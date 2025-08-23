export interface TerminalTheme {
  id: string;
  name: string;
  description?: string;
  colors: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent?: string;
    selectionBackground: string;
    selectionForeground?: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TerminalFont {
  family: string;
  size: number;
  weight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  lineHeight: number;
  letterSpacing?: number;
}

export interface TerminalCursor {
  style: 'block' | 'underline' | 'bar';
  blink: boolean;
  width?: number;
}

export interface TerminalScrollback {
  lines: number;
  enabled: boolean;
}

export interface TerminalBell {
  enabled: boolean;
  sound: boolean;
  visual: boolean;
  duration: number;
}

export interface TerminalSettings {
  theme: string; // Theme ID
  font: TerminalFont;
  cursor: TerminalCursor;
  scrollback: TerminalScrollback;
  bell: TerminalBell;
  tabSize: number;
  wordSeparator: string;
  allowTransparency: boolean;
  macOptionIsMeta: boolean;
  macOptionClickForcesSelection: boolean;
  rightClickSelectsWord: boolean;
  rendererType: 'canvas' | 'dom';
  fastScrollModifier: 'alt' | 'ctrl' | 'shift';
  fastScrollSensitivity: number;
  scrollSensitivity: number;
  minimumContrastRatio: number;
  drawBoldTextInBrightColors: boolean;
  allowProposedApi: boolean;

  // Enhanced features settings
  enhancedFeatures: TerminalEnhancedFeatures;
  commandHistory: TerminalHistorySettings;
  autoComplete: TerminalAutoCompleteSettings;
  aliases: TerminalAliasSettings;
}

export interface TerminalEnhancedFeatures {
  multiLineInput: boolean;
  enhancedCopyPaste: boolean;
  terminalSearch: boolean;
  keyboardShortcuts: boolean;
  showCommandExpansion: boolean;
  confirmDangerousCommands: boolean;
}

export interface TerminalHistorySettings {
  enabled: boolean;
  maxEntries: number;
  persistAcrossSessions: boolean;
  ignoreDuplicates: boolean;
  ignoreCommands: string[];
  searchCaseSensitive: boolean;
  navigationEnabled: boolean;
}

export interface TerminalAutoCompleteSettings {
  enabled: boolean;
  triggerOnTab: boolean;
  triggerOnSpace: boolean;
  minCharacters: number;
  maxSuggestions: number;
  showDescriptions: boolean;
  caseSensitive: boolean;
  fuzzyMatching: boolean;
  autoInsertSingle: boolean;
  showTypes: boolean;
  cacheEnabled: boolean;
  cacheTimeout: number;
}

export interface TerminalAliasSettings {
  enabled: boolean;
  showExpansion: boolean;
  confirmExpansion: boolean;
  caseSensitive: boolean;
  allowRecursiveExpansion: boolean;
  maxExpansionDepth: number;
}

export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[];
  action: string;
  category: 'terminal' | 'file' | 'edit' | 'view' | 'session';
  enabled: boolean;
  customizable: boolean;
}

export interface TerminalPreferences {
  settings: TerminalSettings;
  shortcuts: KeyboardShortcut[];
  customThemes: TerminalTheme[];
  version: string;
  lastUpdated: Date;
}
