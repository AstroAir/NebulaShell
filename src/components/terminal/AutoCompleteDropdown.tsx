'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CompletionSuggestion, CompletionType } from '@/types/terminal-autocomplete';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Command, 
  File, 
  Folder, 
  Flag, 
  Settings, 
  Variable, 
  History, 
  Hash 
} from 'lucide-react';

interface AutoCompleteDropdownProps {
  suggestions: CompletionSuggestion[];
  selectedIndex: number;
  position: { x: number; y: number };
  visible: boolean;
  onSelect: (suggestion: CompletionSuggestion, index: number) => void;
  onClose: () => void;
  maxHeight?: number;
  showTypes?: boolean;
  showDescriptions?: boolean;
}

const TYPE_ICONS: Record<CompletionType, React.ComponentType<any>> = {
  command: Command,
  file: File,
  directory: Folder,
  flag: Flag,
  option: Settings,
  variable: Variable,
  alias: Hash,
  history: History,
  custom: Settings,
};

const TYPE_COLORS: Record<CompletionType, string> = {
  command: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  file: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  directory: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  flag: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  option: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  variable: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  alias: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  history: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  custom: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
};

export function AutoCompleteDropdown({
  suggestions,
  selectedIndex,
  position,
  visible,
  onSelect,
  onClose,
  maxHeight = 200,
  showTypes = true,
  showDescriptions = true
}: AutoCompleteDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  const handleItemClick = (suggestion: CompletionSuggestion, index: number) => {
    onSelect(suggestion, index);
  };

  const getTypeIcon = (type: CompletionType) => {
    const IconComponent = TYPE_ICONS[type];
    return IconComponent ? <IconComponent className="h-3 w-3" /> : null;
  };

  const getTypeColor = (type: CompletionType) => {
    return TYPE_COLORS[type] || TYPE_COLORS.custom;
  };

  return (
    <Card
      ref={dropdownRef}
      className="absolute z-50 p-1 shadow-lg border bg-background/95 backdrop-blur-sm"
      style={{
        left: position.x,
        top: position.y,
        maxHeight,
        minWidth: '200px',
        maxWidth: '400px'
      }}
    >
      <div className="overflow-y-auto max-h-full">
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.text}-${suggestion.type}-${index}`}
            ref={index === selectedIndex ? selectedItemRef : undefined}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm
              ${index === selectedIndex 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted/50'
              }
            `}
            onClick={() => handleItemClick(suggestion, index)}
          >
            {/* Type icon and badge */}
            {showTypes && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {getTypeIcon(suggestion.type)}
                <Badge 
                  variant="secondary" 
                  className={`text-xs px-1 py-0 h-4 ${getTypeColor(suggestion.type)}`}
                >
                  {suggestion.type}
                </Badge>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium truncate">
                  {suggestion.displayText || suggestion.text}
                </span>
                {suggestion.detail && (
                  <span className="text-xs text-muted-foreground truncate">
                    {suggestion.detail}
                  </span>
                )}
              </div>
              
              {showDescriptions && suggestion.description && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {suggestion.description}
                </div>
              )}
            </div>

            {/* Priority indicator for debugging */}
            {process.env.NODE_ENV === 'development' && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {suggestion.priority}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer with navigation hint */}
      <div className="border-t mt-1 pt-1 px-2 py-1">
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>↑↓ Navigate</span>
          <span>Tab/Enter Select</span>
          <span>Esc Cancel</span>
        </div>
      </div>
    </Card>
  );
}

// Hook for managing autocomplete state and positioning
export function useAutoComplete() {
  const [isVisible, setIsVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const show = (
    newSuggestions: CompletionSuggestion[], 
    pos: { x: number; y: number }
  ) => {
    setSuggestions(newSuggestions);
    setSelectedIndex(0);
    setPosition(pos);
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
    setSuggestions([]);
    setSelectedIndex(0);
  };

  const selectNext = () => {
    setSelectedIndex(prev => 
      prev < suggestions.length - 1 ? prev + 1 : prev
    );
  };

  const selectPrevious = () => {
    setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
  };

  const selectFirst = () => {
    setSelectedIndex(0);
  };

  const selectLast = () => {
    setSelectedIndex(suggestions.length - 1);
  };

  const getSelected = (): CompletionSuggestion | null => {
    return suggestions[selectedIndex] || null;
  };

  return {
    isVisible,
    suggestions,
    selectedIndex,
    position,
    show,
    hide,
    selectNext,
    selectPrevious,
    selectFirst,
    selectLast,
    getSelected
  };
}

// Utility function to calculate dropdown position relative to terminal cursor
export function calculateDropdownPosition(
  terminalElement: HTMLElement,
  cursorPosition: { row: number; col: number },
  charWidth: number,
  lineHeight: number
): { x: number; y: number } {
  const terminalRect = terminalElement.getBoundingClientRect();
  
  // Calculate position based on cursor position
  const x = terminalRect.left + (cursorPosition.col * charWidth);
  const y = terminalRect.top + ((cursorPosition.row + 1) * lineHeight);
  
  // Adjust if dropdown would go off-screen
  const dropdownWidth = 300; // Estimated dropdown width
  const dropdownHeight = 200; // Estimated dropdown height
  
  let adjustedX = x;
  let adjustedY = y;
  
  // Adjust horizontal position
  if (x + dropdownWidth > window.innerWidth) {
    adjustedX = window.innerWidth - dropdownWidth - 10;
  }
  
  // Adjust vertical position
  if (y + dropdownHeight > window.innerHeight) {
    adjustedY = y - dropdownHeight - lineHeight;
  }
  
  return { x: adjustedX, y: adjustedY };
}
