import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Types for collaboration
interface CollaborationUser {
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
  ws: WebSocket;
}

interface CollaborationSession {
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

interface CollaborationMessage {
  type: 'user-join' | 'user-leave' | 'user-update' | 'terminal-input' | 'terminal-output' | 'cursor-move' | 'selection-change' | 'ping' | 'pong';
  sessionId: string;
  userId: string;
  timestamp: number;
  data?: any;
}

// Global state for collaboration sessions
const sessions = new Map<string, CollaborationSession>();
const userSessions = new Map<string, string>(); // userId -> sessionId

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Initialize WebSocket server
function initializeWebSocketServer() {
  if (wss) return wss;

  wss = new WebSocketServer({ 
    port: 8080,
    path: '/api/collaboration/websocket'
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');

    if (!sessionId || !userId) {
      ws.close(1008, 'Missing sessionId or userId');
      return;
    }

    handleUserConnection(ws, sessionId, userId);
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  console.log('WebSocket server initialized on port 8080');
  return wss;
}

function handleUserConnection(ws: WebSocket, sessionId: string, userId: string) {
  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    session = createSession(sessionId, userId);
    sessions.set(sessionId, session);
  }

  // Check if user is already in session
  const existingUser = session.users.get(userId);
  if (existingUser) {
    // Update existing user's WebSocket connection
    existingUser.ws = ws;
    existingUser.isActive = true;
    existingUser.lastSeen = Date.now();
  } else {
    // Add new user to session
    if (session.users.size >= session.settings.maxUsers) {
      ws.close(1008, 'Session is full');
      return;
    }

    const user: CollaborationUser = {
      id: userId,
      name: `User ${userId.slice(-4)}`, // Default name
      color: generateUserColor(userId),
      isActive: true,
      lastSeen: Date.now(),
      ws,
    };

    session.users.set(userId, user);
    userSessions.set(userId, sessionId);

    // Notify other users about new user
    broadcastToSession(sessionId, {
      type: 'user-join',
      sessionId,
      userId,
      timestamp: Date.now(),
      data: {
        id: user.id,
        name: user.name,
        color: user.color,
        isActive: user.isActive,
        lastSeen: user.lastSeen,
      },
    }, userId);
  }

  // Set up message handlers
  ws.on('message', (data) => {
    try {
      const message: CollaborationMessage = JSON.parse(data.toString());
      handleMessage(sessionId, userId, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    handleUserDisconnection(sessionId, userId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error for user', userId, ':', error);
  });

  // Send initial session state to user
  sendToUser(userId, {
    type: 'user-join',
    sessionId,
    userId,
    timestamp: Date.now(),
    data: {
      session: {
        id: session.id,
        users: Array.from(session.users.values()).map(u => ({
          id: u.id,
          name: u.name,
          color: u.color,
          isActive: u.isActive,
          lastSeen: u.lastSeen,
          cursor: u.cursor,
        })),
      },
    },
  });

  console.log(`User ${userId} connected to session ${sessionId}`);
}

function handleMessage(sessionId: string, userId: string, message: CollaborationMessage) {
  const session = sessions.get(sessionId);
  const user = session?.users.get(userId);
  
  if (!session || !user) {
    console.error('Invalid session or user for message:', sessionId, userId);
    return;
  }

  // Update user activity
  user.lastSeen = Date.now();
  user.isActive = true;
  session.lastActivity = Date.now();

  switch (message.type) {
    case 'ping':
      // Respond with pong
      sendToUser(userId, {
        type: 'pong',
        sessionId,
        userId,
        timestamp: Date.now(),
      });
      break;

    case 'user-update':
      // Update user data
      Object.assign(user, message.data);
      broadcastToSession(sessionId, message, userId);
      break;

    case 'terminal-input':
      if (session.settings.shareTerminalInput) {
        broadcastToSession(sessionId, message, userId);
      }
      break;

    case 'terminal-output':
      if (session.settings.shareTerminalOutput) {
        broadcastToSession(sessionId, message, userId);
      }
      break;

    case 'cursor-move':
      if (session.settings.shareCursor) {
        user.cursor = message.data.cursor;
        broadcastToSession(sessionId, message, userId);
      }
      break;

    case 'selection-change':
      broadcastToSession(sessionId, message, userId);
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

function handleUserDisconnection(sessionId: string, userId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const user = session.users.get(userId);
  if (user) {
    user.isActive = false;
    user.lastSeen = Date.now();

    // Notify other users
    broadcastToSession(sessionId, {
      type: 'user-leave',
      sessionId,
      userId,
      timestamp: Date.now(),
    }, userId);

    // Remove user after a delay (in case they reconnect)
    setTimeout(() => {
      session.users.delete(userId);
      userSessions.delete(userId);

      // Clean up empty sessions
      if (session.users.size === 0) {
        sessions.delete(sessionId);
        console.log(`Session ${sessionId} cleaned up`);
      }
    }, 30000); // 30 seconds
  }

  console.log(`User ${userId} disconnected from session ${sessionId}`);
}

function createSession(sessionId: string, ownerId: string): CollaborationSession {
  return {
    id: sessionId,
    name: `Session ${sessionId.slice(-8)}`,
    ownerId,
    users: new Map(),
    isActive: true,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    settings: {
      maxUsers: 10,
      allowGuestUsers: true,
      requirePermission: false,
      shareTerminalInput: true,
      shareTerminalOutput: true,
      shareCursor: true,
    },
  };
}

function broadcastToSession(sessionId: string, message: CollaborationMessage, excludeUserId?: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const messageStr = JSON.stringify(message);
  
  session.users.forEach((user, userId) => {
    if (userId !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(messageStr);
    }
  });
}

function sendToUser(userId: string, message: CollaborationMessage) {
  const sessionId = userSessions.get(userId);
  if (!sessionId) return;

  const session = sessions.get(sessionId);
  const user = session?.users.get(userId);
  
  if (user && user.ws.readyState === WebSocket.OPEN) {
    user.ws.send(JSON.stringify(message));
  }
}

function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Cleanup inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  const maxInactiveTime = 24 * 60 * 60 * 1000; // 24 hours

  sessions.forEach((session, sessionId) => {
    if (now - session.lastActivity > maxInactiveTime) {
      sessions.delete(sessionId);
      console.log(`Cleaned up inactive session: ${sessionId}`);
    }
  });
}, 60 * 60 * 1000); // Check every hour

// Initialize WebSocket server
initializeWebSocketServer();

// Next.js API route handler (for HTTP requests)
export async function GET(request: NextRequest) {
  return new Response('WebSocket endpoint - use WebSocket connection', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, userId } = body;

    switch (action) {
      case 'get-session':
        const session = sessions.get(sessionId);
        if (session) {
          return Response.json({
            success: true,
            session: {
              id: session.id,
              name: session.name,
              ownerId: session.ownerId,
              userCount: session.users.size,
              isActive: session.isActive,
              settings: session.settings,
            },
          });
        } else {
          return Response.json({
            success: false,
            error: 'Session not found',
          }, { status: 404 });
        }

      case 'list-sessions':
        const activeSessions = Array.from(sessions.values())
          .filter(s => s.isActive)
          .map(s => ({
            id: s.id,
            name: s.name,
            userCount: s.users.size,
            lastActivity: s.lastActivity,
          }));

        return Response.json({
          success: true,
          sessions: activeSessions,
        });

      default:
        return Response.json({
          success: false,
          error: 'Unknown action',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('API error:', error);
    return Response.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
