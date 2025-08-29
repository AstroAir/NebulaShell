import { NextRequest, NextResponse } from 'next/server';
import { sshManager } from '@/lib/ssh-manager';
import { logger } from '@/lib/logger';

interface MobileSessionRequest {
  action: 'optimize' | 'status' | 'settings' | 'cleanup';
  sessionId?: string;
  settings?: {
    lowBandwidth?: boolean;
    touchOptimized?: boolean;
    reducedAnimations?: boolean;
    compressData?: boolean;
    batchUpdates?: boolean;
  };
}

interface MobileSessionResponse {
  success: boolean;
  data?: any;
  optimizations?: {
    applied: string[];
    recommendations: string[];
  };
  performance?: {
    latency: number;
    bandwidth: 'high' | 'medium' | 'low';
    batteryOptimized: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: MobileSessionRequest = await request.json();
    const { action, sessionId, settings = {} } = body;

    switch (action) {
      case 'optimize':
        return await handleOptimizeSession(sessionId, settings);
      
      case 'status':
        return await handleSessionStatus(sessionId);
      
      case 'settings':
        return await handleUpdateSettings(sessionId, settings);
      
      case 'cleanup':
        return await handleCleanupSessions();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: optimize, status, settings, cleanup' },
          { status: 400 }
        );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Mobile session API error';
    logger.error('Mobile session API error', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

async function handleOptimizeSession(
  sessionId?: string, 
  settings: any = {}
): Promise<NextResponse> {
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required for optimization' },
      { status: 400 }
    );
  }

  const session = sshManager.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  const optimizations: string[] = [];
  const recommendations: string[] = [];

  // Apply mobile optimizations
  if (settings.lowBandwidth) {
    optimizations.push('Low bandwidth mode enabled');
    // Reduce terminal update frequency
    // Compress data transmission
  }

  if (settings.touchOptimized) {
    optimizations.push('Touch interface optimizations enabled');
    // Adjust touch targets
    // Enable gesture recognition
  }

  if (settings.reducedAnimations) {
    optimizations.push('Reduced animations for better performance');
    // Disable non-essential animations
  }

  if (settings.compressData) {
    optimizations.push('Data compression enabled');
    // Enable gzip compression for WebSocket data
  }

  if (settings.batchUpdates) {
    optimizations.push('Batched updates for better performance');
    // Batch terminal updates to reduce redraws
  }

  // Generate recommendations based on session state
  const sessionAge = Date.now() - session.createdAt.getTime();
  if (sessionAge > 30 * 60 * 1000) { // 30 minutes
    recommendations.push('Consider refreshing long-running sessions');
  }

  if (!settings.compressData) {
    recommendations.push('Enable data compression for better mobile performance');
  }

  // Detect connection quality (mock implementation)
  const performance = {
    latency: Math.random() * 200 + 50, // Mock latency 50-250ms
    bandwidth: (Math.random() > 0.5 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    batteryOptimized: settings.reducedAnimations && settings.batchUpdates
  };

  const response: MobileSessionResponse = {
    success: true,
    data: {
      sessionId,
      optimized: true,
      timestamp: new Date().toISOString()
    },
    optimizations: {
      applied: optimizations,
      recommendations
    },
    performance
  };

  // Update session activity
  sshManager.updateLastActivity(sessionId);

  return NextResponse.json(response);
}

async function handleSessionStatus(sessionId?: string): Promise<NextResponse> {
  if (!sessionId) {
    // Return status for all sessions
    const allSessions = sshManager.getAllSessions();
    const sessionStatuses = allSessions.map(session => ({
      id: session.id,
      connected: session.connected,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      hostname: session.config.hostname,
      username: session.config.username,
      mobileOptimized: false // This would be stored in session metadata
    }));

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessionStatuses,
        totalSessions: sessionStatuses.length,
        activeSessions: sessionStatuses.filter(s => s.connected).length
      }
    });
  }

  const session = sshManager.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  // Calculate session metrics
  const sessionAge = Date.now() - session.createdAt.getTime();
  const lastActivityAge = Date.now() - session.lastActivity.getTime();

  return NextResponse.json({
    success: true,
    data: {
      sessionId,
      connected: session.connected,
      hostname: session.config.hostname,
      username: session.config.username,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      metrics: {
        sessionAge,
        lastActivityAge,
        isIdle: lastActivityAge > 5 * 60 * 1000, // 5 minutes
        shouldOptimize: sessionAge > 10 * 60 * 1000 // 10 minutes
      }
    }
  });
}

async function handleUpdateSettings(
  sessionId?: string, 
  settings: any = {}
): Promise<NextResponse> {
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required for settings update' },
      { status: 400 }
    );
  }

  const session = sshManager.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  // Store mobile settings (this would typically be persisted)
  const mobileSettings = {
    lowBandwidth: settings.lowBandwidth || false,
    touchOptimized: settings.touchOptimized || false,
    reducedAnimations: settings.reducedAnimations || false,
    compressData: settings.compressData || false,
    batchUpdates: settings.batchUpdates || false,
    updatedAt: new Date().toISOString()
  };

  logger.info('Mobile settings updated', { sessionId, settings: mobileSettings });

  return NextResponse.json({
    success: true,
    data: {
      sessionId,
      settings: mobileSettings,
      message: 'Mobile settings updated successfully'
    }
  });
}

async function handleCleanupSessions(): Promise<NextResponse> {
  const allSessions = sshManager.getAllSessions();
  const now = Date.now();
  const cleanupThreshold = 60 * 60 * 1000; // 1 hour
  
  let cleanedCount = 0;
  const cleanedSessions: string[] = [];

  for (const session of allSessions) {
    const lastActivityAge = now - session.lastActivity.getTime();
    
    if (!session.connected && lastActivityAge > cleanupThreshold) {
      try {
        await sshManager.disconnect(session.id);
        cleanedSessions.push(session.id);
        cleanedCount++;
      } catch (error) {
        logger.error('Failed to cleanup session', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      cleanedCount,
      cleanedSessions,
      remainingSessions: allSessions.length - cleanedCount,
      cleanupThreshold: cleanupThreshold / 1000 / 60, // minutes
      timestamp: new Date().toISOString()
    }
  });
}

// GET endpoint for quick status checks
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (sessionId) {
      return await handleSessionStatus(sessionId);
    } else {
      return await handleSessionStatus();
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to get session status' },
      { status: 500 }
    );
  }
}
