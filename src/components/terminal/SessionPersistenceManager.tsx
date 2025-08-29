'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  FolderOpen, 
  Star, 
  StarOff, 
  Trash2, 
  Download, 
  Upload,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Server,
  User,
  Tag,
  Settings,
  Plus
} from 'lucide-react';
import { terminalSessionPersistence, PersistedSession, SessionRestoreOptions } from '@/lib/terminal-session-persistence';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/components/accessibility/AccessibilityProvider';

interface SessionPersistenceManagerProps {
  currentSessionId?: string;
  onSessionRestore?: (sessionId: string, options: SessionRestoreOptions) => void;
  onSessionCreate?: (name: string, config: any) => void;
  className?: string;
}

export function SessionPersistenceManager({ 
  currentSessionId,
  onSessionRestore,
  onSessionCreate,
  className 
}: SessionPersistenceManagerProps) {
  const [sessions, setSessions] = useState<PersistedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PersistedSession | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreOptions, setRestoreOptions] = useState<SessionRestoreOptions>({
    restoreScrollback: true,
    restoreEnvironment: true,
    restoreWorkingDirectory: true,
    restoreAliases: true,
  });
  const [newSessionName, setNewSessionName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { announce } = useAccessibility();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    const allSessions = terminalSessionPersistence.getAllSessions();
    setSessions(allSessions);
  };

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;

    // This would typically get connection config from current session
    const mockConfig = {
      hostname: 'localhost',
      port: 22,
      username: 'user',
    };

    const sessionId = terminalSessionPersistence.createSession(newSessionName, mockConfig);
    onSessionCreate?.(newSessionName, mockConfig);
    
    setNewSessionName('');
    setShowCreateDialog(false);
    loadSessions();
    announce(`Session "${newSessionName}" created successfully`);
  };

  const handleRestoreSession = (session: PersistedSession) => {
    setSelectedSession(session);
    setShowRestoreDialog(true);
  };

  const confirmRestore = () => {
    if (!selectedSession) return;

    onSessionRestore?.(selectedSession.id, restoreOptions);
    setShowRestoreDialog(false);
    setSelectedSession(null);
    announce(`Session "${selectedSession.name}" restored`);
  };

  const handleToggleFavorite = (sessionId: string) => {
    const success = terminalSessionPersistence.toggleFavorite(sessionId);
    if (success) {
      loadSessions();
      announce('Favorite status updated');
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const success = terminalSessionPersistence.deleteSession(sessionId);
    if (success) {
      loadSessions();
      announce('Session deleted successfully');
    }
  };

  const handleExportSessions = () => {
    const data = terminalSessionPersistence.exportSessions();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-sessions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce('Sessions exported successfully');
  };

  const handleImportSessions = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as string;
        const success = terminalSessionPersistence.importSessions(data);
        if (success) {
          loadSessions();
          announce('Sessions imported successfully');
        } else {
          announce('Failed to import sessions', 'assertive');
        }
      } catch (error) {
        announce('Invalid session file format', 'assertive');
      }
    };
    reader.readAsText(file);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.connectionConfig.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const favoriteSessions = sessions.filter(session => session.metadata.favorite);
  const recentSessions = sessions.slice(0, 10);
  const stats = terminalSessionPersistence.getSessionStats();

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Session Persistence
            </CardTitle>
            <CardDescription>
              Save and restore terminal sessions with full state
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSessions}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex items-center gap-2"
            >
              <label htmlFor="import-sessions">
                <Upload className="h-4 w-4" />
                Import
                <input
                  id="import-sessions"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportSessions}
                />
              </label>
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Save Current
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Current Session</DialogTitle>
                  <DialogDescription>
                    Save the current terminal session for later restoration
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
                      Save Session
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <Input
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({sessions.length})</TabsTrigger>
            <TabsTrigger value="favorites">Favorites ({favoriteSessions.length})</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sessions found</p>
                    <p className="text-sm">Create your first session to get started</p>
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <Card 
                      key={session.id}
                      className={cn(
                        'p-4 hover:shadow-md transition-shadow',
                        currentSessionId === session.id && 'ring-2 ring-primary'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium truncate">{session.name}</h4>
                            {session.metadata.favorite && (
                              <Star className="h-4 w-4 fill-current text-yellow-500" />
                            )}
                            {currentSessionId === session.id && (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {session.connectionConfig.hostname}:{session.connectionConfig.port}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {session.connectionConfig.username}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(session.metadata.lastAccessed)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              {formatDuration(session.metadata.sessionDuration)}
                            </div>
                          </div>

                          {session.metadata.tags.length > 0 && (
                            <div className="flex items-center gap-1 mb-2">
                              {session.metadata.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            {session.metadata.totalCommands} commands • 
                            {session.terminalState.scrollback.length} lines saved
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleFavorite(session.id)}
                            className="h-8 w-8 p-0"
                          >
                            {session.metadata.favorite ? (
                              <Star className="h-4 w-4 fill-current text-yellow-500" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreSession(session)}
                            className="h-8 w-8 p-0"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSession(session.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="favorites" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {favoriteSessions.map((session) => (
                  <Card key={session.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{session.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {session.connectionConfig.hostname} • {formatTimestamp(session.metadata.lastAccessed)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRestoreSession(session)}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <Card key={session.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{session.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {session.connectionConfig.hostname} • {formatTimestamp(session.metadata.lastAccessed)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRestoreSession(session)}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-medium mb-3">Session Statistics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Sessions:</span>
                    <span className="font-mono">{stats.totalSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Favorite Sessions:</span>
                    <span className="font-mono">{stats.favoriteSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Commands:</span>
                    <span className="font-mono">{stats.totalCommands}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Duration:</span>
                    <span className="font-mono">{formatDuration(stats.averageSessionDuration)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Restore Dialog */}
        <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Session</DialogTitle>
              <DialogDescription>
                Choose what to restore from "{selectedSession?.name}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="restore-scrollback">Restore Scrollback</Label>
                  <Switch
                    id="restore-scrollback"
                    checked={restoreOptions.restoreScrollback}
                    onCheckedChange={(checked) => 
                      setRestoreOptions(prev => ({ ...prev, restoreScrollback: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="restore-environment">Restore Environment Variables</Label>
                  <Switch
                    id="restore-environment"
                    checked={restoreOptions.restoreEnvironment}
                    onCheckedChange={(checked) => 
                      setRestoreOptions(prev => ({ ...prev, restoreEnvironment: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="restore-directory">Restore Working Directory</Label>
                  <Switch
                    id="restore-directory"
                    checked={restoreOptions.restoreWorkingDirectory}
                    onCheckedChange={(checked) => 
                      setRestoreOptions(prev => ({ ...prev, restoreWorkingDirectory: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="restore-aliases">Restore Aliases</Label>
                  <Switch
                    id="restore-aliases"
                    checked={restoreOptions.restoreAliases}
                    onCheckedChange={(checked) => 
                      setRestoreOptions(prev => ({ ...prev, restoreAliases: checked }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRestoreDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={confirmRestore}>
                  Restore Session
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
