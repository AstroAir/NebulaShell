'use client';

import { useState, useEffect } from 'react';

// Responsive breakpoints matching Tailwind CSS defaults
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`);
}

export function useResponsive() {
  const isSm = useBreakpoint('sm');
  const isMd = useBreakpoint('md');
  const isLg = useBreakpoint('lg');
  const isXl = useBreakpoint('xl');
  const is2Xl = useBreakpoint('2xl');

  // Mobile-first approach
  const isMobile = !isSm; // < 640px
  const isTablet = isSm && !isLg; // 640px - 1023px
  const isDesktop = isLg; // >= 1024px
  const isLargeDesktop = isXl; // >= 1280px

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    breakpoints: {
      sm: isSm,
      md: isMd,
      lg: isLg,
      xl: isXl,
      '2xl': is2Xl,
    },
  };
}

export function useViewport() {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
}

// Utility function to get responsive classes
export function getResponsiveClasses(config: {
  mobile?: string;
  tablet?: string;
  desktop?: string;
  largeDesktop?: string;
}): string {
  const classes = [];
  
  if (config.mobile) classes.push(config.mobile);
  if (config.tablet) classes.push(`sm:${config.tablet}`);
  if (config.desktop) classes.push(`lg:${config.desktop}`);
  if (config.largeDesktop) classes.push(`xl:${config.largeDesktop}`);
  
  return classes.join(' ');
}
