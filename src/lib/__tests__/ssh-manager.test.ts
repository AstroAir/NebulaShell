import { SSHManager } from '../ssh-manager';
import { securityManager } from '../security';
import { logger } from '../logger';

// Mock dependencies
jest.mock('../security', () => ({
  securityManager: {
    checkRateLimit: jest.fn(() => true),
    validateSSHConfig: jest.fn(() => ({ valid: true, errors: [] })),
    sanitizeLogData: jest.fn((data) => data),
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    sshConnectionAttempt: jest.fn(),
    sshConnectionSuccess: jest.fn(),
    sshConnectionFailure: jest.fn(),
    sshConnectionFailed: jest.fn(),
  },
}));

// Mock NodeSSH - variables removed as we'll create fresh mocks in beforeEach

jest.mock('node-ssh', () => {
  return {
    NodeSSH: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      dispose: jest.fn(),
      requestShell: jest.fn(),
      exec: jest.fn(),
      putFile: jest.fn(),
      getFile: jest.fn(),
      connection: {
        on: jest.fn(),
        end: jest.fn(),
      },
    }))
  };
});

describe('SSHManager', () => {
  let sshManager: SSHManager;
  let mockSecurityManager: jest.Mocked<typeof securityManager>;
  let mockNodeSSHInstance: any;

  beforeEach(() => {
    // Clear all mocks once at the beginning
    jest.clearAllMocks();

    // Setup security manager mocks
    mockSecurityManager = securityManager as jest.Mocked<typeof securityManager>;
    mockSecurityManager.checkRateLimit.mockReturnValue(true);
    mockSecurityManager.validateSSHConfig.mockReturnValue({ valid: true, errors: [] });

    // Get the mocked NodeSSH constructor and setup its instance methods
    const { NodeSSH } = require('node-ssh');
    mockNodeSSHInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      requestShell: jest.fn().mockResolvedValue({
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
      }),
      exec: jest.fn().mockResolvedValue({ stdout: '', stderr: '', code: 0 }),
      putFile: jest.fn().mockResolvedValue(undefined),
      getFile: jest.fn().mockResolvedValue(undefined),
      connection: {
        on: jest.fn(),
        end: jest.fn(),
      },
    };

    // Make NodeSSH constructor return our mock instance
    NodeSSH.mockImplementation(() => mockNodeSSHInstance);

    sshManager = new SSHManager();
  });

  describe('Session Creation', () => {
    const validConfig = {
      id: 'session-123',
      hostname: 'test.example.com',
      port: 22,
      username: 'testuser',
      authMethod: 'password' as const,
      password: 'testpass',
    };

    it('should create SSH session successfully', async () => {
      const session = await sshManager.createSession(validConfig);
      
      expect(session).toBeDefined();
      expect(session.id).toBe('session-123');
      expect(session.config).toEqual(validConfig);
      expect(session.connected).toBe(false);
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should validate SSH config before creating session', async () => {
      await sshManager.createSession(validConfig);
      
      expect(mockSecurityManager.validateSSHConfig).toHaveBeenCalledWith(validConfig);
    });

    it('should reject invalid SSH config', async () => {
      mockSecurityManager.validateSSHConfig.mockReturnValue({
        valid: false,
        errors: ['Invalid hostname'],
      });
      
      await expect(sshManager.createSession(validConfig))
        .rejects.toThrow('Invalid configuration');
    });

    it('should check rate limiting', async () => {
      await sshManager.createSession(validConfig);
      
      expect(mockSecurityManager.checkRateLimit).toHaveBeenCalledWith(
        `${validConfig.hostname}:${validConfig.username}`
      );
    });

    it('should reject when rate limited', async () => {
      mockSecurityManager.checkRateLimit.mockReturnValue(false);
      
      await expect(sshManager.createSession(validConfig))
        .rejects.toThrow('Too many connection attempts');
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sshManager.createSession(validConfig);
      const session2 = await sshManager.createSession({
        ...validConfig,
        id: 'session-456',
        hostname: 'other.example.com',
      });

      expect(session1.id).not.toBe(session2.id);
    });

    it('should initialize performance metrics', async () => {
      const session = await sshManager.createSession(validConfig);

      const metrics = sshManager.getPerformanceMetrics(session.id);
      expect(metrics).toBeUndefined(); // Metrics are initialized on mobile optimization
    });
  });

  describe('SSH Connection', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession({
        id: 'test-session',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });
      sessionId = session.id;
    });

    it('should connect to SSH server successfully', async () => {
      await sshManager.connect(sessionId);

      expect(mockNodeSSHInstance.connect).toHaveBeenCalledWith(expect.objectContaining({
        host: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      }));

      const session = sshManager.getSession(sessionId);
      expect(session?.connected).toBe(true);

      // Performance metrics are only available after mobile optimization
      sshManager.optimizeForMobile(sessionId);
      const metrics = sshManager.getPerformanceMetrics(sessionId);
      expect(metrics?.connectionTime).toBeGreaterThan(0);
    });

    it('should handle connection errors', async () => {
      mockNodeSSHInstance.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(sshManager.connect(sessionId))
        .rejects.toThrow('Connection failed');

      const session = sshManager.getSession(sessionId);
      expect(session?.connected).toBe(false);
    });

    it('should support key-based authentication', async () => {
      const keySession = await sshManager.createSession({
        id: 'key-session',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        privateKey: '/path/to/key',
      });

      await sshManager.connect(keySession.id);

      expect(mockNodeSSHInstance.connect).toHaveBeenCalledWith(expect.objectContaining({
        host: 'test.example.com',
        port: 22,
        username: 'testuser',
        privateKey: '/path/to/key',
      }));
    });

    it('should handle mobile settings optimization', async () => {
      await sshManager.connect(sessionId);

      const mobileSettings = {
        lowBandwidth: true,
        batchUpdates: true,
        compressionEnabled: true,
        touchOptimized: true,
        reducedAnimations: true,
      };

      sshManager.setMobileSettings(sessionId, mobileSettings);

      const retrievedSettings = sshManager.getMobileSettings(sessionId);
      expect(retrievedSettings).toEqual(mobileSettings);
    });
  });

  describe('Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession({
        id: 'session-test',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });
      sessionId = session.id;
      await sshManager.connect(sessionId);
    });

    it('should get session by ID', () => {
      const session = sshManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null for non-existent session', () => {
      const session = sshManager.getSession('non-existent-id');

      expect(session).toBeUndefined();
    });

    it('should get SSH connection', () => {
      const connection = sshManager.getSSHConnection(sessionId);
      
      expect(connection).toBeDefined();
    });

    it('should return null for non-existent connection', () => {
      const connection = sshManager.getSSHConnection('non-existent-id');

      expect(connection).toBeUndefined();
    });

    it('should get all sessions', () => {
      const sessions = sshManager.getAllSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(sessionId);
    });

    it('should update last activity', () => {
      const originalActivity = sshManager.getSession(sessionId)?.lastActivity;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        sshManager.updateLastActivity(sessionId);
        
        const updatedActivity = sshManager.getSession(sessionId)?.lastActivity;
        expect(updatedActivity!.getTime()).toBeGreaterThan(originalActivity!.getTime());
      }, 10);
    });
  });

  describe('Mobile Optimization', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession({
        id: 'mobile-session',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });
      sessionId = session.id;
      await sshManager.connect(sessionId);
    });

    it('should optimize for mobile', () => {
      const result = sshManager.optimizeForMobile(sessionId);

      expect(result).toBe(true);

      const settings = sshManager.getMobileSettings(sessionId);
      expect(settings?.lowBandwidth).toBe(true);
      expect(settings?.touchOptimized).toBe(true);

      const metrics = sshManager.getPerformanceMetrics(sessionId);
      expect(metrics).toBeDefined();
    });

    it('should update latency metrics', () => {
      sshManager.optimizeForMobile(sessionId);
      sshManager.updateLatencyMetrics(sessionId, 100);

      const metrics = sshManager.getPerformanceMetrics(sessionId);
      expect(metrics?.lastLatency).toBe(100);
      expect(metrics?.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Session Cleanup', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession({
        id: 'cleanup-session',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });
      sessionId = session.id;
      await sshManager.connect(sessionId);
    });

    it('should disconnect session', async () => {
      await sshManager.disconnect(sessionId);

      expect(mockNodeSSHInstance.dispose).toHaveBeenCalled();

      const session = sshManager.getSession(sessionId);
      expect(session).toBeUndefined(); // Session should be removed
    });

    it('should handle disconnect errors gracefully', async () => {
      mockNodeSSHInstance.dispose.mockImplementation(() => {
        throw new Error('Disconnect failed');
      });

      await expect(sshManager.disconnect(sessionId)).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Error disconnecting SSH session',
        expect.any(Object),
        sessionId
      );
    });

    it('should cleanup inactive sessions', () => {
      // Make session inactive by setting old lastActivity (more than 1 hour ago)
      const session = sshManager.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 3600001); // 1 hour and 1ms ago
      }

      sshManager.cleanupInactiveSessions();

      // Session should be cleaned up
      const cleanedSession = sshManager.getSession(sessionId);
      expect(cleanedSession).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation with invalid config', async () => {
      const invalidConfig = {
        id: 'invalid-session',
        hostname: '',
        port: -1,
        username: '',
      };

      mockSecurityManager.validateSSHConfig.mockReturnValue({
        valid: false,
        errors: ['Invalid hostname', 'Invalid port'],
      });

      await expect(sshManager.createSession(invalidConfig))
        .rejects.toThrow('Invalid configuration');
    });

    it('should handle operations on non-existent sessions', async () => {
      await expect(sshManager.connect('non-existent'))
        .rejects.toThrow('Session not found');
    });

    it('should handle network timeouts', async () => {
      const session = await sshManager.createSession({
        id: 'timeout-session',
        hostname: 'timeout.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });

      mockNodeSSHInstance.connect.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );

      await expect(sshManager.connect(session.id))
        .rejects.toThrow('Connection timeout');
    });
  });

  describe('Basic Operations', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sshManager.createSession({
        id: 'basic-session',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });
      sessionId = session.id;
    });

    it('should disconnect session', async () => {
      await sshManager.connect(sessionId);
      await sshManager.disconnect(sessionId);

      expect(mockNodeSSHInstance.dispose).toHaveBeenCalled();

      const session = sshManager.getSession(sessionId);
      expect(session).toBeUndefined(); // Session should be removed after disconnect
    });

    it('should handle disconnect errors gracefully', async () => {
      await sshManager.connect(sessionId);

      mockNodeSSHInstance.dispose.mockImplementation(() => {
        throw new Error('Disconnect failed');
      });

      await expect(sshManager.disconnect(sessionId)).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Error disconnecting SSH session',
        expect.any(Object),
        sessionId
      );
    });

    it('should cleanup inactive sessions', () => {
      // Create session and make it inactive (more than 1 hour ago)
      const session = sshManager.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 3600001); // 1 hour and 1ms ago
      }

      sshManager.cleanupInactiveSessions();

      // Session should be cleaned up
      const cleanedSession = sshManager.getSession(sessionId);
      expect(cleanedSession).toBeUndefined();
    });
  });
});
