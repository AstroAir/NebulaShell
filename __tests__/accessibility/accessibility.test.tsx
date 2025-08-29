import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TerminalThemeSelector } from '@/components/terminal/TerminalThemeSelector';
import { CommandHistorySearch } from '@/components/terminal/CommandHistorySearch';
import { DragDropFileTransfer } from '@/components/file-transfer/DragDropFileTransfer';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';
import { EnhancedConnectionManager } from '@/components/connection/EnhancedConnectionManager';
import { createMockTerminalTheme, createMockHistoryEntry, createMockCollaborationUser } from '../utils/test-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  describe('Terminal Theme Selector', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for theme cards', () => {
      render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      // Theme cards should have proper labels
      const themeCards = screen.getAllByRole('button');
      themeCards.forEach(card => {
        expect(card).toHaveAttribute('aria-label');
      });
    });

    it('should support keyboard navigation', () => {
      render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      // Tab navigation should work
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('tabindex');
      });
    });

    it('should announce theme changes to screen readers', () => {
      render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      // Should have live region for announcements
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Command History Search', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <CommandHistorySearch onCommandSelect={jest.fn()} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper search input labeling', () => {
      render(<CommandHistorySearch onCommandSelect={jest.fn()} />);
      
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAccessibleName();
      expect(searchInput).toHaveAttribute('aria-describedby');
    });

    it('should announce search results count', () => {
      render(<CommandHistorySearch onCommandSelect={jest.fn()} />);
      
      // Should have results announcement
      const resultsRegion = screen.getByRole('region', { name: /search results/i });
      expect(resultsRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should support keyboard navigation in results', () => {
      render(<CommandHistorySearch onCommandSelect={jest.fn()} />);
      
      // Results should be navigable with keyboard
      const resultsList = screen.getByRole('list');
      expect(resultsList).toHaveAttribute('aria-label');
    });
  });

  describe('File Transfer Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <DragDropFileTransfer 
          transfers={[]}
          onFileUpload={jest.fn()}
          onFileDownload={jest.fn()}
          onTransferCancel={jest.fn()}
          onTransferPause={jest.fn()}
          onTransferResume={jest.fn()}
          onTransferRetry={jest.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper drop zone accessibility', () => {
      render(
        <DragDropFileTransfer 
          transfers={[]}
          onFileUpload={jest.fn()}
        />
      );
      
      const dropZone = screen.getByRole('button', { name: /drag files here/i });
      expect(dropZone).toHaveAttribute('aria-describedby');
      expect(dropZone).toHaveAttribute('tabindex', '0');
    });

    it('should announce file upload progress', () => {
      const transfers = [
        {
          id: 'transfer-1',
          name: 'test.txt',
          size: 1024,
          type: 'text/plain',
          status: 'uploading' as const,
          progress: 50,
          direction: 'upload' as const,
          remotePath: '/test.txt',
        },
      ];
      
      render(
        <DragDropFileTransfer 
          transfers={transfers}
          onFileUpload={jest.fn()}
        />
      );
      
      // Progress bars should have proper labels
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should provide alternative text for file icons', () => {
      const transfers = [
        {
          id: 'transfer-1',
          name: 'document.pdf',
          size: 1024,
          type: 'application/pdf',
          status: 'completed' as const,
          progress: 100,
          direction: 'upload' as const,
          remotePath: '/document.pdf',
        },
      ];
      
      render(
        <DragDropFileTransfer 
          transfers={transfers}
          onFileUpload={jest.fn()}
        />
      );
      
      // File icons should have alt text
      const fileIcon = screen.getByRole('img', { hidden: true });
      expect(fileIcon).toHaveAttribute('aria-label');
    });
  });

  describe('Collaboration Panel', () => {
    const mockUsers = [
      createMockCollaborationUser({
        id: 'user-1',
        name: 'Alice',
        color: '#3b82f6',
        isActive: true,
      }),
      createMockCollaborationUser({
        id: 'user-2',
        name: 'Bob',
        color: '#ef4444',
        isActive: false,
      }),
    ];

    it('should not have accessibility violations', async () => {
      const { container } = render(
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
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper user list accessibility', () => {
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
      
      const userList = screen.getByRole('list');
      expect(userList).toHaveAttribute('aria-label', /connected users/i);
      
      const userItems = screen.getAllByRole('listitem');
      userItems.forEach(item => {
        expect(item).toHaveAttribute('aria-label');
      });
    });

    it('should announce user status changes', () => {
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
      
      // Should have live region for status updates
      const statusRegion = screen.getByRole('status', { hidden: true });
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide accessible session controls', () => {
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
      
      const shareButton = screen.getByRole('button', { name: /share session/i });
      const endButton = screen.getByRole('button', { name: /end session/i });
      
      expect(shareButton).toHaveAccessibleName();
      expect(endButton).toHaveAccessibleName();
    });
  });

  describe('Enhanced Connection Manager', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <EnhancedConnectionManager 
          onConnect={jest.fn()}
          onProfileCreate={jest.fn()}
          onProfileUpdate={jest.fn()}
          onProfileDelete={jest.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper search functionality accessibility', () => {
      render(
        <EnhancedConnectionManager 
          onConnect={jest.fn()}
        />
      );
      
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAccessibleName();
      expect(searchInput).toHaveAttribute('aria-describedby');
    });

    it('should provide accessible profile cards', () => {
      render(
        <EnhancedConnectionManager 
          onConnect={jest.fn()}
        />
      );
      
      // Profile cards should be accessible
      const profileCards = screen.getAllByRole('button');
      profileCards.forEach(card => {
        expect(card).toHaveAccessibleName();
      });
    });

    it('should support keyboard navigation in tabs', () => {
      render(
        <EnhancedConnectionManager 
          onConnect={jest.fn()}
        />
      );
      
      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });
  });

  describe('Color Contrast', () => {
    it('should meet WCAG AA color contrast requirements', async () => {
      const { container } = render(
        <div>
          <TerminalThemeSelector currentTheme="default-dark" onThemeChange={jest.fn()} />
          <CommandHistorySearch onCommandSelect={jest.fn()} />
          <DragDropFileTransfer transfers={[]} onFileUpload={jest.fn()} />
        </div>
      );
      
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      
      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modal dialogs', () => {
      render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      // Open create theme dialog
      const createButton = screen.getByRole('button', { name: /create/i });
      createButton.click();
      
      // Focus should be trapped in dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should restore focus after dialog closes', () => {
      render(
        <TerminalThemeSelector 
          currentTheme="default-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      const createButton = screen.getByRole('button', { name: /create/i });
      createButton.focus();
      createButton.click();
      
      // Close dialog
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.click();
      
      // Focus should return to create button
      expect(createButton).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful headings structure', () => {
      render(
        <div>
          <TerminalThemeSelector currentTheme="default-dark" onThemeChange={jest.fn()} />
          <CommandHistorySearch onCommandSelect={jest.fn()} />
        </div>
      );
      
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check heading hierarchy
      headings.forEach(heading => {
        const level = parseInt(heading.tagName.charAt(1));
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(6);
      });
    });

    it('should provide descriptive labels for interactive elements', () => {
      render(
        <DragDropFileTransfer 
          transfers={[]}
          onFileUpload={jest.fn()}
        />
      );
      
      const interactiveElements = screen.getAllByRole('button');
      interactiveElements.forEach(element => {
        expect(element).toHaveAccessibleName();
      });
    });
  });

  describe('High Contrast Mode', () => {
    it('should work properly in high contrast mode', async () => {
      // Simulate high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      const { container } = render(
        <TerminalThemeSelector 
          currentTheme="high-contrast-dark"
          onThemeChange={jest.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
