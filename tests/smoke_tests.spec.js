const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Boost Smoke Tests', () => {
  // TC_SMOKE_001: Homepage Accessibility
  test('Homepage loads with key elements', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
    expect(response?.status()).toBe(200);
    fs.appendFileSync('smoke-logs.txt', `Homepage loaded with status: ${response?.status()}\n`);

    // Check logo
    const logoLocator = page.getByRole('img', { name: /Boost/i });
    await expect(logoLocator).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Logo visible\n');

    // Check navigation bar
    const navLocator = page.locator('nav, [role="navigation"], div[class*="nav"]').first();
    await expect(navLocator).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Navigation bar visible\n');

    // Check main content
    const contentLocator = page.locator('h1, h2, p').first();
    await expect(contentLocator).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Main content visible\n');
  });

  // TC_SMOKE_002: Navigation Menu
  test('Navigation menu links work correctly', async ({ page, baseURL }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const navLinks = {
      'libraries': /.*libraries.*/i,
      'releases': /.*releases.*/i,
      'community': /.*community.*/i,
      'news': /.*news.*/i,
      'learn': /.*docs.*/i
    };

    // Log all nav links
    const allLinks = await page.locator('nav a, a.menu-link').all();
    fs.appendFileSync('smoke-logs.txt', `Found ${allLinks.length} nav links:\n`);
    for (let i = 0; i < allLinks.length; i++) {
      const text = await allLinks[i].textContent() || 'no text';
      const href = await allLinks[i].getAttribute('href') || 'no href';
      fs.appendFileSync('smoke-logs.txt', `Link ${i + 1}: text="${text.trim()}", href="${href}"\n`);
    }

    for (const [text, urlPattern] of Object.entries(navLinks)) {
      const linkLocator = text === 'libraries' ? page.locator('a#libraries') :
                         text === 'releases' ? page.locator('a#releases') :
                         text === 'community' ? page.locator('a#community') :
                         text === 'news' ? page.locator('a#news') :
                         page.locator('a#learn');

      await expect(linkLocator).toBeVisible({ timeout: 10000 });
      await linkLocator.click({ timeout: 15000 });
      await expect(page).toHaveURL(urlPattern, { timeout: 15000 });
      await expect(page).not.toHaveURL(/.*404.*/);
      fs.appendFileSync('smoke-logs.txt', `Navigated to ${text}: ${page.url()}\n`);
      await page.goto('/');
    }
  });

  // TC_SMOKE_003: Library Listings
  test('Libraries page displays and links to documentation', async ({ page }) => {
    await page.goto('/libraries', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Asio/, level: 3 })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Beast/, level: 3 })).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Boost.Asio and Boost.Beast visible on libraries page\n');

    const libraries = [
      { name: 'Asio', href: '/library/latest/asio/', urlPattern: /.*asio.*/i },
      { name: 'Beast', href: '/library/latest/beast/', urlPattern: /.*beast.*/i },
      { name: 'Describe', href: '/library/latest/describe/', urlPattern: /.*describe.*/i }
    ];

    for (const lib of libraries) {
      await page.locator(`a[href="${lib.href}"]`).click({ timeout: 15000 });
      await expect(page).toHaveURL(lib.urlPattern, { timeout: 15000 });
      fs.appendFileSync('smoke-logs.txt', `Navigated to Boost.${lib.name} docs: ${page.url()}\n`);
      await page.goto('/libraries', { waitUntil: 'networkidle' });
    }
  });

  // TC_SMOKE_004: Download Functionality
  test('Download section works correctly', async ({ page }) => {
    await page.goto('/releases', { waitUntil: 'networkidle' });
    const versionLink = page.getByText('boost_1_88_0.tar.gz').first();
    await expect(versionLink).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Download version link visible\n');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      versionLink.click()
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$|\.tar\.gz$/);
    fs.appendFileSync('smoke-logs.txt', `Download initiated: ${download.suggestedFilename()}\n`);
  });

  // TC_SMOKE_005: Search bar functionality
  test('Search bar works with basic query', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const searchTrigger = page.locator('[class*="search"], i[class*="fa-search"], span[class*="icon-search"]').first();
    await expect(searchTrigger).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Search bar trigger visible\n');

    await searchTrigger.click();
    const searchInput = page.getByRole('combobox', { name: 'Search' });
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Boost.Asio');
    await Promise.all([
      searchInput.press('Enter'),
      page.waitForResponse(/algolia/, { timeout: 10000 }).catch(() => {}) // Allow test to proceed if no Algolia response
    ]);

    // Verify and click the first search result
    const resultLink = page.getByRole('dialog').getByText('Boost.Asio').locator('a[href*="/libs/asio"]').first();
    await expect(resultLink).toBeVisible({ timeout: 10000 });
    await expect(resultLink).toHaveAttribute('href', /libs\/asio/, { timeout: 5000 });
    fs.appendFileSync('smoke-logs.txt', 'Search result for "Boost.Asio" visible\n');

    await resultLink.click({ timeout: 15000 });
    await expect(page).toHaveURL(/doc\/libs\/latest\/libs\/asio/, { timeout: 15000 });
    fs.appendFileSync('smoke-logs.txt', 'Navigated to Boost.Asio docs from search result\n');
  });

  // TC_SMOKE_006: Responsive Design
  test('Homepage is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const navLocator = page.locator('nav, [role="navigation"], div[class*="nav"]').first();
    await expect(navLocator).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Mobile: Navigation bar visible\n');

    const contentLocator = page.locator('h1, h2, p').first();
    await expect(contentLocator).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('smoke-logs.txt', 'Mobile: Main content visible\n');

    // Check for overlapping elements (basic check via bounding box)
    const navBox = await navLocator.boundingBox();
    const contentBox = await contentLocator.boundingBox();
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(contentBox.y);
    fs.appendFileSync('smoke-logs.txt', 'Mobile: No overlapping nav and content\n');
  });
});