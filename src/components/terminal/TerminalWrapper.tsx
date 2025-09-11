'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TerminalWrapperProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated' | 'minimal';
  showDecoration?: boolean;
}

export function TerminalWrapper({
  children,
  className,
  variant = 'default',
  showDecoration = true,
}: TerminalWrapperProps) {
  const variantStyles = {
    default: 'bg-card border shadow-lg',
    glass: 'glass-morphism',
    elevated: 'bg-card/95 backdrop-blur-md shadow-2xl border',
    minimal: 'bg-transparent border-0',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl transition-all duration-300',
        variantStyles[variant],
        className
      )}
    >
      {/* Terminal Header Decoration */}
      {showDecoration && variant !== 'minimal' && (
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-muted/20 to-transparent pointer-events-none" />
      )}
      
      {/* Terminal Traffic Lights (macOS style) */}
      {showDecoration && variant !== 'minimal' && (
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
        </div>
      )}
      
      {/* Terminal Content */}
      <div className={cn(
        'relative z-0',
        showDecoration && variant !== 'minimal' ? 'pt-8' : ''
      )}>
        {children}
      </div>
      
      {/* Gradient Overlay for depth */}
      {variant === 'glass' && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none rounded-xl" />
      )}
      
      {/* Animated Border */}
      {variant === 'elevated' && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-[-1px] bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 animate-gradient opacity-0 hover:opacity-100 transition-opacity duration-500" />
        </div>
      )}
    </div>
  );
}

interface TerminalHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TerminalHeader({
  title = 'Terminal',
  subtitle,
  actions,
  className,
}: TerminalHeaderProps) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 border-b bg-muted/30',
      className
    )}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

interface TerminalStatusBarProps {
  items?: Array<{
    label: string;
    value: string | React.ReactNode;
    icon?: React.ReactNode;
  }>;
  className?: string;
}

export function TerminalStatusBar({
  items = [],
  className,
}: TerminalStatusBarProps) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-1.5 border-t bg-muted/20 text-xs',
      className
    )}>
      <div className="flex items-center gap-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            {item.icon && (
              <span className="text-muted-foreground">{item.icon}</span>
            )}
            <span className="text-muted-foreground">{item.label}:</span>
            <span className="text-foreground/80 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
