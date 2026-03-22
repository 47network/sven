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

test('admin editor can open, edit, and save file @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await ensureAuth(page);

  const api = page.request;
  const filePath = '.tmp/e2e-editor.txt';
  await api.put('/v1/admin/editor/file', {
    data: { path: filePath, content: 'initial content', create_dirs: true },
  });

  await page.goto('/editor');
  await page.getByPlaceholder('Search across project...').fill('e2e-editor');
  await page.getByRole('button', { name: 'Search' }).click();

  const result = page.getByText(`${filePath}:1`);
  await expect(result).toBeVisible();
  await result.click();

  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('updated content');

  await page.getByRole('button', { name: 'Save' }).click();

  const readRes = await api.get(`/v1/admin/editor/file?path=${encodeURIComponent(filePath)}`);
  expect(readRes.ok()).toBe(true);
  const payload = await readRes.json();
  expect(payload?.data?.content).toContain('updated content');
});

test('admin editor applies syntax highlighting across supported languages @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await ensureAuth(page);

  const api = page.request;
  const cases = [
    { ext: 'ts', sample: 'const value: number = 42;\nexport default value;\n' },
    { ext: 'js', sample: 'function greet(name) { return name.toUpperCase(); }\n' },
    { ext: 'py', sample: 'def greet(name):\n    return name.upper()\n' },
    { ext: 'json', sample: '{ "name": "sven", "ok": true }\n' },
    { ext: 'yaml', sample: 'name: sven\nenabled: true\n' },
    { ext: 'md', sample: '# Title\n\n- item\n' },
    { ext: 'sql', sample: 'SELECT id, name FROM users WHERE id = 1;\n' },
    { ext: 'sh', sample: 'echo "hello"\n' },
  ];

  await page.goto('/editor');

  for (const item of cases) {
    const filePath = `.tmp/e2e-editor-lang-${item.ext}.${item.ext}`;
    await api.put('/v1/admin/editor/file', {
      data: { path: filePath, content: item.sample, create_dirs: true },
    });

    await page.getByPlaceholder('Search across project...').fill(`e2e-editor-lang-${item.ext}`);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(`${filePath}:1`)).toBeVisible();
    await page.getByText(`${filePath}:1`).click();

    const line = page.locator('.cm-content .cm-line').first();
    await expect(line).toBeVisible();
    const highlightedSpans = line.locator('span');
    const spanCount = await highlightedSpans.count();
    expect(spanCount).toBeGreaterThan(0);
  }
});

test('admin editor file tree shows expected project structure @admin', async ({ page }) => {
  if (!ENABLE || !SESSION_COOKIE) {
    test.skip(true, 'ADMIN_UI_E2E or ADMIN_SESSION_COOKIE not set');
  }

  await ensureAuth(page);
  const api = page.request;

  await api.put('/v1/admin/editor/file', {
    data: {
      path: '.tmp/e2e-tree/alpha/file-a.txt',
      content: 'A',
      create_dirs: true,
    },
  });
  await api.put('/v1/admin/editor/file', {
    data: {
      path: '.tmp/e2e-tree/beta/nested/file-b.txt',
      content: 'B',
      create_dirs: true,
    },
  });

  await page.goto('/editor');

  const workspaceCard = page.locator('.card').first();
  await expect(workspaceCard.getByRole('button', { name: 'Refresh' })).toBeVisible();

  await expect(workspaceCard.getByRole('button', { name: '.tmp' })).toBeVisible();
  await workspaceCard.getByRole('button', { name: '.tmp' }).click();
  await expect(workspaceCard.getByRole('button', { name: 'e2e-tree' })).toBeVisible();

  await workspaceCard.getByRole('button', { name: 'e2e-tree' }).click();
  await expect(workspaceCard.getByRole('button', { name: 'alpha' })).toBeVisible();
  await expect(workspaceCard.getByRole('button', { name: 'beta' })).toBeVisible();

  await workspaceCard.getByRole('button', { name: 'alpha' }).click();
  await expect(workspaceCard.getByRole('button', { name: 'file-a.txt' })).toBeVisible();

  await workspaceCard.getByRole('button', { name: 'beta' }).click();
  await expect(workspaceCard.getByRole('button', { name: 'nested' })).toBeVisible();
});
