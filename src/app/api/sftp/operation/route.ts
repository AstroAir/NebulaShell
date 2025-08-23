import { NextRequest, NextResponse } from 'next/server';
import { sftpManager } from '@/lib/sftp-manager';
import { logger } from '@/lib/logger';
import { FileOperation } from '@/types/file-transfer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, operation } = body as { sessionId: string; operation: FileOperation };

    if (!sessionId || !operation) {
      return NextResponse.json(
        { error: 'Session ID and operation are required' },
        { status: 400 }
      );
    }

    const result = await sftpManager.performFileOperation(sessionId, operation);

    if (result.success) {
      logger.info('SFTP operation completed', { 
        operation: operation.type, 
        source: operation.source,
        destination: operation.destination 
      }, sessionId);
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Operation failed';
    logger.error('SFTP operation failed', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}
