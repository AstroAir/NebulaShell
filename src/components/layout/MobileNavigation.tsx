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
      className="h-full flex flex-col container-query bg-gradient-to-b from-background to-background/95"
      onClick={handleInteraction}
    >
      <Tabs defaultValue="profiles" className="flex-1 flex flex-col">
        <TabsList className={`grid w-full grid-cols-${tabCols} mx-4 mt-4 bg-muted/50 backdrop-blur-sm`}>
          <TabsTrigger value="profiles" className="flex flex-col items-center gap-1 py-3 touch-target transition-all duration-200 hover:bg-accent/80">
            <Bookmark className="h-4 w-4" />
            <span className="text-xs font-medium">Profiles</span>
          </TabsTrigger>
          <TabsTrigger value="connect" className="flex flex-col items-center gap-1 py-3 touch-target transition-all duration-200 hover:bg-accent/80">
            <Settings className="h-4 w-4" />
            <span className="text-xs font-medium">Connect</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="flex flex-col items-center gap-1 py-3 touch-target transition-all duration-200 hover:bg-accent/80">
            <FolderOpen className="h-4 w-4" />
            <span className="text-xs font-medium">Files</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex flex-col items-center gap-1 py-3 touch-target transition-all duration-200 hover:bg-accent/80">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">Sessions</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 touch-scroll-smooth">
          <TabsContent value="profiles" className="mt-4 px-4 pb-6 content-spacing">
            <ConnectionProfiles />
          </TabsContent>

          <TabsContent value="connect" className="mt-4 px-4 pb-6 content-spacing">
            <SSHConnectionForm />
          </TabsContent>

          <TabsContent value="files" className="mt-4 px-4 pb-6 content-spacing space-y-4">
            <FileBrowser />
            {activeTransfers.length > 0 && (
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <TransferProgress transfers={activeTransfers} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-4 px-4 pb-6 content-spacing">
            <SessionManager />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
});
