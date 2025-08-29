import { NextRequest, NextResponse } from 'next/server';
import { sftpManager } from '@/lib/sftp-manager';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, remotePath } = body;

    if (!sessionId || !remotePath) {
      return NextResponse.json(
        { error: 'Session ID and remote path are required' },
        { status: 400 }
      );
    }

    const buffer = await sftpManager.downloadFile(sessionId, remotePath);
    
    const fileName = remotePath.split('/').pop() || 'download';
    
    logger.info('File downloaded via API', { 
      fileName, 
      remotePath,
      size: buffer.length 
    }, sessionId);

    // Return the file as a blob
    return new NextResponse(buffer as BodyInit, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Download failed';
    logger.error('SFTP download failed', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}
