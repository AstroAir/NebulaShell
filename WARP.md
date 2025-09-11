# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**WebSSH Terminal** - A modern, secure web-based SSH terminal and file manager built with Next.js 15, React 19, TypeScript, and Tauri for desktop deployment. The application supports real-time terminal emulation, SFTP file transfers, session management, and can run as both a web application and desktop application.

## Core Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, shadcn/ui, xterm.js
- **Backend**: Node.js with Socket.IO for WebSocket communication, node-ssh for SSH connections
- **Desktop**: Tauri v2 for cross-platform desktop builds
- **Testing**: Jest, React Testing Library, Playwright
- **Build Tools**: pnpm, TypeScript, ESLint, PostCSS with Tailwind CSS v4

### Directory Structure
```
src/
├── app/                    # Next.js app router pages
│   ├── layout.tsx         # Root layout with metadata
│   └── page.tsx           # Main application page with terminal UI
├── components/            # React components
│   ├── terminal/          # Terminal emulation (Terminal.tsx, TerminalContext.tsx, TabbedTerminal.tsx)
│   ├── ssh/               # SSH connection forms and status
│   ├── file-transfer/     # SFTP file browser and transfer UI
│   ├── session/           # Session management components
│   ├── layout/            # Responsive layout and resizable panels
│   └── accessibility/     # Accessibility providers and skip links
├── lib/                   # Core business logic
│   ├── ssh-manager.ts     # SSH connection management
│   ├── sftp-manager.ts    # SFTP file operations
│   ├── websocket-adapter.ts  # WebSocket/Socket.IO/Tauri adapter pattern
│   ├── backend-config.ts  # Backend selection logic
│   └── security.ts        # Encryption and security validation
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
server.ts                  # Node.js server with Socket.IO
src-tauri/                 # Tauri desktop application configuration
__tests__/                 # Test files
```

### Backend Architecture

The application uses an adaptive backend pattern that automatically selects the appropriate communication method:

1. **Node.js + Socket.IO** (default for web): Full-featured server with WebSocket support via `server.ts`
2. **Tauri IPC** (desktop app): Direct IPC communication when running as Tauri app
3. **Raw WebSocket** (alternative): Direct WebSocket communication for Rust backends

Selection logic in `src/lib/backend-config.ts`:
- Detects Tauri environment via `window.__TAURI__`
- Falls back to Socket.IO for web deployment
- Configurable via environment variables

### Key Architectural Patterns

1. **Adapter Pattern**: `websocket-adapter.ts` provides unified interface for Socket.IO, WebSocket, and Tauri
2. **Manager Pattern**: Dedicated managers for SSH, SFTP, terminal sessions, and security
3. **Context Pattern**: React contexts for terminal state and WebSocket connections
4. **Responsive Design**: Adaptive layouts for desktop, tablet, and mobile
5. **Security Layer**: Encryption for credentials, rate limiting, session validation

## Development Commands

### Environment Setup
```bash
# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Generate encryption key (for .env)
openssl rand -hex 16
```

### Development
```bash
# Start development server (web mode with hot reload)
pnpm dev

# Start development server with file watching
pnpm dev:watch

# Run frontend only (Next.js dev server)
pnpm dev:frontend

# Run Tauri desktop app in development
pnpm tauri:dev
```

### Building
```bash
# Build for production (web)
pnpm build
pnpm start

# Build Tauri desktop app
pnpm tauri:build

# Build for specific platforms
pnpm build:windows      # Windows MSI/NSIS
pnpm build:macos        # macOS DMG/App Bundle
pnpm build:linux        # Linux AppImage/DEB/RPM

# Build all platforms
pnpm build:all-platforms
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Run specific test suites
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests
pnpm test:e2e          # End-to-end tests (Playwright)

# Run E2E tests with UI
pnpm test:e2e:headed

# Install Playwright browsers
pnpm playwright:install
```

### Code Quality
```bash
# Run ESLint
pnpm lint

# Clean build artifacts
pnpm clean
```

## Critical Implementation Details

### SSH Connection Flow
1. Client sends connection config via WebSocket/IPC
2. `SSHManager` validates config and checks rate limits
3. Connection established using `node-ssh` with configurable algorithms
4. Shell stream created with terminal dimensions
5. Bidirectional data flow: terminal ↔ WebSocket ↔ SSH shell
6. Session tracking with automatic cleanup on disconnect

### File Transfer Implementation
- Uses `ssh2-sftp-client` for SFTP operations
- Supports drag-and-drop uploads via `react-dropzone`
- Progress tracking with speed calculation
- Batch operations for multiple files
- Directory navigation with breadcrumb trail

### Security Considerations
- AES encryption for stored credentials (`crypto-js`)
- Rate limiting per IP address
- Session timeout management (default 60 minutes)
- SSH key validation and management
- Input sanitization for terminal commands

### Terminal Features
- Full xterm.js integration with color support
- Tab management for multiple sessions
- Command history with search
- Auto-complete suggestions
- Custom themes and font settings
- Keyboard shortcuts (Ctrl+C/V for copy/paste)
- Resize handling with dimension sync to SSH

## Common Development Tasks

### Adding a New Terminal Theme
1. Define theme in `src/lib/terminal-themes.ts`
2. Add theme option to `TerminalThemeSelector.tsx`
3. Update settings manager in `terminal-settings-manager.ts`

### Implementing New SSH Features
1. Extend `SSHConnectionConfig` type in `src/types/ssh.ts`
2. Update validation in `security.ts`
3. Modify connection logic in `ssh-manager.ts`
4. Update form in `SSHConnectionForm.tsx`

### Adding File Operations
1. Implement operation in `sftp-manager.ts`
2. Add UI controls in `FileBrowser.tsx`
3. Handle progress in `TransferProgress.tsx`
4. Add error handling and logging

### Creating New Keyboard Shortcuts
1. Define shortcut in `KeyboardShortcuts.tsx`
2. Add handler in relevant component
3. Update help dialog in `KeyboardShortcutsHelp.tsx`

## Testing Guidelines

### Test Structure
- Unit tests: Component logic and utility functions
- Integration tests: WebSocket communication, SSH operations
- E2E tests: Full user workflows with Playwright

### Running a Single Test
```bash
# Run a specific test file
pnpm test ssh-manager.test.ts

# Run a specific test name
pnpm test --testNamePattern="should create session"

# Debug a single test (serial, no cache)
pnpm test --runInBand --no-cache
```

### Mocking Strategy
- Socket.IO mocked in `__tests__/mocks/socket.io.ts`
- SSH operations mocked in `__tests__/mocks/ssh.ts`
- xterm.js mocked for terminal tests
- File operations use mock FileReader/Blob

## Deployment Considerations

### Web Deployment
1. Set production environment variables
2. Build with `pnpm build`
3. Start the server with `pnpm start`
4. Configure reverse proxy/load balancer for WebSocket support
5. Enable HTTPS for production
### Desktop Distribution
1. Configure code signing certificates
2. Build platform-specific installers
3. Test auto-update functionality
4. Verify native module compatibility

### Environment Variables
Required for production:
- `ENCRYPTION_KEY`: 32-character hex string for credential encryption
- `NODE_ENV`: Set to "production"
- `PORT`: Server port (default 3000)
- `SESSION_TIMEOUT_MINUTES`: Session timeout (default 60)

## Troubleshooting

### Common Issues

**WebSocket Connection Failures**
- Check if server is running on correct port
- Verify firewall allows WebSocket connections
- Check Socket.IO path configuration

**SSH Connection Issues**
- Verify SSH algorithms compatibility
- Check rate limiting hasn't been exceeded
- Ensure private key format is correct (OpenSSH format)

**Terminal Rendering Problems**
- Clear browser cache
- Check xterm.js addon loading
- Verify terminal dimensions are set correctly

**Build Failures**
- Run `pnpm clean` to clear artifacts
- Delete `node_modules` and reinstall
- Check Node.js version (requires 18+)
- For Tauri: verify Rust toolchain is installed

## Performance Monitoring

Key metrics tracked:
- Connection establishment time
- Terminal input latency
- File transfer speeds
- Memory usage per session
- WebSocket message throughput

Access metrics via:
- Browser DevTools Performance tab
- Application logs with `LOG_LEVEL=DEBUG`
- Jest coverage reports
- Playwright trace viewer
