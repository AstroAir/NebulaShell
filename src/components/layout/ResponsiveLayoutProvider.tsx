'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/use-responsive';

interface ResponsiveLayoutContextType {
  // Device type detection
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  
  // Layout state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;
  
  // Mobile-specific states
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  
  // Layout preferences
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Utility functions
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileOverlays: () => void;
}

const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextType | undefined>(undefined);

export function useResponsiveLayout() {
  const context = useContext(ResponsiveLayoutContext);
  if (context === undefined) {
    throw new Error('useResponsiveLayout must be used within a ResponsiveLayoutProvider');
  }
  return context;
}

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
}

export function ResponsiveLayoutProvider({ children }: ResponsiveLayoutProviderProps) {
  const { isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
  
  // Layout states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-close mobile overlays when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setMobileMenuOpen(false);
      setSidebarOpen(true); // Show sidebar by default on desktop
    } else {
      setSidebarOpen(false); // Hide sidebar by default on mobile
    }
  }, [isDesktop]);

  // Close mobile overlays when fullscreen changes
  useEffect(() => {
    if (isFullscreen) {
      setMobileMenuOpen(false);
      setSidebarOpen(false);
    }
  }, [isFullscreen]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileOverlays = () => {
    setMobileMenuOpen(false);
    if (isMobile || isTablet) {
      setSidebarOpen(false);
    }
  };

  const value: ResponsiveLayoutContextType = {
    // Device detection
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    
    // Layout state
    sidebarOpen,
    setSidebarOpen,
    isFullscreen,
    setIsFullscreen,
    
    // Mobile-specific
    mobileMenuOpen,
    setMobileMenuOpen,
    
    // Layout preferences
    sidebarCollapsed,
    setSidebarCollapsed,
    
    // Utility functions
    toggleSidebar,
    toggleMobileMenu,
    closeMobileOverlays,
  };

  return (
    <ResponsiveLayoutContext.Provider value={value}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
}
