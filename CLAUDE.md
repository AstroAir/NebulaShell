# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WebTerminal Pro is a professional SSH terminal client built with Next.js 15, Tauri, and modern web technologies. It provides secure SSH connections, file transfer capabilities, and advanced terminal features in both web and desktop environments.

### Core Technologies
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui with Radix UI primitives
- **Terminal**: xterm.js with FitAddon and WebLinksAddon
- **Desktop**: Tauri 2.x with Rust backend
- **Real-time Communication**: Socket.IO for WebSocket connections
- **SSH**: node-ssh library for SSH connections
- **File Transfer**: ssh2-sftp-client for SFTP operations
- **State Management**: React Context API
- **Testing**: Jest for unit tests, Playwright for E2E tests

## Development Commands

### Package Manager
This project uses `pnpm` as the package manager:
```bash
pnpm install          # Install dependencies
```

### Development
```bash
pnpm dev              # Start full development server (frontend + backend)
pnpm dev:frontend     # Start only Next.js frontend (http://localhost:3000)
pnpm dev:watch        # Start dev server with auto-restart
pnpm tauri:dev        # Start Tauri desktop app in development
pnpm app:dev          # Alias for tauri:dev
```

### Building
```bash
pnpm build            # Build Next.js application (static export for Tauri)
pnpm build:frontend   # Build only frontend
pnpm build:server     # Build only backend server
pnpm tauri:build      # Build Tauri desktop app for production
pnpm app:build        # Build Tauri app for current platform
pnpm app:build:debug  # Build Tauri app in debug mode
pnpm build:all-platforms # Build for all supported platforms
```

### Platform-Specific Builds
```bash
pnpm build:windows    # Build for Windows (x64)
pnpm build:macos      # Build for macOS (Intel and Apple Silicon)
pnpm build:linux      # Build for Linux (x64)
```

### Testing
```bash
pnpm test             # Run all Jest unit tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm test:unit        # Run only unit tests
pnpm test:integration # Run integration tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm test:e2e:headed  # Run E2E tests with visible browser
pnpm test:e2e:debug   # Run E2E tests in debug mode
```

### Code Quality
```bash
pnpm lint             # Run ESLint
pnpm clean            # Clean build artifacts
```

### Playwright Setup
```bash
pnpm playwright:install      # Install Playwright browsers
pnpm playwright:install-deps # Install system dependencies for Playwright
```

## Architecture Overview

### Dual Architecture Pattern
WebTerminal Pro supports both web and desktop deployment:
- **Web Mode**: Full-stack Next.js with API routes and WebSocket server
- **Desktop Mode**: Tauri frontend with Rust backend, using Next.js as static frontend

### Key Architectural Components

#### 1. Frontend Structure (Next.js)
```
src/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes (web mode only)
│   │   ├── ssh/          # SSH connection endpoints
│   │   ├── sftp/         # File transfer endpoints
│   │   ├── socket/       # WebSocket initialization
│   │   └── terminal/     # Terminal features
│   ├── layout.tsx        # Root layout with metadata
│   ├── page.tsx          # Main application page
│   └── globals.css       # Global styles
├── components/            # React components
│   ├── terminal/         # Terminal-related components
│   ├── ssh/              # SSH connection components
│   ├── file-transfer/    # File browser and transfer
│   ├── layout/           # Responsive layout components
│   └── ui/               # Reusable UI components (shadcn/ui)
└── lib/                  # Utility libraries and managers
    ├── ssh-manager.ts    # SSH connection management
    ├── websocket-server.ts # WebSocket server
    ├── terminal-*.ts     # Terminal feature managers
    └── security.ts       # Security and validation
```

#### 2. Desktop Backend (Tauri/Rust)
```
src-tauri/
├── src/
│   ├── main.rs           # Application entry point
│   ├── lib.rs            # Core library
│   ├── websocket.rs      # WebSocket handling
│   ├── ssh.rs            # SSH client implementation
│   ├── performance.rs    # Performance monitoring
│   └── optimization.rs   # Mobile optimizations
├── Cargo.toml           # Rust dependencies
└── tauri.conf.json      # Tauri configuration
```

#### 3. State Management
- **Terminal Context**: Central state for terminal sessions and connections
- **SSH Manager**: Manages SSH connections and sessions
- **WebSocket Server**: Handles real-time communication between frontend and backend
- **File Transfer Manager**: Coordinates SFTP operations

#### 4. Security Layer
- **Security Manager**: Input validation and rate limiting
- **Encryption**: AES encryption for stored credentials
- **Session Management**: Automatic cleanup and timeout handling

### Key Design Patterns

#### 1. Adapter Pattern
- `tauri-adapter.ts` and `websocket-adapter.ts` provide unified interfaces for web and desktop modes
- Components work transparently regardless of deployment target

#### 2. Manager Pattern
- Specialized managers handle complex domains (SSH, SFTP, Terminal, etc.)
- Single responsibility principle with clear interfaces

#### 3. Context Provider Pattern
- React Context provides global state for terminal operations
- Providers handle initialization and cleanup automatically

## Important Development Notes

### Configuration Management
- **Web Mode**: Uses Next.js API routes and built-in WebSocket server
- **Desktop Mode**: Uses Tauri's backend services and native WebSocket implementation
- The application automatically detects the environment and adapts

### Terminal Implementation
- Uses xterm.js for terminal emulation
- Supports ANSI colors, cursor positioning, and text formatting
- Handles terminal resizing and window management
- Supports custom themes and fonts

### SSH Connection Flow
1. User enters connection details
2. Security validation and rate limiting
3. SSH connection establishment
4. WebSocket channel creation for real-time I/O
5. Terminal session management
6. Automatic cleanup on disconnect

### File Transfer Architecture
- SFTP operations through ssh2-sftp-client
- Progress tracking for large transfers
- Drag-and-drop support
- Batch operations support

### Testing Strategy
- **Unit Tests**: Jest for component and library testing
- **Integration Tests**: API and WebSocket integration
- **E2E Tests**: Playwright for full user workflows
- **Mock Strategy**: Comprehensive mocking in jest.setup.js

### Performance Considerations
- Lazy loading of heavy components
- Component-level code splitting
- WebSocket connection pooling
- Mobile optimization settings
- Memory management for long-running sessions

### Mobile Responsiveness
- Responsive layout system with breakpoints
- Touch-optimized controls
- Performance modes for low-bandwidth connections
- Adaptive UI based on viewport size

## Security Best Practices

### Input Validation
- All user inputs validated through security manager
- Rate limiting on connection attempts
- XSS prevention through proper escaping

### Credential Management
- Encrypted storage of SSH credentials
- No plaintext passwords in logs
- Session-based authentication with timeout

### Network Security
- CORS configuration for WebSocket connections
- Secure key exchange algorithms
- Certificate validation options

## Common Development Workflows

### Adding New Terminal Features
1. Implement feature in `src/lib/terminal-*.ts`
2. Add UI components in `src/components/terminal/`
3. Update TerminalContext if global state needed
4. Add tests in `__tests__/components/terminal/`

### Adding SSH Functionality
1. Extend SSH manager in `src/lib/ssh-manager.ts`
2. Add API endpoints in `src/app/api/ssh/`
3. Update WebSocket handlers for real-time updates
4. Add integration tests

### Desktop-Specific Features
1. Implement Rust code in `src-tauri/src/`
2. Add Tauri commands in `src-tauri/src/lib.rs`
3. Create TypeScript bindings in frontend
4. Test both web and desktop modes

### Testing New Features
1. Unit tests: `pnpm test:unit`
2. Integration tests: `pnpm test:integration`
3. E2E tests: `pnpm test:e2e`
4. Coverage: `pnpm test:coverage`

## Build and Deployment

### Web Deployment
```bash
pnpm build            # Build static export
# Deploy out/ folder to any static hosting service
```

### Desktop Deployment
```bash
pnpm app:build        # Build for current platform
pnpm build:all-platforms # Build for all platforms
# Installers will be in src-tauri/target/release/bundle/
```

### Environment Variables
- `NODE_ENV`: Set to 'production' for production builds
- `PORT`: Development server port (default: 3000)
- Tauri-specific environment variables are handled automatically

## Debugging

### Frontend Debugging
- React DevTools for component inspection
- Network tab for API and WebSocket debugging
- Console logging implemented throughout

### Backend Debugging
- Tauri dev tools for desktop debugging
- Node.js debugging for web mode
- Extensive logging system in `src/lib/logger.ts`

### WebSocket Debugging
- Socket.IO client debugging enabled in development
- Connection status monitoring
- Event logging for all WebSocket communications