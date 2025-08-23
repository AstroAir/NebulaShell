import { SSHConnectionConfig } from './ssh';

export interface TerminalSession {
  id: string;
  name: string;
  config: SSHConnectionConfig;
  connected: boolean;
  lastActivity: Date;
  createdAt: Date;
  isActive: boolean;
  terminalInstance?: any; // xterm.js Terminal instance
  buffer?: string; // Terminal buffer for inactive sessions
}

export interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  isActive: boolean;
  hasUnreadActivity: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface TerminalState {
  sessions: Map<string, TerminalSession>;
  tabs: TerminalTab[];
  activeTabId: string | null;
  maxTabs: number;
}

export interface TabContextMenuAction {
  label: string;
  action: 'close' | 'closeOthers' | 'closeAll' | 'rename' | 'duplicate';
  icon?: string;
  disabled?: boolean;
}
