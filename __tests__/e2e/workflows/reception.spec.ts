/**
 * E2E: Department Reception Pages
 *
 * Tests the department-specific reception pages:
 *   Radiology Reception → Lab Reception → Pharmacy Reception
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Department Reception', () => {
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

  test('RECEP-E2E-01: Radiology reception loads', async () => {
    await navigateTo(page, '/radiology/reception');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('RECEP-E2E-02: Lab reception loads', async () => {
    await navigateTo(page, '/lab/reception');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('RECEP-E2E-03: Pharmacy reception loads', async () => {
    await navigateTo(page, '/pharmacy/reception');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
