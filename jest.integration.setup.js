import '@testing-library/jest-dom'

// Minimal setup for integration tests - no global mocks
// This allows integration tests to use real implementations

// Mock only what's absolutely necessary for the test environment
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock scrollTo
window.scrollTo = jest.fn()

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.sessionStorage = sessionStorageMock

// Mock fetch
global.fetch = jest.fn()

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Mock HTMLCanvasElement for xterm.js
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
}))

// Mock xterm.js Terminal to avoid canvas issues
jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    write: jest.fn(),
    writeln: jest.fn(),
    clear: jest.fn(),
    reset: jest.fn(),
    resize: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    dispose: jest.fn(),
    onData: jest.fn(),
    onResize: jest.fn(),
    loadAddon: jest.fn(),
    element: document.createElement('div'),
    cols: 80,
    rows: 24,
  })),
}))

// Mock xterm addons
jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    activate: jest.fn(),
    dispose: jest.fn(),
    fit: jest.fn(),
  })),
}))

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn().mockImplementation(() => ({
    activate: jest.fn(),
    dispose: jest.fn(),
  })),
}))

// Note: @xterm/addon-search is not used in this project
