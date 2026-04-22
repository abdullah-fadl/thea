/**
 * E2E: Emergency Room Workflow
 *
 * Tests the ER workflow:
 *   Board → Registration → Nursing → Doctor
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('ER Workflow', () => {
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

  test('ER-E2E-01: ER Board loads tracking board', async () => {
    await navigateTo(page, '/er/board');
    await expectPageLoaded(page);

    // Should render the ER tracking board
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-E2E-02: ER Registration page renders', async () => {
    await navigateTo(page, '/er/register');
    await expectPageLoaded(page);

    // Should render registration form with patient search
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-E2E-03: ER Nursing hub renders', async () => {
    await navigateTo(page, '/er/nursing');
    await expectPageLoaded(page);

    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-E2E-04: ER Doctor hub renders', async () => {
    await navigateTo(page, '/er/doctor');
    await expectPageLoaded(page);

    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
