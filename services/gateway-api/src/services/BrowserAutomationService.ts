import { createLogger } from '@sven/shared';
import { v7 as uuidv7 } from 'uuid';
import { Pool } from 'pg';
import { mkdir, access, readFile, stat } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const logger = createLogger('browser-automation');

type PageHandle = any;
type BrowserContextHandle = any;
type BrowserHandle = any;

interface ProfileRuntime {
  context: BrowserContextHandle;
  page: PageHandle;
  sessionId: string;
  storageStatePath: string;
  networkCaptureEnabled: boolean;
  networkEvents: Array<Record<string, unknown>>;
}

export class BrowserAutomationService {
  private browser: BrowserHandle | null = null;
  private runtimes = new Map<string, ProfileRuntime>();

  constructor(private pool: Pool) {}

  async status(): Promise<{ browser_started: boolean; active_profiles: number }> {
    return {
      browser_started: this.browser !== null,
      active_profiles: this.runtimes.size,
    };
  }

  async start(): Promise<{ started: true; active_profiles: number }> {
    await this.ensureBrowser();
    return {
      started: true,
      active_profiles: this.runtimes.size,
    };
  }

  async stop(profileId?: string, organizationId?: string): Promise<{ stopped: true; profile_id?: string; active_profiles: number }> {
    if (profileId) {
      if (!organizationId) throw new Error('organizationId is required for profile stop');
      await this.stopProfile(profileId, organizationId);
      return {
        stopped: true,
        profile_id: profileId,
        active_profiles: this.runtimes.size,
      };
    }
    await this.stopAll();
    return {
      stopped: true,
      active_profiles: this.runtimes.size,
    };
  }

  async restart(): Promise<{ restarted: true; active_profiles: number }> {
    await this.stopAll();
    await this.ensureBrowser();
    return {
      restarted: true,
      active_profiles: this.runtimes.size,
    };
  }

  async listProfiles(organizationId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT id, name, storage_path, created_at, last_used, organization_id
       FROM browser_profiles
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return res.rows;
  }

  async createProfile(name: string, organizationId: string): Promise<any> {
    const id = uuidv7();
    const storagePath = `profiles/${id}`;
    await this.pool.query(
      `INSERT INTO browser_profiles (id, organization_id, name, storage_path, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, organizationId, name, storagePath],
    );
    return { id, organization_id: organizationId, name, storage_path: storagePath };
  }

  async navigate(profileId: string, url: string, organizationId: string): Promise<any> {
    await this.assertAllowedUrl(url, organizationId);
    const runtime = await this.getOrCreateRuntime(profileId, organizationId);

    await runtime.page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await runtime.page.title();

    await this.pool.query(
      `UPDATE browser_profiles SET last_used = NOW() WHERE id = $1`,
      [profileId],
    );
    await this.pool.query(
      `UPDATE browser_sessions SET pages_visited = pages_visited + 1 WHERE id = $1`,
      [runtime.sessionId],
    );
    await this.persistRuntime(profileId);

    return { url: runtime.page.url(), title };
  }

  async snapshot(profileId: string, organizationId: string, fullPage = true, selector?: string): Promise<any> {
    const runtime = await this.getOrCreateRuntime(profileId, organizationId);
    let imageBuffer: Buffer;
    if (selector) {
      const handle = await runtime.page.$(selector);
      if (!handle) {
        throw new Error(`Element not found for selector: ${selector}`);
      }
      imageBuffer = await handle.screenshot({ type: 'png' });
    } else {
      imageBuffer = await runtime.page.screenshot({ fullPage, type: 'png' });
    }
    const b64 = Buffer.from(imageBuffer).toString('base64');
    return { mime_type: 'image/png', data_base64: b64 };
  }

  async action(profileId: string, action: string, payload: Record<string, any>, organizationId: string): Promise<any> {
    const runtime = await this.getOrCreateRuntime(profileId, organizationId);
    const page = runtime.page;

    switch (action) {
      case 'click':
        await page.click(payload.selector);
        await this.persistRuntime(profileId);
        return { ok: true };
      case 'type':
        await page.fill(payload.selector, payload.text || '');
        await this.persistRuntime(profileId);
        return { ok: true };
      case 'fill_form': {
        const fields = Array.isArray(payload.fields) ? payload.fields : [];
        for (const field of fields) {
          if (!field?.selector) continue;
          await page.fill(field.selector, String(field.value || ''));
        }
        await this.persistRuntime(profileId);
        return { ok: true, fields: fields.length };
      }
      case 'select':
        await page.selectOption(payload.selector, payload.value);
        await this.persistRuntime(profileId);
        return { ok: true };
      case 'wait':
        if (payload.selector) {
          await page.waitForSelector(payload.selector, {
            timeout: Number(payload.timeout_ms || 10000),
          });
        } else {
          await page.waitForTimeout(Number(payload.timeout_ms || 1000));
        }
        return { ok: true };
      case 'scroll':
        if (payload.selector) {
          const safeSelector = this.assertSafeSelector(payload.selector);
          await page.locator(safeSelector).first().evaluate((el: any) => el.scrollIntoView());
        } else {
          await page.evaluate(
            ({ x, y }: { x: number; y: number }) => (globalThis as any).window?.scrollTo(Number(x) || 0, Number(y) || 0),
            { x: payload.x || 0, y: payload.y || 0 },
          );
        }
        return { ok: true };
      case 'evaluate': {
        const script = String(payload.script || '');
        if (!script) throw new Error('script is required for evaluate');
        const result = await page.evaluate(
          (code: string) => {
            // eslint-disable-next-line no-new-func
            const fn = new Function(code);
            return fn();
          },
          script,
        );
        return { result };
      }
      case 'upload_file': {
        const selector = String(payload.selector || '');
        const rawPath = String(payload.file_path || '');
        if (!selector || !rawPath) {
          throw new Error('selector and file_path are required for upload_file');
        }
        const resolvedPath = resolve(rawPath);
        const allowedUploadRoot = resolve(process.env.SVEN_BROWSER_UPLOAD_ROOT || join(process.cwd(), 'uploads'));
        if (resolvedPath !== allowedUploadRoot && !resolvedPath.startsWith(allowedUploadRoot + '/')) {
          throw new Error('file_path must be within the uploads directory');
        }
        await page.setInputFiles(selector, resolvedPath);
        await this.persistRuntime(profileId);
        return { ok: true };
      }
      case 'open_tab': {
        const nextUrl = payload.url ? String(payload.url) : '';
        if (nextUrl) {
          await this.assertAllowedUrl(nextUrl, organizationId);
        }
        const newPage = await runtime.context.newPage();
        if (nextUrl) {
          await newPage.goto(nextUrl, { waitUntil: 'domcontentloaded' });
          await this.pool.query(
            `UPDATE browser_sessions SET pages_visited = pages_visited + 1 WHERE id = $1`,
            [runtime.sessionId],
          );
        }
        runtime.page = newPage;
        await this.persistRuntime(profileId);
        return {
          ok: true,
          active_tab: (await runtime.context.pages()).length - 1,
          url: nextUrl || 'about:blank',
        };
      }
      case 'list_tabs': {
        const pages = await runtime.context.pages();
        const tabs = await Promise.all(
          pages.map(async (p: any, index: number) => ({
            index,
            url: p.url(),
            title: await p.title(),
            active: p === runtime.page,
          })),
        );
        return { tabs };
      }
      case 'switch_tab': {
        const targetIndex = Number(payload.index);
        if (!Number.isInteger(targetIndex) || targetIndex < 0) {
          throw new Error('index must be a non-negative integer for switch_tab');
        }
        const pages = await runtime.context.pages();
        if (!pages[targetIndex]) {
          throw new Error(`Tab index out of range: ${targetIndex}`);
        }
        runtime.page = pages[targetIndex];
        return { ok: true, active_tab: targetIndex, url: runtime.page.url() };
      }
      case 'close_tab': {
        const requested = payload.index;
        const pages = await runtime.context.pages();
        const targetIndex =
          requested === undefined || requested === null
            ? pages.findIndex((p: any) => p === runtime.page)
            : Number(requested);
        if (!Number.isInteger(targetIndex) || targetIndex < 0 || !pages[targetIndex]) {
          throw new Error(`Tab index out of range: ${String(requested)}`);
        }
        const target = pages[targetIndex];
        await target.close();
        const remaining = await runtime.context.pages();
        if (remaining.length === 0) {
          runtime.page = await runtime.context.newPage();
        } else if (target === runtime.page) {
          runtime.page = remaining[Math.min(targetIndex, remaining.length - 1)];
        }
        await this.persistRuntime(profileId);
        return { ok: true, active_tab: Math.max(0, Math.min(targetIndex, remaining.length - 1)) };
      }
      case 'pdf': {
        const pdfBuffer = await page.pdf({
          format: payload.format ? String(payload.format) : 'A4',
          printBackground: payload.print_background !== false,
          landscape: Boolean(payload.landscape),
        });
        return {
          mime_type: 'application/pdf',
          data_base64: Buffer.from(pdfBuffer).toString('base64'),
        };
      }
      case 'download_file': {
        const timeoutMs = Number(payload.timeout_ms || 15000);
        const selector = payload.selector ? String(payload.selector) : '';
        const nextUrl = payload.url ? String(payload.url) : '';
        if (!selector && !nextUrl) {
          throw new Error('selector or url is required for download_file');
        }
        if (nextUrl) {
          await this.assertAllowedUrl(nextUrl, organizationId);
        }

        const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs });
        if (selector) {
          await page.click(selector);
        } else {
          await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
        }
        const download = await downloadPromise;
        const downloadDir = await this.getDownloadDir(profileId);
        const filename = download.suggestedFilename();
        const filePath = join(downloadDir, filename);
        await download.saveAs(filePath);
        const fileStats = await stat(filePath);
        const fileBuffer = await readFile(filePath);
        return {
          file_path: filePath,
          file_name: filename,
          file_size: fileStats.size,
          mime_type: guessMimeType(filename),
          data_base64: fileBuffer.toString('base64'),
        };
      }
      case 'network_intercept': {
        const mode = String(payload.mode || '').toLowerCase();
        if (mode === 'start') {
          runtime.networkCaptureEnabled = true;
          runtime.networkEvents = [];
          return { ok: true, mode: 'start' };
        }
        if (mode === 'stop') {
          runtime.networkCaptureEnabled = false;
          return { ok: true, mode: 'stop', events_captured: runtime.networkEvents.length };
        }
        if (mode === 'get') {
          const limit = Number(payload.limit || 200);
          return {
            ok: true,
            events: runtime.networkEvents.slice(0, Math.max(1, limit)),
            events_captured: runtime.networkEvents.length,
          };
        }
        throw new Error('mode must be one of: start, stop, get');
      }
      case 'get_text': {
        const text = payload.selector
          ? await page.textContent(payload.selector)
          : await page.evaluate(() => (globalThis as any).document?.body?.innerText || '');
        return { text: text || '' };
      }
      case 'get_html': {
        const html = payload.selector
          ? await page.locator(this.assertSafeSelector(payload.selector)).first().evaluate((el: any) => el.outerHTML)
          : await page.content();
        return { html: html || '' };
      }
      default:
        throw new Error(`Unsupported browser action: ${action}`);
    }
  }

  private async getOrCreateRuntime(profileId: string, organizationId: string): Promise<ProfileRuntime> {
    const existing = this.runtimes.get(profileId);
    if (existing) {
      await this.assertProfileAccess(profileId, organizationId);
      return existing;
    }

    await this.ensureBrowser();
    const storageStatePath = await this.getStorageStatePath(profileId, organizationId);
    const hasStorage = await this.fileExists(storageStatePath);
    const context = await this.browser!.newContext(
      hasStorage
        ? {
            storageState: storageStatePath,
            acceptDownloads: true,
          }
        : { acceptDownloads: true },
    );
    const page = await context.newPage();
    const sessionId = uuidv7();

    await this.pool.query(
      `INSERT INTO browser_sessions (id, profile_id, started_at, pages_visited)
       VALUES ($1, $2, NOW(), 0)`,
      [sessionId, profileId],
    );

    const runtime: ProfileRuntime = {
      context,
      page,
      sessionId,
      storageStatePath,
      networkCaptureEnabled: false,
      networkEvents: [],
    };
    context.on('request', (req: any) => {
      if (!runtime.networkCaptureEnabled) return;
      if (runtime.networkEvents.length >= 1000) return;
      runtime.networkEvents.push({
        phase: 'request',
        method: req.method(),
        url: req.url(),
        ts: Date.now(),
      });
    });
    context.on('response', (res: any) => {
      if (!runtime.networkCaptureEnabled) return;
      if (runtime.networkEvents.length >= 1000) return;
      runtime.networkEvents.push({
        phase: 'response',
        status: res.status(),
        url: res.url(),
        ts: Date.now(),
      });
    });
    this.runtimes.set(profileId, runtime);
    return runtime;
  }

  private async stopProfile(profileId: string, organizationId?: string): Promise<void> {
    if (organizationId) {
      await this.assertProfileAccess(profileId, organizationId);
    }
    const runtime = this.runtimes.get(profileId);
    if (!runtime) return;
    this.runtimes.delete(profileId);
    await this.persistRuntime(profileId, runtime);
    await this.pool.query(
      `UPDATE browser_sessions SET ended_at = NOW() WHERE id = $1`,
      [runtime.sessionId],
    );
    try {
      await runtime.page.close();
    } catch {
      // best effort
    }
    try {
      await runtime.context.close();
    } catch {
      // best effort
    }
  }

  private async stopAll(): Promise<void> {
    const runtimeEntries = Array.from(this.runtimes.entries());
    for (const [profileId] of runtimeEntries) {
      // eslint-disable-next-line no-await-in-loop
      await this.stopProfile(profileId);
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // best effort
      }
      this.browser = null;
      logger.info('Browser stopped');
    }
  }

  private async persistRuntime(profileId: string, runtime?: ProfileRuntime): Promise<void> {
    const active = runtime || this.runtimes.get(profileId);
    if (!active) return;
    await active.context.storageState({ path: active.storageStatePath });
  }

  private async getStorageStatePath(profileId: string, organizationId: string): Promise<string> {
    const profile = await this.assertProfileAccess(profileId, organizationId);
    const storagePath = String(profile.storage_path || '').trim();
    if (!storagePath) {
      throw new Error(`Invalid storage path for profile: ${profileId}`);
    }
    const profileDir = join(process.cwd(), '.browser', storagePath);
    await mkdir(profileDir, { recursive: true });
    return join(profileDir, 'storage-state.json');
  }

  private async getDownloadDir(profileId: string): Promise<string> {
    const path = join(process.cwd(), '.browser', 'downloads', profileId);
    await mkdir(path, { recursive: true });
    return path;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (this.browser) return;
    if (process.env.BROWSER_ENFORCE_CONTAINER === 'true' && !this.isLikelyContainerRuntime()) {
      throw new Error('Browser runtime requires container execution when BROWSER_ENFORCE_CONTAINER=true');
    }
    try {
      const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
      const playwright = await dynamicImport('@playwright/test');
      const chromium = (playwright as any).chromium;
      const proxyServer = process.env.EGRESS_PROXY_URL || process.env.BROWSER_PROXY_URL || '';
      this.browser = await chromium.launch({
        headless: process.env.BROWSER_HEADLESS !== 'false',
        ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
      });
      logger.info('Browser launched');
    } catch (err) {
      logger.error('Failed to launch browser', { err: String(err) });
      throw new Error('Browser runtime unavailable. Ensure @playwright/test is installed and browsers are provisioned.');
    }
  }

  private async assertAllowedUrl(rawUrl: string, organizationId: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https URLs are allowed');
    }

    const host = parsed.hostname.toLowerCase();
    if (this.isRawIp(host)) {
      throw new Error('Raw IP navigation is blocked');
    }

    const allowRes = await this.pool.query(
      `SELECT pattern FROM allowlists
       WHERE (organization_id = $1 OR organization_id IS NULL)
         AND type = 'web_domain' AND enabled = TRUE`,
      [organizationId],
    );
    const patterns = allowRes.rows.map((r) => String(r.pattern).toLowerCase());
    if (patterns.length === 0) {
      throw new Error('No web_domain allowlist configured for browser navigation');
    }

    if (!this.matchesAllowlist(host, patterns)) {
      throw new Error(`Domain not allowlisted: ${host}`);
    }
  }

  private assertSafeSelector(selector: any): string {
    const sel = String(selector || '').trim();
    if (!sel) throw new Error('Selector cannot be empty');
    if (/[<>{}\n\r]/.test(sel) || sel.includes('javascript=')) {
      throw new Error('Invalid characters or patterns in selector');
    }
    return sel;
  }

  private matchesAllowlist(host: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern === '*') return true;
      if (host === pattern) return true;
      if (host.endsWith(`.${pattern}`)) return true;
    }
    return false;
  }

  private isRawIp(host: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  }

  private isLikelyContainerRuntime(): boolean {
    if (process.env.KUBERNETES_SERVICE_HOST) return true;
    if (existsSync('/.dockerenv')) return true;
    if (existsSync('/run/.containerenv')) return true;
    return false;
  }

  private async assertProfileAccess(
    profileId: string,
    organizationId: string,
  ): Promise<{ storage_path: string | null }> {
    const res = await this.pool.query(
      `SELECT storage_path
       FROM browser_profiles
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1`,
      [profileId, organizationId],
    );
    if (res.rows.length === 0) {
      throw new Error(`Browser profile not found: ${profileId}`);
    }
    return {
      storage_path: res.rows[0].storage_path ?? null,
    };
  }
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}
