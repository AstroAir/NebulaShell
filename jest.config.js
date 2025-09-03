// Comprehensive Jest configuration for advanced terminal features
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/e2e/',
  ],
  // Memory and performance optimizations
  maxWorkers: 1, // Use single worker to prevent hanging and memory issues
  workerIdleMemoryLimit: '256MB', // Reduce memory limit for workers
  testTimeout: 15000, // 15 seconds timeout (reduced from 30s)

  // Prevent hanging tests and memory leaks
  forceExit: true, // Force exit after tests complete
  detectOpenHandles: false, // Disable to prevent false positives causing memory issues
  detectLeaks: false, // Disable experimental leak detection that causes heap issues
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: false,
      tsconfig: 'tsconfig.jest.json',
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'server.ts',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
    '!src/app/layout.tsx',
    '!src/app/globals.css',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Specific thresholds for new advanced features
    'src/components/terminal/TerminalThemeSelector.tsx': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/lib/terminal-themes.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/lib/terminal-history-enhanced.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}',
  ],
  setupFiles: ['<rootDir>/__tests__/setup/env.js'],

  // Additional memory management settings
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Optimize test execution
  bail: false, // Don't bail on first failure to see all issues
  verbose: false, // Reduce verbose output to save memory

  // Cache settings for better performance
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
}

module.exports = config
