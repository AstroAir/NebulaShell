import { enhancedSSHMock } from '../mocks/ssh';
import { testDatabase } from '../setup/test-database';

describe('Command Execution and Shell Interaction Validation', () => {
  let sessionId: string;

  beforeAll(async () => {
    await testDatabase.initialize();
  });

  afterAll(async () => {
    await testDatabase.cleanup();
  });

  beforeEach(() => {
    sessionId = `test-session-${Date.now()}`;
    enhancedSSHMock.createSession(sessionId);
    enhancedSSHMock.connect(sessionId);
  });

  afterEach(() => {
    enhancedSSHMock.clearSessions();
  });

  describe('Basic Command Execution', () => {
    it('should execute simple commands and return output', async () => {
      const testCases = [
        { command: 'pwd', expectedPattern: /\/home\/testuser/ },
        { command: 'whoami', expectedPattern: /testuser/ },
        { command: 'echo "Hello World"', expectedPattern: /Hello World/ },
        { command: 'date', expectedPattern: /\d{4}/ }, // Should contain year
      ];

      for (const testCase of testCases) {
        const result = await enhancedSSHMock.executeCommand(sessionId, testCase.command);
        expect(result).toMatch(testCase.expectedPattern);
      }
    });

    it('should handle commands with arguments', async () => {
      const result = await enhancedSSHMock.executeCommand(sessionId, 'ls -la');
      
      expect(result).toContain('total');
      expect(result).toContain('drwxr-xr-x');
      expect(result).toContain('testuser');
    });

    it('should handle commands with pipes and redirections', async () => {
      // Add custom command for pipe testing
      enhancedSSHMock.addCustomCommand(
        'ls | grep txt',
        'welcome.txt'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'ls | grep txt');
      expect(result).toContain('welcome.txt');
    });

    it('should handle command chaining with &&', async () => {
      enhancedSSHMock.addCustomCommand(
        'pwd && whoami',
        '/home/testuser\ntestuser'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'pwd && whoami');
      expect(result).toContain('/home/testuser');
      expect(result).toContain('testuser');
    });
  });

  describe('File System Operations', () => {
    it('should handle file reading operations', async () => {
      const result = await enhancedSSHMock.executeCommand(sessionId, 'cat welcome.txt');
      expect(result).toBe('Hello from test server!');
    });

    it('should handle directory navigation', async () => {
      await enhancedSSHMock.executeCommand(sessionId, 'cd documents');
      const pwdResult = await enhancedSSHMock.executeCommand(sessionId, 'pwd');
      
      expect(pwdResult).toContain('documents');
    });

    it('should handle relative path navigation', async () => {
      await enhancedSSHMock.executeCommand(sessionId, 'cd documents');
      await enhancedSSHMock.executeCommand(sessionId, 'cd ..');
      const pwdResult = await enhancedSSHMock.executeCommand(sessionId, 'pwd');
      
      expect(pwdResult).toBe('/home/testuser');
    });

    it('should handle file creation and modification', async () => {
      enhancedSSHMock.addCustomCommand(
        'touch newfile.txt',
        ''
      );

      enhancedSSHMock.addCustomCommand(
        'echo "test content" > newfile.txt',
        ''
      );

      enhancedSSHMock.addCustomCommand(
        'cat newfile.txt',
        'test content'
      );

      await enhancedSSHMock.executeCommand(sessionId, 'touch newfile.txt');
      await enhancedSSHMock.executeCommand(sessionId, 'echo "test content" > newfile.txt');
      const result = await enhancedSSHMock.executeCommand(sessionId, 'cat newfile.txt');
      
      expect(result).toBe('test content');
    });

    it('should handle file permissions and ownership', async () => {
      enhancedSSHMock.addCustomCommand(
        'ls -l test-script.sh',
        '-rwxr-xr-x 1 testuser testuser 65 Jan 15 10:30 test-script.sh'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'ls -l test-script.sh');
      expect(result).toContain('-rwxr-xr-x');
      expect(result).toContain('testuser');
    });
  });

  describe('Environment and Variables', () => {
    it('should handle environment variable operations', async () => {
      await enhancedSSHMock.executeCommand(sessionId, 'export TEST_VAR=test_value');
      
      enhancedSSHMock.addCustomCommand(
        'echo $TEST_VAR',
        'test_value'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'echo $TEST_VAR');
      expect(result).toBe('test_value');
    });

    it('should handle built-in environment variables', async () => {
      enhancedSSHMock.addCustomCommand(
        'echo $HOME',
        '/home/testuser'
      );

      enhancedSSHMock.addCustomCommand(
        'echo $USER',
        'testuser'
      );

      const homeResult = await enhancedSSHMock.executeCommand(sessionId, 'echo $HOME');
      const userResult = await enhancedSSHMock.executeCommand(sessionId, 'echo $USER');
      
      expect(homeResult).toBe('/home/testuser');
      expect(userResult).toBe('testuser');
    });

    it('should handle PATH variable and command resolution', async () => {
      enhancedSSHMock.addCustomCommand(
        'echo $PATH',
        '/usr/local/bin:/usr/bin:/bin'
      );

      enhancedSSHMock.addCustomCommand(
        'which ls',
        '/bin/ls'
      );

      const pathResult = await enhancedSSHMock.executeCommand(sessionId, 'echo $PATH');
      const whichResult = await enhancedSSHMock.executeCommand(sessionId, 'which ls');
      
      expect(pathResult).toContain('/bin');
      expect(whichResult).toBe('/bin/ls');
    });
  });

  describe('Process Management', () => {
    it('should handle process listing', async () => {
      const result = await enhancedSSHMock.executeCommand(sessionId, 'ps aux');
      
      expect(result).toContain('USER');
      expect(result).toContain('PID');
      expect(result).toContain('testuser');
    });

    it('should handle background processes', async () => {
      enhancedSSHMock.addCustomCommand(
        'sleep 10 &',
        '[1] 1234'
      );

      enhancedSSHMock.addCustomCommand(
        'jobs',
        '[1]+  Running                 sleep 10 &'
      );

      await enhancedSSHMock.executeCommand(sessionId, 'sleep 10 &');
      const jobsResult = await enhancedSSHMock.executeCommand(sessionId, 'jobs');
      
      expect(jobsResult).toContain('Running');
      expect(jobsResult).toContain('sleep 10');
    });

    it('should handle process termination', async () => {
      enhancedSSHMock.addCustomCommand(
        'kill 1234',
        ''
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'kill 1234');
      expect(result).toBe('');
    });
  });

  describe('Interactive Commands', () => {
    it('should handle interactive command initiation', async () => {
      const interactivePromise = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interactive_start', (id, command) => {
          expect(id).toBe(sessionId);
          expect(command).toBe('top');
          resolve();
        });
      });

      await enhancedSSHMock.executeCommand(sessionId, 'top');
      await interactivePromise;
    });

    it('should handle vim editor simulation', async () => {
      const interactivePromise = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interactive_start', (id, command) => {
          expect(id).toBe(sessionId);
          expect(command).toBe('vim test.txt');
          resolve();
        });
      });

      const result = await enhancedSSHMock.executeCommand(sessionId, 'vim test.txt');
      expect(result).toContain('\x1b[?1049h'); // Vim alternate screen
      
      await interactivePromise;
    });

    it('should handle command interruption with Ctrl+C', async () => {
      const interruptPromise = new Promise<void>((resolve) => {
        enhancedSSHMock.once('interrupted', (id) => {
          expect(id).toBe(sessionId);
          resolve();
        });
      });

      await enhancedSSHMock.executeCommand(sessionId, 'ping google.com');
      enhancedSSHMock.interrupt(sessionId);
      
      await interruptPromise;
    });
  });

  describe('Command History and Completion', () => {
    it('should maintain command history', async () => {
      const commands = ['pwd', 'ls', 'whoami', 'date'];
      
      for (const command of commands) {
        await enhancedSSHMock.executeCommand(sessionId, command);
      }
      
      const historyResult = await enhancedSSHMock.executeCommand(sessionId, 'history');
      
      commands.forEach(command => {
        expect(historyResult).toContain(command);
      });
    });

    it('should handle history navigation', async () => {
      await enhancedSSHMock.executeCommand(sessionId, 'pwd');
      await enhancedSSHMock.executeCommand(sessionId, 'ls');
      
      // Simulate up arrow key (history navigation)
      enhancedSSHMock.addCustomCommand(
        '!!',
        'ls' // Last command
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, '!!');
      expect(result).toBe('ls');
    });

    it('should handle command aliases', async () => {
      enhancedSSHMock.addCustomCommand(
        'll',
        'total 24\ndrwxr-xr-x 5 testuser testuser 4096 Jan 15 10:30 .'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'll');
      expect(result).toContain('total');
      expect(result).toContain('drwxr-xr-x');
    });
  });

  describe('Error Handling', () => {
    it('should handle command not found errors', async () => {
      const result = await enhancedSSHMock.executeCommand(sessionId, 'nonexistent-command');
      expect(result).toContain('command not found');
    });

    it('should handle permission denied errors', async () => {
      enhancedSSHMock.addCustomCommand(
        'cat /etc/shadow',
        'cat: /etc/shadow: Permission denied'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'cat /etc/shadow');
      expect(result).toContain('Permission denied');
    });

    it('should handle file not found errors', async () => {
      enhancedSSHMock.addCustomCommand(
        'cat nonexistent.txt',
        'cat: nonexistent.txt: No such file or directory'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'cat nonexistent.txt');
      expect(result).toContain('No such file or directory');
    });

    it('should handle syntax errors in commands', async () => {
      enhancedSSHMock.addCustomCommand(
        'ls |',
        'bash: syntax error near unexpected token `|`'
      );

      const result = await enhancedSSHMock.executeCommand(sessionId, 'ls |');
      expect(result).toContain('syntax error');
    });
  });

  describe('Performance and Timing', () => {
    it('should handle commands with delays', async () => {
      enhancedSSHMock.addCustomCommand(
        'slow-command',
        'Command completed after delay',
        { delay: 100 }
      );

      const startTime = Date.now();
      const result = await enhancedSSHMock.executeCommand(sessionId, 'slow-command');
      const endTime = Date.now();
      
      expect(result).toBe('Command completed after delay');
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle streaming output commands', async () => {
      const streamData: string[] = [];
      
      enhancedSSHMock.on('data', (id, data) => {
        if (id === sessionId) {
          streamData.push(data);
        }
      });

      const streamComplete = new Promise<void>((resolve) => {
        enhancedSSHMock.once('stream_complete', (id) => {
          if (id === sessionId) {
            resolve();
          }
        });
      });

      await enhancedSSHMock.executeCommand(sessionId, 'ping google.com');
      await streamComplete;
      
      expect(streamData.length).toBeGreaterThan(0);
      expect(streamData.some(data => data.includes('bytes from'))).toBe(true);
    });

    it('should handle concurrent command execution', async () => {
      const commands = ['pwd', 'whoami', 'ls', 'date', 'echo test'];
      
      const startTime = Date.now();
      const results = await Promise.all(
        commands.map(command => enhancedSSHMock.executeCommand(sessionId, command))
      );
      const endTime = Date.now();
      
      expect(results).toHaveLength(commands.length);
      results.forEach(result => {
        expect(typeof result).toBe('string');
      });
      
      // Should complete reasonably quickly for concurrent execution
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
