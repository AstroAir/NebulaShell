'use client';

import { useResponsive } from './use-responsive';
import { useViewport } from './use-responsive';

export interface TerminalConfig {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  scrollback: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  tabStopWidth: number;
  allowTransparency: boolean;
  minimumContrastRatio: number;
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selectionBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

export function useTerminalConfig(): TerminalConfig {
  const { isMobile, isTablet } = useResponsive();
  const { width } = useViewport();

  // Base theme configuration
  const baseTheme = {
    background: '#1a1a1a',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selectionBackground: '#3e3e3e',
    black: '#000000',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#ffffff',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  };

  // Utility to map width to a value range (clamp-like behavior)
  const scale = (w: number, minW: number, maxW: number, minV: number, maxV: number) => {
    const clampedW = Math.max(minW, Math.min(maxW, w));
    const t = (clampedW - minW) / (maxW - minW || 1);
    return minV + t * (maxV - minV);
  };

  // Mobile-optimized configuration (fluid sizing)
  if (isMobile) {
    const mobileSize = Math.round(scale(width, 320, 480, 11, 13));
    return {
      fontSize: mobileSize,
      lineHeight: 1.3, // Slightly increased line height for better readability
      fontFamily: '"SF Mono", "Monaco", "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Ubuntu Mono", monospace',
      scrollback: 500, // Reduced scrollback for better performance
      cursorBlink: true,
      cursorStyle: 'block',
      tabStopWidth: 2, // Smaller tab width for mobile
      allowTransparency: false, // Disable transparency for better performance
      minimumContrastRatio: 4.5, // Higher contrast for mobile screens
      theme: baseTheme,
    };
  }

  // Tablet configuration (fluid sizing)
  if (isTablet) {
    const tabletSize = Math.round(scale(width, 768, 1024, 12, 14));
    return {
      fontSize: tabletSize,
      lineHeight: 1.25,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
      scrollback: 750,
      cursorBlink: true,
      cursorStyle: 'block',
      tabStopWidth: 3,
      allowTransparency: false,
      minimumContrastRatio: 3,
      theme: baseTheme,
    };
  }

  // Desktop configuration (fluid sizing)
  const desktopSize = Math.round(scale(width, 1024, 1920, 13, 16));
  return {
    fontSize: desktopSize,
    lineHeight: 1.22, // slightly more generous for readability
    fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
    scrollback: 1000,
    cursorBlink: true,
    cursorStyle: 'block',
    tabStopWidth: 4,
    allowTransparency: true,
    minimumContrastRatio: 2, // improve readability on desktop too
    theme: baseTheme,
  };

}

// Mobile-specific terminal utilities
export function useMobileTerminalUtils() {
  const { isMobile } = useResponsive();

  const handleVirtualKeyboard = () => {
    if (!isMobile) return;

    // Handle virtual keyboard appearance/disappearance
    const handleResize = () => {
      // Force terminal resize when virtual keyboard appears/disappears
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };

    // Listen for viewport changes that might indicate virtual keyboard
    const handleVisualViewportChange = () => {
      if ('visualViewport' in window) {
        handleResize();
      }
    };

    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
      };
    }

    // Fallback for browsers without visualViewport API
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    return () => {};
  };

  const preventZoom = (element: HTMLElement) => {
    if (!isMobile) return;

    // Prevent zoom on double tap
    element.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    });

    let lastTouchEnd = 0;
    element.addEventListener('touchend', (e) => {
      const now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  };

  const optimizeScrolling = (element: HTMLElement) => {
    if (!isMobile) return;

    // Enable momentum scrolling on iOS (with proper typing)
    (element.style as any).webkitOverflowScrolling = 'touch';
    (element.style as any).overflowScrolling = 'touch';

    // Improve scrolling performance
    element.style.willChange = 'scroll-position';
    element.style.transform = 'translateZ(0)'; // Force hardware acceleration
  };

  return {
    handleVirtualKeyboard,
    preventZoom,
    optimizeScrolling,
  };
}
