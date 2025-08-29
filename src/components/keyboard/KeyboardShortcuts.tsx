'use client';

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useTerminal } from '@/components/terminal/TerminalContext';
import { useResponsive } from '@/hooks/use-responsive';
import { toast } from 'sonner';

export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  category: 'terminal' | 'navigation' | 'tabs' | 'layout' | 'general';
  action: () => void;
  enabled?: boolean;
  global?: boolean; // If true, works even when not focused on terminal
}

interface KeyboardShortcutsProps {
  onToggleHelp?: () => void;
  onToggleSettings?: () => void;
  onToggleLayoutSettings?: () => void;
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onToggleFullscreen?: () => void;
  onToggleSidebar?: () => void;
  onFocusTerminal?: () => void;
  onClearTerminal?: () => void;
  onCopySelection?: () => void;
  onPasteClipboard?: () => void;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  onToggleHelp,
  onToggleSettings,
  onToggleLayoutSettings,
  onNewTab,
  onCloseTab,
  onNextTab,
  onPrevTab,
  onToggleFullscreen,
  onToggleSidebar,
  onFocusTerminal,
  onClearTerminal,
  onCopySelection,
  onPasteClipboard,
}) => {
  const { isDesktop } = useResponsive();
  const { connectionStatus } = useTerminal();
  const isConnected = connectionStatus.status === 'connected';
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    // General shortcuts
    {
      id: 'help',
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts help',
      category: 'general',
      action: () => onToggleHelp?.(),
      global: true,
    },
    {
      id: 'settings',
      key: ',',
      ctrlKey: true,
      description: 'Open settings',
      category: 'general',
      action: () => onToggleSettings?.(),
      global: true,
    },
    {
      id: 'layout-settings',
      key: 'l',
      ctrlKey: true,
      shiftKey: true,
      description: 'Open layout settings',
      category: 'layout',
      action: () => onToggleLayoutSettings?.(),
      global: true,
      enabled: isDesktop,
    },

    // Tab management
    {
      id: 'new-tab',
      key: 't',
      ctrlKey: true,
      description: 'New terminal tab',
      category: 'tabs',
      action: () => {
        onNewTab?.();
        toast.success('New terminal tab created');
      },
      global: true,
    },
    {
      id: 'close-tab',
      key: 'w',
      ctrlKey: true,
      description: 'Close current tab',
      category: 'tabs',
      action: () => {
        onCloseTab?.();
        toast.info('Terminal tab closed');
      },
      global: true,
    },
    {
      id: 'next-tab',
      key: 'Tab',
      ctrlKey: true,
      description: 'Next tab',
      category: 'tabs',
      action: () => onNextTab?.(),
      global: true,
    },
    {
      id: 'prev-tab',
      key: 'Tab',
      ctrlKey: true,
      shiftKey: true,
      description: 'Previous tab',
      category: 'tabs',
      action: () => onPrevTab?.(),
      global: true,
    },

    // Navigation shortcuts
    {
      id: 'focus-terminal',
      key: 'k',
      ctrlKey: true,
      description: 'Focus terminal input',
      category: 'navigation',
      action: () => onFocusTerminal?.(),
      global: true,
    },
    {
      id: 'toggle-fullscreen',
      key: 'Enter',
      altKey: true,
      description: 'Toggle fullscreen',
      category: 'navigation',
      action: () => onToggleFullscreen?.(),
      global: true,
    },
    {
      id: 'toggle-sidebar',
      key: 'b',
      ctrlKey: true,
      description: 'Toggle sidebar',
      category: 'layout',
      action: () => onToggleSidebar?.(),
      global: true,
      enabled: isDesktop,
    },

    // Terminal operations
    {
      id: 'clear-terminal',
      key: 'l',
      ctrlKey: true,
      description: 'Clear terminal',
      category: 'terminal',
      action: () => {
        onClearTerminal?.();
        toast.info('Terminal cleared');
      },
      enabled: isConnected,
    },
    {
      id: 'copy-selection',
      key: 'c',
      ctrlKey: true,
      description: 'Copy selection',
      category: 'terminal',
      action: () => onCopySelection?.(),
      enabled: isConnected,
    },
    {
      id: 'paste-clipboard',
      key: 'v',
      ctrlKey: true,
      description: 'Paste from clipboard',
      category: 'terminal',
      action: () => onPasteClipboard?.(),
      enabled: isConnected,
    },

    // Quick actions
    {
      id: 'escape',
      key: 'Escape',
      description: 'Cancel current operation / Close dialogs',
      category: 'general',
      action: () => {
        // This will be handled by individual components
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      },
      global: true,
    },
  ], [
    isConnected,
    isDesktop,
    onToggleHelp,
    onClearTerminal,
    onCopySelection,
    onPasteClipboard,
    onCloseTab,
    onFocusTerminal,
    onNewTab,
    onNextTab,
    onPrevTab,
    onToggleFullscreen,
    onToggleLayoutSettings,
    onToggleSettings,
    onToggleSidebar
  ]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!shortcutsEnabled) return;

    // Don't trigger shortcuts when typing in input fields (unless global)
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.contentEditable === 'true';

    for (const shortcut of shortcuts) {
      // Skip disabled shortcuts
      if (shortcut.enabled === false) continue;

      // Skip non-global shortcuts when in input fields
      if (isInputField && !shortcut.global) continue;

      // Check if the key combination matches
      const keyMatches = event.key === shortcut.key;
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
      const altMatches = !!shortcut.altKey === event.altKey;
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey;
      const metaMatches = !!shortcut.metaKey === event.metaKey;

      if (keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches) {
        event.preventDefault();
        event.stopPropagation();
        
        try {
          shortcut.action();
        } catch (error) {
          console.error('Error executing keyboard shortcut:', error);
          toast.error('Failed to execute keyboard shortcut');
        }
        
        break;
      }
    }
  }, [shortcuts, shortcutsEnabled]);

  // Set up keyboard event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Load shortcuts enabled state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('keyboard-shortcuts-enabled');
      if (saved !== null) {
        setShortcutsEnabled(JSON.parse(saved));
      }
    }
  }, []);

  // Save shortcuts enabled state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('keyboard-shortcuts-enabled', JSON.stringify(shortcutsEnabled));
    }
  }, [shortcutsEnabled]);

  // Expose shortcuts and control functions
  return null; // This is a headless component
};

// Hook to get available shortcuts
export const useKeyboardShortcuts = () => {
  const { isDesktop } = useResponsive();
  const { connectionStatus } = useTerminal();
  const isConnected = connectionStatus.status === 'connected';

  const getShortcuts = useCallback((): KeyboardShortcut[] => {
    return [
      // General shortcuts
      {
        id: 'help',
        key: '?',
        shiftKey: true,
        description: 'Show keyboard shortcuts help',
        category: 'general' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'settings',
        key: ',',
        ctrlKey: true,
        description: 'Open settings',
        category: 'general' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'layout-settings',
        key: 'l',
        ctrlKey: true,
        shiftKey: true,
        description: 'Open layout settings',
        category: 'layout' as const,
        action: () => {},
        global: true,
        enabled: isDesktop,
      },

      // Tab management
      {
        id: 'new-tab',
        key: 't',
        ctrlKey: true,
        description: 'New terminal tab',
        category: 'tabs' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'close-tab',
        key: 'w',
        ctrlKey: true,
        description: 'Close current tab',
        category: 'tabs' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'next-tab',
        key: 'Tab',
        ctrlKey: true,
        description: 'Next tab',
        category: 'tabs' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'prev-tab',
        key: 'Tab',
        ctrlKey: true,
        shiftKey: true,
        description: 'Previous tab',
        category: 'tabs' as const,
        action: () => {},
        global: true,
      },

      // Navigation shortcuts
      {
        id: 'focus-terminal',
        key: 'k',
        ctrlKey: true,
        description: 'Focus terminal input',
        category: 'navigation' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'toggle-fullscreen',
        key: 'Enter',
        altKey: true,
        description: 'Toggle fullscreen',
        category: 'navigation' as const,
        action: () => {},
        global: true,
      },
      {
        id: 'toggle-sidebar',
        key: 'b',
        ctrlKey: true,
        description: 'Toggle sidebar',
        category: 'layout' as const,
        action: () => {},
        global: true,
        enabled: isDesktop,
      },

      // Terminal operations
      {
        id: 'clear-terminal',
        key: 'l',
        ctrlKey: true,
        description: 'Clear terminal',
        category: 'terminal' as const,
        action: () => {},
        enabled: isConnected,
      },
      {
        id: 'copy-selection',
        key: 'c',
        ctrlKey: true,
        description: 'Copy selection',
        category: 'terminal' as const,
        action: () => {},
        enabled: isConnected,
      },
      {
        id: 'paste-clipboard',
        key: 'v',
        ctrlKey: true,
        description: 'Paste from clipboard',
        category: 'terminal' as const,
        action: () => {},
        enabled: isConnected,
      },
    ].filter(shortcut => shortcut.enabled !== false);
  }, [isDesktop, isConnected]);

  return { getShortcuts };
};

export default KeyboardShortcuts;
