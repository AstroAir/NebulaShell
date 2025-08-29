'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  RotateCcw, 
  Layout, 
  PanelLeft, 
  // PanelBottom - removed as not currently used
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface LayoutSettingsProps {
  onClose?: () => void;
}

interface LayoutPreferences {
  defaultSidebarSize: number;
  defaultBottomSize: number;
  enableResizable: boolean;
  persistLayout: boolean;
  autoCollapseSidebar: boolean;
  showLayoutControls: boolean;
  animateTransitions: boolean;
  compactMode: boolean;
}

const LAYOUT_PREFERENCES_KEY = 'layout-preferences';

const defaultPreferences: LayoutPreferences = {
  defaultSidebarSize: 25,
  defaultBottomSize: 30,
  enableResizable: true,
  persistLayout: true,
  autoCollapseSidebar: false,
  showLayoutControls: true,
  animateTransitions: true,
  compactMode: false,
};

export const LayoutSettings: React.FC<LayoutSettingsProps> = ({ onClose }) => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [preferences, setPreferences] = useState<LayoutPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LAYOUT_PREFERENCES_KEY);
      if (saved) {
        try {
          const parsedPreferences = JSON.parse(saved);
          setPreferences(prev => ({ ...prev, ...parsedPreferences }));
        } catch (error) {
          console.warn('Failed to parse saved layout preferences:', error);
        }
      }
    }
  }, []);

  const updatePreference = <K extends keyof LayoutPreferences>(
    key: K,
    value: LayoutPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const savePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAYOUT_PREFERENCES_KEY, JSON.stringify(preferences));
      setHasChanges(false);
      
      // Trigger a custom event to notify other components
      window.dispatchEvent(new CustomEvent('layout-preferences-changed', {
        detail: preferences
      }));
    }
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    setHasChanges(true);
  };

  const getDeviceIcon = () => {
    if (isMobile) return <Smartphone className="h-4 w-4" />;
    if (isTablet) return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceLabel = () => {
    if (isMobile) return 'Mobile';
    if (isTablet) return 'Tablet';
    return 'Desktop';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            <CardTitle>Layout Settings</CardTitle>
            <Badge variant="outline" className="flex items-center gap-1">
              {getDeviceIcon()}
              {getDeviceLabel()}
            </Badge>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
        <CardDescription>
          Customize your workspace layout and panel behavior
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Desktop-only settings */}
        {isDesktop && (
          <>
            {/* Panel Sizes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <PanelLeft className="h-4 w-4" />
                <Label className="text-sm font-medium">Panel Sizes</Label>
              </div>
              
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sidebar-size" className="text-sm">
                      Default Sidebar Width
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {preferences.defaultSidebarSize}%
                    </span>
                  </div>
                  <Slider
                    id="sidebar-size"
                    min={15}
                    max={50}
                    step={1}
                    value={[preferences.defaultSidebarSize]}
                    onValueChange={([value]) => updatePreference('defaultSidebarSize', value)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bottom-size" className="text-sm">
                      Default Bottom Panel Height
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {preferences.defaultBottomSize}%
                    </span>
                  </div>
                  <Slider
                    id="bottom-size"
                    min={20}
                    max={60}
                    step={1}
                    value={[preferences.defaultBottomSize]}
                    onValueChange={([value]) => updatePreference('defaultBottomSize', value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* Layout Behavior */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Layout Behavior</Label>
          
          <div className="space-y-3 pl-6">
            {isDesktop && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-resizable" className="text-sm">
                    Enable Resizable Panels
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow dragging panel borders to resize
                  </p>
                </div>
                <Switch
                  id="enable-resizable"
                  checked={preferences.enableResizable}
                  onCheckedChange={(checked) => updatePreference('enableResizable', checked)}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="persist-layout" className="text-sm">
                  Remember Layout
                </Label>
                <p className="text-xs text-muted-foreground">
                  Save panel sizes and positions between sessions
                </p>
              </div>
              <Switch
                id="persist-layout"
                checked={preferences.persistLayout}
                onCheckedChange={(checked) => updatePreference('persistLayout', checked)}
              />
            </div>

            {isDesktop && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-collapse" className="text-sm">
                      Auto-collapse Sidebar
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically collapse sidebar when very narrow
                    </p>
                  </div>
                  <Switch
                    id="auto-collapse"
                    checked={preferences.autoCollapseSidebar}
                    onCheckedChange={(checked) => updatePreference('autoCollapseSidebar', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-controls" className="text-sm">
                      Show Layout Controls
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display floating layout control buttons
                    </p>
                  </div>
                  <Switch
                    id="show-controls"
                    checked={preferences.showLayoutControls}
                    onCheckedChange={(checked) => updatePreference('showLayoutControls', checked)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Visual Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Visual Settings</Label>
          
          <div className="space-y-3 pl-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="animate-transitions" className="text-sm">
                  Smooth Transitions
                </Label>
                <p className="text-xs text-muted-foreground">
                  Animate panel resize and collapse transitions
                </p>
              </div>
              <Switch
                id="animate-transitions"
                checked={preferences.animateTransitions}
                onCheckedChange={(checked) => updatePreference('animateTransitions', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compact-mode" className="text-sm">
                  Compact Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Reduce padding and spacing for more content
                </p>
              </div>
              <Switch
                id="compact-mode"
                checked={preferences.compactMode}
                onCheckedChange={(checked) => updatePreference('compactMode', checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={resetPreferences}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved changes
              </Badge>
            )}
            <Button
              onClick={savePreferences}
              disabled={!hasChanges}
              className={cn(
                "transition-all duration-200",
                hasChanges && "bg-primary hover:bg-primary/90"
              )}
            >
              Save Settings
            </Button>
          </div>
        </div>

        {/* Device-specific note */}
        {!isDesktop && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Some layout features are only available on desktop devices. 
              {isMobile && " Mobile layout is optimized for touch interaction."}
              {isTablet && " Tablet layout provides a balance between mobile and desktop features."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Hook for accessing layout preferences
export const useLayoutPreferences = () => {
  const [preferences, setPreferences] = useState<LayoutPreferences>(defaultPreferences);

  useEffect(() => {
    // Load preferences on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LAYOUT_PREFERENCES_KEY);
      if (saved) {
        try {
          const parsedPreferences = JSON.parse(saved);
          setPreferences(prev => ({ ...prev, ...parsedPreferences }));
        } catch (error) {
          console.warn('Failed to parse saved layout preferences:', error);
        }
      }

      // Listen for preference changes
      const handlePreferencesChanged = (event: CustomEvent<LayoutPreferences>) => {
        setPreferences(event.detail);
      };

      window.addEventListener('layout-preferences-changed', handlePreferencesChanged as EventListener);

      return () => {
        window.removeEventListener('layout-preferences-changed', handlePreferencesChanged as EventListener);
      };
    }
  }, []);

  return preferences;
};

export default LayoutSettings;
