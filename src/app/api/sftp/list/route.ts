import { NextRequest, NextResponse } from 'next/server';
import { sftpManager } from '@/lib/sftp-manager';
import { logger } from '@/lib/logger';

// Required for static export
export const dynamic = 'force-static';

interface SFTPListRequest {
  sessionId: string;
  path?: string;
  options?: {
    mobileOptimized?: boolean;
    maxItems?: number;
    includeHidden?: boolean;
    sortBy?: 'name' | 'size' | 'modified' | 'type';
    sortOrder?: 'asc' | 'desc';
    thumbnails?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SFTPListRequest = await request.json();
    const { sessionId, path = '/', options = {} } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const {
      mobileOptimized = false,
      maxItems = mobileOptimized ? 50 : 200,
      includeHidden = false,
      sortBy = 'name',
      sortOrder = 'asc'
      // thumbnails option removed as it's not currently implemented
    } = options;

    const startTime = Date.now();
    const listing = await sftpManager.listDirectory(sessionId, path);

    // Filter hidden files if requested
    let filteredItems = includeHidden ? listing.items : listing.items.filter(item => !item.name.startsWith('.'));

    // Sort the listing
    filteredItems.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'modified':
          const aTime = a.modifiedTime instanceof Date ? a.modifiedTime.getTime() : 0;
          const bTime = b.modifiedTime instanceof Date ? b.modifiedTime.getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Limit items for mobile
    if (filteredItems.length > maxItems) {
      filteredItems = filteredItems.slice(0, maxItems);
    }

    // Add mobile-specific metadata
    const response: any = {
      success: true,
      listing: {
        ...listing,
        items: filteredItems
      },
      metadata: {
        path,
        totalItems: listing.items.length,
        filteredItems: filteredItems.length,
        includeHidden,
        sortBy,
        sortOrder,
        mobileOptimized,
        processingTime: Date.now() - startTime
      }
    };

    // Add performance hints for mobile
    if (mobileOptimized) {
      response.mobileHints = {
        useVirtualScrolling: filteredItems.length > 20,
        enableLazyLoading: filteredItems.length > 50,
        recommendBatching: filteredItems.length > 100
      };
    }

    return NextResponse.json(response);
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
