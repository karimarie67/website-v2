const { test, expect } = require('@playwright/test');

test.describe('Boost.io Regression Tests', () => {
  test.use({ browserName: 'chromium', viewport: { width: 1280, height: 720 } });

  test('TC_REG_006 - Logo Display Post-Update', async ({ page }) => {
    try {
      await page.goto('https://www.boost.io', { timeout: 60000 });
      await page.locator('img[src*="logo"]').waitFor({ state: 'visible', timeout: 10000 });
      const logo = await page.locator('img[src*="logo"]');
      const boundingBox = await logo.boundingBox();
      expect(boundingBox.width).toBeGreaterThan(50); // Ensure logo has reasonable size
      expect(boundingBox.height).toBeGreaterThan(50);
      console.log('Logo displayed correctly post-update');
    } catch (error) {
      console.error('Error in TC_REG_006:', error);
      await page.screenshot({ path: 'screenshots/logo-regression-failure.png' });
      throw error;
    }
  });

  test('Navigation bar functionality post-update', async ({ page }) => {
    try {
      await page.goto('https://www.boost.io', { timeout: 60000 });
      const navLinks = await page.locator('nav a').all();
      expect(navLinks.length).toBeGreaterThan(0);
      for (const link of navLinks) {
        const href = await link.getAttribute('href');
        console.log(`Testing nav link: ${href}`);
        await link.click();
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        expect(page.url()).toContain(href);
        await page.goBack();
      }
    } catch (error) {
      console.error('Error in navigation test:', error);
      await page.screenshot({ path: 'screenshots/nav-regression-failure.png' });
      throw error;
    }
  });
});