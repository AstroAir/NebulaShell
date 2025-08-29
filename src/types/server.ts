import { Socket } from 'socket.io';
import { SSHConnectionConfig } from './ssh'; // TerminalSize removed as not used

// Extended Socket interface with custom properties
export interface ExtendedSocket extends Socket {
  shell?: any; // SSH shell instance
  sessionId?: string;
}

// Socket.IO event data types
export interface SSHConnectData {
  config: SSHConnectionConfig;
  cols?: number;
  rows?: number;
}

export interface TerminalInputData {
  sessionId: string;
  input: string;
}

export interface TerminalResizeData {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalDataResponse {
  sessionId: string;
  data: string;
}

export interface SSHConnectedResponse {
  sessionId: string;
  status: 'connected';
}

export interface SSHDisconnectedResponse {
  sessionId: string;
}

export interface SSHErrorResponse {
  sessionId?: string;
  message: string;
  code?: string;
  details?: string;
}

// Enhanced error types
export interface TypedError extends Error {
  code?: string;
  details?: string;
  sessionId?: string;
}

export interface ValidationError extends TypedError {
  field?: string;
  value?: any;
}

export interface ConnectionError extends TypedError {
  hostname?: string;
  port?: number;
  timeout?: boolean;
}

export interface AuthenticationError extends TypedError {
  username?: string;
  authMethod?: 'password' | 'privateKey';
}

// Server configuration types
export interface ServerConfig {
  dev: boolean;
  hostname: string;
  port: number;
}

// HTTP Server error types
export interface ServerError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  address?: string;
  port?: number;
}

// Socket.IO server events map
export interface ServerToClientEvents {
  terminal_data: (data: TerminalDataResponse) => void;
  ssh_connected: (data: SSHConnectedResponse) => void;
  ssh_disconnected: (data: SSHDisconnectedResponse) => void;
  ssh_error: (data: SSHErrorResponse) => void;
}

export interface ClientToServerEvents {
  ssh_connect: (data: SSHConnectData) => void;
  terminal_input: (data: TerminalInputData) => void;
  terminal_resize: (data: TerminalResizeData) => void;
  ssh_disconnect: () => void;
}

export interface InterServerEvents {
  // Add any inter-server events if needed
}

export interface SocketData {
  // Add any socket data if needed
}
