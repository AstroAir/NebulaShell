'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTerminal } from '@/components/terminal/TerminalContext';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const { connectionStatus } = useTerminal();

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" />;
      case 'connecting':
        return <Clock className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'disconnected':
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusVariant = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'default' as const;
      case 'connecting':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      case 'disconnected':
      default:
        return 'outline' as const;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={getStatusVariant()} className="flex items-center gap-1">
          {getStatusIcon()}
          {getStatusText()}
        </Badge>
        {connectionStatus.sessionId && (
          <span className="text-sm text-muted-foreground">
            Session: {connectionStatus.sessionId.slice(0, 8)}...
          </span>
        )}
      </div>
      
      {connectionStatus.message && (
        <Alert variant={connectionStatus.status === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>
            {connectionStatus.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
