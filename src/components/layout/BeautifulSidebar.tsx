'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  Home,
  Terminal,
  FolderOpen,
  Settings,
  Bookmark,
  Activity,
  Cloud,
  Shield,
  Zap
} from 'lucide-react';

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

export function BeautifulSidebar({
  className,
  collapsed = false,
  onToggle,
  children,
}: SidebarProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64 lg:w-72 xl:w-80',
        'bg-card/50 backdrop-blur-md border-r',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between p-4 border-b bg-card/30">
        <div className={cn(
          'flex items-center gap-3 transition-opacity duration-200',
          collapsed && !isHovered ? 'opacity-0' : 'opacity-100'
        )}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Terminal className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className={cn(
            'transition-all duration-200',
            collapsed ? 'scale-0 w-0' : 'scale-100'
          )}>
            <h2 className="font-semibold text-sm">WebSSH Terminal</h2>
            <p className="text-xs text-muted-foreground">Professional Edition</p>
          </div>
        </div>
        
        {onToggle && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            className={cn(
              'transition-all duration-200',
              collapsed ? 'rotate-180' : ''
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <SidebarSection title="Main" collapsed={collapsed && !isHovered}>
          <SidebarItem
            icon={<Home className="w-4 h-4" />}
            label="Dashboard"
            collapsed={collapsed && !isHovered}
            active
          />
          <SidebarItem
            icon={<Terminal className="w-4 h-4" />}
            label="Terminal"
            badge="3"
            collapsed={collapsed && !isHovered}
          />
          <SidebarItem
            icon={<FolderOpen className="w-4 h-4" />}
            label="File Manager"
            collapsed={collapsed && !isHovered}
          />
          <SidebarItem
            icon={<Bookmark className="w-4 h-4" />}
            label="Bookmarks"
            collapsed={collapsed && !isHovered}
          />
        </SidebarSection>
        
        <SidebarSection title="Monitoring" collapsed={collapsed && !isHovered}>
          <SidebarItem
            icon={<Activity className="w-4 h-4" />}
            label="Sessions"
            badge="Live"
            badgeVariant="success"
            collapsed={collapsed && !isHovered}
          />
          <SidebarItem
            icon={<Zap className="w-4 h-4" />}
            label="Performance"
            collapsed={collapsed && !isHovered}
          />
          <SidebarItem
            icon={<Shield className="w-4 h-4" />}
            label="Security"
            collapsed={collapsed && !isHovered}
          />
        </SidebarSection>
        
        <SidebarSection title="System" collapsed={collapsed && !isHovered}>
          <SidebarItem
            icon={<Cloud className="w-4 h-4" />}
            label="Cloud Sync"
            collapsed={collapsed && !isHovered}
          />
          <SidebarItem
            icon={<Settings className="w-4 h-4" />}
            label="Settings"
            collapsed={collapsed && !isHovered}
          />
        </SidebarSection>
        
        {/* Custom content */}
        {children && (
          <div className={cn(
            'pt-4 transition-all duration-200',
            collapsed && !isHovered ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          )}>
            {children}
          </div>
        )}
      </nav>
      
      {/* Footer */}
      <div className="relative p-4 border-t bg-card/30">
        <div className={cn(
          'flex items-center gap-3',
          collapsed && !isHovered ? 'justify-center' : 'justify-between'
        )}>
          <div className={cn(
            'flex items-center gap-3',
            collapsed && !isHovered ? 'hidden' : 'flex'
          )}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-xs font-semibold">U</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium">User</span>
              <span className="text-xs text-muted-foreground">Free Plan</span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

interface SidebarSectionProps {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
}

function SidebarSection({ title, collapsed, children }: SidebarSectionProps) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  collapsed?: boolean;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({
  icon,
  label,
  badge,
  badgeVariant = 'default',
  collapsed,
  active,
  onClick,
}: SidebarItemProps) {
  const badgeStyles = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-green-500/20 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    error: 'bg-red-500/20 text-red-600 dark:text-red-400',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
        'hover:bg-accent/50 hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-accent text-accent-foreground shadow-sm',
        collapsed && 'justify-center'
      )}
    >
      <div className={cn(
        'flex items-center justify-center',
        active && 'text-primary'
      )}>
        {icon}
      </div>
      
      {!collapsed && (
        <>
          <span className="flex-1 text-left text-sm font-medium">
            {label}
          </span>
          
          {badge && (
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              badgeStyles[badgeVariant]
            )}>
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}
