import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('desktop tauri companion shell renders core controls @desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sven Companion Desktop (Tauri)')).toBeVisible();
  await expect(page.getByLabel('Gateway URL')).toBeVisible();
  await expect(page.getByLabel('Chat ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Config' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Device Login' })).toBeVisible();
});

test('desktop tauri companion shell has no critical/serious a11y violations @desktop', async ({
  page,
}) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
});
