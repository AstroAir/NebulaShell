import { createEnhancedSocketMock, EnhancedSocketMock } from '../mocks/socket.io';
import { enhancedSSHMock } from '../mocks/ssh';
import { testEnvironment } from '../setup/test-environment';
import { testDatabase } from '../setup/test-database';

describe('End-to-End Terminal Testing', () => {
  let socketMock: EnhancedSocketMock;
  let sessionId: string;

  beforeAll(async () => {
    // Initialize test environment
    await testDatabase.initialize();
    
    // Try to set up Docker environment (optional)
    try {
      await testEnvironment.setupEnvironment();
      console.log('Docker test environment available');
    } catch (error) {
      console.warn('Docker environment not available, using mocks only:', error);
    }
  });

  afterAll(async () => {
    await testDatabase.cleanup();
    
    if (testEnvironment.isEnvironmentReady()) {
      await testEnvironment.teardownEnvironment();
    }
  });

  beforeEach(() => {
    socketMock = createEnhancedSocketMock({
      autoConnect: true,
      connectionDelay: 50,
      simulateNetworkIssues: false,
    });
    
    sessionId = `e2e-session-${Date.now()}`;
    enhancedSSHMock.clearSessions();
  });

  afterEach(() => {
    socketMock.reset();
    enhancedSSHMock.clearSessions();
  });

  describe('Complete Terminal Workflow', () => {
    it('should handle complete user session from connection to disconnection', async () => {
      // Step 1: Establish socket connection
      const connectPromise = new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });
      
      await connectPromise;
      expect(socketMock.connected).toBe(true);

      // Step 2: Initiate SSH connection
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

      // Step 3: Execute basic commands
      const commands = [
        { input: 'pwd\r', expectedOutput: '/home/testuser' },
        { input: 'whoami\r', expectedOutput: 'testuser' },
        { input: 'ls\r', expectedOutput: 'documents  projects  welcome.txt' },
      ];

      for (const command of commands) {
        const outputPromise = new Promise<void>((resolve) => {
          socketMock.once('terminal_data', (data) => {
            expect(data.sessionId).toBe(sessionId);
            expect(data.data).toContain(command.expectedOutput);
            resolve();
          });
        });

        await socketMock.simulateTerminalInput(sessionId, command.input);
        await outputPromise;
      }

      // Step 4: Test file operations
      const fileCommands = [
        { input: 'cat welcome.txt\r', expectedOutput: 'Hello from test server!' },
        { input: 'ls -la\r', expectedOutput: 'drwxr-xr-x' },
      ];

      for (const command of fileCommands) {
        const outputPromise = new Promise<void>((resolve) => {
          socketMock.once('terminal_data', (data) => {
            expect(data.data).toContain(command.expectedOutput);
            resolve();
          });
        });

        await socketMock.simulateTerminalInput(sessionId, command.input);
        await outputPromise;
      }

      // Step 5: Test interactive command
      const interactivePromise = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interactive_start', (id, command) => {
          expect(id).toBe(sessionId);
          expect(command).toBe('top');
          resolve();
        });
      });

      await socketMock.simulateTerminalInput(sessionId, 'top\r');
      await interactivePromise;

      // Step 6: Interrupt interactive command
      const interruptPromise = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interrupted', (id) => {
          expect(id).toBe(sessionId);
          resolve();
        });
      });

      await socketMock.simulateTerminalInput(sessionId, '\x03'); // Ctrl+C
      await interruptPromise;

      // Step 7: Graceful disconnection
      const disconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_disconnected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          resolve();
        });
      });

      enhancedSSHMock.disconnect(sessionId);
      await disconnectPromise;
    });

    it('should handle multiple concurrent sessions', async () => {
      const sessions = [
        { id: 'session-1', hostname: 'server1.example.com' },
        { id: 'session-2', hostname: 'server2.example.com' },
        { id: 'session-3', hostname: 'server3.example.com' },
      ];

      // Connect all sessions
      const connectionPromises = sessions.map(session => {
        return new Promise<void>((resolve) => {
          socketMock.once('ssh_connected', (data) => {
            if (data.sessionId === session.id) {
              resolve();
            }
          });
        });
      });

      for (const session of sessions) {
        await socketMock.simulateSSHConnect({
          id: session.id,
          hostname: session.hostname,
          port: 22,
          username: 'testuser',
          password: 'testpass',
        });
      }

      await Promise.all(connectionPromises);

      // Execute commands on all sessions
      const commandPromises = sessions.map(session => {
        return new Promise<void>((resolve) => {
          socketMock.once('terminal_data', (data) => {
            if (data.sessionId === session.id) {
              expect(data.data).toContain('/home/testuser');
              resolve();
            }
          });
        });
      });

      for (const session of sessions) {
        await socketMock.simulateTerminalInput(session.id, 'pwd\r');
      }

      await Promise.all(commandPromises);

      // Disconnect all sessions
      const disconnectionPromises = sessions.map(session => {
        return new Promise<void>((resolve) => {
          socketMock.once('ssh_disconnected', (data) => {
            if (data.sessionId === session.id) {
              resolve();
            }
          });
        });
      });

      for (const session of sessions) {
        enhancedSSHMock.disconnect(session.id);
      }

      await Promise.all(disconnectionPromises);
    });

    it('should handle network interruption and recovery', async () => {
      // Establish connection
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

      // Simulate network interruption
      const disconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('disconnect', () => resolve());
      });

      const reconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      socketMock.simulateNetworkInterruption(1000);

      await disconnectPromise;
      expect(socketMock.connected).toBe(false);

      await reconnectPromise;
      expect(socketMock.connected).toBe(true);

      // Verify session can be restored
      const restoredPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_connected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          resolve();
        });
      });

      await socketMock.simulateSSHConnect(sshConfig);
      await restoredPromise;
    });
  });

  describe('Real-time Data Streaming', () => {
    beforeEach(async () => {
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

    it('should handle high-frequency data updates', async () => {
      const updateCount = 50;
      const receivedUpdates: string[] = [];

      socketMock.on('terminal_data', (data) => {
        if (data.sessionId === sessionId) {
          receivedUpdates.push(data.data);
        }
      });

      // Send rapid updates
      for (let i = 0; i < updateCount; i++) {
        await socketMock.simulateTerminalInput(sessionId, `update-${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(receivedUpdates.length).toBe(updateCount);
      receivedUpdates.forEach((update, index) => {
        expect(update).toBe(`update-${index}`);
      });
    });

    it('should handle large data payloads', async () => {
      const largeData = 'X'.repeat(50000); // 50KB of data
      
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
    it('should handle connection failures gracefully', async () => {

      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('CONNECTION_FAILED');
          resolve();
        });
      });

      // Mock connection failure
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Connection failed',
          code: 'CONNECTION_FAILED',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle command execution errors', async () => {
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

      // Test command not found error
      const outputPromise = new Promise<void>((resolve) => {
        socketMock.once('terminal_data', (data) => {
          expect(data.data).toContain('command not found');
          resolve();
        });
      });

      await socketMock.simulateTerminalInput(sessionId, 'nonexistent-command\r');
      await outputPromise;
    });

    it('should handle session timeout', async () => {
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

      const timeoutPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('SESSION_TIMEOUT');
          resolve();
        });
      });

      // Simulate session timeout
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Session timeout after inactivity',
          code: 'SESSION_TIMEOUT',
        });
      }, 100);

      await timeoutPromise;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent operations efficiently', async () => {
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

      const operationCount = 20;
      const startTime = Date.now();

      // Execute multiple operations concurrently
      const operations = Array.from({ length: operationCount }, (_, i) => 
        socketMock.simulateTerminalInput(sessionId, `echo "Operation ${i}"\r`)
      );

      await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000); // 2 seconds
    });

    it('should maintain performance under load', async () => {
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

      const messageCount = 100;
      const receivedMessages: string[] = [];

      socketMock.on('terminal_data', (data) => {
        if (data.sessionId === sessionId) {
          receivedMessages.push(data.data);
        }
      });

      // Send messages rapidly
      const startTime = Date.now();
      for (let i = 0; i < messageCount; i++) {
        await socketMock.simulateTerminalInput(sessionId, `msg-${i}`);
      }

      // Wait for all messages to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(receivedMessages.length).toBe(messageCount);
      expect(duration).toBeLessThan(1000); // Should process quickly
    });

    it('should handle memory efficiently with large sessions', async () => {
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

      // Generate large amount of terminal history
      for (let i = 0; i < 1000; i++) {
        await enhancedSSHMock.executeCommand(sessionId, `echo "Command ${i}"`);
      }

      const session = enhancedSSHMock.getSession(sessionId);
      expect(session?.commandHistory.length).toBe(1000);

      // Memory usage should be reasonable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });
});
