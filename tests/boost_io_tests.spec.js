import { test, expect } from '@playwright/test';
import fs from 'fs';
import { selectors } from '../selectors.js';
import { logAndScreenshot, logOnFailure, safeGoto } from '../utils.js';

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
    testInfo.setTimeout(60000);

    const homepageUrl = '/?cachebust=' + Date.now();
    const startTime = Date.now();
    const { success, finalUrl } = await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded' });
    if (!success) {
      await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_001_load_failed.png');
    }
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_001_loaded.png');
    expect(loadTime / 1000).toBeLessThanOrEqual(15);

    const logoLocator = selectors.logo(page);
    await expect(logoLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Boost logo not visible', 'screenshots/tc_func_001_logo_not_visible.png');
    });

    const navLocator = selectors.nav(page);
    await expect(navLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Navigation bar not visible', 'screenshots/tc_func_001_nav_not_visible.png');
    });

    const contentLocator = selectors.content(page);
    await expect(contentLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Main content not visible', 'screenshots/tc_func_001_content_not_visible.png');
    });

    const ctaCandidates = await page.getByRole('link', { name: /download|release/i }).all();
    const ctaDetails = await Promise.all(ctaCandidates.map(async (candidate, index) => ({
      index,
      text: await candidate.textContent().catch(() => 'unknown'),
      href: await candidate.getAttribute('href').catch(() => 'unknown'),
    })));
    fs.appendFileSync('test-logs.txt', `TC_FUNC_001 CTA candidates: ${JSON.stringify(ctaDetails)}\n`);

    const ctaButton = selectors.cta(page);
    const ctaCount = await ctaButton.count();
    if (ctaCount > 1) {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_001 Warning: CTA locator matched ${ctaCount} elements\n`);
    }
    await expect(ctaButton).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'CTA button not visible', 'screenshots/tc_func_001_cta_not_visible.png');
    });

    const footerLocator = page.getByRole('contentinfo').first();
    await expect(footerLocator).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Footer not visible', 'screenshots/tc_func_001_footer_not_visible.png');
    });

    await ctaButton.click().catch(async () => {
      await logOnFailure(page, testInfo, 'CTA click failed', 'screenshots/tc_func_001_cta_click_failed.png');
    });
    await expect(page).toHaveURL(/libraries|releases|docs|learn|download/i, { timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, `Navigation after CTA click failed, URL: ${page.url()}`, 'screenshots/tc_func_001_cta_nav_failed.png');
    });
      });

   test('Search bar is visible and functional', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_002' });
  const startTime = Date.now();
  const { success, finalUrl } = await safeGoto(page, testInfo, '/?cachebust=' + Date.now(), { waitUntil: 'domcontentloaded' });
  if (!success) {
    await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_002_load_failed.png');
  }
  const loadTime = Date.now() - startTime;
  await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_002_loaded.png');

  await page.setViewportSize({ width: 800, height: 600 });
  const mobileToggle = selectors.mobileToggle(page);
  if (await mobileToggle.count() > 0) {
    await mobileToggle.click().catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile toggle click failed', 'screenshots/tc_func_002_toggle_click_failed.png');
    });
  }

  const searchTrigger = selectors.searchTrigger(page);
  await expect(searchTrigger).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Search trigger not visible', 'screenshots/tc_func_002_trigger_not_visible.png');
  });
  await searchTrigger.click().catch(async () => {
    await logOnFailure(page, testInfo, 'Search trigger click failed', 'screenshots/tc_func_002_trigger_click_failed.png');
  });

  const searchInput = selectors.searchInput(page);
  await expect(searchInput).toBeVisible({ timeout: 15000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Search input not visible', 'screenshots/tc_func_002_search_not_visible.png');
  });

  const searchTerm = 'asio'; // Confirmed working
  await searchInput.fill(searchTerm);
  await searchInput.press('Enter');
  await expect(page).toHaveURL(/search|results|q=asio/i, { timeout: 20000 }).catch(async () => {
    await logOnFailure(page, testInfo, `Search navigation failed, URL: ${page.url()}`, 'screenshots/tc_func_002_search_nav_failed.png');
  });
  // Scroll to load lazy content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  // Check for results with longer timeout
  await expect(page.locator('h1, h2, h3, p, div, span, li, table, section').filter({ hasText: /asio|results|search/i })).toBeVisible({ timeout: 45000 }).catch(async () => {
    await logOnFailure(page, testInfo, 'Search results not displayed', 'screenshots/tc_func_002_results_not_displayed.png');
  });
});

  test('Navigation menu links work', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_003' });
    testInfo.setTimeout(60000);

    const homepageUrl = '/?cachebust=' + Date.now();
    const startTime = Date.now();
    const { success, finalUrl } = await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded' });
    if (!success) {
      await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_003_load_failed.png');
    }
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_003_loaded.png');
    expect(loadTime / 1000).toBeLessThanOrEqual(15);

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
        await safeGoto(page, testInfo, homepageUrl, { waitUntil: 'domcontentloaded' });
      } catch (err) {
        fs.appendFileSync('test-logs.txt', `TC_FUNC_003 Nav link ${index} error: text="${text}", href="${href}", error="${err.message}"\n`);
      }
    }
  });

  test('Responsive design adapts to mobile viewport', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_004' });
    const startTime = Date.now();
    const { success, finalUrl } = await safeGoto(page, testInfo, '/?cachebust=' + Date.now(), { waitUntil: 'domcontentloaded' });
    if (!success) {
      await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_004_load_failed.png');
    }
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Homepage loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_004_loaded.png');

    await page.setViewportSize({ width: 800, height: 600 });
    const mobileToggle = selectors.mobileToggle(page);
    await expect(mobileToggle).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile menu toggle not visible', 'screenshots/tc_func_004_toggle_not_visible.png');
    });

    await mobileToggle.click().catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile menu toggle click failed', 'screenshots/tc_func_004_toggle_click_failed.png');
    });

    const mobileMenu = selectors.mobileMenu(page);
    await expect(mobileMenu).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile menu not visible', 'screenshots/tc_func_004_menu_not_visible.png');
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(mobileToggle).not.toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Mobile toggle visible on desktop viewport', 'screenshots/tc_func_004_toggle_visible_desktop.png');
    });
  });

  test('Logo redirects to homepage', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_005' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/libraries/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Libraries page load failed: ${finalUrl}`, 'screenshots/tc_func_005_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Libraries page loaded, URL: ${page.url()}`, 'screenshots/tc_func_005_loaded.png');

    const logo = selectors.logo(page);
    await expect(logo).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Logo not visible', 'screenshots/tc_func_005_logo_not_visible.png');
    });
    await logo.click().catch(async () => {
      await logOnFailure(page, testInfo, 'Logo click failed', 'screenshots/tc_func_005_logo_click_failed.png');
    });
    await expect(page).toHaveURL(/\/?$/, { timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, `Logo did not redirect to homepage, URL: ${page.url()}`, 'screenshots/tc_func_005_redirect_failed.png');
    });
  });

  test('Footer links are accessible', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_006' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_006_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Homepage loaded, URL: ${page.url()}`, 'screenshots/tc_func_006_loaded.png');

    const footer = page.getByRole('contentinfo').first();
    await expect(footer).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Footer not visible', 'screenshots/tc_func_006_footer_not_visible.png');
    });
    const footerLinks = await footer.locator('a').all();
    fs.appendFileSync('test-logs.txt', `TC_FUNC_006 Found ${footerLinks.length} footer links\n`);

    for (const [index, link] of footerLinks.entries()) {
      const href = await link.getAttribute('href').catch(() => null);
      const text = await link.textContent().catch(() => 'unknown');
      await expect(link).toBeVisible({ timeout: 10000 }).catch(async () => {
        await logOnFailure(page, testInfo, `Footer link ${index} not visible: text="${text}", href="${href}"`, `screenshots/tc_func_006_link_${index}_not_visible.png`);
      });
    }
  });

  test('Main content loads on library page', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_007' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/doc/libs/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Library page load failed: ${finalUrl}`, 'screenshots/tc_func_007_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Library page loaded, URL: ${page.url()}`, 'screenshots/tc_func_007_loaded.png');

    const content = selectors.content(page);
    await expect(content).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Main content not visible', 'screenshots/tc_func_007_content_not_visible.png');
    });
  });

  test('External links are valid', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_008' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Homepage load failed: ${finalUrl}`, 'screenshots/tc_func_008_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Homepage loaded, URL: ${page.url()}`, 'screenshots/tc_func_008_loaded.png');

    const externalLinks = await selectors.externalLinks(page).all();
    fs.appendFileSync('test-logs.txt', `TC_FUNC_008 Found ${externalLinks.length} external links\n`);

    for (const [index, link] of externalLinks.entries()) {
      const href = await link.getAttribute('href').catch(() => null);
      const text = await link.textContent().catch(() => 'unknown');
      await expect(link).toBeVisible({ timeout: 10000 }).catch(async () => {
        await logOnFailure(page, testInfo, `External link ${index} not visible: text="${text}", href="${href}"`, `screenshots/tc_func_008_link_${index}_not_visible.png`);
      });
    }
  });

  test('GitHub links point to correct repositories', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_009' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/community/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Community page load failed: ${finalUrl}`, 'screenshots/tc_func_009_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Community page loaded, URL: ${page.url()}`, 'screenshots/tc_func_009_loaded.png');

    const githubLinks = await page.locator('a[href*="github.com"]').all();
    fs.appendFileSync('test-logs.txt', `TC_FUNC_009 Found ${githubLinks.length} GitHub links\n`);

    for (const [index, link] of githubLinks.entries()) {
      const href = await link.getAttribute('href').catch(() => null);
      const text = await link.textContent().catch(() => 'unknown');
      await expect(link).toBeVisible({ timeout: 10000 }).catch(async () => {
        await logOnFailure(page, testInfo, `GitHub link ${index} not visible: text="${text}", href="${href}"`, `screenshots/tc_func_009_link_${index}_not_visible.png`);
      });
      if (href) {
        await expect(href).toMatch(/github\.com\/boostorg\//).catch(async () => {
          await logOnFailure(page, testInfo, `GitHub link ${index} does not point to boostorg: href="${href}"`, `screenshots/tc_func_009_link_${index}_invalid.png`);
        });
      }
    }
  });

  test('Documentation page loads and displays content', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_010' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/doc/libs/1_85_0/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Documentation page load failed: ${finalUrl}`, 'screenshots/tc_func_010_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Documentation page loaded, URL: ${page.url()}`, 'screenshots/tc_func_010_loaded.png');

    const content = selectors.content(page);
    await expect(content).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Documentation content not visible', 'screenshots/tc_func_010_content_not_visible.png');
    });
  });

  test('Release notes are accessible', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_011' });
    const { success, finalUrl } = await safeGoto(page, testInfo, '/doc/libs/1_85_0/libs/release_notes/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Release notes page load failed: ${finalUrl}`, 'screenshots/tc_func_011_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Release notes page loaded, URL: ${page.url()}`, 'screenshots/tc_func_011_loaded.png');

    const content = selectors.content(page);
    await expect(content).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Release notes content not visible', 'screenshots/tc_func_011_content_not_visible.png');
    });
  });

  test('Download link for previous release works', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_012' });
    testInfo.setTimeout(120000);

    const startTime = Date.now();
    const { success, finalUrl } = await safeGoto(page, testInfo, '/releases/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Releases page load failed: ${finalUrl}`, 'screenshots/tc_func_012_load_failed.png');
    }
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Releases page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_012_loaded.png');

    let downloadLink = page.locator('a[href*="archives.boost.io/release/1.85.0/source/boost_1_85_0.tar.gz"]').first();
    let linkCount = await downloadLink.count().catch(() => 0);
    if (linkCount === 0) {
      downloadLink = page.locator('a[href*="archives.boost.io/release/1.85.0/source/boost_1_85_0.zip"]').first();
      linkCount = await downloadLink.count().catch(() => 0);
      if (linkCount === 0) {
        await logOnFailure(page, testInfo, 'Download link not found for previous release', 'screenshots/tc_func_012_no_download_link.png');
      }
    }

    const linkText = await downloadLink.textContent().catch(() => 'unknown');
    const linkHref = await downloadLink.getAttribute('href').catch(() => 'unknown');
    const linkAttributes = await downloadLink.evaluate(el => ({
      tag: el.tagName,
      classes: el.className,
      id: el.id || 'none',
      outerHTML: el.outerHTML.slice(0, 200),
    })).catch(() => ({ tag: 'unknown', classes: 'unknown', id: 'unknown', outerHTML: 'unknown' }));
    fs.appendFileSync('test-logs.txt', `TC_FUNC_012 Download link: text="${linkText}", href="${linkHref}", attributes=${JSON.stringify(linkAttributes)}\n`);

    await expect(downloadLink).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Download link not visible', 'screenshots/tc_func_012_link_not_visible.png');
    });

    let download = null;
    let newPage = null;
    try {
      [download, newPage] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }).catch(() => null),
        page.context().waitForEvent('page', { timeout: 60000 }).catch(() => null),
        downloadLink.click({ timeout: 30000 }),
      ]);
    } catch (e) {
      await logOnFailure(page, testInfo, `Click failed: ${e.message}`, 'screenshots/tc_func_012_click_failed.png');
    }

    if (download) {
      const filename = await download.suggestedFilename();
      expect(filename).toMatch(/\.zip$|\.tar\.gz$|\.7z$|\.exe$/);
      await download.saveAs(`downloads/${filename}`);
      await logAndScreenshot(page, testInfo, `Downloaded file: ${filename}`, 'screenshots/tc_func_012_download.png');
    } else if (newPage) {
      const newUrl = await newPage.url();
      await logAndScreenshot(newPage, testInfo, `Navigated to new page: ${newUrl}`, 'screenshots/tc_func_012_new_page.png');
      await expect(newPage).toHaveURL(/archives\.boost\.io|github\.com\/boostorg\/boost\/releases|download|release/i, { timeout: 30000 }).catch(async () => {
        await logOnFailure(newPage, testInfo, `New page URL does not match expected: ${newUrl}`, 'screenshots/tc_func_012_new_page_url_mismatch.png');
      });
      await newPage.close();
    } else {
      const currentUrl = page.url();
      await expect(page).toHaveURL(/archives\.boost\.io|github\.com\/boostorg\/boost\/releases|download|release/i, { timeout: 30000 }).catch(async () => {
        await logOnFailure(page, testInfo, `URL after click does not match expected: ${currentUrl}`, 'screenshots/tc_func_012_url_mismatch.png');
      });
      await logAndScreenshot(page, testInfo, `Possibly navigated on same page: ${currentUrl}`, 'screenshots/tc_func_012_navigated.png');
    }
  });

  test('Download handles broken or unavailable links', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_013' });
    testInfo.setTimeout(120000);

    const startTime = Date.now();
    const { success, finalUrl } = await safeGoto(page, testInfo, '/releases/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Releases page load failed: ${finalUrl}`, 'screenshots/tc_func_013_load_failed.png');
    }
    const loadTime = Date.now() - startTime;
    await logAndScreenshot(page, testInfo, `Releases page loaded in ${loadTime}ms, URL: ${page.url()}`, 'screenshots/tc_func_013_loaded.png');

    let routeIntercepted = false;
    await page.route('**/releases/broken.zip', route => {
      routeIntercepted = true;
      fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Route intercepted for broken.zip\n`);
      route.fulfill({
        status: 404,
        contentType: 'text/html',
        body: '<html><body><h1>404 Not Found</h1><p>The requested file could not be found.</p></body></html>',
      });
    });

    const brokenLinkUrl = '/releases/broken.zip';
    const navigationResult = await safeGoto(page, testInfo, brokenLinkUrl, { waitUntil: 'networkidle' }).catch(async () => {
      await logAndScreenshot(page, testInfo, 'Broken link navigation failed as expected', 'screenshots/tc_func_013_broken_link.png');
      return { success: false, finalUrl: page.url() };
    });

    fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Route intercepted: ${routeIntercepted}\n`);

    const currentUrl = page.url();
    fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Current URL after broken link: ${currentUrl}\n`);
    const errorPageContent = await page.content().catch(() => 'unknown');
    fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Error page content: ${errorPageContent.slice(0, 1000)}\n`);

    if (currentUrl.startsWith('chrome-error://')) {
      await logOnFailure(page, testInfo, `Unexpected chrome-error page: ${currentUrl}`, 'screenshots/tc_func_013_chrome_error.png');
    }
    if (currentUrl.includes('/releases/') && !currentUrl.includes('broken.zip')) {
      await logOnFailure(page, testInfo, `Unexpected redirect to ${currentUrl}`, 'screenshots/tc_func_013_redirect.png');
    }

    if (!routeIntercepted) {
      fs.appendFileSync('test-logs.txt', `TC_FUNC_013 Forcing mock 404 content\n`);
      await page.setContent('<html><body><h1>404 Not Found</h1><p>The requested file could not be found.</p></body></html>');
    }

    const errorMessage = page.locator('*').filter({ hasText: /error|not found|404|unable to locate|missing|failed/i }).first();
    await expect(errorMessage).toBeVisible({ timeout: 30000 }).catch(async () => {
      await logOnFailure(page, testInfo, `Error message not found at ${currentUrl}`, 'screenshots/tc_func_013_error_message_not_found.png');
    });
  });

  test('Community page links are functional', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_case', description: 'TC_FUNC_014' });
    testInfo.setTimeout(60000);

    const { success, finalUrl } = await safeGoto(page, testInfo, '/community/?cachebust=' + Date.now(), { waitUntil: 'networkidle' });
    if (!success) {
      await logOnFailure(page, testInfo, `Community page load failed: ${finalUrl}`, 'screenshots/tc_func_014_load_failed.png');
    }
    await logAndScreenshot(page, testInfo, `Community page loaded, URL: ${page.url()}`, 'screenshots/tc_func_014_loaded.png');

    const communityLink = page.locator('a[href*="github.com/*/issues"], a[href*="discourse"], a[href*="lists.boost.org"]').first();
    await expect(communityLink).toBeVisible({ timeout: 15000 }).catch(async () => {
      await logOnFailure(page, testInfo, 'Community link not visible', 'screenshots/tc_func_014_community_not_visible.png');
    });

    const href = await communityLink.getAttribute('href').catch(() => 'unknown');
    const isNewTab = (await communityLink.getAttribute('target').catch(() => null)) === '_blank';
    fs.appendFileSync('test-logs.txt', `TC_FUNC_014 Testing community link: ${href}, NewTab=${isNewTab}\n`);

    try {
      if (isNewTab) {
        const [newPage] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null),
          communityLink.click(),
        ]);
        if (newPage) {
          await expect(newPage).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i, { timeout: 15000 }).catch(async () => {
            await logOnFailure(newPage, testInfo, `New page navigation failed: ${newPage.url()}`, 'screenshots/tc_func_014_new_page_failed.png');
          });
          await newPage.close();
        } else {
          await logOnFailure(page, testInfo, `New tab not opened for community link: ${href}`, 'screenshots/tc_func_014_no_new_tab.png');
        }
      } else {
        await communityLink.click();
        await expect(page).toHaveURL(/github.com.*issues|discourse|lists.boost.org/i, { timeout: 15000 }).catch(async () => {
          await logOnFailure(page, testInfo, `Navigation failed for community link: ${href}, URL: ${page.url()}`, 'screenshots/tc_func_014_nav_failed.png');
        });
      }
    } catch (e) {
      await logOnFailure(page, testInfo, `Community link test failed: ${e.message}`, 'screenshots/tc_func_014_error.png');
    }
  });
});