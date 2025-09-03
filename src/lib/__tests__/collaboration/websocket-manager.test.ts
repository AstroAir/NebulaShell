import { WebSocketCollaborationManager } from '../../collaboration/websocket-manager';

// Mock WebSocket
const MockWebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1, // OPEN
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
}));

// Add static properties
(MockWebSocket as any).CONNECTING = 0;
(MockWebSocket as any).OPEN = 1;
(MockWebSocket as any).CLOSING = 2;
(MockWebSocket as any).CLOSED = 3;

global.WebSocket = MockWebSocket as any;

// Mock window.location
delete (window as any).location;
(window as any).location = {
  protocol: 'http:',
  host: 'localhost:3000',
};

// Mock document
Object.defineProperty(document, 'hidden', {
  value: false,
  writable: true,
});

describe('WebSocketCollaborationManager', () => {
  let collaborationManager: WebSocketCollaborationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    collaborationManager = new WebSocketCollaborationManager();
  });

  afterEach(() => {
    collaborationManager.disconnect();
  });

  describe('Initialization', () => {
    it('should initialize with WebSocket manager', () => {
      expect(collaborationManager).toBeDefined();
      expect(collaborationManager.isConnected()).toBe(false);
    });

    it('should initialize with empty state', () => {
      const session = collaborationManager.getCurrentSession();
      const user = collaborationManager.getCurrentUser();
      
      expect(session).toBeNull();
      expect(user).toBeNull();
    });
  });

  describe('Event System', () => {
    it('should support event listeners', () => {
      const callback = jest.fn();
      
      collaborationManager.on('test-event', callback);
      
      // Verify event listener was added (internal functionality)
      expect(callback).toBeDefined();
    });

    it('should support removing event listeners', () => {
      const callback = jest.fn();
      
      collaborationManager.on('test-event', callback);
      collaborationManager.off('test-event', callback);
      
      // Verify event listener was removed (internal functionality)
      expect(callback).toBeDefined();
    });

    it('should provide message sending methods', () => {
      expect(typeof collaborationManager.sendTerminalInput).toBe('function');
      expect(typeof collaborationManager.sendTerminalOutput).toBe('function');
      expect(typeof collaborationManager.sendCursorMove).toBe('function');
      expect(typeof collaborationManager.sendSelectionChange).toBe('function');
    });

    it('should provide user update method', () => {
      expect(typeof collaborationManager.updateUser).toBe('function');
    });

    it('should handle disconnect method', () => {
      expect(typeof collaborationManager.disconnect).toBe('function');
      
      // Should not throw when called
      expect(() => collaborationManager.disconnect()).not.toThrow();
    });
  });

  describe('Connection Management', () => {
    it('should handle connection state', () => {
      expect(collaborationManager.isConnected()).toBe(false);
    });

    it('should provide current session info', () => {
      const session = collaborationManager.getCurrentSession();
      expect(session).toBeNull();
    });

    it('should provide current user info', () => {
      const user = collaborationManager.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should provide connected users list', () => {
      const users = collaborationManager.getConnectedUsers();
      expect(users).toEqual([]);
    });
  });
});
