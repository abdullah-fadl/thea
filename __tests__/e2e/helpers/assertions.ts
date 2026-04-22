/**
 * Shared assertion helpers for E2E tests.
 */

import { Page, expect } from '@playwright/test';

/**
 * Assert a toast notification is visible containing the given text.
 */
export async function expectToast(page: Page, text: string) {
  const toast = page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 10000 });
}

/**
 * Assert a table has at least `min` rows.
 */
export async function expectTableHasRows(page: Page, min: number) {
  const rows = page.locator('tbody tr, [role="row"]');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(min);
}

/**
 * Assert a page heading contains the given text.
 */
export async function expectPageTitle(page: Page, text: string) {
  const heading = page.getByRole('heading', { name: text });
  await expect(heading.first()).toBeVisible({ timeout: 15000 });
}

/**
 * Assert no error alerts are visible on the page.
 */
export async function expectNoErrors(page: Page) {
  const errorAlert = page.locator('[role="alert"]');
  const alertCount = await errorAlert.count();
  for (let i = 0; i < alertCount; i++) {
    const text = await errorAlert.nth(i).textContent();
    if (text?.toLowerCase().includes('error') || text?.toLowerCase().includes('failed')) {
      throw new Error(`Unexpected error on page: ${text}`);
    }
  }
}

/**
 * Assert the page shows an empty state (no data).
 */
export async function expectEmptyState(page: Page) {
  const emptyIndicators = page.locator(
    '[class*="empty"], [class*="no-data"], text=/no .*(found|data|results)/i',
  );
  await expect(emptyIndicators.first()).toBeVisible({ timeout: 10000 });
}

/**
 * Assert the page loaded successfully (no 404, no error page).
 */
export async function expectPageLoaded(page: Page) {
  // Should NOT show "404" or "Page not found"
  const notFound = page.getByText('404');
  const isNotFound = await notFound.isVisible().catch(() => false);
  expect(isNotFound).toBe(false);

  // Should NOT show unhandled runtime error
  const runtimeError = page.getByText('Unhandled Runtime Error');
  const hasRuntimeError = await runtimeError.isVisible().catch(() => false);
  expect(hasRuntimeError).toBe(false);
}
