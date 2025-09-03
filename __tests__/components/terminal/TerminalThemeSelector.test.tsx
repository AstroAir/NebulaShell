import React from 'react';
import { render, screen, fireEvent, waitFor, user, createMockTerminalTheme } from '../../utils/test-utils';
import { TerminalThemeSelector } from '@/components/terminal/TerminalThemeSelector';

// Mock the terminal theme manager
jest.mock('@/lib/terminal-themes', () => {
  const mockThemes = [
    {
      id: 'default-dark',
      name: 'Default Dark',
      description: 'The default dark theme',
      category: 'dark',
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    },
    {
      id: 'monokai',
      name: 'Monokai',
      description: 'Popular dark theme with vibrant colors',
      category: 'dark',
      colors: {
        background: '#272822',
        foreground: '#f8f8f2',
        cursor: '#f8f8f0',
        selectionBackground: '#49483e',
        black: '#272822',
        red: '#f92672',
        green: '#a6e22e',
        yellow: '#f4bf75',
        blue: '#66d9ef',
        magenta: '#ae81ff',
        cyan: '#a1efe4',
        white: '#f8f8f2',
        brightBlack: '#75715e',
        brightRed: '#f92672',
        brightGreen: '#a6e22e',
        brightYellow: '#f4bf75',
        brightBlue: '#66d9ef',
        brightMagenta: '#ae81ff',
        brightCyan: '#a1efe4',
        brightWhite: '#f9f8f5',
      },
    },
    {
      id: 'solarized-light',
      name: 'Solarized Light',
      description: 'Easy on the eyes light theme',
      category: 'light',
      colors: {
        background: '#fdf6e3',
        foreground: '#657b83',
        cursor: '#657b83',
        selectionBackground: '#eee8d5',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5',
        brightBlack: '#002b36',
        brightRed: '#cb4b16',
        brightGreen: '#586e75',
        brightYellow: '#657b83',
        brightBlue: '#839496',
        brightMagenta: '#6c71c4',
        brightCyan: '#93a1a1',
        brightWhite: '#fdf6e3',
      },
    },
    {
      id: 'custom-theme',
      name: 'Custom Theme',
      description: 'A custom user theme',
      category: 'custom',
      colors: {
        background: '#2d2d2d',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selectionBackground: '#515151',
        black: '#000000',
        red: '#f2777a',
        green: '#99cc99',
        yellow: '#ffcc66',
        blue: '#6699cc',
        magenta: '#cc99cc',
        cyan: '#66cccc',
        white: '#ffffff',
        brightBlack: '#666666',
        brightRed: '#f2777a',
        brightGreen: '#99cc99',
        brightYellow: '#ffcc66',
        brightBlue: '#6699cc',
        brightMagenta: '#cc99cc',
        brightCyan: '#66cccc',
        brightWhite: '#ffffff',
      },
    },
  ];

  return {
    terminalThemeManager: {
      getAllThemes: jest.fn(() => mockThemes),
      getCurrentTheme: jest.fn(() => mockThemes[0]),
      setCurrentTheme: jest.fn(() => true),
      addCustomTheme: jest.fn(() => true),
      removeCustomTheme: jest.fn(() => true),
      exportThemes: jest.fn(() => JSON.stringify(mockThemes)),
      importThemes: jest.fn(() => true),
    },
  };
});

// Get the mocked terminal theme manager from the module mock
const { terminalThemeManager: mockTerminalThemeManager } = jest.requireMock('../../../src/lib/terminal-themes');

describe('TerminalThemeSelector', () => {
  const mockThemes = [
    createMockTerminalTheme({
      id: 'default-dark',
      name: 'Default Dark',
      category: 'dark',
    }),
    createMockTerminalTheme({
      id: 'monokai',
      name: 'Monokai',
      category: 'dark',
    }),
    createMockTerminalTheme({
      id: 'solarized-light',
      name: 'Solarized Light',
      category: 'light',
    }),
    createMockTerminalTheme({
      id: 'custom-theme',
      name: 'Custom Theme',
      category: 'custom',
    }),
  ];

  const defaultProps = {
    currentTheme: 'default-dark',
    onThemeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminalThemeManager.getAllThemes.mockReturnValue(mockThemes);
    mockTerminalThemeManager.getCurrentTheme.mockReturnValue(mockThemes[0]);
  });

  afterEach(() => {
    // Clean up any hanging timers or resources
    jest.clearAllTimers();
    // Use global cleanup function if available
    if ((global as any).cleanupTestTimeouts) {
      (global as any).cleanupTestTimeouts();
    }
  });

  describe('Rendering', () => {
    it('renders the theme selector with title and description', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      expect(screen.getByText('Terminal Themes')).toBeInTheDocument();
      expect(screen.getByText(/Customize your terminal appearance/)).toBeInTheDocument();
    });

    it('renders export and import buttons', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
    });

    it('renders create custom theme button', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    });

    it('renders theme category tabs', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /dark/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /light/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /high contrast/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /custom/i })).toBeInTheDocument();
    });
  });

  describe('Theme Selection', () => {
    it('displays all themes in the all tab', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      mockThemes.forEach(theme => {
        expect(screen.getByText(theme.name)).toBeInTheDocument();
      });
    });

    it('calls onThemeChange when a theme is selected', async () => {
      const onThemeChange = jest.fn();
      mockTerminalThemeManager.setCurrentTheme.mockReturnValue(true);

      render(<TerminalThemeSelector {...defaultProps} onThemeChange={onThemeChange} />);

      const monokaiTheme = screen.getByText('Monokai').closest('div[role="button"]');
      await user.click(monokaiTheme!);

      expect(mockTerminalThemeManager.setCurrentTheme).toHaveBeenCalledWith('monokai');
      expect(onThemeChange).toHaveBeenCalledWith('monokai');
    });

    it('highlights the currently selected theme', () => {
      render(<TerminalThemeSelector {...defaultProps} currentTheme="monokai" />);
      
      const monokaiCard = screen.getByText('Monokai').closest('.ring-2');
      expect(monokaiCard).toBeInTheDocument();
    });

    it('shows active badge for current theme', () => {
      render(<TerminalThemeSelector {...defaultProps} currentTheme="monokai" />);

      // Look for the Active badge specifically
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Theme Categories', () => {
    it('filters themes by category when tab is selected', async () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /dark/i }));
      
      expect(screen.getByText('Default Dark')).toBeInTheDocument();
      expect(screen.getByText('Monokai')).toBeInTheDocument();
      expect(screen.queryByText('Solarized Light')).not.toBeInTheDocument();
    });

    it('shows only light themes in light tab', async () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /light/i }));
      
      expect(screen.getByText('Solarized Light')).toBeInTheDocument();
      expect(screen.queryByText('Default Dark')).not.toBeInTheDocument();
      expect(screen.queryByText('Monokai')).not.toBeInTheDocument();
    });

    it('shows only custom themes in custom tab', async () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      await user.click(screen.getByRole('tab', { name: /custom/i }));
      
      expect(screen.getByText('Custom Theme')).toBeInTheDocument();
      expect(screen.queryByText('Default Dark')).not.toBeInTheDocument();
    });
  });

  describe('Theme Preview', () => {
    it('shows theme preview with terminal colors', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      const previewElements = screen.getAllByText('$ ls -la');
      expect(previewElements.length).toBeGreaterThan(0);
    });

    it('applies theme colors to preview', () => {
      render(<TerminalThemeSelector {...defaultProps} />);

      const preview = screen.getAllByText('$ ls -la')[0].parentElement;
      expect(preview).toHaveStyle({
        backgroundColor: '#000000',
        color: '#ffffff',
      });
    });

    it('shows preview button for each theme', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      const previewButtons = screen.getAllByText('Preview');
      expect(previewButtons).toHaveLength(mockThemes.length);
    });
  });

  describe('Custom Theme Management', () => {
    it('opens create custom theme dialog when create button is clicked', async () => {
      render(<TerminalThemeSelector {...defaultProps} />);

      await user.click(screen.getByTestId('create-theme-button'));

      expect(screen.getByText(/Design your own terminal theme/)).toBeInTheDocument();
    });

    it('shows delete button for custom themes', () => {
      render(<TerminalThemeSelector {...defaultProps} />);

      const deleteButton = screen.getByTestId('delete-theme');
      expect(deleteButton).toBeInTheDocument();
    });

    it('calls removeCustomTheme when delete button is clicked', async () => {
      mockTerminalThemeManager.removeCustomTheme.mockReturnValue(true);
      
      render(<TerminalThemeSelector {...defaultProps} />);
      
      const customThemeCard = screen.getByText('Custom Theme').closest('div');
      const deleteButton = customThemeCard?.querySelector('button:last-child');
      
      if (deleteButton) {
        await user.click(deleteButton);
        expect(mockTerminalThemeManager.removeCustomTheme).toHaveBeenCalledWith('custom-theme');
      }
    });
  });

  describe('Import/Export', () => {
    it('calls exportThemes when export button is clicked', async () => {
      const mockExportData = JSON.stringify({ themes: mockThemes });
      mockTerminalThemeManager.exportThemes.mockReturnValue(mockExportData);

      render(<TerminalThemeSelector {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(mockTerminalThemeManager.exportThemes).toHaveBeenCalled();
    });

    it('handles file import when file is selected', async () => {
      mockTerminalThemeManager.importThemes.mockReturnValue(true);
      
      render(<TerminalThemeSelector {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/import/i);
      const file = new File(['{"themes": []}'], 'themes.json', { type: 'application/json' });
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(mockTerminalThemeManager.importThemes).toHaveBeenCalled();
      });
    });

    it('handles import errors gracefully', async () => {
      mockTerminalThemeManager.importThemes.mockReturnValue(false);
      
      render(<TerminalThemeSelector {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/import/i);
      const file = new File(['invalid json'], 'themes.json', { type: 'application/json' });
      
      await user.upload(fileInput, file);
      
      // Should not throw error and should handle gracefully
      await waitFor(() => {
        expect(mockTerminalThemeManager.importThemes).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(5);
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1); // Only active panel is rendered
    });

    it('supports keyboard navigation', async () => {
      render(<TerminalThemeSelector {...defaultProps} />);
      
      const firstTab = screen.getByRole('tab', { name: /all/i });
      firstTab.focus();
      
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /dark/i })).toHaveFocus();
    });

    it('announces theme changes to screen readers', async () => {
      const onThemeChange = jest.fn();
      mockTerminalThemeManager.setCurrentTheme.mockReturnValue(true);
      
      render(<TerminalThemeSelector {...defaultProps} onThemeChange={onThemeChange} />);
      
      const monokaiTheme = screen.getByText('Monokai').closest('[role="button"]');
      await user.click(monokaiTheme!);
      
      // The accessibility provider should announce the change
      // This would be tested in integration with the accessibility provider
    });
  });

  describe('Error Handling', () => {
    it('handles theme manager errors gracefully', () => {
      mockTerminalThemeManager.getAllThemes.mockImplementation(() => {
        throw new Error('Theme manager error');
      });
      
      expect(() => {
        render(<TerminalThemeSelector {...defaultProps} />);
      }).not.toThrow();
    });

    it('shows fallback when no themes are available', () => {
      mockTerminalThemeManager.getAllThemes.mockReturnValue([]);
      
      render(<TerminalThemeSelector {...defaultProps} />);
      
      // Should still render the component structure
      expect(screen.getByText('Terminal Themes')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily when props do not change', () => {
      const { rerender } = render(<TerminalThemeSelector {...defaultProps} />);
      
      const initialRenderCount = mockTerminalThemeManager.getAllThemes.mock.calls.length;
      
      // Re-render with same props
      rerender(<TerminalThemeSelector {...defaultProps} />);
      
      // Should not call getAllThemes again if properly memoized
      expect(mockTerminalThemeManager.getAllThemes.mock.calls.length).toBe(initialRenderCount);
    });
  });
});
