import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface PerformanceMetrics {
  sessionId?: string;
  clientInfo: {
    userAgent: string;
    isMobile: boolean;
    screenSize: { width: number; height: number };
    connectionType?: string;
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  metrics: {
    pageLoadTime?: number;
    terminalInitTime?: number;
    firstInputDelay?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
    memoryUsage?: number;
    networkLatency?: number;
    websocketLatency?: number;
    autoCompleteLatency?: number;
    renderFrameRate?: number;
  };
  timestamp: number;
}

interface PerformanceReport {
  overall: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  recommendations: string[];
  optimizations: string[];
  mobileSpecific?: {
    batteryImpact: 'low' | 'medium' | 'high';
    dataUsage: 'low' | 'medium' | 'high';
    touchResponsiveness: 'excellent' | 'good' | 'poor';
  };
}

// Store performance data (in production, this would be a proper database)
const performanceData: Map<string, PerformanceMetrics[]> = new Map();

export async function POST(request: NextRequest) {
  try {
    const metrics: PerformanceMetrics = await request.json();
    
    // Validate required fields
    if (!metrics.clientInfo || !metrics.metrics || !metrics.timestamp) {
      return NextResponse.json(
        { error: 'Client info, metrics, and timestamp are required' },
        { status: 400 }
      );
    }

    // Store metrics
    const sessionId = metrics.sessionId || 'anonymous';
    if (!performanceData.has(sessionId)) {
      performanceData.set(sessionId, []);
    }
    
    const sessionMetrics = performanceData.get(sessionId)!;
    sessionMetrics.push(metrics);
    
    // Keep only last 100 entries per session
    if (sessionMetrics.length > 100) {
      sessionMetrics.splice(0, sessionMetrics.length - 100);
    }

    // Generate performance report
    const report = generatePerformanceReport(metrics);

    // Log performance issues
    if (report.overall === 'poor' || report.overall === 'needs-improvement') {
      logger.warn('Performance issues detected', {
        sessionId,
        overall: report.overall,
        isMobile: metrics.clientInfo.isMobile,
        recommendations: report.recommendations
      });
    }

    return NextResponse.json({
      success: true,
      report,
      stored: true,
      sessionMetricsCount: sessionMetrics.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process performance metrics';
    logger.error('Performance monitoring error', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const summary = url.searchParams.get('summary') === 'true';

    if (sessionId) {
      const sessionMetrics = performanceData.get(sessionId) || [];
      
      if (summary) {
        const summaryData = generateSessionSummary(sessionMetrics);
        return NextResponse.json({
          success: true,
          sessionId,
          summary: summaryData,
          metricsCount: sessionMetrics.length
        });
      }

      return NextResponse.json({
        success: true,
        sessionId,
        metrics: sessionMetrics,
        count: sessionMetrics.length
      });
    }

    // Return overall statistics
    const totalSessions = performanceData.size;
    const totalMetrics = Array.from(performanceData.values()).reduce((sum, metrics) => sum + metrics.length, 0);
    
    const mobileSessionsCount = Array.from(performanceData.values()).filter(metrics => 
      metrics.length > 0 && metrics[metrics.length - 1].clientInfo.isMobile
    ).length;

    return NextResponse.json({
      success: true,
      statistics: {
        totalSessions,
        totalMetrics,
        mobileSessionsCount,
        desktopSessionsCount: totalSessions - mobileSessionsCount,
        averageMetricsPerSession: totalSessions > 0 ? Math.round(totalMetrics / totalSessions) : 0
      }
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve performance data' },
      { status: 500 }
    );
  }
}

function generatePerformanceReport(
  currentMetrics: PerformanceMetrics
  // historicalMetrics parameter removed as it's not currently used
): PerformanceReport {
  const { metrics, clientInfo } = currentMetrics;
  const recommendations: string[] = [];
  const optimizations: string[] = [];
  
  let score = 100;

  // Analyze page load time
  if (metrics.pageLoadTime) {
    if (metrics.pageLoadTime > 3000) {
      score -= 20;
      recommendations.push('Page load time is slow (>3s). Consider code splitting and lazy loading.');
    } else if (metrics.pageLoadTime > 1500) {
      score -= 10;
      recommendations.push('Page load time could be improved (<1.5s is ideal).');
    }
  }

  // Analyze terminal initialization
  if (metrics.terminalInitTime) {
    if (metrics.terminalInitTime > 1000) {
      score -= 15;
      recommendations.push('Terminal initialization is slow. Consider optimizing xterm.js setup.');
    }
  }

  // Analyze First Input Delay (FID)
  if (metrics.firstInputDelay) {
    if (metrics.firstInputDelay > 100) {
      score -= 15;
      recommendations.push('First Input Delay is high. Optimize main thread blocking.');
    }
  }

  // Analyze Largest Contentful Paint (LCP)
  if (metrics.largestContentfulPaint) {
    if (metrics.largestContentfulPaint > 2500) {
      score -= 20;
      recommendations.push('Largest Contentful Paint is slow. Optimize critical resources.');
    }
  }

  // Analyze Cumulative Layout Shift (CLS)
  if (metrics.cumulativeLayoutShift) {
    if (metrics.cumulativeLayoutShift > 0.1) {
      score -= 10;
      recommendations.push('Layout shifts detected. Ensure stable layouts.');
    }
  }

  // Analyze network latency
  if (metrics.networkLatency) {
    if (metrics.networkLatency > 200) {
      score -= 10;
      recommendations.push('High network latency detected. Consider CDN or server optimization.');
    }
  }

  // Analyze WebSocket latency
  if (metrics.websocketLatency) {
    if (metrics.websocketLatency > 100) {
      score -= 10;
      recommendations.push('WebSocket latency is high. Check server performance.');
    }
  }

  // Mobile-specific analysis
  let mobileSpecific: PerformanceReport['mobileSpecific'];
  if (clientInfo.isMobile) {
    mobileSpecific = {
      batteryImpact: 'low',
      dataUsage: 'low',
      touchResponsiveness: 'excellent'
    };

    // Analyze mobile-specific metrics
    if (metrics.renderFrameRate && metrics.renderFrameRate < 30) {
      score -= 15;
      recommendations.push('Low frame rate on mobile. Reduce animations and optimize rendering.');
      mobileSpecific.batteryImpact = 'high';
    }

    if (metrics.memoryUsage && metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
      score -= 10;
      recommendations.push('High memory usage on mobile device. Optimize memory management.');
    }

    // Check for mobile optimizations
    if (clientInfo.screenSize.width < 768) {
      optimizations.push('Mobile layout optimizations applied');
    }

    if (clientInfo.connectionType === '2g' || clientInfo.connectionType === '3g') {
      recommendations.push('Slow connection detected. Enable data compression and reduce update frequency.');
      mobileSpecific.dataUsage = 'high';
    }
  }

  // Determine overall score
  let overall: PerformanceReport['overall'];
  if (score >= 90) overall = 'excellent';
  else if (score >= 75) overall = 'good';
  else if (score >= 50) overall = 'needs-improvement';
  else overall = 'poor';

  return {
    overall,
    recommendations,
    optimizations,
    mobileSpecific
  };
}

function generateSessionSummary(metrics: PerformanceMetrics[]) {
  if (metrics.length === 0) {
    return { message: 'No metrics available' };
  }

  const latest = metrics[metrics.length - 1];
  const averages = {
    pageLoadTime: 0,
    terminalInitTime: 0,
    networkLatency: 0,
    websocketLatency: 0,
    autoCompleteLatency: 0
  };

  let count = 0;
  metrics.forEach(metric => {
    if (metric.metrics.pageLoadTime) {
      averages.pageLoadTime += metric.metrics.pageLoadTime;
      count++;
    }
    if (metric.metrics.terminalInitTime) {
      averages.terminalInitTime += metric.metrics.terminalInitTime;
    }
    if (metric.metrics.networkLatency) {
      averages.networkLatency += metric.metrics.networkLatency;
    }
    if (metric.metrics.websocketLatency) {
      averages.websocketLatency += metric.metrics.websocketLatency;
    }
    if (metric.metrics.autoCompleteLatency) {
      averages.autoCompleteLatency += metric.metrics.autoCompleteLatency;
    }
  });

  // Calculate averages
  const keys = Object.keys(averages) as Array<keyof typeof averages>;
  keys.forEach(key => {
    averages[key] = count > 0 ? averages[key] / count : 0;
  });

  return {
    sessionDuration: Date.now() - metrics[0].timestamp,
    totalMetrics: metrics.length,
    isMobile: latest.clientInfo.isMobile,
    averages,
    latest: latest.metrics,
    trends: {
      improving: averages.networkLatency < (latest.metrics.networkLatency || 0),
      stable: Math.abs(averages.networkLatency - (latest.metrics.networkLatency || 0)) < 10
    }
  };
}
