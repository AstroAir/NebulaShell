import { TerminalThemeManager, defaultThemes } from '@/lib/terminal-themes';
import { mockLocalStorage } from '../utils/test-utils';

describe('TerminalThemeManager', () => {
  let themeManager: TerminalThemeManager;
  let localStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    localStorage = mockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: localStorage,
      writable: true,
    });
    
    // Create a fresh instance for each test
    themeManager = new TerminalThemeManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('loads default themes on initialization', () => {
      const themes = themeManager.getAllThemes();
      
      expect(themes.length).toBeGreaterThanOrEqual(defaultThemes.length);
      expect(themes.some(theme => theme.id === 'default-dark')).toBe(true);
      expect(themes.some(theme => theme.id === 'monokai')).toBe(true);
    });

    it('sets default theme as current theme', () => {
      const currentTheme = themeManager.getCurrentTheme();
      
      expect(currentTheme.id).toBe('default-dark');
    });

    it('loads custom themes from localStorage', () => {
      const customThemes = [
        {
          id: 'custom-1',
          name: 'Custom Theme',
          description: 'A custom theme',
          category: 'custom' as const,
          colors: {
            background: '#123456',
            foreground: '#abcdef',
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
        },
      ];
      
      localStorage.getItem.mockReturnValue(JSON.stringify(customThemes));
      
      const newManager = new TerminalThemeManager();
      const themes = newManager.getAllThemes();
      
      expect(themes.some(theme => theme.id === 'custom-1')).toBe(true);
    });

    it('loads current theme from localStorage', () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'terminal-current-theme') return 'monokai';
        return null;
      });
      
      const newManager = new TerminalThemeManager();
      const currentTheme = newManager.getCurrentTheme();
      
      expect(currentTheme.id).toBe('monokai');
    });
  });

  describe('Theme Management', () => {
    it('gets current theme', () => {
      const currentTheme = themeManager.getCurrentTheme();
      
      expect(currentTheme).toBeDefined();
      expect(currentTheme.id).toBe('default-dark');
    });

    it('sets current theme', () => {
      const success = themeManager.setCurrentTheme('monokai');
      
      expect(success).toBe(true);
      expect(themeManager.getCurrentTheme().id).toBe('monokai');
      expect(localStorage.setItem).toHaveBeenCalledWith('terminal-current-theme', 'monokai');
    });

    it('returns false when setting invalid theme', () => {
      const success = themeManager.setCurrentTheme('non-existent-theme');
      
      expect(success).toBe(false);
      expect(themeManager.getCurrentTheme().id).toBe('default-dark');
    });

    it('gets all themes', () => {
      const themes = themeManager.getAllThemes();
      
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.every(theme => theme.id && theme.name && theme.colors)).toBe(true);
    });

    it('gets themes by category', () => {
      const darkThemes = themeManager.getThemesByCategory('dark');
      const lightThemes = themeManager.getThemesByCategory('light');
      
      expect(darkThemes.every(theme => theme.category === 'dark')).toBe(true);
      expect(lightThemes.every(theme => theme.category === 'light')).toBe(true);
      expect(darkThemes.length).toBeGreaterThan(0);
      expect(lightThemes.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Theme Management', () => {
    const customTheme = {
      id: 'test-custom',
      name: 'Test Custom Theme',
      description: 'A test custom theme',
      category: 'custom' as const,
      colors: {
        background: '#123456',
        foreground: '#abcdef',
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
    };

    it('adds custom theme', () => {
      const success = themeManager.addCustomTheme(customTheme);
      
      expect(success).toBe(true);
      
      const themes = themeManager.getAllThemes();
      expect(themes.some(theme => theme.id === 'test-custom')).toBe(true);
      
      const addedTheme = themes.find(theme => theme.id === 'test-custom');
      expect(addedTheme?.category).toBe('custom');
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('prevents adding duplicate theme IDs', () => {
      themeManager.addCustomTheme(customTheme);
      const success = themeManager.addCustomTheme(customTheme);
      
      expect(success).toBe(false);
    });

    it('removes custom theme', () => {
      themeManager.addCustomTheme(customTheme);
      const success = themeManager.removeCustomTheme('test-custom');
      
      expect(success).toBe(true);
      
      const themes = themeManager.getAllThemes();
      expect(themes.some(theme => theme.id === 'test-custom')).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('prevents removing non-custom themes', () => {
      const success = themeManager.removeCustomTheme('default-dark');
      
      expect(success).toBe(false);
    });

    it('prevents removing non-existent themes', () => {
      const success = themeManager.removeCustomTheme('non-existent');
      
      expect(success).toBe(false);
    });

    it('switches to default theme when removing current custom theme', () => {
      themeManager.addCustomTheme(customTheme);
      themeManager.setCurrentTheme('test-custom');
      
      expect(themeManager.getCurrentTheme().id).toBe('test-custom');
      
      themeManager.removeCustomTheme('test-custom');
      
      expect(themeManager.getCurrentTheme().id).toBe('default-dark');
    });
  });

  describe('Import/Export', () => {
    it('exports themes', () => {
      const customTheme = {
        id: 'export-test',
        name: 'Export Test Theme',
        description: 'A theme for export testing',
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
      };
      
      themeManager.addCustomTheme(customTheme);
      themeManager.setCurrentTheme('export-test');
      
      const exportData = themeManager.exportThemes();
      const parsed = JSON.parse(exportData);
      
      expect(parsed.customThemes).toBeDefined();
      expect(parsed.currentTheme).toBe('export-test');
      expect(parsed.customThemes.some((theme: any) => theme.id === 'export-test')).toBe(true);
    });

    it('imports themes', () => {
      const importData = {
        customThemes: [
          {
            id: 'imported-theme',
            name: 'Imported Theme',
            description: 'An imported theme',
            category: 'custom',
            colors: {
              background: '#111111',
              foreground: '#eeeeee',
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
          },
        ],
        currentTheme: 'imported-theme',
      };
      
      const success = themeManager.importThemes(JSON.stringify(importData));
      
      expect(success).toBe(true);
      
      const themes = themeManager.getAllThemes();
      expect(themes.some(theme => theme.id === 'imported-theme')).toBe(true);
      expect(themeManager.getCurrentTheme().id).toBe('imported-theme');
    });

    it('handles invalid import data gracefully', () => {
      const success = themeManager.importThemes('invalid json');
      
      expect(success).toBe(false);
    });

    it('handles import data without custom themes', () => {
      const importData = { currentTheme: 'monokai' };
      const success = themeManager.importThemes(JSON.stringify(importData));
      
      expect(success).toBe(true);
      expect(themeManager.getCurrentTheme().id).toBe('monokai');
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const customTheme = {
        id: 'error-test',
        name: 'Error Test Theme',
        description: 'A theme for error testing',
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
      };
      
      // Should not throw error
      expect(() => {
        themeManager.addCustomTheme(customTheme);
      }).not.toThrow();
    });

    it('handles corrupted localStorage data', () => {
      localStorage.getItem.mockReturnValue('corrupted json data');
      
      // Should not throw error during initialization
      expect(() => {
        new TerminalThemeManager();
      }).not.toThrow();
    });
  });

  describe('Theme Validation', () => {
    it('validates theme structure', () => {
      const invalidTheme = {
        id: 'invalid-theme',
        name: 'Invalid Theme',
        // Missing required properties
      };
      
      const success = themeManager.addCustomTheme(invalidTheme as any);
      
      // Should handle invalid themes gracefully
      expect(success).toBe(false);
    });
  });
});
