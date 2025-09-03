import { WebSocketCollaborationManager } from '@/lib/websocket-collaboration-manager';
import { createMockWebSocket } from '../utils/test-utils';

describe('WebSocketCollaborationManager', () => {
  let collaborationManager: WebSocketCollaborationManager;
  let mockWebSocket: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWebSocket = createMockWebSocket();

    // Mock WebSocket constructor to always return the same instance
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket.mockWs) as any;

    // Add WebSocket constants to the mock
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).OPEN = 1;
    (global.WebSocket as any).CLOSING = 2;
    (global.WebSocket as any).CLOSED = 3;

    collaborationManager = new WebSocketCollaborationManager();
  });

  afterEach(() => {
    // Clean up collaboration manager and connections
    if (collaborationManager) {
      collaborationManager.disconnect();
    }

    // Clean up mock WebSocket
    if (mockWebSocket && mockWebSocket.cleanup) {
      mockWebSocket.cleanup();
    }

    // Clear all timers and mocks
    jest.clearAllTimers();
    jest.clearAllMocks();

    // Use global cleanup function if available
    if ((global as any).cleanupTestTimeouts) {
      (global as any).cleanupTestTimeouts();
    }
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
      const onError = jest.fn();
      collaborationManager.on('error', onError);

      // Mock WebSocket constructor to throw an error
      (global.WebSocket as any).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      // The connect method should reject when WebSocket constructor throws
      await expect(collaborationManager.connect('ws://invalid-url')).rejects.toThrow('Connection failed');
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
      const onDisconnect = jest.fn();
      collaborationManager.on('disconnect', onDisconnect);

      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();

      // Clear previous WebSocket constructor calls
      (global.WebSocket as any).mockClear();

      // Simulate unexpected disconnect (wasClean: false)
      // We need to modify the mock to simulate wasClean: false
      mockWebSocket.mockWs.readyState = mockWebSocket.mockWs.CLOSED;
      if (mockWebSocket.mockWs.onclose) {
        mockWebSocket.mockWs.onclose({ code: 1006, reason: 'Abnormal closure', wasClean: false } as CloseEvent);
      }

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait longer than reconnect delay

      // Verify disconnect event was emitted
      expect(onDisconnect).toHaveBeenCalledWith({
        code: 1006,
        reason: 'Abnormal closure',
        wasClean: false, // Now properly simulated
      });

      // Verify reconnection attempt was made (new WebSocket created)
      expect(global.WebSocket).toHaveBeenCalled();
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
      // Check that the send method was called with create_session message
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"create_session"')
      );
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"name":"Test Session"')
      );
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"maxUsers":5')
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

      // Check that the send method was called with terminal_input message
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"terminal_input"')
      );
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"input":"ls -la\\n"')
      );
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":"test-session"')
      );
    });

    it('sends cursor position updates', () => {
      collaborationManager.sendCursorUpdate({
        x: 10,
        y: 5,
        line: 5,
        column: 10,
      });

      // Check that the send method was called with cursor_update message
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"cursor_update"')
      );
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"x":10')
      );
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":"test-session"')
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
          type: 'unknown_message',
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
    it('handles WebSocket errors', async () => {
      const onError = jest.fn();
      collaborationManager.on('error', onError);

      const connectPromise = collaborationManager.connect('ws://localhost:3001');

      // Wait a bit for the WebSocket to be set up
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manually trigger the error handler
      const errorEvent = { error: new Error('Network error'), type: 'error', target: mockWebSocket.mockWs };
      if (mockWebSocket.mockWs.onerror) {
        mockWebSocket.mockWs.onerror(errorEvent as any);
      }

      // The connect promise should reject with the error event
      await expect(connectPromise).rejects.toEqual(errorEvent);

      // Verify error event was emitted
      expect(onError).toHaveBeenCalledWith({
        type: 'connection_error',
        error: errorEvent,
      });
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
      
      const startTime = Date.now();

      // Send many messages rapidly
      for (let i = 0; i < 100; i++) {
        collaborationManager.sendTerminalInput(`command ${i}\n`);
      }

      const endTime = Date.now();

      // Should handle rapid sending efficiently (allow up to 1000ms for test environment)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledTimes(101); // +1 for join_session message
    });

    it('throttles cursor updates to prevent spam', () => {
      collaborationManager.connect('ws://localhost:3001');
      mockWebSocket.simulateOpen();
      collaborationManager.joinSession('test-session', { name: 'User', color: '#000' });

      // Clear previous calls
      mockWebSocket.mockWs.send.mockClear();

      // Send many cursor updates rapidly
      for (let i = 0; i < 50; i++) {
        collaborationManager.sendCursorUpdate({
          x: i,
          y: i,
          line: i,
          column: i,
        });
      }

      // Should throttle cursor updates (expect at least some throttling, but not necessarily just 1)
      expect(mockWebSocket.mockWs.send).toHaveBeenCalledTimes(1); // Only the throttled update
    });
  });
});
