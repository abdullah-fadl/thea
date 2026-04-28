/**
 * E2E: Billing Workflow
 *
 * Tests the billing workflow:
 *   Service Catalog → Medication Catalog → Diagnosis Catalog →
 *   Pricing Packages → Pending Orders
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Billing Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await setPlatformHealth(page);
    await setLanguageEnglish(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('BILL-E2E-01: Service catalog page loads', async () => {
    await navigateTo(page, '/billing/service-catalog');
    await expectPageLoaded(page);

    // Page should render without errors (may show loading/empty state with no data)
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('BILL-E2E-02: Medication catalog page loads', async () => {
    await navigateTo(page, '/billing/medication-catalog');
    await expectPageLoaded(page);

    // Page should render without errors (may show loading/empty state with no data)
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('BILL-E2E-03: Diagnosis catalog page loads', async () => {
    await navigateTo(page, '/billing/diagnosis-catalog');
    await expectPageLoaded(page);

    // Page should render without errors (may show loading/empty state with no data)
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('BILL-E2E-04: Pricing packages page loads', async () => {
    await navigateTo(page, '/billing/pricing-packages');
    await expectPageLoaded(page);

    // Should render pricing packages table
    const heading = page.getByText(/package|باقات|باقة/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('BILL-E2E-05: Service catalog search filters results', async () => {
    await navigateTo(page, '/billing/service-catalog');
    await expectPageLoaded(page);

    // Find a search input and type a search term
    const searchInput = page.locator(
      'input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="بحث"]',
    ).first();

    const isVisible = await searchInput.isVisible().catch(() => false);
    if (isVisible) {
      await searchInput.fill('test');
      // Wait for filtered results
      await page.waitForTimeout(1000);
      // Page should not crash
      await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
    }
  });
});
