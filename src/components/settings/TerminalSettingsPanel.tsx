'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Palette, 
  // Type, Volume2, Plus, Trash2 - removed as not currently used
  Keyboard,
  Eye,
  Download,
  Upload,
  RotateCcw
} from 'lucide-react';
import { TerminalSettings, TerminalTheme, KeyboardShortcut } from '@/types/terminal-settings';
import { terminalSettingsManager } from '@/lib/terminal-settings-manager';

interface TerminalSettingsPanelProps {
  className?: string;
  onClose?: () => void;
}

export function TerminalSettingsPanel({ className, onClose }: TerminalSettingsPanelProps) {
  const [settings, setSettings] = useState<TerminalSettings>(terminalSettingsManager.getSettings());
  const [themes, setThemes] = useState<TerminalTheme[]>(terminalSettingsManager.getAllThemes());
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(terminalSettingsManager.getAllShortcuts());
  const [activeTab, setActiveTab] = useState('appearance');

  useEffect(() => {
    const handleSettingsChanged = (newSettings: TerminalSettings) => {
      setSettings(newSettings);
    };

    const handleThemeCreated = () => {
      setThemes(terminalSettingsManager.getAllThemes());
    };

    const handleThemeUpdated = () => {
      setThemes(terminalSettingsManager.getAllThemes());
    };

    const handleThemeDeleted = () => {
      setThemes(terminalSettingsManager.getAllThemes());
    };

    const handleShortcutUpdated = () => {
      setShortcuts(terminalSettingsManager.getAllShortcuts());
    };

    terminalSettingsManager.on('settingsChanged', handleSettingsChanged);
    terminalSettingsManager.on('themeCreated', handleThemeCreated);
    terminalSettingsManager.on('themeUpdated', handleThemeUpdated);
    terminalSettingsManager.on('themeDeleted', handleThemeDeleted);
    terminalSettingsManager.on('shortcutUpdated', handleShortcutUpdated);

    return () => {
      terminalSettingsManager.off('settingsChanged', handleSettingsChanged);
      terminalSettingsManager.off('themeCreated', handleThemeCreated);
      terminalSettingsManager.off('themeUpdated', handleThemeUpdated);
      terminalSettingsManager.off('themeDeleted', handleThemeDeleted);
      terminalSettingsManager.off('shortcutUpdated', handleShortcutUpdated);
    };
  }, []);

  const updateSettings = (updates: Partial<TerminalSettings>) => {
    terminalSettingsManager.updateSettings(updates);
  };

  const handleThemeChange = (themeId: string) => {
    terminalSettingsManager.setActiveTheme(themeId);
  };

  const handleFontSizeChange = (size: number[]) => {
    updateSettings({
      font: { ...settings.font, size: size[0] }
    });
  };

  const handleLineHeightChange = (lineHeight: number[]) => {
    updateSettings({
      font: { ...settings.font, lineHeight: lineHeight[0] }
    });
  };

  const handleScrollbackChange = (lines: number[]) => {
    updateSettings({
      scrollback: { ...settings.scrollback, lines: lines[0] }
    });
  };

  const exportSettings = () => {
    const preferences = terminalSettingsManager.exportSettings();
    const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terminal-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const preferences = JSON.parse(e.target?.result as string);
        terminalSettingsManager.importSettings(preferences);
      } catch {
        alert('Failed to import settings: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const resetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      terminalSettingsManager.resetSettings();
    }
  };

  const currentTheme = terminalSettingsManager.getTheme(settings.theme);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Terminal Settings
        </CardTitle>
        <CardDescription>
          Customize your terminal appearance and behavior
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance" data-testid="themes-tab" className="flex items-center gap-1">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              Behavior
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-1">
              <Keyboard className="h-4 w-4" />
              Shortcuts
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-6">
            {/* Theme Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Color Theme</Label>
              <Select value={settings.theme} onValueChange={handleThemeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themes.map(theme => (
                    <SelectItem key={theme.id} value={theme.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: theme.colors.background }}
                        />
                        {theme.name}
                        {theme.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTheme && (
                <div className="p-3 border rounded-lg bg-muted/30">
                  <div className="text-sm font-medium mb-2">{currentTheme.name}</div>
                  {currentTheme.description && (
                    <div className="text-xs text-muted-foreground mb-2">{currentTheme.description}</div>
                  )}
                  <div className="flex gap-1">
                    {Object.entries(currentTheme.colors).slice(0, 8).map(([name, color]) => (
                      <div
                        key={name}
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: color }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Font Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Font</Label>
              
              <div className="space-y-2">
                <Label htmlFor="font-family">Font Family</Label>
                <Input
                  id="font-family"
                  value={settings.font.family}
                  onChange={(e) => updateSettings({
                    font: { ...settings.font, family: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Font Size: {settings.font.size}px</Label>
                <Slider
                  value={[settings.font.size]}
                  onValueChange={handleFontSizeChange}
                  min={8}
                  max={32}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Line Height: {settings.font.lineHeight}</Label>
                <Slider
                  value={[settings.font.lineHeight]}
                  onValueChange={handleLineHeightChange}
                  min={1.0}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Cursor Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Cursor</Label>
              
              <div className="space-y-2">
                <Label>Cursor Style</Label>
                <Select 
                  value={settings.cursor.style} 
                  onValueChange={(value: 'block' | 'underline' | 'bar') => 
                    updateSettings({
                      cursor: { ...settings.cursor, style: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="cursor-blink"
                  checked={settings.cursor.blink}
                  onCheckedChange={(checked) => updateSettings({
                    cursor: { ...settings.cursor, blink: checked }
                  })}
                />
                <Label htmlFor="cursor-blink">Cursor Blinking</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6">
            {/* Scrollback */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Scrollback</Label>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="scrollback-enabled"
                  checked={settings.scrollback.enabled}
                  onCheckedChange={(checked) => updateSettings({
                    scrollback: { ...settings.scrollback, enabled: checked }
                  })}
                />
                <Label htmlFor="scrollback-enabled">Enable Scrollback</Label>
              </div>

              <div className="space-y-2">
                <Label>Scrollback Lines: {settings.scrollback.lines}</Label>
                <Slider
                  value={[settings.scrollback.lines]}
                  onValueChange={handleScrollbackChange}
                  min={100}
                  max={10000}
                  step={100}
                  className="w-full"
                  disabled={!settings.scrollback.enabled}
                />
              </div>
            </div>

            {/* Bell Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Terminal Bell</Label>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="bell-enabled"
                  checked={settings.bell.enabled}
                  onCheckedChange={(checked) => updateSettings({
                    bell: { ...settings.bell, enabled: checked }
                  })}
                />
                <Label htmlFor="bell-enabled">Enable Bell</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="bell-sound"
                  checked={settings.bell.sound}
                  onCheckedChange={(checked) => updateSettings({
                    bell: { ...settings.bell, sound: checked }
                  })}
                  disabled={!settings.bell.enabled}
                />
                <Label htmlFor="bell-sound">Sound Bell</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="bell-visual"
                  checked={settings.bell.visual}
                  onCheckedChange={(checked) => updateSettings({
                    bell: { ...settings.bell, visual: checked }
                  })}
                  disabled={!settings.bell.enabled}
                />
                <Label htmlFor="bell-visual">Visual Bell</Label>
              </div>
            </div>

            {/* Other Behavior Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Other</Label>
              
              <div className="space-y-2">
                <Label>Tab Size</Label>
                <Input
                  type="number"
                  value={settings.tabSize}
                  onChange={(e) => updateSettings({
                    tabSize: parseInt(e.target.value) || 4
                  })}
                  min={1}
                  max={8}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="right-click-select"
                  checked={settings.rightClickSelectsWord}
                  onCheckedChange={(checked) => updateSettings({
                    rightClickSelectsWord: checked
                  })}
                />
                <Label htmlFor="right-click-select">Right Click Selects Word</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shortcuts" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Keyboard Shortcuts</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => terminalSettingsManager.resetShortcuts()}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="space-y-3">
              {['terminal', 'edit', 'view', 'session'].map(category => (
                <div key={category}>
                  <h3 className="text-sm font-medium mb-2 capitalize">{category}</h3>
                  <div className="space-y-2">
                    {shortcuts
                      .filter(s => s.category === category)
                      .map(shortcut => (
                        <div key={shortcut.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium text-sm">{shortcut.name}</div>
                            <div className="text-xs text-muted-foreground">{shortcut.description}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {shortcut.keys.map(key => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}
                                </Badge>
                              ))}
                            </div>
                            <Switch
                              checked={shortcut.enabled}
                              onCheckedChange={() => terminalSettingsManager.toggleShortcut(shortcut.id)}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">Import/Export</Label>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportSettings}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Settings
                </Button>
                
                <div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={importSettings}
                    style={{ display: 'none' }}
                    id="import-settings"
                  />
                  <Button variant="outline" onClick={() => document.getElementById('import-settings')?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Settings
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Reset</Label>
              <Button variant="destructive" onClick={resetSettings}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All Settings
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {onClose && (
          <div className="flex justify-end mt-6 pt-4 border-t">
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
