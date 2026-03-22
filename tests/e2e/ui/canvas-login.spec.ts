import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('canvas login renders correctly @canvas', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sven Canvas' })).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.locator('input#password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('canvas login has no critical/serious a11y violations @canvas', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
});
