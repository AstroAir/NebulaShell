# Advanced Terminal Features - Test Suite

This directory contains comprehensive test suites for all advanced terminal features implemented in the web terminal application.

## Test Structure

```
__tests__/
├── components/           # React component tests
│   ├── terminal/
│   │   ├── TerminalThemeSelector.test.tsx
│   │   └── CommandHistorySearch.test.tsx
│   ├── file-transfer/
│   │   └── DragDropFileTransfer.test.tsx
│   └── collaboration/
│       └── CollaborationPanel.test.tsx
├── lib/                  # Utility library tests
│   ├── terminal-themes.test.ts
│   ├── terminal-history-enhanced.test.ts
│   ├── file-transfer-manager.test.ts
│   └── connection-profiles-enhanced.test.ts
├── api/                  # Backend API tests
│   ├── file-transfer.test.ts
│   └── collaboration.test.ts
├── setup/               # Test configuration
│   ├── env.js
│   ├── global-setup.js
│   └── global-teardown.js
└── utils/               # Test utilities
    └── test-utils.tsx
```

## Test Categories

### 1. Unit Tests
- **React Components**: Test individual component behavior, props, state, and user interactions
- **Utility Libraries**: Test core business logic, data management, and algorithms
- **Coverage Target**: 95% for new advanced features

### 2. Integration Tests
- **API Endpoints**: Test file upload/download, WebSocket communication
- **Component Integration**: Test how components work together
- **Coverage Target**: 90% for API routes

### 3. End-to-End Tests
- **User Workflows**: Complete user journeys from start to finish
- **Cross-browser Testing**: Chrome, Firefox, Safari, Edge
- **Mobile Testing**: Responsive design and touch interactions
- **Accessibility Testing**: WCAG compliance and screen reader support

## Running Tests

### All Tests
```bash
npm run test:all
```

### Individual Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e

# Coverage report
npm run test:coverage

# Accessibility tests
npm run test:a11y

# Performance tests
npm run test:performance
```

### Development Mode
```bash
# Watch mode for unit tests
npm run test:watch

# Debug E2E tests
npm run test:e2e:debug

# Run E2E tests with browser UI
npm run test:e2e:headed
```

## Test Features Covered

### Terminal Themes
- ✅ Theme selection and switching
- ✅ Custom theme creation and editing
- ✅ Theme import/export functionality
- ✅ Theme persistence across sessions
- ✅ Color picker interactions
- ✅ Theme preview functionality
- ✅ Category filtering (Dark, Light, High Contrast, Custom)
- ✅ Accessibility compliance

### Command History
- ✅ Search functionality with advanced filters
- ✅ Command indexing and retrieval
- ✅ Favorites management
- ✅ Tags and metadata handling
- ✅ Statistics and analytics
- ✅ Export/import capabilities
- ✅ Performance with large datasets
- ✅ Real-time search with debouncing

### File Transfer
- ✅ Drag and drop file upload
- ✅ File selection via dialog
- ✅ Progress tracking and speed calculation
- ✅ Pause/resume/cancel operations
- ✅ File type and size validation
- ✅ Error handling and retry logic
- ✅ Multiple file handling
- ✅ Download functionality
- ✅ Security validations

### Real-time Collaboration
- ✅ WebSocket connection management
- ✅ User presence and status
- ✅ Session sharing and invitations
- ✅ Real-time cursor tracking
- ✅ Collaborative terminal input/output
- ✅ User management and permissions
- ✅ Connection resilience and reconnection

### Enhanced Connection Management
- ✅ Profile creation and editing
- ✅ Connection grouping and organization
- ✅ Quick connect functionality
- ✅ Template-based profile creation
- ✅ Import/export of profiles
- ✅ Search and filtering
- ✅ Favorites and recent connections

## Test Utilities

### Mock Factories
- `createMockFile()` - Creates mock File objects for testing
- `createMockConnectionProfile()` - Creates test connection profiles
- `createMockHistoryEntry()` - Creates test command history entries
- `createMockTerminalTheme()` - Creates test terminal themes
- `createMockWebSocket()` - Creates mock WebSocket for collaboration tests

### Test Helpers
- `mockLocalStorage()` - Provides localStorage mock with state tracking
- `createDragEvent()` - Creates drag and drop events for testing
- `checkAccessibility()` - Runs accessibility checks with axe-core
- `measureRenderTime()` - Performance testing utilities

## Coverage Requirements

### Minimum Coverage Thresholds
- **Lines**: 90%
- **Functions**: 90%
- **Branches**: 90%
- **Statements**: 90%

### Enhanced Coverage for New Features
- **Terminal Themes**: 95%
- **Command History**: 95%
- **File Transfer**: 95%
- **Collaboration**: 95%
- **Connection Management**: 95%

## Accessibility Testing

All components are tested for:
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation support
- ✅ Screen reader compatibility
- ✅ Focus management
- ✅ ARIA labels and roles
- ✅ Color contrast requirements
- ✅ High contrast theme support

## Performance Testing

Performance tests verify:
- ✅ Component render times < 100ms
- ✅ Large dataset handling (1000+ items)
- ✅ Memory usage optimization
- ✅ Search performance with debouncing
- ✅ File transfer efficiency
- ✅ WebSocket message handling

## Browser Support

E2E tests run on:
- ✅ Chrome (Desktop & Mobile)
- ✅ Firefox (Desktop)
- ✅ Safari (Desktop & Mobile)
- ✅ Edge (Desktop)

## Continuous Integration

The test suite is designed for CI/CD environments:
- Parallel test execution
- Artifact collection (screenshots, videos, reports)
- Coverage reporting with thresholds
- Performance benchmarking
- Accessibility compliance checking

## Troubleshooting

### Common Issues

1. **Playwright Browser Installation**
   ```bash
   npm run playwright:install
   ```

2. **Test Timeouts**
   - Increase timeout in `playwright.config.ts`
   - Check for async operations without proper awaiting

3. **Coverage Issues**
   - Ensure all new files are included in coverage collection
   - Check for untested error paths

4. **Flaky Tests**
   - Add proper wait conditions
   - Use `waitFor` for async operations
   - Mock external dependencies

### Debug Mode

For debugging failing tests:
```bash
# Debug specific test
npm run test:e2e:debug -- --grep "theme selection"

# Run with browser UI
npm run test:e2e:headed

# Verbose Jest output
npm run test:unit -- --verbose
```

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure 95% coverage for new code
3. Add accessibility tests
4. Include E2E test for user workflows
5. Update this README with new test coverage

## Test Reports

Test results are generated in:
- `coverage/` - Coverage reports (HTML & LCOV)
- `test-results/` - E2E test artifacts
- `test-results/e2e-results.html` - Playwright HTML report
