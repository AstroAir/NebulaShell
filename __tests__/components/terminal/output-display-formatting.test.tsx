import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { Terminal } from '@/components/terminal/Terminal';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { MockSocket } from '../../mocks/socket.io';

// Mock xterm.js with output handling capabilities
const mockXTerm = {
  open: jest.fn(),
  write: jest.fn(),
  writeln: jest.fn(),
  clear: jest.fn(),
  focus: jest.fn(),
  dispose: jest.fn(),
  loadAddon: jest.fn(),
  onData: jest.fn(),
  onResize: jest.fn(),
  resize: jest.fn(),
  fit: jest.fn(),
  element: document.createElement('div'),
  cols: 80,
  rows: 24,
  buffer: {
    active: {
      length: 0,
      getLine: jest.fn(() => ({ 
        translateToString: jest.fn(() => ''),
        getCell: jest.fn(() => ({ getChars: () => '', getBgColor: () => 0, getFgColor: () => 0 })),
      })),
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

describe('Terminal Output Display and Formatting', () => {
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

  describe('Basic Output Display', () => {
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

    it('should display plain text output', async () => {
      const plainText = 'Hello, Terminal!';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: plainText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(plainText);
      });
    });

    it('should display multi-line output', async () => {
      const multiLineText = 'Line 1\nLine 2\nLine 3';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: multiLineText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(multiLineText);
      });
    });

    it('should handle empty output', async () => {
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: '',
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith('');
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
  });

  describe('ANSI Escape Sequence Handling', () => {
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

    it('should handle color formatting', async () => {
      const coloredText = '\x1b[31mRed text\x1b[0m Normal text';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: coloredText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(coloredText);
      });
    });

    it('should handle background colors', async () => {
      const backgroundColorText = '\x1b[41mRed background\x1b[0m Normal';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: backgroundColorText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(backgroundColorText);
      });
    });

    it('should handle text styling (bold, italic, underline)', async () => {
      const styledText = '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m \x1b[4mUnderline\x1b[0m';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: styledText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(styledText);
      });
    });

    it('should handle cursor movement sequences', async () => {
      const cursorMovement = '\x1b[2J\x1b[H'; // Clear screen and move to home
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: cursorMovement,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(cursorMovement);
      });
    });

    it('should handle complex ANSI sequences', async () => {
      const complexAnsi = '\x1b[2K\x1b[1G\x1b[32m✓\x1b[0m Success message';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: complexAnsi,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(complexAnsi);
      });
    });
  });

  describe('Special Character Handling', () => {
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

    it('should handle carriage return and line feed', async () => {
      const crlfText = 'Line 1\r\nLine 2\r\nLine 3';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: crlfText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(crlfText);
      });
    });

    it('should handle tab characters', async () => {
      const tabbedText = 'Column1\tColumn2\tColumn3';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: tabbedText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(tabbedText);
      });
    });

    it('should handle backspace characters', async () => {
      const backspaceText = 'Hello\b\b\b\b\bWorld';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: backspaceText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(backspaceText);
      });
    });

    it('should handle bell character', async () => {
      const bellText = 'Alert!\x07';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: bellText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(bellText);
      });
    });
  });

  describe('Unicode and International Characters', () => {
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

    it('should handle Unicode characters', async () => {
      const unicodeText = 'Hello 世界 🌍 🚀';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: unicodeText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(unicodeText);
      });
    });

    it('should handle emoji characters', async () => {
      const emojiText = '✅ Success! ❌ Error! ⚠️ Warning!';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: emojiText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(emojiText);
      });
    });

    it('should handle right-to-left text', async () => {
      const rtlText = 'Hello مرحبا שלום';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: rtlText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(rtlText);
      });
    });

    it('should handle combining characters', async () => {
      const combiningText = 'e\u0301'; // é using combining acute accent
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: combiningText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(combiningText);
      });
    });
  });

  describe('Progress Indicators and Dynamic Content', () => {
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

    it('should handle progress bar updates', async () => {
      const progressUpdates = [
        'Progress: [          ] 0%',
        'Progress: [##        ] 20%',
        'Progress: [####      ] 40%',
        'Progress: [######    ] 60%',
        'Progress: [########  ] 80%',
        'Progress: [##########] 100%',
      ];

      for (const [index, progress] of progressUpdates.entries()) {
        setTimeout(() => {
          act(() => {
            mockSocket.simulateServerEvent('terminal_data', {
              sessionId: 'test-session',
              data: `\r${progress}`,
            });
          });
        }, index * 100);
      }

      await waitFor(() => {
        progressUpdates.forEach(progress => {
          expect(mockXTerm.write).toHaveBeenCalledWith(`\r${progress}`);
        });
      }, { timeout: 1000 });
    });

    it('should handle spinner animations', async () => {
      const spinnerFrames = ['|', '/', '-', '\\'];
      
      spinnerFrames.forEach((frame, index) => {
        setTimeout(() => {
          act(() => {
            mockSocket.simulateServerEvent('terminal_data', {
              sessionId: 'test-session',
              data: `\rLoading ${frame}`,
            });
          });
        }, index * 100);
      });

      await waitFor(() => {
        spinnerFrames.forEach(frame => {
          expect(mockXTerm.write).toHaveBeenCalledWith(`\rLoading ${frame}`);
        });
      }, { timeout: 500 });
    });

    it('should handle real-time log streaming', async () => {
      const logEntries = [
        '[INFO] Application started',
        '[DEBUG] Loading configuration',
        '[WARN] Deprecated API used',
        '[ERROR] Connection failed',
        '[INFO] Retrying connection',
      ];

      logEntries.forEach((entry, index) => {
        setTimeout(() => {
          act(() => {
            mockSocket.simulateServerEvent('terminal_data', {
              sessionId: 'test-session',
              data: `${entry}\n`,
            });
          });
        }, index * 50);
      });

      await waitFor(() => {
        logEntries.forEach(entry => {
          expect(mockXTerm.write).toHaveBeenCalledWith(`${entry}\n`);
        });
      }, { timeout: 500 });
    });
  });

  describe('Interactive Output Handling', () => {
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

    it('should handle interactive prompts', async () => {
      const promptText = 'Enter your name: ';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: promptText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(promptText);
      });
    });

    it('should handle password input (hidden characters)', async () => {
      const passwordPrompt = 'Password: ';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: passwordPrompt,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(passwordPrompt);
      });
    });

    it('should handle menu selections', async () => {
      const menuText = `Select an option:
1) Option A
2) Option B
3) Option C
Choice: `;
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: menuText,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(menuText);
      });
    });
  });

  describe('Error and Status Message Formatting', () => {
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

    it('should handle error messages with red formatting', async () => {
      const errorMessage = '\x1b[31mError: Command not found\x1b[0m';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: errorMessage,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should handle success messages with green formatting', async () => {
      const successMessage = '\x1b[32m✓ Operation completed successfully\x1b[0m';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: successMessage,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(successMessage);
      });
    });

    it('should handle warning messages with yellow formatting', async () => {
      const warningMessage = '\x1b[33m⚠ Warning: Deprecated feature used\x1b[0m';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: warningMessage,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(warningMessage);
      });
    });

    it('should handle info messages with blue formatting', async () => {
      const infoMessage = '\x1b[34mℹ Information: Process started\x1b[0m';
      
      act(() => {
        mockSocket.simulateServerEvent('terminal_data', {
          sessionId: 'test-session',
          data: infoMessage,
        });
      });

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledWith(infoMessage);
      });
    });
  });

  describe('Performance and Memory Management', () => {
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

    it('should handle high-frequency output updates', async () => {
      const updateCount = 100;
      
      for (let i = 0; i < updateCount; i++) {
        setTimeout(() => {
          act(() => {
            mockSocket.simulateServerEvent('terminal_data', {
              sessionId: 'test-session',
              data: `Update ${i}\n`,
            });
          });
        }, i * 5);
      }

      await waitFor(() => {
        expect(mockXTerm.write).toHaveBeenCalledTimes(updateCount);
      }, { timeout: 1000 });
    });

    it('should handle concurrent output streams', async () => {
      const stream1Data = ['Stream1: Message 1', 'Stream1: Message 2'];
      const stream2Data = ['Stream2: Message A', 'Stream2: Message B'];
      
      // Interleave messages from different streams
      setTimeout(() => {
        act(() => {
          mockSocket.simulateServerEvent('terminal_data', {
            sessionId: 'test-session',
            data: stream1Data[0] + '\n',
          });
        });
      }, 10);

      setTimeout(() => {
        act(() => {
          mockSocket.simulateServerEvent('terminal_data', {
            sessionId: 'test-session',
            data: stream2Data[0] + '\n',
          });
        });
      }, 20);

      setTimeout(() => {
        act(() => {
          mockSocket.simulateServerEvent('terminal_data', {
            sessionId: 'test-session',
            data: stream1Data[1] + '\n',
          });
        });
      }, 30);

      setTimeout(() => {
        act(() => {
          mockSocket.simulateServerEvent('terminal_data', {
            sessionId: 'test-session',
            data: stream2Data[1] + '\n',
          });
        });
      }, 40);

      await waitFor(() => {
        [...stream1Data, ...stream2Data].forEach(message => {
          expect(mockXTerm.write).toHaveBeenCalledWith(message + '\n');
        });
      }, { timeout: 200 });
    });
  });
});
