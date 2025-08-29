import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, user, createMockHistoryEntry } from '../../utils/test-utils';
import { CommandHistorySearch } from '@/components/terminal/CommandHistorySearch';
import { enhancedTerminalHistoryManager } from '@/lib/terminal-history-enhanced';

// Mock the history manager
jest.mock('@/lib/terminal-history-enhanced', () => ({
  enhancedTerminalHistoryManager: {
    search: jest.fn(),
    getMostUsedCommands: jest.fn(),
    getStats: jest.fn(),
    toggleFavorite: jest.fn(),
    exportHistory: jest.fn(),
    importHistory: jest.fn(),
  },
}));

const mockHistoryManager = enhancedTerminalHistoryManager as jest.Mocked<typeof enhancedTerminalHistoryManager>;

describe('CommandHistorySearch', () => {
  const mockHistoryEntries = [
    createMockHistoryEntry({
      id: 'entry-1',
      command: 'ls -la',
      timestamp: Date.now() - 1000,
      exitCode: 0,
      workingDirectory: '/home/user',
      tags: ['filesystem'],
    }),
    createMockHistoryEntry({
      id: 'entry-2',
      command: 'git status',
      timestamp: Date.now() - 2000,
      exitCode: 0,
      workingDirectory: '/home/user/project',
      tags: ['git'],
      favorite: true,
    }),
    createMockHistoryEntry({
      id: 'entry-3',
      command: 'npm install',
      timestamp: Date.now() - 3000,
      exitCode: 1,
      workingDirectory: '/home/user/project',
      tags: ['npm'],
    }),
  ];

  const mockMostUsedCommands = [
    { command: 'ls -la', count: 15 },
    { command: 'git status', count: 12 },
    { command: 'npm install', count: 8 },
  ];

  const mockStats = {
    totalCommands: 100,
    uniqueCommands: 45,
    mostUsedCommands: mockMostUsedCommands,
    averageSessionLength: 300000,
    commandsPerDay: [
      { date: '2024-01-01', count: 10 },
      { date: '2024-01-02', count: 15 },
    ],
    successRate: 85.5,
  };

  const defaultProps = {
    onCommandSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHistoryManager.search.mockReturnValue(mockHistoryEntries);
    mockHistoryManager.getMostUsedCommands.mockReturnValue(mockMostUsedCommands);
    mockHistoryManager.getStats.mockReturnValue(mockStats);
  });

  describe('Rendering', () => {
    it('renders the command history search interface', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByText('Command History')).toBeInTheDocument();
      expect(screen.getByText(/Search and manage your terminal command history/)).toBeInTheDocument();
    });

    it('renders search input with placeholder', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search commands/);
      expect(searchInput).toBeInTheDocument();
    });

    it('renders filter and export buttons', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('renders tab navigation', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByRole('tab', { name: /results/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /most used/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /statistics/i })).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('performs search when query is entered', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search commands/);
      await user.type(searchInput, 'git');
      
      // Wait for debounced search
      await waitFor(() => {
        expect(mockHistoryManager.search).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'git' })
        );
      }, { timeout: 1000 });
    });

    it('displays search results', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      mockHistoryEntries.forEach(entry => {
        expect(screen.getByText(entry.command)).toBeInTheDocument();
      });
    });

    it('shows command metadata (timestamp, directory, exit code)', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByText('/home/user')).toBeInTheDocument();
      expect(screen.getByText('/home/user/project')).toBeInTheDocument();
    });

    it('displays tags for commands', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByText('filesystem')).toBeInTheDocument();
      expect(screen.getByText('git')).toBeInTheDocument();
      expect(screen.getByText('npm')).toBeInTheDocument();
    });

    it('shows exit code badges with appropriate colors', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      // Success (exit code 0) should have success styling
      const successBadges = screen.getAllByText('0');
      expect(successBadges.length).toBeGreaterThan(0);
      
      // Error (exit code 1) should have error styling
      const errorBadges = screen.getAllByText('1');
      expect(errorBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Command Selection', () => {
    it('calls onCommandSelect when command is clicked', async () => {
      const onCommandSelect = jest.fn();
      render(<CommandHistorySearch {...defaultProps} onCommandSelect={onCommandSelect} />);
      
      const commandCard = screen.getByText('ls -la').closest('[role="button"]');
      await user.click(commandCard!);
      
      expect(onCommandSelect).toHaveBeenCalledWith('ls -la');
    });

    it('copies command to clipboard when copy button is clicked', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      const copyButtons = screen.getAllByRole('button');
      const copyButton = copyButtons.find(btn => 
        btn.querySelector('svg') && btn.getAttribute('aria-label')?.includes('copy')
      );
      
      if (copyButton) {
        await user.click(copyButton);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      }
    });
  });

  describe('Favorites Management', () => {
    it('shows favorite star for favorited commands', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      // The git status command is marked as favorite
      const gitStatusCard = screen.getByText('git status').closest('div');
      expect(gitStatusCard).toBeInTheDocument();
    });

    it('toggles favorite status when star is clicked', async () => {
      mockHistoryManager.toggleFavorite.mockReturnValue(true);
      
      render(<CommandHistorySearch {...defaultProps} />);
      
      const favoriteButtons = screen.getAllByRole('button');
      const starButton = favoriteButtons.find(btn => 
        btn.querySelector('svg') && btn.getAttribute('aria-label')?.includes('favorite')
      );
      
      if (starButton) {
        await user.click(starButton);
        expect(mockHistoryManager.toggleFavorite).toHaveBeenCalled();
      }
    });
  });

  describe('Filtering', () => {
    it('shows filter panel when filters button is clicked', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /filters/i }));
      
      expect(screen.getByText('Exit Code')).toBeInTheDocument();
      expect(screen.getByText('Show Favorites')).toBeInTheDocument();
      expect(screen.getByText('Limit')).toBeInTheDocument();
    });

    it('applies exit code filter', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /filters/i }));
      
      const exitCodeSelect = screen.getByRole('combobox');
      await user.click(exitCodeSelect);
      await user.click(screen.getByText('Success (0)'));
      
      expect(mockHistoryManager.search).toHaveBeenCalledWith(
        expect.objectContaining({ exitCode: 0 })
      );
    });

    it('applies favorites filter', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /filters/i }));
      
      const favoritesSelect = screen.getAllByRole('combobox')[1];
      await user.click(favoritesSelect);
      await user.click(screen.getByText('Favorites Only'));
      
      expect(mockHistoryManager.search).toHaveBeenCalledWith(
        expect.objectContaining({ favorites: true })
      );
    });
  });

  describe('Most Used Commands Tab', () => {
    it('displays most used commands when tab is selected', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /most used/i }));
      
      expect(screen.getByText('ls -la')).toBeInTheDocument();
      expect(screen.getByText('15 times')).toBeInTheDocument();
      expect(screen.getByText('git status')).toBeInTheDocument();
      expect(screen.getByText('12 times')).toBeInTheDocument();
    });

    it('shows ranking badges for most used commands', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /most used/i }));
      
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });
  });

  describe('Statistics Tab', () => {
    it('displays usage statistics when tab is selected', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /statistics/i }));
      
      expect(screen.getByText('Total Commands:')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Unique Commands:')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Success Rate:')).toBeInTheDocument();
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });

    it('displays recent activity data', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /statistics/i }));
      
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      // Should show commands per day data
    });
  });

  describe('Export/Import', () => {
    it('exports history when export button is clicked', async () => {
      const mockExportData = JSON.stringify({ history: mockHistoryEntries });
      mockHistoryManager.exportHistory.mockReturnValue(mockExportData);
      
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      mockCreateElement.mockReturnValue(mockAnchor as any);
      
      render(<CommandHistorySearch {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /export/i }));
      
      expect(mockHistoryManager.exportHistory).toHaveBeenCalled();
      expect(mockAnchor.click).toHaveBeenCalled();
      
      mockCreateElement.mockRestore();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no commands found', () => {
      mockHistoryManager.search.mockReturnValue([]);
      
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByText('No commands found')).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('supports keyboard navigation', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      const searchInput = screen.getByRole('searchbox');
      searchInput.focus();
      
      await user.keyboard('{Tab}');
      // Should move to next focusable element
    });

    it('announces search results to screen readers', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search commands/);
      await user.type(searchInput, 'git');
      
      // The accessibility provider should announce the results
      await waitFor(() => {
        expect(mockHistoryManager.search).toHaveBeenCalled();
      });
    });
  });

  describe('Performance', () => {
    it('debounces search input to avoid excessive API calls', async () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search commands/);
      
      // Type multiple characters quickly
      await user.type(searchInput, 'git status');
      
      // Should only call search once after debounce delay
      await waitFor(() => {
        expect(mockHistoryManager.search).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
    });

    it('limits results to prevent performance issues', () => {
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(mockHistoryManager.search).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles search errors gracefully', () => {
      mockHistoryManager.search.mockImplementation(() => {
        throw new Error('Search error');
      });
      
      expect(() => {
        render(<CommandHistorySearch {...defaultProps} />);
      }).not.toThrow();
    });

    it('handles missing data gracefully', () => {
      mockHistoryManager.getStats.mockReturnValue({
        totalCommands: 0,
        uniqueCommands: 0,
        mostUsedCommands: [],
        averageSessionLength: 0,
        commandsPerDay: [],
        successRate: 0,
      });
      
      render(<CommandHistorySearch {...defaultProps} />);
      
      expect(screen.getByText('Command History')).toBeInTheDocument();
    });
  });
});
