'use client';

export interface PersistedSession {
  id: string;
  name: string;
  connectionConfig: {
    hostname: string;
    port: number;
    username: string;
    // Note: passwords should not be persisted for security
  };
  terminalState: {
    workingDirectory: string;
    environmentVariables: Record<string, string>;
    aliases: Record<string, string>;
    theme: string;
    fontSize: number;
    scrollback: string[]; // Last N lines of output
  };
  metadata: {
    createdAt: number;
    lastAccessed: number;
    totalCommands: number;
    sessionDuration: number;
    tags: string[];
    favorite: boolean;
  };
  settings: {
    autoReconnect: boolean;
    saveScrollback: boolean;
    maxScrollbackLines: number;
    persistEnvironment: boolean;
  };
}

export interface SessionRestoreOptions {
  restoreScrollback: boolean;
  restoreEnvironment: boolean;
  restoreWorkingDirectory: boolean;
  restoreAliases: boolean;
}

export class TerminalSessionPersistence {
  private sessions: Map<string, PersistedSession> = new Map();
  private maxSessions: number = 100;
  private maxScrollbackLines: number = 1000;

  constructor() {
    this.loadSessions();
  }

  private loadSessions() {
    try {
      const saved = localStorage.getItem('terminal-persisted-sessions');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.sessions && Array.isArray(data.sessions)) {
          data.sessions.forEach((session: PersistedSession) => {
            this.sessions.set(session.id, session);
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted sessions:', error);
    }
  }

  private saveSessions() {
    try {
      const data = {
        sessions: Array.from(this.sessions.values()),
        lastSaved: Date.now(),
      };
      localStorage.setItem('terminal-persisted-sessions', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save persisted sessions:', error);
    }
  }

  createSession(
    name: string,
    connectionConfig: PersistedSession['connectionConfig'],
    initialState?: Partial<PersistedSession['terminalState']>
  ): string {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: PersistedSession = {
      id,
      name,
      connectionConfig,
      terminalState: {
        workingDirectory: '~',
        environmentVariables: {},
        aliases: {},
        theme: 'default-dark',
        fontSize: 14,
        scrollback: [],
        ...initialState,
      },
      metadata: {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        totalCommands: 0,
        sessionDuration: 0,
        tags: [],
        favorite: false,
      },
      settings: {
        autoReconnect: false,
        saveScrollback: true,
        maxScrollbackLines: this.maxScrollbackLines,
        persistEnvironment: true,
      },
    };

    this.sessions.set(id, session);
    
    // Maintain session limit
    if (this.sessions.size > this.maxSessions) {
      this.cleanupOldSessions();
    }
    
    this.saveSessions();
    return id;
  }

  updateSession(sessionId: string, updates: Partial<PersistedSession>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Deep merge updates
    const updatedSession: PersistedSession = {
      ...session,
      ...updates,
      terminalState: {
        ...session.terminalState,
        ...(updates.terminalState || {}),
      },
      metadata: {
        ...session.metadata,
        ...(updates.metadata || {}),
        lastAccessed: Date.now(),
      },
      settings: {
        ...session.settings,
        ...(updates.settings || {}),
      },
    };

    this.sessions.set(sessionId, updatedSession);
    this.saveSessions();
    return true;
  }

  getSession(sessionId: string): PersistedSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Update last accessed time
      session.metadata.lastAccessed = Date.now();
      this.saveSessions();
    }
    return session || null;
  }

  getAllSessions(): PersistedSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.metadata.lastAccessed - a.metadata.lastAccessed);
  }

  getFavoriteSessions(): PersistedSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.metadata.favorite)
      .sort((a, b) => b.metadata.lastAccessed - a.metadata.lastAccessed);
  }

  getRecentSessions(limit: number = 10): PersistedSession[] {
    return this.getAllSessions().slice(0, limit);
  }

  searchSessions(query: string): PersistedSession[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.sessions.values())
      .filter(session => 
        session.name.toLowerCase().includes(lowerQuery) ||
        session.connectionConfig.hostname.toLowerCase().includes(lowerQuery) ||
        session.connectionConfig.username.toLowerCase().includes(lowerQuery) ||
        session.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.metadata.lastAccessed - a.metadata.lastAccessed);
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.saveSessions();
    }
    return deleted;
  }

  toggleFavorite(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.favorite = !session.metadata.favorite;
      this.saveSessions();
      return true;
    }
    return false;
  }

  addTags(sessionId: string, tags: string[]): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.tags = [...new Set([...session.metadata.tags, ...tags])];
      this.saveSessions();
      return true;
    }
    return false;
  }

  removeTags(sessionId: string, tags: string[]): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.tags = session.metadata.tags.filter(tag => !tags.includes(tag));
      this.saveSessions();
      return true;
    }
    return false;
  }

  updateScrollback(sessionId: string, newLines: string[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.settings.saveScrollback) return false;

    const maxLines = session.settings.maxScrollbackLines;
    const currentScrollback = session.terminalState.scrollback;
    const combinedScrollback = [...currentScrollback, ...newLines];

    // Maintain scrollback limit
    if (combinedScrollback.length > maxLines) {
      session.terminalState.scrollback = combinedScrollback.slice(-maxLines);
    } else {
      session.terminalState.scrollback = combinedScrollback;
    }

    this.saveSessions();
    return true;
  }

  updateEnvironment(sessionId: string, variables: Record<string, string>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.settings.persistEnvironment) return false;

    session.terminalState.environmentVariables = {
      ...session.terminalState.environmentVariables,
      ...variables,
    };

    this.saveSessions();
    return true;
  }

  updateWorkingDirectory(sessionId: string, directory: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.terminalState.workingDirectory = directory;
    this.saveSessions();
    return true;
  }

  updateAliases(sessionId: string, aliases: Record<string, string>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.terminalState.aliases = {
      ...session.terminalState.aliases,
      ...aliases,
    };

    this.saveSessions();
    return true;
  }

  getRestoreScript(sessionId: string, options: SessionRestoreOptions): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const commands: string[] = [];

    // Restore working directory
    if (options.restoreWorkingDirectory && session.terminalState.workingDirectory !== '~') {
      commands.push(`cd "${session.terminalState.workingDirectory}"`);
    }

    // Restore environment variables
    if (options.restoreEnvironment) {
      Object.entries(session.terminalState.environmentVariables).forEach(([key, value]) => {
        commands.push(`export ${key}="${value}"`);
      });
    }

    // Restore aliases
    if (options.restoreAliases) {
      Object.entries(session.terminalState.aliases).forEach(([alias, command]) => {
        commands.push(`alias ${alias}="${command}"`);
      });
    }

    return commands;
  }

  private cleanupOldSessions() {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => a.metadata.lastAccessed - b.metadata.lastAccessed);

    // Remove oldest sessions, but keep favorites
    const toRemove = sessions
      .filter(session => !session.metadata.favorite)
      .slice(0, this.sessions.size - this.maxSessions + 10); // Remove extra to avoid frequent cleanup

    toRemove.forEach(session => {
      this.sessions.delete(session.id);
    });
  }

  exportSessions(): string {
    return JSON.stringify({
      sessions: Array.from(this.sessions.values()),
      exportDate: new Date().toISOString(),
      version: '1.0',
    }, null, 2);
  }

  importSessions(data: string, mergeStrategy: 'replace' | 'merge' = 'merge'): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (!parsed.sessions || !Array.isArray(parsed.sessions)) {
        return false;
      }

      if (mergeStrategy === 'replace') {
        this.sessions.clear();
      }

      parsed.sessions.forEach((session: PersistedSession) => {
        // Generate new ID if session already exists
        let sessionId = session.id;
        if (this.sessions.has(sessionId)) {
          sessionId = `${session.id}-imported-${Date.now()}`;
          session.id = sessionId;
        }
        
        this.sessions.set(sessionId, session);
      });

      this.saveSessions();
      return true;
    } catch (error) {
      console.warn('Failed to import sessions:', error);
      return false;
    }
  }

  clearAllSessions(): void {
    this.sessions.clear();
    this.saveSessions();
  }

  getSessionStats(): {
    totalSessions: number;
    favoriteSessions: number;
    totalCommands: number;
    averageSessionDuration: number;
    oldestSession: number;
    newestSession: number;
  } {
    const sessions = Array.from(this.sessions.values());
    
    return {
      totalSessions: sessions.length,
      favoriteSessions: sessions.filter(s => s.metadata.favorite).length,
      totalCommands: sessions.reduce((sum, s) => sum + s.metadata.totalCommands, 0),
      averageSessionDuration: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.metadata.sessionDuration, 0) / sessions.length 
        : 0,
      oldestSession: sessions.length > 0 
        ? Math.min(...sessions.map(s => s.metadata.createdAt)) 
        : 0,
      newestSession: sessions.length > 0 
        ? Math.max(...sessions.map(s => s.metadata.createdAt)) 
        : 0,
    };
  }
}

export const terminalSessionPersistence = new TerminalSessionPersistence();
