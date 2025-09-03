// Mock Socket.IO Server
const mockSocket = {
  id: 'socket-123',
  emit: jest.fn(),
  on: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  disconnect: jest.fn(),
  handshake: {
    address: '127.0.0.1',
    headers: { 'user-agent': 'test-browser' },
  },
};

const mockIo = {
  on: jest.fn(),
  emit: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
  sockets: {
    sockets: new Map([['socket-123', mockSocket]]),
  },
};

jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => mockIo),
}));

import { WebSocketServer } from '../websocket-server';
import { sshManager } from '../ssh-manager';
import { logger } from '../logger';

// Mock dependencies
jest.mock('../ssh-manager', () => ({
  sshManager: {
    createSession: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    getSession: jest.fn(),
    getSSHConnection: jest.fn(),
    updateLastActivity: jest.fn(),
    executeCommand: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock Socket.IO (mocked above)

describe('WebSocketServer', () => {
  let webSocketServer: WebSocketServer;
  let mockSSHManager: jest.Mocked<typeof sshManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSSHManager = sshManager as jest.Mocked<typeof sshManager>;
    mockSSHManager.createSession.mockResolvedValue({
      id: 'session-123',
      config: { id: 'test-config-1', hostname: 'test.com', port: 22, username: 'user' },
      connected: false,
      createdAt: new Date(),
      lastActivity: new Date(),
    });
    
    mockSSHManager.getSession.mockReturnValue({
      id: 'session-123',
      config: { id: 'test-config-2', hostname: 'test.com', port: 22, username: 'user' },
      connected: true,
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    // Mock SSH connection with all required NodeSSH properties
    const mockSSHConnection = {
      requestShell: jest.fn().mockResolvedValue({
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        setWindow: jest.fn(),
      }),
      connection: {},
      getConnection: jest.fn(),
      connect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      dispose: jest.fn(),
      exec: jest.fn(),
      execCommand: jest.fn(),
      mkdir: jest.fn(),
      getFile: jest.fn(),
      putFile: jest.fn(),
      putFiles: jest.fn(),
      putDirectory: jest.fn(),
      requestSFTP: jest.fn(),
      forwardIn: jest.fn(),
      forwardOut: jest.fn(),
      requestSubsystem: jest.fn(),
    } as any;

    mockSSHManager.getSSHConnection.mockReturnValue(mockSSHConnection);
    
    webSocketServer = new WebSocketServer(mockIo as any);
  });

  describe('Initialization', () => {
    it('should initialize with Socket.IO server', () => {
      expect(webSocketServer).toBeDefined();
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should set up connection handler', () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      expect(connectionHandler).toBeDefined();
    });

    it('should have IO instance available', () => {
      const io = webSocketServer.getIO();
      expect(io).toBeDefined();
    });
  });

  describe('Socket Connection Handling', () => {
    let connectionHandler: Function;

    beforeEach(() => {
      connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
    });

    it('should handle new socket connection', () => {
      connectionHandler(mockSocket);
      
      expect(mockSocket.on).toHaveBeenCalledWith('ssh:connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ssh:disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('terminal:input', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('terminal:resize', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle socket connections', () => {
      connectionHandler(mockSocket);

      // Verify connection handler was called
      expect(mockSocket.on).toHaveBeenCalled();
    });

    it('should log connection details', () => {
      connectionHandler(mockSocket);
      
      expect(logger.info).toHaveBeenCalledWith(
        'WebSocket client connected',
        expect.objectContaining({
          socketId: 'socket-123',
          clientIP: '127.0.0.1',
        })
      );
    });
  });

  describe('SSH Connection Management', () => {
    let sshConnectHandler: Function;

    beforeEach(() => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);
      
      sshConnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:connect')?.[1];
    });

    it('should handle SSH connection request', async () => {
      const sshConfig = {
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        password: 'testpass',
      };
      
      await sshConnectHandler({ config: sshConfig });
      
      expect(mockSSHManager.createSession).toHaveBeenCalledWith(sshConfig);
      expect(mockSSHManager.connect).toHaveBeenCalledWith('session-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('ssh:connected', {
        sessionId: 'session-123',
        status: 'connected',
      });
    });

    it('should handle SSH connection errors', async () => {
      mockSSHManager.createSession.mockRejectedValue(new Error('Connection failed'));
      
      const sshConfig = {
        hostname: 'invalid.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        password: 'wrongpass',
      };
      
      await sshConnectHandler({ config: sshConfig });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ssh:error', {
        error: 'Connection failed',
        success: false,
      });
    });

    it('should handle SSH connection setup', async () => {
      const mockSSHConnection = {
        requestShell: jest.fn().mockResolvedValue({
          write: jest.fn(),
          setWindow: jest.fn(),
          on: jest.fn(),
          end: jest.fn(),
        }),
        connection: {},
        getConnection: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn(),
        exec: jest.fn(),
        execCommand: jest.fn(),
        mkdir: jest.fn(),
        getFile: jest.fn(),
        putFile: jest.fn(),
        putFiles: jest.fn(),
        putDirectory: jest.fn(),
        requestSFTP: jest.fn(),
        requestSubsystem: jest.fn(),
        forwardIn: jest.fn(),
        forwardOut: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      } as any;

      mockSSHManager.getSSHConnection.mockReturnValue(mockSSHConnection);

      const sshConfig = {
        id: 'test-config',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        password: 'testpass',
      };

      await sshConnectHandler({ config: sshConfig });

      expect(mockSSHManager.createSession).toHaveBeenCalledWith(sshConfig);
      expect(mockSSHManager.connect).toHaveBeenCalled();
    });

    it('should handle shell data events', async () => {
      const mockShell = {
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
        removeListener: jest.fn(),
        setWindow: jest.fn(),
      };
      
      const mockSSHConnection = {
        requestShell: jest.fn().mockResolvedValue(mockShell),
        connection: {},
        getConnection: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn(),
        exec: jest.fn(),
        execCommand: jest.fn(),
        mkdir: jest.fn(),
        getFile: jest.fn(),
        putFile: jest.fn(),
        putFiles: jest.fn(),
        putDirectory: jest.fn(),
        requestSFTP: jest.fn(),
        requestSubsystem: jest.fn(),
        forwardIn: jest.fn(),
        forwardOut: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      } as any;

      mockSSHManager.getSSHConnection.mockReturnValue(mockSSHConnection);

      await sshConnectHandler({
        config: {
          id: 'test-config',
          hostname: 'test.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          password: 'pass',
        }
      });
      
      // Simulate shell data event
      const dataHandler = mockShell.on.mock.calls.find(call => call[0] === 'data')?.[1];
      dataHandler('terminal output');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal:output', 'terminal output');
    });
  });

  describe('Terminal Input Handling', () => {
    let terminalInputHandler: Function;
    let mockShell: any;

    beforeEach(async () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);
      
      mockShell = {
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
        removeListener: jest.fn(),
        setWindow: jest.fn(),
      };

      // Attach shell to mock socket for terminal input tests
      (mockSocket as any).shell = mockShell;
      (mockSocket as any).sessionId = 'session-123';
      
      const mockSSHConnection = {
        requestShell: jest.fn().mockResolvedValue(mockShell),
        connection: {},
        getConnection: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn(),
        exec: jest.fn(),
        execCommand: jest.fn(),
        mkdir: jest.fn(),
        getFile: jest.fn(),
        putFile: jest.fn(),
        putFiles: jest.fn(),
        putDirectory: jest.fn(),
        requestSFTP: jest.fn(),
        requestSubsystem: jest.fn(),
        forwardIn: jest.fn(),
        forwardOut: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      } as any;

      mockSSHManager.getSSHConnection.mockReturnValue(mockSSHConnection);
      
      // Establish SSH connection first
      const sshConnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:connect')?.[1];
      await sshConnectHandler({
        config: {
          id: 'test-config',
          hostname: 'test.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          password: 'pass',
        }
      });
      
      terminalInputHandler = mockSocket.on.mock.calls.find(call => call[0] === 'terminal:input')?.[1];
    });

    it('should handle terminal input', () => {
      const inputData = { sessionId: 'session-123', input: 'ls -la\r' };

      terminalInputHandler.call(mockSocket, inputData);

      expect((mockSocket as any).shell.write).toHaveBeenCalledWith('ls -la\r');
    });

    it('should handle special key sequences', () => {
      const ctrlC = { sessionId: 'session-123', input: '\x03' }; // Ctrl+C

      terminalInputHandler.call(mockSocket, ctrlC);

      expect((mockSocket as any).shell.write).toHaveBeenCalledWith('\x03');
    });

    it('should handle empty input gracefully', () => {
      const emptyInput = { sessionId: 'session-123', input: '' };

      terminalInputHandler.call(mockSocket, emptyInput);

      // Empty input should not call shell.write
      expect((mockSocket as any).shell.write).not.toHaveBeenCalled();
    });
  });

  describe('Terminal Resize Handling', () => {
    let terminalResizeHandler: Function;

    beforeEach(async () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);
      
      // Establish SSH connection first
      const sshConnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:connect')?.[1];
      await sshConnectHandler({
        config: {
          hostname: 'test.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          password: 'pass',
        }
      });
      
      terminalResizeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'terminal:resize')?.[1];
    });

    it('should handle terminal resize', () => {
      const dimensions = { sessionId: 'session-123', cols: 120, rows: 40 };

      terminalResizeHandler(dimensions);

      // Verify that updateLastActivity is called
      expect(mockSSHManager.updateLastActivity).toHaveBeenCalledWith('session-123');
    });

    it('should validate resize dimensions', () => {
      const invalidDimensions = { sessionId: 'session-123', cols: -1, rows: 0 };

      terminalResizeHandler(invalidDimensions);

      // Should emit error for invalid dimensions
      expect(mockSocket.emit).toHaveBeenCalledWith('ssh_error', expect.objectContaining({
        message: expect.stringContaining('dimensions'),
      }));
    });
  });

  describe('Disconnection Handling', () => {
    let disconnectHandler: Function;

    beforeEach(async () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);
      
      // Establish SSH connection
      const sshConnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:connect')?.[1];
      await sshConnectHandler({
        config: {
          hostname: 'test.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          password: 'pass',
        }
      });
      
      disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
    });

    it('should handle socket disconnection', async () => {
      await disconnectHandler('client disconnect');
      
      expect(mockSSHManager.disconnect).toHaveBeenCalledWith('session-123');
      expect(logger.info).toHaveBeenCalledWith(
        'WebSocket client disconnected',
        expect.objectContaining({
          socketId: 'socket-123',
        })
      );
    });

    it('should clean up connections on disconnect', async () => {
      await disconnectHandler('client disconnect');

      // Verify disconnect cleanup was called
      expect(mockSSHManager.disconnect).toHaveBeenCalled();
    });

    it('should handle SSH disconnection request', async () => {
      const sshDisconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:disconnect')?.[1];

      await sshDisconnectHandler();

      expect(mockSSHManager.disconnect).toHaveBeenCalledWith('session-123');
      expect((mockSocket as any).shell.end).toHaveBeenCalled();

      // The ssh:disconnected event is emitted when the shell closes, not directly by the disconnect handler
      // So we don't expect the emit call here
    });
  });

  describe('Socket.IO Integration', () => {
    it('should provide access to Socket.IO instance', () => {
      const io = webSocketServer.getIO();

      expect(io).toBeDefined();
      expect(io).toBe(mockIo);
    });

    it('should handle socket connections through IO', () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('ssh:connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('terminal:input', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('terminal:resize', expect.any(Function));
    });

    it('should handle socket disconnections', () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ssh:disconnect', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    it('should handle SSH connection timeout', async () => {
      mockSSHManager.connect.mockRejectedValue(new Error('Connection timeout'));
      
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);
      
      const sshConnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:connect')?.[1];
      
      await sshConnectHandler({
        config: {
          hostname: 'timeout.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          password: 'pass',
        }
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ssh:error', expect.objectContaining({
        error: 'Connection timeout',
        success: false,
      }));
    });

    it('should handle SSH connection errors', async () => {
      mockSSHManager.connect.mockRejectedValue(new Error('Connection failed'));

      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);

      const sshConnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ssh:connect')?.[1];

      await sshConnectHandler({
        config: {
          id: 'test-config',
          hostname: 'test.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          password: 'pass',
        }
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('ssh:error', expect.objectContaining({
        error: expect.any(String),
        success: false,
      }));
    });

    it('should handle malformed input data', () => {
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      connectionHandler(mockSocket);
      
      const terminalInputHandler = mockSocket.on.mock.calls.find(call => call[0] === 'terminal:input')?.[1];
      
      // Should not throw error with malformed input
      expect(() => terminalInputHandler(null)).not.toThrow();
      expect(() => terminalInputHandler(undefined)).not.toThrow();
    });
  });

  describe('Server Management', () => {
    it('should provide Socket.IO server instance', () => {
      const io = webSocketServer.getIO();

      expect(io).toBeDefined();
      expect(typeof io.on).toBe('function');
      expect(typeof io.emit).toBe('function');
    });

    it('should handle server initialization', () => {
      // Verify that the server was initialized with connection handlers
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
});
