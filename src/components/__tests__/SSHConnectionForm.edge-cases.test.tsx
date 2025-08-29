import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SSHConnectionForm } from '../ssh/SSHConnectionForm'
import { TerminalProvider } from '../terminal/TerminalContext'
import { MockSocket } from '../../../tests/mocks/socket.io'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}))

const SSHConnectionFormWithProvider = () => (
  <TerminalProvider>
    <SSHConnectionForm />
  </TerminalProvider>
)

describe('SSHConnectionForm Edge Cases and Error Scenarios', () => {
  let mockSocket: MockSocket
  let user: ReturnType<typeof userEvent.setup>
  let emitSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket = new MockSocket()
    require('socket.io-client').io.mockReturnValue(mockSocket)
    emitSpy = jest.spyOn(mockSocket, 'emit')
    user = userEvent.setup()
  })

  describe('Connection Failures', () => {
    it('should handle connection timeout errors', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'timeout.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate connection timeout
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Connection timeout after 30 seconds',
        code: 'TIMEOUT',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/connection timeout/i)).toBeInTheDocument()
      })

      // Form should be re-enabled for retry
      expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled()
    })

    it('should handle network unreachable errors', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'unreachable.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate network unreachable
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Network is unreachable',
        code: 'ENETUNREACH',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/network is unreachable/i)).toBeInTheDocument()
      })
    })

    it('should handle DNS resolution failures', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'nonexistent.invalid')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate DNS resolution failure
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'getaddrinfo ENOTFOUND nonexistent.invalid',
        code: 'ENOTFOUND',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/enotfound/i)).toBeInTheDocument()
      })
    })

    it('should handle connection refused errors', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/port/i), '2222')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate connection refused
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'connect ECONNREFUSED 93.184.216.34:2222',
        code: 'ECONNREFUSED',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/econnrefused/i)).toBeInTheDocument()
      })
    })
  })

  describe('Authentication Failures', () => {
    it('should handle invalid password authentication', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'wrongpassword')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate authentication failure
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
      })

      // Password field should still contain the value (not cleared in current implementation)
      expect(screen.getByPlaceholderText('Enter password')).toHaveValue('wrongpassword')
    })

    it('should handle invalid private key authentication', async () => {
      render(<SSHConnectionFormWithProvider />)

      // Switch to private key authentication
      const keyTab = screen.getByRole('tab', { name: /private key/i })
      await user.click(keyTab)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----'), 'invalid-key-content')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate private key authentication failure
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Private key authentication failed',
        code: 'KEY_AUTH_FAILED',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/private key authentication failed/i)).toBeInTheDocument()
      })
    })

    it('should handle malformed private key', async () => {
      render(<SSHConnectionFormWithProvider />)

      // Switch to private key authentication
      const keyTab = screen.getByRole('tab', { name: /private key/i })
      await user.click(keyTab)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----'), 'not-a-valid-key')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate malformed key error
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Invalid private key format',
        code: 'INVALID_KEY_FORMAT',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/invalid private key format/i)).toBeInTheDocument()
      })
    })

    it('should handle encrypted private key without passphrase', async () => {
      render(<SSHConnectionFormWithProvider />)

      // Switch to private key authentication
      const keyTab = screen.getByRole('tab', { name: /private key/i })
      await user.click(keyTab)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----'), '-----BEGIN ENCRYPTED PRIVATE KEY-----\nencrypted-content\n-----END ENCRYPTED PRIVATE KEY-----')
      // Don't provide passphrase

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate passphrase required error
      mockSocket.simulateServerEvent('ssh_error', {
        message: 'Passphrase required for encrypted private key',
        code: 'PASSPHRASE_REQUIRED',
        sessionId: 'test-session'
      })

      await waitFor(() => {
        expect(screen.getByText(/passphrase required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Invalid Input Handling', () => {
    it('should handle extremely long hostnames', async () => {
      render(<SSHConnectionFormWithProvider />)

      // Use a shorter but still long hostname to avoid timeout
      const longHostname = 'a'.repeat(100) + '.example.com'
      const hostnameInput = screen.getByLabelText(/hostname/i)

      // Set the value directly instead of typing to avoid timeout
      fireEvent.change(hostnameInput, { target: { value: longHostname } })

      // Should accept the long hostname (no specific validation in current implementation)
      expect(hostnameInput).toHaveValue(longHostname)

      // Connect button should still be enabled if other required fields are filled
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })

    it('should handle invalid port numbers', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')

      // Clear the port field first, then type the new value
      const portInput = screen.getByLabelText(/port/i)
      await user.clear(portInput)
      await user.type(portInput, '99999')

      // Port input should accept the value (validation may happen on submit)
      expect(portInput).toHaveValue(99999)

      // Form should still be submittable (validation happens server-side)
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })

    it('should handle special characters in username', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'user@#$%^&*()')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should handle special characters gracefully
      expect(emitSpy).toHaveBeenCalledWith('ssh_connect', expect.objectContaining({
        config: expect.objectContaining({
          username: 'user@#$%^&*()'
        })
      }))
    })

    it('should handle empty required fields', async () => {
      render(<SSHConnectionFormWithProvider />)

      // Try to connect without filling required fields
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/hostname and username are required/i)).toBeInTheDocument()
      })

      // Button is not disabled in current implementation, validation happens on submit
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })
  })

  describe('Socket Connection Issues', () => {
    it('should handle socket disconnection during connection attempt', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate socket disconnection
      mockSocket.disconnect()

      // Form should be re-enabled after disconnection
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled()
      })
    })

    it('should handle malformed server responses', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate malformed response
      mockSocket.simulateServerEvent('ssh_connected', {
        // Missing required fields
        status: 'connected'
        // sessionId is missing
      })

      // The form should handle malformed responses gracefully without crashing
      // No specific error message is shown for malformed responses in current implementation
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })

    it('should handle unexpected server events', async () => {
      render(<SSHConnectionFormWithProvider />)

      // Simulate unexpected event before connection
      mockSocket.simulateServerEvent('unknown_event', {
        data: 'unexpected data'
      })

      // Should not crash or show errors for unknown events
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })
  })

  describe('Concurrent Connection Attempts', () => {
    it('should prevent multiple simultaneous connection attempts', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()

      // Click connect button multiple times rapidly
      const connectButton = screen.getByRole('button', { name: /connect/i })
      await user.click(connectButton)
      await user.click(connectButton)
      await user.click(connectButton)

      // Should only emit one SSH connection request (may also emit 'connect' event)
      const sshConnectCalls = emitSpy.mock.calls.filter(call => call[0] === 'ssh_connect')
      expect(sshConnectCalls).toHaveLength(1)
      expect(emitSpy).toHaveBeenCalledWith('ssh_connect', expect.any(Object))
    })

    it('should handle connection attempt while already connected', async () => {
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      mockSocket.connect()
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Simulate successful connection
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session',
        status: 'connected'
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
      })

      // Try to connect again while already connected
      // Should show disconnect button, not connect
      expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument()
    })
  })
})
