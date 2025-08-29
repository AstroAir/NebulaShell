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
 * Design system spacing scale using shadcn/ui tokens
 */
export const spacing = {
  xs: 'space-y-1',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
  '2xl': 'space-y-12',
  '3xl': 'space-y-16',
} as const;

export const spacingX = {
  xs: 'space-x-1',
  sm: 'space-x-2',
  md: 'space-x-4',
  lg: 'space-x-6',
  xl: 'space-x-8',
  '2xl': 'space-x-12',
  '3xl': 'space-x-16',
} as const;

export const gap = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
  '2xl': 'gap-12',
  '3xl': 'gap-16',
} as const;

export const padding = {
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
  '2xl': 'p-12',
  '3xl': 'p-16',
} as const;

export const margin = {
  xs: 'm-1',
  sm: 'm-2',
  md: 'm-4',
  lg: 'm-6',
  xl: 'm-8',
  '2xl': 'm-12',
  '3xl': 'm-16',
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
  input: 'border-input',
  primary: 'border-primary',
  secondary: 'border-secondary',
  muted: 'border-muted',
  accent: 'border-accent',
  destructive: 'border-destructive',
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
