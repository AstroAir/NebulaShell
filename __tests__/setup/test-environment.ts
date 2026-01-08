import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface TestSSHServer {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  purpose: string;
}

export interface TestEnvironment {
  servers: TestSSHServer[];
  isRunning: boolean;
  dockerProcess?: ChildProcess;
}

export class TestEnvironmentManager {
  private environment: TestEnvironment = {
    servers: [
      {
        name: 'primary',
        host: 'localhost',
        port: 2222,
        username: 'testuser',
        password: 'testpass',
        purpose: 'General SSH testing'
      },
      {
        name: 'secondary',
        host: 'localhost',
        port: 2223,
        username: 'testuser2',
        password: 'testpass2',
        purpose: 'Multi-connection testing'
      },
      {
        name: 'slow',
        host: 'localhost',
        port: 2224,
        username: 'slowuser',
        password: 'slowpass',
        purpose: 'Timeout and performance testing'
      },
      {
        name: 'sftp',
        host: 'localhost',
        port: 2225,
        username: 'sftpuser',
        password: 'sftppass',
        purpose: 'SFTP and file transfer testing'
      }
    ],
    isRunning: false
  };

  async setupEnvironment(): Promise<void> {
    console.log('Setting up test environment...');
    
    // Create test files directory
    await this.createTestFiles();
    
    // Start Docker containers
    await this.startDockerContainers();
    
    // Wait for services to be ready
    await this.waitForServices();
    
    this.environment.isRunning = true;
    console.log('Test environment ready!');
  }

  async teardownEnvironment(): Promise<void> {
    console.log('Tearing down test environment...');
    
    if (this.environment.dockerProcess) {
      this.environment.dockerProcess.kill();
    }
    
    // Stop Docker containers
    await this.stopDockerContainers();
    
    // Clean up test files
    await this.cleanupTestFiles();
    
    this.environment.isRunning = false;
    console.log('Test environment cleaned up!');
  }

  getServer(name: string): TestSSHServer | undefined {
    return this.environment.servers.find(server => server.name === name);
  }

  getAllServers(): TestSSHServer[] {
    return [...this.environment.servers];
  }

  isEnvironmentReady(): boolean {
    return this.environment.isRunning;
  }

  private async createTestFiles(): Promise<void> {
    const testFilesDir = path.join(__dirname, 'test-files');
    
    try {
      await fs.mkdir(testFilesDir, { recursive: true });
      
      // Create various test files
      await fs.writeFile(
        path.join(testFilesDir, 'small-file.txt'),
        'This is a small test file for upload/download testing.'
      );
      
      await fs.writeFile(
        path.join(testFilesDir, 'medium-file.txt'),
        'A'.repeat(1024 * 10) // 10KB file
      );
      
      await fs.writeFile(
        path.join(testFilesDir, 'large-file.txt'),
        'B'.repeat(1024 * 100) // 100KB file
      );
      
      // Create a test script
      await fs.writeFile(
        path.join(testFilesDir, 'test-script.sh'),
        '#!/bin/bash\necho "Test script executed at $(date)"\necho "Arguments: $@"'
      );
      
      console.log('Test files created successfully');
    } catch (error) {
      console.error('Failed to create test files:', error);
      throw error;
    }
  }

  private async startDockerContainers(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dockerComposePath = path.join(__dirname, 'docker-compose.test.yml');
      
      const process = spawn('docker-compose', [
        '-f', dockerComposePath,
        'up', '-d', '--build'
      ], {
        stdio: 'pipe'
      });

      let errorOutput = '';

      process.stdout?.on('data', () => {
        // Output captured but not used
      });

      process.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('Docker containers started successfully');
          resolve();
        } else {
          console.error('Failed to start Docker containers:', errorOutput);
          reject(new Error(`Docker compose failed with code ${code}: ${errorOutput}`));
        }
      });

      this.environment.dockerProcess = process;
    });
  }

  private async stopDockerContainers(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dockerComposePath = path.join(__dirname, 'docker-compose.test.yml');
      
      const process = spawn('docker-compose', [
        '-f', dockerComposePath,
        'down', '-v'
      ], {
        stdio: 'pipe'
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('Docker containers stopped successfully');
          resolve();
        } else {
          console.error('Failed to stop Docker containers');
          reject(new Error(`Docker compose down failed with code ${code}`));
        }
      });
    });
  }

  private async waitForServices(): Promise<void> {
    console.log('Waiting for SSH services to be ready...');
    
    const maxRetries = 30;
    const retryDelay = 2000; // 2 seconds
    
    for (const server of this.environment.servers) {
      let retries = 0;
      let isReady = false;
      
      while (retries < maxRetries && !isReady) {
        try {
          await this.checkSSHConnection(server);
          isReady = true;
          console.log(`SSH server ${server.name} is ready`);
        } catch {
          retries++;
          if (retries < maxRetries) {
            console.log(`Waiting for SSH server ${server.name}... (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            throw new Error(`SSH server ${server.name} failed to start after ${maxRetries} attempts`);
          }
        }
      }
    }
  }

  private async checkSSHConnection(server: TestSSHServer): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      const process = spawn('nc', ['-z', server.host, server.port.toString()], {
        stdio: 'pipe'
      });

      process.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Connection check failed for ${server.name}`));
        }
      });

      process.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private async cleanupTestFiles(): Promise<void> {
    const testFilesDir = path.join(__dirname, 'test-files');
    
    try {
      await fs.rm(testFilesDir, { recursive: true, force: true });
      console.log('Test files cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup test files:', error);
    }
  }
}

// Global test environment instance
export const testEnvironment = new TestEnvironmentManager();
