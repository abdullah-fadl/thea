/**
 * Authentication helpers for E2E tests.
 *
 * Login page uses TheaInput (no id attrs). Actual selectors:
 *   email:    input[type="email"]
 *   tenant:   button[aria-pressed] (click to select)
 *   password: input[autocomplete="current-password"]
 */

import { Page } from '@playwright/test';
import { BASE_URL } from './constants';

// ── Selectors matching Login.tsx ────────────────────────────────────────
const SEL_EMAIL_INPUT = 'input[type="email"]';
const SEL_PASSWORD_INPUT = 'input[autocomplete="current-password"]';
const SEL_SUBMIT_BUTTON = 'button[type="submit"]';

/**
 * Wait for the dev server to be available (polls /api/health).
 */
export async function waitForServer(page: Page) {
  await page.request.get(`${BASE_URL}/api/health`).catch(() => null);
  await page.waitForFunction(
    (url: string) => {
      return fetch(`${url}/api/health`)
        .then((res) => res.ok)
        .catch(() => false);
    },
    BASE_URL,
    { timeout: 30000 },
  );
}

/**
 * Login to the app with email/password. Handles:
 * - ChunkLoadError / Unhandled Runtime Error recovery
 * - Loading spinners
 * - Multi-step login (email → tenant buttons → password)
 * - Connection reset retries
 * - Auth cookie polling
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  tenantId?: string,
) {
  await waitForServer(page);

  // Force English language via cookie to avoid RTL input issues
  const domain = new URL(BASE_URL).hostname;
  await page.context().addCookies([
    { name: 'px-language', value: 'en', domain, path: '/' },
  ]);

  // Navigate to /login with ChunkLoadError + connection error recovery
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (error: any) {
      const msg = error?.message || '';
      if (
        (msg.includes('ERR_CONNECTION') || msg.includes('net::ERR')) &&
        attempt < 2
      ) {
        // Server may have restarted — wait for it to come back
        await waitForServer(page);
        continue;
      }
      throw error;
    }
    const errorDialog = page.getByRole('dialog', {
      name: 'Unhandled Runtime Error',
    });
    const chunkError = page.getByText('ChunkLoadError');
    if (
      (await errorDialog.isVisible().catch(() => false)) ||
      (await chunkError.isVisible().catch(() => false))
    ) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (attempt === 0) continue;
    }
    break;
  }

  // Wait for loading to finish
  const loadingText = page.getByText('Loading...');
  if (await loadingText.isVisible().catch(() => false)) {
    await loadingText
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
      });
  }
  if (await loadingText.isVisible().catch(() => false)) {
    await loadingText
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {});
  }

  // Ensure email input is visible (retry on connection errors)
  const emailInput = page.locator(SEL_EMAIL_INPUT);
  if (!(await emailInput.isVisible().catch(() => false))) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded' });
        break;
      } catch (error: any) {
        const message = error?.message || '';
        if (
          message.includes('ERR_CONNECTION_RESET') ||
          message.includes('net::ERR')
        ) {
          await waitForServer(page);
          if (retry === 0) continue;
        }
        throw error;
      }
    }
  }

  // ─── Step 1: Enter email ──────────────────────────────────────────────
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  // Click input, wait for React hydration, then type
  await emailInput.click();
  await page.waitForTimeout(500);
  await page.keyboard.type(email, { delay: 30 });
  // Verify the value was typed correctly, retry if needed
  const typedValue = await emailInput.inputValue();
  if (typedValue !== email) {
    // Clear and retype with triple-click select-all
    await emailInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
    await page.keyboard.type(email, { delay: 30 });
  }
  // Wait for React to enable the submit button
  const submitBtn = page.locator(`${SEL_SUBMIT_BUTTON}:not([disabled])`);
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();

  // ─── Step 2: Wait for next step (password, tenant buttons, or error) ──
  await page.waitForFunction(
    () => {
      const passwordInput = document.querySelector(
        'input[autocomplete="current-password"]',
      );
      const tenantButton = document.querySelector('button[aria-pressed]');
      const errorAlert = document.querySelector('[role="alert"]');
      return (
        passwordInput ||
        tenantButton ||
        (errorAlert && errorAlert.textContent?.includes('Invalid'))
      );
    },
    { timeout: 15000 },
  );

  // Check for login error
  const errorAlert = await page.$('[role="alert"]');
  if (errorAlert) {
    const errorText = await errorAlert.textContent();
    if (errorText?.includes('Invalid') || errorText?.includes('not found')) {
      throw new Error(`Login failed: ${errorText}. Test user may not exist.`);
    }
  }

  // ─── Step 2b: Handle tenant selection if visible ──────────────────────
  const tenantButtonEl = await page.$('button[aria-pressed]');
  if (tenantButtonEl) {
    if (tenantId) {
      const targetBtn = page.locator(`button[aria-pressed]`).filter({
        hasText: tenantId,
      });
      if ((await targetBtn.count()) > 0) {
        await targetBtn.first().click();
      } else {
        await page.locator('button[aria-pressed]').first().click();
      }
    } else {
      await page.locator('button[aria-pressed]').first().click();
    }

    const continueBtn = page.locator('button').filter({ hasText: /continue|متابعة/i });
    if ((await continueBtn.count()) > 0) {
      await continueBtn.first().click();
    }

    await page
      .locator(SEL_PASSWORD_INPUT)
      .waitFor({ state: 'visible', timeout: 10000 });
  }

  // ─── Step 3: Enter password ───────────────────────────────────────────
  const passwordInput = page.locator(SEL_PASSWORD_INPUT);
  await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
  await passwordInput.click();
  await page.waitForTimeout(200);
  await page.keyboard.type(password, { delay: 30 });
  // Wait for React to enable the submit button
  const loginBtn = page.locator(`${SEL_SUBMIT_BUTTON}:not([disabled])`);
  await loginBtn.waitFor({ state: 'visible', timeout: 5000 });

  // ─── Step 4: Submit and wait for navigation away from /login ──────────
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await Promise.all([
        page.waitForURL((url) => !url.pathname.includes('/login'), {
          timeout: 15000,
        }),
        loginBtn.click(),
      ]);
      break;
    } catch (error: any) {
      const message = error?.message || '';
      // Check for "Failed to fetch" alert on page (API call failed)
      const alertEl = await page.$('[role="alert"]');
      const alertText = alertEl ? await alertEl.textContent() : '';
      const isFetchError =
        alertText?.includes('Failed to fetch') ||
        alertText?.includes('fetch');
      if (
        isFetchError ||
        message.includes('ERR_SOCKET_NOT_CONNECTED') ||
        message.includes('net::ERR') ||
        message.includes('Timeout')
      ) {
        if (attempt < 2) {
          await waitForServer(page);
          await page.reload({ waitUntil: 'domcontentloaded' });
          // Re-enter password after reload
          const pwInput = page.locator(SEL_PASSWORD_INPUT);
          if (await pwInput.isVisible().catch(() => false)) {
            await pwInput.click();
            await page.waitForTimeout(200);
            await page.keyboard.type(password, { delay: 30 });
            await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
          }
          continue;
        }
      }
      throw error;
    }
  }

  // ─── Step 5: Wait for auth cookie to stabilize ────────────────────────
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/auth/me') && response.status() === 200,
      { timeout: 15000 },
    )
    .catch(() => {});

  const authCookieDeadline = Date.now() + 15000;
  while (Date.now() < authCookieDeadline) {
    const cookies = await page.context().cookies();
    if (cookies.some((cookie) => cookie.name === 'auth-token')) break;
    await page.waitForTimeout(300);
  }
}

/**
 * Logout by clearing all cookies.
 */
export async function logout(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
}
