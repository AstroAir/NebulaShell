// Mock SSH connections for testing
import { EventEmitter } from 'events'

export class MockSSHConnection extends EventEmitter {
  public connected = false
  public config: any = {}

  async connect(config: any) {
    this.config = config
    this.connected = true
    this.emit('ready')
    return this
  }

  async requestShell(options: any = {}) {
    const shell = new MockShell()
    return shell
  }

  async exec(command: string) {
    return {
      stdout: `Mock output for: ${command}`,
      stderr: '',
      code: 0,
    }
  }

  dispose() {
    this.connected = false
    this.emit('close')
  }

  end() {
    this.dispose()
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

export const mockNodeSSH = jest.fn(() => new MockSSHConnection())

export default {
  NodeSSH: mockNodeSSH,
  MockSSHConnection,
  MockShell,
}
