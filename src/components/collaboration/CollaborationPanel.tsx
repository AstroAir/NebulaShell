'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Share2,
  Copy,
  UserPlus,
  UserMinus,
  Wifi,
  WifiOff,
  Crown,
  Clock,
  MousePointer
} from 'lucide-react';
import { collaborationManager, CollaborationUser, CollaborationSession } from '@/lib/collaboration/websocket-manager';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/components/accessibility/AccessibilityProvider';

interface CollaborationPanelProps {
  sessionId?: string;
  currentUser?: Omit<CollaborationUser, 'isActive' | 'lastSeen'>;
  connectedUsers?: CollaborationUser[];
  connectionStatus?: string;
  connectionError?: string;
  onSessionCreate?: (sessionName: string) => void;
  onSessionJoin?: (sessionId: string) => void;
  onSessionLeave?: () => void;
  onSessionShare?: (sessionId: string) => void;
  onSessionEnd?: () => void;
  onUserJoin?: (user: CollaborationUser) => void;
  onUserLeave?: (userId: string) => void;
  className?: string;
}

export function CollaborationPanel({
  sessionId,
  currentUser,
  connectedUsers: initialConnectedUsers,
  connectionStatus,
  connectionError,
  onSessionCreate,
  onSessionJoin,
  onSessionLeave,
  onSessionShare,
  onSessionEnd,

  className
}: CollaborationPanelProps) {
  const [isConnected, setIsConnected] = useState(!!sessionId || connectionStatus === 'connected');
  const [connectedUsers, setConnectedUsers] = useState<CollaborationUser[]>(initialConnectedUsers || []);
  const [currentSession, setCurrentSession] = useState<CollaborationSession | null>(
    sessionId ? {
      id: sessionId,
      name: 'Current Session',
      ownerId: currentUser?.id || 'current-user',
      users: new Map(),
      isActive: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      settings: {
        maxUsers: 10,
        allowGuestUsers: true,
        requirePermission: false,
        shareTerminalInput: true,
        shareTerminalOutput: true,
        shareCursor: true,
      }
    } : null
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [joinSessionId, setJoinSessionId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [sessionSettings, setSessionSettings] = useState({
    shareTerminalInput: true,
    shareTerminalOutput: true,
    shareCursor: true,
    allowGuestUsers: true,
    maxUsers: 10,
  });
  const { announce } = useAccessibility();

  // Sync prop changes with state
  useEffect(() => {
    if (initialConnectedUsers) {
      setConnectedUsers(initialConnectedUsers);
    }
  }, [initialConnectedUsers]);

  useEffect(() => {
    setIsConnected(!!sessionId || connectionStatus === 'connected');
  }, [sessionId, connectionStatus]);

  useEffect(() => {
    if (sessionId) {
      setCurrentSession({
        id: sessionId,
        name: 'Current Session',
        ownerId: currentUser?.id || 'current-user',
        users: new Map(),
        isActive: true,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        settings: {
          maxUsers: 10,
          allowGuestUsers: true,
          requirePermission: false,
          shareTerminalInput: true,
          shareTerminalOutput: true,
          shareCursor: true,
        }
      });
    } else {
      setCurrentSession(null);
    }
  }, [sessionId, currentUser]);

  const handleConnected = useCallback(() => {
    setIsConnected(true);
    setCurrentSession(collaborationManager.getCurrentSession());
    setConnectedUsers(collaborationManager.getConnectedUsers());
    announce('Connected to collaboration session');
  }, [announce]);

  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
    announce('Disconnected from collaboration session');
  }, [announce]);

  const handleUserJoined = useCallback((data: { user: CollaborationUser }) => {
    setConnectedUsers(collaborationManager.getConnectedUsers());
    announce(`${data.user.name} joined the session`);
  }, [announce]);

  const handleUserLeft = useCallback(() => {
    setConnectedUsers(collaborationManager.getConnectedUsers());
    announce('A user left the session');
  }, [announce]);

  const handleUserUpdated = useCallback(() => {
    setConnectedUsers(collaborationManager.getConnectedUsers());
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('Collaboration error:', error);
    announce('Collaboration error occurred', 'assertive');
  }, [announce]);

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !currentUser) return;

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const success = await collaborationManager.connect(sessionId, currentUser);
    
    if (success) {
      onSessionCreate?.(newSessionName);
      setNewSessionName('');
      setShowCreateDialog(false);
      
      // Generate share URL
      const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
      setShareUrl(url);
    }
  };

  const handleJoinSession = async () => {
    if (!joinSessionId.trim() || !currentUser) return;

    const success = await collaborationManager.connect(joinSessionId, currentUser);
    
    if (success) {
      onSessionJoin?.(joinSessionId);
      setJoinSessionId('');
      setShowJoinDialog(false);
    }
  };

  const handleLeaveSession = () => {
    collaborationManager.disconnect();
    onSessionLeave?.();
    setCurrentSession(null);
    setConnectedUsers([]);
    setShareUrl('');
  };

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      announce('Share URL copied to clipboard');
    } catch {
      announce('Failed to copy share URL', 'assertive');
    }
  };

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getUserStatusColor = (user: CollaborationUser) => {
    if (!user.isActive) return 'bg-gray-400';
    const now = Date.now();
    const timeSinceLastSeen = now - user.lastSeen;

    if (timeSinceLastSeen < 30000) return 'bg-green-500'; // Active (last 30s)
    if (timeSinceLastSeen < 300000) return 'bg-yellow-500'; // Away (last 5m)
    return 'bg-red-500'; // Inactive
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    // Set up collaboration manager event listeners
    collaborationManager.on('connected', handleConnected);
    collaborationManager.on('disconnected', handleDisconnected);
    collaborationManager.on('userJoined', handleUserJoined);
    collaborationManager.on('userLeft', handleUserLeft);
    collaborationManager.on('userUpdated', handleUserUpdated);
    collaborationManager.on('error', handleError);

    return () => {
      collaborationManager.off('connected', handleConnected);
      collaborationManager.off('disconnected', handleDisconnected);
      collaborationManager.off('userJoined', handleUserJoined);
      collaborationManager.off('userLeft', handleUserLeft);
      collaborationManager.off('userUpdated', handleUserUpdated);
      collaborationManager.off('error', handleError);
    };
  }, [handleConnected, handleDisconnected, handleUserJoined, handleUserLeft, handleUserUpdated, handleError]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Collaboration
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              Share your terminal session with others in real-time
            </CardDescription>
          </div>
          
          {!isConnected ? (
            <div className="flex items-center gap-2">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Create Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Collaboration Session</DialogTitle>
                    <DialogDescription>
                      Start a new session to share your terminal with others
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="session-name">Session Name</Label>
                      <Input
                        id="session-name"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        placeholder="My Development Session"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateSession}>
                        Create Session
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Join Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Collaboration Session</DialogTitle>
                    <DialogDescription>
                      Enter a session ID to join an existing collaboration
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="join-session-id">Session ID</Label>
                      <Input
                        id="join-session-id"
                        value={joinSessionId}
                        onChange={(e) => setJoinSessionId(e.target.value)}
                        placeholder="session-123456789"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowJoinDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleJoinSession}>
                        Join Session
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLeaveSession}
              className="flex items-center gap-2"
            >
              <UserMinus className="h-4 w-4" />
              Leave Session
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Error State */}
        {connectionStatus === 'error' && connectionError && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>Connection Error</strong>
                <p className="text-sm mt-1">{connectionError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Session Information */}
        {sessionId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Session ID:</span>
                  <code className="text-sm bg-background px-2 py-1 rounded">{sessionId}</code>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">Connected Users ({connectedUsers.length})</span>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      connectionStatus === 'connected' ? "bg-green-500" :
                      connectionStatus === 'reconnecting' ? "bg-yellow-500" : "bg-red-500"
                    )} />
                    <span className="text-xs text-muted-foreground">
                      {connectionStatus === 'connected' ? 'Connected' :
                       connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSessionShare?.(sessionId)}
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share Session
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onSessionEnd?.()}
                  className="flex items-center gap-2"
                >
                  <UserMinus className="h-4 w-4" />
                  End Session
                </Button>
              </div>
            </div>

            {/* Session Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">Session Duration:</div>
                <div className="text-xs text-muted-foreground">
                  {currentSession ? formatDuration(Date.now() - currentSession.createdAt) : '0m'}
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">Commands Executed:</div>
                <div className="text-xs text-muted-foreground">0</div>
              </div>
            </div>

            {/* Permissions Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Permissions</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="allow-input" defaultChecked />
                  <label htmlFor="allow-input" className="text-sm">Allow Input</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="view-only" />
                  <label htmlFor="view-only" className="text-sm">View Only</label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Session State */}
        {!sessionId && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active session</p>
            <p className="text-sm">Create or join a session to start collaborating</p>
          </div>
        )}

        {isConnected && currentSession ? (
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users">Users ({connectedUsers.length})</TabsTrigger>
              <TabsTrigger value="share">Share</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-4">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {connectedUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No users connected</p>
                      <p className="text-sm">Share the session link to invite others</p>
                    </div>
                  ) : (
                    connectedUsers.map((user) => (
                    <Card key={user.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback style={{ backgroundColor: user.color }}>
                                {user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div 
                              className={cn(
                                'absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background',
                                getUserStatusColor(user)
                              )}
                            />
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{user.name}</span>
                              {user.id === currentSession.ownerId && (
                                <Crown className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatLastSeen(user.lastSeen)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {user.cursor && (
                            <Badge variant="outline" className="text-xs">
                              <MousePointer className="h-3 w-3 mr-1" />
                              L{user.cursor.line}
                            </Badge>
                          )}
                          <Badge 
                            variant={user.isActive ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {user.isActive ? 'Active' : 'Away'}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="share" className="mt-4">
              <div className="space-y-4">
                <div>
                  <Label>Session ID</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      value={currentSession.id} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(currentSession.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {shareUrl && (
                  <div>
                    <Label>Share URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={shareUrl} 
                        readOnly 
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyShareUrl}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Alert>
                  <Share2 className="h-4 w-4" />
                  <AlertDescription>
                    Share the session ID or URL with others to invite them to collaborate.
                    They will be able to see your terminal output and optionally provide input.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Share Terminal Input</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow others to type commands in your terminal
                    </p>
                  </div>
                  <Switch
                    checked={sessionSettings.shareTerminalInput}
                    onCheckedChange={(checked) => 
                      setSessionSettings(prev => ({ ...prev, shareTerminalInput: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Share Terminal Output</Label>
                    <p className="text-sm text-muted-foreground">
                      Show your terminal output to others
                    </p>
                  </div>
                  <Switch
                    checked={sessionSettings.shareTerminalOutput}
                    onCheckedChange={(checked) => 
                      setSessionSettings(prev => ({ ...prev, shareTerminalOutput: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Share Cursor Position</Label>
                    <p className="text-sm text-muted-foreground">
                      Show your cursor position to others
                    </p>
                  </div>
                  <Switch
                    checked={sessionSettings.shareCursor}
                    onCheckedChange={(checked) => 
                      setSessionSettings(prev => ({ ...prev, shareCursor: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Guest Users</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow users to join without authentication
                    </p>
                  </div>
                  <Switch
                    checked={sessionSettings.allowGuestUsers}
                    onCheckedChange={(checked) => 
                      setSessionSettings(prev => ({ ...prev, allowGuestUsers: checked }))
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active collaboration session</p>
            <p className="text-sm">Create or join a session to start collaborating</p>
          </div>
        )}
      </CardContent>

      {/* Status region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {connectionStatus === 'connected' && `Connected to session ${sessionId} with ${connectedUsers.length} users`}
        {connectionStatus === 'reconnecting' && 'Reconnecting to collaboration session...'}
        {connectionStatus === 'disconnected' && 'Disconnected from collaboration session'}
      </div>
    </Card>
  );
}
