import { EventEmitter } from 'events';
import {
  TerminalSettings,
  TerminalTheme,
  KeyboardShortcut,
  TerminalPreferences,
  // TerminalEnhancedFeatures, TerminalHistorySettings, TerminalAutoCompleteSettings, TerminalAliasSettings - removed as not currently used
} from '@/types/terminal-settings';
import { logger } from './logger';

export class TerminalSettingsManager extends EventEmitter {
  private settings: TerminalSettings;
  private themes: Map<string, TerminalTheme> = new Map();
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private storageKey = 'webssh_terminal_settings';

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
    this.initializeBuiltInThemes();
    this.initializeDefaultShortcuts();
    // Only load from storage on the client side
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  private getDefaultSettings(): TerminalSettings {
    return {
      theme: 'default-dark',
      font: {
        family: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
        size: 14,
        weight: 'normal',
        lineHeight: 1.2,
        letterSpacing: 0,
      },
      cursor: {
        style: 'block',
        blink: true,
        width: 1,
      },
      scrollback: {
        lines: 1000,
        enabled: true,
      },
      bell: {
        enabled: true,
        sound: false,
        visual: true,
        duration: 200,
      },
      tabSize: 4,
      wordSeparator: ' ()[]{}\'"`',
      allowTransparency: false,
      macOptionIsMeta: false,
      macOptionClickForcesSelection: false,
      rightClickSelectsWord: true,
      rendererType: 'canvas',
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      minimumContrastRatio: 1,
      drawBoldTextInBrightColors: true,
      allowProposedApi: false,

      // Enhanced features settings
      enhancedFeatures: {
        multiLineInput: true,
        enhancedCopyPaste: true,
        terminalSearch: true,
        keyboardShortcuts: true,
        showCommandExpansion: false,
        confirmDangerousCommands: true,
      },

      commandHistory: {
        enabled: true,
        maxEntries: 1000,
        persistAcrossSessions: true,
        ignoreDuplicates: true,
        ignoreCommands: ['passwd', 'sudo -S', 'mysql -p', 'psql'],
        searchCaseSensitive: false,
        navigationEnabled: true,
      },

      autoComplete: {
        enabled: true,
        triggerOnTab: true,
        triggerOnSpace: false,
        minCharacters: 1,
        maxSuggestions: 10,
        showDescriptions: true,
        caseSensitive: false,
        fuzzyMatching: true,
        autoInsertSingle: true,
        showTypes: true,
        cacheEnabled: true,
        cacheTimeout: 300000,
      },

      aliases: {
        enabled: true,
        showExpansion: false,
        confirmExpansion: false,
        caseSensitive: false,
        allowRecursiveExpansion: true,
        maxExpansionDepth: 5,
      },
    };
  }

  private initializeBuiltInThemes(): void {
    const themes: TerminalTheme[] = [
      {
        id: 'default-dark',
        name: 'Default Dark',
        description: 'Default dark theme with good contrast',
        colors: {
          background: '#1a1a1a',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selectionBackground: '#3e3e3e',
          black: '#000000',
          red: '#e06c75',
          green: '#98c379',
          yellow: '#d19a66',
          blue: '#61afef',
          magenta: '#c678dd',
          cyan: '#56b6c2',
          white: '#ffffff',
          brightBlack: '#5c6370',
          brightRed: '#e06c75',
          brightGreen: '#98c379',
          brightYellow: '#d19a66',
          brightBlue: '#61afef',
          brightMagenta: '#c678dd',
          brightCyan: '#56b6c2',
          brightWhite: '#ffffff',
        },
        isBuiltIn: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'default-light',
        name: 'Default Light',
        description: 'Default light theme for bright environments',
        colors: {
          background: '#ffffff',
          foreground: '#000000',
          cursor: '#000000',
          selectionBackground: '#c7c7c7',
          black: '#000000',
          red: '#cd3131',
          green: '#00bc00',
          yellow: '#949800',
          blue: '#0451a5',
          magenta: '#bc05bc',
          cyan: '#0598bc',
          white: '#555555',
          brightBlack: '#666666',
          brightRed: '#cd3131',
          brightGreen: '#14ce14',
          brightYellow: '#b5ba00',
          brightBlue: '#0451a5',
          brightMagenta: '#bc05bc',
          brightCyan: '#0598bc',
          brightWhite: '#a5a5a5',
        },
        isBuiltIn: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'monokai',
        name: 'Monokai',
        description: 'Popular dark theme with vibrant colors',
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
        isBuiltIn: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'solarized-dark',
        name: 'Solarized Dark',
        description: 'Low contrast dark theme easy on the eyes',
        colors: {
          background: '#002b36',
          foreground: '#839496',
          cursor: '#93a1a1',
          selectionBackground: '#073642',
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
        isBuiltIn: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    themes.forEach(theme => {
      this.themes.set(theme.id, theme);
    });
  }

  private initializeDefaultShortcuts(): void {
    const shortcuts: KeyboardShortcut[] = [
      {
        id: 'copy',
        name: 'Copy',
        description: 'Copy selected text',
        keys: ['Ctrl+C'],
        action: 'copy',
        category: 'edit',
        enabled: true,
        customizable: true,
      },
      {
        id: 'paste',
        name: 'Paste',
        description: 'Paste from clipboard',
        keys: ['Ctrl+V'],
        action: 'paste',
        category: 'edit',
        enabled: true,
        customizable: true,
      },
      {
        id: 'clear',
        name: 'Clear Screen',
        description: 'Clear terminal screen',
        keys: ['Ctrl+L'],
        action: 'clear',
        category: 'terminal',
        enabled: true,
        customizable: true,
      },
      {
        id: 'new-tab',
        name: 'New Tab',
        description: 'Open new terminal tab',
        keys: ['Ctrl+T'],
        action: 'newTab',
        category: 'session',
        enabled: true,
        customizable: true,
      },
      {
        id: 'close-tab',
        name: 'Close Tab',
        description: 'Close current terminal tab',
        keys: ['Ctrl+W'],
        action: 'closeTab',
        category: 'session',
        enabled: true,
        customizable: true,
      },
      {
        id: 'next-tab',
        name: 'Next Tab',
        description: 'Switch to next tab',
        keys: ['Ctrl+Tab'],
        action: 'nextTab',
        category: 'session',
        enabled: true,
        customizable: true,
      },
      {
        id: 'prev-tab',
        name: 'Previous Tab',
        description: 'Switch to previous tab',
        keys: ['Ctrl+Shift+Tab'],
        action: 'prevTab',
        category: 'session',
        enabled: true,
        customizable: true,
      },
      {
        id: 'zoom-in',
        name: 'Zoom In',
        description: 'Increase font size',
        keys: ['Ctrl+Plus'],
        action: 'zoomIn',
        category: 'view',
        enabled: true,
        customizable: true,
      },
      {
        id: 'zoom-out',
        name: 'Zoom Out',
        description: 'Decrease font size',
        keys: ['Ctrl+Minus'],
        action: 'zoomOut',
        category: 'view',
        enabled: true,
        customizable: true,
      },
      {
        id: 'reset-zoom',
        name: 'Reset Zoom',
        description: 'Reset font size to default',
        keys: ['Ctrl+0'],
        action: 'resetZoom',
        category: 'view',
        enabled: true,
        customizable: true,
      },
    ];

    shortcuts.forEach(shortcut => {
      this.shortcuts.set(shortcut.id, shortcut);
    });
  }

  // Settings Management
  getSettings(): TerminalSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<TerminalSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveToStorage();
    this.emit('settingsChanged', this.settings);
    logger.info('Terminal settings updated');
  }

  resetSettings(): void {
    this.settings = this.getDefaultSettings();
    this.saveToStorage();
    this.emit('settingsChanged', this.settings);
    logger.info('Terminal settings reset to defaults');
  }

  // Theme Management
  getTheme(themeId: string): TerminalTheme | null {
    return this.themes.get(themeId) || null;
  }

  getAllThemes(): TerminalTheme[] {
    return Array.from(this.themes.values());
  }

  getBuiltInThemes(): TerminalTheme[] {
    return Array.from(this.themes.values()).filter(theme => theme.isBuiltIn);
  }

  getCustomThemes(): TerminalTheme[] {
    return Array.from(this.themes.values()).filter(theme => !theme.isBuiltIn);
  }

  createCustomTheme(theme: Omit<TerminalTheme, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>): TerminalTheme {
    const customTheme: TerminalTheme = {
      ...theme,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isBuiltIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.themes.set(customTheme.id, customTheme);
    this.saveToStorage();
    this.emit('themeCreated', customTheme);
    
    return customTheme;
  }

  updateCustomTheme(themeId: string, updates: Partial<TerminalTheme>): boolean {
    const theme = this.themes.get(themeId);
    if (!theme || theme.isBuiltIn) return false;

    const updatedTheme = {
      ...theme,
      ...updates,
      id: theme.id,
      isBuiltIn: false,
      createdAt: theme.createdAt,
      updatedAt: new Date(),
    };

    this.themes.set(themeId, updatedTheme);
    this.saveToStorage();
    this.emit('themeUpdated', updatedTheme);
    
    return true;
  }

  deleteCustomTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme || theme.isBuiltIn) return false;

    this.themes.delete(themeId);
    
    // If this was the active theme, switch to default
    if (this.settings.theme === themeId) {
      this.settings.theme = 'default-dark';
    }

    this.saveToStorage();
    this.emit('themeDeleted', theme);
    
    return true;
  }

  setActiveTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme) return false;

    this.settings.theme = themeId;
    this.saveToStorage();
    this.emit('settingsChanged', this.settings);
    this.emit('themeChanged', theme);
    
    return true;
  }

  // Shortcut Management
  getShortcut(shortcutId: string): KeyboardShortcut | null {
    return this.shortcuts.get(shortcutId) || null;
  }

  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsByCategory(category: KeyboardShortcut['category']): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(s => s.category === category);
  }

  updateShortcut(shortcutId: string, keys: string[]): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut || !shortcut.customizable) return false;

    shortcut.keys = keys;
    this.saveToStorage();
    this.emit('shortcutUpdated', shortcut);
    
    return true;
  }

  toggleShortcut(shortcutId: string): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) return false;

    shortcut.enabled = !shortcut.enabled;
    this.saveToStorage();
    this.emit('shortcutUpdated', shortcut);
    
    return true;
  }

  resetShortcuts(): void {
    this.initializeDefaultShortcuts();
    this.saveToStorage();
    this.emit('shortcutsReset');
  }

  // Font Management
  increaseFontSize(): void {
    const newSize = Math.min(this.settings.font.size + 1, 32);
    this.updateSettings({ 
      font: { ...this.settings.font, size: newSize } 
    });
  }

  decreaseFontSize(): void {
    const newSize = Math.max(this.settings.font.size - 1, 8);
    this.updateSettings({ 
      font: { ...this.settings.font, size: newSize } 
    });
  }

  resetFontSize(): void {
    this.updateSettings({ 
      font: { ...this.settings.font, size: 14 } 
    });
  }

  // Storage
  private saveToStorage(): void {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const preferences: TerminalPreferences = {
        settings: this.settings,
        shortcuts: Array.from(this.shortcuts.values()),
        customThemes: this.getCustomThemes(),
        version: '1.0',
        lastUpdated: new Date(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(preferences));
    } catch (error) {
      logger.error('Failed to save terminal settings', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private loadFromStorage(): void {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const preferences: TerminalPreferences = JSON.parse(stored);
      
      if (preferences.settings) {
        this.settings = { ...this.getDefaultSettings(), ...preferences.settings };
      }

      if (preferences.shortcuts) {
        preferences.shortcuts.forEach(shortcut => {
          this.shortcuts.set(shortcut.id, shortcut);
        });
      }

      if (preferences.customThemes) {
        preferences.customThemes.forEach(theme => {
          this.themes.set(theme.id, {
            ...theme,
            createdAt: new Date(theme.createdAt),
            updatedAt: new Date(theme.updatedAt),
          });
        });
      }
    } catch (error) {
      logger.error('Failed to load terminal settings', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  exportSettings(): TerminalPreferences {
    return {
      settings: this.settings,
      shortcuts: Array.from(this.shortcuts.values()),
      customThemes: this.getCustomThemes(),
      version: '1.0',
      lastUpdated: new Date(),
    };
  }

  importSettings(preferences: TerminalPreferences): void {
    this.settings = { ...this.getDefaultSettings(), ...preferences.settings };
    
    if (preferences.shortcuts) {
      preferences.shortcuts.forEach(shortcut => {
        this.shortcuts.set(shortcut.id, shortcut);
      });
    }

    if (preferences.customThemes) {
      preferences.customThemes.forEach(theme => {
        this.themes.set(theme.id, theme);
      });
    }

    this.saveToStorage();
    this.emit('settingsImported');
  }

  // Enhanced features settings methods
  getEnhancedFeatures() {
    return { ...this.settings.enhancedFeatures };
  }

  updateEnhancedFeatures(updates: Partial<typeof this.settings.enhancedFeatures>): void {
    this.settings.enhancedFeatures = { ...this.settings.enhancedFeatures, ...updates };
    this.saveToStorage();
    this.emit('enhancedFeaturesChanged', this.settings.enhancedFeatures);
  }

  getCommandHistorySettings() {
    return { ...this.settings.commandHistory };
  }

  updateCommandHistorySettings(updates: Partial<typeof this.settings.commandHistory>): void {
    this.settings.commandHistory = { ...this.settings.commandHistory, ...updates };
    this.saveToStorage();
    this.emit('commandHistorySettingsChanged', this.settings.commandHistory);
  }

  getAutoCompleteSettings() {
    return { ...this.settings.autoComplete };
  }

  updateAutoCompleteSettings(updates: Partial<typeof this.settings.autoComplete>): void {
    this.settings.autoComplete = { ...this.settings.autoComplete, ...updates };
    this.saveToStorage();
    this.emit('autoCompleteSettingsChanged', this.settings.autoComplete);
  }

  getAliasSettings() {
    return { ...this.settings.aliases };
  }

  updateAliasSettings(updates: Partial<typeof this.settings.aliases>): void {
    this.settings.aliases = { ...this.settings.aliases, ...updates };
    this.saveToStorage();
    this.emit('aliasSettingsChanged', this.settings.aliases);
  }

  // Convenience methods for feature toggles
  isFeatureEnabled(feature: keyof typeof this.settings.enhancedFeatures): boolean {
    return this.settings.enhancedFeatures[feature];
  }

  toggleFeature(feature: keyof typeof this.settings.enhancedFeatures): void {
    this.settings.enhancedFeatures[feature] = !this.settings.enhancedFeatures[feature];
    this.saveToStorage();
    this.emit('featureToggled', { feature, enabled: this.settings.enhancedFeatures[feature] });
  }

  // Reset methods for individual sections
  resetEnhancedFeatures(): void {
    const defaultSettings = this.getDefaultSettings();
    this.settings.enhancedFeatures = defaultSettings.enhancedFeatures;
    this.saveToStorage();
    this.emit('enhancedFeaturesReset');
  }

  resetCommandHistorySettings(): void {
    const defaultSettings = this.getDefaultSettings();
    this.settings.commandHistory = defaultSettings.commandHistory;
    this.saveToStorage();
    this.emit('commandHistorySettingsReset');
  }

  resetAutoCompleteSettings(): void {
    const defaultSettings = this.getDefaultSettings();
    this.settings.autoComplete = defaultSettings.autoComplete;
    this.saveToStorage();
    this.emit('autoCompleteSettingsReset');
  }

  resetAliasSettings(): void {
    const defaultSettings = this.getDefaultSettings();
    this.settings.aliases = defaultSettings.aliases;
    this.saveToStorage();
    this.emit('aliasSettingsReset');
  }
}

export const terminalSettingsManager = new TerminalSettingsManager();
