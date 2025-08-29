'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  History, 
  Star, 
  StarOff, 
  Copy, 
  Tag, 
  Calendar,
  TrendingUp,
  Filter,
  Download,
  Trash2,
  Clock,
  Terminal,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { enhancedTerminalHistoryManager, HistoryEntry, HistorySearchOptions } from '@/lib/terminal-history-enhanced';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/components/accessibility/AccessibilityProvider';
import { useDebounce } from '@/hooks/use-performance-monitor';

interface CommandHistorySearchProps {
  onCommandSelect?: (command: string) => void;
  className?: string;
}

export function CommandHistorySearch({ onCommandSelect, className }: CommandHistorySearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HistoryEntry[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<HistorySearchOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState(enhancedTerminalHistoryManager.getStats());
  const { announce } = useAccessibility();

  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    performSearch();
  }, [debouncedQuery, selectedFilters]);

  useEffect(() => {
    setStats(enhancedTerminalHistoryManager.getStats());
  }, [searchResults]);

  const performSearch = () => {
    const options: HistorySearchOptions = {
      query: debouncedQuery || undefined,
      ...selectedFilters,
      limit: 100,
    };

    const results = enhancedTerminalHistoryManager.search(options);
    setSearchResults(results);
    
    if (debouncedQuery) {
      announce(`Found ${results.length} commands matching "${debouncedQuery}"`);
    }
  };

  const handleCommandSelect = (command: string) => {
    onCommandSelect?.(command);
    announce(`Command selected: ${command}`);
  };

  const handleToggleFavorite = (entryId: string) => {
    const success = enhancedTerminalHistoryManager.toggleFavorite(entryId);
    if (success) {
      performSearch(); // Refresh results
      announce('Favorite status updated');
    }
  };

  const handleCopyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      announce('Command copied to clipboard');
    } catch (error) {
      announce('Failed to copy command', 'assertive');
    }
  };

  const handleExportHistory = () => {
    const data = enhancedTerminalHistoryManager.exportHistory();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce('History exported successfully');
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString();
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getExitCodeBadge = (exitCode?: number) => {
    if (exitCode === undefined) return null;
    
    return (
      <Badge 
        variant={exitCode === 0 ? 'default' : 'destructive'}
        className="text-xs"
      >
        {exitCode === 0 ? (
          <CheckCircle className="h-3 w-3 mr-1" />
        ) : (
          <XCircle className="h-3 w-3 mr-1" />
        )}
        {exitCode}
      </Badge>
    );
  };

  const mostUsedCommands = useMemo(() => {
    return enhancedTerminalHistoryManager.getMostUsedCommands(10);
  }, [searchResults]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Command History
            </CardTitle>
            <CardDescription>
              Search and manage your terminal command history
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportHistory}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commands... (try 'tag:git' or 'dir:/home')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Exit Code</label>
                <Select
                  value={selectedFilters.exitCode?.toString() || 'all'}
                  onValueChange={(value) => 
                    setSelectedFilters(prev => ({
                      ...prev,
                      exitCode: value === 'all' ? undefined : parseInt(value)
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0">Success (0)</SelectItem>
                    <SelectItem value="1">Error (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Show Favorites</label>
                <Select
                  value={selectedFilters.favorites ? 'true' : 'false'}
                  onValueChange={(value) => 
                    setSelectedFilters(prev => ({
                      ...prev,
                      favorites: value === 'true'
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">All Commands</SelectItem>
                    <SelectItem value="true">Favorites Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Limit</label>
                <Select
                  value={selectedFilters.limit?.toString() || '100'}
                  onValueChange={(value) => 
                    setSelectedFilters(prev => ({
                      ...prev,
                      limit: parseInt(value)
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">
              Results ({searchResults.length})
            </TabsTrigger>
            <TabsTrigger value="popular">Most Used</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No commands found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  searchResults.map((entry) => (
                    <Card 
                      key={entry.id}
                      className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleCommandSelect(entry.command)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded truncate">
                              {entry.command}
                            </code>
                            {getExitCodeBadge(entry.exitCode)}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(entry.timestamp)}
                            </span>
                            {entry.workingDirectory && (
                              <span className="flex items-center gap-1">
                                <Terminal className="h-3 w-3" />
                                {entry.workingDirectory}
                              </span>
                            )}
                            {entry.duration && (
                              <span>{entry.duration}ms</span>
                            )}
                          </div>

                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              {entry.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(entry.id);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            {entry.favorite ? (
                              <Star className="h-4 w-4 fill-current text-yellow-500" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCommand(entry.command);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="popular" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {mostUsedCommands.map((item, index) => (
                  <Card 
                    key={item.command}
                    className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleCommandSelect(item.command)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {item.command}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.count} times
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCommand(item.command);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <h4 className="font-medium">Usage Statistics</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Commands:</span>
                    <span className="font-mono">{stats.totalCommands}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unique Commands:</span>
                    <span className="font-mono">{stats.uniqueCommands}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-mono">{stats.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Session:</span>
                    <span className="font-mono">
                      {Math.round(stats.averageSessionLength / 1000 / 60)}m
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  <h4 className="font-medium">Recent Activity</h4>
                </div>
                <div className="space-y-1 text-sm">
                  {stats.commandsPerDay.slice(-7).map((day) => (
                    <div key={day.date} className="flex justify-between">
                      <span>{new Date(day.date).toLocaleDateString()}</span>
                      <span className="font-mono">{day.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
