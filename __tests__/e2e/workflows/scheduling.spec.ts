/**
 * E2E: Scheduling Workflow
 *
 * Tests the scheduling module:
 *   Calendar → Resources → Templates
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Scheduling Workflow', () => {
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

  test('SCHED-E2E-01: Calendar page loads', async () => {
    await navigateTo(page, '/scheduling/calendar');
    await expectPageLoaded(page);

    // Calendar page shows Month/Week/Day view toggles
    const viewToggle = page.getByText(/month|week|day|شهر/i);
    await expect(viewToggle.first()).toBeVisible({ timeout: 15000 });
  });

  test('SCHED-E2E-02: Resources page loads', async () => {
    await navigateTo(page, '/scheduling/resources');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('SCHED-E2E-03: Templates page loads', async () => {
    await navigateTo(page, '/scheduling/templates');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
