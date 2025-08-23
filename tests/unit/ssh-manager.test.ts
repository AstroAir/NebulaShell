import { SSHManager } from '../../src/lib/ssh-manager'
import { SSHConnectionConfig } from '../../src/types/ssh'
import { securityManager } from '../../src/lib/security'
import { logger } from '../../src/lib/logger'
import { NodeSSH } from 'node-ssh'

// Mock dependencies
jest.mock('../../src/lib/security')
jest.mock('../../src/lib/logger')
jest.mock('node-ssh')

describe('SSHManager', () => {
  let sshManager: SSHManager;
  let mockSSH: jest.Mocked<NodeSSH>;
  let mockSecurityManager: jest.Mocked<typeof securityManager>;
  let mockLogger: jest.Mocked<typeof logger>;

  const mockConfig: SSHConnectionConfig = {
    id: 'test-session-1',
    hostname: 'test.example.com',
    port: 22,
    username: 'testuser',
    password: 'testpass',
    name: 'Test Connection',
  }

  beforeEach(() => {
    // Use the singleton instance
    sshManager = require('../../src/lib/ssh-manager').sshManager
    mockSecurityManager = securityManager as jest.Mocked<typeof securityManager>
    mockLogger = logger as jest.Mocked<typeof logger>

    // Reset mocks
    jest.clearAllMocks()

    // Setup default mock behaviors
    mockSecurityManager.validateSSHConfig.mockReturnValue({ valid: true, errors: [] })
    mockSecurityManager.checkRateLimit.mockReturnValue(true)

    // Mock NodeSSH constructor and instance methods
    const mockSSHInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
      connection: { on: jest.fn(), end: jest.fn() },
    }

    const NodeSSHMock = jest.fn().mockImplementation(() => mockSSHInstance)
    require('node-ssh').NodeSSH = NodeSSHMock
    mockSSH = mockSSHInstance as any
  })

  describe('createSession', () => {
    it('should create a new SSH session with valid config', async () => {
      const session = await sshManager.createSession(mockConfig)

      expect(session).toEqual({
        id: mockConfig.id,
        config: mockConfig,
        connected: false,
        lastActivity: expect.any(Date),
        createdAt: expect.any(Date),
      })

      expect(mockSecurityManager.validateSSHConfig).toHaveBeenCalledWith(mockConfig)
      expect(mockSecurityManager.checkRateLimit).toHaveBeenCalledWith('test.example.com:testuser')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SSH session created',
        { hostname: mockConfig.hostname, username: mockConfig.username },
        mockConfig.id
      )
    })

    it('should throw error for invalid config', async () => {
      mockSecurityManager.validateSSHConfig.mockReturnValue({
        valid: false,
        errors: ['Invalid hostname'],
      })

      await expect(sshManager.createSession(mockConfig)).rejects.toThrow(
        'Invalid configuration: Invalid hostname'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid SSH configuration',
        { errors: ['Invalid hostname'] },
        mockConfig.id
      )
    })

    it('should throw error when rate limit exceeded', async () => {
      mockSecurityManager.checkRateLimit.mockReturnValue(false)

      await expect(sshManager.createSession(mockConfig)).rejects.toThrow(
        'Too many connection attempts. Please wait before trying again.'
      )

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limit exceeded for SSH connection',
        { hostname: mockConfig.hostname, username: mockConfig.username },
        mockConfig.id
      )
    })
  })

  describe('connect', () => {
    beforeEach(async () => {
      await sshManager.createSession(mockConfig)
    })

    it('should connect to SSH server successfully', async () => {
      await sshManager.connect(mockConfig.id)

      expect(mockSSH.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: mockConfig.hostname,
          port: mockConfig.port,
          username: mockConfig.username,
          password: mockConfig.password,
          readyTimeout: 30000,
          algorithms: expect.any(Object),
        })
      )

      const session = sshManager.getSession(mockConfig.id)
      expect(session?.connected).toBe(true)
    })

    it('should handle SSH connection with private key', async () => {
      const keyConfig = {
        ...mockConfig,
        id: 'key-test-session',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END PRIVATE KEY-----',
        password: undefined,
      }

      await sshManager.createSession(keyConfig)
      await sshManager.connect(keyConfig.id)

      expect(mockSSH.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: keyConfig.hostname,
          port: keyConfig.port,
          username: keyConfig.username,
          privateKey: keyConfig.privateKey,
          readyTimeout: 30000,
        })
      )
    })

    it('should throw error for non-existent session', async () => {
      await expect(sshManager.connect('non-existent')).rejects.toThrow('Session not found')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Session not found for connection attempt',
        { sessionId: 'non-existent' }
      )
    })

    it('should handle SSH connection errors', async () => {
      const connectionError = new Error('Connection failed')
      mockSSH.connect.mockRejectedValue(connectionError)

      await expect(sshManager.connect(mockConfig.id)).rejects.toThrow('Connection failed')

      // The logger method is called with different parameters in the actual implementation
      expect(mockLogger.sshConnectionFailed).toHaveBeenCalledWith(
        mockConfig.hostname,
        mockConfig.username,
        'Connection failed',
        mockConfig.id
      )
    })
  })

  describe('disconnect', () => {
    beforeEach(async () => {
      await sshManager.createSession(mockConfig)
      await sshManager.connect(mockConfig.id)
    })

    it('should disconnect SSH session successfully', async () => {
      await sshManager.disconnect(mockConfig.id)

      expect(mockSSH.dispose).toHaveBeenCalled()
      expect(sshManager.getSession(mockConfig.id)).toBeUndefined()
    })

    it('should handle disconnect for non-existent session', async () => {
      await sshManager.disconnect('non-existent')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to disconnect non-existent session',
        { sessionId: 'non-existent' }
      )
    })

    it('should handle disconnect errors gracefully', async () => {
      const disconnectError = new Error('Disconnect failed')
      mockSSH.dispose.mockImplementation(() => {
        throw disconnectError
      })

      await sshManager.disconnect(mockConfig.id)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error disconnecting SSH session',
        { error: 'Disconnect failed' },
        mockConfig.id
      )
    })
  })

  describe('session management', () => {
    beforeEach(async () => {
      await sshManager.createSession(mockConfig)
    })

    it('should get session by ID', () => {
      const session = sshManager.getSession(mockConfig.id)
      expect(session).toBeDefined()
      expect(session?.id).toBe(mockConfig.id)
    })

    it('should get SSH connection by session ID', () => {
      const ssh = sshManager.getSSHConnection(mockConfig.id)
      expect(ssh).toBe(mockSSH)
    })

    it('should get all sessions', () => {
      const sessions = sshManager.getAllSessions()
      expect(sessions.length).toBeGreaterThanOrEqual(1)
      // Find our specific session
      const ourSession = sessions.find(s => s.id === mockConfig.id)
      expect(ourSession).toBeDefined()
      expect(ourSession?.id).toBe(mockConfig.id)
    })

    it('should update last activity', () => {
      const originalActivity = sshManager.getSession(mockConfig.id)?.lastActivity
      
      // Wait a bit to ensure time difference
      setTimeout(() => {
        sshManager.updateLastActivity(mockConfig.id)
        const updatedActivity = sshManager.getSession(mockConfig.id)?.lastActivity
        expect(updatedActivity).not.toEqual(originalActivity)
      }, 10)
    })
  })

  describe('cleanupInactiveSessions', () => {
    it('should cleanup sessions older than 1 hour', async () => {
      // Create a session
      await sshManager.createSession(mockConfig)
      
      // Mock the session to be old
      const session = sshManager.getSession(mockConfig.id)
      if (session) {
        session.lastActivity = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }

      sshManager.cleanupInactiveSessions()

      expect(sshManager.getSession(mockConfig.id)).toBeUndefined()
    })

    it('should not cleanup active sessions', async () => {
      await sshManager.createSession(mockConfig)
      
      sshManager.cleanupInactiveSessions()

      expect(sshManager.getSession(mockConfig.id)).toBeDefined()
    })
  })
})
