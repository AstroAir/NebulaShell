import { test, expect } from '@playwright/test';

// Extended layout and a11y checks

test.describe('Layout extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button[title="Create new terminal tab"]', { timeout: 30000 });
  });

  test('a11y: no serious/critical violations in main region', async ({ page }) => {
    // Inject axe-core from CDN to avoid adding a new dependency
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js' });

    const results = await page.evaluate(async () => {
      // @ts-ignore
      const axe = (window as any).axe;
      if (!axe) return null;
      // Scan only the main region for speed/stability
      const main = document.querySelector('main[role="main"]') || document.body;
      // @ts-ignore
      return await axe.run(main, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        resultTypes: ['violations'],
        rules: {
          // Allow contrast issues for now; can be enabled later after design tuning
          'color-contrast': { enabled: false },
        },
      });
    });

    expect(results).not.toBeNull();
    if (!results) return;

    const seriousOrWorse = results.violations.filter((v: any) => v.impact === 'serious' || v.impact === 'critical');
    if (seriousOrWorse.length) {
      console.error('A11y violations:', seriousOrWorse.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
    }
    expect(seriousOrWorse.length).toBe(0);
  });

  test('desktop: sidebar has reasonable width and footer visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop-only assertion');

    // Sidebar width in expected range
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
    const sbox = await sidebar.boundingBox();
    expect(sbox).not.toBeNull();
    if (sbox) {
      expect(sbox.width).toBeGreaterThanOrEqual(180);
      expect(sbox.width).toBeLessThanOrEqual(480);
    }

    // Footer text visible and no horizontal overflow introduced by footer
    await expect(page.getByText('WebTerminal Pro - Professional SSH Terminal')).toBeVisible();
    const overflowPx = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return Math.max(0, el.scrollWidth - el.clientWidth);
    });
    expect(overflowPx).toBeLessThanOrEqual(1);
  });
});

