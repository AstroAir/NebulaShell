'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Spinner Loading Component
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

export function Spinner({ size = 'md', className, variant = 'default' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  const variantClasses = {
    default: 'border-muted-foreground/30 border-t-muted-foreground',
    primary: 'border-primary/30 border-t-primary',
    secondary: 'border-secondary/30 border-t-secondary',
  };

  return (
    <div
      className={cn(
        'inline-block animate-spin rounded-full',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Dots Loading Component
interface DotsProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingDots({ size = 'md', className }: DotsProps) {
  const sizeClasses = {
    sm: 'space-x-1',
    md: 'space-x-1.5',
    lg: 'space-x-2',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <div className={cn('flex items-center', sizeClasses[size], className)}>
      <div className={cn(dotSizes[size], 'bg-current rounded-full animate-bounce [animation-delay:-0.3s]')} />
      <div className={cn(dotSizes[size], 'bg-current rounded-full animate-bounce [animation-delay:-0.15s]')} />
      <div className={cn(dotSizes[size], 'bg-current rounded-full animate-bounce')} />
    </div>
  );
}

// Pulse Loading Component
interface PulseProps {
  className?: string;
  count?: number;
}

export function LoadingPulse({ className, count = 3 }: PulseProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-8 bg-primary rounded-full animate-pulse"
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.5s',
          }}
        />
      ))}
    </div>
  );
}

// Skeleton Component
interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'shimmer' | 'pulse';
}

export function Skeleton({ className, variant = 'shimmer' }: SkeletonProps) {
  const variantClasses = {
    default: 'bg-muted',
    shimmer: 'skeleton',
    pulse: 'bg-muted animate-pulse',
  };

  return (
    <div
      className={cn(
        'rounded-md',
        variantClasses[variant],
        className
      )}
    />
  );
}

// Skeleton Text Component
interface SkeletonTextProps {
  lines?: number;
  className?: string;
  widths?: string[];
}

export function SkeletonText({ lines = 3, className, widths }: SkeletonTextProps) {
  const defaultWidths = ['w-full', 'w-3/4', 'w-1/2'];
  const lineWidths = widths || defaultWidths.slice(0, lines);

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', lineWidths[i] || 'w-full')}
        />
      ))}
    </div>
  );
}

// Skeleton Card Component
interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
  showActions?: boolean;
}

export function SkeletonCard({ className, showAvatar = true, showActions = true }: SkeletonCardProps) {
  return (
    <div className={cn('p-6 rounded-xl border bg-card', className)}>
      <div className="flex items-start gap-4">
        {showAvatar && (
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        )}
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          {showActions && (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Loading Overlay Component
interface LoadingOverlayProps {
  visible?: boolean;
  children?: React.ReactNode;
  text?: string;
  blur?: boolean;
}

export function LoadingOverlay({ 
  visible = true, 
  children, 
  text = 'Loading...', 
  blur = true 
}: LoadingOverlayProps) {
  if (!visible) return <>{children}</>;

  return (
    <div className="relative">
      {children && (
        <div className={cn(blur && 'blur-sm pointer-events-none')}>
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
        <Spinner size="lg" variant="primary" />
        {text && (
          <p className="mt-4 text-sm text-muted-foreground animate-pulse">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

// Progress Bar Component
interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  variant?: 'default' | 'gradient' | 'striped';
  showLabel?: boolean;
  animated?: boolean;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  className, 
  variant = 'default',
  showLabel = false,
  animated = true
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variantClasses = {
    default: 'bg-primary',
    gradient: 'bg-gradient-to-r from-primary to-accent',
    striped: 'bg-primary bg-stripes',
  };

  return (
    <div className={cn('relative', className)}>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variantClasses[variant],
            animated && 'animate-pulse-soft'
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

// Circular Progress Component
interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function CircularProgress({ 
  value, 
  size = 120, 
  strokeWidth = 8,
  className,
  showLabel = true
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-500 ease-out"
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-2xl font-semibold">
          {value}%
        </span>
      )}
    </div>
  );
}
