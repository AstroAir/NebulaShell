# WebTerminal Pro - Complete Build Guide

This guide provides comprehensive instructions for building the WebTerminal Pro Tauri application across all supported platforms.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or later)
- **pnpm** (v8 or later)
- **Rust** (latest stable)
- **Tauri CLI** (v2.8.4 or later)

### Basic Build Commands
```bash
# Install dependencies
pnpm install

# Build frontend only
pnpm build:frontend

# Build Tauri app for current platform
pnpm tauri build

# Build debug version
pnpm tauri build --debug

# Run in development mode
pnpm tauri dev
```

## 🏗️ Complete Build Process

### 1. Environment Setup

#### Windows
```powershell
# Install Rust
winget install Rustlang.Rust.GNU

# Install Node.js and pnpm
winget install OpenJS.NodeJS
npm install -g pnpm

# Install Tauri CLI
pnpm add -g @tauri-apps/cli
```

#### macOS
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js and pnpm
brew install node pnpm

# Install Tauri CLI
pnpm add -g @tauri-apps/cli
```

#### Linux (Ubuntu/Debian)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js and pnpm
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# Install system dependencies
sudo apt-get install -y libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev

# Install Tauri CLI
pnpm add -g @tauri-apps/cli
```

### 2. Project Setup
```bash
# Clone and navigate to project
cd simple-web-terminal

# Install all dependencies
pnpm install

# Verify setup
pnpm tauri --version
cargo --version
node --version
```

### 3. Build Process

#### Development Build
```bash
# Build frontend and run in dev mode
pnpm tauri dev
```

#### Production Build
```bash
# Build optimized frontend
pnpm build:frontend

# Build Tauri application
pnpm tauri build
```

#### Debug Build
```bash
# Build with debug symbols
pnpm tauri build --debug
```

## 🌍 Cross-Platform Builds

### Using the Build Script
```bash
# Build for current platform only
node build-scripts/build-all-platforms.js

# Build for all available platforms (requires platform-specific setup)
node build-scripts/build-all-platforms.js --all

# Build debug version
node build-scripts/build-all-platforms.js --debug

# Skip frontend build
node build-scripts/build-all-platforms.js --skip-frontend

# Skip tests
node build-scripts/build-all-platforms.js --skip-tests
```

### Manual Cross-Platform Setup

#### Windows Targets
```bash
# Add Windows target (on Windows)
rustup target add x86_64-pc-windows-msvc

# Build for Windows
pnpm tauri build --target x86_64-pc-windows-msvc
```

#### macOS Targets
```bash
# Add macOS targets (on macOS)
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Build for macOS Intel
pnpm tauri build --target x86_64-apple-darwin

# Build for macOS Apple Silicon
pnpm tauri build --target aarch64-apple-darwin
```

#### Linux Targets
```bash
# Add Linux target (on Linux)
rustup target add x86_64-unknown-linux-gnu

# Build for Linux
pnpm tauri build --target x86_64-unknown-linux-gnu
```

## 📦 Build Outputs

### Windows
- **Executable**: `src-tauri/target/release/webterminal-pro.exe`
- **MSI Installer**: `src-tauri/target/release/bundle/msi/WebTerminal Pro_1.0.0_x64_en-US.msi`
- **NSIS Installer**: `src-tauri/target/release/bundle/nsis/WebTerminal Pro_1.0.0_x64-setup.exe`

### macOS
- **App Bundle**: `src-tauri/target/release/bundle/macos/WebTerminal Pro.app`
- **DMG**: `src-tauri/target/release/bundle/dmg/WebTerminal Pro_1.0.0_x64.dmg`

### Linux
- **AppImage**: `src-tauri/target/release/bundle/appimage/webterminal-pro_1.0.0_amd64.AppImage`
- **DEB Package**: `src-tauri/target/release/bundle/deb/webterminal-pro_1.0.0_amd64.deb`
- **RPM Package**: `src-tauri/target/release/bundle/rpm/webterminal-pro-1.0.0-1.x86_64.rpm`

## 🧪 Testing

### Unit Tests
```bash
# Run Rust tests
cd src-tauri
cargo test

# Run JavaScript tests
pnpm test
```

### Integration Tests
```bash
# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e
```

### Performance Tests
```bash
# Run performance tests
pnpm test:performance
```

## 🔧 Configuration

### Tauri Configuration
The main configuration is in `src-tauri/tauri.conf.json`:
- **App metadata**: name, version, description
- **Build settings**: frontend dist path, dev server
- **Bundle configuration**: icons, installers, signing
- **Security settings**: CSP, permissions
- **Plugin configuration**: filesystem, shell, updater

### Build Profiles
Rust build profiles in `src-tauri/Cargo.toml`:
- **Debug**: Fast compilation, debug symbols
- **Release**: Optimized, stripped symbols
- **Release-with-debug**: Optimized with debug info

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean build cache
cargo clean
pnpm clean

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Update Rust toolchain
rustup update
```

#### Missing Dependencies
```bash
# Linux: Install WebKit dependencies
sudo apt-get install libwebkit2gtk-4.0-dev

# macOS: Install Xcode command line tools
xcode-select --install

# Windows: Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/
```

#### Permission Issues
```bash
# Fix file permissions (Unix-like systems)
chmod +x build-scripts/*.sh

# Run as administrator (Windows)
# Right-click PowerShell -> "Run as Administrator"
```

### Debug Information
```bash
# Enable verbose logging
RUST_LOG=debug pnpm tauri build

# Check system info
pnpm tauri info

# Validate configuration
pnpm tauri build --debug --verbose
```

## 📋 Build Checklist

- [ ] Prerequisites installed and verified
- [ ] Dependencies installed (`pnpm install`)
- [ ] Frontend builds successfully (`pnpm build:frontend`)
- [ ] Rust code compiles (`cargo check`)
- [ ] Tests pass (`pnpm test`)
- [ ] Application builds (`pnpm tauri build`)
- [ ] Generated bundles work correctly
- [ ] Cross-platform targets configured (if needed)
- [ ] Code signing configured (for distribution)

## 🎯 Next Steps

After successful build:
1. Test the generated executables/installers
2. Verify SSH connectivity and terminal functionality
3. Test file transfer operations
4. Validate cross-platform compatibility
5. Set up code signing for distribution
6. Configure auto-updater (optional)
7. Create distribution packages

For detailed development information, see the main README.md file.
