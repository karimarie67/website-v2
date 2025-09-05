import { test } from '@playwright/test';

/**
 * Get the base URL from the current project configuration
 * @param {import('@playwright/test').TestInfo} testInfo - Test info object
 * @returns {string} The base URL for the current project
 */
export function getBaseURL(testInfo) {
  const config = testInfo.project.use;
  return config.baseURL || 'https://www.boost.org';
}

/**
 * Build a URL relative to the current project's base URL
 * @param {import('@playwright/test').TestInfo} testInfo - Test info object  
 * @param {string} path - The path to append to base URL
 * @param {Object} options - URL options
 * @param {boolean} options.cachebust - Add cachebust parameter
 * @param {Object} options.params - Additional query parameters
 * @returns {string} Complete URL
 */
export function buildURL(testInfo, path = '/', options = {}) {
  const baseURL = getBaseURL(testInfo);
  const url = new URL(path, baseURL);
  
  if (options.cachebust) {
    url.searchParams.set('cachebust', Date.now().toString());
  }
  
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
}

/**
 * Common URL patterns used in tests
 */
export const urlPatterns = {
  homepage: '/',
  libraries: '/libraries/',
  releases: '/releases/', 
  documentation: '/doc/libs/',
  community: '/community/',
  search: '/search/',
  // Version-specific URLs
  docLibsVersion: (version = '1_85_0') => `/doc/libs/${version}/`,
  releaseNotes: (version = '1_85_0') => `/doc/libs/${version}/libs/release_notes/`,
};

/**
 * Expected URL patterns for navigation validation
 */
export const expectedUrlPatterns = {
  afterCTAClick: /libraries|releases|docs|learn|download/i,
  afterSearch: /search|results|q=/i,
  afterLogoClick: /\/?$/,
  githubBoost: /github\.com\/boostorg/,
  downloadSite: /archives\.boost\.io|github\.com\/boostorg\/boost\/releases|download|release/i,
  communityLinks: /github.com.*issues|discourse|lists.boost.org/i,
};

/**
 * Test data constants
 */
export const testData = {
  searchTerms: {
    working: 'asio', // Known to work
    alternative: 'algorithm',
  },
  downloadFiles: {
    tarGz: /boost_1_85_0\.tar\.gz$/,
    zip: /boost_1_85_0\.zip$/,
    supported: /\.(zip|tar\.gz|tar\.bz2|7z|exe)$/,
  },
  timeouts: {
    short: 5000,
    medium: 15000, 
    long: 30000,
    download: 60000,
  },
  viewport: {
    desktop: { width: 1280, height: 720 },
    mobile: { width: 800, height: 600 },
  }
};