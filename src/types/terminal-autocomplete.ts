export interface CompletionSuggestion {
  text: string;
  displayText?: string;
  description?: string;
  type: CompletionType;
  priority: number | 'high' | 'medium' | 'low';
  insertText?: string;
  detail?: string;
}

export type CompletionType = 
  | 'command'
  | 'file'
  | 'directory'
  | 'flag'
  | 'option'
  | 'variable'
  | 'alias'
  | 'history'
  | 'custom';

export interface CompletionContext {
  fullLine: string;
  currentWord: string;
  wordStartIndex: number;
  wordEndIndex: number;
  cursorPosition: number;
  tokens: string[];
  currentTokenIndex: number;
}

export interface CompletionProvider {
  name: string;
  priority: number;
  canComplete: (context: CompletionContext) => boolean;
  getCompletions: (context: CompletionContext) => Promise<CompletionSuggestion[]>;
}

export interface AutoCompleteSettings {
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
  cacheTimeout: number; // in milliseconds
  // Enhanced auto-completion settings
  enableFuzzySearch?: boolean;
  showCategories?: boolean;
}

export interface CompletionCache {
  key: string;
  suggestions: CompletionSuggestion[];
  timestamp: number;
  expiresAt: number;
}

export interface CompletionState {
  isActive: boolean;
  suggestions: CompletionSuggestion[];
  selectedIndex: number;
  context: CompletionContext | null;
  trigger: 'tab' | 'space' | 'manual' | null;
}

export interface FileSystemEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  modified?: Date;
  permissions?: string;
}

// Common command definitions for completion
export interface CommandDefinition {
  name: string;
  description?: string;
  flags?: FlagDefinition[];
  subcommands?: CommandDefinition[];
  aliases?: string[];
}

export interface FlagDefinition {
  name: string;
  shortName?: string;
  description?: string;
  hasValue: boolean;
  valueType?: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  possibleValues?: string[];
}

// Built-in command database
export const COMMON_COMMANDS: CommandDefinition[] = [
  {
    name: 'ls',
    description: 'List directory contents',
    flags: [
      { name: '--all', shortName: '-a', description: 'Show hidden files', hasValue: false },
      { name: '--long', shortName: '-l', description: 'Long format', hasValue: false },
      { name: '--human-readable', shortName: '-h', description: 'Human readable sizes', hasValue: false },
      { name: '--recursive', shortName: '-R', description: 'Recursive listing', hasValue: false },
    ]
  },
  {
    name: 'cd',
    description: 'Change directory',
    flags: []
  },
  {
    name: 'pwd',
    description: 'Print working directory',
    flags: []
  },
  {
    name: 'mkdir',
    description: 'Create directories',
    flags: [
      { name: '--parents', shortName: '-p', description: 'Create parent directories', hasValue: false },
      { name: '--mode', shortName: '-m', description: 'Set permissions', hasValue: true, valueType: 'string' },
    ]
  },
  {
    name: 'rmdir',
    description: 'Remove empty directories',
    flags: [
      { name: '--parents', shortName: '-p', description: 'Remove parent directories', hasValue: false },
    ]
  },
  {
    name: 'rm',
    description: 'Remove files and directories',
    flags: [
      { name: '--recursive', shortName: '-r', description: 'Remove recursively', hasValue: false },
      { name: '--force', shortName: '-f', description: 'Force removal', hasValue: false },
      { name: '--interactive', shortName: '-i', description: 'Prompt before removal', hasValue: false },
    ]
  },
  {
    name: 'cp',
    description: 'Copy files and directories',
    flags: [
      { name: '--recursive', shortName: '-r', description: 'Copy recursively', hasValue: false },
      { name: '--preserve', shortName: '-p', description: 'Preserve attributes', hasValue: false },
      { name: '--interactive', shortName: '-i', description: 'Prompt before overwrite', hasValue: false },
    ]
  },
  {
    name: 'mv',
    description: 'Move/rename files and directories',
    flags: [
      { name: '--interactive', shortName: '-i', description: 'Prompt before overwrite', hasValue: false },
      { name: '--force', shortName: '-f', description: 'Force move', hasValue: false },
    ]
  },
  {
    name: 'cat',
    description: 'Display file contents',
    flags: [
      { name: '--number', shortName: '-n', description: 'Number lines', hasValue: false },
      { name: '--show-ends', shortName: '-E', description: 'Show line endings', hasValue: false },
    ]
  },
  {
    name: 'grep',
    description: 'Search text patterns',
    flags: [
      { name: '--ignore-case', shortName: '-i', description: 'Case insensitive', hasValue: false },
      { name: '--recursive', shortName: '-r', description: 'Search recursively', hasValue: false },
      { name: '--line-number', shortName: '-n', description: 'Show line numbers', hasValue: false },
      { name: '--count', shortName: '-c', description: 'Count matches', hasValue: false },
    ]
  },
  {
    name: 'find',
    description: 'Find files and directories',
    flags: [
      { name: '-name', description: 'Search by name', hasValue: true, valueType: 'string' },
      { name: '-type', description: 'Search by type', hasValue: true, valueType: 'string', possibleValues: ['f', 'd', 'l'] },
      { name: '-size', description: 'Search by size', hasValue: true, valueType: 'string' },
    ]
  },
  {
    name: 'chmod',
    description: 'Change file permissions',
    flags: [
      { name: '--recursive', shortName: '-R', description: 'Change recursively', hasValue: false },
    ]
  },
  {
    name: 'chown',
    description: 'Change file ownership',
    flags: [
      { name: '--recursive', shortName: '-R', description: 'Change recursively', hasValue: false },
    ]
  },
  {
    name: 'ps',
    description: 'Show running processes',
    flags: [
      { name: '--all', shortName: '-a', description: 'Show all processes', hasValue: false },
      { name: '--user', shortName: '-u', description: 'Show user processes', hasValue: false },
      { name: '--full', shortName: '-f', description: 'Full format', hasValue: false },
    ]
  },
  {
    name: 'kill',
    description: 'Terminate processes',
    flags: [
      { name: '--signal', shortName: '-s', description: 'Signal to send', hasValue: true, valueType: 'string' },
    ]
  },
  {
    name: 'top',
    description: 'Display running processes',
    flags: []
  },
  {
    name: 'df',
    description: 'Display filesystem usage',
    flags: [
      { name: '--human-readable', shortName: '-h', description: 'Human readable sizes', hasValue: false },
    ]
  },
  {
    name: 'du',
    description: 'Display directory usage',
    flags: [
      { name: '--human-readable', shortName: '-h', description: 'Human readable sizes', hasValue: false },
      { name: '--summarize', shortName: '-s', description: 'Summary only', hasValue: false },
    ]
  },
  {
    name: 'tar',
    description: 'Archive files',
    flags: [
      { name: '--create', shortName: '-c', description: 'Create archive', hasValue: false },
      { name: '--extract', shortName: '-x', description: 'Extract archive', hasValue: false },
      { name: '--file', shortName: '-f', description: 'Archive file', hasValue: true, valueType: 'file' },
      { name: '--gzip', shortName: '-z', description: 'Compress with gzip', hasValue: false },
    ]
  },
  {
    name: 'wget',
    description: 'Download files from web',
    flags: [
      { name: '--output-document', shortName: '-O', description: 'Output file', hasValue: true, valueType: 'file' },
      { name: '--continue', shortName: '-c', description: 'Continue download', hasValue: false },
    ]
  },
  {
    name: 'curl',
    description: 'Transfer data from servers',
    flags: [
      { name: '--output', shortName: '-o', description: 'Output file', hasValue: true, valueType: 'file' },
      { name: '--location', shortName: '-L', description: 'Follow redirects', hasValue: false },
      { name: '--header', shortName: '-H', description: 'Add header', hasValue: true, valueType: 'string' },
    ]
  }
];
