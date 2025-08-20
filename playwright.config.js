module.exports = {
  projects: [
    {
      name: 'staging',
      use: {
        baseURL: 'https://www.stage.boost.org',
        browserName: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
        trace: 'on-first-retry',
      },
    },
    {
      name: 'production',
      use: {
        baseURL: 'https://www.boost.org',
        browserName: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
        trace: 'on-first-retry',
      },
    },
    {
      name: 'staging-mobile',
      use: {
        baseURL: 'https://www.stage.boost.org',
        browserName: 'chromium',
        headless: true,
        viewport: { width: 800, height: 600 },
        trace: 'on-first-retry',
      },
    },
    {
      name: 'production-mobile',
      use: {
        baseURL: 'https://www.boost.org',
        browserName: 'chromium',
        headless: true,
        viewport: { width: 800, height: 600 },
        trace: 'on-first-retry',
      },
    },
  ],
  use: {
    // Enable TypeScript support
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
};