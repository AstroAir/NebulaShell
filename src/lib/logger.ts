import { securityManager } from './security';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  sessionId?: string;
  userId?: string;
  ip?: string;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    // Set log level from environment
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLogLevel) {
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, data?: any, sessionId?: string, userId?: string, ip?: string): void {
    if (level > this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data: data ? securityManager.sanitizeLogData(data) : undefined,
      sessionId,
      userId,
      ip,
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const levelName = LogLevel[level];
    const timestamp = entry.timestamp.toISOString();
    const logMessage = `[${timestamp}] ${levelName}: ${message}`;
    
    if (data) {
      console.log(logMessage, entry.data);
    } else {
      console.log(logMessage);
    }
  }

  error(message: string, data?: any, sessionId?: string, userId?: string, ip?: string): void {
    this.log(LogLevel.ERROR, message, data, sessionId, userId, ip);
  }

  warn(message: string, data?: any, sessionId?: string, userId?: string, ip?: string): void {
    this.log(LogLevel.WARN, message, data, sessionId, userId, ip);
  }

  info(message: string, data?: any, sessionId?: string, userId?: string, ip?: string): void {
    this.log(LogLevel.INFO, message, data, sessionId, userId, ip);
  }

  debug(message: string, data?: any, sessionId?: string, userId?: string, ip?: string): void {
    this.log(LogLevel.DEBUG, message, data, sessionId, userId, ip);
  }

  // SSH-specific logging methods
  sshConnectionAttempt(hostname: string, username: string, sessionId: string, ip?: string): void {
    this.info('SSH connection attempt', { hostname, username }, sessionId, undefined, ip);
  }

  sshConnectionSuccess(hostname: string, username: string, sessionId: string, ip?: string): void {
    this.info('SSH connection successful', { hostname, username }, sessionId, undefined, ip);
  }

  sshConnectionFailed(hostname: string, username: string, error: string, sessionId: string, ip?: string): void {
    this.error('SSH connection failed', { hostname, username, error }, sessionId, undefined, ip);
  }

  sshDisconnection(sessionId: string, reason?: string, ip?: string): void {
    this.info('SSH disconnection', { reason }, sessionId, undefined, ip);
  }

  sshCommand(command: string, sessionId: string, ip?: string): void {
    this.debug('SSH command executed', { command: command.substring(0, 100) }, sessionId, undefined, ip);
  }

  // Get logs for monitoring/debugging
  getLogs(level?: LogLevel, sessionId?: string, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level <= level);
    }

    if (sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === sessionId);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Get log statistics
  getStats(): { total: number; byLevel: Record<string, number> } {
    const byLevel: Record<string, number> = {
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
    };

    for (const log of this.logs) {
      const levelName = LogLevel[log.level];
      byLevel[levelName]++;
    }

    return {
      total: this.logs.length,
      byLevel,
    };
  }
}

export const logger = Logger.getInstance();
