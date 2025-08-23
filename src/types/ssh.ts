export interface SSHConnectionConfig {
  id: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  name?: string;
}

export interface SSHSession {
  id: string;
  config: SSHConnectionConfig;
  connected: boolean;
  lastActivity: Date;
  createdAt: Date;
}

export interface TerminalMessage {
  type: 'data' | 'resize' | 'connect' | 'disconnect' | 'error';
  sessionId: string;
  data?: string;
  cols?: number;
  rows?: number;
  error?: string;
}

export interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  message?: string;
  sessionId?: string;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface FileTransferRequest {
  sessionId: string;
  localPath: string;
  remotePath: string;
  direction: 'upload' | 'download';
}

export interface FileTransferProgress {
  sessionId: string;
  filename: string;
  transferred: number;
  total: number;
  percentage: number;
}
