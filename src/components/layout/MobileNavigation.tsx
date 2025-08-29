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
  const [containerRef, containerState] = useContainerQuery();

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
      className="h-full flex flex-col container-query"
      onClick={handleInteraction}
    >
      <Tabs defaultValue="profiles" className="flex-1 flex flex-col">
        <TabsList className={`grid w-full grid-cols-${tabCols} mx-4 mt-4`}>
          <TabsTrigger value="profiles" className="flex flex-col items-center gap-1 py-3">
            <Bookmark className="h-4 w-4" />
            <span className="text-xs">Profiles</span>
          </TabsTrigger>
          <TabsTrigger value="connect" className="flex flex-col items-center gap-1 py-3">
            <Settings className="h-4 w-4" />
            <span className="text-xs">Connect</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="flex flex-col items-center gap-1 py-3">
            <FolderOpen className="h-4 w-4" />
            <span className="text-xs">Files</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex flex-col items-center gap-1 py-3">
            <Activity className="h-4 w-4" />
            <span className="text-xs">Sessions</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="profiles" className="mt-4 px-4 pb-4">
            <ConnectionProfiles />
          </TabsContent>

          <TabsContent value="connect" className="mt-4 px-4 pb-4">
            <SSHConnectionForm />
          </TabsContent>

          <TabsContent value="files" className="mt-4 px-4 pb-4 space-y-4">
            <FileBrowser />
            {activeTransfers.length > 0 && (
              <TransferProgress transfers={activeTransfers} />
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-4 px-4 pb-4">
            <SessionManager />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
});
