'use client';

import { useState, useEffect, useRef } from 'react';

export interface ContainerQueryBreakpoints {
  xs: number;  // 320px
  sm: number;  // 384px
  md: number;  // 448px
  lg: number;  // 512px
  xl: number;  // 576px
  '2xl': number; // 672px
  '3xl': number; // 768px
  '4xl': number; // 896px
  '5xl': number; // 1024px
  '6xl': number; // 1152px
  '7xl': number; // 1280px
}

export const containerBreakpoints: ContainerQueryBreakpoints = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
  '3xl': 768,
  '4xl': 896,
  '5xl': 1024,
  '6xl': 1152,
  '7xl': 1280,
} as const;

export type ContainerBreakpoint = keyof ContainerQueryBreakpoints;

export interface ContainerQueryState {
  width: number;
  height: number;
  breakpoints: Record<ContainerBreakpoint, boolean>;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2Xl: boolean;
  is3Xl: boolean;
  is4Xl: boolean;
  is5Xl: boolean;
  is6Xl: boolean;
  is7Xl: boolean;
}

/**
 * Hook for container queries - monitors the size of a specific container element
 * and provides responsive breakpoints based on container width rather than viewport width
 */
export function useContainerQuery<T extends HTMLElement = HTMLElement>(): [
  React.RefObject<T | null>,
  ContainerQueryState
] {
  const containerRef = useRef<T>(null);
  const [state, setState] = useState<ContainerQueryState>({
    width: 0,
    height: 0,
    breakpoints: {
      xs: false,
      sm: false,
      md: false,
      lg: false,
      xl: false,
      '2xl': false,
      '3xl': false,
      '4xl': false,
      '5xl': false,
      '6xl': false,
      '7xl': false,
    },
    isXs: false,
    isSm: false,
    isMd: false,
    isLg: false,
    isXl: false,
    is2Xl: false,
    is3Xl: false,
    is4Xl: false,
    is5Xl: false,
    is6Xl: false,
    is7Xl: false,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateState = (width: number, height: number) => {
      const newState: ContainerQueryState = {
        width,
        height,
        breakpoints: {
          xs: width >= containerBreakpoints.xs,
          sm: width >= containerBreakpoints.sm,
          md: width >= containerBreakpoints.md,
          lg: width >= containerBreakpoints.lg,
          xl: width >= containerBreakpoints.xl,
          '2xl': width >= containerBreakpoints['2xl'],
          '3xl': width >= containerBreakpoints['3xl'],
          '4xl': width >= containerBreakpoints['4xl'],
          '5xl': width >= containerBreakpoints['5xl'],
          '6xl': width >= containerBreakpoints['6xl'],
          '7xl': width >= containerBreakpoints['7xl'],
        },
        isXs: width >= containerBreakpoints.xs,
        isSm: width >= containerBreakpoints.sm,
        isMd: width >= containerBreakpoints.md,
        isLg: width >= containerBreakpoints.lg,
        isXl: width >= containerBreakpoints.xl,
        is2Xl: width >= containerBreakpoints['2xl'],
        is3Xl: width >= containerBreakpoints['3xl'],
        is4Xl: width >= containerBreakpoints['4xl'],
        is5Xl: width >= containerBreakpoints['5xl'],
        is6Xl: width >= containerBreakpoints['6xl'],
        is7Xl: width >= containerBreakpoints['7xl'],
      };
      setState(newState);
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateState(width, height);
      }
    });

    resizeObserver.observe(container);

    // Initial measurement
    const rect = container.getBoundingClientRect();
    updateState(rect.width, rect.height);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [containerRef, state];
}

/**
 * Hook for container query breakpoint matching
 */
export function useContainerBreakpoint(
  breakpoint: ContainerBreakpoint,
  containerRef?: React.RefObject<HTMLElement>
): boolean {
  const [internalRef, state] = useContainerQuery();
  const ref = containerRef || internalRef;
  
  return state.breakpoints[breakpoint];
}

/**
 * Utility function to generate container query classes
 */
export function containerQuery(
  breakpoint: ContainerBreakpoint,
  classes: string
): string {
  return `container-${breakpoint}:${classes}`;
}

/**
 * Enhanced responsive utility that combines viewport and container queries
 */
export interface ResponsiveConfig {
  viewport?: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  };
  container?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
    '3xl'?: string;
    '4xl'?: string;
    '5xl'?: string;
    '6xl'?: string;
    '7xl'?: string;
  };
}

export function generateResponsiveClasses(config: ResponsiveConfig): string {
  const classes: string[] = [];

  // Viewport-based classes
  if (config.viewport) {
    Object.entries(config.viewport).forEach(([breakpoint, className]) => {
      if (className) {
        classes.push(`${breakpoint}:${className}`);
      }
    });
  }

  // Container-based classes
  if (config.container) {
    Object.entries(config.container).forEach(([breakpoint, className]) => {
      if (className) {
        classes.push(`container-${breakpoint}:${className}`);
      }
    });
  }

  return classes.join(' ');
}

/**
 * Hook for responsive typography scaling
 */
export function useResponsiveTypography(
  baseSize: number = 16,
  scaleRatio: number = 1.2
) {
  const [containerRef, state] = useContainerQuery();

  const getScaledSize = (level: number = 0): number => {
    let scale = 1;
    
    // Adjust scale based on container width
    if (state.width < containerBreakpoints.sm) {
      scale = 0.875; // Smaller on very small containers
    } else if (state.width < containerBreakpoints.md) {
      scale = 0.9375; // Slightly smaller on small containers
    } else if (state.width >= containerBreakpoints['2xl']) {
      scale = 1.125; // Larger on large containers
    }

    return baseSize * Math.pow(scaleRatio, level) * scale;
  };

  return {
    containerRef,
    getScaledSize,
    fontSize: {
      xs: getScaledSize(-2),
      sm: getScaledSize(-1),
      base: getScaledSize(0),
      lg: getScaledSize(1),
      xl: getScaledSize(2),
      '2xl': getScaledSize(3),
      '3xl': getScaledSize(4),
    },
  };
}
