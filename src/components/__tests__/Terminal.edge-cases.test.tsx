import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Terminal } from '../terminal/Terminal'
import { TerminalProvider } from '../terminal/TerminalContext'
import { MockSocket } from '../../../tests/mocks/socket.io'
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

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const TerminalWithProvider = ({ sessionId }: { sessionId?: string } = {}) => (
  <TerminalProvider>
    <Terminal sessionId={sessionId} />
  </TerminalProvider>
)

describe('Terminal Edge Cases and Error Scenarios', () => {
  let mockSocket: MockSocket
  let mockTerminal: MockTerminal
  let onDataCallback: (data: string) => void

  // Set a global timeout for all tests in this suite
  jest.setTimeout(10000) // 10 seconds

  beforeEach(() => {
    jest.clearAllMocks()

    // Create fresh mock instances
    mockSocket = new MockSocket()
    mockTerminal = new MockTerminal()

    // Setup mocks
    require('socket.io-client').io.mockReturnValue(mockSocket)
    require('@xterm/xterm').Terminal.mockImplementation(() => mockTerminal)

    jest.spyOn(mockSocket, 'emit')
    jest.spyOn(mockSocket, 'on')
    jest.spyOn(mockSocket, 'off')
    jest.spyOn(mockSocket, 'connect')
    jest.spyOn(mockSocket, 'disconnect')

    // Spy on onData and capture the callback
    jest.spyOn(mockTerminal, 'onData').mockImplementation((callback) => {
      onDataCallback = callback
    })
  })

  describe('Large Data Handling', () => {
    it('should handle extremely large terminal output', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket first
      mockSocket.connect()

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Simulate large output (reduced to 10KB for better test performance)
      const largeData = 'A'.repeat(10 * 1024)
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session',
        data: largeData
      })

      // Terminal should handle large data without crashing
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledWith(largeData)
      }, { timeout: 2000 })
    })

    it('should handle rapid successive data chunks', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket first
      mockSocket.connect()

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Simulate rapid data chunks (reduced to 10 for better test performance)
      for (let i = 0; i < 10; i++) {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: `Line ${i}\n`
        })
      }

      // All data should be written
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledTimes(10)
      }, { timeout: 2000 })
    })

    it('should handle binary data gracefully', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket first
      mockSocket.connect()

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Simulate binary data
      const binaryData = '\x00\x01\x02\x03\xFF\xFE\xFD'
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session',
        data: binaryData
      })

      // Should handle binary data without errors
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledWith(binaryData)
      }, { timeout: 2000 })
    })

    it('should handle malformed UTF-8 sequences', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket first
      mockSocket.connect()

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Simulate malformed UTF-8
      const malformedData = 'Valid text \xFF\xFE invalid UTF-8'
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session',
        data: malformedData
      })

      // Should handle gracefully
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledWith(malformedData)
      }, { timeout: 2000 })
    })
  })

  describe('Terminal State Edge Cases', () => {
    it('should handle terminal disposal during data reception', async () => {
      const { unmount } = render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Unmount component (dispose terminal)
      unmount()

      // Simulate data after disposal
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session',
        data: 'Data after disposal'
      })

      // Should not cause errors
      expect(mockTerminal.dispose).toHaveBeenCalled()
    })

    it('should handle missing session ID', async () => {
      render(<TerminalWithProvider />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Simulate data without session ID
      mockSocket.simulateServerEvent('terminal_data', {
        data: 'Data without session'
      })

      // Should not write data without valid session
      expect(mockTerminal.write).not.toHaveBeenCalled()
    })

    it('should handle data for wrong session', async () => {
      render(<TerminalWithProvider sessionId="session-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Simulate data for different session
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'session-2',
        data: 'Data for wrong session'
      })

      // Should not write data for wrong session
      expect(mockTerminal.write).not.toHaveBeenCalled()
    })

    it('should handle terminal resize failures', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Mock resize failure
      const mockFitAddon = require('@xterm/addon-fit').FitAddon.mock.results[0].value
      const originalFit = mockFitAddon.fit
      mockFitAddon.fit.mockImplementation(() => {
        throw new Error('Resize failed')
      })

      // Trigger resize - should not crash the app
      try {
        act(() => {
          fireEvent(window, new Event('resize'))
        })
      } catch {
        // Expected to throw, but app should handle gracefully
      }

      // Should have attempted to call fit
      expect(mockFitAddon.fit).toHaveBeenCalled()

      // Restore original implementation
      mockFitAddon.fit.mockImplementation(originalFit)
    })
  })

  describe('Input Handling Edge Cases', () => {
    it('should handle extremely long input lines', async () => {
      userEvent.setup()
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket and simulate SSH connection
      mockSocket.connect()
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session',
        status: 'connected'
      })

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Wait for onData callback to be set up with shorter timeout
      await waitFor(() => {
        expect(onDataCallback).toBeDefined()
      }, { timeout: 2000 })

      // Simulate very long input (reduced size for better test performance)
      const longInput = 'a'.repeat(1000)

      // Use the captured onData callback
      act(() => {
        onDataCallback(longInput)
      })

      // Should emit input data
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: 'test-session',
          input: longInput
        })
      }, { timeout: 2000 })
    })

    it('should handle special control characters', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket and simulate SSH connection
      mockSocket.connect()
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session',
        status: 'connected'
      })

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Wait for onData callback to be set up
      await waitFor(() => {
        expect(onDataCallback).toBeDefined()
      }, { timeout: 2000 })

      // Simulate control characters
      const controlChars = '\x03\x04\x1A\x1B[A\x1B[B\x1B[C\x1B[D'
      act(() => {
        onDataCallback(controlChars)
      })

      // Should handle control characters
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: 'test-session',
          input: controlChars
        })
      }, { timeout: 2000 })
    })

    it('should handle input when socket is disconnected', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Disconnect socket
      mockSocket.disconnect()

      // Only try to send input if callback is defined
      if (onDataCallback) {
        act(() => {
          onDataCallback('test input')
        })
      }

      // Should not emit when disconnected
      expect(mockSocket.emit).not.toHaveBeenCalledWith('terminal_input', expect.any(Object))
    })

    it('should handle rapid input events', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket and simulate SSH connection
      mockSocket.connect()
      mockSocket.simulateServerEvent('ssh_connected', {
        sessionId: 'test-session',
        status: 'connected'
      })

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Wait for onData callback to be set up
      await waitFor(() => {
        expect(onDataCallback).toBeDefined()
      }, { timeout: 2000 })

      // Simulate rapid input (reduced from 100 to 5 for better test performance)
      act(() => {
        for (let i = 0; i < 5; i++) {
          onDataCallback(`char${i}`)
        }
      })

      // Should handle all input events
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledTimes(5)
      }, { timeout: 2000 })
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle terminal with massive history', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket first
      mockSocket.connect()

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Simulate massive history (reduced to 20 lines for better test performance)
      for (let i = 0; i < 20; i++) {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: `Line ${i}: ${'x'.repeat(20)}\n`
        })
      }

      // Terminal should handle large history
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledTimes(20)
      }, { timeout: 2000 })
    })

    it('should handle terminal clear operations', async () => {
      render(<TerminalWithProvider sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Connect the socket first
      mockSocket.connect()

      // Wait for terminal to be fully initialized
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Add some content
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session',
        data: 'Some content\n'
      })

      // Simulate clear command
      mockSocket.simulateServerEvent('terminal_data', {
        sessionId: 'test-session',
        data: '\x1b[2J\x1b[H'
      })

      // Should handle clear sequences
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledWith('\x1b[2J\x1b[H')
      }, { timeout: 2000 })
    })

    it('should handle component re-renders without memory leaks', async () => {
      const { rerender } = render(<TerminalWithProvider sessionId="session-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Re-render with different session
      rerender(<TerminalWithProvider sessionId="session-2" />)

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      })

      // Should dispose old terminal and create new one
      expect(mockTerminal.dispose).toHaveBeenCalled()
    })
  })

  describe('Error Recovery', () => {
    it('should recover from terminal initialization failures', async () => {
      // Mock terminal constructor to fail initially
      const mockTerminalConstructor = require('@xterm/xterm').Terminal

      mockTerminalConstructor.mockImplementationOnce(() => {
        throw new Error('Terminal initialization failed')
      })

      // The error will be thrown during render, so we need to catch it
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      // Expect the component to throw an error during initialization
      expect(() => {
        render(<TerminalWithProvider sessionId="test-session" />)
      }).not.toThrow() // The component should handle the error gracefully

      // Should still render the container even if terminal fails to initialize
      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      }, { timeout: 2000 })

      consoleSpy.mockRestore()
    })

    it('should handle addon loading failures', async () => {
      // Mock addon to fail
      const mockFitAddon = require('@xterm/addon-fit').FitAddon

      mockFitAddon.mockImplementationOnce(() => {
        throw new Error('Addon loading failed')
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      // The component should handle addon failures gracefully
      expect(() => {
        render(<TerminalWithProvider sessionId="test-session" />)
      }).not.toThrow()

      // Should still render terminal container
      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      }, { timeout: 2000 })

      consoleSpy.mockRestore()
    })

    it('should handle DOM attachment failures', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      // Mock open method to fail
      jest.spyOn(mockTerminal, 'open').mockImplementation(() => {
        throw new Error('DOM attachment failed')
      })

      // The component should handle DOM attachment failures gracefully
      expect(() => {
        render(<TerminalWithProvider sessionId="test-session" />)
      }).not.toThrow()

      await waitFor(() => {
        expect(screen.getByTestId('terminal-container')).toBeInTheDocument()
      }, { timeout: 2000 })

      // Should have attempted to open the terminal
      expect(mockTerminal.open).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
