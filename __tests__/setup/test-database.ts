import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface TestDatabaseConfig {
  name: string;
  path: string;
  schema: Record<string, any>;
}

export interface TestFileSystemConfig {
  baseDir: string;
  directories: string[];
  files: Array<{
    path: string;
    content: string;
    permissions?: string;
  }>;
}

export class TestDatabaseManager {
  private databases: Map<string, TestDatabaseConfig> = new Map();
  private tempDir: string;
  private fileSystem: TestFileSystemConfig | null = null;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), `terminal-test-${Date.now()}`);
  }

  async initialize(): Promise<void> {
    console.log('Initializing test database and file system...');
    
    // Create temporary directory
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // Initialize test databases
    await this.initializeTestDatabases();
    
    // Set up test file system
    await this.setupTestFileSystem();
    
    console.log(`Test environment initialized at: ${this.tempDir}`);
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up test database and file system...');
    
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      console.log('Test environment cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup test environment:', error);
    }
  }

  private async initializeTestDatabases(): Promise<void> {
    // Connection profiles database
    const connectionProfilesDB: TestDatabaseConfig = {
      name: 'connection-profiles',
      path: path.join(this.tempDir, 'connection-profiles.json'),
      schema: {
        profiles: [
          {
            id: 'test-profile-1',
            name: 'Test Server 1',
            hostname: 'localhost',
            port: 2222,
            username: 'testuser',
            password: 'testpass',
            tags: ['test', 'development'],
            createdAt: new Date().toISOString(),
          },
          {
            id: 'test-profile-2',
            name: 'Test Server 2',
            hostname: 'localhost',
            port: 2223,
            username: 'testuser2',
            password: 'testpass2',
            tags: ['test', 'staging'],
            createdAt: new Date().toISOString(),
          },
        ],
      },
    };

    // Terminal history database
    const terminalHistoryDB: TestDatabaseConfig = {
      name: 'terminal-history',
      path: path.join(this.tempDir, 'terminal-history.json'),
      schema: {
        sessions: {
          'test-session-1': {
            sessionId: 'test-session-1',
            entries: [
              {
                id: 'cmd-1',
                command: 'ls -la',
                timestamp: new Date().toISOString(),
                exitCode: 0,
                output: 'total 24\ndrwxr-xr-x 5 testuser testuser 4096 Jan 15 10:30 .',
              },
              {
                id: 'cmd-2',
                command: 'pwd',
                timestamp: new Date().toISOString(),
                exitCode: 0,
                output: '/home/testuser',
              },
            ],
          },
        },
      },
    };

    // SSH keys database
    const sshKeysDB: TestDatabaseConfig = {
      name: 'ssh-keys',
      path: path.join(this.tempDir, 'ssh-keys.json'),
      schema: {
        keys: [
          {
            id: 'test-key-1',
            name: 'Test RSA Key',
            type: 'rsa',
            bits: 2048,
            fingerprint: 'SHA256:test-fingerprint-1',
            publicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... test-key',
            privateKey: '-----BEGIN RSA PRIVATE KEY-----\ntest-private-key\n-----END RSA PRIVATE KEY-----',
            createdAt: new Date().toISOString(),
            useCount: 5,
            isDefault: true,
          },
        ],
      },
    };

    // Terminal settings database
    const terminalSettingsDB: TestDatabaseConfig = {
      name: 'terminal-settings',
      path: path.join(this.tempDir, 'terminal-settings.json'),
      schema: {
        settings: {
          theme: 'default-dark',
          fontSize: 14,
          fontFamily: 'Cascadia Code',
          cursorBlink: true,
          cursorStyle: 'block',
          scrollback: 1000,
          tabStopWidth: 4,
          allowTransparency: false,
          minimumContrastRatio: 4.5,
        },
        themes: {
          'default-dark': {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#ffffff',
            selection: '#264f78',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
          },
        },
      },
    };

    // Write all databases to disk
    const databases = [
      connectionProfilesDB,
      terminalHistoryDB,
      sshKeysDB,
      terminalSettingsDB,
    ];

    for (const db of databases) {
      await fs.writeFile(db.path, JSON.stringify(db.schema, null, 2));
      this.databases.set(db.name, db);
      console.log(`Created test database: ${db.name}`);
    }
  }

  private async setupTestFileSystem(): Promise<void> {
    const fileSystemConfig: TestFileSystemConfig = {
      baseDir: path.join(this.tempDir, 'filesystem'),
      directories: [
        'home/testuser',
        'home/testuser/documents',
        'home/testuser/projects',
        'home/testuser/.ssh',
        'tmp',
        'var/log',
      ],
      files: [
        {
          path: 'home/testuser/welcome.txt',
          content: 'Hello from test server!',
        },
        {
          path: 'home/testuser/test-script.sh',
          content: '#!/bin/bash\necho "Test script executed successfully"\necho "Arguments: $@"',
          permissions: '755',
        },
        {
          path: 'home/testuser/.bashrc',
          content: `# Test .bashrc
export PATH="/usr/local/bin:/usr/bin:/bin"
export HOME="/home/testuser"
export USER="testuser"
alias ll="ls -la"
alias testcmd="echo Test command executed"
export TEST_ENV_VAR="test-value"`,
        },
        {
          path: 'home/testuser/.ssh/authorized_keys',
          content: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... test-key testuser@test-server',
          permissions: '600',
        },
        {
          path: 'home/testuser/documents/readme.md',
          content: '# Test Document\n\nThis is a test document for file operations.',
        },
        {
          path: 'home/testuser/projects/sample.js',
          content: 'console.log("Hello from sample project!");',
        },
        {
          path: 'tmp/test-temp-file.txt',
          content: 'Temporary test file content',
        },
        {
          path: 'var/log/test.log',
          content: `2024-01-15 10:30:00 INFO Test log entry 1
2024-01-15 10:31:00 WARN Test log entry 2
2024-01-15 10:32:00 ERROR Test log entry 3`,
        },
      ],
    };

    // Create directories
    for (const dir of fileSystemConfig.directories) {
      const fullPath = path.join(fileSystemConfig.baseDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }

    // Create files
    for (const file of fileSystemConfig.files) {
      const fullPath = path.join(fileSystemConfig.baseDir, file.path);
      await fs.writeFile(fullPath, file.content);
      
      if (file.permissions) {
        await fs.chmod(fullPath, parseInt(file.permissions, 8));
      }
    }

    this.fileSystem = fileSystemConfig;
    console.log(`Created test file system at: ${fileSystemConfig.baseDir}`);
  }

  // Database access methods
  async getDatabase(name: string): Promise<any> {
    const db = this.databases.get(name);
    if (!db) {
      throw new Error(`Database ${name} not found`);
    }

    const content = await fs.readFile(db.path, 'utf-8');
    return JSON.parse(content);
  }

  async updateDatabase(name: string, data: any): Promise<void> {
    const db = this.databases.get(name);
    if (!db) {
      throw new Error(`Database ${name} not found`);
    }

    await fs.writeFile(db.path, JSON.stringify(data, null, 2));
  }

  // File system access methods
  getFileSystemPath(relativePath: string = ''): string {
    if (!this.fileSystem) {
      throw new Error('File system not initialized');
    }
    return path.join(this.fileSystem.baseDir, relativePath);
  }

  async readTestFile(relativePath: string): Promise<string> {
    const fullPath = this.getFileSystemPath(relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async writeTestFile(relativePath: string, content: string): Promise<void> {
    const fullPath = this.getFileSystemPath(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  async deleteTestFile(relativePath: string): Promise<void> {
    const fullPath = this.getFileSystemPath(relativePath);
    await fs.unlink(fullPath);
  }

  async listTestDirectory(relativePath: string = ''): Promise<string[]> {
    const fullPath = this.getFileSystemPath(relativePath);
    return await fs.readdir(fullPath);
  }

  // Utility methods
  getTempDir(): string {
    return this.tempDir;
  }

  getDatabasePath(name: string): string {
    const db = this.databases.get(name);
    if (!db) {
      throw new Error(`Database ${name} not found`);
    }
    return db.path;
  }

  getAllDatabases(): TestDatabaseConfig[] {
    return Array.from(this.databases.values());
  }
}

// Global test database instance
export const testDatabase = new TestDatabaseManager();
