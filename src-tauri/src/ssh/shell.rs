use crate::types::{AppError, AppResult};
use ssh2::Channel;
use std::io::{Read, Write};
use tokio::sync::mpsc;

#[allow(dead_code)]
pub struct ShellHandler {
    channel: Channel,
    output_sender: mpsc::UnboundedSender<String>,
    output_receiver: mpsc::UnboundedReceiver<String>,
}

#[allow(dead_code)]
impl ShellHandler {
    pub fn new(channel: Channel) -> Self {
        let (output_sender, output_receiver) = mpsc::unbounded_channel();
        
        Self {
            channel,
            output_sender,
            output_receiver,
        }
    }

    pub async fn start_reading(&mut self) -> AppResult<()> {
        let mut channel = self.channel.clone();
        let sender = self.output_sender.clone();
        
        tokio::task::spawn_blocking(move || {
            let mut buffer = [0; 4096];
            loop {
                match channel.read(&mut buffer) {
                    Ok(0) => {
                        // EOF reached
                        log::info!("Shell reached EOF");
                        break;
                    }
                    Ok(n) => {
                        let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                        if sender.send(output).is_err() {
                            log::warn!("Failed to send shell output - receiver dropped");
                            break;
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No data available, continue
                        std::thread::sleep(std::time::Duration::from_millis(10));
                        continue;
                    }
                    Err(e) => {
                        log::error!("Error reading from shell: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn write_input(&mut self, input: &str) -> AppResult<()> {
        let mut channel = self.channel.clone();
        let input = input.to_string();
        
        tokio::task::spawn_blocking(move || {
            channel.write_all(input.as_bytes())
        }).await
        .map_err(|e| AppError::SSHConnectionFailed(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to write to shell: {}", e)))?;

        Ok(())
    }

    pub async fn resize(&mut self, cols: u16, rows: u16) -> AppResult<()> {
        let mut channel = self.channel.clone();
        
        tokio::task::spawn_blocking(move || {
            channel.request_pty_size(cols as u32, rows as u32, Some(0), Some(0))
        }).await
        .map_err(|e| AppError::SSHConnectionFailed(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to resize shell: {}", e)))?;

        Ok(())
    }

    pub async fn read_output(&mut self) -> Option<String> {
        self.output_receiver.recv().await
    }

    pub fn close(&mut self) -> AppResult<()> {
        self.channel.close()
            .map_err(|e| AppError::SSHConnectionFailed(format!("Failed to close shell: {}", e)))?;
        Ok(())
    }

    pub fn is_eof(&self) -> bool {
        self.channel.eof()
    }

    pub fn exit_status(&self) -> Option<i32> {
        self.channel.exit_status().ok()
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ShellConfig {
    pub term_type: String,
    pub cols: u16,
    pub rows: u16,
    pub env_vars: Vec<(String, String)>,
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            term_type: "xterm-256color".to_string(),
            cols: 80,
            rows: 24,
            env_vars: Vec::new(),
        }
    }
}

#[allow(dead_code)]
pub struct ShellManager {
    shells: std::collections::HashMap<String, ShellHandler>,
}

#[allow(dead_code)]
impl ShellManager {
    pub fn new() -> Self {
        Self {
            shells: std::collections::HashMap::new(),
        }
    }

    pub fn add_shell(&mut self, session_id: String, shell: ShellHandler) {
        self.shells.insert(session_id, shell);
    }

    pub fn get_shell_mut(&mut self, session_id: &str) -> Option<&mut ShellHandler> {
        self.shells.get_mut(session_id)
    }

    pub fn remove_shell(&mut self, session_id: &str) -> Option<ShellHandler> {
        self.shells.remove(session_id)
    }

    pub fn has_shell(&self, session_id: &str) -> bool {
        self.shells.contains_key(session_id)
    }

    pub fn shell_count(&self) -> usize {
        self.shells.len()
    }

    pub async fn close_all_shells(&mut self) -> AppResult<()> {
        for (session_id, shell) in self.shells.iter_mut() {
            if let Err(e) = shell.close() {
                log::warn!("Failed to close shell for session {}: {}", session_id, e);
            }
        }
        self.shells.clear();
        Ok(())
    }
}

impl Default for ShellManager {
    fn default() -> Self {
        Self::new()
    }
}
