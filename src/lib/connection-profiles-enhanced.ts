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
  groupId?: string; // Optional group assignment
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
    const profile = this.profiles.get(profileId);
    if (!group || !profile) return false;

    if (!group.profiles.includes(profileId)) {
      group.profiles.push(profileId);
      profile.groupId = groupId;
      this.saveGroups();
      this.saveProfiles();
    }
    return true;
  }

  removeProfileFromGroup(groupId: string, profileId: string): boolean {
    const group = this.groups.get(groupId);
    const profile = this.profiles.get(profileId);
    if (!group) return false;

    const index = group.profiles.indexOf(profileId);
    if (index > -1) {
      group.profiles.splice(index, 1);
      if (profile) {
        profile.groupId = undefined;
        this.saveProfiles();
      }
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

  // Alias method for test compatibility
  assignToGroup(profileId: string, groupId: string): boolean {
    return this.addProfileToGroup(groupId, profileId);
  }

  // Get profiles by authentication method
  getProfilesByAuthMethod(authMethod: 'password' | 'key' | 'agent'): ConnectionProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.authMethod === authMethod);
  }

  // Template management
  createProfileFromTemplate(templateId: string, variables: Record<string, any>): string | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    // Apply variables to template
    const profileData = this.applyTemplateVariables(template.template, variables);

    return this.createProfile(profileData as Omit<ConnectionProfile, 'id' | 'metadata'>);
  }

  // Alias for backward compatibility
  createFromTemplate(templateId: string, variables: Record<string, any>): string | null {
    return this.createProfileFromTemplate(templateId, variables);
  }

  private applyTemplateVariables(template: Partial<ConnectionProfile>, variables: Record<string, any>): Partial<ConnectionProfile> {
    const result = JSON.parse(JSON.stringify(template));

    // Enhanced variable substitution with type handling
    const substitute = (obj: any): any => {
      if (typeof obj === 'string') {
        // Handle full string replacement (e.g., port: "{{port}}" -> port: 2222)
        const fullMatch = obj.match(/^\{\{(\w+)\}\}$/);
        if (fullMatch) {
          const varName = fullMatch[1];
          return variables.hasOwnProperty(varName) ? variables[varName] : obj;
        }

        // Handle partial string replacement (e.g., "{{name}} Server" -> "My Server")
        return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          return variables.hasOwnProperty(varName) ? String(variables[varName]) : match;
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

    // Apply direct variable assignments for top-level properties
    const substituted = substitute(result);

    // Override with direct variable assignments if they exist
    Object.keys(variables).forEach(key => {
      if (substituted.hasOwnProperty(key)) {
        substituted[key] = variables[key];
      }
    });

    return substituted;
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
      version: '1.0',
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
    return `profile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private loadProfiles() {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const saved = localStorage.getItem('connection-profiles-enhanced');
      if (saved) {
        const profiles = JSON.parse(saved);

        // Validate data structure
        if (Array.isArray(profiles)) {
          profiles.forEach((profile: any) => {
            if (this.isValidProfile(profile)) {
              this.profiles.set(profile.id, profile);
            } else {
              console.warn('Invalid profile data found, skipping:', profile);
            }
          });
        } else {
          console.warn('Invalid profiles data structure, expected array');
        }
      }
    } catch (error) {
      console.error('Failed to load connection profiles:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('connection-profiles-enhanced');
      } catch (clearError) {
        console.error('Failed to clear corrupted profile data:', clearError);
      }
    }
  }

  private saveProfiles() {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const profiles = Array.from(this.profiles.values());
      localStorage.setItem('connection-profiles-enhanced', JSON.stringify(profiles));
    } catch (error) {
      console.error('Failed to save connection profiles:', error);
      // Attempt to free up space by removing old data
      try {
        localStorage.removeItem('connection-profiles-enhanced-backup');
      } catch (cleanupError) {
        console.error('Failed to cleanup storage:', cleanupError);
      }
    }
  }

  private isValidProfile(profile: any): profile is ConnectionProfile {
    return (
      profile &&
      typeof profile === 'object' &&
      typeof profile.id === 'string' &&
      typeof profile.name === 'string' &&
      typeof profile.hostname === 'string' &&
      typeof profile.port === 'number' &&
      typeof profile.username === 'string' &&
      ['password', 'key', 'agent'].includes(profile.authMethod) &&
      profile.metadata &&
      typeof profile.metadata === 'object' &&
      typeof profile.metadata.createdAt === 'number'
    );
  }

  private isValidGroup(group: any): group is ConnectionGroup {
    return (
      group &&
      typeof group === 'object' &&
      typeof group.id === 'string' &&
      typeof group.name === 'string' &&
      typeof group.color === 'string' &&
      Array.isArray(group.profiles)
    );
  }

  private loadGroups() {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const saved = localStorage.getItem('connection-groups');
      if (saved) {
        const groups = JSON.parse(saved);

        // Validate data structure
        if (Array.isArray(groups)) {
          groups.forEach((group: any) => {
            if (this.isValidGroup(group)) {
              this.groups.set(group.id, group);
            } else {
              console.warn('Invalid group data found, skipping:', group);
            }
          });
        } else {
          console.warn('Invalid groups data structure, expected array');
        }
      }
    } catch (error) {
      console.error('Failed to load connection groups:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('connection-groups');
      } catch (clearError) {
        console.error('Failed to clear corrupted group data:', clearError);
      }
    }
  }

  private loadTemplates() {
    try {
      const saved = localStorage.getItem('connection-templates');
      if (saved) {
        const templates = JSON.parse(saved);
        if (Array.isArray(templates)) {
          templates.forEach((template: ConnectionTemplate) => {
            this.templates.set(template.id, template);
          });
        } else {
          console.warn('Invalid templates data structure, expected array');
        }
      }
    } catch (error) {
      console.warn('Failed to load connection templates:', error);
    }
  }

  private saveGroups() {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const groups = Array.from(this.groups.values());
      localStorage.setItem('connection-groups', JSON.stringify(groups));
    } catch (error) {
      console.error('Failed to save connection groups:', error);
      // Attempt to free up space by removing old data
      try {
        localStorage.removeItem('connection-groups-backup');
      } catch (cleanupError) {
        console.error('Failed to cleanup group storage:', cleanupError);
      }
    }
  }

  private loadRecentConnections() {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const saved = localStorage.getItem('recent-connections');
      if (saved) {
        const connections = JSON.parse(saved);

        // Validate data structure
        if (Array.isArray(connections) && connections.every(id => typeof id === 'string')) {
          this.recentConnections = connections;
        } else {
          console.warn('Invalid recent connections data structure, expected array of strings');
          this.recentConnections = [];
        }
      }
    } catch (error) {
      console.error('Failed to load recent connections:', error);
      this.recentConnections = [];
      // Clear corrupted data
      try {
        localStorage.removeItem('recent-connections');
      } catch (clearError) {
        console.error('Failed to clear corrupted recent connections data:', clearError);
      }
    }
  }

  private saveRecentConnections() {
    // Guard against SSR
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.setItem('recent-connections', JSON.stringify(this.recentConnections));
    } catch (error) {
      console.error('Failed to save recent connections:', error);
      // Attempt to free up space by removing old data
      try {
        localStorage.removeItem('recent-connections-backup');
      } catch (cleanupError) {
        console.error('Failed to cleanup recent connections storage:', cleanupError);
      }
    }
  }

  private initializeDefaultTemplates() {
    const defaultTemplates: ConnectionTemplate[] = [
      {
        id: 'aws-ec2',
        name: 'AWS EC2 Instance',
        description: 'Connect to an AWS EC2 instance',
        category: 'cloud',
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
        category: 'containers',
        template: {
          name: 'Docker: {{containerName}}',
          hostname: 'localhost',
          port: 2222, // Will be replaced by template variable
          username: 'root',
          authMethod: 'password',
          connectionOptions: {
            keepAlive: true,
            timeout: 10000,
          },
        },
        variables: [
          { name: 'containerName', label: 'Container Name', type: 'text', required: true },
          { name: 'port', label: 'SSH Port', type: 'number', required: true, default: 2222 },
        ],
      },
      {
        id: 'dev-server',
        name: 'Development Server',
        description: 'Connect to a development server',
        category: 'development',
        template: {
          name: 'Dev: {{serverName}}',
          hostname: '{{hostname}}',
          port: 22,
          username: '{{username}}',
          authMethod: 'password',
          connectionOptions: {
            keepAlive: true,
            timeout: 10000,
          },
        },
        variables: [
          { name: 'serverName', label: 'Server Name', type: 'text', required: true },
          { name: 'hostname', label: 'Hostname or IP', type: 'text', required: true },
          { name: 'username', label: 'Username', type: 'text', required: true, default: 'developer' },
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
