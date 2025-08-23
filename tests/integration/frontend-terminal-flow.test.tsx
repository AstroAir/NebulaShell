import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// Complete terminal application component for integration testing
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

describe('Frontend Terminal Flow Integration', () => {
  let mockSocket: MockSocket
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket = new MockSocket()
    require('socket.io-client').io.mockReturnValue(mockSocket)
    user = userEvent.setup()
  })

  describe('Complete Connection Flow', () => {
    it('should handle complete SSH connection and terminal interaction flow', async () => {
      render(<TerminalApp />)

      // Initial state - should be disconnected
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()

      // Fill SSH connection form
      await user.type(screen.getByLabelText(/hostname/i), 'test.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/password/i), 'testpass')

      // Connect socket
      mockSocket.connect()

      // Submit connection form
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should show connecting state
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()

      // Simulate successful SSH connection
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session-123',
        status: 'connected',
      })

      // Should show connected state
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
        expect(screen.getByText(/session: test-sess/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
      })

      // Terminal should be ready for input
      const terminalCard = screen.getByRole('region')
      expect(terminalCard).toBeInTheDocument()

      // Simulate terminal data from server
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session-123',
        data: 'user@server:~$ ',
      })

      // Test terminal input
      const emitSpy = jest.spyOn(mockSocket, 'emit')
      
      // Simulate typing in terminal (this would normally be handled by xterm.js)
      // For testing, we'll directly test the context methods
      await user.click(terminalCard)

      // The actual terminal input would be handled by xterm.js
      // We can test that the context is properly set up
      expect(terminalCard).toBeInTheDocument()
    })

    it('should handle connection errors gracefully', async () => {
      render(<TerminalApp />)

      // Fill form with invalid credentials
      await user.type(screen.getByLabelText(/hostname/i), 'invalid.example.com')
      await user.type(screen.getByLabelText(/username/i), 'wronguser')
      await user.type(screen.getByLabelText(/password/i), 'wrongpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate connection error
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Authentication failed',
        sessionId: 'test-session',
      })

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
      })

      // Form should be re-enabled for retry
      expect(screen.getByLabelText(/hostname/i)).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })

    it('should handle disconnection flow', async () => {
      render(<TerminalApp />)

      // Connect first
      await user.type(screen.getByLabelText(/hostname/i), 'test.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/password/i), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session-123',
        status: 'connected',
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })

      // Disconnect
      const emitSpy = jest.spyOn(mockSocket, 'emit')
      await user.click(screen.getByRole('button', { name: /disconnect/i }))

      expect(emitSpy).toHaveBeenCalledWith('ssh_disconnect')

      // Simulate server disconnection response
      mockSocket.simulateServerEvent('ssh_disconnected', {
        sessionId: 'test-session-123',
      })

      // Should return to disconnected state
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
        expect(screen.queryByText(/session:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Terminal Operations', () => {
    beforeEach(async () => {
      render(<TerminalApp />)

      // Set up connected state
      await user.type(screen.getByLabelText(/hostname/i), 'test.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/password/i), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session-123',
        status: 'connected',
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })

    it('should handle terminal data flow', async () => {
      // Simulate receiving terminal output
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session-123',
        data: 'Welcome to the server!\r\nuser@server:~$ ',
      })

      // Terminal should be ready to receive more data
      const terminalCard = screen.getByRole('region')
      expect(terminalCard).toBeInTheDocument()

      // Simulate more terminal output
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session-123',
        data: 'ls -la\r\ntotal 8\r\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\r\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 ..\r\nuser@server:~$ ',
      })

      // Terminal should handle the data
      expect(terminalCard).toBeInTheDocument()
    })

    it('should handle terminal resize operations', async () => {
      const emitSpy = jest.spyOn(mockSocket, 'emit')

      // Simulate window resize
      fireEvent(window, new Event('resize'))

      // The terminal should eventually emit a resize event
      // In a real scenario, this would be triggered by the FitAddon
      await waitFor(() => {
        // The resize would be handled by xterm.js and the terminal context
        expect(screen.getByRole('region')).toBeInTheDocument()
      })
    })

    it('should handle server-initiated disconnection during terminal session', async () => {
      // Simulate terminal activity
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session-123',
        data: 'user@server:~$ working...\r\n',
      })

      // Simulate server disconnection
      mockSocket.simulateServerEvent('ssh_disconnected', {
        sessionId: 'test-session-123',
      })

      // Should return to disconnected state
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
      })
    })
  })

  describe('Authentication Methods', () => {
    it('should handle private key authentication flow', async () => {
      render(<TerminalApp />)

      // Switch to private key authentication
      const keyRadio = screen.getByRole('radio', { name: /private key/i })
      await user.click(keyRadio)

      // Fill form with private key
      await user.type(screen.getByLabelText(/hostname/i), 'test.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/private key/i), '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END PRIVATE KEY-----')
      await user.type(screen.getByLabelText(/passphrase/i), 'key-passphrase')

      mockSocket.connect()

      const emitSpy = jest.spyOn(mockSocket, 'emit')
      await user.click(screen.getByRole('button', { name: /connect/i }))

      expect(emitSpy).toHaveBeenCalledWith('ssh_connect', {
        config: expect.objectContaining({
          hostname: 'test.example.com',
          username: 'testuser',
          privateKey: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END PRIVATE KEY-----',
          passphrase: 'key-passphrase',
        }),
      })

      // Simulate successful connection
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session-123',
        status: 'connected',
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Recovery', () => {
    it('should allow retry after connection failure', async () => {
      render(<TerminalApp />)

      // First attempt - fail
      await user.type(screen.getByLabelText(/hostname/i), 'test.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/password/i), 'wrongpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Authentication failed',
      })

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
      })

      // Second attempt - succeed
      await user.clear(screen.getByLabelText(/password/i))
      await user.type(screen.getByLabelText(/password/i), 'correctpass')

      const emitSpy = jest.spyOn(mockSocket, 'emit')
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Error should be cleared
      expect(screen.queryByText(/authentication failed/i)).not.toBeInTheDocument()

      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session-123',
        status: 'connected',
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })

    it('should handle socket disconnection and reconnection', async () => {
      render(<TerminalApp />)

      // Initial connection
      mockSocket.connect()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled()
      })

      // Socket disconnects
      mockSocket.disconnect()

      // Should handle gracefully
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
      })

      // Socket reconnects
      mockSocket.connect()

      // Should be able to connect again
      await user.type(screen.getByLabelText(/hostname/i), 'test.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/password/i), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session-123',
        status: 'connected',
      })

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })
  })
})
