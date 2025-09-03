// Mock xterm.js for testing
export class MockTerminal {
  public cols = 80
  public rows = 24
  public element: HTMLElement
  private eventHandlers: Map<string, Function[]> = new Map()
  private content = ''

  constructor() {
    this.element = document.createElement('div')
    this.element.className = 'xterm'
  }

  // Create spies for all methods to track calls
  public write = jest.fn((data: string) => {
    this.content += data
  })

  public writeln = jest.fn((data: string) => {
    this.content += data + '\n'
  })

  public loadAddon = jest.fn((addon: any) => {
    // Mock addon loading - simulate successful addon loading
    if (addon && typeof addon.activate === 'function') {
      addon.activate(this);
    }
  })

  public clear = jest.fn(() => {
    this.content = ''
  })

  public dispose = jest.fn(() => {
    this.eventHandlers.clear()
    this.content = ''
    // Simulate proper cleanup
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  })

  public open = jest.fn((parent?: HTMLElement) => {
    // Mock opening terminal in DOM element
    if (parent && this.element) {
      parent.appendChild(this.element)
    }
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

  public onData = jest.fn((callback: (data: string) => void) => {
    this.addEventListener('data', callback)
  })

  public onResize = jest.fn((callback: (size: { cols: number; rows: number }) => void) => {
    this.addEventListener('resize', callback)
  })

  public onKey = jest.fn((callback: (event: any) => void) => {
    this.addEventListener('key', callback)
  })

  public onBinary = jest.fn((callback: (data: string) => void) => {
    this.addEventListener('binary', callback)
  })

  public onCursorMove = jest.fn((callback: () => void) => {
    this.addEventListener('cursormove', callback)
  })

  public onLineFeed = jest.fn((callback: () => void) => {
    this.addEventListener('linefeed', callback)
  })

  public onScroll = jest.fn((callback: (ydisp: number) => void) => {
    this.addEventListener('scroll', callback)
  })

  public onSelectionChange = jest.fn((callback: () => void) => {
    this.addEventListener('selectionchange', callback)
  })

  public onRender = jest.fn((callback: (event: any) => void) => {
    this.addEventListener('render', callback)
  })

  public onTitleChange = jest.fn((callback: (title: string) => void) => {
    this.addEventListener('titlechange', callback)
  })

  public onBell = jest.fn((callback: () => void) => {
    this.addEventListener('bell', callback)
  })

  public getSelection = jest.fn(() => {
    return 'mock selection'
  })

  public hasSelection = jest.fn(() => {
    return false
  })

  public clearSelection = jest.fn(() => {
    // Mock clear selection
  })

  public attachCustomKeyEventHandler = jest.fn(() => {
    // Mock custom key event handler
    return () => {
      // Mock disposal function
    }
  })

  public resize = jest.fn((cols: number, rows: number) => {
    this.cols = cols
    this.rows = rows
  })

  public reset = jest.fn(() => {
    this.content = ''
  })

  public scrollToBottom = jest.fn(() => {
    // Mock scroll to bottom
  })

  public scrollToTop = jest.fn(() => {
    // Mock scroll to top
  })

  // Test helper methods
  public simulateInput = jest.fn((data: string) => {
    // Simulate user input by triggering data event
    const callbacks = this.eventHandlers.get('data') || []
    callbacks.forEach(callback => callback(data))
  })

  public simulateKeyPress = jest.fn((key: string) => {
    // Simulate key press by triggering key event
    const callbacks = this.eventHandlers.get('key') || []
    callbacks.forEach(callback => callback({ key, domEvent: {} }))
  })

  // Helper methods for testing
  private addEventListener(event: string, callback: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(callback)
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
    this.onKey.mockClear()
    this.onBinary.mockClear()
    this.onCursorMove.mockClear()
    this.onLineFeed.mockClear()
    this.onScroll.mockClear()
    this.onSelectionChange.mockClear()
    this.onRender.mockClear()
    this.onTitleChange.mockClear()
    this.onBell.mockClear()
    this.getSelection.mockClear()
    this.hasSelection.mockClear()
    this.clearSelection.mockClear()
    this.attachCustomKeyEventHandler.mockClear()
    this.resize.mockClear()
    this.reset.mockClear()
    this.scrollToBottom.mockClear()
    this.scrollToTop.mockClear()
    this.simulateInput.mockClear()
    this.simulateKeyPress.mockClear()
    this.eventHandlers.clear()
    this.content = ''
  }
}

export class MockFitAddon {
  public fit = jest.fn(() => {
    // Mock fit functionality - simulate successful fit
  })

  public proposeDimensions = jest.fn(() => {
    return { cols: 80, rows: 24 }
  })

  public activate = jest.fn((terminal: any) => {
    // Mock activation
    this.terminal = terminal
  })

  public dispose = jest.fn(() => {
    // Mock disposal
  })

  private terminal: any
}

export class MockWebLinksAddon {
  public activate = jest.fn((terminal: any) => {
    // Mock activation
    this.terminal = terminal
  })

  public dispose = jest.fn(() => {
    // Mock disposal
  })

  private terminal: any
}

export class MockSearchAddon {
  public findNext = jest.fn(() => {
    return false // Mock no results found
  })

  public findPrevious = jest.fn(() => {
    return false // Mock no results found
  })

  public activate = jest.fn((terminal: any) => {
    // Mock activation
    this.terminal = terminal
  })

  public dispose = jest.fn(() => {
    // Mock disposal
  })

  private terminal: any
}

export class MockUnicode11Addon {
  public activate = jest.fn((terminal: any) => {
    // Mock activation
    this.terminal = terminal
  })

  public dispose = jest.fn(() => {
    // Mock disposal
  })

  private terminal: any
}

const mockXterm = {
  Terminal: MockTerminal,
  FitAddon: MockFitAddon,
  WebLinksAddon: MockWebLinksAddon,
  SearchAddon: MockSearchAddon,
  Unicode11Addon: MockUnicode11Addon,
}

export default mockXterm;
