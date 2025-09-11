import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Required for static export
export const dynamic = 'force-static';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: number;
  permissions?: string;
  extension?: string;
}

interface ListRequest {
  remotePath?: string;
  showHidden?: boolean;
  sortBy?: 'name' | 'size' | 'modified' | 'type';
  sortOrder?: 'asc' | 'desc';
}

interface ListResponse {
  success: boolean;
  message: string;
  files?: FileItem[];
  currentPath?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ListResponse>> {
  try {
    const body: ListRequest = await request.json();
    const { 
      remotePath = '', 
      showHidden = false, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = body;

    // Security: Prevent path traversal attacks
    if (remotePath.includes('..')) {
      return NextResponse.json({
        success: false,
        message: 'Invalid path',
        error: 'INVALID_PATH',
      }, { status: 400 });
    }

    // Determine directory to list
    const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const userUploadDir = join(uploadDir, 'user-uploads'); // In production, use user ID
    const targetPath = remotePath ? join(userUploadDir, remotePath) : userUploadDir;

    // Check if directory exists
    if (!existsSync(targetPath)) {
      return NextResponse.json({
        success: false,
        message: 'Directory not found',
        error: 'DIRECTORY_NOT_FOUND',
      }, { status: 404 });
    }

    // Check if it's actually a directory
    const pathStats = await stat(targetPath);
    if (!pathStats.isDirectory()) {
      return NextResponse.json({
        success: false,
        message: 'Path is not a directory',
        error: 'NOT_DIRECTORY',
      }, { status: 400 });
    }

    // Read directory contents
    const entries = await readdir(targetPath);
    const files: FileItem[] = [];

    for (const entry of entries) {
      // Skip hidden files if not requested
      if (!showHidden && entry.startsWith('.')) {
        continue;
      }

      const entryPath = join(targetPath, entry);
      const entryStats = await stat(entryPath);
      
      const fileItem: FileItem = {
        name: entry,
        path: remotePath ? join(remotePath, entry) : entry,
        type: entryStats.isDirectory() ? 'directory' : 'file',
        size: entryStats.size,
        modified: entryStats.mtime.getTime(),
      };

      // Add extension for files
      if (fileItem.type === 'file') {
        const parts = entry.split('.');
        if (parts.length > 1) {
          fileItem.extension = parts.pop()?.toLowerCase();
        }
      }

      // Add basic permissions info (simplified)
      try {
        fileItem.permissions = entryStats.mode.toString(8).slice(-3);
      } catch {
        // Permissions not available on all systems
      }

      files.push(fileItem);
    }

    // Sort files
    files.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'modified':
          comparison = a.modified - b.modified;
          break;
        case 'type':
          // Directories first, then files
          if (a.type !== b.type) {
            comparison = a.type === 'directory' ? -1 : 1;
          } else {
            comparison = a.name.localeCompare(b.name);
          }
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Log access for monitoring
    console.log(`Directory listed: ${targetPath} (${files.length} items)`);

    return NextResponse.json({
      success: true,
      message: 'Directory listed successfully',
      files,
      currentPath: remotePath,
    });

  } catch (error) {
    console.error('List directory error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to list directory',
      error: 'LIST_ERROR',
    }, { status: 500 });
  }
}

// Handle GET requests for simple directory listing
export async function GET(request: NextRequest): Promise<NextResponse<ListResponse>> {
  const { searchParams } = new URL(request.url);
  const remotePath = searchParams.get('path') || '';
  const showHidden = searchParams.get('hidden') === 'true';
  const sortBy = (searchParams.get('sort') as any) || 'name';
  const sortOrder = (searchParams.get('order') as any) || 'asc';

  // Create a mock request body for the POST handler
  const mockRequest = {
    json: async () => ({
      remotePath,
      showHidden,
      sortBy,
      sortOrder,
    }),
  } as NextRequest;

  return POST(mockRequest);
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
