use crate::types::{AppError, AppResult, FileTransfer, TransferStatus, TransferDirection};
use crate::ssh::SSHManager;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use uuid::Uuid;

pub type SharedTransferManager = Arc<RwLock<TransferManager>>;

pub struct TransferManager {
    transfers: Arc<DashMap<String, FileTransfer>>,
    ssh_manager: Arc<RwLock<SSHManager>>,
    max_concurrent_transfers: usize,
    active_transfers: usize,
}

impl TransferManager {
    pub fn new(ssh_manager: Arc<RwLock<SSHManager>>) -> Self {
        let manager = Self {
            transfers: Arc::new(DashMap::new()),
            ssh_manager,
            max_concurrent_transfers: 3, // Allow up to 3 concurrent transfers
            active_transfers: 0,
        };

        // Start periodic cleanup task
        manager.start_cleanup_task();
        manager
    }

    fn start_cleanup_task(&self) {
        let transfers = self.transfers.clone();

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(600)); // Clean up every 10 minutes

            loop {
                interval.tick().await;
                Self::periodic_cleanup(&transfers).await;
            }
        });
    }

    async fn periodic_cleanup(transfers: &Arc<DashMap<String, FileTransfer>>) {
        let completed_transfers: Vec<String> = transfers
            .iter()
            .filter(|entry| {
                let transfer = entry.value();
                matches!(transfer.status, TransferStatus::Completed | TransferStatus::Failed | TransferStatus::Cancelled) &&
                transfer.end_time.is_some_and(|end_time| {
                    Utc::now().signed_duration_since(end_time).num_minutes() > 60 // Keep for 1 hour
                })
            })
            .map(|entry| entry.key().clone())
            .collect();

        let removed_count = completed_transfers.len();
        for transfer_id in completed_transfers {
            transfers.remove(&transfer_id);
        }

        if removed_count > 0 {
            log::info!("Periodic cleanup removed {} old completed transfers", removed_count);
        }
    }

    pub fn list_transfers(&self) -> Vec<FileTransfer> {
        self.transfers.iter().map(|entry| entry.value().clone()).collect()
    }

    pub fn get_transfer(&self, transfer_id: &str) -> Option<FileTransfer> {
        self.transfers.get(transfer_id).map(|entry| entry.value().clone())
    }

    pub async fn start_upload(
        &mut self,
        session_id: String,
        remote_path: String,
        name: String,
        content: Vec<u8>,
    ) -> AppResult<String> {
        if self.active_transfers >= self.max_concurrent_transfers {
            return Err(AppError::FileOperationFailed("Too many concurrent transfers".to_string()));
        }

        let transfer_id = Uuid::new_v4().to_string();
        let size = content.len() as u64;

        let transfer = FileTransfer {
            id: transfer_id.clone(),
            session_id: session_id.clone(),
            name,
            remote_path: remote_path.clone(),
            local_path: None,
            size,
            transferred: 0,
            status: TransferStatus::Pending,
            direction: TransferDirection::Upload,
            start_time: Utc::now(),
            end_time: None,
            error: None,
        };

        self.transfers.insert(transfer_id.clone(), transfer.clone());
        self.active_transfers += 1;

        // Start the upload task
        let transfers = self.transfers.clone();
        let ssh_manager = self.ssh_manager.clone();
        let transfer_id_clone = transfer_id.clone();

        tokio::spawn(async move {
            let result = Self::execute_upload(
                ssh_manager,
                transfers.clone(),
                transfer_id_clone.clone(),
                session_id,
                remote_path,
                content,
            ).await;

            // Update transfer status
            if let Some(mut transfer) = transfers.get_mut(&transfer_id_clone) {
                match result {
                    Ok(_) => {
                        transfer.status = TransferStatus::Completed;
                        transfer.transferred = transfer.size;
                        transfer.end_time = Some(Utc::now());
                    }
                    Err(e) => {
                        transfer.status = TransferStatus::Failed;
                        transfer.error = Some(e.to_string());
                        transfer.end_time = Some(Utc::now());
                    }
                }
            }
        });

        Ok(transfer_id)
    }

    pub async fn start_download(
        &mut self,
        session_id: String,
        remote_path: String,
        name: Option<String>,
    ) -> AppResult<String> {
        if self.active_transfers >= self.max_concurrent_transfers {
            return Err(AppError::FileOperationFailed("Too many concurrent transfers".to_string()));
        }

        let transfer_id = Uuid::new_v4().to_string();
        let display_name = name.unwrap_or_else(|| {
            remote_path.split('/').next_back().unwrap_or("download").to_string()
        });

        let transfer = FileTransfer {
            id: transfer_id.clone(),
            session_id: session_id.clone(),
            name: display_name,
            remote_path: remote_path.clone(),
            local_path: None,
            size: 0, // Will be updated when we get the file
            transferred: 0,
            status: TransferStatus::Pending,
            direction: TransferDirection::Download,
            start_time: Utc::now(),
            end_time: None,
            error: None,
        };

        self.transfers.insert(transfer_id.clone(), transfer.clone());
        self.active_transfers += 1;

        // Start the download task
        let transfers = self.transfers.clone();
        let ssh_manager = self.ssh_manager.clone();
        let transfer_id_clone = transfer_id.clone();

        tokio::spawn(async move {
            let result = Self::execute_download(
                ssh_manager,
                transfers.clone(),
                transfer_id_clone.clone(),
                session_id,
                remote_path,
            ).await;

            // Update transfer status
            if let Some(mut transfer) = transfers.get_mut(&transfer_id_clone) {
                match result {
                    Ok(size) => {
                        transfer.status = TransferStatus::Completed;
                        transfer.size = size;
                        transfer.transferred = size;
                        transfer.end_time = Some(Utc::now());
                    }
                    Err(e) => {
                        transfer.status = TransferStatus::Failed;
                        transfer.error = Some(e.to_string());
                        transfer.end_time = Some(Utc::now());
                    }
                }
            }
        });

        Ok(transfer_id)
    }

    async fn execute_upload(
        ssh_manager: Arc<RwLock<SSHManager>>,
        transfers: Arc<DashMap<String, FileTransfer>>,
        transfer_id: String,
        session_id: String,
        remote_path: String,
        content: Vec<u8>,
    ) -> AppResult<()> {
        // Update status to in progress
        if let Some(mut transfer) = transfers.get_mut(&transfer_id) {
            transfer.status = TransferStatus::InProgress;
        }

        let manager = ssh_manager.read().await;
        manager.upload_file(&session_id, &remote_path, &content).await?;

        Ok(())
    }

    async fn execute_download(
        ssh_manager: Arc<RwLock<SSHManager>>,
        transfers: Arc<DashMap<String, FileTransfer>>,
        transfer_id: String,
        session_id: String,
        remote_path: String,
    ) -> AppResult<u64> {
        // Update status to in progress
        if let Some(mut transfer) = transfers.get_mut(&transfer_id) {
            transfer.status = TransferStatus::InProgress;
        }

        let manager = ssh_manager.read().await;
        let content = manager.download_file(&session_id, &remote_path).await?;
        let size = content.len() as u64;

        // For now, we don't actually save the file locally in the Tauri app
        // The content would be returned to the frontend
        
        Ok(size)
    }

    pub fn cancel_transfer(&mut self, transfer_id: &str) -> AppResult<()> {
        if let Some(mut transfer) = self.transfers.get_mut(transfer_id) {
            if matches!(transfer.status, TransferStatus::Pending | TransferStatus::InProgress) {
                transfer.status = TransferStatus::Cancelled;
                transfer.end_time = Some(Utc::now());
                self.active_transfers = self.active_transfers.saturating_sub(1);
            }
        }
        Ok(())
    }

    pub fn cleanup_completed_transfers(&mut self) {
        let completed_transfers: Vec<String> = self.transfers
            .iter()
            .filter(|entry| matches!(
                entry.value().status,
                TransferStatus::Completed | TransferStatus::Failed | TransferStatus::Cancelled
            ))
            .map(|entry| entry.key().clone())
            .collect();

        let removed_count = completed_transfers.len();
        for transfer_id in completed_transfers {
            self.transfers.remove(&transfer_id);
        }

        if removed_count > 0 {
            log::info!("Cleaned up {} completed transfers", removed_count);
        }

        // Recalculate active transfers
        self.active_transfers = self.transfers
            .iter()
            .filter(|entry| matches!(
                entry.value().status,
                TransferStatus::Pending | TransferStatus::InProgress
            ))
            .count();
    }

    pub async fn graceful_shutdown(&mut self) -> AppResult<()> {
        log::info!("Starting graceful shutdown of transfer manager");

        // Cancel all pending and in-progress transfers
        let active_transfer_ids: Vec<String> = self.transfers
            .iter()
            .filter(|entry| matches!(
                entry.value().status,
                TransferStatus::Pending | TransferStatus::InProgress
            ))
            .map(|entry| entry.key().clone())
            .collect();

        for transfer_id in active_transfer_ids {
            if let Err(e) = self.cancel_transfer(&transfer_id) {
                log::error!("Error cancelling transfer {} during shutdown: {}", transfer_id, e);
            }
        }

        // Clear all transfers
        self.transfers.clear();
        self.active_transfers = 0;

        log::info!("Transfer manager shutdown complete");
        Ok(())
    }

    pub fn get_active_transfer_count(&self) -> usize {
        self.active_transfers
    }

    pub fn get_total_transfer_count(&self) -> usize {
        self.transfers.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ssh::SSHManager;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[tokio::test]
    async fn test_transfer_manager_creation() {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let manager = TransferManager::new(ssh_manager);

        assert_eq!(manager.get_active_transfer_count(), 0);
        assert_eq!(manager.get_total_transfer_count(), 0);
    }

    #[tokio::test]
    async fn test_transfer_listing() {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let manager = TransferManager::new(ssh_manager);

        let transfers = manager.list_transfers();
        assert!(transfers.is_empty());
    }

    #[tokio::test]
    async fn test_cleanup_completed_transfers() {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let mut manager = TransferManager::new(ssh_manager);

        // Initially no transfers
        assert_eq!(manager.get_total_transfer_count(), 0);

        // Cleanup should not panic
        manager.cleanup_completed_transfers();
        assert_eq!(manager.get_total_transfer_count(), 0);
    }

    #[tokio::test]
    async fn test_graceful_shutdown() {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let mut manager = TransferManager::new(ssh_manager);

        let result = manager.graceful_shutdown().await;
        assert!(result.is_ok());

        // After shutdown, should have no transfers
        assert_eq!(manager.get_active_transfer_count(), 0);
        assert_eq!(manager.get_total_transfer_count(), 0);
    }

    #[tokio::test]
    async fn test_cancel_nonexistent_transfer() {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let mut manager = TransferManager::new(ssh_manager);

        // Cancelling non-existent transfer should not fail
        let result = manager.cancel_transfer("non-existent-id");
        assert!(result.is_ok());
    }
}
