import React, { useState, useRef } from 'react';
import { terminalThemeManager, TerminalTheme } from '@/lib/terminal-themes';

interface TerminalThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
}

type ThemeCategory = 'all' | 'dark' | 'light' | 'high-contrast' | 'custom';
export const TerminalThemeSelector: React.FC<TerminalThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ThemeCategory>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allThemes = terminalThemeManager.getAllThemes();
  const currentThemeObj = terminalThemeManager.getCurrentTheme();

  const getFilteredThemes = (): TerminalTheme[] => {
    if (selectedCategory === 'all') return allThemes;
    return allThemes.filter(theme => theme.category === selectedCategory);
  };

  const filteredThemes = getFilteredThemes();

  const handleThemeSelect = (themeId: string) => {
    terminalThemeManager.setCurrentTheme(themeId);
    onThemeChange(themeId);
  };

  const handleExport = () => {
    const exportData = terminalThemeManager.exportThemes();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terminal-themes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = terminalThemeManager.importThemes(content);
        if (!success) {
          alert('Failed to import themes. Please check the file format.');
        }
      } catch (error) {
        alert('Error reading file. Please try again.');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteTheme = (themeId: string) => {
    if (confirm('Are you sure you want to delete this custom theme?')) {
      terminalThemeManager.removeCustomTheme(themeId);
    }
  };

  const renderThemeCard = (theme: TerminalTheme) => {
    const isActive = theme.id === currentTheme;
    const isCustom = theme.category === 'custom';
    const isPreview = previewTheme === theme.id;

    return (
      <div
        key={theme.id}
        className={`
          relative p-4 border rounded-lg cursor-pointer transition-all
          ${isActive ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 hover:border-gray-400'}
          ${isPreview ? 'ring-2 ring-purple-500' : ''}
        `}
        onClick={() => handleThemeSelect(theme.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium text-sm">{theme.name}</h3>
            <p className="text-xs text-gray-500">{theme.description}</p>
          </div>
          {isActive && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              Active
            </span>
          )}
        </div>

        {/* Theme Preview */}
        <div
          className="w-full h-16 rounded text-xs p-2 font-mono"
          style={{
            backgroundColor: theme.colors.background,
            color: theme.colors.foreground,
          }}
        >
          <div>$ ls -la</div>
          <div style={{ color: theme.colors.blue }}>drwxr-xr-x</div>
          <div style={{ color: theme.colors.green }}>-rw-r--r--</div>
        </div>

        <div className="flex justify-between items-center mt-2">
          <button
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewTheme(previewTheme === theme.id ? null : theme.id);
            }}
          >
            Preview
          </button>

          {isCustom && (
            <button
              data-testid="delete-theme"
              className="text-xs text-red-600 hover:text-red-800"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTheme(theme.id);
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Terminal Themes</h2>
        <p className="text-gray-600">
          Customize your terminal appearance with beautiful themes
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setShowCreateDialog(true)}
        >
          Create Custom Theme
        </button>
        <button
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          onClick={handleExport}
        >
          Export Themes
        </button>
        <button
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          onClick={() => fileInputRef.current?.click()}
        >
          Import Themes
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200 mb-6" role="tablist">
        {[
          { id: 'all', label: 'All Themes' },
          { id: 'dark', label: 'Dark' },
          { id: 'light', label: 'Light' },
          { id: 'high-contrast', label: 'High Contrast' },
          { id: 'custom', label: 'Custom' },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selectedCategory === tab.id}
            className={`
              px-4 py-2 font-medium text-sm border-b-2 transition-colors
              ${selectedCategory === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
            onClick={() => setSelectedCategory(tab.id as ThemeCategory)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredThemes.length > 0 ? (
          filteredThemes.map(renderThemeCard)
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500">
            No themes available in this category
          </div>
        )}
      </div>

      {/* Create Custom Theme Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Create Custom Theme</h3>
            <p className="text-gray-600 mb-4">
              Design your own terminal theme with custom colors and settings.
            </p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setShowCreateDialog(false)}
              >
                Start Creating
              </button>
              <button
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
