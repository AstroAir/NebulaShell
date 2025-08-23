# Testing Documentation

This document provides comprehensive information about the testing strategy and implementation for the simple-web-terminal project.

## Overview

The project uses a comprehensive testing approach with:
- **Frontend Testing**: Jest + React Testing Library + MSW
- **Backend Testing**: Jest + Supertest for HTTP/WebSocket testing
- **Coverage Target**: 80%+ code coverage
- **Integration Testing**: Real-time WebSocket and SSH connection testing

## Test Structure

```
tests/
├── unit/                    # Backend unit tests
│   ├── ssh-manager.test.ts
│   ├── security-manager.test.ts
│   ├── terminal-history-manager.test.ts
│   └── sftp-manager.test.ts
├── integration/             # Backend integration tests
│   ├── websocket-server.test.ts
│   └── ssh-operations.test.ts
├── mocks/                   # Test mocks and utilities
│   ├── socket.io.ts
│   ├── ssh.ts
│   └── xterm.ts
src/
├── components/__tests__/    # Frontend component tests
│   ├── Terminal.test.tsx
│   ├── TerminalContext.test.tsx
│   ├── SSHConnectionForm.test.tsx
│   └── ConnectionStatus.test.tsx
└── lib/__tests__/          # Frontend library tests
```

## Running Tests

### All Tests
```bash
pnpm test                    # Run all tests
pnpm test:watch             # Run tests in watch mode
pnpm test:coverage          # Run tests with coverage report
```

### Specific Test Suites
```bash
pnpm test:frontend          # Frontend tests only
pnpm test:backend           # Backend tests only
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests only
```

### CI/CD Tests
```bash
pnpm test:ci                # Run all tests for CI (no watch mode)
```

## Test Categories

### 1. Backend Unit Tests

#### SSH Manager Tests (`tests/unit/ssh-manager.test.ts`)
- Session creation and management
- SSH connection establishment
- Authentication (password and key-based)
- Error handling and validation
- Session cleanup and rate limiting

#### Security Manager Tests (`tests/unit/security-manager.test.ts`)
- SSH configuration validation
- Rate limiting functionality
- Input sanitization
- Terminal dimension validation
- Data encryption/decryption

#### Terminal History Manager Tests (`tests/unit/terminal-history-manager.test.ts`)
- Command history storage and retrieval
- Session management
- History navigation (previous/next)
- Search functionality
- Settings management

#### SFTP Manager Tests (`tests/unit/sftp-manager.test.ts`)
- SFTP connection establishment
- File operations (upload/download/delete)
- Directory listing and navigation
- Progress tracking
- Error handling

### 2. Backend Integration Tests

#### WebSocket Server Tests (`tests/integration/websocket-server.test.ts`)
- Socket.IO connection handling
- SSH connection flow through WebSocket
- Terminal input/output streaming
- Connection cleanup and error handling
- Real-time communication testing

#### SSH Operations Tests (`tests/integration/ssh-operations.test.ts`)
- End-to-end SSH session lifecycle
- Integration between SSH, SFTP, and terminal managers
- Concurrent session handling
- Error recovery and cleanup

### 3. Frontend Unit Tests

#### Terminal Component Tests (`src/components/__tests__/Terminal.test.tsx`)
- Terminal rendering and initialization
- xterm.js integration
- Input handling and keyboard shortcuts
- Resize operations
- Session management

#### Terminal Context Tests (`src/components/__tests__/TerminalContext.test.tsx`)
- WebSocket connection management
- SSH connection state management
- Feature toggles and settings
- Event handling and cleanup

#### SSH Connection Form Tests (`src/components/__tests__/SSHConnectionForm.test.tsx`)
- Form validation and submission
- Authentication method switching
- Error display and handling
- Connection state management

#### Connection Status Tests (`src/components/__tests__/ConnectionStatus.test.tsx`)
- Status display and updates
- Icon and badge rendering
- Session ID display
- Accessibility features

### 4. Frontend Integration Tests

#### Terminal Flow Tests (`tests/integration/frontend-terminal-flow.test.tsx`)
- Complete SSH connection workflow
- Terminal interaction and data flow
- Authentication method testing
- Error recovery and reconnection
- User interaction scenarios

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Separate projects for frontend and backend
- Custom test environments (jsdom for frontend, node for backend)
- Coverage thresholds and reporting
- Module path mapping

### Setup Files
- `jest.setup.js`: Frontend test setup with mocks
- `jest.setup.backend.js`: Backend test setup with mocks

## Mocking Strategy

### Frontend Mocks
- **Socket.IO Client**: Mock WebSocket connections
- **xterm.js**: Mock terminal functionality
- **Next.js Router**: Mock navigation
- **Browser APIs**: ResizeObserver, matchMedia, etc.

### Backend Mocks
- **node-ssh**: Mock SSH connections
- **ssh2-sftp-client**: Mock SFTP operations
- **crypto-js**: Mock encryption
- **File System**: Mock fs operations

## Coverage Requirements

The project maintains high test coverage with the following thresholds:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Coverage Reports
- HTML report: `coverage/lcov-report/index.html`
- LCOV format: `coverage/lcov.info`
- Text summary in terminal

## Best Practices

### Writing Tests
1. **Descriptive Test Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow the AAA pattern
3. **Mock External Dependencies**: Mock all external services
4. **Test Edge Cases**: Include error scenarios and edge cases
5. **Async Testing**: Properly handle async operations with waitFor

### Test Organization
1. **Group Related Tests**: Use describe blocks for logical grouping
2. **Setup and Teardown**: Use beforeEach/afterEach for test isolation
3. **Shared Utilities**: Extract common test utilities
4. **Mock Management**: Clear mocks between tests

### Performance
1. **Parallel Execution**: Tests run in parallel by default
2. **Test Isolation**: Each test should be independent
3. **Resource Cleanup**: Properly clean up resources
4. **Timeout Handling**: Set appropriate timeouts for async operations

## Continuous Integration

### GitHub Actions Workflow
The project uses GitHub Actions for automated testing:
- **Multi-Node Testing**: Tests on Node.js 18.x and 20.x
- **Linting and Type Checking**: ESLint and TypeScript validation
- **Security Auditing**: Dependency vulnerability scanning
- **Coverage Reporting**: Codecov and Coveralls integration
- **Build Verification**: Production build testing

### Pre-commit Hooks
Consider setting up pre-commit hooks for:
- Running tests on changed files
- Linting and formatting
- Type checking

## Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
pnpm test ssh-manager.test.ts

# Run specific test case
pnpm test --testNamePattern="should create session"

# Run tests in debug mode
pnpm test --runInBand --no-cache
```

### Debug Configuration
- Use `console.log` for debugging (removed in CI)
- Set `DEBUG=true` environment variable for verbose output
- Use Jest's `--verbose` flag for detailed test output

## Future Improvements

1. **E2E Testing**: Add Playwright or Cypress for end-to-end testing
2. **Visual Regression**: Add visual testing for UI components
3. **Performance Testing**: Add performance benchmarks
4. **Accessibility Testing**: Automated a11y testing
5. **API Testing**: Add API endpoint testing with Supertest

## Troubleshooting

### Common Issues
1. **Timeout Errors**: Increase Jest timeout for slow operations
2. **Mock Issues**: Ensure mocks are properly reset between tests
3. **Async Issues**: Use proper async/await and waitFor patterns
4. **Environment Issues**: Check Node.js version compatibility

### Getting Help
- Check test logs for detailed error messages
- Review mock implementations for accuracy
- Ensure all dependencies are properly installed
- Verify test environment setup
