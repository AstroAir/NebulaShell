import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SSHConnectionConfig, SSHSession, SftpFileInfo, AutocompleteSuggestion } from '@/types/ssh';
import { WebSocketAdapter } from './websocket-adapter';

// Request/Response types matching Rust backend
interface CreateSessionRequest {
  config: SSHConnectionConfig;
}

interface CreateSessionResponse {
  success: boolean;
  session?: SSHSession;
  error?: string;
}

interface ConnectRequest {
  session_id: string;
}

interface ConnectResponse {
  success: boolean;
  error?: string;
}

interface CreateShellRequest {
  session_id: string;
  cols: number;
  rows: number;
}

interface WriteToShellRequest {
  session_id: string;
  input: string;
}

interface ResizeShellRequest {
  session_id: string;
  cols: number;
  rows: number;
}

interface SftpListRequest {
  session_id: string;
  path: string;
}

interface SftpDownloadRequest {
  session_id: string;
  remote_path: string;
}

interface SftpUploadRequest {
  session_id: string;
  remote_path: string;
  contents: number[];
}

interface AutocompleteRequest {
  session_id: string;
  input: string;
  cursor_position: number;
}

interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export class TauriSSHAdapter implements WebSocketAdapter {
  private outputListeners: Map<string, (data: string) => void> = new Map();
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private eventUnlisteners: UnlistenFn[] = [];
  private _connected: boolean = false;
  private currentSessionId: string | null = null;

  constructor() {
    this.setupEventListeners();
  }

  get connected(): boolean {
    return this._connected;
  }

  // WebSocketAdapter interface implementation
  connect(): void {
    this._connected = true;
    this.triggerEvent('connect', {});
  }

  disconnect(): void {
    this._connected = false;
    this.triggerEvent('disconnect', {});
    this.destroy();
  }

  emit(event: string, data: any): void {
    // Handle SSH events by calling appropriate Tauri commands
    this.handleEmit(event, data).catch(error => {
      console.error(`Error handling emit for ${event}:`, error);
      this.triggerEvent('error', { event, error: error.message });
    });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      this.eventListeners.get(event)?.delete(callback);
    } else {
      this.eventListeners.delete(event);
    }
  }

  private triggerEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  private async handleEmit(event: string, data: any): Promise<void> {
    switch (event) {
      case 'ssh_connect':
        await this.handleSSHConnect(data);
        break;
      case 'ssh_disconnect':
        await this.handleSSHDisconnect(data);
        break;
      case 'terminal_input':
        await this.handleTerminalInput(data);
        break;
      case 'terminal_resize':
        await this.handleTerminalResize(data);
        break;
      default:
        console.warn(`Unhandled emit event: ${event}`);
    }
  }

  private async handleSSHConnect(data: { config: SSHConnectionConfig, cols?: number, rows?: number }): Promise<void> {
    try {
      // Create session
      const session = await this.createSession(data.config);
      this.currentSessionId = session.id;

      // Connect
      await this.connect_ssh(session.id);

      // Create shell
      await this.createShell(session.id, data.cols || 80, data.rows || 24);

      // Emit success
      this.triggerEvent('ssh_connected', {
        sessionId: session.id,
        status: 'connected'
      });

    } catch (error) {
      this.triggerEvent('ssh_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleSSHDisconnect(data: { sessionId: string }): Promise<void> {
    try {
      await this.disconnect_ssh(data.sessionId);
      this.currentSessionId = null;
      this.triggerEvent('ssh_disconnected', { sessionId: data.sessionId });
    } catch (error) {
      console.error('Error disconnecting SSH:', error);
    }
  }

  private async handleTerminalInput(data: { sessionId: string, input: string }): Promise<void> {
    try {
      await this.writeToShell(data.sessionId, data.input);
    } catch (error) {
      console.error('Error sending terminal input:', error);
    }
  }

  private async handleTerminalResize(data: { sessionId: string, cols: number, rows: number }): Promise<void> {
    try {
      await this.resizeShell(data.sessionId, data.cols, data.rows);
    } catch (error) {
      console.error('Error resizing terminal:', error);
    }
  }

  private async setupEventListeners() {
    // Listen for terminal output events
    const terminalOutputUnlisten = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { sessionId, data } = event.payload;
      const listener = this.outputListeners.get(sessionId);
      if (listener) {
        listener(data);
      }
    });
    this.eventUnlisteners.push(terminalOutputUnlisten);

    // Listen for SSH connection events
    const sshConnectedUnlisten = await listen<string>('ssh-connected', (event) => {
      console.log('SSH connected:', event.payload);
    });
    this.eventUnlisteners.push(sshConnectedUnlisten);

    const sshDisconnectedUnlisten = await listen<string>('ssh-disconnected', (event) => {
      console.log('SSH disconnected:', event.payload);
      // Clean up output listener for this session
      this.outputListeners.delete(event.payload);
    });
    this.eventUnlisteners.push(sshDisconnectedUnlisten);

    const sshErrorUnlisten = await listen<string>('ssh-connection-error', (event) => {
      console.error('SSH connection error:', event.payload);
    });
    this.eventUnlisteners.push(sshErrorUnlisten);
  }

  // SSH Operations
  async createSession(config: SSHConnectionConfig): Promise<SSHSession> {
    const request: CreateSessionRequest = { config };
    const response: CreateSessionResponse = await invoke('ssh_create_session', { request });

    if (!response.success || !response.session) {
      throw new Error(response.error || 'Failed to create SSH session');
    }

    return response.session;
  }

  async connect_ssh(sessionId: string): Promise<void> {
    const request: ConnectRequest = { session_id: sessionId };
    const response: ConnectResponse = await invoke('ssh_connect', { request });

    if (!response.success) {
      throw new Error(response.error || 'Failed to connect SSH session');
    }
  }

  async disconnect_ssh(sessionId: string): Promise<void> {
    const response: ConnectResponse = await invoke('ssh_disconnect', { sessionId });

    if (!response.success) {
      throw new Error(response.error || 'Failed to disconnect SSH session');
    }

    // Clean up output listener
    this.outputListeners.delete(sessionId);
  }

  async createShell(sessionId: string, cols: number, rows: number): Promise<void> {
    const request: CreateShellRequest = { session_id: sessionId, cols, rows };
    const response: ConnectResponse = await invoke('ssh_create_shell', { request });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create shell');
    }
  }

  async writeToShell(sessionId: string, input: string): Promise<void> {
    const request: WriteToShellRequest = { session_id: sessionId, input };
    const response: ConnectResponse = await invoke('ssh_write_to_shell', { request });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to write to shell');
    }
  }

  async resizeShell(sessionId: string, cols: number, rows: number): Promise<void> {
    const request: ResizeShellRequest = { session_id: sessionId, cols, rows };
    const response: ConnectResponse = await invoke('ssh_resize_shell', { request });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to resize shell');
    }
  }

  async listSessions(): Promise<SSHSession[]> {
    return await invoke('ssh_list_sessions');
  }

  // Terminal Output Handling
  onTerminalOutput(sessionId: string, callback: (data: string) => void): void {
    this.outputListeners.set(sessionId, callback);
  }

  offTerminalOutput(sessionId: string): void {
    this.outputListeners.delete(sessionId);
  }

  // SFTP Operations
  async createSftpSession(sessionId: string): Promise<void> {
    const response: ConnectResponse = await invoke('sftp_create_session', { sessionId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create SFTP session');
    }
  }

  async listDirectory(sessionId: string, path: string): Promise<SftpFileInfo[]> {
    const request: SftpListRequest = { session_id: sessionId, path };
    return await invoke('sftp_list_directory', { request });
  }

  async downloadFile(sessionId: string, remotePath: string): Promise<Uint8Array> {
    const request: SftpDownloadRequest = { session_id: sessionId, remote_path: remotePath };
    const contents: number[] = await invoke('sftp_download_file', { request });
    return new Uint8Array(contents);
  }

  async uploadFile(sessionId: string, remotePath: string, contents: Uint8Array): Promise<void> {
    const request: SftpUploadRequest = { 
      session_id: sessionId, 
      remote_path: remotePath, 
      contents: Array.from(contents) 
    };
    const response: ConnectResponse = await invoke('sftp_upload_file', { request });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to upload file');
    }
  }

  // Autocomplete
  async getAutocompleteSuggestions(
    sessionId: string, 
    input: string, 
    cursorPosition: number
  ): Promise<AutocompleteSuggestion[]> {
    const request: AutocompleteRequest = { 
      session_id: sessionId, 
      input, 
      cursor_position: cursorPosition 
    };
    return await invoke('get_autocomplete_suggestions', { request });
  }

  // Cleanup
  destroy(): void {
    // Remove all event listeners
    this.eventUnlisteners.forEach(unlisten => unlisten());
    this.eventUnlisteners = [];
    
    // Clear output listeners
    this.outputListeners.clear();
  }
}

// Singleton instance
let tauriAdapter: TauriSSHAdapter | null = null;

export function getTauriAdapter(): TauriSSHAdapter {
  if (!tauriAdapter) {
    tauriAdapter = new TauriSSHAdapter();
  }
  return tauriAdapter;
}

// Check if running in Tauri environment
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
