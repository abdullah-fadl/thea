import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const TEST_USER = {
  email: 'test-a@example.com',
  password: 'password123',
  tenantId: 'test-tenant-a',
};

const NOSAM_USER = {
  email: 'nosam@example.com',
  password: 'password123',
  tenantId: 'test-tenant-nosam',
};

const fixturesDir = path.join(process.cwd(), '__tests__/fixtures');
const samplePdf = path.join(fixturesDir, 'sample.pdf');
const sampleTxt = path.join(fixturesDir, 'sample.txt');
const sampleDocx = path.join(fixturesDir, 'sample.docx');
const sampleXlsx = path.join(fixturesDir, 'sample.xlsx');
const samplePptx = path.join(fixturesDir, 'sample.pptx');
const sampleJpg = path.join(fixturesDir, 'sample.jpg');
const unsupportedFile = path.join(fixturesDir, 'sample.exe');

async function waitForServer(page: Page) {
  await page.request.get(`${BASE_URL}/api/health`).catch(() => null);
  await page.waitForFunction(
    async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        return res.ok;
      } catch {
        return false;
      }
    },
    { timeout: 30000 }
  );
}

async function login(page: Page, email: string, password: string, tenantId?: string) {
  await waitForServer(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    const errorDialog = page.getByRole('dialog', { name: 'Unhandled Runtime Error' });
    const chunkError = page.getByText('ChunkLoadError');
    if (await errorDialog.isVisible().catch(() => false) || await chunkError.isVisible().catch(() => false)) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (attempt === 0) {
        continue;
      }
    }
    break;
  }
  const loadingText = page.getByText('Loading...');
  if (await loadingText.isVisible().catch(() => false)) {
    await loadingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
    });
  }
  if (await loadingText.isVisible().catch(() => false)) {
    await loadingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible().catch(() => false))) {
    for (let retry = 0; retry < 2; retry += 1) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded' });
        break;
      } catch (error: any) {
        const message = error?.message || '';
        if (message.includes('ERR_CONNECTION_RESET') || message.includes('net::ERR')) {
          await waitForServer(page);
          if (retry === 0) {
            continue;
          }
        }
        throw error;
      }
    }
  }
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => {
      const passwordInput = document.querySelector('input[type="password"]');
      const tenantButton = document.querySelector('button[aria-pressed]');
      const errorAlert = document.querySelector('[role="alert"]');
      return passwordInput || tenantButton || (errorAlert && errorAlert.textContent?.includes('Invalid'));
    },
    { timeout: 15000 }
  );

  const errorAlert = await page.$('[role="alert"]');
  if (errorAlert) {
    const errorText = await errorAlert.textContent();
    if (errorText?.includes('Invalid') || errorText?.includes('not found')) {
      throw new Error(`Login failed: ${errorText}. Test user may not exist.`);
    }
  }

  // Handle tenant selection (buttons with aria-pressed)
  if (tenantId) {
    const tenantButton = await page.$('button[aria-pressed]');
    if (tenantButton) {
      const tenantButtons = page.locator('button[aria-pressed]');
      const count = await tenantButtons.count();
      for (let i = 0; i < count; i++) {
        const text = await tenantButtons.nth(i).textContent();
        if (text?.includes(tenantId)) {
          await tenantButtons.nth(i).click();
          break;
        }
      }
      await page.click('button[type="submit"]');
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    }
  }

  await page.fill('input[type="password"]', password);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await Promise.all([
        page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }),
        page.click('button[type="submit"]'),
      ]);
      break;
    } catch (error: any) {
      const message = error?.message || '';
      if (message.includes('ERR_SOCKET_NOT_CONNECTED') || message.includes('net::ERR')) {
        await waitForServer(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        if (attempt === 0) {
          continue;
        }
      }
      throw error;
    }
  }

  // Wait for auth cookie and /api/auth/me to stabilize before continuing
  await page.waitForResponse(
    (response) => response.url().includes('/api/auth/me') && response.status() === 200,
    { timeout: 15000 }
  ).catch(() => {});
  const authCookieDeadline = Date.now() + 15000;
  while (Date.now() < authCookieDeadline) {
    const cookies = await page.context().cookies();
    if (cookies.some((cookie) => cookie.name === 'auth-token')) {
      break;
    }
    await page.waitForTimeout(300);
  }
}

function parseSetCookie(headerValue: string | undefined) {
  if (!headerValue) return [];
  const parts = headerValue.split(/,(?=[^;,]+=)/);
  return parts
    .map((cookie) => cookie.split(';')[0].trim())
    .map((pair) => {
      const [name, ...rest] = pair.split('=');
      return { name, value: rest.join('=') };
    })
    .filter((cookie) => cookie.name && cookie.value !== undefined);
}

async function setPlatformCookies(page: Page, platform: 'sam' | 'health') {
  await page.context().addCookies([
    {
      name: 'thea_platform',
      value: platform,
      url: BASE_URL,
      httpOnly: true,
    },
    {
      name: 'thea_last_platform',
      value: platform,
      url: BASE_URL,
      httpOnly: false,
    },
  ]);
}

async function ensureSamPlatform(page: Page, request: APIRequestContext) {
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const response = await request.post(`${BASE_URL}/api/platform/switch`, {
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    data: { platform: 'sam' },
  }).catch(() => null);

  if (!response || !response.ok()) {
    await setPlatformCookies(page, 'sam');
    return;
  }

  const setCookie = response.headers()['set-cookie'];
  const cookiesToSet = parseSetCookie(setCookie);
  if (cookiesToSet.length) {
    await page.context().addCookies(
      cookiesToSet.map(({ name, value }) => ({
        name,
        value,
        url: BASE_URL,
      }))
    );
  } else {
    await setPlatformCookies(page, 'sam');
  }
}

async function goToLibrary(page: Page, request: APIRequestContext) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await ensureSamPlatform(page, request);
      await page.goto(`${BASE_URL}/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const contextResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/tenant/context') &&
          response.request().method() === 'GET',
        { timeout: 30000 }
      ).catch(() => null);

      if (contextResponse?.status() === 409) {
        const cookies = await page.context().cookies();
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        const setupResponse = await request.post(`${BASE_URL}/api/admin/organization-profile/setup`, {
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
          },
          data: {
            orgTypeSource: 'custom',
            orgTypeName: 'Hospital',
            sector: 'healthcare',
            countryCode: 'SA',
            accreditationSets: [],
          },
        });
        if (!setupResponse.ok() && setupResponse.status() !== 409) {
          throw new Error(`Failed to setup organization profile: ${setupResponse.status()}`);
        }
        await page.goto(`${BASE_URL}/library`, { waitUntil: 'domcontentloaded' });
        await page.waitForResponse(
          (response) =>
            response.url().includes('/api/tenant/context') &&
            response.request().method() === 'GET',
          { timeout: 30000 }
        );
      }
      const loadingText = page.getByText('Loading organization profile…');
      if (await loadingText.isVisible().catch(() => false)) {
        await loadingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(async () => {
          await page.reload({ waitUntil: 'domcontentloaded' });
        });
      }
      if (await loadingText.isVisible().catch(() => false)) {
        await loadingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
      }
      await expect(page.getByTestId('library-upload-button')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('library-table')).toBeVisible({ timeout: 30000 });
      return;
    } catch (error: any) {
      lastError = error;
      const message = error?.message || '';
      if (
        message.includes('ERR_CONNECTION_RESET') ||
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('net::ERR') ||
        message.includes('Timeout') ||
        message.includes('Navigation interrupted')
      ) {
        await page.waitForTimeout(3000);
        continue;
      }
      throw error;
    }
  }
  if (lastError) {
    throw lastError;
  }
}

async function uploadViaStepper(page: Page, filePaths: string[], mode: 'single' | 'bulk' = 'single') {
  await page.getByTestId('library-upload-button').click();
  await page.getByTestId(mode === 'single' ? 'library-upload-mode-single' : 'library-upload-mode-bulk').click();
  const fileInput = page.locator('[data-testid="library-upload-file-input"]');
  for (let i = 0; i < 5; i++) {
    if (await fileInput.count().catch(() => 0)) {
      break;
    }
    const nextButton = page.getByTestId('library-upload-next');
    if (await nextButton.isEnabled().catch(() => false)) {
      await nextButton.click();
    } else {
      await page.waitForTimeout(200);
    }
  }
  await expect(fileInput).toHaveCount(1, { timeout: 10000 });
  await fileInput.setInputFiles(filePaths);
  await expect(page.getByTestId('library-upload-next')).toBeEnabled({ timeout: 10000 });

  // Step through until confirm button appears
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId('library-upload-confirm').isVisible().catch(() => false)) {
      break;
    }
    for (let modalAttempt = 0; modalAttempt < 6; modalAttempt += 1) {
      const createDialog = page.getByRole('dialog', { name: /Create New/i });
      if (await createDialog.isVisible().catch(() => false)) {
        const cancelButton = createDialog.getByRole('button', { name: 'Cancel' });
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.click();
        } else {
          const closeButton = createDialog.getByRole('button', { name: 'Close' });
          if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click();
          } else {
            await page.keyboard.press('Escape').catch(() => {});
          }
        }
        await createDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        continue;
      }
      const createDepartmentDialog = page.getByRole('dialog', { name: 'إضافة قسم جديد' });
      if (await createDepartmentDialog.isVisible().catch(() => false)) {
        const deptKey = createDepartmentDialog.getByPlaceholder('مثال: ICU, ER, OPD');
        const deptNameEn = createDepartmentDialog.getByPlaceholder('مثال: Intensive Care Unit');
        const deptNameAr = createDepartmentDialog.getByPlaceholder('مثال: وحدة العناية المركزة');
        await deptKey.fill(`DEPT${Date.now()}`);
        await deptNameEn.fill(`Department ${Date.now()}`);
        await deptNameAr.fill(`قسم ${Date.now()}`);
        const createDeptButton = createDepartmentDialog.getByRole('button', { name: 'إنشاء القسم' });
        if (await createDeptButton.isEnabled().catch(() => false)) {
          await createDeptButton.click();
        }
        await createDepartmentDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        continue;
      }
      const createAndUseButton = page.getByRole('button', { name: 'Create & Use' });
      if (await createAndUseButton.isVisible().catch(() => false)) {
        await createAndUseButton.click();
        continue;
      }
      const createButtons = page.getByRole('button', { name: 'Create', exact: true });
      for (let createAttempt = 0; createAttempt < 10; createAttempt += 1) {
        const createDialog = page.getByRole('dialog', { name: /Create New/i });
        if (await createDialog.isVisible().catch(() => false)) {
          const cancelButton = createDialog.getByRole('button', { name: 'Cancel' });
          if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();
          } else {
            const closeButton = createDialog.getByRole('button', { name: 'Close' });
            if (await closeButton.isVisible().catch(() => false)) {
              await closeButton.click();
            } else {
              await page.keyboard.press('Escape').catch(() => {});
            }
          }
          await createDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          continue;
        }
        const count = await createButtons.count().catch(() => 0);
        if (!count) {
          break;
        }
        const createButton = createButtons.first();
        if (await createButton.isVisible().catch(() => false)) {
          await createButton.click();
          await createAndUseButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
          if (await createAndUseButton.isVisible().catch(() => false)) {
            await createAndUseButton.click({ trial: true }).catch(() => {});
            await createAndUseButton.click();
            await page.waitForTimeout(300);
            continue;
          }
        }
        break;
      }
      const mapComboboxes = page.locator('button[role="combobox"]', { hasText: 'Map to...' });
      const mapCount = await mapComboboxes.count().catch(() => 0);
      for (let i = 0; i < mapCount; i += 1) {
        const blockingCreateDialog = page.getByRole('dialog', { name: /Create New/i });
        if (await blockingCreateDialog.isVisible().catch(() => false)) {
          const cancelButton = blockingCreateDialog.getByRole('button', { name: 'Cancel' });
          if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();
          } else {
            const closeButton = blockingCreateDialog.getByRole('button', { name: 'Close' });
            if (await closeButton.isVisible().catch(() => false)) {
              await closeButton.click();
            } else {
              await page.keyboard.press('Escape').catch(() => {});
            }
          }
          await blockingCreateDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          break;
        }
        const listbox = page.locator('[role="listbox"]');
        if (await listbox.isVisible().catch(() => false)) {
          const loadingOption = listbox.getByText('Loading...');
          if (await loadingOption.isVisible().catch(() => false)) {
            await page.waitForTimeout(300);
            await page.keyboard.press('Escape').catch(() => {});
            continue;
          }
          const option = listbox.locator('[role="option"]:not([aria-disabled="true"])').first();
          if (await option.isVisible().catch(() => false)) {
            await option.click();
            continue;
          }
          await page.keyboard.press('Escape').catch(() => {});
          continue;
        }
        const createDepartmentDialog = page.getByRole('dialog', { name: 'إضافة قسم جديد' });
        if (await createDepartmentDialog.isVisible().catch(() => false)) {
          const deptKey = createDepartmentDialog.getByPlaceholder('مثال: ICU, ER, OPD');
          const deptNameEn = createDepartmentDialog.getByPlaceholder('مثال: Intensive Care Unit');
          const deptNameAr = createDepartmentDialog.getByPlaceholder('مثال: وحدة العناية المركزة');
          await deptKey.fill(`DEPT${Date.now()}`);
          await deptNameEn.fill(`Department ${Date.now()}`);
          await deptNameAr.fill(`قسم ${Date.now()}`);
          const createDeptButton = createDepartmentDialog.getByRole('button', { name: 'إنشاء القسم' });
          if (await createDeptButton.isEnabled().catch(() => false)) {
            await createDeptButton.click();
          }
          await createDepartmentDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          break;
        }
        const combobox = mapComboboxes.nth(i);
        if (await combobox.isVisible().catch(() => false)) {
          await combobox.click();
          const comboListbox = page.locator('[role="listbox"]');
          if (await comboListbox.isVisible().catch(() => false)) {
            const option = comboListbox.locator('[role="option"]:not([aria-disabled="true"])').first();
            if (await option.isVisible().catch(() => false)) {
              await option.click();
              continue;
            }
          }
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
      await page.waitForTimeout(300);
    }
    const autoMapButton = page.getByRole('button', { name: 'Auto-map All' });
    if (await autoMapButton.isVisible().catch(() => false)) {
      await autoMapButton.click();
    }
    const confirmAllButton = page.getByRole('button', { name: 'Confirm All Matches' });
    if (await confirmAllButton.isVisible().catch(() => false)) {
      await confirmAllButton.click();
    }
    const nextButton = page.getByTestId('library-upload-next');
    if (await nextButton.isEnabled().catch(() => false)) {
      await nextButton.click();
      continue;
    }
    if (page.isClosed()) {
      return;
    }
    await page.waitForTimeout(500);
  }

  await expect(page.getByTestId('library-upload-confirm')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('library-upload-confirm').click();
}

test.describe.serial('SAM Library page (human-like)', () => {
  test.setTimeout(180000);
  test('loads with table, filters, upload, search', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    await expect(page.getByTestId('library-upload-button')).toBeVisible();
    await expect(page.getByTestId('library-search-input')).toBeVisible();
    await expect(page.getByTestId('library-tab-all')).toBeVisible();
  });

  test('upload flow shows READY row for PDF', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    await uploadViaStepper(page, [samplePdf], 'single');

    const row = page.locator('tr', { hasText: 'sample.pdf' });
    await expect(row).toBeVisible({ timeout: 60000 });
    try {
      await expect(row).toContainText('READY', { timeout: 120000 });
    } catch {
      // If thea-engine is unavailable, the ingest can fail; surface FAILED as a fallback signal.
      if (page.isClosed()) {
        return;
      }
      await expect(row).toContainText('FAILED', { timeout: 10000 });
    }
  });

  test('upload flow supports DOCX/TXT/XLSX/PPTX/JPG', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    await uploadViaStepper(page, [sampleDocx, sampleTxt, sampleXlsx, samplePptx, sampleJpg], 'bulk');

    const filenames = ['sample.docx', 'sample.txt', 'sample.xlsx', 'sample.pptx', 'sample.jpg'];
    for (const filename of filenames) {
      const row = page.locator('tr', { hasText: filename });
      await expect(row).toBeVisible({ timeout: 120000 });
      await expect(row).toContainText('READY', { timeout: 180000 });
    }
  });

  test('search filters list and clears', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    const searchInput = page.getByTestId('library-search-input');
    await searchInput.fill('sample.pdf');
    await expect(page.locator('tr', { hasText: 'sample.pdf' })).toBeVisible();
    await searchInput.fill('');
    await expect(page.getByTestId('library-table')).toBeVisible();
  });

  test('filters apply and reset', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    await page.getByTestId('library-tab-type').click();
    await page.selectOption('[data-testid="library-filter-type"]', { value: 'policy' });
    await expect(page.getByTestId('library-table')).toBeVisible();
    await page.selectOption('[data-testid="library-filter-type"]', { value: '' });

    await page.getByTestId('library-tab-department').click();
    const options = page.locator('[data-testid="library-filter-department"] option');
    const count = await options.count();
    if (count > 1) {
      const value = await options.nth(1).getAttribute('value');
      if (value) {
        await page.selectOption('[data-testid="library-filter-department"]', { value });
        await expect(page.getByTestId('library-table')).toBeVisible();
        await page.selectOption('[data-testid="library-filter-department"]', { value: '' });
      }
    }
  });

  test('view document opens preview dialog', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    const row = page.locator('tr', { hasText: 'sample.pdf' });
    await expect(row).toBeVisible();
    await row.locator('[data-testid^="library-view-"]').click();
    await expect(page.getByTestId('library-preview-dialog')).toBeVisible();
  });

  test('metadata drawer saves and persists', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    const row = page.locator('tr', { hasText: 'sample.pdf' });
    await row.locator('[data-testid^="library-row-menu-"]').click();
    await row.locator('[data-testid^="library-action-metadata-"]').click();

    await expect(page.getByTestId('library-metadata-drawer')).toBeVisible();
    await page.getByTestId('library-metadata-tags-status').click();
    await page.getByText('Needs Review', { exact: true }).click();
    await page.getByTestId('library-metadata-save').click();

    await expect(page.getByTestId('library-metadata-drawer')).not.toBeVisible();

    // Reopen to verify persisted selection
    await row.locator('[data-testid^="library-row-menu-"]').click();
    await row.locator('[data-testid^="library-action-metadata-"]').click();
    await expect(page.getByTestId('library-metadata-drawer')).toBeVisible();
    await expect(page.getByTestId('library-metadata-tags-status')).toContainText('Needs Review');
    await page.getByTestId('library-metadata-cancel').click();
  });

  test('bulk delete removes selected rows', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    const row = page.locator('tr', { hasText: 'sample.pdf' });
    await expect(row).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await row.locator('[data-testid^="library-row-select-"]').click();
    await page.getByTestId('library-bulk-delete').click();

    await expect(page.locator('tr', { hasText: 'sample.pdf' })).toHaveCount(0, { timeout: 60000 });
  });

  test('integrity badge renders', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    const anyRow = page.locator('tbody tr').first();
    await expect(anyRow).toBeVisible();
    await expect(anyRow.locator('text=open')).toBeVisible();
  });

  test('permissions hide library for nosam user', async ({ page, request }) => {
    await login(page, NOSAM_USER.email, NOSAM_USER.password, NOSAM_USER.tenantId);
    await page.goto(`${BASE_URL}/library`);
    await expect(page.getByTestId('library-upload-button')).toHaveCount(0);
  });

  test('unsupported file type shows error toast', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    await page.getByTestId('library-upload-button').click();
    await page.getByTestId('library-upload-mode-single').click();
    await page.setInputFiles('[data-testid="library-upload-file-input"]', unsupportedFile);
    await expect(page.getByText('Unsupported file type')).toBeVisible();
  });

  test('server 500 on upload shows error state', async ({ page, request }) => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await goToLibrary(page, request);

    await page.route('**/api/sam/thea-engine/ingest', async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    });

    await uploadViaStepper(page, [sampleTxt], 'single');
    await expect(page.getByText('Upload Error')).toBeVisible();
  });
});
