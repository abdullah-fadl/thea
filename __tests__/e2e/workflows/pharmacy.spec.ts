/**
 * E2E: Pharmacy Workflow
 *
 * Tests the pharmacy workflow:
 *   Dispensing → Inventory → Reception
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Pharmacy Workflow', () => {
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

  test('PHARM-E2E-01: Dispensing page loads', async () => {
    await navigateTo(page, '/pharmacy/dispensing');
    await expectPageLoaded(page);

    // Should render the dispensing queue
    const heading = page.getByText(/dispens|صرف/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('PHARM-E2E-02: Inventory page loads', async () => {
    await navigateTo(page, '/pharmacy/inventory');
    await expectPageLoaded(page);

    // Should render inventory management
    const heading = page.getByText(/inventor|مخزون/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('PHARM-E2E-03: Pharmacy Reception page loads', async () => {
    await navigateTo(page, '/pharmacy/reception');
    await expectPageLoaded(page);

    // Should render pharmacy reception with search
    const heading = page.getByText(/reception|استقبال/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });
});
