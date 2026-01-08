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
  AlertCircle,
  ChevronLeft,
  ChevronRight
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

  // Horizontal scrolling state for the tab list
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = tabsListRef.current;
    if (!el) return;
    const left = el.scrollLeft > 0;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setCanScrollLeft(left);
    setCanScrollRight(right);
  }, []);

  useEffect(() => {
    const el = tabsListRef.current;
    if (!el) return;
    updateScrollButtons();

    const onScroll = () => updateScrollButtons();
    el.addEventListener('scroll', onScroll);

    const onResize = () => updateScrollButtons();
    window.addEventListener('resize', onResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollButtons());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [updateScrollButtons]);

  const scrollByAmount = (dir: 'left' | 'right') => {
    const el = tabsListRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const scrollLeft = () => scrollByAmount('left');
  const scrollRight = () => scrollByAmount('right');

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

    // Ensure at least one default tab exists so the terminal is present for tests and first-time users
    if (terminalSessionManager.getTabCount() === 0) {
      const defaultConfig = {
        id: `local-${Date.now()}`,
        hostname: 'local',
        port: 22,
        username: 'user',
        name: 'Terminal',
      } as const;
      const session = terminalSessionManager.createSession(defaultConfig as any, defaultConfig.name);
      // Activate the created tab
      terminalSessionManager.activateTab(`tab_${session.id}`);
      updateTabs();
    }

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
      {/* Hidden description for screen readers */}
      <div id="terminal-description" className="sr-only">
        Terminal interface with multiple tabs. Use arrow keys to navigate between tabs, Enter to activate, and Escape to close menus.
      </div>

      <Card
        className={cn(
          "glass-card flex h-full flex-col overflow-hidden border-border/30",
          "shadow-xl hover:shadow-2xl transition-all duration-300",
          "bg-gradient-to-br from-card/95 via-card/98 to-card/95",
          className
        )}
        role="region"
        aria-label="Terminal interface"
        aria-describedby="terminal-description"
      >
      {/* Enhanced Tab Bar with Improved Visual Hierarchy */}
      <div className={cn(
        "flex items-center border-b border-border/30 relative",
        "bg-gradient-to-r from-muted/20 via-muted/10 to-muted/20",
        "backdrop-blur-sm shadow-sm",
        isMobile ? "px-2 py-2" : "px-4 py-3"
      )}>
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-accent/3 opacity-40"></div>
        {/* Edge fade overlays for tab scroll affordance */ }
        {canScrollLeft && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-20 bg-gradient-to-r from-background/80 to-transparent"
          />
        )}
        {canScrollRight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-20 bg-gradient-to-l from-background/80 to-transparent"
          />
        )}


        {/* Tab container with improved scrolling */}
        <div
          ref={tabsListRef}
          onScroll={() => updateScrollButtons()}
          className={cn(
            "flex-1 flex items-center relative z-10",
            "overflow-x-auto scrollbar-hide scroll-smooth",
            "gap-2"
          )}
          role="tablist"
          aria-label="Terminal tabs"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group relative flex items-center cursor-pointer min-w-0 transition-all duration-300",
                "rounded-t-lg border-x border-t border-border/30",
                // Enhanced spacing and sizing
                isMobile ? "px-4 py-3 gap-2 max-w-36" : "px-6 py-4 gap-3 max-w-52",
                // Enhanced active state with improved visual hierarchy
                tab.isActive
                  ? cn(
                      'bg-gradient-to-b from-background/98 to-background/95',
                      'border-primary/40 shadow-lg backdrop-blur-md relative z-20',
                      'before:absolute before:inset-0 before:bg-gradient-to-b before:from-primary/8 before:to-transparent before:pointer-events-none before:rounded-t-lg'
                    )
                  : cn(
                      'bg-gradient-to-b from-muted/40 to-muted/20',
                      'hover:from-background/60 hover:to-background/40',
                      'hover:shadow-md hover:scale-[1.02] hover:z-10',
                      'border-border/20'
                    ),
                // Enhanced activity indicator
                tab.hasUnreadActivity && !tab.isActive && cn(
                  'bg-gradient-to-r from-info/20 to-info/10',
                  'border-l-2 border-l-info animate-pulse-soft'
                ),
                // Improved visual separation
                "ml-0.5 first:ml-0"
              )}
              onClick={() => handleTabClick(tab.id)}
              role="tab"
              aria-selected={tab.isActive}
              aria-controls={`terminal-panel-${tab.id}`}
              tabIndex={tab.isActive ? 0 : -1}
              aria-label={`Terminal tab: ${tab.title}${tab.hasUnreadActivity ? ' (has activity)' : ''}${tab.connectionStatus === 'connected' ? ' (connected)' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTabClick(tab.id);
                }
              }}
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
                  onKeyDown={(e) => {
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

              <div className="flex items-center gap-2">
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
                        aria-label="Tab options"
                        title="Tab options"
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
                    "group/close relative overflow-hidden rounded-md transition-all duration-200",
                    "hover:bg-destructive/20 hover:text-destructive hover:scale-110",
                    "focus:bg-destructive/20 focus:text-destructive",
                    "active:scale-95",
                    isMobile ? "h-6 w-6 p-1" : "h-5 w-5 p-0.5"
                  )}
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  aria-label="Close tab"
                  title="Close tab"
                >
                  <X className={cn(
                    "transition-all duration-200 group-hover/close:rotate-90",
                    isMobile ? "h-4 w-4" : "h-3 w-3"
                  )} />
                  <div className="absolute inset-0 bg-destructive/10 opacity-0 group-hover/close:opacity-100 transition-opacity duration-200"></div>
                </Button>
              </div>
            </div>
          ))}
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollLeft}
              aria-label="Scroll tabs left"
              className={cn(
                "absolute left-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 p-0",
                "rounded-full bg-background/80 backdrop-blur-sm border shadow-sm",
                "hidden sm:flex items-center justify-center"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {canScrollRight && (
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollRight}
              aria-label="Scroll tabs right"
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 p-0",
                "rounded-full bg-background/80 backdrop-blur-sm border shadow-sm",
                "hidden sm:flex items-center justify-center"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

        </div>

        {/* Enhanced New Tab Button with improved styling */}
        <div className="flex items-center border-l border-border/60 pl-4 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewTab}
            disabled={!terminalSessionManager.canCreateNewTab()}
            className={cn(
              "group touch-target transition-all duration-300 relative overflow-hidden",
              "hover:bg-gradient-to-r hover:from-primary/15 hover:to-accent/15 hover:text-primary hover:shadow-md",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "rounded-xl border border-border/30",
              isMobile ? "mx-2 px-4 py-3" : "mx-3 px-6 py-3"
            )}
            aria-label="Create new terminal tab"
            title="Create new terminal tab"
          >
            <div className="relative z-10 flex items-center">
              <Plus className={cn(
                "transition-all duration-300 group-hover:rotate-90 group-hover:scale-110",
                isMobile ? "h-5 w-5" : "h-4 w-4"
              )} />
              {!isMobile && <span className="ml-2 font-semibold tracking-wide">New Tab</span>}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Button>
        </div>
      </div>

      {/* Enhanced Terminal Content Area with Modern Design */}
      <CardContent
        ref={terminalContentRef}
        className={cn(
          "p-0 flex-1 min-h-0 relative overflow-hidden",
          "bg-gradient-to-br from-terminal-background via-terminal-background/98 to-terminal-background/95",
          "border-t border-border/20"
        )}
      >
        {/* Subtle background pattern for depth */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-accent/6 via-transparent to-transparent"></div>
        </div>

        {activeSession ? (
          <div
            className="relative z-10 h-full"
            role="tabpanel"
            id={`terminal-panel-${activeSession.id}`}
            aria-labelledby={`tab-${activeSession.id}`}
          >
            <Terminal
              key={activeSession.id}
              sessionId={activeSession.id}
              className="h-full"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground relative z-10">
            <div className="text-center space-y-6 p-8 max-w-lg mx-auto glass-subtle rounded-2xl border border-border/30 shadow-lg">
              <div className="relative group cursor-pointer" onClick={handleNewTab}>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-all duration-500 animate-pulse-soft"></div>
                <div className="relative p-6 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 backdrop-blur-sm border border-border/30 group-hover:border-primary/30 transition-all duration-300 group-hover:scale-105">
                  <Plus className="h-16 w-16 mx-auto opacity-60 transition-all duration-300 group-hover:opacity-80 group-hover:rotate-90 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">No Terminal Sessions</h3>
                <p className="text-base text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
                  Click the + button above or in the tab bar to create your first terminal session and start connecting to your servers.
                </p>
                <div className="pt-2">
                  <Button
                    onClick={handleNewTab}
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Create Terminal Session
                  </Button>
                </div>
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
