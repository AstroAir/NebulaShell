// Mock Socket.IO for testing
import { enhancedSSHMock } from './ssh'

export interface MockSocketMessage {
  event: string;
  data: any;
  timestamp: number;
  sessionId?: string;
}

export interface MockSocketOptions {
  autoConnect?: boolean;
  connectionDelay?: number;
  simulateNetworkIssues?: boolean;
  networkIssueRate?: number; // 0-1, probability of network issues
}

export class MockSocket {
  protected events: Map<string, Function[]> = new Map()
  public connected = false
  public id = 'mock-socket-id'
  private timeouts: Set<NodeJS.Timeout> = new Set()

  // Make emit a jest spy
  public emit = jest.fn((event: string, ...args: any[]) => {
    const callbacks = this.events.get(event) || []
    // Check if we're in a test environment and wrap in act if available
    if (typeof global !== 'undefined' && (global as any).IS_REACT_ACT_ENVIRONMENT) {
      const { act } = require('@testing-library/react')
      act(() => {
        callbacks.forEach(callback => callback(...args))
      })
    } else {
      callbacks.forEach(callback => callback(...args))
    }
  })

  on(event: string, callback: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)
    return this
  }

  off(event: string, callback?: Function) {
    if (callback) {
      const callbacks = this.events.get(event) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    } else {
      this.events.delete(event)
    }
    return this
  }



  connect() {
    if (!this.connected) {
      this.connected = true
      // Use setTimeout to prevent synchronous infinite loops
      const timeoutId = setTimeout(() => {
        if (this.connected) {
          this.emit('connect')
        }
        this.timeouts.delete(timeoutId)
      }, 0)
      this.timeouts.add(timeoutId)
    }
    return this
  }

  disconnect() {
    if (this.connected) {
      this.connected = false
      // Use setTimeout to prevent synchronous infinite loops
      const timeoutId = setTimeout(() => {
        this.emit('disconnect')
        this.timeouts.delete(timeoutId)
      }, 0)
      this.timeouts.add(timeoutId)
    }
    return this
  }

  close() {
    this.disconnect()
    this.cleanup()
  }

  // Clean up all resources to prevent memory leaks
  cleanup() {
    // Clear all timeouts
    this.timeouts.forEach(timeoutId => clearTimeout(timeoutId))
    this.timeouts.clear()

    // Clear all event listeners
    this.events.clear()

    // Reset connection state
    this.connected = false
  }

  // Reset all mocks for clean test state
  resetMocks() {
    this.emit.mockClear()
    this.events.clear()
    this.connected = false
    // Clear any pending timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
  }

  // Simulate server events
  simulateServerEvent(event: string, data: any) {
    console.log(`MockSocket.simulateServerEvent: ${event}`, data, 'connected:', this.connected)
    // Always emit server events for testing purposes
    // The connection check is mainly for client-initiated events
    console.log(`MockSocket.emit: ${event}`, data)
    this.emit(event, data)
  }
}

export const mockIo = jest.fn(() => new MockSocket())

export class EnhancedSocketMock extends MockSocket {
  private messageHistory: MockSocketMessage[] = [];
  private options: MockSocketOptions;
  private networkSimulation: {
    latency: number;
    packetLoss: number;
    jitter: number;
  } = {
    latency: 0,
    packetLoss: 0,
    jitter: 0,
  };

  constructor(options: MockSocketOptions = {}) {
    super();
    this.options = {
      autoConnect: true,
      connectionDelay: 100,
      simulateNetworkIssues: false,
      networkIssueRate: 0.05,
      ...options,
    };

    if (this.options.autoConnect) {
      setTimeout(() => this.connect(), this.options.connectionDelay);
    }
  }

  connect(): this {
    if (!this.connected) {
      this.connected = true;
      setTimeout(() => {
        this.emit('connect');
      }, this.calculateNetworkDelay());
    }
    return this;
  }

  disconnect(): this {
    if (this.connected) {
      this.connected = false;
      setTimeout(() => {
        this.emit('disconnect');
      }, this.calculateNetworkDelay());
    }
    return this;
  }

  // Enhanced emit method
  public emit = jest.fn((event: string, ...args: any[]): void => {
    // Log the message for debugging
    this.logMessage(event, args[0]);

    // Simulate network conditions
    if (this.shouldSimulateNetworkIssue()) {
      console.log(`Network issue simulated for event: ${event}`);
      return;
    }

    // Add network latency
    const delay = this.calculateNetworkDelay();

    if (delay > 0) {
      setTimeout(() => {
        const callbacks = this.events.get(event) || []
        callbacks.forEach(callback => callback(...args))
      }, delay);
    } else {
      const callbacks = this.events.get(event) || []
      callbacks.forEach(callback => callback(...args))
    }
  });

  // Enhanced SSH connection simulation
  async simulateSSHConnect(config: any): Promise<void> {
    const sessionId = config.id || `session-${Date.now()}`;

    try {
      // Create SSH session
      enhancedSSHMock.createSession(sessionId);
      enhancedSSHMock.connect(sessionId);

      // Set up SSH event forwarding
      this.setupSSHEventForwarding(sessionId);

      // Simulate connection success
      setTimeout(() => {
        this.emit('ssh_connected', {
          sessionId,
          status: 'connected',
        });
      }, this.calculateConnectionDelay(config));

    } catch (error) {
      setTimeout(() => {
        this.emit('ssh_error', {
          sessionId,
          message: error instanceof Error ? error.message : 'Connection failed',
          code: 'CONNECTION_FAILED',
        });
      }, this.calculateConnectionDelay(config));
    }
  }

  // Simulate terminal input with realistic command processing
  async simulateTerminalInput(sessionId: string, input: string): Promise<void> {
    try {
      // Handle special keys
      if (input === '\x03') { // Ctrl+C
        enhancedSSHMock.interrupt(sessionId);
        return;
      }

      if (input === '\r' || input === '\n') {
        // Process the current command
        const session = enhancedSSHMock.getSession(sessionId);
        if (session) {
          // Extract command from input buffer (simplified)
          const command = this.extractCommand(input);
          if (command) {
            const response = await enhancedSSHMock.executeCommand(sessionId, command);

            // Emit command output
            setTimeout(() => {
              this.emit('terminal_data', {
                sessionId,
                data: response + '\n$ ', // Add prompt
              });
            }, this.calculateCommandDelay(command));
          }
        }
        return;
      }

      // Echo input for regular characters
      setTimeout(() => {
        this.emit('terminal_data', {
          sessionId,
          data: input,
        });
      }, this.calculateNetworkDelay());

    } catch (error) {
      setTimeout(() => {
        this.emit('ssh_error', {
          sessionId,
          message: error instanceof Error ? error.message : 'Command execution failed',
          code: 'COMMAND_FAILED',
        });
      }, this.calculateNetworkDelay());
    }
  }

  // Simulate terminal resize
  simulateTerminalResize(sessionId: string, cols: number, rows: number): void {
    enhancedSSHMock.resize(sessionId, cols, rows);
  }

  // Network simulation methods
  setNetworkConditions(conditions: {
    latency?: number;
    packetLoss?: number;
    jitter?: number;
  }): void {
    this.networkSimulation = {
      ...this.networkSimulation,
      ...conditions,
    };
  }

  simulateNetworkInterruption(duration: number): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, duration);
  }

  // Utility methods
  private setupSSHEventForwarding(sessionId: string): void {
    enhancedSSHMock.on('data', (id: string, data: string) => {
      if (id === sessionId) {
        this.emit('terminal_data', { sessionId, data });
      }
    });

    enhancedSSHMock.on('disconnected', (id: string) => {
      if (id === sessionId) {
        this.emit('ssh_disconnected', { sessionId });
      }
    });

    enhancedSSHMock.on('interrupted', (id: string) => {
      if (id === sessionId) {
        this.emit('terminal_data', { sessionId, data: '\n$ ' });
      }
    });
  }

  private extractCommand(input: string): string {
    // Simplified command extraction
    // In a real implementation, this would maintain an input buffer
    return input.trim();
  }

  private calculateNetworkDelay(): number {
    const baseLatency = this.networkSimulation.latency;
    const jitter = this.networkSimulation.jitter;

    if (jitter > 0) {
      const variation = (Math.random() - 0.5) * 2 * jitter;
      return Math.max(0, baseLatency + variation);
    }

    return baseLatency;
  }

  private calculateConnectionDelay(config: any): number {
    // Simulate realistic connection times based on server type
    const baseDelay = 500; // Base connection time
    const hostDelay = config.hostname?.includes('slow') ? 2000 : 0;
    return baseDelay + hostDelay + this.calculateNetworkDelay();
  }

  private calculateCommandDelay(command: string): number {
    // Simulate realistic command execution times
    const commandDelays: Record<string, number> = {
      'ls': 50,
      'pwd': 20,
      'whoami': 20,
      'ps aux': 200,
      'top': 300,
      'ping': 1000,
      'find': 1500,
    };

    const baseDelay = commandDelays[command.split(' ')[0]] || 100;
    return baseDelay + this.calculateNetworkDelay();
  }

  private shouldSimulateNetworkIssue(): boolean {
    return (this.options.simulateNetworkIssues ?? false) &&
           Math.random() < (this.options.networkIssueRate || 0);
  }

  private logMessage(event: string, data: any): void {
    this.messageHistory.push({
      event,
      data,
      timestamp: Date.now(),
      sessionId: data?.sessionId,
    });

    // Keep only last 1000 messages
    if (this.messageHistory.length > 1000) {
      this.messageHistory = this.messageHistory.slice(-1000);
    }
  }

  // Testing utilities
  getMessageHistory(): MockSocketMessage[] {
    return [...this.messageHistory];
  }

  getMessagesForSession(sessionId: string): MockSocketMessage[] {
    return this.messageHistory.filter(msg => msg.sessionId === sessionId);
  }

  clearMessageHistory(): void {
    this.messageHistory = [];
  }

  // Reset for clean test state
  reset(): void {
    this.connected = false;
    this.messageHistory = [];
    enhancedSSHMock.clearSessions();
    this.emit.mockClear();
  }
}

// Factory function for creating enhanced socket mocks
export function createEnhancedSocketMock(options?: MockSocketOptions): EnhancedSocketMock {
  return new EnhancedSocketMock(options);
}

const mockSocketIO = {
  io: mockIo,
  MockSocket,
  EnhancedSocketMock,
  createEnhancedSocketMock,
}

export default mockSocketIO;
