pub mod types;
pub mod ssh;
pub mod websocket;
pub mod server;
pub mod transfer;
pub mod performance;
pub mod logging;
pub mod optimization;
pub mod security;
pub mod recording;
pub mod commands;

use ssh::SSHManager;
use std::sync::Arc;
use tokio::sync::RwLock;

// Global state for SSH manager
pub type SharedSSHManager = Arc<RwLock<SSHManager>>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize SSH manager
  let ssh_manager: SharedSSHManager = Arc::new(RwLock::new(SSHManager::new()));

  tauri::Builder::default()
    .manage(ssh_manager)
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      log::info!("WebTerminal Pro starting up...");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::ssh_create_session,
      commands::ssh_connect,
      commands::ssh_disconnect,
      commands::ssh_create_shell,
      commands::ssh_write_to_shell,
      commands::ssh_resize_shell,
      commands::ssh_list_sessions,
      commands::sftp_create_session,
      commands::sftp_list_directory,
      commands::sftp_download_file,
      commands::sftp_upload_file,
      commands::get_autocomplete_suggestions,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
