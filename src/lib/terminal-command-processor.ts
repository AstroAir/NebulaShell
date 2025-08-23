import { terminalHistoryManager } from './terminal-history-manager';
import { terminalAliasesManager } from './terminal-aliases-manager';
import { CommandHistoryEntry } from '@/types/terminal-history';

export interface LocalCommand {
  name: string;
  description: string;
  handler: (args: string[], sessionId: string, terminal: any) => Promise<boolean>;
  aliases?: string[];
}

export class TerminalCommandProcessor {
  private localCommands: Map<string, LocalCommand> = new Map();

  constructor() {
    this.initializeBuiltInCommands();
  }

  private initializeBuiltInCommands(): void {
    // History command
    this.registerCommand({
      name: 'history',
      description: 'Display command history',
      aliases: ['hist'],
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleHistoryCommand(args, sessionId, terminal);
      }
    });

    // Clear history command
    this.registerCommand({
      name: 'history-clear',
      description: 'Clear command history',
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleHistoryClearCommand(args, sessionId, terminal);
      }
    });

    // History search command
    this.registerCommand({
      name: 'history-search',
      description: 'Search command history',
      aliases: ['hsearch'],
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleHistorySearchCommand(args, sessionId, terminal);
      }
    });

    // Help command for local commands
    this.registerCommand({
      name: 'local-help',
      description: 'Show available local terminal commands',
      aliases: ['lhelp'],
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleLocalHelpCommand(args, sessionId, terminal);
      }
    });

    // Alias management commands
    this.registerCommand({
      name: 'alias',
      description: 'Create or list command aliases',
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleAliasCommand(args, sessionId, terminal);
      }
    });

    this.registerCommand({
      name: 'unalias',
      description: 'Remove command aliases',
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleUnaliasCommand(args, sessionId, terminal);
      }
    });

    this.registerCommand({
      name: 'aliases',
      description: 'List all command aliases',
      handler: async (args: string[], sessionId: string, terminal: any) => {
        return this.handleAliasesCommand(args, sessionId, terminal);
      }
    });
  }

  registerCommand(command: LocalCommand): void {
    this.localCommands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      command.aliases.forEach(alias => {
        this.localCommands.set(alias, command);
      });
    }
  }

  unregisterCommand(name: string): void {
    const command = this.localCommands.get(name);
    if (command) {
      this.localCommands.delete(name);
      
      // Remove aliases
      if (command.aliases) {
        command.aliases.forEach(alias => {
          this.localCommands.delete(alias);
        });
      }
    }
  }

  async processCommand(commandLine: string, sessionId: string, terminal: any): Promise<boolean> {
    const trimmed = commandLine.trim();
    if (!trimmed) return false;

    // First, try to expand aliases
    const aliasExpansion = terminalAliasesManager.expandCommand(trimmed);
    let actualCommand = trimmed;

    if (aliasExpansion) {
      actualCommand = aliasExpansion.expandedCommand;

      // Show expansion if enabled
      const settings = terminalAliasesManager.getSettings();
      if (settings.showExpansion) {
        terminal.writeln(`\x1b[90mExpanded: ${actualCommand}\x1b[0m`);
      }

      // Ask for confirmation if enabled
      if (settings.confirmExpansion) {
        terminal.writeln(`\x1b[33mExecute: ${actualCommand}? (y/N)\x1b[0m`);
        // Note: In a real implementation, this would need to handle user input
        // For now, we'll just proceed
      }
    }

    const parts = this.parseCommand(actualCommand);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.localCommands.get(commandName);
    if (command) {
      try {
        return await command.handler(args, sessionId, terminal);
      } catch (error) {
        terminal.writeln(`\x1b[31mError executing local command '${commandName}': ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
        return true; // Command was handled, even if it failed
      }
    }

    return false; // Command not handled locally
  }

  private parseCommand(commandLine: string): string[] {
    // Simple command parsing - split by spaces but respect quotes
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];
      
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

  // Built-in command handlers
  private async handleHistoryCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    const options = this.parseHistoryArgs(args);
    
    let entries: CommandHistoryEntry[] = [];
    
    if (options.global) {
      entries = terminalHistoryManager.getGlobalHistory();
    } else {
      entries = terminalHistoryManager.getSessionHistory(sessionId);
    }

    if (options.count && options.count > 0) {
      entries = entries.slice(-options.count);
    }

    if (entries.length === 0) {
      terminal.writeln('\x1b[33mNo command history found.\x1b[0m');
      return true;
    }

    terminal.writeln('\x1b[36mCommand History:\x1b[0m');
    entries.forEach((entry, index) => {
      const timestamp = entry.timestamp.toLocaleTimeString();
      const lineNumber = options.global ? 
        terminalHistoryManager.getGlobalHistory().indexOf(entry) + 1 :
        index + 1;
      
      terminal.writeln(`\x1b[90m${lineNumber.toString().padStart(4)}\x1b[0m  \x1b[90m${timestamp}\x1b[0m  ${entry.command}`);
    });

    return true;
  }

  private async handleHistoryClearCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    const options = this.parseHistoryClearArgs(args);
    
    if (options.global) {
      terminalHistoryManager.clearHistory();
      terminal.writeln('\x1b[32mGlobal command history cleared.\x1b[0m');
    } else {
      terminalHistoryManager.clearHistory(sessionId);
      terminal.writeln('\x1b[32mSession command history cleared.\x1b[0m');
    }

    return true;
  }

  private async handleHistorySearchCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    if (args.length === 0) {
      terminal.writeln('\x1b[31mUsage: history-search <search-term> [options]\x1b[0m');
      terminal.writeln('Options:');
      terminal.writeln('  -g, --global    Search global history');
      terminal.writeln('  -c, --case      Case sensitive search');
      terminal.writeln('  -l, --limit N   Limit results to N entries');
      return true;
    }

    const options = this.parseHistorySearchArgs(args);
    
    const results = terminalHistoryManager.searchHistory({
      query: options.query,
      caseSensitive: options.caseSensitive,
      sessionId: options.global ? undefined : sessionId,
      limit: options.limit,
      includeGlobal: options.global
    });

    if (results.length === 0) {
      terminal.writeln(`\x1b[33mNo commands found matching '${options.query}'.\x1b[0m`);
      return true;
    }

    terminal.writeln(`\x1b[36mSearch Results for '${options.query}':\x1b[0m`);
    results.forEach((result, index) => {
      const timestamp = result.entry.timestamp.toLocaleTimeString();
      const command = result.entry.command;
      
      // Highlight the match
      const beforeMatch = command.substring(0, result.matchIndex);
      const match = command.substring(result.matchIndex, result.matchIndex + result.matchLength);
      const afterMatch = command.substring(result.matchIndex + result.matchLength);
      
      const highlightedCommand = `${beforeMatch}\x1b[43m\x1b[30m${match}\x1b[0m${afterMatch}`;
      
      terminal.writeln(`\x1b[90m${(index + 1).toString().padStart(4)}\x1b[0m  \x1b[90m${timestamp}\x1b[0m  ${highlightedCommand}`);
    });

    return true;
  }

  private async handleLocalHelpCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    terminal.writeln('\x1b[36mAvailable Local Terminal Commands:\x1b[0m');
    
    const commands = Array.from(this.localCommands.values())
      .filter((cmd, index, arr) => arr.findIndex(c => c.name === cmd.name) === index) // Remove duplicates from aliases
      .sort((a, b) => a.name.localeCompare(b.name));

    commands.forEach(cmd => {
      const aliases = cmd.aliases ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
      terminal.writeln(`  \x1b[32m${cmd.name}\x1b[0m${aliases} - ${cmd.description}`);
    });

    terminal.writeln('\nNote: These commands are processed locally and do not affect the remote server.');
    return true;
  }

  // Argument parsing helpers
  private parseHistoryArgs(args: string[]): { count?: number; global: boolean } {
    let count: number | undefined;
    let global = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '-g' || arg === '--global') {
        global = true;
      } else if (arg === '-n' || arg === '--count') {
        const nextArg = args[i + 1];
        if (nextArg && !isNaN(parseInt(nextArg))) {
          count = parseInt(nextArg);
          i++; // Skip the next argument
        }
      } else if (!isNaN(parseInt(arg))) {
        count = parseInt(arg);
      }
    }

    return { count, global };
  }

  private parseHistoryClearArgs(args: string[]): { global: boolean } {
    let global = false;

    for (const arg of args) {
      if (arg === '-g' || arg === '--global') {
        global = true;
      }
    }

    return { global };
  }

  private parseHistorySearchArgs(args: string[]): { 
    query: string; 
    caseSensitive: boolean; 
    global: boolean; 
    limit: number 
  } {
    let query = '';
    let caseSensitive = false;
    let global = false;
    let limit = 50;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '-g' || arg === '--global') {
        global = true;
      } else if (arg === '-c' || arg === '--case') {
        caseSensitive = true;
      } else if (arg === '-l' || arg === '--limit') {
        const nextArg = args[i + 1];
        if (nextArg && !isNaN(parseInt(nextArg))) {
          limit = parseInt(nextArg);
          i++; // Skip the next argument
        }
      } else if (!arg.startsWith('-')) {
        query = arg;
      }
    }

    return { query, caseSensitive, global, limit };
  }

  // Alias command handlers
  private async handleAliasCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    if (args.length === 0) {
      // List all aliases
      return this.handleAliasesCommand(args, sessionId, terminal);
    }

    if (args.length === 1) {
      // Show specific alias
      const aliasName = args[0];
      const alias = terminalAliasesManager.getAlias(aliasName);

      if (alias) {
        terminal.writeln(`\x1b[36mAlias '${alias.name}':\x1b[0m`);
        terminal.writeln(`  Command: ${alias.command}`);
        if (alias.description) {
          terminal.writeln(`  Description: ${alias.description}`);
        }
        if (alias.parameters && alias.parameters.length > 0) {
          terminal.writeln(`  Parameters:`);
          alias.parameters.forEach(param => {
            const required = param.required ? ' (required)' : ' (optional)';
            terminal.writeln(`    ${param.name}: ${param.description || 'No description'}${required}`);
          });
        }
        terminal.writeln(`  Used ${alias.useCount} times`);
      } else {
        terminal.writeln(`\x1b[31mAlias '${aliasName}' not found.\x1b[0m`);
      }
      return true;
    }

    // Create new alias: alias name="command"
    const aliasName = args[0];
    const aliasCommand = args.slice(1).join(' ');

    // Remove quotes if present
    const cleanCommand = aliasCommand.replace(/^["']|["']$/g, '');

    try {
      terminalAliasesManager.createAlias(aliasName, cleanCommand);
      terminal.writeln(`\x1b[32mAlias '${aliasName}' created successfully.\x1b[0m`);
    } catch (error) {
      terminal.writeln(`\x1b[31mError creating alias: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
    }

    return true;
  }

  private async handleUnaliasCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    if (args.length === 0) {
      terminal.writeln('\x1b[31mUsage: unalias <alias-name>\x1b[0m');
      return true;
    }

    const aliasName = args[0];

    if (terminalAliasesManager.deleteAlias(aliasName)) {
      terminal.writeln(`\x1b[32mAlias '${aliasName}' removed successfully.\x1b[0m`);
    } else {
      terminal.writeln(`\x1b[31mAlias '${aliasName}' not found.\x1b[0m`);
    }

    return true;
  }

  private async handleAliasesCommand(args: string[], sessionId: string, terminal: any): Promise<boolean> {
    const aliases = terminalAliasesManager.getAllAliases();

    if (aliases.length === 0) {
      terminal.writeln('\x1b[33mNo aliases defined.\x1b[0m');
      return true;
    }

    terminal.writeln('\x1b[36mDefined Aliases:\x1b[0m');

    // Group by category
    const categorized = aliases.reduce((acc, alias) => {
      const category = alias.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(alias);
      return acc;
    }, {} as Record<string, typeof aliases>);

    Object.entries(categorized).forEach(([category, categoryAliases]) => {
      terminal.writeln(`\n\x1b[35m${category.toUpperCase()}:\x1b[0m`);

      categoryAliases
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(alias => {
          const description = alias.description ? ` - ${alias.description}` : '';
          const usage = alias.useCount > 0 ? ` \x1b[90m(used ${alias.useCount}x)\x1b[0m` : '';
          terminal.writeln(`  \x1b[32m${alias.name}\x1b[0m = '${alias.command}'${description}${usage}`);
        });
    });

    return true;
  }

  getAvailableCommands(): LocalCommand[] {
    return Array.from(this.localCommands.values())
      .filter((cmd, index, arr) => arr.findIndex(c => c.name === cmd.name) === index);
  }
}

export const terminalCommandProcessor = new TerminalCommandProcessor();
