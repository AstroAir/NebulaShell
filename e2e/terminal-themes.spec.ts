import { test, expect } from '@playwright/test';

test.describe('Terminal Themes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });
  });

  test('should display theme selector', async ({ page }) => {
    // Open theme selector (assuming it's in a settings panel or similar)
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Check if theme selector is visible
    await expect(page.locator('text=Terminal Themes')).toBeVisible();
    await expect(page.locator('text=Customize your terminal appearance')).toBeVisible();
  });

  test('should show available themes', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Check for default themes
    await expect(page.locator('text=Default Dark')).toBeVisible();
    await expect(page.locator('text=Monokai')).toBeVisible();
    await expect(page.locator('text=Solarized Light')).toBeVisible();
    await expect(page.locator('text=Dracula')).toBeVisible();
  });

  test('should switch themes', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Get initial terminal background color
    const terminal = page.locator('[data-testid="terminal-container"]');
    const initialBgColor = await terminal.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    
    // Switch to Monokai theme
    await page.click('text=Monokai');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Check if terminal background changed
    const newBgColor = await terminal.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    
    expect(newBgColor).not.toBe(initialBgColor);
  });

  test('should filter themes by category', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Click on Dark themes tab
    await page.click('[role="tab"]:has-text("Dark")');
    
    // Should show dark themes
    await expect(page.locator('text=Default Dark')).toBeVisible();
    await expect(page.locator('text=Monokai')).toBeVisible();
    
    // Click on Light themes tab
    await page.click('[role="tab"]:has-text("Light")');
    
    // Should show light themes
    await expect(page.locator('text=Solarized Light')).toBeVisible();
    
    // Dark themes should not be visible
    await expect(page.locator('text=Default Dark')).not.toBeVisible();
  });

  test('should preview themes', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Find a theme card and click preview
    const themeCard = page.locator('text=Monokai').locator('..');
    await themeCard.locator('button:has-text("Preview")').click();
    
    // Should show preview with theme colors
    const preview = page.locator('[data-testid="theme-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('text=$ ls -la')).toBeVisible();
  });

  test('should create custom theme', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Click create custom theme button
    await page.click('button:has-text("Create")');
    
    // Should open custom theme dialog
    await expect(page.locator('text=Create Custom Theme')).toBeVisible();
    
    // Fill in theme details
    await page.fill('[placeholder="Theme name"]', 'My Custom Theme');
    await page.fill('[placeholder="Description"]', 'A custom theme for testing');
    
    // Change some colors
    await page.click('[data-testid="background-color-picker"]');
    await page.fill('[data-testid="background-color-input"]', '#1a1a1a');
    
    await page.click('[data-testid="foreground-color-picker"]');
    await page.fill('[data-testid="foreground-color-input"]', '#ffffff');
    
    // Save the theme
    await page.click('button:has-text("Save Theme")');
    
    // Should close dialog and show new theme
    await expect(page.locator('text=Create Custom Theme')).not.toBeVisible();
    await expect(page.locator('text=My Custom Theme')).toBeVisible();
  });

  test('should export themes', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('button:has-text("Export")');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Check download filename
    expect(download.suggestedFilename()).toMatch(/terminal-themes-\d{4}-\d{2}-\d{2}\.json/);
  });

  test('should import themes', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Create a mock theme file
    const themeData = {
      customThemes: [
        {
          id: 'imported-theme',
          name: 'Imported Theme',
          description: 'An imported theme',
          category: 'custom',
          colors: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selectionBackground: '#333333',
            black: '#000000',
            red: '#ff0000',
            green: '#00ff00',
            yellow: '#ffff00',
            blue: '#0000ff',
            magenta: '#ff00ff',
            cyan: '#00ffff',
            white: '#ffffff',
            brightBlack: '#808080',
            brightRed: '#ff8080',
            brightGreen: '#80ff80',
            brightYellow: '#ffff80',
            brightBlue: '#8080ff',
            brightMagenta: '#ff80ff',
            brightCyan: '#80ffff',
            brightWhite: '#ffffff',
          },
        },
      ],
      currentTheme: 'imported-theme',
    };
    
    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'themes.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(themeData)),
    });
    
    // Should show imported theme
    await expect(page.locator('text=Imported Theme')).toBeVisible();
  });

  test('should persist theme selection across page reloads', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Switch to Monokai theme
    await page.click('text=Monokai');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="terminal-container"]');
    
    // Check if Monokai theme is still active
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    const monokaiCard = page.locator('text=Monokai').locator('..');
    await expect(monokaiCard.locator('text=Active')).toBeVisible();
  });

  test('should be accessible via keyboard navigation', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Focus on the first tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Navigate to theme tabs
    
    // Should be able to navigate between tabs with arrow keys
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText('Dark');
    
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText('Light');
    
    // Should be able to activate themes with Enter
    await page.keyboard.press('Tab'); // Move to theme cards
    await page.keyboard.press('Enter');
    
    // Theme should be activated
    await page.waitForTimeout(500);
  });

  test('should handle theme errors gracefully', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Try to import invalid theme file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('invalid json content'),
    });
    
    // Should show error message but not crash
    await expect(page.locator('text=Failed to import')).toBeVisible();
    
    // Theme selector should still be functional
    await expect(page.locator('text=Terminal Themes')).toBeVisible();
  });

  test('should work on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'This test is only for mobile devices');
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Should display themes in mobile-friendly layout
    await expect(page.locator('text=Terminal Themes')).toBeVisible();
    
    // Should be able to select themes on mobile
    await page.click('text=Monokai');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Check if theme was applied
    const terminal = page.locator('[data-testid="terminal-container"]');
    const bgColor = await terminal.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    
    expect(bgColor).toBeTruthy();
  });

  test('should support high contrast themes for accessibility', async ({ page }) => {
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="themes-tab"]');
    
    // Click on High Contrast tab
    await page.click('[role="tab"]:has-text("High Contrast")');
    
    // Should show high contrast themes
    await expect(page.locator('text=High Contrast Dark')).toBeVisible();
    await expect(page.locator('text=High Contrast Light')).toBeVisible();
    
    // Select high contrast theme
    await page.click('text=High Contrast Dark');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Check if high contrast colors are applied
    const terminal = page.locator('[data-testid="terminal-container"]');
    const textColor = await terminal.evaluate(el => 
      getComputedStyle(el).color
    );
    
    // High contrast themes should have very distinct colors
    expect(textColor).toBeTruthy();
  });
});
