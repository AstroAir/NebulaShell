// Mock crypto module with a more comprehensive approach
const mockCrypto = {
  randomBytes: jest.fn(() => Buffer.from('1234567890123456')), // 16 bytes for IV
  createCipheriv: jest.fn(() => ({
    update: jest.fn(() => Buffer.from('encrypted-part')),
    final: jest.fn(() => Buffer.from('-final-part')),
  })),
  createDecipheriv: jest.fn(() => ({
    update: jest.fn(() => Buffer.from('decrypted-part')),
    final: jest.fn(() => Buffer.from('-final-part')),
  })),
};

// Use jest.doMock to ensure the mock is applied before the module is imported
jest.doMock('crypto', () => mockCrypto);

import { SecurityManager } from '../security';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (SecurityManager as any).instance = undefined;
    securityManager = SecurityManager.getInstance();

    // Reset crypto mocks
    jest.clearAllMocks();

    // Reset mock implementations
    mockCrypto.randomBytes.mockReturnValue(Buffer.from('1234567890123456'));
    mockCrypto.createCipheriv.mockReturnValue({
      update: jest.fn(() => Buffer.from('encrypted-part')),
      final: jest.fn(() => Buffer.from('-final-part')),
    });
    mockCrypto.createDecipheriv.mockReturnValue({
      update: jest.fn(() => Buffer.from('decrypted-part')),
      final: jest.fn(() => Buffer.from('-final-part')),
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = SecurityManager.getInstance();
      const instance2 = SecurityManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(securityManager);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = SecurityManager.getInstance();
      // Simulate some state change by calling checkRateLimit
      instance1.checkRateLimit('test-user');
      
      const instance2 = SecurityManager.getInstance();
      // Should be the same instance with same internal state
      expect(instance1).toBe(instance2);
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt text successfully', () => {
      const plaintext = 'sensitive-password';
      const encrypted = securityManager.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':'); // Should contain IV separator
      expect(encrypted).not.toBe(plaintext);
    });

    it('should decrypt text successfully', () => {
      const plaintext = 'sensitive-password';
      const encrypted = 'mock-iv-hex:encrypted-part-final-part';
      
      const decrypted = securityManager.decrypt(encrypted);
      
      expect(decrypted).toBeDefined();
      expect(typeof decrypted).toBe('string');
      expect(decrypted).toBe('decrypted-part-final-part');
    });

    it('should handle encryption errors gracefully', () => {
      const crypto = require('crypto');
      crypto.createCipheriv.mockImplementationOnce(() => {
        throw new Error('Encryption failed');
      });

      expect(() => {
        securityManager.encrypt('test');
      }).toThrow('Failed to encrypt data');
    });

    it('should handle decryption errors gracefully', () => {
      const crypto = require('crypto');
      crypto.createDecipheriv.mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });

      expect(() => {
        securityManager.decrypt('invalid:data');
      }).toThrow('Failed to decrypt data');
    });

    it('should handle malformed encrypted data', () => {
      expect(() => {
        securityManager.decrypt('malformed-data-without-separator');
      }).toThrow('Invalid encrypted data format');
    });

    it('should handle empty encryption input', () => {
      const encrypted = securityManager.encrypt('');
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('SSH Configuration Validation', () => {
    it('should validate valid SSH config', () => {
      const validConfig = {
        hostname: 'example.com',
        port: 22,
        username: 'user',
        authMethod: 'password' as const,
        password: 'secret123',
      };

      const result = securityManager.validateSSHConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid hostname', () => {
      const invalidConfig = {
        hostname: '',
        port: 22,
        username: 'user',
        authMethod: 'password' as const,
      };

      const result = securityManager.validateSSHConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hostname is required and must be a string');
    });

    it('should reject invalid port numbers', () => {
      const invalidConfig = {
        hostname: 'example.com',
        port: 70000, // Invalid port
        username: 'user',
        authMethod: 'password' as const,
      };

      const result = securityManager.validateSSHConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Port must be a number between 1 and 65535');
    });

    it('should reject empty username', () => {
      const invalidConfig = {
        hostname: 'example.com',
        port: 22,
        username: '',
        authMethod: 'password' as const,
      };

      const result = securityManager.validateSSHConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username is required and must be a string');
    });

    it('should reject config without authentication credentials', () => {
      const invalidConfig = {
        hostname: 'example.com',
        port: 22,
        username: 'user',
        // No password or privateKey provided
      };

      const result = securityManager.validateSSHConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either password or private key is required');
    });

    it('should validate private key when no credentials provided', () => {
      const configWithoutKey = {
        hostname: 'example.com',
        port: 22,
        username: 'user',
        // No password or privateKey provided
      };

      const result = securityManager.validateSSHConfig(configWithoutKey);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either password or private key is required');
    });

    it('should accept valid key authentication config', () => {
      const validKeyConfig = {
        hostname: 'example.com',
        port: 22,
        username: 'user',
        authMethod: 'key' as const,
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
      };

      const result = securityManager.validateSSHConfig(validKeyConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Additional Security Features', () => {
    it('should handle encryption and decryption consistently', () => {
      const testData = 'sensitive information';

      // Mock the decipher to return the original test data
      mockCrypto.createDecipheriv.mockReturnValueOnce({
        update: jest.fn(() => Buffer.from(testData)),
        final: jest.fn(() => Buffer.from('')),
      });

      const encrypted = securityManager.encrypt(testData);
      const decrypted = securityManager.decrypt(encrypted);

      expect(decrypted).toBe(testData);
      expect(encrypted).not.toBe(testData);
      expect(encrypted.length).toBeGreaterThan(testData.length);
    });

    it('should generate different encrypted values for same input', () => {
      const testData = 'test data';

      // Mock different IVs for different encrypted values
      mockCrypto.randomBytes
        .mockReturnValueOnce(Buffer.from('1234567890123456')) // First IV
        .mockReturnValueOnce(Buffer.from('6543210987654321')); // Second IV

      // Mock deciphers to return the original data
      mockCrypto.createDecipheriv
        .mockReturnValueOnce({
          update: jest.fn(() => Buffer.from(testData)),
          final: jest.fn(() => Buffer.from('')),
        })
        .mockReturnValueOnce({
          update: jest.fn(() => Buffer.from(testData)),
          final: jest.fn(() => Buffer.from('')),
        });

      const encrypted1 = securityManager.encrypt(testData);
      const encrypted2 = securityManager.encrypt(testData);

      expect(encrypted1).not.toBe(encrypted2); // Due to random IV
      expect(securityManager.decrypt(encrypted1)).toBe(testData);
      expect(securityManager.decrypt(encrypted2)).toBe(testData);
    });

    it('should handle empty string encryption', () => {
      // Mock decipher to return empty string
      mockCrypto.createDecipheriv.mockReturnValueOnce({
        update: jest.fn(() => Buffer.from('')),
        final: jest.fn(() => Buffer.from('')),
      });

      const encrypted = securityManager.encrypt('');
      const decrypted = securityManager.decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle special characters in encryption', () => {
      const specialData = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      // Mock decipher to return the special characters
      mockCrypto.createDecipheriv.mockReturnValueOnce({
        update: jest.fn(() => Buffer.from(specialData)),
        final: jest.fn(() => Buffer.from('')),
      });

      const encrypted = securityManager.encrypt(specialData);
      const decrypted = securityManager.decrypt(encrypted);

      expect(decrypted).toBe(specialData);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid encrypted data gracefully', () => {
      expect(() => {
        securityManager.decrypt('invalid-encrypted-data');
      }).toThrow();
    });

    it('should handle malformed encrypted data', () => {
      expect(() => {
        securityManager.decrypt('not:valid:format');
      }).toThrow();
    });

    it('should handle empty encrypted data', () => {
      expect(() => {
        securityManager.decrypt('');
      }).toThrow();
    });

    it('should validate SSH config with missing required fields', () => {
      const incompleteConfig = {
        hostname: 'test.com'
        // Missing username, port, etc.
      };

      const result = securityManager.validateSSHConfig(incompleteConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle SSH config validation with null values', () => {
      const configWithNulls = {
        hostname: null,
        port: null,
        username: null
      };

      const result = securityManager.validateSSHConfig(configWithNulls);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Log Data Sanitization', () => {
    it('should sanitize sensitive fields in log data', () => {
      const logData = {
        username: 'testuser',
        password: 'secret123',
        privateKey: 'ssh-rsa AAAAB3...',
        hostname: 'example.com',
      };

      const sanitized = securityManager.sanitizeLogData(logData);
      
      expect(sanitized.username).toBe('testuser');
      expect(sanitized.hostname).toBe('example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.privateKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const logData = {
        config: {
          auth: {
            password: 'secret',
            key: 'private-key-data',
          },
          connection: {
            hostname: 'example.com',
          },
        },
      };

      const sanitized = securityManager.sanitizeLogData(logData);
      
      expect(sanitized.config.connection.hostname).toBe('example.com');
      expect(sanitized.config.auth.password).toBe('[REDACTED]');
      expect(sanitized.config.auth.key).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const logData = {
        connections: [
          { hostname: 'server1.com', password: 'secret1' },
          { hostname: 'server2.com', token: 'secret2' },
        ],
      };

      const sanitized = securityManager.sanitizeLogData(logData);
      
      expect(sanitized.connections[0].hostname).toBe('server1.com');
      expect(sanitized.connections[0].password).toBe('[REDACTED]');
      expect(sanitized.connections[1].hostname).toBe('server2.com');
      expect(sanitized.connections[1].token).toBe('[REDACTED]');
    });

    it('should handle non-object inputs', () => {
      expect(securityManager.sanitizeLogData('string')).toBe('string');
      expect(securityManager.sanitizeLogData(123)).toBe(123);
      expect(securityManager.sanitizeLogData(null)).toBe(null);
      expect(securityManager.sanitizeLogData(undefined)).toBe(undefined);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Reset rate limiting state
      (securityManager as any).connectionAttempts.clear();
    });

    it('should allow first connection attempt', () => {
      const result = securityManager.checkRateLimit('user1');
      expect(result).toBe(true);
    });

    it('should allow multiple attempts within limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = securityManager.checkRateLimit('user1');
        expect(result).toBe(true);
      }
    });

    it('should block attempts after exceeding limit', () => {
      // Exceed the default limit of 5 attempts
      for (let i = 0; i < 5; i++) {
        securityManager.checkRateLimit('user1');
      }
      
      const blocked = securityManager.checkRateLimit('user1');
      expect(blocked).toBe(false);
    });

    it('should track different users separately', () => {
      // Max out user1
      for (let i = 0; i < 5; i++) {
        securityManager.checkRateLimit('user1');
      }
      
      // user2 should still be allowed
      const user2Result = securityManager.checkRateLimit('user2');
      expect(user2Result).toBe(true);
      
      // user1 should be blocked
      const user1Result = securityManager.checkRateLimit('user1');
      expect(user1Result).toBe(false);
    });

    it('should respect custom limits', () => {
      // Allow only 2 attempts
      securityManager.checkRateLimit('user1', 2);
      securityManager.checkRateLimit('user1', 2);
      
      const blocked = securityManager.checkRateLimit('user1', 2);
      expect(blocked).toBe(false);
    });

    it('should reset after time window expires', () => {
      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Max out attempts
      for (let i = 0; i < 5; i++) {
        securityManager.checkRateLimit('user1');
      }
      
      // Should be blocked
      expect(securityManager.checkRateLimit('user1')).toBe(false);
      
      // Advance time beyond window (default 5 minutes = 300000ms)
      mockTime += 300001;
      
      // Should be allowed again
      expect(securityManager.checkRateLimit('user1')).toBe(true);
      
      // Restore original Date.now
      Date.now = originalNow;
    });
  });
});
