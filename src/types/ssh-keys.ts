export interface SSHKey {
  id: string;
  name: string;
  description?: string;
  type: 'rsa' | 'ed25519' | 'ecdsa' | 'dsa';
  bits: number;
  fingerprint: string;
  publicKey: string;
  privateKey: string; // Encrypted
  passphrase?: string; // Encrypted
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
  tags: string[];
  isDefault: boolean;
}

export interface SSHKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

export interface KeyGenerationOptions {
  type: 'rsa' | 'ed25519' | 'ecdsa';
  bits?: number; // For RSA keys
  passphrase?: string;
  comment?: string;
}

export interface KeyImportOptions {
  name: string;
  description?: string;
  privateKey: string;
  publicKey?: string;
  passphrase?: string;
  tags?: string[];
}

export interface KeyExportOptions {
  format: 'openssh' | 'pem' | 'putty';
  includePublic: boolean;
  includePrivate: boolean;
  encryptPrivate: boolean;
  passphrase?: string;
}

export interface KeyValidationResult {
  isValid: boolean;
  type?: string;
  bits?: number;
  fingerprint?: string;
  hasPassphrase?: boolean;
  errors: string[];
}

export interface KeyUsageRecord {
  keyId: string;
  hostname: string;
  username: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface KeyManagerState {
  keys: Map<string, SSHKey>;
  defaultKeyId?: string;
  usageHistory: KeyUsageRecord[];
}
