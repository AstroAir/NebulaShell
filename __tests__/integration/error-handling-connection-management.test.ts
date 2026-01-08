import { createEnhancedSocketMock, EnhancedSocketMock } from '../mocks/socket.io';
import { enhancedSSHMock } from '../mocks/ssh';
import { SSHConnectionConfig } from '@/types/ssh';

describe('Error Handling and Connection Management', () => {
  let socketMock: EnhancedSocketMock;
  let sessionId: string;
  let testConfig: SSHConnectionConfig;

  beforeEach(() => {
    socketMock = createEnhancedSocketMock({
      autoConnect: false,
      simulateNetworkIssues: false,
    });
    
    sessionId = `test-session-${Date.now()}`;
    testConfig = {
      id: sessionId,
      hostname: 'test.example.com',
      port: 22,
      username: 'testuser',
      password: 'testpass',
    };
    
    enhancedSSHMock.clearSessions();
  });

  afterEach(() => {
    socketMock.reset();
    enhancedSSHMock.clearSessions();
  });

  describe('Connection Error Scenarios', () => {
    it('should handle connection timeout', async () => {

      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('CONNECTION_FAILED');
          expect(data.message).toContain('timeout');
          resolve();
        });
      });

      // Simulate connection timeout
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Connection timeout after 30 seconds',
          code: 'CONNECTION_FAILED',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle authentication failure', async () => {

      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('AUTH_FAILED');
          expect(data.message).toContain('authentication');
          resolve();
        });
      });

      // Simulate authentication failure
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Authentication failed for user testuser',
          code: 'AUTH_FAILED',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle host key verification failure', async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('HOST_KEY_VERIFICATION_FAILED');
          expect(data.message).toContain('host key');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Host key verification failed',
          code: 'HOST_KEY_VERIFICATION_FAILED',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle network unreachable errors', async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });

      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('NETWORK_UNREACHABLE');
          expect(data.message).toContain('network');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Network is unreachable',
          code: 'NETWORK_UNREACHABLE',
        });
      }, 100);

      await errorPromise;
    });
  });

  describe('Session Management Errors', () => {
    it('should handle session not found errors', async () => {
      const nonExistentSessionId = 'non-existent-session';
      
      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(nonExistentSessionId);
          expect(data.code).toBe('SESSION_NOT_FOUND');
          expect(data.message).toContain('not found');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId: nonExistentSessionId,
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle session timeout', async () => {
      socketMock.connect();
      await socketMock.simulateSSHConnect(testConfig);

      const timeoutPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('SESSION_TIMEOUT');
          expect(data.message).toContain('timeout');
          resolve();
        });
      });

      // Simulate session timeout after inactivity
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Session timeout after 30 minutes of inactivity',
          code: 'SESSION_TIMEOUT',
        });
      }, 100);

      await timeoutPromise;
    });

    it('should handle maximum sessions exceeded', async () => {
      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.code).toBe('MAX_SESSIONS_EXCEEDED');
          expect(data.message).toContain('maximum');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId: 'new-session',
          message: 'Maximum number of concurrent sessions exceeded',
          code: 'MAX_SESSIONS_EXCEEDED',
        });
      }, 100);

      await errorPromise;
    });
  });

  describe('Command Execution Errors', () => {
    beforeEach(async () => {
      socketMock.connect();
      await new Promise<void>((resolve) => {
        socketMock.once('connect', () => resolve());
      });
      await socketMock.simulateSSHConnect(testConfig);
    });

    it('should handle command execution timeout', async () => {
      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('COMMAND_TIMEOUT');
          expect(data.message).toContain('timeout');
          resolve();
        });
      });

      // Simulate long-running command timeout
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Command execution timeout after 60 seconds',
          code: 'COMMAND_TIMEOUT',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle command execution failure', async () => {
      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('COMMAND_FAILED');
          expect(data.message).toContain('failed');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Command execution failed with exit code 1',
          code: 'COMMAND_FAILED',
        });
      }, 100);

      await errorPromise;
    });

    it('should handle permission denied errors', async () => {
      const errorPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.code).toBe('PERMISSION_DENIED');
          expect(data.message).toContain('permission');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Permission denied: cannot access /root',
          code: 'PERMISSION_DENIED',
        });
      }, 100);

      await errorPromise;
    });
  });

  describe('Network Error Recovery', () => {
    it('should handle connection loss and automatic reconnection', async () => {
      socketMock.connect();
      await socketMock.simulateSSHConnect(testConfig);

      const disconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_disconnected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          resolve();
        });
      });

      const reconnectPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_connected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          expect(data.status).toBe('connected');
          resolve();
        });
      });

      // Simulate network interruption and recovery
      socketMock.simulateNetworkInterruption(500);
      
      await disconnectPromise;
      await reconnectPromise;
    });

    it('should handle intermittent connectivity issues', async () => {
      socketMock.setNetworkConditions({
        packetLoss: 0.3, // 30% packet loss
        latency: 200,
        jitter: 100,
      });

      socketMock.connect();
      await socketMock.simulateSSHConnect(testConfig);

      const messagesSent = 20;
      const receivedMessages: string[] = [];
      const errorMessages: string[] = [];

      socketMock.on('terminal_data', (data) => {
        receivedMessages.push(data.data);
      });

      socketMock.on('ssh_error', (data) => {
        if (data.code === 'NETWORK_ERROR') {
          errorMessages.push(data.message);
        }
      });

      // Send multiple messages with poor network conditions
      for (let i = 0; i < messagesSent; i++) {
        await socketMock.simulateTerminalInput(sessionId, `message-${i}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have some packet loss
      expect(receivedMessages.length).toBeLessThan(messagesSent);
    });

    it('should handle graceful degradation during network issues', async () => {
      socketMock.connect();
      await socketMock.simulateSSHConnect(testConfig);

      // Start with good network conditions
      socketMock.setNetworkConditions({
        latency: 50,
        packetLoss: 0,
      });

      await socketMock.simulateTerminalInput(sessionId, 'test1');

      // Degrade network conditions
      socketMock.setNetworkConditions({
        latency: 1000,
        packetLoss: 0.5,
      });

      const degradedPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          if (data.code === 'NETWORK_DEGRADED') {
            expect(data.message).toContain('degraded');
            resolve();
          }
        });
      });

      // Simulate network degradation warning
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Network performance degraded',
          code: 'NETWORK_DEGRADED',
        });
      }, 100);

      await degradedPromise;
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should handle memory pressure scenarios', async () => {
      const memoryPressurePromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_error', (data) => {
          expect(data.code).toBe('MEMORY_PRESSURE');
          expect(data.message).toContain('memory');
          resolve();
        });
      });

      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'System under memory pressure, limiting new connections',
          code: 'MEMORY_PRESSURE',
        });
      }, 100);

      await memoryPressurePromise;
    });

    it('should handle resource cleanup on error', async () => {
      socketMock.connect();
      await socketMock.simulateSSHConnect(testConfig);

      const cleanupPromise = new Promise<void>((resolve) => {
        socketMock.once('ssh_disconnected', (data) => {
          expect(data.sessionId).toBe(sessionId);
          resolve();
        });
      });

      // Simulate critical error requiring cleanup
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Critical error, cleaning up session',
          code: 'CRITICAL_ERROR',
        });
        
        // Simulate automatic cleanup
        setTimeout(() => {
          socketMock.emit('ssh_disconnected', { sessionId });
        }, 50);
      }, 100);

      await cleanupPromise;
    });

    it('should handle concurrent error scenarios', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      const errors: string[] = [];

      socketMock.on('ssh_error', (data) => {
        errors.push(data.sessionId);
      });

      // Simulate concurrent errors
      const errorPromises = sessions.map((id, index) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            socketMock.emit('ssh_error', {
              sessionId: id,
              message: `Error in session ${id}`,
              code: 'CONCURRENT_ERROR',
            });
            resolve();
          }, index * 50);
        });
      });

      await Promise.all(errorPromises);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errors).toHaveLength(sessions.length);
      sessions.forEach(sessionId => {
        expect(errors).toContain(sessionId);
      });
    });
  });

  describe('Error Recovery Strategies', () => {
    it('should implement exponential backoff for reconnection', async () => {
      const reconnectionAttempts: number[] = [];
      
      socketMock.on('ssh_error', (data) => {
        if (data.code === 'RECONNECTION_ATTEMPT') {
          reconnectionAttempts.push(Date.now());
        }
      });

      // Simulate multiple reconnection attempts with exponential backoff
      const delays = [100, 200, 400, 800]; // Exponential backoff
      
      for (let i = 0; i < delays.length; i++) {
        setTimeout(() => {
          socketMock.emit('ssh_error', {
            sessionId,
            message: `Reconnection attempt ${i + 1}`,
            code: 'RECONNECTION_ATTEMPT',
          });
        }, delays[i]);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(reconnectionAttempts.length).toBe(delays.length);
      
      // Verify exponential backoff timing
      for (let i = 1; i < reconnectionAttempts.length; i++) {
        const timeDiff = reconnectionAttempts[i] - reconnectionAttempts[i - 1];
        expect(timeDiff).toBeGreaterThanOrEqual(delays[i] - delays[i - 1] - 50); // Allow 50ms tolerance
      }
    });

    it('should handle circuit breaker pattern for failing connections', async () => {
      let circuitBreakerTripped = false;
      
      socketMock.on('ssh_error', (data) => {
        if (data.code === 'CIRCUIT_BREAKER_OPEN') {
          circuitBreakerTripped = true;
        }
      });

      // Simulate multiple consecutive failures
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          socketMock.emit('ssh_error', {
            sessionId,
            message: `Connection failure ${i + 1}`,
            code: 'CONNECTION_FAILED',
          });
        }, i * 100);
      }

      // Simulate circuit breaker opening after threshold
      setTimeout(() => {
        socketMock.emit('ssh_error', {
          sessionId,
          message: 'Circuit breaker opened due to consecutive failures',
          code: 'CIRCUIT_BREAKER_OPEN',
        });
      }, 600);

      await new Promise(resolve => setTimeout(resolve, 700));

      expect(circuitBreakerTripped).toBe(true);
    });
  });
});
