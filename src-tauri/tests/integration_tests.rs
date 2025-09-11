use app::server::AppServer;
use app::types::*;
use app::ssh::SSHManager;
use app::transfer::TransferManager;
use app::performance::PerformanceMonitor;
use app::optimization::PerformanceOptimizer;
use app::logging::StructuredLogger;
use std::time::Duration;
use tokio::time::sleep;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

#[tokio::test]
async fn test_server_startup_and_health_check() {
    let server = AppServer::new(0); // Use port 0 for automatic assignment
    
    // Test that server can be created without panicking
    assert_eq!(server.get_port(), 0);
    
    // Test graceful shutdown
    let result = server.graceful_shutdown().await;
    assert!(result.is_ok(), "Server should shutdown gracefully");
}

#[tokio::test]
async fn test_ssh_session_lifecycle() {
    // Test SSH session creation, connection, and cleanup
    let ssh_manager = SSHManager::new();
    
    // Create a test SSH configuration
    let config = SSHConnectionConfig {
        hostname: "localhost".to_string(),
        port: 22,
        username: "testuser".to_string(),
        password: Some("testpass".to_string()),
        private_key: None,
        passphrase: None,
    };
    
    // Create session
    let session_result = ssh_manager.create_session(config).await;
    assert!(session_result.is_ok(), "Should be able to create SSH session");
    
    let session = session_result.unwrap();
    let session_id = &session.id;
    
    // Test session exists
    let sessions = ssh_manager.list_sessions().await;
    assert_eq!(sessions.len(), 1, "Should have one session");
    assert_eq!(sessions[0].id, *session_id, "Session ID should match");
    
    // Test session info
    let session_info = ssh_manager.get_session_info(session_id).await;
    assert!(session_info.is_ok(), "Should be able to get session info");
    
    // Test disconnect
    let disconnect_result = ssh_manager.disconnect(session_id).await;
    assert!(disconnect_result.is_ok(), "Should be able to disconnect session");
    
    // Test graceful shutdown
    let shutdown_result = ssh_manager.graceful_shutdown().await;
    assert!(shutdown_result.is_ok(), "SSH manager should shutdown gracefully");
}

#[tokio::test]
async fn test_transfer_manager_lifecycle() {
    let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
    let mut transfer_manager = TransferManager::new(ssh_manager);
    
    // Test initial state
    assert_eq!(transfer_manager.get_active_transfer_count(), 0);
    assert_eq!(transfer_manager.get_total_transfer_count(), 0);
    
    // Test listing transfers (should be empty)
    let transfers = transfer_manager.list_transfers();
    assert!(transfers.is_empty(), "Should have no transfers initially");
    
    // Test cleanup
    transfer_manager.cleanup_completed_transfers();
    assert_eq!(transfer_manager.get_total_transfer_count(), 0);
    
    // Test graceful shutdown
    let shutdown_result = transfer_manager.graceful_shutdown().await;
    assert!(shutdown_result.is_ok(), "Transfer manager should shutdown gracefully");
}

#[tokio::test]
async fn test_performance_monitoring() {
    let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
    let transfer_manager = Arc::new(RwLock::new(TransferManager::new(ssh_manager.clone())));

    let monitor = PerformanceMonitor::new();
    let metrics = monitor.get_metrics(&ssh_manager, &transfer_manager).await;
    
    // Test that metrics are returned
    assert!(metrics.timestamp > 0, "Should have a valid timestamp");
    assert!(metrics.system.uptime > 0, "Should have uptime");
    assert_eq!(metrics.connections.active_sessions, 0, "Should have no active sessions initially");
    assert_eq!(metrics.application.active_transfers, 0, "Should have no active transfers initially");
}

#[tokio::test]
async fn test_performance_optimization() {
    let optimizer = PerformanceOptimizer::new();
    
    // Test initial state
    let summary = optimizer.get_performance_summary();
    assert_eq!(summary.active_connections, 0, "Should have no active connections initially");
    assert_eq!(summary.active_tasks, 0, "Should have no active tasks initially");
    assert!(summary.memory_usage_bytes > 0, "Should have some memory usage");
    
    // Test connection acquisition
    let connection_result = optimizer.connection_pool.acquire_connection("test-session").await;
    assert!(connection_result.is_ok(), "Should be able to acquire connection");
    
    let _permit = connection_result.unwrap();
    
    // Test that active connection count increased
    assert_eq!(optimizer.connection_pool.get_active_count(), 1, "Should have one active connection");
    
    // Connection should be released when permit is dropped
    drop(_permit);
    
    // Give a moment for cleanup
    sleep(Duration::from_millis(10)).await;
}

#[tokio::test]
async fn test_error_handling() {
    let ssh_manager = SSHManager::new();
    
    // Test error when getting non-existent session
    let result = ssh_manager.get_session("non-existent-id").await;
    assert!(result.is_err(), "Should return error for non-existent session");
    
    if let Err(error) = result {
        assert_eq!(error.error_code(), "SESSION_NOT_FOUND");
        assert!(error.to_string().contains("non-existent-id"));
    }
    
    // Test error when disconnecting non-existent session
    let disconnect_result = ssh_manager.disconnect("non-existent-id").await;
    // Disconnect should not fail for non-existent sessions (graceful handling)
    assert!(disconnect_result.is_ok(), "Disconnect should handle non-existent sessions gracefully");
}

#[tokio::test]
async fn test_autocomplete_functionality() {
    let ssh_manager = SSHManager::new();
    
    // Create a test session (won't actually connect)
    let config = SSHConnectionConfig {
        hostname: "localhost".to_string(),
        port: 22,
        username: "testuser".to_string(),
        password: Some("testpass".to_string()),
        private_key: None,
        passphrase: None,
    };
    
    let session = ssh_manager.create_session(config).await.unwrap();
    
    // Test autocomplete suggestions (should work even without actual SSH connection)
    let suggestions_result = ssh_manager.get_autocomplete_suggestions(&session.id, "l", 1).await;
    
    // This will fail because there's no actual SSH connection, but we can test the error handling
    assert!(suggestions_result.is_err(), "Should fail without SSH connection");
    
    if let Err(error) = suggestions_result {
        assert_eq!(error.error_code(), "CONNECTION_FAILED");
    }
}

#[tokio::test]
async fn test_structured_logging() {
    
    // Test error logging
    let error = AppError::SessionNotFound("test-session".to_string());
    let mut metadata = HashMap::new();
    metadata.insert("test_key".to_string(), "test_value".to_string());
    
    // This should not panic
    StructuredLogger::log_error(&error, Some("test context"), Some(metadata));
    
    // Test connection logging
    let mut details = HashMap::new();
    details.insert("host".to_string(), "localhost".to_string());
    StructuredLogger::log_connection_event("test_connect", "test-session", Some(details));
    
    // Test performance logging
    StructuredLogger::log_performance_metric("test_metric", 42.0, "ms", None);
    
    // Test security logging
    let mut security_details = HashMap::new();
    security_details.insert("event".to_string(), "test_event".to_string());
    StructuredLogger::log_security_event("test_security", "info", security_details);
}

#[tokio::test]
async fn test_websocket_client_structure() {
    // Test that WebSocket client structure can be created
    // This is mainly a compilation test since WebSocketClient is private
    
    // We can test the public WebSocket handler indirectly by testing the server
    let server = AppServer::new(0);
    
    // Test that server can be created (which includes WebSocket setup)
    assert_eq!(server.get_port(), 0);
    
    // Test graceful shutdown
    let result = server.graceful_shutdown().await;
    assert!(result.is_ok(), "Server should shutdown gracefully");
}

#[tokio::test]
async fn test_cross_platform_compatibility() {
    // Test that core functionality works across platforms
    
    // Test SSH manager creation (should work on all platforms)
    let ssh_manager = SSHManager::new();
    assert_eq!(ssh_manager.get_active_session_count(), 0);
    
    // Test server creation (should work on all platforms)
    let server = AppServer::new(0);
    assert_eq!(server.get_port(), 0);
    
    // Test performance optimizer (should work on all platforms)
    let optimizer = PerformanceOptimizer::new();
    let summary = optimizer.get_performance_summary();
    assert!(summary.memory_usage_bytes > 0);
    
    // Cleanup
    let _ = server.graceful_shutdown().await;
}
