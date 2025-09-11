'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileOptimizedLayout({ children, className }: MobileOptimizedLayoutProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      if (currentScrollY > lastScrollY.current) {
        setScrollDirection('down');
      } else {
        setScrollDirection('up');
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className={cn(
        'min-h-screen bg-background transition-all duration-300',
        'safe-area-inset',
        className
      )}
    >
      <div className={cn(
        'transition-transform duration-300',
        scrollDirection === 'down' && isScrolled && 'transform -translate-y-full'
      )}>
        {children}
      </div>
    </div>
  );
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function MobileDrawer({ 
  isOpen, 
  onClose, 
  children, 
  position = 'left',
  className 
}: MobileDrawerProps) {
  const handlers = useSwipeable({
    onSwipedLeft: position === 'right' ? onClose : undefined,
    onSwipedRight: position === 'left' ? onClose : undefined,
    onSwipedDown: position === 'bottom' ? onClose : undefined,
    trackMouse: false,
  });

  const drawerStyles = {
    left: cn(
      'left-0 top-0 h-full w-4/5 max-w-sm',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    ),
    right: cn(
      'right-0 top-0 h-full w-4/5 max-w-sm',
      isOpen ? 'translate-x-0' : 'translate-x-full'
    ),
    bottom: cn(
      'bottom-0 left-0 w-full h-3/4 max-h-[600px]',
      'rounded-t-2xl',
      isOpen ? 'translate-y-0' : 'translate-y-full'
    ),
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        {...handlers}
        className={cn(
          'fixed z-50 bg-card shadow-xl transition-transform duration-300',
          'safe-area-inset',
          drawerStyles[position],
          className
        )}
      >
        {/* Handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
        )}
        
        {children}
      </div>
    </>
  );
}

interface MobileBottomNavigationProps {
  items: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    badge?: string | number;
  }>;
  className?: string;
}

export function MobileBottomNavigation({ items, className }: MobileBottomNavigationProps) {
  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-40',
      'bg-card/95 backdrop-blur-md border-t',
      'safe-area-bottom',
      className
    )}>
      <div className="flex justify-around items-center py-2">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className={cn(
              'flex flex-col items-center justify-center',
              'min-w-[64px] px-3 py-2 rounded-lg',
              'transition-all duration-200',
              'mobile-touch-target',
              item.isActive 
                ? 'text-primary bg-primary/10' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <div className="relative">
              {item.icon}
              {item.badge && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 
                               bg-destructive text-destructive-foreground text-[10px] 
                               font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

interface MobileFABProps {
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  mini?: boolean;
}

export function MobileFAB({ icon, onClick, className, mini = false }: MobileFABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fab',
        mini && 'w-12 h-12',
        className
      )}
    >
      {icon}
    </button>
  );
}

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated' | 'neumorphic';
  onClick?: () => void;
}

export function MobileCard({ 
  children, 
  className, 
  variant = 'default',
  onClick 
}: MobileCardProps) {
  const variantStyles = {
    default: 'bg-card border shadow-sm',
    glass: 'glass-modern',
    elevated: 'card-elevated hover-lift',
    neumorphic: 'neumorphism',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'mobile-card rounded-xl transition-all duration-200',
        variantStyles[variant],
        onClick && 'cursor-pointer active:scale-[0.98]',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileHeaderProps {
  title?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
  transparent?: boolean;
}

export function MobileHeader({ 
  title, 
  leftAction, 
  rightAction, 
  className,
  transparent = false 
}: MobileHeaderProps) {
  return (
    <header className={cn(
      'sticky top-0 z-30 transition-all duration-300',
      !transparent && 'bg-card/95 backdrop-blur-md border-b shadow-sm',
      'safe-area-inset',
      className
    )}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-shrink-0 w-12">
          {leftAction}
        </div>
        
        {title && (
          <h1 className="flex-1 text-center text-lg font-semibold truncate px-2">
            {title}
          </h1>
        )}
        
        <div className="flex-shrink-0 w-12 flex justify-end">
          {rightAction}
        </div>
      </div>
    </header>
  );
}

interface MobilePullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function MobilePullToRefresh({ 
  onRefresh, 
  children, 
  className 
}: MobilePullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    
    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance > 60) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    
    setPullDistance(0);
  };

  return (
    <div 
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={cn(
          'pull-to-refresh',
          (pullDistance > 60 || isRefreshing) && 'visible',
          isRefreshing && 'refreshing'
        )}
        style={{ 
          transform: `translateX(-50%) ${pullDistance > 0 ? `translateY(${Math.min(pullDistance / 2, 30)}px)` : ''}` 
        }}
      >
        {isRefreshing ? (
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          <ChevronDown className="w-6 h-6" />
        )}
      </div>
      
      <div 
        style={{ 
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance / 2, 75)}px)` : '',
          transition: isPulling ? 'none' : 'transform 0.3s ease'
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface MobileTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }>;
  defaultTab?: string;
  className?: string;
}

export function MobileTabs({ tabs, defaultTab, className }: MobileTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const nextIndex = Math.min(activeIndex + 1, tabs.length - 1);
      setActiveTab(tabs[nextIndex].id);
    },
    onSwipedRight: () => {
      const prevIndex = Math.max(activeIndex - 1, 0);
      setActiveTab(tabs[prevIndex].id);
    },
    trackMouse: false,
  });

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Tab Headers */}
      <div className="flex border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20 scroll-snap-x overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 whitespace-nowrap',
              'transition-all duration-200 scroll-snap-start',
              'border-b-2',
              activeTab === tab.id
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            {tab.icon}
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div {...handlers} className="flex-1 overflow-hidden">
        <div 
          className="flex h-full transition-transform duration-300"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {tabs.map((tab) => (
            <div key={tab.id} className="w-full flex-shrink-0 overflow-auto">
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
