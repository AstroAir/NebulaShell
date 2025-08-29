require('@testing-library/jest-dom')

// Set React act environment for better test behavior
global.IS_REACT_ACT_ENVIRONMENT = true

// Mock WebSocket for collaboration tests
global.WebSocket = jest.fn(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock File API for file transfer tests
global.File = class MockFile {
  constructor(parts, filename, properties) {
    this.name = filename;
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    this.type = properties?.type || '';
    this.lastModified = Date.now();
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }

  text() {
    return Promise.resolve('mock file content');
  }
};

// Mock FileReader for file operations
global.FileReader = class MockFileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.onloadstart = null;
    this.onloadend = null;
    this.onprogress = null;
  }

  readAsText(file) {
    setTimeout(() => {
      this.result = 'mock file content';
      this.readyState = 2;
      if (this.onload) this.onload({ target: this });
    }, 0);
  }

  readAsArrayBuffer(file) {
    setTimeout(() => {
      this.result = new ArrayBuffer(file.size || 0);
      this.readyState = 2;
      if (this.onload) this.onload({ target: this });
    }, 0);
  }

  abort() {
    this.readyState = 2;
    if (this.onabort) this.onabort({ target: this });
  }
};

// Mock URL.createObjectURL for file downloads
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock IntersectionObserver for performance monitoring
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock PerformanceObserver for performance monitoring
global.PerformanceObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('mock clipboard content')),
  },
});

// Mock matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock fetch for API tests
global.fetch = jest.fn();

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock xterm.js
jest.mock('@xterm/xterm', () => {
  const { MockTerminal } = require('./tests/mocks/xterm')
  return {
    Terminal: jest.fn().mockImplementation(() => new MockTerminal()),
  }
})

jest.mock('@xterm/addon-fit', () => {
  const { MockFitAddon } = require('./tests/mocks/xterm')
  return {
    FitAddon: jest.fn().mockImplementation(() => new MockFitAddon()),
  }
})

jest.mock('@xterm/addon-web-links', () => {
  const { MockWebLinksAddon } = require('./tests/mocks/xterm')
  return {
    WebLinksAddon: jest.fn().mockImplementation(() => new MockWebLinksAddon()),
  }
})

// Mock Socket.IO client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    close: jest.fn(),
    connected: false,
    id: 'mock-socket-id',
  })),
}))

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
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

// Suppress console errors and warnings in tests unless explicitly testing them
const originalError = console.error
const originalWarn = console.warn
beforeAll(() => {
  console.error = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : ''
    const errorObj = typeof args[0] === 'object' ? args[0] : null

    // Suppress React act() warnings and component suspension warnings
    if (
      message.includes('Warning: ReactDOM.render is no longer supported') ||
      message.includes('An update to') && message.includes('inside a test was not wrapped in act') ||
      message.includes('A component suspended inside an `act` scope') ||
      message.includes('When testing, code that causes React state updates should be wrapped into act')
    ) {
      return
    }

    // Suppress expected SSH error messages in tests (these are legitimate test scenarios)
    if (message.includes('SSH error:') ||
        message.includes('Socket not connected') ||
        (errorObj && errorObj.message && (errorObj.code || errorObj.sessionId)) ||
        (args.length > 0 && typeof args[0] === 'object' && args[0] !== null &&
         (args[0].message || args[0].code || args[0].sessionId))) {
      return
    }

    originalError.call(console, ...args)
  }

  console.warn = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : ''

    // Suppress expected terminal resize failure warnings in tests
    if (message.includes('Terminal resize failed:')) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Backend-specific mocks for unified configuration
// localStorage is already mocked above

// Mock node-ssh
jest.mock('node-ssh', () => ({
  NodeSSH: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    dispose: jest.fn(),
    requestShell: jest.fn(),
    exec: jest.fn(),
    putFile: jest.fn(),
    getFile: jest.fn(),
    putDirectory: jest.fn(),
    getDirectory: jest.fn(),
    connection: {
      on: jest.fn(),
      end: jest.fn(),
    },
  })),
}))

// Mock ssh2-sftp-client
jest.mock('ssh2-sftp-client', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    mkdir: jest.fn(),
    rmdir: jest.fn(),
    exists: jest.fn(),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
  }))
})

// Mock crypto-js
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn(() => ({ toString: () => 'encrypted-data' })),
    decrypt: jest.fn(() => ({ toString: () => 'decrypted-data' })),
  },
  enc: {
    Utf8: {
      stringify: jest.fn(data => data),
      parse: jest.fn(data => data),
    },
  },
}))

// Mock node-forge
jest.mock('node-forge', () => ({
  pki: {
    privateKeyFromPem: jest.fn(),
    publicKeyFromPem: jest.fn(),
    certificateFromPem: jest.fn(),
  },
  ssh: {
    privateKeyToOpenSSH: jest.fn(),
    publicKeyToOpenSSH: jest.fn(),
  },
}))

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}))

// Mock fs operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}))

// Mock path operations
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
}))

// Global test setup
beforeEach(() => {
  jest.clearAllMocks()
})

// Increase timeout for integration tests
jest.setTimeout(30000)
