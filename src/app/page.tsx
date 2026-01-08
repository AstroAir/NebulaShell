'use client';

import React, { useState, Suspense, lazy } from 'react';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { TabbedTerminal } from '@/components/terminal/TabbedTerminal';
import { ResponsiveLayoutProvider } from '@/components/layout/ResponsiveLayoutProvider';
import { ResponsiveHeader } from '@/components/layout/ResponsiveHeader';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { AccessibilityProvider } from '@/components/accessibility/AccessibilityProvider';
import { SkipLinks, useSkipLinkTargets } from '@/components/accessibility/SkipLinks';

// Lazy load heavy components for better performance
const SSHConnectionForm = lazy(() => import('@/components/ssh/SSHConnectionForm').then(m => ({ default: m.SSHConnectionForm })));
const SessionManager = lazy(() => import('@/components/session/SessionManager').then(m => ({ default: m.SessionManager })));
const ConnectionProfiles = lazy(() => import('@/components/connection/ConnectionProfiles').then(m => ({ default: m.ConnectionProfiles })));
const FileBrowser = lazy(() => import('@/components/file-transfer/FileBrowser').then(m => ({ default: m.FileBrowser })));
const TransferProgress = lazy(() => import('@/components/file-transfer/TransferProgress').then(m => ({ default: m.TransferProgress })));
const TerminalSettingsPanel = lazy(() => import('@/components/settings/TerminalSettingsPanel').then(m => ({ default: m.TerminalSettingsPanel })));
const LayoutSettings = lazy(() => import('@/components/layout/LayoutSettings').then(m => ({ default: m.LayoutSettings })));
const KeyboardShortcutsHelp = lazy(() => import('@/components/keyboard/KeyboardShortcutsHelp').then(m => ({ default: m.KeyboardShortcutsHelp })));

// Loading fallback component
const LoadingFallback = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center justify-center p-8 ${className}`}>
    <div className="flex items-center gap-3">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  </div>
);
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
import { useLayoutPreferences } from '@/components/layout/LayoutSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Bookmark,
  FolderOpen,
  Settings,
} from 'lucide-react';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showFileTransfer, setShowFileTransfer] = useState(false);
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
          {/* Enhanced Header with improved backdrop and shadow */}
          <div className="sticky top-0 z-40 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 bg-background/95 border-b border-border/60 shadow-sm">
            <ResponsiveHeader
              onToggleSettings={() => setShowSettings(!showSettings)}
              onToggleLayoutSettings={() => setShowLayoutSettings(!showLayoutSettings)}
              onOpenFileTransfer={() => setShowFileTransfer(true)}
              mobileMenuContent={<MobileNavigation activeTransfers={activeTransfers} />}
            />
          </div>

          {/* Enhanced Settings Panel with better spacing and animation */}
          {showSettings && (
            <div className="border-b border-border/40 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 animate-slide-down backdrop-blur-sm">
              <div className="container mx-auto px-4 py-6 lg:py-8">
                <div className="glass-morphism rounded-2xl p-4 lg:p-6 shadow-lg">
                  <Suspense fallback={<LoadingFallback />}>
                    <TerminalSettingsPanel onClose={() => setShowSettings(false)} />
                  </Suspense>
                </div>
              </div>
            </div>
          )}

          {/* File Transfer Overlay */}
          {showFileTransfer && (
            <div className="border-b border-border/40 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 animate-slide-down backdrop-blur-sm">
              <div className="container mx-auto px-4 py-6 lg:py-8">
                <div className="glass-morphism rounded-2xl p-4 lg:p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">File Transfer</h2>
                    <button type="button" className="text-sm underline" onClick={() => setShowFileTransfer(false)} aria-label="Close file transfer overlay">Close</button>
                  </div>
                  <Suspense fallback={<LoadingFallback />}>
                    <FileBrowser />
                  </Suspense>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Layout Settings Panel with improved design */}
          {showLayoutSettings && (
            <div className="border-b border-border/40 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 animate-slide-down backdrop-blur-sm">
              <div className="container mx-auto px-4 py-6 lg:py-8">
                <div className="glass-morphism rounded-2xl p-4 lg:p-6 shadow-lg">
                  <Suspense fallback={<LoadingFallback />}>
                    <LayoutSettings onClose={() => setShowLayoutSettings(false)} />
                  </Suspense>
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
                  <div id="sidebar" className="h-full component-spacing" role="complementary" aria-label="Navigation and tools">
                    <div className={cn(
                      "glass-subtle rounded-2xl h-full shadow-md hover:shadow-lg transition-all duration-300",
                      "border border-border/20 hover:border-border/30",
                      "bg-gradient-to-br from-card/95 via-card/98 to-card/95",
                      "component-spacing"
                    )}>
                    <Tabs defaultValue="profiles" className="w-full h-full flex flex-col">
                      <TabsList className={cn(
                        "grid w-full grid-cols-2 lg:grid-cols-4 mb-6 p-2",
                        "bg-gradient-to-r from-muted/30 via-muted/40 to-muted/30",
                        "backdrop-blur-sm border border-border/20",
                        "rounded-xl shadow-sm"
                      )}>
                        <TabsTrigger value="profiles" className={cn(
                          "flex items-center gap-2 py-3 px-4 rounded-lg transition-all duration-300",
                          "text-xs lg:text-sm font-medium",
                          "hover:bg-accent/60 hover:shadow-sm hover:scale-[1.02]",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                          "data-[state=active]:shadow-md"
                        )}>
                          <Bookmark className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                          <span className="hidden sm:inline">Profiles</span>
                        </TabsTrigger>
                        <TabsTrigger value="connect" className={cn(
                          "flex items-center gap-2 py-3 px-4 rounded-lg transition-all duration-300",
                          "text-xs lg:text-sm font-medium",
                          "hover:bg-accent/60 hover:shadow-sm hover:scale-[1.02]",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                          "data-[state=active]:shadow-md"
                        )}>
                          <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                          <span className="hidden sm:inline">Connect</span>
                        </TabsTrigger>
                        <TabsTrigger value="files" data-testid="files-tab" className={cn(
                          "flex items-center gap-2 py-3 px-4 rounded-lg transition-all duration-300",
                          "text-xs lg:text-sm font-medium",
                          "hover:bg-accent/60 hover:shadow-sm hover:scale-[1.02]",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                          "data-[state=active]:shadow-md"
                        )}>
                          <FolderOpen className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                          <span className="hidden sm:inline">Files</span>
                        </TabsTrigger>
                        <TabsTrigger value="sessions" className={cn(
                          "flex items-center gap-2 py-3 px-4 rounded-lg transition-all duration-300",
                          "text-xs lg:text-sm font-medium",
                          "hover:bg-accent/60 hover:shadow-sm hover:scale-[1.02]",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                          "data-[state=active]:shadow-md"
                        )}>
                          <Activity className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                          <span className="hidden sm:inline">Sessions</span>
                        </TabsTrigger>
                      </TabsList>

                      <div className="flex-1 overflow-hidden">
                        <TabsContent value="profiles" className="h-full mt-0 p-1">
                          <div className="h-full overflow-y-auto touch-scroll-smooth">
                            <Suspense fallback={<LoadingFallback />}>
                              <ConnectionProfiles />
                            </Suspense>
                          </div>
                        </TabsContent>

                        <TabsContent value="connect" className="h-full mt-0 p-1">
                          <div className="h-full overflow-y-auto touch-scroll-smooth">
                            <Suspense fallback={<LoadingFallback />}>
                              <SSHConnectionForm />
                            </Suspense>
                          </div>
                        </TabsContent>

                        <TabsContent value="files" className="h-full mt-0 p-1 space-y-4">
                          <div className="h-full overflow-y-auto touch-scroll-smooth space-y-4">
                            <Suspense fallback={<LoadingFallback />}>
                              <FileBrowser />
                            </Suspense>
                            {activeTransfers.length > 0 && (
                              <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                <Suspense fallback={<LoadingFallback className="p-2" />}>
                                  <TransferProgress transfers={activeTransfers} />
                                </Suspense>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="sessions" className="h-full mt-0 p-1">
                          <div className="h-full overflow-y-auto touch-scroll-smooth">
                            <Suspense fallback={<LoadingFallback />}>
                              <SessionManager />
                            </Suspense>
                          </div>
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
                      <div id="terminal" role="region" aria-label="Terminal interface" className="h-full min-h-0 flex flex-col component-spacing">
                        <div className={cn(
                          "glass-subtle rounded-2xl h-full min-h-0 flex flex-col transition-all duration-300",
                          "shadow-lg hover:shadow-xl",
                          "border border-border/20 hover:border-border/30",
                          "bg-gradient-to-br from-card/95 via-card/98 to-card/95",
                          "overflow-hidden"
                        )}>
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
                      <div className="h-full p-3 lg:p-4 xl:p-6">
                        <div className="h-full glass-subtle rounded-2xl flex items-center justify-center border border-border/30 shadow-md">
                          <div className="text-center space-y-2">
                            <p className="text-muted-foreground text-responsive-lg font-medium">Console Output</p>
                            <p className="text-muted-foreground/70 text-responsive-sm">Logs, output, and debug information will appear here</p>
                          </div>
                        </div>
                      </div>
                    }
                  />
                }
              />
            ) : (
              <ResponsiveGrid>
                {/* Desktop Sidebar - Connection and File Management */}
                <ResponsiveSidebar className="component-spacing">
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
                      <TabsTrigger value="files" data-testid="files-tab" className="flex items-center gap-1 text-xs lg:text-sm">
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
                <ResponsiveContent className="component-spacing">
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

          {/* Enhanced Footer with improved design */}
          <ResponsiveFooter>
            <div className="container mx-auto component-spacing">
              <div className="glass-subtle rounded-xl flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm text-muted-foreground gap-4 component-spacing border border-border/30 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-soft"></div>
                  <p className="text-responsive-sm font-medium">WebTerminal Pro - Professional SSH Terminal</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground/70">v1.0.0</span>
                  <span className="text-muted-foreground/70">•</span>
                  <span className="text-muted-foreground/70">Built with Next.js & Tauri</span>
                </div>
              </div>
            </div>
          </ResponsiveFooter>
        </ResponsiveLayout>

        {/* Keyboard Shortcuts Help Dialog */}
        <Suspense fallback={null}>
          <KeyboardShortcutsHelp
            open={showKeyboardHelp}
            onOpenChange={setShowKeyboardHelp}
          />
        </Suspense>
      </ResponsiveLayoutProvider>
    </TerminalProvider>
    </AccessibilityProvider>
  );
}
