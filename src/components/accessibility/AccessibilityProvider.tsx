'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  announcements: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  isReducedMotion: boolean;
  isHighContrast: boolean;
  prefersKeyboardNavigation: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    screenReaderMode: false,
    keyboardNavigation: false,
    announcements: true,
  });

  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [prefersKeyboardNavigation, setPrefersKeyboardNavigation] = useState(false);

  // Detect user preferences
  useEffect(() => {
    // Check for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(reducedMotionQuery.matches);
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
      setSettings(prev => ({ ...prev, reduceMotion: e.matches }));
    };
    
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    // Check for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(highContrastQuery.matches);
    
    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
      setSettings(prev => ({ ...prev, highContrast: e.matches }));
    };
    
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    // Detect keyboard navigation preference
    const handleKeyDown = () => {
      setPrefersKeyboardNavigation(true);
      setSettings(prev => ({ ...prev, keyboardNavigation: true }));
    };

    const handleMouseDown = () => {
      setPrefersKeyboardNavigation(false);
      setSettings(prev => ({ ...prev, keyboardNavigation: false }));
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    // Load saved settings
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn('Failed to parse saved accessibility settings:', error);
      }
    }

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply CSS classes based on settings
    root.classList.toggle('reduce-motion', settings.reduceMotion || isReducedMotion);
    root.classList.toggle('high-contrast', settings.highContrast || isHighContrast);
    root.classList.toggle('large-text', settings.largeText);
    root.classList.toggle('screen-reader-mode', settings.screenReaderMode);
    root.classList.toggle('keyboard-navigation', settings.keyboardNavigation || prefersKeyboardNavigation);

    // Save settings
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings, isReducedMotion, isHighContrast, prefersKeyboardNavigation]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.announcements) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  };

  const value: AccessibilityContextType = {
    settings,
    updateSettings,
    announce,
    isReducedMotion: settings.reduceMotion || isReducedMotion,
    isHighContrast: settings.highContrast || isHighContrast,
    prefersKeyboardNavigation: settings.keyboardNavigation || prefersKeyboardNavigation,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

/**
 * Hook for accessible form validation
 */
export function useAccessibleForm() {
  const { announce } = useAccessibility();

  const announceError = (fieldName: string, error: string) => {
    announce(`Error in ${fieldName}: ${error}`, 'assertive');
  };

  const announceSuccess = (message: string) => {
    announce(message, 'polite');
  };

  return { announceError, announceSuccess };
}

/**
 * Hook for accessible navigation
 */
export function useAccessibleNavigation() {
  const { announce, prefersKeyboardNavigation } = useAccessibility();

  const announceNavigation = (destination: string) => {
    if (prefersKeyboardNavigation) {
      announce(`Navigated to ${destination}`, 'polite');
    }
  };

  const announcePageChange = (pageName: string) => {
    announce(`Page changed to ${pageName}`, 'polite');
  };

  return { announceNavigation, announcePageChange };
}

/**
 * Hook for accessible status updates
 */
export function useAccessibleStatus() {
  const { announce } = useAccessibility();

  const announceStatus = (status: string, priority: 'polite' | 'assertive' = 'polite') => {
    announce(status, priority);
  };

  const announceError = (error: string) => {
    announce(`Error: ${error}`, 'assertive');
  };

  const announceSuccess = (message: string) => {
    announce(`Success: ${message}`, 'polite');
  };

  const announceLoading = (action: string) => {
    announce(`Loading ${action}`, 'polite');
  };

  const announceComplete = (action: string) => {
    announce(`${action} complete`, 'polite');
  };

  return {
    announceStatus,
    announceError,
    announceSuccess,
    announceLoading,
    announceComplete,
  };
}

/**
 * Component for accessible loading states
 */
export function AccessibleLoading({ 
  message = 'Loading',
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div 
      role="status" 
      aria-live="polite" 
      aria-label={message}
      className={className}
    >
      <span className="sr-only">{message}</span>
    </div>
  );
}

/**
 * Component for accessible error messages
 */
export function AccessibleError({ 
  message,
  id,
  className 
}: { 
  message: string;
  id?: string;
  className?: string;
}) {
  return (
    <div 
      role="alert" 
      aria-live="assertive"
      id={id}
      className={className}
    >
      {message}
    </div>
  );
}
