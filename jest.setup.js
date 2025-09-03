require('@testing-library/jest-dom')
const { toHaveNoViolations } = require('jest-axe')

// Import type definitions for jest-axe
/// <reference path="./__tests__/types/jest-axe.d.ts" />

// Set React act environment for better test behavior
global.IS_REACT_ACT_ENVIRONMENT = true

// Extend Jest matchers with jest-axe
expect.extend(toHaveNoViolations)

// WebSocket is mocked per-test in collaboration tests

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
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    this.unobserve = jest.fn();
  }

  observe() {
    // Mock observe
  }

  disconnect() {
    // Mock disconnect
  }

  unobserve() {
    // Mock unobserve
  }
};

// Mock PerformanceObserver for performance monitoring
global.PerformanceObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock performance.now for timing tests
let mockTime = 0;
global.performance = {
  now: jest.fn(() => {
    mockTime += 10; // Simulate 10ms increments
    return mockTime;
  }),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
};

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

// Add Web API polyfills for Node.js environment
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init.method || 'GET';
      this.headers = new Map(Object.entries(init.headers || {}));
      this.body = init.body || null;
      this._json = null;
      this._formData = null;
    }

    async json() {
      if (this._json) return this._json;
      if (typeof this.body === 'string') {
        this._json = JSON.parse(this.body);
        return this._json;
      }
      return {};
    }

    async formData() {
      if (this._formData) return this._formData;
      return new FormData();
    }

    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: Object.fromEntries(this.headers),
        body: this.body
      });
    }
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Map(Object.entries(init.headers || {}));
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }

    clone() {
      return new Response(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: Object.fromEntries(this.headers)
      });
    }

    // Static methods for Next.js compatibility
    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      });
    }

    static redirect(url, status = 302) {
      return new Response(null, {
        status,
        headers: {
          Location: url
        }
      });
    }

    static error() {
      return new Response(null, { status: 500 });
    }
  };
}

// Always override FormData to ensure our polyfill is used
global.FormData = class FormData {
    constructor() {
      this._data = new Map();
    }

    append(name, value, filename) {
      if (!this._data.has(name)) {
        this._data.set(name, []);
      }

      // Handle File objects specially to preserve metadata
      if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'File') {
        // Convert File to a string that includes metadata for the upload route to parse
        const fileContent = value.stream ? '[File object - stream not accessible]' : value.toString();
        const metadataString = `MOCK_FILE_|${value.name}|${value.type}|${value.size}|${fileContent}`;
        this._data.get(name).push({ value: metadataString, filename: filename || value.name });
      } else {
        // Store other values directly without transformation
        this._data.get(name).push({ value, filename });
      }
    }

    get(name) {
      const values = this._data.get(name);
      if (!values || values.length === 0) return null;
      const entry = values[0];
      return entry.value;
    }

    getAll(name) {
      const values = this._data.get(name);
      return values ? values.map(v => v.value) : [];
    }

    has(name) {
      return this._data.has(name);
    }

    delete(name) {
      this._data.delete(name);
    }

    set(name, value, filename) {
      // Store the value directly without any transformation
      this._data.set(name, [{ value, filename }]);
    }

    entries() {
      const entries = [];
      for (const [name, values] of this._data) {
        for (const { value } of values) {
          // Don't convert File objects to strings
          entries.push([name, value]);
        }
      }
      return entries[Symbol.iterator]();
    }

    keys() {
      return this._data.keys();
    }

    values() {
      const values = [];
      for (const [, valueArray] of this._data) {
        for (const { value } of valueArray) {
          values.push(value);
        }
      }
      return values[Symbol.iterator]();
    }

    [Symbol.iterator]() {
      return this.entries();
    }
  };

if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits, name, options = {}) {
      this.bits = bits;
      const calculatedSize = bits.reduce((size, bit) => size + (bit.length || bit.byteLength || 0), 0);

      // Set properties directly first
      this.name = name;
      this.type = options.type || '';
      this.size = calculatedSize;
      this.lastModified = options.lastModified || Date.now();

      // Then define them as non-writable properties to match File API
      Object.defineProperty(this, 'type', {
        value: options.type || '',
        writable: false,
        enumerable: true,
        configurable: true
      });

      Object.defineProperty(this, 'name', {
        value: name,
        writable: false,
        enumerable: true,
        configurable: true
      });

      Object.defineProperty(this, 'size', {
        value: calculatedSize,
        writable: false,
        enumerable: true,
        configurable: true
      });

      Object.defineProperty(this, 'lastModified', {
        value: options.lastModified || Date.now(),
        writable: false,
        enumerable: true,
        configurable: true
      });
    }

    async text() {
      return this.bits.join('');
    }

    async arrayBuffer() {
      const text = await this.text();
      return new TextEncoder().encode(text).buffer;
    }

    stream() {
      // Simple stream mock
      return {
        getReader() {
          let done = false;
          return {
            read() {
              if (done) {
                return Promise.resolve({ done: true });
              }
              done = true;
              return Promise.resolve({
                done: false,
                value: new TextEncoder().encode(this.bits.join(''))
              });
            }
          };
        }
      };
    }
  };
}

if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || '';
      this.size = parts.reduce((size, part) => size + (part.length || part.byteLength || 0), 0);
    }

    async text() {
      return this.parts.join('');
    }

    async arrayBuffer() {
      const text = await this.text();
      return new TextEncoder().encode(text).buffer;
    }

    slice(start = 0, end = this.size, contentType = '') {
      const text = this.parts.join('');
      const sliced = text.slice(start, end);
      return new Blob([sliced], { type: contentType });
    }
  };
}

// Global cleanup tracking
global.testTimeouts = new Set();
global.testIntervals = new Set();

// Override setTimeout and setInterval to track them
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

global.setTimeout = (fn, delay, ...args) => {
  const id = originalSetTimeout(fn, delay, ...args);
  global.testTimeouts.add(id);
  return id;
};

global.setInterval = (fn, delay, ...args) => {
  const id = originalSetInterval(fn, delay, ...args);
  global.testIntervals.add(id);
  return id;
};

global.clearTimeout = (id) => {
  global.testTimeouts.delete(id);
  return originalClearTimeout(id);
};

global.clearInterval = (id) => {
  global.testIntervals.delete(id);
  return originalClearInterval(id);
};

// Global cleanup function
global.cleanupTestTimeouts = () => {
  global.testTimeouts.forEach(id => originalClearTimeout(id));
  global.testIntervals.forEach(id => originalClearInterval(id));
  global.testTimeouts.clear();
  global.testIntervals.clear();
};

// Clear all mocks and cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  // Clean up any remaining timeouts/intervals
  global.cleanupTestTimeouts();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
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

// Mock xterm.js - both static and dynamic imports
const mockXtermModules = () => {
  const { MockTerminal, MockFitAddon, MockWebLinksAddon } = require('./__tests__/mocks/xterm')
  return {
    Terminal: jest.fn().mockImplementation(() => new MockTerminal()),
    FitAddon: jest.fn().mockImplementation(() => new MockFitAddon()),
    WebLinksAddon: jest.fn().mockImplementation(() => new MockWebLinksAddon()),
  }
}

// Static imports
jest.mock('@xterm/xterm', () => {
  const mocks = mockXtermModules()
  return {
    Terminal: mocks.Terminal,
  }
})

jest.mock('@xterm/addon-fit', () => {
  const mocks = mockXtermModules()
  return {
    FitAddon: mocks.FitAddon,
  }
})

jest.mock('@xterm/addon-web-links', () => {
  const mocks = mockXtermModules()
  return {
    WebLinksAddon: mocks.WebLinksAddon,
  }
})

// Mock dynamic imports for XTerm modules
const originalImport = global.import || (() => Promise.reject(new Error('import() not supported')))
global.import = jest.fn((moduleName) => {
  if (moduleName === '@xterm/xterm') {
    const mocks = mockXtermModules()
    return Promise.resolve({
      Terminal: mocks.Terminal,
    })
  }
  if (moduleName === '@xterm/addon-fit') {
    const mocks = mockXtermModules()
    return Promise.resolve({
      FitAddon: mocks.FitAddon,
    })
  }
  if (moduleName === '@xterm/addon-web-links') {
    const mocks = mockXtermModules()
    return Promise.resolve({
      WebLinksAddon: mocks.WebLinksAddon,
    })
  }
  // Fall back to original import for other modules
  return originalImport(moduleName)
})



// Socket.IO client is mocked in individual test files

// Global test utilities - ResizeObserver is already defined above, remove duplicate

// Mock window.matchMedia with proper implementation
const mockMatchMedia = jest.fn().mockImplementation(query => {
  const mediaQuery = {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };

  // Set matches based on common queries for testing
  if (query.includes('max-width: 768px')) {
    mediaQuery.matches = false; // Desktop by default
  } else if (query.includes('prefers-reduced-motion: reduce')) {
    mediaQuery.matches = false; // No reduced motion by default
  }

  return mediaQuery;
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Ensure global.matchMedia is also available for Node.js environment
global.matchMedia = mockMatchMedia;

// Socket.IO client is mocked in individual test files

// Socket.IO mocks are handled in individual test files

// Mock the accessibility hooks and contexts
jest.mock('@/components/accessibility/AccessibilityProvider', () => ({
  AccessibilityProvider: ({ children }) => children,
  useAccessibility: () => ({
    isReducedMotion: false,
    announcements: [],
    announce: jest.fn(),
    setFocusVisible: jest.fn(),
    isFocusVisible: false,
  }),
}));

// Mock the responsive layout hooks and contexts
jest.mock('@/components/layout/ResponsiveLayoutProvider', () => ({
  ResponsiveLayoutProvider: ({ children }) => children,
  useResponsiveLayout: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    breakpoint: 'desktop',
  }),
}));

// Mock the terminal context with dynamic state
const mockTerminalState = {
  socket: null,
  isConnected: false,
  connectionStatus: { status: 'disconnected' },
  sessionId: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendInput: jest.fn(),
  resize: jest.fn(),
  sendCommand: jest.fn(),
  history: [],
  currentDirectory: '/home/user',
  historyManager: {
    addCommand: jest.fn(),
    getHistory: jest.fn(() => []),
    clearHistory: jest.fn(),
  },
  autoCompleteManager: {
    getSuggestions: jest.fn(() => []),
  },
  aliasesManager: {
    getAliases: jest.fn(() => ({})),
  },
  commandProcessor: {
    processCommand: jest.fn(),
  },
  settingsManager: {
    getSettings: jest.fn(() => ({})),
  },
  features: {
    historyEnabled: true,
    autoCompleteEnabled: true,
    aliasesEnabled: true,
    enhancedFeaturesEnabled: true,
  },
  toggleFeature: jest.fn(),
  refreshFeatureStates: jest.fn(),
};

jest.mock('@/components/terminal/TerminalContext', () => ({
  TerminalProvider: ({ children }) => children,
  useTerminal: () => mockTerminalState,
  __mockTerminalState: mockTerminalState, // Export for test manipulation
}));

// Mock the responsive hook
jest.mock('@/hooks/use-responsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: false,
    breakpoints: {
      sm: true,
      md: true,
      lg: true,
      xl: false,
      '2xl': false,
    },
  }),
  useViewport: () => ({
    width: 1024,
    height: 768,
  }),
  useMediaQuery: jest.fn(() => false),
  useBreakpoint: jest.fn(() => true),
  getResponsiveClasses: jest.fn(() => ''),
}));

// Mock Headers for API tests
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      this._headers = new Map();
      if (init) {
        if (init instanceof Headers) {
          for (const [key, value] of init.entries()) {
            this._headers.set(key.toLowerCase(), value);
          }
        } else if (Array.isArray(init)) {
          for (const [key, value] of init) {
            this._headers.set(key.toLowerCase(), value);
          }
        } else if (typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this._headers.set(key.toLowerCase(), value);
          }
        }
      }
    }

    append(name, value) {
      const existing = this._headers.get(name.toLowerCase());
      this._headers.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
    }

    delete(name) {
      this._headers.delete(name.toLowerCase());
    }

    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }

    has(name) {
      return this._headers.has(name.toLowerCase());
    }

    set(name, value) {
      this._headers.set(name.toLowerCase(), value);
    }

    entries() {
      return this._headers.entries();
    }

    keys() {
      return this._headers.keys();
    }

    values() {
      return this._headers.values();
    }

    [Symbol.iterator]() {
      return this._headers.entries();
    }
  };
}

// Mock TextEncoder/TextDecoder for API tests
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input = '') {
      const bytes = [];
      for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code < 0x80) {
          bytes.push(code);
        } else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else {
          bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
      }
      return new Uint8Array(bytes);
    }
  };
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(input) {
      if (!input) return '';
      let result = '';
      for (let i = 0; i < input.length; i++) {
        result += String.fromCharCode(input[i]);
      }
      return result;
    }
  };
}

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

  // Final cleanup of all resources
  global.cleanupTestTimeouts();

  // Restore original timer functions
  global.setTimeout = originalSetTimeout;
  global.setInterval = originalSetInterval;
  global.clearTimeout = originalClearTimeout;
  global.clearInterval = originalClearInterval;

  // Force final garbage collection
  if (global.gc) {
    global.gc();
  }
})

// Backend-specific mocks for unified configuration
// localStorage is already mocked above

// Mock ssh2 library to prevent WASM loading issues
jest.mock('ssh2', () => {
  const EventEmitter = require('events');

  class MockClient extends EventEmitter {
    connect(config) {
      setTimeout(() => this.emit('ready'), 10);
      return this;
    }

    end() {
      setTimeout(() => this.emit('close'), 10);
      return this;
    }

    destroy() {
      setTimeout(() => this.emit('close'), 10);
      return this;
    }

    shell(options, callback) {
      const mockStream = new EventEmitter();
      mockStream.write = jest.fn();
      mockStream.end = jest.fn();
      mockStream.setWindow = jest.fn();
      setTimeout(() => callback(null, mockStream), 10);
    }

    exec(command, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      const mockStream = new EventEmitter();
      mockStream.write = jest.fn();
      mockStream.end = jest.fn();
      setTimeout(() => {
        callback(null, mockStream);
        mockStream.emit('close', 0, null);
      }, 10);
    }

    sftp(callback) {
      const mockSftp = new EventEmitter();
      mockSftp.readdir = jest.fn((path, cb) => cb(null, []));
      mockSftp.stat = jest.fn((path, cb) => cb(null, { isDirectory: () => false, isFile: () => true }));
      mockSftp.readFile = jest.fn((path, cb) => cb(null, Buffer.from('test')));
      mockSftp.writeFile = jest.fn((path, data, cb) => cb(null));
      mockSftp.mkdir = jest.fn((path, cb) => cb(null));
      mockSftp.rmdir = jest.fn((path, cb) => cb(null));
      mockSftp.unlink = jest.fn((path, cb) => cb(null));
      mockSftp.rename = jest.fn((oldPath, newPath, cb) => cb(null));
      mockSftp.end = jest.fn();
      setTimeout(() => callback(null, mockSftp), 10);
    }
  }

  return {
    Client: MockClient,
    utils: {
      parseKey: jest.fn(() => ({ type: 'ssh-rsa', comment: 'test' })),
      genPublicKey: jest.fn(() => ({ type: 'ssh-rsa', data: Buffer.from('test') })),
    }
  };
});

// node-ssh is mocked in individual test files

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
