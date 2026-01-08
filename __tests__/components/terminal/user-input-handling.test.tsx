import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Terminal } from '@/components/terminal/Terminal';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { MockSocket } from '../../mocks/socket.io';

// Mock xterm.js with input handling capabilities
const mockXTerm = {
  open: jest.fn(),
  write: jest.fn(),
  writeln: jest.fn(),
  clear: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
  dispose: jest.fn(),
  loadAddon: jest.fn(),
  onData: jest.fn(),
  onResize: jest.fn(),
  onKey: jest.fn(),
  resize: jest.fn(),
  fit: jest.fn(),
  getSelection: jest.fn(() => ''),
  selectAll: jest.fn(),
  clearSelection: jest.fn(),
  element: document.createElement('div'),
  textarea: document.createElement('textarea'),
  cols: 80,
  rows: 24,
  buffer: {
    active: {
      length: 0,
      getLine: jest.fn(() => ({ translateToString: jest.fn(() => '') })),
    },
  },
};

const mockFitAddon = {
  fit: jest.fn(),
  proposeDimensions: jest.fn(() => ({ cols: 80, rows: 24 })),
};

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn(() => mockXTerm),
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn(() => mockFitAddon),
}));

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn(() => ({})),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}));

describe('User Input Handling and Keyboard Event Processing', () => {
  let mockSocket: MockSocket;
  let onDataCallback: (data: string) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new MockSocket();

    require('socket.io-client').io.mockReturnValue(mockSocket);
    mockSocket.connect();

    // Capture the onData callback
    mockXTerm.onData.mockImplementation((callback) => {
      onDataCallback = callback;
      return { dispose: jest.fn() };
    });
  });

  afterEach(() => {
    mockSocket.cleanup();
  });

  describe('Basic Input Handling', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should handle regular character input', async () => {
      const testInput = 'hello world';
      
      act(() => {
        onDataCallback(testInput);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: testInput,
        });
      });
    });

    it('should handle Enter key press', async () => {
      act(() => {
        onDataCallback('\r');
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\r',
        });
      });
    });

    it('should handle Backspace key', async () => {
      act(() => {
        onDataCallback('\x7f'); // Backspace character
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x7f',
        });
      });
    });

    it('should handle Tab key', async () => {
      act(() => {
        onDataCallback('\t');
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\t',
        });
      });
    });

    it('should handle Space key', async () => {
      act(() => {
        onDataCallback(' ');
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: ' ',
        });
      });
    });
  });

  describe('Special Key Combinations', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should handle Ctrl+C (interrupt)', async () => {
      act(() => {
        onDataCallback('\x03'); // Ctrl+C
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x03',
        });
      });
    });

    it('should handle Ctrl+D (EOF)', async () => {
      act(() => {
        onDataCallback('\x04'); // Ctrl+D
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x04',
        });
      });
    });

    it('should handle Ctrl+Z (suspend)', async () => {
      act(() => {
        onDataCallback('\x1a'); // Ctrl+Z
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1a',
        });
      });
    });

    it('should handle Ctrl+L (clear screen)', async () => {
      act(() => {
        onDataCallback('\x0c'); // Ctrl+L
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x0c',
        });
      });
    });
  });

  describe('Arrow Key Navigation', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should handle Up arrow key', async () => {
      act(() => {
        onDataCallback('\x1b[A'); // Up arrow
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[A',
        });
      });
    });

    it('should handle Down arrow key', async () => {
      act(() => {
        onDataCallback('\x1b[B'); // Down arrow
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[B',
        });
      });
    });

    it('should handle Left arrow key', async () => {
      act(() => {
        onDataCallback('\x1b[D'); // Left arrow
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[D',
        });
      });
    });

    it('should handle Right arrow key', async () => {
      act(() => {
        onDataCallback('\x1b[C'); // Right arrow
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[C',
        });
      });
    });
  });

  describe('Function Keys', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should handle F1 key', async () => {
      act(() => {
        onDataCallback('\x1bOP'); // F1
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1bOP',
        });
      });
    });

    it('should handle F12 key', async () => {
      act(() => {
        onDataCallback('\x1b[24~'); // F12
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[24~',
        });
      });
    });

    it('should handle Home key', async () => {
      act(() => {
        onDataCallback('\x1b[H'); // Home
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[H',
        });
      });
    });

    it('should handle End key', async () => {
      act(() => {
        onDataCallback('\x1b[F'); // End
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[F',
        });
      });
    });

    it('should handle Page Up key', async () => {
      act(() => {
        onDataCallback('\x1b[5~'); // Page Up
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[5~',
        });
      });
    });

    it('should handle Page Down key', async () => {
      act(() => {
        onDataCallback('\x1b[6~'); // Page Down
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: '\x1b[6~',
        });
      });
    });
  });

  describe('Input Validation and Filtering', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should handle Unicode characters', async () => {
      const unicodeInput = '🚀 Hello 世界';
      
      act(() => {
        onDataCallback(unicodeInput);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: unicodeInput,
        });
      });
    });

    it('should handle empty input', async () => {
      act(() => {
        onDataCallback('');
      });

      // Empty input should not be sent
      expect(mockSocket.emit).not.toHaveBeenCalledWith('terminal_input', {
        sessionId: expect.any(String),
        input: '',
      });
    });

    it('should handle very long input', async () => {
      const longInput = 'a'.repeat(10000);
      
      act(() => {
        onDataCallback(longInput);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: longInput,
        });
      });
    });

    it('should handle rapid input sequences', async () => {
      const inputs = ['a', 'b', 'c', 'd', 'e'];
      
      inputs.forEach((input, index) => {
        setTimeout(() => {
          act(() => {
            onDataCallback(input);
          });
        }, index * 10);
      });

      await waitFor(() => {
        inputs.forEach(input => {
          expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
            sessionId: expect.any(String),
            input,
          });
        });
      }, { timeout: 1000 });
    });
  });

  describe('Paste Operations', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should handle single line paste', async () => {
      const pasteData = 'pasted content';
      
      act(() => {
        onDataCallback(pasteData);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: pasteData,
        });
      });
    });

    it('should handle multi-line paste', async () => {
      const multiLinePaste = 'line 1\nline 2\nline 3';
      
      act(() => {
        onDataCallback(multiLinePaste);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: multiLinePaste,
        });
      });
    });

    it('should handle large paste operations', async () => {
      const largePaste = 'Large content\n'.repeat(1000);
      
      act(() => {
        onDataCallback(largePaste);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: largePaste,
        });
      });
    });
  });

  describe('Input State Management', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.onData).toHaveBeenCalled();
        expect(mockXTerm.onKey).toHaveBeenCalled();
      });
    });

    it('should maintain input focus', async () => {
      const container = screen.getByTestId('terminal-container');
      
      act(() => {
        container.focus();
      });

      act(() => {
        onDataCallback('test input');
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: 'test input',
        });
      });
    });

    it('should handle input when terminal loses focus', async () => {
      const container = screen.getByTestId('terminal-container');
      
      act(() => {
        container.blur();
      });

      act(() => {
        onDataCallback('test input');
      });

      // Input should still be processed even when not focused
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: 'test input',
        });
      });
    });

    it('should handle input during connection states', async () => {
      // Test input during connecting state
      act(() => {
        mockSocket.simulateServerEvent('ssh_connecting', {
          sessionId: 'test-session',
        });
      });

      act(() => {
        onDataCallback('input during connecting');
      });

      // Input should be queued or handled appropriately
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('terminal_input', {
          sessionId: expect.any(String),
          input: 'input during connecting',
        });
      });
    });
  });
});
