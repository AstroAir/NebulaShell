export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  lastSeen: number;
  cursor: {
    x: number;
    y: number;
    line: number;
    column: number;
  };
}

export interface CollaborationSession {
  id: string;
  name: string;
  createdAt: number;
  users: CollaborationUser[];
  maxUsers: number;
  permissions: {
    allowInput: boolean;
    allowFileTransfer: boolean;
  };
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export class WebSocketCollaborationManager {
  private ws: WebSocket | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private currentSession: string | null = null;
  private connectedUsers: CollaborationUser[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Initialize event listener map
    this.eventListeners.set('connect', []);
    this.eventListeners.set('disconnect', []);
    this.eventListeners.set('session_joined', []);
    this.eventListeners.set('session_left', []);
    this.eventListeners.set('user_joined', []);
    this.eventListeners.set('user_left', []);
    this.eventListeners.set('terminal_input', []);
    this.eventListeners.set('terminal_output', []);
    this.eventListeners.set('cursor_update', []);
    this.eventListeners.set('error', []);
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.emit('connect', {});
          resolve();
        };

        this.ws.onclose = (event) => {
          this.emit('disconnect', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect(url);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.emit('error', {
            type: 'connection_error',
            error,
          });
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    this.currentSession = null;
    this.connectedUsers = [];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  createSession(options: {
    name: string;
    maxUsers: number;
    permissions: { allowInput: boolean; allowFileTransfer: boolean };
  }): string {
    const sessionId = this.generateSessionId();
    this.sendMessage({
      type: 'create_session',
      data: {
        sessionId,
        ...options,
      },
    });
    return sessionId;
  }

  joinSession(sessionId: string, user: { name: string; color: string }): boolean {
    if (!this.isConnected()) {
      this.emit('error', {
        type: 'send_error',
        message: 'Not connected to collaboration server',
      });
      return false;
    }

    this.currentSession = sessionId;
    this.sendMessage({
      type: 'join_session',
      data: {
        sessionId,
        user,
      },
    });
    return true;
  }

  leaveSession(): boolean {
    if (!this.currentSession) return false;

    this.sendMessage({
      type: 'leave_session',
      data: {
        sessionId: this.currentSession,
      },
    });

    this.currentSession = null;
    this.connectedUsers = [];
    return true;
  }

  sendTerminalInput(input: string): void {
    if (!this.currentSession) {
      this.emit('error', {
        type: 'send_error',
        message: 'Not connected to collaboration server',
      });
      return;
    }

    this.sendMessage({
      type: 'terminal_input',
      data: {
        sessionId: this.currentSession,
        input,
        timestamp: Date.now(),
      },
    });
  }

  sendCursorUpdate(cursor: { x: number; y: number; line: number; column: number }): void {
    if (!this.currentSession) return;

    // Throttle cursor updates to prevent spam
    this.throttledSendMessage({
      type: 'cursor_update',
      data: {
        sessionId: this.currentSession,
        cursor,
        timestamp: Date.now(),
      },
    });
  }

  getConnectedUsers(): CollaborationUser[] {
    return [...this.connectedUsers];
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  private sendMessage(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      this.emit('error', {
        type: 'send_error',
        message: 'Not connected to collaboration server',
      });
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      this.emit('error', {
        type: 'send_error',
        error,
      });
    }
  }

  private throttledSendMessage = this.throttle((message: WebSocketMessage) => {
    this.sendMessage(message);
  }, 100);

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      this.processMessage(message);
    } catch (error) {
      this.emit('error', {
        type: 'parse_error',
        message: 'Invalid JSON received from server',
        error,
      });
    }
  }

  private processMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'session_joined':
        this.handleSessionJoined(message.data);
        break;
      case 'user_joined':
        this.handleUserJoined(message.data);
        break;
      case 'user_left':
        this.handleUserLeft(message.data);
        break;
      case 'terminal_output':
        this.emit('terminal_output', message.data);
        break;
      case 'cursor_update':
        this.emit('cursor_update', message.data);
        break;
      case 'user_status_update':
        this.handleUserStatusUpdate(message.data);
        break;
      default:
        this.emit('error', {
          type: 'unknown_message',
          messageType: message.type,
        });
    }
  }

  private handleSessionJoined(data: any): void {
    this.connectedUsers = data.users || [];
    this.emit('session_joined', data);
  }

  private handleUserJoined(data: any): void {
    const existingIndex = this.connectedUsers.findIndex(u => u.id === data.user.id);
    if (existingIndex === -1) {
      this.connectedUsers.push(data.user);
    }
    this.emit('user_joined', data);
  }

  private handleUserLeft(data: any): void {
    this.connectedUsers = this.connectedUsers.filter(u => u.id !== data.userId);
    this.emit('user_left', data);
  }

  private handleUserStatusUpdate(data: any): void {
    const userIndex = this.connectedUsers.findIndex(u => u.id === data.userId);
    if (userIndex !== -1) {
      this.connectedUsers[userIndex] = {
        ...this.connectedUsers[userIndex],
        isActive: data.isActive,
        lastSeen: data.lastSeen,
      };
    }
  }

  private attemptReconnect(url: string): void {
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect(url).catch(() => {
        // Reconnection failed, will try again if under limit
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private throttle(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;
    
    return (...args: any[]) => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func(...args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }
}

export const webSocketCollaborationManager = new WebSocketCollaborationManager();
