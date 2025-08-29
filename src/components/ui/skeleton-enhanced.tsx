'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/components/accessibility/AccessibilityProvider';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'pulse' | 'wave';
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  lines?: number;
  avatar?: boolean;
  preventLayoutShift?: boolean;
}

export function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  rounded = 'md',
  lines = 1,
  avatar = false,
  preventLayoutShift = true,
  ...props
}: SkeletonProps) {
  const { isReducedMotion } = useAccessibility();

  const baseClasses = cn(
    'bg-muted',
    // Prevent layout shift
    preventLayoutShift && 'prevent-layout-shift',
    // Animation based on variant and motion preference
    !isReducedMotion && {
      'skeleton': variant === 'wave',
      'skeleton-pulse': variant === 'pulse',
    },
    // Rounded corners
    {
      'rounded-none': rounded === 'none',
      'rounded-sm': rounded === 'sm',
      'rounded-md': rounded === 'md',
      'rounded-lg': rounded === 'lg',
      'rounded-full': rounded === 'full',
    },
    className
  );

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (avatar) {
    return (
      <div
        className={cn(baseClasses, 'rounded-full')}
        style={{ width: width || '40px', height: height || '40px', ...style }}
        aria-label="Loading avatar"
        role="img"
        {...props}
      />
    );
  }

  if (lines === 1) {
    return (
      <div
        className={cn(baseClasses, !height && 'h-4')}
        style={style}
        aria-label="Loading content"
        role="img"
        {...props}
      />
    );
  }

  return (
    <div className="space-y-2" aria-label="Loading content" role="img" {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            baseClasses,
            'h-4',
            // Vary width for last line to look more natural
            index === lines - 1 && 'w-3/4'
          )}
          style={index === lines - 1 ? { width: '75%' } : style}
        />
      ))}
    </div>
  );
}

// Specific skeleton components for common use cases
export function SkeletonCard({
  showAvatar = false,
  showImage = false,
  lines = 3,
  className,
}: {
  showAvatar?: boolean;
  showImage?: boolean;
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('p-4 space-y-4', className)} role="img" aria-label="Loading card">
      {showImage && <Skeleton height={200} rounded="lg" />}
      
      <div className="space-y-3">
        {showAvatar && (
          <div className="flex items-center space-x-3">
            <Skeleton avatar width={40} height={40} />
            <div className="space-y-2 flex-1">
              <Skeleton height={16} width="60%" />
              <Skeleton height={14} width="40%" />
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Skeleton height={20} width="80%" />
          <Skeleton lines={lines} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)} role="img" aria-label="Loading table">
      {showHeader && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`header-${index}`} height={16} width="80%" />
          ))}
        </div>
      )}
      
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                height={14}
                width={colIndex === 0 ? '90%' : '70%'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTerminal({
  lines = 10,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('p-4 bg-black rounded-lg space-y-1', className)}
      role="img"
      aria-label="Loading terminal"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="flex items-center space-x-2">
          <Skeleton
            height={12}
            width={index % 3 === 0 ? '20px' : '12px'}
            className="bg-green-500/20"
          />
          <Skeleton
            height={12}
            width={`${Math.random() * 40 + 40}%`}
            className="bg-white/10"
          />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({
  items = 5,
  showAvatar = false,
  showIcon = false,
  className,
}: {
  items?: number;
  showAvatar?: boolean;
  showIcon?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)} role="img" aria-label="Loading list">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3">
          {showAvatar && <Skeleton avatar width={32} height={32} />}
          {showIcon && <Skeleton width={16} height={16} rounded="sm" />}
          
          <div className="flex-1 space-y-1">
            <Skeleton height={16} width="70%" />
            <Skeleton height={12} width="50%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonButton({
  size = 'default',
  className,
}: {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const heights = {
    sm: 32,
    default: 40,
    lg: 48,
  };

  const widths = {
    sm: 80,
    default: 100,
    lg: 120,
  };

  return (
    <Skeleton
      height={heights[size]}
      width={widths[size]}
      rounded="md"
      className={className}
      aria-label="Loading button"
    />
  );
}

// Hook for managing skeleton loading states
export function useSkeletonLoading(isLoading: boolean, delay: number = 200) {
  const [showSkeleton, setShowSkeleton] = React.useState(false);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      // Delay showing skeleton to avoid flash for quick loads
      timeoutId = setTimeout(() => {
        setShowSkeleton(true);
      }, delay);
    } else {
      setShowSkeleton(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, delay]);

  return showSkeleton;
}
