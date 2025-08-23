import { NextRequest, NextResponse } from 'next/server';
import { sshManager } from '@/lib/ssh-manager';
import { SSHConnectionConfig } from '@/types/ssh';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostname, port, username, password, privateKey, passphrase, name } = body;

    // Validate required fields
    if (!hostname || !username) {
      return NextResponse.json(
        { error: 'Hostname and username are required' },
        { status: 400 }
      );
    }

    // Validate authentication method
    if (!password && !privateKey) {
      return NextResponse.json(
        { error: 'Either password or private key is required' },
        { status: 400 }
      );
    }

    const config: SSHConnectionConfig = {
      id: uuidv4(),
      hostname,
      port: port || 22,
      username,
      password,
      privateKey,
      passphrase,
      name: name || `${username}@${hostname}`,
    };

    // Create session but don't connect yet (connection happens via WebSocket)
    const session = await sshManager.createSession(config);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      session: {
        id: session.id,
        name: config.name,
        hostname: config.hostname,
        port: config.port,
        username: config.username,
        connected: session.connected,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error('SSH connection error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create SSH session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
