# WebSSH Terminal

A modern, secure web-based SSH terminal built with Next.js and shadcn/ui. Connect to remote servers directly from your browser with a full-featured terminal interface.

## Features

### 🔐 Secure SSH Connections
- Password and private key authentication
- Encrypted credential handling with AES encryption
- Rate limiting and security validation
- Session management with automatic cleanup
- SSH key generation, import, and export
- Certificate-based authentication support

### 🖥️ Advanced Terminal Experience
- Real-time terminal emulation using xterm.js
- Multiple terminal tabs with session switching
- Support for colors, cursor positioning, and text formatting
- Customizable themes and font settings
- Search functionality within terminal output
- Keyboard shortcuts and hotkeys
- Full-screen terminal mode
- Terminal bell notifications (visual and audio)

### 📁 File Transfer & Management
- SFTP file browser with directory navigation
- Drag-and-drop file uploads
- File download capabilities
- Transfer progress indicators with speed monitoring
- File operations (create, delete, rename directories)
- Batch file operations

### 🔖 Connection Management
- Connection profiles and bookmarks
- Quick connect from recent connections
- Favorite connections with tags
- Connection history tracking
- Profile groups and organization
- Import/export connection profiles

### 🎨 Customization & Themes
- Multiple built-in terminal themes (Dark, Light, Monokai, Solarized)
- Custom theme creation and editing
- Font family, size, and line height controls
- Cursor style and blinking options
- Scrollback buffer configuration
- Terminal behavior customization

### ⌨️ Keyboard & Shortcuts
- Customizable keyboard shortcuts
- Copy/paste with Ctrl+C/Ctrl+V
- Tab navigation (Ctrl+T, Ctrl+W, Ctrl+Tab)
- Font size controls (Ctrl+Plus/Minus/0)
- Terminal clearing (Ctrl+L)
- Context menus and right-click actions

### 📊 Monitoring & Analytics
- Real-time connection monitoring
- Session statistics and performance metrics
- Connection success/failure tracking
- Usage analytics and reporting
- SSH key usage tracking
- Audit logs for security compliance

### 🛡️ Enhanced Security
- Session timeout warnings
- IP whitelisting and blacklisting capabilities
- Two-factor authentication support
- Encrypted local storage
- Secure credential management
- Rate limiting and brute force protection

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd simple-web-terminal
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Connecting to a Server

1. **Fill in connection details:**
   - Hostname: The server's IP address or domain name
   - Port: SSH port (default: 22)
   - Username: Your username on the remote server

2. **Choose authentication method:**
   - **Password**: Enter your password
   - **Private Key**: Paste your private key (supports encrypted keys with passphrase)

3. **Click Connect** to establish the SSH connection

### Terminal Features

- **Full terminal emulation**: Supports all standard terminal operations
- **Copy/Paste**: Use Ctrl+C/Ctrl+V (or Cmd+C/Cmd+V on Mac)
- **Resize**: Terminal automatically adjusts to window size
- **Colors and formatting**: Full support for ANSI colors and text formatting

## Architecture

### Frontend
- **Next.js 15**: React framework with App Router
- **shadcn/ui**: Modern UI component library
- **xterm.js**: Terminal emulation
- **Socket.IO**: Real-time communication
- **TypeScript**: Type safety throughout

### Backend
- **Next.js API Routes**: RESTful API endpoints
- **Socket.IO**: WebSocket server for real-time terminal communication
- **node-ssh**: SSH client library
- **Custom Security Layer**: Encryption, validation, and rate limiting

## Security Considerations

### Production Deployment
- Use HTTPS in production
- Set strong encryption keys
- Configure proper firewall rules
- Monitor logs for suspicious activity
- Regularly update dependencies

### Best Practices
- Use private key authentication when possible
- Implement proper access controls
- Monitor session activity
- Set appropriate session timeouts
- Use strong passwords and keys

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
