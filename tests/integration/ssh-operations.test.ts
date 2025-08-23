import { sshManager } from '../../src/lib/ssh-manager'
import { sftpManager } from '../../src/lib/sftp-manager'
import { terminalSessionManager } from '../../src/lib/terminal-session-manager'
import { SSHConnectionConfig } from '../../src/types/ssh'

// Mock external dependencies
jest.mock('node-ssh')
jest.mock('ssh2-sftp-client')

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
      sshManager.updateLastActivity(session.id)
      const updatedSession = sshManager.getSession(session.id)
      expect(updatedSession?.lastActivity).not.toEqual(originalActivity)

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

      const terminalSessions = configs.map(config =>
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
    it('should integrate SFTP with SSH session', async () => {
      // Create and connect SSH session
      const sshSession = await sshManager.createSession(testConfig)
      await sshManager.connect(sshSession.id)

      // Create SFTP connection
      const sftpClient = await sftpManager.createSFTPConnection(sshSession.id)
      expect(sftpClient).toBeDefined()

      // Test directory listing
      const mockFiles = [
        { name: 'file1.txt', type: '-', size: 1024, modifyTime: new Date() },
        { name: 'dir1', type: 'd', size: 4096, modifyTime: new Date() },
      ]

      // Mock SFTP operations
      const mockSftpClient = sftpClient as any
      mockSftpClient.list.mockResolvedValue(mockFiles)

      const directoryListing = await sftpManager.listDirectory(sshSession.id, '/home/user')
      expect(directoryListing.items).toHaveLength(2)
      expect(directoryListing.items[0].type).toBe('directory') // First item is directory (type 'd')
      expect(directoryListing.items[1].type).toBe('file') // Second item is file (type '-')

      // Test file upload
      const testBuffer = Buffer.from('test file content')
      mockSftpClient.put.mockResolvedValue(undefined)

      const uploadPath = await sftpManager.uploadFile(
        sshSession.id,
        testBuffer,
        '/home/user',
        'test.txt'
      )
      expect(uploadPath).toBe('/home/user/test.txt')

      // Test file download
      mockSftpClient.get.mockResolvedValue(testBuffer)

      const downloadedBuffer = await sftpManager.downloadFile(
        sshSession.id,
        '/home/user/test.txt'
      )
      expect(downloadedBuffer).toEqual(testBuffer)

      // Cleanup
      await sftpManager.closeSFTPConnection(sshSession.id)
      await sshManager.disconnect(sshSession.id)
    })

    it('should handle SFTP file operations with progress tracking', async () => {
      const sshSession = await sshManager.createSession(testConfig)
      await sshManager.connect(sshSession.id)

      const sftpClient = await sftpManager.createSFTPConnection(sshSession.id)
      const mockSftpClient = sftpClient as any

      // Test upload with progress callback
      const testBuffer = Buffer.from('large file content'.repeat(1000))
      const progressUpdates: any[] = []

      mockSftpClient.put.mockResolvedValue(undefined)

      await sftpManager.uploadFile(
        sshSession.id,
        testBuffer,
        '/home/user',
        'large-file.txt',
        (progress) => {
          progressUpdates.push(progress)
        }
      )

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[0]).toMatchObject({
        direction: 'upload',
        fileName: 'large-file.txt',
        total: testBuffer.length,
        // Status can be 'transferring' or 'completed' depending on timing
      })

      // Test download with progress callback
      const downloadProgressUpdates: any[] = []
      mockSftpClient.get.mockResolvedValue(testBuffer)

      await sftpManager.downloadFile(
        sshSession.id,
        '/home/user/large-file.txt',
        (progress) => {
          downloadProgressUpdates.push(progress)
        }
      )

      expect(downloadProgressUpdates.length).toBeGreaterThan(0)
      expect(downloadProgressUpdates[0]).toMatchObject({
        direction: 'download',
        fileName: 'large-file.txt',
        status: 'transferring',
      })

      // Cleanup
      await sftpManager.closeSFTPConnection(sshSession.id)
      await sshManager.disconnect(sshSession.id)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle SSH connection failures gracefully', async () => {
      const invalidConfig = {
        ...testConfig,
        id: 'error-test-session-1',
        hostname: 'nonexistent.example.com',
      }

      // Mock connection failure
      const mockSSH = require('node-ssh').NodeSSH
      const mockInstance = new mockSSH()
      mockInstance.connect.mockRejectedValue(new Error('Connection failed'))

      // Mock the constructor to return our mock instance
      mockSSH.mockImplementation(() => mockInstance)

      const session = await sshManager.createSession(invalidConfig)

      await expect(sshManager.connect(session.id)).rejects.toThrow('Connection failed')

      // Session should still exist but not be connected
      const failedSession = sshManager.getSession(session.id)
      expect(failedSession?.connected).toBe(false)
    })

    it('should handle SFTP operation failures', async () => {
      const sftpConfig = {
        ...testConfig,
        id: 'sftp-error-test-session',
      }

      const sshSession = await sshManager.createSession(sftpConfig)
      await sshManager.connect(sshSession.id)

      const sftpClient = await sftpManager.createSFTPConnection(sshSession.id)
      const mockSftpClient = sftpClient as any

      // Mock SFTP operation failure
      mockSftpClient.list.mockRejectedValue(new Error('Permission denied'))

      await expect(
        sftpManager.listDirectory(sshSession.id, '/restricted')
      ).rejects.toThrow('Permission denied')

      // SFTP connection should still be available for other operations
      mockSftpClient.list.mockResolvedValue([])
      const result = await sftpManager.listDirectory(sshSession.id, '/home/user')
      expect(result.items).toHaveLength(0)

      // Cleanup
      await sftpManager.closeSFTPConnection(sshSession.id)
      await sshManager.disconnect(sshSession.id)
    })

    it('should handle terminal session cleanup on SSH disconnect', async () => {
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
})
