const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Centralized locators for reusability
const selectors = {
  logo: page => page.getByRole('img', { name: /Boost/i }).first().or(page.locator('img[src*="/static/img/Boost_Logo"]')),
  nav: page => page.getByRole('navigation').first().or(page.locator('header, nav, div[class*="nav"], section[class*="nav"]')).first(),
  content: page => page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2, h3, p')).first(),
  cta: page => page.getByRole('link', { name: /Download the Latest Release|download.*release/i }).first(),
  searchInput: page => page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]')),
  mobileToggle: page => page.locator('button[aria-label*="menu"], button[class*="hamburger"], button[aria-controls*="nav"], button[aria-expanded], button:has(svg), div[class*="menu"] button, [data-toggle*="nav"], [data-nav], [id*="toggle"], [id*="menu"], [role="button"], [data-menu], button[class*="mobile-nav"], [data-mobile-nav], button[id*="nav"]').first(),
  mobileMenu: page => page.locator('nav, div[id*="nav"], div[class*="nav"], ul[class*="menu"], div[class*="mobile-nav"], [role="navigation"]').first(),
};

// Utility functions for logging and screenshots
async function logAndScreenshot(page, testInfo, message, path, logFile = 'test-logs.txt') {
  fs.appendFileSync(logFile, `${message}\n`);
  try {
    await page.screenshot({ path, fullPage: true, timeout: 10000 });
    fs.appendFileSync(logFile, `Screenshot saved: ${path}\n`);
  } catch (err) {
    fs.appendFileSync(logFile, `Screenshot failed: ${err.message}\n`);
  }
}

async function setupPage(page, testInfo, viewport = { width: 1280, height: 720 }) {
  await page.setViewportSize(viewport);
  page.on('console', msg => fs.appendFileSync('test-logs.txt', `Console [${msg.type()}]: ${msg.text()}\n`));
  page.on('pageerror', err => fs.appendFileSync('test-logs.txt', `PAGE ERROR: ${err.message}\n`));

  // Block non-essential requests
  await page.route('**/*.{woff,woff2,ttf,otf,eot,png,jpg,jpeg,svg}', route => route.abort());
  await page.route('**/*font*', route => route.abort());
  await page.route('**/*image*', route => route.abort());

  // Log network requests
  await page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();
    const resourceType = route.request().resourceType();
    const startTime = Date.now();
    await route.continue();
    const response = await route.request().response().catch(() => null);
    const status = response ? response.status() : 'pending';
    const duration = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Network request: ${method} ${url}, Type: ${resourceType}, Status: ${status}, Duration: ${duration}ms\n`);
  });
}

test.describe('Boost Staging Functional Tests', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(90000); // Consistent timeout across tests
    await setupPage(page, testInfo);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      await logAndScreenshot(page, testInfo, `Test failed: ${testInfo.error?.message || 'Unknown error'}, URL: ${page.url()}, Page state: ${page.isClosed() ? 'closed' : 'open'}`, `screenshots/${testInfo.title.replace(/\s+/g, '_')}_error.png`);
    }
  });

  test('Homepage loads correctly with all key elements', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_001' });

    const startTime = Date.now();
    let response;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await page.goto('https://www.stage.boost.org/', { waitUntil: 'domcontentloaded' });
        break;
      } catch (err) {
        await logAndScreenshot(page, testInfo, `Page.goto attempt ${attempt} failed: ${err.message}`, `screenshots/tc_func_001_attempt_${attempt}.png`);
        if (attempt === 3) throw new Error(`Homepage failed to load after ${attempt} attempts: ${err.message}`);
        await page.waitForTimeout(2000);
      }
    }

    if (!response || response.status() !== 200) {
      throw new Error(`Homepage failed to load: Status ${response?.status() || 'no response'}`);
    }
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Page loaded with status: ${response.status()} in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_001_loaded.png');
    expect(loadTime / 1000).toBeLessThanOrEqual(15);

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Reduced for faster tests

    // Check logo
    const logoLocator = selectors.logo(page);
    await logoLocator.scrollIntoViewIfNeeded();
    await expect(logoLocator).toBeVisible();
    await logAndScreenshot(page, testInfo, 'Logo visible', 'screenshots/tc_func_001_logo.png');

    // Check navigation
    const navLocator = selectors.nav(page);
    await navLocator.scrollIntoViewIfNeeded();
    await expect(navLocator).toBeVisible();
    await logAndScreenshot(page, testInfo, 'Navigation bar visible', 'screenshots/tc_func_001_nav.png');

    // Check main content
    const contentLocator = selectors.content(page);
    await expect(contentLocator).toBeVisible();
    await logAndScreenshot(page, testInfo, 'Main content visible', 'screenshots/tc_func_001_content.png');

    // Debug: Log CTA candidates
    const ctaCandidates = await page.getByRole('link', { name: /download|release/i }).all();
    for (const [index, candidate] of ctaCandidates.entries()) {
      const text = await candidate.textContent();
      const href = await candidate.getAttribute('href');
      await logAndScreenshot(page, testInfo, `CTA candidate ${index}: text="${text}", href="${href}"`, `screenshots/tc_func_001_cta_candidate_${index}.png`);
    }

    // Check CTA
    const ctaButton = selectors.cta(page);
    const ctaCount = await ctaButton.count();
    if (ctaCount > 1) {
      await logAndScreenshot(page, testInfo, `Warning: CTA locator matched ${ctaCount} elements`, 'screenshots/tc_func_001_cta_warning.png');
    }
    await ctaButton.scrollIntoViewIfNeeded();
    await expect(ctaButton).toBeVisible();
    await logAndScreenshot(page, testInfo, 'CTA button visible', 'screenshots/tc_func_001_cta.png');

    // Verify footer
    await expect(page.locator('footer')).toBeVisible();
    await logAndScreenshot(page, testInfo, 'Footer visible', 'screenshots/tc_func_001_footer.png');

    // Test CTA navigation
    await ctaButton.click();
    await expect(page).toHaveURL(/libraries|releases|docs|learn|download/i);
  });

  test('External links open correctly', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_002' });

    const startTime = Date.now();
    await page.goto('https://www.stage.boost.org/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Page loaded in ${loadTime}ms`, 'screenshots/tc_func_002_loaded.png');

    const externalLinks = await page.locator('a[href*="github.com"], a[href*="boost.org"], a[href*="youtube.com"], a[href*="reddit.com"], a[href*="linkedin.com"], a[href*="bsky.app"], a[href*="mastodon.social"], a[href*="x.com"], a[href*="facebook.com"]').all();
    await logAndScreenshot(page, testInfo, `Found ${externalLinks.length} external links`, 'screenshots/tc_func_002_links.png');

    if (externalLinks.length === 0) {
      await logAndScreenshot(page, testInfo, 'No external links found, skipping checks', 'screenshots/tc_func_002_no_links.png');
      return;
    }

    for (const [index, link] of externalLinks.entries()) {
      const href = await link.getAttribute('href').catch(() => null);
      const text = await link.textContent().catch(() => 'unknown');
      const isNewTab = (await link.getAttribute('target').catch(() => null)) === '_blank';
      
      // Skip invalid URLs
      if (!href || href.includes('http://ttps') || !href.startsWith('http')) {
        await logAndScreenshot(page, testInfo, `Skipping invalid link ${index}: text="${text}", href="${href}"`, `screenshots/tc_func_002_link_${index}_skipped.png`);
        continue;
      }

      await expect(link).toBeVisible();
      await logAndScreenshot(page, testInfo, `Testing link ${index}: text="${text}", href="${href}", NewTab=${isNewTab}`, `screenshots/tc_func_002_link_${index}.png`);

      try {
        if (isNewTab) {
          const [newPage] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null),
            link.click(),
          ]);
          if (newPage) {
            const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('http://ttps', 'https');
            await expect(newPage).toHaveURL(new RegExp(escapedHref), { timeout: 15000 });
            await newPage.close();
          } else {
            const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('http://ttps', 'https');
            await expect(page).toHaveURL(new RegExp(escapedHref), { timeout: 15000 });
            await page.goto('https://www.stage.boost.org/', { waitUntil: 'domcontentloaded' });
          }
        } else {
          await link.click();
          const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('http://ttps', 'https');
          await expect(page).toHaveURL(new RegExp(escapedHref), { timeout: 15000 });
          await page.goto('https://www.stage.boost.org/', { waitUntil: 'domcontentloaded' });
        }
      } catch (err) {
        await logAndScreenshot(page, testInfo, `Link ${index} failed: text="${text}", href="${href}", error="${err.message}"`, `screenshots/tc_func_002_link_${index}_error.png`);
        await page.goto('https://www.stage.boost.org/', { waitUntil: 'domcontentloaded' });
      }
    }
  });

  test('Navigation menu links redirect correctly', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_003' });
    testInfo.setTimeout(120000);

    const startTime = Date.now();
    await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Page loaded in ${loadTime}ms`, 'screenshots/tc_func_003_loaded.png');

    // Check for menu toggle and open if present
    const toggleLocator = selectors.mobileToggle(page);
    if (await toggleLocator.count() > 0) {
      await toggleLocator.scrollIntoViewIfNeeded();
      await expect(toggleLocator).toBeVisible();
      await toggleLocator.click();
      await page.waitForTimeout(2000); // Wait for menu animation
      await logAndScreenshot(page, testInfo, 'Menu toggle clicked', 'screenshots/tc_func_003_toggle.png');
      const menuLocator = selectors.mobileMenu(page);
      await expect(menuLocator).toBeVisible();
      await logAndScreenshot(page, testInfo, 'Navigation menu visible', 'screenshots/tc_func_003_menu.png');
    } else {
      await logAndScreenshot(page, testInfo, 'No menu toggle found, assuming desktop navigation', 'screenshots/tc_func_003_no_toggle.png');
    }

    const navLinks = {
      'libraries': /libraries/i,
      'releases': /releases/i,
      'community': /community/i,
      'news': /news|blog/i,
      'learn': /docs/i,
      'join': /signup/i,
    };

    for (const [text, urlPattern] of Object.entries(navLinks)) {
      const linkLocator = text === 'join'
        ? page.getByRole('link', { name: new RegExp(text, 'i') }).or(page.locator(`a[href*="/signup"]`)).first()
        : page.getByRole('link', { name: new RegExp(text, 'i') }).or(page.locator(`a[href*="/${text}"]`)).first();

      // Debug: Log locator candidates
      const candidates = await linkLocator.all();
      for (const [index, candidate] of candidates.entries()) {
        const candidateText = await candidate.textContent().catch(() => 'unknown');
        const candidateHref = await candidate.getAttribute('href').catch(() => 'unknown');
        await logAndScreenshot(page, testInfo, `Nav link ${text} candidate ${index}: text="${candidateText}", href="${candidateHref}"`, `screenshots/tc_func_003_${text}_candidate_${index}.png`);
      }

      const linkCount = await linkLocator.count();
      if (linkCount === 0) {
        await logAndScreenshot(page, testInfo, `No elements found for nav link ${text}`, `screenshots/tc_func_003_${text}_not_found.png`);
        throw new Error(`No elements found for nav link ${text}`);
      }

      try {
        await linkLocator.waitFor({ state: 'visible', timeout: 10000 });
        await linkLocator.scrollIntoViewIfNeeded({ timeout: 10000 });
        await expect(linkLocator).toBeVisible();
        await logAndScreenshot(page, testInfo, `Nav link ${text} visible`, `screenshots/tc_func_003_${text}_visible.png`);

        const href = await linkLocator.getAttribute('href');
        await expect(href).toMatch(urlPattern);

        await linkLocator.click();
        await expect(page).toHaveURL(urlPattern, { timeout: 15000 });
        await logAndScreenshot(page, testInfo, `Nav link ${text} navigated to ${page.url()}`, `screenshots/tc_func_003_${text}_post_nav.png`);
      } catch (err) {
        await logAndScreenshot(page, testInfo, `Nav link ${text} failed: ${err.message}`, `screenshots/tc_func_003_${text}_error.png`);
        throw err;
      }

      await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    }
  });

  test('Mobile navigation menu functionality', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_004' });
    testInfo.setTimeout(180000);
    await setupPage(page, testInfo, { width: 375, height: 667 });

    const startTime = Date.now();
    await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Page loaded in ${loadTime}ms`, 'screenshots/tc_func_004_loaded.png');

    const toggleLocator = selectors.mobileToggle(page);
    if (await toggleLocator.count() > 0) {
      await toggleLocator.scrollIntoViewIfNeeded();
      await expect(toggleLocator).toBeVisible();
      await toggleLocator.click();
      await page.waitForTimeout(5000);
      await logAndScreenshot(page, testInfo, 'Menu toggle clicked', 'screenshots/tc_func_004_toggle.png');

      const menuLocator = selectors.mobileMenu(page);
      await expect(menuLocator).toBeVisible();
      await logAndScreenshot(page, testInfo, 'Mobile menu visible', 'screenshots/tc_func_004_menu.png');
    } else {
      await logAndScreenshot(page, testInfo, 'No menu toggle found, skipping toggle interaction', 'screenshots/tc_func_004_no_toggle.png');
    }

    const navLinks = {
      'libraries': /libraries/i,
      'releases': /releases/i,
      'community': /community/i,
      'news': /news|blog/i,
      'learn': /docs/i,
      'join': /signup/i,
    };

    for (const [text, urlPattern] of Object.entries(navLinks)) {
      const linkLocator = text === 'join'
        ? page.locator(`nav a[href*="/signup"], a[class*="menu"][href*="/signup"]`).first()
        : page.locator(`nav a[href*="/${text}"], a[class*="menu"][href*="/${text}"]`).first();

      await linkLocator.scrollIntoViewIfNeeded();
      await expect(linkLocator).toBeVisible();
      await logAndScreenshot(page, testInfo, `Nav link ${text} visible`, `screenshots/tc_func_004_${text}_visible.png`);

      const href = await linkLocator.getAttribute('href');
      await expect(href).toMatch(urlPattern);

      let clickSucceeded = false;
      for (let attempt = 1; attempt <= 3 && !clickSucceeded; attempt++) {
        try {
          await linkLocator.click({ force: true });
          await page.waitForTimeout(2000);
          if (page.url().match(urlPattern)) {
            clickSucceeded = true;
            await logAndScreenshot(page, testInfo, `Click succeeded on attempt ${attempt} for ${text}`, `screenshots/tc_func_004_${text}_click_${attempt}.png`);
          }
        } catch (err) {
          await logAndScreenshot(page, testInfo, `Click attempt ${attempt} failed for ${text}: ${err.message}`, `screenshots/tc_func_004_${text}_click_${attempt}_error.png`);
          if (attempt === 3) throw err;
        }
      }

      await expect(page).toHaveURL(urlPattern);
      await logAndScreenshot(page, testInfo, `Nav link ${text} navigated to ${page.url()}`, `screenshots/tc_func_004_${text}_post_nav.png`);

      await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    }
  });

  test('Libraries page lists all Boost libraries', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_005' });

    const startTime = Date.now();
    await page.goto('https://www.stage.boost.org/libraries', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Libraries page loaded in ${loadTime}ms`, 'screenshots/tc_func_005_loaded.png');
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    await expect(page.getByRole('link', { name: /asio/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /beast/i })).toBeVisible();

    const loadMore = page.getByRole('button', { name: /more|load/i });
    if (await loadMore.count() > 0) {
      await loadMore.click();
      await expect(page.locator('ul').nth(1)).toBeVisible();
      await logAndScreenshot(page, testInfo, 'Load More button clicked successfully', 'screenshots/tc_func_005_load_more.png');
    }

    await page.getByRole('link', { name: /asio/i }).click();
    await expect(page).toHaveURL(/doc\/libs\/.*\/asio|library.*asio/i);
  });

  test('Library documentation is complete and functional', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_006' });

    const startTime = Date.now();
    await page.goto('https://www.stage.boost.org/libs/beast', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Beast docs loaded in ${loadTime}ms`, 'screenshots/tc_func_006_loaded.png');
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    await expect(page.getByRole('heading', { name: /overview|introduction|getting started/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /api reference/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /examples/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /tutorial/i })).toBeVisible();

    const copyButton = page.getByRole('button', { name: /copy/i });
    if (await copyButton.count() > 0) {
      await copyButton.click();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toMatch(/.+/);
      await logAndScreenshot(page, testInfo, `Clipboard text copied: ${clipboardText}`, 'screenshots/tc_func_006_copy.png');
    }
  });

  test('Documentation handles invalid or missing content', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_007' });

    await page.goto('https://www.stage.boost.org/libs/nonexistent', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /404|not found|error/i })).toBeVisible();
    await logAndScreenshot(page, testInfo, `Navigated to nonexistent page: ${page.url()}`, 'screenshots/tc_func_007_nonexistent.png');

    await page.goto('https://www.stage.boost.org/libs/beast', { waitUntil: 'networkidle' });
    const links = await page.locator('a[href*="/libs"]').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      await link.click();
      await expect(page).not.toHaveURL(/404/i);
      await logAndScreenshot(page, testInfo, `Library link ${href} navigated successfully`, `screenshots/tc_func_007_${href.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
      await page.goto('https://www.stage.boost.org/libs/beast', { waitUntil: 'networkidle' });
    }
  });

  test('Search returns accurate results for valid queries', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_008' });

    await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    const queries = ['Boost.Beast', 'WebSocket', 'C++20', 'tutorial'];

    for (const query of queries) {
      const searchInput = selectors.searchInput(page);
      await expect(searchInput).toBeVisible();
      await searchInput.fill(query);
      const startTime = Date.now();
      await Promise.all([
        searchInput.press('Enter'),
        page.waitForResponse(/algolia|search|query/i).catch(() => null),
      ]);
      const loadTime = Date.now() - startTime;
      await logAndScreenshot(page, testInfo, `Search for "${query}" took ${loadTime}ms`, `screenshots/tc_func_008_${query}.png`);
      expect(loadTime / 1000).toBeLessThanOrEqual(10);

      const resultLink = page.getByRole('dialog').getByRole('link', { name: new RegExp(query, 'i') }).or(page.locator(`a:has-text("${query}")`)).first();
      await expect(resultLink).toBeVisible();
      await resultLink.click();
      await expect(page).not.toHaveURL(/404/i);
      await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    }
  });

  test('Search handles invalid or unusual inputs', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_009' });

    await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    const tests = [
      { input: '', expected: /please enter|no results|empty/i },
      { input: '@#$%', expected: /no results|safe results|invalid/i },
      { input: 'a'.repeat(100), expected: /.*|no results|too long/i },
      { input: 'xyz_library', expected: /no results/i },
    ];

    for (const { input, expected } of tests) {
      const searchInput = selectors.searchInput(page);
      await expect(searchInput).toBeVisible();
      await searchInput.fill(input);
      await Promise.all([
        searchInput.press('Enter'),
        page.waitForResponse(/algolia|search|query/i).catch(() => null),
      ]);
      await expect(page.locator(`text=/${expected}/i`)).toBeVisible();
      await logAndScreenshot(page, testInfo, `Search for "${input}" handled correctly`, `screenshots/tc_func_009_${input.slice(0, 20)}.png`);
      await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    }
  });

  test('Search performs well under high-latency conditions', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_010' });

    await page.route('**/algolia**', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      route.continue();
    });

    await page.goto('https://www.stage.boost.org/', { waitUntil: 'networkidle' });
    const searchInput = selectors.searchInput(page);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Boost.Asio');
    const startTime = Date.now();
    await Promise.all([
      searchInput.press('Enter'),
      page.waitForResponse(/algolia|search|query/i).catch(() => null),
    ]);
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Search under latency took ${loadTime}ms`, 'screenshots/tc_func_010_search.png');
    expect(loadTime / 1000).toBeLessThanOrEqual(10);

    await expect(page.getByRole('link', { name: /asio/i }).or(page.locator('a:has-text("Asio")'))).toBeVisible();
  });

  test('Users can download the latest Boost release', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_011' });

    await page.goto('https://www.stage.boost.org/releases', { waitUntil: 'networkidle' });
    const downloadLink = page.getByRole('link', { name: /download|release/i }).or(page.locator('a:has-text("Download")'));
    await expect(downloadLink).toBeVisible();
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download').catch(() => null),
        downloadLink.click(),
      ]);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.zip$|\.tar\.gz$/);
        await logAndScreenshot(page, testInfo, `Downloaded file: ${download.suggestedFilename()}`, 'screenshots/tc_func_011_download.png');
      } else {
        await expect(page).toHaveURL(/download|release/i);
      }
    } catch (e) {
      await logAndScreenshot(page, testInfo, `Download failed: ${e.message}`, 'screenshots/tc_func_011_error.png');
      await downloadLink.click();
      await expect(page).toHaveURL(/download|release/i);
    }
  });

  test('Users can access previous Boost releases', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_012' });

    await page.goto('https://www.stage.boost.org/releases', { waitUntil: 'networkidle' });
    const downloadLink = page.getByText(/1\.85\.0/i).locator('a').first().or(page.locator('a:has-text("1.85.0")'));
    await expect(downloadLink).toBeVisible();
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download').catch(() => null),
        downloadLink.click(),
      ]);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.zip$|\.tar\.gz$/);
        await logAndScreenshot(page, testInfo, `Downloaded file: ${download.suggestedFilename()}`, 'screenshots/tc_func_012_download.png');
      } else {
        await expect(page).toHaveURL(/download|release/i);
      }
    } catch (e) {
      await logAndScreenshot(page, testInfo, `Download failed: ${e.message}`, 'screenshots/tc_func_012_error.png');
      await downloadLink.click();
      await expect(page).toHaveURL(/download|release/i);
    }
  });

  test('Download handles broken or unavailable links', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_013' });

    await page.route('**/releases/broken.zip', route => route.abort());
    await page.goto('https://www.stage.boost.org/releases', { waitUntil: 'networkidle' });
    await page.goto('https://www.stage.boost.org/releases/broken.zip', { waitUntil: 'networkidle' }).catch(() => null);
    await expect(page.getByRole('heading', { name: /error|not found|404/i }).or(page.locator('h1, h2, h3'))).toBeVisible();
    await logAndScreenshot(page, testInfo, `Error page for broken link`, 'screenshots/tc_func_013_error.png');
  });

  test('Community page links are functional', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_014' });

    await page.goto('https://www.stage.boost.org/community', { waitUntil: 'networkidle' });
    const communityLink = page.locator('a[href*="github.com/*/issues"], a[href*="discourse"], a[href*="lists.boost.org"]').first();
    await expect(communityLink).toBeVisible();
    const href = await communityLink.getAttribute('href');
    const isNewTab = (await communityLink.getAttribute('target')) === '_blank';
    await logAndScreenshot(page, testInfo, `Testing community link: ${href}, NewTab=${isNewTab}`, 'screenshots/tc_func_014_community.png');

    if (isNewTab) {
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page').catch(() => null),
        communityLink.click(),
      ]);
      if (newPage) {
        await expect(newPage).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i);
        await newPage.close();
      } else {
        await expect(page).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i);
      }
    } else {
      await communityLink.click();
      await expect(page).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i);
    }
  });
});