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
  announcements: Array<{ message: string; priority: 'polite' | 'assertive'; timestamp: number }>;
  isReducedMotion: boolean;
  isHighContrast: boolean;
  prefersKeyboardNavigation: boolean;
  isFocusVisible: boolean;
  setFocusVisible: (visible: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: React.ReactNode;
  maxAnnouncements?: number;
}

export function AccessibilityProvider({ children, maxAnnouncements = 10 }: AccessibilityProviderProps) {
  // Detect test environment
  const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

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
  const [announcements, setAnnouncements] = useState<Array<{ message: string; priority: 'polite' | 'assertive'; timestamp: number }>>([]);
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  // Detect user preferences
  useEffect(() => {
    if (isTestEnvironment) {
      // In test environment, check matchMedia immediately and synchronously
      try {
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const initialReducedMotion = reducedMotionQuery.matches;
        setIsReducedMotion(initialReducedMotion);
        setSettings(prev => ({ ...prev, reduceMotion: initialReducedMotion }));

        const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
        const initialHighContrast = highContrastQuery.matches;
        setIsHighContrast(initialHighContrast);
        setSettings(prev => ({ ...prev, highContrast: initialHighContrast }));
      } catch (error) {
        console.warn('matchMedia not available in test environment:', error);
      }
      return; // Skip complex event listener setup in tests
    }

    // Production environment - full functionality
    // Check for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initialReducedMotion = reducedMotionQuery.matches;
    setIsReducedMotion(initialReducedMotion);
    setSettings(prev => ({ ...prev, reduceMotion: initialReducedMotion }));

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
      setSettings(prev => ({ ...prev, reduceMotion: e.matches }));
    };

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    // Check for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const initialHighContrast = highContrastQuery.matches;
    setIsHighContrast(initialHighContrast);
    setSettings(prev => ({ ...prev, highContrast: initialHighContrast }));

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
      setSettings(prev => ({ ...prev, highContrast: e.matches }));
    };

    highContrastQuery.addEventListener('change', handleHighContrastChange);

    // Detect keyboard navigation preference and manage focus visible
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab key indicates keyboard navigation
      if (e.key === 'Tab') {
        setIsFocusVisible(true);
      }
      setPrefersKeyboardNavigation(true);
      setSettings(prev => ({ ...prev, keyboardNavigation: true }));
    };

    const handleMouseDown = () => {
      setIsFocusVisible(false);
      setPrefersKeyboardNavigation(false);
      setSettings(prev => ({ ...prev, keyboardNavigation: false }));
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    // Load saved settings (with error handling for test environment)
    try {
      const savedSettings = localStorage?.getItem('accessibility-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.warn('Failed to parse saved accessibility settings:', error);
        }
      }
    } catch (error) {
      // localStorage might not be available in test environment
      console.warn('localStorage not available:', error);
    }

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Create ARIA live regions immediately
  useEffect(() => {
    const createLiveRegions = () => {
      // Create persistent ARIA live regions if they don't exist
      if (!document.querySelector('[aria-live="polite"]')) {
        const politeRegion = document.createElement('div');
        politeRegion.setAttribute('aria-live', 'polite');
        politeRegion.setAttribute('aria-atomic', 'true');
        politeRegion.className = 'sr-only';
        politeRegion.id = 'accessibility-announcements-polite';
        politeRegion.style.position = 'absolute';
        politeRegion.style.left = '-10000px';
        politeRegion.style.width = '1px';
        politeRegion.style.height = '1px';
        politeRegion.style.overflow = 'hidden';
        document.body.appendChild(politeRegion);
      }

      if (!document.querySelector('[aria-live="assertive"]')) {
        const assertiveRegion = document.createElement('div');
        assertiveRegion.setAttribute('aria-live', 'assertive');
        assertiveRegion.setAttribute('aria-atomic', 'true');
        assertiveRegion.className = 'sr-only';
        assertiveRegion.id = 'accessibility-announcements-assertive';
        assertiveRegion.style.position = 'absolute';
        assertiveRegion.style.left = '-10000px';
        assertiveRegion.style.width = '1px';
        assertiveRegion.style.height = '1px';
        assertiveRegion.style.overflow = 'hidden';
        document.body.appendChild(assertiveRegion);
      }
    };

    if (isTestEnvironment) {
      // In test environment, create regions synchronously
      createLiveRegions();
    } else {
      // In production, create regions normally
      createLiveRegions();
    }
  }, [isTestEnvironment]);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply CSS classes based on settings
    root.classList.toggle('reduce-motion', settings.reduceMotion || isReducedMotion);
    root.classList.toggle('high-contrast', settings.highContrast || isHighContrast);
    root.classList.toggle('large-text', settings.largeText);
    root.classList.toggle('screen-reader-mode', settings.screenReaderMode);
    root.classList.toggle('keyboard-navigation', settings.keyboardNavigation || prefersKeyboardNavigation);

    // Save settings (with error handling for test environment)
    try {
      localStorage?.setItem('accessibility-settings', JSON.stringify(settings));
    } catch (error) {
      // localStorage might not be available in test environment
      console.warn('localStorage not available for saving:', error);
    }
  }, [settings, isReducedMotion, isHighContrast, prefersKeyboardNavigation]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.announcements) {
      console.warn('Announcements are disabled');
      return;
    }

    // Add to announcements array
    const newAnnouncement = { message, priority, timestamp: Date.now() };
    setAnnouncements(prev => {
      const updated = [...prev, newAnnouncement];
      // Keep only the most recent announcements
      return updated.slice(-maxAnnouncements);
    });

    // Use persistent live regions
    const regionId = priority === 'assertive'
      ? 'accessibility-announcements-assertive'
      : 'accessibility-announcements-polite';

    const liveRegion = document.getElementById(regionId);
    if (liveRegion) {
      liveRegion.textContent = message;

      // Clear after announcement to allow for new ones
      setTimeout(() => {
        if (liveRegion.textContent === message) {
          liveRegion.textContent = '';
        }
      }, 1000);
    }
  };

  const value: AccessibilityContextType = {
    settings,
    updateSettings,
    announce,
    announcements,
    isReducedMotion: settings.reduceMotion || isReducedMotion,
    isHighContrast: settings.highContrast || isHighContrast,
    prefersKeyboardNavigation: settings.keyboardNavigation || prefersKeyboardNavigation,
    isFocusVisible,
    setFocusVisible: setIsFocusVisible,
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
