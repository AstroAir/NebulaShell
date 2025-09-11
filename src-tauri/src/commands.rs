use crate::types::{
    SSHConnectionConfig, SSHSession, SftpFileInfo,
    AutocompleteSuggestion, TerminalOutputEvent
};
use crate::SharedSSHManager;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

// Command request/response types
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub config: SSHConnectionConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub success: bool,
    pub session: Option<SSHSession>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateShellRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteToShellRequest {
    pub session_id: String,
    pub input: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResizeShellRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SftpListRequest {
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SftpDownloadRequest {
    pub session_id: String,
    pub remote_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SftpUploadRequest {
    pub session_id: String,
    pub remote_path: String,
    pub contents: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AutocompleteRequest {
    pub session_id: String,
    pub input: String,
    pub cursor_position: usize,
}

// SSH Commands
#[tauri::command]
pub async fn ssh_create_session(
    ssh_manager: State<'_, SharedSSHManager>,
    request: CreateSessionRequest,
) -> Result<CreateSessionResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.create_session(request.config).await {
        Ok(session) => Ok(CreateSessionResponse {
            success: true,
            session: Some(session),
            error: None,
        }),
        Err(e) => Ok(CreateSessionResponse {
            success: false,
            session: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_connect(
    app_handle: AppHandle,
    ssh_manager: State<'_, SharedSSHManager>,
    request: ConnectRequest,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.connect(&request.session_id).await {
        Ok(_) => {
            // Emit connection success event
            let _ = app_handle.emit("ssh-connected", &request.session_id);

            Ok(ConnectResponse {
                success: true,
                error: None,
            })
        },
        Err(e) => {
            // Emit connection error event
            let error_msg = e.to_string();
            let _ = app_handle.emit("ssh-connection-error", &error_msg);
            
            Ok(ConnectResponse {
                success: false,
                error: Some(error_msg),
            })
        },
    }
}

#[tauri::command]
pub async fn ssh_disconnect(
    app_handle: AppHandle,
    ssh_manager: State<'_, SharedSSHManager>,
    session_id: String,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.disconnect(&session_id).await {
        Ok(_) => {
            // Emit disconnection event
            let _ = app_handle.emit("ssh-disconnected", &session_id);
            
            Ok(ConnectResponse {
                success: true,
                error: None,
            })
        },
        Err(e) => Ok(ConnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_create_shell(
    app_handle: AppHandle,
    ssh_manager: State<'_, SharedSSHManager>,
    request: CreateShellRequest,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.create_shell(&request.session_id, request.cols, request.rows).await {
        Ok(_) => {
            // Start terminal output monitoring
            start_terminal_output_monitoring(
                app_handle,
                ssh_manager.inner().clone(),
                request.session_id.clone(),
            ).await;
            
            Ok(ConnectResponse {
                success: true,
                error: None,
            })
        },
        Err(e) => Ok(ConnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_write_to_shell(
    ssh_manager: State<'_, SharedSSHManager>,
    request: WriteToShellRequest,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.write_to_shell(&request.session_id, &request.input).await {
        Ok(_) => Ok(ConnectResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(ConnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_resize_shell(
    ssh_manager: State<'_, SharedSSHManager>,
    request: ResizeShellRequest,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.resize_shell(&request.session_id, request.cols, request.rows).await {
        Ok(_) => Ok(ConnectResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(ConnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_list_sessions(
    ssh_manager: State<'_, SharedSSHManager>,
) -> Result<Vec<SSHSession>, String> {
    let manager = ssh_manager.read().await;
    Ok(manager.list_sessions().await)
}

// SFTP Commands
#[tauri::command]
pub async fn sftp_create_session(
    ssh_manager: State<'_, SharedSSHManager>,
    session_id: String,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.create_sftp(&session_id).await {
        Ok(_) => Ok(ConnectResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(ConnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn sftp_list_directory(
    ssh_manager: State<'_, SharedSSHManager>,
    request: SftpListRequest,
) -> Result<Vec<SftpFileInfo>, String> {
    let manager = ssh_manager.read().await;
    
    match manager.list_directory(&request.session_id, &request.path).await {
        Ok(files) => Ok(files),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn sftp_download_file(
    ssh_manager: State<'_, SharedSSHManager>,
    request: SftpDownloadRequest,
) -> Result<Vec<u8>, String> {
    let manager = ssh_manager.read().await;
    
    match manager.download_file(&request.session_id, &request.remote_path).await {
        Ok(contents) => Ok(contents),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn sftp_upload_file(
    ssh_manager: State<'_, SharedSSHManager>,
    request: SftpUploadRequest,
) -> Result<ConnectResponse, String> {
    let manager = ssh_manager.read().await;
    
    match manager.upload_file(&request.session_id, &request.remote_path, &request.contents).await {
        Ok(_) => Ok(ConnectResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(ConnectResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

// Autocomplete Commands
#[tauri::command]
pub async fn get_autocomplete_suggestions(
    ssh_manager: State<'_, SharedSSHManager>,
    request: AutocompleteRequest,
) -> Result<Vec<AutocompleteSuggestion>, String> {
    let manager = ssh_manager.read().await;
    
    match manager.get_autocomplete_suggestions(
        &request.session_id,
        &request.input,
        request.cursor_position,
    ).await {
        Ok(suggestions) => Ok(suggestions),
        Err(e) => Err(e.to_string()),
    }
}

// Helper function to start terminal output monitoring
async fn start_terminal_output_monitoring(
    app_handle: AppHandle,
    ssh_manager: SharedSSHManager,
    session_id: String,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(50));
        
        loop {
            interval.tick().await;
            
            let manager = ssh_manager.read().await;
            match manager.read_from_shell(&session_id).await {
                Ok(Some(output)) => {
                    let event = TerminalOutputEvent {
                        session_id: session_id.clone(),
                        data: output,
                    };
                    
                    if let Err(e) = app_handle.emit("terminal-output", &event) {
                        log::error!("Failed to emit terminal output: {}", e);
                        break;
                    }
                },
                Ok(None) => {
                    // No output available, continue
                },
                Err(e) => {
                    log::error!("Error reading from shell: {}", e);
                    break;
                }
            }
        }
    });
}
