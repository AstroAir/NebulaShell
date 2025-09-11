use crate::types::{SystemPerformanceMetrics, SystemMetrics, ConnectionMetrics, ApplicationMetrics};
use crate::ssh::SSHManager;
use crate::transfer::TransferManager;
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct PerformanceMonitor {
    start_time: SystemTime,
    total_connections: u64,
    failed_connections: u64,
    bytes_sent: u64,
    bytes_received: u64,
    completed_transfers: u64,
    failed_transfers: u64,
    websocket_connections: u32,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            start_time: SystemTime::now(),
            total_connections: 0,
            failed_connections: 0,
            bytes_sent: 0,
            bytes_received: 0,
            completed_transfers: 0,
            failed_transfers: 0,
            websocket_connections: 0,
        }
    }

    pub async fn get_metrics(
        &self,
        ssh_manager: &Arc<RwLock<SSHManager>>,
        transfer_manager: &Arc<RwLock<TransferManager>>,
    ) -> SystemPerformanceMetrics {
        let system_metrics = self.get_system_metrics().await;
        let connection_metrics = self.get_connection_metrics(ssh_manager).await;
        let application_metrics = self.get_application_metrics(transfer_manager).await;

        SystemPerformanceMetrics {
            system: system_metrics,
            connections: connection_metrics,
            application: application_metrics,
            timestamp: Utc::now().timestamp_millis(),
        }
    }

    async fn get_system_metrics(&self) -> SystemMetrics {
        // Basic system metrics - in a production system, you'd use a proper system monitoring library
        let uptime = self.start_time
            .elapsed()
            .unwrap_or_default()
            .as_secs();

        // Simulate system metrics (in a real implementation, you'd use system APIs)
        SystemMetrics {
            cpu_usage: self.get_cpu_usage(),
            memory_usage: self.get_memory_usage_percentage(),
            memory_total: self.get_total_memory(),
            memory_used: self.get_used_memory(),
            uptime,
            load_average: self.get_load_average(),
        }
    }

    async fn get_connection_metrics(&self, ssh_manager: &Arc<RwLock<SSHManager>>) -> ConnectionMetrics {
        let manager = ssh_manager.read().await;
        let sessions = manager.list_sessions().await;
        let active_sessions = sessions.len() as u32;

        // Calculate average latency (simplified)
        let average_latency = if active_sessions > 0 {
            // In a real implementation, you'd track actual latencies
            50.0 // Simulated 50ms average
        } else {
            0.0
        };

        ConnectionMetrics {
            active_sessions,
            total_connections: self.total_connections,
            failed_connections: self.failed_connections,
            bytes_sent: self.bytes_sent,
            bytes_received: self.bytes_received,
            average_latency,
        }
    }

    async fn get_application_metrics(&self, transfer_manager: &Arc<RwLock<TransferManager>>) -> ApplicationMetrics {
        let manager = transfer_manager.read().await;
        let transfers = manager.list_transfers();
        
        let active_transfers = transfers.iter()
            .filter(|t| matches!(t.status, crate::types::TransferStatus::InProgress | crate::types::TransferStatus::Pending))
            .count() as u32;

        // Calculate error rate (simplified)
        let total_operations = self.completed_transfers + self.failed_transfers;
        let error_rate = if total_operations > 0 {
            (self.failed_transfers as f64 / total_operations as f64) * 100.0
        } else {
            0.0
        };

        ApplicationMetrics {
            websocket_connections: self.websocket_connections,
            active_transfers,
            completed_transfers: self.completed_transfers,
            failed_transfers: self.failed_transfers,
            cache_hit_rate: 95.0, // Simulated cache hit rate
            error_rate,
        }
    }

    // Simulated system metric functions
    // In a real implementation, these would use proper system APIs
    
    fn get_cpu_usage(&self) -> f64 {
        // Simulate CPU usage between 10-80%
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        SystemTime::now().hash(&mut hasher);
        let hash = hasher.finish();
        
        10.0 + ((hash % 70) as f64)
    }

    fn get_memory_usage_percentage(&self) -> f64 {
        // Simulate memory usage between 30-90%
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() / 10).hash(&mut hasher);
        let hash = hasher.finish();
        
        30.0 + ((hash % 60) as f64)
    }

    fn get_total_memory(&self) -> u64 {
        // Simulate 8GB total memory
        8 * 1024 * 1024 * 1024
    }

    fn get_used_memory(&self) -> u64 {
        let total = self.get_total_memory();
        let usage_percent = self.get_memory_usage_percentage();
        (total as f64 * (usage_percent / 100.0)) as u64
    }

    fn get_load_average(&self) -> Option<Vec<f64>> {
        // Simulate load averages for 1, 5, and 15 minutes
        Some(vec![1.2, 1.5, 1.8])
    }

    // Methods to update metrics (would be called from various parts of the application)
    pub fn increment_connections(&mut self) {
        self.total_connections += 1;
    }

    pub fn increment_failed_connections(&mut self) {
        self.failed_connections += 1;
    }

    pub fn add_bytes_sent(&mut self, bytes: u64) {
        self.bytes_sent += bytes;
    }

    pub fn add_bytes_received(&mut self, bytes: u64) {
        self.bytes_received += bytes;
    }

    pub fn increment_completed_transfers(&mut self) {
        self.completed_transfers += 1;
    }

    pub fn increment_failed_transfers(&mut self) {
        self.failed_transfers += 1;
    }

    pub fn set_websocket_connections(&mut self, count: u32) {
        self.websocket_connections = count;
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ssh::SSHManager;
    use crate::transfer::TransferManager;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[tokio::test]
    async fn test_performance_monitor_creation() {
        let monitor = PerformanceMonitor::new();

        // Test that monitor can be created
        assert_eq!(monitor.total_connections, 0);
        assert_eq!(monitor.failed_connections, 0);
    }

    #[tokio::test]
    async fn test_get_metrics() {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let transfer_manager = Arc::new(RwLock::new(TransferManager::new(ssh_manager.clone())));

        let monitor = PerformanceMonitor::new();
        let metrics = monitor.get_metrics(&ssh_manager, &transfer_manager).await;

        // Test that metrics are returned with valid values
        assert!(metrics.timestamp > 0);
        // uptime is u64 so it's always >= 0, just check it exists
        let _ = metrics.system.uptime;
        assert_eq!(metrics.connections.active_sessions, 0);
        assert_eq!(metrics.application.active_transfers, 0);
    }

    #[test]
    fn test_metric_updates() {
        let mut monitor = PerformanceMonitor::new();

        // Test increment methods
        monitor.increment_connections();
        assert_eq!(monitor.total_connections, 1);

        monitor.increment_failed_connections();
        assert_eq!(monitor.failed_connections, 1);

        monitor.add_bytes_sent(1024);
        assert_eq!(monitor.bytes_sent, 1024);

        monitor.add_bytes_received(512);
        assert_eq!(monitor.bytes_received, 512);

        monitor.increment_completed_transfers();
        assert_eq!(monitor.completed_transfers, 1);

        monitor.increment_failed_transfers();
        assert_eq!(monitor.failed_transfers, 1);

        monitor.set_websocket_connections(5);
        assert_eq!(monitor.websocket_connections, 5);
    }

    #[test]
    fn test_simulated_metrics() {
        let monitor = PerformanceMonitor::new();

        // Test that simulated metrics return reasonable values
        let cpu_usage = monitor.get_cpu_usage();
        assert!(cpu_usage >= 10.0 && cpu_usage <= 80.0);

        let memory_usage = monitor.get_memory_usage_percentage();
        assert!(memory_usage >= 30.0 && memory_usage <= 90.0);

        let total_memory = monitor.get_total_memory();
        assert_eq!(total_memory, 8 * 1024 * 1024 * 1024); // 8GB

        let used_memory = monitor.get_used_memory();
        assert!(used_memory > 0);
        assert!(used_memory <= total_memory);

        let load_avg = monitor.get_load_average();
        assert!(load_avg.is_some());
        if let Some(loads) = load_avg {
            assert_eq!(loads.len(), 3);
        }
    }
}
