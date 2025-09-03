import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  ResponsiveLayout,
  ResponsiveMain,
  ResponsiveGrid,
  ResponsiveSidebar,
  ResponsiveContent,
  ResponsiveFooter,
} from '@/components/layout/ResponsiveLayout';

// Mock the responsive layout provider
jest.mock('@/components/layout/ResponsiveLayoutProvider', () => ({
  ResponsiveLayoutProvider: ({ children }: any) => children,
  useResponsiveLayout: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: false,
    sidebarOpen: true,
    setSidebarOpen: jest.fn(),
    isFullscreen: false,
    setIsFullscreen: jest.fn(),
    mobileMenuOpen: false,
    setMobileMenuOpen: jest.fn(),
    sidebarCollapsed: false,
    setSidebarCollapsed: jest.fn(),
    toggleSidebar: jest.fn(),
    toggleMobileMenu: jest.fn(),
    closeMobileOverlays: jest.fn(),
  }),
}));

describe('ResponsiveLayout Components', () => {
  describe('ResponsiveLayout', () => {
    it('renders children correctly', () => {
      render(
        <ResponsiveLayout>
          <div data-testid="child">Test content</div>
        </ResponsiveLayout>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('applies correct CSS classes', () => {
      const { container } = render(
        <ResponsiveLayout className="custom-class">
          <div>Content</div>
        </ResponsiveLayout>
      );

      const layout = container.firstChild as HTMLElement;
      expect(layout).toHaveClass('custom-class');
    });
  });

  describe('ResponsiveMain', () => {
    it('renders main content area', () => {
      render(
        <ResponsiveMain>
          <div data-testid="main-content">Main content</div>
        </ResponsiveMain>
      );

      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('applies semantic main element', () => {
      const { container } = render(
        <ResponsiveMain>
          <div>Content</div>
        </ResponsiveMain>
      );

      expect(container.querySelector('main')).toBeInTheDocument();
    });
  });

  describe('ResponsiveGrid', () => {
    it('renders grid layout', () => {
      render(
        <ResponsiveGrid>
          <div data-testid="grid-item-1">Item 1</div>
          <div data-testid="grid-item-2">Item 2</div>
        </ResponsiveGrid>
      );

      expect(screen.getByTestId('grid-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('grid-item-2')).toBeInTheDocument();
    });
  });

  describe('ResponsiveSidebar', () => {
    it('renders sidebar content', () => {
      render(
        <ResponsiveSidebar>
          <div data-testid="sidebar-content">Sidebar</div>
        </ResponsiveSidebar>
      );

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    });

    it('applies semantic aside element', () => {
      const { container } = render(
        <ResponsiveSidebar>
          <div>Content</div>
        </ResponsiveSidebar>
      );

      expect(container.querySelector('aside')).toBeInTheDocument();
    });
  });

  describe('ResponsiveContent', () => {
    it('renders content area', () => {
      render(
        <ResponsiveContent>
          <div data-testid="content">Content</div>
        </ResponsiveContent>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('ResponsiveFooter', () => {
    it('renders footer content', () => {
      render(
        <ResponsiveFooter>
          <div data-testid="footer-content">Footer</div>
        </ResponsiveFooter>
      );

      expect(screen.getByTestId('footer-content')).toBeInTheDocument();
    });

    it('applies semantic footer element', () => {
      const { container } = render(
        <ResponsiveFooter>
          <div>Content</div>
        </ResponsiveFooter>
      );

      expect(container.querySelector('footer')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper semantic structure', () => {
      const { container } = render(
        <ResponsiveLayout>
          <ResponsiveMain>
            <div>Main content</div>
          </ResponsiveMain>
          <ResponsiveSidebar>
            <div>Sidebar</div>
          </ResponsiveSidebar>
          <ResponsiveFooter>
            <div>Footer</div>
          </ResponsiveFooter>
        </ResponsiveLayout>
      );

      expect(container.querySelector('main')).toBeInTheDocument();
      expect(container.querySelector('aside')).toBeInTheDocument();
      expect(container.querySelector('footer')).toBeInTheDocument();
    });
  });
});
