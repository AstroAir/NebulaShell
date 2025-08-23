import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { sshManager } from '@/lib/ssh-manager';
import { SSHConnectionConfig } from '@/types/ssh';

export const dynamic = 'force-dynamic';

// Store the Socket.IO server instance
let io: SocketIOServer | undefined;

export async function GET(req: NextRequest) {
  if (!io) {
    const httpServer: NetServer = (global as any).httpServer;
    
    if (!httpServer) {
      return new Response('HTTP server not available', { status: 500 });
    }

    io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
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

          shell.on('error', (error: Error) => {
            socket.emit('ssh_error', {
              sessionId: session.id,
              message: error.message
            });
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

  return new Response('Socket.IO server initialized', { status: 200 });
}
