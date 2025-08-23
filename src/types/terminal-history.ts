export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  sessionId: string;
  workingDirectory?: string;
  exitCode?: number;
  duration?: number;
}

export interface CommandHistorySession {
  sessionId: string;
  entries: CommandHistoryEntry[];
  currentIndex: number;
  maxEntries: number;
}

export interface CommandHistorySettings {
  enabled: boolean;
  maxEntries: number;
  maxSessions: number;
  persistAcrossSessions: boolean;
  ignoreDuplicates: boolean;
  ignoreCommands: string[]; // Commands to not store in history (e.g., passwords)
  searchCaseSensitive: boolean;
}

export interface CommandHistorySearchResult {
  entry: CommandHistoryEntry;
  matchIndex: number;
  matchLength: number;
}

export interface CommandHistoryState {
  sessions: Map<string, CommandHistorySession>;
  globalHistory: CommandHistoryEntry[];
  settings: CommandHistorySettings;
  currentSessionId: string | null;
}

export interface CommandHistoryExport {
  sessions: Array<{
    sessionId: string;
    entries: CommandHistoryEntry[];
  }>;
  globalHistory: CommandHistoryEntry[];
  settings: CommandHistorySettings;
  exportedAt: Date;
  version: string;
}

// Navigation directions for history browsing
export type HistoryNavigationDirection = 'up' | 'down' | 'first' | 'last';

// Search options for history search
export interface HistorySearchOptions {
  query: string;
  caseSensitive?: boolean;
  sessionId?: string;
  limit?: number;
  includeGlobal?: boolean;
}
