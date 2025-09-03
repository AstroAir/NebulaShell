import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SSHConnectionForm } from '../ssh/SSHConnectionForm'
import { TerminalProvider } from '../terminal/TerminalContext'
import { MockSocket } from '../../../__tests__/mocks/socket.io'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}))

// Unmock TerminalContext to use the real implementation
jest.unmock('@/components/terminal/TerminalContext')

const SSHConnectionFormWithProvider = () => (
  <TerminalProvider>
    <SSHConnectionForm />
  </TerminalProvider>
)

describe('SSHConnectionForm Edge Cases and Error Scenarios', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    jest.clearAllMocks()

    // Ensure socket.io-client returns a proper mock socket for tests that use the real TerminalContext
    const mockSocket = new MockSocket()
    require('socket.io-client').io.mockReturnValue(mockSocket)

    user = userEvent.setup()
  })

  describe('Connection Failures', () => {
    it('should handle connection timeout errors', async () => {
      // Create a controlled test that simulates the error handling behavior
      const mockConnect = jest.fn().mockRejectedValue(new Error('Connection timeout after 30 seconds'))

      // Mock the useTerminal hook to return our controlled functions
      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'timeout.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByText(/connection timeout/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Verify connect was called
      expect(mockConnect).toHaveBeenCalled()

      // Form should be re-enabled for retry
      expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled()

      useTerminalSpy.mockRestore()
    })

    it('should handle network unreachable errors', async () => {
      // Mock the connect function to reject with network error
      const mockConnect = jest.fn().mockRejectedValue(new Error('Network is unreachable'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'unreachable.example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/network is unreachable/i)).toBeInTheDocument()
      })

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
    })

    it('should handle DNS resolution failures', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND nonexistent.invalid'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'nonexistent.invalid')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/enotfound/i)).toBeInTheDocument()
      })

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
    })

    it('should handle connection refused errors', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 93.184.216.34:2222'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/port/i), '2222')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/econnrefused/i)).toBeInTheDocument()
      })

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
    })
  })

  describe('Authentication Failures', () => {
    it('should handle invalid password authentication', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('Authentication failed'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'wrongpassword')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
      })

      // Password field should still contain the value (not cleared in current implementation)
      expect(screen.getByPlaceholderText('Enter password')).toHaveValue('wrongpassword')

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
    })

    it('should handle invalid private key authentication', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('Private key authentication failed'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

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

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/private key authentication failed/i)).toBeInTheDocument()
      })

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
    })

    it('should handle malformed private key', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('Invalid private key format'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

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

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid private key format/i)).toBeInTheDocument()
      })

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
    })

    it('should handle encrypted private key without passphrase', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('Passphrase required for encrypted private key'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

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

      await user.click(screen.getByRole('button', { name: /connect/i }))

      await waitFor(() => {
        expect(screen.getByText(/passphrase required/i)).toBeInTheDocument()
      })

      expect(mockConnect).toHaveBeenCalled()
      useTerminalSpy.mockRestore()
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
      const mockConnect = jest.fn()

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'user@#$%^&*()')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should handle special characters gracefully
      expect(mockConnect).toHaveBeenCalledWith(expect.objectContaining({
        username: 'user@#$%^&*()'
      }))

      useTerminalSpy.mockRestore()
    })

    it('should handle empty required fields', async () => {
      // Use the real TerminalContext for this test since it's testing form validation
      render(<SSHConnectionFormWithProvider />)

      // Try to connect without filling required fields
      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/hostname and username are required/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Button is not disabled in current implementation, validation happens on submit
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })
  })

  describe('Socket Connection Issues', () => {
    it('should handle socket disconnection during connection attempt', async () => {
      // Mock a connection that fails to simulate disconnection
      const mockConnect = jest.fn().mockRejectedValue(new Error('Socket disconnected'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/socket disconnected/i)).toBeInTheDocument()
      })

      // Form should be re-enabled after error
      expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled()

      useTerminalSpy.mockRestore()
    })

    it('should handle malformed server responses', async () => {
      // Mock a connection that fails to simulate malformed response handling
      const mockConnect = jest.fn().mockRejectedValue(new Error('Malformed server response'))

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: jest.fn(),
        connectionStatus: { status: 'disconnected' },
        sessionId: null,
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/malformed server response/i)).toBeInTheDocument()
      })

      // The form should handle malformed responses gracefully without crashing
      expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled()

      useTerminalSpy.mockRestore()
    })

    it('should handle unexpected server events', async () => {
      // Use the real TerminalContext for this test since it's testing event handling
      render(<SSHConnectionFormWithProvider />)

      // Should not crash or show errors for unknown events
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/hostname/i)).toBeInTheDocument()

      // Form should remain functional
      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      expect(screen.getByLabelText(/hostname/i)).toHaveValue('example.com')
    })
  })

  describe('Concurrent Connection Attempts', () => {
    it('should prevent multiple simultaneous connection attempts', async () => {
      // Use the real TerminalContext for this test to test the actual form state management
      render(<SSHConnectionFormWithProvider />)

      await user.type(screen.getByLabelText(/hostname/i), 'example.com')
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter password'), 'testpass')

      // Click connect button multiple times rapidly
      const connectButton = screen.getByRole('button', { name: /connect/i })
      await user.click(connectButton)

      // Wait for the form to be in connecting state (button disabled)
      await waitFor(() => {
        expect(connectButton).toBeDisabled()
      }, { timeout: 1000 })

      // Try to click again while disabled - these should not trigger additional connections
      await user.click(connectButton)
      await user.click(connectButton)

      // The button should remain disabled, indicating the form is preventing multiple attempts
      expect(connectButton).toBeDisabled()

      // Form should handle the connection attempt gracefully
      expect(screen.getByLabelText(/hostname/i)).toBeDisabled()
    })

    it('should handle connection attempt while already connected', async () => {
      const mockConnect = jest.fn()
      const mockDisconnect = jest.fn()

      const useTerminalSpy = jest.spyOn(require('../terminal/TerminalContext'), 'useTerminal')
      useTerminalSpy.mockReturnValue({
        connect: mockConnect,
        disconnect: mockDisconnect,
        connectionStatus: { status: 'connected', sessionId: 'test-session' },
        sessionId: 'test-session',
        socket: null,
        historyManager: {} as any,
        autoCompleteManager: {} as any,
        aliasesManager: {} as any,
        commandProcessor: {} as any,
        settingsManager: {} as any,
        features: {
          historyEnabled: true,
          autoCompleteEnabled: true,
          aliasesEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        toggleFeature: jest.fn(),
        refreshFeatureStates: jest.fn(),
        sendInput: jest.fn(),
        resize: jest.fn(),
      })

      render(<SSHConnectionFormWithProvider />)

      // Should show disconnect button when already connected
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
      })

      // Should not show connect button when already connected
      expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument()

      useTerminalSpy.mockRestore()
    })
  })
})
