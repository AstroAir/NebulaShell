import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Required for static export
export const dynamic = 'force-static';

interface DownloadRequest {
  remotePath: string;
}



export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: DownloadRequest = await request.json();
    const { remotePath } = body;

    if (!remotePath) {
      return NextResponse.json({
        success: false,
        message: 'Remote path is required',
        error: 'MISSING_PATH',
      }, { status: 400 });
    }

    // Security: Prevent path traversal attacks
    if (remotePath.includes('..') || remotePath.includes('~')) {
      return NextResponse.json({
        success: false,
        message: 'Invalid path',
        error: 'INVALID_PATH',
      }, { status: 400 });
    }

    // Determine file location
    const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const userUploadDir = join(uploadDir, 'user-uploads'); // In production, use user ID
    const filePath = join(userUploadDir, remotePath);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        message: 'File not found',
        error: 'FILE_NOT_FOUND',
      }, { status: 404 });
    }

    // Get file stats
    const fileStats = await stat(filePath);
    
    // Read file
    const fileBuffer = await readFile(filePath);
    
    // Determine content type based on file extension
    const getContentType = (filename: string): string => {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'txt': return 'text/plain';
        case 'json': return 'application/json';
        case 'js': return 'application/javascript';
        case 'css': return 'text/css';
        case 'html': return 'text/html';
        case 'pdf': return 'application/pdf';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'zip': return 'application/zip';
        case 'tar': return 'application/x-tar';
        case 'gz': return 'application/gzip';
        default: return 'application/octet-stream';
      }
    };

    const contentType = getContentType(remotePath);
    const fileName = remotePath.split('/').pop() || 'download';

    // Log download for monitoring
    console.log(`File downloaded: ${remotePath} (${fileStats.size} bytes)`);

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStats.size.toString(),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Download failed',
      error: 'DOWNLOAD_ERROR',
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
