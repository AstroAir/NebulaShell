'use client';

import React, { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/use-responsive';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResizableLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  className?: string;
  defaultSidebarSize?: number;
  minSidebarSize?: number;
  maxSidebarSize?: number;
  collapsible?: boolean;
  persistLayout?: boolean;
}

interface LayoutState {
  sidebarSize: number;
  isCollapsed: boolean;
  isMaximized: boolean;
}

const STORAGE_KEY = 'resizable-layout-state';
const DEFAULT_SIDEBAR_SIZE = 25; // 25% of screen width
const MIN_SIDEBAR_SIZE = 15;
const MAX_SIDEBAR_SIZE = 50;

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  sidebar,
  main,
  className,
  defaultSidebarSize = DEFAULT_SIDEBAR_SIZE,
  minSidebarSize = MIN_SIDEBAR_SIZE,
  maxSidebarSize = MAX_SIDEBAR_SIZE,
  collapsible = true,
  persistLayout = true,
}) => {
  const { isMobile, isTablet } = useResponsive();
  
  const [layoutState, setLayoutState] = useState<LayoutState>({
    sidebarSize: defaultSidebarSize,
    isCollapsed: false,
    isMaximized: false,
  });

  // Load saved layout state on mount
  useEffect(() => {
    if (persistLayout && typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setLayoutState(prev => ({
            ...prev,
            ...parsedState,
            // Ensure values are within bounds
            sidebarSize: Math.max(minSidebarSize, Math.min(maxSidebarSize, parsedState.sidebarSize || defaultSidebarSize))
          }));
        } catch (error) {
          console.warn('Failed to parse saved layout state:', error);
        }
      }
    }
  }, [persistLayout, defaultSidebarSize, minSidebarSize, maxSidebarSize]);

  // Save layout state when it changes
  useEffect(() => {
    if (persistLayout && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutState));
    }
  }, [layoutState, persistLayout]);

  const handleSidebarResize = (sizes: number[]) => {
    const newSize = sizes[0];
    setLayoutState(prev => ({
      ...prev,
      sidebarSize: newSize,
      isCollapsed: newSize < minSidebarSize + 2, // Auto-collapse when very small
    }));
  };

  const toggleSidebar = () => {
    setLayoutState(prev => ({
      ...prev,
      isCollapsed: !prev.isCollapsed,
    }));
  };

  const resetLayout = () => {
    setLayoutState({
      sidebarSize: defaultSidebarSize,
      isCollapsed: false,
      isMaximized: false,
    });
  };

  const toggleMaximize = () => {
    setLayoutState(prev => ({
      ...prev,
      isMaximized: !prev.isMaximized,
    }));
  };

  // Use mobile layout for mobile and tablet devices
  if (isMobile || isTablet) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {main}
      </div>
    );
  }

  // Desktop resizable layout
  const sidebarSize = layoutState.isCollapsed ? 0 : layoutState.sidebarSize;
  const mainSize = layoutState.isMaximized ? 100 : (100 - sidebarSize);

  return (
    <div className={cn("h-full relative", className)}>
      {/* Layout Controls */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-1">
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border"
            title={layoutState.isCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {layoutState.isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMaximize}
          className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border"
          title={layoutState.isMaximized ? "Restore layout" : "Maximize terminal"}
        >
          {layoutState.isMaximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetLayout}
          className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border"
          title="Reset layout"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <ResizablePanelGroup
        direction="horizontal"
        onLayout={handleSidebarResize}
        className="h-full"
      >
        {/* Sidebar Panel */}
        {!layoutState.isMaximized && (
          <>
            <ResizablePanel
              defaultSize={sidebarSize}
              minSize={layoutState.isCollapsed ? 0 : minSidebarSize}
              maxSize={maxSidebarSize}
              collapsible={collapsible}
              className={cn(
                "transition-all duration-200",
                layoutState.isCollapsed && "min-w-0 overflow-hidden"
              )}
            >
              <div className={cn(
                "h-full transition-opacity duration-200",
                layoutState.isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              )}>
                {sidebar}
              </div>
            </ResizablePanel>

            {/* Resize Handle */}
            <ResizableHandle 
              withHandle 
              className={cn(
                "transition-opacity duration-200 hover:bg-accent",
                layoutState.isCollapsed && "opacity-50"
              )}
            />
          </>
        )}

        {/* Main Content Panel */}
        <ResizablePanel
          defaultSize={mainSize}
          minSize={layoutState.isMaximized ? 100 : 50}
          className="relative"
        >
          <div className="h-full">
            {main}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Collapsed Sidebar Indicator */}
      {layoutState.isCollapsed && !layoutState.isMaximized && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-40">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-12 w-6 rounded-r-md rounded-l-none bg-background/80 backdrop-blur-sm border border-l-0 hover:w-8 transition-all duration-200"
            title="Show sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Hook for accessing layout state
export const useResizableLayout = () => {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    sidebarSize: DEFAULT_SIDEBAR_SIZE,
    isCollapsed: false,
    isMaximized: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setLayoutState(prev => ({ ...prev, ...parsedState }));
        } catch (error) {
          console.warn('Failed to parse saved layout state:', error);
        }
      }
    }
  }, []);

  return layoutState;
};

export default ResizableLayout;
