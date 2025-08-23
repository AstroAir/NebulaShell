'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  X, 
  MoreHorizontal, 
  Copy, 
  Edit3, 
  Wifi, 
  WifiOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Terminal } from './Terminal';
import { terminalSessionManager } from '@/lib/terminal-session-manager';
import { TerminalTab, TerminalSession } from '@/types/terminal-session';
import { useTerminal } from './TerminalContext';

interface TabbedTerminalProps {
  className?: string;
}

export function TabbedTerminal({ className }: TabbedTerminalProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const { connectionStatus } = useTerminal();

  // Update tabs when session manager changes
  useEffect(() => {
    const updateTabs = () => {
      setTabs(terminalSessionManager.getAllTabs());
      setActiveTabId(terminalSessionManager.getActiveTabId());
    };

    const handleTabCreated = () => updateTabs();
    const handleTabClosed = () => updateTabs();
    const handleTabActivated = () => updateTabs();
    const handleTabRenamed = () => updateTabs();
    const handleTabActivity = () => updateTabs();
    const handleTabStatusChanged = () => updateTabs();

    terminalSessionManager.on('tabCreated', handleTabCreated);
    terminalSessionManager.on('tabClosed', handleTabClosed);
    terminalSessionManager.on('tabActivated', handleTabActivated);
    terminalSessionManager.on('tabRenamed', handleTabRenamed);
    terminalSessionManager.on('tabActivity', handleTabActivity);
    terminalSessionManager.on('tabStatusChanged', handleTabStatusChanged);

    // Initial load
    updateTabs();

    return () => {
      terminalSessionManager.off('tabCreated', handleTabCreated);
      terminalSessionManager.off('tabClosed', handleTabClosed);
      terminalSessionManager.off('tabActivated', handleTabActivated);
      terminalSessionManager.off('tabRenamed', handleTabRenamed);
      terminalSessionManager.off('tabActivity', handleTabActivity);
      terminalSessionManager.off('tabStatusChanged', handleTabStatusChanged);
    };
  }, []);

  const handleTabClick = (tabId: string) => {
    terminalSessionManager.activateTab(tabId);
  };

  const handleCloseTab = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    terminalSessionManager.closeTab(tabId);
  };

  const handleNewTab = () => {
    if (!terminalSessionManager.canCreateNewTab()) {
      alert('Maximum number of tabs reached');
      return;
    }
    
    // This would typically open a connection dialog
    // For now, we'll emit an event that the parent can handle
    window.dispatchEvent(new CustomEvent('requestNewTerminal'));
  };

  const handleRenameTab = (tabId: string, newTitle: string) => {
    terminalSessionManager.renameTab(tabId, newTitle);
    setEditingTabId(null);
    setEditingTitle('');
  };

  const handleDuplicateTab = (tabId: string) => {
    terminalSessionManager.duplicateTab(tabId);
  };

  const handleCloseOtherTabs = (tabId: string) => {
    terminalSessionManager.closeOtherTabs(tabId);
  };

  const handleCloseAllTabs = () => {
    terminalSessionManager.closeAllTabs();
  };

  const startEditing = (tab: TerminalTab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const getConnectionIcon = (status: TerminalTab['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-3 w-3 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <WifiOff className="h-3 w-3 text-gray-500" />;
    }
  };

  const activeSession = terminalSessionManager.getActiveSession();

  return (
    <Card className={className}>
      {/* Tab Bar */}
      <div className="flex items-center border-b bg-muted/30">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`
                flex items-center gap-2 px-3 py-2 border-r cursor-pointer min-w-0 max-w-48
                ${tab.isActive 
                  ? 'bg-background border-b-2 border-b-primary' 
                  : 'hover:bg-muted/50'
                }
                ${tab.hasUnreadActivity && !tab.isActive ? 'bg-blue-50 dark:bg-blue-950' : ''}
              `}
              onClick={() => handleTabClick(tab.id)}
            >
              {getConnectionIcon(tab.connectionStatus)}
              
              {editingTabId === tab.id ? (
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleRenameTab(tab.id, editingTitle)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameTab(tab.id, editingTitle);
                    } else if (e.key === 'Escape') {
                      setEditingTabId(null);
                      setEditingTitle('');
                    }
                  }}
                  className="h-6 text-xs"
                  autoFocus
                />
              ) : (
                <span className="truncate text-sm font-medium">
                  {tab.title}
                </span>
              )}

              {tab.hasUnreadActivity && !tab.isActive && (
                <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full" />
              )}

              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => startEditing(tab)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateTab(tab.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleCloseOtherTabs(tab.id)}>
                      Close Others
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCloseAllTabs}>
                      Close All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-muted"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* New Tab Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTab}
          disabled={!terminalSessionManager.canCreateNewTab()}
          className="mx-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Terminal Content */}
      <CardContent className="p-0 h-[calc(100%-48px)]">
        {activeSession ? (
          <Terminal 
            key={activeSession.id}
            sessionId={activeSession.id}
            className="h-full" 
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Terminal Sessions</p>
              <p className="text-sm">Click the + button to create a new terminal session</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
