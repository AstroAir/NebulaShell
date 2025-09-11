// Comprehensive SSH mocking for testing
import { EventEmitter } from 'events'

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
}

export default mockSSH;
