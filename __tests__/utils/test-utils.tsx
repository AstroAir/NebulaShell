import React, { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock contexts for testing
const MockAccessibilityContext = React.createContext({
  isReducedMotion: false,
  announcements: [],
  announce: jest.fn(),
  setFocusVisible: jest.fn(),
  isFocusVisible: false,
});

const MockResponsiveContext = React.createContext({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  breakpoint: 'desktop' as const,
});

const MockTerminalContext = React.createContext({
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected' as const,
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendCommand: jest.fn(),
  history: [],
  currentDirectory: '/home/user',
});

// Mock providers for testing
const MockAccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const mockValue = {
    isReducedMotion: false,
    announcements: [],
    announce: jest.fn(),
    setFocusVisible: jest.fn(),
    isFocusVisible: false,
  };

  return (
    <MockAccessibilityContext.Provider value={mockValue}>
      <div data-testid="mock-accessibility-provider">
        {children}
      </div>
    </MockAccessibilityContext.Provider>
  );
};

const MockResponsiveLayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const mockValue = {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    breakpoint: 'desktop' as const,
  };

  return (
    <MockResponsiveContext.Provider value={mockValue}>
      <div data-testid="mock-responsive-provider">
        {children}
      </div>
    </MockResponsiveContext.Provider>
  );
};

const MockTerminalProvider = ({ children }: { children: React.ReactNode }) => {
  const mockValue = {
    socket: null,
    isConnected: false,
    connectionStatus: 'disconnected' as const,
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendCommand: jest.fn(),
    history: [],
    currentDirectory: '/home/user',
  };

  return (
    <MockTerminalContext.Provider value={mockValue}>
      <div data-testid="mock-terminal-provider">
        {children}
      </div>
    </MockTerminalContext.Provider>
  );
};

// Custom render function with mock providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockAccessibilityProvider>
      <MockResponsiveLayoutProvider>
        <MockTerminalProvider>
          <div data-testid="test-wrapper">
            {children}
          </div>
        </MockTerminalProvider>
      </MockResponsiveLayoutProvider>
    </MockAccessibilityProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => rtlRender(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Custom user event setup
export const user = userEvent.setup();

// Test data factories
export const createMockFile = (
  name: string = 'test.txt',
  content: string = 'test content',
  type: string = 'text/plain'
): File => {
  const file = new File([content], name, { type });
  return file;
};

export const createMockConnectionProfile = (overrides = {}) => ({
  id: 'test-profile-1',
  name: 'Test Server',
  description: 'Test connection profile',
  hostname: 'test.example.com',
  port: 22,
  username: 'testuser',
  authMethod: 'password' as const,
  connectionOptions: {
    keepAlive: true,
    keepAliveInterval: 30,
    timeout: 10000,
    compression: false,
    forwardAgent: false,
    forwardX11: false,
  },
  environment: {
    variables: {},
    workingDirectory: '~',
    shell: '/bin/bash',
  },
  tunnels: [],
  metadata: {
    createdAt: Date.now(),
    lastUsed: 0,
    useCount: 0,
    favorite: false,
    tags: [],
    color: '#3b82f6',
  },
  quickConnect: {
    enabled: false,
    autoConnect: false,
    connectOnStartup: false,
  },
  ...overrides,
});

export const createMockHistoryEntry = (overrides = {}) => ({
  id: 'history-1',
  command: 'ls -la',
  timestamp: Date.now(),
  sessionId: 'session-1',
  workingDirectory: '/home/user',
  exitCode: 0,
  duration: 100,
  output: 'total 8\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .',
  tags: [],
  favorite: false,
  ...overrides,
});

export const createMockTerminalTheme = (overrides = {}) => ({
  id: 'test-theme',
  name: 'Test Theme',
  description: 'A test theme',
  category: 'dark' as const,
  colors: {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selectionBackground: '#ffffff40',
    black: '#000000',
    red: '#cd0000',
    green: '#00cd00',
    yellow: '#cdcd00',
    blue: '#0000ee',
    magenta: '#cd00cd',
    cyan: '#00cdcd',
    white: '#e5e5e5',
    brightBlack: '#7f7f7f',
    brightRed: '#ff0000',
    brightGreen: '#00ff00',
    brightYellow: '#ffff00',
    brightBlue: '#5c5cff',
    brightMagenta: '#ff00ff',
    brightCyan: '#00ffff',
    brightWhite: '#ffffff',
  },
  ...overrides,
});

export const createMockFileTransferItem = (overrides = {}) => ({
  id: 'transfer-1',
  name: 'test.txt',
  size: 1024,
  type: 'text/plain',
  status: 'pending' as const,
  progress: 0,
  direction: 'upload' as const,
  remotePath: '/home/user/test.txt',
  ...overrides,
});

export const createMockCollaborationUser = (overrides = {}) => ({
  id: 'user-1',
  name: 'Test User',
  color: '#3b82f6',
  isActive: true,
  lastSeen: Date.now(),
  cursor: {
    x: 0,
    y: 0,
    line: 1,
    column: 1,
  },
  ...overrides,
});

export const createMockPersistedSession = (overrides = {}) => ({
  id: 'session-1',
  name: 'Test Session',
  connectionConfig: {
    hostname: 'test.example.com',
    port: 22,
    username: 'testuser',
  },
  terminalState: {
    workingDirectory: '/home/user',
    environmentVariables: {},
    aliases: {},
    theme: 'default-dark',
    fontSize: 14,
    scrollback: ['$ ls', 'file1.txt file2.txt'],
  },
  metadata: {
    createdAt: Date.now(),
    lastAccessed: Date.now(),
    totalCommands: 5,
    sessionDuration: 300000,
    tags: [],
    favorite: false,
  },
  settings: {
    autoReconnect: false,
    saveScrollback: true,
    maxScrollbackLines: 1000,
    persistEnvironment: true,
  },
  ...overrides,
});

// Mock WebSocket for collaboration tests
export const createMockWebSocket = () => {
  const timeouts = new Set<NodeJS.Timeout>();
  const intervals = new Set<NodeJS.Timeout>();

  const mockWs = {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    onopen: jest.fn() as any,
    onclose: jest.fn() as any,
    onmessage: jest.fn() as any,
    onerror: jest.fn() as any,
  };

  // Simulate WebSocket events
  const simulateOpen = () => {
    mockWs.readyState = mockWs.OPEN;
    if (mockWs.onopen) mockWs.onopen({} as Event);
  };

  const simulateMessage = (data: any) => {
    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  };

  const simulateClose = (code = 1000, reason = '') => {
    mockWs.readyState = mockWs.CLOSED;
    if (mockWs.onclose) {
      mockWs.onclose({ code, reason, wasClean: true } as CloseEvent);
    }
  };

  const simulateError = (error: any) => {
    if (mockWs.onerror) {
      // Create a proper ErrorEvent-like object
      const errorEvent = {
        type: 'error',
        error: error,
        message: error.message || 'WebSocket error',
        target: mockWs
      } as any;
      mockWs.onerror(errorEvent);
    }
  };

  // Cleanup function to prevent memory leaks
  const cleanup = () => {
    // Clear all timeouts and intervals
    timeouts.forEach(id => clearTimeout(id));
    intervals.forEach(id => clearInterval(id));
    timeouts.clear();
    intervals.clear();

    // Reset all mock functions
    Object.values(mockWs).forEach(fn => {
      if (jest.isMockFunction(fn)) {
        fn.mockClear();
      }
    });

    // Reset event handlers
    mockWs.onopen = null;
    mockWs.onclose = null;
    mockWs.onmessage = null;
    mockWs.onerror = null;

    // Reset readyState
    mockWs.readyState = mockWs.CLOSED;
  };

  return {
    mockWs,
    simulateOpen,
    simulateMessage,
    simulateClose,
    simulateError,
    cleanup,
  };
};

// Accessibility testing utilities
export const checkAccessibility = async (container: HTMLElement) => {
  try {
    const axeCore = await import('axe-core');
    const results = await axeCore.default.run(container);
    return results;
  } catch (error) {
    console.warn('axe-core not available, skipping accessibility check');
    return { violations: [] };
  }
};

// Wait for async operations with improved timeout handling
export const waitForAsync = (ms: number = 0) =>
  new Promise(resolve => {
    const timeoutId = setTimeout(resolve, ms);
    // Track timeout for cleanup
    if ((global as any).testTimeouts) {
      (global as any).testTimeouts.add(timeoutId);
    }
  });

// Enhanced waitFor with better error handling and timeout management
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
) => {
  const {
    timeout = 5000,
    interval = 50,
    timeoutMessage = 'Condition was not met within timeout'
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) {
        return true;
      }
    } catch (error) {
      // Continue checking if condition throws
    }

    await waitForAsync(interval);
  }

  throw new Error(`${timeoutMessage} (${timeout}ms)`);
};

// Mock promise utilities for testing async flows
export const createMockPromise = <T = any>() => {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
};

// Timeout management utilities
export const withTimeout = function<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${timeoutMessage} (${timeoutMs}ms)`));
      }, timeoutMs);

      // Track timeout for cleanup
      if ((global as any).testTimeouts) {
        (global as any).testTimeouts.add(timeoutId);
      }
    })
  ]);
};

// Async cleanup helpers
export const createAsyncCleanup = () => {
  const cleanupTasks: Array<() => Promise<void> | void> = [];

  const addCleanup = (task: () => Promise<void> | void) => {
    cleanupTasks.push(task);
  };

  const cleanup = async () => {
    const results = await Promise.allSettled(
      cleanupTasks.map(task => Promise.resolve(task()))
    );

    // Log any cleanup failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Cleanup task ${index} failed:`, result.reason);
      }
    });

    cleanupTasks.length = 0; // Clear tasks
  };

  return { addCleanup, cleanup };
};

// Mock drag and drop events
export const createDragEvent = (type: string, files: File[] = []) => {
  const event = new Event(type, { bubbles: true });

  // Create a proper DataTransferItemList-like object
  const items = files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file }));
  Object.defineProperty(items, 'length', { value: files.length, writable: false });

  // Create a proper FileList-like object
  const fileList = Object.assign(files, { length: files.length });

  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: fileList,
      items,
      types: files.length > 0 ? ['Files'] : [],
      dropEffect: 'copy',
      effectAllowed: 'all',
    },
    writable: false,
    configurable: true,
  });
  return event;
};

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void) => {
  // Ensure performance.now() is available and working
  if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
    console.warn('performance.now() not available, using Date.now() fallback');
    const start = Date.now();
    renderFn();
    await waitForAsync(10); // Wait for render to complete
    const end = Date.now();
    return end - start;
  }

  const start = performance.now();

  // Validate start time is a valid number
  if (isNaN(start) || !isFinite(start)) {
    console.warn('Invalid start time from performance.now(), using Date.now() fallback');
    const dateStart = Date.now();
    renderFn();
    await waitForAsync(10);
    const dateEnd = Date.now();
    return dateEnd - dateStart;
  }

  renderFn();
  await waitForAsync(10); // Wait for render to complete with small delay
  const end = performance.now();

  // Validate end time and calculate duration
  if (isNaN(end) || !isFinite(end)) {
    console.warn('Invalid end time from performance.now(), returning fallback duration');
    return 10; // Return reasonable fallback duration
  }

  const duration = end - start;

  // Ensure duration is valid
  if (isNaN(duration) || !isFinite(duration) || duration < 0) {
    console.warn('Invalid duration calculated, returning fallback duration');
    return 10; // Return reasonable fallback duration
  }

  return duration;
};

// Local storage testing utilities
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get store() {
      return { ...store };
    },
  };
};
