'use client';

export interface ConnectionProfile {
  id: string;
  name: string;
  description?: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key' | 'agent';
  privateKeyPath?: string;
  privateKeyContent?: string;
  passphrase?: string;
  // Note: passwords should not be stored for security
  savePassword?: boolean;
  connectionOptions: {
    keepAlive?: boolean;
    keepAliveInterval?: number;
    timeout?: number;
    compression?: boolean;
    forwardAgent?: boolean;
    forwardX11?: boolean;
  };
  environment?: {
    variables: Record<string, string>;
    workingDirectory?: string;
    shell?: string;
  };
  tunnels?: Array<{
    id: string;
    name: string;
    type: 'local' | 'remote' | 'dynamic';
    localPort: number;
    remoteHost: string;
    remotePort: number;
    enabled: boolean;
  }>;
  metadata: {
    createdAt: number;
    lastUsed: number;
    useCount: number;
    favorite: boolean;
    tags: string[];
    color?: string;
    icon?: string;
  };
  quickConnect?: {
    enabled: boolean;
    autoConnect: boolean;
    connectOnStartup: boolean;
  };
}

export interface ConnectionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: Partial<ConnectionProfile>;
  variables: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean';
    required: boolean;
    default?: any;
    options?: string[];
    description?: string;
  }>;
}

export interface ConnectionGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  profiles: string[]; // Profile IDs
  expanded?: boolean;
}

export class EnhancedConnectionProfileManager {
  private profiles: Map<string, ConnectionProfile> = new Map();
  private groups: Map<string, ConnectionGroup> = new Map();
  private templates: Map<string, ConnectionTemplate> = new Map();
  private recentConnections: string[] = [];
  private maxRecentConnections = 10;

  constructor() {
    this.loadProfiles();
    this.loadGroups();
    this.loadTemplates();
    this.loadRecentConnections();
    this.initializeDefaultTemplates();
  }

  // Profile management
  createProfile(profile: Omit<ConnectionProfile, 'id' | 'metadata'>): string {
    const id = this.generateId();
    const fullProfile: ConnectionProfile = {
      ...profile,
      id,
      metadata: {
        createdAt: Date.now(),
        lastUsed: 0,
        useCount: 0,
        favorite: false,
        tags: [],
      },
    };

    this.profiles.set(id, fullProfile);
    this.saveProfiles();
    return id;
  }

  updateProfile(id: string, updates: Partial<ConnectionProfile>): boolean {
    const profile = this.profiles.get(id);
    if (!profile) return false;

    Object.assign(profile, updates);
    this.saveProfiles();
    return true;
  }

  deleteProfile(id: string): boolean {
    const deleted = this.profiles.delete(id);
    if (deleted) {
      // Remove from groups
      this.groups.forEach(group => {
        const index = group.profiles.indexOf(id);
        if (index > -1) {
          group.profiles.splice(index, 1);
        }
      });
      
      // Remove from recent connections
      this.recentConnections = this.recentConnections.filter(pid => pid !== id);
      
      this.saveProfiles();
      this.saveGroups();
      this.saveRecentConnections();
    }
    return deleted;
  }

  getProfile(id: string): ConnectionProfile | null {
    return this.profiles.get(id) || null;
  }

  getAllProfiles(): ConnectionProfile[] {
    return Array.from(this.profiles.values());
  }

  searchProfiles(query: string): ConnectionProfile[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.profiles.values()).filter(profile =>
      profile.name.toLowerCase().includes(lowerQuery) ||
      profile.hostname.toLowerCase().includes(lowerQuery) ||
      profile.username.toLowerCase().includes(lowerQuery) ||
      profile.description?.toLowerCase().includes(lowerQuery) ||
      profile.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getFavoriteProfiles(): ConnectionProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.metadata.favorite)
      .sort((a, b) => b.metadata.lastUsed - a.metadata.lastUsed);
  }

  getRecentProfiles(): ConnectionProfile[] {
    return this.recentConnections
      .map(id => this.profiles.get(id))
      .filter(Boolean) as ConnectionProfile[];
  }

  // Connection tracking
  recordConnection(profileId: string): void {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    profile.metadata.lastUsed = Date.now();
    profile.metadata.useCount++;

    // Update recent connections
    this.recentConnections = this.recentConnections.filter(id => id !== profileId);
    this.recentConnections.unshift(profileId);
    
    if (this.recentConnections.length > this.maxRecentConnections) {
      this.recentConnections = this.recentConnections.slice(0, this.maxRecentConnections);
    }

    this.saveProfiles();
    this.saveRecentConnections();
  }

  toggleFavorite(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    profile.metadata.favorite = !profile.metadata.favorite;
    this.saveProfiles();
    return true;
  }

  // Group management
  createGroup(group: Omit<ConnectionGroup, 'id'>): string {
    const id = this.generateId();
    const fullGroup: ConnectionGroup = {
      ...group,
      id,
    };

    this.groups.set(id, fullGroup);
    this.saveGroups();
    return id;
  }

  updateGroup(id: string, updates: Partial<ConnectionGroup>): boolean {
    const group = this.groups.get(id);
    if (!group) return false;

    Object.assign(group, updates);
    this.saveGroups();
    return true;
  }

  deleteGroup(id: string): boolean {
    const deleted = this.groups.delete(id);
    if (deleted) {
      this.saveGroups();
    }
    return deleted;
  }

  addProfileToGroup(groupId: string, profileId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group || !this.profiles.has(profileId)) return false;

    if (!group.profiles.includes(profileId)) {
      group.profiles.push(profileId);
      this.saveGroups();
    }
    return true;
  }

  removeProfileFromGroup(groupId: string, profileId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const index = group.profiles.indexOf(profileId);
    if (index > -1) {
      group.profiles.splice(index, 1);
      this.saveGroups();
      return true;
    }
    return false;
  }

  getAllGroups(): ConnectionGroup[] {
    return Array.from(this.groups.values());
  }

  getGroupedProfiles(): Array<{ group: ConnectionGroup; profiles: ConnectionProfile[] }> {
    return Array.from(this.groups.values()).map(group => ({
      group,
      profiles: group.profiles
        .map(id => this.profiles.get(id))
        .filter(Boolean) as ConnectionProfile[],
    }));
  }

  getUngroupedProfiles(): ConnectionProfile[] {
    const groupedProfileIds = new Set(
      Array.from(this.groups.values()).flatMap(group => group.profiles)
    );
    
    return Array.from(this.profiles.values())
      .filter(profile => !groupedProfileIds.has(profile.id));
  }

  // Template management
  createProfileFromTemplate(templateId: string, variables: Record<string, any>): string | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    // Apply variables to template
    const profileData = this.applyTemplateVariables(template.template, variables);
    
    return this.createProfile(profileData as Omit<ConnectionProfile, 'id' | 'metadata'>);
  }

  private applyTemplateVariables(template: Partial<ConnectionProfile>, variables: Record<string, any>): Partial<ConnectionProfile> {
    const result = JSON.parse(JSON.stringify(template));
    
    // Simple variable substitution
    const substitute = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          return variables[varName] || match;
        });
      } else if (Array.isArray(obj)) {
        return obj.map(substitute);
      } else if (obj && typeof obj === 'object') {
        const newObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
          newObj[key] = substitute(value);
        }
        return newObj;
      }
      return obj;
    };

    return substitute(result);
  }

  getAllTemplates(): ConnectionTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): ConnectionTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  // Import/Export
  exportProfiles(): string {
    return JSON.stringify({
      profiles: Array.from(this.profiles.values()),
      groups: Array.from(this.groups.values()),
      recentConnections: this.recentConnections,
      exportDate: new Date().toISOString(),
    }, null, 2);
  }

  importProfiles(data: string, mergeStrategy: 'replace' | 'merge' = 'merge'): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (mergeStrategy === 'replace') {
        this.profiles.clear();
        this.groups.clear();
        this.recentConnections = [];
      }

      if (parsed.profiles && Array.isArray(parsed.profiles)) {
        parsed.profiles.forEach((profile: ConnectionProfile) => {
          if (mergeStrategy === 'merge' && this.profiles.has(profile.id)) {
            // Generate new ID for conflicts
            profile.id = this.generateId();
          }
          this.profiles.set(profile.id, profile);
        });
      }

      if (parsed.groups && Array.isArray(parsed.groups)) {
        parsed.groups.forEach((group: ConnectionGroup) => {
          if (mergeStrategy === 'merge' && this.groups.has(group.id)) {
            group.id = this.generateId();
          }
          this.groups.set(group.id, group);
        });
      }

      if (parsed.recentConnections && Array.isArray(parsed.recentConnections)) {
        if (mergeStrategy === 'merge') {
          this.recentConnections = [
            ...new Set([...parsed.recentConnections, ...this.recentConnections])
          ].slice(0, this.maxRecentConnections);
        } else {
          this.recentConnections = parsed.recentConnections;
        }
      }

      this.saveProfiles();
      this.saveGroups();
      this.saveRecentConnections();
      return true;
    } catch (error) {
      console.error('Failed to import profiles:', error);
      return false;
    }
  }

  // Quick connect
  getQuickConnectProfiles(): ConnectionProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.quickConnect?.enabled)
      .sort((a, b) => b.metadata.lastUsed - a.metadata.lastUsed);
  }

  getAutoConnectProfiles(): ConnectionProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.quickConnect?.autoConnect);
  }

  getStartupConnectProfiles(): ConnectionProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.quickConnect?.connectOnStartup);
  }

  // Private methods
  private generateId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadProfiles() {
    try {
      const saved = localStorage.getItem('connection-profiles-enhanced');
      if (saved) {
        const profiles = JSON.parse(saved);
        profiles.forEach((profile: ConnectionProfile) => {
          this.profiles.set(profile.id, profile);
        });
      }
    } catch (error) {
      console.warn('Failed to load connection profiles:', error);
    }
  }

  private saveProfiles() {
    try {
      const profiles = Array.from(this.profiles.values());
      localStorage.setItem('connection-profiles-enhanced', JSON.stringify(profiles));
    } catch (error) {
      console.warn('Failed to save connection profiles:', error);
    }
  }

  private loadGroups() {
    try {
      const saved = localStorage.getItem('connection-groups');
      if (saved) {
        const groups = JSON.parse(saved);
        groups.forEach((group: ConnectionGroup) => {
          this.groups.set(group.id, group);
        });
      }
    } catch (error) {
      console.warn('Failed to load connection groups:', error);
    }
  }

  private saveGroups() {
    try {
      const groups = Array.from(this.groups.values());
      localStorage.setItem('connection-groups', JSON.stringify(groups));
    } catch (error) {
      console.warn('Failed to save connection groups:', error);
    }
  }

  private loadRecentConnections() {
    try {
      const saved = localStorage.getItem('recent-connections');
      if (saved) {
        this.recentConnections = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load recent connections:', error);
    }
  }

  private saveRecentConnections() {
    try {
      localStorage.setItem('recent-connections', JSON.stringify(this.recentConnections));
    } catch (error) {
      console.warn('Failed to save recent connections:', error);
    }
  }

  private initializeDefaultTemplates() {
    const defaultTemplates: ConnectionTemplate[] = [
      {
        id: 'aws-ec2',
        name: 'AWS EC2 Instance',
        description: 'Connect to an AWS EC2 instance',
        category: 'Cloud',
        template: {
          name: '{{instanceName}} ({{region}})',
          hostname: '{{hostname}}',
          port: 22,
          username: '{{username}}',
          authMethod: 'key',
          privateKeyPath: '~/.ssh/{{keyName}}.pem',
        },
        variables: [
          { name: 'instanceName', label: 'Instance Name', type: 'text', required: true },
          { name: 'hostname', label: 'Public IP/DNS', type: 'text', required: true },
          { name: 'username', label: 'Username', type: 'select', required: true, options: ['ec2-user', 'ubuntu', 'admin'], default: 'ec2-user' },
          { name: 'keyName', label: 'Key Pair Name', type: 'text', required: true },
          { name: 'region', label: 'AWS Region', type: 'text', required: false, default: 'us-east-1' },
        ],
      },
      {
        id: 'raspberry-pi',
        name: 'Raspberry Pi',
        description: 'Connect to a Raspberry Pi device',
        category: 'IoT',
        template: {
          name: 'Raspberry Pi ({{hostname}})',
          hostname: '{{hostname}}',
          port: 22,
          username: 'pi',
          authMethod: 'password',
        },
        variables: [
          { name: 'hostname', label: 'IP Address or Hostname', type: 'text', required: true },
        ],
      },
      {
        id: 'docker-container',
        name: 'Docker Container',
        description: 'Connect to a Docker container via SSH',
        category: 'Containers',
        template: {
          name: 'Docker: {{containerName}}',
          hostname: 'localhost',
          port: '{{port}}',
          username: 'root',
          authMethod: 'password',
        },
        variables: [
          { name: 'containerName', label: 'Container Name', type: 'text', required: true },
          { name: 'port', label: 'SSH Port', type: 'number', required: true, default: 2222 },
        ],
      },
    ];

    defaultTemplates.forEach(template => {
      if (!this.templates.has(template.id)) {
        this.templates.set(template.id, template);
      }
    });
  }
}

export const enhancedConnectionProfileManager = new EnhancedConnectionProfileManager();
