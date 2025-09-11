use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConnectionConfig {
    pub id: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    #[serde(rename = "privateKey")]
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    #[serde(rename = "keepAlive")]
    pub keep_alive: Option<bool>,
    #[serde(rename = "readyTimeout")]
    pub ready_timeout: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHSession {
    pub id: String,
    pub config: SSHConnectionConfig,
    pub connected: bool,
    #[serde(rename = "lastActivity")]
    pub last_activity: DateTime<Utc>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConnectData {
    pub config: SSHConnectionConfig,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInputData {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutputEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalResizeData {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalDataResponse {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub data: String,
    pub timestamp: Option<i64>,
    pub batched: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConnectedResponse {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHDisconnectedResponse {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHErrorResponse {
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub message: String,
    pub code: Option<String>,
    pub details: Option<String>,
}

// File transfer types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    pub permissions: String,
    #[serde(rename = "lastModified")]
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
    #[serde(rename = "localPath")]
    pub local_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListResponse {
    pub files: Vec<FileInfo>,
    pub path: String,
}

// Mobile optimization types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileOptimizationData {
    #[serde(rename = "lowBandwidth")]
    pub low_bandwidth: Option<bool>,
    #[serde(rename = "batchUpdates")]
    pub batch_updates: Option<bool>,
    #[serde(rename = "compressionEnabled")]
    pub compression_enabled: Option<bool>,
}

// Performance monitoring types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub latency: f64,
    #[serde(rename = "dataTransferred")]
    pub data_transferred: u64,
    #[serde(rename = "commandsExecuted")]
    pub commands_executed: u32,
    pub timestamp: DateTime<Utc>,
}

// WebSocket event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketEvent {
    #[serde(rename = "ssh_connect")]
    SSHConnect(SSHConnectData),
    #[serde(rename = "terminal_input")]
    TerminalInput(TerminalInputData),
    #[serde(rename = "terminal_resize")]
    TerminalResize(TerminalResizeData),
    #[serde(rename = "ssh_disconnect")]
    SSHDisconnect { session_id: String },
    #[serde(rename = "mobile_optimize")]
    MobileOptimize(MobileOptimizationData),
    #[serde(rename = "performance_metrics")]
    PerformanceMetrics(PerformanceMetrics),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketResponse {
    #[serde(rename = "terminal_data")]
    TerminalData(TerminalDataResponse),
    #[serde(rename = "ssh_connected")]
    SSHConnected(SSHConnectedResponse),
    #[serde(rename = "ssh_disconnected")]
    SSHDisconnected(SSHDisconnectedResponse),
    #[serde(rename = "ssh_error")]
    SSHError(SSHErrorResponse),
    #[serde(rename = "mobile_optimized")]
    MobileOptimized {
        applied: MobileOptimizationData,
        timestamp: i64,
    },
}

// Enhanced error types with better categorization
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("SSH connection failed: {0}")]
    SSHConnectionFailed(String),
    #[error("SSH authentication failed: {0}")]
    SSHAuthenticationFailed(String),
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
    #[error("File operation failed: {0}")]
    FileOperationFailed(String),
    #[error("WebSocket error: {0}")]
    WebSocketError(String),
    #[error("Transfer error: {0}")]
    TransferError(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Internal server error: {0}")]
    InternalError(String),
    #[error("Operation failed: {0}")]
    OperationFailed(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    IOError(#[from] std::io::Error),
    #[error("SSH2 error: {0}")]
    SSH2Error(#[from] ssh2::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}

impl AppError {
    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::SSHConnectionFailed(_) => "CONNECTION_FAILED",
            AppError::SSHAuthenticationFailed(_) => "AUTH_FAILED",
            AppError::SessionNotFound(_) => "SESSION_NOT_FOUND",
            AppError::InvalidConfiguration(_) => "INVALID_CONFIG",
            AppError::FileOperationFailed(_) => "FILE_OPERATION_FAILED",
            AppError::WebSocketError(_) => "WEBSOCKET_ERROR",
            AppError::TransferError(_) => "TRANSFER_ERROR",
            AppError::PermissionDenied(_) => "PERMISSION_DENIED",
            AppError::ResourceExhausted(_) => "RESOURCE_EXHAUSTED",
            AppError::TimeoutError(_) => "TIMEOUT_ERROR",
            AppError::ValidationError(_) => "VALIDATION_ERROR",
            AppError::InternalError(_) => "INTERNAL_ERROR",
            AppError::OperationFailed(_) => "OPERATION_FAILED",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::IOError(_) => "IO_ERROR",
            AppError::SSH2Error(_) => "SSH2_ERROR",
            AppError::SerializationError(_) => "SERIALIZATION_ERROR",
        }
    }

    pub fn severity(&self) -> ErrorSeverity {
        match self {
            AppError::SSHConnectionFailed(_) | AppError::SSHAuthenticationFailed(_) => ErrorSeverity::High,
            AppError::SessionNotFound(_) | AppError::InvalidConfiguration(_) => ErrorSeverity::Medium,
            AppError::FileOperationFailed(_) | AppError::TransferError(_) => ErrorSeverity::Medium,
            AppError::WebSocketError(_) => ErrorSeverity::High,
            AppError::PermissionDenied(_) => ErrorSeverity::High,
            AppError::ResourceExhausted(_) | AppError::TimeoutError(_) => ErrorSeverity::Medium,
            AppError::ValidationError(_) => ErrorSeverity::Low,
            AppError::InternalError(_) => ErrorSeverity::Critical,
            AppError::OperationFailed(_) => ErrorSeverity::Medium,
            AppError::NotFound(_) => ErrorSeverity::Low,
            AppError::IOError(_) | AppError::SSH2Error(_) => ErrorSeverity::Medium,
            AppError::SerializationError(_) => ErrorSeverity::Low,
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(self,
            AppError::SSHConnectionFailed(_) |
            AppError::TimeoutError(_) |
            AppError::ResourceExhausted(_) |
            AppError::IOError(_)
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

pub type AppResult<T> = Result<T, AppError>;

// SFTP file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_directory: bool,
    pub modified: Option<i64>,
    pub permissions: Option<String>,
}

// File download request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDownloadRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
}

// File upload request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUploadRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
    pub content: String, // Base64 encoded content
}

// File transfer types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransfer {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub name: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
    #[serde(rename = "localPath")]
    pub local_path: Option<String>,
    pub size: u64,
    pub transferred: u64,
    pub status: TransferStatus,
    pub direction: TransferDirection,
    #[serde(rename = "startTime")]
    pub start_time: DateTime<Utc>,
    #[serde(rename = "endTime")]
    pub end_time: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Upload,
    Download,
}

// Transfer request types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferUploadRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
    pub content: String, // Base64 encoded content
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferDownloadRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
    pub name: Option<String>,
}

// Terminal autocomplete types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub input: String,
    pub cursor_position: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteSuggestion {
    pub text: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub suggestion_type: SuggestionType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SuggestionType {
    Command,
    File,
    Directory,
    Option,
    Variable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteResponse {
    pub suggestions: Vec<AutocompleteSuggestion>,
    pub prefix: String,
    pub cursor_position: usize,
}

// Mobile session management types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileSessionRequest {
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub device_info: MobileDeviceInfo,
    pub optimizations: MobileOptimizations,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileDeviceInfo {
    pub platform: String, // "ios", "android", etc.
    pub screen_width: u32,
    pub screen_height: u32,
    pub pixel_ratio: f32,
    pub is_tablet: bool,
    pub supports_touch: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileOptimizations {
    pub reduce_animations: bool,
    pub optimize_scrolling: bool,
    pub increase_touch_targets: bool,
    pub reduce_network_usage: bool,
    pub battery_optimization: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileSessionResponse {
    pub success: bool,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub applied_optimizations: MobileOptimizations,
    pub recommendations: Vec<String>,
    pub error: Option<String>,
}

// System performance monitoring types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemPerformanceMetrics {
    pub system: SystemMetrics,
    pub connections: ConnectionMetrics,
    pub application: ApplicationMetrics,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub memory_total: u64,
    pub memory_used: u64,
    pub uptime: u64,
    pub load_average: Option<Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionMetrics {
    pub active_sessions: u32,
    pub total_connections: u64,
    pub failed_connections: u64,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub average_latency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationMetrics {
    pub websocket_connections: u32,
    pub active_transfers: u32,
    pub completed_transfers: u64,
    pub failed_transfers: u64,
    pub cache_hit_rate: f64,
    pub error_rate: f64,
}
