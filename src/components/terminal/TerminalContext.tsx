'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SSHConnectionConfig, ConnectionStatus } from '@/types/ssh';
import { terminalHistoryManager } from '@/lib/terminal-history-manager';
import { terminalAutoCompleteManager } from '@/lib/terminal-autocomplete-manager';
import { terminalAliasesManager } from '@/lib/terminal-aliases-manager';
import { terminalCommandProcessor } from '@/lib/terminal-command-processor';
import { terminalSettingsManager } from '@/lib/terminal-settings-manager';

interface TerminalContextType {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  connect: (config: SSHConnectionConfig) => void;
  disconnect: () => void;
  sendInput: (input: string) => void;
  resize: (cols: number, rows: number) => void;
  sessionId: string | null;

  // Enhanced services
  historyManager: typeof terminalHistoryManager;
  autoCompleteManager: typeof terminalAutoCompleteManager;
  aliasesManager: typeof terminalAliasesManager;
  commandProcessor: typeof terminalCommandProcessor;
  settingsManager: typeof terminalSettingsManager;

  // Enhanced features state
  features: {
    historyEnabled: boolean;
    autoCompleteEnabled: boolean;
    aliasesEnabled: boolean;
    enhancedFeaturesEnabled: boolean;
  };

  // Feature control methods
  toggleFeature: (feature: keyof TerminalContextType['features']) => void;
  refreshFeatureStates: () => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'disconnected'
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Enhanced features state
  const [features, setFeatures] = useState({
    historyEnabled: true,
    autoCompleteEnabled: true,
    aliasesEnabled: true,
    enhancedFeaturesEnabled: true,
  });

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    // Set socket immediately so tests can access it
    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected');
      // Socket is already set, just log the connection
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnectionStatus({ status: 'disconnected' });
      setSessionId(null);
      // Keep the socket reference but it will show as disconnected
    });

    newSocket.on('ssh_connected', (data: { sessionId: string; status: string }) => {
      console.log('SSH connected:', data);
      setConnectionStatus({
        status: 'connected',
        sessionId: data.sessionId
      });
      setSessionId(data.sessionId);
    });

    newSocket.on('ssh_disconnected', (data: { sessionId: string }) => {
      console.log('SSH disconnected:', data);
      setConnectionStatus({ status: 'disconnected' });
      setSessionId(null);
    });

    newSocket.on('ssh_error', (data: { message: string; sessionId?: string }) => {
      console.error('SSH error:', data);
      setConnectionStatus({ 
        status: 'error', 
        message: data.message,
        sessionId: data.sessionId 
      });
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const connect = (config: SSHConnectionConfig) => {
    if (!socket) {
      console.error('Socket not connected');
      return;
    }

    setConnectionStatus({ status: 'connecting' });
    socket.emit('ssh_connect', { config });
  };

  const disconnect = () => {
    if (!socket || !sessionId) return;

    socket.emit('ssh_disconnect');
    setConnectionStatus({ status: 'disconnected' });
    setSessionId(null);
  };

  const sendInput = (input: string) => {
    if (!socket || !sessionId) return;

    socket.emit('terminal_input', { 
      sessionId, 
      input 
    });
  };

  const resize = (cols: number, rows: number) => {
    if (!socket || !sessionId) return;

    socket.emit('terminal_resize', {
      sessionId,
      cols,
      rows
    });
  };

  // Feature control methods
  const refreshFeatureStates = () => {
    const settings = terminalSettingsManager.getSettings();
    setFeatures({
      historyEnabled: settings.commandHistory.enabled,
      autoCompleteEnabled: settings.autoComplete.enabled,
      aliasesEnabled: settings.aliases.enabled,
      enhancedFeaturesEnabled: settings.enhancedFeatures.keyboardShortcuts,
    });
  };

  const toggleFeature = (feature: keyof typeof features) => {
    const newState = !features[feature];
    setFeatures(prev => ({ ...prev, [feature]: newState }));

    // Update the corresponding settings
    switch (feature) {
      case 'historyEnabled':
        terminalSettingsManager.updateCommandHistorySettings({ enabled: newState });
        break;
      case 'autoCompleteEnabled':
        terminalSettingsManager.updateAutoCompleteSettings({ enabled: newState });
        break;
      case 'aliasesEnabled':
        terminalSettingsManager.updateAliasSettings({ enabled: newState });
        break;
      case 'enhancedFeaturesEnabled':
        terminalSettingsManager.updateEnhancedFeatures({ keyboardShortcuts: newState });
        break;
    }
  };

  // Initialize feature states on mount
  useEffect(() => {
    refreshFeatureStates();

    // Listen for settings changes
    const handleSettingsChange = () => {
      refreshFeatureStates();
    };

    terminalSettingsManager.on('settingsChanged', handleSettingsChange);
    terminalSettingsManager.on('commandHistorySettingsChanged', handleSettingsChange);
    terminalSettingsManager.on('autoCompleteSettingsChanged', handleSettingsChange);
    terminalSettingsManager.on('aliasSettingsChanged', handleSettingsChange);
    terminalSettingsManager.on('enhancedFeaturesChanged', handleSettingsChange);

    return () => {
      terminalSettingsManager.off('settingsChanged', handleSettingsChange);
      terminalSettingsManager.off('commandHistorySettingsChanged', handleSettingsChange);
      terminalSettingsManager.off('autoCompleteSettingsChanged', handleSettingsChange);
      terminalSettingsManager.off('aliasSettingsChanged', handleSettingsChange);
      terminalSettingsManager.off('enhancedFeaturesChanged', handleSettingsChange);
    };
  }, []);

  return (
    <TerminalContext.Provider value={{
      socket,
      connectionStatus,
      connect,
      disconnect,
      sendInput,
      resize,
      sessionId,

      // Enhanced services
      historyManager: terminalHistoryManager,
      autoCompleteManager: terminalAutoCompleteManager,
      aliasesManager: terminalAliasesManager,
      commandProcessor: terminalCommandProcessor,
      settingsManager: terminalSettingsManager,

      // Enhanced features state
      features,

      // Feature control methods
      toggleFeature,
      refreshFeatureStates,
    }}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
