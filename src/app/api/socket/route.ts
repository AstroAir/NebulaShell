// NextRequest import removed as not used
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { sshManager } from '@/lib/ssh-manager';
import { SSHConnectionConfig } from '@/types/ssh';

export const dynamic = 'force-static';

// Store the Socket.IO server instance
let io: SocketIOServer | undefined;

export async function GET() {
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

      // Store client info for mobile optimizations
      let clientInfo = {
        isMobile: false,
        lowBandwidth: false,
        batchUpdates: false,
        compressionEnabled: false
      };

      socket.on('client_info', (info: any) => {
        clientInfo = { ...clientInfo, ...info };
        console.log('Client info updated:', socket.id, clientInfo);
      });

      socket.on('ssh_connect', async (data: { config: SSHConnectionConfig; clientInfo?: any }) => {
        if (data.clientInfo) {
          clientInfo = { ...clientInfo, ...data.clientInfo };
        }
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

          // Handle shell data with mobile optimizations
          let dataBuffer = '';
          let lastEmit = Date.now();
          const BATCH_INTERVAL = clientInfo.batchUpdates ? 50 : 16; // 50ms for mobile, 16ms for desktop

          shell.on('data', (data: Buffer) => {
            const dataString = data.toString();

            if (clientInfo.batchUpdates) {
              // Batch updates for mobile
              dataBuffer += dataString;
              const now = Date.now();

              if (now - lastEmit >= BATCH_INTERVAL || dataBuffer.length > 1024) {
                socket.emit('terminal_data', {
                  sessionId: session.id,
                  data: dataBuffer,
                  batched: true,
                  timestamp: now
                });
                dataBuffer = '';
                lastEmit = now;
              }
            } else {
              // Real-time updates for desktop
              socket.emit('terminal_data', {
                sessionId: session.id,
                data: dataString,
                timestamp: Date.now()
              });
            }

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

      // Mobile-specific events
      socket.on('mobile_optimize', (data: {
        lowBandwidth?: boolean;
        batchUpdates?: boolean;
        compressionEnabled?: boolean;
      }) => {
        clientInfo = { ...clientInfo, ...data };
        socket.emit('mobile_optimized', {
          applied: data,
          timestamp: Date.now()
        });
      });

      socket.on('performance_metrics', (metrics: any) => {
        // Log performance metrics for monitoring
        console.log('Performance metrics received:', socket.id, {
          isMobile: clientInfo.isMobile,
          metrics: metrics
        });
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
