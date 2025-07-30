const { test, expect } = require('@playwright/test');

test.describe('Boost.io Internal Links Validation', () => {
  // Use a fresh browser context for each test to avoid context closure issues
  test.use({ browserName: 'chromium', viewport: { width: 1280, height: 720 } });

  test('Validate /libs/asio page loads correctly', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto('https://www.boost.io/libs/asio', { timeout: 60000 });
      await expect(page).toHaveTitle(/Asio/, { timeout: 10000 });
      const content = await page.locator('h1:has-text("Asio")').textContent();
      expect(content).toContain('Asio');
      console.log('Successfully validated /libs/asio page');
    } catch (error) {
      console.error('Error in /libs/asio test:', error);
      await page.screenshot({ path: 'screenshots/asio-failure.png' });
      throw error;
    } finally {
      await context.close();
    }
  });

  test('Validate /doc/libs/1_86_0 page loads correctly', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto('https://www.boost.io/doc/libs/1_86_0', { timeout: 60000 });
      await expect(page).toHaveTitle(/Boost 1.86.0/, { timeout: 10000 });
      const content = await page.locator('h1:has-text("Boost 1.86.0")').textContent();
      expect(content).toContain('Boost 1.86.0');
      console.log('Successfully validated /doc/libs/1_86_0 page');
    } catch (error) {
      console.error('Error in /doc/libs/1_86_0 test:', error);
      await page.screenshot({ path: 'screenshots/doc-libs-failure.png' });
      throw error;
    } finally {
      await context.close();
    }
  });
});