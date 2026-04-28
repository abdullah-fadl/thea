/**
 * E2E: Admin & Settings
 *
 * Tests admin pages:
 *   Users → Clinical Infrastructure → Providers → Security Settings
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Admin & Settings', () => {
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

  test('ADMIN-E2E-01: Users management page loads', async () => {
    await navigateTo(page, '/admin/users');
    await expectPageLoaded(page);

    // Should render the users management interface
    const heading = page.getByText(/User Management|إدارة المستخدمين/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('ADMIN-E2E-02: Clinical infrastructure page loads', async () => {
    await navigateTo(page, '/admin/clinical-infra');
    await expectPageLoaded(page);

    // Should render clinical infrastructure management
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ADMIN-E2E-03: Providers page loads', async () => {
    await navigateTo(page, '/admin/clinical-infra/providers');
    await expectPageLoaded(page);

    // Should render the providers list
    const heading = page.getByText(/provider|مقدم|طبيب/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('ADMIN-E2E-04: Security settings page loads', async () => {
    await navigateTo(page, '/settings/security');
    await expectPageLoaded(page);

    // Page should render without errors
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
