'use client';

export interface CollaborationUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    line: number;
    column: number;
  };
  isActive: boolean;
  lastSeen: number;
}

export interface CollaborationMessage {
  type: 'user-join' | 'user-leave' | 'user-update' | 'terminal-input' | 'terminal-output' | 'cursor-move' | 'selection-change' | 'ping' | 'pong';
  sessionId: string;
  userId: string;
  timestamp: number;
  data?: any;
}

export interface CollaborationSession {
  id: string;
  name: string;
  ownerId: string;
  users: Map<string, CollaborationUser>;
  isActive: boolean;
  createdAt: number;
  lastActivity: number;
  settings: {
    maxUsers: number;
    allowGuestUsers: boolean;
    requirePermission: boolean;
    shareTerminalInput: boolean;
    shareTerminalOutput: boolean;
    shareCursor: boolean;
  };
}

export class WebSocketCollaborationManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentSession: CollaborationSession | null = null;
  private currentUser: CollaborationUser | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;

  constructor() {
    this.setupEventListeners();
  }

  // Event system
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }

  // Connection management
  async connect(sessionId: string, user: Omit<CollaborationUser, 'isActive' | 'lastSeen'>): Promise<boolean> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return true;
    }

    this.isConnecting = true;
    this.currentUser = {
      ...user,
      isActive: true,
      lastSeen: Date.now(),
    };

    try {
      const wsUrl = this.getWebSocketUrl();
      this.ws = new WebSocket(`${wsUrl}?sessionId=${sessionId}&userId=${user.id}`);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { sessionId, user: this.currentUser });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(sessionId);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

      return true;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.isConnecting = false;
      return false;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.stopHeartbeat();
    this.currentSession = null;
    this.currentUser = null;
  }

  private scheduleReconnect(sessionId: string) {
    if (!this.currentUser) return;

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.currentUser) {
        this.connect(sessionId, this.currentUser);
      }
    }, delay);
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/collaboration/websocket`;
  }

  // Message handling
  private handleMessage(event: MessageEvent) {
    try {
      const message: CollaborationMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'user-join':
          this.handleUserJoin(message);
          break;
        case 'user-leave':
          this.handleUserLeave(message);
          break;
        case 'user-update':
          this.handleUserUpdate(message);
          break;
        case 'terminal-input':
          this.handleTerminalInput(message);
          break;
        case 'terminal-output':
          this.handleTerminalOutput(message);
          break;
        case 'cursor-move':
          this.handleCursorMove(message);
          break;
        case 'selection-change':
          this.handleSelectionChange(message);
          break;
        case 'pong':
          // Heartbeat response
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleUserJoin(message: CollaborationMessage) {
    if (this.currentSession) {
      const user: CollaborationUser = message.data;
      this.currentSession.users.set(user.id, user);
      this.emit('userJoined', { user, session: this.currentSession });
    }
  }

  private handleUserLeave(message: CollaborationMessage) {
    if (this.currentSession) {
      this.currentSession.users.delete(message.userId);
      this.emit('userLeft', { userId: message.userId, session: this.currentSession });
    }
  }

  private handleUserUpdate(message: CollaborationMessage) {
    if (this.currentSession) {
      const user = this.currentSession.users.get(message.userId);
      if (user) {
        Object.assign(user, message.data);
        this.emit('userUpdated', { user, session: this.currentSession });
      }
    }
  }

  private handleTerminalInput(message: CollaborationMessage) {
    this.emit('terminalInput', {
      userId: message.userId,
      input: message.data.input,
      timestamp: message.timestamp,
    });
  }

  private handleTerminalOutput(message: CollaborationMessage) {
    this.emit('terminalOutput', {
      userId: message.userId,
      output: message.data.output,
      timestamp: message.timestamp,
    });
  }

  private handleCursorMove(message: CollaborationMessage) {
    if (this.currentSession) {
      const user = this.currentSession.users.get(message.userId);
      if (user) {
        user.cursor = message.data.cursor;
        this.emit('cursorMoved', { user, cursor: message.data.cursor });
      }
    }
  }

  private handleSelectionChange(message: CollaborationMessage) {
    this.emit('selectionChanged', {
      userId: message.userId,
      selection: message.data.selection,
      timestamp: message.timestamp,
    });
  }

  // Message sending
  private sendMessage(message: Omit<CollaborationMessage, 'timestamp'>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const fullMessage: CollaborationMessage = {
        ...message,
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(fullMessage));
    }
  }

  sendTerminalInput(sessionId: string, input: string) {
    this.sendMessage({
      type: 'terminal-input',
      sessionId,
      userId: this.currentUser?.id || '',
      data: { input },
    });
  }

  sendTerminalOutput(sessionId: string, output: string) {
    this.sendMessage({
      type: 'terminal-output',
      sessionId,
      userId: this.currentUser?.id || '',
      data: { output },
    });
  }

  sendCursorMove(sessionId: string, cursor: CollaborationUser['cursor']) {
    this.sendMessage({
      type: 'cursor-move',
      sessionId,
      userId: this.currentUser?.id || '',
      data: { cursor },
    });
  }

  sendSelectionChange(sessionId: string, selection: any) {
    this.sendMessage({
      type: 'selection-change',
      sessionId,
      userId: this.currentUser?.id || '',
      data: { selection },
    });
  }

  updateUser(updates: Partial<CollaborationUser>) {
    if (this.currentUser && this.currentSession) {
      Object.assign(this.currentUser, updates);
      this.sendMessage({
        type: 'user-update',
        sessionId: this.currentSession.id,
        userId: this.currentUser.id,
        data: updates,
      });
    }
  }

  // Heartbeat
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: 'ping',
          sessionId: this.currentSession?.id || '',
          userId: this.currentUser?.id || '',
        });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Utility methods
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getCurrentSession(): CollaborationSession | null {
    return this.currentSession;
  }

  getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  getConnectedUsers(): CollaborationUser[] {
    return this.currentSession ? Array.from(this.currentSession.users.values()) : [];
  }

  private setupEventListeners() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (this.currentUser) {
        this.currentUser.isActive = !document.hidden;
        this.updateUser({ isActive: this.currentUser.isActive });
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }
}

export const collaborationManager = new WebSocketCollaborationManager();
