import { EventEmitter } from 'events';
import {
  CommandHistoryEntry,
  CommandHistorySession,
  CommandHistorySettings,
  CommandHistoryState,
  CommandHistorySearchResult,
  CommandHistoryExport,
  HistoryNavigationDirection,
  HistorySearchOptions
} from '@/types/terminal-history';
import { logger } from './logger';

export class TerminalHistoryManager extends EventEmitter {
  private state: CommandHistoryState;
  private storageKey = 'webssh_command_history';
  private settingsKey = 'webssh_history_settings';

  constructor() {
    super();
    this.state = this.getDefaultState();
    this.loadFromStorage();
  }

  private getDefaultState(): CommandHistoryState {
    return {
      sessions: new Map(),
      globalHistory: [],
      settings: this.getDefaultSettings(),
      currentSessionId: null,
    };
  }

  private getDefaultSettings(): CommandHistorySettings {
    return {
      enabled: true,
      maxEntries: 1000,
      maxSessions: 10,
      persistAcrossSessions: true,
      ignoreDuplicates: true,
      ignoreCommands: ['passwd', 'sudo -S', 'mysql -p', 'psql'],
      searchCaseSensitive: false,
    };
  }

  // Session Management
  createSession(sessionId: string): CommandHistorySession {
    if (this.state.sessions.has(sessionId)) {
      return this.state.sessions.get(sessionId)!;
    }

    const session: CommandHistorySession = {
      sessionId,
      entries: [],
      currentIndex: -1,
      maxEntries: this.state.settings.maxEntries,
    };

    this.state.sessions.set(sessionId, session);
    this.state.currentSessionId = sessionId;

    // Cleanup old sessions if we exceed the limit
    if (this.state.sessions.size > this.state.settings.maxSessions) {
      this.cleanupOldSessions();
    }

    this.saveToStorage();
    this.emit('sessionCreated', session);
    
    logger.info('Command history session created', { sessionId });
    return session;
  }

  setCurrentSession(sessionId: string): void {
    if (this.state.sessions.has(sessionId)) {
      this.state.currentSessionId = sessionId;
      this.emit('sessionChanged', sessionId);
    }
  }

  // Command Management
  addCommand(command: string, sessionId?: string): CommandHistoryEntry | null {
    if (!this.state.settings.enabled) {
      return null;
    }

    const targetSessionId = sessionId || this.state.currentSessionId;
    if (!targetSessionId) {
      logger.warn('No session ID provided for command history');
      return null;
    }

    // Check if command should be ignored
    if (this.shouldIgnoreCommand(command)) {
      return null;
    }

    // Get or create session
    let session = this.state.sessions.get(targetSessionId);
    if (!session) {
      session = this.createSession(targetSessionId);
    }

    // Check for duplicates if enabled
    if (this.state.settings.ignoreDuplicates && session.entries.length > 0) {
      const lastEntry = session.entries[session.entries.length - 1];
      if (lastEntry.command === command.trim()) {
        return lastEntry;
      }
    }

    const entry: CommandHistoryEntry = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      command: command.trim(),
      timestamp: new Date(),
      sessionId: targetSessionId,
    };

    // Add to session history
    session.entries.push(entry);
    session.currentIndex = session.entries.length;

    // Trim session history if needed
    if (session.entries.length > session.maxEntries) {
      session.entries = session.entries.slice(-session.maxEntries);
      session.currentIndex = session.entries.length;
    }

    // Add to global history if enabled
    if (this.state.settings.persistAcrossSessions) {
      this.state.globalHistory.push(entry);
      if (this.state.globalHistory.length > this.state.settings.maxEntries) {
        this.state.globalHistory = this.state.globalHistory.slice(-this.state.settings.maxEntries);
      }
    }

    this.saveToStorage();
    this.emit('commandAdded', entry);
    
    logger.debug('Command added to history', { 
      sessionId: targetSessionId, 
      command: command.substring(0, 50) 
    });
    
    return entry;
  }

  // Navigation
  navigateHistory(direction: HistoryNavigationDirection, sessionId?: string): string | null {
    const targetSessionId = sessionId || this.state.currentSessionId;
    if (!targetSessionId) return null;

    const session = this.state.sessions.get(targetSessionId);
    if (!session || session.entries.length === 0) return null;

    switch (direction) {
      case 'up':
        if (session.currentIndex > 0) {
          session.currentIndex--;
        }
        break;
      case 'down':
        if (session.currentIndex < session.entries.length) {
          session.currentIndex++;
        }
        break;
      case 'first':
        session.currentIndex = 0;
        break;
      case 'last':
        session.currentIndex = session.entries.length;
        break;
    }

    // Return empty string if we're past the last entry (for new command input)
    if (session.currentIndex >= session.entries.length) {
      return '';
    }

    const command = session.entries[session.currentIndex]?.command || '';
    this.emit('historyNavigated', { direction, command, index: session.currentIndex });
    
    return command;
  }

  // Search
  searchHistory(options: HistorySearchOptions): CommandHistorySearchResult[] {
    const results: CommandHistorySearchResult[] = [];
    const { query, caseSensitive = this.state.settings.searchCaseSensitive, sessionId, limit = 50 } = options;

    if (!query.trim()) return results;

    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const entries: CommandHistoryEntry[] = [];

    // Collect entries to search
    if (sessionId && this.state.sessions.has(sessionId)) {
      entries.push(...this.state.sessions.get(sessionId)!.entries);
    } else if (options.includeGlobal) {
      entries.push(...this.state.globalHistory);
    } else if (this.state.currentSessionId && this.state.sessions.has(this.state.currentSessionId)) {
      entries.push(...this.state.sessions.get(this.state.currentSessionId)!.entries);
    }

    // Search through entries
    for (const entry of entries.reverse()) {
      const command = caseSensitive ? entry.command : entry.command.toLowerCase();
      const matchIndex = command.indexOf(searchQuery);
      
      if (matchIndex !== -1) {
        results.push({
          entry,
          matchIndex,
          matchLength: query.length,
        });

        if (results.length >= limit) break;
      }
    }

    this.emit('historySearched', { query, results: results.length });
    return results;
  }

  // Utility methods
  private shouldIgnoreCommand(command: string): boolean {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return true;

    return this.state.settings.ignoreCommands.some(ignored => 
      trimmedCommand.startsWith(ignored)
    );
  }

  private cleanupOldSessions(): void {
    const sessions = Array.from(this.state.sessions.entries());
    sessions.sort((a, b) => {
      const aLastEntry = a[1].entries[a[1].entries.length - 1];
      const bLastEntry = b[1].entries[b[1].entries.length - 1];
      
      if (!aLastEntry) return 1;
      if (!bLastEntry) return -1;
      
      return bLastEntry.timestamp.getTime() - aLastEntry.timestamp.getTime();
    });

    // Remove oldest sessions
    const toRemove = sessions.slice(this.state.settings.maxSessions);
    toRemove.forEach(([sessionId]) => {
      this.state.sessions.delete(sessionId);
    });
  }

  // Storage
  private saveToStorage(): void {
    try {
      const data = {
        sessions: Array.from(this.state.sessions.entries()).map(([id, session]) => ({
          ...session,
          sessionId: id,
        })),
        globalHistory: this.state.globalHistory,
        currentSessionId: this.state.currentSessionId,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
      localStorage.setItem(this.settingsKey, JSON.stringify(this.state.settings));
    } catch (error) {
      logger.error('Failed to save command history', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private loadFromStorage(): void {
    try {
      // Load settings
      const settingsData = localStorage.getItem(this.settingsKey);
      if (settingsData) {
        this.state.settings = { ...this.getDefaultSettings(), ...JSON.parse(settingsData) };
      }

      // Load history data
      const historyData = localStorage.getItem(this.storageKey);
      if (!historyData) return;

      const data = JSON.parse(historyData);
      
      // Restore sessions
      if (data.sessions) {
        data.sessions.forEach((sessionData: any) => {
          const session: CommandHistorySession = {
            sessionId: sessionData.sessionId,
            entries: sessionData.entries.map((entry: any) => ({
              ...entry,
              timestamp: new Date(entry.timestamp),
            })),
            currentIndex: sessionData.currentIndex || sessionData.entries.length,
            maxEntries: sessionData.maxEntries || this.state.settings.maxEntries,
          };
          this.state.sessions.set(session.sessionId, session);
        });
      }

      // Restore global history
      if (data.globalHistory) {
        this.state.globalHistory = data.globalHistory.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }

      this.state.currentSessionId = data.currentSessionId;
    } catch (error) {
      logger.error('Failed to load command history', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Public API
  getSettings(): CommandHistorySettings {
    return { ...this.state.settings };
  }

  updateSettings(updates: Partial<CommandHistorySettings>): void {
    this.state.settings = { ...this.state.settings, ...updates };
    this.saveToStorage();
    this.emit('settingsChanged', this.state.settings);
  }

  getSessionHistory(sessionId?: string): CommandHistoryEntry[] {
    const targetSessionId = sessionId || this.state.currentSessionId;
    if (!targetSessionId) return [];

    const session = this.state.sessions.get(targetSessionId);
    return session ? [...session.entries] : [];
  }

  getGlobalHistory(): CommandHistoryEntry[] {
    return [...this.state.globalHistory];
  }

  clearHistory(sessionId?: string): void {
    if (sessionId) {
      const session = this.state.sessions.get(sessionId);
      if (session) {
        session.entries = [];
        session.currentIndex = -1;
      }
    } else {
      this.state.sessions.clear();
      this.state.globalHistory = [];
      this.state.currentSessionId = null;
    }

    this.saveToStorage();
    this.emit('historyCleared', { sessionId });
  }

  exportHistory(): CommandHistoryExport {
    return {
      sessions: Array.from(this.state.sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        entries: session.entries,
      })),
      globalHistory: this.state.globalHistory,
      settings: this.state.settings,
      exportedAt: new Date(),
      version: '1.0',
    };
  }

  importHistory(data: CommandHistoryExport): void {
    // Import sessions
    data.sessions.forEach(sessionData => {
      const session: CommandHistorySession = {
        sessionId: sessionData.sessionId,
        entries: sessionData.entries.map(entry => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        })),
        currentIndex: sessionData.entries.length,
        maxEntries: this.state.settings.maxEntries,
      };
      this.state.sessions.set(session.sessionId, session);
    });

    // Import global history
    this.state.globalHistory = data.globalHistory.map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));

    // Import settings
    if (data.settings) {
      this.state.settings = { ...this.getDefaultSettings(), ...data.settings };
    }

    this.saveToStorage();
    this.emit('historyImported');
  }
}

export const terminalHistoryManager = new TerminalHistoryManager();
