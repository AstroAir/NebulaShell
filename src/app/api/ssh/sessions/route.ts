import { NextResponse } from 'next/server';
import { sshManager } from '@/lib/ssh-manager';

export async function GET() {
  try {
    const sessions = sshManager.getAllSessions();
    
    const sessionData = sessions.map(session => ({
      id: session.id,
      name: session.config.name,
      hostname: session.config.hostname,
      port: session.config.port,
      username: session.config.username,
      connected: session.connected,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
    }));

    return NextResponse.json({
      success: true,
      sessions: sessionData,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
