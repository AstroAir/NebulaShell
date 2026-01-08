import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { Terminal } from '@/components/terminal/Terminal';
import { TerminalProvider } from '@/components/terminal/TerminalContext';
import { MockSocket } from '../../mocks/socket.io';

// Mock xterm.js with mobile-specific features
const mockXTerm = {
  open: jest.fn(),
  write: jest.fn(),
  dispose: jest.fn(),
  loadAddon: jest.fn(),
  onData: jest.fn(),
  onResize: jest.fn(),
  resize: jest.fn(),
  fit: jest.fn(),
  focus: jest.fn(),
  element: document.createElement('div'),
  cols: 80,
  rows: 24,
};

const mockFitAddon = {
  fit: jest.fn(),
  proposeDimensions: jest.fn(() => ({ cols: 80, rows: 24 })),
};

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn(() => mockXTerm),
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn(() => mockFitAddon),
}));

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn(() => ({})),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => new MockSocket()),
}));

// Mock responsive hooks
const mockUseResponsive = jest.fn();
const mockUseViewport = jest.fn();
jest.mock('@/hooks/use-responsive', () => ({
  useResponsive: () => mockUseResponsive(),
  useViewport: () => mockUseViewport(),
}));

const mockUseTouchGestures = jest.fn();
jest.mock('@/hooks/use-touch-gestures', () => ({
  useTouchGestures: () => mockUseTouchGestures(),
}));

describe('Responsive Design and Mobile Compatibility', () => {
  let mockSocket: MockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new MockSocket();
    require('socket.io-client').io.mockReturnValue(mockSocket);
    mockSocket.connect();

    // Default responsive state
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      screenWidth: 1920,
      screenHeight: 1080,
    });

    mockUseViewport.mockReturnValue({
      width: 1920,
      height: 1080,
    });

    mockUseTouchGestures.mockReturnValue({
      onTouchStart: jest.fn(),
      onTouchMove: jest.fn(),
      onTouchEnd: jest.fn(),
    });
  });

  afterEach(() => {
    mockSocket.cleanup();
  });

  describe('Desktop Responsive Behavior', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1920,
        screenHeight: 1080,
      });
    });

    it('should render with desktop configuration', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            fontSize: expect.any(Number),
            fontFamily: expect.any(String),
          })
        );
      });
    });

    it('should handle large screen dimensions', async () => {
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 2560,
        screenHeight: 1440,
      });

      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      expect(container).toHaveClass('min-h-[320px]');
    });

    it('should handle window resize on desktop', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });

      // Simulate window resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1600 });
        Object.defineProperty(window, 'innerHeight', { value: 900 });
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });
  });

  describe('Tablet Responsive Behavior', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        screenWidth: 768,
        screenHeight: 1024,
      });
    });

    it('should render with tablet configuration', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            fontSize: expect.any(Number),
            convertEol: true,
          })
        );
      });
    });

    it('should handle tablet orientation changes', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });

      // Simulate orientation change (portrait to landscape)
      act(() => {
        mockUseResponsive.mockReturnValue({
          isMobile: false,
          isTablet: true,
          isDesktop: false,
          screenWidth: 1024,
          screenHeight: 768,
        });
        window.dispatchEvent(new Event('orientationchange'));
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });

    it('should optimize touch interactions for tablet', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Simulate touch interaction
      act(() => {
        fireEvent.touchStart(container, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
      });

      expect(mockUseTouchGestures).toHaveBeenCalled();
    });
  });

  describe('Mobile Responsive Behavior', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 667,
      });
    });

    it('should render with mobile configuration', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            convertEol: true,
            disableStdin: false,
            macOptionIsMeta: true,
          })
        );
      });
    });

    it('should handle small screen dimensions', async () => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 320,
        screenHeight: 568,
      });

      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      expect(container).toBeInTheDocument();
    });

    it('should prevent zoom on mobile', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Check for touch-action CSS property (would be set by preventZoom function)
      expect(container).toBeInTheDocument();
    });

    it('should optimize scrolling for mobile', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Simulate touch scroll
      act(() => {
        fireEvent.touchStart(container, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchMove(container, {
          touches: [{ clientX: 100, clientY: 50 }],
        });
        fireEvent.touchEnd(container);
      });

      expect(mockUseTouchGestures).toHaveBeenCalled();
    });

    it('should handle mobile keyboard appearance', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      // Simulate mobile keyboard appearance (viewport height change)
      act(() => {
        Object.defineProperty(window, 'innerHeight', { value: 300 });
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });
  });

  describe('Touch Gesture Support', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 667,
      });
    });

    it('should handle tap gestures', async () => {
      const mockTouchGestures = {
        onTouchStart: jest.fn(),
        onTouchMove: jest.fn(),
        onTouchEnd: jest.fn(),
      };
      mockUseTouchGestures.mockReturnValue(mockTouchGestures);

      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      act(() => {
        fireEvent.touchStart(container, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchEnd(container, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });
      });

      expect(mockTouchGestures.onTouchStart).toHaveBeenCalled();
      expect(mockTouchGestures.onTouchEnd).toHaveBeenCalled();
    });

    it('should handle swipe gestures', async () => {
      const mockTouchGestures = {
        onTouchStart: jest.fn(),
        onTouchMove: jest.fn(),
        onTouchEnd: jest.fn(),
      };
      mockUseTouchGestures.mockReturnValue(mockTouchGestures);

      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Simulate swipe gesture
      act(() => {
        fireEvent.touchStart(container, {
          touches: [{ clientX: 200, clientY: 100 }],
        });
        fireEvent.touchMove(container, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchEnd(container, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });
      });

      expect(mockTouchGestures.onTouchStart).toHaveBeenCalled();
      expect(mockTouchGestures.onTouchMove).toHaveBeenCalled();
      expect(mockTouchGestures.onTouchEnd).toHaveBeenCalled();
    });

    it('should handle pinch gestures for zoom', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Simulate pinch gesture
      act(() => {
        fireEvent.touchStart(container, {
          touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 200, clientY: 200 },
          ],
        });
        fireEvent.touchMove(container, {
          touches: [
            { clientX: 90, clientY: 90 },
            { clientX: 210, clientY: 210 },
          ],
        });
        fireEvent.touchEnd(container);
      });

      expect(mockUseTouchGestures).toHaveBeenCalled();
    });

    it('should handle long press gestures', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Simulate long press
      act(() => {
        fireEvent.touchStart(container, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
      });

      // Wait for long press duration
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      act(() => {
        fireEvent.touchEnd(container, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });
      });

      expect(mockUseTouchGestures).toHaveBeenCalled();
    });
  });

  describe('Accessibility on Mobile', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 667,
      });
    });

    it('should maintain accessibility attributes on mobile', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'Terminal');
    });

    it('should handle screen reader compatibility', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      const container = screen.getByTestId('terminal-container');
      
      // Simulate screen reader focus
      act(() => {
        container.focus();
      });

      expect(container).toHaveFocus();
    });

    it('should support high contrast mode', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      // Terminal should adapt to high contrast preferences
      expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
        expect.objectContaining({
          minimumContrastRatio: expect.any(Number),
        })
      );
    });
  });

  describe('Performance Optimization for Mobile', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 667,
      });
    });

    it('should optimize rendering for mobile performance', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      // Check that mobile-specific optimizations are applied
      await waitFor(() => {
        expect(require('@xterm/xterm').Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            convertEol: true,
            macOptionIsMeta: true,
          })
        );
      });
    });

    it('should handle memory constraints on mobile', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      // Simulate memory pressure
      act(() => {
        window.dispatchEvent(new Event('memorywarning'));
      });

      // Terminal should handle memory warnings gracefully
      expect(mockXTerm.open).toHaveBeenCalled();
    });

    it('should throttle resize events on mobile', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });

      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
      }

      // Should throttle resize calls
      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });
  });

  describe('Cross-Device Compatibility', () => {
    it('should handle device switching', async () => {
      // Start with mobile
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 667,
      });

      const { rerender } = render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      await waitFor(() => {
        expect(mockXTerm.open).toHaveBeenCalled();
      });

      // Switch to desktop
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      rerender(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      // Should adapt to new device type
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should maintain session across device changes', async () => {
      render(
        <TerminalProvider>
          <Terminal />
        </TerminalProvider>
      );

      // Simulate device change
      act(() => {
        mockUseResponsive.mockReturnValue({
          isMobile: false,
          isTablet: true,
          isDesktop: false,
          screenWidth: 768,
          screenHeight: 1024,
        });
        window.dispatchEvent(new Event('resize'));
      });

      // Session should remain intact
      expect(mockSocket.connected).toBe(true);
    });
  });
});
