'use client';

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

export class EnhancedTerminalHistoryManager {
  private history: HistoryEntry[] = [];
  private maxHistorySize: number = 10000;
  private searchIndex: Map<string, Set<string>> = new Map();
  private commandFrequency: Map<string, number> = new Map();

  constructor() {
    this.loadHistory();
    this.buildSearchIndex();
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem('terminal-history-enhanced');
      if (saved) {
        const data = JSON.parse(saved);
        this.history = data.history || [];
        this.commandFrequency = new Map(data.frequency || []);
        
        // Clean up old entries if needed
        if (this.history.length > this.maxHistorySize) {
          this.history = this.history.slice(-this.maxHistorySize);
          this.saveHistory();
        }
      }
    } catch (error) {
      console.warn('Failed to load terminal history:', error);
    }
  }

  private saveHistory() {
    try {
      const data = {
        history: this.history,
        frequency: Array.from(this.commandFrequency.entries()),
      };
      localStorage.setItem('terminal-history-enhanced', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save terminal history:', error);
    }
  }

  private buildSearchIndex() {
    this.searchIndex.clear();
    
    this.history.forEach(entry => {
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

  addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullEntry: HistoryEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };

    this.history.push(fullEntry);
    
    // Update command frequency
    const freq = this.commandFrequency.get(entry.command) || 0;
    this.commandFrequency.set(entry.command, freq + 1);

    // Maintain size limit
    if (this.history.length > this.maxHistorySize) {
      const removed = this.history.shift();
      if (removed) {
        this.updateFrequencyOnRemoval(removed.command);
      }
    }

    this.updateSearchIndex(fullEntry);
    this.saveHistory();
    
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

  search(options: HistorySearchOptions = {}): HistoryEntry[] {
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
          for (const entry of this.history) {
            if (entry.command.toLowerCase().includes(query)) {
              matchingIds!.add(entry.id);
            }
          }
        }
      }

      // Build candidate entries from matching IDs
      if (matchingIds.size > 0) {
        for (const entry of this.history) {
          if (matchingIds.has(entry.id)) {
            candidateEntries.push(entry);
          }
        }
      }
    } else {
      // No query filter - use all entries
      candidateEntries = this.history;
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
    return this.history
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
    const entry = this.history.find(e => e.id === entryId);
    if (entry) {
      entry.favorite = !entry.favorite;
      this.saveHistory();
      return true;
    }
    return false;
  }

  addTags(entryId: string, tags: string[]): boolean {
    const entry = this.history.find(e => e.id === entryId);
    if (entry) {
      entry.tags = [...(entry.tags || []), ...tags];
      this.updateSearchIndex(entry);
      this.saveHistory();
      return true;
    }
    return false;
  }

  removeTags(entryId: string, tags: string[]): boolean {
    const entry = this.history.find(e => e.id === entryId);
    if (entry && entry.tags) {
      entry.tags = entry.tags.filter(tag => !tags.includes(tag));
      this.buildSearchIndex(); // Rebuild index after tag removal
      this.saveHistory();
      return true;
    }
    return false;
  }

  getStats(): HistoryStats {
    const totalCommands = this.history.length;
    const uniqueCommands = new Set(this.history.map(e => e.command)).size;
    const mostUsedCommands = this.getMostUsedCommands(5);
    
    // Calculate success rate
    const commandsWithExitCode = this.history.filter(e => e.exitCode !== undefined);
    const successfulCommands = commandsWithExitCode.filter(e => e.exitCode === 0);
    const successRate = commandsWithExitCode.length > 0
      ? (successfulCommands.length / commandsWithExitCode.length)
      : 0;

    // Calculate commands per day for last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentCommands = this.history.filter(e => e.timestamp >= thirtyDaysAgo);
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
    this.history.forEach(entry => {
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

  exportHistory(): string {
    return JSON.stringify({
      history: this.history,
      frequency: Array.from(this.commandFrequency.entries()),
      exportDate: new Date().toISOString(),
    }, null, 2);
  }

  importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.history && Array.isArray(parsed.history)) {
        // Merge with existing history, avoiding duplicates
        const existingIds = new Set(this.history.map(e => e.id));
        const newEntries = parsed.history.filter((e: HistoryEntry) => !existingIds.has(e.id));
        
        this.history.push(...newEntries);
        this.history.sort((a, b) => a.timestamp - b.timestamp);
        
        // Maintain size limit
        if (this.history.length > this.maxHistorySize) {
          this.history = this.history.slice(-this.maxHistorySize);
        }
      }
      
      if (parsed.frequency && Array.isArray(parsed.frequency)) {
        parsed.frequency.forEach(([command, count]: [string, number]) => {
          const existing = this.commandFrequency.get(command) || 0;
          this.commandFrequency.set(command, existing + count);
        });
      }
      
      this.buildSearchIndex();
      this.saveHistory();
      return true;
    } catch (error) {
      console.warn('Failed to import history:', error);
      return false;
    }
  }

  clearHistory(): void {
    this.history = [];
    this.commandFrequency.clear();
    this.searchIndex.clear();
    this.saveHistory();
  }
}

export const enhancedTerminalHistoryManager = new EnhancedTerminalHistoryManager();
