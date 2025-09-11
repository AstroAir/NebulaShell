// WebSocket adapter to handle Socket.IO, raw WebSocket, and Tauri connections

import { io, Socket as SocketIOSocket } from 'socket.io-client';
import { shouldUseWebSocket, shouldUseTauri, getSocketUrl } from './backend-config';
import { TauriSSHAdapter } from './tauri-adapter';

export interface WebSocketAdapter {
  connect(): void;
  disconnect(): void;
  emit(event: string, data: any): void;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback?: (data: any) => void): void;
  connected: boolean;
}

class SocketIOAdapter implements WebSocketAdapter {
  private socket: SocketIOSocket | null = null;

  get connected(): boolean {
    return this.socket?.connected || false;
  }

  connect(): void {
    this.socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, data: any): void {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: (data: any) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }
}

class RawWebSocketAdapter implements WebSocketAdapter {
  private ws: WebSocket | null = null;
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    const url = getSocketUrl();
    console.log('Connecting to WebSocket:', url);
    
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connect', {});
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.emit('disconnect', { code: event.code, reason: event.reason });
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
          this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type) {
          this.emit(message.type, message);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  emit(event: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // For internal events like 'connect', 'disconnect', just trigger listeners
      if (event === 'connect' || event === 'disconnect' || event === 'error') {
        this.triggerEvent(event, data);
        return;
      }

      // For SSH events, send as WebSocket message
      const message = {
        type: event,
        ...data
      };
      this.ws.send(JSON.stringify(message));
    }
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
}

export function createWebSocketAdapter(): WebSocketAdapter {
  if (shouldUseTauri()) {
    console.log('Using Tauri adapter for desktop app');
    return new TauriSSHAdapter();
  } else if (shouldUseWebSocket()) {
    console.log('Using raw WebSocket adapter for Rust backend');
    return new RawWebSocketAdapter();
  } else {
    console.log('Using Socket.IO adapter for Node.js backend');
    return new SocketIOAdapter();
  }
}
