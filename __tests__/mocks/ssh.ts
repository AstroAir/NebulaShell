// Comprehensive SSH mocking for testing
import { EventEmitter } from 'events'

export interface MockSSHCommand {
  command: string;
  response: string | (() => string);
  delay?: number;
  exitCode?: number;
  interactive?: boolean;
  streamOutput?: boolean;
}

export interface MockSSHSession {
  id: string;
  connected: boolean;
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  commandHistory: string[];
  currentProcess?: string;
}

export class MockSSHConnection extends EventEmitter {
  public connected = false
  public config: any = {}

  async connect(config: any) {
    // Simulate different connection scenarios based on hostname
    if (config.host === 'nonexistent.example.com' || config.hostname === 'nonexistent.example.com') {
      throw new Error('Connection failed');
    }

    this.config = config
    this.connected = true
    this.emit('ready')
    return this
  }

  async requestShell() {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    const shell = new MockShell()
    return shell
  }

  async exec(command: string) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    return {
      stdout: `Mock output for: ${command}`,
      stderr: '',
      code: 0,
    }
  }

  // SFTP operations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async putFile(..._: [string, string]) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    return Promise.resolve()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getFile(..._: [string, string]) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    return Promise.resolve()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async putDirectory(..._: [string, string]) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    return Promise.resolve()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getDirectory(..._: [string, string]) {
    if (!this.connected) {
      throw new Error('Not connected')
    }
    return Promise.resolve()
  }

  dispose() {
    this.connected = false
    this.emit('close')
    return Promise.resolve()
  }

  end() {
    this.dispose()
  }

  // Connection property for compatibility
  get connection() {
    return {
      on: jest.fn(),
      end: jest.fn(),
    }
  }
}

export class MockShell extends EventEmitter {
  public writable = true
  public readable = true

  write(data: string) {
    // Simulate echoing back the input
    setTimeout(() => {
      this.emit('data', Buffer.from(data))
    }, 10)
  }

  setWindow(rows: number, cols: number) {
    // Mock terminal resize
    this.emit('resize', { rows, cols })
  }

  end() {
    this.writable = false
    this.emit('close')
  }

  // Simulate server responses
  simulateOutput(data: string) {
    this.emit('data', Buffer.from(data))
  }

  simulateError(error: Error) {
    this.emit('error', error)
  }

  simulateClose() {
    this.emit('close')
  }
}

// Create a comprehensive NodeSSH mock that includes all methods
export const createMockNodeSSH = () => jest.fn().mockImplementation(() => new MockSSHConnection())

// Individual mock functions for granular testing
export const mockConnect = jest.fn().mockImplementation(async (config: any) => {
  if (config.host === 'nonexistent.example.com' || config.hostname === 'nonexistent.example.com') {
    throw new Error('Connection failed');
  }
  return Promise.resolve();
});

export const mockDispose = jest.fn().mockResolvedValue(undefined);

export const mockRequestShell = jest.fn().mockResolvedValue({
  write: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
});

export const mockExec = jest.fn().mockResolvedValue({
  stdout: 'mock output',
  stderr: '',
  code: 0
});

// Main NodeSSH mock factory
export const mockNodeSSH = createMockNodeSSH()

export class EnhancedSSHMock extends EventEmitter {
  private sessions: Map<string, MockSSHSession> = new Map();
  private commandResponses: Map<string, MockSSHCommand> = new Map();
  private defaultCommands: MockSSHCommand[] = [
    {
      command: 'pwd',
      response: '/home/testuser',
    },
    {
      command: 'whoami',
      response: 'testuser',
    },
    {
      command: 'ls',
      response: 'documents  projects  welcome.txt  test-script.sh',
    },
    {
      command: 'ls -la',
      response: `total 24
drwxr-xr-x 5 testuser testuser 4096 Jan 15 10:30 .
drwxr-xr-x 3 root     root     4096 Jan 15 10:00 ..
-rw-r--r-- 1 testuser testuser  220 Jan 15 10:00 .bash_logout
-rw-r--r-- 1 testuser testuser 3771 Jan 15 10:00 .bashrc
-rw-r--r-- 1 testuser testuser  807 Jan 15 10:00 .profile
drwxr-xr-x 2 testuser testuser 4096 Jan 15 10:30 documents
drwxr-xr-x 2 testuser testuser 4096 Jan 15 10:30 projects
-rwxr-xr-x 1 testuser testuser   65 Jan 15 10:30 test-script.sh
-rw-r--r-- 1 testuser testuser   26 Jan 15 10:30 welcome.txt`,
    },
    {
      command: 'cat welcome.txt',
      response: 'Hello from test server!',
    },
    {
      command: 'echo $HOME',
      response: '/home/testuser',
    },
    {
      command: 'date',
      response: () => new Date().toString(),
    },
    {
      command: 'uname -a',
      response: 'Linux test-server 5.15.0-generic #72-Ubuntu SMP Tue Nov 30 07:07:44 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux',
    },
    {
      command: 'ps aux',
      response: `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1  167304 11788 ?        Ss   10:00   0:01 /sbin/init
root         2  0.0  0.0      0     0 ?        S    10:00   0:00 [kthreadd]
testuser  1234  0.0  0.2  21532  4892 pts/0    Ss   10:30   0:00 -bash
testuser  1456  0.0  0.1  19312  3284 pts/0    R+   10:35   0:00 ps aux`,
    },
    {
      command: 'top',
      response: `top - 10:35:01 up  35 min,  1 user,  load average: 0.08, 0.03, 0.01
Tasks: 123 total,   1 running, 122 sleeping,   0 stopped,   0 zombie
%Cpu(s):  0.3 us,  0.1 sy,  0.0 ni, 99.6 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem :   1024.0 total,    512.0 free,    256.0 used,    256.0 buff/cache
MiB Swap:   1024.0 total,   1024.0 free,      0.0 used.    768.0 avail Mem`,
      interactive: true,
    },
    {
      command: 'ping google.com',
      response: `PING google.com (172.217.164.110) 56(84) bytes of data.
64 bytes from 172.217.164.110: icmp_seq=1 ttl=117 time=12.1 ms
64 bytes from 172.217.164.110: icmp_seq=2 ttl=117 time=12.3 ms
64 bytes from 172.217.164.110: icmp_seq=3 ttl=117 time=12.0 ms`,
      interactive: true,
      streamOutput: true,
    },
    {
      command: 'vim test.txt',
      response: '\x1b[?1049h\x1b[22;0;0t\x1b[1;1H\x1b[?25l', // Enter vim mode
      interactive: true,
    },
    {
      command: 'history',
      response: () => {
        const session = this.getCurrentSession();
        if (session) {
          return session.commandHistory
            .map((cmd, index) => `${index + 1}  ${cmd}`)
            .join('\n');
        }
        return '1  pwd\n2  ls\n3  whoami';
      },
    },
  ];

  private currentSessionId: string | null = null;

  constructor() {
    super();
    this.initializeDefaultCommands();
  }

  private initializeDefaultCommands(): void {
    this.defaultCommands.forEach(cmd => {
      this.commandResponses.set(cmd.command, cmd);
    });
  }

  createSession(sessionId: string): MockSSHSession {
    const session: MockSSHSession = {
      id: sessionId,
      connected: false,
      workingDirectory: '/home/testuser',
      environmentVariables: {
        HOME: '/home/testuser',
        USER: 'testuser',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        SHELL: '/bin/bash',
        TERM: 'xterm-256color',
      },
      commandHistory: [],
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    return session;
  }

  connect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.connected = true;
      this.currentSessionId = sessionId;
      this.emit('connected', sessionId);
    }
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.connected = false;
      this.emit('disconnected', sessionId);
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.connected) {
      throw new Error('Session not connected');
    }

    // Add to command history
    session.commandHistory.push(command);

    // Handle built-in commands
    if (command.startsWith('cd ')) {
      return this.handleCdCommand(session, command);
    }

    if (command.startsWith('export ')) {
      return this.handleExportCommand(session, command);
    }

    // Check for registered command responses
    const mockCommand = this.commandResponses.get(command.trim());
    if (mockCommand) {
      let response = typeof mockCommand.response === 'function'
        ? mockCommand.response()
        : mockCommand.response;

      // Handle interactive commands
      if (mockCommand.interactive) {
        session.currentProcess = command;
        this.emit('interactive_start', sessionId, command);
      }

      // Handle streaming output
      if (mockCommand.streamOutput) {
        this.simulateStreamingOutput(sessionId, response);
        return '';
      }

      // Add delay if specified
      if (mockCommand.delay) {
        await new Promise(resolve => setTimeout(resolve, mockCommand.delay));
      }

      return response;
    }

    // Handle unknown commands
    return this.handleUnknownCommand(command);
  }

  private handleCdCommand(session: MockSSHSession, command: string): string {
    const path = command.substring(3).trim() || session.environmentVariables.HOME;

    // Simple path handling
    if (path === '..') {
      const parts = session.workingDirectory.split('/');
      parts.pop();
      session.workingDirectory = parts.join('/') || '/';
    } else if (path.startsWith('/')) {
      session.workingDirectory = path;
    } else {
      session.workingDirectory = `${session.workingDirectory}/${path}`.replace('//', '/');
    }

    return '';
  }

  private handleExportCommand(session: MockSSHSession, command: string): string {
    const exportMatch = command.match(/export\s+(\w+)=(.+)/);
    if (exportMatch) {
      const [, key, value] = exportMatch;
      session.environmentVariables[key] = value.replace(/['"]/g, '');
    }
    return '';
  }

  private handleUnknownCommand(command: string): string {
    return `bash: ${command}: command not found`;
  }

  private simulateStreamingOutput(sessionId: string, output: string): void {
    const lines = output.split('\n');
    let index = 0;

    const streamInterval = setInterval(() => {
      if (index < lines.length) {
        this.emit('data', sessionId, lines[index] + '\n');
        index++;
      } else {
        clearInterval(streamInterval);
        this.emit('stream_complete', sessionId);
      }
    }, 1000); // Stream one line per second
  }

  addCustomCommand(command: string, response: string | (() => string), options?: {
    delay?: number;
    exitCode?: number;
    interactive?: boolean;
    streamOutput?: boolean;
  }): void {
    this.commandResponses.set(command, {
      command,
      response,
      ...options,
    });
  }

  removeCustomCommand(command: string): void {
    this.commandResponses.delete(command);
  }

  getCurrentSession(): MockSSHSession | null {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) || null : null;
  }

  getSession(sessionId: string): MockSSHSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): MockSSHSession[] {
    return Array.from(this.sessions.values());
  }

  clearSessions(): void {
    this.sessions.clear();
    this.currentSessionId = null;
  }

  // Simulate terminal interruption (Ctrl+C)
  interrupt(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.currentProcess) {
      session.currentProcess = undefined;
      this.emit('interrupted', sessionId);
      this.emit('data', sessionId, '^C\n');
    }
  }

  // Simulate terminal resize
  resize(sessionId: string, cols: number, rows: number): void {
    this.emit('resize', sessionId, { cols, rows });
  }
}

export const enhancedSSHMock = new EnhancedSSHMock();

// Default export for compatibility
const mockSSH = {
  NodeSSH: mockNodeSSH,
  MockSSHConnection,
  MockShell,
  createMockNodeSSH,
  mockConnect,
  mockDispose,
  mockRequestShell,
  mockExec,
  EnhancedSSHMock,
  enhancedSSHMock,
}

export default mockSSH;
