use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{interval, Duration};
use dashmap::DashMap;
use std::collections::HashMap;
use serde::Serialize;

// Connection pool for managing SSH connections efficiently
pub struct ConnectionPool {
    max_connections: usize,
    active_connections: Arc<Semaphore>,
    connection_stats: Arc<DashMap<String, ConnectionStats>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionStats {
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_used: chrono::DateTime<chrono::Utc>,
    pub usage_count: u64,
    pub bytes_transferred: u64,
}

impl ConnectionPool {
    pub fn new(max_connections: usize) -> Self {
        Self {
            max_connections,
            active_connections: Arc::new(Semaphore::new(max_connections)),
            connection_stats: Arc::new(DashMap::new()),
        }
    }

    pub async fn acquire_connection(&self, session_id: &str) -> Result<ConnectionPermit, String> {
        // Try to acquire a connection permit
        let permit = self.active_connections
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| "Failed to acquire connection permit")?;

        // Update or create connection stats
        let now = chrono::Utc::now();
        self.connection_stats
            .entry(session_id.to_string())
            .and_modify(|stats| {
                stats.last_used = now;
                stats.usage_count += 1;
            })
            .or_insert(ConnectionStats {
                created_at: now,
                last_used: now,
                usage_count: 1,
                bytes_transferred: 0,
            });

        Ok(ConnectionPermit {
            _permit: permit,
            session_id: session_id.to_string(),
            stats: self.connection_stats.clone(),
        })
    }

    pub fn get_stats(&self) -> HashMap<String, ConnectionStats> {
        self.connection_stats
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect()
    }

    pub fn get_active_count(&self) -> usize {
        self.max_connections - self.active_connections.available_permits()
    }
}

pub struct ConnectionPermit {
    _permit: tokio::sync::OwnedSemaphorePermit,
    session_id: String,
    stats: Arc<DashMap<String, ConnectionStats>>,
}

impl ConnectionPermit {
    pub fn add_bytes_transferred(&self, bytes: u64) {
        if let Some(mut stats) = self.stats.get_mut(&self.session_id) {
            stats.bytes_transferred += bytes;
        }
    }
}

impl Drop for ConnectionPermit {
    fn drop(&mut self) {
        // Update last used time when connection is released
        if let Some(mut stats) = self.stats.get_mut(&self.session_id) {
            stats.last_used = chrono::Utc::now();
        }
    }
}

// Memory management utilities
pub struct MemoryManager {
    max_memory_usage: usize,
    cleanup_interval: Duration,
}

impl MemoryManager {
    pub fn new(max_memory_mb: usize) -> Self {
        let manager = Self {
            max_memory_usage: max_memory_mb * 1024 * 1024, // Convert to bytes
            cleanup_interval: Duration::from_secs(300), // 5 minutes
        };
        
        manager.start_memory_monitor();
        manager
    }

    fn start_memory_monitor(&self) {
        let cleanup_interval = self.cleanup_interval;
        let max_memory = self.max_memory_usage;
        
        tokio::spawn(async move {
            let mut interval = interval(cleanup_interval);
            
            loop {
                interval.tick().await;
                Self::check_memory_usage(max_memory).await;
            }
        });
    }

    async fn check_memory_usage(max_memory: usize) {
        // In a real implementation, you would check actual memory usage
        // For now, we'll simulate memory monitoring
        let current_usage = Self::get_memory_usage();
        
        if current_usage > max_memory {
            log::warn!("Memory usage ({} bytes) exceeds limit ({} bytes), triggering cleanup", 
                      current_usage, max_memory);
            Self::trigger_garbage_collection().await;
        }
    }

    fn get_memory_usage() -> usize {
        // Simulate memory usage - in a real implementation, you'd use system APIs
        // or memory profiling libraries
        std::process::id() as usize * 1024 // Placeholder
    }

    async fn trigger_garbage_collection() {
        // Force garbage collection and cleanup
        log::info!("Triggering memory cleanup");
        
        // In Rust, we don't have explicit GC, but we can:
        // 1. Clear caches
        // 2. Drop unused connections
        // 3. Compact data structures
        
        // This is a placeholder for actual cleanup logic
        tokio::task::yield_now().await;
    }
}

// Async task manager for better resource utilization
pub struct TaskManager {
    max_concurrent_tasks: usize,
    task_semaphore: Arc<Semaphore>,
    task_stats: Arc<DashMap<String, TaskStats>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskStats {
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub task_type: String,
    pub status: TaskStatus,
}

#[derive(Debug, Clone, Serialize)]
pub enum TaskStatus {
    Running,
    Completed,
    Failed(String),
}

impl TaskManager {
    pub fn new(max_concurrent_tasks: usize) -> Self {
        Self {
            max_concurrent_tasks,
            task_semaphore: Arc::new(Semaphore::new(max_concurrent_tasks)),
            task_stats: Arc::new(DashMap::new()),
        }
    }

    pub async fn spawn_task<F, T>(&self, task_id: String, task_type: String, future: F) -> Result<T, String>
    where
        F: std::future::Future<Output = T> + Send + 'static,
        T: Send + 'static,
    {
        // Acquire task permit
        let _permit = self.task_semaphore
            .acquire()
            .await
            .map_err(|_| "Failed to acquire task permit")?;

        // Record task start
        self.task_stats.insert(task_id.clone(), TaskStats {
            started_at: chrono::Utc::now(),
            task_type: task_type.clone(),
            status: TaskStatus::Running,
        });

        // Execute the task
        let result = future.await;

        // Update task completion
        if let Some(mut stats) = self.task_stats.get_mut(&task_id) {
            stats.status = TaskStatus::Completed;
        }

        Ok(result)
    }

    pub fn get_active_task_count(&self) -> usize {
        self.max_concurrent_tasks - self.task_semaphore.available_permits()
    }

    pub fn get_task_stats(&self) -> HashMap<String, TaskStats> {
        self.task_stats
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect()
    }
}

// Performance optimizer that coordinates all optimization components
pub struct PerformanceOptimizer {
    pub connection_pool: ConnectionPool,
    pub memory_manager: MemoryManager,
    pub task_manager: TaskManager,
}

impl PerformanceOptimizer {
    pub fn new() -> Self {
        Self {
            connection_pool: ConnectionPool::new(50), // Max 50 concurrent connections
            memory_manager: MemoryManager::new(512), // 512MB memory limit
            task_manager: TaskManager::new(20), // Max 20 concurrent tasks
        }
    }

    pub fn get_performance_summary(&self) -> PerformanceSummary {
        PerformanceSummary {
            active_connections: self.connection_pool.get_active_count(),
            active_tasks: self.task_manager.get_active_task_count(),
            memory_usage_bytes: MemoryManager::get_memory_usage(),
            connection_stats: self.connection_pool.get_stats(),
            task_stats: self.task_manager.get_task_stats(),
        }
    }
}

#[derive(Debug)]
pub struct PerformanceSummary {
    pub active_connections: usize,
    pub active_tasks: usize,
    pub memory_usage_bytes: usize,
    pub connection_stats: HashMap<String, ConnectionStats>,
    pub task_stats: HashMap<String, TaskStats>,
}

impl Default for PerformanceOptimizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_connection_pool_creation() {
        let pool = ConnectionPool::new(10);
        assert_eq!(pool.get_active_count(), 0);
        assert!(pool.get_stats().is_empty());
    }

    #[tokio::test]
    async fn test_connection_acquisition() {
        let pool = ConnectionPool::new(2);

        // Acquire first connection
        let permit1 = pool.acquire_connection("session1").await;
        assert!(permit1.is_ok());
        assert_eq!(pool.get_active_count(), 1);

        // Acquire second connection
        let permit2 = pool.acquire_connection("session2").await;
        assert!(permit2.is_ok());
        assert_eq!(pool.get_active_count(), 2);

        // Check stats
        let stats = pool.get_stats();
        assert_eq!(stats.len(), 2);
        assert!(stats.contains_key("session1"));
        assert!(stats.contains_key("session2"));

        // Drop permits to release connections
        drop(permit1);
        drop(permit2);

        // Give a moment for cleanup
        sleep(Duration::from_millis(10)).await;
    }

    #[tokio::test]
    async fn test_connection_permit_bytes_tracking() {
        let pool = ConnectionPool::new(1);
        let permit = pool.acquire_connection("test-session").await.unwrap();

        // Add bytes transferred
        permit.add_bytes_transferred(1024);

        // Check that stats are updated
        let stats = pool.get_stats();
        let session_stats = stats.get("test-session").unwrap();
        assert_eq!(session_stats.bytes_transferred, 1024);
        assert_eq!(session_stats.usage_count, 1);
    }

    #[tokio::test]
    async fn test_memory_manager_creation() {
        let manager = MemoryManager::new(512); // 512MB
        assert_eq!(manager.max_memory_usage, 512 * 1024 * 1024);
    }

    #[test]
    fn test_memory_usage_simulation() {
        let usage = MemoryManager::get_memory_usage();
        assert!(usage > 0, "Memory usage should be greater than 0");
    }

    #[tokio::test]
    async fn test_task_manager_creation() {
        let manager = TaskManager::new(5);
        assert_eq!(manager.get_active_task_count(), 0);
        assert!(manager.get_task_stats().is_empty());
    }

    #[tokio::test]
    async fn test_task_execution() {
        let manager = TaskManager::new(2);

        // Spawn a simple task
        let result = manager.spawn_task(
            "test-task".to_string(),
            "test".to_string(),
            async { 42 }
        ).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);

        // Check task stats
        let stats = manager.get_task_stats();
        assert!(stats.contains_key("test-task"));

        let task_stat = stats.get("test-task").unwrap();
        assert_eq!(task_stat.task_type, "test");
        assert!(matches!(task_stat.status, TaskStatus::Completed));
    }

    #[tokio::test]
    async fn test_performance_optimizer_creation() {
        let optimizer = PerformanceOptimizer::new();

        let summary = optimizer.get_performance_summary();
        assert_eq!(summary.active_connections, 0);
        assert_eq!(summary.active_tasks, 0);
        assert!(summary.memory_usage_bytes > 0);
        assert!(summary.connection_stats.is_empty());
        assert!(summary.task_stats.is_empty());
    }

    #[tokio::test]
    async fn test_performance_optimizer_integration() {
        let optimizer = PerformanceOptimizer::new();

        // Test connection acquisition
        let permit = optimizer.connection_pool.acquire_connection("test").await;
        assert!(permit.is_ok());

        let summary = optimizer.get_performance_summary();
        assert_eq!(summary.active_connections, 1);
        assert_eq!(summary.connection_stats.len(), 1);

        drop(permit);

        // Give a moment for cleanup
        sleep(Duration::from_millis(10)).await;
    }
}
