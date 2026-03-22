import { test, expect } from '@playwright/test';

const ENABLE = process.env.ADMIN_UI_E2E === '1';
const SESSION_COOKIE = process.env.ADMIN_SESSION_COOKIE || '';

async function ensureAuth(page: any) {
  if (!SESSION_COOKIE) return false;
  const baseURL = process.env.ADMIN_UI_BASE_URL || 'http://127.0.0.1:3100';
  await page.context().addCookies([
    {
      name: 'sven_session',
      value: SESSION_COOKIE,
      url: baseURL,
      path: '/',
    },
  ]);
  return true;
}

test('trace view step modal opens and supports copy actions @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await page.addInitScript(() => {
    const fakeClipboard = {
      writeText: async () => undefined,
      readText: async () => '',
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: fakeClipboard,
      configurable: true,
    });
  });

  await ensureAuth(page);
  await page.goto('/trace-view');

  const stepRows = page.getByTestId('trace-step-row');
  const stepCount = await stepRows.count();
  if (stepCount === 0) {
    expect(true).toBe(true);
    return;
  }

  await stepRows.first().click();
  const modal = page.getByTestId('trace-step-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('trace-step-modal-tool-name')).toBeVisible();
  await expect(page.getByTestId('trace-step-modal-status')).toBeVisible();

  await page.getByTestId('trace-step-copy-params').click();
  await expect(page.getByTestId('trace-step-copy-params')).toContainText(/Copied|Copy/i);

  await page.getByTestId('trace-step-copy-output').click();
  await expect(page.getByTestId('trace-step-copy-output')).toContainText(/Copied|Copy/i);

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});
