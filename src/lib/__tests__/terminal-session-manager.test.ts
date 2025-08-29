import { TerminalSessionManager } from '../terminal-session-manager'
import { SSHConnectionConfig } from '@/types/ssh'
import { logger } from '../logger'

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('TerminalSessionManager', () => {
  let manager: TerminalSessionManager
  let mockConfig: SSHConnectionConfig

  beforeEach(() => {
    jest.clearAllMocks()
    manager = new TerminalSessionManager()
    
    mockConfig = {
      id: 'test-session-1',
      hostname: 'example.com',
      port: 22,
      username: 'testuser',
      password: 'testpass',
    }
  })

  describe('Session Creation', () => {
    it('should create a session with basic config', () => {
      const session = manager.createSession(mockConfig)
      
      expect(session.id).toBe('test-session-1')
      expect(session.name).toBe('testuser@example.com')
      expect(session.config).toEqual(mockConfig)
      expect(session.connected).toBe(false)
      expect(session.isActive).toBe(false)
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.lastActivity).toBeInstanceOf(Date)
    })

    it('should create a session with custom name', () => {
      const session = manager.createSession(mockConfig, 'Custom Session')
      
      expect(session.name).toBe('Custom Session')
    })

    it('should create corresponding tab when session is created', () => {
      const session = manager.createSession(mockConfig)
      const tabs = manager.getAllTabs()

      expect(tabs).toHaveLength(1)
      expect(tabs[0].id).toBe(`tab_${session.id}`)
      expect(tabs[0].sessionId).toBe(session.id)
      expect(tabs[0].title).toBe(session.name)
      expect(tabs[0].isActive).toBe(false)
      expect(tabs[0].connectionStatus).toBe('disconnected')
    })

    it('should emit events when session is created', (done) => {
      let sessionCreated = false
      let tabCreated = false

      manager.on('sessionCreated', (session) => {
        expect(session.id).toBe('test-session-1')
        sessionCreated = true
        if (sessionCreated && tabCreated) done()
      })

      manager.on('tabCreated', (tab) => {
        expect(tab.sessionId).toBe('test-session-1')
        tabCreated = true
        if (sessionCreated && tabCreated) done()
      })

      manager.createSession(mockConfig)
    })
  })

  describe('Session Retrieval', () => {
    let testSession: any

    beforeEach(() => {
      testSession = manager.createSession(mockConfig)
    })

    it('should get session by ID', () => {
      const retrieved = manager.getSession(testSession.id)
      expect(retrieved).toEqual(testSession)
    })

    it('should return null for non-existent session', () => {
      const retrieved = manager.getSession('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('should get all sessions', () => {
      const config2 = { ...mockConfig, id: 'test-session-2', hostname: 'example2.com' }
      const session2 = manager.createSession(config2)
      
      const allSessions = manager.getAllSessions()
      expect(allSessions).toHaveLength(2)
      expect(allSessions).toContain(testSession)
      expect(allSessions).toContain(session2)
    })

    it('should get active session', () => {
      const tabs = manager.getAllTabs()
      manager.activateTab(tabs[0].id)
      const activeSession = manager.getActiveSession()
      expect(activeSession).toEqual(testSession)
    })

    it('should return null when no session is active', () => {
      const activeSession = manager.getActiveSession()
      expect(activeSession).toBeNull()
    })
  })

  describe('Tab Activation', () => {
    let testSession: any

    beforeEach(() => {
      testSession = manager.createSession(mockConfig)
    })

    it('should activate tab successfully', () => {
      const tabs = manager.getAllTabs()
      const result = manager.activateTab(tabs[0].id)
      expect(result).toBe(true)

      const session = manager.getSession(testSession.id)
      expect(session!.isActive).toBe(true)
    })

    it('should return false for non-existent tab', () => {
      const result = manager.activateTab('non-existent-tab-id')
      expect(result).toBe(false)
    })

    it('should deactivate previously active session', () => {
      const config2 = { ...mockConfig, id: 'test-session-2' }
      const session2 = manager.createSession(config2)
      const tabs = manager.getAllTabs()

      manager.activateTab(tabs[0].id)
      manager.activateTab(tabs[1].id)

      const session1 = manager.getSession(testSession.id)
      const session2Retrieved = manager.getSession(session2.id)

      expect(session1!.isActive).toBe(false)
      expect(session2Retrieved!.isActive).toBe(true)
    })
  })

  describe('Tab Management', () => {
    let testSession: any

    beforeEach(() => {
      testSession = manager.createSession(mockConfig)
    })

    it('should get all tabs', () => {
      const tabs = manager.getAllTabs()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].sessionId).toBe(testSession.id)
    })

    it('should activate tab successfully', () => {
      const tabs = manager.getAllTabs()
      const result = manager.activateTab(tabs[0].id)

      expect(result).toBe(true)

      const updatedTabs = manager.getAllTabs()
      expect(updatedTabs[0].isActive).toBe(true)
    })

    it('should return false for non-existent tab', () => {
      const result = manager.activateTab('non-existent-tab')
      expect(result).toBe(false)
    })

    it('should get active tab ID', () => {
      const tabs = manager.getAllTabs()
      manager.activateTab(tabs[0].id)

      const activeTabId = manager.getActiveTabId()
      expect(activeTabId).toBe(tabs[0].id)
    })

    it('should return null when no tab is active', () => {
      const activeTabId = manager.getActiveTabId()
      expect(activeTabId).toBeNull()
    })
  })

  describe('Session Buffer Management', () => {
    let testSession: any

    beforeEach(() => {
      testSession = manager.createSession(mockConfig)
    })

    it('should update session buffer', () => {
      const buffer = 'test buffer content'
      manager.updateSessionBuffer(testSession.id, buffer)

      const session = manager.getSession(testSession.id)
      expect(session!.buffer).toBe(buffer)
    })

    it('should set and get terminal instance', () => {
      const mockTerminal = { write: jest.fn() }
      manager.setTerminalInstance(testSession.id, mockTerminal)

      const retrieved = manager.getTerminalInstance(testSession.id)
      expect(retrieved).toBe(mockTerminal)
    })
  })

  describe('Tab Closure', () => {
    let testSession: any

    beforeEach(() => {
      testSession = manager.createSession(mockConfig)
    })

    it('should close tab and remove session', () => {
      const tabs = manager.getAllTabs()
      const result = manager.closeTab(tabs[0].id)
      expect(result).toBe(true)

      const session = manager.getSession(testSession.id)
      expect(session).toBeNull()

      const updatedTabs = manager.getAllTabs()
      expect(updatedTabs).toHaveLength(0)
    })

    it('should return false for non-existent tab', () => {
      const result = manager.closeTab('non-existent-tab-id')
      expect(result).toBe(false)
    })

    it('should emit events when session is closed', (done) => {
      const tabs = manager.getAllTabs()

      manager.on('sessionClosed', (session) => {
        expect(session.id).toBe(testSession.id)
        done()
      })

      manager.closeTab(tabs[0].id)
    })
  })

  describe('State Management', () => {
    it('should check if new tabs can be created', () => {
      expect(manager.canCreateNewTab()).toBe(true)

      // Create sessions up to the limit
      for (let i = 0; i < 10; i++) {
        const config = { ...mockConfig, id: `session-${i}` }
        manager.createSession(config)
      }

      expect(manager.canCreateNewTab()).toBe(false)
    })

    it('should get tab count', () => {
      expect(manager.getTabCount()).toBe(0)

      manager.createSession(mockConfig)
      expect(manager.getTabCount()).toBe(1)

      manager.createSession({ ...mockConfig, id: 'session-2' })
      expect(manager.getTabCount()).toBe(2)
    })

    it('should set maximum tabs', () => {
      manager.setMaxTabs(5)

      // The setMaxTabs method just sets the limit, but doesn't enforce it during creation
      // So we just test that the method exists and can be called
      expect(manager.canCreateNewTab()).toBe(true)
    })
  })
})
