import { NextRequest, NextResponse } from 'next/server';
import { sshManager } from '@/lib/ssh-manager';

// Required for static export
export const dynamic = 'force-static';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await sshManager.disconnect(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session disconnected successfully',
    });
  } catch (error) {
    console.error('SSH disconnection error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to disconnect SSH session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
