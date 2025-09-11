pub mod session;
pub mod shell;

use crate::types::{AppError, AppResult, SSHConnectionConfig, SSHSession, SftpFileInfo, AutocompleteSuggestion, SuggestionType};
use crate::{log_connection, log_security};
use chrono::{Utc, Duration};
use dashmap::DashMap;
use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use tokio::sync::RwLock;
use tempfile::NamedTempFile;
use tokio::time::{interval, Duration as TokioDuration};

pub struct SSHManager {
    sessions: Arc<DashMap<String, Arc<RwLock<SSHSessionData>>>>,
    session_timeout: Duration,
    cleanup_interval: TokioDuration,
}

pub struct SSHSessionData {
    pub session: SSHSession,
    pub ssh_session: Option<Session>,
    pub shell: Option<ssh2::Channel>,
    pub sftp: Option<ssh2::Sftp>,
}

impl SSHManager {
    pub fn new() -> Self {
        let manager = Self {
            sessions: Arc::new(DashMap::new()),
            session_timeout: Duration::minutes(30), // 30 minute timeout
            cleanup_interval: TokioDuration::from_secs(300), // Check every 5 minutes
        };

        // Start cleanup task
        manager.start_cleanup_task();
        manager
    }

    fn start_cleanup_task(&self) {
        let sessions = self.sessions.clone();
        let timeout = self.session_timeout;
        let cleanup_interval = self.cleanup_interval;

        tokio::spawn(async move {
            let mut interval = interval(cleanup_interval);

            loop {
                interval.tick().await;
                Self::cleanup_expired_sessions(&sessions, timeout).await;
            }
        });
    }

    async fn cleanup_expired_sessions(
        sessions: &Arc<DashMap<String, Arc<RwLock<SSHSessionData>>>>,
        timeout: Duration,
    ) {
        let now = Utc::now();
        let mut expired_sessions = Vec::new();

        // Find expired sessions
        for entry in sessions.iter() {
            let session_data = entry.value().read().await;
            if now.signed_duration_since(session_data.session.last_activity) > timeout {
                expired_sessions.push(entry.key().clone());
            }
        }

        // Remove expired sessions
        for session_id in expired_sessions {
            if let Some((_, session_data)) = sessions.remove(&session_id) {
                let mut data = session_data.write().await;

                // Close shell if exists
                if let Some(mut shell) = data.shell.take() {
                    let _ = shell.close();
                }

                // Close SFTP if exists
                if let Some(_sftp) = data.sftp.take() {
                    // SFTP will be dropped automatically
                }

                // Close SSH session
                if let Some(session) = data.ssh_session.take() {
                    let _ = session.disconnect(None, "Session timeout", None);
                }

                log_connection!("session_expired", &session_id, {
                    let mut details = std::collections::HashMap::new();
                    details.insert("reason".to_string(), "timeout".to_string());
                    details.insert("timeout_minutes".to_string(), timeout.num_minutes().to_string());
                    details
                });
            }
        }
    }

    pub async fn create_session(&self, config: SSHConnectionConfig) -> AppResult<SSHSession> {
        // Validate configuration
        self.validate_config(&config)?;

        let session = SSHSession {
            id: config.id.clone(),
            config: config.clone(),
            connected: false,
            last_activity: Utc::now(),
            created_at: Utc::now(),
        };

        let session_data = SSHSessionData {
            session: session.clone(),
            ssh_session: None,
            shell: None,
            sftp: None,
        };

        self.sessions.insert(
            config.id.clone(),
            Arc::new(RwLock::new(session_data)),
        );

        log::info!("SSH session created: {}", config.id);
        Ok(session)
    }

    pub async fn connect(&self, session_id: &str) -> AppResult<()> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;
        let config = &data.session.config;

        log::info!("Attempting SSH connection to {}@{}:{}", 
                   config.username, config.hostname, config.port);

        // Create TCP connection
        let tcp = TcpStream::connect(format!("{}:{}", config.hostname, config.port))
            .map_err(|e| AppError::SSHConnectionFailed(format!("TCP connection failed: {}", e)))?;

        // Create SSH session
        let mut session = Session::new()
            .map_err(|e| AppError::SSHConnectionFailed(format!("SSH session creation failed: {}", e)))?;

        session.set_tcp_stream(tcp);
        session.handshake()
            .map_err(|e| AppError::SSHConnectionFailed(format!("SSH handshake failed: {}", e)))?;

        // Authenticate
        self.authenticate(&mut session, config).await?;

        // Clone config values before mutating data
        let hostname = config.hostname.clone();
        let port = config.port;
        let username = config.username.clone();

        // Store the session
        data.ssh_session = Some(session);
        data.session.connected = true;
        data.session.last_activity = Utc::now();

        log_connection!("ssh_connected", session_id, {
            let mut details = std::collections::HashMap::new();
            details.insert("host".to_string(), hostname);
            details.insert("port".to_string(), port.to_string());
            details.insert("username".to_string(), username);
            details
        });

        Ok(())
    }

    pub async fn disconnect(&self, session_id: &str) -> AppResult<()> {
        if let Some(session_data) = self.sessions.get(session_id) {
            let mut data = session_data.write().await;

            // Close shell if exists
            if let Some(mut shell) = data.shell.take() {
                let _ = shell.close();
                log::debug!("Shell closed for session: {}", session_id);
            }

            // Close SFTP if exists
            if let Some(_sftp) = data.sftp.take() {
                // SFTP will be dropped automatically
                log::debug!("SFTP session closed for session: {}", session_id);
            }

            // Close SSH session
            if let Some(session) = data.ssh_session.take() {
                let _ = session.disconnect(None, "Client disconnecting", None);
                log::debug!("SSH connection closed for session: {}", session_id);
            }

            data.session.connected = false;
            log::info!("SSH session disconnected: {}", session_id);
        }

        Ok(())
    }

    pub async fn graceful_shutdown(&self) -> AppResult<()> {
        log::info!("Starting graceful shutdown of SSH manager");

        let session_ids: Vec<String> = self.sessions.iter()
            .map(|entry| entry.key().clone())
            .collect();

        for session_id in session_ids {
            if let Err(e) = self.disconnect(&session_id).await {
                log::error!("Error disconnecting session {} during shutdown: {}", session_id, e);
            }
        }

        // Clear all sessions
        self.sessions.clear();

        log::info!("SSH manager shutdown complete");
        Ok(())
    }

    pub fn get_active_session_count(&self) -> usize {
        self.sessions.len()
    }

    pub async fn get_session_info(&self, session_id: &str) -> AppResult<(bool, bool, bool)> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let data = session_data.read().await;
        Ok((
            data.ssh_session.is_some(),
            data.shell.is_some(),
            data.sftp.is_some(),
        ))
    }

    pub async fn create_shell(&self, session_id: &str, cols: u16, rows: u16) -> AppResult<()> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;
        
        let session = data.ssh_session.as_mut()
            .ok_or_else(|| AppError::SSHConnectionFailed("No SSH session available".to_string()))?;

        let mut channel = session.channel_session()
            .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to create channel: {}", e)))?;

        channel.request_pty("xterm-256color", None, Some((cols as u32, rows as u32, 0, 0)))
            .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to request PTY: {}", e)))?;

        channel.shell()
            .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to start shell: {}", e)))?;

        data.shell = Some(channel);
        data.session.last_activity = Utc::now();

        log::info!("Shell created for session: {}", session_id);
        Ok(())
    }

    pub async fn write_to_shell(&self, session_id: &str, input: &str) -> AppResult<()> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;
        
        if let Some(shell) = data.shell.as_mut() {
            shell.write(input.as_bytes())
                .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to write to shell: {}", e)))?;
            
            data.session.last_activity = Utc::now();
        }

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn read_from_shell(&self, session_id: &str) -> AppResult<Option<String>> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;
        
        if let Some(shell) = data.shell.as_mut() {
            let mut buffer = [0; 4096];
            match shell.read(&mut buffer) {
                Ok(0) => Ok(None), // EOF
                Ok(n) => {
                    data.session.last_activity = Utc::now();
                    Ok(Some(String::from_utf8_lossy(&buffer[..n]).to_string()))
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Ok(None),
                Err(e) => Err(AppError::SSHConnectionFailed(format!("Failed to read from shell: {}", e))),
            }
        } else {
            Ok(None)
        }
    }

    pub async fn resize_shell(&self, session_id: &str, cols: u16, rows: u16) -> AppResult<()> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;
        
        if let Some(shell) = data.shell.as_mut() {
            shell.request_pty_size(cols as u32, rows as u32, Some(0), Some(0))
                .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to resize shell: {}", e)))?;
            
            data.session.last_activity = Utc::now();
        }

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_session(&self, session_id: &str) -> AppResult<SSHSession> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let data = session_data.read().await;
        Ok(data.session.clone())
    }

    pub async fn list_sessions(&self) -> Vec<SSHSession> {
        let mut sessions = Vec::new();
        for entry in self.sessions.iter() {
            if let Ok(data) = entry.value().try_read() {
                sessions.push(data.session.clone());
            }
        }
        sessions
    }

    #[allow(dead_code)]
    pub async fn remove_session(&self, session_id: &str) -> AppResult<()> {
        self.disconnect(session_id).await?;
        self.sessions.remove(session_id);
        log::info!("SSH session removed: {}", session_id);
        Ok(())
    }

    fn validate_config(&self, config: &SSHConnectionConfig) -> AppResult<()> {
        if config.hostname.is_empty() {
            return Err(AppError::InvalidConfiguration("Hostname cannot be empty".to_string()));
        }
        if config.username.is_empty() {
            return Err(AppError::InvalidConfiguration("Username cannot be empty".to_string()));
        }
        if config.port == 0 {
            return Err(AppError::InvalidConfiguration("Port number cannot be 0".to_string()));
        }
        if config.password.is_none() && config.private_key.is_none() {
            return Err(AppError::InvalidConfiguration("Either password or private key must be provided".to_string()));
        }
        Ok(())
    }

    async fn authenticate(&self, session: &mut Session, config: &SSHConnectionConfig) -> AppResult<()> {
        if let Some(password) = &config.password {
            session.userauth_password(&config.username, password)
                .map_err(|e| AppError::SSHAuthenticationFailed(format!("Password authentication failed: {}", e)))?;
        } else if let Some(private_key) = &config.private_key {
            self.authenticate_with_private_key(session, &config.username, private_key, config.passphrase.as_deref()).await?;
        } else {
            return Err(AppError::SSHAuthenticationFailed("No authentication method provided".to_string()));
        }

        if !session.authenticated() {
            return Err(AppError::SSHAuthenticationFailed("Authentication failed".to_string()));
        }

        Ok(())
    }

    async fn authenticate_with_private_key(
        &self,
        session: &mut Session,
        username: &str,
        private_key: &str,
        passphrase: Option<&str>,
    ) -> AppResult<()> {
        // Create a temporary file for the private key
        let mut temp_file = NamedTempFile::new()
            .map_err(|e| AppError::SSHAuthenticationFailed(format!("Failed to create temporary key file: {}", e)))?;

        // Write the private key to the temporary file
        temp_file.write_all(private_key.as_bytes())
            .map_err(|e| AppError::SSHAuthenticationFailed(format!("Failed to write private key to temp file: {}", e)))?;

        // Ensure the file is written to disk
        temp_file.flush()
            .map_err(|e| AppError::SSHAuthenticationFailed(format!("Failed to flush private key file: {}", e)))?;

        let temp_path = temp_file.path();

        // Set restrictive permissions on the temporary file (Unix-like systems)
        #[cfg(unix)]
        {
            use std::fs;
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(temp_path)
                .map_err(|e| AppError::SSHAuthenticationFailed(format!("Failed to get file metadata: {}", e)))?
                .permissions();
            perms.set_mode(0o600); // Read/write for owner only
            fs::set_permissions(temp_path, perms)
                .map_err(|e| AppError::SSHAuthenticationFailed(format!("Failed to set file permissions: {}", e)))?;
        }

        // Attempt authentication with the private key
        let result = if let Some(passphrase) = passphrase {
            session.userauth_pubkey_file(username, None, temp_path, Some(passphrase))
        } else {
            session.userauth_pubkey_file(username, None, temp_path, None)
        };

        // Clean up: the temporary file will be automatically deleted when temp_file goes out of scope

        result.map_err(|e| AppError::SSHAuthenticationFailed(format!("Private key authentication failed: {}", e)))?;

        log_security!("private_key_auth_success", "info", {
            let mut details = std::collections::HashMap::new();
            details.insert("username".to_string(), username.to_string());
            details.insert("auth_method".to_string(), "private_key".to_string());
            details
        });

        Ok(())
    }

    // SFTP operations
    pub async fn create_sftp(&self, session_id: &str) -> AppResult<()> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;

        if let Some(ssh_session) = &data.ssh_session {
            let sftp = ssh_session.sftp()
                .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to create SFTP session: {}", e)))?;

            data.sftp = Some(sftp);
            log::info!("SFTP session created for: {}", session_id);
        } else {
            return Err(AppError::SSHConnectionFailed("No SSH session available for SFTP".to_string()));
        }

        Ok(())
    }

    pub async fn list_directory(&self, session_id: &str, path: &str) -> AppResult<Vec<SftpFileInfo>> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;

        // Create SFTP session if it doesn't exist
        if data.sftp.is_none() {
            if let Some(ssh_session) = &data.ssh_session {
                let sftp = ssh_session.sftp()
                    .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to create SFTP session: {}", e)))?;
                data.sftp = Some(sftp);
            } else {
                return Err(AppError::SSHConnectionFailed("No SSH session available for SFTP".to_string()));
            }
        }

        if let Some(sftp) = &data.sftp {
            let entries = sftp.readdir(std::path::Path::new(path))
                .map_err(|e| AppError::FileOperationFailed(format!("Failed to list directory: {}", e)))?;

            let mut files = Vec::new();
            for (path, stat) in entries {
                let file_info = SftpFileInfo {
                    name: path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    path: path.to_string_lossy().to_string(),
                    size: stat.size.unwrap_or(0),
                    is_directory: stat.is_dir(),
                    modified: stat.mtime.map(|t| t as i64),
                    permissions: stat.perm.map(|p| format!("{:o}", p)),
                };
                files.push(file_info);
            }

            data.session.last_activity = Utc::now();
            Ok(files)
        } else {
            Err(AppError::FileOperationFailed("SFTP session not available".to_string()))
        }
    }

    pub async fn download_file(&self, session_id: &str, remote_path: &str) -> AppResult<Vec<u8>> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;

        // Create SFTP session if it doesn't exist
        if data.sftp.is_none() {
            if let Some(ssh_session) = &data.ssh_session {
                let sftp = ssh_session.sftp()
                    .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to create SFTP session: {}", e)))?;
                data.sftp = Some(sftp);
            } else {
                return Err(AppError::SSHConnectionFailed("No SSH session available for SFTP".to_string()));
            }
        }

        if let Some(sftp) = &data.sftp {
            let mut remote_file = sftp.open(std::path::Path::new(remote_path))
                .map_err(|e| AppError::FileOperationFailed(format!("Failed to open remote file: {}", e)))?;

            let mut contents = Vec::new();
            remote_file.read_to_end(&mut contents)
                .map_err(|e| AppError::FileOperationFailed(format!("Failed to read file: {}", e)))?;

            data.session.last_activity = Utc::now();
            Ok(contents)
        } else {
            Err(AppError::FileOperationFailed("SFTP session not available".to_string()))
        }
    }

    pub async fn upload_file(&self, session_id: &str, remote_path: &str, contents: &[u8]) -> AppResult<()> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let mut data = session_data.write().await;

        // Create SFTP session if it doesn't exist
        if data.sftp.is_none() {
            if let Some(ssh_session) = &data.ssh_session {
                let sftp = ssh_session.sftp()
                    .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to create SFTP session: {}", e)))?;
                data.sftp = Some(sftp);
            } else {
                return Err(AppError::SSHConnectionFailed("No SSH session available for SFTP".to_string()));
            }
        }

        if let Some(sftp) = &data.sftp {
            let mut remote_file = sftp.create(std::path::Path::new(remote_path))
                .map_err(|e| AppError::FileOperationFailed(format!("Failed to create remote file: {}", e)))?;

            remote_file.write_all(contents)
                .map_err(|e| AppError::FileOperationFailed(format!("Failed to write file: {}", e)))?;

            data.session.last_activity = Utc::now();
            Ok(())
        } else {
            Err(AppError::FileOperationFailed("SFTP session not available".to_string()))
        }
    }

    // Terminal autocomplete functionality
    pub async fn get_autocomplete_suggestions(
        &self,
        session_id: &str,
        input: &str,
        cursor_position: usize,
    ) -> AppResult<Vec<AutocompleteSuggestion>> {
        let session_data = self.sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let data = session_data.read().await;

        if data.ssh_session.is_none() {
            return Err(AppError::SSHConnectionFailed("No SSH session available".to_string()));
        }

        // Parse the input to determine what kind of completion is needed
        let suggestions = self.generate_suggestions(input, cursor_position).await?;

        Ok(suggestions)
    }

    async fn generate_suggestions(
        &self,
        input: &str,
        cursor_position: usize,
    ) -> AppResult<Vec<AutocompleteSuggestion>> {
        let mut suggestions = Vec::new();

        // Get the word at cursor position
        let (prefix, word_start) = self.get_word_at_cursor(input, cursor_position);

        // If we're at the beginning or after whitespace, suggest commands
        if word_start == 0 || input.chars().nth(word_start.saturating_sub(1)) == Some(' ') {
            suggestions.extend(self.get_command_suggestions(&prefix));
        }

        // If the prefix looks like a path, suggest files/directories
        if prefix.contains('/') || prefix.starts_with('.') || prefix.starts_with('~') {
            // For now, we'll provide basic path suggestions
            // In a full implementation, this would use SFTP to list directories
            suggestions.extend(self.get_path_suggestions(&prefix));
        }

        // Add common option suggestions if prefix starts with -
        if prefix.starts_with('-') {
            suggestions.extend(self.get_option_suggestions(&prefix));
        }

        Ok(suggestions)
    }

    fn get_word_at_cursor(&self, input: &str, cursor_position: usize) -> (String, usize) {
        let chars: Vec<char> = input.chars().collect();
        let cursor_pos = cursor_position.min(chars.len());

        // Find word boundaries
        let mut start = cursor_pos;
        while start > 0 && !chars[start - 1].is_whitespace() {
            start -= 1;
        }

        let mut end = cursor_pos;
        while end < chars.len() && !chars[end].is_whitespace() {
            end += 1;
        }

        let word: String = chars[start..end].iter().collect();
        (word, start)
    }

    fn get_command_suggestions(&self, prefix: &str) -> Vec<AutocompleteSuggestion> {
        let common_commands = vec![
            ("ls", "List directory contents"),
            ("cd", "Change directory"),
            ("pwd", "Print working directory"),
            ("cat", "Display file contents"),
            ("grep", "Search text patterns"),
            ("find", "Find files and directories"),
            ("chmod", "Change file permissions"),
            ("chown", "Change file ownership"),
            ("cp", "Copy files"),
            ("mv", "Move/rename files"),
            ("rm", "Remove files"),
            ("mkdir", "Create directory"),
            ("rmdir", "Remove directory"),
            ("tar", "Archive files"),
            ("gzip", "Compress files"),
            ("ssh", "Secure shell"),
            ("scp", "Secure copy"),
            ("rsync", "Remote sync"),
            ("ps", "List processes"),
            ("top", "Display running processes"),
            ("kill", "Terminate processes"),
            ("nano", "Text editor"),
            ("vim", "Vi text editor"),
            ("emacs", "Emacs text editor"),
        ];

        common_commands
            .into_iter()
            .filter(|(cmd, _)| cmd.starts_with(prefix))
            .map(|(cmd, desc)| AutocompleteSuggestion {
                text: cmd.to_string(),
                description: Some(desc.to_string()),
                suggestion_type: SuggestionType::Command,
            })
            .collect()
    }

    fn get_path_suggestions(&self, prefix: &str) -> Vec<AutocompleteSuggestion> {
        // Basic path suggestions - in a full implementation, this would
        // use SFTP to list actual directories
        let mut suggestions = Vec::new();

        if prefix.is_empty() || prefix == "." {
            suggestions.push(AutocompleteSuggestion {
                text: "./".to_string(),
                description: Some("Current directory".to_string()),
                suggestion_type: SuggestionType::Directory,
            });
            suggestions.push(AutocompleteSuggestion {
                text: "../".to_string(),
                description: Some("Parent directory".to_string()),
                suggestion_type: SuggestionType::Directory,
            });
        }

        if prefix.is_empty() || prefix.starts_with('/') {
            let common_paths = vec![
                ("/home/", "User home directories"),
                ("/etc/", "System configuration"),
                ("/var/", "Variable data"),
                ("/tmp/", "Temporary files"),
                ("/usr/", "User programs"),
                ("/opt/", "Optional software"),
            ];

            for (path, desc) in common_paths {
                if path.starts_with(prefix) {
                    suggestions.push(AutocompleteSuggestion {
                        text: path.to_string(),
                        description: Some(desc.to_string()),
                        suggestion_type: SuggestionType::Directory,
                    });
                }
            }
        }

        suggestions
    }

    fn get_option_suggestions(&self, prefix: &str) -> Vec<AutocompleteSuggestion> {
        let common_options = vec![
            ("-l", "Long format listing"),
            ("-a", "Show all files including hidden"),
            ("-h", "Human readable sizes"),
            ("-r", "Recursive"),
            ("-f", "Force operation"),
            ("-v", "Verbose output"),
            ("-i", "Interactive mode"),
            ("-n", "Numeric output"),
            ("--help", "Show help information"),
            ("--version", "Show version information"),
        ];

        common_options
            .into_iter()
            .filter(|(opt, _)| opt.starts_with(prefix))
            .map(|(opt, desc)| AutocompleteSuggestion {
                text: opt.to_string(),
                description: Some(desc.to_string()),
                suggestion_type: SuggestionType::Option,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ssh_manager_creation() {
        let manager = SSHManager::new();
        assert_eq!(manager.get_active_session_count(), 0);
    }

    #[tokio::test]
    async fn test_session_creation() {
        let manager = SSHManager::new();

        let config = SSHConnectionConfig {
            id: "test-config".to_string(),
            hostname: "localhost".to_string(),
            port: 22,
            username: "testuser".to_string(),
            password: Some("testpass".to_string()),
            private_key: None,
            passphrase: None,
            keep_alive: Some(true),
            ready_timeout: Some(5000),
        };

        let result = manager.create_session(config).await;
        assert!(result.is_ok());

        let session = result.unwrap();
        assert!(!session.id.is_empty());
        assert_eq!(session.config.hostname, "localhost");
        assert_eq!(session.config.username, "testuser");
    }

    #[tokio::test]
    async fn test_session_not_found_error() {
        let manager = SSHManager::new();

        let result = manager.get_session("non-existent").await;
        assert!(result.is_err());

        if let Err(error) = result {
            assert_eq!(error.error_code(), "SESSION_NOT_FOUND");
        }
    }

    #[tokio::test]
    async fn test_graceful_shutdown() {
        let manager = SSHManager::new();
        let result = manager.graceful_shutdown().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_autocomplete_word_parsing() {
        let manager = SSHManager::new();

        let (word, start) = manager.get_word_at_cursor("ls -la", 2);
        assert_eq!(word, "ls");
        assert_eq!(start, 0);

        let (word, start) = manager.get_word_at_cursor("cd /home", 8);
        assert_eq!(word, "/home");
        assert_eq!(start, 3);
    }

    #[tokio::test]
    async fn test_command_suggestions() {
        let manager = SSHManager::new();

        let suggestions = manager.get_command_suggestions("l");
        assert!(!suggestions.is_empty());

        let ls_suggestion = suggestions.iter().find(|s| s.text == "ls");
        assert!(ls_suggestion.is_some());

        if let Some(suggestion) = ls_suggestion {
            assert_eq!(suggestion.suggestion_type, SuggestionType::Command);
            assert!(suggestion.description.is_some());
        }
    }

    #[tokio::test]
    async fn test_option_suggestions() {
        let manager = SSHManager::new();

        let suggestions = manager.get_option_suggestions("-");
        assert!(!suggestions.is_empty());

        let help_suggestion = suggestions.iter().find(|s| s.text == "--help");
        assert!(help_suggestion.is_some());
    }
}

impl Default for SSHManager {
    fn default() -> Self {
        Self::new()
    }
}
