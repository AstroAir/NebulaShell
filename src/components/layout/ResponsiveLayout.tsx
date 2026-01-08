'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from './ResponsiveLayoutProvider';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveLayout({ children, className }: ResponsiveLayoutProps) {
  const { isFullscreen } = useResponsiveLayout();

  return (
    <div 
      className={cn(
        'min-h-screen flex flex-col bg-background transition-all duration-300',
        isFullscreen && 'fixed inset-0 z-50',
        className
      )}
    >
      {children}
    </div>
  );
}

interface ResponsiveHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveHeader({ children, className }: ResponsiveHeaderProps) {
  return (
    <header className={cn(
      'border-b bg-card/95 backdrop-blur-sm sticky top-0 z-40',
      'shadow-sm transition-all duration-200',
      className
    )}>
      <div className="container mx-auto px-4 py-3 lg:py-4">
        {children}
      </div>
    </header>
  );
}

interface ResponsiveMainProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveMain({ children, className }: ResponsiveMainProps) {
  const { isFullscreen } = useResponsiveLayout();

  return (
    <main
      className={cn(
        'flex-1 min-h-0 container mx-auto transition-all duration-300',
        isFullscreen ? 'px-0 py-0' : 'px-4 py-6 lg:px-6 lg:py-8',
        className
      )}
    >
      {children}
    </main>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveGrid({ children, className }: ResponsiveGridProps) {
  const { isFullscreen, isDesktop } = useResponsiveLayout();

  return (
    <div
      className={cn(
        'grid h-full min-h-0 transition-all duration-300',
        // Mobile: single column with standardized spacing
        'grid-cols-1 gap-4',
        // Desktop: sidebar + main content with enhanced spacing
        isDesktop && !isFullscreen && 'lg:grid-cols-[320px_1fr] lg:gap-6 xl:gap-8',
        // Fullscreen: single column
        isFullscreen && 'grid-cols-1 gap-0',
        // Height calculations with better viewport handling
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)]',
        className
      )}
    >
      {children}
    </div>
  );
}

interface ResponsiveSidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveSidebar({ children, className }: ResponsiveSidebarProps) {
  const { isDesktop, isFullscreen } = useResponsiveLayout();

  // Don't render sidebar in fullscreen mode
  if (isFullscreen) {
    return null;
  }

  return (
    <aside 
      className={cn(
        'space-y-6 transition-all duration-300',
        // Desktop: always visible
        isDesktop && 'block',
        // Mobile: controlled by state (will be handled by Sheet component)
        !isDesktop && 'hidden',
        className
      )}
    >
      {children}
    </aside>
  );
}

interface ResponsiveContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveContent({ children, className }: ResponsiveContentProps) {
  const { isFullscreen } = useResponsiveLayout();

  return (
    <div 
      className={cn(
        'flex flex-col h-full min-h-0 min-w-0',
        isFullscreen && 'col-span-1',
        className
      )}
    >
      {children}
    </div>
  );
}

interface ResponsiveFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveFooter({ children, className }: ResponsiveFooterProps) {
  const { isFullscreen } = useResponsiveLayout();

  // Hide footer in fullscreen mode
  if (isFullscreen) {
    return null;
  }

  return (
    <footer className={cn('border-t bg-card mt-auto', className)}>
      <div className="container mx-auto px-4 py-4">
        {children}
      </div>
    </footer>
  );
}
