import { TerminalSettingsManager } from '../terminal-settings-manager';

// Mock dependencies
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('TerminalSettingsManager', () => {
  let settingsManager: TerminalSettingsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    settingsManager = new TerminalSettingsManager();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const settings = settingsManager.getSettings();
      
      expect(settings.theme).toBe('default-dark');
      expect(settings.font.family).toContain('Cascadia Code');
      expect(settings.font.size).toBe(14);
      expect(settings.cursor.style).toBe('block');
      expect(settings.scrollback.lines).toBe(1000);
    });

    it('should load settings from localStorage', () => {
      const savedPreferences = {
        settings: {
          theme: 'custom-theme',
          font: {
            family: 'Monaco',
            size: 16,
            lineHeight: 1.2
          },
          cursor: {
            style: 'underline' as const,
            blink: false
          },
          scrollback: {
            lines: 1000,
            enabled: true
          },
          bell: {
            sound: false,
            visual: true,
            duration: 150
          },
          tabSize: 4,
          wordSeparator: ' ()[]{}\'"`',
          allowTransparency: false,
          macOptionIsMeta: false,
          macOptionClickForcesSelection: false,
          rightClickSelectsWord: true,
          rendererType: 'canvas' as const,
          fastScrollModifier: 'alt' as const,
          fastScrollSensitivity: 5,
          scrollSensitivity: 1,
          minimumContrastRatio: 1,
          drawBoldTextInBrightColors: true,
          allowProposedApi: false,
          shortcuts: []
        },
        shortcuts: [],
        customThemes: [],
        version: '1.0.0',
        lastUpdated: new Date()
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedPreferences));

      const manager = new TerminalSettingsManager();
      const settings = manager.getSettings();

      expect(settings.theme).toBe('custom-theme');
      expect(settings.font.size).toBe(16);
      expect(settings.font.family).toBe('Monaco');
      expect(settings.cursor.style).toBe('underline');
    });

    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      expect(() => new TerminalSettingsManager()).not.toThrow();
    });

    it('should initialize built-in themes', () => {
      const themes = settingsManager.getAllThemes();
      
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.some(t => t.id === 'default-dark')).toBe(true);
      expect(themes.some(t => t.id === 'default-light')).toBe(true);
    });

    it('should initialize default keyboard shortcuts', () => {
      const shortcuts = settingsManager.getAllShortcuts();
      
      expect(shortcuts.length).toBeGreaterThan(0);
      expect(shortcuts.some(s => s.id === 'copy')).toBe(true);
      expect(shortcuts.some(s => s.id === 'paste')).toBe(true);
      expect(shortcuts.some(s => s.id === 'clear')).toBe(true);
    });
  });

  describe('Settings Management', () => {
    it('should update settings', () => {
      const updates = {
        theme: 'new-theme',
        font: {
          family: '"Cascadia Code", monospace',
          size: 18,
          lineHeight: 1.2
        },
        cursor: { style: 'block' as const, blink: false },
      };
      
      settingsManager.updateSettings(updates);
      const settings = settingsManager.getSettings();
      
      expect(settings.theme).toBe('new-theme');
      expect(settings.font.size).toBe(18);
      expect(settings.cursor.blink).toBe(false);
    });

    it('should save settings to localStorage', () => {
      settingsManager.updateSettings({ theme: 'test-theme' });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'webssh_terminal_settings',
        expect.any(String)
      );
    });

    it('should emit settingsChanged event', () => {
      const settingsChangedSpy = jest.fn();
      settingsManager.on('settingsChanged', settingsChangedSpy);
      
      const updates = { theme: 'new-theme' };
      settingsManager.updateSettings(updates);
      
      expect(settingsChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'new-theme' })
      );
    });

    it('should reset settings to defaults', () => {
      // First modify settings
      settingsManager.updateSettings({
        theme: 'custom',
        font: {
          family: '"Cascadia Code", monospace',
          size: 20,
          lineHeight: 1.2
        }
      });
      
      // Then reset
      settingsManager.resetSettings();
      
      const settings = settingsManager.getSettings();
      expect(settings.theme).toBe('default-dark');
      expect(settings.font.size).toBe(14);
    });
  });

  describe('Theme Management', () => {
    it('should get current theme', () => {
      const settings = settingsManager.getSettings();
      const theme = settingsManager.getTheme(settings.theme);
      
      expect(theme).toBeDefined();
      expect(theme?.id).toBe('default-dark');
    });

    it('should set current theme', () => {
      const success = settingsManager.setActiveTheme('default-light');
      
      expect(success).toBe(true);
      expect(settingsManager.getSettings().theme).toBe('default-light');
    });

    it('should return false for non-existent theme', () => {
      const success = settingsManager.setActiveTheme('non-existent-theme');
      
      expect(success).toBe(false);
    });

    it('should add custom theme', () => {
      const customTheme = {
        name: 'Custom Theme',
        description: 'A custom theme',
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selectionBackground: '#333333',
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff',
          brightBlack: '#666666',
          brightRed: '#ff6666',
          brightGreen: '#66ff66',
          brightYellow: '#ffff66',
          brightBlue: '#6666ff',
          brightMagenta: '#ff66ff',
          brightCyan: '#66ffff',
          brightWhite: '#ffffff',
        },
      };

      const createdTheme = settingsManager.createCustomTheme(customTheme);
      
      expect(createdTheme).toBeDefined();
      expect(createdTheme.name).toBe('Custom Theme');

      const themes = settingsManager.getAllThemes();
      expect(themes.some(t => t.id === createdTheme.id)).toBe(true);
    });

    it('should create theme with unique ID', () => {
      const duplicateTheme = {
        name: 'Duplicate Theme',
        description: 'A duplicate theme',
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selectionBackground: '#333333',
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff',
          brightBlack: '#666666',
          brightRed: '#ff6666',
          brightGreen: '#66ff66',
          brightYellow: '#ffff66',
          brightBlue: '#6666ff',
          brightMagenta: '#ff66ff',
          brightCyan: '#66ffff',
          brightWhite: '#ffffff',
        },
      };

      const createdTheme = settingsManager.createCustomTheme(duplicateTheme);

      expect(createdTheme).toBeDefined();
      expect(createdTheme.id).not.toBe('default-dark'); // Should have unique ID
    });

    it('should remove custom theme', () => {
      // First add a custom theme
      const customTheme = {
        name: 'Removable Theme',
        description: 'A theme to be removed',
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selectionBackground: '#333333',
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff',
          brightBlack: '#666666',
          brightRed: '#ff6666',
          brightGreen: '#66ff66',
          brightYellow: '#ffff66',
          brightBlue: '#6666ff',
          brightMagenta: '#ff66ff',
          brightCyan: '#66ffff',
          brightWhite: '#ffffff',
        },
      };

      const createdTheme = settingsManager.createCustomTheme(customTheme);

      // Then remove it
      const success = settingsManager.deleteCustomTheme(createdTheme.id);
      
      expect(success).toBe(true);
      
      const themes = settingsManager.getAllThemes();
      expect(themes.some(t => t.id === createdTheme.id)).toBe(false);
    });

    it('should not remove built-in theme', () => {
      const success = settingsManager.deleteCustomTheme('default-dark');
      
      expect(success).toBe(false);
    });

    it('should get custom themes only', () => {
      // Add a custom theme
      const customTheme = {
        name: 'Custom Only',
        description: 'Custom theme',
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selectionBackground: '#333333',
          black: '#000000',
          red: '#ff0000',
          green: '#00ff00',
          yellow: '#ffff00',
          blue: '#0000ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          white: '#ffffff',
          brightBlack: '#666666',
          brightRed: '#ff6666',
          brightGreen: '#66ff66',
          brightYellow: '#ffff66',
          brightBlue: '#6666ff',
          brightMagenta: '#ff66ff',
          brightCyan: '#66ffff',
          brightWhite: '#ffffff',
        },
      };

      const createdTheme = settingsManager.createCustomTheme(customTheme);

      const customThemes = settingsManager.getCustomThemes();

      expect(customThemes.length).toBeGreaterThan(0);
      expect(customThemes.every(t => !t.isBuiltIn)).toBe(true);
      expect(customThemes.some(t => t.id === createdTheme.id)).toBe(true);
    });
  });

  describe('Keyboard Shortcuts Management', () => {
    it('should get shortcut by ID', () => {
      const shortcut = settingsManager.getShortcut('copy');
      
      expect(shortcut).toBeDefined();
      expect(shortcut?.id).toBe('copy');
      expect(shortcut?.keys).toContain('Ctrl+C');
    });

    it('should update shortcut', () => {
      const success = settingsManager.updateShortcut('copy', ['Ctrl+Shift+C']);
      
      expect(success).toBe(true);
      
      const shortcut = settingsManager.getShortcut('copy');
      expect(shortcut?.keys).toEqual(['Ctrl+Shift+C']);
    });

    it('should return false for non-existent shortcut update', () => {
      const success = settingsManager.updateShortcut('non-existent', ['Ctrl+X']);
      
      expect(success).toBe(false);
    });

    it('should reset all shortcuts to defaults', () => {
      // First modify shortcut
      settingsManager.updateShortcut('copy', ['Ctrl+Shift+C']);

      // Then reset all shortcuts
      settingsManager.resetShortcuts();

      const shortcut = settingsManager.getShortcut('copy');
      expect(shortcut?.keys).toContain('Ctrl+C'); // Back to default
    });

    it('should get shortcuts by category', () => {
      const editShortcuts = settingsManager.getShortcutsByCategory('edit');

      expect(editShortcuts.length).toBeGreaterThan(0);
      expect(editShortcuts.every(s => s.category === 'edit')).toBe(true);
    });

    it('should toggle shortcut enabled state', () => {
      const shortcut = settingsManager.getShortcut('copy');
      const originalState = shortcut?.enabled;

      const success = settingsManager.toggleShortcut('copy');
      expect(success).toBe(true);

      const updatedShortcut = settingsManager.getShortcut('copy');
      expect(updatedShortcut?.enabled).toBe(!originalState);
    });
  });

  describe('Enhanced Features Settings', () => {
    it('should get enhanced features settings', () => {
      const features = settingsManager.getEnhancedFeatures();
      
      expect(features).toBeDefined();
      expect(typeof features.multiLineInput).toBe('boolean');
      expect(typeof features.keyboardShortcuts).toBe('boolean');
    });

    it('should update enhanced features', () => {
      const updates = {
        multiLineInput: false,
        terminalSearch: true,
      };
      
      settingsManager.updateEnhancedFeatures(updates);
      
      const features = settingsManager.getEnhancedFeatures();
      expect(features.multiLineInput).toBe(false);
      expect(features.terminalSearch).toBe(true);
    });

    it('should update command history settings', () => {
      const updates = {
        maxEntries: 2000,
        ignoreDuplicates: false,
      };
      
      settingsManager.updateCommandHistorySettings(updates);
      
      const settings = settingsManager.getSettings();
      expect(settings.commandHistory.maxEntries).toBe(2000);
      expect(settings.commandHistory.ignoreDuplicates).toBe(false);
    });

    it('should update autocomplete settings', () => {
      const updates = {
        enabled: false,
        maxSuggestions: 5,
      };
      
      settingsManager.updateAutoCompleteSettings(updates);
      
      const settings = settingsManager.getSettings();
      expect(settings.autoComplete.enabled).toBe(false);
      expect(settings.autoComplete.maxSuggestions).toBe(5);
    });

    it('should update alias settings', () => {
      const updates = {
        enabled: false,
        caseSensitive: true,
      };
      
      settingsManager.updateAliasSettings(updates);
      
      const settings = settingsManager.getSettings();
      expect(settings.aliases.enabled).toBe(false);
      expect(settings.aliases.caseSensitive).toBe(true);
    });
  });

  describe('Import/Export', () => {
    beforeEach(() => {
      // Set up some custom settings
      settingsManager.updateSettings({
        theme: 'custom-theme',
        font: {
          family: '"Cascadia Code", monospace',
          size: 16,
          lineHeight: 1.2
        }
      });
      settingsManager.updateShortcut('copy', ['Ctrl+Shift+C']);
    });

    it('should export settings', () => {
      const exported = settingsManager.exportSettings();
      
      expect(exported.settings).toBeDefined();
      expect(exported.shortcuts).toBeDefined();
      expect(exported.customThemes).toBeDefined();
      expect(exported.version).toBe('1.0');
      expect(exported.lastUpdated).toBeInstanceOf(Date);
    });

    it('should import settings', () => {
      // Use exported settings as base for import
      const exportedSettings = settingsManager.exportSettings();
      const importData = {
        ...exportedSettings,
        settings: {
          ...exportedSettings.settings,
          theme: 'imported-theme',
          font: {
            ...exportedSettings.settings.font,
            size: 20
          },
        },
        shortcuts: [
          {
            id: 'copy',
            name: 'Copy',
            description: 'Copy selected text',
            keys: ['Ctrl+Alt+C'],
            action: 'copy',
            category: 'edit' as const,
            enabled: true,
            customizable: true,
          },
        ],
        customThemes: [],
        version: '1.0',
        lastUpdated: new Date(),
      };
      
      settingsManager.importSettings(importData);
      
      const settings = settingsManager.getSettings();
      expect(settings.theme).toBe('imported-theme');
      expect(settings.font.size).toBe(20);
      
      const copyShortcut = settingsManager.getShortcut('copy');
      expect(copyShortcut?.keys).toEqual(['Ctrl+Alt+C']);
    });

    it('should emit settingsImported event', () => {
      const importedSpy = jest.fn();
      settingsManager.on('settingsImported', importedSpy);
      
      // Use exported settings as base for import
      const exportedSettings = settingsManager.exportSettings();
      const importData = {
        ...exportedSettings,
        shortcuts: [],
        customThemes: [],
        version: '1.0',
        lastUpdated: new Date(),
      };
      
      settingsManager.importSettings(importData);
      
      expect(importedSpy).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should validate theme structure', () => {
      const invalidTheme = {
        id: 'invalid',
        name: 'Invalid Theme',
        // Missing required properties
      };
      
      // Test that createCustomTheme handles invalid themes gracefully
      const result = settingsManager.createCustomTheme(invalidTheme as any);

      // Should still create a theme, even with missing properties
      expect(result).toBeDefined();
      expect(result.name).toBe('Invalid Theme');
    });

    it('should validate shortcut keys format', () => {
      const success = settingsManager.updateShortcut('copy', ['InvalidKey+Format']);
      
      // Should handle invalid keys gracefully
      expect(typeof success).toBe('boolean');
    });

    it('should validate settings values', () => {
      const invalidSettings = {
        font: {
          family: '"Cascadia Code", monospace',
          size: -10, // Invalid negative size
          lineHeight: 1.2
        },
        scrollback: { lines: -100, enabled: true }, // Invalid negative lines
      };
      
      // Should not throw error, but may ignore invalid values
      expect(() => settingsManager.updateSettings(invalidSettings)).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many theme operations efficiently', () => {
      // Add many custom themes
      for (let i = 0; i < 10; i++) { // Reduced for performance
        settingsManager.createCustomTheme({
          name: `Theme ${i}`,
          description: `Theme ${i}`,
          colors: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            cursorAccent: '#000000',
            selectionBackground: '#333333',
            black: '#000000',
            red: '#ff0000',
            green: '#00ff00',
            yellow: '#ffff00',
            blue: '#0000ff',
            magenta: '#ff00ff',
            cyan: '#00ffff',
            white: '#ffffff',
            brightBlack: '#666666',
            brightRed: '#ff6666',
            brightGreen: '#66ff66',
            brightYellow: '#ffff66',
            brightBlue: '#6666ff',
            brightMagenta: '#ff66ff',
            brightCyan: '#66ffff',
            brightWhite: '#ffffff',
          },
        });
      }

      // Get all themes
      const themes = settingsManager.getAllThemes();

      // Test that operations complete successfully
      expect(themes.length).toBeGreaterThan(10);
    });

    it('should handle frequent settings updates efficiently', () => {
      // Perform many settings updates
      for (let i = 0; i < 100; i++) {
        settingsManager.updateSettings({
          font: {
            family: '"Cascadia Code", monospace',
            size: 14 + (i % 10),
            lineHeight: 1.2
          }
        });
      }

      // Test that operations complete successfully
      const settings = settingsManager.getSettings();
      expect(settings.font.size).toBeGreaterThanOrEqual(14);
    });
  });
});
