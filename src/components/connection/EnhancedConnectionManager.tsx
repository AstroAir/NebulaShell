'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Server, 
  Plus, 
  Search, 
  Star, 
  StarOff, 
  Clock, 
  Folder, 
  FolderOpen,
  Play, 
  Edit, 
  Trash2, 
  Copy,
  Download,
  Upload,
  Zap,
  Settings,
  ChevronDown,
  ChevronRight,
  Globe,
  Shield,
  Terminal,
  Wifi
} from 'lucide-react';
import { enhancedConnectionProfileManager, ConnectionProfile, ConnectionGroup, ConnectionTemplate } from '@/lib/connection-profiles-enhanced';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/components/accessibility/AccessibilityProvider';

interface EnhancedConnectionManagerProps {
  onConnect?: (profile: ConnectionProfile) => void;
  onProfileCreate?: (profile: ConnectionProfile) => void;
  onProfileUpdate?: (profile: ConnectionProfile) => void;
  onProfileDelete?: (profileId: string) => void;
  className?: string;
}

export function EnhancedConnectionManager({
  onConnect,
  onProfileCreate,
  onProfileUpdate,
  onProfileDelete,
  className
}: EnhancedConnectionManagerProps) {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [groups, setGroups] = useState<ConnectionGroup[]>([]);
  const [templates, setTemplates] = useState<ConnectionTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ConnectionProfile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { announce } = useAccessibility();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setProfiles(enhancedConnectionProfileManager.getAllProfiles());
    setGroups(enhancedConnectionProfileManager.getAllGroups());
    setTemplates(enhancedConnectionProfileManager.getAllTemplates());
  };

  const handleConnect = (profile: ConnectionProfile) => {
    enhancedConnectionProfileManager.recordConnection(profile.id);
    onConnect?.(profile);
    loadData(); // Refresh to update last used time
    announce(`Connecting to ${profile.name}`);
  };

  const handleToggleFavorite = (profileId: string) => {
    const success = enhancedConnectionProfileManager.toggleFavorite(profileId);
    if (success) {
      loadData();
      announce('Favorite status updated');
    }
  };

  const handleDeleteProfile = (profileId: string) => {
    const success = enhancedConnectionProfileManager.deleteProfile(profileId);
    if (success) {
      onProfileDelete?.(profileId);
      loadData();
      announce('Profile deleted successfully');
    }
  };

  const handleExportProfiles = () => {
    const data = enhancedConnectionProfileManager.exportProfiles();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-profiles-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce('Profiles exported successfully');
  };

  const handleImportProfiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as string;
        const success = enhancedConnectionProfileManager.importProfiles(data);
        if (success) {
          loadData();
          announce('Profiles imported successfully');
        } else {
          announce('Failed to import profiles', 'assertive');
        }
      } catch (error) {
        announce('Invalid profile file format', 'assertive');
      }
    };
    reader.readAsText(file);
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const formatLastUsed = (timestamp: number) => {
    if (timestamp === 0) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getProfileIcon = (profile: ConnectionProfile) => {
    if (profile.metadata.icon) {
      return profile.metadata.icon;
    }
    
    // Default icons based on hostname patterns
    const hostname = profile.hostname.toLowerCase();
    if (hostname.includes('aws') || hostname.includes('ec2')) return '☁️';
    if (hostname.includes('docker')) return '🐳';
    if (hostname.includes('pi') || hostname.includes('raspberry')) return '🥧';
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return '🏠';
    return '🖥️';
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const favoriteProfiles = enhancedConnectionProfileManager.getFavoriteProfiles();
  const recentProfiles = enhancedConnectionProfileManager.getRecentProfiles();
  const quickConnectProfiles = enhancedConnectionProfileManager.getQuickConnectProfiles();
  const groupedProfiles = enhancedConnectionProfileManager.getGroupedProfiles();
  const ungroupedProfiles = enhancedConnectionProfileManager.getUngroupedProfiles();

  const ProfileCard = ({ profile }: { profile: ConnectionProfile }) => (
    <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-8 w-8" style={{ backgroundColor: profile.metadata.color }}>
            <AvatarFallback className="text-xs">
              {getProfileIcon(profile)}
            </AvatarFallback>
          </Avatar>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{profile.name}</h4>
              {profile.metadata.favorite && (
                <Star className="h-4 w-4 fill-current text-yellow-500" />
              )}
              {profile.quickConnect?.enabled && (
                <Zap className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{profile.username}@{profile.hostname}:{profile.port}</span>
              {profile.authMethod === 'key' && <Shield className="h-3 w-3" />}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatLastUsed(profile.metadata.lastUsed)}
              </span>
              <span>{profile.metadata.useCount} connections</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleConnect(profile);
            }}
            className="h-8 w-8 p-0"
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(profile.id);
            }}
            className="h-8 w-8 p-0"
          >
            {profile.metadata.favorite ? (
              <Star className="h-4 w-4 fill-current text-yellow-500" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProfile(profile);
            }}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteProfile(profile.id);
            }}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {profile.metadata.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          {profile.metadata.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Connection Manager
            </CardTitle>
            <CardDescription>
              Manage and organize your SSH connection profiles
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportProfiles}
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
              <label htmlFor="import-profiles">
                <Upload className="h-4 w-4" />
                Import
                <input
                  id="import-profiles"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportProfiles}
                />
              </label>
            </Button>
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Templates
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Connection Templates</DialogTitle>
                  <DialogDescription>
                    Create connections from predefined templates
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {templates.map(template => (
                    <Card key={template.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {template.category}
                          </Badge>
                        </div>
                        <Button size="sm">Use Template</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Connection Profile</DialogTitle>
                  <DialogDescription>
                    Add a new SSH connection profile
                  </DialogDescription>
                </DialogHeader>
                {/* Profile creation form would go here */}
                <div className="text-sm text-muted-foreground">
                  Profile creation form would be implemented here with all the connection options.
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({profiles.length})</TabsTrigger>
            <TabsTrigger value="favorites">Favorites ({favoriteProfiles.length})</TabsTrigger>
            <TabsTrigger value="recent">Recent ({recentProfiles.length})</TabsTrigger>
            <TabsTrigger value="quick">Quick ({quickConnectProfiles.length})</TabsTrigger>
            <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {searchQuery ? (
                  filteredProfiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No profiles found</p>
                      <p className="text-sm">Try adjusting your search query</p>
                    </div>
                  ) : (
                    filteredProfiles.map(profile => (
                      <ProfileCard key={profile.id} profile={profile} />
                    ))
                  )
                ) : (
                  profiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No connection profiles</p>
                      <p className="text-sm">Create your first profile to get started</p>
                    </div>
                  ) : (
                    profiles.map(profile => (
                      <ProfileCard key={profile.id} profile={profile} />
                    ))
                  )
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="favorites" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {favoriteProfiles.map(profile => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {recentProfiles.map(profile => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="quick" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {quickConnectProfiles.map(profile => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {groupedProfiles.map(({ group, profiles: groupProfiles }) => (
                  <Collapsible
                    key={group.id}
                    open={expandedGroups.has(group.id)}
                    onOpenChange={() => toggleGroupExpansion(group.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedGroups.has(group.id) ? (
                              <FolderOpen className="h-5 w-5" style={{ color: group.color }} />
                            ) : (
                              <Folder className="h-5 w-5" style={{ color: group.color }} />
                            )}
                            <div>
                              <h4 className="font-medium">{group.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {groupProfiles.length} profiles
                              </p>
                            </div>
                          </div>
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </Card>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 ml-8 space-y-2">
                      {groupProfiles.map(profile => (
                        <ProfileCard key={profile.id} profile={profile} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                {ungroupedProfiles.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-muted-foreground">Ungrouped</h4>
                    <div className="space-y-2">
                      {ungroupedProfiles.map(profile => (
                        <ProfileCard key={profile.id} profile={profile} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
