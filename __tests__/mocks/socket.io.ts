// Mock Socket.IO for testing
export class MockSocket {
  private events: Map<string, Function[]> = new Map()
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

const mockSocketIO = {
  io: mockIo,
  MockSocket,
}

export default mockSocketIO;
