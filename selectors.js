export const selectors = {
  mobileToggle: page => page.locator('button[class*="menu"], button[aria-label="menu"]'),
  searchInput: page => page.getByRole('combobox', { name: /search/i }).or(page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]')),
  searchTrigger: page => page.locator('#gecko-search-button'),
  logo: page => page.getByRole('img', { name: /Boost/i }).first().or(page.locator('img[src*="/static/img/Boost_Logo"]')),
  nav: page => page.getByRole('navigation').first().or(page.locator('header, nav, div[class*="nav"], section[class*="nav"]')).first(),
  content: page => page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2, h3, p')).first(),
  cta: page => page.getByRole('button', { name: /get started|learn more|sign up/i }).or(page.locator('a[class*="cta"], button[class*="cta"]')),
};
     