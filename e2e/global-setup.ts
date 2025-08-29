import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('Setting up E2E test environment...');

  // Create test fixtures directory
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // Create test files for file transfer tests
  const testFiles = [
    { name: 'test-upload.txt', content: 'This is a test file for upload testing.' },
    { name: 'large-test-file.txt', content: 'x'.repeat(1024 * 1024) }, // 1MB file
    { name: 'file1.txt', content: 'Content of file 1' },
    { name: 'file2.txt', content: 'Content of file 2' },
    { name: 'file3.txt', content: 'Content of file 3' },
    { 
      name: 'test-data.json', 
      content: JSON.stringify({ 
        test: true, 
        data: [1, 2, 3], 
        message: 'Test JSON file' 
      }, null, 2) 
    },
  ];

  testFiles.forEach(file => {
    const filePath = path.join(fixturesDir, file.name);
    fs.writeFileSync(filePath, file.content);
  });

  // Create test upload directory
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'test-uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Start a browser instance for authentication if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:3000');
    
    // Wait for the application to load
    await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 30000 });
    
    // Perform any global authentication or setup
    // For example, if the app requires login:
    // await page.click('[data-testid="login-button"]');
    // await page.fill('[data-testid="username"]', 'testuser');
    // await page.fill('[data-testid="password"]', 'testpass');
    // await page.click('[data-testid="submit-login"]');
    
    // Save authentication state if needed
    // await context.storageState({ path: 'auth-state.json' });
    
    console.log('Application is ready for testing');
  } catch (error) {
    console.error('Failed to set up test environment:', error);
    throw error;
  } finally {
    await browser.close();
  }

  // Set up test database or mock services if needed
  // This could include starting a test WebSocket server for collaboration tests
  
  console.log('E2E test environment setup completed');
}

export default globalSetup;
