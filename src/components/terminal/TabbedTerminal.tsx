'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { TerminalTab } from '@/types/terminal-session';
import { useTerminal } from './TerminalContext';

import { useResponsive } from '@/hooks/use-responsive';
import { KeyboardShortcuts } from '@/components/keyboard/KeyboardShortcuts';
import { useSwipeNavigation } from '@/hooks/use-touch-gestures';
import { cn } from '@/lib/utils';

interface TabbedTerminalProps {
  className?: string;
  onToggleHelp?: () => void;
  onToggleSettings?: () => void;
  onToggleLayoutSettings?: () => void;
  onToggleFullscreen?: () => void;
  onToggleSidebar?: () => void;
}

export function TabbedTerminal({
  className,
  onToggleHelp,
  onToggleSettings,
  onToggleLayoutSettings,
  onToggleFullscreen,
  onToggleSidebar,
}: TabbedTerminalProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const { } = useTerminal(); // connectionStatus removed as not used
  const { isMobile } = useResponsive(); // isTablet removed as not used

  // Swipe navigation for mobile
  const handleSwipeLeft = useCallback(() => {
    if (!activeTabId || tabs.length <= 1) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    handleTabClick(tabs[nextIndex].id);
  }, [activeTabId, tabs]);

  const handleSwipeRight = useCallback(() => {
    if (!activeTabId || tabs.length <= 1) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    handleTabClick(tabs[prevIndex].id);
  }, [activeTabId, tabs]);

  const { attachGestures } = useSwipeNavigation({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    enabled: isMobile && tabs.length > 1,
  });

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

  // Enhanced tab navigation for keyboard shortcuts
  const handleNextTab = useCallback(() => {
    if (tabs.length <= 1) return;

    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    terminalSessionManager.activateTab(tabs[nextIndex].id);
  }, [tabs, activeTabId]);

  const handlePrevTab = useCallback(() => {
    if (tabs.length <= 1) return;

    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    terminalSessionManager.activateTab(tabs[prevIndex].id);
  }, [tabs, activeTabId]);

  // Focus terminal input
  const handleFocusTerminal = useCallback(() => {
    const terminalElement = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
    if (terminalElement) {
      terminalElement.focus();
    }
  }, []);

  // Clear current terminal
  const handleClearTerminal = useCallback(() => {
    const event = new CustomEvent('clear-terminal', { detail: { tabId: activeTabId } });
    document.dispatchEvent(event);
  }, [activeTabId]);

  // Copy selection from terminal
  const handleCopySelection = useCallback(() => {
    const event = new CustomEvent('copy-selection', { detail: { tabId: activeTabId } });
    document.dispatchEvent(event);
  }, [activeTabId]);

  // Paste to terminal
  const handlePasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const event = new CustomEvent('paste-text', { detail: { tabId: activeTabId, text } });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
    }
  }, [activeTabId]);

  // Close current tab
  const handleCloseCurrentTab = useCallback(() => {
    if (activeTabId) {
      terminalSessionManager.closeTab(activeTabId);
    }
  }, [activeTabId]);

  const startEditing = (tab: TerminalTab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const getConnectionIcon = (status: TerminalTab['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-3 w-3 text-success" />;
      case 'connecting':
        return <Loader2 className="h-3 w-3 text-info animate-spin" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <WifiOff className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const activeSession = terminalSessionManager.getActiveSession();
  const terminalContentRef = useRef<HTMLDivElement>(null);

  // Attach swipe gestures to terminal content
  useEffect(() => {
    if (isMobile && terminalContentRef.current) {
      return attachGestures(terminalContentRef.current);
    }
  }, [isMobile, attachGestures]);

  return (
    <>
      <Card className={cn("card-elevated overflow-hidden", className)}>
      {/* Enhanced Tab Bar with Modern Design */}
      <div className={cn(
        "flex items-center border-b bg-gradient-to-r from-muted/30 to-muted/50 backdrop-blur-sm",
        "shadow-sm transition-all duration-200",
        isMobile && "px-2"
      )}>
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group relative flex items-center gap-2 cursor-pointer min-w-0 touch-target transition-all duration-300",
                // Enhanced mobile-specific styling
                isMobile ? "px-3 py-3 max-w-36" : "px-4 py-3 max-w-52",
                // Enhanced active state with modern styling and better visual feedback
                tab.isActive
                  ? 'bg-background/98 border-b-2 border-b-primary shadow-md backdrop-blur-sm relative z-10'
                  : 'hover:bg-background/70 hover:shadow-sm hover:scale-[1.02]',
                // Enhanced activity indicator with better visual prominence
                tab.hasUnreadActivity && !tab.isActive && 'bg-info/15 border-l-3 border-l-info animate-pulse',
                // Add subtle border between tabs with better visual separation
                "border-r border-border/40 last:border-r-0",
                // Add subtle glow effect for active tab
                tab.isActive && "before:absolute before:inset-0 before:bg-gradient-to-b before:from-primary/5 before:to-transparent before:pointer-events-none"
              )}
              onClick={() => handleTabClick(tab.id)}
            >
              {/* Enhanced connection status with better visual feedback and animations */}
              <div className={cn(
                "flex items-center justify-center rounded-full transition-all duration-300 relative",
                isMobile ? "w-5 h-5" : "w-6 h-6",
                tab.connectionStatus === 'connected' && "bg-success/25 shadow-sm",
                tab.connectionStatus === 'connecting' && "bg-info/25 shadow-sm animate-pulse",
                tab.connectionStatus === 'error' && "bg-destructive/25 shadow-sm",
                // Add subtle ring effect for active connection
                tab.connectionStatus === 'connected' && "ring-1 ring-success/20"
              )}>
                {getConnectionIcon(tab.connectionStatus)}
              </div>

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
                  className={cn(
                    "border-0 bg-transparent focus:bg-background/80 rounded-md",
                    isMobile ? "text-xs h-6" : "text-sm h-7"
                  )}
                  autoFocus
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "block truncate font-medium transition-colors duration-200",
                    isMobile ? "text-xs" : "text-sm",
                    tab.isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {isMobile ? tab.title.slice(0, 10) + (tab.title.length > 10 ? '...' : '') : tab.title}
                  </span>
                  {/* Activity indicator dot */}
                  {tab.hasUnreadActivity && !tab.isActive && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-info rounded-full animate-pulse" />
                  )}
                </div>
              )}

              {tab.hasUnreadActivity && !tab.isActive && (
                <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full" />
              )}

              <div className="flex items-center gap-1">
                {/* Show dropdown menu only on desktop or when there are multiple tabs */}
                {(!isMobile || tabs.length > 1) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "p-0 hover:bg-muted touch-target",
                          isMobile ? "h-6 w-6" : "h-5 w-5"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className={cn(
                          isMobile ? "h-4 w-4" : "h-3 w-3"
                        )} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEditing(tab)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      {!isMobile && (
                        <DropdownMenuItem onClick={() => handleDuplicateTab(tab.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleCloseOtherTabs(tab.id)}>
                        Close Others
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCloseAllTabs}>
                        Close All
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "p-0 hover:bg-muted touch-target",
                    isMobile ? "h-6 w-6" : "h-5 w-5"
                  )}
                  onClick={(e) => handleCloseTab(tab.id, e)}
                >
                  <X className={cn(
                    isMobile ? "h-4 w-4" : "h-3 w-3"
                  )} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Enhanced New Tab Button */}
        <div className="flex items-center border-l border-border/50 pl-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewTab}
            disabled={!terminalSessionManager.canCreateNewTab()}
            className={cn(
              "touch-target interactive-hover transition-all duration-200",
              "hover:bg-primary/10 hover:text-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isMobile ? "mx-1 px-2 py-2" : "mx-2 px-3 py-2"
            )}
            title="Create new terminal tab"
          >
            <Plus className={cn(
              "transition-transform duration-200 group-hover:scale-110",
              isMobile ? "h-5 w-5" : "h-4 w-4"
            )} />
            {!isMobile && <span className="ml-2 font-medium">New Tab</span>}
          </Button>
        </div>
      </div>

      {/* Enhanced Terminal Content Area */}
      <CardContent
        ref={terminalContentRef}
        className="p-0 h-[calc(100%-48px)] relative bg-gradient-to-br from-background to-background/95"
      >
        {activeSession ? (
          <Terminal
            key={activeSession.id}
            sessionId={activeSession.id}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-4 p-8">
              <div className="relative">
                <Plus className="h-16 w-16 mx-auto opacity-40 transition-all duration-300 hover:opacity-60 hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl opacity-30"></div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-semibold">No Terminal Sessions</p>
                <p className="text-sm text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
                  Click the + button to create a new terminal session and start connecting to your servers
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Swipe indicator for mobile */}
        {isMobile && tabs.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  tab.isActive ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Keyboard Shortcuts Handler */}
    <KeyboardShortcuts
      onToggleHelp={onToggleHelp}
      onToggleSettings={onToggleSettings}
      onToggleLayoutSettings={onToggleLayoutSettings}
      onNewTab={handleNewTab}
      onCloseTab={handleCloseCurrentTab}
      onNextTab={handleNextTab}
      onPrevTab={handlePrevTab}
      onToggleFullscreen={onToggleFullscreen}
      onToggleSidebar={onToggleSidebar}
      onFocusTerminal={handleFocusTerminal}
      onClearTerminal={handleClearTerminal}
      onCopySelection={handleCopySelection}
      onPasteClipboard={handlePasteClipboard}
    />
    </>
  );
}
