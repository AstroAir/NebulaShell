import { EventEmitter } from 'events';
import {
  CommandHistoryEntry,
  CommandHistorySession,
  CommandHistorySettings,
  CommandHistoryState,
  CommandHistorySearchResult,
  CommandHistoryExport,
  HistoryNavigationDirection,
  HistorySearchOptions as BaseHistorySearchOptions
} from '@/types/terminal-history';
import { logger } from './logger';

// Enhanced history entry interface
export interface HistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  sessionId: string;
  workingDirectory?: string;
  exitCode?: number;
  duration?: number;
  output?: string;
  tags?: string[];
  favorite?: boolean;
}

export interface HistorySearchOptions {
  query?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  exitCode?: number;
  tags?: string[];
  favorites?: boolean;
  limit?: number;
  offset?: number;
}

export interface HistoryStats {
  totalCommands: number;
  uniqueCommands: number;
  mostUsedCommands: Array<{ command: string; count: number }>;
  averageSessionLength: number;
  commandsPerDay: Array<{ date: string; count: number }>;
  successRate: number;
}

export class TerminalHistoryManager extends EventEmitter {
  private state: CommandHistoryState;
  private storageKey = 'webssh_command_history';
  private settingsKey = 'webssh_history_settings';

  // Enhanced features
  private enhancedHistory: HistoryEntry[] = [];
  private maxHistorySize: number = 10000;
  private searchIndex: Map<string, Set<string>> = new Map();
  private commandFrequency: Map<string, number> = new Map();

  constructor() {
    super();
    this.state = this.getDefaultState();
    // Only load from storage on the client side
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
      this.loadEnhancedHistory();
      this.buildSearchIndex();
    }
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
  searchHistory(options: BaseHistorySearchOptions): CommandHistorySearchResult[] {
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
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

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
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

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

  // Enhanced Features

  private loadEnhancedHistory() {
    try {
      const saved = localStorage.getItem('terminal-history-enhanced');
      if (saved) {
        const data = JSON.parse(saved);
        this.enhancedHistory = data.history || [];
        this.commandFrequency = new Map(data.frequency || []);

        // Clean up old entries if needed
        if (this.enhancedHistory.length > this.maxHistorySize) {
          this.enhancedHistory = this.enhancedHistory.slice(-this.maxHistorySize);
          this.saveEnhancedHistory();
        }
      }
    } catch (error) {
      console.warn('Failed to load enhanced terminal history:', error);
    }
  }

  private saveEnhancedHistory() {
    try {
      const data = {
        history: this.enhancedHistory,
        frequency: Array.from(this.commandFrequency.entries()),
      };
      localStorage.setItem('terminal-history-enhanced', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save enhanced terminal history:', error);
    }
  }

  private buildSearchIndex() {
    this.searchIndex.clear();

    this.enhancedHistory.forEach(entry => {
      // Index by command words
      const words = entry.command.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) {
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, new Set());
          }
          this.searchIndex.get(word)!.add(entry.id);
        }
      });

      // Index by tags
      if (entry.tags) {
        entry.tags.forEach(tag => {
          const tagKey = `tag:${tag.toLowerCase()}`;
          if (!this.searchIndex.has(tagKey)) {
            this.searchIndex.set(tagKey, new Set());
          }
          this.searchIndex.get(tagKey)!.add(entry.id);
        });
      }

      // Index by working directory
      if (entry.workingDirectory) {
        const dirKey = `dir:${entry.workingDirectory.toLowerCase()}`;
        if (!this.searchIndex.has(dirKey)) {
          this.searchIndex.set(dirKey, new Set());
        }
        this.searchIndex.get(dirKey)!.add(entry.id);
      }
    });
  }

  addEnhancedEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullEntry: HistoryEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };

    this.enhancedHistory.push(fullEntry);

    // Update command frequency
    const freq = this.commandFrequency.get(entry.command) || 0;
    this.commandFrequency.set(entry.command, freq + 1);

    // Maintain size limit
    if (this.enhancedHistory.length > this.maxHistorySize) {
      const removed = this.enhancedHistory.shift();
      if (removed) {
        this.updateFrequencyOnRemoval(removed.command);
      }
    }

    this.updateSearchIndex(fullEntry);
    this.saveEnhancedHistory();

    return id;
  }

  private updateFrequencyOnRemoval(command: string) {
    const freq = this.commandFrequency.get(command);
    if (freq && freq > 1) {
      this.commandFrequency.set(command, freq - 1);
    } else {
      this.commandFrequency.delete(command);
    }
  }

  private updateSearchIndex(entry: HistoryEntry) {
    // Add to search index
    const words = entry.command.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, new Set());
        }
        this.searchIndex.get(word)!.add(entry.id);
      }
    });

    if (entry.tags) {
      entry.tags.forEach(tag => {
        const tagKey = `tag:${tag.toLowerCase()}`;
        if (!this.searchIndex.has(tagKey)) {
          this.searchIndex.set(tagKey, new Set());
        }
        this.searchIndex.get(tagKey)!.add(entry.id);
      });
    }

    if (entry.workingDirectory) {
      const dirKey = `dir:${entry.workingDirectory.toLowerCase()}`;
      if (!this.searchIndex.has(dirKey)) {
        this.searchIndex.set(dirKey, new Set());
      }
      this.searchIndex.get(dirKey)!.add(entry.id);
    }
  }

  searchEnhanced(options: HistorySearchOptions = {}): HistoryEntry[] {
    let candidateEntries: HistoryEntry[] = [];
    let matchingIds: Set<string> | null = null;

    // Filter by query using search index first (most selective)
    if (options.query) {
      const query = options.query.toLowerCase();
      matchingIds = new Set<string>();

      // Check for special search syntax
      if (query.startsWith('tag:')) {
        const tag = query.substring(4);
        const tagResults = this.searchIndex.get(`tag:${tag}`);
        if (tagResults) {
          tagResults.forEach(id => matchingIds!.add(id));
        }
      } else if (query.startsWith('dir:')) {
        const dir = query.substring(4);
        const dirResults = this.searchIndex.get(`dir:${dir}`);
        if (dirResults) {
          dirResults.forEach(id => matchingIds!.add(id));
        }
      } else {
        // Regular text search using index - optimized for performance
        const words = query.split(/\s+/).filter(word => word.length > 2);

        if (words.length > 0) {
          // Start with results from first word
          const firstWordResults = this.searchIndex.get(words[0]);
          if (firstWordResults) {
            firstWordResults.forEach(id => matchingIds!.add(id));

            // Intersect with results from other words for AND behavior
            for (let i = 1; i < words.length; i++) {
              const wordResults = this.searchIndex.get(words[i]);
              if (wordResults) {
                const intersection = new Set<string>();
                matchingIds!.forEach(id => {
                  if (wordResults.has(id)) {
                    intersection.add(id);
                  }
                });
                matchingIds = intersection;
              } else {
                // If any word has no results, no matches possible
                matchingIds!.clear();
                break;
              }
            }
          }
        }

        // Fallback to simple string matching if no index results
        if (matchingIds!.size === 0) {
          // Direct iteration is faster than filter for large arrays
          for (const entry of this.enhancedHistory) {
            if (entry.command.toLowerCase().includes(query)) {
              matchingIds!.add(entry.id);
            }
          }
        }
      }

      // Build candidate entries from matching IDs
      if (matchingIds.size > 0) {
        for (const entry of this.enhancedHistory) {
          if (matchingIds.has(entry.id)) {
            candidateEntries.push(entry);
          }
        }
      }
    } else {
      // No query filter - use all entries
      candidateEntries = this.enhancedHistory;
    }

    // Apply additional filters efficiently
    let results: HistoryEntry[] = [];

    for (const entry of candidateEntries) {
      // Apply all filters in one pass
      if (options.sessionId && entry.sessionId !== options.sessionId) continue;
      if (options.startDate && entry.timestamp < options.startDate.getTime()) continue;
      if (options.endDate && entry.timestamp > options.endDate.getTime()) continue;
      if (options.exitCode !== undefined && entry.exitCode !== options.exitCode) continue;
      if (options.tags && options.tags.length > 0 &&
          (!entry.tags || !options.tags.some(tag => entry.tags!.includes(tag)))) continue;
      if (options.favorites && !entry.favorite) continue;

      results.push(entry);
    }

    // Sort by timestamp (newest first) - only sort what we need
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination efficiently
    const offset = options.offset || 0;
    const limit = options.limit;

    if (offset > 0) {
      results = results.slice(offset);
    }
    if (limit !== undefined) {
      results = results.slice(0, limit);
    }

    return results;
  }

  getRecentCommands(limit: number = 50): HistoryEntry[] {
    return this.enhancedHistory
      .slice(-limit)
      .reverse();
  }

  getMostUsedCommands(limit: number = 10): Array<{ command: string; count: number }> {
    return Array.from(this.commandFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([command, count]) => ({ command, count }));
  }

  toggleFavorite(entryId: string): boolean {
    const entry = this.enhancedHistory.find(e => e.id === entryId);
    if (entry) {
      entry.favorite = !entry.favorite;
      this.saveEnhancedHistory();
      return true;
    }
    return false;
  }

  addTags(entryId: string, tags: string[]): boolean {
    const entry = this.enhancedHistory.find(e => e.id === entryId);
    if (entry) {
      entry.tags = [...(entry.tags || []), ...tags];
      this.updateSearchIndex(entry);
      this.saveEnhancedHistory();
      return true;
    }
    return false;
  }

  removeTags(entryId: string, tags: string[]): boolean {
    const entry = this.enhancedHistory.find(e => e.id === entryId);
    if (entry && entry.tags) {
      entry.tags = entry.tags.filter(tag => !tags.includes(tag));
      this.buildSearchIndex(); // Rebuild index after tag removal
      this.saveEnhancedHistory();
      return true;
    }
    return false;
  }

  getEnhancedStats(): HistoryStats {
    const totalCommands = this.enhancedHistory.length;
    const uniqueCommands = new Set(this.enhancedHistory.map(e => e.command)).size;
    const mostUsedCommands = this.getMostUsedCommands(5);

    // Calculate success rate
    const commandsWithExitCode = this.enhancedHistory.filter(e => e.exitCode !== undefined);
    const successfulCommands = commandsWithExitCode.filter(e => e.exitCode === 0);
    const successRate = commandsWithExitCode.length > 0
      ? (successfulCommands.length / commandsWithExitCode.length)
      : 0;

    // Calculate commands per day for last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentCommands = this.enhancedHistory.filter(e => e.timestamp >= thirtyDaysAgo);
    const commandsByDay = new Map<string, number>();

    recentCommands.forEach(entry => {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      commandsByDay.set(date, (commandsByDay.get(date) || 0) + 1);
    });

    const commandsPerDay = Array.from(commandsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate average session length
    const sessions = new Map<string, HistoryEntry[]>();
    this.enhancedHistory.forEach(entry => {
      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, []);
      }
      sessions.get(entry.sessionId)!.push(entry);
    });

    const sessionLengths = Array.from(sessions.values()).map(entries => {
      if (entries.length < 2) return 0;
      const sorted = entries.sort((a, b) => a.timestamp - b.timestamp);
      return sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    });

    const averageSessionLength = sessionLengths.length > 0
      ? sessionLengths.reduce((sum, length) => sum + length, 0) / sessionLengths.length
      : 0;

    return {
      totalCommands,
      uniqueCommands,
      mostUsedCommands,
      averageSessionLength,
      commandsPerDay,
      successRate,
    };
  }

  exportEnhancedHistory(): string {
    return JSON.stringify({
      history: this.enhancedHistory,
      frequency: Array.from(this.commandFrequency.entries()),
      exportDate: new Date().toISOString(),
    }, null, 2);
  }

  importEnhancedHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);

      if (parsed.history && Array.isArray(parsed.history)) {
        // Merge with existing history, avoiding duplicates
        const existingIds = new Set(this.enhancedHistory.map(e => e.id));
        const newEntries = parsed.history.filter((e: HistoryEntry) => !existingIds.has(e.id));

        this.enhancedHistory.push(...newEntries);
        this.enhancedHistory.sort((a, b) => a.timestamp - b.timestamp);

        // Maintain size limit
        if (this.enhancedHistory.length > this.maxHistorySize) {
          this.enhancedHistory = this.enhancedHistory.slice(-this.maxHistorySize);
        }
      }

      if (parsed.frequency && Array.isArray(parsed.frequency)) {
        parsed.frequency.forEach(([command, count]: [string, number]) => {
          const existing = this.commandFrequency.get(command) || 0;
          this.commandFrequency.set(command, existing + count);
        });
      }

      this.buildSearchIndex();
      this.saveEnhancedHistory();
      return true;
    } catch (error) {
      console.warn('Failed to import enhanced history:', error);
      return false;
    }
  }

  clearEnhancedHistory(): void {
    this.enhancedHistory = [];
    this.commandFrequency.clear();
    this.searchIndex.clear();
    this.saveEnhancedHistory();
  }
}

export const terminalHistoryManager = new TerminalHistoryManager();
