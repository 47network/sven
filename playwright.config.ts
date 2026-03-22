import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const hasDesktopTauri = fs.existsSync('apps/companion-desktop-tauri');
const adminPort = Number(process.env.ADMIN_UI_PORT || '3100');
const canvasPort = Number(process.env.CANVAS_UI_PORT || '3200');
const adminBasePath = process.env.ADMIN_BASE_PATH || '/admin47';
const normalizedAdminBasePath = adminBasePath === '/' ? '' : adminBasePath.replace(/\/$/, '');
const adminOrigin = `http://127.0.0.1:${adminPort}`;
const adminBaseUrl = `${adminOrigin}${normalizedAdminBasePath}`;
const canvasBaseUrl = `http://127.0.0.1:${canvasPort}`;

const projects: Array<{ name: string; use: { baseURL: string }; grep: RegExp }> = [
  {
    name: 'admin-web',
    use: { baseURL: adminBaseUrl },
    grep: /@admin/,
  },
  {
    name: 'canvas-web',
    use: { baseURL: canvasBaseUrl },
    grep: /@canvas/,
  },
];

const webServer: Array<{ command: string; url: string; reuseExistingServer: boolean; timeout: number }> = [
  {
    command: `set PLAYWRIGHT=1 && cd apps/admin-ui && npx next dev --port ${adminPort}`,
    url: `${adminBaseUrl}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    command: `npm --workspace apps/canvas-ui run dev -- --port ${canvasPort}`,
    url: `${canvasBaseUrl}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
];

if (hasDesktopTauri) {
  projects.push({
    name: 'desktop-tauri-web',
    use: { baseURL: 'http://127.0.0.1:4173' },
    grep: /@desktop/,
  });

  webServer.push({
    command: 'npm --workspace apps/companion-desktop-tauri run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  });
}

export default defineConfig({
  testDir: './tests/e2e/ui',
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
  webServer,
});
