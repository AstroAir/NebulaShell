import { test, expect } from '@playwright/test';

// Basic layout smoke checks across projects (desktop/mobile via playwright.config projects)

test.describe('Layout smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the UI shell to be ready (tab bar with New Tab button)
    await page.waitForSelector('button[title="Create new terminal tab"]', { timeout: 30000 });
  });

  test('terminal renders, occupies space, and no horizontal overflow', async ({ page, isMobile }) => {
    const region = isMobile ? page.locator('main[role="main"]') : page.locator('#terminal');
    await expect(region).toBeVisible();

    const box = await region.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(200);
      expect(box.height).toBeGreaterThan(200);
    }

    // Ensure page has no horizontal scrollbars in normal view
    // Measure horizontal overflow in pixels and assert reasonable bounds per form factor
    const overflowPx = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return Math.max(0, el.scrollWidth - el.clientWidth);
    });
    if (isMobile) {
      expect(overflowPx).toBeLessThanOrEqual(24);
    } else {
      expect(overflowPx).toBeLessThanOrEqual(1);
    }
  });

  test('new tab control is present', async ({ page }) => {
    // The button has a title in TabbedTerminal
    const newTabButton = page.locator('button[title="Create new terminal tab"]');
    await expect(newTabButton).toBeVisible();
  });

  test('desktop: bottom panel can be shown and hidden without breaking terminal', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Bottom panel controls are desktop-only');

    // Initially, bottom panel may be hidden; click the show control (bottom-right)
    const showBottom = page.locator('button[title="Show bottom panel"]');
    await showBottom.first().click({ trial: true }).catch(() => {});
    if (await showBottom.first().isVisible()) {
      await showBottom.first().click();
    }

    // Expect Console Output area when bottom panel is visible (from page layout copy)
    await expect(page.locator('text=Console Output')).toBeVisible({ timeout: 10000 });

    // Hide/collapse bottom panel
    const hideBottom = page.locator('button[title="Hide bottom panel"]');
    const closeBottom = page.locator('button[title="Close bottom panel"]');

    if (await hideBottom.first().isVisible()) {
      await hideBottom.first().click();
    } else if (await closeBottom.first().isVisible()) {
      await closeBottom.first().click();
    }

    // Terminal still visible and sized
    const terminal = page.locator('#terminal');
    await expect(terminal).toBeVisible();
    const box = await terminal.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThan(200);
    }
  });
});

