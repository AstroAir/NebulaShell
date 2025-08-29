import crypto from 'crypto';

// Environment variables for encryption
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

export class SecurityManager {
  private static instance: SecurityManager;
  private encryptionKey: Buffer;

  private constructor() {
    this.encryptionKey = Buffer.from(ENCRYPTION_KEY, 'hex');
  }

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  /**
   * Encrypt sensitive data like passwords and private keys
   */
  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      if (error instanceof Error && error.message.includes('Invalid encrypted data format')) {
        throw error;
      }
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Validate SSH connection parameters
   */
  validateSSHConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Hostname validation
    if (!config.hostname || typeof config.hostname !== 'string') {
      errors.push('Hostname is required and must be a string');
    } else if (config.hostname.length > 255) {
      errors.push('Hostname is too long');
    } else if (!/^[a-zA-Z0-9.-]+$/.test(config.hostname)) {
      errors.push('Hostname contains invalid characters');
    }

    // Port validation
    if (config.port !== undefined && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
      errors.push('Port must be a number between 1 and 65535');
    }

    // Username validation
    if (!config.username || typeof config.username !== 'string') {
      errors.push('Username is required and must be a string');
    } else if (config.username.length > 32) {
      errors.push('Username is too long');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(config.username)) {
      errors.push('Username contains invalid characters');
    }

    // Authentication validation
    if (!config.password && !config.privateKey) {
      errors.push('Either password or private key is required');
    }

    // Password validation
    if (config.password && typeof config.password !== 'string') {
      errors.push('Password must be a string');
    }

    // Private key validation
    if (config.privateKey) {
      if (typeof config.privateKey !== 'string') {
        errors.push('Private key must be a string');
      } else if (!config.privateKey.includes('BEGIN') || !config.privateKey.includes('PRIVATE KEY')) {
        errors.push('Private key format appears to be invalid');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize log data to remove sensitive information
   */
  sanitizeLogData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'privateKey', 'passphrase', 'key', 'secret', 'token'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeLogData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Rate limiting for connection attempts
   */
  private connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();

  checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 300000): boolean {
    const now = Date.now();
    const attempts = this.connectionAttempts.get(identifier);

    if (!attempts) {
      this.connectionAttempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset if window has passed
    if (now - attempts.lastAttempt > windowMs) {
      this.connectionAttempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Check if limit exceeded
    if (attempts.count >= maxAttempts) {
      return false;
    }

    // Increment count
    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  /**
   * Clean up old rate limit entries
   */
  cleanupRateLimit(): void {
    const now = Date.now();
    const windowMs = 300000; // 5 minutes

    for (const [identifier, attempts] of this.connectionAttempts.entries()) {
      if (now - attempts.lastAttempt > windowMs) {
        this.connectionAttempts.delete(identifier);
      }
    }
  }

  /**
   * Reset rate limit state (for testing purposes)
   */
  resetRateLimit(): void {
    this.connectionAttempts.clear();
  }
}

export const securityManager = SecurityManager.getInstance();

// Clean up rate limit entries every 10 minutes
setInterval(() => {
  securityManager.cleanupRateLimit();
}, 600000);
