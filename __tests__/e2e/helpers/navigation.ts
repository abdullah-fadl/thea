/**
 * Navigation helpers for E2E tests.
 * Handles platform cookie setup and page loading.
 */

import { Page } from '@playwright/test';
import { BASE_URL } from './constants';
import { waitForServer } from './auth';

/**
 * Set the activePlatform cookie to 'health'.
 * Required by middleware.ts for accessing clinical routes (OPD, ER, Lab, etc.).
 */
export async function setPlatformHealth(page: Page) {
  await page.context().addCookies([
    {
      name: 'activePlatform',
      value: 'health',
      domain: new URL(BASE_URL).hostname,
      path: '/',
    },
  ]);
}

/**
 * Set the activePlatform cookie to 'sam'.
 */
export async function setPlatformSam(page: Page) {
  await page.context().addCookies([
    {
      name: 'activePlatform',
      value: 'sam',
      domain: new URL(BASE_URL).hostname,
      path: '/',
    },
  ]);
}

/**
 * Navigate to a path, wait for DOM load and loading spinners to disappear.
 * Retries on connection errors (server may be overwhelmed by parallel tests).
 */
export async function navigateTo(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      break;
    } catch (error: any) {
      const msg = error?.message || '';
      const isRetryable =
        msg.includes('ERR_CONNECTION') ||
        msg.includes('net::ERR') ||
        msg.includes('Timeout');
      if (isRetryable && attempt < 2) {
        // Server may have restarted or be slow compiling — wait and retry
        await waitForServer(page);
        continue;
      }
      throw error;
    }
  }
  await waitForPageLoad(page);
}

/**
 * Wait for page to finish loading:
 * - Dismiss "Loading..." text
 * - Wait for any skeleton/spinner to disappear
 */
export async function waitForPageLoad(page: Page, timeout = 15000) {
  // Wait for any "Loading..." text to disappear
  const loadingText = page.getByText('Loading...');
  if (await loadingText.isVisible().catch(() => false)) {
    await loadingText
      .waitFor({ state: 'hidden', timeout })
      .catch(() => {});
  }

  // Wait for skeleton loaders to disappear
  const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]').first();
  if (await skeleton.isVisible().catch(() => false)) {
    await skeleton
      .waitFor({ state: 'hidden', timeout })
      .catch(() => {});
  }
}

/**
 * Force English language for stable selectors.
 * Language is stored in cookie 'px-language' (checked first) and localStorage 'px-language'.
 */
export async function setLanguageEnglish(page: Page) {
  await page.context().addCookies([
    {
      name: 'px-language',
      value: 'en',
      domain: new URL(BASE_URL).hostname,
      path: '/',
    },
  ]);
  await page.evaluate(() => localStorage.setItem('px-language', 'en'));
}

/**
 * Wait for SWR data to load (network request completes + content renders).
 */
export async function waitForDataLoad(page: Page, apiPattern: string, timeout = 15000) {
  await page
    .waitForResponse(
      (response) => response.url().includes(apiPattern) && response.status() === 200,
      { timeout },
    )
    .catch(() => {});
  await waitForPageLoad(page);
}
