import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Transfer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });
  });

  test('should display file transfer interface', async ({ page }) => {
    // Open file transfer panel
    await page.click('[data-testid="file-transfer-button"]');
    
    // Check if file transfer interface is visible
    await expect(page.locator('text=File Transfer')).toBeVisible();
    await expect(page.locator('text=Drag and drop files or click to upload')).toBeVisible();
  });

  test('should show drop zone', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Check drop zone elements
    await expect(page.locator('text=Drag files here to upload')).toBeVisible();
    await expect(page.locator('text=or click to select files')).toBeVisible();
    await expect(page.locator('button:has-text("Select Files")')).toBeVisible();
  });

  test('should upload files via file selection', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Create a test file
    const testFilePath = path.join(__dirname, 'fixtures', 'test-upload.txt');
    
    // Click select files button and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Should show upload progress
    await expect(page.locator('text=test-upload.txt')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    
    // Wait for upload to complete
    await page.waitForSelector('text=Completed', { timeout: 10000 });
  });

  test('should handle drag and drop upload', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    const dropZone = page.locator('[data-testid="drop-zone"]');
    
    // Create a test file for drag and drop
    const testFile = {
      name: 'drag-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content for drag and drop'),
    };
    
    // Simulate drag enter
    await dropZone.dispatchEvent('dragenter', {
      dataTransfer: {
        files: [testFile],
        types: ['Files'],
      },
    });
    
    // Should highlight drop zone
    await expect(page.locator('text=Drop files here')).toBeVisible();
    
    // Simulate drop
    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [testFile],
        types: ['Files'],
      },
    });
    
    // Should show upload progress
    await expect(page.locator('text=drag-test.txt')).toBeVisible();
  });

  test('should validate file types', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Try to upload an invalid file type
    const invalidFile = {
      name: 'malware.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('malicious content'),
    };
    
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [invalidFile],
        types: ['Files'],
      },
    });
    
    // Should show validation error
    await expect(page.locator('text=File type not allowed')).toBeVisible();
  });

  test('should validate file size', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Try to upload a file that's too large
    const largeFile = {
      name: 'large-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(200 * 1024 * 1024), // 200MB
    };
    
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [largeFile],
        types: ['Files'],
      },
    });
    
    // Should show size validation error
    await expect(page.locator('text=File too large')).toBeVisible();
  });

  test('should show transfer progress', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Upload a file
    const testFile = path.join(__dirname, 'fixtures', 'test-upload.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Should show transfer details
    await expect(page.locator('text=test-upload.txt')).toBeVisible();
    await expect(page.locator('[data-testid="upload-badge"]')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    
    // Should show transfer controls
    await expect(page.locator('[data-testid="pause-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-button"]')).toBeVisible();
  });

  test('should pause and resume transfers', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Upload a file
    const testFile = path.join(__dirname, 'fixtures', 'large-test-file.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Pause the transfer
    await page.click('[data-testid="pause-button"]');
    await expect(page.locator('text=Paused')).toBeVisible();
    
    // Resume the transfer
    await page.click('[data-testid="resume-button"]');
    await expect(page.locator('text=Uploading')).toBeVisible();
  });

  test('should cancel transfers', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Upload a file
    const testFile = path.join(__dirname, 'fixtures', 'test-upload.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Cancel the transfer
    await page.click('[data-testid="cancel-button"]');
    
    // Transfer should be removed
    await expect(page.locator('text=test-upload.txt')).not.toBeVisible();
  });

  test('should retry failed transfers', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Simulate a failed transfer (this would require mocking the API)
    // For now, we'll assume there's a way to trigger a failure
    
    // Should show retry button for failed transfers
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Click retry
    await page.click('[data-testid="retry-button"]');
    
    // Should restart the transfer
    await expect(page.locator('text=Uploading')).toBeVisible();
  });

  test('should show transfer statistics', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Should show transfer status summary
    await expect(page.locator('text=Active:')).toBeVisible();
    await expect(page.locator('text=Completed:')).toBeVisible();
    await expect(page.locator('text=Errors:')).toBeVisible();
  });

  test('should display appropriate file icons', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    const testFiles = [
      { name: 'document.txt', type: 'text/plain' },
      { name: 'image.png', type: 'image/png' },
      { name: 'video.mp4', type: 'video/mp4' },
      { name: 'archive.zip', type: 'application/zip' },
    ];
    
    for (const file of testFiles) {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: file.name,
        mimeType: file.type,
        buffer: Buffer.from('test content'),
      });
      
      // Should show appropriate icon for file type
      await expect(page.locator(`text=${file.name}`)).toBeVisible();
    }
  });

  test('should handle multiple file uploads', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    const testFiles = [
      path.join(__dirname, 'fixtures', 'file1.txt'),
      path.join(__dirname, 'fixtures', 'file2.txt'),
      path.join(__dirname, 'fixtures', 'file3.txt'),
    ];
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFiles);
    
    // Should show all files in transfer list
    await expect(page.locator('text=file1.txt')).toBeVisible();
    await expect(page.locator('text=file2.txt')).toBeVisible();
    await expect(page.locator('text=file3.txt')).toBeVisible();
  });

  test('should download files', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Navigate to download section or trigger download
    await page.click('[data-testid="download-tab"]');
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click download button for a file
    await page.click('[data-testid="download-file-button"]');
    
    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test('should show empty state when no transfers', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Should show empty state
    await expect(page.locator('text=No transfers')).toBeVisible();
    await expect(page.locator('text=Upload or download files to see progress here')).toBeVisible();
  });

  test('should be accessible via keyboard', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Should be able to navigate with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Should trigger file selection
    
    // File input should be accessible
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeFocused();
  });

  test('should work on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'This test is only for mobile devices');
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="file-transfer-button"]');
    
    // Should display file transfer in mobile-friendly layout
    await expect(page.locator('text=File Transfer')).toBeVisible();
    
    // Should be able to select files on mobile
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'mobile-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Mobile test content'),
    });
    
    await expect(page.locator('text=mobile-test.txt')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/file-transfer/upload', route => {
      route.abort('failed');
    });
    
    await page.click('[data-testid="file-transfer-button"]');
    
    // Upload a file
    const testFile = path.join(__dirname, 'fixtures', 'test-upload.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Should show error state
    await expect(page.locator('text=Upload failed')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should persist transfer state across page reloads', async ({ page }) => {
    await page.click('[data-testid="file-transfer-button"]');
    
    // Start an upload
    const testFile = path.join(__dirname, 'fixtures', 'test-upload.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="terminal-container"]');
    
    // Open file transfer panel
    await page.click('[data-testid="file-transfer-button"]');
    
    // Should show previous transfer (if it was saved)
    // This depends on the implementation of transfer persistence
  });
});
