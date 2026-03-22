import { test, expect } from '@playwright/test';

const ENABLE = process.env.ADMIN_UI_E2E === '1';
const SESSION_COOKIE = process.env.ADMIN_SESSION_COOKIE || '';

async function ensureAuth(page) {
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

test('admin backup & restore page loads @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await ensureAuth(page);
  await page.goto('/backup-restore');

  await expect(page.getByRole('heading', { name: 'Backup & Restore' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Backup Now' })).toBeVisible();
});
