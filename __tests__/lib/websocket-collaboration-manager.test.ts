import { WebSocketCollaborationManager } from '@/lib/websocket-collaboration-manager';
import { createMockWebSocket } from '../utils/test-utils';

describe('WebSocketCollaborationManager', () => {
  let collaborationManager: WebSocketCollaborationManager;
  let mockWebSocket: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWebSocket = createMockWebSocket();
    
    // Mock WebSocket constructor
    global.WebSocket = jest.fn(() => mockWebSocket.mockWs) as any;
    
    collaborationManager = new WebSocketCollaborationManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    collaborationManager.disconnect();
  });

  describe('Connection Management', () => {
    it('establishes WebSocket connection', async () => {
      const connectPromise = collaborationManager.connect('ws://localhost:3001');
      
      // Simulate connection opening
      mockWebSocket.simulateOpen();
      
      await connectPromise;
      
      expect(collaborationManager.isConnected()).toBe(true);
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3001');
    });

    it('handles connection errors', async () => {
      const connectPromise = collaborationManager.connect('ws://invalid-url');
      
      // Simulate connection error
      mockWebSocket.simulateError(new Error('Connection failed'));
      
      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(collaborationManager.isConnected()).toBe(false);
    });

    it('disconnects WebSocket connection', () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      
      collaborationManager.disconnect();
      
      expect(mockWebSocket.mockWs.close).toHaveBeenCalled();
      expect(collaborationManager.isConnected()).toBe(false);
    });

    it('handles connection close events', () => {
      const onDisconnect = jest.fn();
      collaborationManager.on('disconnect', onDisconnect);
      
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      
      // Simulate connection close
      mockWebSocket.simulateClose(1000, 'Normal closure');
      
      expect(onDisconnect).toHaveBeenCalledWith({
        code: 1000,
        reason: 'Normal closure',
        wasClean: true,
      });
      expect(collaborationManager.isConnected()).toBe(false);
    });

    it('attempts reconnection on unexpected disconnect', async () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      
      // Simulate unexpected disconnect
      mockWebSocket.simulateClose(1006, 'Abnormal closure');
      
      // Should attempt to reconnect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
    });

    it('creates a new collaboration session', () => {
      const sessionId = collaborationManager.createSession({
        name: 'Test Session',
        maxUsers: 5,
        permissions: { allowInput: true, allowFileTransfer: false },
      });
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'create_session',
          data: expect.objectContaining({
            sessionId,
            name: 'Test Session',
            maxUsers: 5,
          }),
        })
      );
    });

    it('joins an existing session', () => {
      const success = collaborationManager.joinSession('existing-session-123', {
        name: 'Test User',
        color: '#3b82f6',
      });
      
      expect(success).toBe(true);
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'join_session',
          data: {
            sessionId: 'existing-session-123',
            user: {
              name: 'Test User',
              color: '#3b82f6',
            },
          },
        })
      );
    });

    it('leaves a session', () => {
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });
      
      const success = collaborationManager.leaveSession();
      
      expect(success).toBe(true);
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'leave_session',
          data: { sessionId: 'test-session' },
        })
      );
    });

    it('handles session join responses', () => {
      const onSessionJoined = jest.fn();
      collaborationManager.on('session_joined', onSessionJoined);
      
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });
      
      // Simulate server response
      mockWebSocket.simulateMessage({
        type: 'session_joined',
        data: {
          sessionId: 'test-session',
          users: [
            { id: 'user-1', name: 'User', color: '#000', isActive: true },
          ],
        },
      });
      
      expect(onSessionJoined).toHaveBeenCalledWith({
        sessionId: 'test-session',
        users: expect.any(Array),
      });
    });
  });

  describe('Real-time Communication', () => {
    beforeEach(async () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });
    });

    it('sends terminal input to other users', () => {
      collaborationManager.sendTerminalInput('ls -la\n');
      
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'terminal_input',
          data: {
            sessionId: 'test-session',
            input: 'ls -la\n',
            timestamp: expect.any(Number),
          },
        })
      );
    });

    it('sends cursor position updates', () => {
      collaborationManager.sendCursorUpdate({
        x: 10,
        y: 5,
        line: 5,
        column: 10,
      });
      
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'cursor_update',
          data: {
            sessionId: 'test-session',
            cursor: { x: 10, y: 5, line: 5, column: 10 },
            timestamp: expect.any(Number),
          },
        })
      );
    });

    it('receives terminal output from other users', () => {
      const onTerminalOutput = jest.fn();
      collaborationManager.on('terminal_output', onTerminalOutput);
      
      mockWebSocket.simulateMessage({
        type: 'terminal_output',
        data: {
          sessionId: 'test-session',
          output: 'file1.txt file2.txt\n',
          userId: 'other-user',
          timestamp: Date.now(),
        },
      });
      
      expect(onTerminalOutput).toHaveBeenCalledWith({
        sessionId: 'test-session',
        output: 'file1.txt file2.txt\n',
        userId: 'other-user',
        timestamp: expect.any(Number),
      });
    });

    it('receives cursor updates from other users', () => {
      const onCursorUpdate = jest.fn();
      collaborationManager.on('cursor_update', onCursorUpdate);
      
      mockWebSocket.simulateMessage({
        type: 'cursor_update',
        data: {
          sessionId: 'test-session',
          userId: 'other-user',
          cursor: { x: 15, y: 8, line: 8, column: 15 },
          timestamp: Date.now(),
        },
      });
      
      expect(onCursorUpdate).toHaveBeenCalledWith({
        sessionId: 'test-session',
        userId: 'other-user',
        cursor: { x: 15, y: 8, line: 8, column: 15 },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('User Management', () => {
    beforeEach(async () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });
    });

    it('tracks connected users', () => {
      mockWebSocket.simulateMessage({
        type: 'user_joined',
        data: {
          sessionId: 'test-session',
          user: {
            id: 'user-2',
            name: 'Alice',
            color: '#3b82f6',
            isActive: true,
          },
        },
      });
      
      const users = collaborationManager.getConnectedUsers();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('handles user leave events', () => {
      const onUserLeft = jest.fn();
      collaborationManager.on('user_left', onUserLeft);
      
      // First add a user
      mockWebSocket.simulateMessage({
        type: 'user_joined',
        data: {
          sessionId: 'test-session',
          user: { id: 'user-2', name: 'Alice', color: '#3b82f6', isActive: true },
        },
      });
      
      // Then simulate user leaving
      mockWebSocket.simulateMessage({
        type: 'user_left',
        data: {
          sessionId: 'test-session',
          userId: 'user-2',
        },
      });
      
      expect(onUserLeft).toHaveBeenCalledWith({
        sessionId: 'test-session',
        userId: 'user-2',
      });
      
      const users = collaborationManager.getConnectedUsers();
      expect(users).toHaveLength(0);
    });

    it('updates user activity status', () => {
      // Add a user
      mockWebSocket.simulateMessage({
        type: 'user_joined',
        data: {
          sessionId: 'test-session',
          user: { id: 'user-2', name: 'Alice', color: '#3b82f6', isActive: true },
        },
      });
      
      // Update user status
      mockWebSocket.simulateMessage({
        type: 'user_status_update',
        data: {
          sessionId: 'test-session',
          userId: 'user-2',
          isActive: false,
          lastSeen: Date.now(),
        },
      });
      
      const users = collaborationManager.getConnectedUsers();
      expect(users[0].isActive).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
    });

    it('handles invalid JSON messages gracefully', () => {
      const onError = jest.fn();
      collaborationManager.on('error', onError);
      
      // Simulate invalid JSON
      mockWebSocket.mockWs.onmessage?.({ data: 'invalid json' } as MessageEvent);
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parse_error',
          message: expect.stringContaining('Invalid JSON'),
        })
      );
    });

    it('handles unknown message types', () => {
      const onError = jest.fn();
      collaborationManager.on('error', onError);
      
      mockWebSocket.simulateMessage({
        type: 'unknown_message_type',
        data: { some: 'data' },
      });
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unknown_message',
          messageType: 'unknown_message_type',
        })
      );
    });

    it('validates message structure', () => {
      const onError = jest.fn();
      collaborationManager.on('error', onError);
      
      // Message without required fields
      mockWebSocket.simulateMessage({
        type: 'terminal_input',
        // Missing data field
      });
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation_error',
        })
      );
    });
  });

  describe('Event System', () => {
    it('registers and triggers event listeners', () => {
      const listener = jest.fn();
      
      collaborationManager.on('test_event', listener);
      collaborationManager.emit('test_event', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    it('removes event listeners', () => {
      const listener = jest.fn();
      
      collaborationManager.on('test_event', listener);
      collaborationManager.off('test_event', listener);
      collaborationManager.emit('test_event', { data: 'test' });
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('handles multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      collaborationManager.on('test_event', listener1);
      collaborationManager.on('test_event', listener2);
      collaborationManager.emit('test_event', { data: 'test' });
      
      expect(listener1).toHaveBeenCalledWith({ data: 'test' });
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket errors', () => {
      const onError = jest.fn();
      collaborationManager.on('error', onError);
      
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateError(new Error('Network error'));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_error',
          error: expect.any(Error),
        })
      );
    });

    it('handles send errors when disconnected', () => {
      const onError = jest.fn();
      collaborationManager.on('error', onError);
      
      // Try to send without connection
      collaborationManager.sendTerminalInput('test');
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'send_error',
          message: 'Not connected to collaboration server',
        })
      );
    });
  });

  describe('Performance', () => {
    it('handles rapid message sending efficiently', async () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });
      
      const startTime = performance.now();
      
      // Send many messages rapidly
      for (let i = 0; i < 100; i++) {
        collaborationManager.sendTerminalInput(`command ${i}\n`);
      }
      
      const endTime = performance.now();
      
      // Should handle rapid sending efficiently
      expect(endTime - startTime).toBeLessThan(100);
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledTimes(100);
    });

    it('throttles cursor updates to prevent spam', () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });
      
      // Send many cursor updates rapidly
      for (let i = 0; i < 50; i++) {
        collaborationManager.sendCursorUpdate({
          x: i,
          y: i,
          line: i,
          column: i,
        });
      }
      
      // Should throttle cursor updates
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledTimes(1); // Only the last update
    });
  });
});
