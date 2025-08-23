import { EventEmitter } from 'events';
import { TerminalSession, TerminalTab, TerminalState } from '@/types/terminal-session';
import { SSHConnectionConfig } from '@/types/ssh';
import { logger } from './logger';

export class TerminalSessionManager extends EventEmitter {
  private state: TerminalState = {
    sessions: new Map(),
    tabs: [],
    activeTabId: null,
    maxTabs: 10,
  };

  createSession(config: SSHConnectionConfig, name?: string): TerminalSession {
    const session: TerminalSession = {
      id: config.id,
      name: name || `${config.username}@${config.hostname}`,
      config,
      connected: false,
      lastActivity: new Date(),
      createdAt: new Date(),
      isActive: false,
      buffer: '',
    };

    this.state.sessions.set(session.id, session);
    
    // Create corresponding tab
    const tab: TerminalTab = {
      id: `tab_${session.id}`,
      sessionId: session.id,
      title: session.name,
      isActive: false,
      hasUnreadActivity: false,
      connectionStatus: 'disconnected',
    };

    this.state.tabs.push(tab);
    
    logger.info('Terminal session created', { sessionId: session.id, name: session.name });
    this.emit('sessionCreated', session);
    this.emit('tabCreated', tab);
    
    return session;
  }

  activateTab(tabId: string): boolean {
    const tab = this.state.tabs.find(t => t.id === tabId);
    if (!tab) return false;

    // Deactivate current tab
    if (this.state.activeTabId) {
      const currentTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
      if (currentTab) {
        currentTab.isActive = false;
        const currentSession = this.state.sessions.get(currentTab.sessionId);
        if (currentSession) {
          currentSession.isActive = false;
        }
      }
    }

    // Activate new tab
    tab.isActive = true;
    tab.hasUnreadActivity = false;
    this.state.activeTabId = tabId;

    const session = this.state.sessions.get(tab.sessionId);
    if (session) {
      session.isActive = true;
      session.lastActivity = new Date();
    }

    logger.debug('Tab activated', { tabId, sessionId: tab.sessionId });
    this.emit('tabActivated', tab);
    
    return true;
  }

  closeTab(tabId: string): boolean {
    const tabIndex = this.state.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return false;

    const tab = this.state.tabs[tabIndex];
    const session = this.state.sessions.get(tab.sessionId);

    // Remove tab
    this.state.tabs.splice(tabIndex, 1);

    // Clean up session
    if (session) {
      this.state.sessions.delete(session.id);
      logger.info('Terminal session closed', { sessionId: session.id });
      this.emit('sessionClosed', session);
    }

    // If this was the active tab, activate another one
    if (this.state.activeTabId === tabId) {
      this.state.activeTabId = null;
      
      if (this.state.tabs.length > 0) {
        // Activate the tab to the left, or the first tab if we closed the leftmost
        const newActiveIndex = Math.max(0, tabIndex - 1);
        const newActiveTab = this.state.tabs[newActiveIndex];
        if (newActiveTab) {
          this.activateTab(newActiveTab.id);
        }
      }
    }

    this.emit('tabClosed', tab);
    return true;
  }

  closeOtherTabs(keepTabId: string): number {
    const tabsToClose = this.state.tabs.filter(t => t.id !== keepTabId);
    let closedCount = 0;

    for (const tab of tabsToClose) {
      if (this.closeTab(tab.id)) {
        closedCount++;
      }
    }

    return closedCount;
  }

  closeAllTabs(): number {
    const tabCount = this.state.tabs.length;
    
    // Close all tabs
    while (this.state.tabs.length > 0) {
      this.closeTab(this.state.tabs[0].id);
    }

    return tabCount;
  }

  renameTab(tabId: string, newTitle: string): boolean {
    const tab = this.state.tabs.find(t => t.id === tabId);
    if (!tab) return false;

    tab.title = newTitle;
    
    const session = this.state.sessions.get(tab.sessionId);
    if (session) {
      session.name = newTitle;
    }

    this.emit('tabRenamed', tab);
    return true;
  }

  duplicateTab(tabId: string): TerminalSession | null {
    const tab = this.state.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    const session = this.state.sessions.get(tab.sessionId);
    if (!session) return null;

    // Create new session with same config
    const newConfig = { ...session.config, id: `${session.config.id}_${Date.now()}` };
    const newSession = this.createSession(newConfig, `${session.name} (Copy)`);
    
    return newSession;
  }

  updateTabConnectionStatus(sessionId: string, status: TerminalTab['connectionStatus']): void {
    const tab = this.state.tabs.find(t => t.sessionId === sessionId);
    if (tab) {
      tab.connectionStatus = status;
      this.emit('tabStatusChanged', tab);
    }

    const session = this.state.sessions.get(sessionId);
    if (session) {
      session.connected = status === 'connected';
      session.lastActivity = new Date();
    }
  }

  markTabActivity(sessionId: string): void {
    const tab = this.state.tabs.find(t => t.sessionId === sessionId);
    if (tab && !tab.isActive) {
      tab.hasUnreadActivity = true;
      this.emit('tabActivity', tab);
    }

    const session = this.state.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  getActiveSession(): TerminalSession | null {
    if (!this.state.activeTabId) return null;
    
    const activeTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
    if (!activeTab) return null;
    
    return this.state.sessions.get(activeTab.sessionId) || null;
  }

  getSession(sessionId: string): TerminalSession | null {
    return this.state.sessions.get(sessionId) || null;
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.state.sessions.values());
  }

  getAllTabs(): TerminalTab[] {
    return [...this.state.tabs];
  }

  getActiveTabId(): string | null {
    return this.state.activeTabId;
  }

  canCreateNewTab(): boolean {
    return this.state.tabs.length < this.state.maxTabs;
  }

  getTabCount(): number {
    return this.state.tabs.length;
  }

  setMaxTabs(maxTabs: number): void {
    this.state.maxTabs = Math.max(1, maxTabs);
  }

  // Store terminal instance for a session
  setTerminalInstance(sessionId: string, terminal: any): void {
    const session = this.state.sessions.get(sessionId);
    if (session) {
      session.terminalInstance = terminal;
    }
  }

  // Get terminal instance for a session
  getTerminalInstance(sessionId: string): any {
    const session = this.state.sessions.get(sessionId);
    return session?.terminalInstance;
  }

  // Store terminal buffer for inactive sessions
  updateSessionBuffer(sessionId: string, buffer: string): void {
    const session = this.state.sessions.get(sessionId);
    if (session && !session.isActive) {
      session.buffer = buffer;
    }
  }
}

export const terminalSessionManager = new TerminalSessionManager();
