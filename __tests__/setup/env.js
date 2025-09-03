// Environment setup for tests
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.UPLOAD_DIR = '/tmp/test-uploads';

// Suppress console warnings in tests unless explicitly testing them
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
     args[0].includes('Warning: An invalid form control') ||
     args[0].includes('componentWillReceiveProps has been renamed'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Performance.now mock is handled in jest.setup.js to avoid conflicts

// Mock crypto for ID generation
global.crypto = global.crypto || {};
global.crypto.getRandomValues = jest.fn((arr) => {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
});

// Mock TextEncoder/TextDecoder for WebSocket tests
global.TextEncoder = global.TextEncoder || class TextEncoder {
  encode(str) {
    return new Uint8Array(str.split('').map(char => char.charCodeAt(0)));
  }
};

global.TextDecoder = global.TextDecoder || class TextDecoder {
  decode(arr) {
    return String.fromCharCode.apply(null, arr);
  }
};

// Global test timeout to prevent hanging
jest.setTimeout(30000);

// Add global cleanup to prevent hanging tests
let testTimeouts = new Set();

global.setTestTimeout = (callback, delay) => {
  const timeoutId = setTimeout(callback, delay);
  testTimeouts.add(timeoutId);
  return timeoutId;
};

global.clearTestTimeout = (timeoutId) => {
  clearTimeout(timeoutId);
  testTimeouts.delete(timeoutId);
};

// Set up React testing environment
global.IS_REACT_ACT_ENVIRONMENT = true;

// Global cleanup function for tests to use
global.cleanupTestTimeouts = () => {
  testTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  testTimeouts.clear();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
};
