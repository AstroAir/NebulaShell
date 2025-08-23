import { EventEmitter } from 'events';
import {
  CompletionSuggestion,
  CompletionContext,
  CompletionProvider,
  AutoCompleteSettings,
  CompletionCache,
  CompletionState,
  CompletionType,
  COMMON_COMMANDS,
  CommandDefinition
} from '@/types/terminal-autocomplete';
import { terminalHistoryManager } from './terminal-history-manager';
import { logger } from './logger';

export class TerminalAutoCompleteManager extends EventEmitter {
  private settings: AutoCompleteSettings;
  private providers: Map<string, CompletionProvider> = new Map();
  private cache: Map<string, CompletionCache> = new Map();
  private state: CompletionState;
  private storageKey = 'webssh_autocomplete_settings';

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
    this.state = this.getDefaultState();
    this.loadFromStorage();
    this.initializeBuiltInProviders();
  }

  private getDefaultSettings(): AutoCompleteSettings {
    return {
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
      cacheTimeout: 300000, // 5 minutes
    };
  }

  private getDefaultState(): CompletionState {
    return {
      isActive: false,
      suggestions: [],
      selectedIndex: 0,
      context: null,
      trigger: null,
    };
  }

  private initializeBuiltInProviders(): void {
    // Command completion provider
    this.registerProvider({
      name: 'commands',
      priority: 100,
      canComplete: (context) => context.currentTokenIndex === 0,
      getCompletions: async (context) => this.getCommandCompletions(context)
    });

    // Flag completion provider
    this.registerProvider({
      name: 'flags',
      priority: 90,
      canComplete: (context) => context.currentWord.startsWith('-'),
      getCompletions: async (context) => this.getFlagCompletions(context)
    });

    // History completion provider
    this.registerProvider({
      name: 'history',
      priority: 80,
      canComplete: (context) => context.currentWord.length >= this.settings.minCharacters,
      getCompletions: async (context) => this.getHistoryCompletions(context)
    });

    // File completion provider (basic)
    this.registerProvider({
      name: 'files',
      priority: 70,
      canComplete: (context) => this.shouldCompleteFiles(context),
      getCompletions: async (context) => this.getFileCompletions(context)
    });
  }

  // Provider management
  registerProvider(provider: CompletionProvider): void {
    this.providers.set(provider.name, provider);
    this.emit('providerRegistered', provider);
  }

  unregisterProvider(name: string): void {
    if (this.providers.delete(name)) {
      this.emit('providerUnregistered', name);
    }
  }

  // Main completion methods
  async getCompletions(input: string, cursorPosition: number): Promise<CompletionSuggestion[]> {
    if (!this.settings.enabled) {
      return [];
    }

    const context = this.parseContext(input, cursorPosition);
    const cacheKey = this.getCacheKey(context);

    // Check cache first
    if (this.settings.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.suggestions;
      }
    }

    // Get completions from providers
    const allSuggestions: CompletionSuggestion[] = [];
    const providers = Array.from(this.providers.values())
      .sort((a, b) => b.priority - a.priority);

    for (const provider of providers) {
      if (provider.canComplete(context)) {
        try {
          const suggestions = await provider.getCompletions(context);
          allSuggestions.push(...suggestions);
        } catch (error) {
          logger.error(`Error in completion provider ${provider.name}`, { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
    }

    // Filter and sort suggestions
    let filteredSuggestions = this.filterSuggestions(allSuggestions, context);
    filteredSuggestions = this.sortSuggestions(filteredSuggestions);
    filteredSuggestions = filteredSuggestions.slice(0, this.settings.maxSuggestions);

    // Cache results
    if (this.settings.cacheEnabled) {
      this.cache.set(cacheKey, {
        key: cacheKey,
        suggestions: filteredSuggestions,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.settings.cacheTimeout
      });
    }

    return filteredSuggestions;
  }

  // Context parsing
  private parseContext(input: string, cursorPosition: number): CompletionContext {
    const beforeCursor = input.substring(0, cursorPosition);
    const afterCursor = input.substring(cursorPosition);
    
    // Simple tokenization (split by spaces, but respect quotes)
    const tokens = this.tokenize(beforeCursor);
    const currentTokenIndex = Math.max(0, tokens.length - 1);
    
    // Find current word boundaries
    let wordStart = beforeCursor.length;
    let wordEnd = cursorPosition;
    
    // Find start of current word
    for (let i = beforeCursor.length - 1; i >= 0; i--) {
      if (beforeCursor[i] === ' ' || beforeCursor[i] === '\t') {
        wordStart = i + 1;
        break;
      }
      if (i === 0) {
        wordStart = 0;
      }
    }
    
    // Find end of current word
    for (let i = cursorPosition; i < input.length; i++) {
      if (input[i] === ' ' || input[i] === '\t') {
        wordEnd = i;
        break;
      }
      if (i === input.length - 1) {
        wordEnd = input.length;
      }
    }

    const currentWord = input.substring(wordStart, wordEnd);

    return {
      fullLine: input,
      currentWord,
      wordStartIndex: wordStart,
      wordEndIndex: wordEnd,
      cursorPosition,
      tokens,
      currentTokenIndex
    };
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if ((char === ' ' || char === '\t') && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  // Built-in completion providers
  private async getCommandCompletions(context: CompletionContext): Promise<CompletionSuggestion[]> {
    const suggestions: CompletionSuggestion[] = [];
    const query = context.currentWord.toLowerCase();

    for (const cmd of COMMON_COMMANDS) {
      if (this.matchesQuery(cmd.name, query)) {
        suggestions.push({
          text: cmd.name,
          description: cmd.description,
          type: 'command',
          priority: 100
        });
      }

      // Include aliases
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          if (this.matchesQuery(alias, query)) {
            suggestions.push({
              text: alias,
              description: `Alias for ${cmd.name}`,
              type: 'alias',
              priority: 90
            });
          }
        }
      }
    }

    return suggestions;
  }

  private async getFlagCompletions(context: CompletionContext): Promise<CompletionSuggestion[]> {
    const suggestions: CompletionSuggestion[] = [];
    
    if (context.tokens.length === 0) return suggestions;
    
    const commandName = context.tokens[0];
    const command = COMMON_COMMANDS.find(cmd => 
      cmd.name === commandName || (cmd.aliases && cmd.aliases.includes(commandName))
    );

    if (!command || !command.flags) return suggestions;

    const query = context.currentWord.toLowerCase();

    for (const flag of command.flags) {
      // Long flag
      if (this.matchesQuery(`--${flag.name}`, query)) {
        suggestions.push({
          text: `--${flag.name}`,
          description: flag.description,
          type: 'flag',
          priority: 80,
          detail: flag.hasValue ? `Requires value (${flag.valueType || 'string'})` : 'No value required'
        });
      }

      // Short flag
      if (flag.shortName && this.matchesQuery(flag.shortName, query)) {
        suggestions.push({
          text: flag.shortName,
          description: flag.description,
          type: 'flag',
          priority: 75,
          detail: flag.hasValue ? `Requires value (${flag.valueType || 'string'})` : 'No value required'
        });
      }
    }

    return suggestions;
  }

  private async getHistoryCompletions(context: CompletionContext): Promise<CompletionSuggestion[]> {
    const suggestions: CompletionSuggestion[] = [];
    const query = context.currentWord;

    if (query.length < this.settings.minCharacters) {
      return suggestions;
    }

    // Get recent commands from history
    const historyEntries = terminalHistoryManager.getGlobalHistory()
      .slice(-50) // Last 50 commands
      .reverse(); // Most recent first

    const seen = new Set<string>();

    for (const entry of historyEntries) {
      if (seen.has(entry.command)) continue;
      
      if (this.matchesQuery(entry.command, query)) {
        suggestions.push({
          text: entry.command,
          description: `From history (${entry.timestamp.toLocaleTimeString()})`,
          type: 'history',
          priority: 60
        });
        seen.add(entry.command);
      }

      if (suggestions.length >= 5) break; // Limit history suggestions
    }

    return suggestions;
  }

  private async getFileCompletions(context: CompletionContext): Promise<CompletionSuggestion[]> {
    // Basic file completion - in a real implementation, this would
    // communicate with the server to get actual file listings
    const suggestions: CompletionSuggestion[] = [];
    const query = context.currentWord;

    // Common file/directory patterns
    const commonPaths = [
      { name: './', type: 'directory' as const },
      { name: '../', type: 'directory' as const },
      { name: '~/', type: 'directory' as const },
      { name: '/tmp/', type: 'directory' as const },
      { name: '/home/', type: 'directory' as const },
      { name: '/var/', type: 'directory' as const },
      { name: '/etc/', type: 'directory' as const },
    ];

    for (const path of commonPaths) {
      if (this.matchesQuery(path.name, query)) {
        suggestions.push({
          text: path.name,
          type: path.type,
          priority: 50,
          description: `${path.type === 'directory' ? 'Directory' : 'File'}`
        });
      }
    }

    return suggestions;
  }

  // Helper methods
  private shouldCompleteFiles(context: CompletionContext): boolean {
    if (context.tokens.length === 0) return false;
    
    const command = context.tokens[0];
    const fileCommands = ['cd', 'ls', 'cat', 'cp', 'mv', 'rm', 'chmod', 'chown'];
    
    return fileCommands.includes(command) || context.currentWord.includes('/');
  }

  private matchesQuery(text: string, query: string): boolean {
    if (!query) return true;
    
    const textLower = this.settings.caseSensitive ? text : text.toLowerCase();
    const queryLower = this.settings.caseSensitive ? query : query.toLowerCase();
    
    if (this.settings.fuzzyMatching) {
      return this.fuzzyMatch(textLower, queryLower);
    } else {
      return textLower.startsWith(queryLower);
    }
  }

  private fuzzyMatch(text: string, query: string): boolean {
    let textIndex = 0;
    let queryIndex = 0;
    
    while (textIndex < text.length && queryIndex < query.length) {
      if (text[textIndex] === query[queryIndex]) {
        queryIndex++;
      }
      textIndex++;
    }
    
    return queryIndex === query.length;
  }

  private filterSuggestions(suggestions: CompletionSuggestion[], context: CompletionContext): CompletionSuggestion[] {
    // Remove duplicates
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.text}:${suggestion.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private sortSuggestions(suggestions: CompletionSuggestion[]): CompletionSuggestion[] {
    return suggestions.sort((a, b) => {
      // Sort by priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Then by text length (shorter first)
      if (a.text.length !== b.text.length) {
        return a.text.length - b.text.length;
      }
      
      // Finally alphabetically
      return a.text.localeCompare(b.text);
    });
  }

  private getCacheKey(context: CompletionContext): string {
    return `${context.fullLine}:${context.cursorPosition}`;
  }

  // Public API
  getSettings(): AutoCompleteSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<AutoCompleteSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveToStorage();
    this.emit('settingsChanged', this.settings);
  }

  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  getState(): CompletionState {
    return { ...this.state };
  }

  setState(updates: Partial<CompletionState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('stateChanged', this.state);
  }

  // Storage
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (error) {
      logger.error('Failed to save autocomplete settings', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.settings = { ...this.getDefaultSettings(), ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error('Failed to load autocomplete settings', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

export const terminalAutoCompleteManager = new TerminalAutoCompleteManager();
