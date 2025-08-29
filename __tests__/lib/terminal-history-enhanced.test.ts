import { EnhancedTerminalHistoryManager } from '@/lib/terminal-history-enhanced';
import { mockLocalStorage } from '../utils/test-utils';

describe('EnhancedTerminalHistoryManager', () => {
  let historyManager: EnhancedTerminalHistoryManager;
  let localStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    localStorage = mockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: localStorage,
      writable: true,
    });
    
    historyManager = new EnhancedTerminalHistoryManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Adding Entries', () => {
    it('adds a new history entry', () => {
      const entryId = historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
        workingDirectory: '/home/user',
        exitCode: 0,
      });
      
      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
      
      const entries = historyManager.search();
      expect(entries).toHaveLength(1);
      expect(entries[0].command).toBe('ls -la');
      expect(entries[0].id).toBe(entryId);
    });

    it('generates unique IDs for entries', () => {
      const id1 = historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
      });
      
      const id2 = historyManager.addEntry({
        command: 'pwd',
        sessionId: 'session-1',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('updates command frequency', () => {
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
      });
      
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
      });
      
      const mostUsed = historyManager.getMostUsedCommands(5);
      expect(mostUsed).toHaveLength(1);
      expect(mostUsed[0].command).toBe('ls -la');
      expect(mostUsed[0].count).toBe(2);
    });

    it('maintains maximum history size', () => {
      // Add more entries than the max size (assuming 10000 is the limit)
      for (let i = 0; i < 10005; i++) {
        historyManager.addEntry({
          command: `command-${i}`,
          sessionId: 'session-1',
        });
      }
      
      const entries = historyManager.search();
      expect(entries.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      // Add test data
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
        workingDirectory: '/home/user',
        exitCode: 0,
        tags: ['filesystem'],
      });
      
      historyManager.addEntry({
        command: 'git status',
        sessionId: 'session-1',
        workingDirectory: '/home/user/project',
        exitCode: 0,
        tags: ['git'],
      });
      
      historyManager.addEntry({
        command: 'npm install',
        sessionId: 'session-2',
        workingDirectory: '/home/user/project',
        exitCode: 1,
        tags: ['npm'],
      });
    });

    it('searches by command text', () => {
      const results = historyManager.search({ query: 'git' });
      
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('git status');
    });

    it('searches by tags', () => {
      const results = historyManager.search({ query: 'tag:git' });
      
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('git status');
    });

    it('searches by working directory', () => {
      const results = historyManager.search({ query: 'dir:/home/user/project' });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.workingDirectory === '/home/user/project')).toBe(true);
    });

    it('filters by session ID', () => {
      const results = historyManager.search({ sessionId: 'session-1' });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.sessionId === 'session-1')).toBe(true);
    });

    it('filters by exit code', () => {
      const successResults = historyManager.search({ exitCode: 0 });
      const errorResults = historyManager.search({ exitCode: 1 });
      
      expect(successResults).toHaveLength(2);
      expect(errorResults).toHaveLength(1);
      expect(errorResults[0].command).toBe('npm install');
    });

    it('filters by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const results = historyManager.search({
        startDate: oneHourAgo,
        endDate: now,
      });
      
      expect(results).toHaveLength(3); // All entries should be within the last hour
    });

    it('limits search results', () => {
      const results = historyManager.search({ limit: 2 });
      
      expect(results).toHaveLength(2);
    });

    it('applies offset for pagination', () => {
      const firstPage = historyManager.search({ limit: 2, offset: 0 });
      const secondPage = historyManager.search({ limit: 2, offset: 2 });
      
      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    it('performs case-insensitive search', () => {
      const results = historyManager.search({ query: 'GIT' });
      
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('git status');
    });

    it('performs AND search with multiple words', () => {
      historyManager.addEntry({
        command: 'git commit -m "fix bug"',
        sessionId: 'session-1',
        tags: ['git'],
      });
      
      const results = historyManager.search({ query: 'git commit' });
      
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('git commit -m "fix bug"');
    });
  });

  describe('Favorites Management', () => {
    let entryId: string;

    beforeEach(() => {
      entryId = historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
      });
    });

    it('toggles favorite status', () => {
      const success = historyManager.toggleFavorite(entryId);
      
      expect(success).toBe(true);
      
      const entries = historyManager.search();
      expect(entries[0].favorite).toBe(true);
    });

    it('toggles favorite status back to false', () => {
      historyManager.toggleFavorite(entryId);
      const success = historyManager.toggleFavorite(entryId);
      
      expect(success).toBe(true);
      
      const entries = historyManager.search();
      expect(entries[0].favorite).toBe(false);
    });

    it('returns false for non-existent entry', () => {
      const success = historyManager.toggleFavorite('non-existent-id');
      
      expect(success).toBe(false);
    });

    it('filters favorites', () => {
      historyManager.toggleFavorite(entryId);
      
      const favorites = historyManager.search({ favorites: true });
      const all = historyManager.search();
      
      expect(favorites).toHaveLength(1);
      expect(all).toHaveLength(1);
      expect(favorites[0].favorite).toBe(true);
    });
  });

  describe('Tags Management', () => {
    let entryId: string;

    beforeEach(() => {
      entryId = historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
        tags: ['filesystem'],
      });
    });

    it('adds tags to entry', () => {
      const success = historyManager.addTags(entryId, ['directory', 'listing']);
      
      expect(success).toBe(true);
      
      const entries = historyManager.search();
      expect(entries[0].tags).toContain('filesystem');
      expect(entries[0].tags).toContain('directory');
      expect(entries[0].tags).toContain('listing');
    });

    it('removes tags from entry', () => {
      historyManager.addTags(entryId, ['directory', 'listing']);
      const success = historyManager.removeTags(entryId, ['directory']);
      
      expect(success).toBe(true);
      
      const entries = historyManager.search();
      expect(entries[0].tags).toContain('filesystem');
      expect(entries[0].tags).toContain('listing');
      expect(entries[0].tags).not.toContain('directory');
    });

    it('returns false for non-existent entry', () => {
      const addSuccess = historyManager.addTags('non-existent', ['tag']);
      const removeSuccess = historyManager.removeTags('non-existent', ['tag']);
      
      expect(addSuccess).toBe(false);
      expect(removeSuccess).toBe(false);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Add test data with various exit codes and timestamps
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
        exitCode: 0,
      });
      
      historyManager.addEntry({
        command: 'git status',
        sessionId: 'session-1',
        exitCode: 0,
      });
      
      historyManager.addEntry({
        command: 'npm install',
        sessionId: 'session-2',
        exitCode: 1,
      });
      
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-2',
        exitCode: 0,
      });
    });

    it('calculates total and unique commands', () => {
      const stats = historyManager.getStats();
      
      expect(stats.totalCommands).toBe(4);
      expect(stats.uniqueCommands).toBe(3); // ls -la, git status, npm install
    });

    it('calculates success rate', () => {
      const stats = historyManager.getStats();
      
      expect(stats.successRate).toBe(75); // 3 out of 4 commands succeeded
    });

    it('provides most used commands', () => {
      const stats = historyManager.getStats();
      
      expect(stats.mostUsedCommands).toHaveLength(3);
      expect(stats.mostUsedCommands[0].command).toBe('ls -la');
      expect(stats.mostUsedCommands[0].count).toBe(2);
    });

    it('calculates commands per day', () => {
      const stats = historyManager.getStats();
      
      expect(stats.commandsPerDay).toBeDefined();
      expect(Array.isArray(stats.commandsPerDay)).toBe(true);
    });
  });

  describe('Recent Commands', () => {
    beforeEach(() => {
      for (let i = 0; i < 60; i++) {
        historyManager.addEntry({
          command: `command-${i}`,
          sessionId: 'session-1',
        });
      }
    });

    it('returns recent commands in reverse chronological order', () => {
      const recent = historyManager.getRecentCommands(10);
      
      expect(recent).toHaveLength(10);
      expect(recent[0].command).toBe('command-59');
      expect(recent[9].command).toBe('command-50');
    });

    it('respects the limit parameter', () => {
      const recent = historyManager.getRecentCommands(5);
      
      expect(recent).toHaveLength(5);
    });
  });

  describe('Import/Export', () => {
    beforeEach(() => {
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
        exitCode: 0,
        tags: ['filesystem'],
        favorite: true,
      });
      
      historyManager.addEntry({
        command: 'git status',
        sessionId: 'session-1',
        exitCode: 0,
        tags: ['git'],
      });
    });

    it('exports history data', () => {
      const exportData = historyManager.exportHistory();
      const parsed = JSON.parse(exportData);
      
      expect(parsed.history).toBeDefined();
      expect(parsed.frequency).toBeDefined();
      expect(parsed.exportDate).toBeDefined();
      expect(parsed.history).toHaveLength(2);
    });

    it('imports history data', () => {
      const exportData = historyManager.exportHistory();
      
      // Create new manager and import
      const newManager = new EnhancedTerminalHistoryManager();
      const success = newManager.importHistory(exportData);
      
      expect(success).toBe(true);
      
      const entries = newManager.search();
      expect(entries).toHaveLength(2);
      expect(entries.some(e => e.command === 'ls -la')).toBe(true);
      expect(entries.some(e => e.command === 'git status')).toBe(true);
    });

    it('merges imported data with existing data', () => {
      const exportData = historyManager.exportHistory();
      
      // Add new entry to existing manager
      historyManager.addEntry({
        command: 'pwd',
        sessionId: 'session-1',
      });
      
      // Import should merge, not replace
      const success = historyManager.importHistory(exportData);
      
      expect(success).toBe(true);
      
      const entries = historyManager.search();
      expect(entries.length).toBeGreaterThan(2); // Should have original + imported
    });

    it('handles invalid import data', () => {
      const success = historyManager.importHistory('invalid json');
      
      expect(success).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('saves data to localStorage on add', () => {
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
      });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'terminal-history-enhanced',
        expect.any(String)
      );
    });

    it('loads data from localStorage on initialization', () => {
      const testData = {
        history: [
          {
            id: 'test-1',
            command: 'ls -la',
            timestamp: Date.now(),
            sessionId: 'session-1',
          },
        ],
        frequency: [['ls -la', 1]],
      };
      
      localStorage.getItem.mockReturnValue(JSON.stringify(testData));
      
      const newManager = new EnhancedTerminalHistoryManager();
      const entries = newManager.search();
      
      expect(entries).toHaveLength(1);
      expect(entries[0].command).toBe('ls -la');
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      expect(() => {
        historyManager.addEntry({
          command: 'ls -la',
          sessionId: 'session-1',
        });
      }).not.toThrow();
    });
  });

  describe('Clear History', () => {
    beforeEach(() => {
      historyManager.addEntry({
        command: 'ls -la',
        sessionId: 'session-1',
      });
      
      historyManager.addEntry({
        command: 'git status',
        sessionId: 'session-1',
      });
    });

    it('clears all history', () => {
      historyManager.clearHistory();
      
      const entries = historyManager.search();
      expect(entries).toHaveLength(0);
      
      const mostUsed = historyManager.getMostUsedCommands();
      expect(mostUsed).toHaveLength(0);
    });

    it('saves cleared state to localStorage', () => {
      historyManager.clearHistory();
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'terminal-history-enhanced',
        expect.stringContaining('"history":[]')
      );
    });
  });
});
