'use client';

import React, { useState } from 'react';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { TabbedTerminal } from '@/components/terminal/TabbedTerminal';
import { SSHConnectionForm } from '@/components/ssh/SSHConnectionForm';
import { ConnectionStatus } from '@/components/ssh/ConnectionStatus';
import { SessionManager } from '@/components/session/SessionManager';
import { ConnectionProfiles } from '@/components/connection/ConnectionProfiles';
import { FileBrowser } from '@/components/file-transfer/FileBrowser';
import { TransferProgress } from '@/components/file-transfer/TransferProgress';
import { TerminalSettingsPanel } from '@/components/settings/TerminalSettingsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Monitor,
  Settings,
  Activity,
  Bookmark,
  FolderOpen,
  Upload,
  Palette,
  Maximize2,
  Minimize2
} from 'lucide-react';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTransfers, setActiveTransfers] = useState([]);

  return (
    <TerminalProvider>
      <div className={`min-h-screen bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-6 w-6" />
                <h1 className="text-2xl font-bold">WebSSH Terminal</h1>
              </div>
              <div className="flex items-center gap-4">
                <ConnectionStatus />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-b bg-muted/30">
            <div className="container mx-auto px-4 py-4">
              <TerminalSettingsPanel onClose={() => setShowSettings(false)} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <div className={`grid gap-6 ${isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-120px)]'} ${isFullscreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`}>
            {/* Left Sidebar - Connection and File Management */}
            {!isFullscreen && (
              <div className="lg:col-span-1 space-y-6">
                <Tabs defaultValue="profiles" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="profiles" className="flex items-center gap-1">
                      <Bookmark className="h-4 w-4" />
                      Profiles
                    </TabsTrigger>
                    <TabsTrigger value="connect" className="flex items-center gap-1">
                      <Settings className="h-4 w-4" />
                      Connect
                    </TabsTrigger>
                    <TabsTrigger value="files" className="flex items-center gap-1">
                      <FolderOpen className="h-4 w-4" />
                      Files
                    </TabsTrigger>
                    <TabsTrigger value="sessions" className="flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Sessions
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
            )}

            {/* Right Side - Terminal */}
            <div className={isFullscreen ? 'col-span-1' : 'lg:col-span-3'}>
              <TabbedTerminal className="h-full" />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t bg-card mt-auto">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>WebSSH Terminal - Secure SSH connections in your browser</p>
              <p>Built with Next.js and shadcn/ui</p>
            </div>
          </div>
        </footer>
      </div>
    </TerminalProvider>
  );
}
