import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { sshManager } from './src/lib/ssh-manager';
import {
  ServerConfig,
  ServerError,
  ExtendedSocket,
  SSHConnectData,
  TerminalInputData,
  TerminalResizeData,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  TypedError,
  ConnectionError,
  AuthenticationError,
  ValidationError
} from './src/types/server';

// Server configuration
const dev: boolean = process.env.NODE_ENV !== 'production';
const hostname: string = 'localhost';
const port: number = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server in ${dev ? 'development' : 'production'} mode...`);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Global type declaration for httpServer
declare global {
  var httpServer: ReturnType<typeof createServer> | undefined;
}

// Utility function for handling errors with proper typing
function handleError(error: unknown, context: string, sessionId?: string): TypedError {
  if (error instanceof Error) {
    const typedError: TypedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      sessionId
    };

    // Add specific error codes based on error type and message
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      typedError.code = 'CONNECTION_FAILED';
    } else if (error.message.includes('Authentication failed') || error.message.includes('All configured authentication methods failed')) {
      typedError.code = 'AUTH_FAILED';
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      typedError.code = 'TIMEOUT';
    } else if (error.message.includes('Invalid configuration')) {
      typedError.code = 'INVALID_CONFIG';
    } else {
      typedError.code = 'UNKNOWN_ERROR';
    }

    console.error(`${context} error:`, {
      message: error.message,
      code: typedError.code,
      sessionId,
      stack: error.stack
    });

    return typedError;
  }

  // Handle non-Error objects
  const fallbackError: TypedError = {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    sessionId
  };

  console.error(`${context} error (non-Error object):`, error);
  return fallbackError;
}

app.prepare().then(() => {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      await handle(req, res, parsedUrl);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error occurred handling', req.url, error);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Store the HTTP server globally for Socket.IO
  global.httpServer = httpServer;

  // Initialize Socket.IO server with proper typing
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket: ExtendedSocket) => {
    console.log('Client connected:', socket.id);

    socket.on('ssh_connect', async (data: SSHConnectData) => {
      try {
        const session = await sshManager.createSession(data.config);
        await sshManager.connect(session.id);

        const ssh = sshManager.getSSHConnection(session.id);
        if (!ssh) {
          throw new Error('Failed to get SSH connection');
        }

        // Create shell with proper typing
        const shell = await ssh.requestShell({
          cols: data.cols || 80,
          rows: data.rows || 24,
          term: 'xterm-256color'
        } as any);

        // Handle shell data with proper typing
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
          const typedError = handleError(error, 'SSH shell', session.id);
          socket.emit('ssh_error', {
            sessionId: session.id,
            message: typedError.message,
            code: typedError.code,
            details: typedError.stack
          });
        });

        // Store shell reference for this socket
        socket.shell = shell;
        socket.sessionId = session.id;

        socket.emit('ssh_connected', {
          sessionId: session.id,
          status: 'connected'
        });

      } catch (error: unknown) {
        const typedError = handleError(error, 'SSH connection', data.config.id);
        socket.emit('ssh_error', {
          sessionId: data.config.id,
          message: typedError.message,
          code: typedError.code,
          details: typedError.stack
        });
      }
    });

    socket.on('terminal_input', (data: TerminalInputData) => {
      try {
        if (!data || typeof data.input !== 'string' || !data.sessionId) {
          socket.emit('ssh_error', {
            sessionId: data?.sessionId,
            message: 'Invalid terminal input data',
            code: 'INVALID_INPUT'
          });
          return;
        }

        if (socket.shell && data.input) {
          socket.shell.write(data.input);
          sshManager.updateLastActivity(data.sessionId);
        }
      } catch (error: unknown) {
        const typedError = handleError(error, 'Terminal input', data?.sessionId);
        socket.emit('ssh_error', {
          sessionId: data?.sessionId,
          message: typedError.message,
          code: typedError.code
        });
      }
    });

    socket.on('terminal_resize', (data: TerminalResizeData) => {
      try {
        if (!data || typeof data.cols !== 'number' || typeof data.rows !== 'number' || !data.sessionId) {
          socket.emit('ssh_error', {
            sessionId: data?.sessionId,
            message: 'Invalid terminal resize data',
            code: 'INVALID_RESIZE'
          });
          return;
        }

        if (data.cols < 1 || data.cols > 1000 || data.rows < 1 || data.rows > 1000) {
          socket.emit('ssh_error', {
            sessionId: data.sessionId,
            message: 'Terminal dimensions out of valid range (1-1000)',
            code: 'INVALID_DIMENSIONS'
          });
          return;
        }

        if (socket.shell) {
          socket.shell.setWindow(data.rows, data.cols);
          sshManager.updateLastActivity(data.sessionId);
        }
      } catch (error: unknown) {
        const typedError = handleError(error, 'Terminal resize', data?.sessionId);
        socket.emit('ssh_error', {
          sessionId: data?.sessionId,
          message: typedError.message,
          code: typedError.code
        });
      }
    });

    socket.on('ssh_disconnect', () => {
      if (socket.shell) {
        socket.shell.end();
      }
      
      if (socket.sessionId) {
        sshManager.disconnect(socket.sessionId);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.shell) {
        socket.shell.end();
      }
      
      if (socket.sessionId) {
        sshManager.disconnect(socket.sessionId);
      }
    });
  });

  httpServer
    .once('error', (err: ServerError) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
