import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MockSocket } from '../mocks/socket.io'

// Unmock TerminalContext to use the real implementation for this specific test
jest.unmock('@/components/terminal/TerminalContext')

// Import components
import { TerminalProvider } from '@/components/terminal/TerminalContext'
import { SSHConnectionForm } from '@/components/ssh/SSHConnectionForm'
import { ConnectionStatus } from '@/components/ssh/ConnectionStatus'
import { Terminal } from '@/components/terminal/Terminal'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}))

// Create a complete terminal app component for integration testing
const TerminalApp = () => (
  <TerminalProvider>
    <div className="terminal-app">
      <div className="connection-section">
        <ConnectionStatus />
        <SSHConnectionForm />
      </div>
      <div className="terminal-section">
        <Terminal sessionId="test-session" />
      </div>
    </div>
  </TerminalProvider>
)

describe('Complete SSH Workflow Integration Tests - Real Context', () => {
  let mockSocket: MockSocket
  let user: ReturnType<typeof userEvent.setup>

  // XTerm modules are already mocked in jest.setup.js

  beforeEach(() => {
    jest.clearAllMocks()

    // Create a new MockSocket instance
    mockSocket = new MockSocket()

    // Ensure the io mock returns our mockSocket instance
    const ioMock = require('socket.io-client').io
    ioMock.mockReturnValue(mockSocket)

    user = userEvent.setup()
  })

  afterEach(() => {
    // Clean up the mock socket instance
    if (mockSocket && typeof mockSocket.cleanup === 'function') {
      mockSocket.cleanup()
    }

    // Also clean up any socket instances that might have been created by the mocked io function
    const ioMock = require('socket.io-client').io
    if (ioMock.mock && ioMock.mock.results) {
      ioMock.mock.results.forEach((result: any) => {
        if (result.value && typeof result.value.cleanup === 'function') {
          result.value.cleanup()
        }
      })
    }

    jest.clearAllMocks()
  })

  describe('Multiple Concurrent Sessions', () => {
    it('should handle multiple concurrent sessions', async () => {
      const { rerender } = render(<TerminalApp />)

      // Connect socket first and wait for it to be ready
      await act(async () => {
        mockSocket.connect()
      })

      // Wait for the TerminalContext to initialize and pick up the socket
      await waitFor(() => {
        expect(mockSocket.connected).toBe(true)
      })

      // Give additional time for the TerminalContext to process the socket connection
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create spy after socket is connected and ready
      const emitSpy = jest.spyOn(mockSocket, 'emit')

      // First session
      await user.clear(screen.getByLabelText(/hostname/i))
      await user.type(screen.getByLabelText(/hostname/i), 'server1.example.com')
      await user.clear(screen.getByLabelText(/username/i))
      await user.type(screen.getByLabelText(/username/i), 'user1')
      await user.clear(screen.getByPlaceholderText('Enter password'))
      await user.type(screen.getByPlaceholderText('Enter password'), 'pass1')

      await user.click(screen.getByRole('button', { name: /connect/i }))

      // Verify the ssh_connect event was emitted with correct config
      await waitFor(() => {
        expect(emitSpy).toHaveBeenCalledWith('ssh_connect', {
          config: expect.objectContaining({
            hostname: 'server1.example.com',
            username: 'user1'
          })
        })
      })

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
    })
  })
})
