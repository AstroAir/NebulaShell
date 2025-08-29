import { sftpManager } from '../../src/lib/sftp-manager'
import { sshManager } from '../../src/lib/ssh-manager'
import { logger } from '../../src/lib/logger'
import SftpClient from 'ssh2-sftp-client'

// Mock dependencies
jest.mock('../../src/lib/ssh-manager')
jest.mock('../../src/lib/logger')
jest.mock('ssh2-sftp-client')

describe('SFTPManager', () => {
  let mockSftpClient: jest.Mocked<SftpClient>;
  let mockSSHManager: jest.Mocked<typeof sshManager>;
  let mockLogger: jest.Mocked<typeof logger>;

  const sessionId = 'test-session-1';

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mocked dependencies
    mockSSHManager = sshManager as jest.Mocked<typeof sshManager>
    mockLogger = logger as jest.Mocked<typeof logger>

    // Setup mock SFTP client
    mockSftpClient = {
      connect: jest.fn().mockResolvedValue(''),
      end: jest.fn().mockResolvedValue(true),
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(Buffer.from('test')),
      put: jest.fn().mockResolvedValue(''),
      mkdir: jest.fn().mockResolvedValue(''),
      rmdir: jest.fn().mockResolvedValue(''),
      delete: jest.fn().mockResolvedValue(''),
      rename: jest.fn().mockResolvedValue(''),
      stat: jest.fn().mockResolvedValue({ size: 1024 }),
      exists: jest.fn().mockResolvedValue(true),
    } as any

    // Mock the SftpClient constructor
    const SftpClientMock = SftpClient as jest.MockedClass<typeof SftpClient>
    SftpClientMock.mockImplementation(() => mockSftpClient)

    // Setup default mock behaviors
    mockSSHManager.getSSHConnection.mockReturnValue({
      connection: 'mock-ssh-connection',
    } as any)
  })

  // Helper function to set up SFTP client in the manager
  const setupSFTPClient = () => {
    const sftpManagerAny = sftpManager as any
    sftpManagerAny.sftpClients.set(sessionId, mockSftpClient)
  }

  describe('createSFTPConnection', () => {
    it('should create SFTP connection successfully', async () => {
      const sftp = await sftpManager.createSFTPConnection(sessionId)

      expect(mockSSHManager.getSSHConnection).toHaveBeenCalledWith(sessionId)
      expect(mockSftpClient.connect).toHaveBeenCalledWith({
        sock: 'mock-ssh-connection'
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SFTP connection established',
        {},
        sessionId
      )
      expect(sftp).toBe(mockSftpClient)
    })

    it('should throw error when SSH connection not found', async () => {
      mockSSHManager.getSSHConnection.mockReturnValue(undefined)

      await expect(sftpManager.createSFTPConnection(sessionId)).rejects.toThrow(
        'SSH connection not found'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create SFTP connection',
        { error: 'SSH connection not found' },
        sessionId
      )
    })

    it('should handle SFTP connection errors', async () => {
      const connectionError = new Error('SFTP connection failed')
      mockSftpClient.connect.mockRejectedValue(connectionError)

      // Mock the SftpClient constructor to return our mock
      const SftpClientMock = SftpClient as jest.MockedClass<typeof SftpClient>
      SftpClientMock.mockImplementation(() => mockSftpClient)

      await expect(sftpManager.createSFTPConnection(sessionId)).rejects.toThrow(
        'SFTP connection failed'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create SFTP connection',
        { error: 'SFTP connection failed' },
        sessionId
      )
    })
  })

  describe('listDirectory', () => {
    beforeEach(() => {
      setupSFTPClient()
    })

    it('should list directory contents successfully', async () => {
      const mockFiles = [
        { name: 'file1.txt', type: '-', size: 1024, modifyTime: new Date() },
        { name: 'dir1', type: 'd', size: 4096, modifyTime: new Date() },
        { name: 'file2.log', type: '-', size: 2048, modifyTime: new Date() },
      ]

      mockSftpClient.list.mockResolvedValue(mockFiles as any)

      const result = await sftpManager.listDirectory(sessionId, '/home/user')

      expect(mockSftpClient.list).toHaveBeenCalledWith('/home/user')
      expect(result.path).toBe('/home/user')
      expect(result.items).toHaveLength(3)
      // Check that we have the expected items (order may vary)
      const fileItem = result.items.find(item => item.name === 'file1.txt')
      const dirItem = result.items.find(item => item.name === 'dir1')
      const logItem = result.items.find(item => item.name === 'file2.log')

      expect(fileItem).toEqual({
        name: 'file1.txt',
        path: '/home/user/file1.txt',
        type: 'file',
        size: 1024,
        modifiedTime: expect.any(Date),
        permissions: '',
        owner: '',
        group: '',
      })
      expect(dirItem).toEqual({
        name: 'dir1',
        path: '/home/user/dir1',
        type: 'directory',
        size: 4096,
        modifiedTime: expect.any(Date),
        permissions: '',
        owner: '',
        group: '',
      })
      expect(logItem).toEqual({
        name: 'file2.log',
        path: '/home/user/file2.log',
        type: 'file',
        size: 2048,
        modifiedTime: expect.any(Date),
        permissions: '',
        owner: '',
        group: '',
      })
    })

    it('should handle root directory parent path', async () => {
      mockSftpClient.list.mockResolvedValue([])

      const result = await sftpManager.listDirectory(sessionId, '/')

      expect(result.parent).toBeUndefined()
    })

    it('should calculate parent path correctly', async () => {
      mockSftpClient.list.mockResolvedValue([])

      const result = await sftpManager.listDirectory(sessionId, '/home/user/documents')

      expect(result.parent).toBe('/home/user')
    })

    it('should handle SFTP list errors', async () => {
      const listError = new Error('Permission denied')
      mockSftpClient.list.mockRejectedValue(listError)

      await expect(sftpManager.listDirectory(sessionId, '/restricted')).rejects.toThrow(
        'Permission denied'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to list directory',
        { path: '/restricted', error: 'Permission denied' },
        sessionId
      )
    })
  })

  describe('performFileOperation', () => {
    beforeEach(() => {
      // Set up SFTP client in the manager's cache
      setupSFTPClient()
    })

    it('should create directory successfully', async () => {
      const operation = {
        type: 'create_directory' as const,
        source: '/home/user/newdir',
        sessionId,
      }

      mockSftpClient.mkdir.mockResolvedValue('')

      const result = await sftpManager.performFileOperation(sessionId, operation)

      expect(mockSftpClient.mkdir).toHaveBeenCalledWith('/home/user/newdir', true)
      expect(result.success).toBe(true)
    })

    it('should delete file successfully', async () => {
      const operation = {
        type: 'delete' as const,
        source: '/home/user/test.txt',
        sessionId,
      }

      mockSftpClient.stat.mockResolvedValue({ isDirectory: false } as any)
      mockSftpClient.delete.mockResolvedValue('')

      const result = await sftpManager.performFileOperation(sessionId, operation)

      expect(mockSftpClient.stat).toHaveBeenCalledWith('/home/user/test.txt')
      expect(mockSftpClient.delete).toHaveBeenCalledWith('/home/user/test.txt')
      expect(result.success).toBe(true)
    })

    it('should rename file successfully', async () => {
      const operation = {
        type: 'rename' as const,
        source: '/home/user/old.txt',
        destination: '/home/user/new.txt',
        sessionId,
      }

      mockSftpClient.rename.mockResolvedValue('')

      const result = await sftpManager.performFileOperation(sessionId, operation)

      expect(mockSftpClient.rename).toHaveBeenCalledWith('/home/user/old.txt', '/home/user/new.txt')
      expect(result.success).toBe(true)
    })

    it('should handle operation errors', async () => {
      const operation = {
        type: 'delete' as const,
        source: '/home/user/nonexistent.txt',
        sessionId,
      }

      const deleteError = new Error('File not found')
      mockSftpClient.stat.mockResolvedValue({ isDirectory: false } as any)
      mockSftpClient.delete.mockRejectedValue(deleteError)

      const result = await sftpManager.performFileOperation(sessionId, operation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')
    })
  })

  describe('uploadFile', () => {
    beforeEach(() => {
      setupSFTPClient()
    })

    it('should upload file successfully', async () => {
      const fileBuffer = Buffer.from('test file content')
      const remotePath = '/home/user'
      const fileName = 'test.txt'

      mockSftpClient.put.mockResolvedValue('')

      const result = await sftpManager.uploadFile(sessionId, fileBuffer, remotePath, fileName)

      expect(mockSftpClient.put).toHaveBeenCalledWith(fileBuffer, '/home/user/test.txt')
      expect(result).toBe('/home/user/test.txt')
    })

    it('should handle upload errors', async () => {
      const fileBuffer = Buffer.from('test content')
      const uploadError = new Error('Upload failed')
      mockSftpClient.put.mockRejectedValue(uploadError)

      await expect(
        sftpManager.uploadFile(sessionId, fileBuffer, '/home/user', 'test.txt')
      ).rejects.toThrow('Upload failed')
    })
  })

  describe('downloadFile', () => {
    beforeEach(() => {
      setupSFTPClient()
    })

    it('should download file successfully', async () => {
      const mockBuffer = Buffer.from('downloaded content')
      mockSftpClient.get.mockResolvedValue(mockBuffer)

      const result = await sftpManager.downloadFile(sessionId, '/home/user/test.txt')

      expect(mockSftpClient.get).toHaveBeenCalledWith('/home/user/test.txt')
      expect(result).toBe(mockBuffer)
    })

    it('should handle download errors', async () => {
      const downloadError = new Error('File not found')
      mockSftpClient.get.mockRejectedValue(downloadError)

      await expect(
        sftpManager.downloadFile(sessionId, '/nonexistent/file.txt')
      ).rejects.toThrow('File not found')
    })
  })



  describe('connection management', () => {
    it('should close SFTP connection', async () => {
      setupSFTPClient()
      mockSftpClient.end.mockResolvedValue(true)

      await sftpManager.closeSFTPConnection(sessionId)

      expect(mockSftpClient.end).toHaveBeenCalled()
    })

    it('should handle close errors gracefully', async () => {
      setupSFTPClient()
      const closeError = new Error('Close failed')
      mockSftpClient.end.mockRejectedValue(closeError)

      await expect(sftpManager.closeSFTPConnection(sessionId)).rejects.toThrow(
        'Close failed'
      )
    })

    it('should handle closing non-existent connection', async () => {
      await expect(sftpManager.closeSFTPConnection('non-existent')).rejects.toThrow(
        'SFTP connection not found'
      )
    })
  })

  describe('transfer management', () => {
    it('should get active transfers', () => {
      const transfers = sftpManager.getActiveTransfers()
      expect(Array.isArray(transfers)).toBe(true)
    })

    it('should cancel transfer', () => {
      const transferId = 'test-transfer-1'
      const result = sftpManager.cancelTransfer(transferId)
      expect(typeof result).toBe('boolean')
    })
  })
})
