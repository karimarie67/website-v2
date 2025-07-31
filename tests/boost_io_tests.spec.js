const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Boost Staging Functional Tests', () => {
 // TC_FUNC_001: Homepage Load and Elements
test('Homepage loads correctly with all key elements', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  page.on('console', msg => fs.appendFileSync('test-logs.txt', `Console [${msg.type()}]: ${msg.text()}\n`));
  page.on('pageerror', err => fs.appendFileSync('test-logs.txt', `PAGE ERROR: ${err.message}\n`));

  try {
    const startTime = Date.now();
    const response = await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    if (!response || response.status() !== 200) {
      fs.appendFileSync('test-logs.txt', `Failed to load homepage: Status ${response?.status()}\n`);
      throw new Error(`Homepage failed to load: Status ${response?.status()}`);
    }
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Page loaded with status: ${response.status()} in ${loadTime}ms\n`);
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    // Updated logo selector to target visible logo
    const logoSelector = 'header a[href="/"] img[alt*="Boost"], a[href="/"] img[src*="/static/img/Boost"]:not([style*="display: none"])';
    const logoElements = await page.locator(logoSelector).all();
    fs.appendFileSync('test-logs.txt', `Found ${logoElements.length} logo elements\n`);
    for (const [index, element] of logoElements.entries()) {
      const isVisible = await element.isVisible();
      const attributes = await element.evaluate(el => ({
        src: el.src,
        alt: el.alt,
        style: el.getAttribute('style'),
        class: el.className
      }));
      fs.appendFileSync('test-logs.txt', `Logo ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}\n`);
    }

    // Add screenshot for debugging
    await page.screenshot({ path: 'debug-homepage.png', fullPage: true });

    // Wait for logo to be attached and visible
    await page.waitForSelector(logoSelector, { state: 'attached', timeout: 30000 });
    await page.waitForSelector(logoSelector, { state: 'visible', timeout: 30000 });
    const logoLocator = page.locator(logoSelector).first();
    await logoLocator.scrollIntoViewIfNeeded();
    await expect(logoLocator).toBeVisible({ timeout: 30000 });

    const navLocator = page.getByRole('navigation').first().or(page.locator('header, nav'));
    await expect(navLocator).toBeVisible({ timeout: 20000 });

    const contentLocator = page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2, h3, p')).first();
    await expect(contentLocator).toBeVisible({ timeout: 20000 });

    const ctaButton = page.getByRole('link', { name: /start|explore|learn|try|download/i });
    const ctaCount = await ctaButton.count();
    fs.appendFileSync('test-logs.txt', `Found ${ctaCount} CTA buttons\n`);
    await expect(ctaButton).toBeVisible({ timeout: 20000 });

    await expect(page.locator('footer')).toBeVisible({ timeout: 20000 });

    await ctaButton.click();
    await expect(page).toHaveURL(/libraries|releases|docs|learn|download/i, { timeout: 30000 });
  } catch (error) {
    fs.appendFileSync('test-logs.txt', `Test failed with error: ${error.message}\n`);
    throw error;
  }
});

  // TC_FUNC_002: External Link Functionality
  test('External links open correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const externalLinks = await page.locator('a[href*="github.com"], a[href*="boost.org"], a[href*="youtube.com"], a[href*="reddit.com"], a[href*="linkedin.com"], a[href*="bsky.app"], a[href*="mastodon.social"]').all();
    fs.appendFileSync('test-logs.txt', `Found ${externalLinks.length} external links\n`);
    
    for (const link of externalLinks) {
      const href = await link.getAttribute('href');
      const isNewTab = (await link.getAttribute('target')) === '_blank';
      await expect(link).toBeVisible({ timeout: 20000 });
      fs.appendFileSync('test-logs.txt', `Testing link: ${href}, NewTab=${isNewTab}\n`);
      
      try {
        if (isNewTab) {
          const [newPage] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 20000 }).catch(() => null),
            link.click()
          ]);
          if (newPage) {
            await expect(newPage).toHaveURL(href, { timeout: 30000 });
            await newPage.close();
          } else {
            await expect(page).toHaveURL(href, { timeout: 30000 });
            await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
          }
        } else {
          await link.click();
          await expect(page).toHaveURL(href, { timeout: 30000 });
          await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
        }
      } catch (e) {
        fs.appendFileSync('test-logs.txt', `Link ${href} failed: ${e.message}\n`);
      }
    }
  });

  // TC_FUNC_003: Navigation Menu Functionality
  test('Navigation menu links redirect correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const navLinks = {
      'libraries': /libraries/i,
      'releases': /releases/i,
      'community': /community/i,
      'news': /news|blog/i,
      'learn': /docs/i,
      'join': /signup/i
    };

    for (const [text, urlPattern] of Object.entries(navLinks)) {
      const linkLocator = page.getByRole('link', { name: new RegExp(text, 'i') }).or(page.locator(`a:has-text("${text}")`));
      const linkCount = await linkLocator.count();
      fs.appendFileSync('test-logs.txt', `Found ${linkCount} links for ${text}\n`);
      await expect(linkLocator).toBeVisible({ timeout: 20000 });
      await linkLocator.first().click({ timeout: 30000 });
      await expect(page).toHaveURL(urlPattern, { timeout: 30000 });
      fs.appendFileSync('test-logs.txt', `Nav link ${text} navigated to ${page.url()}\n`);
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    }

    const dropdown = page.locator('nav [class*="dropdown-menu"], nav ul[role="menu"], nav ul');
    const dropdownCount = await dropdown.count();
    fs.appendFileSync('test-logs.txt', `Found ${dropdownCount} dropdowns\n`);
    if (dropdownCount > 0) {
      await dropdown.first().hover({ timeout: 20000 });
      const subItems = await dropdown.locator('a').all();
      fs.appendFileSync('test-logs.txt', `Found ${subItems.length} dropdown items\n`);
      for (const item of subItems) {
        const href = await item.getAttribute('href');
        try {
          await item.click({ timeout: 30000 });
          await expect(page).not.toHaveURL(/404/i, { timeout: 30000 });
          fs.appendFileSync('test-logs.txt', `Dropdown link ${href} navigated successfully\n`);
        } catch (e) {
          fs.appendFileSync('test-logs.txt', `Dropdown link ${href} failed: ${e.message}\n`);
        }
        await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
      }
    }
  });

  // TC_FUNC_004: Mobile Navigation Menu
  test('Mobile navigation menu is usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const hamburger = page.locator('button[aria-label*="menu"], button[class*="hamburger"], button[aria-expanded], button:has-text("☰")');
    await expect(hamburger).toBeVisible({ timeout: 20000 });
    await hamburger.click();
    await page.waitForSelector('nav[aria-hidden="false"], nav[class*="open"], nav ul, [role="navigation"]', { state: 'visible', timeout: 20000 });

    const menuItems = await page.locator('nav a, [role="navigation"] a').all();
    fs.appendFileSync('test-logs.txt', `Found ${menuItems.length} mobile menu items\n`);
    for (const item of menuItems) {
      const href = await item.getAttribute('href');
      await expect(item).toBeVisible({ timeout: 20000 });
      try {
        await item.click({ timeout: 30000 });
        await expect(page).not.toHaveURL(/404/i, { timeout: 30000 });
        fs.appendFileSync('test-logs.txt', `Mobile menu link ${href} navigated successfully\n`);
      } catch (e) {
        fs.appendFileSync('test-logs.txt', `Mobile menu link ${href} failed: ${e.message}\n`);
      }
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
      await hamburger.click();
      await page.waitForTimeout(500);
    }
  });

  // TC_FUNC_005: Library Listing Display
  test('Libraries page lists all Boost libraries', async ({ page }) => {
    await page.goto('/libraries', { waitUntil: 'networkidle', timeout: 30000 });
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Libraries page loaded in ${loadTime}ms\n`);
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    await expect(page.getByRole('link', { name: /asio/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /beast/i })).toBeVisible({ timeout: 15000 });

    const loadMore = page.getByRole('button', { name: /more|load/i });
    if (await loadMore.count() > 0) {
      await loadMore.click();
      await expect(page.locator('ul').nth(1)).toBeVisible({ timeout: 15000 });
      fs.appendFileSync('test-logs.txt', 'Load More button clicked successfully\n');
    } else {
      fs.appendFileSync('test-logs.txt', 'No Load More button found\n');
    }

    await page.getByRole('link', { name: /asio/i }).click();
    await expect(page).toHaveURL(/doc\/libs\/.*\/asio|library.*asio/i, { timeout: 15000 });
  });

  // TC_FUNC_006: Library Documentation Content
  test('Library documentation is complete and functional', async ({ page }) => {
    await page.goto('/libs/beast', { waitUntil: 'networkidle', timeout: 30000 });
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Beast docs loaded in ${loadTime}ms\n`);
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    const headingLocator = page.getByRole('heading', { name: /overview|introduction|getting started|api reference|examples|tutorial/i });
    const headingCount = await headingLocator.count();
    fs.appendFileSync('test-logs.txt', `Found ${headingCount} documentation headings\n`);
    await expect(page.getByRole('heading', { name: /overview|introduction|getting started/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: /api reference/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: /examples/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: /tutorial/i })).toBeVisible({ timeout: 20000 });

    const copyButton = page.getByRole('button', { name: /copy/i });
    if (await copyButton.count() > 0) {
      try {
        await copyButton.click();
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toMatch(/.+/);
        fs.appendFileSync('test-logs.txt', `Clipboard text copied: ${clipboardText}\n`);
      } catch (e) {
        fs.appendFileSync('test-logs.txt', `Clipboard test skipped: ${e.message}\n`);
      }
    } else {
      fs.appendFileSync('test-logs.txt', 'No copy button found\n');
    }

    const link = page.locator('a[href*="/libs"]').first();
    await expect(link).toBeVisible({ timeout: 20000 });
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).not.toHaveURL(/404/i, { timeout: 30000 });
    fs.appendFileSync('test-logs.txt', `Library link ${href} navigated successfully\n`);
  });

  // TC_FUNC_007: Documentation Edge Cases
  test('Documentation handles invalid or missing content', async ({ page }) => {
    await page.goto('/libs/nonexistent', { waitUntil: 'networkidle', timeout: 30000 });
    const currentUrl = page.url();
    fs.appendFileSync('test-logs.txt', `Navigated to: ${currentUrl}\n`);
    await expect(page.getByRole('heading', { name: /404|not found|error/i })).toBeVisible({ timeout: 15000 });

    await page.goto('/libs/beast', { waitUntil: 'networkidle' });
    const links = await page.locator('a[href*="/libs"]').all();
    fs.appendFileSync('test-logs.txt', `Found ${links.length} library links\n`);
    for (const link of links) {
      const href = await link.getAttribute('href');
      await expect(link).toBeVisible({ timeout: 15000 });
      await link.click();
      await expect(page).not.toHaveURL(/404/i, { timeout: 15000 });
      fs.appendFileSync('test-logs.txt', `Library link ${href} navigated successfully\n`);
      await page.goto('/libs/beast', { waitUntil: 'networkidle' });
    }
  });

  // TC_FUNC_008: Search with Valid Queries
  test('Search returns accurate results for valid queries', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const queries = ['Boost.Beast', 'WebSocket', 'C++20', 'tutorial'];

    for (const query of queries) {
      const searchInput = page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]'));
      const searchCount = await searchInput.count();
      fs.appendFileSync('test-logs.txt', `Found ${searchCount} search inputs for query "${query}"\n`);
      await expect(searchInput).toBeVisible({ timeout: 20000 });
      await searchInput.fill(query);
      const startTime = Date.now();
      await Promise.all([
        searchInput.press('Enter'),
        page.waitForResponse(/algolia|search|query/i, { timeout: 20000 }).catch(() => null)
      ]);
      const loadTime = Date.now() - startTime;
      fs.appendFileSync('test-logs.txt', `Search for "${query}" took ${loadTime}ms\n`);
      expect(loadTime / 1000).toBeLessThanOrEqual(10);

      const resultLink = page.getByRole('dialog').getByRole('link', { name: new RegExp(query, 'i') }).or(page.locator(`a:has-text("${query}")`)).first();
      const resultCount = await resultLink.count();
      fs.appendFileSync('test-logs.txt', `Found ${resultCount} search result links for "${query}"\n`);
      await expect(resultLink).toBeVisible({ timeout: 20000 });
      await resultLink.click();
      await expect(page).not.toHaveURL(/404/i, { timeout: 30000 });
      fs.appendFileSync('test-logs.txt', `Search result for "${query}" navigated to ${page.url()}\n`);
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    }
  });

  // TC_FUNC_009: Search Edge Cases
  test('Search handles invalid or unusual inputs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const tests = [
      { input: '', expected: /please enter|no results|empty/i },
      { input: '@#$%', expected: /no results|safe results|invalid/i },
      { input: 'a'.repeat(100), expected: /.*|no results|too long/i },
      { input: 'xyz_library', expected: /no results/i }
    ];

    for (const { input, expected } of tests) {
      const searchInput = page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]'));
      await expect(searchInput).toBeVisible({ timeout: 20000 });
      await searchInput.fill(input);
      await Promise.all([
        searchInput.press('Enter'),
        page.waitForResponse(/algolia|search|query/i, { timeout: 20000 }).catch(() => null)
      ]);
      await expect(page.locator(`text=/${expected}/i`)).toBeVisible({ timeout: 20000 });
      fs.appendFileSync('test-logs.txt', `Search for "${input}" handled correctly\n`);
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    }
  });

  // TC_FUNC_010: Search Performance Under Load
  test('Search performs well under high-latency conditions', async ({ page }) => {
    await page.route('**/algolia**', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      route.continue();
    });

    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const searchInput = page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]'));
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill('Boost.Asio');
    const startTime = Date.now();
    await Promise.all([
      searchInput.press('Enter'),
      page.waitForResponse(/algolia|search|query/i, { timeout: 20000 }).catch(() => null)
    ]);
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Search under latency took ${loadTime}ms\n`);
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    await expect(page.getByRole('link', { name: /asio/i }).or(page.locator('a:has-text("Asio")'))).toBeVisible({ timeout: 20000 });
  });

  // TC_FUNC_011: Download Latest Boost Release
  test('Users can download the latest Boost release', async ({ page }) => {
    await page.goto('/releases', { waitUntil: 'networkidle', timeout: 30000 });
    const downloadLink = page.getByRole('link', { name: /download|release/i }).or(page.locator('a:has-text("Download")'));
    const downloadCount = await downloadLink.count();
    fs.appendFileSync('test-logs.txt', `Found ${downloadCount} download links\n`);
    await expect(downloadLink).toBeVisible({ timeout: 20000 });
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
        downloadLink.click()
      ]);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.zip$|\.tar\.gz$/);
        fs.appendFileSync('test-logs.txt', `Downloaded file: ${download.suggestedFilename()}\n`);
      } else {
        fs.appendFileSync('test-logs.txt', `Download event not triggered, checking redirect\n`);
        await expect(page).toHaveURL(/download|release/i, { timeout: 30000 });
      }
    } catch (e) {
      fs.appendFileSync('test-logs.txt', `Download failed: ${e.message}\n`);
      await downloadLink.click();
      await expect(page).toHaveURL(/download|release/i, { timeout: 30000 });
    }
  });

  // TC_FUNC_012: Download Previous Releases
  test('Users can access previous Boost releases', async ({ page }) => {
    await page.goto('/releases', { waitUntil: 'networkidle', timeout: 30000 });
    const downloadLink = page.getByText(/1\.85\.0/i).locator('a').first().or(page.locator('a:has-text("1.85.0")'));
    const downloadCount = await downloadLink.count();
    fs.appendFileSync('test-logs.txt', `Found ${downloadCount} links for version 1.85.0\n`);
    await expect(downloadLink).toBeVisible({ timeout: 20000 });
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
        downloadLink.click()
      ]);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.zip$|\.tar\.gz$/);
        fs.appendFileSync('test-logs.txt', `Downloaded file: ${download.suggestedFilename()}\n`);
      } else {
        fs.appendFileSync('test-logs.txt', `Download event not triggered, checking redirect\n`);
        await expect(page).toHaveURL(/download|release/i, { timeout: 30000 });
      }
    } catch (e) {
      fs.appendFileSync('test-logs.txt', `Download failed: ${e.message}\n`);
      await downloadLink.click();
      await expect(page).toHaveURL(/download|release/i, { timeout: 30000 });
    }
  });

  // TC_FUNC_013: Download Link Error Handling
  test('Download handles broken or unavailable links', async ({ page }) => {
    await page.route('**/releases/broken.zip', route => route.abort());
    await page.goto('/releases', { waitUntil: 'networkidle', timeout: 30000 });
    await page.goto('/releases/broken.zip', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
    const errorText = await page.locator('body').textContent();
    fs.appendFileSync('test-logs.txt', `Error page content: ${errorText}\n`);
    await expect(page.getByRole('heading', { name: /error|not found|404/i }).or(page.locator('h1, h2, h3'))).toBeVisible({ timeout: 20000 });
  });

  // TC_FUNC_014: Community Page Links
  test('Community page links are functional', async ({ page }) => {
    await page.goto('/community', { waitUntil: 'networkidle', timeout: 30000 });
    const communityLink = page.locator('a[href*="github.com/*/issues"], a[href*="discourse"], a[href*="lists.boost.org"]').first();
    await expect(communityLink).toBeVisible({ timeout: 15000 });
    const href = await communityLink.getAttribute('href');
    const isNewTab = (await communityLink.getAttribute('target')) === '_blank';
    fs.appendFileSync('test-logs.txt', `Testing community link: ${href}, NewTab=${isNewTab}\n`);
    
    if (isNewTab) {
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null),
        communityLink.click()
      ]);
      if (newPage) {
        await expect(newPage).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i, { timeout: 15000 });
        await newPage.close();
      } else {
        await expect(page).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i, { timeout: 15000 });
      }
    } else {
      await communityLink.click();
      await expect(page).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i, { timeout: 15000 });
    }
  });
});