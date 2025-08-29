'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
// Label import removed as not currently used
import { Separator } from '@/components/ui/separator';
import {
  Keyboard,
  Search,
  Terminal,
  Navigation,
  Layout,
  Settings,
  Layers as TabsIcon,
  X
} from 'lucide-react';
import { useKeyboardShortcuts, KeyboardShortcut } from './KeyboardShortcuts';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons = {
  general: Settings,
  terminal: Terminal,
  navigation: Navigation,
  layout: Layout,
  tabs: TabsIcon,
};

const categoryColors = {
  general: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  terminal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  navigation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  layout: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  tabs: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onOpenChange,
}) => {
  const { getShortcuts } = useKeyboardShortcuts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const shortcuts = getShortcuts();

  // Filter shortcuts based on search and category
  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesSearch = !searchQuery || 
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.key.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group shortcuts by category
  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  const formatKeyCombo = (shortcut: KeyboardShortcut) => {
    const keys: string[] = [];
    
    if (shortcut.ctrlKey) keys.push('Ctrl');
    if (shortcut.altKey) keys.push('Alt');
    if (shortcut.shiftKey) keys.push('Shift');
    if (shortcut.metaKey) keys.push('Cmd');
    
    keys.push(shortcut.key);
    
    return keys;
  };

  const KeyCombo: React.FC<{ shortcut: KeyboardShortcut }> = ({ shortcut }) => {
    const keys = formatKeyCombo(shortcut);
    
    return (
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-muted-foreground text-xs">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const ShortcutItem: React.FC<{ shortcut: KeyboardShortcut }> = ({ shortcut }) => {
    const IconComponent = categoryIcons[shortcut.category];
    
    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{shortcut.description}</p>
            <Badge 
              variant="secondary" 
              className={cn("text-xs mt-1", categoryColors[shortcut.category])}
            >
              {shortcut.category}
            </Badge>
          </div>
        </div>
        <KeyCombo shortcut={shortcut} />
      </div>
    );
  };

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Master these keyboard shortcuts to work more efficiently
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and Filter */}
          <div className="space-y-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shortcuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                {categories.map(category => (
                  <TabsTrigger key={category} value={category} className="text-xs capitalize">
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Separator className="mb-4" />

          {/* Shortcuts List */}
          <div className="flex-1 overflow-y-auto">
            {selectedCategory === 'all' ? (
              <div className="space-y-6">
                {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => {
                  const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
                  
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <IconComponent className="h-4 w-4" />
                        <h3 className="font-semibold capitalize">{category}</h3>
                        <Badge variant="outline" className="text-xs">
                          {categoryShortcuts.length}
                        </Badge>
                      </div>
                      <div className="space-y-1 ml-6">
                        {categoryShortcuts.map(shortcut => (
                          <ShortcutItem key={shortcut.id} shortcut={shortcut} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredShortcuts.map(shortcut => (
                  <ShortcutItem key={shortcut.id} shortcut={shortcut} />
                ))}
              </div>
            )}

            {filteredShortcuts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Keyboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No shortcuts found matching your search.</p>
                <p className="text-sm mt-1">Try adjusting your search terms or category filter.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{filteredShortcuts.length} shortcuts shown</span>
                <span>•</span>
                <span>Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Esc</kbd> to close</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">Tip: Most shortcuts work globally</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp;
