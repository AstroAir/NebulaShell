import { NodeSSH } from 'node-ssh';
import { SSHConnectionConfig, SSHSession } from '@/types/ssh';
import { securityManager } from './security';
import { logger } from './logger';

interface MobileSettings {
  lowBandwidth: boolean;
  batchUpdates: boolean;
  compressionEnabled: boolean;
  touchOptimized: boolean;
  reducedAnimations: boolean;
}

interface PerformanceMetrics {
  connectionTime: number;
  lastLatency: number;
  averageLatency: number;
  dataTransferred: number;
  commandsExecuted: number;
  lastOptimization: Date;
}

export class SSHManager {
  private sessions: Map<string, { ssh: NodeSSH; session: SSHSession; mobileSettings?: MobileSettings }> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  async createSession(config: SSHConnectionConfig): Promise<SSHSession> {
    // Validate configuration
    const validation = securityManager.validateSSHConfig(config);
    if (!validation.valid) {
      logger.error('Invalid SSH configuration', { errors: validation.errors }, config.id);
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Check rate limiting
    const identifier = `${config.hostname}:${config.username}`;
    if (!securityManager.checkRateLimit(identifier)) {
      logger.warn('Rate limit exceeded for SSH connection', { hostname: config.hostname, username: config.username }, config.id);
      throw new Error('Too many connection attempts. Please wait before trying again.');
    }

    const ssh = new NodeSSH();

    const session: SSHSession = {
      id: config.id,
      config,
      connected: false,
      lastActivity: new Date(),
      createdAt: new Date(),
    };

    this.sessions.set(config.id, { ssh, session });
    logger.info('SSH session created', { hostname: config.hostname, username: config.username }, config.id);
    return session;
  }

  async connect(sessionId: string): Promise<void> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      logger.error('Session not found for connection attempt', { sessionId });
      throw new Error('Session not found');
    }

    const { ssh, session } = sessionData;
    const { config } = session;

    logger.sshConnectionAttempt(config.hostname, config.username, sessionId);

    try {
      await ssh.connect({
        host: config.hostname,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
        readyTimeout: 30000,
        algorithms: {
          kex: [
            'diffie-hellman-group1-sha1',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group16-sha512',
            'diffie-hellman-group18-sha512',
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-gcm',
            'aes256-gcm',
          ],
          hmac: [
            'hmac-sha2-256',
            'hmac-sha2-512',
            'hmac-sha1',
          ],
        },
      });

      session.connected = true;
      session.lastActivity = new Date();
      logger.sshConnectionSuccess(config.hostname, config.username, sessionId);
    } catch (error) {
      session.connected = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.sshConnectionFailed(config.hostname, config.username, errorMessage, sessionId);
      throw error;
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      logger.warn('Attempted to disconnect non-existent session', { sessionId });
      return;
    }

    const { ssh, session } = sessionData;

    try {
      ssh.dispose();
      session.connected = false;
      logger.sshDisconnection(sessionId, 'Manual disconnect');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error disconnecting SSH session', { error: errorMessage }, sessionId);
    }

    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): SSHSession | undefined {
    const sessionData = this.sessions.get(sessionId);
    return sessionData?.session;
  }

  getSSHConnection(sessionId: string): NodeSSH | undefined {
    const sessionData = this.sessions.get(sessionId);
    return sessionData?.ssh;
  }

  getAllSessions(): SSHSession[] {
    return Array.from(this.sessions.values()).map(({ session }) => session);
  }

  updateLastActivity(sessionId: string): void {
    const sessionData = this.sessions.get(sessionId);
    if (sessionData) {
      sessionData.session.lastActivity = new Date();

      // Update performance metrics
      const metrics = this.performanceMetrics.get(sessionId);
      if (metrics) {
        metrics.commandsExecuted++;
      }
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<{ success: boolean; output: string; error?: string }> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { ssh, session } = sessionData;
    if (!session.connected) {
      throw new Error('Session not connected');
    }

    try {
      const result = await ssh.execCommand(command);
      this.updateLastActivity(sessionId);

      return {
        success: result.code === 0,
        output: result.stdout || result.stderr,
        error: result.code !== 0 ? result.stderr : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Command execution failed', { sessionId, command, error: errorMessage });

      return {
        success: false,
        output: '',
        error: errorMessage
      };
    }
  }

  // Mobile optimization methods
  setMobileSettings(sessionId: string, settings: Partial<MobileSettings>): void {
    const sessionData = this.sessions.get(sessionId);
    if (sessionData) {
      sessionData.mobileSettings = {
        ...sessionData.mobileSettings,
        ...settings
      } as MobileSettings;

      logger.info('Mobile settings updated', { sessionId, settings });
    }
  }

  getMobileSettings(sessionId: string): MobileSettings | undefined {
    const sessionData = this.sessions.get(sessionId);
    return sessionData?.mobileSettings;
  }

  optimizeForMobile(sessionId: string): boolean {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return false;

    const defaultMobileSettings: MobileSettings = {
      lowBandwidth: true,
      batchUpdates: true,
      compressionEnabled: true,
      touchOptimized: true,
      reducedAnimations: true
    };

    this.setMobileSettings(sessionId, defaultMobileSettings);

    // Initialize performance metrics
    this.performanceMetrics.set(sessionId, {
      connectionTime: Date.now(),
      lastLatency: 0,
      averageLatency: 0,
      dataTransferred: 0,
      commandsExecuted: 0,
      lastOptimization: new Date()
    });

    return true;
  }

  getPerformanceMetrics(sessionId: string): PerformanceMetrics | undefined {
    return this.performanceMetrics.get(sessionId);
  }

  updateLatencyMetrics(sessionId: string, latency: number): void {
    const metrics = this.performanceMetrics.get(sessionId);
    if (metrics) {
      metrics.lastLatency = latency;
      metrics.averageLatency = (metrics.averageLatency + latency) / 2;
    }
  }

  // Cleanup inactive sessions (older than 1 hour)
  cleanupInactiveSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [sessionId, { session }] of this.sessions) {
      if (session.lastActivity < oneHourAgo) {
        this.disconnect(sessionId);
      }
    }
  }
}

// Singleton instance
export const sshManager = new SSHManager();

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  sshManager.cleanupInactiveSessions();
}, 30 * 60 * 1000);
