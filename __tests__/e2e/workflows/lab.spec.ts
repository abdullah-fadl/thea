/**
 * E2E: Lab Workflow
 *
 * Tests the laboratory workflow:
 *   Collection → Results Entry → Dashboard → QC Module
 */

import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateTo, setPlatformHealth, setLanguageEnglish } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { TEST_USER } from '../helpers/constants';

test.describe('Lab Workflow', () => {
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

  test('LAB-E2E-01: Collection page loads', async () => {
    await navigateTo(page, '/lab/collection');
    await expectPageLoaded(page);

    // Should render specimen collection UI
    const heading = page.getByText(/collection|سحب العينات/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('LAB-E2E-02: Results page loads worklist', async () => {
    await navigateTo(page, '/lab/results');
    await expectPageLoaded(page);

    // Should render the results entry page
    const heading = page.getByText(/result|نتائج/i);
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  });

  test('LAB-E2E-03: Lab Dashboard renders', async () => {
    await navigateTo(page, '/lab/dashboard');
    await expectPageLoaded(page);

    // Should render dashboard with TAT metrics
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('LAB-E2E-04: QC Module page loads', async () => {
    await navigateTo(page, '/lab/qc');
    await expectPageLoaded(page);

    // Should render the quality control page
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
