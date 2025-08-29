'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Bookmark, 
  Plus, 
  Search, 
  Star, 
  StarOff, 
  Edit, 
  Trash2, 
  Play,
  Clock,
  Server,
  Tag,
  // FolderPlus, Download, Upload - removed as not currently used
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConnectionProfile, ProfileGroup } from '@/types/connection-profile';
import { connectionProfileManager } from '@/lib/connection-profile-manager';
import { useTerminal } from '@/components/terminal/TerminalContext';
import { formatDate } from '@/lib/utils';

interface ConnectionProfilesProps {
  className?: string;
  onConnect?: (profile: ConnectionProfile) => void;
}

export function ConnectionProfiles({ className, onConnect }: ConnectionProfilesProps) {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [, setGroups] = useState<ProfileGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [, setEditingProfile] = useState<ConnectionProfile | null>(null);

  const { connect } = useTerminal();

  const loadProfiles = useCallback(() => {
    const searchFilter = {
      query: searchQuery || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      favorite: showFavoritesOnly || undefined,
      sortBy: 'lastUsed' as const,
      sortOrder: 'desc' as const,
    };

    setProfiles(connectionProfileManager.searchProfiles(searchFilter));
    setGroups(connectionProfileManager.getAllGroups());
  }, [searchQuery, selectedTags, showFavoritesOnly]);

  useEffect(() => {
    loadProfiles();

    const handleProfileCreated = () => loadProfiles();
    const handleProfileUpdated = () => loadProfiles();
    const handleProfileDeleted = () => loadProfiles();

    connectionProfileManager.on('profileCreated', handleProfileCreated);
    connectionProfileManager.on('profileUpdated', handleProfileUpdated);
    connectionProfileManager.on('profileDeleted', handleProfileDeleted);

    return () => {
      connectionProfileManager.off('profileCreated', handleProfileCreated);
      connectionProfileManager.off('profileUpdated', handleProfileUpdated);
      connectionProfileManager.off('profileDeleted', handleProfileDeleted);
    };
  }, [loadProfiles]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleConnect = (profile: ConnectionProfile) => {
    const config = {
      id: `${profile.id}_${Date.now()}`,
      ...profile.config,
    };
    
    connectionProfileManager.recordConnection(profile.id, config);
    
    if (onConnect) {
      onConnect(profile);
    } else {
      connect(config);
    }
  };

  const handleToggleFavorite = (profileId: string) => {
    connectionProfileManager.toggleFavorite(profileId);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile?')) {
      connectionProfileManager.deleteProfile(profileId);
    }
  };

  const getAllTags = () => {
    const tags = new Set<string>();
    profiles.forEach(profile => {
      profile.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const getRecentProfiles = () => {
    return profiles
      .filter(p => p.lastUsed)
      .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
      .slice(0, 5);
  };

  const getFavoriteProfiles = () => {
    return profiles.filter(p => p.favorite);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          Connection Profiles
        </CardTitle>
        <CardDescription>
          Manage and quickly connect to your saved servers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search profiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Star className="h-4 w-4" />
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Connection Profile</DialogTitle>
                  <DialogDescription>
                    Save connection details for quick access
                  </DialogDescription>
                </DialogHeader>
                {/* Profile creation form would go here */}
              </DialogContent>
            </Dialog>
          </div>

          {/* Tags Filter */}
          {getAllTags().length > 0 && (
            <div className="flex flex-wrap gap-1">
              {getAllTags().map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Recent Connections */}
        {getRecentProfiles().length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Connections
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {getRecentProfiles().map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{profile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {profile.config.username}@{profile.config.hostname}:{profile.config.port}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profile.lastUsed && formatDate(profile.lastUsed)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleConnect(profile)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorite Profiles */}
        {getFavoriteProfiles().length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Favorites
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {getFavoriteProfiles().map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <Server className="h-4 w-4 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{profile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {profile.config.username}@{profile.config.hostname}:{profile.config.port}
                    </div>
                    {profile.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {profile.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {profile.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{profile.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleFavorite(profile.id)}
                    >
                      {profile.favorite ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProfile(profile)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConnect(profile)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Profiles */}
        {profiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Connection Profiles</p>
            <p className="text-sm">Create your first profile to get started</p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-medium mb-2">All Profiles ({profiles.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                >
                  <Server className="h-4 w-4 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{profile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {profile.config.username}@{profile.config.hostname}:{profile.config.port}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleFavorite(profile.id)}
                    >
                      {profile.favorite ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConnect(profile)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
