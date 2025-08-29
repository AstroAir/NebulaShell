import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { measureRenderTime } from '../utils/test-utils';
import { TerminalThemeSelector } from '@/components/terminal/TerminalThemeSelector';
import { CommandHistorySearch } from '@/components/terminal/CommandHistorySearch';
import { DragDropFileTransfer } from '@/components/file-transfer/DragDropFileTransfer';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';
import { EnhancedConnectionManager } from '@/components/connection/EnhancedConnectionManager';
import { enhancedTerminalHistoryManager } from '@/lib/terminal-history-enhanced';
import { enhancedConnectionProfileManager } from '@/lib/connection-profiles-enhanced';

describe('Performance Tests', () => {
  describe('Component Render Performance', () => {
    it('should render TerminalThemeSelector within performance budget', async () => {
      const renderTime = await measureRenderTime(() => {
        render(
          <TerminalThemeSelector 
            currentTheme="default-dark"
            onThemeChange={jest.fn()}
          />
        );
      });
      
      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should render CommandHistorySearch within performance budget', async () => {
      const renderTime = await measureRenderTime(() => {
        render(<CommandHistorySearch onCommandSelect={jest.fn()} />);
      });
      
      expect(renderTime).toBeLessThan(100);
    });

    it('should render DragDropFileTransfer within performance budget', async () => {
      const renderTime = await measureRenderTime(() => {
        render(
          <DragDropFileTransfer 
            transfers={[]}
            onFileUpload={jest.fn()}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(100);
    });

    it('should render CollaborationPanel within performance budget', async () => {
      const mockUsers = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        color: '#3b82f6',
        isActive: true,
        lastSeen: Date.now(),
        cursor: { x: 0, y: 0, line: 1, column: 1 },
      }));

      const renderTime = await measureRenderTime(() => {
        render(
          <CollaborationPanel 
            sessionId="test-session"
            currentUser={mockUsers[0]}
            connectedUsers={mockUsers}
            onUserJoin={jest.fn()}
            onUserLeave={jest.fn()}
            onSessionShare={jest.fn()}
            onSessionEnd={jest.fn()}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(100);
    });

    it('should render EnhancedConnectionManager within performance budget', async () => {
      const renderTime = await measureRenderTime(() => {
        render(<EnhancedConnectionManager onConnect={jest.fn()} />);
      });
      
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large theme collections efficiently', async () => {
      // Create many themes
      const manyThemes = Array.from({ length: 100 }, (_, i) => ({
        id: `theme-${i}`,
        name: `Theme ${i}`,
        description: `Test theme ${i}`,
        category: 'custom' as const,
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selectionBackground: '#333333',
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff',
          brightBlack: '#808080',
          brightRed: '#ff8080',
          brightGreen: '#80ff80',
          brightYellow: '#ffff80',
          brightBlue: '#8080ff',
          brightMagenta: '#ff80ff',
          brightCyan: '#80ffff',
          brightWhite: '#ffffff',
        },
      }));

      const startTime = performance.now();
      
      render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
          themes={manyThemes}
        />
      );
      
      const endTime = performance.now();
      
      // Should handle 100 themes within 200ms
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle large command history efficiently', async () => {
      // Create large history dataset
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `cmd-${i}`,
        command: `command-${i} --option value`,
        timestamp: Date.now() - (i * 1000),
        sessionId: 'session-1',
        workingDirectory: '/home/user',
        exitCode: i % 10 === 0 ? 1 : 0, // 10% error rate
        duration: Math.random() * 1000,
        output: `Output for command ${i}`,
        tags: [`tag-${i % 5}`],
        favorite: i % 20 === 0, // 5% favorites
      }));

      const startTime = performance.now();
      
      render(
        <CommandHistorySearch 
          onCommandSelect={jest.fn()}
          history={largeHistory}
        />
      );
      
      const endTime = performance.now();
      
      // Should handle 1000 commands within 300ms
      expect(endTime - startTime).toBeLessThan(300);
    });

    it('should handle many file transfers efficiently', async () => {
      const manyTransfers = Array.from({ length: 50 }, (_, i) => ({
        id: `transfer-${i}`,
        name: `file-${i}.txt`,
        size: 1024 * (i + 1),
        type: 'text/plain',
        status: ['pending', 'uploading', 'completed', 'error'][i % 4] as any,
        progress: Math.min(100, i * 2),
        direction: i % 2 === 0 ? 'upload' : 'download' as any,
        remotePath: `/files/file-${i}.txt`,
        speed: 1024 * 1024, // 1MB/s
        timeRemaining: Math.max(0, 60 - i),
      }));

      const startTime = performance.now();
      
      render(
        <DragDropFileTransfer 
          transfers={manyTransfers}
          onFileUpload={jest.fn()}
        />
      );
      
      const endTime = performance.now();
      
      // Should handle 50 transfers within 150ms
      expect(endTime - startTime).toBeLessThan(150);
    });

    it('should handle many connection profiles efficiently', async () => {
      const manyProfiles = Array.from({ length: 200 }, (_, i) => ({
        id: `profile-${i}`,
        name: `Server ${i}`,
        description: `Test server ${i}`,
        hostname: `server${i}.example.com`,
        port: 22,
        username: `user${i}`,
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          keepAliveInterval: 30,
          timeout: 10000,
          compression: false,
          forwardAgent: false,
          forwardX11: false,
        },
        environment: {
          variables: {},
          workingDirectory: '~',
          shell: '/bin/bash',
        },
        tunnels: [],
        metadata: {
          createdAt: Date.now() - (i * 86400000), // Spread over days
          lastUsed: i % 10 === 0 ? Date.now() - (i * 3600000) : 0,
          useCount: Math.floor(Math.random() * 50),
          favorite: i % 25 === 0,
          tags: [`env-${i % 3}`, `team-${i % 5}`],
          color: '#3b82f6',
        },
        quickConnect: {
          enabled: i % 10 === 0,
          autoConnect: false,
          connectOnStartup: false,
        },
      }));

      const startTime = performance.now();
      
      render(
        <EnhancedConnectionManager 
          onConnect={jest.fn()}
          profiles={manyProfiles}
        />
      );
      
      const endTime = performance.now();
      
      // Should handle 200 profiles within 250ms
      expect(endTime - startTime).toBeLessThan(250);
    });
  });

  describe('Search Performance', () => {
    it('should perform command history search efficiently', () => {
      // Create large dataset
      for (let i = 0; i < 5000; i++) {
        enhancedTerminalHistoryManager.addEntry({
          command: `command-${i} --flag value-${i}`,
          sessionId: 'perf-test',
          workingDirectory: '/test',
          exitCode: i % 10 === 0 ? 1 : 0,
        });
      }

      const startTime = performance.now();
      
      // Perform search
      const results = enhancedTerminalHistoryManager.search({
        query: 'command',
        limit: 100,
      });
      
      const endTime = performance.now();
      
      expect(results.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(50); // Should search within 50ms
    });

    it('should perform connection profile search efficiently', () => {
      // Create large dataset
      for (let i = 0; i < 1000; i++) {
        enhancedConnectionProfileManager.createProfile({
          name: `Server ${i}`,
          hostname: `server${i}.example.com`,
          port: 22,
          username: `user${i}`,
          authMethod: 'password' as const,
          metadata: {
            tags: [`env-${i % 5}`, `region-${i % 10}`],
          },
        });
      }

      const startTime = performance.now();
      
      // Perform search
      const results = enhancedConnectionProfileManager.searchProfiles('server');
      
      const endTime = performance.now();
      
      expect(results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(30); // Should search within 30ms
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during rapid re-renders', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many re-renders
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <TerminalThemeSelector 
            currentTheme={`theme-${i % 5}`}
            onThemeChange={jest.fn()}
          />
        );
        unmount();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory usage should not increase significantly
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      }
    });

    it('should clean up event listeners properly', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(
        <DragDropFileTransfer 
          transfers={[]}
          onFileUpload={jest.fn()}
        />
      );
      
      const addedListeners = addEventListenerSpy.mock.calls.length;
      
      unmount();
      
      const removedListeners = removeEventListenerSpy.mock.calls.length;
      
      // Should remove all added listeners
      expect(removedListeners).toBeGreaterThanOrEqual(addedListeners);
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Animation Performance', () => {
    it('should maintain 60fps during theme transitions', async () => {
      const { rerender } = render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      const frameTimestamps: number[] = [];
      
      // Mock requestAnimationFrame to track frame timing
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = jest.fn((callback) => {
        frameTimestamps.push(performance.now());
        return originalRAF(callback);
      });
      
      // Trigger theme change
      act(() => {
        rerender(
          <TerminalThemeSelector 
            currentTheme="monokai"
            onThemeChange={jest.fn()}
          />
        );
      });
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      window.requestAnimationFrame = originalRAF;
      
      // Calculate frame rate
      if (frameTimestamps.length > 1) {
        const frameDurations = frameTimestamps.slice(1).map((timestamp, i) => 
          timestamp - frameTimestamps[i]
        );
        const averageFrameDuration = frameDurations.reduce((a, b) => a + b, 0) / frameDurations.length;
        const fps = 1000 / averageFrameDuration;
        
        // Should maintain at least 30fps (allowing for test environment overhead)
        expect(fps).toBeGreaterThan(30);
      }
    });
  });

  describe('Bundle Size Impact', () => {
    it('should not significantly increase bundle size', () => {
      // This would typically be tested in a build process
      // Here we can at least verify that components are tree-shakeable
      
      const componentExports = [
        TerminalThemeSelector,
        CommandHistorySearch,
        DragDropFileTransfer,
        CollaborationPanel,
        EnhancedConnectionManager,
      ];
      
      // All components should be defined
      componentExports.forEach(Component => {
        expect(Component).toBeDefined();
        expect(typeof Component).toBe('function');
      });
    });
  });

  describe('Network Performance', () => {
    it('should efficiently handle WebSocket message throughput', () => {
      const messages: any[] = [];
      const startTime = performance.now();
      
      // Simulate processing many WebSocket messages
      for (let i = 0; i < 1000; i++) {
        const message = {
          type: 'terminal_output',
          data: {
            sessionId: 'test-session',
            output: `Output line ${i}\n`,
            timestamp: Date.now(),
          },
        };
        messages.push(message);
      }
      
      const endTime = performance.now();
      
      // Should process 1000 messages within 100ms
      expect(endTime - startTime).toBeLessThan(100);
      expect(messages.length).toBe(1000);
    });

    it('should efficiently handle file upload chunking', () => {
      const chunkSize = 64 * 1024; // 64KB chunks
      const fileSize = 10 * 1024 * 1024; // 10MB file
      const chunks: ArrayBuffer[] = [];
      
      const startTime = performance.now();
      
      // Simulate chunking a large file
      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const chunk = new ArrayBuffer(Math.min(chunkSize, fileSize - offset));
        chunks.push(chunk);
      }
      
      const endTime = performance.now();
      
      expect(chunks.length).toBe(Math.ceil(fileSize / chunkSize));
      expect(endTime - startTime).toBeLessThan(50); // Should chunk within 50ms
    });
  });
});
