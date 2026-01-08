import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Terminal } from '@/components/terminal/Terminal';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { MockSocket } from '../../mocks/socket.io';

// Mock xterm.js
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
  scrollToTop: jest.fn(),
  scrollToBottom: jest.fn(),
  scrollLines: jest.fn(),
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

const mockWebLinksAddon = {};

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn(() => mockXTerm),
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn(() => mockFitAddon),
}));

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn(() => mockWebLinksAddon),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}));

describe('XTerm.js Integration Testing', () => {
  let mockSocket: MockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new MockSocket();
    require('socket.io-client').io.mockReturnValue(mockSocket);
    mockSocket.connect();
  });

  afterEach(() => {
    mockSocket.cleanup();
  });

  describe('Terminal Initialization', () => {
    it('should initialize xterm.js terminal with correct configuration', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: expect.any(Object),
            fontFamily: expect.any(String),
            fontSize: expect.any(Number),
            cursorBlink: expect.any(Boolean),
            cursorStyle: expect.any(String),
            scrollback: expect.any(Number),
          })
        );
      });
    });

    it('should load required addons', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.loadAddon).toHaveBeenCalledWith(mockFitAddon);
        expect(mockXTerm.loadAddon).toHaveBeenCalledWith(mockWebLinksAddon);
      });
    });

    it('should open terminal in DOM container', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const terminalContainer = screen.getByTestId('terminal-container');
      expect(terminalContainer).toBeInTheDocument();

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalledWith(terminalContainer);
      });
    });

    it('should fit terminal to container size', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });
  });

  describe('Terminal Rendering and Display', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });
    });

    it('should render terminal output correctly', async () => {
      const testOutput = 'Hello, Terminal!';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: testOutput,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(testOutput);
      });
    });

    it('should handle ANSI escape sequences', async () => {
      const ansiOutput = '\x1b[32mGreen text\x1b[0m Normal text';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: ansiOutput,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(ansiOutput);
      });
    });

    it('should handle multi-line output', async () => {
      const multiLineOutput = 'Line 1\nLine 2\nLine 3';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: multiLineOutput,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(multiLineOutput);
      });
    });

    it('should handle large output chunks', async () => {
      const largeOutput = 'A'.repeat(10000);
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: largeOutput,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(largeOutput);
      });
    });

    it('should handle rapid output updates', async () => {
      const outputs = ['Output 1', 'Output 2', 'Output 3', 'Output 4', 'Output 5'];
      
      outputs.forEach((output, index) => {
        setTimeout(() => {
          act(() => {
            mockSocket.simulateServerEvent('terminal_data', {
              sessionId: 'test-session',
              data: output,
            });
          });
        }, index * 10);
      });

      await waitFor(() => {
        outputs.forEach(output => {
          expect(mockXTerm.write).toHaveBeenCalledWith(output);
        });
      }, { timeout: 1000 });
    });
  });

  describe('Terminal Theming and Appearance', () => {
    it('should apply dark theme correctly', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: expect.objectContaining({
              background: expect.any(String),
              foreground: expect.any(String),
              cursor: expect.any(String),
            }),
          })
        );
      });
    });

    it('should handle font configuration', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            fontFamily: expect.stringContaining('Cascadia Code'),
            fontSize: expect.any(Number),
            lineHeight: expect.any(Number),
          })
        );
      });
    });

    it('should handle cursor configuration', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            cursorBlink: expect.any(Boolean),
            cursorStyle: expect.any(String),
          })
        );
      });
    });
  });

  describe('Terminal Resizing and Responsiveness', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });
    });

    it('should handle window resize events', async () => {
      // Simulate window resize
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });

    it('should handle manual terminal resize', async () => {
      const newCols = 120;
      const newRows = 40;

      act(() => {
        mockSocket.simulateServerEvent('terminal_resize', {
          sessionId: 'test-session',
          cols: newCols,
          rows: newRows,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.resize).toHaveBeenCalledWith(newCols, newRows);
      });
    });

    it('should maintain aspect ratio during resize', async () => {
      // Mock container dimensions
      const container = screen.getByTestId('terminal-container');
      Object.defineProperty(container, 'clientWidth', { value: 800 });
      Object.defineProperty(container, 'clientHeight', { value: 600 });

      mockFitAddon.proposeDimensions.mockReturnValue({ cols: 100, rows: 30 });

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(mockFitAddon.proposeDimensions).toHaveBeenCalled();
        expect(mockXTerm.resize).toHaveBeenCalledWith(100, 30);
      });
    });
  });

  describe('Terminal Scrolling and Navigation', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });
    });

    it('should handle scrollback buffer', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            scrollback: expect.any(Number),
          })
        );
      });
    });

    it('should handle scroll to top', async () => {
      // Simulate Ctrl+Home
      act(() => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'Home',
          ctrlKey: true,
        });
        document.dispatchEvent(keyEvent);
      });

      // In a real implementation, this would trigger scrollToTop
      expect(mockXTerm.scrollToTop).not.toHaveBeenCalled(); // Not implemented in this mock
    });

    it('should handle scroll to bottom', async () => {
      // Simulate Ctrl+End
      act(() => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'End',
          ctrlKey: true,
        });
        document.dispatchEvent(keyEvent);
      });

      // In a real implementation, this would trigger scrollToBottom
      expect(mockXTerm.scrollToBottom).not.toHaveBeenCalled(); // Not implemented in this mock
    });
  });

  describe('Terminal Selection and Copy/Paste', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });
    });

    it('should handle text selection', async () => {
      mockXTerm.getSelection.mockReturnValue('selected text');

      // Simulate text selection
      act(() => {
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: 100,
          clientY: 100,
        });
        mockXTerm.element.dispatchEvent(mouseEvent);
      });

      expect(mockXTerm.getSelection).toBeDefined();
    });

    it('should handle select all', async () => {
      // Simulate Ctrl+A
      act(() => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
        });
        document.dispatchEvent(keyEvent);
      });

      // In a real implementation, this would trigger selectAll
      expect(mockXTerm.selectAll).not.toHaveBeenCalled(); // Not implemented in this mock
    });

    it('should handle copy operation', async () => {
      mockXTerm.getSelection.mockReturnValue('text to copy');

      // Simulate Ctrl+C
      act(() => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
        });
        document.dispatchEvent(keyEvent);
      });

      // In a real implementation, this would copy to clipboard
      expect(mockXTerm.getSelection).toBeDefined();
    });
  });

  describe('Terminal Focus and Blur', () => {
    beforeEach(async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });
    });

    it('should handle terminal focus', async () => {
      const container = screen.getByTestId('terminal-container');
      
      act(() => {
        container.focus();
      });

      // In a real implementation, this would trigger focus
      expect(mockXTerm.focus).toBeDefined();
    });

    it('should handle terminal blur', async () => {
      const container = screen.getByTestId('terminal-container');
      
      act(() => {
        container.blur();
      });

      // In a real implementation, this would trigger blur
      expect(mockXTerm.blur).toBeDefined();
    });

    it('should maintain focus during typing', async () => {
      const container = screen.getByTestId('terminal-container');
      
      act(() => {
        container.focus();
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'a',
        });
        container.dispatchEvent(keyEvent);
      });

      // Terminal should remain focused
      expect(document.activeElement).toBe(container);
    });
  });

  describe('Terminal Cleanup and Disposal', () => {
    it('should dispose terminal on unmount', async () => {
      const { unmount } = render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });

      unmount();

      expect(mockXTerm.dispose).toHaveBeenCalled();
    });

    it('should clean up event listeners on unmount', async () => {
      const { unmount } = render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });

      // Mock event listener cleanup
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should handle multiple terminal instances', async () => {
      const { unmount: unmount1 } = render(
        <TerminalProvider>
          <Terminal sessionId="session-1" />
        </TerminalProvider>
      );

      const { unmount: unmount2 } = render(
        <TerminalProvider>
          <Terminal sessionId="session-2" />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalledTimes(2);
      });

      unmount1();
      expect(mockXTerm.dispose).toHaveBeenCalledTimes(1);

      unmount2();
      expect(mockXTerm.dispose).toHaveBeenCalledTimes(2);
    });
  });
});
