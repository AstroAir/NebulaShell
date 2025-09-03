import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { sshManager } from './ssh-manager';
import { SSHConnectionConfig } from '@/types/ssh';
import { logger } from './logger';
// WebSocketMessage import removed as not currently used

export class WebSocketServer {
  private io: SocketIOServer;

  constructor(server: HTTPServer | SocketIOServer) {
    if ('on' in server && 'emit' in server) {
      // If it's already a SocketIOServer instance (for testing)
      this.io = server as SocketIOServer;
    } else {
      // Create new SocketIOServer from HTTP server
      this.io = new SocketIOServer(server as HTTPServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', {
        socketId: socket.id,
        clientIP: socket.handshake.address
      });

      socket.on('ssh:connect', async (data: { config: SSHConnectionConfig }) => {
        let sessionId: string | undefined;
        try {
          const session = await sshManager.createSession(data.config);
          sessionId = session.id;
          await sshManager.connect(session.id);

          const ssh = sshManager.getSSHConnection(session.id);
          if (!ssh) {
            throw new Error('Failed to get SSH connection');
          }

          // Create shell
          const shell = await ssh.requestShell({
            cols: 80,
            rows: 24,
            term: 'xterm-256color'
          } as any);

          // Handle shell data
          shell.on('data', (data: Buffer) => {
            socket.emit('terminal:output', data.toString());
            sshManager.updateLastActivity(session.id);
          });

          shell.on('close', () => {
            socket.emit('ssh:disconnected', {
              sessionId: session.id,
              success: true
            });
            sshManager.disconnect(session.id);
          });

          // Store shell reference for this socket
          (socket as any).shell = shell;
          (socket as any).sessionId = session.id;

          socket.emit('ssh:connected', {
            sessionId: session.id,
            status: 'connected'
          });

        } catch (error) {
          logger.error('SSH connection failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            sessionId: sessionId || data.config.id
          });
          socket.emit('ssh:error', {
            error: error instanceof Error ? error.message : 'Connection failed',
            success: false,
            sessionId: sessionId || data.config.id
          });
        }
      });

      socket.on('terminal:input', (data: { sessionId: string; input: string }) => {
        // Validate input data
        if (!data || !data.sessionId || data.input === null || data.input === undefined) {
          socket.emit('ssh_error', {
            message: 'Invalid terminal input data',
            code: 'INVALID_INPUT',
            sessionId: data?.sessionId
          });
          return;
        }

        const shell = (socket as any).shell;
        if (shell && data.input) {
          shell.write(data.input);
          sshManager.updateLastActivity(data.sessionId);
        }
      });

      socket.on('terminal:resize', (data: { sessionId: string; cols: number; rows: number }) => {
        // Validate resize data
        if (!data || !data.sessionId || !data.cols || !data.rows ||
            data.cols < 1 || data.cols > 1000 || data.rows < 1 || data.rows > 1000) {
          socket.emit('ssh_error', {
            message: 'Terminal dimensions out of valid range (1-1000)',
            code: 'INVALID_DIMENSIONS',
            sessionId: data?.sessionId
          });
          return;
        }

        const shell = (socket as any).shell;
        if (shell) {
          shell.setWindow(data.rows, data.cols);
          sshManager.updateLastActivity(data.sessionId);
        }
      });

      socket.on('ssh:disconnect', () => {
        const sessionId = (socket as any).sessionId;
        const shell = (socket as any).shell;
        
        if (shell) {
          shell.end();
        }
        
        if (sessionId) {
          sshManager.disconnect(sessionId);
        }
      });

      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', {
          socketId: socket.id
        });
        const sessionId = (socket as any).sessionId;
        const shell = (socket as any).shell;
        
        if (shell) {
          shell.end();
        }
        
        if (sessionId) {
          sshManager.disconnect(sessionId);
        }
      });
    });
  }

  getIO() {
    return this.io;
  }
}

let websocketServer: WebSocketServer | null = null;

export function initializeWebSocketServer(server: HTTPServer): WebSocketServer {
  if (!websocketServer) {
    websocketServer = new WebSocketServer(server);
  }
  return websocketServer;
}

export function getWebSocketServer(): WebSocketServer | null {
  return websocketServer;
}
