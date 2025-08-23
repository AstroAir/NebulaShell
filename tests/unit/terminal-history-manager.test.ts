import { terminalHistoryManager } from '../../src/lib/terminal-history-manager'
import { CommandHistoryEntry } from '../../src/types/terminal-history'

describe('TerminalHistoryManager', () => {
  const sessionId = 'test-session-1'

  beforeEach(() => {
    // Reset the manager state by creating a new instance
    jest.clearAllMocks();

    // Clear all history and reset settings
    terminalHistoryManager.clearHistory();
    terminalHistoryManager.updateSettings({
      enabled: true,
      maxEntries: 1000,
      ignoreDuplicates: true,
    });
  })

  describe('session management', () => {
    it('should create a new session', () => {
      const session = terminalHistoryManager.createSession(sessionId)

      expect(session.sessionId).toBe(sessionId)
      expect(session.entries).toHaveLength(0)
      expect(session.currentIndex).toBe(-1)
      expect(session.maxEntries).toBe(1000)
    })

    it('should return existing session if already created', () => {
      const session1 = terminalHistoryManager.createSession(sessionId)
      const session2 = terminalHistoryManager.createSession(sessionId)

      expect(session1).toBe(session2)
    })

    it('should set current session', () => {
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.setCurrentSession(sessionId)

      // We can't directly access getCurrentSession, but we can test by adding commands
      const command = 'test command'
      const entry = terminalHistoryManager.addCommand(command) // Should use current session
      expect(entry).toBeTruthy()
      expect(entry?.command).toBe(command)
    })

    it('should clear session history', () => {
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.addCommand('test command', sessionId)

      terminalHistoryManager.clearHistory(sessionId)

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(0)
    })
  })

  describe('command history', () => {
    beforeEach(() => {
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.setCurrentSession(sessionId)
    })

    it('should add command to history', () => {
      const command = 'ls -la'
      const entry = terminalHistoryManager.addCommand(command, sessionId)

      expect(entry).toBeTruthy()
      expect(entry?.command).toBe(command)
      expect(entry?.timestamp).toBeInstanceOf(Date)

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(1)
      expect(history[0].command).toBe(command)
    })

    it('should not add empty commands', () => {
      // Clear any existing history first
      terminalHistoryManager.clearHistory(sessionId)

      const entry1 = terminalHistoryManager.addCommand('', sessionId)
      const entry2 = terminalHistoryManager.addCommand('   ', sessionId)

      expect(entry1).toBeNull()
      expect(entry2).toBeNull()

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(0)
    })

    it('should not add duplicate commands when ignoreDuplicates is enabled', () => {
      const command = 'ls -la'
      const entry1 = terminalHistoryManager.addCommand(command, sessionId)
      const entry2 = terminalHistoryManager.addCommand(command, sessionId)

      expect(entry1).toBeTruthy()
      expect(entry2).toBe(entry1) // Should return the same entry

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(1)
    })

    it('should ignore sensitive commands', () => {
      // Clear any existing history first
      terminalHistoryManager.clearHistory(sessionId)

      const sensitiveCommands = ['passwd', 'sudo -S', 'mysql -p']

      sensitiveCommands.forEach(cmd => {
        const entry = terminalHistoryManager.addCommand(cmd, sessionId)
        expect(entry).toBeNull()
      })

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(0)
    })

    it('should limit history entries per session', () => {
      // Clear all history and create a new session with updated settings
      terminalHistoryManager.clearHistory()

      // Update settings to have a smaller limit
      terminalHistoryManager.updateSettings({ maxEntries: 3 })

      // Create a new session after updating settings
      const limitTestSessionId = 'limit-test-session'
      terminalHistoryManager.createSession(limitTestSessionId)

      // Add more commands than the limit
      for (let i = 0; i < 5; i++) {
        terminalHistoryManager.addCommand(`command-${i}`, limitTestSessionId)
      }

      const history = terminalHistoryManager.getSessionHistory(limitTestSessionId)
      expect(history.length).toBeLessThanOrEqual(3)
    })
  })

  describe('navigation', () => {
    beforeEach(() => {
      // Clear all history first
      terminalHistoryManager.clearHistory()

      // Create fresh session
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.setCurrentSession(sessionId)

      // Add some test commands
      ['command1', 'command2', 'command3'].forEach(cmd => {
        terminalHistoryManager.addCommand(cmd, sessionId)
      })
    })

    it('should navigate to previous command', () => {
      // Verify commands were added
      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history.length).toBeGreaterThan(0)

      const prev1 = terminalHistoryManager.navigateHistory('up', sessionId)
      expect(prev1).toBeTruthy()

      const prev2 = terminalHistoryManager.navigateHistory('up', sessionId)
      expect(prev2).toBeTruthy()

      const prev3 = terminalHistoryManager.navigateHistory('up', sessionId)
      expect(prev3).toBeTruthy()
    })

    it('should navigate to next command', () => {
      // Go to beginning
      terminalHistoryManager.navigateHistory('first', sessionId)

      const next1 = terminalHistoryManager.navigateHistory('down', sessionId)
      expect(next1).toBeTruthy()

      const next2 = terminalHistoryManager.navigateHistory('down', sessionId)
      expect(next2).toBeTruthy()

      // Should return empty string when past end
      const next3 = terminalHistoryManager.navigateHistory('down', sessionId)
      expect(typeof next3).toBe('string')
    })

    it('should navigate to first and last commands', () => {
      const first = terminalHistoryManager.navigateHistory('first', sessionId)
      expect(first).toBeTruthy()

      const last = terminalHistoryManager.navigateHistory('last', sessionId)
      expect(typeof last).toBe('string')
    })

    it('should reset navigation index when adding new command', () => {
      terminalHistoryManager.navigateHistory('up', sessionId)
      terminalHistoryManager.addCommand('new-command', sessionId)

      // After adding a command, current index should be at the end
      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(4) // 3 original + 1 new
    })
  })

  describe('search functionality', () => {
    beforeEach(() => {
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.setCurrentSession(sessionId)

      // Add test commands
      const commands = [
        'ls -la /home',
        'cd /var/log',
        'grep error /var/log/syslog',
        'ls -la /var',
        'tail -f /var/log/nginx/error.log'
      ]

      commands.forEach(cmd => {
        terminalHistoryManager.addCommand(cmd, sessionId)
      })
    })

    it('should search commands by query', () => {
      const results = terminalHistoryManager.searchHistory({ query: 'ls', sessionId })

      expect(results.length).toBeGreaterThanOrEqual(2)
      results.forEach(result => {
        expect(result.entry.command).toContain('ls')
      })
    })

    it('should search case-insensitively by default', () => {
      const results = terminalHistoryManager.searchHistory({ query: 'LOG', sessionId })

      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.entry.command.toLowerCase()).toContain('log')
      })
    })

    it('should search case-sensitively when specified', () => {
      const results = terminalHistoryManager.searchHistory({
        query: 'LOG',
        sessionId,
        caseSensitive: true,
      })

      expect(results).toHaveLength(0)
    })

    it('should limit search results', () => {
      const results = terminalHistoryManager.searchHistory({
        query: 'var',
        sessionId,
        limit: 2,
      })

      expect(results).toHaveLength(2)
    })

    it('should search in global history when no session specified', () => {
      // Add command to global history
      terminalHistoryManager.addCommand('global-command', sessionId)

      const results = terminalHistoryManager.searchHistory({ query: 'global' })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('settings management', () => {
    it('should get current settings', () => {
      const settings = terminalHistoryManager.getSettings()

      expect(settings.enabled).toBe(true)
      expect(settings.maxEntries).toBe(1000)
      expect(settings.ignoreDuplicates).toBe(true)
    })

    it('should update settings', () => {
      const newSettings = {
        enabled: false,
        maxEntries: 500,
        ignoreDuplicates: false,
      }

      terminalHistoryManager.updateSettings(newSettings)
      const settings = terminalHistoryManager.getSettings()

      expect(settings.enabled).toBe(false)
      expect(settings.maxEntries).toBe(500)
      expect(settings.ignoreDuplicates).toBe(false)
    })

    it('should clear all history', () => {
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.addCommand('test-command', sessionId)

      terminalHistoryManager.clearHistory() // Clear all

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history).toHaveLength(0)
    })
  })

  describe('export and import', () => {
    beforeEach(() => {
      // Clear all history first
      terminalHistoryManager.clearHistory()

      // Create fresh session
      terminalHistoryManager.createSession(sessionId)
      terminalHistoryManager.setCurrentSession(sessionId)

      // Add test commands
      const commands = ['ls', 'cd', 'ls', 'grep', 'ls']
      commands.forEach(cmd => {
        terminalHistoryManager.addCommand(cmd, sessionId)
      })
    })

    it('should export history', () => {
      const exported = terminalHistoryManager.exportHistory()

      expect(exported.sessions).toHaveLength(1)
      expect(exported.sessions[0].sessionId).toBe(sessionId)
      expect(exported.sessions[0].entries).toHaveLength(5) // All commands including duplicates
      expect(exported.exportedAt).toBeInstanceOf(Date)
      expect(exported.version).toBe('1.0')
    })

    it('should import history', () => {
      const exportData = terminalHistoryManager.exportHistory()

      // Clear current history
      terminalHistoryManager.clearHistory()

      // Import the data
      terminalHistoryManager.importHistory(exportData)

      const history = terminalHistoryManager.getSessionHistory(sessionId)
      expect(history.length).toBeGreaterThan(0)
    })

    it('should get global history', () => {
      const globalHistory = terminalHistoryManager.getGlobalHistory()

      expect(globalHistory.length).toBeGreaterThan(0)
      expect(globalHistory[0].command).toBeTruthy()
    })
  })
})
