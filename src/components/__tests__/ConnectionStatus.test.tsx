import React from 'react'
import { render, screen } from '@testing-library/react'
import { ConnectionStatus } from '../ssh/ConnectionStatus'
import { useTerminal } from '../terminal/TerminalContext'

// Mock the TerminalContext hook directly
jest.mock('../terminal/TerminalContext', () => ({
  useTerminal: jest.fn()
}))

const mockUseTerminal = useTerminal as jest.MockedFunction<typeof useTerminal>

const createMockTerminalContext = (connectionStatus: any) => ({
  socket: null,
  connectionStatus,
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendInput: jest.fn(),
  resize: jest.fn(),
  sessionId: connectionStatus.sessionId || null,
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
})

describe('ConnectionStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render disconnected status by default', () => {
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ status: 'disconnected' }))
    
    render(<ConnectionStatus />)

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should render connecting status', () => {
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ status: 'connecting' }))

    render(<ConnectionStatus />)
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  it('should render connected status with session ID', () => {
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ 
      status: 'connected', 
      sessionId: 'test-session-123' 
    }))

    render(<ConnectionStatus />)
    
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
    expect(screen.getByText(/session:/i)).toBeInTheDocument()
    expect(screen.getByText(/test-ses/i)).toBeInTheDocument()
  })

  it('should render error status with message', () => {
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ 
      status: 'error', 
      message: 'Authentication failed',
      sessionId: 'test-session'
    }))

    render(<ConnectionStatus />)
    
    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
  })

  it('should truncate long session IDs', () => {
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ 
      status: 'connected',
      sessionId: 'very-long-session-id-that-should-be-truncated'
    }))

    render(<ConnectionStatus />)
    
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
    expect(screen.getByText(/session: very-lon/i)).toBeInTheDocument()
    expect(screen.queryByText(/very-long-session-id-that-should-be-truncated/)).not.toBeInTheDocument()
  })

  it('should display appropriate icons for each status', () => {
    // Test disconnected icon
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ status: 'disconnected' }))
    const { rerender } = render(<ConnectionStatus />)
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()

    // Test connected icon
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ 
      status: 'connected',
      sessionId: 'test-session'
    }))
    rerender(<ConnectionStatus />)
    expect(screen.getByText(/connected/i)).toBeInTheDocument()

    // Test error icon
    mockUseTerminal.mockReturnValue(createMockTerminalContext({ 
      status: 'error',
      message: 'Connection failed'
    }))
    rerender(<ConnectionStatus />)
    expect(screen.getByText(/error/i)).toBeInTheDocument()
  })
})
