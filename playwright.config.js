/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './tests',
  timeout: 60000,
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'staging',
      use: { baseURL: 'https://www.stage.boost.cppalliance.org' },
    },
    {
      name: 'production',
      use: { baseURL: 'https://www.boost.io' },
    },
  ],
};
module.exports = config;


