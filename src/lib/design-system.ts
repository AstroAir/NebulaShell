'use client';

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Enhanced utility function for merging classes with design system consistency
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Simplified and harmonious spacing scale for consistent layouts
 * Based on a 0.5rem (8px) base unit with clear semantic naming
 */
export const spacing = {
  // Core numeric values (for specific use cases)
  0: 'space-y-0',
  px: 'space-y-px',
  1: 'space-y-1',
  2: 'space-y-2',
  4: 'space-y-4',
  6: 'space-y-6',
  8: 'space-y-8',
  12: 'space-y-12',
  16: 'space-y-16',

  // Semantic spacing (preferred for most use cases)
  xs: 'space-y-2',    // 0.5rem - Tight spacing for related elements
  sm: 'space-y-4',    // 1rem - Standard component spacing
  md: 'space-y-6',    // 1.5rem - Section spacing
  lg: 'space-y-8',    // 2rem - Large section spacing
  xl: 'space-y-12',   // 3rem - Major layout spacing
} as const;

export const spacingX = {
  // Core numeric values
  0: 'space-x-0',
  px: 'space-x-px',
  1: 'space-x-1',
  2: 'space-x-2',
  4: 'space-x-4',
  6: 'space-x-6',
  8: 'space-x-8',
  12: 'space-x-12',
  16: 'space-x-16',

  // Semantic spacing (matches vertical spacing)
  xs: 'space-x-2',
  sm: 'space-x-4',
  md: 'space-x-6',
  lg: 'space-x-8',
  xl: 'space-x-12',
} as const;

export const gap = {
  // Core numeric values
  0: 'gap-0',
  px: 'gap-px',
  1: 'gap-1',
  2: 'gap-2',
  4: 'gap-4',
  6: 'gap-6',
  8: 'gap-8',
  12: 'gap-12',
  16: 'gap-16',

  // Semantic spacing (matches other spacing utilities)
  xs: 'gap-2',
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
  xl: 'gap-12',
} as const;

export const padding = {
  // Core numeric values
  0: 'p-0',
  px: 'p-px',
  1: 'p-1',
  2: 'p-2',
  4: 'p-4',
  6: 'p-6',
  8: 'p-8',
  12: 'p-12',
  16: 'p-16',

  // Semantic spacing (matches other spacing utilities)
  xs: 'p-2',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-12',
} as const;

export const margin = {
  // Core numeric values
  0: 'm-0',
  px: 'm-px',
  1: 'm-1',
  2: 'm-2',
  4: 'm-4',
  6: 'm-6',
  8: 'm-8',
  12: 'm-12',
  16: 'm-16',

  // Semantic spacing (matches other spacing utilities)
  xs: 'm-2',
  sm: 'm-4',
  md: 'm-6',
  lg: 'm-8',
  xl: 'm-12',
} as const;

/**
 * Responsive spacing utilities for consistent cross-device layouts
 */
export const responsiveSpacing = {
  // Standard responsive progression: base -> md:+25% -> lg:+50%
  container: 'px-4 md:px-6 lg:px-8',
  section: 'py-8 md:py-12 lg:py-16',
  component: 'p-4 md:p-6 lg:p-8',

  // Touch-friendly spacing for interactive elements
  touchTarget: 'min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px]',
  buttonPadding: 'px-4 py-3 md:px-6 md:py-2',
  inputPadding: 'px-4 py-3 md:px-3 md:py-2',
} as const;

/**
 * Typography scale using shadcn/ui design tokens
 */
export const typography = {
  xs: 'text-xs leading-4',
  sm: 'text-sm leading-5',
  base: 'text-base leading-6',
  lg: 'text-lg leading-7',
  xl: 'text-xl leading-8',
  '2xl': 'text-2xl leading-9',
  '3xl': 'text-3xl leading-10',
  '4xl': 'text-4xl leading-none',
} as const;

export const fontWeight = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

/**
 * Color utilities using shadcn/ui semantic colors
 */
export const colors = {
  background: 'bg-background text-foreground',
  card: 'bg-card text-card-foreground',
  popover: 'bg-popover text-popover-foreground',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  muted: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
} as const;

export const textColors = {
  foreground: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary-foreground',
  accent: 'text-accent-foreground',
  destructive: 'text-destructive',
} as const;

export const borderColors = {
  default: 'border-border',
  strong: 'border-border-strong',
  subtle: 'border-border-subtle',
  input: 'border-input',
  primary: 'border-primary',
  secondary: 'border-secondary',
  muted: 'border-muted',
  accent: 'border-accent',
  destructive: 'border-destructive',
} as const;

/**
 * Enhanced Border Radius Scale
 */
export const borderRadius = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  full: 'rounded-full',
} as const;

/**
 * Enhanced Shadow System
 */
export const shadows = {
  none: 'shadow-none',
  xs: 'shadow-xs',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
  inner: 'shadow-inner',
} as const;

/**
 * Component variant utilities
 */
export const buttonVariants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
} as const;

export const cardVariants = {
  default: 'bg-card text-card-foreground border shadow-sm',
  elevated: 'bg-card text-card-foreground border shadow-md',
  outlined: 'bg-card text-card-foreground border-2',
  ghost: 'bg-transparent',
} as const;

/**
 * Loading state utilities
 */
export const loadingStates = {
  skeleton: 'animate-pulse bg-muted rounded',
  spinner: 'animate-spin',
  pulse: 'animate-pulse',
} as const;

/**
 * Focus and interaction states
 */
export const focusStates = {
  default: 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  destructive: 'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
  none: 'focus:outline-none',
} as const;

export const hoverStates = {
  default: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'hover:bg-destructive/90',
  muted: 'hover:bg-muted',
} as const;

/**
 * Responsive utilities
 */
export const responsive = {
  mobile: 'block sm:hidden',
  tablet: 'hidden sm:block lg:hidden',
  desktop: 'hidden lg:block',
  mobileTablet: 'block lg:hidden',
  tabletDesktop: 'hidden sm:block',
} as const;

/**
 * Layout utilities
 */
export const layout = {
  container: 'container mx-auto px-4',
  section: 'py-8 lg:py-12',
  grid: {
    cols1: 'grid grid-cols-1',
    cols2: 'grid grid-cols-1 md:grid-cols-2',
    cols3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    cols4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  },
  flex: {
    center: 'flex items-center justify-center',
    between: 'flex items-center justify-between',
    start: 'flex items-center justify-start',
    end: 'flex items-center justify-end',
    col: 'flex flex-col',
    colCenter: 'flex flex-col items-center justify-center',
  },
} as const;

/**
 * Animation utilities
 */
export const animations = {
  fadeIn: 'animate-in fade-in duration-200',
  fadeOut: 'animate-out fade-out duration-200',
  slideIn: 'animate-in slide-in-from-bottom duration-300',
  slideOut: 'animate-out slide-out-to-bottom duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-200',
  scaleOut: 'animate-out zoom-out-95 duration-200',
} as const;

/**
 * Utility functions for consistent component creation
 */
export function createComponentVariants<T extends Record<string, string>>(
  base: string,
  variants: T
): T & { base: string } {
  return { base, ...variants };
}

export function applyVariant(
  base: string,
  variant: string | undefined,
  variants: Record<string, string>
): string {
  return cn(base, variant ? variants[variant] : '');
}

/**
 * Design system validation utilities
 */
export function validateSpacing(value: string): boolean {
  const validSpacing = /^(p|m|space|gap)-\d+$|^(p|m|space|gap)-(x|y|t|b|l|r)-\d+$/;
  return validSpacing.test(value);
}

export function validateColor(value: string): boolean {
  const validColors = /^(bg|text|border)-(background|foreground|card|popover|primary|secondary|muted|accent|destructive)(-foreground)?$/;
  return validColors.test(value);
}

/**
 * Consistent error and success state utilities
 */
export const stateVariants = {
  error: {
    background: 'bg-destructive/10',
    border: 'border-destructive',
    text: 'text-destructive',
    icon: 'text-destructive',
  },
  success: {
    background: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    icon: 'text-green-600 dark:text-green-400',
  },
  warning: {
    background: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    background: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    icon: 'text-blue-600 dark:text-blue-400',
  },
} as const;
