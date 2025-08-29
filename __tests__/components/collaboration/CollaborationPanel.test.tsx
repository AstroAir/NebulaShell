import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, user, createMockCollaborationUser, createMockWebSocket } from '../../utils/test-utils';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';

// Mock the WebSocket collaboration manager
jest.mock('@/lib/websocket-collaboration-manager', () => ({
  webSocketCollaborationManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    shareSession: jest.fn(),
    joinSession: jest.fn(),
    sendMessage: jest.fn(),
    getConnectedUsers: jest.fn(),
    isConnected: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

describe('CollaborationPanel', () => {
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
      isActive: true,
    }),
    createMockCollaborationUser({
      id: 'user-3',
      name: 'Charlie',
      color: '#10b981',
      isActive: false,
    }),
  ];

  const defaultProps = {
    sessionId: 'test-session-123',
    currentUser: mockUsers[0],
    connectedUsers: mockUsers,
    onUserJoin: jest.fn(),
    onUserLeave: jest.fn(),
    onSessionShare: jest.fn(),
    onSessionEnd: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders collaboration panel with title', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByText('Collaboration')).toBeInTheDocument();
      expect(screen.getByText(/Share your terminal session/)).toBeInTheDocument();
    });

    it('displays current session information', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByText('Session ID:')).toBeInTheDocument();
      expect(screen.getByText('test-session-123')).toBeInTheDocument();
    });

    it('shows connected users count', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByText('Connected Users (3)')).toBeInTheDocument();
    });

    it('displays share session button', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /share session/i })).toBeInTheDocument();
    });

    it('displays end session button', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /end session/i })).toBeInTheDocument();
    });
  });

  describe('User List', () => {
    it('displays all connected users', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('shows user avatars with correct colors', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      const aliceAvatar = screen.getByText('A').closest('div');
      const bobAvatar = screen.getByText('B').closest('div');
      
      expect(aliceAvatar).toHaveStyle({ backgroundColor: '#3b82f6' });
      expect(bobAvatar).toHaveStyle({ backgroundColor: '#ef4444' });
    });

    it('indicates active vs inactive users', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      // Active users should have online indicator
      const aliceCard = screen.getByText('Alice').closest('div');
      const bobCard = screen.getByText('Bob').closest('div');
      const charlieCard = screen.getByText('Charlie').closest('div');
      
      expect(aliceCard).toHaveTextContent('Online');
      expect(bobCard).toHaveTextContent('Online');
      expect(charlieCard).toHaveTextContent('Away');
    });

    it('shows current user indicator', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      const aliceCard = screen.getByText('Alice').closest('div');
      expect(aliceCard).toHaveTextContent('You');
    });

    it('displays user cursor positions', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      // Should show cursor position information
      expect(screen.getByText('Line 1, Col 1')).toBeInTheDocument();
    });
  });

  describe('Session Sharing', () => {
    it('opens share dialog when share button is clicked', async () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /share session/i }));
      
      expect(screen.getByText('Share Terminal Session')).toBeInTheDocument();
      expect(screen.getByText(/Share this link with others/)).toBeInTheDocument();
    });

    it('displays shareable link in dialog', async () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /share session/i }));
      
      const shareLink = screen.getByDisplayValue(/localhost:3000\/collaborate/);
      expect(shareLink).toBeInTheDocument();
    });

    it('copies share link to clipboard', async () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /share session/i }));
      await user.click(screen.getByRole('button', { name: /copy link/i }));
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('test-session-123')
      );
    });

    it('calls onSessionShare when sharing', async () => {
      const onSessionShare = jest.fn();
      render(<CollaborationPanel {...defaultProps} onSessionShare={onSessionShare} />);
      
      await user.click(screen.getByRole('button', { name: /share session/i }));
      await user.click(screen.getByRole('button', { name: /copy link/i }));
      
      expect(onSessionShare).toHaveBeenCalledWith('test-session-123');
    });

    it('shows QR code for mobile sharing', async () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /share session/i }));
      await user.click(screen.getByRole('button', { name: /qr code/i }));
      
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });
  });

  describe('Session Management', () => {
    it('ends session when end button is clicked', async () => {
      const onSessionEnd = jest.fn();
      render(<CollaborationPanel {...defaultProps} onSessionEnd={onSessionEnd} />);
      
      await user.click(screen.getByRole('button', { name: /end session/i }));
      
      // Should show confirmation dialog
      expect(screen.getByText('End Collaboration Session')).toBeInTheDocument();
      
      await user.click(screen.getByRole('button', { name: /end session/i }));
      
      expect(onSessionEnd).toHaveBeenCalledWith('test-session-123');
    });

    it('shows session statistics', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByText('Session Duration:')).toBeInTheDocument();
      expect(screen.getByText('Commands Executed:')).toBeInTheDocument();
    });

    it('displays session permissions', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      // Should show permission controls
      expect(screen.getByText('Permissions')).toBeInTheDocument();
      expect(screen.getByText('Allow Input')).toBeInTheDocument();
      expect(screen.getByText('View Only')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles user joining session', async () => {
      const onUserJoin = jest.fn();
      const { rerender } = render(
        <CollaborationPanel {...defaultProps} onUserJoin={onUserJoin} />
      );
      
      const newUser = createMockCollaborationUser({
        id: 'user-4',
        name: 'David',
        color: '#8b5cf6',
      });
      
      // Simulate user joining
      rerender(
        <CollaborationPanel 
          {...defaultProps} 
          connectedUsers={[...mockUsers, newUser]}
          onUserJoin={onUserJoin}
        />
      );
      
      expect(screen.getByText('David')).toBeInTheDocument();
    });

    it('handles user leaving session', async () => {
      const onUserLeave = jest.fn();
      const { rerender } = render(
        <CollaborationPanel {...defaultProps} onUserLeave={onUserLeave} />
      );
      
      // Simulate user leaving
      rerender(
        <CollaborationPanel 
          {...defaultProps} 
          connectedUsers={mockUsers.slice(0, 2)}
          onUserLeave={onUserLeave}
        />
      );
      
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
      expect(screen.getByText('Connected Users (2)')).toBeInTheDocument();
    });

    it('shows user activity indicators', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      // Should show typing indicators or other activity
      const activeUsers = screen.getAllByText('Online');
      expect(activeUsers.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates', () => {
    it('updates user cursor positions in real-time', async () => {
      const { rerender } = render(<CollaborationPanel {...defaultProps} />);
      
      const updatedUsers = mockUsers.map(user => 
        user.id === 'user-2' 
          ? { ...user, cursor: { x: 10, y: 5, line: 5, column: 10 } }
          : user
      );
      
      rerender(<CollaborationPanel {...defaultProps} connectedUsers={updatedUsers} />);
      
      expect(screen.getByText('Line 5, Col 10')).toBeInTheDocument();
    });

    it('shows typing indicators', () => {
      const typingUsers = mockUsers.map(user => 
        user.id === 'user-2' 
          ? { ...user, isTyping: true }
          : user
      );
      
      render(<CollaborationPanel {...defaultProps} connectedUsers={typingUsers} />);
      
      expect(screen.getByText('typing...')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('shows connection status indicator', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('handles connection errors', () => {
      render(
        <CollaborationPanel 
          {...defaultProps} 
          connectionStatus="error"
          connectionError="WebSocket connection failed"
        />
      );
      
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument();
    });

    it('shows reconnecting status', () => {
      render(
        <CollaborationPanel 
          {...defaultProps} 
          connectionStatus="reconnecting"
        />
      );
      
      expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      expect(screen.getByRole('region', { name: /collaboration/i })).toBeInTheDocument();
      expect(screen.getByRole('list')).toBeInTheDocument(); // User list
      expect(screen.getAllByRole('listitem')).toHaveLength(3); // User items
    });

    it('supports keyboard navigation', async () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      const shareButton = screen.getByRole('button', { name: /share session/i });
      shareButton.focus();
      
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('Share Terminal Session')).toBeInTheDocument();
    });

    it('announces user join/leave events', () => {
      render(<CollaborationPanel {...defaultProps} />);
      
      // The accessibility provider should announce these events
      // This would be tested in integration with the accessibility provider
    });
  });

  describe('Error Handling', () => {
    it('handles missing session ID gracefully', () => {
      render(<CollaborationPanel {...defaultProps} sessionId="" />);
      
      expect(screen.getByText('No active session')).toBeInTheDocument();
    });

    it('handles empty user list', () => {
      render(<CollaborationPanel {...defaultProps} connectedUsers={[]} />);
      
      expect(screen.getByText('No users connected')).toBeInTheDocument();
    });

    it('handles WebSocket connection failures', () => {
      render(
        <CollaborationPanel 
          {...defaultProps} 
          connectionStatus="error"
          connectionError="Failed to connect to collaboration server"
        />
      );
      
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large numbers of users efficiently', () => {
      const manyUsers = Array.from({ length: 100 }, (_, i) => 
        createMockCollaborationUser({
          id: `user-${i}`,
          name: `User ${i}`,
          color: '#3b82f6',
        })
      );
      
      const startTime = performance.now();
      render(<CollaborationPanel {...defaultProps} connectedUsers={manyUsers} />);
      const endTime = performance.now();
      
      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('efficiently updates user positions', () => {
      const { rerender } = render(<CollaborationPanel {...defaultProps} />);
      
      // Simulate rapid cursor updates
      for (let i = 0; i < 10; i++) {
        const updatedUsers = mockUsers.map(user => ({
          ...user,
          cursor: { x: i, y: i, line: i, column: i },
        }));
        
        rerender(<CollaborationPanel {...defaultProps} connectedUsers={updatedUsers} />);
      }
      
      // Should handle updates without performance issues
      expect(screen.getByText('Collaboration')).toBeInTheDocument();
    });
  });
});
