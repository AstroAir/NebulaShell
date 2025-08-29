const fs = require('fs');
const path = require('path');

module.exports = async () => {
  // Clean up test upload directory
  const uploadDir = process.env.UPLOAD_DIR || '/tmp/test-uploads';
  if (fs.existsSync(uploadDir)) {
    try {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test upload directory:', error.message);
    }
  }

  console.log('Global test teardown completed');
};
