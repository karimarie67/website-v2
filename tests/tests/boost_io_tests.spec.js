const { test, expect } = require('@playwright/test');

test.describe('Boost.io Functional Tests', () => {
  test.use({ browserName: 'chromium', viewport: { width: 1280, height: 720 } });

  test('Homepage loads correctly with all key elements', async ({ page }) => {
    try {
      await page.goto('https://www.boost.io', { timeout: 60000 });
      await page.locator('img[alt*="Boost C++ Libraries"]').waitFor({ state: 'visible', timeout: 10000 });
      const logoVisible = await page.locator('img[alt*="Boost C++ Libraries"]').isVisible();
      expect(logoVisible).toBe(true);
      const navBar = await page.locator('nav:has(a[href="/libs"])').isVisible();
      expect(navBar).toBe(true);
      await expect(page).toHaveTitle(/Boost C++ Libraries/, { timeout: 10000 });
      console.log('Homepage loaded successfully with key elements');
    } catch (error) {
      console.error('Error in homepage test:', error);
      await page.screenshot({ path: 'screenshots/homepage-failure.png' });
      throw error;
    }
  });

  test('External links open correctly', async ({ page }) => {
    try {
      await page.goto('https://www.boost.io', { timeout: 60000 });
      await page.locator('.news-section').waitFor({ state: 'visible', timeout: 60000 });
      const links = await page.locator('.news-section a[href^="http"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        console.log(`Testing external link: ${href}`);
        const response = await page.goto(href, { timeout: 60000 });
        expect(response.status()).toBeLessThan(400);
        await page.goBack();
      }
    } catch (error) {
      console.error('Error in external links test:', error);
      await page.screenshot({ path: 'screenshots/external-links-failure.png' });
      throw error;
    }
  });
});