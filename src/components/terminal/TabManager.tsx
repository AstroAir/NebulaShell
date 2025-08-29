'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
// Label and Separator imports removed as not currently used
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  // DialogTrigger - removed as not currently used
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  // DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger - removed as not currently used
} from '@/components/ui/dropdown-menu';
import {
  Layers as TabsIcon,
  Plus,
  X,
  MoreHorizontal,
  Copy,
  Edit3,
  Trash2,
  // FolderOpen, Settings, Bookmark, Maximize2, ArrowRight, ArrowLeft, Minimize2 - removed as not currently used
} from 'lucide-react';
import { terminalSessionManager } from '@/lib/terminal-session-manager';
import { TerminalTab } from '@/types/terminal-session';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface TabManagerProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onNewTab: () => void;
  className?: string;
}

export const TabManager: React.FC<TabManagerProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onNewTab,
  className,
}) => {
  const { isMobile } = useResponsive();
  const [showTabManager, setShowTabManager] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleRenameTab = useCallback((tabId: string, newTitle: string) => {
    terminalSessionManager.renameTab(tabId, newTitle);
    setEditingTabId(null);
    setEditingTitle('');
  }, []);

  const handleDuplicateTab = useCallback((tabId: string) => {
    terminalSessionManager.duplicateTab(tabId);
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    terminalSessionManager.closeTab(tabId);
  }, []);

  /*
  const handleCloseOtherTabs = useCallback((tabId: string) => {
    terminalSessionManager.closeOtherTabs(tabId);
  }, []);
  */

  const handleCloseAllTabs = useCallback(() => {
    terminalSessionManager.closeAllTabs();
  }, []);

  /*
  const handleMoveTabLeft = useCallback((tabId: string) => {
    // Tab reordering functionality would be implemented here
    console.log('Move tab left:', tabId);
  }, []);

  const handleMoveTabRight = useCallback((tabId: string) => {
    // Tab reordering functionality would be implemented here
    console.log('Move tab right:', tabId);
  }, []);
  */

  const startEditing = useCallback((tab: TerminalTab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  }, []);

  // TabContextMenu component removed as not currently used - keeping for future implementation
  /*
  const TabContextMenuComponent: React.FC<{ tab: TerminalTab; children: React.ReactNode }> = ({
    tab,
    children
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => startEditing(tab)}>
          <Edit3 className="h-4 w-4 mr-2" />
          Rename Tab
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleDuplicateTab(tab.id)}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate Tab
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRight className="h-4 w-4 mr-2" />
            Move Tab
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem 
              onClick={() => handleMoveTabLeft(tab.id)}
              disabled={tabs.findIndex(t => t.id === tab.id) === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Move Left
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleMoveTabRight(tab.id)}
              disabled={tabs.findIndex(t => t.id === tab.id) === tabs.length - 1}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Move Right
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem 
          onClick={() => handleCloseOtherTabs(tab.id)}
          disabled={tabs.length <= 1}
        >
          <Minimize2 className="h-4 w-4 mr-2" />
          Close Other Tabs
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => handleCloseTab(tab.id)}
          className="text-destructive focus:text-destructive"
        >
          <X className="h-4 w-4 mr-2" />
          Close Tab
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  */

  const TabManagerDialog: React.FC = () => (
    <Dialog open={showTabManager} onOpenChange={setShowTabManager}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TabsIcon className="h-5 w-5" />
            Tab Manager
          </DialogTitle>
          <DialogDescription>
            Manage all your terminal tabs in one place
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                tab.id === activeTabId 
                  ? "bg-primary/10 border-primary/20" 
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs">
                  {index + 1}
                </Badge>
                
                {editingTabId === tab.id ? (
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameTab(tab.id, editingTitle);
                      } else if (e.key === 'Escape') {
                        setEditingTabId(null);
                        setEditingTitle('');
                      }
                    }}
                    onBlur={() => handleRenameTab(tab.id, editingTitle)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tab.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tab.sessionId ? `Session: ${tab.sessionId.slice(0, 8)}...` : 'Not connected'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTabClick(tab.id)}
                  className="h-8 px-2"
                >
                  {tab.id === activeTabId ? 'Active' : 'Switch'}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
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
                    <DropdownMenuItem 
                      onClick={() => handleCloseTab(tab.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {tabs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <TabsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No terminal tabs open</p>
              <p className="text-sm mt-1">Create a new tab to get started</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button onClick={onNewTab} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Tab
            </Button>
            
            {tabs.length > 1 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCloseAllTabs}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Close All
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {tabs.length} tab{tabs.length !== 1 ? 's' : ''} open
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Tab Manager Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowTabManager(true)}
        className="h-8 px-2"
        title="Manage tabs"
      >
        <TabsIcon className="h-4 w-4" />
        {!isMobile && tabs.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {tabs.length}
          </Badge>
        )}
      </Button>

      {/* New Tab Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNewTab}
        disabled={!terminalSessionManager.canCreateNewTab()}
        className="h-8 px-2"
        title="New tab (Ctrl+T)"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <TabManagerDialog />
    </div>
  );
};

export default TabManager;
