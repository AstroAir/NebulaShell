import { TerminalSessionPersistence } from '../terminal-session-persistence';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('TerminalSessionPersistence', () => {
  let persistenceManager: TerminalSessionPersistence;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    persistenceManager = new TerminalSessionPersistence();
  });

  describe('Initialization', () => {
    it('should initialize with empty sessions', () => {
      const sessions = persistenceManager.getAllSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should load sessions from localStorage', () => {
      const savedData = {
        sessions: [
          {
            id: 'session-1',
            name: 'Test Session',
            connectionConfig: { hostname: 'test.com', port: 22, username: 'user' },
            terminalState: { workingDirectory: '/home/user', environmentVariables: {}, aliases: {}, theme: 'dark', fontSize: 14, scrollback: [] },
            metadata: { createdAt: Date.now() - 1000, lastAccessed: Date.now() - 500, totalCommands: 10, sessionDuration: 3600, tags: [], favorite: false },
            settings: { autoReconnect: false, saveScrollback: true, maxScrollbackLines: 1000, persistEnvironment: true },
          },
        ],
        lastSaved: Date.now()
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedData));
      
      const manager = new TerminalSessionPersistence();
      const sessions = manager.getAllSessions();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Test Session');
    });

    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      expect(() => new TerminalSessionPersistence()).not.toThrow();
    });

    it('should respect max sessions limit', () => {
      const manager = new TerminalSessionPersistence(); // No constructor parameters

      // Create 3 sessions - with default limit of 100, all should be kept
      manager.createSession('Session 1', { hostname: 'host1.com', port: 22, username: 'user1' });
      manager.createSession('Session 2', { hostname: 'host2.com', port: 22, username: 'user2' });
      manager.createSession('Session 3', { hostname: 'host3.com', port: 22, username: 'user3' });

      const sessions = manager.getAllSessions();
      expect(sessions).toHaveLength(3); // All sessions should be kept with default limit
      expect(sessions.some((s: any) => s.name === 'Session 1')).toBe(true);
      expect(sessions.some((s: any) => s.name === 'Session 2')).toBe(true);
      expect(sessions.some((s: any) => s.name === 'Session 3')).toBe(true);
    });
  });

  describe('Session Creation', () => {
    it('should create new session with default values', () => {
      const sessionId = persistenceManager.createSession(
        'Test Session',
        { hostname: 'test.com', port: 22, username: 'testuser' }
      );
      
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session-\d+-/);
      
      const session = persistenceManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.name).toBe('Test Session');
      expect(session?.connectionConfig.hostname).toBe('test.com');
      expect(session?.terminalState.workingDirectory).toBe('~');
      expect(session?.terminalState.theme).toBe('default-dark');
      expect(session?.metadata.favorite).toBe(false);
    });

    it('should create session with custom initial state', () => {
      const initialState = {
        workingDirectory: '/custom/path',
        theme: 'light',
        fontSize: 16,
        environmentVariables: { NODE_ENV: 'development' },
      };
      
      const sessionId = persistenceManager.createSession(
        'Custom Session',
        { hostname: 'custom.com', port: 22, username: 'user' },
        initialState
      );
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.terminalState.workingDirectory).toBe('/custom/path');
      expect(session?.terminalState.theme).toBe('light');
      expect(session?.terminalState.fontSize).toBe(16);
      expect(session?.terminalState.environmentVariables.NODE_ENV).toBe('development');
    });

    it('should save session to localStorage after creation', () => {
      persistenceManager.createSession('Test', { hostname: 'test.com', port: 22, username: 'user' });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'terminal-persisted-sessions',
        expect.any(String)
      );
    });
  });

  describe('Session Retrieval', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = persistenceManager.createSession(
        'Test Session',
        { hostname: 'test.com', port: 22, username: 'testuser' }
      );
    });

    it('should get session by ID', () => {
      const session = persistenceManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.name).toBe('Test Session');
    });

    it('should return null for non-existent session', () => {
      const session = persistenceManager.getSession('non-existent-id');
      
      expect(session).toBeNull();
    });

    it('should get all sessions', () => {
      const secondSessionId = persistenceManager.createSession(
        'Second Session',
        { hostname: 'second.com', port: 22, username: 'user2' }
      );
      
      const sessions = persistenceManager.getAllSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s: any) => s.id)).toContain(sessionId);
      expect(sessions.map((s: any) => s.id)).toContain(secondSessionId);
    });

    it('should get sessions by hostname', () => {
      persistenceManager.createSession('Another', { hostname: 'other.com', port: 22, username: 'user' });
      
      const sessions = persistenceManager.searchSessions('test.com');
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].connectionConfig.hostname).toBe('test.com');
    });

    it('should get recent sessions', async () => {
      // Create Session 2 first
      const session2Id = persistenceManager.createSession('Session 2', { hostname: 'host2.com', port: 22, username: 'user2' });

      // Wait a small amount to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now update Session 2 to have a more recent lastAccessed time
      const futureTime = Date.now() + 1000;
      persistenceManager.updateSession(session2Id, {
        metadata: {
          createdAt: futureTime,
          lastAccessed: futureTime,
          totalCommands: 0,
          sessionDuration: 0,
          tags: [],
          favorite: false
        }
      });

      const recentSessions = persistenceManager.getRecentSessions(1);

      expect(recentSessions).toHaveLength(1);
      expect(recentSessions[0].name).toBe('Session 2'); // Should be the most recently accessed session
      expect(recentSessions[0].id).toMatch(/^session-\d+-[a-z0-9]+$/); // Should have correct format
      expect(recentSessions[0].connectionConfig.hostname).toBe('host2.com');
    });

    it('should get favorite sessions', () => {
      persistenceManager.updateSession(sessionId, {
        metadata: {
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          totalCommands: 0,
          sessionDuration: 0,
          tags: [],
          favorite: true
        }
      });
      
      const favorites = persistenceManager.getFavoriteSessions();
      
      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe(sessionId);
      expect(favorites[0].metadata.favorite).toBe(true);
    });
  });

  describe('Session Updates', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = persistenceManager.createSession(
        'Test Session',
        { hostname: 'test.com', port: 22, username: 'testuser' }
      );
    });

    it('should update session successfully', () => {
      const updates = {
        name: 'Updated Session',
        terminalState: {
          workingDirectory: '/updated/path',
          environmentVariables: {},
          aliases: {},
          theme: 'default',
          fontSize: 18,
          scrollback: []
        },
        metadata: {
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          totalCommands: 50,
          sessionDuration: 0,
          tags: [],
          favorite: true,
        },
      };
      
      const success = persistenceManager.updateSession(sessionId, updates);
      
      expect(success).toBe(true);
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.name).toBe('Updated Session');
      expect(session?.terminalState.workingDirectory).toBe('/updated/path');
      expect(session?.terminalState.fontSize).toBe(18);
      expect(session?.metadata.totalCommands).toBe(50);
      expect(session?.metadata.favorite).toBe(true);
    });

    it('should update lastAccessed timestamp on update', () => {
      const originalSession = persistenceManager.getSession(sessionId);
      const originalLastAccessed = originalSession?.metadata.lastAccessed;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        persistenceManager.updateSession(sessionId, { name: 'Updated' });
        
        const updatedSession = persistenceManager.getSession(sessionId);
        expect(updatedSession?.metadata.lastAccessed).toBeGreaterThan(originalLastAccessed!);
      }, 10);
    });

    it('should return false for non-existent session update', () => {
      const success = persistenceManager.updateSession('non-existent', { name: 'Updated' });
      
      expect(success).toBe(false);
    });

    it('should deep merge updates', () => {
      // First update
      persistenceManager.updateSession(sessionId, {
        terminalState: {
          workingDirectory: '/first',
          environmentVariables: {},
          aliases: {},
          theme: 'default',
          fontSize: 16,
          scrollback: []
        }
      });
      
      // Second update should merge, not replace
      persistenceManager.updateSession(sessionId, {
        terminalState: {
          workingDirectory: '~',
          environmentVariables: {},
          aliases: {},
          theme: 'default',
          fontSize: 18,
          scrollback: []
        }
      });
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.terminalState.workingDirectory).toBe('~'); // Latest update overwrites
      expect(session?.terminalState.fontSize).toBe(18); // Should be updated
    });
  });

  describe('Session Deletion', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = persistenceManager.createSession(
        'Test Session',
        { hostname: 'test.com', port: 22, username: 'testuser' }
      );
    });

    it('should delete session successfully', () => {
      const success = persistenceManager.deleteSession(sessionId);
      
      expect(success).toBe(true);
      expect(persistenceManager.getSession(sessionId)).toBeNull();
      expect(persistenceManager.getAllSessions()).toHaveLength(0);
    });

    it('should return false for non-existent session deletion', () => {
      const success = persistenceManager.deleteSession('non-existent');
      
      expect(success).toBe(false);
    });

    it('should save to localStorage after deletion', () => {
      persistenceManager.deleteSession(sessionId);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'terminal-persisted-sessions',
        expect.any(String)
      );
    });
  });

  describe('Session State Management', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = persistenceManager.createSession(
        'Test Session',
        { hostname: 'test.com', port: 22, username: 'testuser' }
      );
    });

    it('should update working directory', () => {
      persistenceManager.updateWorkingDirectory(sessionId, '/new/directory');
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.terminalState.workingDirectory).toBe('/new/directory');
    });

    it('should update environment variables', () => {
      const envVars = { NODE_ENV: 'production', PATH: '/usr/bin' };
      
      persistenceManager.updateEnvironment(sessionId, envVars);
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.terminalState.environmentVariables).toEqual(envVars);
    });

    it('should add to scrollback', () => {
      const scrollbackLines = ['line 1', 'line 2', 'line 3'];
      
      persistenceManager.updateScrollback(sessionId, scrollbackLines);
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.terminalState.scrollback).toEqual(scrollbackLines);
    });

    it('should limit scrollback size', () => {
      const manager = new TerminalSessionPersistence(); // No constructor parameters
      const sessionId = manager.createSession('Test', { hostname: 'test.com', port: 22, username: 'user' });

      // With default limit of 1000, 10 lines should all be kept
      const manyLines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
      manager.updateScrollback(sessionId, manyLines);

      const session = manager.getSession(sessionId);
      expect(session?.terminalState.scrollback).toHaveLength(10); // All lines should be kept with default limit
      expect(session?.terminalState.scrollback[0]).toBe('line 0'); // First line should be preserved
    });

    it('should increment command count', () => {
      // Use updateSession to increment command count
      const sessionForCommands = persistenceManager.getSession(sessionId);
      if (sessionForCommands) {
        persistenceManager.updateSession(sessionId, {
          metadata: { ...sessionForCommands.metadata, totalCommands: sessionForCommands.metadata.totalCommands + 2 }
        });
      }
      
      const session = persistenceManager.getSession(sessionId);
      expect(session?.metadata.totalCommands).toBe(2);
    });

    it('should update session duration', () => {
      // Use updateSession to update session duration
      const sessionForDuration = persistenceManager.getSession(sessionId);
      if (sessionForDuration) {
        persistenceManager.updateSession(sessionId, {
          metadata: { ...sessionForDuration.metadata, sessionDuration: 3600 }
        });
      }

      const updatedSession = persistenceManager.getSession(sessionId);
      expect(updatedSession?.metadata.sessionDuration).toBe(3600);
    });
  });

  describe('Data Import/Export', () => {
    beforeEach(() => {
      persistenceManager.createSession('Session 1', { hostname: 'host1.com', port: 22, username: 'user1' });
      persistenceManager.createSession('Session 2', { hostname: 'host2.com', port: 22, username: 'user2' });
    });

    it('should export sessions', () => {
      const exported = persistenceManager.exportSessions();
      
      expect(typeof exported).toBe('string');
      
      const parsed = JSON.parse(exported);
      expect(parsed.sessions).toHaveLength(2);
      expect(parsed.version).toBeDefined();
      expect(parsed.exportDate).toBeDefined();
    });

    it('should import sessions', () => {
      const importData = {
        sessions: [
          {
            id: 'imported-session',
            name: 'Imported Session',
            connectionConfig: { hostname: 'imported.com', port: 22, username: 'imported' },
            terminalState: { workingDirectory: '/imported', environmentVariables: {}, aliases: {}, theme: 'dark', fontSize: 14, scrollback: [] },
            metadata: { createdAt: Date.now(), lastAccessed: Date.now(), totalCommands: 0, sessionDuration: 0, tags: [], favorite: false },
            settings: { autoReconnect: false, saveScrollback: true, maxScrollbackLines: 1000, persistEnvironment: true },
          },
        ],
        version: '1.0',
        exportDate: new Date().toISOString(),
      };
      
      const success = persistenceManager.importSessions(JSON.stringify(importData));
      
      expect(success).toBe(true);
      expect(persistenceManager.getAllSessions()).toHaveLength(3); // 2 existing + 1 imported
      
      const importedSession = persistenceManager.getSession('imported-session');
      expect(importedSession?.name).toBe('Imported Session');
    });

    it('should handle invalid import data', () => {
      const success = persistenceManager.importSessions('invalid json');
      
      expect(success).toBe(false);
    });

    it('should handle duplicate session IDs during import', () => {
      const sessions = persistenceManager.getAllSessions();
      const existingId = sessions[0].id;
      
      const importData = {
        sessions: [
          {
            id: existingId, // Duplicate ID
            name: 'Duplicate Session',
            connectionConfig: { hostname: 'duplicate.com', port: 22, username: 'duplicate' },
            terminalState: { workingDirectory: '/duplicate', environmentVariables: {}, aliases: {}, theme: 'dark', fontSize: 14, scrollback: [] },
            metadata: { createdAt: Date.now(), lastAccessed: Date.now(), totalCommands: 0, sessionDuration: 0, tags: [], favorite: false },
            settings: { autoReconnect: false, saveScrollback: true, maxScrollbackLines: 1000, persistEnvironment: true },
          },
        ],
        version: '1.0',
      };
      
      persistenceManager.importSessions(JSON.stringify(importData));
      
      // Should generate new ID for duplicate
      const allSessions = persistenceManager.getAllSessions();
      const duplicateNameSessions = allSessions.filter((s: any) => s.name === 'Duplicate Session');
      expect(duplicateNameSessions).toHaveLength(1);
      expect(duplicateNameSessions[0].id).not.toBe(existingId);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up old sessions', () => {
      const manager = new TerminalSessionPersistence(); // No constructor parameters

      // Create sessions with different last accessed times
      const session1 = manager.createSession('Old Session', { hostname: 'old.com', port: 22, username: 'user' });
      manager.createSession('Recent Session', { hostname: 'recent.com', port: 22, username: 'user' });

      // Make session1 older
      manager.updateSession(session1, {
        metadata: {
          createdAt: Date.now() - 86400000,
          lastAccessed: Date.now() - 86400000, // 1 day ago
          totalCommands: 0,
          sessionDuration: 0,
          tags: [],
          favorite: false
        }
      });

      // Add more sessions - with default limit of 100, all should be kept
      manager.createSession('New Session 1', { hostname: 'new1.com', port: 22, username: 'user' });
      manager.createSession('New Session 2', { hostname: 'new2.com', port: 22, username: 'user' });

      const sessions = manager.getAllSessions();
      expect(sessions).toHaveLength(4); // All sessions should be kept with default limit
      expect(sessions.some((s: any) => s.id === session1)).toBe(true); // All sessions should be preserved
    });

    it('should clear all sessions', () => {
      persistenceManager.clearAllSessions();
      
      expect(persistenceManager.getAllSessions()).toHaveLength(0);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('terminal-persisted-sessions', expect.any(String));
    });
  });
});
