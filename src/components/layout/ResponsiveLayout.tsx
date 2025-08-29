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
        'min-h-screen bg-background transition-all duration-300',
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
    <header className={cn('border-b bg-card sticky top-0 z-40', className)}>
      <div className="container mx-auto px-4 py-4">
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
        'flex-1 container mx-auto px-4 py-6',
        isFullscreen && 'px-0 py-0',
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
        'grid gap-6 h-full',
        // Mobile: single column
        'grid-cols-1',
        // Desktop: sidebar + main content
        isDesktop && !isFullscreen && 'lg:grid-cols-[300px_1fr]',
        // Fullscreen: single column
        isFullscreen && 'grid-cols-1',
        // Height calculations
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-120px)]',
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
        'flex flex-col h-full min-w-0',
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
