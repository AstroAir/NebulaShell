import { EventEmitter } from 'events';
import * as forge from 'node-forge';
import * as CryptoJS from 'crypto-js';
import { 
  SSHKey, 
  SSHKeyPair, 
  KeyGenerationOptions, 
  KeyImportOptions,
  KeyExportOptions,
  KeyValidationResult,
  KeyUsageRecord,
  KeyManagerState 
} from '@/types/ssh-keys';
import { logger } from './logger';

export class SSHKeyManager extends EventEmitter {
  private state: KeyManagerState = {
    keys: new Map(),
    usageHistory: [],
  };
  private storageKey = 'webssh_ssh_keys';
  private encryptionKey = 'webssh_key_encryption'; // In production, use a proper key

  constructor() {
    super();
    this.loadFromStorage();
  }

  // Key Generation
  async generateKeyPair(options: KeyGenerationOptions): Promise<SSHKeyPair> {
    try {
      switch (options.type) {
        case 'rsa':
          return this.generateRSAKey(options.bits || 2048, options.passphrase, options.comment);
        case 'ed25519':
          return this.generateEd25519Key(options.passphrase, options.comment);
        default:
          throw new Error(`Key type ${options.type} not supported`);
      }
    } catch (error) {
      logger.error('Key generation failed', { 
        type: options.type, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  private generateRSAKey(bits: number, passphrase?: string, comment?: string): SSHKeyPair {
    const keypair = forge.pki.rsa.generateKeyPair({ bits });
    
    let privateKeyPem: string;
    if (passphrase) {
      privateKeyPem = forge.pki.encryptRsaPrivateKey(keypair.privateKey, passphrase);
    } else {
      privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
    }

    const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
    const publicKeySSH = this.convertPemToSSH(publicKeyPem, 'rsa', comment);
    const fingerprint = this.generateFingerprint(publicKeyPem);

    return {
      privateKey: privateKeyPem,
      publicKey: publicKeySSH,
      fingerprint,
    };
  }

  private generateEd25519Key(passphrase?: string, comment?: string): SSHKeyPair {
    // Note: node-forge doesn't support Ed25519, so this is a simplified implementation
    // In a real application, you'd use a library that supports Ed25519
    throw new Error('Ed25519 key generation not implemented in this demo');
  }

  private convertPemToSSH(publicKeyPem: string, type: string, comment?: string): string {
    // Convert PEM public key to SSH format
    // This is a simplified implementation
    const key = forge.pki.publicKeyFromPem(publicKeyPem);
    const sshKey = forge.ssh.publicKeyToOpenSSH(key, comment || '');
    return sshKey;
  }

  private generateFingerprint(publicKeyPem: string): string {
    const key = forge.pki.publicKeyFromPem(publicKeyPem);
    const sshKey = forge.ssh.publicKeyToOpenSSH(key);
    const md = forge.md.sha256.create();
    md.update(sshKey);
    return md.digest().toHex();
  }

  // Key Management
  async createKey(
    name: string,
    keyPair: SSHKeyPair,
    options: {
      description?: string;
      type: 'rsa' | 'ed25519' | 'ecdsa' | 'dsa';
      bits: number;
      passphrase?: string;
      tags?: string[];
    }
  ): Promise<SSHKey> {
    const key: SSHKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: options.description,
      type: options.type,
      bits: options.bits,
      fingerprint: keyPair.fingerprint,
      publicKey: keyPair.publicKey,
      privateKey: this.encryptData(keyPair.privateKey),
      passphrase: options.passphrase ? this.encryptData(options.passphrase) : undefined,
      createdAt: new Date(),
      useCount: 0,
      tags: options.tags || [],
      isDefault: this.state.keys.size === 0, // First key becomes default
    };

    this.state.keys.set(key.id, key);
    
    if (key.isDefault) {
      this.state.defaultKeyId = key.id;
    }

    this.saveToStorage();
    this.emit('keyCreated', key);
    
    logger.info('SSH key created', { keyId: key.id, name, type: options.type });
    return key;
  }

  async importKey(options: KeyImportOptions): Promise<SSHKey> {
    const validation = this.validateKey(options.privateKey, options.publicKey);
    if (!validation.isValid) {
      throw new Error(`Invalid key: ${validation.errors.join(', ')}`);
    }

    const keyPair: SSHKeyPair = {
      privateKey: options.privateKey,
      publicKey: options.publicKey || this.extractPublicKey(options.privateKey),
      fingerprint: validation.fingerprint || '',
    };

    return this.createKey(options.name, keyPair, {
      description: options.description,
      type: validation.type as any,
      bits: validation.bits || 0,
      passphrase: options.passphrase,
      tags: options.tags,
    });
  }

  private extractPublicKey(privateKey: string): string {
    try {
      const key = forge.pki.privateKeyFromPem(privateKey);
      const publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
      return forge.ssh.publicKeyToOpenSSH(publicKey);
    } catch (error) {
      throw new Error('Failed to extract public key from private key');
    }
  }

  validateKey(privateKey: string, publicKey?: string): KeyValidationResult {
    const errors: string[] = [];
    let isValid = true;
    let type: string | undefined;
    let bits: number | undefined;
    let fingerprint: string | undefined;
    let hasPassphrase = false;

    try {
      // Try to parse private key
      let key: forge.pki.PrivateKey;
      try {
        key = forge.pki.privateKeyFromPem(privateKey);
      } catch {
        // Try with passphrase (we can't validate without the actual passphrase)
        hasPassphrase = true;
        throw new Error('Private key appears to be encrypted');
      }

      // Determine key type and bits
      if ((key as any).n && (key as any).e) {
        type = 'rsa';
        bits = (key as any).n.bitLength();
      }

      // Generate fingerprint
      const publicKeyPem = forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey((key as any).n, (key as any).e));
      fingerprint = this.generateFingerprint(publicKeyPem);

      // Validate public key if provided
      if (publicKey) {
        try {
          // Basic validation - check if it looks like an SSH public key
          if (!publicKey.startsWith('ssh-') && !publicKey.startsWith('ecdsa-') && !publicKey.startsWith('ssh-ed25519')) {
            throw new Error('Invalid public key format');
          }
          // Additional validation could be done here
        } catch {
          errors.push('Invalid public key format');
          isValid = false;
        }
      }

    } catch (error) {
      if (!hasPassphrase) {
        errors.push('Invalid private key format');
        isValid = false;
      }
    }

    return {
      isValid,
      type,
      bits,
      fingerprint,
      hasPassphrase,
      errors,
    };
  }

  getKey(keyId: string): SSHKey | null {
    return this.state.keys.get(keyId) || null;
  }

  getAllKeys(): SSHKey[] {
    return Array.from(this.state.keys.values());
  }

  getDefaultKey(): SSHKey | null {
    if (!this.state.defaultKeyId) return null;
    return this.state.keys.get(this.state.defaultKeyId) || null;
  }

  setDefaultKey(keyId: string): boolean {
    const key = this.state.keys.get(keyId);
    if (!key) return false;

    // Remove default from current default key
    if (this.state.defaultKeyId) {
      const currentDefault = this.state.keys.get(this.state.defaultKeyId);
      if (currentDefault) {
        currentDefault.isDefault = false;
      }
    }

    // Set new default
    key.isDefault = true;
    this.state.defaultKeyId = keyId;

    this.saveToStorage();
    this.emit('defaultKeyChanged', key);
    
    return true;
  }

  deleteKey(keyId: string): boolean {
    const key = this.state.keys.get(keyId);
    if (!key) return false;

    this.state.keys.delete(keyId);

    // If this was the default key, set a new default
    if (this.state.defaultKeyId === keyId) {
      this.state.defaultKeyId = undefined;
      const remainingKeys = Array.from(this.state.keys.values());
      if (remainingKeys.length > 0) {
        this.setDefaultKey(remainingKeys[0].id);
      }
    }

    this.saveToStorage();
    this.emit('keyDeleted', key);
    
    logger.info('SSH key deleted', { keyId, name: key.name });
    return true;
  }

  updateKey(keyId: string, updates: Partial<Pick<SSHKey, 'name' | 'description' | 'tags'>>): boolean {
    const key = this.state.keys.get(keyId);
    if (!key) return false;

    Object.assign(key, updates);
    this.saveToStorage();
    this.emit('keyUpdated', key);
    
    return true;
  }

  // Key Usage
  recordKeyUsage(keyId: string, hostname: string, username: string, success: boolean, error?: string): void {
    const key = this.state.keys.get(keyId);
    if (key) {
      key.useCount++;
      key.lastUsed = new Date();
    }

    const record: KeyUsageRecord = {
      keyId,
      hostname,
      username,
      timestamp: new Date(),
      success,
      error,
    };

    this.state.usageHistory.unshift(record);
    
    // Keep only last 100 records
    if (this.state.usageHistory.length > 100) {
      this.state.usageHistory = this.state.usageHistory.slice(0, 100);
    }

    this.saveToStorage();
    this.emit('keyUsed', record);
  }

  getKeyUsageHistory(keyId?: string): KeyUsageRecord[] {
    if (keyId) {
      return this.state.usageHistory.filter(record => record.keyId === keyId);
    }
    return [...this.state.usageHistory];
  }

  // Export/Import
  exportKey(keyId: string, options: KeyExportOptions): string {
    const key = this.state.keys.get(keyId);
    if (!key) throw new Error('Key not found');

    let result = '';

    if (options.includePublic) {
      result += `# Public Key: ${key.name}\n`;
      result += key.publicKey + '\n\n';
    }

    if (options.includePrivate) {
      result += `# Private Key: ${key.name}\n`;
      const privateKey = this.decryptData(key.privateKey);
      
      if (options.encryptPrivate && options.passphrase) {
        // Re-encrypt with new passphrase
        const key_obj = forge.pki.privateKeyFromPem(privateKey);
        result += forge.pki.encryptRsaPrivateKey(key_obj, options.passphrase);
      } else {
        result += privateKey;
      }
    }

    return result;
  }

  // Encryption helpers
  private encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  private decryptData(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Storage
  private saveToStorage(): void {
    try {
      const data = {
        keys: Array.from(this.state.keys.entries()),
        defaultKeyId: this.state.defaultKeyId,
        usageHistory: this.state.usageHistory,
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to save SSH keys to storage', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      
      if (data.keys) {
        this.state.keys = new Map(data.keys.map(([id, key]: [string, any]) => [
          id,
          {
            ...key,
            createdAt: new Date(key.createdAt),
            lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined,
          }
        ]));
      }

      if (data.defaultKeyId) {
        this.state.defaultKeyId = data.defaultKeyId;
      }

      if (data.usageHistory) {
        this.state.usageHistory = data.usageHistory.map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp),
        }));
      }
    } catch (error) {
      logger.error('Failed to load SSH keys from storage', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

export const sshKeyManager = new SSHKeyManager();
