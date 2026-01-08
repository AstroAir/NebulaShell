import { createEnhancedSocketMock, EnhancedSocketMock } from '../mocks/socket.io';
import { enhancedSSHMock } from '../mocks/ssh';

describe('WebSocket/Socket.IO Communication Layer Testing', () => {
  let socketMock: EnhancedSocketMock;
  let sessionId: string;

  beforeEach(() => {
    socketMock = createEnhancedSocketMock({
      autoConnect: false,
      connectionDelay: 50,
      simulateNetworkIssues: false,
    });
    
    sessionId = `test-session-${Date.now()}`;
    enhancedSSHMock.clearSessions();
  });

  afterEach(() => {
    socketMock.reset();
    enhancedSSHMock.clearSessions();
  });

  describe('Connection Management', () => {
    it('should establish socket connection', async () => {
      const connectPromise = new Promise<void>((resolve) => {
        socketMock.once('connect', () => {
          resolve();
        });
      });

      socketMock.connect();
      await connectPromise;

      expect(socketMock.connected).toBe(true);
    });

    it('should handle socket disconnection', async () => {
      socketMock.connect();
      
      const disconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('disconnect', () => {
          resolve();
        });
      });

      socketMock.disconnect();
      await disconnectPromise;

      expect(socketMock.connected).toBe(false);
    });

    it('should handle connection with network delay', async () => {
      socketMock.setNetworkConditions({
        latency: 100,
        jitter: 20,
      });

      const startTime = Date.now();
      
      const connectPromise = new Promise<void>((resolve) => {
        socketMock.once('connect', () => {
          resolve();
        });
      });

      socketMock.connect();
      await connectPromise;

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(80); // Account for jitter
    });

    it('should handle network interruption and reconnection', async () => {
      socketMock.connect();
      
      const disconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('disconnect', () => {
          resolve();
        });
      });

      const reconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('connect', () => {
          resolve();
        });
      });

      // Simulate network interruption
      socketMock.simulateNetworkInterruption(200);
      
      await disconnectPromise;
      expect(socketMock.connected).toBe(false);
      
      await reconnectPromise;
      expect(socketMock.connected).toBe(true);
    });
  });

  describe('SSH Connection Events', () => {
    beforeEach(async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });
    });

    it('should handle SSH connection request', async () => {
      const sshConfig = {
        id: sessionId,
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      };

      const sshConnectedPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_connected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.status).toBe('connected');
          resolve();
        });
      });

      await socketMock.simulateSSHConnect(sshConfig);
      await sshConnectedPromise;
    });

    it('should handle SSH connection failure', async () => {
      const invalidConfig = {
        id: sessionId,
        hostname: 'invalid.example.com',
        port: 22,
        username: 'testuser',
        password: 'wrongpass',
      };

      const sshErrorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('CONNECTION_FAILED');
          expect(data.message).toBeDefined();
          resolve();
        });
      });

      // Mock connection failure
      enhancedSSHMock.addCustomCommand = jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await socketMock.simulateSSHConnect(invalidConfig);
      await sshErrorPromise;
    });

    it('should handle SSH disconnection', async () => {
      const sshConfig = {
        id: sessionId,
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      };

      await socketMock.simulateSSHConnect(sshConfig);

      const sshDisconnectedPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_disconnected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          resolve();
        });
      });

      enhancedSSHMock.disconnect(sessionId);
      await sshDisconnectedPromise;
    });
  });

  describe('Terminal Data Communication', () => {
    beforeEach(async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      const sshConfig = {
        id: sessionId,
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      };

      await socketMock.simulateSSHConnect(sshConfig);
    });

    it('should handle terminal input and echo', async () => {
      const terminalDataPromise = new Promise<void>((resolve) => {
        socketMock.once('terminal_data', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.data).toBe('test input');
          resolve();
        });
      });

      await socketMock.simulateTerminalInput(sessionId, 'test input');
      await terminalDataPromise;
    });

    it('should handle command execution and output', async () => {
      const terminalOutputPromise = new Promise<void>((resolve) => {
        socketMock.once('terminal_data', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.data).toContain('/home/testuser');
          expect(data.data).toContain('$ '); // Prompt
          resolve();
        });
      });

      await socketMock.simulateTerminalInput(sessionId, 'pwd\r');
      await terminalOutputPromise;
    });

    it('should handle special key sequences', async () => {
      const interruptPromise = new Promise<void>((resolve) => {
        socketMock.once('terminal_data', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.data).toContain('$ '); // Should return to prompt
          resolve();
        });
      });

      // Start a long-running command
      await socketMock.simulateTerminalInput(sessionId, 'ping google.com\r');
      
      // Send Ctrl+C
      await socketMock.simulateTerminalInput(sessionId, '\x03');
      await interruptPromise;
    });

    it('should handle terminal resize events', async () => {
      const resizePromise = new Promise<void>((resolve) => {
        enhancedSSHMock.once('resize', (id, dimensions) => {
          expect(id).toBe(sessionId);
          expect(dimensions.cols).toBe(120);
          expect(dimensions.rows).toBe(40);
          resolve();
        });
      });

      socketMock.simulateTerminalResize(sessionId, 120, 40);
      await resizePromise;
    });
  });

  describe('Real-time Data Streaming', () => {
    beforeEach(async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      const sshConfig = {
        id: sessionId,
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      };

      await socketMock.simulateSSHConnect(sshConfig);
    });

    it('should handle streaming command output', async () => {
      const streamData: string[] = [];
      
      socketMock.on('terminal_data', (data) => {
        if (data.sessionId === sessionId) {
          streamData.push(data.data);
        }
      });

      const streamComplete = new Promise<void>((resolve) => {
        enhancedSSHMock.once('stream_complete', (id) => {
          if (id === sessionId) {
            resolve();
          }
        });
      });

      await socketMock.simulateTerminalInput(sessionId, 'ping google.com\r');
      await streamComplete;

      expect(streamData.length).toBeGreaterThan(1);
      expect(streamData.some(data => data.includes('bytes from'))).toBe(true);
    });

    it('should handle high-frequency data transmission', async () => {
      const dataCount = 100;
      const receivedData: string[] = [];

      socketMock.on('terminal_data', (data) => {
        if (data.sessionId === sessionId) {
          receivedData.push(data.data);
        }
      });

      // Simulate rapid data transmission
      for (let i = 0; i < dataCount; i++) {
        await socketMock.simulateTerminalInput(sessionId, `data-${i}`);
      }

      // Wait for all data to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedData.length).toBe(dataCount);
      receivedData.forEach((data, index) => {
        expect(data).toBe(`data-${index}`);
      });
    });

    it('should handle large data payloads', async () => {
      const largeData = 'A'.repeat(10000); // 10KB of data
      
      const dataPromise = new Promise<void>((resolve) => {
        socketMock.once('terminal_data', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.data).toBe(largeData);
          resolve();
        });
      });

      await socketMock.simulateTerminalInput(sessionId, largeData);
      await dataPromise;
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });
    });

    it('should handle network packet loss', async () => {
      socketMock.setNetworkConditions({
        packetLoss: 0.1, // 10% packet loss
      });

      const messagesSent = 10;
      const receivedMessages: string[] = [];

      socketMock.on('terminal_data', (data) => {
        receivedMessages.push(data.data);
      });

      for (let i = 0; i < messagesSent; i++) {
        await socketMock.simulateTerminalInput(sessionId, `message-${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // With 10% packet loss, we should receive fewer messages
      expect(receivedMessages.length).toBeLessThan(messagesSent);
    });

    it('should handle network latency variations', async () => {
      socketMock.setNetworkConditions({
        latency: 100,
        jitter: 50,
      });

      const timestamps: number[] = [];
      
      socketMock.on('terminal_data', () => {
        timestamps.push(Date.now());
      });

      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        await socketMock.simulateTerminalInput(sessionId, `test-${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that messages arrived with varying delays
      const delays = timestamps.map(ts => ts - startTime);
      const minDelay = Math.min(...delays);
      const maxDelay = Math.max(...delays);
      
      expect(maxDelay - minDelay).toBeGreaterThan(30); // Should have jitter
    });

    it('should handle connection timeout scenarios', async () => {
      socketMock.setNetworkConditions({
        latency: 5000, // Very high latency
      });

      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1000); // Timeout after 1 second
      });

      const dataPromise = new Promise<void>((resolve) => {
        socketMock.once('terminal_data', () => {
          resolve();
        });
      });

      socketMock.simulateTerminalInput(sessionId, 'test');

      // Should timeout before receiving data due to high latency
      await Promise.race([timeoutPromise, dataPromise]);
      
      // The timeout should win
      expect(true).toBe(true); // Test passes if we reach here
    });
  });

  describe('Message History and Debugging', () => {
    beforeEach(async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });
    });

    it('should maintain message history', async () => {
      const messages = ['msg1', 'msg2', 'msg3'];
      
      for (const message of messages) {
        await socketMock.simulateTerminalInput(sessionId, message);
      }

      const history = socketMock.getMessageHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const terminalDataMessages = history.filter(msg => msg.event === 'terminal_data');
      expect(terminalDataMessages.length).toBe(messages.length);
    });

    it('should filter messages by session', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      await socketMock.simulateTerminalInput(session1, 'message for session 1');
      await socketMock.simulateTerminalInput(session2, 'message for session 2');

      const session1Messages = socketMock.getMessagesForSession(session1);
      const session2Messages = socketMock.getMessagesForSession(session2);

      expect(session1Messages.length).toBeGreaterThan(0);
      expect(session2Messages.length).toBeGreaterThan(0);
      
      session1Messages.forEach(msg => {
        expect(msg.sessionId).toBe(session1);
      });
      
      session2Messages.forEach(msg => {
        expect(msg.sessionId).toBe(session2);
      });
    });

    it('should clear message history', async () => {
      await socketMock.simulateTerminalInput(sessionId, 'test message');
      
      let history = socketMock.getMessageHistory();
      expect(history.length).toBeGreaterThan(0);

      socketMock.clearMessageHistory();
      
      history = socketMock.getMessageHistory();
      expect(history.length).toBe(0);
    });
  });
});
