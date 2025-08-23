// Backend-specific Jest setup

// Mock localStorage for backend tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

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
