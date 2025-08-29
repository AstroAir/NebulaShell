import { securityManager } from '../../src/lib/security'
import { SSHConnectionConfig } from '../../src/types/ssh'

describe('SecurityManager', () => {
  beforeEach(() => {
    // Reset rate limiting state
    securityManager.resetRateLimit()
  })

  describe('validateSSHConfig', () => {
    const validConfig: SSHConnectionConfig = {
      id: 'test-1',
      hostname: 'example.com',
      port: 22,
      username: 'testuser',
      password: 'testpass',
    };

    it('should validate a correct SSH config', () => {
      const result = securityManager.validateSSHConfig(validConfig)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject config with missing hostname', () => {
      const config = { ...validConfig, hostname: '' }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Hostname is required and must be a string')
    })

    it('should reject config with invalid hostname characters', () => {
      const config = { ...validConfig, hostname: 'invalid@hostname' }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Hostname contains invalid characters')
    })

    it('should reject config with invalid port', () => {
      const config = { ...validConfig, port: 0 }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Port must be a number between 1 and 65535')
    })

    it('should reject config with missing username', () => {
      const config = { ...validConfig, username: '' }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Username is required and must be a string')
    })

    it('should reject config with neither password nor private key', () => {
      const config = { ...validConfig, password: undefined }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Either password or private key is required')
    })

    it('should accept config with private key instead of password', () => {
      const config = {
        ...validConfig,
        password: undefined,
        privateKey: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END PRIVATE KEY-----',
      }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject config with invalid private key format', () => {
      const config = {
        ...validConfig,
        password: undefined,
        privateKey: 'invalid-key-format'
      }
      const result = securityManager.validateSSHConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Private key format appears to be invalid')
    })

    it('should accept any valid hostname format', () => {
      const validHostnames = [
        'example.com',
        'sub.example.com',
        'test-server.example.org',
        '192.168.1.100',
        'localhost',
      ]

      validHostnames.forEach(hostname => {
        const config = { ...validConfig, hostname }
        const result = securityManager.validateSSHConfig(config)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('checkRateLimit', () => {
    it('should allow first connection attempt', () => {
      const result = securityManager.checkRateLimit('test-identifier')
      expect(result).toBe(true)
    })

    it('should allow connections within rate limit', () => {
      const identifier = 'test-identifier-2'

      // Make multiple attempts within limit (default is 5)
      for (let i = 0; i < 4; i++) {
        const result = securityManager.checkRateLimit(identifier)
        expect(result).toBe(true)
      }
    })

    it('should block connections exceeding rate limit', () => {
      const identifier = 'test-identifier-3'

      // Exceed rate limit (default is 5 attempts)
      for (let i = 0; i < 5; i++) {
        securityManager.checkRateLimit(identifier)
      }

      const result = securityManager.checkRateLimit(identifier)
      expect(result).toBe(false)
    })

    it('should reset rate limit after time window', () => {
      const identifier = 'test-identifier-4'

      // Exceed rate limit
      for (let i = 0; i < 5; i++) {
        securityManager.checkRateLimit(identifier)
      }

      // Mock time passage (6 minutes = 360000ms, window is 300000ms)
      const originalNow = Date.now
      Date.now = jest.fn(() => originalNow() + 360000)

      const result = securityManager.checkRateLimit(identifier)
      expect(result).toBe(true)

      // Restore original Date.now
      Date.now = originalNow
    })
  })

  describe('sanitizeLogData', () => {
    it('should sanitize sensitive fields in log data', () => {
      const logData = {
        hostname: 'test.example.com',
        username: 'testuser',
        password: 'secret123',
        privateKey: 'private-key-content',
        other: 'safe-data'
      }

      const sanitized = securityManager.sanitizeLogData(logData)
      expect(sanitized.hostname).toBe('test.example.com')
      expect(sanitized.username).toBe('testuser')
      expect(sanitized.password).toBe('[REDACTED]')
      expect(sanitized.privateKey).toBe('[REDACTED]')
      expect(sanitized.other).toBe('safe-data')
    })

    it('should handle nested objects', () => {
      const logData = {
        config: {
          password: 'secret123',
          hostname: 'test.example.com'
        }
      }

      const sanitized = securityManager.sanitizeLogData(logData)
      expect(sanitized.config.password).toBe('[REDACTED]')
      expect(sanitized.config.hostname).toBe('test.example.com')
    })

    it('should handle non-object input', () => {
      expect(securityManager.sanitizeLogData('string')).toBe('string')
      expect(securityManager.sanitizeLogData(123)).toBe(123)
      expect(securityManager.sanitizeLogData(null)).toBe(null)
    })
  })

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'sensitive-password'
      const encrypted = securityManager.encrypt(originalData)
      expect(encrypted).not.toBe(originalData)
      expect(encrypted).toContain(':') // Should contain IV:authTag:encrypted format

      const decrypted = securityManager.decrypt(encrypted)
      expect(decrypted).toBe(originalData)
    })

    it('should handle empty data', () => {
      const encrypted = securityManager.encrypt('')
      const decrypted = securityManager.decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should throw error for invalid encrypted data', () => {
      expect(() => {
        securityManager.decrypt('invalid-data')
      }).toThrow('Invalid encrypted data format')
    })
  })

  describe('cleanupRateLimit', () => {
    it('should clean up old rate limit entries', () => {
      const identifier = 'test-cleanup'
      securityManager.checkRateLimit(identifier)

      // This method exists but is private, so we just test it doesn't throw
      expect(() => {
        securityManager.cleanupRateLimit()
      }).not.toThrow()
    })
  })
})
