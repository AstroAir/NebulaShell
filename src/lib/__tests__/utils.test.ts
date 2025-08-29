import { 
  cn, 
  formatBytes, 
  formatDate, 
  formatDuration, 
  calculateTransferSpeed, 
  estimateTimeRemaining 
} from '../utils'

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-2 py-1', 'text-sm')).toBe('px-2 py-1 text-sm')
    })

    it('should handle conditional classes', () => {
      expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class')
      expect(cn('base-class', false && 'conditional-class')).toBe('base-class')
    })

    it('should handle Tailwind conflicts', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null, undefined)).toBe('')
    })
  })

  describe('formatBytes', () => {
    it('should format zero bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
    })

    it('should format bytes', () => {
      expect(formatBytes(512)).toBe('512 Bytes')
      expect(formatBytes(1023)).toBe('1023 Bytes')
    })

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(2048)).toBe('2 KB')
    })

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
    })

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
    })

    it('should handle large numbers', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 5)).toBe('5 TB')
    })
  })

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-12-25T15:30:00Z')
      const formatted = formatDate(date)
      
      // The exact format depends on locale, but should contain expected elements
      expect(formatted).toMatch(/Dec|December/)
      expect(formatted).toMatch(/25/)
      expect(formatted).toMatch(/2023/)
      expect(formatted).toMatch(/\d{1,2}:\d{2}/)
    })

    it('should handle different dates', () => {
      const date1 = new Date('2023-01-01T00:00:00Z')
      const date2 = new Date('2023-06-15T12:45:00Z')
      
      const formatted1 = formatDate(date1)
      const formatted2 = formatDate(date2)
      
      expect(formatted1).toMatch(/Jan|January/)
      expect(formatted2).toMatch(/Jun|June/)
    })
  })

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(0)).toBe('0s')
      expect(formatDuration(30)).toBe('30s')
      expect(formatDuration(59)).toBe('59s')
    })

    it('should format minutes', () => {
      expect(formatDuration(60)).toBe('1m')
      expect(formatDuration(90)).toBe('2m')
      expect(formatDuration(150)).toBe('3m')
      expect(formatDuration(3599)).toBe('60m')
    })

    it('should format hours', () => {
      expect(formatDuration(3600)).toBe('1h')
      expect(formatDuration(7200)).toBe('2h')
      expect(formatDuration(5400)).toBe('2h') // 1.5 hours rounds to 2
    })

    it('should handle decimal seconds', () => {
      expect(formatDuration(45.7)).toBe('46s')
      expect(formatDuration(89.3)).toBe('1m') // 89.3 seconds rounds to 1 minute
    })
  })

  describe('calculateTransferSpeed', () => {
    it('should calculate speed correctly', () => {
      const startTime = new Date(Date.now() - 2000) // 2 seconds ago
      const transferred = 2048 // 2KB

      const speed = calculateTransferSpeed(transferred, startTime)
      expect(speed).toBeCloseTo(1024, 0) // ~1KB/s with 1 decimal place tolerance
    })

    it('should handle zero elapsed time', () => {
      const startTime = new Date() // Now
      const transferred = 1024
      
      const speed = calculateTransferSpeed(transferred, startTime)
      expect(speed).toBe(0)
    })

    it('should handle zero transferred bytes', () => {
      const startTime = new Date(Date.now() - 1000) // 1 second ago
      const transferred = 0
      
      const speed = calculateTransferSpeed(transferred, startTime)
      expect(speed).toBe(0)
    })

    it('should handle large transfers', () => {
      const startTime = new Date(Date.now() - 10000) // 10 seconds ago
      const transferred = 10 * 1024 * 1024 // 10MB
      
      const speed = calculateTransferSpeed(transferred, startTime)
      expect(speed).toBeCloseTo(1024 * 1024, 0) // ~1MB/s
    })
  })

  describe('estimateTimeRemaining', () => {
    it('should estimate time correctly', () => {
      const transferred = 1024 // 1KB
      const total = 5120 // 5KB
      const speed = 1024 // 1KB/s
      
      const timeRemaining = estimateTimeRemaining(transferred, total, speed)
      expect(timeRemaining).toBe(4) // 4 seconds
    })

    it('should return 0 for zero speed', () => {
      const timeRemaining = estimateTimeRemaining(1024, 5120, 0)
      expect(timeRemaining).toBe(0)
    })

    it('should return 0 when transfer is complete', () => {
      const timeRemaining = estimateTimeRemaining(5120, 5120, 1024)
      expect(timeRemaining).toBe(0)
    })

    it('should return 0 when transferred exceeds total', () => {
      const timeRemaining = estimateTimeRemaining(6000, 5120, 1024)
      expect(timeRemaining).toBe(0)
    })

    it('should handle fractional results', () => {
      const transferred = 1000
      const total = 3000
      const speed = 800
      
      const timeRemaining = estimateTimeRemaining(transferred, total, speed)
      expect(timeRemaining).toBe(2.5) // 2.5 seconds
    })

    it('should handle large files', () => {
      const transferred = 100 * 1024 * 1024 // 100MB
      const total = 1024 * 1024 * 1024 // 1GB
      const speed = 10 * 1024 * 1024 // 10MB/s
      
      const timeRemaining = estimateTimeRemaining(transferred, total, speed)
      expect(timeRemaining).toBeCloseTo(92.4, 0.5) // ~92 seconds with tolerance
    })
  })
})
