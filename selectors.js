export const selectors = {
  mobileToggle: page => page.locator('button[class*="menu"], button[aria-label="menu"]'),
  mobileMenu: page => page.locator('[class*="mobile-menu"], [class*="nav-menu"][class*="open"], nav ul[class*="show"]'),
  searchInput: page => page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]')),
  searchTrigger: page => page.locator('#gecko-search-button'),
  // Enhanced logo selector targeting the specific Boost logo
  logo: page => page.locator('img[src*="Boost_Symbol_Transparent.svg"]')
    .or(page.locator('img[src*="boost" i][src*="symbol" i]'))
    .or(page.locator('img[src*="boost" i][src*="logo" i]'))
    .or(page.getByRole('img', { name: /boost/i }))
    .or(page.locator('img[alt*="boost" i], img[title*="boost" i]'))
    .or(page.locator('.logo img, #logo img, [class*="logo"] img'))
    .or(page.locator('header img, nav img'))
    .or(page.locator('a[href="/"] img, a[href="./"] img'))
    .first(),
  nav: page => page.getByRole('navigation').first().or(page.locator('header, nav, div[class*="nav"], section[class*="nav"]')).first(),
  content: page => page.getByRole('main').or(page.locator('main, [role="main"], .content, #content')).or(page.getByRole('heading', { level: 1 })).or(page.locator('h1, h2, h3, p')).first(),
  // Updated CTA selector with more comprehensive options
  cta: page => page.getByRole('link', { name: /download|release|get started|latest/i })
    .or(page.getByRole('button', { name: /download|release|get started|latest/i }))
    .or(page.locator('a[href*="download"], a[href*="release"], a[href*="get-started"]'))
    .or(page.locator('.cta, #cta, [class*="download"], [class*="release"]'))
    .or(page.locator('a[class*="btn"], button[class*="btn"]').filter({ hasText: /download|release|get started|latest/i }))
    .first(),
  navLinks: page => page.getByRole('navigation').locator('a').or(page.locator('nav a, header a')),
  externalLinks: page => page.locator('a[href^="http"]').filter({ hasText: /.+/ }),
};