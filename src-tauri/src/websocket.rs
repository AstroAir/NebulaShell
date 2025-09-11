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
        WebSocketEvent::MobileOptimize(_) => {
            // TODO: Implement mobile optimization
            log::info!("Mobile optimization requested (not implemented yet)");
        }
        WebSocketEvent::PerformanceMetrics(_) => {
            // TODO: Implement performance metrics
            log::info!("Performance metrics received (not implemented yet)");
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
