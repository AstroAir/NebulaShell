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

// Mock performance.now for consistent timing in tests
global.performance = global.performance || {};
global.performance.now = jest.fn(() => Date.now());

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
