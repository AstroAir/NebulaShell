'use client';

import React, { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/use-responsive';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { 
  PanelBottomClose, 
  PanelBottomOpen, 
  RotateCcw,
  SplitSquareHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerticalResizableLayoutProps {
  top: React.ReactNode;
  bottom?: React.ReactNode;
  className?: string;
  defaultBottomSize?: number;
  minBottomSize?: number;
  maxBottomSize?: number;
  collapsible?: boolean;
  persistLayout?: boolean;
  showBottomPanel?: boolean;
  onToggleBottomPanel?: (show: boolean) => void;
}

interface VerticalLayoutState {
  bottomSize: number;
  isBottomCollapsed: boolean;
  showBottomPanel: boolean;
}

const VERTICAL_STORAGE_KEY = 'vertical-resizable-layout-state';
const DEFAULT_BOTTOM_SIZE = 30; // 30% of screen height
const MIN_BOTTOM_SIZE = 20;
const MAX_BOTTOM_SIZE = 60;

export const VerticalResizableLayout: React.FC<VerticalResizableLayoutProps> = ({
  top,
  bottom,
  className,
  defaultBottomSize = DEFAULT_BOTTOM_SIZE,
  minBottomSize = MIN_BOTTOM_SIZE,
  maxBottomSize = MAX_BOTTOM_SIZE,
  collapsible = true,
  persistLayout = true,
  showBottomPanel = false,
  onToggleBottomPanel,
}) => {
  const { isMobile } = useResponsive();
  
  const [layoutState, setLayoutState] = useState<VerticalLayoutState>({
    bottomSize: defaultBottomSize,
    isBottomCollapsed: false,
    showBottomPanel: showBottomPanel,
  });

  // Load saved layout state on mount
  useEffect(() => {
    if (persistLayout && typeof window !== 'undefined') {
      const saved = localStorage.getItem(VERTICAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setLayoutState(prev => ({
            ...prev,
            ...parsedState,
            // Ensure values are within bounds
            bottomSize: Math.max(minBottomSize, Math.min(maxBottomSize, parsedState.bottomSize || defaultBottomSize)),
            showBottomPanel: showBottomPanel // Override with prop
          }));
        } catch (error) {
          console.warn('Failed to parse saved vertical layout state:', error);
        }
      }
    }
  }, [persistLayout, defaultBottomSize, minBottomSize, maxBottomSize, showBottomPanel]);

  // Save layout state when it changes
  useEffect(() => {
    if (persistLayout && typeof window !== 'undefined') {
      localStorage.setItem(VERTICAL_STORAGE_KEY, JSON.stringify(layoutState));
    }
  }, [layoutState, persistLayout]);

  // Sync with external showBottomPanel prop
  useEffect(() => {
    setLayoutState(prev => ({
      ...prev,
      showBottomPanel: showBottomPanel
    }));
  }, [showBottomPanel]);

  const handleBottomResize = (sizes: number[]) => {
    const newBottomSize = sizes[1];
    setLayoutState(prev => ({
      ...prev,
      bottomSize: newBottomSize,
      isBottomCollapsed: newBottomSize < minBottomSize + 2, // Auto-collapse when very small
    }));
  };

  const toggleBottomPanel = () => {
    const newShowState = !layoutState.showBottomPanel;
    setLayoutState(prev => ({
      ...prev,
      showBottomPanel: newShowState,
      isBottomCollapsed: false, // Reset collapse state when toggling
    }));
    onToggleBottomPanel?.(newShowState);
  };

  const toggleBottomCollapse = () => {
    setLayoutState(prev => ({
      ...prev,
      isBottomCollapsed: !prev.isBottomCollapsed,
    }));
  };

  const resetLayout = () => {
    setLayoutState(prev => ({
      ...prev,
      bottomSize: defaultBottomSize,
      isBottomCollapsed: false,
    }));
  };

  // Use simple layout for mobile devices
  if (isMobile) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {top}
        {layoutState.showBottomPanel && bottom && (
          <div className="border-t bg-background">
            {bottom}
          </div>
        )}
      </div>
    );
  }

  // Desktop vertical resizable layout
  const bottomSize = layoutState.isBottomCollapsed ? 0 : layoutState.bottomSize;
  const topSize = 100 - bottomSize;

  if (!layoutState.showBottomPanel || !bottom) {
    return (
      <div className={cn("h-full relative", className)}>
        {/* Layout Controls */}
        <div className="absolute bottom-2 right-2 z-50 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleBottomPanel}
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border"
            title="Show bottom panel"
          >
            <SplitSquareHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="h-full">
          {top}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full relative", className)}>
      {/* Layout Controls */}
      <div className="absolute bottom-2 right-2 z-50 flex items-center gap-1">
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleBottomCollapse}
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border"
            title={layoutState.isBottomCollapsed ? "Show bottom panel" : "Hide bottom panel"}
          >
            {layoutState.isBottomCollapsed ? (
              <PanelBottomOpen className="h-4 w-4" />
            ) : (
              <PanelBottomClose className="h-4 w-4" />
            )}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleBottomPanel}
          className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border"
          title="Close bottom panel"
        >
          <SplitSquareHorizontal className="h-4 w-4" />
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
        direction="vertical"
        onLayout={handleBottomResize}
        className="h-full"
      >
        {/* Top Panel */}
        <ResizablePanel
          defaultSize={topSize}
          minSize={40}
          className="relative"
        >
          <div className="h-full">
            {top}
          </div>
        </ResizablePanel>

        {/* Resize Handle */}
        <ResizableHandle 
          withHandle 
          className={cn(
            "transition-opacity duration-200 hover:bg-accent",
            layoutState.isBottomCollapsed && "opacity-50"
          )}
        />

        {/* Bottom Panel */}
        <ResizablePanel
          defaultSize={bottomSize}
          minSize={layoutState.isBottomCollapsed ? 0 : minBottomSize}
          maxSize={maxBottomSize}
          collapsible={collapsible}
          className={cn(
            "transition-all duration-200",
            layoutState.isBottomCollapsed && "min-h-0 overflow-hidden"
          )}
        >
          <div className={cn(
            "h-full transition-opacity duration-200 border-t bg-background",
            layoutState.isBottomCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            {bottom}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Collapsed Bottom Panel Indicator */}
      {layoutState.isBottomCollapsed && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleBottomCollapse}
            className="h-6 w-12 rounded-t-md rounded-b-none bg-background/80 backdrop-blur-sm border border-b-0 hover:h-8 transition-all duration-200"
            title="Show bottom panel"
          >
            <PanelBottomOpen className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Hook for accessing vertical layout state
export const useVerticalResizableLayout = () => {
  const [layoutState, setLayoutState] = useState<VerticalLayoutState>({
    bottomSize: DEFAULT_BOTTOM_SIZE,
    isBottomCollapsed: false,
    showBottomPanel: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VERTICAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setLayoutState(prev => ({ ...prev, ...parsedState }));
        } catch (error) {
          console.warn('Failed to parse saved vertical layout state:', error);
        }
      }
    }
  }, []);

  return layoutState;
};

export default VerticalResizableLayout;
