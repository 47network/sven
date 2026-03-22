import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const ADMIN_WEB = path.resolve(__dirname, '../routes/admin/web.ts');
const ADAPTER_ROUTE = path.resolve(__dirname, '../routes/adapter.ts');
const WIDGET_ADAPTER = path.resolve(__dirname, '../../../adapter-webchat/src/index.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/140_web_widget_embed.sql');

describe('D7 Embeddable Chat Widget', () => {
  it('provides admin widget settings/instances/embed endpoints', async () => {
    const source = await fs.readFile(ADMIN_WEB, 'utf8');
    expect(source.includes('/web/widget/settings')).toBe(true);
    expect(source.includes('/web/widget/instances')).toBe(true);
    expect(source.includes('/web/widget/embed/:instanceId')).toBe(true);
    expect(source.includes('embed_snippet')).toBe(true);
  });

  it('enforces per-instance widget rate limiting on adapter ingest', async () => {
    const source = await fs.readFile(ADAPTER_ROUTE, 'utf8');
    expect(source.includes('validateAndConsumeWidgetRateLimit')).toBe(true);
    expect(source.includes('WIDGET_RATE_LIMITED')).toBe(true);
    expect(source.includes('widget_instance_key')).toBe(true);
  });

  it('serves script-tag widget bootstrap with customization + session persistence', async () => {
    const source = await fs.readFile(WIDGET_ADAPTER, 'utf8');
    expect(source.includes('/widget.js')).toBe(true);
    expect(source.includes('SvenWidgetConfig')).toBe(true);
    expect(source.includes('localStorage')).toBe(true);
    expect(source.includes('d.apiKey')).toBe(true);
    expect(source.includes('d.endpoint')).toBe(true);
  });

  it('migration defines widget settings and instance keys tables', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('CREATE TABLE IF NOT EXISTS web_widget_settings')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS web_widget_instances')).toBe(true);
    expect(migration.includes('rate_limit_rpm')).toBe(true);
  });
});
