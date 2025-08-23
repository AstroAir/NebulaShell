// Mock Socket.IO for testing
export class MockSocket {
  private events: Map<string, Function[]> = new Map()
  public connected = false
  public id = 'mock-socket-id'

  on(event: string, callback: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)
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
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.events.get(event) || []
    callbacks.forEach(callback => callback(...args))
  }

  connect() {
    this.connected = true
    this.emit('connect')
  }

  disconnect() {
    this.connected = false
    this.emit('disconnect')
  }

  close() {
    this.disconnect()
  }

  // Simulate server events
  simulateServerEvent(event: string, data: any) {
    this.emit(event, data)
  }
}

export const mockIo = jest.fn(() => new MockSocket())

export default {
  io: mockIo,
  MockSocket,
}
