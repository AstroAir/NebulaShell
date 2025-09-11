use crate::types::{AppError, AppResult, SSHSession};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SessionMetrics {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub commands_executed: u32,
    pub connection_time: chrono::DateTime<Utc>,
    pub last_activity: chrono::DateTime<Utc>,
}

impl Default for SessionMetrics {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            bytes_sent: 0,
            bytes_received: 0,
            commands_executed: 0,
            connection_time: now,
            last_activity: now,
        }
    }
}

#[allow(dead_code)]
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, SSHSession>>>,
    metrics: Arc<RwLock<HashMap<String, SessionMetrics>>>,
}

#[allow(dead_code)]
impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_session(&self, session: SSHSession) -> AppResult<()> {
        let mut sessions = self.sessions.write().await;
        let mut metrics = self.metrics.write().await;
        
        sessions.insert(session.id.clone(), session.clone());
        metrics.insert(session.id.clone(), SessionMetrics::default());
        
        log::info!("Session added to manager: {}", session.id);
        Ok(())
    }

    pub async fn remove_session(&self, session_id: &str) -> AppResult<()> {
        let mut sessions = self.sessions.write().await;
        let mut metrics = self.metrics.write().await;
        
        sessions.remove(session_id);
        metrics.remove(session_id);
        
        log::info!("Session removed from manager: {}", session_id);
        Ok(())
    }

    pub async fn get_session(&self, session_id: &str) -> AppResult<SSHSession> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id)
            .cloned()
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))
    }

    pub async fn update_session(&self, session: SSHSession) -> AppResult<()> {
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session);
        Ok(())
    }

    pub async fn list_sessions(&self) -> Vec<SSHSession> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }

    pub async fn update_last_activity(&self, session_id: &str) -> AppResult<()> {
        let mut sessions = self.sessions.write().await;
        let mut metrics = self.metrics.write().await;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.last_activity = Utc::now();
        }
        
        if let Some(metric) = metrics.get_mut(session_id) {
            metric.last_activity = Utc::now();
        }
        
        Ok(())
    }

    pub async fn update_metrics(&self, session_id: &str, bytes_sent: u64, bytes_received: u64) -> AppResult<()> {
        let mut metrics = self.metrics.write().await;
        
        if let Some(metric) = metrics.get_mut(session_id) {
            metric.bytes_sent += bytes_sent;
            metric.bytes_received += bytes_received;
            metric.last_activity = Utc::now();
        }
        
        Ok(())
    }

    pub async fn increment_command_count(&self, session_id: &str) -> AppResult<()> {
        let mut metrics = self.metrics.write().await;
        
        if let Some(metric) = metrics.get_mut(session_id) {
            metric.commands_executed += 1;
            metric.last_activity = Utc::now();
        }
        
        Ok(())
    }

    pub async fn get_metrics(&self, session_id: &str) -> AppResult<SessionMetrics> {
        let metrics = self.metrics.read().await;
        metrics.get(session_id)
            .cloned()
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))
    }

    pub async fn cleanup_inactive_sessions(&self, timeout_minutes: u64) -> AppResult<Vec<String>> {
        let mut sessions = self.sessions.write().await;
        let mut metrics = self.metrics.write().await;
        let cutoff = Utc::now() - chrono::Duration::minutes(timeout_minutes as i64);
        
        let mut removed_sessions = Vec::new();
        
        sessions.retain(|id, session| {
            if session.last_activity < cutoff {
                removed_sessions.push(id.clone());
                false
            } else {
                true
            }
        });
        
        for session_id in &removed_sessions {
            metrics.remove(session_id);
        }
        
        if !removed_sessions.is_empty() {
            log::info!("Cleaned up {} inactive sessions", removed_sessions.len());
        }
        
        Ok(removed_sessions)
    }

    pub async fn get_session_count(&self) -> usize {
        let sessions = self.sessions.read().await;
        sessions.len()
    }

    pub async fn is_session_connected(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        sessions.get(session_id)
            .map(|s| s.connected)
            .unwrap_or(false)
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
