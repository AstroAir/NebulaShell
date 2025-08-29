'use client';

import React from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/use-responsive';

interface TouchButtonProps extends React.ComponentProps<typeof Button> {
  touchOptimized?: boolean;
}

export const TouchButton = React.forwardRef<HTMLButtonElement, TouchButtonProps>(
  ({ className, touchOptimized = true, children, ...props }, ref) => {
    const { isMobile } = useResponsive();

    return (
      <Button
        ref={ref}
        className={cn(
          // Base touch-friendly styles
          touchOptimized && 'touch-target',
          // Mobile-specific optimizations
          isMobile && touchOptimized && [
            'min-h-[44px] min-w-[44px]', // iOS HIG minimum touch target
            'active:scale-95 transition-transform duration-75', // Visual feedback
            'select-none', // Prevent text selection
          ],
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

TouchButton.displayName = 'TouchButton';
