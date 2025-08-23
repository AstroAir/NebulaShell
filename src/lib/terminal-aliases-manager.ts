import { EventEmitter } from 'events';
import {
  CommandAlias,
  AliasParameter,
  AliasExpansionContext,
  AliasSettings,
  AliasGroup,
  AliasState,
  AliasExport,
  AliasSearchFilter,
  BUILT_IN_ALIASES
} from '@/types/terminal-aliases';
import { logger } from './logger';

export class TerminalAliasesManager extends EventEmitter {
  private state: AliasState;
  private storageKey = 'webssh_terminal_aliases';
  private settingsKey = 'webssh_aliases_settings';

  constructor() {
    super();
    this.state = this.getDefaultState();
    this.loadFromStorage();
    this.initializeBuiltInAliases();
  }

  private getDefaultState(): AliasState {
    return {
      aliases: new Map(),
      groups: new Map(),
      settings: this.getDefaultSettings(),
    };
  }

  private getDefaultSettings(): AliasSettings {
    return {
      enabled: true,
      showExpansion: false,
      confirmExpansion: false,
      caseSensitive: false,
      allowRecursiveExpansion: true,
      maxExpansionDepth: 5,
    };
  }

  private initializeBuiltInAliases(): void {
    // Only add built-in aliases if they don't already exist
    for (const builtInAlias of BUILT_IN_ALIASES) {
      if (!this.hasAlias(builtInAlias.name)) {
        this.createAlias(
          builtInAlias.name,
          builtInAlias.command,
          {
            description: builtInAlias.description,
            parameters: builtInAlias.parameters,
            category: builtInAlias.category,
            tags: builtInAlias.tags,
          }
        );
      }
    }
  }

  // Alias Management
  createAlias(
    name: string,
    command: string,
    options: {
      description?: string;
      parameters?: AliasParameter[];
      category?: string;
      tags?: string[];
    } = {}
  ): CommandAlias {
    if (this.hasAlias(name)) {
      throw new Error(`Alias '${name}' already exists`);
    }

    const alias: CommandAlias = {
      id: `alias_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      command,
      description: options.description,
      parameters: options.parameters || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      useCount: 0,
      tags: options.tags || [],
      category: options.category,
    };

    this.state.aliases.set(name, alias);
    this.saveToStorage();
    
    logger.info('Command alias created', { name, command });
    this.emit('aliasCreated', alias);
    
    return alias;
  }

  updateAlias(name: string, updates: Partial<CommandAlias>): boolean {
    const alias = this.state.aliases.get(name);
    if (!alias) return false;

    const updatedAlias = {
      ...alias,
      ...updates,
      id: alias.id, // Prevent ID changes
      name: alias.name, // Prevent name changes through this method
      createdAt: alias.createdAt, // Prevent creation date changes
      updatedAt: new Date(),
    };

    this.state.aliases.set(name, updatedAlias);
    this.saveToStorage();
    
    logger.info('Command alias updated', { name });
    this.emit('aliasUpdated', updatedAlias);
    
    return true;
  }

  deleteAlias(name: string): boolean {
    const alias = this.state.aliases.get(name);
    if (!alias) return false;

    this.state.aliases.delete(name);
    this.saveToStorage();
    
    logger.info('Command alias deleted', { name });
    this.emit('aliasDeleted', alias);
    
    return true;
  }

  renameAlias(oldName: string, newName: string): boolean {
    if (!this.hasAlias(oldName) || this.hasAlias(newName)) {
      return false;
    }

    const alias = this.state.aliases.get(oldName)!;
    const updatedAlias = { ...alias, name: newName, updatedAt: new Date() };

    this.state.aliases.delete(oldName);
    this.state.aliases.set(newName, updatedAlias);
    this.saveToStorage();
    
    logger.info('Command alias renamed', { oldName, newName });
    this.emit('aliasRenamed', { oldName, newName, alias: updatedAlias });
    
    return true;
  }

  hasAlias(name: string): boolean {
    return this.state.aliases.has(name);
  }

  getAlias(name: string): CommandAlias | undefined {
    return this.state.aliases.get(name);
  }

  getAllAliases(): CommandAlias[] {
    return Array.from(this.state.aliases.values());
  }

  // Command Expansion
  expandCommand(input: string): AliasExpansionContext | null {
    if (!this.state.settings.enabled) {
      return null;
    }

    const tokens = this.parseCommand(input);
    if (tokens.length === 0) return null;

    const aliasName = tokens[0];
    const alias = this.getAlias(aliasName);
    
    if (!alias) return null;

    // Extract parameters from the input
    const parameters = this.extractParameters(alias, tokens.slice(1));
    
    // Expand the command
    const expandedCommand = this.performExpansion(alias, parameters);
    
    // Handle recursive expansion if enabled
    let finalCommand = expandedCommand;
    if (this.state.settings.allowRecursiveExpansion) {
      finalCommand = this.expandRecursively(expandedCommand, 0);
    }

    // Update usage count
    alias.useCount++;
    this.state.aliases.set(aliasName, alias);

    const context: AliasExpansionContext = {
      alias,
      parameters,
      originalCommand: input,
      expandedCommand: finalCommand,
    };

    this.emit('aliasExpanded', context);
    return context;
  }

  private parseCommand(input: string): string[] {
    // Simple command parsing - split by spaces but respect quotes
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  private extractParameters(alias: CommandAlias, args: string[]): Record<string, string> {
    const parameters: Record<string, string> = {};
    
    if (!alias.parameters) return parameters;

    // Map positional parameters
    alias.parameters
      .sort((a, b) => a.position - b.position)
      .forEach((param, index) => {
        if (index < args.length) {
          parameters[param.name] = args[index];
        } else if (param.defaultValue) {
          parameters[param.name] = param.defaultValue;
        } else if (param.required) {
          throw new Error(`Required parameter '${param.name}' is missing`);
        }
      });

    return parameters;
  }

  private performExpansion(alias: CommandAlias, parameters: Record<string, string>): string {
    let expanded = alias.command;

    // Replace parameter placeholders
    if (alias.parameters) {
      for (const param of alias.parameters) {
        const value = parameters[param.name] || param.defaultValue || '';
        const placeholder = `{${param.name}}`;
        expanded = expanded.replace(new RegExp(placeholder, 'g'), value);
      }
    }

    // Append any remaining arguments
    const usedParams = new Set(alias.parameters?.map(p => p.name) || []);
    const remainingArgs = Object.entries(parameters)
      .filter(([name]) => !usedParams.has(name))
      .map(([, value]) => value);

    if (remainingArgs.length > 0) {
      expanded += ' ' + remainingArgs.join(' ');
    }

    return expanded;
  }

  private expandRecursively(command: string, depth: number): string {
    if (depth >= this.state.settings.maxExpansionDepth) {
      logger.warn('Maximum alias expansion depth reached', { depth, command });
      return command;
    }

    const tokens = this.parseCommand(command);
    if (tokens.length === 0) return command;

    const firstToken = tokens[0];
    const alias = this.getAlias(firstToken);
    
    if (!alias) return command;

    // Expand this level
    const parameters = this.extractParameters(alias, tokens.slice(1));
    const expanded = this.performExpansion(alias, parameters);
    
    // Recursively expand the result
    return this.expandRecursively(expanded, depth + 1);
  }

  // Search and Filter
  searchAliases(filter: AliasSearchFilter): CommandAlias[] {
    let aliases = this.getAllAliases();

    // Apply filters
    if (filter.query) {
      const query = this.state.settings.caseSensitive ? filter.query : filter.query.toLowerCase();
      aliases = aliases.filter(alias => {
        const name = this.state.settings.caseSensitive ? alias.name : alias.name.toLowerCase();
        const command = this.state.settings.caseSensitive ? alias.command : alias.command.toLowerCase();
        const description = this.state.settings.caseSensitive ? 
          (alias.description || '') : (alias.description || '').toLowerCase();
        
        return name.includes(query) || command.includes(query) || description.includes(query);
      });
    }

    if (filter.category) {
      aliases = aliases.filter(alias => alias.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      aliases = aliases.filter(alias => 
        alias.tags && filter.tags!.some(tag => alias.tags!.includes(tag))
      );
    }

    if (filter.groupId) {
      const group = this.state.groups.get(filter.groupId);
      if (group) {
        aliases = aliases.filter(alias => group.aliases.includes(alias.id));
      }
    }

    // Apply sorting
    const sortBy = filter.sortBy || 'name';
    const sortOrder = filter.sortOrder || 'asc';
    
    aliases.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'useCount':
          aValue = a.useCount;
          bValue = b.useCount;
          break;
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    return aliases;
  }

  // Settings
  getSettings(): AliasSettings {
    return { ...this.state.settings };
  }

  updateSettings(updates: Partial<AliasSettings>): void {
    this.state.settings = { ...this.state.settings, ...updates };
    this.saveToStorage();
    this.emit('settingsChanged', this.state.settings);
  }

  // Storage
  private saveToStorage(): void {
    try {
      const data = {
        aliases: Array.from(this.state.aliases.entries()),
        groups: Array.from(this.state.groups.entries()),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
      localStorage.setItem(this.settingsKey, JSON.stringify(this.state.settings));
    } catch (error) {
      logger.error('Failed to save terminal aliases', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private loadFromStorage(): void {
    try {
      // Load settings
      const settingsData = localStorage.getItem(this.settingsKey);
      if (settingsData) {
        this.state.settings = { ...this.getDefaultSettings(), ...JSON.parse(settingsData) };
      }

      // Load aliases and groups
      const aliasData = localStorage.getItem(this.storageKey);
      if (!aliasData) return;

      const data = JSON.parse(aliasData);
      
      // Restore aliases
      if (data.aliases) {
        data.aliases.forEach(([name, alias]: [string, any]) => {
          this.state.aliases.set(name, {
            ...alias,
            createdAt: new Date(alias.createdAt),
            updatedAt: new Date(alias.updatedAt),
          });
        });
      }

      // Restore groups
      if (data.groups) {
        data.groups.forEach(([id, group]: [string, any]) => {
          this.state.groups.set(id, group);
        });
      }
    } catch (error) {
      logger.error('Failed to load terminal aliases', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Export/Import
  exportAliases(): AliasExport {
    return {
      aliases: this.getAllAliases(),
      groups: Array.from(this.state.groups.values()),
      settings: this.state.settings,
      exportedAt: new Date(),
      version: '1.0',
    };
  }

  importAliases(data: AliasExport, options: { overwrite?: boolean } = {}): void {
    // Import aliases
    data.aliases.forEach(alias => {
      if (!this.hasAlias(alias.name) || options.overwrite) {
        this.state.aliases.set(alias.name, {
          ...alias,
          createdAt: new Date(alias.createdAt),
          updatedAt: new Date(alias.updatedAt),
        });
      }
    });

    // Import groups
    data.groups.forEach(group => {
      this.state.groups.set(group.id, group);
    });

    // Import settings
    if (data.settings) {
      this.state.settings = { ...this.getDefaultSettings(), ...data.settings };
    }

    this.saveToStorage();
    this.emit('aliasesImported');
  }

  clearAllAliases(): void {
    this.state.aliases.clear();
    this.state.groups.clear();
    this.saveToStorage();
    this.emit('aliasesCleared');
  }
}

export const terminalAliasesManager = new TerminalAliasesManager();
