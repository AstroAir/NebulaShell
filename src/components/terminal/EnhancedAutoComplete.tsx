'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { CompletionSuggestion, CompletionType } from '@/types/terminal-autocomplete';
import { useResponsive } from '@/hooks/use-responsive';
import { fuzzySearch } from '@/lib/fuzzy-search';
import { cn } from '@/lib/utils';
import { 
  Command as CommandIcon, 
  File, 
  Folder, 
  Flag, 
  Settings, 
  Variable, 
  History, 
  Hash,
  Search,
  // Clock - removed as not currently used
  Star,
} from 'lucide-react';

interface EnhancedAutoCompleteProps {
  suggestions: CompletionSuggestion[];
  selectedIndex: number;
  position: { x: number; y: number };
  visible: boolean;
  onSelect: (suggestion: CompletionSuggestion, index: number) => void;
  onClose: () => void;
  currentInput: string;
  maxHeight?: number;
  enableFuzzySearch?: boolean;
  showCategories?: boolean;
}

const TYPE_ICONS: Record<CompletionType, React.ComponentType<any>> = {
  command: CommandIcon,
  file: File,
  directory: Folder,
  flag: Flag,
  option: Settings,
  variable: Variable,
  alias: Hash,
  history: History,
  custom: Settings,
};

const TYPE_LABELS: Record<CompletionType, string> = {
  command: 'Commands',
  file: 'Files',
  directory: 'Directories',
  flag: 'Flags',
  option: 'Options',
  variable: 'Variables',
  alias: 'Aliases',
  history: 'History',
  custom: 'Custom',
};

// Component to render highlighted text
const HighlightedText: React.FC<{
  text: string;
  highlightRanges?: Array<{ start: number; end: number }>;
  className?: string;
}> = ({ text, highlightRanges, className }) => {
  if (!highlightRanges || highlightRanges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  highlightRanges.forEach((range, index) => {
    // Add text before the highlight
    if (range.start > lastIndex) {
      parts.push(
        <span key={`text-${index}`} className={className}>
          {text.slice(lastIndex, range.start)}
        </span>
      );
    }

    // Add highlighted text
    parts.push(
      <span
        key={`highlight-${index}`}
        className={cn(className, "bg-yellow-200 dark:bg-yellow-800 font-semibold")}
      >
        {text.slice(range.start, range.end)}
      </span>
    );

    lastIndex = range.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end" className={className}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
};

export function EnhancedAutoComplete({
  suggestions,
  selectedIndex,
  position,
  visible,
  onSelect,
  onClose,
  // currentInput - removed as not currently used
  maxHeight = 300,
  enableFuzzySearch = true,
  showCategories = true,
}: EnhancedAutoCompleteProps) {
  const { isMobile } = useResponsive();
  const [searchValue, setSearchValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<CompletionSuggestion[]>([]);
  const [suggestionMatches, setSuggestionMatches] = useState<Map<string, { textMatch: any; descMatch: any }>>(new Map());

  // Advanced fuzzy search implementation using the fuzzy search library
  const performFuzzySearch = useCallback((text: string, query: string) => {
    if (!enableFuzzySearch || !query) return { matches: true, score: 1 };

    return fuzzySearch(text, query, {
      caseSensitive: false,
      threshold: 0.1, // Lower threshold for more permissive matching
      includeMatches: true,
    });
  }, [enableFuzzySearch]);

  // Filter and sort suggestions with advanced scoring
  useEffect(() => {
    let filtered = suggestions;

    if (searchValue) {
      // Filter and score suggestions using advanced fuzzy search
      const scoredSuggestions = suggestions
        .map(suggestion => {
          const textMatch = performFuzzySearch(suggestion.text, searchValue);
          const descMatch = performFuzzySearch(suggestion.description || '', searchValue);

          const matches = textMatch.matches || descMatch.matches;
          const score = Math.max(textMatch.score, descMatch.score * 0.7); // Description matches get lower weight

          return { suggestion, matches, score, textMatch, descMatch };
        })
        .filter(item => item.matches);

      // Sort by score (highest first), then by priority, then by text length
      scoredSuggestions.sort((a, b) => {
        // First by fuzzy match score
        if (a.score !== b.score) {
          return b.score - a.score;
        }

        // Then by suggestion priority
        const getPriorityValue = (priority: number | 'high' | 'medium' | 'low'): number => {
          if (typeof priority === 'number') return priority;
          switch (priority) {
            case 'high': return 100;
            case 'medium': return 50;
            case 'low': return 10;
            default: return 0;
          }
        };

        const aPriority = getPriorityValue(a.suggestion.priority);
        const bPriority = getPriorityValue(b.suggestion.priority);
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }

        // Finally by text length (shorter first)
        return a.suggestion.text.length - b.suggestion.text.length;
      });

      filtered = scoredSuggestions.map(item => item.suggestion);

      // Store match results for highlighting
      const matchMap = new Map();
      scoredSuggestions.forEach(item => {
        matchMap.set(item.suggestion.text, {
          textMatch: item.textMatch,
          descMatch: item.descMatch,
        });
      });
      setSuggestionMatches(matchMap);
    } else {
      setSuggestionMatches(new Map());
    }

    setFilteredSuggestions(filtered);
  }, [suggestions, searchValue, performFuzzySearch]);

  // Group suggestions by type
  const groupedSuggestions = React.useMemo(() => {
    if (!showCategories) {
      return { all: filteredSuggestions };
    }

    const groups: Record<string, CompletionSuggestion[]> = {};
    
    filteredSuggestions.forEach(suggestion => {
      const type = suggestion.type || 'custom';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(suggestion);
    });

    return groups;
  }, [filteredSuggestions, showCategories]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredSuggestions[selectedIndex]) {
            onSelect(filteredSuggestions[selectedIndex], selectedIndex);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedIndex, filteredSuggestions, onSelect, onClose]);

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-autocomplete]')) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  if (!visible) return null;

  const getTypeIcon = (type: CompletionType) => {
    const IconComponent = TYPE_ICONS[type];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  const handleItemSelect = (suggestion: CompletionSuggestion) => {
    const index = filteredSuggestions.indexOf(suggestion);
    onSelect(suggestion, index);
  };

  return (
    <div
      data-autocomplete
      className={cn(
        "absolute z-50 shadow-lg border bg-background/95 backdrop-blur-sm rounded-md",
        isMobile && "w-[calc(100vw-2rem)] max-w-sm"
      )}
      style={{
        left: isMobile ? '1rem' : position.x,
        top: position.y,
        maxHeight,
        minWidth: isMobile ? 'auto' : '300px',
      }}
    >
      <Command className="rounded-md border-0">
        {enableFuzzySearch && (
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search suggestions..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )}
        
        <CommandList style={{ maxHeight: maxHeight - (enableFuzzySearch ? 50 : 0) }}>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No suggestions found</p>
            </div>
          </CommandEmpty>

          {Object.entries(groupedSuggestions).map(([type, suggestions], groupIndex) => (
            <React.Fragment key={type}>
              {showCategories && suggestions.length > 0 && (
                <CommandGroup heading={TYPE_LABELS[type as CompletionType] || type}>
                  {suggestions.map((suggestion, index) => {
                    const globalIndex = filteredSuggestions.indexOf(suggestion);
                    const isSelected = globalIndex === selectedIndex;
                    
                    return (
                      <CommandItem
                        key={`${suggestion.text}-${index}`}
                        value={suggestion.text}
                        onSelect={() => handleItemSelect(suggestion)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 cursor-pointer",
                          isSelected && "bg-accent text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getTypeIcon(suggestion.type)}
                          <HighlightedText
                            text={suggestion.text}
                            highlightRanges={suggestionMatches.get(suggestion.text)?.textMatch?.highlightRanges}
                            className="font-medium truncate"
                          />
                          {suggestion.priority === 'high' && (
                            <Star className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>

                        {suggestion.description && (
                          <HighlightedText
                            text={suggestion.description}
                            highlightRanges={suggestionMatches.get(suggestion.text)?.descMatch?.highlightRanges}
                            className="text-xs text-muted-foreground truncate max-w-[150px]"
                          />
                        )}
                        
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.type}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              
              {!showCategories && suggestions.map((suggestion, index) => {
                const globalIndex = filteredSuggestions.indexOf(suggestion);
                const isSelected = globalIndex === selectedIndex;
                
                return (
                  <CommandItem
                    key={`${suggestion.text}-${index}`}
                    value={suggestion.text}
                    onSelect={() => handleItemSelect(suggestion)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 cursor-pointer",
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getTypeIcon(suggestion.type)}
                      <HighlightedText
                        text={suggestion.text}
                        highlightRanges={suggestionMatches.get(suggestion.text)?.textMatch?.highlightRanges}
                        className="font-medium truncate"
                      />
                    </div>

                    {suggestion.description && (
                      <HighlightedText
                        text={suggestion.description}
                        highlightRanges={suggestionMatches.get(suggestion.text)?.descMatch?.highlightRanges}
                        className="text-xs text-muted-foreground truncate max-w-[150px]"
                      />
                    )}
                  </CommandItem>
                );
              })}
              
              {groupIndex < Object.keys(groupedSuggestions).length - 1 && (
                <CommandSeparator />
              )}
            </React.Fragment>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
