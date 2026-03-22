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

test('admin scheduler creates schedule via UI @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await ensureAuth(page);
  await page.goto('/scheduler');

  await expect(page.getByRole('heading', { name: 'Scheduler' })).toBeVisible();

  const name = `UI Schedule ${Date.now()}`;
  await page.getByPlaceholder('Name').fill(name);
  await page.getByPlaceholder('Instruction for the agent').fill('Check inbox');

  await page.getByRole('button', { name: 'Create Schedule' }).click();
  await expect(page.getByText(name, { exact: false })).toBeVisible();
});
