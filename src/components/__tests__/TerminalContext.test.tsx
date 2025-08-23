import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TerminalProvider, useTerminal } from '../terminal/TerminalContext'
import { MockSocket } from '../../../tests/mocks/socket.io'
import { SSHConnectionConfig } from '../../types/ssh'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}))

// Test component to access context
const TestComponent = () => {
  const {
    socket,
    connectionStatus,
    connect,
    disconnect,
    sendInput,
    resize,
    sessionId,
    features,
    toggleFeature,
  } = useTerminal()

  return (
    <div>
      <div data-testid="connection-status">{connectionStatus.status}</div>
      <div data-testid="session-id">{sessionId || 'no-session'}</div>
      <div data-testid="socket-connected">{socket?.connected ? 'true' : 'false'}</div>
      <div data-testid="history-enabled">{features.historyEnabled ? 'true' : 'false'}</div>
      <button
        data-testid="connect-btn"
        onClick={() =>
          connect({
            id: 'test-session',
            hostname: 'test.example.com',
            port: 22,
            username: 'testuser',
            password: 'testpass',
          })
        }
      >
        Connect
      </button>
      <button data-testid="disconnect-btn" onClick={disconnect}>
        Disconnect
      </button>
      <button
        data-testid="send-input-btn"
        onClick={() => sendInput('test command\n')}
      >
        Send Input
      </button>
      <button
        data-testid="resize-btn"
        onClick={() => resize(100, 30)}
      >
        Resize
      </button>
      <button
        data-testid="toggle-history-btn"
        onClick={() => toggleFeature('historyEnabled')}
      >
        Toggle History
      </button>
    </div>
  )
}

const TerminalWithProvider = () => (
  <TerminalProvider>
    <TestComponent />
  </TerminalProvider>
)

describe('TerminalContext', () => {
  let mockSocket: MockSocket

  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket = new MockSocket()
    require('socket.io-client').io.mockReturnValue(mockSocket)
  })

  it('should provide initial context values', () => {
    render(<TerminalWithProvider />)

    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
    expect(screen.getByTestId('session-id')).toHaveTextContent('no-session')
    expect(screen.getByTestId('socket-connected')).toHaveTextContent('false')
    expect(screen.getByTestId('history-enabled')).toHaveTextContent('true')
  })

  it('should initialize socket connection on mount', async () => {
    render(<TerminalWithProvider />)

    // Simulate socket connection
    mockSocket.connect()

    await waitFor(() => {
      expect(screen.getByTestId('socket-connected')).toHaveTextContent('true')
    })
  })

  it('should handle SSH connection', async () => {
    render(<TerminalWithProvider />)

    // Connect socket first
    mockSocket.connect()

    await waitFor(() => {
      expect(screen.getByTestId('socket-connected')).toHaveTextContent('true')
    })

    // Click connect button
    fireEvent.click(screen.getByTestId('connect-btn'))

    expect(screen.getByTestId('connection-status')).toHaveTextContent('connecting')

    // Simulate successful SSH connection
    mockSocket.simulateServerEvent('ssh_connected', {
      sessionId: 'test-session',
      status: 'connected',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
      expect(screen.getByTestId('session-id')).toHaveTextContent('test-session')
    })
  })

  it('should handle SSH connection errors', async () => {
    render(<TerminalWithProvider />)

    mockSocket.connect()

    await waitFor(() => {
      expect(screen.getByTestId('socket-connected')).toHaveTextContent('true')
    })

    fireEvent.click(screen.getByTestId('connect-btn'))

    // Simulate SSH error
    mockSocket.simulateServerEvent('ssh_error', {
      message: 'Connection failed',
      sessionId: 'test-session',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('error')
    })
  })

  it('should handle SSH disconnection', async () => {
    render(<TerminalWithProvider />)

    mockSocket.connect()

    // First connect
    fireEvent.click(screen.getByTestId('connect-btn'))
    mockSocket.simulateServerEvent('ssh_connected', {
      sessionId: 'test-session',
      status: 'connected',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
    })

    // Then disconnect
    fireEvent.click(screen.getByTestId('disconnect-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('session-id')).toHaveTextContent('no-session')
    })
  })

  it('should handle server-initiated disconnection', async () => {
    render(<TerminalWithProvider />)

    mockSocket.connect()
    fireEvent.click(screen.getByTestId('connect-btn'))
    mockSocket.simulateServerEvent('ssh_connected', {
      sessionId: 'test-session',
      status: 'connected',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
    })

    // Simulate server disconnection
    mockSocket.simulateServerEvent('ssh_disconnected', {
      sessionId: 'test-session',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('session-id')).toHaveTextContent('no-session')
    })
  })

  it('should send terminal input', async () => {
    render(<TerminalWithProvider />)

    mockSocket.connect()
    fireEvent.click(screen.getByTestId('connect-btn'))
    mockSocket.simulateServerEvent('ssh_connected', {
      sessionId: 'test-session',
      status: 'connected',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
    })

    const emitSpy = jest.spyOn(mockSocket, 'emit')
    fireEvent.click(screen.getByTestId('send-input-btn'))

    expect(emitSpy).toHaveBeenCalledWith('terminal_input', {
      sessionId: 'test-session',
      input: 'test command\n',
    })
  })

  it('should handle terminal resize', async () => {
    render(<TerminalWithProvider />)

    mockSocket.connect()
    fireEvent.click(screen.getByTestId('connect-btn'))
    mockSocket.simulateServerEvent('ssh_connected', {
      sessionId: 'test-session',
      status: 'connected',
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
    })

    const emitSpy = jest.spyOn(mockSocket, 'emit')
    fireEvent.click(screen.getByTestId('resize-btn'))

    expect(emitSpy).toHaveBeenCalledWith('terminal_resize', {
      sessionId: 'test-session',
      cols: 100,
      rows: 30,
    })
  })

  it('should toggle features', () => {
    render(<TerminalWithProvider />)

    expect(screen.getByTestId('history-enabled')).toHaveTextContent('true')

    fireEvent.click(screen.getByTestId('toggle-history-btn'))

    expect(screen.getByTestId('history-enabled')).toHaveTextContent('false')

    fireEvent.click(screen.getByTestId('toggle-history-btn'))

    expect(screen.getByTestId('history-enabled')).toHaveTextContent('true')
  })

  it('should handle socket disconnection', async () => {
    render(<TerminalWithProvider />)

    mockSocket.connect()

    await waitFor(() => {
      expect(screen.getByTestId('socket-connected')).toHaveTextContent('true')
    })

    // Simulate socket disconnection
    mockSocket.disconnect()

    await waitFor(() => {
      expect(screen.getByTestId('socket-connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('session-id')).toHaveTextContent('no-session')
    })
  })

  it('should not send input when not connected', () => {
    render(<TerminalWithProvider />)

    const emitSpy = jest.spyOn(mockSocket, 'emit')
    fireEvent.click(screen.getByTestId('send-input-btn'))

    expect(emitSpy).not.toHaveBeenCalledWith('terminal_input', expect.anything())
  })

  it('should not resize when not connected', () => {
    render(<TerminalWithProvider />)

    const emitSpy = jest.spyOn(mockSocket, 'emit')
    fireEvent.click(screen.getByTestId('resize-btn'))

    expect(emitSpy).not.toHaveBeenCalledWith('terminal_resize', expect.anything())
  })

  it('should handle connect without socket', () => {
    // Mock console.error to avoid noise in tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    render(<TerminalWithProvider />)

    // Don't connect socket, just try to SSH connect
    fireEvent.click(screen.getByTestId('connect-btn'))

    expect(consoleSpy).toHaveBeenCalledWith('Socket not connected')

    consoleSpy.mockRestore()
  })
})
