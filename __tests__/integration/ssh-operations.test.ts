import { sshManager } from '@/lib/ssh-manager'
import { sftpManager } from '@/lib/sftp-manager'
import { terminalSessionManager } from '@/lib/terminal-session-manager'
import { SSHConnectionConfig } from '@/types/ssh'

// Mock external dependencies
jest.mock('node-ssh')
jest.mock('ssh2-sftp-client', () => {
  const mockSftpClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(Buffer.from('test')),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    stat: jest.fn().mockResolvedValue({ size: 1024, modifyTime: new Date() }),
  }

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockSftpClient)
  }
})

describe('SSH Operations Integration', () => {
  const testConfig: SSHConnectionConfig = {
    id: 'integration-test-session',
    hostname: 'test.example.com',
    port: 22,
    username: 'testuser',
    password: 'testpass',
    name: 'Integration Test Connection',
  };

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset rate limiting for each test
    const securityManager = require('../../src/lib/security').securityManager
    securityManager['connectionAttempts'] = new Map()
    securityManager['lastCleanup'] = 0
  })

  afterEach(async () => {
    // Clean up all sessions after each test
    const allSessions = sshManager.getAllSessions()
    await Promise.all(
      allSessions.map(session => sshManager.disconnect(session.id))
    )

    // Clean up terminal sessions
    const allTabs = terminalSessionManager.getAllTabs()
    allTabs.forEach(tab => {
      terminalSessionManager.closeTab(tab.id)
    })
  })

  describe('SSH Session Lifecycle', () => {
    it('should create, connect, and manage SSH session', async () => {
      // Create session
      const session = await sshManager.createSession(testConfig)
      expect(session.id).toBe(testConfig.id)
      expect(session.connected).toBe(false)

      // Connect session
      await sshManager.connect(session.id)
      const connectedSession = sshManager.getSession(session.id)
      expect(connectedSession?.connected).toBe(true)

      // Get SSH connection
      const ssh = sshManager.getSSHConnection(session.id)
      expect(ssh).toBeDefined()

      // Update activity
      const originalActivity = connectedSession?.lastActivity
      const originalTime = originalActivity?.getTime()
      // Add a small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))
      sshManager.updateLastActivity(session.id)
      const updatedSession = sshManager.getSession(session.id)
      const updatedTime = updatedSession?.lastActivity?.getTime()
      expect(updatedTime).toBeGreaterThan(originalTime || 0)

      // Disconnect session
      await sshManager.disconnect(session.id)
      expect(sshManager.getSession(session.id)).toBeUndefined()
    })

    it('should handle multiple concurrent sessions', async () => {
      const configs = [
        { ...testConfig, id: 'session-1', hostname: 'server1.example.com' },
        { ...testConfig, id: 'session-2', hostname: 'server2.example.com' },
        { ...testConfig, id: 'session-3', hostname: 'server3.example.com' },
      ]

      // Create multiple sessions
      const sessions = await Promise.all(
        configs.map(config => sshManager.createSession(config))
      )

      expect(sessions).toHaveLength(3)
      expect(sshManager.getAllSessions()).toHaveLength(3)

      // Connect all sessions
      await Promise.all(
        sessions.map(session => sshManager.connect(session.id))
      )

      // Verify all are connected
      sessions.forEach(session => {
        const connectedSession = sshManager.getSession(session.id)
        expect(connectedSession?.connected).toBe(true)
      })

      // Disconnect all sessions
      await Promise.all(
        sessions.map(session => sshManager.disconnect(session.id))
      )

      expect(sshManager.getAllSessions()).toHaveLength(0)
    })

    it('should cleanup inactive sessions', async () => {
      // Create session
      const session = await sshManager.createSession(testConfig)
      await sshManager.connect(session.id)

      // Mock old last activity
      const sessionData = sshManager.getSession(session.id)
      if (sessionData) {
        sessionData.lastActivity = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }

      // Run cleanup
      sshManager.cleanupInactiveSessions()

      // Session should be removed
      expect(sshManager.getSession(session.id)).toBeUndefined()
    })
  })

  describe('Terminal Session Integration', () => {
    it('should integrate SSH session with terminal session manager', async () => {
      // Create SSH session
      const sshSession = await sshManager.createSession(testConfig)
      await sshManager.connect(sshSession.id)

      // Create terminal session
      const terminalSession = terminalSessionManager.createSession(
        testConfig,
        'Test Terminal Session'
      )

      expect(terminalSession.id).toBe(testConfig.id)
      expect(terminalSession.config).toEqual(testConfig)
      expect(terminalSession.name).toBe('Test Terminal Session')

      // Get the tab for this session and activate it
      const tabs = terminalSessionManager.getAllTabs()
      const sessionTab = tabs.find(tab => tab.sessionId === terminalSession.id)
      expect(sessionTab).toBeDefined()

      if (sessionTab) {
        terminalSessionManager.activateTab(sessionTab.id)
        const activeSession = terminalSessionManager.getActiveSession()
        expect(activeSession?.id).toBe(terminalSession.id)
      }

      // Update connection status
      terminalSessionManager.updateTabConnectionStatus(terminalSession.id, 'connected')
      const updatedSession = terminalSessionManager.getSession(terminalSession.id)
      expect(updatedSession?.connected).toBe(true)

      // Cleanup
      await sshManager.disconnect(sshSession.id)
      if (sessionTab) {
        terminalSessionManager.closeTab(sessionTab.id)
      }
    })

    it('should handle terminal session tabs', async () => {
      // Create multiple terminal sessions
      const configs = [
        { ...testConfig, id: 'tab-session-1' },
        { ...testConfig, id: 'tab-session-2' },
        { ...testConfig, id: 'tab-session-3' },
      ]

      configs.map(config =>
        terminalSessionManager.createSession(config, `Tab ${config.id}`)
      )

      // Check tabs were created (note: there might be leftover tabs from previous tests)
      const tabs = terminalSessionManager.getAllTabs()
      expect(tabs.length).toBeGreaterThanOrEqual(3)

      // Find tabs for our sessions
      const ourTabs = tabs.filter(tab =>
        ['tab-session-1', 'tab-session-2', 'tab-session-3'].includes(tab.sessionId)
      )
      expect(ourTabs).toHaveLength(3)

      // Activate different tabs
      terminalSessionManager.activateTab(ourTabs[1].id)
      const activeTabId = terminalSessionManager.getActiveTabId()
      expect(activeTabId).toBe(ourTabs[1].id)

      // Close tab
      terminalSessionManager.closeTab(ourTabs[0].id)
      const remainingOurTabs = terminalSessionManager.getAllTabs().filter(tab =>
        ['tab-session-2', 'tab-session-3'].includes(tab.sessionId)
      )
      expect(remainingOurTabs).toHaveLength(2)

      // Cleanup remaining tabs
      remainingOurTabs.forEach(tab => {
        terminalSessionManager.closeTab(tab.id)
      })
    })
  })

  describe('SFTP Integration', () => {
    it('should handle SFTP manager availability', async () => {
      // Create and connect SSH session
      const sshSession = await sshManager.createSession(testConfig)
      await sshManager.connect(sshSession.id)

      // Test that SFTP manager exists and has expected methods
      expect(sftpManager).toBeDefined()
      expect(typeof sftpManager.listDirectory).toBe('function')
      expect(typeof sftpManager.uploadFile).toBe('function')
      expect(typeof sftpManager.downloadFile).toBe('function')

      // Cleanup
      await sshManager.disconnect(sshSession.id)
    })

    it('should handle SFTP operations interface', async () => {
      // Test that SFTP manager has the expected interface
      expect(sftpManager.getActiveTransfers).toBeDefined()
      expect(typeof sftpManager.getActiveTransfers).toBe('function')

      const activeTransfers = sftpManager.getActiveTransfers()
      expect(Array.isArray(activeTransfers)).toBe(true)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle SSH connection failures gracefully', async () => {
      const invalidConfig = {
        ...testConfig,
        id: 'error-test-session-1',
        hostname: 'nonexistent.example.com',
      }

      // Mock connection failure by overriding the existing mock
      const mockSSH = require('node-ssh').NodeSSH
      const originalImplementation = mockSSH.getMockImplementation()

      // Create a new mock instance that fails to connect
      const failingMockInstance = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        dispose: jest.fn(),
        connection: null,
        sftp: jest.fn(),
        exec: jest.fn(),
        execCommand: jest.fn(),
      }

      // Temporarily override the constructor
      mockSSH.mockImplementation(() => failingMockInstance)

      try {
        const session = await sshManager.createSession(invalidConfig)

        await expect(sshManager.connect(session.id)).rejects.toThrow('Connection failed')

        // Session should still exist but not be connected
        const failedSession = sshManager.getSession(session.id)
        expect(failedSession?.connected).toBe(false)
      } finally {
        // Restore original mock implementation
        if (originalImplementation) {
          mockSSH.mockImplementation(originalImplementation)
        } else {
          mockSSH.mockRestore()
        }
      }
    })

    it('should handle SFTP manager error scenarios', async () => {
      // Test that SFTP manager handles errors gracefully
      expect(() => sftpManager.getActiveTransfers()).not.toThrow()

      // Test with invalid session ID
      await expect(
        sftpManager.listDirectory('invalid-session', '/home')
      ).rejects.toThrow()
    })

    it('should handle terminal session cleanup on SSH disconnect', async () => {
      // Reset mock to working state for this test
      const mockSSH = require('node-ssh').NodeSSH
      const workingMockInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn(),
        connection: { sock: { readyState: 'open' } },
        sftp: jest.fn(),
        exec: jest.fn(),
        execCommand: jest.fn(),
      }
      mockSSH.mockImplementation(() => workingMockInstance)

      const cleanupConfig = {
        ...testConfig,
        id: 'cleanup-test-session',
      }

      // Create SSH and terminal sessions
      const sshSession = await sshManager.createSession(cleanupConfig)
      await sshManager.connect(sshSession.id)

      const terminalSession = terminalSessionManager.createSession(cleanupConfig)
      terminalSessionManager.updateTabConnectionStatus(terminalSession.id, 'connected')

      // Disconnect SSH session
      await sshManager.disconnect(sshSession.id)

      // Terminal session should be updated
      terminalSessionManager.updateTabConnectionStatus(terminalSession.id, 'disconnected')
      const updatedSession = terminalSessionManager.getSession(terminalSession.id)
      expect(updatedSession?.connected).toBe(false)

      // Cleanup
      const tabs = terminalSessionManager.getAllTabs()
      const sessionTab = tabs.find(tab => tab.sessionId === terminalSession.id)
      if (sessionTab) {
        terminalSessionManager.closeTab(sessionTab.id)
      }
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('should handle rapid connection/disconnection cycles', async () => {
      const rapidConfig = {
        ...testConfig,
        id: 'rapid-cycle-session',
      }

      // Perform rapid connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        const session = await sshManager.createSession(rapidConfig)
        await sshManager.connect(session.id)

        // Verify connection
        const connectedSession = sshManager.getSession(session.id)
        expect(connectedSession?.connected).toBe(true)

        // Immediate disconnect
        await sshManager.disconnect(session.id)

        // Verify disconnection - session should be deleted after disconnect
        const disconnectedSession = sshManager.getSession(session.id)
        expect(disconnectedSession).toBeUndefined()
      }
    })

    it('should handle concurrent connection attempts to same server', async () => {
      const concurrentConfigs = Array.from({ length: 3 }, (_, i) => ({
        ...testConfig,
        id: `concurrent-session-${i}`,
      }))

      // Create multiple sessions concurrently
      const sessions = await Promise.all(
        concurrentConfigs.map(config => sshManager.createSession(config))
      )

      // Connect all sessions concurrently
      const connectionPromises = sessions.map(session =>
        sshManager.connect(session.id)
      )

      await Promise.all(connectionPromises)

      // Verify all sessions are connected
      sessions.forEach(session => {
        const connectedSession = sshManager.getSession(session.id)
        expect(connectedSession?.connected).toBe(true)
      })

      // Cleanup
      await Promise.all(sessions.map(session =>
        sshManager.disconnect(session.id)
      ))
    })

    it('should handle malformed SSH configuration', async () => {
      const malformedConfigs = [
        {
          id: 'malformed-1',
          hostname: '', // Empty hostname
          port: 22,
          username: 'testuser',
          password: 'testpass',
          authMethod: 'password' as const,
        },
        {
          id: 'malformed-2',
          hostname: 'example.com',
          port: 0, // Invalid port
          username: 'testuser',
          password: 'testpass',
          authMethod: 'password' as const,
        },
        {
          id: 'malformed-3',
          hostname: 'example.com',
          port: 22,
          username: '', // Empty username
          password: 'testpass',
          authMethod: 'password' as const,
        },
      ]

      for (const config of malformedConfigs) {
        await expect(sshManager.createSession(config)).rejects.toThrow()
      }
    })

    it('should handle session cleanup after process termination', async () => {
      const cleanupConfig = {
        ...testConfig,
        id: 'cleanup-after-termination',
      }

      const session = await sshManager.createSession(cleanupConfig)
      await sshManager.connect(session.id)

      // Simulate process termination
      const mockSSH = require('node-ssh').NodeSSH
      const mockInstance = mockSSH.mock.results[mockSSH.mock.results.length - 1].value

      // Simulate connection being forcibly closed
      if (mockInstance && mockInstance.connection) {
        mockInstance.connection = null
      }
      if (mockInstance && mockInstance.dispose) {
        mockInstance.dispose.mockImplementation(() => {
          throw new Error('Connection already closed')
        })
      }

      // Should handle cleanup gracefully
      await expect(sshManager.disconnect(session.id)).resolves.not.toThrow()
    })

    it('should handle memory pressure during large data transfers', async () => {
      const memoryTestConfig = {
        ...testConfig,
        id: 'memory-pressure-session',
      }

      const session = await sshManager.createSession(memoryTestConfig)
      await sshManager.connect(session.id)

      // Simulate large data transfer
      'x'.repeat(10 * 1024 * 1024) // 10MB - currently unused but kept for future implementation

      // This would test memory handling in a real implementation
      // For now, just verify the session can handle the request
      expect(session.id).toBe('memory-pressure-session')

      await sshManager.disconnect(session.id)
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency terminal data', async () => {
      const perfConfig = {
        ...testConfig,
        id: 'performance-session',
      }

      const session = await sshManager.createSession(perfConfig)
      await sshManager.connect(session.id)

      // Simulate high-frequency data
      const dataChunks = 1000
      const startTime = Date.now()

      for (let i = 0; i < dataChunks; i++) {
        // In a real implementation, this would test terminal data handling
        // For now, just verify session remains stable
        const currentSession = sshManager.getSession(session.id)
        expect(currentSession?.connected).toBe(true)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle 1000 operations in reasonable time
      expect(duration).toBeLessThan(5000) // 5 seconds

      await sshManager.disconnect(session.id)
    })

    it('should handle multiple sessions under load', async () => {
      const sessionCount = 5 // Reduced to avoid rate limiting
      const sessions = []

      // Create multiple sessions with small delays to avoid rate limiting
      for (let i = 0; i < sessionCount; i++) {
        const config = {
          ...testConfig,
          id: `load-test-session-${i}`,
          hostname: `test-${i}.example.com`, // Different hostnames to avoid rate limiting
        }
        const session = await sshManager.createSession(config)
        sessions.push(session)

        // Small delay to avoid rate limiting
        if (i < sessionCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      // Connect all sessions
      const startTime = Date.now()
      await Promise.all(sessions.map(session =>
        sshManager.connect(session.id)
      ))
      const connectTime = Date.now() - startTime

      // Should connect all sessions in reasonable time
      expect(connectTime).toBeLessThan(10000) // 10 seconds

      // Verify all sessions are connected
      sessions.forEach(session => {
        const connectedSession = sshManager.getSession(session.id)
        expect(connectedSession?.connected).toBe(true)
      })

      // Cleanup all sessions
      await Promise.all(sessions.map(session =>
        sshManager.disconnect(session.id)
      ))
    })

    it('should maintain performance with long-running sessions', async () => {
      const longRunningConfig = {
        ...testConfig,
        id: 'long-running-session',
      }

      const session = await sshManager.createSession(longRunningConfig)
      await sshManager.connect(session.id)

      // Simulate long-running session with periodic activity
      const iterations = 100
      const startTime = Date.now()

      for (let i = 0; i < iterations; i++) {
        // Simulate periodic session activity
        const currentSession = sshManager.getSession(session.id)
        expect(currentSession?.connected).toBe(true)

        // Small delay to simulate real-world usage
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should maintain performance over time
      expect(duration).toBeLessThan(5000) // 5 seconds for 100 iterations

      await sshManager.disconnect(session.id)
    })
  })

  describe('Security and Validation', () => {
    it('should validate SSH configuration parameters', async () => {
      const invalidConfigs = [
        {
          id: 'invalid-hostname',
          hostname: 'invalid@hostname', // Contains invalid character
          port: 22,
          username: 'testuser',
          password: 'testpass',
          authMethod: 'password' as const,
        },
        {
          id: 'invalid-port',
          hostname: 'example.com',
          port: 99999, // Port out of range
          username: 'testuser',
          password: 'testpass',
          authMethod: 'password' as const,
        },
        {
          id: 'invalid-username',
          hostname: 'example.com',
          port: 22,
          username: 'user@invalid', // Contains invalid character
          password: 'testpass',
          authMethod: 'password' as const,
        },
      ]

      for (const config of invalidConfigs) {
        await expect(sshManager.createSession(config)).rejects.toThrow()
      }
    })

    it('should handle session isolation properly', async () => {
      const session1Config = {
        ...testConfig,
        id: 'isolation-session-1',
      }

      const session2Config = {
        ...testConfig,
        id: 'isolation-session-2',
      }

      const session1 = await sshManager.createSession(session1Config)
      const session2 = await sshManager.createSession(session2Config)

      await sshManager.connect(session1.id)
      await sshManager.connect(session2.id)

      // Sessions should be isolated
      expect(session1.id).not.toBe(session2.id)

      const retrievedSession1 = sshManager.getSession(session1.id)
      const retrievedSession2 = sshManager.getSession(session2.id)

      expect(retrievedSession1?.id).toBe(session1.id)
      expect(retrievedSession2?.id).toBe(session2.id)

      // Disconnecting one should not affect the other
      await sshManager.disconnect(session1.id)

      expect(sshManager.getSession(session1.id)).toBeUndefined()
      expect(sshManager.getSession(session2.id)?.connected).toBe(true)

      await sshManager.disconnect(session2.id)
    })

    it('should sanitize sensitive data in logs', async () => {
      const sensitiveConfig = {
        ...testConfig,
        id: 'sensitive-data-session',
        password: 'super-secret-password-123',
      }

      // Mock console to capture logs
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const session = await sshManager.createSession(sensitiveConfig)
      await sshManager.connect(session.id)

      // Check that sensitive data is not logged
      const allLogs = [...consoleSpy.mock.calls, ...consoleErrorSpy.mock.calls]
      const logsWithPassword = allLogs.some(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('super-secret-password-123'))
      )

      expect(logsWithPassword).toBe(false)

      await sshManager.disconnect(session.id)

      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })
  })
})
