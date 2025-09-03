'use client';

export interface TerminalTheme {
  id: string;
  name: string;
  description: string;
  category: 'dark' | 'light' | 'high-contrast' | 'custom';
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
  font?: {
    family?: string;
    size?: number;
    weight?: string;
    lineHeight?: number;
  };
  opacity?: number;
  blur?: boolean;
}

export const defaultThemes: TerminalTheme[] = [
  {
    id: 'default-dark',
    name: 'Default Dark',
    description: 'Classic dark terminal theme',
    category: 'dark',
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selectionBackground: '#ffffff40',
      black: '#000000',
      red: '#cd0000',
      green: '#00cd00',
      yellow: '#cdcd00',
      blue: '#0000ee',
      magenta: '#cd00cd',
      cyan: '#00cdcd',
      white: '#e5e5e5',
      brightBlack: '#7f7f7f',
      brightRed: '#ff0000',
      brightGreen: '#00ff00',
      brightYellow: '#ffff00',
      brightBlue: '#5c5cff',
      brightMagenta: '#ff00ff',
      brightCyan: '#00ffff',
      brightWhite: '#ffffff',
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
    id: 'dracula',
    name: 'Dracula',
    description: 'Dark theme with purple accents',
    category: 'dark',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      selectionBackground: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    description: 'Low contrast dark theme',
    category: 'dark',
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
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    description: 'Low contrast light theme',
    category: 'light',
    colors: {
      background: '#fdf6e3',
      foreground: '#657b83',
      cursor: '#586e75',
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
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum contrast for accessibility',
    category: 'high-contrast',
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffff00',
      selectionBackground: '#ffffff',
      selectionForeground: '#000000',
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

export class TerminalThemeManager {
  private themes: Map<string, TerminalTheme> = new Map();
  private currentThemeId: string = 'default-dark';
  private customThemes: TerminalTheme[] = [];

  constructor() {
    this.loadDefaultThemes();
    this.loadCustomThemes();
    this.loadCurrentTheme();
    this.addInitialCustomTheme();
  }

  private addInitialCustomTheme() {
    // Add a sample custom theme for testing
    const customTheme: TerminalTheme = {
      id: 'custom-theme-1',
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
    };
    this.themes.set(customTheme.id, customTheme);
    this.customThemes.push(customTheme);
  }

  private loadDefaultThemes() {
    defaultThemes.forEach(theme => {
      this.themes.set(theme.id, theme);
    });
  }

  private loadCustomThemes() {
    try {
      const saved = localStorage.getItem('terminal-custom-themes');
      if (saved) {
        this.customThemes = JSON.parse(saved);
        this.customThemes.forEach(theme => {
          this.themes.set(theme.id, theme);
        });
      }
    } catch (error) {
      console.warn('Failed to load custom themes:', error);
    }
  }

  private loadCurrentTheme() {
    try {
      const saved = localStorage.getItem('terminal-current-theme');
      if (saved && this.themes.has(saved)) {
        this.currentThemeId = saved;
      }
    } catch (error) {
      console.warn('Failed to load current theme:', error);
    }
  }

  getCurrentTheme(): TerminalTheme {
    return this.themes.get(this.currentThemeId) || defaultThemes[0];
  }

  setCurrentTheme(themeId: string): boolean {
    if (this.themes.has(themeId)) {
      this.currentThemeId = themeId;
      try {
        localStorage.setItem('terminal-current-theme', themeId);
      } catch (error) {
        console.warn('Failed to save current theme:', error);
      }
      return true;
    }
    return false;
  }

  getAllThemes(): TerminalTheme[] {
    return Array.from(this.themes.values());
  }

  getThemesByCategory(category: TerminalTheme['category']): TerminalTheme[] {
    return Array.from(this.themes.values()).filter(theme => theme.category === category);
  }

  private isValidTheme(theme: any): theme is TerminalTheme {
    return (
      theme &&
      typeof theme === 'object' &&
      typeof theme.id === 'string' &&
      typeof theme.name === 'string' &&
      theme.colors &&
      typeof theme.colors === 'object' &&
      typeof theme.colors.background === 'string' &&
      typeof theme.colors.foreground === 'string'
    );
  }

  addCustomTheme(theme: TerminalTheme): boolean {
    try {
      // Validate theme structure
      if (!this.isValidTheme(theme)) {
        return false;
      }

      // Ensure unique ID
      if (this.themes.has(theme.id)) {
        return false;
      }

      theme.category = 'custom';
      this.themes.set(theme.id, theme);
      this.customThemes.push(theme);

      localStorage.setItem('terminal-custom-themes', JSON.stringify(this.customThemes));
      return true;
    } catch (error) {
      console.warn('Failed to add custom theme:', error);
      return false;
    }
  }

  removeCustomTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme || theme.category !== 'custom') {
      return false;
    }

    try {
      this.themes.delete(themeId);
      this.customThemes = this.customThemes.filter(t => t.id !== themeId);
      
      localStorage.setItem('terminal-custom-themes', JSON.stringify(this.customThemes));
      
      // Switch to default if current theme was removed
      if (this.currentThemeId === themeId) {
        this.setCurrentTheme('default-dark');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to remove custom theme:', error);
      return false;
    }
  }

  exportThemes(): string {
    return JSON.stringify({
      customThemes: this.customThemes,
      currentTheme: this.currentThemeId,
    }, null, 2);
  }

  importThemes(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.customThemes && Array.isArray(parsed.customThemes)) {
        parsed.customThemes.forEach((theme: TerminalTheme) => {
          this.addCustomTheme(theme);
        });
      }
      
      if (parsed.currentTheme && this.themes.has(parsed.currentTheme)) {
        this.setCurrentTheme(parsed.currentTheme);
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to import themes:', error);
      return false;
    }
  }
}

export const terminalThemeManager = new TerminalThemeManager();
