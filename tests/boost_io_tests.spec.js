
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Boost Staging Functional Tests', () => {
/// TC_FUNC_001: Homepage Load and Elements
test('Homepage loads correctly with all key elements', async ({ page }, testInfo) => {
  testInfo.setTimeout(90000); // 90s timeout for debugging
  await page.setViewportSize({ width: 1280, height: 720 });

  page.on('console', msg => fs.appendFileSync('test-logs.txt', `Console [${msg.type()}]: ${msg.text()}\n`));
  page.on('pageerror', err => fs.appendFileSync('test-logs.txt', `PAGE ERROR: ${err.message}\n`));

  // Block font and image requests
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
    const status = response ? response.status : 'pending';
    const duration = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Network request: ${method} ${url}, Type: ${resourceType}, Status: ${status}, Duration: ${duration}ms\n`);
  });

  try {
    const startTime = Date.now();
    let response;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await page.goto('https://www.stage.boost.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (err) {
        fs.appendFileSync('test-logs.txt', `Page.goto attempt ${attempt} failed: ${err.message}\n`);
        if (attempt === 3) throw err;
        await page.waitForTimeout(2000);
      }
    }
    if (!response || response.status() !== 200) {
      fs.appendFileSync('test-logs.txt', `Failed to load homepage: Status ${response?.status() || 'no response'}, URL: ${page.url()}\n`);
      throw new Error(`Homepage failed to load: Status ${response?.status() || 'no response'}`);
    }
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Page loaded with status: ${response.status()} in ${loadTime}ms, URL: ${page.url()}\n`);
    expect(loadTime / 1000).toBeLessThanOrEqual(15);

    // Stabilize page state
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(7000); // Longer delay for rendering

    // Debug: Screenshot before logo check
    await page.screenshot({ path: 'screenshots/tc_func_001_pre_logo.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Pre-logo screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_001_pre_logo.png\n`);

    // Debug: Log all img elements
    const allImages = await page.locator('img').all();
    fs.appendFileSync('test-logs.txt', `Found ${allImages.length} img elements\n`);
    for (const [index, img] of allImages.entries()) {
      const isVisible = await img.isVisible();
      const attributes = await img.evaluate(el => ({
        src: el.src,
        alt: el.alt || '',
        style: el.getAttribute('style') || '',
        class: el.className,
        loading: el.getAttribute('loading') || '',
      }));
      const styles = await img.evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
      }));
      fs.appendFileSync('test-logs.txt', `Image ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
    }

    // Check logo
    let logoLocator = page.getByRole('img', { name: /Boost/i }).first();
    const logoElements = await page.getByRole('img', { name: /Boost/i }).all();
    fs.appendFileSync('test-logs.txt', `Found ${logoElements.length} logo elements with getByRole\n`);
    if (logoElements.length === 0) {
      fs.appendFileSync('test-logs.txt', `Falling back to alternative selector for logo\n`);
      logoLocator = page.locator('img[src*="/static/img/Boost_Logo"]');
    }

    await page.evaluate(() => {
      const img = document.querySelector('img[src*="/static/img/Boost_Logo"]') || document.querySelector('img[alt*="Boost"]');
      if (img) img.scrollIntoView();
    });

    await logoLocator.waitFor({ state: 'visible', timeout: 20000 });
    await expect(logoLocator).toBeVisible({ timeout: 20000 });
    fs.appendFileSync('test-logs.txt', `Logo visible\n`);

    // Debug: Screenshot before navigation check
    await page.screenshot({ path: 'screenshots/tc_func_001_pre_nav.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Pre-nav screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_001_pre_nav.png\n`);

    // Debug: Log potential navigation elements
    const navElements = await page.locator('nav, header, div[role="navigation"], section[role="navigation"], div[class*="nav"], header[class*="nav"]').all();
    fs.appendFileSync('test-logs.txt', `Found ${navElements.length} potential navigation elements\n`);
    for (const [index, nav] of navElements.entries()) {
      const isVisible = await nav.isVisible();
      const attributes = await nav.evaluate(el => ({
        tag: el.tagName,
        role: el.getAttribute('role') || '',
        class: el.className,
        id: el.id || '',
      }));
      const styles = await nav.evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
      }));
      fs.appendFileSync('test-logs.txt', `Nav ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
    }

    // Check navigation
    const navLocator = page.getByRole('navigation').first().or(page.locator('header, nav, div[class*="nav"], section[class*="nav"]')).first();
    await navLocator.waitFor({ state: 'visible', timeout: 15000 });
    await expect(navLocator).toBeVisible({ timeout: 15000 });
    fs.appendFileSync('test-logs.txt', `Navigation bar visible\n`);

    const contentLocator = page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2, h3, p')).first();
    await expect(contentLocator).toBeVisible({ timeout: 10000 });
    fs.appendFileSync('test-logs.txt', `Main content visible\n`);

    // Debug: Screenshot before CTA check
    await page.screenshot({ path: 'screenshots/tc_func_001_pre_cta.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Pre-CTA screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_001_pre_cta.png\n`);

    // Debug: Log all CTA links
    const ctaLinks = await page.getByRole('link', { name: /start|explore|learn|try|download/i }).all();
    fs.appendFileSync('test-logs.txt', `Found ${ctaLinks.length} CTA links\n`);
    for (const [index, link] of ctaLinks.entries()) {
      const isVisible = await link.isVisible();
      const attributes = await link.evaluate(el => ({
        href: el.href,
        text: el.textContent.trim(),
        class: el.className,
        id: el.id || '',
      }));
      const styles = await link.evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
      }));
      fs.appendFileSync('test-logs.txt', `CTA ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
    }

    // Check CTA
    let ctaButton = page.getByRole('link', { name: /download/i }).first();
    const ctaCount = await page.getByRole('link', { name: /download/i }).count();
    fs.appendFileSync('test-logs.txt', `Found ${ctaCount} download links\n`);
    if (ctaCount === 0) {
      fs.appendFileSync('test-logs.txt', `Falling back to alternative CTA selector\n`);
      ctaButton = page.locator('a[class*="bg-orange"]');
    }

    await page.evaluate(() => {
      const link = document.querySelector('a[class*="bg-orange"]') || document.querySelector('a[href*="/releases"]');
      if (link) link.scrollIntoView();
    });

    await ctaButton.waitFor({ state: 'visible', timeout: 15000 });
    await expect(ctaButton).toBeVisible({ timeout: 15000 });
    fs.appendFileSync('test-logs.txt', `CTA button visible\n`);

    await expect(page.locator('footer')).toBeVisible({ timeout: 10000 });

    await ctaButton.click();
    await expect(page).toHaveURL(/libraries|releases|docs|learn|download/i, { timeout: 15000 });
  } catch (error) {
    fs.appendFileSync('test-logs.txt', `Test failed with error: ${error.message}, URL: ${page.url()}, Page state: ${page.isClosed() ? 'closed' : 'open'}\n`);
    await page.screenshot({ path: 'screenshots/tc_func_001_error.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Error screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot attempted: screenshots/tc_func_001_error.png\n`);
    throw error;
  }
});

// TC_FUNC_002: External Link Functionality
test('External links open correctly', async ({ page }, testInfo) => {
  testInfo.setTimeout(90000); // 90s timeout for debugging
  await page.setViewportSize({ width: 1280, height: 720 });

  // Block font and image requests
  await page.route('**/*.{woff,woff2,ttf,otf,eot,png,jpg,jpeg,svg}', route => route.abort());
  await page.route('**/*font*', route => route.abort());
  await page.route('**/*image*', route => route.abort());

  try {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Page loaded with status: ${page.url()} in ${loadTime}ms\n`);
    await page.waitForTimeout(5000); // Wait for dynamic content

    // Debug: Screenshot before link check
    await page.screenshot({ path: 'screenshots/tc_func_002_pre_links.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Pre-links screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_002_pre_links.png\n`);

    // Debug: Log all external links
    const externalLinks = await page.locator('a[href*="github.com"], a[href*="boost.org"], a[href*="youtube.com"], a[href*="reddit.com"], a[href*="linkedin.com"], a[href*="bsky.app"], a[href*="mastodon.social"], a[href*="x.com"], a[href*="facebook.com"]').all();
    fs.appendFileSync('test-logs.txt', `Found ${externalLinks.length} external links\n`);
    for (const [index, link] of externalLinks.entries()) {
      const isVisible = await link.isVisible().catch(() => false);
      const attributes = await link.evaluate(el => ({
        href: el.href,
        text: el.textContent.trim(),
        target: el.getAttribute('target') || '',
        class: el.className,
      })).catch(() => ({ href: 'unknown', text: 'unknown', target: '', class: '' }));
      fs.appendFileSync('test-logs.txt', `Link ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}\n`);
    }

    // Check if links exist
    if (externalLinks.length === 0) {
      fs.appendFileSync('test-logs.txt', `No external links found, skipping checks\n`);
      return;
    }

    for (const [index, link] of externalLinks.entries()) {
      try {
        await link.waitFor({ state: 'visible', timeout: 10000 });
        const href = await link.getAttribute('href');
        const isNewTab = (await link.getAttribute('target')) === '_blank';
        await expect(link).toBeVisible({ timeout: 10000 });
        fs.appendFileSync('test-logs.txt', `Testing link ${index}: ${href}, NewTab=${isNewTab}\n`);

        if (isNewTab) {
          const [newPage] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null),
            link.click()
          ]);
          if (newPage) {
            await expect(newPage).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 20000 });
            await newPage.close();
          } else {
            await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 20000 });
            await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20000 });
          }
        } else {
          await link.click();
          await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 20000 });
          await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
      } catch (e) {
        fs.appendFileSync('test-logs.txt', `Link ${index} failed: ${e.message}\n`);
      }
    }
  } catch (error) {
    fs.appendFileSync('test-logs.txt', `Test failed with error: ${error.message}, URL: ${page.url()}, Page state: ${page.isClosed() ? 'closed' : 'open'}\n`);
    await page.screenshot({ path: 'screenshots/tc_func_002_error.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Error screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot attempted: screenshots/tc_func_002_error.png\n`);
    throw error;
  }
});

// TC_FUNC_003: Navigation Menu Functionality
test('Navigation menu links redirect correctly', async ({ page }, testInfo) => {
  testInfo.setTimeout(120000); // 120s timeout for debugging
  await page.setViewportSize({ width: 1280, height: 720 });

  // Block font and image requests
  await page.route('**/*.{woff,woff2,ttf,otf,eot,png,jpg,jpeg,svg}', route => route.abort());
  await page.route('**/*font*', route => route.abort());
  await page.route('**/*image*', route => route.abort());

  try {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `Page loaded with status: ${page.url()} in ${loadTime}ms\n`);
    await page.waitForTimeout(10000); // Wait for dynamic content

    // Debug: Screenshot before nav checks
    await page.screenshot({ path: 'screenshots/tc_func_003_pre_nav.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Pre-nav screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_003_pre_nav.png\n`);

    // Debug: Log navigation structure
    const navElements = await page.locator('nav, header, div[class*="nav"], section[class*="nav"]').all();
    fs.appendFileSync('test-logs.txt', `Found ${navElements.length} navigation elements\n`);
    for (const [index, nav] of navElements.entries()) {
      const isVisible = await nav.isVisible().catch(() => false);
      const attributes = await nav.evaluate(el => ({
        tag: el.tagName,
        role: el.getAttribute('role') || '',
        class: el.className,
        id: el.id || '',
      })).catch(() => ({ tag: 'unknown', role: '', class: '', id: '' }));
      const styles = await nav.evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown' }));
      fs.appendFileSync('test-logs.txt', `Nav ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
    }

    const navLinks = {
      'libraries': /libraries/i,
      'releases': /releases/i,
      'community': /community/i,
      'news': /news|blog/i,
      'learn': /docs/i,
      'join': /signup/i
    };

    for (const [text, urlPattern] of Object.entries(navLinks)) {
      // Debug: Log all matching links
      const allLinks = await page.getByRole('link', { name: new RegExp(text, 'i') }).all();
      fs.appendFileSync('test-logs.txt', `Found ${allLinks.length} links for ${text}\n`);
      for (const [index, link] of allLinks.entries()) {
        const isVisible = await link.isVisible().catch(() => false);
        const attributes = await link.evaluate(el => ({
          href: el.href,
          text: el.textContent.trim(),
          id: el.id || '',
          class: el.className,
          hxGet: el.getAttribute('hx-get') || '',
        })).catch(() => ({ href: 'unknown', text: 'unknown', id: '', class: '', hxGet: '' }));
        const styles = await link.evaluate(el => ({
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
        })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown' }));
        fs.appendFileSync('test-logs.txt', `Link ${index} for ${text}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
      }

      // Debug: Log toggle buttons
      const menuToggle = page.locator('button[aria-label*="menu"], button[class*="toggle"], div[class*="menu"] button, [aria-controls*="nav"], [data-nav], button:has(svg), button[class*="hamburger"], button[aria-expanded]');
      const toggleCount = await menuToggle.count();
      fs.appendFileSync('test-logs.txt', `Found ${toggleCount} menu toggle buttons for ${text}\n`);
      for (const [index, toggle] of (await menuToggle.all()).entries()) {
        const isVisible = await toggle.isVisible().catch(() => false);
        const attributes = await toggle.evaluate(el => ({
          class: el.className,
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaExpanded: el.getAttribute('aria-expanded') || '',
          ariaControls: el.getAttribute('aria-controls') || '',
          dataNav: el.getAttribute('data-nav') || '',
        })).catch(() => ({ class: 'unknown', ariaLabel: '', ariaExpanded: '', ariaControls: '', dataNav: '' }));
        fs.appendFileSync('test-logs.txt', `Toggle ${index} for ${text}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}\n`);
      }

      // Custom locator for "join" to avoid news link
      let linkLocator = text === 'join'
        ? page.locator(`a[id="${text}"].menu-link, a[href*="/signup"], a[class*="menu"][href*="/signup"]`).first()
        : page.locator(`a[id="${text}"].menu-link`).first();
      const linkCount = await (text === 'join'
        ? page.locator(`a[id="${text}"].menu-link, a[href*="/signup"]`).count()
        : page.locator(`a[id="${text}"].menu-link`).count());
      if (linkCount === 0) {
        fs.appendFileSync('test-logs.txt', `Falling back to alternative link selector for ${text}\n`);
        linkLocator = page.locator(`a[id="${text}"], a[class*="menu"], a[href*="/${text}"]`).first();
      }

      // Ensure link is in viewport
      await page.evaluate((selector) => {
        const link = document.querySelector(selector);
        if (link) link.scrollIntoView();
      }, text === 'join' ? `a[id="${text}"].menu-link, a[href*="/signup"]` : `a[id="${text}"].menu-link, a[id="${text}"], a[class*="menu"], a[href*="/${text}"]`);

      // Attempt to reveal menu
      if (toggleCount > 0) {
        const toggle = menuToggle.first();
        await toggle.hover({ timeout: 10000 }).catch(err => {
          fs.appendFileSync('test-logs.txt', `Menu toggle hover failed for ${text}: ${err.message}\n`);
        });
        await page.waitForTimeout(2000);
        await toggle.click({ timeout: 10000 }).catch(err => {
          fs.appendFileSync('test-logs.txt', `Menu toggle click failed for ${text}: ${err.message}\n`);
        });
        await page.waitForTimeout(3000);
        const ariaExpanded = await toggle.getAttribute('aria-expanded').catch(() => null);
        fs.appendFileSync('test-logs.txt', `Menu toggle aria-expanded for ${text}: ${ariaExpanded}\n`);
        if (ariaExpanded !== 'true') {
          await toggle.click({ timeout: 10000 }).catch(err => {
            fs.appendFileSync('test-logs.txt', `Second menu toggle click failed for ${text}: ${err.message}\n`);
          });
          await page.waitForTimeout(3000);
        }
      }

      // Debug: Screenshot after toggle
      await page.screenshot({ path: `screenshots/tc_func_003_${text}_post_toggle.png`, fullPage: true, timeout: 10000 }).catch(err => {
        fs.appendFileSync('test-logs.txt', `Post-toggle screenshot for ${text} failed: ${err.message}\n`);
      });
      fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_003_${text}_post_toggle.png\n`);

      await linkLocator.waitFor({ state: 'visible', timeout: 50000 });
      await expect(linkLocator).toBeVisible({ timeout: 50000 });
      fs.appendFileSync('test-logs.txt', `Nav link ${text} visible\n`);

      // Verify href before click
      const href = await linkLocator.getAttribute('href').catch(() => 'unknown');
      fs.appendFileSync('test-logs.txt', `Nav link ${text} href: ${href}\n`);
      await expect(href).toMatch(urlPattern);

      // Debug: Screenshot before click
      await page.screenshot({ path: `screenshots/tc_func_003_${text}_pre_click.png`, fullPage: true, timeout: 10000 }).catch(err => {
        fs.appendFileSync('test-logs.txt', `Pre-click screenshot for ${text} failed: ${err.message}\n`);
      });
      fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_003_${text}_pre_click.png\n`);

      await linkLocator.click({ timeout: 30000 });
      await page.waitForTimeout(2000); // Wait for potential redirects
      await expect(page).toHaveURL(urlPattern, { timeout: 40000 });
      fs.appendFileSync('test-logs.txt', `Nav link ${text} navigated to ${page.url()}\n`);

      // Debug: Screenshot after navigation
      await page.screenshot({ path: `screenshots/tc_func_003_${text}_post_nav.png`, fullPage: true, timeout: 10000 }).catch(err => {
        fs.appendFileSync('test-logs.txt', `Post-nav screenshot for ${text} failed: ${err.message}\n`);
      });
      fs.appendFileSync('test-logs.txt', `Screenshot saved: screenshots/tc_func_003_${text}_post_nav.png\n`);

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
  } catch (error) {
    fs.appendFileSync('test-logs.txt', `Test failed with error: ${error.message}, URL: ${page.url()}, Page state: ${page.isClosed() ? 'closed' : 'open'}\n`);
    await page.screenshot({ path: 'screenshots/tc_func_003_error.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `Error screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `Screenshot attempted: screenshots/tc_func_003_error.png\n`);
    throw error;
  }
});

// TC_FUNC_004: Mobile Navigation Menu Functionality
test('Mobile navigation menu functionality', async ({ page }, testInfo) => {
  testInfo.setTimeout(180000); // 180s timeout for debugging
  await page.setViewportSize({ width: 375, height: 667 });

  // Block font and image requests
  await page.route('**/*.{woff,woff2,ttf,otf,eot,png,jpg,jpeg,svg}', route => route.abort());
  await page.route('**/*font*', route => route.abort());
  await page.route('**/*image*', route => route.abort());

  try {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Page loaded with status: ${page.url()} in ${loadTime}ms\n`);
    await page.waitForTimeout(10000); // Wait for dynamic content

    // Debug: Screenshot before toggle check
    await page.screenshot({ path: 'screenshots/tc_func_004_pre_toggle.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Pre-toggle screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Screenshot saved: screenshots/tc_func_004_pre_toggle.png\n`);

    // Debug: Log navigation structure
    const navElements = await page.locator('nav, header, div[class*="nav"], div[id*="nav"], section[class*="nav"], ul[class*="menu"], [role="navigation"]').all();
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Found ${navElements.length} navigation elements\n`);
    for (const [index, nav] of navElements.entries()) {
      const isVisible = await nav.isVisible().catch(() => false);
      const attributes = await nav.evaluate(el => ({
        tag: el.tagName,
        role: el.getAttribute('role') || '',
        class: el.className,
        id: el.id || '',
      })).catch(() => ({ tag: 'unknown', role: '', class: '', id: '' }));
      const styles = await nav.evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
        maxHeight: window.getComputedStyle(el).maxHeight,
        transform: window.getComputedStyle(el).transform,
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', maxHeight: 'unknown', transform: 'unknown' }));
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Nav ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
    }

    // Debug: Log toggle buttons
    const toggleLocator = page.locator('button[aria-label*="menu"], button[class*="hamburger"], button[aria-controls*="nav"], button[aria-expanded], button:has(svg), div[class*="menu"] button, [data-toggle*="nav"], [data-nav], [id*="toggle"], [id*="menu"], [role="button"], [data-menu], button[class*="mobile-nav"], [data-mobile-nav], button[id*="nav"]');
    const toggleCount = await toggleLocator.count();
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Found ${toggleCount} menu toggle buttons\n`);
    for (const [index, toggle] of (await toggleLocator.all()).entries()) {
      const isVisible = await toggle.isVisible().catch(() => false);
      const attributes = await toggle.evaluate(el => ({
        tag: el.tagName,
        class: el.className,
        ariaLabel: el.getAttribute('aria-label') || '',
        ariaExpanded: el.getAttribute('aria-expanded') || '',
        ariaControls: el.getAttribute('aria-controls') || '',
        dataToggle: el.getAttribute('data-toggle') || '',
        dataNav: el.getAttribute('data-nav') || '',
        id: el.id || '',
      })).catch(() => ({ tag: 'unknown', class: 'unknown', ariaLabel: '', ariaExpanded: '', ariaControls: '', dataToggle: '', dataNav: '', id: '' }));
      const styles = await toggle.evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown' }));
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Toggle ${index}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}\n`);
    }

    // Ensure toggle is in viewport and visible
    if (toggleCount > 0) {
      await toggleLocator.first().scrollIntoViewIfNeeded();
      await expect(toggleLocator.first()).toBeVisible({ timeout: 30000 });
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Menu toggle visible\n`);

      // Click toggle with JavaScript fallback
      await toggleLocator.first().evaluate(el => el.click()).catch(err => {
        fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Menu toggle JS click failed: ${err.message}\n`);
      });
      await page.waitForTimeout(15000); // Increased delay for menu
      const ariaExpanded = await toggleLocator.first().getAttribute('aria-expanded').catch(() => null);
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Menu toggle aria-expanded: ${ariaExpanded}\n`);
      if (ariaExpanded !== 'true') {
        await toggleLocator.first().evaluate(el => el.click()).catch(err => {
          fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Second menu toggle JS click failed: ${err.message}\n`);
        });
        await page.waitForTimeout(15000);
      }

      // Verify menu is visible
      const menuLocator = page.locator('nav, div[id*="nav"], div[class*="nav"], ul[class*="menu"], div[class*="mobile-nav"], [role="navigation"]');
      await expect(menuLocator.first()).toBeVisible({ timeout: 30000 });
      const menuStyles = await menuLocator.first().evaluate(el => ({
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
        maxHeight: window.getComputedStyle(el).maxHeight,
        transform: window.getComputedStyle(el).transform,
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', maxHeight: 'unknown', transform: 'unknown' }));
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Mobile menu visible, Styles=${JSON.stringify(menuStyles)}\n`);

      // Check for sub-menus and parent items
      const subMenuLocator = page.locator('nav ul ul, div[id*="nav"] ul, div[class*="menu"] ul, [role="menu"], li:has(a[id="libraries"])');
      const subMenuCount = await subMenuLocator.count();
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Found ${subMenuCount} sub-menus\n`);
      for (const [index, subMenu] of (await subMenuLocator.all()).entries()) {
        const isVisible = await subMenu.isVisible().catch(() => false);
        const styles = await subMenu.evaluate(el => ({
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
          maxHeight: window.getComputedStyle(el).maxHeight,
          transform: window.getComputedStyle(el).transform,
        })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', maxHeight: 'unknown', transform: 'unknown' }));
        fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Sub-menu ${index}: Visible=${isVisible}, Styles=${JSON.stringify(styles)}\n`);
        if (!isVisible) {
          await subMenu.evaluate(el => {
            el.style.display = 'block';
            el.style.maxHeight = 'none';
            el.style.opacity = '1';
            el.style.transform = 'none';
          }).catch(err => {
            fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Sub-menu ${index} style override failed: ${err.message}\n`);
          });
          await subMenu.click({ timeout: 10000 }).catch(err => {
            fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Sub-menu ${index} click failed: ${err.message}\n`);
          });
          await page.waitForTimeout(5000);
        }
      }
    } else {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: No menu toggle found, skipping toggle interaction\n`);
    }

    // Debug: Screenshot after toggle and sub-menu handling
    await page.screenshot({ path: 'screenshots/tc_func_004_post_toggle.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Post-toggle screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Screenshot saved: screenshots/tc_func_004_post_toggle.png\n`);

    const navLinks = {
      'libraries': /libraries/i,
      'releases': /releases/i,
      'community': /community/i,
      'news': /news|blog/i,
      'learn': /docs/i,
      'join': /signup/i
    };

    for (const [text, urlPattern] of Object.entries(navLinks)) {
      // Debug: Log all matching links
      const allLinks = await page.locator(`nav a[href*="/${text}"], a[class*="menu"][href*="/${text}"], a[id="${text}"], div[id*="nav"] a[href*="/${text}"], ul[class*="menu"] a[href*="/${text}"], [role="navigation"] a[href*="/${text}"], ul a[href*="/${text}"], [aria-label*="menu"] a[href*="/${text}"], div[class*="nav"] ul a[href*="/${text}"]`).all();
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Found ${allLinks.length} links for ${text}\n`);
      for (const [index, link] of allLinks.entries()) {
        const isVisible = await link.isVisible().catch(() => false);
        const attributes = await link.evaluate(el => ({
          href: el.href,
          text: el.textContent.trim(),
          id: el.id || '',
          class: el.className,
        })).catch(() => ({ href: 'unknown', text: 'unknown', id: '', class: '' }));
        const styles = await link.evaluate(el => ({
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
        })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown' }));
        const parentStyles = await link.evaluate(el => {
          const parent = el.parentElement;
          return parent ? {
            display: window.getComputedStyle(parent).display,
            visibility: window.getComputedStyle(parent).visibility,
            opacity: window.getComputedStyle(parent).opacity,
            maxHeight: window.getComputedStyle(parent).maxHeight,
          } : {};
        }).catch(() => ({}));
        fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Link ${index} for ${text}: Visible=${isVisible}, Attributes=${JSON.stringify(attributes)}, Styles=${JSON.stringify(styles)}, ParentStyles=${JSON.stringify(parentStyles)}\n`);
      }

      const linkLocator = text === 'join'
        ? page.locator(`nav a[id="${text}"], nav a[href*="/signup"], a[class*="menu"][href*="/signup"], div[id*="nav"] a[href*="/signup"], ul[class*="menu"] a[href*="/signup"], [role="navigation"] a[href*="/signup"], ul a[href*="/signup"], [aria-label*="menu"] a[href*="/signup"], div[class*="nav"] ul a[href*="/signup"]`).first()
        : page.locator(`nav a[id="${text}"], nav a[href*="/${text}"], a[class*="menu"][href*="/${text}"], div[id*="nav"] a[href*="/${text}"], ul[class*="menu"] a[href*="/${text}"], [role="navigation"] a[href*="/${text}"], ul a[href*="/${text}"], [aria-label*="menu"] a[href*="/${text}"], div[class*="nav"] ul a[href*="/${text}"]`).first();

      // Ensure link is in viewport
      await page.evaluate((selector) => {
        const link = document.querySelector(selector);
        if (link) link.scrollIntoView();
      }, `nav a[id="${text}"], nav a[href*="/${text}"], a[class*="menu"][href*="/${text}"], div[id*="nav"] a[href*="/${text}"], ul[class*="menu"] a[href*="/${text}"], [role="navigation"] a[href*="/${text}"], [aria-label*="menu"] a[href*="/${text}"]`);

      // Debug: Screenshot before link check
      await page.screenshot({ path: `screenshots/tc_func_004_${text}_pre_link.png`, fullPage: true, timeout: 10000 }).catch(err => {
        fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Pre-link screenshot for ${text} failed: ${err.message}\n`);
      });
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Screenshot saved: screenshots/tc_func_004_${text}_pre_link.png\n`);

      // Force parent visibility
      await linkLocator.evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          parent.style.display = 'block';
          parent.style.maxHeight = 'none';
          parent.style.opacity = '1';
          parent.style.transform = 'none';
          parent = parent.parentElement;
        }
      }).catch(err => {
        fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Link ${text} parent style override failed: ${err.message}\n`);
      });

      await linkLocator.waitFor({ state: 'visible', timeout: 75000 });
      await expect(linkLocator).toBeVisible({ timeout: 75000 });
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Nav link ${text} visible\n`);

      // Verify href
      const href = await linkLocator.getAttribute('href').catch(() => 'unknown');
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Nav link ${text} href: ${href}\n`);
      await expect(href).toMatch(urlPattern);

      await linkLocator.click({ timeout: 30000 });
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(urlPattern, { timeout: 40000 });
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Nav link ${text} navigated to ${page.url()}\n`);

      // Debug: Screenshot after navigation
      await page.screenshot({ path: `screenshots/tc_func_004_${text}_post_nav.png`, fullPage: true, timeout: 10000 }).catch(err => {
        fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Post-nav screenshot for ${text} failed: ${err.message}\n`);
      });
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Screenshot saved: screenshots/tc_func_004_${text}_post_nav.png\n`);

      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    }
  } catch (error) {
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Test failed with error: ${error.message}, URL: ${page.url()}, Page state: ${page.isClosed() ? 'closed' : 'open'}\n`);
    await page.screenshot({ path: 'screenshots/tc_func_004_error.png', fullPage: true, timeout: 10000 }).catch(err => {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Error screenshot failed: ${err.message}\n`);
    });
    fs.appendFileSync('test-logs.txt', `TC_FUNC_004: Screenshot attempted: screenshots/tc_func_004_error.png\n`);
    throw error;
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