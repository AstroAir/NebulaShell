// Mock xterm.js for testing
export class MockTerminal {
  public cols = 80
  public rows = 24
  private eventHandlers: Map<string, Function[]> = new Map()
  private content = ''

  // Create spies for all methods to track calls
  public write = jest.fn((data: string) => {
    this.content += data
  })

  public writeln = jest.fn((data: string) => {
    this.content += data + '\n'
  })

  public clear = jest.fn(() => {
    this.content = ''
  })

  public dispose = jest.fn(() => {
    this.eventHandlers.clear()
  })

  public open = jest.fn(() => {
    // Mock opening terminal in DOM element
  })

  public focus = jest.fn(() => {
    // Mock focus
  })

  public blur = jest.fn(() => {
    // Mock blur
  })

  public selectAll = jest.fn(() => {
    // Mock select all
  })

  public loadAddon = jest.fn(() => {
    // Mock addon loading
  })

  public onData = jest.fn((callback: (data: string) => void) => {
    this.addEventListener('data', callback)
  })

  public onResize = jest.fn((callback: (size: { cols: number; rows: number }) => void) => {
    this.addEventListener('resize', callback)
  })

  constructor() {
    // Mock terminal options
  }

  getSelection() {
    return 'mock selection'
  }

  hasSelection() {
    return false
  }

  clearSelection() {
    // Mock clear selection
  }

  attachCustomKeyEventHandler() {
    // Mock custom key event handler
    return () => {
      // Mock disposal function
    }
  }

  // Helper methods for testing
  private addEventListener(event: string, callback: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(callback)
  }

  // Simulate user input
  simulateInput(data: string) {
    const callbacks = this.eventHandlers.get('data') || []
    callbacks.forEach(callback => callback(data))
  }

  // Simulate terminal resize
  simulateResize(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    const callbacks = this.eventHandlers.get('resize') || []
    callbacks.forEach(callback => callback({ cols, rows }))
  }

  // Get current content for testing
  getContent() {
    return this.content
  }

  // Reset all mocks for clean test state
  resetMocks() {
    this.write.mockClear()
    this.writeln.mockClear()
    this.clear.mockClear()
    this.dispose.mockClear()
    this.open.mockClear()
    this.focus.mockClear()
    this.blur.mockClear()
    this.selectAll.mockClear()
    this.loadAddon.mockClear()
    this.onData.mockClear()
    this.onResize.mockClear()
    this.eventHandlers.clear()
    this.content = ''
  }
}

export class MockFitAddon {
  fit() {
    // Mock fit functionality
  }

  proposeDimensions() {
    return { cols: 80, rows: 24 }
  }
}

export class MockWebLinksAddon {
  // Mock web links addon
}

const mockXterm = {
  Terminal: MockTerminal,
  FitAddon: MockFitAddon,
  WebLinksAddon: MockWebLinksAddon,
}

export default mockXterm;
