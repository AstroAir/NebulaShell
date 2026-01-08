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
  FolderOpen,
} from 'lucide-react';

interface ResponsiveHeaderProps {
  onToggleSettings: () => void;
  onToggleLayoutSettings?: () => void;
  onOpenFileTransfer?: () => void;
  mobileMenuContent?: React.ReactNode;
}

export function ResponsiveHeader({
  onToggleSettings,
  onToggleLayoutSettings,
  onOpenFileTransfer,
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
    <header className={cn(
      "border-b border-border/40 sticky top-0 z-40",
      "bg-gradient-to-r from-card/96 via-card/99 to-card/96",
      "backdrop-blur-md shadow-lg transition-all duration-300",
      "supports-[backdrop-filter]:bg-card/80"
    )}>
      <div className="container mx-auto component-spacing">
        <div className="flex items-center justify-between min-h-[3.5rem]">
          {/* Left side - Logo and mobile menu with improved spacing */}
          <div className="flex items-center flex-gap-responsive-lg min-w-0 flex-1 lg:flex-none">
            {/* Mobile menu button */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="touch-target lg:hidden"
                    aria-label="Open menu"
                    data-testid="mobile-menu-button"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between component-spacing border-b">
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

            {/* Enhanced Logo with improved visual hierarchy */}
            <div className="flex items-center flex-gap-responsive-lg min-w-0">
              <div className="relative group">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  "bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10",
                  "shadow-lg group-hover:shadow-xl",
                  "border border-primary/20 group-hover:border-primary/30",
                  "group-hover:scale-105"
                )}>
                  <Monitor className={cn(
                    "text-primary transition-all duration-300",
                    "group-hover:text-primary/90",
                    isMobile ? "h-5 w-5" : "h-6 w-6 lg:h-7 lg:w-7"
                  )} />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="flex flex-col min-w-0">
                <h1
                  className={cn(
                    'font-bold tracking-tight transition-all duration-300',
                    'bg-gradient-to-r from-foreground via-foreground/95 to-foreground/85 bg-clip-text text-transparent',
                    'hover:from-primary hover:via-primary/90 hover:to-primary/80',
                    isMobile ? 'text-lg leading-5' : 'text-xl lg:text-2xl leading-6 lg:leading-7'
                  )}
                >
                  <span className="truncate">WebTerminal Pro</span>
                </h1>
                {!isMobile && (
                  <p className="text-xs text-muted-foreground font-medium tracking-wide transition-colors duration-300 hover:text-muted-foreground/80">
                    Professional SSH Terminal
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Enhanced Actions with improved spacing */}
          <div className="flex items-center flex-gap-responsive min-w-0">
            {/* Enhanced Connection status with better visual design */}
            <div className="hidden sm:block">
              <div className={cn(
                "px-4 py-3 rounded-xl transition-all duration-300",
                "bg-gradient-to-r from-muted/30 via-muted/40 to-muted/30",
                "border border-border/30 hover:border-border/50",
                "shadow-sm hover:shadow-md",
                "backdrop-blur-sm"
              )}>
                <ConnectionStatus />
              </div>
            </div>

            {/* Enhanced Layout settings button - Desktop only */}
            {isDesktop && onToggleLayoutSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleLayoutSettings}
                className={cn(
                  "group relative overflow-hidden rounded-xl transition-all duration-300",
                  "hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/10",
                  "hover:shadow-md hover:scale-105",
                  "border border-border/20 hover:border-border/40",
                  "px-3 py-2.5"
                )}
                aria-label="Toggle layout settings"
              >
                <div className="relative z-10 flex items-center">
                  <Layout className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                  <span className="ml-2 hidden xl:inline font-medium">Layout</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Button>
            )}

            {/* Enhanced Settings button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSettings}
              className={cn(
                "group relative overflow-hidden rounded-xl transition-all duration-300",
                "hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/20",
                "hover:shadow-md hover:scale-105",
                "border border-border/20 hover:border-border/40",
                "px-3 py-2.5"
              )}
              aria-label="Toggle settings"
              data-testid="settings-button"
            >
              <div className="relative z-10 flex items-center">
                <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                {isDesktop && <span className="ml-2 hidden xl:inline font-medium">Settings</span>}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Button>

            {/* File transfer button */}
            {onOpenFileTransfer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenFileTransfer}
                className={cn(
                  "group relative overflow-hidden rounded-xl transition-all duration-300",
                  "hover:bg-gradient-to-r hover:from-accent/20 hover:to-accent/10",
                  "hover:shadow-md hover:scale-105",
                  "border border-border/20 hover:border-border/40",
                  "px-3 py-2.5"
                )}
                aria-label="Open file transfer"
                data-testid="file-transfer-button"
              >
                <div className="relative z-10 flex items-center">
                  <FolderOpen className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  {isDesktop && <span className="ml-2 hidden xl:inline font-medium">Files</span>}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Button>
            )}

            {/* Enhanced Fullscreen toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={cn(
                "group relative overflow-hidden rounded-xl transition-all duration-300",
                "hover:bg-gradient-to-r hover:from-primary/20 hover:to-primary/10",
                "hover:shadow-lg hover:scale-105",
                "border border-border/20 hover:border-primary/30",
                "px-3 py-2.5",
                isFullscreen && "bg-primary/10 border-primary/20"
              )}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <div className="relative z-10 flex items-center">
                <div className="transition-transform duration-300 group-hover:scale-110">
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </div>
                {isDesktop && (
                  <span className="ml-2 hidden xl:inline font-medium">
                    {isFullscreen ? 'Exit' : 'Fullscreen'}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/15 to-primary/8 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Button>
          </div>
        </div>

        {/* Enhanced Mobile connection status bar */}
        {isMobile && (
          <div className="mt-3 pt-3 border-t border-border/50 sm:hidden">
            <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
              <ConnectionStatus />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
