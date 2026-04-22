/**
 * E2E: Radiology Workflow
 *
 * Tests the radiology workflow:
 *   Studies → Reporting → Reception
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Radiology Workflow', () => {
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

  test('RAD-E2E-01: Studies page loads', async () => {
    await navigateTo(page, '/radiology/studies');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('RAD-E2E-02: Reporting page loads', async () => {
    await navigateTo(page, '/radiology/reporting');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('RAD-E2E-03: Reception page loads', async () => {
    await navigateTo(page, '/radiology/reception');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
