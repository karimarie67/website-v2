export const selectors = {
  // Mobile navigation selectors with comprehensive fallbacks
  mobileToggle: page => page.locator('button[class*="menu"], button[aria-label*="menu" i], .mobile-toggle, #mobile-toggle, [class*="hamburger"]')
    .or(page.locator('button[aria-expanded], button[data-toggle="menu"]'))
    .or(page.locator('.nav-toggle, .navbar-toggle, .menu-toggle')),
  
  mobileMenu: page => page.locator('[class*="mobile-menu"], [class*="nav-menu"][class*="open"], nav ul[class*="show"], .mobile-nav')
    .or(page.locator('[aria-expanded="true"] + ul, [aria-expanded="true"] + div'))
    .or(page.locator('.navbar-collapse.show, .nav-menu.active')),
  
  // Search functionality selectors
  searchInput: page => page.getByRole('combobox', { name: /search/i })
    .or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]'))
    .or(page.locator('#search-input, .search-input, [class*="search-input"]'))
    .or(page.locator('[role="searchbox"], [aria-label*="search" i]')),
  
  searchTrigger: page => page.locator('#gecko-search-button')
    .or(page.locator('button[aria-label*="search" i], button[title*="search" i]'))
    .or(page.locator('.search-trigger, #search-trigger, [class*="search-btn"]'))
    .or(page.locator('button:has-text("Search"), [type="submit"][value*="search" i]')),
  
  // Logo selector with multiple fallback strategies
  logo: page => page.locator('img[src*="Boost_Symbol_Transparent.svg"]')
  .or(page.locator('img[alt*="boost" i], img[title*="boost" i]').filter({ hasNot: page.locator('iframe') }))
  .or(page.locator('img[src*="boost" i][src*="logo" i], img[src*="boost" i][src*="symbol" i]').filter({ hasNot: page.locator('iframe') }))
  .or(page.locator('.logo img, #logo img, [class*="logo"] img').filter({ hasNot: page.locator('iframe') }))
  .or(page.locator('header img, nav img').first())
  .or(page.locator('a[href="/"] img, a[href="./"] img').first()),
  
  // Navigation selectors
  nav: page => page.getByRole('navigation').first()
    .or(page.locator('header nav, .navbar, .navigation'))
    .or(page.locator('nav, div[class*="nav"], section[class*="nav"]').first()),
  
  navLinks: page => page.getByRole('navigation').locator('a')
    .or(page.locator('nav a, header a, [class*="nav"] a'))
    .or(page.locator('.navbar a, .navigation a')),
  
  // Content area selectors
  content: page => page.getByRole('main')
    .or(page.locator('main, [role="main"], .content, #content'))
    .or(page.locator('.main-content, .page-content, #main'))
    .or(page.getByRole('heading', { level: 1 }))
    .or(page.locator('h1, h2, h3').first())
    .or(page.locator('article, section').first()),
  
  // CTA (Call to Action) button selectors with comprehensive patterns
  cta: page => page.getByRole('link', { name: /download|release|get started|latest|learn more/i })
    .or(page.getByRole('button', { name: /download|release|get started|latest|learn more/i }))
    .or(page.locator('a[href*="download"], a[href*="release"], a[href*="get-started"]'))
    .or(page.locator('a').filter({ hasText: /download.*latest.*release|get.*started|learn.*more/i }))
    .or(page.locator('.cta, #cta, [class*="cta"], [class*="download"], [class*="release"]'))
    .or(page.locator('a[class*="btn"], button[class*="btn"]').filter({ hasText: /download|release|get started|latest/i }))
    .or(page.locator('[role="button"]:has-text("Download"), [role="button"]:has-text("Get Started")')),
  
  // External links selector
  externalLinks: page => page.locator('a[href^="http"]').filter({ hasText: /.+/ })
    .or(page.locator('a[href^="https"]').filter({ hasText: /.+/ }))
    .or(page.locator('a[target="_blank"]').filter({ hasText: /.+/ })),
  
  // Footer selector
  footer: page => page.getByRole('contentinfo').first()
    .or(page.locator('footer, .footer, #footer'))
    .or(page.locator('[role="contentinfo"]')),
  
  // Search results selectors
  searchResults: page => page.locator('[class*="search-result"], [class*="result"]')
    .or(page.locator('[data-testid*="search"], [data-testid*="result"]'))
    .or(page.locator('.algolia-autocomplete .aa-dropdown-menu .aa-suggestion'))
    .or(page.locator('[role="listbox"] [role="option"]'))
    .or(page.locator('.search-hits, .search-results, #search-results')),
  
  // Download link patterns
  downloadLinks: page => page.locator('a[href*="archives.boost.io"]')
    .or(page.locator('a[href*="boost_1_85_0"], a[href*="boost-1.85.0"]'))
    .or(page.locator('a[href$=".tar.gz"], a[href$=".zip"], a[href$=".exe"]'))
    .or(page.locator('a:has-text("Download"), a:has-text("tar.gz"), a:has-text("zip")'))
    .or(page.locator('[class*="download"], #download'))
    .or(page.locator('button:has-text("Download")')),
  
  // Form elements
  forms: {
    input: page => page.locator('input:not([type="hidden"])'),
    button: page => page.locator('button, input[type="submit"], input[type="button"]'),
    select: page => page.locator('select'),
    textarea: page => page.locator('textarea'),
  },
  
  // Common UI elements
  modals: page => page.locator('[role="dialog"], .modal, .popup')
    .or(page.locator('[aria-modal="true"]'))
    .or(page.locator('.overlay, .lightbox')),
  
  alerts: page => page.locator('[role="alert"], .alert, .notification')
    .or(page.locator('.error, .warning, .success, .info'))
    .or(page.locator('[class*="toast"], [class*="snackbar"]')),
  
  // Loading indicators
  loading: page => page.locator('.loading, .spinner, [class*="load"]')
    .or(page.locator('[aria-busy="true"]'))
    .or(page.locator('.progress, [role="progressbar"]')),
};