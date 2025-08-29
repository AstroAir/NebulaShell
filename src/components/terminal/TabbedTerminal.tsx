'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
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
import { usePerformanceMonitor, useStableCallback } from '@/hooks/use-performance-monitor';
import { SkeletonTerminal } from '@/components/ui/skeleton-enhanced';
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
  const terminalContentRef = useRef<HTMLDivElement>(null);

  // Attach swipe gestures to terminal content
  useEffect(() => {
    if (isMobile && terminalContentRef.current) {
      return attachGestures(terminalContentRef.current);
    }
  }, [isMobile, attachGestures]);

  return (
    <>
      <Card className={className}>
      {/* Tab Bar */}
      <div className={cn(
        "flex items-center border-b bg-muted/30",
        isMobile && "px-2"
      )}>
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-1 border-r cursor-pointer min-w-0 touch-target",
                // Mobile-specific styling
                isMobile ? "px-2 py-3 max-w-32" : "px-3 py-2 max-w-48",
                // Active state
                tab.isActive
                  ? 'bg-background border-b-2 border-b-primary'
                  : 'hover:bg-muted/50',
                // Activity indicator
                tab.hasUnreadActivity && !tab.isActive && 'bg-blue-50 dark:bg-blue-950'
              )}
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
                  className={cn(
                    "text-xs",
                    isMobile ? "h-5" : "h-6"
                  )}
                  autoFocus
                />
              ) : (
                <span className={cn(
                  "truncate font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {isMobile ? tab.title.slice(0, 8) + (tab.title.length > 8 ? '...' : '') : tab.title}
                </span>
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

        {/* New Tab Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTab}
          disabled={!terminalSessionManager.canCreateNewTab()}
          className={cn(
            "touch-target",
            isMobile ? "mx-1 px-2" : "mx-2"
          )}
        >
          <Plus className={cn(
            isMobile ? "h-5 w-5" : "h-4 w-4"
          )} />
          {!isMobile && <span className="ml-1 hidden sm:inline">New</span>}
        </Button>
      </div>

      {/* Terminal Content */}
      <CardContent
        ref={terminalContentRef}
        className="p-0 h-[calc(100%-48px)] relative"
      >
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
