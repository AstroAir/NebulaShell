export interface WebSocketMessage {
  type: 'terminal_data' | 'terminal_resize' | 'ssh_connect' | 'ssh_disconnect' | 'error' | 'status';
  payload: any;
  sessionId?: string;
}

export interface TerminalDataMessage {
  type: 'terminal_data';
  payload: {
    data: string;
  };
  sessionId: string;
}

export interface TerminalResizeMessage {
  type: 'terminal_resize';
  payload: {
    cols: number;
    rows: number;
  };
  sessionId: string;
}

export interface SSHConnectMessage {
  type: 'ssh_connect';
  payload: {
    hostname: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  };
  sessionId: string;
}

export interface SSHDisconnectMessage {
  type: 'ssh_disconnect';
  sessionId: string;
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
  sessionId?: string;
}

export interface StatusMessage {
  type: 'status';
  payload: {
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    message?: string;
  };
  sessionId: string;
}
