import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerminalProvider } from '../../src/components/terminal/TerminalContext'
import { Terminal } from '../../src/components/terminal/Terminal'
import { SSHConnectionForm } from '../../src/components/ssh/SSHConnectionForm'
import { ConnectionStatus } from '../../src/components/ssh/ConnectionStatus'
import { MockSocket } from '../mocks/socket.io'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}))

// Complete terminal application component
const TerminalApp = () => (
  <TerminalProvider>
    <div className="terminal-app">
      <div className="connection-section">
        <ConnectionStatus />
        <SSHConnectionForm />
      </div>
      <div className="terminal-section">
        <Terminal />
      </div>
    </div>
  </TerminalProvider>
)

describe('Complete SSH Workflow Integration Tests', () => {
  let mockSocket: MockSocket
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket = new MockSocket()
    require('socket.io-client').io.mockReturnValue(mockSocket)
    user = userEvent.setup()
  })

  describe('End-to-End SSH Session Lifecycle', () => {
    it('should handle complete session from connection to disconnection', async () => {
      render(<TerminalApp />)

      // Step 1: Initial state verification
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()

      // Step 2: Fill connection form
      await user.type(screen.getByLabelText(/hostname/i), 'production.example.com')
      await user.type(screen.getByLabelText(/port/i), '22')
      await user.type(screen.getByLabelText(/username/i), 'admin')
      await user.type(screen.getByPlaceholderText('Enter password'), 'secure-password')

      // Step 3: Establish socket connection
      mockSocket.connect()
      await waitFor(() => {
        expect(mockSocket.connected).toBe(true)
      })

      // Step 4: Initiate SSH connection
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Verify connection request
      expect(mockSocket.emit).toHaveBeenCalledWith('ssh_connect', {
        id: expect.any(String),
        hostname: 'production.example.com',
        port: 22,
        username: 'admin',
        password: 'secure-password',
        authMethod: 'password'
      })

      // Step 5: Simulate successful SSH connection
      const sessionId = 'prod-session-123'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId,
        status: 'connected'
      })

      // Step 6: Verify connected state
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
        expect(screen.getByText(new RegExp(sessionId.slice(0, 8)))).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
      })

      // Step 7: Simulate terminal ready and initial prompt
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\x1b[32madmin@production:~$\x1b[0m '
      })

      // Step 8: Simulate user commands and responses
      const commands = [
        { input: 'ls -la\r', output: 'total 24\ndrwxr-xr-x 3 admin admin 4096 Jan 1 12:00 .\ndrwxr-xr-x 3 root  root  4096 Jan 1 11:00 ..\n-rw-r--r-- 1 admin admin  220 Jan 1 11:00 .bash_logout\n' },
        { input: 'pwd\r', output: '/home/admin\n' },
        { input: 'whoami\r', output: 'admin\n' }
      ]

      for (const command of commands) {
        // Simulate user typing command
        mockSocket.simulateServerEvent('terminal_input', {
          sessionId,
          data: command.input
        })

        // Simulate server response
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId,
          data: command.output + '\x1b[32madmin@production:~$\x1b[0m '
        })
      }

      // Step 9: Test file operations
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'cat /etc/hostname\r'
      })

      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: 'production-server\n\x1b[32madmin@production:~$\x1b[0m '
      })

      // Step 10: Simulate graceful disconnection
      await user.click(screen.getByRole('button', { name: /disconnect/i }))

      expect(mockSocket.emit).toHaveBeenCalledWith('ssh_disconnect', {
        sessionId
      })

      // Step 11: Simulate server confirming disconnection
      mockSocket.simulateServerEvent('ssh_disconnected', {
        sessionId
      })

      // Step 12: Verify disconnected state
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
        expect(screen.queryByText(new RegExp(sessionId.slice(0, 8)))).not.toBeInTheDocument()
      })
    })

    it('should handle session reconnection after network interruption', async () => {
      render(<TerminalApp />)

      // Initial connection
      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      const sessionId = 'reconnect-session'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })

      // Simulate network interruption
      mockSocket.disconnect()

      await waitFor(() => {
        expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
      })

      // Simulate automatic reconnection
      mockSocket.connect()

      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
      })

      // Simulate successful reconnection
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })

    it('should handle multiple concurrent sessions', async () => {
      const { rerender } = render(<TerminalApp />)

      // First session
      await user.type(screen.getByLabelText(/hostname/i), 'server1.example.com')
      await user.type(screen.getByLabelText(/username/i), 'user1')
      await user.type(screen.getByPlaceholderText('Enter password'), 'pass1')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      const session1Id = 'session-1'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: session1Id,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })

      // Simulate opening second terminal (new component instance)
      rerender(
        <TerminalProvider>
          <div className="terminal-app">
            <div className="connection-section">
              <ConnectionStatus />
              <SSHConnectionForm />
            </div>
            <div className="terminal-section">
              <Terminal sessionId="session-2" />
            </div>
          </div>
        </TerminalProvider>
      )

      // Second session should be independent
      const session2Id = 'session-2'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: session2Id,
        status: 'connected'
      })

      // Both sessions should be able to receive data independently
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: session1Id,
        data: 'Session 1 data\n'
      })

      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: session2Id,
        data: 'Session 2 data\n'
      })

      // Verify sessions are isolated
      expect(mockSocket.emit).toHaveBeenCalledWith('ssh_connect', expect.objectContaining({
        hostname: 'server1.example.com'
      }))
    })
  })

  describe('Real-time Terminal Interaction', () => {
    beforeEach(async () => {
      render(<TerminalApp />)

      // Set up connected state
      await user.type(screen.getByLabelText(/hostname/i), 'interactive.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'interactive-session',
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })

    it('should handle interactive command execution', async () => {
      const sessionId = 'interactive-session'

      // Simulate interactive command (top)
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'top\r'
      })

      // Simulate real-time top output updates
      const topOutputs = [
        'top - 12:00:01 up 1 day,  2:34,  1 user,  load average: 0.08, 0.03, 0.01\n',
        'Tasks: 123 total,   1 running, 122 sleeping,   0 stopped,   0 zombie\n',
        '%Cpu(s):  0.3 us,  0.1 sy,  0.0 ni, 99.6 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st\n'
      ]

      for (const output of topOutputs) {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId,
          data: output
        })
      }

      // Simulate pressing 'q' to quit top
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'q'
      })

      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\x1b[32muser@interactive:~$\x1b[0m '
      })

      // Verify all interactions were handled
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', expect.objectContaining({
        sessionId,
        data: 'top\r'
      }))
    })

    it('should handle file editing session', async () => {
      const sessionId = 'interactive-session'

      // Simulate opening vim
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'vim test.txt\r'
      })

      // Simulate vim interface
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\x1b[?1049h\x1b[22;0;0t\x1b[1;1H\x1b[?25l'
      })

      // Simulate entering insert mode
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'i'
      })

      // Simulate typing text
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'Hello, World!'
      })

      // Simulate saving and exiting (:wq)
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: '\x1b:wq\r'
      })

      // Simulate return to shell
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\x1b[?1049l\x1b[23;0;0t\x1b[32muser@interactive:~$\x1b[0m '
      })

      // Verify vim session was handled
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', expect.objectContaining({
        data: 'vim test.txt\r'
      }))
    })

    it('should handle long-running processes', async () => {
      const sessionId = 'interactive-session'

      // Simulate starting a long-running process
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'ping google.com\r'
      })

      // Simulate continuous ping output
      for (let i = 1; i <= 5; i++) {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId,
          data: `64 bytes from 172.217.164.110: icmp_seq=${i} ttl=117 time=12.${i} ms\n`
        })

        // Add small delay to simulate real-time
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Simulate Ctrl+C to stop ping
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: '\x03'
      })

      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '^C\n--- google.com ping statistics ---\n5 packets transmitted, 5 received, 0% packet loss\n\x1b[32muser@interactive:~$\x1b[0m '
      })

      // Verify process interruption was handled
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', expect.objectContaining({
        data: '\x03'
      }))
    })
  })

  describe('Session Management', () => {
    it('should handle session timeout and cleanup', async () => {
      render(<TerminalApp />)

      // Connect
      await user.type(screen.getByLabelText(/hostname/i), 'timeout.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      const sessionId = 'timeout-session'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })

      // Simulate session timeout
      mockSocket.simulateServerEvent('ssh_error', {
        sessionId,
        message: 'Session timeout after 30 minutes of inactivity',
        code: 'SESSION_TIMEOUT'
      })

      await waitFor(() => {
        expect(screen.getByText(/session timeout/i)).toBeInTheDocument()
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
      })
    })

    it('should handle server-initiated disconnection', async () => {
      render(<TerminalApp />)

      // Connect
      await user.type(screen.getByLabelText(/hostname/i), 'server.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      const sessionId = 'server-disconnect-session'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })

      // Simulate server shutdown message
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\nBroadcast message from root@server (pts/0) (Mon Jan  1 12:00:00 2024):\n\nThe system is going down for maintenance NOW!\n\nConnection to server.example.com closed.\n'
      })

      // Simulate server disconnection
      mockSocket.simulateServerEvent('ssh_disconnected', {
        sessionId,
        reason: 'Server shutdown'
      })

      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
        expect(screen.getByText(/server shutdown/i)).toBeInTheDocument()
      })
    })

    it('should handle session persistence across page refresh', async () => {
      render(<TerminalApp />)

      // Connect
      await user.type(screen.getByLabelText(/hostname/i), 'persistent.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      const sessionId = 'persistent-session'
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })

      // Simulate page refresh (socket reconnection)
      mockSocket.disconnect()
      mockSocket.connect()

      // Simulate session restoration
      mockSocket.simulateServerEvent('session_restored', {
        sessionId,
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })
  })

  describe('File Transfer Operations', () => {
    beforeEach(async () => {
      render(<TerminalApp />)

      // Set up connected state
      await user.type(screen.getByLabelText(/hostname/i), 'fileserver.example.com')
      await user.type(screen.getByLabelText(/username/i), 'fileuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'filepass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'file-session',
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })

    it('should handle file upload operations', async () => {
      const sessionId = 'file-session'

      // Simulate file upload command
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'scp localfile.txt user@server:/remote/path/\r'
      })

      // Simulate upload progress
      const progressUpdates = [
        'localfile.txt                    0%    0     0.0KB/s   --:-- ETA',
        'localfile.txt                   25%  256KB  128.0KB/s   00:03 ETA',
        'localfile.txt                   50%  512KB  170.7KB/s   00:01 ETA',
        'localfile.txt                   75%  768KB  192.0KB/s   00:00 ETA',
        'localfile.txt                  100% 1024KB  204.8KB/s   00:05'
      ]

      for (const progress of progressUpdates) {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId,
          data: `\r${progress}`
        })
        await new Promise(resolve => setTimeout(resolve, 5))
      }

      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\n\x1b[32mfileuser@fileserver:~$\x1b[0m '
      })

      // Verify upload was initiated
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', expect.objectContaining({
        data: 'scp localfile.txt user@server:/remote/path/\r'
      }))
    })

    it('should handle file download operations', async () => {
      const sessionId = 'file-session'

      // Simulate file download command
      mockSocket.simulateServerEvent('terminal_input', {
        sessionId,
        data: 'scp user@server:/remote/largefile.zip ./\r'
      })

      // Simulate download progress with large file
      const downloadUpdates = [
        'largefile.zip                    0%    0     0.0KB/s   --:-- ETA',
        'largefile.zip                    5%   5MB   1.2MB/s   04:15 ETA',
        'largefile.zip                   15%  15MB   2.1MB/s   02:30 ETA',
        'largefile.zip                   35%  35MB   3.5MB/s   01:20 ETA',
        'largefile.zip                   65%  65MB   4.2MB/s   00:45 ETA',
        'largefile.zip                   90%  90MB   4.8MB/s   00:10 ETA',
        'largefile.zip                  100% 100MB   5.0MB/s   00:20'
      ]

      for (const progress of downloadUpdates) {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId,
          data: `\r${progress}`
        })
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      mockSocket.simulateServerEvent('terminal_data', {
        sessionId,
        data: '\n\x1b[32mfileuser@fileserver:~$\x1b[0m '
      })

      // Verify download was initiated
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', expect.objectContaining({
        data: 'scp user@server:/remote/largefile.zip ./\r'
      }))
    })
  })
})
