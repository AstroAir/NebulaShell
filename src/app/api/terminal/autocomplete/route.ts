import { NextRequest, NextResponse } from 'next/server';
import { sshManager } from '@/lib/ssh-manager';
import { fuzzySearchArray } from '@/lib/fuzzy-search';
import { logger } from '@/lib/logger';

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
        const fileSuggestions = await getFileSuggestions();
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
  // This would typically query the remote system for available commands
  // For now, return common commands
  const commonCommands = [
    { text: 'ls', description: 'List directory contents', priority: 'high' as const },
    { text: 'cd', description: 'Change directory', priority: 'high' as const },
    { text: 'pwd', description: 'Print working directory', priority: 'high' as const },
    { text: 'cat', description: 'Display file contents', priority: 'medium' as const },
    { text: 'grep', description: 'Search text patterns', priority: 'medium' as const },
    { text: 'find', description: 'Find files and directories', priority: 'medium' as const },
    { text: 'chmod', description: 'Change file permissions', priority: 'low' as const },
    { text: 'chown', description: 'Change file ownership', priority: 'low' as const },
  ];

  return commonCommands
    .filter(cmd => !currentWord || cmd.text.startsWith(currentWord))
    .slice(0, mobileOptimized ? 5 : 10)
    .map(cmd => ({
      ...cmd,
      type: 'command' as const,
      icon: 'terminal'
    }));
}

async function getFileSuggestions(): Promise<AutoCompleteSuggestion[]> {
  // This would typically use SFTP to list directory contents
  // For now, return mock suggestions
  // Parameters removed as they're not currently used in the implementation
  return [];
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
