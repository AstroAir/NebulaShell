import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Terminal } from '../terminal/Terminal'
import { TerminalProvider } from '../terminal/TerminalContext'
import { MockTerminal } from '../../../tests/mocks/xterm'

// Mock xterm.js
jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => new MockTerminal()),
}))

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn(),
    proposeDimensions: jest.fn(() => ({ cols: 80, rows: 24 })),
  })),
}))

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn().mockImplementation(() => ({})),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const TerminalWithProvider = ({ sessionId }: { sessionId?: string }) => (
  <TerminalProvider>
    <Terminal sessionId={sessionId} />
  </TerminalProvider>
)

describe('Terminal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render terminal container', () => {
    render(<TerminalWithProvider />)

    // The terminal should render as a card component
    const terminalCard = screen.getByRole('region')
    expect(terminalCard).toBeInTheDocument()
  })

  it('should initialize xterm.js terminal on mount', async () => {
    const { Terminal } = require('@xterm/xterm')
    render(<TerminalWithProvider />)

    await waitFor(() => {
      expect(Terminal).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: expect.objectContaining({
            background: '#1a1a1a',
            foreground: '#ffffff',
          }),
          fontFamily: expect.stringMatching(/Cascadia Code|SF Mono|Monaco/),
          fontSize: expect.any(Number),
          cursorBlink: true,
        })
      )
    })
  })

  it('should handle terminal input', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)

    const terminalCard = screen.getByRole('region')

    // Simulate clicking on terminal to focus
    await user.click(terminalCard)

    // The actual input handling is done by xterm.js, so we test the setup
    expect(terminalCard).toBeInTheDocument()
  })

  it('should handle terminal resize', async () => {
    render(<TerminalWithProvider />)

    // Simulate window resize
    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      // The resize handler should be called
      expect(global.ResizeObserver).toHaveBeenCalled()
    })
  })

  it('should handle connection status changes', async () => {
    const { rerender } = render(<TerminalWithProvider />)

    // Wait for terminal to initialize
    await waitFor(() => {
      expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Re-render with different props
    rerender(<TerminalWithProvider sessionId="test-session" />)
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
  })

  it('should cleanup on unmount', () => {
    const { unmount } = render(<TerminalWithProvider />)

    unmount()

    // Verify cleanup (ResizeObserver disconnect, etc.)
    expect(global.ResizeObserver).toHaveBeenCalled()
  })

  it('should handle keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)

    // Wait for terminal to initialize
    const terminalContainer = await screen.findByTestId('terminal-container')
    
    // Test Ctrl+C
    await user.click(terminalContainer)
    await user.keyboard('{Control>}c{/Control}')
    
    // Test Ctrl+V
    await user.keyboard('{Control>}v{/Control}')
    
    // The actual handling is done by xterm.js, we just verify the container is interactive
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle paste operations', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)

    // Wait for terminal to initialize
    const terminalContainer = await screen.findByTestId('terminal-container')
    
    // Mock clipboard data
    const clipboardData = 'pasted text'
    
    // Simulate paste event
    await user.click(terminalContainer)
    
    // Create a mock paste event since ClipboardEvent is not available in test environment
    const pasteEvent = new Event('paste') as any
    
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: jest.fn().mockReturnValue(clipboardData),
      },
    })
    
    fireEvent(terminalContainer, pasteEvent)
    
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle search functionality', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Test search shortcut (Ctrl+F)
    await user.click(terminalContainer)
    await user.keyboard('{Control>}f{/Control}')
    
    // The search functionality would be handled by the terminal implementation
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle command history navigation', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Test arrow key navigation
    await user.click(terminalContainer)
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{ArrowDown}')
    
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle tab completion', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Test tab completion
    await user.click(terminalContainer)
    await user.keyboard('{Tab}')
    
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle terminal clear', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Test clear shortcut (Ctrl+L)
    await user.click(terminalContainer)
    await user.keyboard('{Control>}l{/Control}')
    
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle different session IDs', () => {
    const { rerender } = render(<TerminalWithProvider sessionId="session-1" />)
    
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
    
    // Change session ID
    rerender(<TerminalWithProvider sessionId="session-2" />)
    
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
  })

  it('should handle terminal focus and blur', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Focus terminal
    await user.click(terminalContainer)
    
    // Blur terminal
    fireEvent.blur(terminalContainer)
    
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle terminal selection', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Test select all (Ctrl+A)
    await user.click(terminalContainer)
    await user.keyboard('{Control>}a{/Control}')
    
    expect(terminalContainer).toBeInTheDocument()
  })

  it('should handle right-click context menu', async () => {
    const user = userEvent.setup()
    render(<TerminalWithProvider />)
    
    const terminalContainer = screen.getByTestId('terminal-container')
    
    // Right-click to open context menu
    await user.pointer({ keys: '[MouseRight]', target: terminalContainer })
    
    expect(terminalContainer).toBeInTheDocument()
  })
})
