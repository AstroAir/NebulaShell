import { NextRequest, NextResponse } from 'next/server';
import { sftpManager } from '@/lib/sftp-manager';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, path = '/' } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const listing = await sftpManager.listDirectory(sessionId, path);

    return NextResponse.json({
      success: true,
      listing,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list directory';
    logger.error('SFTP list directory failed', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}
