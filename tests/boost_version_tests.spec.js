import { test, expect } from '@playwright/test';

test.describe('Boost Website Version Tests', () => {
  // Test for Libraries page
  test('Libraries page loads Latest version and switches to older version', async ({ page, baseURL }) => {
    // Navigate to Libraries page
    await page.goto(`${baseURL}/libs`, { waitUntil: 'networkidle' });
    // Verify Latest version is selected
    const versionDropdown = page.locator('select[name="version"], [data-test-id="version-dropdown"]');
    const selectedVersion = await versionDropdown.evaluate(node => node.value || node.textContent.trim());
    await expect(selectedVersion).toMatch(/latest/i, 'Latest version should be selected by default');
    // Verify key elements for Latest version
    await expect(page.locator('img[alt="Boost"]').filter({ has: { visible: true } }).first())
      .toBeVisible({ timeout: 15000 }, 'Visible Boost logo should load');
    await expect(page.locator('a[href*="/libs/asio"]')).toBeVisible('Asio library link should be visible');
    // Select older version (e.g., 1.84)
    await versionDropdown.selectOption({ label: '1.84.0' });
    await page.waitForURL(new RegExp(`${baseURL}/doc/libs/1_84_0`), { timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`${baseURL}/doc/libs/1_84_0`), 'URL should match version 1.84');
    // Verify content for older version
    await expect(page.locator('h1, h2').filter({ hasText: /Boost 1\.84\.0/i }))
      .toBeVisible('Version 1.84 header should be visible');
    await expect(page.locator('a[href*="/libs/asio"]')).toBeVisible('Asio library link should still exist');
    // Debugging: Save screenshot if test fails
    await page.screenshot({ path: 'libraries_1_84_0.png' });
  });

  // Test for Releases page
  test('Releases page loads Latest version and switches to older release', async ({ page, baseURL }) => {
    // Navigate to Test page
    await page.goto(`${baseURL}/users/history`, { waitUntil: 'networkidle' });
    // Verify Latest version is selected
    const versionDropdown = page.locator('select[name="release"], [data-test-id="release-dropdown"]');
    const selectedVersion = await versionDropdown.evaluate(node => node.value || node.textContent.trim());
    await expect(selectedVersion).toMatch(/latest/i, 'Latest version should be selected by default');
    // Verify key elements for Latest version
    await expect(page.locator('img[alt="Boost"]').filter({ has: { visible: true } }).first())
      .toBeVisible({ timeout: 15000 }, 'Visible Boost logo should load');
    await expect(page.locator('a[href*="/users/history/version"]')).toBeVisible('Release notes link should be visible');
    // Select older version (e.g., 1.84)
    await versionDropdown.selectOption({ label: '1.84.0' });
    await page.waitForURL(`${baseURL}/users/history/version_1_84_0.html`, { timeout: 15000 });
    await expect(page).toHaveURL(`${baseURL}/users/history/version_1_84_0.html`, 'URL should match version 1.84');
    // Verify content for older version
    await expect(page.locator('h1, h2').filter({ hasText: /Version 1\.84\.0/i }))
      .toBeVisible('Version 1.84 release header should be visible');
    await expect(page.locator('text=Release Notes')).toBeVisible('Release notes should be visible');
    // Debugging: Save screenshot if test fails
    await page.screenshot({ path: 'releases_1_84_0.png' });
  });
});