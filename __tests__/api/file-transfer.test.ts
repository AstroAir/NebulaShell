// Mock path module with simple, working join function
jest.mock('path', () => ({
  join: (...args: string[]) => {
    // Simple path joining that works reliably in tests
    const validArgs = args.filter(arg => arg != null && arg !== '');
    return validArgs.length > 0 ? validArgs.join('/').replace(/\/+/g, '/') : '/tmp/test-uploads';
  },
  extname: (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  },
}));

import { NextRequest } from 'next/server';
import { POST as uploadPOST } from '@/app/api/file-transfer/upload/route';
import { POST as downloadPOST } from '@/app/api/file-transfer/download/route';
import { POST as listPOST, GET as listGET } from '@/app/api/file-transfer/list/route';
import fs from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
}));



// Mock process.cwd() to return a valid path
const originalCwd = process.cwd;
process.cwd = jest.fn(() => '/mock/project/root');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = require('fs/promises') as jest.Mocked<typeof import('fs/promises')>;

describe('File Transfer API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPLOAD_DIR = '/tmp/test-uploads';
  });

  describe('Upload API', () => {
    const createMockRequest = (formData: FormData) => {
      return {
        formData: jest.fn().mockResolvedValue(formData),
      } as unknown as NextRequest;
    };

    const createMockFile = (name: string, content: string, type: string) => {
      // For large files, don't include the full content to avoid memory issues
      const actualSize = content.length;
      const sampleContent = content.length > 1000 ? content.substring(0, 1000) + '...[truncated]' : content;
      const metadataContent = `MOCK_FILE_|${name}|${type}|${actualSize}|${sampleContent}`;
      const file = new File([metadataContent], name, { type });
      // Set the size to the actual content length for validation
      Object.defineProperty(file, 'size', { value: actualSize, writable: false, configurable: true });
      return file;
    };

    it('successfully uploads a valid file', async () => {
      const formData = new FormData();
      const file = createMockFile('test.txt', 'Hello, World!', 'text/plain');
      formData.append('file', file);
      formData.append('remotePath', '/home/user');

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('File uploaded successfully');
      expect(data.filePath).toBeDefined();
      expect(data.size).toBe(file.size);
    });

    it('rejects files that are too large', async () => {
      const formData = new FormData();
      const largeContent = 'x'.repeat(200 * 1024 * 1024); // 200MB
      const file = createMockFile('large.txt', largeContent, 'text/plain');
      formData.append('file', file);

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('FILE_TOO_LARGE');
    });

    it('rejects invalid file types', async () => {
      const formData = new FormData();
      const file = createMockFile('malware.exe', 'malicious content', 'application/x-executable');
      formData.append('file', file);

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_FILE_TYPE');
    });

    it('returns error when no file is provided', async () => {
      const formData = new FormData();
      formData.append('remotePath', '/home/user');

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('MISSING_FILE');
    });

    it('creates upload directory if it does not exist', async () => {
      const formData = new FormData();
      const file = createMockFile('test.txt', 'content', 'text/plain');
      formData.append('file', file);

      mockFs.existsSync.mockReturnValue(false);
      mockFsPromises.mkdir.mockResolvedValue(undefined);
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);

      // Debug: Check what mkdir was actually called with
      console.log('mkdir calls:', mockFsPromises.mkdir.mock.calls);

      expect(mockFsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('user-uploads'),
        { recursive: true }
      );
    });

    it('sanitizes file names', async () => {
      const formData = new FormData();
      const file = createMockFile('../../malicious.txt', 'content', 'text/plain');
      formData.append('file', file);

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filePath).not.toContain('../');
    });

    it('handles file write errors', async () => {
      const formData = new FormData();
      const file = createMockFile('test.txt', 'content', 'text/plain');
      formData.append('file', file);

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.writeFile.mockRejectedValue(new Error('Disk full'));

      const request = createMockRequest(formData);
      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UPLOAD_ERROR');
    });
  });

  describe('Download API', () => {
    const createMockRequest = (body: any) => {
      return {
        json: jest.fn().mockResolvedValue(body),
      } as unknown as NextRequest;
    };

    it('successfully downloads an existing file', async () => {
      const requestBody = { remotePath: 'test.txt' };
      const fileContent = Buffer.from('Hello, World!');
      const fileStats = { size: fileContent.length };

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValue(fileStats as any);
      mockFsPromises.readFile.mockResolvedValue(fileContent);

      const request = createMockRequest(requestBody);
      const response = await downloadPOST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      expect(response.headers.get('Content-Length')).toBe(fileContent.length.toString());
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
    });

    it('returns 404 for non-existent files', async () => {
      const requestBody = { remotePath: 'nonexistent.txt' };

      mockFs.existsSync.mockReturnValue(false);

      const request = createMockRequest(requestBody);
      const response = await downloadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('FILE_NOT_FOUND');
    });

    it('prevents path traversal attacks', async () => {
      const requestBody = { remotePath: '../../../etc/passwd' };

      const request = createMockRequest(requestBody);
      const response = await downloadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_PATH');
    });

    it('returns error when remote path is missing', async () => {
      const requestBody = {};

      const request = createMockRequest(requestBody);
      const response = await downloadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('MISSING_PATH');
    });

    it('sets correct content type based on file extension', async () => {
      const testCases = [
        { filename: 'test.json', expectedType: 'application/json' },
        { filename: 'test.png', expectedType: 'image/png' },
        { filename: 'test.pdf', expectedType: 'application/pdf' },
        { filename: 'test.unknown', expectedType: 'application/octet-stream' },
      ];

      for (const testCase of testCases) {
        const requestBody = { remotePath: testCase.filename };
        const fileContent = Buffer.from('content');

        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.stat.mockResolvedValue({ size: fileContent.length } as any);
        mockFsPromises.readFile.mockResolvedValue(fileContent);

        const request = createMockRequest(requestBody);
        const response = await downloadPOST(request);

        expect(response.headers.get('Content-Type')).toBe(testCase.expectedType);
      }
    });

    it('handles file read errors', async () => {
      const requestBody = { remotePath: 'test.txt' };

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValue({ size: 100 } as any);
      mockFsPromises.readFile.mockRejectedValue(new Error('Permission denied'));

      const request = createMockRequest(requestBody);
      const response = await downloadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DOWNLOAD_ERROR');
    });
  });

  describe('List API', () => {
    const createMockRequest = (body: any) => {
      return {
        json: jest.fn().mockResolvedValue(body),
      } as unknown as NextRequest;
    };

    const createMockURL = (searchParams: Record<string, string>) => {
      return {
        url: `http://localhost:3000/api/file-transfer/list?${new URLSearchParams(searchParams).toString()}`,
      } as unknown as NextRequest;
    };

    it('lists files in directory', async () => {
      const requestBody = { remotePath: '' };
      const mockFiles = ['file1.txt', 'file2.json', 'subdir'];
      const mockStats = [
        { isDirectory: () => false, size: 100, mtime: new Date(), mode: 0o644 },
        { isDirectory: () => false, size: 200, mtime: new Date(), mode: 0o644 },
        { isDirectory: () => true, size: 0, mtime: new Date(), mode: 0o755 },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(mockFiles as any);
      mockFsPromises.stat
        .mockResolvedValueOnce(mockStats[0] as any)
        .mockResolvedValueOnce(mockStats[1] as any)
        .mockResolvedValueOnce(mockStats[2] as any);

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files).toHaveLength(3);
      expect(data.files[0].name).toBe('file1.txt');
      expect(data.files[0].type).toBe('file');
      expect(data.files[2].name).toBe('subdir');
      expect(data.files[2].type).toBe('directory');
    });

    it('filters hidden files when showHidden is false', async () => {
      const requestBody = { remotePath: '', showHidden: false };
      const mockFiles = ['file1.txt', '.hidden', 'file2.txt'];

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(mockFiles as any);
      mockFsPromises.stat
        .mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date(), mode: 0o644 } as any);

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(data.files).toHaveLength(2);
      expect(data.files.some((f: any) => f.name === '.hidden')).toBe(false);
    });

    it('includes hidden files when showHidden is true', async () => {
      const requestBody = { remotePath: '', showHidden: true };
      const mockFiles = ['file1.txt', '.hidden', 'file2.txt'];

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(mockFiles as any);
      mockFsPromises.stat
        .mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date(), mode: 0o644 } as any);

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(data.files).toHaveLength(3);
      expect(data.files.some((f: any) => f.name === '.hidden')).toBe(true);
    });

    it('sorts files by name by default', async () => {
      const requestBody = { remotePath: '' };
      const mockFiles = ['zebra.txt', 'alpha.txt', 'beta.txt'];

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(mockFiles as any);
      mockFsPromises.stat
        .mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date(), mode: 0o644 } as any);

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(data.files[0].name).toBe('alpha.txt');
      expect(data.files[1].name).toBe('beta.txt');
      expect(data.files[2].name).toBe('zebra.txt');
    });

    it('sorts files by size when requested', async () => {
      const requestBody = { remotePath: '', sortBy: 'size' };
      const mockFiles = ['small.txt', 'large.txt', 'medium.txt'];
      const mockStats = [
        { isDirectory: () => false, size: 50, mtime: new Date(), mode: 0o644 },
        { isDirectory: () => false, size: 500, mtime: new Date(), mode: 0o644 },
        { isDirectory: () => false, size: 200, mtime: new Date(), mode: 0o644 },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(mockFiles as any);
      mockFsPromises.stat
        .mockResolvedValueOnce(mockStats[0] as any)
        .mockResolvedValueOnce(mockStats[1] as any)
        .mockResolvedValueOnce(mockStats[2] as any);

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(data.files[0].name).toBe('small.txt');
      expect(data.files[1].name).toBe('medium.txt');
      expect(data.files[2].name).toBe('large.txt');
    });

    it('returns 404 for non-existent directory', async () => {
      const requestBody = { remotePath: 'nonexistent' };

      mockFs.existsSync.mockReturnValue(false);

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DIRECTORY_NOT_FOUND');
    });

    it('prevents path traversal attacks', async () => {
      const requestBody = { remotePath: '../../../etc' };

      const request = createMockRequest(requestBody);
      const response = await listPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_PATH');
    });

    it('handles GET requests with query parameters', async () => {
      const mockFiles = ['file1.txt'];

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(mockFiles as any);
      mockFsPromises.stat
        .mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date(), mode: 0o644 } as any);

      const request = createMockURL({ path: '', hidden: 'false' });
      const response = await listGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files).toHaveLength(1);
    });
  });
});
