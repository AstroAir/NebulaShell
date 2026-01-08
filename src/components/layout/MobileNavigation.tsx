'use client';

import React, { memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContainerQuery } from '@/hooks/use-container-query';
import { ConnectionProfiles } from '@/components/connection/ConnectionProfiles';
import { SSHConnectionForm } from '@/components/ssh/SSHConnectionForm';
import { FileBrowser } from '@/components/file-transfer/FileBrowser';
import { TransferProgress } from '@/components/file-transfer/TransferProgress';
import { SessionManager } from '@/components/session/SessionManager';
import { useResponsiveLayout } from './ResponsiveLayoutProvider';
import {
  Bookmark,
  Settings,
  FolderOpen,
  Activity,
} from 'lucide-react';

import { cn } from '@/lib/utils';
interface MobileNavigationProps {
  activeTransfers?: any[];
}

export const MobileNavigation = memo(function MobileNavigation({ activeTransfers = [] }: MobileNavigationProps) {
  const { closeMobileOverlays } = useResponsiveLayout();
  const [containerRef, containerState] = useContainerQuery<HTMLDivElement>();

  // Close mobile menu when user interacts with content
  const handleInteraction = () => {
    // Small delay to allow the interaction to complete
    setTimeout(() => {
      closeMobileOverlays();
    }, 100);
  };

  // Responsive tab layout based on container size
  const tabCols = containerState.isMd ? 4 : containerState.isSm ? 2 : 4;

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full flex flex-col container-query",
        "bg-gradient-to-b from-card/96 via-background/99 to-background/96",
        "backdrop-blur-md border-t border-border/30"
      )}
      onClick={handleInteraction}
    >
      <Tabs defaultValue="profiles" className="flex-1 flex flex-col">
        <TabsList className={cn(
          `grid w-full grid-cols-${tabCols}`,
          "mx-4 mt-6 mb-2 p-2",
          "bg-gradient-to-r from-muted/40 via-muted/60 to-muted/40",
          "backdrop-blur-md border border-border/30",
          "shadow-lg rounded-2xl"
        )}>
          <TabsTrigger value="profiles" className={cn(
            "group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl",
            "transition-all duration-300 min-h-[60px] min-w-[60px]",
            "hover:bg-accent/80 hover:scale-105 hover:shadow-sm",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
            "data-[state=active]:shadow-md data-[state=active]:scale-105"
          )}>
            <Bookmark className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xs font-semibold tracking-wide">Profiles</span>
          </TabsTrigger>
          <TabsTrigger value="connect" className={cn(
            "group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl",
            "transition-all duration-300 min-h-[60px] min-w-[60px]",
            "hover:bg-accent/80 hover:scale-105 hover:shadow-sm",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
            "data-[state=active]:shadow-md data-[state=active]:scale-105"
          )}>
            <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            <span className="text-xs font-semibold tracking-wide">Connect</span>
          </TabsTrigger>
          <TabsTrigger value="files" data-testid="files-tab" className={cn(
            "group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl",
            "transition-all duration-300 min-h-[60px] min-w-[60px]",
            "hover:bg-accent/80 hover:scale-105 hover:shadow-sm",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
            "data-[state=active]:shadow-md data-[state=active]:scale-105"
          )}>
            <FolderOpen className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xs font-semibold tracking-wide">Files</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className={cn(
            "group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl",
            "transition-all duration-300 min-h-[60px] min-w-[60px]",
            "hover:bg-accent/80 hover:scale-105 hover:shadow-sm",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
            "data-[state=active]:shadow-md data-[state=active]:scale-105"
          )}>
            <Activity className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xs font-semibold tracking-wide">Sessions</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 touch-scroll-smooth">
          <TabsContent value="profiles" className="mt-6 px-6 pb-8 content-spacing">
            <div className="glass-card rounded-2xl p-4 shadow-lg">
              <ConnectionProfiles />
            </div>
          </TabsContent>

          <TabsContent value="connect" className="mt-6 px-6 pb-8 content-spacing">
            <div className="glass-card rounded-2xl p-4 shadow-lg">
              <SSHConnectionForm />
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-6 px-6 pb-8 content-spacing space-y-6">
            <div className="glass-card rounded-2xl p-4 shadow-lg">
              <FileBrowser />
            </div>
            {activeTransfers.length > 0 && (
              <div className="glass-subtle rounded-xl p-4 border border-border/40 shadow-md">
                <h3 className="text-sm font-semibold mb-3 text-foreground/80">File Transfers</h3>
                <TransferProgress transfers={activeTransfers} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-6 px-6 pb-8 content-spacing">
            <div className="glass-card rounded-2xl p-4 shadow-lg">
              <SessionManager />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
});
