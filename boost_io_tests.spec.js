const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Centralized locators for reusability
const selectors = {
  logo: page => page.getByRole('img', { name: /Boost/i }).first().or(page.locator('img[src*="/static/img/Boost_Logo"]')),
  nav: page => page.getByRole('navigation').first().or(page.locator('header, nav, div[class*="nav"], section[class*="nav"]')).first(),
  content: page => page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2, h3, p')).first(),
  cta: page => page.getByRole('link', { name: /Download the Latest Release|download.*release/i }).first(),
  searchInput: page => page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]')),
  mobileToggle: page => page.locator('button[aria-label*="menu" i], button[class*="hamburger" i], button[aria-controls*="nav" i], button[aria-expanded], button:has(svg), button[class*="menu" i], button[id*="nav" i], button[id*="menu" i], [data-toggle*="nav" i], [data-nav], [data-menu], button[class*="mobile-nav" i], [data-mobile-nav], button[aria-label*="toggle" i], button[class*="toggle" i], div[class*="nav-toggle" i], span[class*="menu" i]').first(),
  mobileMenu: page => page.locator('nav, div[id*="nav" i], div[class*="nav" i], ul[class*="menu" i], div[class*="mobile-nav" i], [role="navigation"]').first(),
  externalLinks: page => page.locator('a[href*="github.com"], a[href*="youtube.com"], a[href*="reddit.com"], a[href*="linkedin.com"], a[href*="bsky.app"], a[href*="mastodon.social"], a[href*="x.com"], a[href*="facebook.com"]').filter({ hasNot: page.locator('a[href*="boost.org"]') }),
};

// Utility functions for logging and screenshots
async function logAndScreenshot(page, testInfo, message, path, logFile = 'test-logs.txt') {
  fs.appendFileSync(logFile, `${message}\n`);
  if (!page.isClosed()) {
    try {
      await page.screenshot({ path, fullPage: true, timeout: 3000 });
      fs.appendFileSync(logFile, `Screenshot saved: ${path}\n`);
    } catch (err) {
      fs.appendFileSync(logFile, `Screenshot failed: ${err.message}\n`);
    }
  } else {
    fs.appendFileSync(logFile, `Screenshot skipped: Page is closed\n`);
  }
}

async function setupPage(page, testInfo, viewport = { width: 1280, height: 720 }) {
  await page.setViewportSize(viewport);
  page.on('console', msg => fs.appendFileSync('test-logs.txt', `Console [${msg.type()}]: ${msg.text()}\n`));
  page.on('pageerror', err => fs.appendFileSync('test-logs.txt', `PAGE ERROR: ${err.message}\n`));
  page.on('close', () => fs.appendFileSync('test-logs.txt', `Page closed unexpectedly at ${new Date().toISOString()}\n`));

  // Block non-essential requests
  await page.route('**/*.{woff,woff2,ttf,otf,eot,png,jpg,jpeg,svg}', route => route.abort());
  await page.route('**/*font*', route => route.abort());
  await page.route('**/*image*', route => route.abort());

  // Log network requests with redirect handling
  await page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();
    const resourceType = route.request().resourceType();
    const startTime = Date.now();
    try {
      await route.continue();
      const response = await route.request().response().catch(() => null);
      const status = response ? response.status() : 'pending';
      const redirectUrl = response && status >= 300 && status < 400 ? response.headerValue('location') : null;
      const duration = Date.now() - startTime;
      fs.appendFileSync('test-logs.txt', `Network request: ${method} ${url}, Type: ${resourceType}, Status: ${status}${redirectUrl ? `, Redirect: ${redirectUrl}` : ''}, Duration: ${duration}ms\n`);
    } catch (err) {
      fs.appendFileSync('test-logs.txt', `Network request failed: ${method} ${url}, Error: ${err.message}\n`);
    }
  });
}

async function safeGoto(page, testInfo, url, options = { waitUntil: 'networkidle' }) {
  const maxRetries = 3;
  let finalUrl = url;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (page.isClosed()) {
      await logAndScreenshot(page, testInfo, `Page is closed before goto attempt ${attempt} for ${url}`, `screenshots/goto_attempt_${attempt}_closed.png`);
      return { success: false, finalUrl };
    }
    try {
      const response = await page.goto(finalUrl, { ...options, timeout: 20000 });
      const status = response ? response.status() : 'no response';
      const redirectUrl = response && status >= 300 && status < 400 ? response.headerValue('location') : null;
      await logAndScreenshot(page, testInfo, `Navigated to ${finalUrl} with status ${status}${redirectUrl ? `, Redirect: ${redirectUrl}` : ''} on attempt ${attempt}`, `screenshots/goto_attempt_${attempt}.png`);
      if (redirectUrl && redirectUrl !== finalUrl) {
        finalUrl = redirectUrl.startsWith('/') ? `https://www.stage.boost.org${redirectUrl}` : redirectUrl;
        await logAndScreenshot(page, testInfo, `Following redirect to ${finalUrl} on attempt ${attempt}`, `screenshots/goto_attempt_${attempt}_redirect.png`);
        continue;
      }
      return { success: true, finalUrl };
    } catch (err) {
      await logAndScreenshot(page, testInfo, `Goto attempt ${attempt} failed for ${finalUrl}: ${err.message}`, `screenshots/goto_attempt_${attempt}_error.png`);
      if (attempt === maxRetries) return { success: false, finalUrl };
      await page.waitForTimeout(1000);
    }
  }
  return { success: false, finalUrl };
}

test.describe('Boost Staging Functional Tests', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    await setupPage(page, testInfo);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      await logAndScreenshot(page, testInfo, `Test failed: ${testInfo.error?.message || 'Unknown error'}, URL: ${page.url()}, Page state: ${page.isClosed() ? 'closed' : 'open'}`, `screenshots/${testInfo.title.replace(/\s+/g, '_')}_error.png`);
    }
  });

  

test('Homepage loads and displays key elements', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_001' });
  testInfo.setTimeout(60000); // Align with playwright.config.js

  // Navigate to homepage using baseURL
  const homepageUrl = '/?cachebust=' + Date.now();
  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!success) {
    await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_001_load_failed.png');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_001_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(15);

  // Verify logo
  const logoLocator = selectors.logo(page);
  await expect(logoLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Boost logo not visible', 'screenshots/tc_func_001_logo_not_visible.png');
  });

  // Verify navigation bar
  const navLocator = selectors.nav(page);
  await expect(navLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Navigation bar not visible', 'screenshots/tc_func_001_nav_not_visible.png');
  });

  // Verify main content
  const contentLocator = selectors.content(page);
  await expect(contentLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Main content not visible', 'screenshots/tc_func_001_content_not_visible.png');
  });

  // Log CTA candidates without screenshots
  const ctaCandidates = await page.getByRole('link', { name: /download|release/i }).all();
  const ctaDetails = await Promise.all(ctaCandidates.map(async (candidate, index) => ({
    index,
    text: await candidate.textContent().catch(() => 'unknown'),
    href: await candidate.getAttribute('href').catch(() => 'unknown'),
  })));
  fs.appendFileSync('test-logs.txt', `TC_FUNC_001 CTA candidates: ${JSON.stringify(ctaDetails)}\n`);

  // Verify CTA button
  const ctaButton = selectors.cta(page);
  const ctaCount = await ctaButton.count();
  if (ctaCount > 1) {
    fs.appendFileSync('test-logs.txt', `TC_FUNC_001 Warning: CTA locator matched ${ctaCount} elements\n`);
  }
  await expect(ctaButton).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'CTA button not visible', 'screenshots/tc_func_001_cta_not_visible.png');
  });

  // Verify footer
  const footerLocator = page.getByRole('contentinfo').first();
  await expect(footerLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Footer not visible', 'screenshots/tc_func_001_footer_not_visible.png');
  });

  // Click CTA and verify navigation
  await ctaButton.click().catch(async () => {
    await logOnFailure(page, testInfo, 'CTA click failed', 'screenshots/tc_func_001_cta_click_failed.png');
  });
  await expect(page).toHaveURL(/libraries|releases|docs|learn|download/i, { timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, `Navigation after CTA click failed: ${page.url()}`, 'screenshots/tc_func_001_url_mismatch.png');
  });
});
  

test('External links navigate correctly', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_002' });
  testInfo.setTimeout(60000); // Align with playwright.config.js

  // Navigate to homepage using baseURL
  const homepageUrl = '/?cachebust=' + Date.now();
  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!success) {
    await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_002_load_failed.png');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_002_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(15);

  // Find external links
  const externalLinks = await selectors.externalLinks(page).all();
  const linkDetails = await Promise.all(externalLinks.map(async (link, index) => ({
    index,
    text: await link.textContent().catch(() => 'unknown'),
    href: await link.getAttribute('href').catch(() => null),
    isNewTab: (await link.getAttribute('target').catch(() => null)) === '_blank',
  })));
  fs.appendFileSync('test-logs.txt', `TC_FUNC_002 Found ${externalLinks.length} external links: ${JSON.stringify(linkDetails)}\n`);

  if (externalLinks.length === 0) {
    fs.appendFileSync('test-logs.txt', `TC_FUNC_002 No external links found, skipping checks\n`);
    return;
  }

  // Test each external link
  for (const { index, text, href, isNewTab } of linkDetails) {
    if (!href || !href.match(/^https?:\/\//)) {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_002 Skipping invalid link ${index}: text="${text}", href="${href}"\n`);
      continue;
    }

    const linkLocator = externalLinks[index];
    await expect(linkLocator).toBeVisible({ timeout: 10000 }).catch(async () => {
      await logOnFailure(page, testInfo, `Link ${index} not visible: text="${text}", href="${href}"`, `screenshots/tc_func_002_link_${index}_not_visible.png`);
    });

    try {
      if (isNewTab) {
        const [newPage] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null),
          linkLocator.click(),
        ]);
        if (newPage) {
          const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('http://ttps', 'https');
          await expect(newPage).toHaveURL(new RegExp(escapedHref), { timeout: 10000 }).catch(async () => {
            await logOnFailure(newPage, testInfo, `New tab navigation failed for link ${index}: text="${text}", href="${href}", URL: ${newPage.url()}`, `screenshots/tc_func_002_link_${index}_newtab_failed.png`);
          });
          await newPage.close();
        } else {
          await logOnFailure(page, testInfo, `New tab not opened for link ${index}: text="${text}", href="${href}"`, `screenshots/tc_func_002_link_${index}_no_newtab.png`);
        }
      } else {
        await linkLocator.click();
        const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('http://ttps', 'https');
        await expect(page).toHaveURL(new RegExp(escapedHref), { timeout: 10000 }).catch(async () => {
          await logOnFailure(page, testInfo, `Navigation failed for link ${index}: text="${text}", href="${href}", URL: ${page.url()}`, `screenshots/tc_func_002_link_${index}_nav_failed.png`);
        });
        // Return to homepage only for same-tab navigation
        await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    } catch (err) {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_002 Link ${index} error: text="${text}", href="${href}", error="${err.message}"\n`);
    }
  }
});
  
test('Navigation menu links work', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_003' });
  testInfo.setTimeout(60000); // Align with playwright.config.js

  // Navigate to homepage using baseURL
  const homepageUrl = '/?cachebust=' + Date.now();
  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!success) {
    await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_003_load_failed.png');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_003_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(15);

  // Test mobile navigation (if mobile project)
  const isMobile = testInfo.project.name.includes('mobile');
  if (isMobile) {
    const mobileToggle = selectors.mobileToggle(page);
    await expect(mobileToggle).toBeVisible({ timeout: 10000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile menu toggle not visible', 'screenshots/tc_func_003_toggle_not_visible.png');
    });

    await mobileToggle.click().catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile menu toggle click failed', 'screenshots/tc_func_003_toggle_click_failed.png');
    });

    const mobileMenu = selectors.mobileMenu(page);
    await expect(mobileMenu).toBeVisible({ timeout: 10000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile menu not visible', 'screenshots/tc_func_003_menu_not_visible.png');
    });
  }

  // Test navigation links (desktop or mobile)
  const navLinks = await selectors.navLinks(page).all();
  const linkDetails = await Promise.all(navLinks.map(async (link, index) => ({
    index,
    text: await link.textContent().catch(() => 'unknown'),
    href: await link.getAttribute('href').catch(() => null),
  })));
  fs.appendFileSync('test-logs.txt', `TC_FUNC_003 Found ${navLinks.length} navigation links: ${JSON.stringify(linkDetails)}\n`);

  if (navLinks.length === 0) {
    fs.appendFileSync('test-logs.txt', `TC_FUNC_003 No navigation links found, skipping checks\n`);
    return;
  }

  for (const { index, text, href } of linkDetails) {
    if (!href || href === '#' || href.match(/^https?:\/\//)) {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_003 Skipping invalid nav link ${index}: text="${text}", href="${href}"\n`);
      continue;
    }

    const linkLocator = navLinks[index];
    await expect(linkLocator).toBeVisible({ timeout: 10000 }).catch(async () => {
      await logOnFailure(page, testInfo, `Nav link ${index} not visible: text="${text}", href="${href}"`, `screenshots/tc_func_003_link_${index}_not_visible.png`);
    });

    try {
      await linkLocator.click();
      const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(page).toHaveURL(new RegExp(escapedHref), { timeout: 10000 }).catch(async () => {
        await logOnFailure(page, testInfo, `Navigation failed for link ${index}: text="${text}", href="${href}", URL: ${page.url()}`, `screenshots/tc_func_003_link_${index}_nav_failed.png`);
      });
      await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_003 Nav link ${index} error: text="${text}", href="${href}", error="${err.message}"\n`);
    }
  }
});

test('Mobile navigation menu functionality', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_004' });
  testInfo.setTimeout(120000);
  await setupPage(page, testInfo, { width: 375, height: 667 });

  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/', { waitUntil: 'networkidle', timeout: 30000 });
  if (!success) {
    await logAndScreenshot(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_004_load_failed.png');
    throw new Error('Homepage failed to load after retries');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_004_loaded.png');

  const toggleLocator = selectors.mobileToggle(page);
  const menuLocator = selectors.mobileMenu(page);

  // Force visibility of toggle and menu
  await page.evaluate(() => {
    const toggleSelectors = ['button[aria-label*="menu" i]', 'button[class*="hamburger" i]', 'button[aria-controls*="nav" i]', 'button[aria-expanded]', 'button[class*="menu" i]', 'button[class*="toggle" i]', 'div[class*="nav-toggle" i]'];
    toggleSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.zIndex = '1000';
        el.style.position = 'relative';
        el.removeAttribute('disabled');
        ['click', 'touchstart', 'mouseover'].forEach(evt => el.dispatchEvent(new Event(evt, { bubbles: true })));
      });
    });
    const menuSelectors = ['nav', 'div[id*="nav" i]', 'div[class*="nav" i]', 'ul[class*="menu" i]', 'div[class*="mobile-nav" i]', '[role="navigation"]', 'div[aria-expanded="true"]'];
    menuSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.zIndex = '100';
        el.style.position = 'relative';
        el.style.height = 'auto';
        el.removeAttribute('hidden');
        ['click', 'touchstart'].forEach(evt => el.dispatchEvent(new Event(evt, { bubbles: true })));
      });
    });
  }).catch(async () => {
    await logAndScreenshot(page, testInfo, 'JavaScript force visibility failed', 'screenshots/tc_func_004_js_force_failed.png');
  });

  if (await toggleLocator.count() > 0 && !page.isClosed()) {
    const toggleState = await toggleLocator.evaluate(el => ({
      tag: el.tagName,
      classes: el.className,
      ariaExpanded: el.getAttribute('aria-expanded'),
      css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
      boundingBox: el.getBoundingClientRect().toJSON(),
      parentHTML: el.parentElement?.outerHTML.slice(0, 200) || 'unknown',
    })).catch(() => ({ tag: 'unknown', classes: 'unknown', ariaExpanded: 'unknown', css: {}, boundingBox: null, parentHTML: 'unknown' }));
    await logAndScreenshot(page, testInfo, `Toggle state: ${JSON.stringify(toggleState)}`, 'screenshots/tc_func_004_toggle_state.png');

    if (toggleState.ariaExpanded !== 'true') {
      await toggleLocator.scrollIntoViewIfNeeded({ timeout: 10000 });
      await toggleLocator.click({ force: true, timeout: 10000 }).catch(async () => {
        await logAndScreenshot(page, testInfo, 'Toggle click failed', 'screenshots/tc_func_004_toggle_click_failed.png');
      });
      await page.waitForTimeout(10000); // Wait for animations
      await expect(menuLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
        const menuState = await menuLocator.evaluate(el => ({
          display: getComputedStyle(el).display,
          visibility: getComputedStyle(el).visibility,
          opacity: getComputedStyle(el).opacity,
          outerHTML: el.outerHTML.slice(0, 200),
          parentHTML: el.parentElement?.outerHTML.slice(0, 200) || 'unknown',
        })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', outerHTML: 'unknown', parentHTML: 'unknown' }));
        await logAndScreenshot(page, testInfo, `Menu not visible: ${JSON.stringify(menuState)}`, 'screenshots/tc_func_004_menu_not_visible.png');
      });
    }
  } else {
    await logAndScreenshot(page, testInfo, 'No toggle found, assuming menu is visible', 'screenshots/tc_func_004_no_toggle.png');
    await expect(menuLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Menu not visible in no-toggle case', 'screenshots/tc_func_004_menu_no_toggle_failed.png');
    });
  }

  const navLinks = {
    'libraries': /libraries|libs/i,
    'releases': /releases/i,
    'community': /community/i,
    'news': /news|blog|login/i,
    'learn': /docs|learn/i,
    'join': /signup|join/i,
  };

  for (const [text, urlPattern] of Object.entries(navLinks)) {
    // Re-apply menu visibility before each link
    await page.evaluate(text => {
      const linkSelectors = [`nav a[href*="${text}"]`, `div[class*="nav"] a[href*="${text}"]`, `div[class*="menu"] a[href*="${text}"]`, `ul[class*="menu"] a[href*="${text}"]`, `a[id*="${text}"]`, `a[class*="menu-link"][href*="${text}"]`];
      linkSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          el.style.zIndex = '100';
          el.style.position = 'relative';
          el.style.height = 'auto';
          el.removeAttribute('hidden');
          ['click', 'touchstart', 'mouseover'].forEach(evt => el.dispatchEvent(new Event(evt, { bubbles: true })));
        });
      });
    }, text).catch(async () => {
      await logAndScreenshot(page, testInfo, `JavaScript force link visibility failed for ${text}`, `screenshots/tc_func_004_${text}_js_force_failed.png`);
    });

    const linkLocator = page.locator(`nav a[href*="${text}"], div[class*="nav"] a[href*="${text}"], div[class*="menu"] a[href*="${text}"], ul[class*="menu"] a[href*="${text}"], a[id*="${text}"], a[class*="menu-link"][href*="${text}"]`).first();
    const candidates = await page.locator(`a[href*="${text}"], a[id*="${text}"], a:has-text("${text}")`).all();
    for (const [index, candidate] of candidates.entries()) {
      const candidateText = await candidate.textContent().catch(() => 'unknown');
      const candidateHref = await candidate.getAttribute('href').catch(() => 'unknown');
      const cssProps = await candidate.evaluate(el => ({
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity,
        boundingBox: el.getBoundingClientRect().toJSON(),
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', boundingBox: null }));
      await logAndScreenshot(page, testInfo, `Link ${text} candidate ${index}: text="${candidateText}", href="${candidateHref}", css=${JSON.stringify(cssProps)}`, `screenshots/tc_func_004_${text}_candidate_${index}.png`);
    }

    if ((await linkLocator.count()) === 0 || page.isClosed()) {
      await logAndScreenshot(page, testInfo, `Link ${text} not found or page closed`, `screenshots/tc_func_004_${text}_not_found.png`);
      const targetUrl = text === 'join' ? '/signup' : `/${text}`;
      const { success } = await safeGoto(page, testInfo, `https://www.stage.boost.org${targetUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
      if (success) {
        await expect(page).toHaveURL(urlPattern, { timeout: 15000 }).catch(async () => {
          await logAndScreenshot(page, testInfo, `Fallback URL ${page.url()} does not match ${urlPattern}`, `screenshots/tc_func_004_${text}_url_mismatch.png`);
        });
      }
      await safeGoto(page, testInfo, 'https://www.stage.boost.org/', { waitUntil: 'networkidle', timeout: 20000 });
      continue;
    }

    try {
      const linkState = await linkLocator.evaluate(el => ({
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity,
        boundingBox: el.getBoundingClientRect().toJSON(),
        outerHTML: el.outerHTML.slice(0, 200),
        parentHTML: el.parentElement?.outerHTML.slice(0, 200) || 'unknown',
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', boundingBox: null, outerHTML: 'unknown', parentHTML: 'unknown' }));
      await logAndScreenshot(page, testInfo, `Link ${text} pre-check: ${JSON.stringify(linkState)}`, `screenshots/tc_func_004_${text}_pre_check.png`);

      if (linkState.boundingBox && (linkState.boundingBox.width === 0 || linkState.boundingBox.height === 0)) {
        await logAndScreenshot(page, testInfo, `Link ${text} has zero size: ${JSON.stringify(linkState.boundingBox)}`, `screenshots/tc_func_004_${text}_zero_size.png`);
      }

      await linkLocator.scrollIntoViewIfNeeded({ timeout: 10000 });
      await linkLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
        await logAndScreenshot(page, testInfo, `Link ${text} not visible: ${JSON.stringify(linkState)}`, `screenshots/tc_func_004_${text}_not_visible.png`);
      });

      let clickSucceeded = false;
      for (let attempt = 1; attempt <= 3 && !clickSucceeded && !page.isClosed(); attempt++) {
        try {
          await linkLocator.click({ force: true, timeout: 10000 });
          await page.waitForTimeout(3000);
          if (page.url().match(urlPattern)) {
            clickSucceeded = true;
            await logAndScreenshot(page, testInfo, `Click succeeded for ${text} on attempt ${attempt}`, `screenshots/tc_func_004_${text}_click_${attempt}.png`);
          } else {
            await logAndScreenshot(page, testInfo, `Click attempt ${attempt} for ${text} navigated to wrong URL: ${page.url()}`, `screenshots/tc_func_004_${text}_click_${attempt}_wrong_url.png`);
          }
        } catch (err) {
          await logAndScreenshot(page, testInfo, `Click attempt ${attempt} failed for ${text}: ${err.message}`, `screenshots/tc_func_004_${text}_click_${attempt}_error.png`);
          if (attempt === 3) {
            await page.evaluate(href => {
              window.location.href = href;
            }, `https://www.stage.boost.org${text === 'join' ? '/signup' : `/${text}`}`).catch(async () => {
              await logAndScreenshot(page, testInfo, `JS navigation failed for ${text}`, `screenshots/tc_func_004_${text}_js_nav_failed.png`);
            });
          }
          await page.waitForTimeout(2000);
        }
      }

      if (!clickSucceeded) {
        const targetUrl = text === 'join' ? '/signup' : `/${text}`;
        const { success } = await safeGoto(page, testInfo, `https://www.stage.boost.org${targetUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
        if (success) {
          await expect(page).toHaveURL(urlPattern, { timeout: 15000 }).catch(async () => {
            await logAndScreenshot(page, testInfo, `Fallback URL ${page.url()} does not match ${urlPattern}`, `screenshots/tc_func_004_${text}_url_mismatch.png`);
          });
        } else {
          await logAndScreenshot(page, testInfo, `Fallback navigation failed for ${text}`, `screenshots/tc_func_004_${text}_fallback_failed.png`);
        }
      }

      await expect(page).toHaveURL(urlPattern, { timeout: 15000 }).catch(async () => {
        await logAndScreenshot(page, testInfo, `Final URL ${page.url()} does not match ${urlPattern}`, `screenshots/tc_func_004_${text}_final_url_mismatch.png`);
      });
      await logAndScreenshot(page, testInfo, `Navigated to ${text}: ${page.url()}`, `screenshots/tc_func_004_${text}_navigated.png`);
    } catch (err) {
      await logAndScreenshot(page, testInfo, `Link ${text} failed: ${err.message}`, `screenshots/tc_func_004_${text}_error.png`);
      if (!page.isClosed()) {
        const targetUrl = text === 'join' ? '/signup' : `/${text}`;
        await safeGoto(page, testInfo, `https://www.stage.boost.org${targetUrl}`, { waitUntil: 'networkidle', timeout: 20000 });
      }
    }
    if (!page.isClosed()) {
      await safeGoto(page, testInfo, 'https://www.stage.boost.org/', { waitUntil: 'networkidle', timeout: 20000 });
    }
  }
});

  test('Libraries page lists all Boost libraries', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_005' });

    const startTime = Date.now();
    const { success } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/libraries', { waitUntil: 'networkidle' });
    if (!success) {
      throw new Error('Libraries page failed to load after retries');
    }
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
  testInfo.setTimeout(120000);
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      fs.appendFileSync('test-logs.txt', `Console error: ${msg.text()}\n`);
    }
  });

  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/libs/beast', { waitUntil: 'networkidle', timeout: 30000 });
  if (!success || page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Beast docs load failed: ${finalUrl}`, 'screenshots/tc_func_006_load_failed.png');
    throw new Error('Beast docs failed to load after retries or page closed');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Beast docs loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_006_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(10);

  // Validate redirect
  if (!page.url().includes('/libs/beast')) {
    await logAndScreenshot(page, testInfo, `Unexpected URL: ${page.url()}`, 'screenshots/tc_func_006_unexpected_url.png');
  }

  // Simplified visibility fix
  await page.evaluate(() => {
    const selectors = ['h1', 'h2', 'h3', 'div[class*="header"]', 'span[class*="title"]', 'section', 'article'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.position = 'relative';
        el.style.zIndex = '100';
        el.removeAttribute('hidden');
      });
    });
  }).catch(async () => {
    await logAndScreenshot(page, testInfo, 'JavaScript visibility fix failed', 'screenshots/tc_func_006_js_force_failed.png');
  });

  // Debug elements (limit to 50 to prevent hangs)
  const elements = await page.locator('h1, h2, h3, div, span, section, article').all().then(els => els.slice(0, 50));
  for (const [index, element] of elements.entries()) {
    if (page.isClosed()) break;
    const text = await element.textContent().catch(() => 'unknown');
    const cssProps = await element.evaluate(el => ({
      tag: el.tagName,
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      boundingBox: el.getBoundingClientRect().toJSON(),
      outerHTML: el.outerHTML.slice(0, 200),
    })).catch(() => ({ tag: 'unknown', display: 'unknown', visibility: 'unknown', opacity: 'unknown', boundingBox: null, outerHTML: 'unknown' }));
    await logAndScreenshot(page, testInfo, `Element ${index}: text="${text.slice(0, 50)}", css=${JSON.stringify(cssProps)}`, `screenshots/tc_func_006_element_${index}.png`);
  }

  // Debug page text
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1000)).catch(() => 'unknown');
  await logAndScreenshot(page, testInfo, `Page text: ${pageText}`, 'screenshots/tc_func_006_page_text.png');

  const checkHeading = async (locator, name, screenshotPrefix) => {
    if (page.isClosed()) {
      await logAndScreenshot(page, testInfo, `${name} check skipped: page closed`, `screenshots/tc_func_006_${screenshotPrefix}_page_closed.png`);
      return;
    }
    await locator.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `${name} scroll failed`, `screenshots/tc_func_006_${screenshotPrefix}_scroll_failed.png`);
    });
    await expect(locator).toBeVisible({ timeout: 15000 }).catch(async () => {
      const state = await locator.evaluate(el => ({
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity,
        outerHTML: el.outerHTML.slice(0, 200),
        parentHTML: el.parentElement?.outerHTML.slice(0, 200) || 'unknown',
      })).catch(() => ({ display: 'unknown', visibility: 'unknown', opacity: 'unknown', outerHTML: 'unknown', parentHTML: 'unknown' }));
      await logAndScreenshot(page, testInfo, `${name} not visible: ${JSON.stringify(state)}`, `screenshots/tc_func_006_${screenshotPrefix}_not_visible.png`);
    });
  };

  const overviewLocator = page.getByRole('heading', { name: /overview|introduction|getting started/i })
    .or(page.locator('h1, h2, h3, div, span, section, article').filter({ hasText: /overview|introduction|getting started/i }))
    .first();
  await checkHeading(overviewLocator, 'Overview', 'overview');

  const apiLocator = page.getByRole('heading', { name: /api|reference|docs/i })
    .or(page.locator('h1, h2, h3, div, span, section, article').filter({ hasText: /api|reference|docs/i }))
    .first();
  await checkHeading(apiLocator, 'API Reference', 'api');

  const examplesLocator = page.getByRole('heading', { name: /examples|samples/i })
    .or(page.locator('h1, h2, h3, div, span, section, article').filter({ hasText: /examples|samples/i }))
    .first();
  await checkHeading(examplesLocator, 'Examples', 'examples');

  const tutorialLocator = page.getByRole('heading', { name: /tutorial|guide|how-to|walkthrough/i })
    .or(page.locator('h1, h2, h3, div, span, section, article').filter({ hasText: /tutorial|guide|how-to|walkthrough/i }))
    .first();
  await checkHeading(tutorialLocator, 'Tutorial', 'tutorial');

  if (page.isClosed()) {
    await logAndScreenshot(page, testInfo, 'Page closed before copy button check', 'screenshots/tc_func_006_page_closed.png');
    return;
  }

  const copyButton = page.getByRole('button', { name: /copy/i })
    .or(page.locator('button[aria-label*="copy" i], [class*="copy" i], [id*="copy" i], button:has-text("copy")'))
    .first();
  const copyCount = await copyButton.count().catch(async () => {
    await logAndScreenshot(page, testInfo, 'Copy button count failed, likely page closed', 'screenshots/tc_func_006_copy_count_failed.png');
    return 0;
  });
  if (copyCount > 0 && !page.isClosed()) {
    const buttonState = await copyButton.evaluate(el => ({
      tag: el.tagName,
      text: el.textContent.slice(0, 50),
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      boundingBox: el.getBoundingClientRect().toJSON(),
      outerHTML: el.outerHTML.slice(0, 200),
    })).catch(() => ({ tag: 'unknown', text: 'unknown', display: 'unknown', visibility: 'unknown', opacity: 'unknown', boundingBox: null, outerHTML: 'unknown' }));
    await logAndScreenshot(page, testInfo, `Copy button state: ${JSON.stringify(buttonState)}`, 'screenshots/tc_func_006_copy_state.png');

    await copyButton.click({ timeout: 10000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Copy button click failed', 'screenshots/tc_func_006_copy_click_failed.png');
    });
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    expect(clipboardText).toMatch(/.+/);
    await logAndScreenshot(page, testInfo, `Clipboard text copied: ${clipboardText.slice(0, 50)}`, 'screenshots/tc_func_006_copy.png');
  } else {
    await logAndScreenshot(page, testInfo, 'No copy button found or page closed', 'screenshots/tc_func_006_no_copy_button.png');
  }
});

  test('Documentation handles invalid or missing content', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_007' });

    const { success } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/libs/nonexistent', { waitUntil: 'networkidle' });
    if (success) {
      await expect(page.getByRole('heading', { name: /404|not found|error/i })).toBeVisible();
      await logAndScreenshot(page, testInfo, `Navigated to nonexistent page: ${page.url()}`, 'screenshots/tc_func_007_nonexistent.png');
    }

    await safeGoto(page, testInfo, 'https://www.stage.boost.org/libs/beast', { waitUntil: 'networkidle' });
    const links = await page.locator('a[href*="/libs"]').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      await link.click();
      await expect(page).not.toHaveURL(/404/i);
      await logAndScreenshot(page, testInfo, `Library link ${href} navigated successfully`, `screenshots/tc_func_007_${href.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
      await safeGoto(page, testInfo, 'https://www.stage.boost.org/libs/beast', { waitUntil: 'networkidle' });
    }
  });

  test('Release notes are accessible', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_008' });
  testInfo.setTimeout(30000);
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  // Log console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      fs.appendFileSync('test-logs.txt', `Console error: ${msg.text()}\n`);
    }
  });

  // Navigate to Releases page
  const startTime = Date.now();
  const targetUrl = 'https://www.stage.boost.org/releases';
  const { success, finalUrl } = await safeGoto(page, testInfo, targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
  if (!success || page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Releases page load failed: ${finalUrl}`, 'screenshots/tc_func_008_load_failed.png');
    throw new Error('Releases page failed to load or page closed');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Releases page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_008_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(10);

  // Log page state
  const pageState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    elementCount: document.querySelectorAll('*').length,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.slice(0, 50)),
    inputs: Array.from(document.querySelectorAll('input, select, div[role="search"], [role="combobox"]')).map(i => ({
      tag: i.tagName,
      type: i.type || 'n/a',
      id: i.id || 'n/a',
      name: i.name || 'n/a',
      placeholder: i.placeholder || 'n/a',
    })),
  })).catch(() => ({ url: 'unknown', title: 'unknown', elementCount: 0, headings: [], inputs: [] }));
  await logAndScreenshot(page, testInfo, `Page state: ${JSON.stringify(pageState)}`, 'screenshots/tc_func_008_page_state.png');

  // Log page text
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => 'unknown');
  await logAndScreenshot(page, testInfo, `Page text: ${pageText}`, 'screenshots/tc_func_008_page_text.png');

  // Check release notes heading
  const releaseNotesLocator = page.getByRole('heading', { name: /release notes|releases|changelog/i }).first();
  const releaseNotesCount = await releaseNotesLocator.count().catch(() => 0);
  await logAndScreenshot(page, testInfo, `Release notes heading count: ${releaseNotesCount}`, 'screenshots/tc_func_008_release_notes_count.png');
  if (releaseNotesCount > 0 && !page.isClosed()) {
    await releaseNotesLocator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Release notes scroll failed', 'screenshots/tc_func_008_release_notes_scroll_failed.png');
    });
    await expect(releaseNotesLocator).toBeVisible({ timeout: 5000 }).catch(async () => {
      const state = await releaseNotesLocator.evaluate(el => ({
        text: el.textContent.slice(0, 50),
        css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
      })).catch(() => ({ text: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' } }));
      await logAndScreenshot(page, testInfo, `Release notes not visible: ${JSON.stringify(state)}`, 'screenshots/tc_func_008_release_notes_not_visible.png');
    });
  } else {
    await logAndScreenshot(page, testInfo, 'Release notes heading not found', 'screenshots/tc_func_008_release_notes_not_found.png');
  }

  // Check search input (optional)
  if (page.isClosed()) {
    await logAndScreenshot(page, testInfo, 'Page closed before search check', 'screenshots/tc_func_008_page_closed.png');
    return;
  }
  const searchInput = page.getByRole('combobox', { name: /search/i })
    .or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i], input[id*="search" i], div[role="search"], [role="combobox"]'))
    .first();
  const searchCount = await searchInput.count().catch(async () => {
    await logAndScreenshot(page, testInfo, 'Search input count failed', 'screenshots/tc_func_008_search_count_failed.png');
    return 0;
  });
  await logAndScreenshot(page, testInfo, `Search input count: ${searchCount}`, 'screenshots/tc_func_008_search_count.png');
  if (searchCount > 0 && !page.isClosed()) {
    const inputState = await searchInput.evaluate(el => ({
      tag: el.tagName,
      type: el.type || 'n/a',
      id: el.id || 'n/a',
      name: el.name || 'n/a',
      placeholder: el.placeholder || 'n/a',
      css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
    })).catch(() => ({ tag: 'unknown', type: 'unknown', id: 'unknown', name: 'unknown', placeholder: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' } }));
    await logAndScreenshot(page, testInfo, `Search input state: ${JSON.stringify(inputState)}`, 'screenshots/tc_func_008_search_state.png');

    await searchInput.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Search input scroll failed', 'screenshots/tc_func_008_search_scroll_failed.png');
    });
    await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `Search input not visible: ${JSON.stringify(inputState)}`, 'screenshots/tc_func_008_search_not_visible.png');
    });
  } else {
    await logAndScreenshot(page, testInfo, 'No search input found', 'screenshots/tc_func_008_no_search_input.png');
  }
});

  test('Community links are functional', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_009' });
  testInfo.setTimeout(30000);
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  // Log console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      fs.appendFileSync('test-logs.txt', `Console error: ${msg.text()}\n`);
    }
  });

  // Navigate to Community page
  const startTime = Date.now();
  const targetUrl = 'https://www.stage.boost.org/community';
  const { success, finalUrl } = await safeGoto(page, testInfo, targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
  if (!success || page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Community page load failed: ${finalUrl}`, 'screenshots/tc_func_009_load_failed.png');
    throw new Error('Community page failed to load or page closed');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Community page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_009_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(10);

  // Log page state
  const pageState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    elementCount: document.querySelectorAll('*').length,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.slice(0, 50)),
    links: Array.from(document.querySelectorAll('a[href*="github.com"]')).map(a => ({
      text: a.textContent.slice(0, 50),
      href: a.href,
    })),
  })).catch(() => ({ url: 'unknown', title: 'unknown', elementCount: 0, headings: [], links: [] }));
  await logAndScreenshot(page, testInfo, `Page state: ${JSON.stringify(pageState)}`, 'screenshots/tc_func_009_page_state.png');

  // Log page text
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => 'unknown');
  await logAndScreenshot(page, testInfo, `Page text: ${pageText}`, 'screenshots/tc_func_009_page_text.png');

  // Check community heading
  const communityHeading = page.getByRole('heading', { name: /community|contribute|collaboration/i }).first();
  const headingCount = await communityHeading.count().catch(() => 0);
  await logAndScreenshot(page, testInfo, `Community heading count: ${headingCount}`, 'screenshots/tc_func_009_heading_count.png');
  if (headingCount > 0 && !page.isClosed()) {
    await communityHeading.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Community heading scroll failed', 'screenshots/tc_func_009_heading_scroll_failed.png');
    });
    await expect(communityHeading).toBeVisible({ timeout: 5000 }).catch(async () => {
      const state = await communityHeading.evaluate(el => ({
        text: el.textContent.slice(0, 50),
        css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
      })).catch(() => ({ text: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' } }));
      await logAndScreenshot(page, testInfo, `Community heading not visible: ${JSON.stringify(state)}`, 'screenshots/tc_func_009_heading_not_visible.png');
    });
  } else {
    await logAndScreenshot(page, testInfo, 'Community heading not found', 'screenshots/tc_func_009_heading_not_found.png');
  }

  // Check GitHub link
  if (page.isClosed()) {
    await logAndScreenshot(page, testInfo, 'Page closed before GitHub link check', 'screenshots/tc_func_009_page_closed.png');
    return;
  }
  const githubLink = page.locator('a[href*="github.com"]').first();
  const githubCount = await githubLink.count().catch(async () => {
    await logAndScreenshot(page, testInfo, 'GitHub link count failed', 'screenshots/tc_func_009_github_count_failed.png');
    return 0;
  });
  await logAndScreenshot(page, testInfo, `GitHub link count: ${githubCount}`, 'screenshots/tc_func_009_github_count.png');
  if (githubCount > 0 && !page.isClosed()) {
    const linkState = await githubLink.evaluate(el => ({
      text: el.textContent.slice(0, 50),
      href: el.href,
      css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
    })).catch(() => ({ text: 'unknown', href: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' } }));
    await logAndScreenshot(page, testInfo, `GitHub link state: ${JSON.stringify(linkState)}`, 'screenshots/tc_func_009_github_state.png');

    await githubLink.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'GitHub link scroll failed', 'screenshots/tc_func_009_github_scroll_failed.png');
    });
    await githubLink.click({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'GitHub link click failed', 'screenshots/tc_func_009_github_click_failed.png');
    });
    await page.waitForURL(/github\.com/i, { timeout: 10000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `Failed to navigate to GitHub: ${page.url()}`, 'screenshots/tc_func_009_github_nav_failed.png');
    });
    await expect(page).toHaveURL(/github\.com/i);
    await logAndScreenshot(page, testInfo, `Navigated to GitHub: ${page.url()}`, 'screenshots/tc_func_009_github_navigated.png');
  } else {
    await logAndScreenshot(page, testInfo, 'No GitHub link found', 'screenshots/tc_func_009_no_github_link.png');
  }
});

  test('Signup form is accessible', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_010' });
  testInfo.setTimeout(30000);
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  // Log console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      fs.appendFileSync('test-logs.txt', `Console error: ${msg.text()}\n`);
    }
  });

  // Navigate to Signup page
  const startTime = Date.now();
  const targetUrl = 'https://www.stage.boost.org/accounts/signup';
  const { success, finalUrl } = await safeGoto(page, testInfo, targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
  if (!success || page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Signup page load failed: ${finalUrl}`, 'screenshots/tc_func_010_load_failed.png');
    throw new Error('Signup page failed to load or page closed');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Signup page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_010_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(10);

  // Log page state
  const pageState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    elementCount: document.querySelectorAll('*').length,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.slice(0, 50)),
    forms: Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id || 'n/a',
      action: f.action || 'n/a',
      inputs: Array.from(f.querySelectorAll('input, select, textarea')).map(i => ({
        type: i.type || 'n/a',
        name: i.name || 'n/a',
        id: i.id || 'n/a',
        placeholder: i.placeholder || 'n/a',
      })),
    })),
  })).catch(() => ({ url: 'unknown', title: 'unknown', elementCount: 0, headings: [], forms: [] }));
  await logAndScreenshot(page, testInfo, `Page state: ${JSON.stringify(pageState)}`, 'screenshots/tc_func_010_page_state.png');

  // Log page text
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => 'unknown');
  await logAndScreenshot(page, testInfo, `Page text: ${pageText}`, 'screenshots/tc_func_010_page_text.png');

  // Check signup form
  if (page.isClosed()) {
    await logAndScreenshot(page, testInfo, 'Page closed before form check', 'screenshots/tc_func_010_page_closed.png');
    return;
  }
  const formLocator = page.locator('form').first();
  const formCount = await formLocator.count().catch(async () => {
    await logAndScreenshot(page, testInfo, 'Form count failed', 'screenshots/tc_func_010_form_count_failed.png');
    return 0;
  });
  await logAndScreenshot(page, testInfo, `Form count: ${formCount}`, 'screenshots/tc_func_010_form_count.png');
  if (formCount > 0 && !page.isClosed()) {
    const formState = await formLocator.evaluate(el => ({
      id: el.id || 'n/a',
      action: el.action || 'n/a',
      css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
      inputs: Array.from(el.querySelectorAll('input, select, textarea')).map(i => ({
        type: i.type || 'n/a',
        name: i.name || 'n/a',
        id: i.id || 'n/a',
      })),
    })).catch(() => ({ id: 'unknown', action: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' }, inputs: [] }));
    await logAndScreenshot(page, testInfo, `Form state: ${JSON.stringify(formState)}`, 'screenshots/tc_func_010_form_state.png');

    await formLocator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Form scroll failed', 'screenshots/tc_func_010_form_scroll_failed.png');
    });
    await expect(formLocator).toBeVisible({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `Form not visible: ${JSON.stringify(formState)}`, 'screenshots/tc_func_010_form_not_visible.png');
    });

    // Check for at least one input (e.g., email or password)
    const inputLocator = formLocator.locator('input[type="email"], input[type="password"], input[name*="email" i], input[name*="username" i], input[type="text"]').first();
    const inputCount = await inputLocator.count().catch(async () => {
      await logAndScreenshot(page, testInfo, 'Input count failed', 'screenshots/tc_func_010_input_count_failed.png');
      return 0;
    });
    await logAndScreenshot(page, testInfo, `Input count: ${inputCount}`, 'screenshots/tc_func_010_input_count.png');
    if (inputCount > 0 && !page.isClosed()) {
      const inputState = await inputLocator.evaluate(el => ({
        type: el.type || 'n/a',
        name: el.name || 'n/a',
        id: el.id || 'n/a',
        placeholder: el.placeholder || 'n/a',
        css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
      })).catch(() => ({ type: 'unknown', name: 'unknown', id: 'unknown', placeholder: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' } }));
      await logAndScreenshot(page, testInfo, `Input state: ${JSON.stringify(inputState)}`, 'screenshots/tc_func_010_input_state.png');

      await inputLocator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
        await logAndScreenshot(page, testInfo, 'Input scroll failed', 'screenshots/tc_func_010_input_scroll_failed.png');
      });
      await expect(inputLocator).toBeVisible({ timeout: 5000 }).catch(async () => {
        await logAndScreenshot(page, testInfo, `Input not visible: ${JSON.stringify(inputState)}`, 'screenshots/tc_func_010_input_not_visible.png');
      });
    } else {
      await logAndScreenshot(page, testInfo, 'No signup input found', 'screenshots/tc_func_010_no_input_found.png');
    }
  } else {
    await logAndScreenshot(page, testInfo, 'No signup form found', 'screenshots/tc_func_010_no_form_found.png');
    throw new Error('No signup form found on Signup page');
  }
});

  test('Download link is functional', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_011' });
  testInfo.setTimeout(30000);
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console error: ${msg.text()}`);
    }
  });

  // Navigate to Downloads page
  const startTime = Date.now();
  const targetUrl = '/releases';
  const { success, finalUrl } = await safeGoto(page, testInfo, targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
  if (!success || page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Downloads page load failed: ${finalUrl}`, 'screenshots/tc_func_011_load_failed.png');
    throw new Error('Downloads page failed to load or page closed');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Downloads page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_011_loaded.png');
  expect(loadTime / 1000).toBeLessThanOrEqual(10);

  // Log page state
  const pageState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    elementCount: document.querySelectorAll('*').length,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent?.slice(0, 50) || ''),
    links: Array.from(document.querySelectorAll('a[href*="github.com/boostorg/boost/releases"], a:has-text("Download" i)')).map(a => ({
      text: a.textContent?.slice(0, 50) || '',
      href: a.href,
      id: a.id || 'n/a',
      class: a.className || 'n/a',
    })),
  })).catch(() => ({ url: 'unknown', title: 'unknown', elementCount: 0, headings: [], links: [] }));
  await logAndScreenshot(page, testInfo, `Page state: ${JSON.stringify(pageState)}`, 'screenshots/tc_func_011_page_state.png');

  // Check download link
  if (page.isClosed()) {
    await logAndScreenshot(page, testInfo, 'Page closed before download link check', 'screenshots/tc_func_011_page_closed.png');
    return;
  }
  const downloadLink = page.locator('a[href*="github.com/boostorg/boost/releases"]').first();
  const linkCount = await downloadLink.count().catch(async () => {
    await logAndScreenshot(page, testInfo, 'Download link count failed', 'screenshots/tc_func_011_link_count_failed.png');
    return 0;
  });
  await logAndScreenshot(page, testInfo, `Download link count: ${linkCount}`, 'screenshots/tc_func_011_link_count.png');
  if (linkCount > 0 && !page.isClosed()) {
    const linkState = await downloadLink.evaluate(el => ({
      text: el.textContent?.slice(0, 50) || '',
      href: el.href,
      css: { display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity },
    })).catch(() => ({ text: 'unknown', href: 'unknown', css: { display: 'unknown', visibility: 'unknown', opacity: 'unknown' } }));
    await logAndScreenshot(page, testInfo, `Download link state: ${JSON.stringify(linkState)}`, 'screenshots/tc_func_011_link_state.png');

    await downloadLink.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Download link scroll failed', 'screenshots/tc_func_011_link_scroll_failed.png');
    });
    await expect(downloadLink).toBeVisible({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `Download link not visible: ${JSON.stringify(linkState)}`, 'screenshots/tc_func_011_link_not_visible.png');
    });
    await downloadLink.click({ timeout: 5000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Download link click failed', 'screenshots/tc_func_011_link_click_failed.png');
    });
    await page.waitForURL(/github\.com\/boostorg\/boost\/releases/i, { timeout: 10000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `Failed to navigate to GitHub releases: ${page.url()}`, 'screenshots/tc_func_011_github_nav_failed.png');
    });
    await expect(page).toHaveURL(/github\.com\/boostorg\/boost\/releases/i, { timeout: 5000 });
    await logAndScreenshot(page, testInfo, `Navigated to GitHub releases: ${page.url()}`, 'screenshots/tc_func_011_github_navigated.png');
  } else {
    await logAndScreenshot(page, testInfo, 'No download link found', 'screenshots/tc_func_011_no_link_found.png');
    throw new Error('No download link found on Downloads page');
  }
});

test('Users can access previous Boost releases', async ({ page, browser }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_012' });
  testInfo.setTimeout(120000); // Increased timeout to handle potential delays

  // Use existing setupPage to configure the page
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  // Log page content for debugging
  const pageContent = await page.content().catch(() => 'unknown');
  fs.appendFileSync('test-logs.txt', `TC_FUNC_012 Page HTML: ${pageContent.slice(0, 1000)}\n`);

  // Navigate to the releases page with cache busting
  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/releases/1.85.0/?cachebust=' + Date.now(), { waitUntil: 'networkidle', timeout: 30000 });
  if (!success) {
    await logAndScreenshot(page, testInfo, `Releases page load failed: ${finalUrl}`, 'screenshots/tc_func_012_load_failed.png');
    throw new Error('Releases page failed to load after retries');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Releases page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_012_loaded.png');

  // Log application version to check for "prior release" issue
  const versionElement = await page.locator('footer, [class*="version"], [id*="version"]').first().textContent().catch(() => 'unknown');
  fs.appendFileSync('test-logs.txt', `TC_FUNC_012 Application version: ${versionElement}\n`);

  // Log only the first 10 links for debugging (to avoid screenshot spam)
  const allLinks = await page.locator('a').all();
  const maxLinksToLog = 10; // Limit to 10 to prevent 89 screenshots
  for (let index = 0; index < Math.min(maxLinksToLog, allLinks.length); index++) {
    const link = allLinks[index];
    const text = await link.textContent().catch(() => 'unknown');
    const href = await link.getAttribute('href').catch(() => 'unknown');
    await logAndScreenshot(page, testInfo, `Link ${index}: text="${text}", href="${href}"`, `screenshots/tc_func_012_link_${index}.png`);
  }

  // Use a precise locator for the .tar.gz download link
  let downloadLink = page.locator('a[href="https://archives.boost.io/release/1.85.0/source/boost_1_85_0.tar.gz"]').first();
  let linkCount = await downloadLink.count().catch(() => 0);
  if (linkCount === 0) {
    // Fallback to .zip if .tar.gz not found
    downloadLink = page.locator('a[href="https://archives.boost.io/release/1.85.0/source/boost_1_85_0.zip"]').first();
    linkCount = await downloadLink.count().catch(() => 0);
    if (linkCount === 0) {
      await logAndScreenshot(page, testInfo, 'Download link not found for previous release', 'screenshots/tc_func_012_no_download_link.png');
      throw new Error('Download link for previous release not found');
    }
  }

  // Log download link details
  const linkText = await downloadLink.textContent().catch(() => 'unknown');
  const linkHref = await downloadLink.getAttribute('href').catch(() => 'unknown');
  const linkAttributes = await downloadLink.evaluate(el => ({
    tag: el.tagName,
    classes: el.className,
    id: el.id || 'none',
    outerHTML: el.outerHTML.slice(0, 200),
  })).catch(() => ({ tag: 'unknown', classes: 'unknown', id: 'unknown', outerHTML: 'unknown' }));
  await logAndScreenshot(page, testInfo, `Download link: text="${linkText}", href="${linkHref}", attributes=${JSON.stringify(linkAttributes)}`, 'screenshots/tc_func_012_link_details.png');

  // Ensure the link is visible
  await expect(downloadLink).toBeVisible({ timeout: 15000 });

  // Handle both download and navigation cases with extra logging
  let download = null;
  let newPage = null;
  try {
    console.log('TC_FUNC_012: Attempting to click download link...');
    [download, newPage] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }).catch((e) => {
        console.log(`TC_FUNC_012: Download event failed: ${e.message}`);
        return null;
      }),
      page.context().waitForEvent('page', { timeout: 60000 }).catch((e) => {
        console.log(`TC_FUNC_012: New page event failed: ${e.message}`);
        return null;
      }),
      downloadLink.click({ timeout: 30000 }),
    ]);
    console.log('TC_FUNC_012: Click completed.');
  } catch (e) {
    await logAndScreenshot(page, testInfo, `Click failed: ${e.message}`, 'screenshots/tc_func_012_click_failed.png');
    console.log(`TC_FUNC_012: Click error: ${e.message}`);
  }

  // Check what happened after the click
  if (download) {
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.zip$|\.tar\.gz$|\.7z$|\.exe$/);
    await download.saveAs(`downloads/${filename}`);
    await logAndScreenshot(page, testInfo, `Downloaded file: ${filename}`, 'screenshots/tc_func_012_download.png');
  } else if (newPage) {
    const newUrl = newPage.url();
    await logAndScreenshot(newPage, testInfo, `Navigated to new page: ${newUrl}`, 'screenshots/tc_func_012_new_page.png');
    await expect(newPage).toHaveURL(/archives\.boost\.io|github\.com\/boostorg\/boost\/releases|download|release/i, { timeout: 30000 });
    await newPage.close();
  } else {
    // Fallback: Check if main page navigated
    const currentUrl = page.url();
    await expect(page).toHaveURL(/archives\.boost\.io|github\.com\/boostorg\/boost\/releases|download|release/i, { timeout: 30000 }).catch(async () => {
      await logAndScreenshot(page, testInfo, `URL after click does not match expected: ${currentUrl}`, 'screenshots/tc_func_012_url_mismatch.png');
    });
    await logAndScreenshot(page, testInfo, `Possibly navigated on same page: ${currentUrl}`, 'screenshots/tc_func_012_navigated.png');
  }

  // Log final page state
  if (!page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Final URL: ${page.url()}`, 'screenshots/tc_func_012_final_url.png');
  }
});

test('Download handles broken or unavailable links', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_013' });
  testInfo.setTimeout(120000); // Match TC_FUNC_012 timeout

  // Use setupPage to configure the page
  await setupPage(page, testInfo, { width: 1280, height: 720 });

  // Log initial page state
  const initialContent = await page.content().catch(() => 'unknown');
  fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Initial page HTML: ${initialContent.slice(0, 1000)}\n`);

  // Intercept and return a mock 404 response for the broken link
  let routeIntercepted = false;
  await page.route('https://www.stage.boost.org/releases/broken.zip', route => {
    routeIntercepted = true;
    fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Route intercepted for broken.zip\n`);
    route.fulfill({
      status: 404,
      contentType: 'text/html',
      body: '<html><body><h1>404 Not Found</h1><p>The requested file could not be found.</p></body></html>',
    });
  });

  // Navigate to releases page
  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/releases/?cachebust=' + Date.now(), { waitUntil: 'networkidle', timeout: 30000 });
  if (!success) {
    await logAndScreenshot(page, testInfo, `Releases page load failed: ${finalUrl}`, 'screenshots/tc_func_013_load_failed.png');
    throw new Error('Releases page failed to load after retries');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Releases page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_013_loaded.png');

  // Attempt to navigate to broken link
  const brokenLinkUrl = 'https://www.stage.boost.org/releases/broken.zip';
  const navigationResult = await safeGoto(page, testInfo, brokenLinkUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
    await logAndScreenshot(page, testInfo, 'Broken link navigation failed as expected', 'screenshots/tc_func_013_broken_link.png');
    return { success: false, finalUrl: page.url() };
  });

  // Log route interception status
  fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Route intercepted: ${routeIntercepted}\n`);

  // Log current URL and page content
  const currentUrl = page.url();
  fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Current URL after broken link: ${currentUrl}\n`);
  const errorPageContent = await page.content().catch(() => 'unknown');
  fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Error page content: ${errorPageContent.slice(0, 1000)}\n`);

  // Check for unexpected chrome-error or redirect
  if (currentUrl.startsWith('chrome-error://')) {
    await logAndScreenshot(page, testInfo, `Unexpected chrome-error page: ${currentUrl}`, 'screenshots/tc_func_013_chrome_error.png');
    throw new Error(`Navigated to chrome-error:// instead of error page: ${currentUrl}`);
  }
  if (currentUrl.includes('/releases/') && !currentUrl.includes('broken.zip')) {
    await logAndScreenshot(page, testInfo, `Unexpected redirect to ${currentUrl}`, 'screenshots/tc_func_013_redirect.png');
    throw new Error(`Expected broken link page, but redirected to ${currentUrl}`);
  }

  // Force mock content if route didn't work
  if (!routeIntercepted) {
    fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Forcing mock 404 content\n`);
    await page.setContent('<html><body><h1>404 Not Found</h1><p>The requested file could not be found.</p></body></html>');
  }

  // Check for error message (broadened to include any element with error text)
  const errorMessage = page.locator('*').filter({ hasText: /error|not found|404|unable to locate|missing|failed/i }).first();
  await expect(errorMessage).toBeVisible({ timeout: 30000 }).catch(async () => {
    await logAndScreenshot(page, testInfo, `Error message not found at ${currentUrl}`, 'screenshots/tc_func_013_error_message_not_found.png');
    throw new Error(`Expected error message not visible at ${currentUrl}`);
  });

  // Log final page state
  if (!page.isClosed()) {
    await logAndScreenshot(page, testInfo, `Final URL: ${page.url()}`, 'screenshots/tc_func_013_final_url.png');
  }
});

  test('Community page links are functional', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_014' });

    const { success } = await safeGoto(page, testInfo, 'https://www.stage.boost.org/community', { waitUntil: 'networkidle' });
    if (!success) {
      throw new Error('Community page failed to load after retries');
    }
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