import { ConnectionProfileManager } from '../connection-profile-manager'
import { SSHConnectionConfig } from '@/types/ssh'
import { logger } from '../logger'

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('ConnectionProfileManager', () => {
  let manager: ConnectionProfileManager
  let mockConfig: Omit<SSHConnectionConfig, 'id'>

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    
    manager = new ConnectionProfileManager()
    
    mockConfig = {
      hostname: 'example.com',
      port: 22,
      username: 'testuser',
      password: 'testpass',
    }
  })

  describe('Profile Creation', () => {
    it('should create a profile with basic config', () => {
      const profile = manager.createProfile('Test Profile', mockConfig)
      
      expect(profile.id).toBeDefined()
      expect(profile.name).toBe('Test Profile')
      expect(profile.config).toEqual(mockConfig)
      expect(profile.favorite).toBe(false)
      expect(profile.useCount).toBe(0)
      expect(profile.createdAt).toBeInstanceOf(Date)
      expect(profile.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a profile with options', () => {
      const options = {
        description: 'Test description',
        tags: ['production', 'web'],
        color: '#ff0000',
        icon: 'server',
      }
      
      const profile = manager.createProfile('Test Profile', mockConfig, options)
      
      expect(profile.description).toBe('Test description')
      expect(profile.tags).toEqual(['production', 'web'])
      expect(profile.color).toBe('#ff0000')
      expect(profile.icon).toBe('server')
    })

    it('should generate unique IDs for profiles', () => {
      const profile1 = manager.createProfile('Profile 1', mockConfig)
      const profile2 = manager.createProfile('Profile 2', mockConfig)
      
      expect(profile1.id).not.toBe(profile2.id)
    })
  })

  describe('Profile Retrieval', () => {
    let testProfile: any

    beforeEach(() => {
      testProfile = manager.createProfile('Test Profile', mockConfig)
    })

    it('should get profile by ID', () => {
      const retrieved = manager.getProfile(testProfile.id)
      expect(retrieved).toEqual(testProfile)
    })

    it('should return null for non-existent profile', () => {
      const retrieved = manager.getProfile('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('should get all profiles', () => {
      const profile2 = manager.createProfile('Profile 2', mockConfig)
      const allProfiles = manager.getAllProfiles()
      
      expect(allProfiles).toHaveLength(2)
      expect(allProfiles).toContain(testProfile)
      expect(allProfiles).toContain(profile2)
    })
  })

  describe('Profile Updates', () => {
    let testProfile: any

    beforeEach(() => {
      testProfile = manager.createProfile('Test Profile', mockConfig)
    })

    it('should update profile successfully', () => {
      const updates = {
        name: 'Updated Profile',
        description: 'Updated description',
      }

      const updated = manager.updateProfile(testProfile.id, updates)

      expect(updated).toBe(true)

      // Verify the profile was actually updated
      const retrievedProfile = manager.getProfile(testProfile.id)
      expect(retrievedProfile!.name).toBe('Updated Profile')
      expect(retrievedProfile!.description).toBe('Updated description')
    })

    it('should return false for non-existent profile update', () => {
      const updated = manager.updateProfile('non-existent-id', { name: 'New Name' })
      expect(updated).toBe(false)
    })

    it('should toggle favorite status', () => {
      expect(testProfile.favorite).toBe(false)

      const updated = manager.toggleFavorite(testProfile.id)
      expect(updated).toBe(true)

      // Verify the profile was actually toggled
      const retrievedProfile = manager.getProfile(testProfile.id)
      expect(retrievedProfile!.favorite).toBe(true)

      const toggledBack = manager.toggleFavorite(testProfile.id)
      expect(toggledBack).toBe(true)

      const retrievedAgain = manager.getProfile(testProfile.id)
      expect(retrievedAgain!.favorite).toBe(false)
    })
  })

  describe('Profile Deletion', () => {
    let testProfile: any

    beforeEach(() => {
      testProfile = manager.createProfile('Test Profile', mockConfig)
    })

    it('should delete profile successfully', () => {
      const deleted = manager.deleteProfile(testProfile.id)
      expect(deleted).toBe(true)
      
      const retrieved = manager.getProfile(testProfile.id)
      expect(retrieved).toBeNull()
    })

    it('should return false for non-existent profile deletion', () => {
      const deleted = manager.deleteProfile('non-existent-id')
      expect(deleted).toBe(false)
    })
  })

  describe('Profile Search', () => {
    beforeEach(() => {
      manager.createProfile('Web Server', mockConfig, { tags: ['web', 'production'] })
      manager.createProfile('Database Server', { ...mockConfig, hostname: 'db.example.com' }, { tags: ['database'] })
      manager.createProfile('Test Server', { ...mockConfig, hostname: 'test.example.com' }, { tags: ['test'] })
    })

    it('should search by name', () => {
      const results = manager.searchProfiles({ query: 'Web' })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Web Server')
    })

    it('should search by hostname', () => {
      const results = manager.searchProfiles({ query: 'db.example' })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Database Server')
    })

    it('should filter by tags', () => {
      const results = manager.searchProfiles({ tags: ['production'] })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Web Server')
    })

    it('should filter favorites only', () => {
      const profiles = manager.getAllProfiles()
      manager.toggleFavorite(profiles[0].id)
      
      const results = manager.searchProfiles({ favorite: true })
      expect(results).toHaveLength(1)
      expect(results[0].favorite).toBe(true)
    })
  })

  describe('Storage Operations', () => {
    it('should save to storage when profile is created', () => {
      manager.createProfile('Test Profile', mockConfig)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'webssh_connection_profiles',
        expect.any(String)
      )
    })

    it('should load from storage on initialization', () => {
      const mockProfile = {
        id: 'test-id',
        name: 'Stored Profile',
        config: mockConfig,
        tags: [],
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        useCount: 0,
      }

      const mockData = {
        profiles: [['test-id', mockProfile]], // Array of [id, profile] tuples
        groups: [],
        history: [],
        quickConnect: [],
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData))

      const newManager = new ConnectionProfileManager()
      const profiles = newManager.getAllProfiles()

      expect(profiles).toHaveLength(1)
      expect(profiles[0].name).toBe('Stored Profile')
    })

    it('should handle corrupted storage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      expect(() => new ConnectionProfileManager()).not.toThrow()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('Event Emission', () => {
    it('should emit events on profile creation', (done) => {
      manager.on('profileCreated', (profile) => {
        expect(profile.name).toBe('Test Profile')
        done()
      })
      
      manager.createProfile('Test Profile', mockConfig)
    })

    it('should emit events on profile update', (done) => {
      const profile = manager.createProfile('Test Profile', mockConfig)
      
      manager.on('profileUpdated', (updatedProfile) => {
        expect(updatedProfile.name).toBe('Updated Name')
        done()
      })
      
      manager.updateProfile(profile.id, { name: 'Updated Name' })
    })

    it('should emit events on profile deletion', (done) => {
      const profile = manager.createProfile('Test Profile', mockConfig)

      manager.on('profileDeleted', (deletedProfile) => {
        expect(deletedProfile.id).toBe(profile.id)
        expect(deletedProfile.name).toBe('Test Profile')
        done()
      })

      manager.deleteProfile(profile.id)
    })
  })
})
