#!/usr/bin/env node
/**
 * WebTerminal Pro - Cross-Platform Build Script
 * This script builds the application for all supported platforms
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const config = {
  buildType: process.argv.includes('--debug') ? 'debug' : 'release',
  skipFrontend: process.argv.includes('--skip-frontend'),
  skipTests: process.argv.includes('--skip-tests'),
  outputDir: process.argv.find(arg => arg.startsWith('--output-dir='))?.split('=')[1] || './dist',
  platforms: {
    windows: 'x86_64-pc-windows-msvc',
    macos: ['x86_64-apple-darwin', 'aarch64-apple-darwin'],
    linux: 'x86_64-unknown-linux-gnu'
  }
};

// Utility functions
const log = {
  info: (msg) => console.log(`\x1b[36m${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m⚠️ ${msg}\x1b[0m`),
  step: (msg) => console.log(`\x1b[34m🔨 ${msg}\x1b[0m`)
};

function commandExists(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd, options = {}) {
  try {
    const result = execSync(cmd, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
    return result;
  } catch (error) {
    log.error(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

function createDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2); // MB
}

// Main build process
async function main() {
  log.info('🚀 WebTerminal Pro - Cross-Platform Build Script');
  log.info(`Build Type: ${config.buildType}`);
  log.info(`Output Directory: ${config.outputDir}`);
  
  // Create output directory
  createDirectory(config.outputDir);
  
  // Check prerequisites
  log.step('Checking prerequisites...');
  const prerequisites = ['node', 'pnpm', 'cargo', 'rustc'];
  
  for (const cmd of prerequisites) {
    if (commandExists(cmd)) {
      const version = execSync(`${cmd} --version`, { encoding: 'utf8' }).split('\n')[0];
      log.success(`${cmd}: ${version}`);
    } else {
      log.error(`${cmd} not found`);
      process.exit(1);
    }
  }
  
  // Install dependencies
  log.step('Installing dependencies...');
  runCommand('pnpm install');
  log.success('Dependencies installed');
  
  // Build frontend
  if (!config.skipFrontend) {
    log.step('Building frontend...');
    runCommand('pnpm build:frontend');
    log.success('Frontend build completed');
  }
  
  // Run tests
  if (!config.skipTests) {
    log.step('Running tests...');
    process.chdir('src-tauri');
    runCommand(`cargo test --${config.buildType}`);
    process.chdir('..');
    log.success('Tests passed');
  }
  
  // Build Tauri application
  log.step('Building Tauri application...');
  
  const buildCmd = config.buildType === 'debug' ? 'tauri build --debug' : 'tauri build';
  
  // Determine current platform
  const platform = process.platform;
  let targets = [];
  
  switch (platform) {
    case 'win32':
      targets = [config.platforms.windows];
      break;
    case 'darwin':
      targets = config.platforms.macos;
      break;
    case 'linux':
      targets = [config.platforms.linux];
      break;
    default:
      log.warning(`Unknown platform: ${platform}, building for current platform`);
      targets = [];
  }
  
  // Build for each target
  for (const target of targets) {
    log.step(`Building for target: ${target}`);
    runCommand(`pnpm ${buildCmd} --target ${target}`);
  }
  
  if (targets.length === 0) {
    runCommand(`pnpm ${buildCmd}`);
  }
  
  // Copy build artifacts
  log.step('Copying build artifacts...');
  
  const sourceDir = path.join('src-tauri', 'target', config.buildType, 'bundle');
  
  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir, { recursive: true });
    
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(config.outputDir, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        createDirectory(path.dirname(destPath));
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    log.success(`Build artifacts copied to ${config.outputDir}`);
  } else {
    log.warning(`No build artifacts found in ${sourceDir}`);
  }
  
  // Generate checksums
  log.step('Generating checksums...');
  
  function processDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        processDirectory(itemPath);
      } else if (stat.isFile() && !item.endsWith('.sha256')) {
        const checksum = generateChecksum(itemPath);
        const checksumFile = `${itemPath}.sha256`;
        fs.writeFileSync(checksumFile, `${checksum}  ${item}\n`);
      }
    }
  }
  
  processDirectory(config.outputDir);
  log.success('Checksums generated');
  
  // Display build summary
  log.info('\n📊 Build Summary:');
  
  function displaySummary(dir, indent = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        log.info(`${indent}📁 ${item}/`);
        displaySummary(itemPath, indent + '  ');
      } else if (!item.endsWith('.sha256')) {
        const size = getFileSize(itemPath);
        log.info(`${indent}📄 ${item} (${size} MB)`);
      }
    }
  }
  
  displaySummary(config.outputDir);
  
  log.success('\n🎉 Build completed successfully!');
  log.info(`📁 Output directory: ${config.outputDir}`);
  log.success('🚀 Ready for distribution!');
}

// Error handling
process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the build process
if (require.main === module) {
  main().catch((error) => {
    log.error(`Build failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, config, log };
