import fs from 'fs';
import path from 'path';

async function globalTeardown() {
  console.log('Cleaning up E2E test environment...');

  try {
    // Clean up test fixtures
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (fs.existsSync(fixturesDir)) {
      fs.rmSync(fixturesDir, { recursive: true, force: true });
    }

    // Clean up test upload directory
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'test-uploads');
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    // Clean up authentication state if it was created
    const authStatePath = path.join(__dirname, '..', 'auth-state.json');
    if (fs.existsSync(authStatePath)) {
      fs.unlinkSync(authStatePath);
    }

    // Clean up any temporary files created during tests
    const tempDir = path.join(__dirname, '..', 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Stop any test services that were started
    // For example, if we started a test WebSocket server:
    // await testWebSocketServer.close();

    console.log('E2E test environment cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
    // Don't throw here as it might mask test failures
  }
}

export default globalTeardown;
