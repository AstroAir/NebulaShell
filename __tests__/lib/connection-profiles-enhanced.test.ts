import { EnhancedConnectionProfileManager } from '@/lib/connection-profiles-enhanced';
import { mockLocalStorage } from '../utils/test-utils';

describe('EnhancedConnectionProfileManager', () => {
  let profileManager: EnhancedConnectionProfileManager;
  let localStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    localStorage = mockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: localStorage,
      writable: true,
    });
    
    profileManager = new EnhancedConnectionProfileManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Profile Management', () => {
    const testProfile = {
      name: 'Test Server',
      description: 'A test server connection',
      hostname: 'test.example.com',
      port: 22,
      username: 'testuser',
      authMethod: 'password' as const,
      connectionOptions: {
        keepAlive: true,
        keepAliveInterval: 30,
        timeout: 10000,
        compression: false,
        forwardAgent: false,
        forwardX11: false,
      },
      environment: {
        variables: { NODE_ENV: 'production' },
        workingDirectory: '/home/testuser',
        shell: '/bin/bash',
      },
      tunnels: [],
      metadata: {
        tags: ['production', 'web'],
        color: '#3b82f6',
      },
      quickConnect: {
        enabled: true,
        autoConnect: false,
        connectOnStartup: false,
      },
    };

    it('creates a new profile', () => {
      const profileId = profileManager.createProfile(testProfile);
      
      expect(profileId).toBeDefined();
      expect(typeof profileId).toBe('string');
      
      const profiles = profileManager.getAllProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('Test Server');
      expect(profiles[0].id).toBe(profileId);
    });

    it('updates an existing profile', () => {
      const profileId = profileManager.createProfile(testProfile);
      
      const success = profileManager.updateProfile(profileId, {
        name: 'Updated Test Server',
        port: 2222,
      });
      
      expect(success).toBe(true);
      
      const profile = profileManager.getProfile(profileId);
      expect(profile?.name).toBe('Updated Test Server');
      expect(profile?.port).toBe(2222);
      expect(profile?.hostname).toBe('test.example.com'); // Should preserve other fields
    });

    it('deletes a profile', () => {
      const profileId = profileManager.createProfile(testProfile);
      
      const success = profileManager.deleteProfile(profileId);
      
      expect(success).toBe(true);
      expect(profileManager.getProfile(profileId)).toBeNull();
      expect(profileManager.getAllProfiles()).toHaveLength(0);
    });

    it('returns false when updating non-existent profile', () => {
      const success = profileManager.updateProfile('non-existent', { name: 'Updated' });
      
      expect(success).toBe(false);
    });

    it('returns false when deleting non-existent profile', () => {
      const success = profileManager.deleteProfile('non-existent');
      
      expect(success).toBe(false);
    });
  });

  describe('Group Management', () => {
    it('creates a new group', () => {
      const groupId = profileManager.createGroup({
        name: 'Production Servers',
        description: 'All production environment servers',
        color: '#ef4444',
        profiles: [],
      });
      
      expect(groupId).toBeDefined();
      
      const groups = profileManager.getAllGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('Production Servers');
    });

    it('assigns profile to group', () => {
      const groupId = profileManager.createGroup({
        name: 'Test Group',
        description: 'Test group',
        color: '#3b82f6',
        profiles: [],
      });
      
      const profileId = profileManager.createProfile({
        name: 'Test Server',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
      
      const success = profileManager.assignToGroup(profileId, groupId);
      
      expect(success).toBe(true);
      
      const profile = profileManager.getProfile(profileId);
      expect(profile?.groupId).toBe(groupId);
    });

    it('gets grouped profiles', () => {
      const groupId = profileManager.createGroup({
        name: 'Test Group',
        description: 'Test group',
        color: '#3b82f6',
        profiles: [],
      });
      
      const profileId1 = profileManager.createProfile({
        name: 'Server 1',
        hostname: 'server1.example.com',
        port: 22,
        username: 'user',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });

      const profileId2 = profileManager.createProfile({
        name: 'Server 2',
        hostname: 'server2.example.com',
        port: 22,
        username: 'user',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
      
      profileManager.assignToGroup(profileId1, groupId);
      profileManager.assignToGroup(profileId2, groupId);
      
      const groupedProfiles = profileManager.getGroupedProfiles();
      
      expect(groupedProfiles).toHaveLength(1);
      expect(groupedProfiles[0].group.name).toBe('Test Group');
      expect(groupedProfiles[0].profiles).toHaveLength(2);
    });
  });

  describe('Favorites and Recent', () => {
    let profileId: string;

    beforeEach(() => {
      profileId = profileManager.createProfile({
        name: 'Test Server',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
    });

    it('toggles favorite status', () => {
      const success = profileManager.toggleFavorite(profileId);
      
      expect(success).toBe(true);
      
      const profile = profileManager.getProfile(profileId);
      expect(profile?.metadata.favorite).toBe(true);
      
      // Toggle back
      profileManager.toggleFavorite(profileId);
      const updatedProfile = profileManager.getProfile(profileId);
      expect(updatedProfile?.metadata.favorite).toBe(false);
    });

    it('records connection usage', () => {
      profileManager.recordConnection(profileId);
      
      const profile = profileManager.getProfile(profileId);
      expect(profile?.metadata.useCount).toBe(1);
      expect(profile?.metadata.lastUsed).toBeGreaterThan(0);
    });

    it('gets favorite profiles', () => {
      profileManager.toggleFavorite(profileId);
      
      const favorites = profileManager.getFavoriteProfiles();
      
      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe(profileId);
    });

    it('gets recent profiles', () => {
      profileManager.recordConnection(profileId);
      
      const recent = profileManager.getRecentProfiles();
      
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe(profileId);
    });

    it('gets quick connect profiles', () => {
      profileManager.updateProfile(profileId, {
        quickConnect: { enabled: true, autoConnect: false, connectOnStartup: false },
      });
      
      const quickConnect = profileManager.getQuickConnectProfiles();
      
      expect(quickConnect).toHaveLength(1);
      expect(quickConnect[0].id).toBe(profileId);
    });
  });

  describe('Templates', () => {
    it('gets all templates', () => {
      const templates = profileManager.getAllTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Should include built-in templates
      expect(templates.some(t => t.category === 'cloud')).toBe(true);
      expect(templates.some(t => t.category === 'development')).toBe(true);
    });

    it('creates profile from template', () => {
      const templates = profileManager.getAllTemplates();
      const awsTemplate = templates.find(t => t.id === 'aws-ec2');
      
      if (awsTemplate) {
        const profileId = profileManager.createFromTemplate(awsTemplate.id, {
          name: 'My AWS Server',
          hostname: 'ec2-123-456-789.compute-1.amazonaws.com',
          username: 'ec2-user',
        });
        
        expect(profileId).toBeDefined();
        
        const profile = profileManager.getProfile(profileId!);
        expect(profile?.name).toBe('My AWS Server');
        expect(profile?.port).toBe(22); // From template
        expect(profile?.authMethod).toBe('key'); // From template
      }
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      // Create test profiles
      profileManager.createProfile({
        name: 'Production Web Server',
        hostname: 'web.prod.example.com',
        port: 22,
        username: 'deploy',
        authMethod: 'key' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });

      profileManager.createProfile({
        name: 'Development Database',
        hostname: 'db.dev.example.com',
        port: 5432,
        username: 'postgres',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
    });

    it('searches profiles by name', () => {
      const results = profileManager.searchProfiles('web');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Production Web Server');
    });

    it('searches profiles by hostname', () => {
      const results = profileManager.searchProfiles('db.dev');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Development Database');
    });

    it('searches profiles by tags', () => {
      const results = profileManager.searchProfiles('production');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Production Web Server');
    });

    it('filters profiles by auth method', () => {
      const keyProfiles = profileManager.getProfilesByAuthMethod('key');
      const passwordProfiles = profileManager.getProfilesByAuthMethod('password');
      
      expect(keyProfiles).toHaveLength(1);
      expect(passwordProfiles).toHaveLength(1);
    });
  });

  describe('Import/Export', () => {
    beforeEach(() => {
      // Create test data
      const groupId = profileManager.createGroup({
        name: 'Test Group',
        description: 'Test group',
        color: '#3b82f6',
        profiles: [],
      });
      
      const profileId = profileManager.createProfile({
        name: 'Test Server',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
      
      profileManager.assignToGroup(profileId, groupId);
    });

    it('exports profiles and groups', () => {
      const exportData = profileManager.exportProfiles();
      const parsed = JSON.parse(exportData);
      
      expect(parsed.profiles).toBeDefined();
      expect(parsed.groups).toBeDefined();
      expect(parsed.exportDate).toBeDefined();
      expect(parsed.version).toBeDefined();
      
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.groups).toHaveLength(1);
    });

    it('imports profiles and groups', () => {
      const exportData = profileManager.exportProfiles();

      // Create new manager and import with replace strategy
      const newManager = new EnhancedConnectionProfileManager();
      const success = newManager.importProfiles(exportData, 'replace');

      expect(success).toBe(true);

      const profiles = newManager.getAllProfiles();
      const groups = newManager.getAllGroups();

      expect(profiles).toHaveLength(1);
      expect(groups).toHaveLength(1);
      expect(profiles[0].name).toBe('Test Server');
    });

    it('handles invalid import data', () => {
      const success = profileManager.importProfiles('invalid json');
      
      expect(success).toBe(false);
    });

    it('merges imported data with existing data', () => {
      const exportData = profileManager.exportProfiles();
      
      // Add another profile
      profileManager.createProfile({
        name: 'Another Server',
        hostname: 'another.example.com',
        port: 22,
        username: 'user',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
      
      // Import should merge
      const success = profileManager.importProfiles(exportData);
      
      expect(success).toBe(true);
      
      const profiles = profileManager.getAllProfiles();
      expect(profiles.length).toBeGreaterThan(1);
    });
  });

  describe('Persistence', () => {
    it('saves data to localStorage on changes', () => {
      profileManager.createProfile({
        name: 'Test Server',
        hostname: 'test.example.com',
        port: 22,
        username: 'testuser',
        authMethod: 'password' as const,
        connectionOptions: {
          keepAlive: true,
          timeout: 10000,
        },
      });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'connection-profiles-enhanced',
        expect.any(String)
      );
    });

    it('loads data from localStorage on initialization', () => {
      const testProfiles = [
        {
          id: 'test-1',
          name: 'Saved Server',
          hostname: 'saved.example.com',
          port: 22,
          username: 'user',
          authMethod: 'password',
          connectionOptions: {
            keepAlive: true,
            timeout: 10000,
          },
          metadata: {
            createdAt: Date.now(),
            lastUsed: 0,
            useCount: 0,
            favorite: false,
            tags: [],
          },
        },
      ];

      // Mock different localStorage keys
      localStorage.getItem.mockImplementation((key: string) => {
        switch (key) {
          case 'connection-profiles-enhanced':
            return JSON.stringify(testProfiles);
          case 'connection-groups':
            return JSON.stringify([]);
          case 'connection-templates':
            return JSON.stringify([]);
          case 'recent-connections':
            return JSON.stringify([]);
          default:
            return null;
        }
      });

      const newManager = new EnhancedConnectionProfileManager();
      const profiles = newManager.getAllProfiles();

      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('Saved Server');
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      expect(() => {
        profileManager.createProfile({
          name: 'Test Server',
          hostname: 'test.example.com',
          port: 22,
          username: 'testuser',
          authMethod: 'password' as const,
          connectionOptions: {
            keepAlive: true,
            timeout: 10000,
          },
        });
      }).not.toThrow();
    });
  });
});
