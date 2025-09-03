// Mock for node-ssh module
const mockConnect = jest.fn().mockImplementation(async (config) => {
  // Simulate different connection scenarios based on hostname
  if (config.host === 'nonexistent.example.com') {
    throw new Error('Connection failed');
  }
  if (config.host && config.host.includes('test.example.com')) {
    // Simulate successful connection
    return Promise.resolve();
  }
  // Default to successful connection
  return Promise.resolve();
});

const mockDispose = jest.fn().mockResolvedValue(undefined);

const mockRequestShell = jest.fn().mockResolvedValue({
  write: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
});

const mockExec = jest.fn().mockResolvedValue({ 
  stdout: 'mock output', 
  stderr: '', 
  code: 0 
});

const NodeSSH = jest.fn().mockImplementation(() => ({
  connect: mockConnect,
  dispose: mockDispose,
  requestShell: mockRequestShell,
  exec: mockExec,
  putFile: jest.fn().mockResolvedValue(undefined),
  getFile: jest.fn().mockResolvedValue(undefined),
  putDirectory: jest.fn().mockResolvedValue(undefined),
  getDirectory: jest.fn().mockResolvedValue(undefined),
  connection: {
    on: jest.fn(),
    end: jest.fn(),
  },
}));

module.exports = {
  NodeSSH,
  // Export individual mocks for testing
  mockConnect,
  mockDispose,
  mockRequestShell,
  mockExec,
};
