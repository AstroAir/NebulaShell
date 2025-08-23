import { createServer } from 'http'
import { io as Client, Socket as ClientSocket } from 'socket.io-client'
import { sshManager } from '../../src/lib/ssh-manager'
import { SSHConnectionConfig } from '../../src/types/ssh'
import { WebSocketServer } from '../../src/lib/websocket-server'

// Mock SSH manager
jest.mock('../../src/lib/ssh-manager')

describe('WebSocket Server Integration', () => {
  let httpServer: any
  let websocketServer: WebSocketServer
  let clientSocket: ClientSocket
  let mockSSHManager: jest.Mocked<typeof sshManager>

  const testConfig: SSHConnectionConfig = {
    id: 'test-session-1',
    hostname: 'test.example.com',
    port: 22,
    username: 'testuser',
    password: 'testpass',
  }

  beforeAll((done) => {
    httpServer = createServer()
    websocketServer = new WebSocketServer(httpServer)

    httpServer.listen(() => {
      const port = httpServer.address()?.port
      clientSocket = Client(`http://localhost:${port}`)

      clientSocket.on('connect', done)
    })

    mockSSHManager = sshManager as jest.Mocked<typeof sshManager>
  })

  afterAll(() => {
    clientSocket.close()
    httpServer.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SSH Connection Flow', () => {
    it('should handle successful SSH connection', (done) => {
      const mockSession = {
        id: testConfig.id,
        config: testConfig,
        connected: true,
        lastActivity: new Date(),
        createdAt: new Date(),
      }

      const mockSSH = {
        requestShell: jest.fn().mockResolvedValue({
          on: jest.fn(),
          write: jest.fn(),
          setWindow: jest.fn(),
          end: jest.fn(),
        }),
      }

      mockSSHManager.createSession.mockResolvedValue(mockSession)
      mockSSHManager.connect.mockResolvedValue(undefined)
      mockSSHManager.getSSHConnection.mockReturnValue(mockSSH as any)

      // Listen for successful connection
      clientSocket.on('ssh_connected', (data) => {
        expect(data.sessionId).toBe(testConfig.id)
        expect(data.status).toBe('connected')
        expect(mockSSHManager.createSession).toHaveBeenCalledWith(testConfig)
        expect(mockSSHManager.connect).toHaveBeenCalledWith(testConfig.id)
        done()
      })

      // Trigger SSH connection
      clientSocket.emit('ssh_connect', { config: testConfig })
    })

    it('should handle SSH connection errors', (done) => {
      const connectionError = new Error('Connection failed')
      mockSSHManager.createSession.mockRejectedValue(connectionError)

      clientSocket.on('ssh_error', (data) => {
        expect(data.message).toBe('Connection failed')
        expect(data.sessionId).toBe(testConfig.id)
        done()
      })

      clientSocket.emit('ssh_connect', { config: testConfig })
    })
  })

  describe('Terminal Input/Output', () => {
    beforeEach(() => {
      const mockSession = {
        id: testConfig.id,
        config: testConfig,
        connected: true,
        lastActivity: new Date(),
        createdAt: new Date(),
      }

      const mockShell = {
        on: jest.fn(),
        write: jest.fn(),
        setWindow: jest.fn(),
        end: jest.fn(),
      }

      const mockSSH = {
        requestShell: jest.fn().mockResolvedValue(mockShell),
      }

      mockSSHManager.createSession.mockResolvedValue(mockSession)
      mockSSHManager.connect.mockResolvedValue(undefined)
      mockSSHManager.getSSHConnection.mockReturnValue(mockSSH as any)
      mockSSHManager.updateLastActivity.mockImplementation(() => {})
    })

    it('should handle terminal input', (done) => {
      const testInput = 'ls -la\n'
      let mockShell: any

      // First establish SSH connection
      clientSocket.on('ssh_connected', () => {
        // Now send terminal input
        clientSocket.emit('terminal_input', {
          sessionId: testConfig.id,
          input: testInput
        })

        setTimeout(() => {
          // Get the mock shell that was created during connection
          const mockSSH = mockSSHManager.getSSHConnection(testConfig.id)
          mockShell = mockSSH.requestShell.mock.results[0].value

          expect(mockShell.write).toHaveBeenCalledWith(testInput)
          expect(mockSSHManager.updateLastActivity).toHaveBeenCalledWith(testConfig.id)
          done()
        }, 100)
      })

      clientSocket.emit('ssh_connect', { config: testConfig })
    })

    it('should handle terminal resize', (done) => {
      const newCols = 120
      const newRows = 40
      let mockShell: any

      // First establish SSH connection
      clientSocket.on('ssh_connected', () => {
        // Now send terminal resize
        clientSocket.emit('terminal_resize', {
          sessionId: testConfig.id,
          cols: newCols,
          rows: newRows
        })

        setTimeout(() => {
          // Get the mock shell that was created during connection
          const mockSSH = mockSSHManager.getSSHConnection(testConfig.id)
          mockShell = mockSSH.requestShell.mock.results[0].value

          expect(mockShell.setWindow).toHaveBeenCalledWith(newRows, newCols)
          expect(mockSSHManager.updateLastActivity).toHaveBeenCalledWith(testConfig.id)
          done()
        }, 100)
      })

      clientSocket.emit('ssh_connect', { config: testConfig })
    })

    it('should validate terminal input data', (done) => {
      clientSocket.on('ssh_error', (data) => {
        expect(data.message).toBe('Invalid terminal input data')
        expect(data.code).toBe('INVALID_INPUT')
        done()
      })

      // Send invalid input data
      clientSocket.emit('terminal_input', {
        sessionId: null,
        input: null
      })
    })

    it('should validate terminal resize data', (done) => {
      clientSocket.on('ssh_error', (data) => {
        expect(data.message).toBe('Terminal dimensions out of valid range (1-1000)')
        expect(data.code).toBe('INVALID_DIMENSIONS')
        done()
      })

      // Send invalid resize data
      clientSocket.emit('terminal_resize', {
        sessionId: testConfig.id,
        cols: 2000,
        rows: 2000
      })
    })
  })

  describe('Connection Cleanup', () => {
    it('should handle SSH disconnect', (done) => {
      let mockShell: any

      clientSocket.on('ssh_connected', () => {
        clientSocket.emit('ssh_disconnect')

        setTimeout(() => {
          // Get the mock shell that was created during connection
          const mockSSH = mockSSHManager.getSSHConnection(testConfig.id)
          mockShell = mockSSH.requestShell.mock.results[0].value

          expect(mockShell.end).toHaveBeenCalled()
          expect(mockSSHManager.disconnect).toHaveBeenCalledWith(testConfig.id)
          done()
        }, 100)
      })

      clientSocket.emit('ssh_connect', { config: testConfig })
    })

    it('should cleanup on client disconnect', (done) => {
      let mockShell: any

      clientSocket.on('ssh_connected', () => {
        clientSocket.disconnect()

        setTimeout(() => {
          // Get the mock shell that was created during connection
          const mockSSH = mockSSHManager.getSSHConnection(testConfig.id)
          mockShell = mockSSH.requestShell.mock.results[0].value

          expect(mockShell.end).toHaveBeenCalled()
          expect(mockSSHManager.disconnect).toHaveBeenCalledWith(testConfig.id)
          done()
        }, 100)
      })

      clientSocket.emit('ssh_connect', { config: testConfig })
    })
  })
})
