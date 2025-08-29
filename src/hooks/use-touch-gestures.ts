'use client';

import { useRef, useCallback } from 'react';

export interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export function useTouchGestures(options: TouchGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    swipeThreshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = options;

  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<TouchPoint | null>(null);
  const isLongPressRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const touchPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    touchStartRef.current = touchPoint;
    touchEndRef.current = null;
    isLongPressRef.current = false;

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress();
      }, longPressDelay);
    }
  }, [onLongPress, longPressDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press if finger moves too much
    if (touchStartRef.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      
      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
      }
    }
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    clearLongPressTimer();

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const touchPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    touchEndRef.current = touchPoint;

    // Don't process other gestures if it was a long press
    if (isLongPressRef.current) {
      return;
    }

    const deltaX = touchPoint.x - touchStartRef.current.x;
    const deltaY = touchPoint.y - touchStartRef.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Check for swipe gestures
    if (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
      return;
    }

    // Check for tap gestures
    if (absDeltaX < 10 && absDeltaY < 10) {
      // Check for double tap
      if (onDoubleTap && lastTapRef.current) {
        const timeDiff = touchPoint.timestamp - lastTapRef.current.timestamp;
        const distanceX = Math.abs(touchPoint.x - lastTapRef.current.x);
        const distanceY = Math.abs(touchPoint.y - lastTapRef.current.y);

        if (timeDiff < doubleTapDelay && distanceX < 30 && distanceY < 30) {
          onDoubleTap();
          lastTapRef.current = null;
          return;
        }
      }

      // Single tap
      if (onTap) {
        onTap();
      }

      lastTapRef.current = touchPoint;
    }
  }, [
    clearLongPressTimer,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    swipeThreshold,
    doubleTapDelay,
  ]);

  const attachGestures = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      clearLongPressTimer();
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, clearLongPressTimer]);

  return { attachGestures };
}

// Hook for swipe navigation between tabs
export function useSwipeNavigation(options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enabled?: boolean;
}) {
  const { onSwipeLeft, onSwipeRight, enabled = true } = options;

  const { attachGestures } = useTouchGestures({
    onSwipeLeft: enabled ? onSwipeLeft : undefined,
    onSwipeRight: enabled ? onSwipeRight : undefined,
    swipeThreshold: 80, // Higher threshold for tab navigation
  });

  return { attachGestures };
}

// Hook for terminal-specific touch interactions
export function useTerminalTouchGestures(options: {
  onDoubleTapToSelect?: () => void;
  onLongPressForMenu?: () => void;
  enabled?: boolean;
}) {
  const { onDoubleTapToSelect, onLongPressForMenu, enabled = true } = options;

  const { attachGestures } = useTouchGestures({
    onDoubleTap: enabled ? onDoubleTapToSelect : undefined,
    onLongPress: enabled ? onLongPressForMenu : undefined,
    longPressDelay: 600, // Slightly longer for terminal
  });

  return { attachGestures };
}
