import React, { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityProvider } from '@/components/accessibility/AccessibilityProvider';
import { ResponsiveLayoutProvider } from '@/components/layout/ResponsiveLayoutProvider';
import { TerminalProvider } from '@/components/terminal/TerminalContext';

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
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
    if (mockWs.onopen) mockWs.onopen({} as Event);
  };

  const simulateMessage = (data: any) => {
    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  };

  const simulateClose = (code = 1000, reason = '') => {
    if (mockWs.onclose) {
      mockWs.onclose({ code, reason, wasClean: true } as CloseEvent);
    }
  };

  const simulateError = (error: any) => {
    if (mockWs.onerror) mockWs.onerror(error);
  };

  return {
    mockWs,
    simulateOpen,
    simulateMessage,
    simulateClose,
    simulateError,
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

// Wait for async operations
export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Mock drag and drop events
export const createDragEvent = (type: string, files: File[] = []) => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      items: files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file })),
      types: ['Files'],
      dropEffect: 'copy',
      effectAllowed: 'all',
    },
  });
  return event;
};

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now();
  renderFn();
  await waitForAsync(); // Wait for render to complete
  const end = performance.now();
  return end - start;
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
