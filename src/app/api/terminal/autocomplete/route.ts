import { NextRequest, NextResponse } from 'next/server';
import { sshManager } from '@/lib/ssh-manager';
import { fuzzySearchArray } from '@/lib/fuzzy-search';
import { logger } from '@/lib/logger';

// Required for static export
export const dynamic = 'force-static';

interface AutoCompleteRequest {
  sessionId: string;
  input: string;
  cursorPosition: number;
  context?: {
    currentDirectory?: string;
    previousCommands?: string[];
    environment?: Record<string, string>;
  };
  options?: {
    maxSuggestions?: number;
    includeFiles?: boolean;
    includeCommands?: boolean;
    includeHistory?: boolean;
    fuzzySearch?: boolean;
    mobileOptimized?: boolean;
  };
}

interface AutoCompleteSuggestion {
  text: string;
  type: 'command' | 'file' | 'directory' | 'flag' | 'variable' | 'alias' | 'history';
  description?: string;
  priority: number | 'high' | 'medium' | 'low';
  insertText?: string;
  detail?: string;
  icon?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AutoCompleteRequest = await request.json();
    const { 
      sessionId, 
      input, 
      cursorPosition, 
      context = {}, 
      options = {} 
    } = body;

    // Validate required fields
    if (!sessionId || input === undefined) {
      return NextResponse.json(
        { error: 'Session ID and input are required' },
        { status: 400 }
      );
    }

    // Check if session exists
    const session = sshManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const {
      maxSuggestions = options.mobileOptimized ? 8 : 15,
      includeFiles = true,
      includeCommands = true,
      includeHistory = true,
      fuzzySearch = true,
      mobileOptimized = false
    } = options;

    const suggestions: AutoCompleteSuggestion[] = [];

    // Parse input to understand context
    const words = input.trim().split(/\s+/);
    const currentWord = getCurrentWord(input, cursorPosition);
    const isFirstWord = words.length <= 1;

    try {
      // Get command suggestions
      if (includeCommands && (isFirstWord || currentWord.startsWith('-'))) {
        const commandSuggestions = await getCommandSuggestions(
          sessionId, 
          currentWord, 
          context,
          mobileOptimized
        );
        suggestions.push(...commandSuggestions);
      }

      // Get file/directory suggestions
      if (includeFiles && (!isFirstWord || currentWord.includes('/'))) {
        const fileSuggestions = await getFileSuggestions(
          sessionId,
          currentWord,
          context,
          mobileOptimized
        );
        suggestions.push(...fileSuggestions);
      }

      // Get history suggestions
      if (includeHistory && context.previousCommands) {
        const historySuggestions = getHistorySuggestions(
          currentWord, 
          context.previousCommands,
          mobileOptimized
        );
        suggestions.push(...historySuggestions);
      }

      // Get environment variable suggestions
      if (currentWord.startsWith('$') && context.environment) {
        const varSuggestions = getVariableSuggestions(
          currentWord, 
          context.environment,
          mobileOptimized
        );
        suggestions.push(...varSuggestions);
      }

    } catch (error) {
      logger.error('Error generating autocomplete suggestions', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        input: input.substring(0, 100) // Log first 100 chars only
      });
    }

    // Apply fuzzy search if enabled
    let filteredSuggestions = suggestions;
    if (fuzzySearch && currentWord) {
      const fuzzyResults = fuzzySearchArray(
        suggestions,
        currentWord,
        (item) => [item.text, item.description || ''],
        { threshold: 0.3, includeScore: true }
      );
      filteredSuggestions = fuzzyResults.map(result => result.item);
    }

    // Sort by priority and relevance
    filteredSuggestions.sort((a, b) => {
      const getPriorityValue = (priority: number | 'high' | 'medium' | 'low'): number => {
        if (typeof priority === 'number') return priority;
        switch (priority) {
          case 'high': return 100;
          case 'medium': return 50;
          case 'low': return 10;
          default: return 0;
        }
      };

      const aPriority = getPriorityValue(a.priority);
      const bPriority = getPriorityValue(b.priority);
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return a.text.length - b.text.length;
    });

    // Limit results
    const limitedSuggestions = filteredSuggestions.slice(0, maxSuggestions);

    // Update session activity
    sshManager.updateLastActivity(sessionId);

    return NextResponse.json({
      success: true,
      suggestions: limitedSuggestions,
      metadata: {
        totalSuggestions: suggestions.length,
        filteredSuggestions: filteredSuggestions.length,
        returnedSuggestions: limitedSuggestions.length,
        currentWord,
        isFirstWord,
        mobileOptimized,
        processingTime: Date.now()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate autocomplete suggestions';
    logger.error('Autocomplete API error', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getCurrentWord(input: string, cursorPosition: number): string {
  const beforeCursor = input.substring(0, cursorPosition);
  const afterCursor = input.substring(cursorPosition);
  
  const wordStart = beforeCursor.lastIndexOf(' ') + 1;
  const wordEnd = afterCursor.indexOf(' ');
  
  const start = wordStart;
  const end = wordEnd === -1 ? input.length : cursorPosition + wordEnd;
  
  return input.substring(start, end);
}

async function getCommandSuggestions(
  sessionId: string,
  currentWord: string,
  context: any,
  mobileOptimized: boolean
): Promise<AutoCompleteSuggestion[]> {
  try {
    // Try to get real commands from the remote system
    const remoteCommands = await getRemoteCommands(sessionId, currentWord);

    if (remoteCommands.length > 0) {
      return remoteCommands
        .slice(0, mobileOptimized ? 8 : 15)
        .map(cmd => ({
          text: cmd.name,
          description: cmd.description || `Command: ${cmd.name}`,
          priority: (cmd.priority === 'high' || cmd.priority === 'medium' || cmd.priority === 'low') ? cmd.priority : 'medium' as const,
          type: 'command' as const,
          icon: 'terminal'
        }));
    }
  } catch (error) {
    logger.error('Error getting remote commands', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId
    });
  }

  // Fallback to common commands if remote discovery fails
  const commonCommands = [
    { text: 'ls', description: 'List directory contents', priority: 'high' as const },
    { text: 'cd', description: 'Change directory', priority: 'high' as const },
    { text: 'pwd', description: 'Print working directory', priority: 'high' as const },
    { text: 'cat', description: 'Display file contents', priority: 'medium' as const },
    { text: 'grep', description: 'Search text patterns', priority: 'medium' as const },
    { text: 'find', description: 'Find files and directories', priority: 'medium' as const },
    { text: 'chmod', description: 'Change file permissions', priority: 'low' as const },
    { text: 'chown', description: 'Change file ownership', priority: 'low' as const },
    { text: 'cp', description: 'Copy files', priority: 'medium' as const },
    { text: 'mv', description: 'Move/rename files', priority: 'medium' as const },
    { text: 'rm', description: 'Remove files', priority: 'medium' as const },
    { text: 'mkdir', description: 'Create directory', priority: 'medium' as const },
    { text: 'rmdir', description: 'Remove directory', priority: 'medium' as const },
    { text: 'touch', description: 'Create empty file', priority: 'low' as const },
    { text: 'nano', description: 'Text editor', priority: 'low' as const },
    { text: 'vim', description: 'Vi text editor', priority: 'low' as const },
    { text: 'emacs', description: 'Emacs text editor', priority: 'low' as const },
    { text: 'ps', description: 'List processes', priority: 'low' as const },
    { text: 'top', description: 'Display running processes', priority: 'low' as const },
    { text: 'htop', description: 'Interactive process viewer', priority: 'low' as const },
    { text: 'kill', description: 'Terminate processes', priority: 'low' as const },
    { text: 'killall', description: 'Kill processes by name', priority: 'low' as const },
    { text: 'which', description: 'Locate command', priority: 'low' as const },
    { text: 'whereis', description: 'Locate binary, source, manual', priority: 'low' as const },
    { text: 'man', description: 'Manual pages', priority: 'low' as const },
    { text: 'history', description: 'Command history', priority: 'low' as const },
    { text: 'alias', description: 'Create command alias', priority: 'low' as const },
    { text: 'unalias', description: 'Remove command alias', priority: 'low' as const },
    { text: 'export', description: 'Set environment variable', priority: 'low' as const },
    { text: 'env', description: 'Display environment', priority: 'low' as const },
    { text: 'echo', description: 'Display text', priority: 'medium' as const },
    { text: 'printf', description: 'Format and print text', priority: 'low' as const },
    { text: 'date', description: 'Display or set date', priority: 'low' as const },
    { text: 'uptime', description: 'System uptime', priority: 'low' as const },
    { text: 'whoami', description: 'Current username', priority: 'low' as const },
    { text: 'id', description: 'User and group IDs', priority: 'low' as const },
    { text: 'su', description: 'Switch user', priority: 'low' as const },
    { text: 'sudo', description: 'Execute as another user', priority: 'medium' as const },
    { text: 'ssh', description: 'Secure shell', priority: 'medium' as const },
    { text: 'scp', description: 'Secure copy', priority: 'medium' as const },
    { text: 'rsync', description: 'Remote sync', priority: 'medium' as const },
    { text: 'wget', description: 'Download files', priority: 'medium' as const },
    { text: 'curl', description: 'Transfer data', priority: 'medium' as const },
    { text: 'tar', description: 'Archive files', priority: 'medium' as const },
    { text: 'gzip', description: 'Compress files', priority: 'low' as const },
    { text: 'gunzip', description: 'Decompress files', priority: 'low' as const },
    { text: 'zip', description: 'Create zip archive', priority: 'low' as const },
    { text: 'unzip', description: 'Extract zip archive', priority: 'low' as const },
    { text: 'df', description: 'Disk space usage', priority: 'low' as const },
    { text: 'du', description: 'Directory usage', priority: 'low' as const },
    { text: 'free', description: 'Memory usage', priority: 'low' as const },
    { text: 'mount', description: 'Mount filesystem', priority: 'low' as const },
    { text: 'umount', description: 'Unmount filesystem', priority: 'low' as const },
  ];

  return commonCommands
    .filter(cmd => !currentWord || cmd.text.startsWith(currentWord))
    .slice(0, mobileOptimized ? 8 : 15)
    .map(cmd => ({
      ...cmd,
      type: 'command' as const,
      icon: 'terminal'
    }));
}

async function getRemoteCommands(sessionId: string, prefix: string): Promise<Array<{name: string, description?: string, priority?: string}>> {
  try {
    // Use SSH to discover available commands on the remote system
    const sshManager = await import('@/lib/ssh-manager');

    // Try multiple methods to discover commands
    const discoveryCommands = [
      // Get commands from PATH
      'echo $PATH | tr ":" "\\n" | head -10 | xargs -I {} find {} -maxdepth 1 -type f -executable 2>/dev/null | head -50',
      // Get common commands from /usr/bin
      'ls /usr/bin/ 2>/dev/null | head -30',
      // Get commands from /bin
      'ls /bin/ 2>/dev/null | head -20',
      // Get built-in commands (bash)
      'compgen -b 2>/dev/null | head -20',
      // Get aliases
      'alias 2>/dev/null | cut -d"=" -f1 | sed "s/alias //" | head -10'
    ];

    const commands = new Set<string>();

    for (const cmd of discoveryCommands) {
      try {
        const result = await sshManager.sshManager.executeCommand(sessionId, cmd);
        if (result.success && result.output) {
          const lines = result.output.split('\n').filter((line: string) => line.trim());
          for (const line of lines) {
            const commandName = line.split('/').pop()?.trim();
            if (commandName && commandName.length > 0 && !commandName.includes(' ')) {
              if (!prefix || commandName.startsWith(prefix)) {
                commands.add(commandName);
              }
            }
          }
        }
      } catch {
        // Continue with next discovery method if one fails
        continue;
      }
    }

    return Array.from(commands).map(name => ({
      name,
      description: `Remote command: ${name}`,
      priority: 'medium'
    }));

  } catch (error) {
    logger.error('Error discovering remote commands', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId
    });
    return [];
  }
}

async function getFileSuggestions(
  sessionId: string,
  currentWord: string,
  context: any,
  mobileOptimized: boolean
): Promise<AutoCompleteSuggestion[]> {
  try {
    // Get the current directory from context or default to current working directory
    const currentDir = context.currentDirectory || '.';

    // Determine the directory to list based on the current word
    let targetDir = currentDir;
    let filePrefix = currentWord;

    // If current word contains a path separator, extract directory and filename parts
    if (currentWord.includes('/')) {
      const lastSlashIndex = currentWord.lastIndexOf('/');
      const dirPart = currentWord.substring(0, lastSlashIndex + 1);
      filePrefix = currentWord.substring(lastSlashIndex + 1);

      // Handle absolute vs relative paths
      if (dirPart.startsWith('/')) {
        targetDir = dirPart;
      } else {
        targetDir = `${currentDir}/${dirPart}`.replace(/\/+/g, '/');
      }
    }

    // Use SFTP to list directory contents
    const sftpManager = await import('@/lib/sftp-manager');
    const directoryListing = await sftpManager.sftpManager.listDirectory(sessionId, targetDir);

    if (!directoryListing.items) {
      return [];
    }

    // Filter and format file suggestions
    const suggestions: AutoCompleteSuggestion[] = directoryListing.items
      .filter(item => {
        // Filter by prefix if provided
        if (filePrefix && !item.name.startsWith(filePrefix)) {
          return false;
        }

        // Skip hidden files unless prefix starts with dot
        if (item.name.startsWith('.') && !filePrefix.startsWith('.')) {
          return false;
        }

        return true;
      })
      .slice(0, mobileOptimized ? 8 : 15) // Limit results for mobile
      .map(item => {
        const isDirectory = item.type === 'directory';
        const suggestion: AutoCompleteSuggestion = {
          text: isDirectory ? `${item.name}/` : item.name,
          type: isDirectory ? 'directory' : 'file',
          description: isDirectory
            ? `Directory: ${item.name}`
            : `File: ${item.name} (${formatFileSize(item.size)})`,
          priority: isDirectory ? 'medium' : 'low',
          icon: isDirectory ? 'folder' : getFileIcon(item.name)
        };

        return suggestion;
      })
      .sort((a, b) => {
        // Sort directories first, then files
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.text.localeCompare(b.text);
      });

    return suggestions;

  } catch (error) {
    logger.error('Error getting file suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId,
      currentWord: currentWord.substring(0, 50) // Log first 50 chars only
    });

    // Return empty array on error to avoid breaking autocomplete
    return [];
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return 'code';
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
      return 'settings';
    case 'md':
    case 'txt':
    case 'log':
      return 'file-text';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
      return 'image';
    case 'pdf':
      return 'file-pdf';
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return 'archive';
    default:
      return 'file';
  }
}

function getHistorySuggestions(
  currentWord: string, 
  previousCommands: string[],
  mobileOptimized: boolean
): AutoCompleteSuggestion[] {
  return previousCommands
    .filter(cmd => cmd.startsWith(currentWord))
    .slice(0, mobileOptimized ? 3 : 5)
    .map(cmd => ({
      text: cmd,
      type: 'history' as const,
      description: 'From command history',
      priority: 'medium' as const,
      icon: 'history'
    }));
}

function getVariableSuggestions(
  currentWord: string, 
  environment: Record<string, string>,
  mobileOptimized: boolean
): AutoCompleteSuggestion[] {
  const varName = currentWord.substring(1); // Remove $
  
  return Object.keys(environment)
    .filter(key => key.startsWith(varName))
    .slice(0, mobileOptimized ? 3 : 8)
    .map(key => ({
      text: `$${key}`,
      type: 'variable' as const,
      description: `Environment variable: ${environment[key]?.substring(0, 50)}...`,
      priority: 'low' as const,
      icon: 'variable'
    }));
}
