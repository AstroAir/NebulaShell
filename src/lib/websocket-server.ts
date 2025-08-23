import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { sshManager } from './ssh-manager';
import { SSHConnectionConfig } from '@/types/ssh';
import { WebSocketMessage } from '@/types/websocket';

export class WebSocketServer {
  private io: SocketIOServer;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('ssh_connect', async (data: { config: SSHConnectionConfig }) => {
        try {
          const session = await sshManager.createSession(data.config);
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
            socket.emit('terminal_data', {
              sessionId: session.id,
              data: data.toString()
            });
            sshManager.updateLastActivity(session.id);
          });

          shell.on('close', () => {
            socket.emit('ssh_disconnected', { sessionId: session.id });
            sshManager.disconnect(session.id);
          });

          // Store shell reference for this socket
          (socket as any).shell = shell;
          (socket as any).sessionId = session.id;

          socket.emit('ssh_connected', {
            sessionId: session.id,
            status: 'connected'
          });

        } catch (error) {
          console.error('SSH connection error:', error);
          socket.emit('ssh_error', {
            message: error instanceof Error ? error.message : 'Connection failed'
          });
        }
      });

      socket.on('terminal_input', (data: { sessionId: string; input: string }) => {
        const shell = (socket as any).shell;
        if (shell && data.input) {
          shell.write(data.input);
          sshManager.updateLastActivity(data.sessionId);
        }
      });

      socket.on('terminal_resize', (data: { sessionId: string; cols: number; rows: number }) => {
        const shell = (socket as any).shell;
        if (shell) {
          shell.setWindow(data.rows, data.cols);
          sshManager.updateLastActivity(data.sessionId);
        }
      });

      socket.on('ssh_disconnect', () => {
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
        console.log('Client disconnected:', socket.id);
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
