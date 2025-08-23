import { EventEmitter } from 'events';
import { 
  ConnectionProfile, 
  ProfileGroup, 
  ConnectionHistory, 
  QuickConnectEntry,
  ProfileSearchFilter,
  ProfileImportExport 
} from '@/types/connection-profile';
import { SSHConnectionConfig } from '@/types/ssh';
import { logger } from './logger';

export class ConnectionProfileManager extends EventEmitter {
  private profiles: Map<string, ConnectionProfile> = new Map();
  private groups: Map<string, ProfileGroup> = new Map();
  private history: ConnectionHistory[] = [];
  private quickConnect: QuickConnectEntry[] = [];
  private storageKey = 'webssh_connection_profiles';

  constructor() {
    super();
    this.loadFromStorage();
  }

  // Profile Management
  createProfile(
    name: string, 
    config: Omit<SSHConnectionConfig, 'id'>, 
    options: {
      description?: string;
      tags?: string[];
      color?: string;
      icon?: string;
    } = {}
  ): ConnectionProfile {
    const profile: ConnectionProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: options.description,
      config,
      tags: options.tags || [],
      favorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      useCount: 0,
      color: options.color,
      icon: options.icon,
    };

    this.profiles.set(profile.id, profile);
    this.saveToStorage();
    
    logger.info('Connection profile created', { profileId: profile.id, name });
    this.emit('profileCreated', profile);
    
    return profile;
  }

  updateProfile(profileId: string, updates: Partial<ConnectionProfile>): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const updatedProfile = {
      ...profile,
      ...updates,
      id: profile.id, // Prevent ID changes
      createdAt: profile.createdAt, // Prevent creation date changes
      updatedAt: new Date(),
    };

    this.profiles.set(profileId, updatedProfile);
    this.saveToStorage();
    
    logger.info('Connection profile updated', { profileId, name: updatedProfile.name });
    this.emit('profileUpdated', updatedProfile);
    
    return true;
  }

  deleteProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    this.profiles.delete(profileId);
    
    // Remove from groups
    for (const group of this.groups.values()) {
      const index = group.profiles.indexOf(profileId);
      if (index > -1) {
        group.profiles.splice(index, 1);
        group.updatedAt = new Date();
      }
    }

    this.saveToStorage();
    
    logger.info('Connection profile deleted', { profileId, name: profile.name });
    this.emit('profileDeleted', profile);
    
    return true;
  }

  getProfile(profileId: string): ConnectionProfile | null {
    return this.profiles.get(profileId) || null;
  }

  getAllProfiles(): ConnectionProfile[] {
    return Array.from(this.profiles.values());
  }

  searchProfiles(filter: ProfileSearchFilter): ConnectionProfile[] {
    let results = Array.from(this.profiles.values());

    // Filter by query
    if (filter.query) {
      const query = filter.query.toLowerCase();
      results = results.filter(profile => 
        profile.name.toLowerCase().includes(query) ||
        profile.description?.toLowerCase().includes(query) ||
        profile.config.hostname.toLowerCase().includes(query) ||
        profile.config.username.toLowerCase().includes(query) ||
        profile.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(profile =>
        filter.tags!.some(tag => profile.tags.includes(tag))
      );
    }

    // Filter by favorite
    if (filter.favorite !== undefined) {
      results = results.filter(profile => profile.favorite === filter.favorite);
    }

    // Filter by group
    if (filter.groupId) {
      const group = this.groups.get(filter.groupId);
      if (group) {
        results = results.filter(profile => group.profiles.includes(profile.id));
      }
    }

    // Sort results
    const sortBy = filter.sortBy || 'name';
    const sortOrder = filter.sortOrder || 'asc';
    
    results.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'lastUsed':
          aValue = a.lastUsed?.getTime() || 0;
          bValue = b.lastUsed?.getTime() || 0;
          break;
        case 'useCount':
          aValue = a.useCount;
          bValue = b.useCount;
          break;
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    return results;
  }

  toggleFavorite(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    profile.favorite = !profile.favorite;
    profile.updatedAt = new Date();
    
    this.saveToStorage();
    this.emit('profileUpdated', profile);
    
    return true;
  }

  // Group Management
  createGroup(name: string, description?: string, color?: string): ProfileGroup {
    const group: ProfileGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      color,
      profiles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.groups.set(group.id, group);
    this.saveToStorage();
    
    logger.info('Profile group created', { groupId: group.id, name });
    this.emit('groupCreated', group);
    
    return group;
  }

  addProfileToGroup(profileId: string, groupId: string): boolean {
    const profile = this.profiles.get(profileId);
    const group = this.groups.get(groupId);
    
    if (!profile || !group) return false;
    if (group.profiles.includes(profileId)) return true;

    group.profiles.push(profileId);
    group.updatedAt = new Date();
    
    this.saveToStorage();
    this.emit('groupUpdated', group);
    
    return true;
  }

  removeProfileFromGroup(profileId: string, groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const index = group.profiles.indexOf(profileId);
    if (index === -1) return false;

    group.profiles.splice(index, 1);
    group.updatedAt = new Date();
    
    this.saveToStorage();
    this.emit('groupUpdated', group);
    
    return true;
  }

  getAllGroups(): ProfileGroup[] {
    return Array.from(this.groups.values());
  }

  // Usage Tracking
  recordConnection(profileId: string, config: SSHConnectionConfig): void {
    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.useCount++;
      profile.lastUsed = new Date();
      profile.updatedAt = new Date();
    }

    const historyEntry: ConnectionHistory = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      profileId,
      config,
      connectedAt: new Date(),
      success: true,
    };

    this.history.unshift(historyEntry);
    
    // Keep only last 100 history entries
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }

    this.updateQuickConnect(config.hostname, config.username, config.port);
    this.saveToStorage();
    
    this.emit('connectionRecorded', historyEntry);
  }

  recordDisconnection(profileId: string, success: boolean, error?: string): void {
    const historyEntry = this.history.find(h => 
      h.profileId === profileId && !h.disconnectedAt
    );

    if (historyEntry) {
      historyEntry.disconnectedAt = new Date();
      historyEntry.duration = Math.floor(
        (historyEntry.disconnectedAt.getTime() - historyEntry.connectedAt.getTime()) / 1000
      );
      historyEntry.success = success;
      historyEntry.error = error;
      
      this.saveToStorage();
      this.emit('connectionEnded', historyEntry);
    }
  }

  private updateQuickConnect(hostname: string, username: string, port: number): void {
    const existing = this.quickConnect.find(q => 
      q.hostname === hostname && q.username === username && q.port === port
    );

    if (existing) {
      existing.useCount++;
      existing.lastUsed = new Date();
    } else {
      this.quickConnect.push({
        hostname,
        username,
        port,
        lastUsed: new Date(),
        useCount: 1,
      });
    }

    // Sort by usage and keep top 10
    this.quickConnect.sort((a, b) => b.useCount - a.useCount);
    this.quickConnect = this.quickConnect.slice(0, 10);
  }

  getQuickConnectEntries(): QuickConnectEntry[] {
    return [...this.quickConnect];
  }

  getConnectionHistory(limit: number = 50): ConnectionHistory[] {
    return this.history.slice(0, limit);
  }

  // Import/Export
  exportProfiles(): ProfileImportExport {
    return {
      version: '1.0',
      exportedAt: new Date(),
      profiles: Array.from(this.profiles.values()),
      groups: Array.from(this.groups.values()),
    };
  }

  importProfiles(data: ProfileImportExport, overwrite: boolean = false): number {
    let importedCount = 0;

    for (const profile of data.profiles) {
      if (!overwrite && this.profiles.has(profile.id)) {
        continue;
      }
      
      this.profiles.set(profile.id, profile);
      importedCount++;
    }

    for (const group of data.groups) {
      if (!overwrite && this.groups.has(group.id)) {
        continue;
      }
      
      this.groups.set(group.id, group);
    }

    this.saveToStorage();
    this.emit('profilesImported', importedCount);
    
    return importedCount;
  }

  // Storage
  private saveToStorage(): void {
    try {
      const data = {
        profiles: Array.from(this.profiles.entries()),
        groups: Array.from(this.groups.entries()),
        history: this.history,
        quickConnect: this.quickConnect,
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to save profiles to storage', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      
      if (data.profiles) {
        this.profiles = new Map(data.profiles.map(([id, profile]: [string, any]) => [
          id,
          {
            ...profile,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt),
            lastUsed: profile.lastUsed ? new Date(profile.lastUsed) : undefined,
          }
        ]));
      }

      if (data.groups) {
        this.groups = new Map(data.groups.map(([id, group]: [string, any]) => [
          id,
          {
            ...group,
            createdAt: new Date(group.createdAt),
            updatedAt: new Date(group.updatedAt),
          }
        ]));
      }

      if (data.history) {
        this.history = data.history.map((entry: any) => ({
          ...entry,
          connectedAt: new Date(entry.connectedAt),
          disconnectedAt: entry.disconnectedAt ? new Date(entry.disconnectedAt) : undefined,
        }));
      }

      if (data.quickConnect) {
        this.quickConnect = data.quickConnect.map((entry: any) => ({
          ...entry,
          lastUsed: new Date(entry.lastUsed),
        }));
      }
    } catch (error) {
      logger.error('Failed to load profiles from storage', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  clearAllData(): void {
    this.profiles.clear();
    this.groups.clear();
    this.history = [];
    this.quickConnect = [];
    
    localStorage.removeItem(this.storageKey);
    this.emit('dataCleared');
  }
}

export const connectionProfileManager = new ConnectionProfileManager();
