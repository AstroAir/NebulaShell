'use client';

import React, { useState } from 'react';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { TabbedTerminal } from '@/components/terminal/TabbedTerminal';
import { SSHConnectionForm } from '@/components/ssh/SSHConnectionForm';
import { SessionManager } from '@/components/session/SessionManager';
import { ConnectionProfiles } from '@/components/connection/ConnectionProfiles';
import { FileBrowser } from '@/components/file-transfer/FileBrowser';
import { TransferProgress } from '@/components/file-transfer/TransferProgress';
import { TerminalSettingsPanel } from '@/components/settings/TerminalSettingsPanel';
import { ResponsiveLayoutProvider } from '@/components/layout/ResponsiveLayoutProvider';
import { ResponsiveHeader } from '@/components/layout/ResponsiveHeader';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { AccessibilityProvider } from '@/components/accessibility/AccessibilityProvider';
import { SkipLinks, useSkipLinkTargets } from '@/components/accessibility/SkipLinks';
import {
  ResponsiveLayout,
  ResponsiveMain,
  ResponsiveGrid,
  ResponsiveSidebar,
  ResponsiveContent,
  ResponsiveFooter,
} from '@/components/layout/ResponsiveLayout';
import { ResizableLayout } from '@/components/layout/ResizableLayout';
import { VerticalResizableLayout } from '@/components/layout/VerticalResizableLayout';
import { LayoutSettings, useLayoutPreferences } from '@/components/layout/LayoutSettings';
import { KeyboardShortcutsHelp } from '@/components/keyboard/KeyboardShortcutsHelp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Bookmark,
  FolderOpen,
  Settings,
} from 'lucide-react';
import { useResponsive } from '@/hooks/use-responsive';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [activeTransfers] = useState([]);
  const { isDesktop } = useResponsive();
  const layoutPreferences = useLayoutPreferences();

  // Initialize skip link targets
  useSkipLinkTargets();

  return (
    <AccessibilityProvider>
      <TerminalProvider>
        <ResponsiveLayoutProvider>
          <SkipLinks />
          <ResponsiveLayout>
          {/* Header */}
          <div className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/80 border-b">
            <ResponsiveHeader
              onToggleSettings={() => setShowSettings(!showSettings)}
              onToggleLayoutSettings={() => setShowLayoutSettings(!showLayoutSettings)}
              mobileMenuContent={<MobileNavigation activeTransfers={activeTransfers} />}
            />
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="border-b bg-muted/30 animate-slide-down">
              <div className="container mx-auto px-4 py-4">
                <div className="glass-morphism rounded-xl p-2">
                  <TerminalSettingsPanel onClose={() => setShowSettings(false)} />
                </div>
              </div>
            </div>
          )}

          {/* Layout Settings Panel */}
          {showLayoutSettings && (
            <div className="border-b bg-muted/30 animate-slide-down">
              <div className="container mx-auto px-4 py-4">
                <div className="glass-morphism rounded-xl p-2">
                  <LayoutSettings onClose={() => setShowLayoutSettings(false)} />
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <ResponsiveMain>
            <main id="main-content" role="main" aria-label="Terminal application">
            {isDesktop && layoutPreferences.enableResizable ? (
              <ResizableLayout
                defaultSidebarSize={layoutPreferences.defaultSidebarSize}
                persistLayout={layoutPreferences.persistLayout}
                sidebar={
                  <div id="sidebar" className="h-full p-2 lg:p-3 xl:p-4" role="complementary" aria-label="Navigation and tools">
                    <div className="glass-subtle rounded-xl h-full">
                    <Tabs defaultValue="profiles" className="w-full h-full flex flex-col">
                      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-4">
                        <TabsTrigger value="profiles" className="flex items-center gap-1 text-xs lg:text-sm">
                          <Bookmark className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline">Profiles</span>
                        </TabsTrigger>
                        <TabsTrigger value="connect" className="flex items-center gap-1 text-xs lg:text-sm">
                          <Settings className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline">Connect</span>
                        </TabsTrigger>
                        <TabsTrigger value="files" className="flex items-center gap-1 text-xs lg:text-sm">
                          <FolderOpen className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline">Files</span>
                        </TabsTrigger>
                        <TabsTrigger value="sessions" className="flex items-center gap-1 text-xs lg:text-sm">
                          <Activity className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline">Sessions</span>
                        </TabsTrigger>
                      </TabsList>

                      <div className="flex-1 overflow-hidden">
                        <TabsContent value="profiles" className="h-full mt-0">
                          <ConnectionProfiles />
                        </TabsContent>

                        <TabsContent value="connect" className="h-full mt-0">
                          <SSHConnectionForm />
                        </TabsContent>

                        <TabsContent value="files" className="h-full mt-0 space-y-4">
                          <FileBrowser />
                          {activeTransfers.length > 0 && (
                            <TransferProgress transfers={activeTransfers} />
                          )}
                        </TabsContent>

                        <TabsContent value="sessions" className="h-full mt-0">
                          <SessionManager />
                        </TabsContent>
                      </div>
                    </Tabs>
                    </div>
                  </div>
                }
                main={
                  <VerticalResizableLayout
                    defaultBottomSize={layoutPreferences.defaultBottomSize}
                    persistLayout={layoutPreferences.persistLayout}
                    showBottomPanel={showBottomPanel}
                    onToggleBottomPanel={setShowBottomPanel}
                    top={
                      <div id="terminal" role="region" aria-label="Terminal interface" className="p-2 lg:p-3 xl:p-4">
                        <div className="glass-subtle rounded-xl h-full">
                          <TabbedTerminal
                            className="h-full"
                            onToggleHelp={() => setShowKeyboardHelp(true)}
                            onToggleSettings={() => setShowSettings(true)}
                            onToggleLayoutSettings={() => setShowLayoutSettings(true)}
                            onToggleFullscreen={() => {
                              if (document.fullscreenElement) {
                                document.exitFullscreen();
                              } else {
                                document.documentElement.requestFullscreen();
                              }
                            }}
                            onToggleSidebar={() => {
                              // This would be handled by the resizable layout
                              const event = new CustomEvent('toggle-sidebar');
                              document.dispatchEvent(event);
                            }}
                          />
                        </div>
                      </div>
                    }
                    bottom={
                      <div className="h-full p-2 lg:p-3 xl:p-4">
                        <div className="h-full glass-subtle rounded-xl flex items-center justify-center">
                          <p className="text-muted-foreground text-responsive-base">Bottom panel content (logs, output, etc.)</p>
                        </div>
                      </div>
                    }
                  />
                }
              />
            ) : (
              <ResponsiveGrid>
                {/* Desktop Sidebar - Connection and File Management */}
                <ResponsiveSidebar className="p-2 lg:p-3 xl:p-4">
                  <div className="glass-subtle rounded-xl">
                  <Tabs defaultValue="profiles" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                      <TabsTrigger value="profiles" className="flex items-center gap-1 text-xs lg:text-sm">
                        <Bookmark className="h-3 w-3 lg:h-4 lg:w-4" />
                        <span className="hidden sm:inline">Profiles</span>
                      </TabsTrigger>
                      <TabsTrigger value="connect" className="flex items-center gap-1 text-xs lg:text-sm">
                        <Settings className="h-3 w-3 lg:h-4 lg:w-4" />
                        <span className="hidden sm:inline">Connect</span>
                      </TabsTrigger>
                      <TabsTrigger value="files" className="flex items-center gap-1 text-xs lg:text-sm">
                        <FolderOpen className="h-3 w-3 lg:h-4 lg:w-4" />
                        <span className="hidden sm:inline">Files</span>
                      </TabsTrigger>
                      <TabsTrigger value="sessions" className="flex items-center gap-1 text-xs lg:text-sm">
                        <Activity className="h-3 w-3 lg:h-4 lg:w-4" />
                        <span className="hidden sm:inline">Sessions</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profiles" className="mt-4">
                      <ConnectionProfiles />
                    </TabsContent>

                    <TabsContent value="connect" className="mt-4">
                      <SSHConnectionForm />
                    </TabsContent>

                    <TabsContent value="files" className="mt-4 space-y-4">
                      <FileBrowser />
                      {activeTransfers.length > 0 && (
                        <TransferProgress transfers={activeTransfers} />
                      )}
                    </TabsContent>

                    <TabsContent value="sessions" className="mt-4">
                      <SessionManager />
                    </TabsContent>
                  </Tabs>
                  </div>
                </ResponsiveSidebar>

                {/* Terminal Content */}
                <ResponsiveContent className="p-2 lg:p-3 xl:p-4">
                  <div className="glass-subtle rounded-xl h-full">
                  <TabbedTerminal
                    className="h-full"
                    onToggleHelp={() => setShowKeyboardHelp(true)}
                    onToggleSettings={() => setShowSettings(true)}
                    onToggleLayoutSettings={() => setShowLayoutSettings(true)}
                    onToggleFullscreen={() => {
                      if (document.fullscreenElement) {
                        document.exitFullscreen();
                      } else {
                        document.documentElement.requestFullscreen();
                      }
                    }}
                    onToggleSidebar={() => {
                      // This would be handled by the responsive layout
                      const event = new CustomEvent('toggle-sidebar');
                      document.dispatchEvent(event);
                    }}
                  />
                  </div>
                </ResponsiveContent>
              </ResponsiveGrid>
            )}
            </main>
          </ResponsiveMain>

          {/* Footer */}
          <ResponsiveFooter>
            <div className="container mx-auto px-4 py-2">
              <div className="glass-subtle rounded-lg flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm text-muted-foreground gap-2 px-3 py-2">
                <p className="text-responsive-sm">WebSSH Terminal - Secure SSH connections in your browser</p>
                <p className="text-responsive-sm">Built with Next.js and shadcn/ui</p>
              </div>
            </div>
          </ResponsiveFooter>
        </ResponsiveLayout>

        {/* Keyboard Shortcuts Help Dialog */}
        <KeyboardShortcutsHelp
          open={showKeyboardHelp}
          onOpenChange={setShowKeyboardHelp}
        />
      </ResponsiveLayoutProvider>
    </TerminalProvider>
    </AccessibilityProvider>
  );
}
