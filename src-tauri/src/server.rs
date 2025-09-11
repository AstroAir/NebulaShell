use crate::ssh::SSHManager;
use crate::websocket::{websocket_handler, SharedSSHManager};
use crate::transfer::{TransferManager, SharedTransferManager};
use crate::performance::PerformanceMonitor;
use crate::optimization::PerformanceOptimizer;
use crate::security::{SecurityManager, SecurityConfig};
use crate::recording::{RecordingManager, RecordingConfig};
use crate::types::{AppError, AppResult, SSHSession, FileListRequest, FileListResponse, FileInfo, FileDownloadRequest, FileUploadRequest, TransferUploadRequest, TransferDownloadRequest, AutocompleteRequest, AutocompleteResponse, MobileSessionRequest, MobileSessionResponse, SystemPerformanceMetrics};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use base64::{Engine as _, engine::general_purpose};

#[derive(Clone)]
pub struct AppState {
    pub ssh_manager: SharedSSHManager,
    pub transfer_manager: SharedTransferManager,
    pub performance_monitor: Arc<RwLock<PerformanceMonitor>>,
    pub performance_optimizer: Arc<PerformanceOptimizer>,
    pub security_manager: Arc<SecurityManager>,
    pub recording_manager: Arc<RecordingManager>,
}

pub struct AppServer {
    ssh_manager: SharedSSHManager,
    transfer_manager: SharedTransferManager,
    performance_monitor: Arc<RwLock<PerformanceMonitor>>,
    performance_optimizer: Arc<PerformanceOptimizer>,
    security_manager: Arc<SecurityManager>,
    recording_manager: Arc<RecordingManager>,
    port: u16,
}

impl AppServer {
    pub async fn new(port: u16) -> AppResult<Self> {
        let ssh_manager = Arc::new(RwLock::new(SSHManager::new()));
        let transfer_manager = Arc::new(RwLock::new(TransferManager::new(ssh_manager.clone())));
        let performance_monitor = Arc::new(RwLock::new(PerformanceMonitor::new()));
        let performance_optimizer = Arc::new(PerformanceOptimizer::new());
        let security_manager = Arc::new(SecurityManager::new(SecurityConfig::default()));
        let recording_manager = Arc::new(RecordingManager::new(RecordingConfig::default()).await?);

        Ok(Self {
            ssh_manager,
            transfer_manager,
            performance_monitor,
            performance_optimizer,
            security_manager,
            recording_manager,
            port,
        })
    }

    pub async fn start(&self) -> AppResult<()> {
        let app = self.create_router();
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        
        log::info!("Starting HTTP server on {}", addr);
        
        let listener = tokio::net::TcpListener::bind(addr).await
            .map_err(AppError::IOError)?;
            
        axum::serve(listener, app).await
            .map_err(|e| AppError::IOError(std::io::Error::other(e)))?;
        
        Ok(())
    }

    fn create_router(&self) -> Router {
        Router::new()
            // WebSocket endpoint
            .route("/socket.io/", get(websocket_handler_wrapper))
            .route("/ws", get(websocket_handler_wrapper))
            
            // SSH API endpoints
            .route("/api/ssh/sessions", get(list_sessions))
            .route("/api/ssh/connect", post(connect_ssh))
            .route("/api/ssh/disconnect/:session_id", post(disconnect_ssh))
            
            // SFTP API endpoints
            .route("/api/sftp/list", post(list_files))
            .route("/api/sftp/upload", post(upload_file))
            .route("/api/sftp/download", post(download_file))
            
            // File transfer endpoints
            .route("/api/file-transfer/list", get(list_transfers))
            .route("/api/file-transfer/upload", post(upload_file_transfer))
            .route("/api/file-transfer/download", post(download_file_transfer))
            
            // Terminal endpoints
            .route("/api/terminal/autocomplete", post(terminal_autocomplete))
            
            // Mobile endpoints
            .route("/api/mobile/session", post(mobile_session))
            
            // Performance endpoints
            .route("/api/performance/monitor", get(performance_monitor))
            .route("/api/performance/optimization", get(performance_optimization))

            // Security monitoring
            .route("/api/security/stats", get(security_stats))

            // Recording management
            .route("/api/recording/stats", get(recording_stats))
            .route("/api/recording/search", post(search_recordings))
            .route("/api/recording/:id/metadata", get(get_recording_metadata))
            .route("/api/recording/:id/events", get(get_recording_events))
            
            // Health check
            .route("/health", get(health_check))
            
            .layer(
                ServiceBuilder::new()
                    .layer(CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any))
            )
            .with_state(AppState {
                ssh_manager: self.ssh_manager.clone(),
                transfer_manager: self.transfer_manager.clone(),
                performance_monitor: self.performance_monitor.clone(),
                performance_optimizer: self.performance_optimizer.clone(),
                security_manager: self.security_manager.clone(),
                recording_manager: self.recording_manager.clone(),
            })
    }

    #[allow(dead_code)]
    pub fn get_port(&self) -> u16 {
        self.port
    }

    pub async fn graceful_shutdown(&self) -> AppResult<()> {
        log::info!("Starting graceful shutdown of application server");

        // Shutdown SSH manager
        {
            let ssh_manager = self.ssh_manager.read().await;
            if let Err(e) = ssh_manager.graceful_shutdown().await {
                log::error!("Error during SSH manager shutdown: {}", e);
            }
        }

        // Shutdown transfer manager
        {
            let mut transfer_manager = self.transfer_manager.write().await;
            if let Err(e) = transfer_manager.graceful_shutdown().await {
                log::error!("Error during transfer manager shutdown: {}", e);
            }
        }

        log::info!("Application server shutdown complete");
        Ok(())
    }
}

// API Handlers

async fn websocket_handler_wrapper(
    ws: axum::extract::WebSocketUpgrade,
    State(state): State<AppState>,
) -> axum::response::Response {
    websocket_handler(ws, State(state.ssh_manager)).await
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().timestamp()
    }))
}

async fn list_sessions(
    State(state): State<AppState>,
) -> Result<Json<Vec<SSHSession>>, StatusCode> {
    let manager = state.ssh_manager.read().await;
    let sessions = manager.list_sessions().await;
    Ok(Json(sessions))
}

#[derive(Deserialize)]
struct ConnectRequest {
    config: crate::types::SSHConnectionConfig,
}

#[derive(Serialize)]
struct ConnectResponse {
    success: bool,
    session_id: Option<String>,
    error: Option<String>,
}

async fn connect_ssh(
    State(state): State<AppState>,
    Json(request): Json<ConnectRequest>,
) -> Json<ConnectResponse> {
    let manager = state.ssh_manager.read().await;
    
    match manager.create_session(request.config).await {
        Ok(session) => {
            match manager.connect(&session.id).await {
                Ok(_) => Json(ConnectResponse {
                    success: true,
                    session_id: Some(session.id),
                    error: None,
                }),
                Err(e) => Json(ConnectResponse {
                    success: false,
                    session_id: None,
                    error: Some(e.to_string()),
                }),
            }
        }
        Err(e) => Json(ConnectResponse {
            success: false,
            session_id: None,
            error: Some(e.to_string()),
        }),
    }
}

#[derive(Serialize)]
struct DisconnectResponse {
    success: bool,
    error: Option<String>,
}

async fn disconnect_ssh(
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> Json<DisconnectResponse> {
    let manager = state.ssh_manager.read().await;
    
    match manager.disconnect(&session_id).await {
        Ok(_) => Json(DisconnectResponse {
            success: true,
            error: None,
        }),
        Err(e) => Json(DisconnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

async fn list_files(
    State(state): State<AppState>,
    Json(request): Json<FileListRequest>,
) -> Json<FileListResponse> {
    log::info!("File listing requested for session: {}, path: {}", request.session_id, request.path);

    let manager = state.ssh_manager.read().await;

    match manager.list_directory(&request.session_id, &request.path).await {
        Ok(sftp_files) => {
            // Convert SftpFileInfo to FileInfo
            let files: Vec<FileInfo> = sftp_files.into_iter().map(|sftp_file| {
                FileInfo {
                    name: sftp_file.name,
                    size: sftp_file.size,
                    is_directory: sftp_file.is_directory,
                    permissions: sftp_file.permissions.unwrap_or_else(|| "unknown".to_string()),
                    last_modified: sftp_file.modified
                        .and_then(|timestamp| chrono::DateTime::from_timestamp(timestamp, 0))
                        .unwrap_or_else(chrono::Utc::now),
                }
            }).collect();

            Json(FileListResponse {
                files,
                path: request.path,
            })
        }
        Err(e) => {
            log::error!("Failed to list files: {}", e);
            Json(FileListResponse {
                files: vec![],
                path: request.path,
            })
        }
    }
}

async fn upload_file(
    State(state): State<AppState>,
    Json(request): Json<FileUploadRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("File upload requested for session: {}, path: {}", request.session_id, request.remote_path);

    // Decode base64 content
    let contents = match general_purpose::STANDARD.decode(&request.content) {
        Ok(data) => data,
        Err(e) => {
            log::error!("Failed to decode base64 content: {}", e);
            return Ok(Json(serde_json::json!({
                "success": false,
                "error": "Invalid base64 content"
            })));
        }
    };

    let manager = state.ssh_manager.read().await;

    match manager.upload_file(&request.session_id, &request.remote_path, &contents).await {
        Ok(_) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "size": contents.len()
            })))
        }
        Err(e) => {
            log::error!("Failed to upload file: {}", e);
            Ok(Json(serde_json::json!({
                "success": false,
                "error": format!("Upload failed: {}", e)
            })))
        }
    }
}

async fn download_file(
    State(state): State<AppState>,
    Json(request): Json<FileDownloadRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("File download requested for session: {}, path: {}", request.session_id, request.remote_path);

    let manager = state.ssh_manager.read().await;

    match manager.download_file(&request.session_id, &request.remote_path).await {
        Ok(contents) => {
            // Encode file contents as base64
            let encoded_content = general_purpose::STANDARD.encode(&contents);

            Ok(Json(serde_json::json!({
                "success": true,
                "content": encoded_content,
                "size": contents.len()
            })))
        }
        Err(e) => {
            log::error!("Failed to download file: {}", e);
            Ok(Json(serde_json::json!({
                "success": false,
                "error": format!("Download failed: {}", e)
            })))
        }
    }
}

async fn list_transfers(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let manager = state.transfer_manager.read().await;
    let transfers = manager.list_transfers();
    Json(serde_json::json!({
        "transfers": transfers
    }))
}

async fn upload_file_transfer(
    State(state): State<AppState>,
    Json(request): Json<TransferUploadRequest>,
) -> Json<serde_json::Value> {
    log::info!("File transfer upload requested for session: {}, path: {}", request.session_id, request.remote_path);

    // Decode base64 content
    let contents = match general_purpose::STANDARD.decode(&request.content) {
        Ok(data) => data,
        Err(e) => {
            log::error!("Failed to decode base64 content: {}", e);
            return Json(serde_json::json!({
                "success": false,
                "error": "Invalid base64 content"
            }));
        }
    };

    let mut manager = state.transfer_manager.write().await;

    match manager.start_upload(
        request.session_id,
        request.remote_path,
        request.name,
        contents,
    ).await {
        Ok(transfer_id) => {
            Json(serde_json::json!({
                "success": true,
                "transferId": transfer_id
            }))
        }
        Err(e) => {
            log::error!("Failed to start upload: {}", e);
            Json(serde_json::json!({
                "success": false,
                "error": format!("Upload failed: {}", e)
            }))
        }
    }
}

async fn download_file_transfer(
    State(state): State<AppState>,
    Json(request): Json<TransferDownloadRequest>,
) -> Json<serde_json::Value> {
    log::info!("File transfer download requested for session: {}, path: {}", request.session_id, request.remote_path);

    let mut manager = state.transfer_manager.write().await;

    match manager.start_download(
        request.session_id,
        request.remote_path,
        request.name,
    ).await {
        Ok(transfer_id) => {
            Json(serde_json::json!({
                "success": true,
                "transferId": transfer_id
            }))
        }
        Err(e) => {
            log::error!("Failed to start download: {}", e);
            Json(serde_json::json!({
                "success": false,
                "error": format!("Download failed: {}", e)
            }))
        }
    }
}

async fn terminal_autocomplete(
    State(state): State<AppState>,
    Json(request): Json<AutocompleteRequest>,
) -> Json<AutocompleteResponse> {
    log::info!("Terminal autocomplete requested for session: {}, input: '{}'", request.session_id, request.input);

    let manager = state.ssh_manager.read().await;

    match manager.get_autocomplete_suggestions(&request.session_id, &request.input, request.cursor_position).await {
        Ok(suggestions) => {
            // Extract the prefix for the current word
            let chars: Vec<char> = request.input.chars().collect();
            let cursor_pos = request.cursor_position.min(chars.len());

            let mut start = cursor_pos;
            while start > 0 && !chars[start - 1].is_whitespace() {
                start -= 1;
            }

            let prefix: String = chars[start..cursor_pos].iter().collect();

            Json(AutocompleteResponse {
                suggestions,
                prefix,
                cursor_position: request.cursor_position,
            })
        }
        Err(e) => {
            log::error!("Failed to get autocomplete suggestions: {}", e);
            Json(AutocompleteResponse {
                suggestions: vec![],
                prefix: String::new(),
                cursor_position: request.cursor_position,
            })
        }
    }
}

async fn mobile_session(
    State(_state): State<AppState>,
    Json(request): Json<MobileSessionRequest>,
) -> Json<MobileSessionResponse> {
    log::info!("Mobile session optimization requested for device: {} ({}x{})",
               request.device_info.platform,
               request.device_info.screen_width,
               request.device_info.screen_height);

    // Generate recommendations based on device info
    let mut recommendations = Vec::new();
    let mut applied_optimizations = request.optimizations.clone();

    // Analyze device characteristics and provide recommendations
    if request.device_info.screen_width < 768 {
        recommendations.push("Consider using compact terminal layout for small screens".to_string());
        applied_optimizations.increase_touch_targets = true;
    }

    if request.device_info.is_tablet {
        recommendations.push("Tablet detected: enabling split-screen optimizations".to_string());
        applied_optimizations.optimize_scrolling = true;
    }

    if request.device_info.platform == "ios" || request.device_info.platform == "android" {
        recommendations.push("Mobile platform detected: enabling battery optimizations".to_string());
        applied_optimizations.battery_optimization = true;
        applied_optimizations.reduce_network_usage = true;
    }

    if request.device_info.pixel_ratio > 2.0 {
        recommendations.push("High DPI display detected: optimizing for crisp text rendering".to_string());
    }

    if !request.device_info.supports_touch {
        recommendations.push("Non-touch device: optimizing for keyboard navigation".to_string());
    } else {
        recommendations.push("Touch device: enabling gesture controls".to_string());
        applied_optimizations.increase_touch_targets = true;
    }

    // Apply performance optimizations based on device capabilities
    if request.device_info.screen_width < 480 || request.device_info.screen_height < 800 {
        applied_optimizations.reduce_animations = true;
        recommendations.push("Small screen detected: reducing animations for better performance".to_string());
    }

    Json(MobileSessionResponse {
        success: true,
        session_id: request.session_id,
        applied_optimizations,
        recommendations,
        error: None,
    })
}

async fn performance_monitor(
    State(state): State<AppState>,
) -> Json<SystemPerformanceMetrics> {
    log::info!("Performance monitoring requested");

    let monitor = state.performance_monitor.read().await;
    let metrics = monitor.get_metrics(&state.ssh_manager, &state.transfer_manager).await;

    Json(metrics)
}

async fn performance_optimization(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    log::info!("Performance optimization metrics requested");

    let summary = state.performance_optimizer.get_performance_summary();

    Json(serde_json::json!({
        "active_connections": summary.active_connections,
        "active_tasks": summary.active_tasks,
        "memory_usage_bytes": summary.memory_usage_bytes,
        "memory_usage_mb": summary.memory_usage_bytes / (1024 * 1024),
        "connection_stats": summary.connection_stats,
        "task_stats": summary.task_stats,
        "optimization_enabled": true,
        "recommendations": generate_performance_recommendations(&summary)
    }))
}

fn generate_performance_recommendations(summary: &crate::optimization::PerformanceSummary) -> Vec<String> {
    let mut recommendations = Vec::new();

    if summary.active_connections > 40 {
        recommendations.push("High connection count detected. Consider implementing connection pooling.".to_string());
    }

    if summary.active_tasks > 15 {
        recommendations.push("High task count detected. Consider task queuing or rate limiting.".to_string());
    }

    let memory_mb = summary.memory_usage_bytes / (1024 * 1024);
    if memory_mb > 400 {
        recommendations.push("High memory usage detected. Consider implementing memory cleanup.".to_string());
    }

    if recommendations.is_empty() {
        recommendations.push("System performance is optimal.".to_string());
    }

    recommendations
}

async fn security_stats(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    log::info!("Security statistics requested");

    let stats = state.security_manager.get_security_stats().await;

    Json(serde_json::json!({
        "total_events": stats.total_events,
        "events_last_hour": stats.events_last_hour,
        "events_last_day": stats.events_last_day,
        "active_rate_limits": stats.active_rate_limits,
        "locked_accounts": stats.locked_accounts,
        "active_connections": stats.active_connections,
        "critical_events_last_day": stats.critical_events_last_day,
        "security_status": if stats.critical_events_last_day > 0 { "ALERT" } else { "OK" },
        "recommendations": generate_security_recommendations(&stats)
    }))
}

fn generate_security_recommendations(stats: &crate::security::SecurityStats) -> Vec<String> {
    let mut recommendations = Vec::new();

    if stats.critical_events_last_day > 0 {
        recommendations.push("Critical security events detected in the last 24 hours. Review security logs immediately.".to_string());
    }

    if stats.locked_accounts > 0 {
        recommendations.push(format!("{} accounts are currently locked due to failed login attempts.", stats.locked_accounts));
    }

    if stats.active_rate_limits > 10 {
        recommendations.push("High number of rate-limited IPs detected. Consider reviewing access patterns.".to_string());
    }

    if stats.active_connections > 50 {
        recommendations.push("High number of active connections. Monitor for potential DDoS activity.".to_string());
    }

    if stats.events_last_hour > 100 {
        recommendations.push("High security event volume in the last hour. Review for suspicious activity.".to_string());
    }

    if recommendations.is_empty() {
        recommendations.push("Security status is normal. No immediate action required.".to_string());
    }

    recommendations
}

async fn recording_stats(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    log::info!("Recording statistics requested");

    let stats = state.recording_manager.get_recording_stats().await;

    Json(serde_json::json!({
        "total_recordings": stats.total_recordings,
        "active_recordings": stats.active_recordings,
        "recent_recordings": stats.recent_recordings,
        "weekly_recordings": stats.weekly_recordings,
        "total_size_bytes": stats.total_size_bytes,
        "total_size_mb": stats.total_size_mb,
        "total_duration_seconds": stats.total_duration_seconds,
        "average_duration_seconds": stats.average_duration_seconds,
        "storage_efficiency": if stats.total_recordings > 0 {
            stats.total_size_mb as f64 / stats.total_recordings as f64
        } else {
            0.0
        }
    }))
}

async fn search_recordings(
    State(state): State<AppState>,
    Json(criteria): Json<crate::recording::RecordingSearchCriteria>,
) -> Json<serde_json::Value> {
    log::info!("Recording search requested with criteria: {:?}", criteria);

    match state.recording_manager.search_recordings(criteria).await {
        Ok(recordings) => Json(serde_json::json!({
            "success": true,
            "recordings": recordings,
            "count": recordings.len()
        })),
        Err(error) => Json(serde_json::json!({
            "success": false,
            "error": error.to_string()
        }))
    }
}

async fn get_recording_metadata(
    State(state): State<AppState>,
    Path(recording_id): Path<String>,
) -> Json<serde_json::Value> {
    log::info!("Recording metadata requested for: {}", recording_id);

    match state.recording_manager.get_recording_metadata(&recording_id).await {
        Ok(Some(metadata)) => Json(serde_json::json!({
            "success": true,
            "metadata": metadata
        })),
        Ok(None) => Json(serde_json::json!({
            "success": false,
            "error": "Recording not found"
        })),
        Err(error) => Json(serde_json::json!({
            "success": false,
            "error": error.to_string()
        }))
    }
}

async fn get_recording_events(
    State(state): State<AppState>,
    Path(recording_id): Path<String>,
) -> Json<serde_json::Value> {
    log::info!("Recording events requested for: {}", recording_id);

    match state.recording_manager.load_recording_events(&recording_id, None).await {
        Ok(events) => Json(serde_json::json!({
            "success": true,
            "events": events,
            "count": events.len()
        })),
        Err(error) => Json(serde_json::json!({
            "success": false,
            "error": error.to_string()
        }))
    }
}
