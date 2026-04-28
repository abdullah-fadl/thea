import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Thea E2E Tests
 */
const shouldUseWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== '1';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid overwhelming the Next.js dev server
  reporter: 'html',
  timeout: 90000, // 90s per test (login + page compilation on dev server)

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  // Global setup: seed test data
  globalSetup: require.resolve('./__tests__/e2e/global-setup.ts'),

  projects: [
    {
      name: 'chromium-ui-crawl',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /ui-crawl\.spec\.ts/,
      fullyParallel: false, // Sequential for UI crawl to avoid server overload
      workers: 1, // Single worker for UI crawl
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /^(?!.*ui-crawl).*\.spec\.ts$/, // All other tests
    },
    // Uncomment for additional browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: shouldUseWebServer
    ? {
        command: 'yarn dev --hostname 127.0.0.1 --port 3000',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
