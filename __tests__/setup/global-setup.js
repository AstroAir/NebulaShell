const fs = require('fs');
const path = require('path');

module.exports = async () => {
  // Create test upload directory
  const uploadDir = process.env.UPLOAD_DIR || '/tmp/test-uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Create test files for file transfer tests
  const testFilesDir = path.join(uploadDir, 'test-files');
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  // Create sample test files
  fs.writeFileSync(path.join(testFilesDir, 'test.txt'), 'This is a test file');
  fs.writeFileSync(path.join(testFilesDir, 'test.json'), JSON.stringify({ test: true }));
  fs.writeFileSync(path.join(testFilesDir, 'large-file.txt'), 'x'.repeat(1024 * 1024)); // 1MB file

  // Set global test timeout (handled in jest.config.js)
  // jest.setTimeout(30000);

  console.log('Global test setup completed');
};
