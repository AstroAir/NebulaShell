'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
  className?: string;
}

const defaultSkipLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#terminal', label: 'Skip to terminal' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#sidebar', label: 'Skip to sidebar' },
];

export function SkipLinks({ links = defaultSkipLinks, className }: SkipLinksProps) {
  return (
    <div className={cn('skip-links', className)}>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            // Position off-screen by default
            'absolute -top-40 left-6 z-[9999]',
            // Style when focused
            'focus:top-6 focus:bg-primary focus:text-primary-foreground',
            'focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg',
            // Smooth transition
            'transition-all duration-200 ease-in-out',
            // Ensure it's accessible
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            // Typography
            'text-sm font-medium',
            // Prevent layout shift
            'whitespace-nowrap'
          )}
          onFocus={() => {
            // Announce to screen readers
            const announcement = `Skip link activated: ${link.label}`;
            announceToScreenReader(announcement);
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

/**
 * Utility function to announce messages to screen readers
 */
function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Hook for managing skip link targets
 */
export function useSkipLinkTargets() {
  React.useEffect(() => {
    // Ensure skip link targets have proper attributes
    const targets = [
      { id: 'main-content', label: 'Main content' },
      { id: 'terminal', label: 'Terminal interface' },
      { id: 'navigation', label: 'Navigation menu' },
      { id: 'sidebar', label: 'Sidebar panel' },
    ];

    targets.forEach(({ id, label }) => {
      const element = document.getElementById(id);
      if (element) {
        // Ensure element is focusable
        if (!element.hasAttribute('tabindex')) {
          element.setAttribute('tabindex', '-1');
        }
        
        // Add aria-label if not present
        if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
          element.setAttribute('aria-label', label);
        }
        
        // Add landmark role if appropriate
        if (id === 'main-content' && !element.hasAttribute('role')) {
          element.setAttribute('role', 'main');
        }
        if (id === 'navigation' && !element.hasAttribute('role')) {
          element.setAttribute('role', 'navigation');
        }
        if (id === 'sidebar' && !element.hasAttribute('role')) {
          element.setAttribute('role', 'complementary');
        }
      }
    });
  }, []);
}

/**
 * Component for screen reader only content
 */
export function ScreenReaderOnly({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <span className={cn('sr-only', className)}>
      {children}
    </span>
  );
}

/**
 * Component for live region announcements
 */
export function LiveRegion({ 
  children, 
  level = 'polite',
  atomic = true,
  className 
}: { 
  children: React.ReactNode;
  level?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-live={level}
      aria-atomic={atomic}
      className={cn('sr-only', className)}
    >
      {children}
    </div>
  );
}

/**
 * Hook for managing focus trapping in modals/dialogs
 */
export function useFocusTrap(isActive: boolean = false) {
  const containerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let parent components handle escape
        e.stopPropagation();
      }
    };

    container.addEventListener('keydown', handleTabKey);
    container.addEventListener('keydown', handleEscapeKey);

    // Focus first element when trap becomes active
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      container.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore() {
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  const saveFocus = React.useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = React.useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);

  return { saveFocus, restoreFocus };
}

/**
 * Component for accessible headings with proper hierarchy
 */
export function AccessibleHeading({
  level,
  children,
  className,
  id,
  ...props
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
  id?: string;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  
  return React.createElement(
    Tag,
    {
      className: cn('scroll-mt-20', className), // Account for sticky headers
      id,
      ...props,
    },
    children
  );
}
