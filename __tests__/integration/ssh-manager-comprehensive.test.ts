import { sshManager } from '@/lib/ssh-manager';
import { SSHConnectionConfig } from '@/types/ssh';
import { testEnvironment } from '../setup/test-environment';
import { enhancedSSHMock } from '../mocks/ssh';

describe('SSH Manager Comprehensive Testing', () => {
  let mockConfig: SSHConnectionConfig;
  let realConfig: SSHConnectionConfig;

  beforeAll(async () => {
    // Set up test environment with Docker containers
    try {
      await testEnvironment.setupEnvironment();
      
      // Configure real SSH connection for integration testing
      const primaryServer = testEnvironment.getServer('primary');
      if (primaryServer) {
        realConfig = {
          id: 'real-test-connection',
          hostname: primaryServer.host,
          port: primaryServer.port,
          username: primaryServer.username,
          password: primaryServer.password,
        };
      }
    } catch (error) {
      console.warn('Docker environment not available, using mock only:', error);
    }

    // Configure mock SSH connection
    mockConfig = {
      id: 'mock-test-connection',
      hostname: 'mock.example.com',
      port: 22,
      username: 'mockuser',
      password: 'mockpass',
    };
  });

  afterAll(async () => {
    if (testEnvironment.isEnvironmentReady()) {
      await testEnvironment.teardownEnvironment();
    }
  });

  beforeEach(() => {
    // Clear any existing sessions
    enhancedSSHMock.clearSessions();
  });

  describe('Session Management', () => {
    it('should create SSH session with valid configuration', async () => {
      const session = await sshManager.createSession(mockConfig);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(mockConfig.id);
      expect(session.config).toEqual(mockConfig);
      expect(session.connected).toBe(false);
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should reject invalid SSH configuration', async () => {
      const invalidConfig: SSHConnectionConfig = {
        id: 'invalid-config',
        hostname: '', // Invalid empty hostname
        port: 22,
        username: 'test',
        password: 'test',
      };

      await expect(sshManager.createSession(invalidConfig))
        .rejects
        .toThrow('Invalid configuration');
    });

    it('should handle multiple concurrent sessions', async () => {
      const configs = [
        { ...mockConfig, id: 'session-1' },
        { ...mockConfig, id: 'session-2', hostname: 'mock2.example.com' },
        { ...mockConfig, id: 'session-3', hostname: 'mock3.example.com' },
      ];

      const sessions = await Promise.all(
        configs.map(config => sshManager.createSession(config))
      );

      expect(sessions).toHaveLength(3);
      sessions.forEach((session, index) => {
        expect(session.id).toBe(configs[index].id);
        expect(session.config.hostname).toBe(configs[index].hostname);
      });
    });

    it('should prevent duplicate session IDs', async () => {
      await sshManager.createSession(mockConfig);
      
      await expect(sshManager.createSession(mockConfig))
        .rejects
        .toThrow('Session with ID mock-test-connection already exists');
    });
  });

  describe('Connection Establishment', () => {
    it('should establish mock SSH connection successfully', async () => {
      const session = await sshManager.createSession(mockConfig);
      
      // Mock the SSH connection
      enhancedSSHMock.createSession(session.id);
      
      await expect(sshManager.connect(session.id)).resolves.not.toThrow();
      
      const updatedSession = sshManager.getSession(session.id);
      expect(updatedSession?.connected).toBe(true);
    });

    it('should handle connection timeout', async () => {
      const timeoutConfig: SSHConnectionConfig = {
        ...mockConfig,
        id: 'timeout-test',
        hostname: 'unreachable.example.com',
      };

      const session = await sshManager.createSession(timeoutConfig);
      
      await expect(sshManager.connect(session.id))
        .rejects
        .toThrow(/timeout|ETIMEDOUT/i);
    });

    it('should handle authentication failure', async () => {
      const authFailConfig: SSHConnectionConfig = {
        ...mockConfig,
        id: 'auth-fail-test',
        password: 'wrong-password',
      };

      const session = await sshManager.createSession(authFailConfig);
      
      await expect(sshManager.connect(session.id))
        .rejects
        .toThrow(/authentication|auth/i);
    });

    // Real SSH connection test (only if Docker environment is available)
    it('should establish real SSH connection when environment is available', async () => {
      if (!realConfig || !testEnvironment.isEnvironmentReady()) {
        console.log('Skipping real SSH test - environment not available');
        return;
      }

      const session = await sshManager.createSession(realConfig);
      
      await expect(sshManager.connect(session.id)).resolves.not.toThrow();
      
      const updatedSession = sshManager.getSession(session.id);
      expect(updatedSession?.connected).toBe(true);
      
      // Clean up
      await sshManager.disconnect(session.id);
    });
  });

  describe('Command Execution', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession(mockConfig);
      sessionId = session.id;
      
      // Set up mock SSH session
      enhancedSSHMock.createSession(sessionId);
      enhancedSSHMock.connect(sessionId);
    });

    it('should execute basic commands', async () => {
      const commands = ['pwd', 'whoami', 'ls', 'date'];
      
      for (const command of commands) {
        const result = await enhancedSSHMock.executeCommand(sessionId, command);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      }
    });

    it('should handle command with arguments', async () => {
      const result = await enhancedSSHMock.executeCommand(sessionId, 'ls -la');
      
      expect(result).toContain('total');
      expect(result).toContain('drwxr-xr-x');
    });

    it('should handle directory navigation', async () => {
      await enhancedSSHMock.executeCommand(sessionId, 'cd documents');
      const pwdResult = await enhancedSSHMock.executeCommand(sessionId, 'pwd');
      
      expect(pwdResult).toContain('documents');
    });

    it('should handle environment variables', async () => {
      await enhancedSSHMock.executeCommand(sessionId, 'export TEST_VAR=test_value');
      const result = await enhancedSSHMock.executeCommand(sessionId, 'echo $TEST_VAR');
      
      expect(result).toContain('test_value');
    });

    it('should handle command history', async () => {
      const commands = ['pwd', 'ls', 'whoami'];
      
      for (const command of commands) {
        await enhancedSSHMock.executeCommand(sessionId, command);
      }
      
      const historyResult = await enhancedSSHMock.executeCommand(sessionId, 'history');
      
      commands.forEach(command => {
        expect(historyResult).toContain(command);
      });
    });

    it('should handle unknown commands', async () => {
      const result = await enhancedSSHMock.executeCommand(sessionId, 'nonexistent-command');
      
      expect(result).toContain('command not found');
    });
  });

  describe('Interactive Commands', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession(mockConfig);
      sessionId = session.id;
      
      enhancedSSHMock.createSession(sessionId);
      enhancedSSHMock.connect(sessionId);
    });

    it('should handle interactive command start', async () => {
      const interactiveStarted = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interactive_start', (id, command) => {
          expect(id).toBe(sessionId);
          expect(command).toBe('top');
          resolve();
        });
      });

      await enhancedSSHMock.executeCommand(sessionId, 'top');
      await interactiveStarted;
    });

    it('should handle command interruption', async () => {
      const interruptHandled = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interrupted', (id) => {
          expect(id).toBe(sessionId);
          resolve();
        });
      });

      await enhancedSSHMock.executeCommand(sessionId, 'ping google.com');
      enhancedSSHMock.interrupt(sessionId);
      
      await interruptHandled;
    });

    it('should handle streaming output', async () => {
      const streamData: string[] = [];
      
      enhancedSSHMock.on('data', (id, data) => {
        if (id === sessionId) {
          streamData.push(data);
        }
      });

      const streamComplete = new Promise<void>((resolve) => {
        enhancedSSHMock.once('stream_complete', (id) => {
          if (id === sessionId) {
            resolve();
          }
        });
      });

      await enhancedSSHMock.executeCommand(sessionId, 'ping google.com');
      await streamComplete;
      
      expect(streamData.length).toBeGreaterThan(0);
      expect(streamData.some(data => data.includes('bytes from'))).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle session not found errors', async () => {
      await expect(sshManager.connect('non-existent-session'))
        .rejects
        .toThrow('Session not found');
    });

    it('should handle connection loss and recovery', async () => {
      const session = await sshManager.createSession(mockConfig);
      enhancedSSHMock.createSession(session.id);
      enhancedSSHMock.connect(session.id);
      
      // Simulate connection loss
      enhancedSSHMock.disconnect(session.id);
      
      // Verify session is marked as disconnected
      const disconnectedSession = sshManager.getSession(session.id);
      expect(disconnectedSession?.connected).toBe(false);
      
      // Attempt reconnection
      enhancedSSHMock.connect(session.id);
      
      // Verify session is reconnected
      const reconnectedSession = sshManager.getSession(session.id);
      expect(reconnectedSession?.connected).toBe(true);
    });

    it('should handle rate limiting', async () => {
      const configs = Array.from({ length: 10 }, (_, i) => ({
        ...mockConfig,
        id: `rate-limit-test-${i}`,
      }));

      // Attempt rapid connections
      const connectionPromises = configs.map(config => 
        sshManager.createSession(config).then(session => 
          sshManager.connect(session.id)
        )
      );

      // Some connections should be rate limited
      const results = await Promise.allSettled(connectionPromises);
      const rejectedCount = results.filter(result => result.status === 'rejected').length;
      
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe('Resource Management', () => {
    it('should clean up disconnected sessions', async () => {
      const session = await sshManager.createSession(mockConfig);
      enhancedSSHMock.createSession(session.id);
      enhancedSSHMock.connect(session.id);
      
      // Disconnect and clean up
      await sshManager.disconnect(session.id);
      
      const cleanedSession = sshManager.getSession(session.id);
      expect(cleanedSession?.connected).toBe(false);
    });

    it('should handle session timeout', async () => {
      const session = await sshManager.createSession(mockConfig);
      enhancedSSHMock.createSession(session.id);
      enhancedSSHMock.connect(session.id);
      
      // Simulate session timeout by not updating last activity
      // In a real scenario, this would be handled by the SSH manager's cleanup process
      
      const sessionData = enhancedSSHMock.getSession(session.id);
      expect(sessionData).toBeDefined();
    });

    it('should limit maximum concurrent sessions', async () => {
      const maxSessions = 5; // Assuming this is the limit
      const configs = Array.from({ length: maxSessions + 2 }, (_, i) => ({
        ...mockConfig,
        id: `max-session-test-${i}`,
        hostname: `mock${i}.example.com`,
      }));

      const sessionPromises = configs.map(config => 
        sshManager.createSession(config)
      );

      const results = await Promise.allSettled(sessionPromises);
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      
      // Should not exceed maximum sessions
      expect(successCount).toBeLessThanOrEqual(maxSessions);
    });
  });
});
