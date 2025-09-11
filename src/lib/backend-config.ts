// Backend configuration for switching between Node.js, Rust WebSocket, and Tauri backends

export interface BackendConfig {
  baseUrl: string;
  socketPath: string;
  useRustBackend: boolean;
  useTauriBackend: boolean;
}

// Check if we're running in Tauri (desktop app)
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

// Default configuration
const defaultConfig: BackendConfig = {
  baseUrl: isTauri ? 'http://localhost:3001' : '',
  socketPath: isTauri ? '/ws' : '/socket.io',
  useRustBackend: isTauri && !isTauri, // Use WebSocket when not in Tauri
  useTauriBackend: isTauri, // Use Tauri commands when in Tauri
};

// Allow override via environment variables in development
const config: BackendConfig = {
  baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || defaultConfig.baseUrl,
  socketPath: process.env.NEXT_PUBLIC_SOCKET_PATH || defaultConfig.socketPath,
  useRustBackend: process.env.NEXT_PUBLIC_USE_RUST_BACKEND === 'true' || defaultConfig.useRustBackend,
  useTauriBackend: process.env.NEXT_PUBLIC_USE_TAURI_BACKEND === 'true' || defaultConfig.useTauriBackend,
};

export default config;

// Helper function to get full socket URL
export function getSocketUrl(): string {
  if (config.useRustBackend) {
    return `${config.baseUrl}${config.socketPath}`;
  }
  return config.socketPath;
}

// Helper function to get API base URL
export function getApiBaseUrl(): string {
  return config.baseUrl;
}

// Helper function to check if we should use WebSocket instead of Socket.IO
export function shouldUseWebSocket(): boolean {
  return config.useRustBackend && !config.useTauriBackend;
}

// Helper function to check if we should use Tauri commands
export function shouldUseTauri(): boolean {
  return config.useTauriBackend;
}

// Helper function to check if running in Tauri environment
export function isTauriEnvironment(): boolean {
  return isTauri;
}
