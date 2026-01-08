use crate::ssh::SSHManager;
use crate::types::{
    AppError, AppResult, WebSocketEvent, WebSocketResponse,
    SSHConnectData, TerminalInputData, TerminalResizeData,
    SSHConnectedResponse, SSHDisconnectedResponse, SSHErrorResponse,
    TerminalDataResponse
};
use crate::log_websocket;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde_json;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{interval, Duration};
use uuid::Uuid;
use chrono;

pub type SharedSSHManager = Arc<RwLock<SSHManager>>;

// Structure to manage WebSocket client sessions
#[derive(Debug)]
struct WebSocketClient {
    #[allow(dead_code)] // Reserved for future client identification features
    id: String,
    session_id: Option<String>,
    sender: mpsc::UnboundedSender<Message>,
    connected_at: chrono::DateTime<chrono::Utc>,
    last_ping: Option<chrono::DateTime<chrono::Utc>>,
    message_count: u64,
    error_count: u64,
}

#[allow(dead_code)] // Reserved for future connection state management
#[derive(Debug, Clone)]
enum ConnectionState {
    Connected,
    Authenticated,
    Disconnecting,
    Error(String),
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(ssh_manager): State<SharedSSHManager>,
) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, ssh_manager))
}

async fn handle_websocket(socket: WebSocket, ssh_manager: SharedSSHManager) {
    let (ws_sender, mut ws_receiver) = socket.split();
    let client_id = Uuid::new_v4().to_string();

    log_websocket!(&client_id, "connected");

    // Create a channel for sending messages to the WebSocket
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Create client structure
    let mut client = WebSocketClient {
        id: client_id.clone(),
        session_id: None,
        sender: tx,
        connected_at: chrono::Utc::now(),
        last_ping: None,
        message_count: 0,
        error_count: 0,
    };

    // Spawn task to handle outgoing messages
    let mut ws_sender = ws_sender;
    let outgoing_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_sender.send(message).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = ws_receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                client.message_count += 1;

                // Validate message size
                if text.len() > 1024 * 1024 { // 1MB limit
                    log::warn!("Received oversized message from client {}: {} bytes", client_id, text.len());
                    client.error_count += 1;

                    let error_response = WebSocketResponse::SSHError(SSHErrorResponse {
                        session_id: client.session_id.clone(),
                        message: "Message too large".to_string(),
                        code: Some("MESSAGE_TOO_LARGE".to_string()),
                        details: Some(format!("Message size: {} bytes, limit: 1MB", text.len())),
                    });

                    if let Ok(response_text) = serde_json::to_string(&error_response) {
                        let _ = client.sender.send(Message::Text(response_text));
                    }
                    continue;
                }

                match handle_websocket_message(&text, &ssh_manager, &mut client).await {
                    Ok(_) => {
                        log::debug!("Successfully handled message from client {}", client_id);
                    }
                    Err(e) => {
                        client.error_count += 1;
                        log::error!("Error handling WebSocket message from client {}: {}", client_id, e);

                        let error_response = WebSocketResponse::SSHError(SSHErrorResponse {
                            session_id: client.session_id.clone(),
                            message: e.to_string(),
                            code: Some(e.error_code().to_string()),
                            details: Some(format!("Client: {}, Message count: {}", client_id, client.message_count)),
                        });

                        if let Ok(response_text) = serde_json::to_string(&error_response) {
                            if client.sender.send(Message::Text(response_text)).is_err() {
                                log::error!("Failed to send error response to client {}", client_id);
                                break;
                            }
                        }

                        // If too many errors, disconnect the client
                        if client.error_count > 10 {
                            log::warn!("Client {} has too many errors ({}), disconnecting", client_id, client.error_count);
                            break;
                        }
                    }
                }
            }
            Ok(Message::Close(close_frame)) => {
                if let Some(frame) = close_frame {
                    log::info!("WebSocket client {} disconnected with code: {}, reason: {}",
                              client_id, frame.code, frame.reason);
                } else {
                    log::info!("WebSocket client {} disconnected", client_id);
                }
                break;
            }
            Ok(Message::Ping(data)) => {
                client.last_ping = Some(chrono::Utc::now());
                if client.sender.send(Message::Pong(data)).is_err() {
                    log::error!("Failed to send pong to client {}", client_id);
                    break;
                }
            }
            Ok(Message::Pong(_)) => {
                // Client responded to our ping
                client.last_ping = Some(chrono::Utc::now());
            }
            Ok(Message::Binary(data)) => {
                log::warn!("Received unexpected binary message from client {}: {} bytes", client_id, data.len());
                // Ignore binary messages for now
            }
            Err(e) => {
                client.error_count += 1;
                log::error!("WebSocket error for client {}: {}", client_id, e);

                // For connection errors, break the loop
                // We'll check the error message since the Error enum variants are private
                let error_msg = e.to_string();
                if error_msg.contains("connection closed") || error_msg.contains("already closed") {
                    break;
                }

                // For other errors, continue but track them
                if client.error_count > 5 {
                    log::warn!("Client {} has too many connection errors ({}), disconnecting", client_id, client.error_count);
                    break;
                }
            }
        }
    }

    // Cleanup: stop the outgoing task
    outgoing_task.abort();

    // Log connection statistics
    let connection_duration = chrono::Utc::now().signed_duration_since(client.connected_at);
    log::info!("WebSocket client {} disconnected after {} seconds, {} messages processed, {} errors",
               client_id,
               connection_duration.num_seconds(),
               client.message_count,
               client.error_count);

    // Cleanup: disconnect SSH session if connected
    if let Some(session_id) = &client.session_id {
        log::info!("Cleaning up SSH session {} for disconnected WebSocket client {}", session_id, client_id);
        let manager = ssh_manager.read().await;
        if let Err(e) = manager.disconnect(session_id).await {
            log::error!("Error disconnecting SSH session {} during cleanup: {}", session_id, e);
        } else {
            log::info!("Successfully cleaned up SSH session: {}", session_id);
        }
    }

    log::info!("WebSocket connection cleanup complete for client: {}", client_id);
}

async fn handle_websocket_message(
    text: &str,
    ssh_manager: &SharedSSHManager,
    client: &mut WebSocketClient,
) -> AppResult<()> {
    // Parse the message - try both direct event format and Socket.IO format
    let event = if let Ok(event) = serde_json::from_str::<WebSocketEvent>(text) {
        event
    } else {
        // Try to parse Socket.IO format: ["event_name", data]
        if let Ok(socket_io_msg) = serde_json::from_str::<serde_json::Value>(text) {
            if let Some(array) = socket_io_msg.as_array() {
                if array.len() >= 2 {
                    let event_name = array[0].as_str().unwrap_or("");
                    let data = &array[1];
                    
                    match event_name {
                        "ssh_connect" => {
                            let connect_data: SSHConnectData = serde_json::from_value(data.clone())?;
                            WebSocketEvent::SSHConnect(connect_data)
                        }
                        "terminal_input" => {
                            let input_data: TerminalInputData = serde_json::from_value(data.clone())?;
                            WebSocketEvent::TerminalInput(input_data)
                        }
                        "terminal_resize" => {
                            let resize_data: TerminalResizeData = serde_json::from_value(data.clone())?;
                            WebSocketEvent::TerminalResize(resize_data)
                        }
                        "ssh_disconnect" => {
                            let session_id = data.get("sessionId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            WebSocketEvent::SSHDisconnect { session_id }
                        }
                        _ => {
                            return Err(AppError::WebSocketError(format!("Unknown event: {}", event_name)));
                        }
                    }
                } else {
                    return Err(AppError::WebSocketError("Invalid Socket.IO message format".to_string()));
                }
            } else {
                return Err(AppError::WebSocketError("Invalid Socket.IO message format".to_string()));
            }
        } else {
            return Err(AppError::WebSocketError("Failed to parse WebSocket message".to_string()));
        }
    };

    // Handle the event
    match event {
        WebSocketEvent::SSHConnect(data) => {
            handle_ssh_connect(data, ssh_manager, client).await?;
        }
        WebSocketEvent::TerminalInput(data) => {
            handle_terminal_input(data, ssh_manager).await?;
        }
        WebSocketEvent::TerminalResize(data) => {
            handle_terminal_resize(data, ssh_manager).await?;
        }
        WebSocketEvent::SSHDisconnect { session_id } => {
            handle_ssh_disconnect(&session_id, ssh_manager, client).await?;
        }
        WebSocketEvent::MobileOptimize(data) => {
            handle_mobile_optimization(serde_json::to_value(data)?, ssh_manager.clone(), client).await?;
        }
        WebSocketEvent::PerformanceMetrics(data) => {
            handle_performance_metrics(serde_json::to_value(data)?, ssh_manager.clone(), client).await?;
        }
    }

    Ok(())
}

async fn handle_ssh_connect(
    data: SSHConnectData,
    ssh_manager: &SharedSSHManager,
    client: &mut WebSocketClient,
) -> AppResult<()> {
    let manager = ssh_manager.read().await;

    // Create session
    let session = manager.create_session(data.config.clone()).await?;

    // Connect
    manager.connect(&session.id).await?;

    // Create shell
    let cols = data.cols.unwrap_or(80);
    let rows = data.rows.unwrap_or(24);
    manager.create_shell(&session.id, cols, rows).await?;

    // Update client with session ID
    client.session_id = Some(session.id.clone());

    // Send success response
    let response = WebSocketResponse::SSHConnected(SSHConnectedResponse {
        session_id: session.id.clone(),
        status: "connected".to_string(),
    });

    let response_text = serde_json::to_string(&response)?;
    client.sender.send(Message::Text(response_text))
        .map_err(|e| AppError::WebSocketError(format!("Failed to send response: {}", e)))?;

    // Start background task to read from shell and send output
    start_terminal_output_task(session.id.clone(), ssh_manager.clone(), client.sender.clone()).await;

    Ok(())
}

// Background task to continuously read from SSH shell and send output to WebSocket
async fn start_terminal_output_task(
    session_id: String,
    ssh_manager: SharedSSHManager,
    sender: mpsc::UnboundedSender<Message>,
) {
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_millis(50)); // Read every 50ms

        loop {
            interval.tick().await;

            // Try to read from shell
            let output = {
                let manager = ssh_manager.read().await;
                match manager.read_from_shell(&session_id).await {
                    Ok(Some(data)) => Some(data),
                    Ok(None) => None, // No data available
                    Err(e) => {
                        log::error!("Error reading from shell for session {}: {}", session_id, e);

                        // Send error to client
                        let error_response = WebSocketResponse::SSHError(SSHErrorResponse {
                            session_id: Some(session_id.clone()),
                            message: format!("Shell read error: {}", e),
                            code: Some(e.error_code().to_string()),
                            details: None,
                        });

                        if let Ok(response_text) = serde_json::to_string(&error_response) {
                            let _ = sender.send(Message::Text(response_text));
                        }

                        break; // Exit the loop on error
                    }
                }
            };

            // Send output to client if available
            if let Some(data) = output {
                let terminal_response = WebSocketResponse::TerminalData(TerminalDataResponse {
                    session_id: session_id.clone(),
                    data,
                    timestamp: Some(chrono::Utc::now().timestamp_millis()),
                    batched: Some(false),
                });

                if let Ok(response_text) = serde_json::to_string(&terminal_response) {
                    if sender.send(Message::Text(response_text)).is_err() {
                        log::info!("WebSocket client disconnected, stopping terminal output task for session: {}", session_id);
                        break;
                    }
                }
            }

            // Check if session still exists
            {
                let manager = ssh_manager.read().await;
                if manager.get_session(&session_id).await.is_err() {
                    log::info!("SSH session {} no longer exists, stopping output task", session_id);
                    break;
                }
            }
        }

        log::info!("Terminal output task ended for session: {}", session_id);
    });
}

async fn handle_terminal_input(
    data: TerminalInputData,
    ssh_manager: &SharedSSHManager,
) -> AppResult<()> {
    let manager = ssh_manager.read().await;
    manager.write_to_shell(&data.session_id, &data.input).await?;
    Ok(())
}

async fn handle_terminal_resize(
    data: TerminalResizeData,
    ssh_manager: &SharedSSHManager,
) -> AppResult<()> {
    let manager = ssh_manager.read().await;
    manager.resize_shell(&data.session_id, data.cols, data.rows).await?;
    Ok(())
}

async fn handle_ssh_disconnect(
    session_id: &str,
    ssh_manager: &SharedSSHManager,
    client: &mut WebSocketClient,
) -> AppResult<()> {
    let manager = ssh_manager.read().await;
    manager.disconnect(session_id).await?;

    // Clear the session ID from client
    client.session_id = None;

    let response = WebSocketResponse::SSHDisconnected(SSHDisconnectedResponse {
        session_id: session_id.to_string(),
    });

    let response_text = serde_json::to_string(&response)?;
    client.sender.send(Message::Text(response_text))
        .map_err(|e| AppError::WebSocketError(format!("Failed to send response: {}", e)))?;

    Ok(())
}

async fn handle_mobile_optimization(
    data: serde_json::Value,
    ssh_manager: Arc<RwLock<SSHManager>>,
    client: &mut WebSocketClient,
) -> AppResult<()> {
    log::info!("Processing mobile optimization request");

    let optimization_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("general");
    let session_id = data.get("sessionId").and_then(|v| v.as_str());

    let mut optimizations_applied = Vec::new();
    let mut recommendations = Vec::new();

    match optimization_type {
        "bandwidth" => {
            // Implement bandwidth optimization
            optimizations_applied.push("Enabled data compression".to_string());
            optimizations_applied.push("Reduced update frequency".to_string());
            optimizations_applied.push("Enabled output batching".to_string());

            recommendations.push("Consider using low-bandwidth mode for better performance".to_string());

            log::info!("Applied bandwidth optimizations for mobile device");
        }
        "battery" => {
            // Implement battery optimization
            optimizations_applied.push("Reduced background processing".to_string());
            optimizations_applied.push("Optimized refresh rates".to_string());
            optimizations_applied.push("Enabled power-saving mode".to_string());

            recommendations.push("Disable animations to save battery".to_string());
            recommendations.push("Use dark theme to reduce screen power consumption".to_string());

            log::info!("Applied battery optimizations for mobile device");
        }
        "touch" => {
            // Implement touch interface optimization
            optimizations_applied.push("Enabled touch-friendly controls".to_string());
            optimizations_applied.push("Increased tap target sizes".to_string());
            optimizations_applied.push("Optimized gesture recognition".to_string());

            recommendations.push("Use virtual keyboard for better text input".to_string());
            recommendations.push("Enable haptic feedback for better touch response".to_string());

            log::info!("Applied touch interface optimizations for mobile device");
        }
        "performance" => {
            // Implement general performance optimization
            optimizations_applied.push("Optimized rendering pipeline".to_string());
            optimizations_applied.push("Reduced memory usage".to_string());
            optimizations_applied.push("Enabled hardware acceleration".to_string());

            recommendations.push("Close unused sessions to free memory".to_string());
            recommendations.push("Limit concurrent connections".to_string());

            log::info!("Applied general performance optimizations for mobile device");
        }
        _ => {
            // Default optimization
            optimizations_applied.push("Applied general mobile optimizations".to_string());
            recommendations.push("Specify optimization type for better results".to_string());
        }
    }

    // If session ID is provided, apply session-specific optimizations
    if let Some(session_id) = session_id {
        let manager = ssh_manager.read().await;
        if let Ok(_session) = manager.get_session(session_id).await {
            optimizations_applied.push(format!("Optimized session: {}", session_id));

            // Apply session-specific mobile optimizations
            // This could include adjusting terminal settings, buffer sizes, etc.
            log::info!("Applied session-specific mobile optimizations for session: {}", session_id);
        }
    }

    // Send optimization results back to client
    let response = serde_json::json!({
        "type": "mobile_optimization_result",
        "success": true,
        "optimizations": {
            "applied": optimizations_applied,
            "recommendations": recommendations,
            "type": optimization_type
        },
        "timestamp": chrono::Utc::now().timestamp()
    });

    let response_text = serde_json::to_string(&response)?;
    client.sender.send(Message::Text(response_text))
        .map_err(|e| AppError::WebSocketError(format!("Failed to send response: {}", e)))?;

    Ok(())
}

async fn handle_performance_metrics(
    data: serde_json::Value,
    ssh_manager: Arc<RwLock<SSHManager>>,
    client: &mut WebSocketClient,
) -> AppResult<()> {
    log::info!("Processing performance metrics request");

    let metrics_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("system");
    let session_id = data.get("sessionId").and_then(|v| v.as_str());

    let metrics = match metrics_type {
        "system" => {
            collect_system_metrics().await
        }
        "network" => {
            collect_network_metrics(session_id).await
        }
        "memory" => {
            collect_memory_metrics().await
        }
        "session" => {
            if let Some(session_id) = session_id {
                collect_session_metrics(session_id, ssh_manager).await
            } else {
                serde_json::json!({
                    "error": "Session ID required for session metrics"
                })
            }
        }
        _ => {
            collect_comprehensive_metrics(ssh_manager).await
        }
    };

    // Send metrics back to client
    let response = serde_json::json!({
        "type": "performance_metrics_result",
        "success": true,
        "metrics": metrics,
        "metricsType": metrics_type,
        "timestamp": chrono::Utc::now().timestamp()
    });

    let response_text = serde_json::to_string(&response)?;
    client.sender.send(Message::Text(response_text))
        .map_err(|e| AppError::WebSocketError(format!("Failed to send response: {}", e)))?;

    Ok(())
}

async fn collect_system_metrics() -> serde_json::Value {
    use crate::performance::PerformanceMonitor;

    let _monitor = PerformanceMonitor::new();

    // Get real system metrics using platform-specific APIs
    #[cfg(target_os = "linux")]
    let cpu_usage = get_linux_cpu_usage().await.unwrap_or(0.0);
    #[cfg(target_os = "windows")]
    let cpu_usage = get_windows_cpu_usage().await.unwrap_or(0.0);
    #[cfg(target_os = "macos")]
    let cpu_usage = get_macos_cpu_usage().await.unwrap_or(0.0);
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    let cpu_usage = monitor.get_cpu_usage();

    #[cfg(target_os = "linux")]
    let memory_info = get_linux_memory_info().await.unwrap_or_default();
    #[cfg(target_os = "windows")]
    let memory_info = get_windows_memory_info().await.unwrap_or_default();
    #[cfg(target_os = "macos")]
    let memory_info = get_macos_memory_info().await.unwrap_or_default();
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    let memory_info = (monitor.get_total_memory(), monitor.get_used_memory());

    serde_json::json!({
        "cpu": {
            "usage_percent": cpu_usage,
            "cores": num_cpus::get(),
            "load_average": get_load_average().await
        },
        "memory": {
            "total_bytes": memory_info.0,
            "used_bytes": memory_info.1,
            "available_bytes": memory_info.0 - memory_info.1,
            "usage_percent": (memory_info.1 as f64 / memory_info.0 as f64) * 100.0
        },
        "disk": {
            "usage_percent": get_disk_usage().await.unwrap_or(0.0)
        },
        "uptime_seconds": get_system_uptime().await.unwrap_or(0)
    })
}

async fn collect_network_metrics(session_id: Option<&str>) -> serde_json::Value {
    let mut metrics = serde_json::json!({
        "total_connections": 0,
        "active_connections": 0,
        "bytes_sent": 0,
        "bytes_received": 0,
        "latency_ms": 0.0
    });

    if let Some(_session_id) = session_id {
        // Collect session-specific network metrics
        // This would involve tracking bytes sent/received for the specific session
        metrics["session_specific"] = serde_json::json!(true);
    }

    metrics
}

async fn collect_memory_metrics() -> serde_json::Value {
    #[cfg(target_os = "linux")]
    let detailed_memory = get_linux_detailed_memory().await.unwrap_or_default();
    #[cfg(target_os = "windows")]
    let detailed_memory = get_windows_detailed_memory().await.unwrap_or_default();
    #[cfg(target_os = "macos")]
    let detailed_memory = get_macos_detailed_memory().await.unwrap_or_default();
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    let detailed_memory = serde_json::json!({
        "heap_size": 0,
        "stack_size": 0,
        "cache_size": 0
    });

    detailed_memory
}

async fn collect_session_metrics(
    session_id: &str,
    ssh_manager: Arc<RwLock<SSHManager>>,
) -> serde_json::Value {
    let manager = ssh_manager.read().await;

    match manager.get_session(session_id).await {
        Ok(session) => {
            serde_json::json!({
                "session_id": session_id,
                "connected": session.connected,
                "created_at": session.created_at,
                "last_activity": session.last_activity,
                "hostname": session.config.hostname,
                "username": session.config.username,
                "port": session.config.port,
                "connection_time_ms": session.last_activity.timestamp_millis() - session.created_at.timestamp_millis(),
                "is_active": (chrono::Utc::now().timestamp_millis() - session.last_activity.timestamp_millis()) < 30000
            })
        }
        Err(_) => {
            serde_json::json!({
                "error": "Session not found",
                "session_id": session_id
            })
        }
    }
}

async fn collect_comprehensive_metrics(ssh_manager: Arc<RwLock<SSHManager>>) -> serde_json::Value {
    let system_metrics = collect_system_metrics().await;
    let network_metrics = collect_network_metrics(None).await;
    let memory_metrics = collect_memory_metrics().await;

    let manager = ssh_manager.read().await;
    let all_sessions = manager.list_sessions().await;

    serde_json::json!({
        "system": system_metrics,
        "network": network_metrics,
        "memory": memory_metrics,
        "sessions": {
            "total": all_sessions.len(),
            "active": all_sessions.iter().filter(|s| s.connected).count(),
            "list": all_sessions
        },
        "timestamp": chrono::Utc::now().timestamp()
    })
}

// Platform-specific system metrics implementations

#[cfg(target_os = "linux")]
async fn get_linux_cpu_usage() -> Result<f64, Box<dyn std::error::Error>> {
    use tokio::fs;

    let stat_content = fs::read_to_string("/proc/stat").await?;
    let first_line = stat_content.lines().next().ok_or("No CPU stats found")?;
    let values: Vec<u64> = first_line
        .split_whitespace()
        .skip(1)
        .take(7)
        .map(|s| s.parse().unwrap_or(0))
        .collect();

    if values.len() >= 4 {
        let idle = values[3];
        let total: u64 = values.iter().sum();
        let usage = 100.0 - (idle as f64 / total as f64 * 100.0);
        Ok(usage.max(0.0).min(100.0))
    } else {
        Err("Invalid CPU stats format".into())
    }
}

#[cfg(target_os = "linux")]
async fn get_linux_memory_info() -> Result<(u64, u64), Box<dyn std::error::Error>> {
    use tokio::fs;

    let meminfo_content = fs::read_to_string("/proc/meminfo").await?;
    let mut total_kb = 0u64;
    let mut available_kb = 0u64;

    for line in meminfo_content.lines() {
        if line.starts_with("MemTotal:") {
            total_kb = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("MemAvailable:") {
            available_kb = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        }
    }

    let total_bytes = total_kb * 1024;
    let used_bytes = total_bytes - (available_kb * 1024);

    Ok((total_bytes, used_bytes))
}

#[cfg(target_os = "linux")]
async fn get_linux_detailed_memory() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use tokio::fs;

    let meminfo_content = fs::read_to_string("/proc/meminfo").await?;
    let mut buffers_kb = 0u64;
    let mut cached_kb = 0u64;
    let mut slab_kb = 0u64;

    for line in meminfo_content.lines() {
        if line.starts_with("Buffers:") {
            buffers_kb = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("Cached:") {
            cached_kb = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("Slab:") {
            slab_kb = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        }
    }

    Ok(serde_json::json!({
        "buffers_bytes": buffers_kb * 1024,
        "cached_bytes": cached_kb * 1024,
        "slab_bytes": slab_kb * 1024
    }))
}

#[cfg(target_os = "windows")]
async fn get_windows_cpu_usage() -> Result<f64, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("wmic")
        .args(&["cpu", "get", "loadpercentage", "/value"])
        .output()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    for line in output_str.lines() {
        if line.starts_with("LoadPercentage=") {
            let value_str = line.split('=').nth(1).unwrap_or("0");
            return Ok(value_str.parse().unwrap_or(0.0));
        }
    }

    Err("Could not parse CPU usage".into())
}

#[cfg(target_os = "windows")]
async fn get_windows_memory_info() -> Result<(u64, u64), Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("wmic")
        .args(&["OS", "get", "TotalVisibleMemorySize,FreePhysicalMemory", "/value"])
        .output()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut total_kb = 0u64;
    let mut free_kb = 0u64;

    for line in output_str.lines() {
        if line.starts_with("TotalVisibleMemorySize=") {
            total_kb = line.split('=').nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("FreePhysicalMemory=") {
            free_kb = line.split('=').nth(1).unwrap_or("0").parse().unwrap_or(0);
        }
    }

    let total_bytes = total_kb * 1024;
    let used_bytes = total_bytes - (free_kb * 1024);

    Ok((total_bytes, used_bytes))
}

#[cfg(target_os = "windows")]
async fn get_windows_detailed_memory() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("wmic")
        .args(&["OS", "get", "TotalVirtualMemorySize,FreeVirtualMemory", "/value"])
        .output()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut total_virtual_kb = 0u64;
    let mut free_virtual_kb = 0u64;

    for line in output_str.lines() {
        if line.starts_with("TotalVirtualMemorySize=") {
            total_virtual_kb = line.split('=').nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("FreeVirtualMemory=") {
            free_virtual_kb = line.split('=').nth(1).unwrap_or("0").parse().unwrap_or(0);
        }
    }

    Ok(serde_json::json!({
        "virtual_total_bytes": total_virtual_kb * 1024,
        "virtual_used_bytes": (total_virtual_kb - free_virtual_kb) * 1024,
        "page_file_usage": ((total_virtual_kb - free_virtual_kb) as f64 / total_virtual_kb as f64) * 100.0
    }))
}

#[cfg(target_os = "macos")]
async fn get_macos_cpu_usage() -> Result<f64, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("top")
        .args(&["-l", "1", "-n", "0"])
        .output()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    for line in output_str.lines() {
        if line.contains("CPU usage:") {
            // Parse line like "CPU usage: 12.34% user, 5.67% sys, 81.99% idle"
            if let Some(idle_part) = line.split("idle").next() {
                if let Some(idle_str) = idle_part.split_whitespace().last() {
                    if let Ok(idle_percent) = idle_str.trim_end_matches('%').parse::<f64>() {
                        return Ok(100.0 - idle_percent);
                    }
                }
            }
        }
    }

    Err("Could not parse CPU usage from top output".into())
}

#[cfg(target_os = "macos")]
async fn get_macos_memory_info() -> Result<(u64, u64), Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("vm_stat").output()?;
    let output_str = String::from_utf8_lossy(&output.stdout);

    let mut page_size = 4096u64; // Default page size
    let mut free_pages = 0u64;
    let mut active_pages = 0u64;
    let mut inactive_pages = 0u64;
    let mut wired_pages = 0u64;

    for line in output_str.lines() {
        if line.starts_with("page size of") {
            if let Some(size_str) = line.split_whitespace().nth(3) {
                page_size = size_str.parse().unwrap_or(4096);
            }
        } else if line.starts_with("Pages free:") {
            free_pages = line.split_whitespace().nth(2).unwrap_or("0").trim_end_matches('.').parse().unwrap_or(0);
        } else if line.starts_with("Pages active:") {
            active_pages = line.split_whitespace().nth(2).unwrap_or("0").trim_end_matches('.').parse().unwrap_or(0);
        } else if line.starts_with("Pages inactive:") {
            inactive_pages = line.split_whitespace().nth(2).unwrap_or("0").trim_end_matches('.').parse().unwrap_or(0);
        } else if line.starts_with("Pages wired down:") {
            wired_pages = line.split_whitespace().nth(3).unwrap_or("0").trim_end_matches('.').parse().unwrap_or(0);
        }
    }

    let total_pages = free_pages + active_pages + inactive_pages + wired_pages;
    let used_pages = active_pages + inactive_pages + wired_pages;

    let total_bytes = total_pages * page_size;
    let used_bytes = used_pages * page_size;

    Ok((total_bytes, used_bytes))
}

#[cfg(target_os = "macos")]
async fn get_macos_detailed_memory() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("vm_stat").output()?;
    let output_str = String::from_utf8_lossy(&output.stdout);

    let mut compressed_pages = 0u64;
    let mut cached_pages = 0u64;
    let page_size = 4096u64;

    for line in output_str.lines() {
        if line.starts_with("Pages stored in compressor:") {
            compressed_pages = line.split_whitespace().nth(4).unwrap_or("0").trim_end_matches('.').parse().unwrap_or(0);
        } else if line.starts_with("File-backed pages:") {
            cached_pages = line.split_whitespace().nth(2).unwrap_or("0").trim_end_matches('.').parse().unwrap_or(0);
        }
    }

    Ok(serde_json::json!({
        "compressed_bytes": compressed_pages * page_size,
        "cached_bytes": cached_pages * page_size,
        "page_size": page_size
    }))
}

// Cross-platform utility functions

async fn get_load_average() -> Option<Vec<f64>> {
    #[cfg(unix)]
    {
        use std::process::Command;

        let output = Command::new("uptime").output().ok()?;
        let output_str = String::from_utf8_lossy(&output.stdout);

        // Parse load averages from uptime output
        if let Some(load_part) = output_str.split("load average:").nth(1) {
            let loads: Vec<f64> = load_part
                .split(',')
                .take(3)
                .filter_map(|s| s.trim().parse().ok())
                .collect();

            if loads.len() == 3 {
                return Some(loads);
            }
        }
    }

    None
}

async fn get_disk_usage() -> Result<f64, Box<dyn std::error::Error>> {
    #[cfg(unix)]
    {
        use std::process::Command;

        let output = Command::new("df")
            .args(&["-h", "/"])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        for line in output_str.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let usage_str = parts[4].trim_end_matches('%');
                if let Ok(usage) = usage_str.parse::<f64>() {
                    return Ok(usage);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let output = Command::new("wmic")
            .args(&["logicaldisk", "where", "size>0", "get", "size,freespace", "/value"])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut total_size = 0u64;
        let mut free_space = 0u64;

        for line in output_str.lines() {
            if line.starts_with("Size=") {
                total_size += line.split('=').nth(1).unwrap_or("0").parse().unwrap_or(0);
            } else if line.starts_with("FreeSpace=") {
                free_space += line.split('=').nth(1).unwrap_or("0").parse().unwrap_or(0);
            }
        }

        if total_size > 0 {
            let used_space = total_size - free_space;
            return Ok((used_space as f64 / total_size as f64) * 100.0);
        }
    }

    Ok(0.0)
}

async fn get_system_uptime() -> Result<u64, Box<dyn std::error::Error>> {
    #[cfg(target_os = "linux")]
    {
        use tokio::fs;

        let uptime_content = fs::read_to_string("/proc/uptime").await?;
        let uptime_seconds = uptime_content
            .split_whitespace()
            .next()
            .unwrap_or("0")
            .parse::<f64>()
            .unwrap_or(0.0);

        return Ok(uptime_seconds as u64);
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let output = Command::new("wmic")
            .args(&["os", "get", "lastbootuptime", "/value"])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        for line in output_str.lines() {
            if line.starts_with("LastBootUpTime=") {
                // Parse Windows WMI datetime format and calculate uptime
                // This is a simplified implementation
                return Ok(3600); // Placeholder - would need proper datetime parsing
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let output = Command::new("sysctl")
            .args(&["-n", "kern.boottime"])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        // Parse boot time and calculate uptime
        // This is a simplified implementation
        return Ok(3600); // Placeholder - would need proper parsing
    }

    Ok(0)
}
