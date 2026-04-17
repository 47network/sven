import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* ── Dashboard (main page) ─────────────────────────────────── */

test('trading dashboard loads without errors @trading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.getByText('Sven Trading')).toBeVisible();
  expect(errors).toEqual([]);
});

test('dashboard renders header with status indicator @trading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sven Trading')).toBeVisible();
  await expect(page.getByText('trading.sven.systems')).toBeVisible();
});

test('dashboard renders sidebar with watchlist @trading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Watchlist')).toBeVisible();
  await expect(page.getByText('Positions')).toBeVisible();
  await expect(page.getByText('Orders')).toBeVisible();
});

test('dashboard has trade button @trading', async ({ page }) => {
  await page.goto('/');
  const tradeBtn = page.getByRole('button', { name: /trade/i });
  await expect(tradeBtn).toBeVisible();
});

test('trade button opens order ticket @trading', async ({ page }) => {
  await page.goto('/');
  const tradeBtn = page.getByRole('button', { name: /trade/i });
  await tradeBtn.click();
  await expect(page.getByText('Order Ticket')).toBeVisible();
});

test('dashboard has no critical a11y violations @trading', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
});

/* ── Sven Autonomous page ──────────────────────────────────── */

test('sven page loads with controls @trading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/sven');
  await expect(page.getByText('Sven Autonomous Trading')).toBeVisible();
  await expect(page.getByText('Trigger Decision')).toBeVisible();
  await expect(page.getByText('Run Kronos')).toBeVisible();
  await expect(page.getByText('Run MiroFish')).toBeVisible();
  expect(errors).toEqual([]);
});

test('sven page has back link to dashboard @trading', async ({ page }) => {
  await page.goto('/sven');
  const backLink = page.getByRole('link', { name: /dashboard/i });
  await expect(backLink).toBeVisible();
});

/* ── Backtest page ─────────────────────────────────────────── */

test('backtest page loads with configuration form @trading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/backtest');
  await expect(page.getByText('Strategy Backtesting')).toBeVisible();
  expect(errors).toEqual([]);
});

test('backtest page has no critical a11y violations @trading', async ({ page }) => {
  await page.goto('/backtest');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
});

/* ── Analytics page ────────────────────────────────────────── */

test('analytics page loads with metrics @trading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/analytics');
  await expect(page.getByText('Portfolio Analytics')).toBeVisible();
  expect(errors).toEqual([]);
});

test('analytics page has no critical a11y violations @trading', async ({ page }) => {
  await page.goto('/analytics');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
});

/* ── Alerts page ───────────────────────────────────────────── */

test('alerts page loads with creation form @trading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/alerts');
  await expect(page.getByText('Trading Alerts')).toBeVisible();
  await expect(page.getByText('Create Alert')).toBeVisible();
  expect(errors).toEqual([]);
});

test('alerts page has no critical a11y violations @trading', async ({ page }) => {
  await page.goto('/alerts');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severe = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
});

/* ── Cross-page navigation ─────────────────────────────────── */

test('navigation between all pages works @trading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sven Trading')).toBeVisible();

  await page.goto('/sven');
  await expect(page.getByText('Sven Autonomous Trading')).toBeVisible();

  await page.goto('/backtest');
  await expect(page.getByText('Strategy Backtesting')).toBeVisible();

  await page.goto('/analytics');
  await expect(page.getByText('Portfolio Analytics')).toBeVisible();

  await page.goto('/alerts');
  await expect(page.getByText('Trading Alerts')).toBeVisible();
});
