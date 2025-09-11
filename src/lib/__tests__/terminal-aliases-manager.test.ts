import { TerminalAliasesManager } from '../terminal-aliases-manager'
import { CommandAlias } from '@/types/terminal-aliases'
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

describe('TerminalAliasesManager', () => {
  let manager: TerminalAliasesManager
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)

    manager = new TerminalAliasesManager()
  })

  describe('Alias Creation', () => {
    it('should create a basic alias', () => {
      const alias = manager.createAlias('test', 'echo hello')

      expect(alias.name).toBe('test')
      expect(alias.command).toBe('echo hello')
      expect(alias.id).toBeDefined()
      expect(alias.createdAt).toBeInstanceOf(Date)
      expect(alias.useCount).toBe(0)
    })

    it('should create alias with options', () => {
      const options = {
        description: 'Test description',
        category: 'testing',
        parameters: [{
          name: 'file',
          description: 'File name',
          required: true,
          type: 'string' as const,
          position: 1
        }],
      }

      const alias = manager.createAlias('test', 'echo $file', options)

      expect(alias.description).toBe('Test description')
      expect(alias.category).toBe('testing')
      expect(alias.parameters).toHaveLength(1)
      expect(alias.parameters![0].name).toBe('file')
    })

    it('should prevent duplicate alias names', () => {
      manager.createAlias('test', 'echo first')

      expect(() => {
        manager.createAlias('test', 'echo second')
      }).toThrow("Alias 'test' already exists")
    })

    it('should emit event when alias is created', (done) => {
      manager.on('aliasCreated', (alias) => {
        expect(alias.name).toBe('test')
        done()
      })
      
      manager.createAlias('test', 'echo hello')
    })
  })

  describe('Alias Retrieval', () => {
    beforeEach(() => {
      manager.createAlias('test1', 'echo test1')
      manager.createAlias('test2', 'echo test2', { category: 'testing' })
    })

    it('should get alias by name', () => {
      const alias = manager.getAlias('test1')
      expect(alias).toBeDefined()
      expect(alias!.command).toBe('echo test1')
    })

    it('should return undefined for non-existent alias', () => {
      const alias = manager.getAlias('nonexistent')
      expect(alias).toBeUndefined()
    })

    it('should get all aliases', () => {
      const aliases = manager.getAllAliases()
      expect(aliases.length).toBeGreaterThanOrEqual(2) // At least our 2 + built-ins
      
      const testAliases = aliases.filter(a => a.name.startsWith('test'))
      expect(testAliases).toHaveLength(2)
    })

    it('should search aliases', () => {
      const results = manager.searchAliases({ query: 'test1' })
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some(r => r.name === 'test1')).toBe(true)
    })

    it('should check if alias exists', () => {
      expect(manager.hasAlias('test1')).toBe(true)
      expect(manager.hasAlias('nonexistent')).toBe(false)
    })
  })

  describe('Alias Updates', () => {
    let testAlias: CommandAlias

    beforeEach(() => {
      testAlias = manager.createAlias('test', 'echo original')
    })

    it('should update alias successfully', () => {
      const updates = {
        command: 'echo updated',
        description: 'Updated description',
      }

      const updated = manager.updateAlias('test', updates)
      expect(updated).toBe(true)

      const alias = manager.getAlias('test')
      expect(alias!.command).toBe('echo updated')
      expect(alias!.description).toBe('Updated description')
    })

    it('should return false for non-existent alias', () => {
      const updated = manager.updateAlias('nonexistent', { command: 'echo test' })
      expect(updated).toBe(false)
    })

    it('should increment use count when alias is used', () => {
      const originalCount = testAlias.useCount

      // Simulate using the alias by expanding a command
      manager.expandCommand('test')

      const alias = manager.getAlias('test')
      expect(alias!.useCount).toBe(originalCount + 1)
    })
  })

  describe('Alias Deletion', () => {
    beforeEach(() => {
      manager.createAlias('test', 'echo test')
    })

    it('should delete alias successfully', () => {
      const deleted = manager.deleteAlias('test')
      expect(deleted).toBe(true)

      const alias = manager.getAlias('test')
      expect(alias).toBeUndefined()
    })

    it('should return false for non-existent alias', () => {
      const deleted = manager.deleteAlias('nonexistent')
      expect(deleted).toBe(false)
    })

    it('should handle deletion gracefully', () => {
      // Just test that deletion works for custom aliases
      const deleted = manager.deleteAlias('test')
      expect(deleted).toBe(true)
    })
  })

  describe('Command Expansion', () => {
    beforeEach(() => {
      manager.createAlias('hello', 'echo "Hello World"')
      manager.createAlias('greet', 'echo "Hello $name"', {
        parameters: [{
          name: 'name',
          description: 'Name to greet',
          required: true,
          type: 'string' as const,
          position: 1
        }]
      })
    })

    it('should expand simple command', () => {
      const result = manager.expandCommand('hello')
      expect(result).toBeDefined()
      expect(result!.alias.name).toBe('hello')
      expect(result!.expandedCommand).toBe('echo "Hello World"')
    })

    it('should return null for non-existent alias', () => {
      const result = manager.expandCommand('nonexistent command')
      expect(result).toBeNull()
    })

    it('should handle empty input', () => {
      const result = manager.expandCommand('')
      expect(result).toBeNull()
    })
  })

  describe('Built-in Aliases', () => {
    it('should initialize with built-in aliases', () => {
      const aliases = manager.getAllAliases()

      expect(aliases.length).toBeGreaterThan(0)

      // Check for some common built-in aliases
      const llAlias = aliases.find(a => a.name === 'll')
      expect(llAlias).toBeDefined()
      expect(llAlias!.command).toBe('ls -la')
    })

    it('should not duplicate built-in aliases on multiple initializations', () => {
      const initialCount = manager.getAllAliases().length

      // Create a new manager (which would re-initialize built-ins)
      const newManager = new TerminalAliasesManager()
      const newCount = newManager.getAllAliases().length

      expect(newCount).toBe(initialCount)
    })
  })

  describe('Settings Management', () => {
    it('should get current settings', () => {
      const settings = manager.getSettings()
      
      expect(settings.enabled).toBe(true)
      expect(settings.maxExpansionDepth).toBe(5)
    })

    it('should update settings', () => {
      const newSettings = {
        enabled: false,
        showExpansion: true,
        maxExpansionDepth: 3,
      }
      
      manager.updateSettings(newSettings)
      const settings = manager.getSettings()
      
      expect(settings.enabled).toBe(false)
      expect(settings.showExpansion).toBe(true)
      expect(settings.maxExpansionDepth).toBe(3)
    })
  })

  describe('Storage Operations', () => {
    it('should save to storage when alias is created', () => {
      manager.createAlias('test', 'echo test')
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'webssh_terminal_aliases',
        expect.any(String)
      )
    })

    it('should handle corrupted storage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      expect(() => new TerminalAliasesManager()).not.toThrow()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('Import and Export', () => {
    beforeEach(() => {
      manager.createAlias('test1', 'echo test1')
      manager.createAlias('test2', 'echo test2')
    })

    it('should export aliases', () => {
      const exported = manager.exportAliases()
      
      expect(exported.aliases.length).toBeGreaterThanOrEqual(2)
      expect(exported.version).toBeDefined()
      expect(exported.exportedAt).toBeInstanceOf(Date)
    })

    it('should export all aliases', () => {
      const exported = manager.exportAliases()

      expect(exported.aliases.length).toBeGreaterThanOrEqual(2)
      expect(exported.version).toBeDefined()
      expect(exported.exportedAt).toBeInstanceOf(Date)
    })
  })
})
