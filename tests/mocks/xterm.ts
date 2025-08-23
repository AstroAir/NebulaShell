// Mock xterm.js for testing
export class MockTerminal {
  public cols = 80
  public rows = 24
  private eventHandlers: Map<string, Function[]> = new Map()
  private content = ''

  constructor(options?: any) {
    // Mock terminal options
  }

  open(element: HTMLElement) {
    // Mock opening terminal in DOM element
  }

  write(data: string) {
    this.content += data
  }

  writeln(data: string) {
    this.content += data + '\n'
  }

  clear() {
    this.content = ''
  }

  dispose() {
    this.eventHandlers.clear()
  }

  onData(callback: (data: string) => void) {
    this.addEventListener('data', callback)
  }

  onResize(callback: (size: { cols: number; rows: number }) => void) {
    this.addEventListener('resize', callback)
  }

  loadAddon(addon: any) {
    // Mock addon loading
  }

  focus() {
    // Mock focus
  }

  blur() {
    // Mock blur
  }

  selectAll() {
    // Mock select all
  }

  getSelection() {
    return 'mock selection'
  }

  clearSelection() {
    // Mock clear selection
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

export default {
  Terminal: MockTerminal,
  FitAddon: MockFitAddon,
  WebLinksAddon: MockWebLinksAddon,
}
