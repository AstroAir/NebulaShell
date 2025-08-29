'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  layoutShifts: number;
  memoryUsage?: number;
  componentRenders: number;
  lastRenderTime: number;
}

interface LayoutShiftEntry {
  value: number;
  sources: any[];
  hadRecentInput: boolean;
}

/**
 * Hook for monitoring component performance and layout shifts
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    layoutShifts: 0,
    componentRenders: 0,
    lastRenderTime: 0,
  });

  // Track component renders
  useEffect(() => {
    const now = Date.now();
    const renderTime = now - lastRenderTimeRef.current;
    renderCountRef.current += 1;
    lastRenderTimeRef.current = now;

    setMetrics(prev => ({
      ...prev,
      renderTime,
      componentRenders: renderCountRef.current,
      lastRenderTime: now,
    }));

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}: ${renderTime}ms`);
    }
  });

  // Monitor layout shifts
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    let cumulativeLayoutShift = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShiftEntry = entry as any;
        if (layoutShiftEntry.entryType === 'layout-shift' && !layoutShiftEntry.hadRecentInput) {
          cumulativeLayoutShift += layoutShiftEntry.value;
          
          setMetrics(prev => ({
            ...prev,
            layoutShifts: cumulativeLayoutShift,
          }));

          // Log significant layout shifts
          if (layoutShiftEntry.value > 0.1) {
            console.warn(`Layout shift detected in ${componentName}:`, {
              value: layoutShiftEntry.value,
              sources: layoutShiftEntry.sources,
            });
          }
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('Layout shift monitoring not supported:', error);
    }

    return () => {
      observer.disconnect();
    };
  }, [componentName]);

  // Monitor memory usage (if available)
  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window) || !('memory' in (window.performance as any))) {
      return;
    }

    const updateMemoryUsage = () => {
      const memory = (window.performance as any).memory;
      if (memory) {
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize,
        }));
      }
    };

    const interval = setInterval(updateMemoryUsage, 5000); // Check every 5 seconds
    updateMemoryUsage(); // Initial check

    return () => {
      clearInterval(interval);
    };
  }, []);

  return metrics;
}

/**
 * Hook for measuring render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef(0);

  const startMeasure = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  const endMeasure = useCallback(() => {
    const renderTime = performance.now() - renderStartRef.current;
    renderCountRef.current += 1;

    if (process.env.NODE_ENV === 'development') {
      if (renderTime > 16) {
        console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms (render #${renderCountRef.current})`);
      }
    }

    return renderTime;
  }, [componentName]);

  return { startMeasure, endMeasure };
}

/**
 * Hook for preventing unnecessary re-renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

/**
 * Hook for debouncing values to prevent excessive re-renders
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling function calls
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      return callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - (now - lastCallRef.current));
    }
  }) as T, [callback, delay]);
}

/**
 * Hook for monitoring intersection (useful for lazy loading)
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting;
        setIsIntersecting(isElementIntersecting);
        
        if (isElementIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, options, hasIntersected]);

  return { isIntersecting, hasIntersected };
}

/**
 * Hook for virtual scrolling performance
 */
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex,
  };
}

/**
 * Performance monitoring context for global metrics
 */
export interface GlobalPerformanceMetrics {
  totalLayoutShifts: number;
  averageRenderTime: number;
  memoryUsage: number;
  componentCount: number;
}

let globalMetrics: GlobalPerformanceMetrics = {
  totalLayoutShifts: 0,
  averageRenderTime: 0,
  memoryUsage: 0,
  componentCount: 0,
};

export function updateGlobalMetrics(metrics: Partial<GlobalPerformanceMetrics>) {
  globalMetrics = { ...globalMetrics, ...metrics };
}

export function getGlobalMetrics(): GlobalPerformanceMetrics {
  return { ...globalMetrics };
}

/**
 * Hook for reporting performance metrics to analytics
 */
export function usePerformanceReporting(enabled: boolean = true) {
  const reportMetrics = useCallback(async (metrics: any) => {
    if (!enabled || process.env.NODE_ENV !== 'production') return;

    try {
      await fetch('/api/performance/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...metrics,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch (error) {
      console.warn('Failed to report performance metrics:', error);
    }
  }, [enabled]);

  return { reportMetrics };
}
