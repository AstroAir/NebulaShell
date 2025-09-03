'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { useTerminal } from './TerminalContext';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { terminalHistoryManager } from '@/lib/terminal-history-manager';
import { terminalCommandProcessor } from '@/lib/terminal-command-processor';
import { terminalAutoCompleteManager } from '@/lib/terminal-autocomplete-manager';
import { terminalAliasesManager } from '@/lib/terminal-aliases-manager';
import { AutoCompleteDropdown, useAutoComplete, calculateDropdownPosition } from './AutoCompleteDropdown';
import { EnhancedAutoComplete } from './EnhancedAutoComplete';
import { CompletionSuggestion } from '@/types/terminal-autocomplete';
import { useTerminalConfig, useMobileTerminalUtils } from '@/hooks/use-terminal-config';
import { useResponsive } from '@/hooks/use-responsive';
import { useTerminalTouchGestures } from '@/hooks/use-touch-gestures';

interface TerminalProps {
  className?: string;
  sessionId?: string;
}

export function Terminal({ className, sessionId: propSessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const { socket, sendInput, resize, connectionStatus, sessionId: contextSessionId } = useTerminal();
  const sessionId = propSessionId || contextSessionId;
  const [isInitialized, setIsInitialized] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [useEnhancedAutoComplete] = useState(true); // setUseEnhancedAutoComplete removed as not used

  // Mobile optimizations
  const terminalConfig = useTerminalConfig();
  const { isMobile } = useResponsive();
  const { handleVirtualKeyboard, preventZoom, optimizeScrolling } = useMobileTerminalUtils();

  // Touch gestures for terminal
  const handleDoubleTapToSelect = () => {
    if (xtermRef.current) {
      // Double tap to select word at cursor
      xtermRef.current.selectAll();
    }
  };

  const handleLongPressForMenu = () => {
    // Long press could show context menu (future enhancement)
    console.log('Long press detected on terminal');
  };

  const { attachGestures: attachTerminalGestures } = useTerminalTouchGestures({
    onDoubleTapToSelect: handleDoubleTapToSelect,
    onLongPressForMenu: handleLongPressForMenu,
    enabled: isMobile,
  });

  // Command history state
  const [currentInput, setCurrentInput] = useState('');
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false);
  const currentInputRef = useRef('');

  // Auto-completion state
  const autoComplete = useAutoComplete();
  const [, setIsAutoCompleting] = useState(false); // isAutoCompleting removed as not used

  // Enhanced features state
  const [isMultiLineMode, setIsMultiLineMode] = useState(false);
  const [multiLineBuffer, setMultiLineBuffer] = useState<string[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize command history session when sessionId changes
  useEffect(() => {
    if (sessionId) {
      terminalHistoryManager.createSession(sessionId);
      terminalHistoryManager.setCurrentSession(sessionId);
    }
  }, [sessionId]);

  // Helper function to handle terminal input and command tracking
  const handleTerminalInput = async (data: string, xterm: any) => {
    // Hide autocomplete when typing (except for tab)
    if (autoComplete.isVisible && data !== '\t') {
      autoComplete.hide();
      setIsAutoCompleting(false);
    }

    // Handle escape key to cancel multi-line mode
    if (data === '\u001b' && isMultiLineMode) { // Escape key
      setIsMultiLineMode(false);
      setMultiLineBuffer([]);
      currentInputRef.current = '';
      setCurrentInput('');
      xterm.writeln('\r\n\x1b[31mMulti-line mode cancelled.\x1b[0m');
      return;
    }

    // Check if this is a command completion (Enter key)
    if (data === '\r' || data === '\n') {
      let currentCommand: string;

      if (isMultiLineMode) {
        // Combine all lines from multi-line buffer
        const allLines = [...multiLineBuffer, currentInputRef.current];
        currentCommand = allLines.join('\n').trim();
        setIsMultiLineMode(false);
        setMultiLineBuffer([]);
      } else {
        // Extract the current command from the terminal buffer
        currentCommand = currentInputRef.current.trim();
      }

      if (currentCommand && sessionId) {
        // Try to process as local command first
        const wasLocalCommand = await terminalCommandProcessor.processCommand(
          currentCommand,
          sessionId,
          xterm
        );

        if (wasLocalCommand) {
          // Command was handled locally, don't send to server
          // Add to history and reset input tracking
          terminalHistoryManager.addCommand(currentCommand, sessionId);
          currentInputRef.current = '';
          setCurrentInput('');
          setIsNavigatingHistory(false);
          return;
        } else {
          // Check for alias expansion
          const aliasExpansion = terminalAliasesManager.expandCommand(currentCommand);
          if (aliasExpansion) {
            // Show expansion if enabled
            const settings = terminalAliasesManager.getSettings();
            if (settings.showExpansion) {
              xterm.writeln(`\x1b[90m→ ${aliasExpansion.expandedCommand}\x1b[0m`);
            }

            // Replace the current command with the expanded version
            // This will be sent to the server instead of the original alias
            data = '\r'; // Simulate enter key for the expanded command
            currentInputRef.current = aliasExpansion.expandedCommand;
            setCurrentInput(aliasExpansion.expandedCommand);
          }

          // Add command to history for remote commands too
          terminalHistoryManager.addCommand(currentCommand, sessionId);
        }
      }

      // Reset input tracking
      currentInputRef.current = '';
      setCurrentInput('');
      setIsNavigatingHistory(false);
    } else if (data === '\u007f' || data === '\b') {
      // Handle backspace
      if (currentInputRef.current.length > 0) {
        currentInputRef.current = currentInputRef.current.slice(0, -1);
        setCurrentInput(currentInputRef.current);
      }
    } else if (data.charCodeAt(0) >= 32) {
      // Handle printable characters
      if (!isNavigatingHistory) {
        currentInputRef.current += data;
        setCurrentInput(currentInputRef.current);
      }
    }

    // Send input to the server
    sendInput(data);
  };

  // Helper function to handle history navigation
  const handleHistoryNavigation = (direction: 'up' | 'down', xterm: any) => {
    if (!sessionId) return;

    const command = terminalHistoryManager.navigateHistory(direction, sessionId);

    if (command !== null) {
      setIsNavigatingHistory(true);

      // Clear current input line
      const currentLine = currentInputRef.current;
      if (currentLine.length > 0) {
        // Move cursor to beginning of input and clear it
        xterm.write('\r');
        // Find the prompt and preserve it while clearing the command
        const buffer = xterm.buffer.active;
        const currentRow = buffer.cursorY;
        const line = buffer.getLine(currentRow);
        if (line) {
          const lineText = line.translateToString();
          const promptMatch = lineText.match(/^[^$#>]*[$#>]\s*/);
          if (promptMatch) {
            const prompt = promptMatch[0];
            xterm.write('\x1b[2K\r' + prompt + command);
          } else {
            xterm.write('\x1b[2K\r' + command);
          }
        } else {
          xterm.write('\x1b[2K\r' + command);
        }
      } else {
        // Just write the command
        xterm.write(command);
      }

      // Update our input tracking
      currentInputRef.current = command;
      setCurrentInput(command);
    }
  };

  // Helper function to handle history search (Ctrl+R)
  const handleHistorySearch = (xterm: any) => {
    if (!sessionId) return;

    // Show search prompt
    xterm.writeln('\r\n\x1b[36mHistory Search (Ctrl+C to cancel):\x1b[0m');
    xterm.write('\x1b[33msearch> \x1b[0m');

    let searchQuery = '';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let searchResults: any[] = []; // Currently unused but kept for future implementation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let currentResultIndex = 0; // Currently unused but kept for future implementation

    // Create a temporary input handler for search
    const searchHandler = (data: string) => {
      if (data === '\u0003') { // Ctrl+C
        xterm.writeln('\r\n\x1b[31mSearch cancelled.\x1b[0m');
        return;
      }

      if (data === '\r' || data === '\n') {
        // Execute search and show results
        if (searchQuery.trim()) {
          const results = terminalHistoryManager.searchHistory({
            query: searchQuery.trim(),
            sessionId: sessionId,
            limit: 10
          });

          if (results.length > 0) {
            xterm.writeln('\r\n\x1b[36mSearch Results:\x1b[0m');
            results.forEach((result, index) => {
              const timestamp = result.entry.timestamp.toLocaleTimeString();
              const command = result.entry.command;
              xterm.writeln(`\x1b[90m${(index + 1).toString().padStart(2)}\x1b[0m  \x1b[90m${timestamp}\x1b[0m  ${command}`);
            });
          } else {
            xterm.writeln(`\r\n\x1b[33mNo results found for '${searchQuery}'.\x1b[0m`);
          }
        }
        xterm.writeln('');
        return;
      }

      if (data === '\u007f' || data === '\b') {
        // Handle backspace
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (data.charCodeAt(0) >= 32) {
        // Handle printable characters
        searchQuery += data;
        xterm.write(data);
      }
    };

    // Temporarily replace the input handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const originalHandler = xterm._core._inputHandler; // Currently unused but kept for future implementation
    xterm.onData(searchHandler);

    // Restore original handler after a timeout or when search is complete
    setTimeout(() => {
      xterm.onData((data: string) => {
        handleTerminalInput(data, xterm);
      });
    }, 30000); // 30 second timeout
  };

  // Helper function to handle auto-completion requests
  const handleAutoCompleteRequest = async (xterm: any) => {
    if (!sessionId || !currentInputRef.current.trim()) return;

    try {
      const cursorPosition = currentInputRef.current.length;
      const suggestions = await terminalAutoCompleteManager.getCompletions(
        currentInputRef.current,
        cursorPosition
      );

      if (suggestions.length === 0) return;

      // If only one suggestion and auto-insert is enabled, insert it directly
      const settings = terminalAutoCompleteManager.getSettings();
      if (suggestions.length === 1 && settings.autoInsertSingle) {
        handleCompletionSelect(suggestions[0], xterm);
        return;
      }

      // Calculate dropdown position
      const buffer = xterm.buffer.active;
      const cursorRow = buffer.cursorY;
      const cursorCol = buffer.cursorX;

      if (terminalRef.current) {
        const position = calculateDropdownPosition(
          terminalRef.current,
          { row: cursorRow, col: cursorCol },
          8, // Approximate character width
          16 // Approximate line height
        );

        autoComplete.show(suggestions, position);
        setIsAutoCompleting(true);
      }
    } catch (error) {
      console.error('Auto-completion error:', error);
    }
  };

  // Helper function to handle completion selection
  const handleCompletionSelect = (suggestion: CompletionSuggestion, xterm: any) => {
    const currentCommand = currentInputRef.current;
    const insertText = suggestion.insertText || suggestion.text;

    // Find the word to replace
    const words = currentCommand.split(' ');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const lastWord = words[words.length - 1]; // Currently unused but kept for future implementation

    // Replace the last word with the completion
    const newCommand = words.slice(0, -1).concat([insertText]).join(' ');

    // Clear current input and write new command
    const clearLength = currentCommand.length;
    if (clearLength > 0) {
      // Move to beginning of line and clear
      xterm.write('\r');
      xterm.write(' '.repeat(clearLength));
      xterm.write('\r');
    }

    // Write the new command
    xterm.write(newCommand);

    // Update our input tracking
    currentInputRef.current = newCommand;
    setCurrentInput(newCommand);

    // Hide autocomplete
    autoComplete.hide();
    setIsAutoCompleting(false);
  };

  // Enhanced terminal feature handlers
  const handleTerminalSearch = (xterm: any) => {
    if (isSearchMode) {
      setIsSearchMode(false);
      xterm.writeln('\r\n\x1b[31mSearch cancelled.\x1b[0m');
      return;
    }

    setIsSearchMode(true);
    xterm.writeln('\r\n\x1b[36mSearch Terminal Output (Ctrl+F to cancel):\x1b[0m');
    xterm.write('\x1b[33msearch> \x1b[0m');

    let searchQuery = '';

    const searchHandler = (data: string) => {
      if (data === '\u0006') { // Ctrl+F
        setIsSearchMode(false);
        xterm.writeln('\r\n\x1b[31mSearch cancelled.\x1b[0m');
        return;
      }

      if (data === '\r' || data === '\n') {
        if (searchQuery.trim()) {
          // In a real implementation, this would search through the terminal buffer
          // For now, we'll just show a message
          xterm.writeln(`\r\n\x1b[33mSearching for '${searchQuery}' in terminal output...\x1b[0m`);
          xterm.writeln('\x1b[90mNote: Terminal search functionality would be implemented here.\x1b[0m');
        }
        setIsSearchMode(false);
        xterm.writeln('');
        return;
      }

      if (data === '\u007f' || data === '\b') {
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (data.charCodeAt(0) >= 32) {
        searchQuery += data;
        xterm.write(data);
      }
    };

    xterm.onData(searchHandler);

    setTimeout(() => {
      if (isSearchMode) {
        setIsSearchMode(false);
        xterm.onData((data: string) => {
          handleTerminalInput(data, xterm);
        });
      }
    }, 30000);
  };

  const handleMultiLineInput = (xterm: any) => {
    if (!isMultiLineMode) {
      setIsMultiLineMode(true);
      setMultiLineBuffer([currentInputRef.current]);
      xterm.writeln('\r\n\x1b[36m[Multi-line mode] Press Enter to execute, Shift+Enter for new line, Esc to cancel\x1b[0m');
      xterm.write('\x1b[33m> \x1b[0m');
    } else {
      // Add current line to buffer and start new line
      const updatedBuffer = [...multiLineBuffer, currentInputRef.current];
      setMultiLineBuffer(updatedBuffer);
      currentInputRef.current = '';
      setCurrentInput('');
      xterm.writeln('');
      xterm.write('\x1b[33m> \x1b[0m');
    }
  };

  const handleEnhancedCopy = (xterm: any) => {
    if (xterm.hasSelection()) {
      const selection = xterm.getSelection();
      navigator.clipboard.writeText(selection).then(() => {
        // Visual feedback
        xterm.writeln('\r\n\x1b[32mText copied to clipboard\x1b[0m');
      }).catch(err => {
        console.warn('Failed to copy to clipboard:', err);
        xterm.writeln('\r\n\x1b[31mFailed to copy to clipboard\x1b[0m');
      });
    } else {
      // Copy current line if no selection
      const currentLine = currentInputRef.current;
      if (currentLine) {
        navigator.clipboard.writeText(currentLine).then(() => {
          xterm.writeln('\r\n\x1b[32mCurrent line copied to clipboard\x1b[0m');
        }).catch(err => {
          console.warn('Failed to copy to clipboard:', err);
        });
      }
    }
  };

  const handleEnhancedPaste = (xterm: any) => {
    navigator.clipboard.readText().then(text => {
      // Handle multi-line paste
      const lines = text.split('\n');
      if (lines.length > 1) {
        xterm.writeln('\r\n\x1b[36mPasting multi-line content...\x1b[0m');
        lines.forEach((line, index) => {
          if (index === lines.length - 1 && !line.trim()) return; // Skip empty last line
          xterm.write(line);
          if (index < lines.length - 1) {
            xterm.writeln('');
          }
        });
      } else {
        xterm.write(text);
        currentInputRef.current += text;
        setCurrentInput(currentInputRef.current);
      }
    }).catch(err => {
      console.warn('Failed to read clipboard:', err);
    });
  };

  const handleClearToEnd = (xterm: any) => {
    // Clear from cursor to end of line
    xterm.write('\x1b[K');
    currentInputRef.current = '';
    setCurrentInput('');
  };

  const handleClearToBeginning = (xterm: any) => {
    // Clear from cursor to beginning of line
    xterm.write('\x1b[1K');
    currentInputRef.current = '';
    setCurrentInput('');
  };

  const handleDeleteWordBackwards = (xterm: any) => {
    const current = currentInputRef.current;
    const words = current.split(' ');
    if (words.length > 1) {
      const newCommand = words.slice(0, -1).join(' ') + ' ';
      const deletedLength = current.length - newCommand.length;

      // Move cursor back and clear
      for (let i = 0; i < deletedLength; i++) {
        xterm.write('\b \b');
      }

      currentInputRef.current = newCommand;
      setCurrentInput(newCommand);
    } else {
      // Clear entire line
      handleClearToEnd(xterm);
    }
  };

  const handleMoveToBeginning = (xterm: any) => {
    // Move cursor to beginning of line
    const currentLength = currentInputRef.current.length;
    for (let i = 0; i < currentLength; i++) {
      xterm.write('\b');
    }
  };

  const handleMoveToEnd = (xterm: any) => {
    // Move cursor to end of line
    const current = currentInputRef.current;
    xterm.write(current);
  };

  useEffect(() => {
    if (!terminalRef.current || isInitialized || !isClient) return;

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const initializeTerminal = async () => {
      try {
        // Dynamic imports to avoid SSR issues
        const { Terminal: XTerm } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        const { WebLinksAddon } = await import('@xterm/addon-web-links');

        // Check if component is still mounted
        if (!isMounted || !terminalRef.current) {
          return;
        }

      // CSS is imported in globals.css

      // Initialize xterm.js with responsive configuration
      const xterm = new XTerm({
        theme: terminalConfig.theme,
        fontFamily: terminalConfig.fontFamily,
        fontSize: terminalConfig.fontSize,
        lineHeight: terminalConfig.lineHeight,
        cursorBlink: terminalConfig.cursorBlink,
        cursorStyle: terminalConfig.cursorStyle,
        scrollback: terminalConfig.scrollback,
        tabStopWidth: terminalConfig.tabStopWidth,
        allowTransparency: terminalConfig.allowTransparency,
        minimumContrastRatio: terminalConfig.minimumContrastRatio,
        // Mobile-specific optimizations
        ...(isMobile && {
          convertEol: true, // Convert \n to \r\n for better mobile compatibility
          disableStdin: false,
          macOptionIsMeta: true, // Better handling of meta key on mobile
          rightClickSelectsWord: false, // Disable right-click selection on mobile
          screenReaderMode: false, // Disable for better performance on mobile
        }),
      });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal
    if (terminalRef.current) {
      xterm.open(terminalRef.current);

      // Apply mobile optimizations
      if (isMobile) {
        preventZoom(terminalRef.current);
        optimizeScrolling(terminalRef.current);

        // Attach touch gestures
        const gestureCleanup = attachTerminalGestures(terminalRef.current);

        // Find the terminal viewport element and optimize it
        const viewport = terminalRef.current.querySelector('.xterm-viewport') as HTMLElement;
        if (viewport) {
          optimizeScrolling(viewport);
        }

        // Store cleanup function for later
        (terminalRef.current as any)._gestureCleanup = gestureCleanup;
      }
    }

    // Fit terminal to container
    fitAddon.fit();

    // Handle input with command history tracking
    xterm.onData((data) => {
      handleTerminalInput(data, xterm);
    });

    // Handle resize
    xterm.onResize(({ cols, rows }) => {
      resize(cols, rows);
    });

    // Handle keyboard shortcuts and history navigation
    xterm.attachCustomKeyEventHandler((event) => {
      // Handle autocomplete navigation when dropdown is visible
      if (autoComplete.isVisible && event.type === 'keydown') {
        if (event.code === 'ArrowUp') {
          autoComplete.selectPrevious();
          return false;
        }
        if (event.code === 'ArrowDown') {
          autoComplete.selectNext();
          return false;
        }
        if (event.code === 'Tab' || event.code === 'Enter') {
          const selected = autoComplete.getSelected();
          if (selected) {
            handleCompletionSelect(selected, xterm);
          }
          return false;
        }
        if (event.code === 'Escape') {
          autoComplete.hide();
          setIsAutoCompleting(false);
          return false;
        }
      }

      // Handle tab for auto-completion trigger
      if (event.type === 'keydown' && event.code === 'Tab' && !autoComplete.isVisible) {
        handleAutoCompleteRequest(xterm);
        return false;
      }

      // Handle command history navigation (only when autocomplete is not active)
      if (event.type === 'keydown' && !event.ctrlKey && !event.altKey && !event.metaKey && !autoComplete.isVisible) {
        if (event.code === 'ArrowUp') {
          handleHistoryNavigation('up', xterm);
          return false;
        }
        if (event.code === 'ArrowDown') {
          handleHistoryNavigation('down', xterm);
          return false;
        }
      }

      // Ctrl+C for copy (when text is selected)
      if (event.ctrlKey && event.code === 'KeyC' && event.type === 'keydown') {
        if (xterm.hasSelection()) {
          document.execCommand('copy');
          return false;
        }
      }

      // Ctrl+V for paste
      if (event.ctrlKey && event.code === 'KeyV' && event.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          sendInput(text);
        }).catch(err => {
          console.warn('Failed to read clipboard:', err);
        });
        return false;
      }

      // Ctrl+L for clear screen
      if (event.ctrlKey && event.code === 'KeyL' && event.type === 'keydown') {
        xterm.clear();
        return false;
      }

      // Ctrl+R for history search
      if (event.ctrlKey && event.code === 'KeyR' && event.type === 'keydown') {
        handleHistorySearch(xterm);
        return false;
      }

      // Ctrl+F for search within terminal output
      if (event.ctrlKey && event.code === 'KeyF' && event.type === 'keydown') {
        handleTerminalSearch(xterm);
        return false;
      }

      // Shift+Enter for multi-line input
      if (event.shiftKey && event.code === 'Enter' && event.type === 'keydown') {
        handleMultiLineInput(xterm);
        return false;
      }

      // Ctrl+Shift+C for copy (alternative to Ctrl+C when no selection)
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyC' && event.type === 'keydown') {
        handleEnhancedCopy(xterm);
        return false;
      }

      // Ctrl+Shift+V for enhanced paste
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyV' && event.type === 'keydown') {
        handleEnhancedPaste(xterm);
        return false;
      }

      // Ctrl+K for clear from cursor to end of line
      if (event.ctrlKey && event.code === 'KeyK' && event.type === 'keydown') {
        handleClearToEnd(xterm);
        return false;
      }

      // Ctrl+U for clear from cursor to beginning of line
      if (event.ctrlKey && event.code === 'KeyU' && event.type === 'keydown') {
        handleClearToBeginning(xterm);
        return false;
      }

      // Ctrl+W for delete word backwards
      if (event.ctrlKey && event.code === 'KeyW' && event.type === 'keydown') {
        handleDeleteWordBackwards(xterm);
        return false;
      }

      // Ctrl+A for move to beginning of line
      if (event.ctrlKey && event.code === 'KeyA' && event.type === 'keydown') {
        handleMoveToBeginning(xterm);
        return false;
      }

      // Ctrl+E for move to end of line
      if (event.ctrlKey && event.code === 'KeyE' && event.type === 'keydown') {
        handleMoveToEnd(xterm);
        return false;
      }

      return true;
    });

      // Store references
      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Set initialized state after everything is set up
      setTimeout(() => {
        setIsInitialized(true);
      }, 0);

      // Initial welcome message
      xterm.writeln('\x1b[1;32mWebSSH Terminal\x1b[0m');
      xterm.writeln('Connect to a server using the connection form above.');
      xterm.writeln('');

      // Handle window resize
      const handleResize = () => {
        try {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        } catch (error) {
          console.warn('Terminal resize failed:', error);
        }
      };

      window.addEventListener('resize', handleResize);

      // Handle virtual keyboard on mobile
      let virtualKeyboardCleanup: (() => void) | undefined;
      if (isMobile) {
        virtualKeyboardCleanup = handleVirtualKeyboard();
      }

      cleanup = () => {
        try {
          window.removeEventListener('resize', handleResize);
          if (virtualKeyboardCleanup) {
            virtualKeyboardCleanup();
          }
          // Clean up touch gestures
          if (terminalRef.current && (terminalRef.current as any)._gestureCleanup) {
            (terminalRef.current as any)._gestureCleanup();
          }
          if (xterm && typeof xterm.dispose === 'function') {
            xterm.dispose();
          }
        } catch (error) {
          console.warn('Terminal cleanup error:', error);
        }
      };
    } catch (error) {
      console.error('Terminal initialization failed:', error);
      setIsInitialized(false);
    }
    };

    initializeTerminal();

    return () => {
      isMounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, sendInput, resize, isClient]);

  // Handle terminal data from socket
  useEffect(() => {
    if (!socket || !xtermRef.current) return;

    const handleTerminalData = (data: { sessionId: string; data: string }) => {
      if (xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    };

    socket.on('terminal_data', handleTerminalData);

    return () => {
      socket.off('terminal_data', handleTerminalData);
    };
  }, [socket]);

  // Handle connection status changes
  useEffect(() => {
    if (!xtermRef.current) return;

    const xterm = xtermRef.current;

    switch (connectionStatus.status) {
      case 'connecting':
        xterm.clear();
        xterm.writeln('\x1b[1;33mConnecting to SSH server...\x1b[0m');
        break;
      case 'connected':
        xterm.clear();
        xterm.writeln('\x1b[1;32mConnected successfully!\x1b[0m');
        break;
      case 'disconnected':
        xterm.writeln('\x1b[1;31mDisconnected from server.\x1b[0m');
        break;
      case 'error':
        xterm.writeln(`\x1b[1;31mConnection error: ${connectionStatus.message}\x1b[0m`);
        break;
    }
  }, [connectionStatus]);

  // Fit terminal when container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        setTimeout(() => {
          fitAddonRef.current?.fit();
        }, 0);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      if (resizeObserver && typeof resizeObserver.disconnect === 'function') {
        resizeObserver.disconnect();
      }
    };
  }, []);

  if (!isClient) {
    return (
      <Card className={`p-0 overflow-hidden ${className}`}>
        <div className="w-full h-full min-h-[400px] bg-[#1a1a1a] flex items-center justify-center">
          <div className="text-white">Loading terminal...</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative">
      <Card className={`p-0 overflow-hidden ${className}`}>
        <div
          ref={terminalRef}
          data-testid="terminal-container"
          role="region"
          aria-label="Terminal"
          className="w-full h-full min-h-[400px] bg-[#1a1a1a]"
          style={{
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'
          }}
        />
      </Card>

      {/* Auto-completion dropdown */}
      {useEnhancedAutoComplete ? (
        <EnhancedAutoComplete
          suggestions={autoComplete.suggestions}
          selectedIndex={autoComplete.selectedIndex}
          position={autoComplete.position}
          visible={autoComplete.isVisible}
          currentInput={currentInput}
          onSelect={(suggestion) => {
            if (xtermRef.current) {
              handleCompletionSelect(suggestion, xtermRef.current);
            }
          }}
          onClose={() => {
            autoComplete.hide();
            setIsAutoCompleting(false);
          }}
          enableFuzzySearch={terminalAutoCompleteManager.getSettings().enableFuzzySearch !== false}
          showCategories={terminalAutoCompleteManager.getSettings().showCategories !== false}
          maxHeight={isMobile ? 250 : 300}
        />
      ) : (
        <AutoCompleteDropdown
          suggestions={autoComplete.suggestions}
          selectedIndex={autoComplete.selectedIndex}
          position={autoComplete.position}
          visible={autoComplete.isVisible}
          onSelect={(suggestion) => {
            if (xtermRef.current) {
              handleCompletionSelect(suggestion, xtermRef.current);
            }
          }}
          onClose={() => {
            autoComplete.hide();
            setIsAutoCompleting(false);
          }}
          showTypes={terminalAutoCompleteManager.getSettings().showTypes}
          showDescriptions={terminalAutoCompleteManager.getSettings().showDescriptions}
        />
      )}
    </div>
  );
}
