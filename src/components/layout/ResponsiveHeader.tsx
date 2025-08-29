'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ConnectionStatus } from '@/components/ssh/ConnectionStatus';
import { useResponsiveLayout } from './ResponsiveLayoutProvider';
import { cn } from '@/lib/utils';
import {
  Monitor,
  Settings,
  Maximize2,
  Minimize2,
  Menu,
  // X - removed as not currently used
  Layout,
} from 'lucide-react';

interface ResponsiveHeaderProps {
  onToggleSettings: () => void;
  onToggleLayoutSettings?: () => void;
  mobileMenuContent?: React.ReactNode;
}

export function ResponsiveHeader({
  onToggleSettings,
  onToggleLayoutSettings,
  mobileMenuContent,
}: ResponsiveHeaderProps) {
  const {
    isMobile,
    isDesktop,
    isFullscreen,
    setIsFullscreen,
    mobileMenuOpen,
    setMobileMenuOpen,
    // toggleMobileMenu - removed as not currently used
    sidebarOpen,
    toggleSidebar,
  } = useResponsiveLayout();

  return (
    <header className="border-b bg-card sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and mobile menu */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="touch-target lg:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        <span className="font-semibold">WebSSH Terminal</span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {mobileMenuContent}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {/* Desktop sidebar toggle */}
            {isDesktop && !isFullscreen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="touch-target"
                aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}

            {/* Logo */}
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 lg:h-6 lg:w-6" />
              <h1 
                className={cn(
                  'font-bold text-responsive-lg',
                  isMobile ? 'text-lg' : 'text-xl lg:text-2xl'
                )}
              >
                {isMobile ? 'WebSSH' : 'WebSSH Terminal'}
              </h1>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Connection status - hide on very small screens */}
            <div className="hidden sm:block">
              <ConnectionStatus />
            </div>

            {/* Layout settings button - Desktop only */}
            {isDesktop && onToggleLayoutSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleLayoutSettings}
                className="touch-target"
                aria-label="Toggle layout settings"
              >
                <Layout className="h-4 w-4" />
                <span className="ml-2 hidden xl:inline">Layout</span>
              </Button>
            )}

            {/* Settings button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSettings}
              className="touch-target"
              aria-label="Toggle settings"
            >
              <Settings className="h-4 w-4" />
              {isDesktop && <span className="ml-2 hidden xl:inline">Settings</span>}
            </Button>

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="touch-target"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              {isDesktop && (
                <span className="ml-2 hidden xl:inline">
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile connection status bar */}
        {isMobile && (
          <div className="mt-2 pt-2 border-t sm:hidden">
            <ConnectionStatus />
          </div>
        )}
      </div>
    </header>
  );
}
