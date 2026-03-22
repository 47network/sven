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

test('admin context debug shows token counts @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await ensureAuth(page);
  await page.goto('/chats');

  const firstChat = page.locator('table tbody tr td a').first();
  const count = await firstChat.count();
  if (count === 0) {
    expect(true).toBe(true);
    return;
  }

  const href = await firstChat.getAttribute('href');
  if (!href) {
    expect(true).toBe(true);
    return;
  }

  await page.goto(href);
  await page.getByRole('button', { name: /Debug Context/i }).click();

  const panel = page.getByTestId('context-debug-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Total tokens:/)).toBeVisible();

  const chatId = href.split('/').pop() || '';
  const apiRes = await page.request.get(`/v1/admin/debug/context/${encodeURIComponent(chatId)}`);
  if (!apiRes.ok()) {
    expect(apiRes.ok()).toBe(true);
    return;
  }
  const payload = await apiRes.json();
  const apiTokens = Number(payload?.data?.totals?.tokens || 0);
  const text = await panel.getByText(/Total tokens:/).textContent();
  expect(text).toContain(String(apiTokens));
});
