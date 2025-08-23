export interface CommandAlias {
  id: string;
  name: string;
  command: string;
  description?: string;
  parameters?: AliasParameter[];
  createdAt: Date;
  updatedAt: Date;
  useCount: number;
  tags?: string[];
  category?: string;
}

export interface AliasParameter {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  position: number; // Position in the command where this parameter should be inserted
}

export interface AliasExpansionContext {
  alias: CommandAlias;
  parameters: Record<string, string>;
  originalCommand: string;
  expandedCommand: string;
}

export interface AliasSettings {
  enabled: boolean;
  showExpansion: boolean; // Show the expanded command before execution
  confirmExpansion: boolean; // Ask for confirmation before executing expanded commands
  caseSensitive: boolean;
  allowRecursiveExpansion: boolean; // Allow aliases to reference other aliases
  maxExpansionDepth: number;
}

export interface AliasGroup {
  id: string;
  name: string;
  description?: string;
  aliases: string[]; // Array of alias IDs
  color?: string;
  icon?: string;
}

export interface AliasState {
  aliases: Map<string, CommandAlias>;
  groups: Map<string, AliasGroup>;
  settings: AliasSettings;
}

export interface AliasExport {
  aliases: CommandAlias[];
  groups: AliasGroup[];
  settings: AliasSettings;
  exportedAt: Date;
  version: string;
}

export interface AliasSearchFilter {
  query?: string;
  category?: string;
  tags?: string[];
  groupId?: string;
  sortBy?: 'name' | 'useCount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Built-in aliases that come with the system
export const BUILT_IN_ALIASES: Omit<CommandAlias, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>[] = [
  {
    name: 'll',
    command: 'ls -la',
    description: 'List files in long format with hidden files',
    category: 'file-management',
    tags: ['list', 'files']
  },
  {
    name: 'la',
    command: 'ls -A',
    description: 'List all files except . and ..',
    category: 'file-management',
    tags: ['list', 'files']
  },
  {
    name: 'l',
    command: 'ls -CF',
    description: 'List files with indicators',
    category: 'file-management',
    tags: ['list', 'files']
  },
  {
    name: 'grep-i',
    command: 'grep -i',
    description: 'Case-insensitive grep',
    category: 'search',
    tags: ['search', 'text']
  },
  {
    name: 'grep-r',
    command: 'grep -r',
    description: 'Recursive grep',
    category: 'search',
    tags: ['search', 'text', 'recursive']
  },
  {
    name: 'df-h',
    command: 'df -h',
    description: 'Show disk usage in human readable format',
    category: 'system',
    tags: ['disk', 'usage']
  },
  {
    name: 'du-h',
    command: 'du -h',
    description: 'Show directory usage in human readable format',
    category: 'system',
    tags: ['disk', 'usage']
  },
  {
    name: 'ps-aux',
    command: 'ps aux',
    description: 'Show all running processes',
    category: 'system',
    tags: ['processes', 'system']
  },
  {
    name: 'mkdir-p',
    command: 'mkdir -p',
    description: 'Create directory with parent directories',
    category: 'file-management',
    tags: ['directory', 'create']
  },
  {
    name: 'rm-rf',
    command: 'rm -rf',
    description: 'Remove files and directories recursively (use with caution)',
    category: 'file-management',
    tags: ['remove', 'delete', 'dangerous']
  },
  {
    name: 'cp-r',
    command: 'cp -r',
    description: 'Copy files and directories recursively',
    category: 'file-management',
    tags: ['copy', 'recursive']
  },
  {
    name: 'mv-i',
    command: 'mv -i',
    description: 'Move files with confirmation prompt',
    category: 'file-management',
    tags: ['move', 'safe']
  },
  {
    name: 'cp-i',
    command: 'cp -i',
    description: 'Copy files with confirmation prompt',
    category: 'file-management',
    tags: ['copy', 'safe']
  },
  {
    name: 'rm-i',
    command: 'rm -i',
    description: 'Remove files with confirmation prompt',
    category: 'file-management',
    tags: ['remove', 'safe']
  },
  {
    name: 'tar-czf',
    command: 'tar -czf',
    description: 'Create compressed tar archive',
    category: 'archive',
    tags: ['archive', 'compress'],
    parameters: [
      {
        name: 'archive_name',
        description: 'Name of the archive file',
        required: true,
        type: 'file',
        position: 1
      },
      {
        name: 'source',
        description: 'Files or directories to archive',
        required: true,
        type: 'file',
        position: 2
      }
    ]
  },
  {
    name: 'tar-xzf',
    command: 'tar -xzf',
    description: 'Extract compressed tar archive',
    category: 'archive',
    tags: ['archive', 'extract'],
    parameters: [
      {
        name: 'archive_name',
        description: 'Name of the archive file to extract',
        required: true,
        type: 'file',
        position: 1
      }
    ]
  },
  {
    name: 'find-name',
    command: 'find . -name',
    description: 'Find files by name in current directory',
    category: 'search',
    tags: ['find', 'search'],
    parameters: [
      {
        name: 'pattern',
        description: 'File name pattern to search for',
        required: true,
        type: 'string',
        position: 1
      }
    ]
  },
  {
    name: 'find-type',
    command: 'find . -type',
    description: 'Find files by type in current directory',
    category: 'search',
    tags: ['find', 'search'],
    parameters: [
      {
        name: 'type',
        description: 'File type (f for files, d for directories)',
        required: true,
        type: 'string',
        position: 1,
        defaultValue: 'f'
      }
    ]
  },
  {
    name: 'chmod-x',
    command: 'chmod +x',
    description: 'Make file executable',
    category: 'permissions',
    tags: ['permissions', 'executable'],
    parameters: [
      {
        name: 'file',
        description: 'File to make executable',
        required: true,
        type: 'file',
        position: 1
      }
    ]
  },
  {
    name: 'wget-c',
    command: 'wget -c',
    description: 'Download file with resume capability',
    category: 'network',
    tags: ['download', 'network'],
    parameters: [
      {
        name: 'url',
        description: 'URL to download',
        required: true,
        type: 'string',
        position: 1
      }
    ]
  }
];
