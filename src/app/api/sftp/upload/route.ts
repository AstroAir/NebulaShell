import { NextRequest, NextResponse } from 'next/server';
import { sftpManager } from '@/lib/sftp-manager';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const remotePath = formData.get('remotePath') as string;

    if (!file || !sessionId || !remotePath) {
      return NextResponse.json(
        { error: 'File, session ID, and remote path are required' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload the file
    const transferId = await sftpManager.uploadFile(
      sessionId,
      buffer,
      remotePath,
      file.name
    );

    logger.info('File uploaded via API', { 
      fileName: file.name, 
      size: file.size, 
      remotePath 
    }, sessionId);

    return NextResponse.json({
      success: true,
      transferId,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    logger.error('SFTP upload failed', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}
