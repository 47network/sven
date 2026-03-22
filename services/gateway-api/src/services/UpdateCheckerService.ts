import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('update-checker');
const DEFAULT_INTERVAL_HOURS = 24;
const MAX_TIMER_INTERVAL_MS = 2_147_483_647;
export const UPDATE_CHECKER_MIN_INTERVAL_HOURS = 1;
export const UPDATE_CHECKER_MAX_INTERVAL_HOURS = Math.floor(MAX_TIMER_INTERVAL_MS / (60 * 60 * 1000));
export const UPDATE_CHECKER_MAX_NOTES_LENGTH = 16_000;
const UPDATE_CHECKER_FEED_TIMEOUT_MS_DEFAULT = 10_000;
const UPDATE_CHECKER_FEED_TIMEOUT_MS_MIN = 100;
const UPDATE_CHECKER_FEED_TIMEOUT_MS_MAX = 120_000;
const UPDATE_CHECKER_FEED_RETRY_COUNT_DEFAULT = 1;
const UPDATE_CHECKER_FEED_RETRY_COUNT_MIN = 0;
const UPDATE_CHECKER_FEED_RETRY_COUNT_MAX = 5;
const UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS_DEFAULT = 250;
const UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS_MIN = 50;
const UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS_MAX = 5_000;
const UPDATE_CHECKER_NOTES_TRUNCATION_MARKER = '\n...[truncated]';
const UPDATE_CHECKER_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
]);
const UPDATE_CHECKER_BLOCKED_IP_LITERALS = new Set([
  '169.254.169.254',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '100.100.100.100',
]);
const DEFAULT_FEED_URL =
  process.env.SVEN_UPDATE_FEED_URL ||
  'https://api.github.com/repos/47matrix/openclaw-sven/releases/latest';

type UpdateFeedPayload = {
  version?: string;
  url?: string;
  notes?: string;
  published_at?: string;
  tag_name?: string;
  html_url?: string;
  body?: string;
};

type UpdateStatus = {
  enabled: boolean;
  intervalHours: number;
  feedUrl: string;
  lastCheckedAt: string | null;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  latestNotes: string | null;
  latestPublishedAt: string | null;
  updateAvailable: boolean;
  dismissedVersion: string | null;
};

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

export class UpdateCheckerService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(private pool: pg.Pool) {}

  async start(): Promise<void> {
    this.running = true;
    try {
      await this.checkIfDue();
    } catch (err) {
      logger.warn('Initial update check failed', { err: String(err) });
    }
    this.scheduleNextTick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async getStatus(options?: { includeFullFeedUrl?: boolean }): Promise<UpdateStatus> {
    const settings = await this.getSettings();
    const currentVersion = getCurrentVersion();
    const latestVersion = readSettingString(settings, 'system.updateChecker.latest_version');
    const latestUrl = readSettingString(settings, 'system.updateChecker.latest_url');
    const latestNotes = readSettingString(settings, 'system.updateChecker.latest_notes');
    const latestPublishedAt = readSettingString(settings, 'system.updateChecker.latest_published_at');
    const lastCheckedAt = readSettingString(settings, 'system.updateChecker.last_checked_at');
    const dismissedVersion = readSettingString(settings, 'system.updateChecker.dismissed_version');
    const enabled = readSettingBool(settings, 'system.updateChecker.enabled', true);
    const intervalHours = readIntervalHoursSetting(settings, 'system.updateChecker.interval_hours', DEFAULT_INTERVAL_HOURS);
    const feedUrl = readSettingString(settings, 'system.updateChecker.feed_url') || DEFAULT_FEED_URL;
    const includeFullFeedUrl = options?.includeFullFeedUrl === true;
    const updateAvailable = computeUpdateAvailability(latestVersion, currentVersion, dismissedVersion);

    return {
      enabled,
      intervalHours,
      feedUrl: includeFullFeedUrl ? feedUrl : redactUpdateFeedUrl(feedUrl),
      lastCheckedAt,
      currentVersion,
      latestVersion,
      latestUrl,
      latestNotes,
      latestPublishedAt,
      updateAvailable,
      dismissedVersion,
    };
  }

  async checkIfDue(): Promise<void> {
    const settings = await this.getSettings();
    const enabled = readSettingBool(settings, 'system.updateChecker.enabled', true);
    if (!enabled) return;

    const lastCheckedAt = readSettingString(settings, 'system.updateChecker.last_checked_at');
    const intervalHours = readIntervalHoursSetting(settings, 'system.updateChecker.interval_hours', DEFAULT_INTERVAL_HOURS);
    if (lastCheckedAt) {
      const last = new Date(lastCheckedAt).getTime();
      if (!Number.isNaN(last)) {
        const nextDue = last + intervalHours * 60 * 60 * 1000;
        if (Date.now() < nextDue) return;
      }
    }

    await this.checkNow();
  }

  async checkNow(): Promise<UpdateStatus> {
    const settings = await this.getSettings();
    const enabled = readSettingBool(settings, 'system.updateChecker.enabled', true);
    if (!enabled) {
      throw new Error('UPDATE_CHECK_DISABLED: update checker is disabled');
    }
    const feedUrlRaw = readSettingString(settings, 'system.updateChecker.feed_url') || DEFAULT_FEED_URL;
    const feedHostAllowlist = resolveUpdateFeedHostAllowlist(process.env.SVEN_UPDATE_CHECKER_ALLOWED_HOSTS);
    const validatedFeedUrl = validateUpdateFeedUrl(feedUrlRaw, feedHostAllowlist);
    if (!validatedFeedUrl.ok) {
      throw new Error(validatedFeedUrl.error);
    }
    const feedUrl = validatedFeedUrl.url.toString();
    const dismissedVersion = readSettingString(settings, 'system.updateChecker.dismissed_version');
    const currentVersion = getCurrentVersion();

    let latestVersion: string | null = null;
    let latestUrl: string | null = null;
    let latestNotes: string | null = null;
    let latestPublishedAt: string | null = null;

    const response = await fetchUpdateFeedWithRetry(feedUrl);
    if (!response.ok) {
      throw new Error(`Update feed error: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as UpdateFeedPayload;

    latestVersion = String(payload.version || payload.tag_name || '').trim() || null;
    latestUrl = String(payload.url || payload.html_url || '').trim() || null;
    latestNotes = String(payload.notes || payload.body || '').trim() || null;
    latestNotes = truncateUpdateFeedNotes(latestNotes, UPDATE_CHECKER_MAX_NOTES_LENGTH);
    latestPublishedAt = String(payload.published_at || '').trim() || null;
    if (latestVersion) {
      ensureValidFeedVersion(latestVersion);
    }

    const updateAvailable = computeUpdateAvailability(latestVersion, currentVersion, dismissedVersion);

    const now = new Date().toISOString();
    await this.setSetting('system.updateChecker.last_checked_at', now);
    await this.setSetting('system.updateChecker.latest_version', latestVersion);
    if (latestUrl !== null) await this.setSetting('system.updateChecker.latest_url', latestUrl);
    if (latestNotes !== null) await this.setSetting('system.updateChecker.latest_notes', latestNotes);
    if (latestPublishedAt !== null) await this.setSetting('system.updateChecker.latest_published_at', latestPublishedAt);
    await this.setSetting('system.updateChecker.update_available', updateAvailable);

    return {
      enabled,
      intervalHours: readIntervalHoursSetting(settings, 'system.updateChecker.interval_hours', DEFAULT_INTERVAL_HOURS),
      feedUrl,
      lastCheckedAt: now,
      currentVersion,
      latestVersion,
      latestUrl,
      latestNotes,
      latestPublishedAt,
      updateAvailable,
      dismissedVersion,
    };
  }

  async dismiss(version: string): Promise<void> {
    const raw = String(version || '').trim();
    if (!raw) return;
    const canonicalDismissed = canonicalizeVersionForDismiss(raw);
    await this.setSetting('system.updateChecker.dismissed_version', canonicalDismissed);
    const latestVersion = readSettingString(await this.getSettings(), 'system.updateChecker.latest_version');
    if (latestVersion && isDismissedVersionEquivalent(latestVersion, canonicalDismissed)) {
      await this.setSetting('system.updateChecker.update_available', false);
    }
  }

  private async getSettings(): Promise<Map<string, unknown>> {
    const keys = [
      'system.updateChecker.enabled',
      'system.updateChecker.interval_hours',
      'system.updateChecker.feed_url',
      'system.updateChecker.last_checked_at',
      'system.updateChecker.latest_version',
      'system.updateChecker.latest_url',
      'system.updateChecker.latest_notes',
      'system.updateChecker.latest_published_at',
      'system.updateChecker.update_available',
      'system.updateChecker.dismissed_version',
    ];
    const res = await this.pool.query(
      `SELECT key, value FROM settings_global WHERE key = ANY($1::text[])`,
      [keys],
    );
    const rows = Array.isArray((res as { rows?: unknown[] } | null)?.rows)
      ? ((res as { rows: unknown[] }).rows as Array<{ key?: unknown; value?: unknown }>)
      : [];
    const map = new Map<string, unknown>();
    for (const row of rows) {
      const key = typeof row.key === 'string' ? row.key : String(row.key || '');
      if (!key) continue;
      map.set(key, parseSettingValue(row.value));
    }
    return map;
  }

  private async setSetting(key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings_global (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
  }

  private async getIntervalMs(): Promise<number> {
    const settings = await this.getSettings();
    const intervalHours = readIntervalHoursSetting(settings, 'system.updateChecker.interval_hours', DEFAULT_INTERVAL_HOURS);
    return intervalHours * 60 * 60 * 1000;
  }

  private scheduleNextTick(): void {
    if (!this.running) return;
    const schedule = async () => {
      if (!this.running) return;
      try {
        await this.checkIfDue();
      } catch (err) {
        logger.warn('Update check failed', { err: String(err) });
      }
      this.scheduleNextTick();
    };
    this.getIntervalMs()
      .then((intervalMs) => {
        if (!this.running) return;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          void schedule();
        }, intervalMs);
      })
      .catch((err) => {
        logger.warn('Failed to resolve update-check interval; using fallback', { err: String(err) });
        if (!this.running) return;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          void schedule();
        }, DEFAULT_INTERVAL_HOURS * 60 * 60 * 1000);
      });
  }
}

function redactUpdateFeedUrl(feedUrl: string): string {
  const value = String(feedUrl || '').trim();
  if (!value) return 'unknown';
  if (value === DEFAULT_FEED_URL) return 'default-feed';
  try {
    const parsed = new URL(value);
    const host = String(parsed.hostname || '').toLowerCase();
    if (isPrivateHost(host)) {
      return 'custom-feed-private';
    }
    return 'custom-feed-public';
  } catch {
    return 'custom-feed-configured';
  }
}

function isPrivateHost(host: string): boolean {
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '0.0.0.0' || host === '::1') return true;
  if (/^10\./.test(host)) return true;
  if (/^127\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function getCurrentVersion(): string {
  return String(process.env.SVEN_VERSION || process.env.npm_package_version || '0.1.0');
}

function parseSettingValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readSettingString(map: Map<string, unknown>, key: string): string | null {
  const value = map.get(key);
  if (value === undefined || value === null) return null;
  return String(value);
}

function readSettingBool(map: Map<string, unknown>, key: string, fallback: boolean): boolean {
  const value = map.get(key);
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function readSettingNumber(map: Map<string, unknown>, key: string, fallback: number): number {
  const value = map.get(key);
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readIntervalHoursSetting(map: Map<string, unknown>, key: string, fallback: number): number {
  const value = map.get(key);
  if (value === undefined || value === null || String(value).trim().length === 0) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid ${key}: expected a finite number between ${UPDATE_CHECKER_MIN_INTERVAL_HOURS} and ${UPDATE_CHECKER_MAX_INTERVAL_HOURS} hours`
    );
  }
  if (parsed < UPDATE_CHECKER_MIN_INTERVAL_HOURS || parsed > UPDATE_CHECKER_MAX_INTERVAL_HOURS) {
    throw new Error(
      `Invalid ${key}: expected a number between ${UPDATE_CHECKER_MIN_INTERVAL_HOURS} and ${UPDATE_CHECKER_MAX_INTERVAL_HOURS} hours`
    );
  }
  return parsed;
}

function truncateUpdateFeedNotes(notes: string | null, maxLength: number): string | null {
  if (!notes) return notes;
  if (notes.length <= maxLength) return notes;
  const marker = UPDATE_CHECKER_NOTES_TRUNCATION_MARKER;
  if (maxLength <= marker.length) return marker.slice(0, maxLength);
  return `${notes.slice(0, maxLength - marker.length)}${marker}`;
}

function isSemverLike(version: string): boolean {
  return parseSemver(version) !== null;
}

function canonicalizeVersionForDismiss(version: string): string {
  const value = String(version || '').trim();
  if (!value) return value;
  const parsed = parseSemver(value);
  if (!parsed) return value;
  const pre = parsed.prerelease.length > 0 ? `-${parsed.prerelease.join('.')}` : '';
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${pre}`;
}

function isDismissedVersionEquivalent(latestVersion: string | null, dismissedVersion: string | null): boolean {
  const latest = String(latestVersion || '').trim();
  const dismissed = String(dismissedVersion || '').trim();
  if (!latest || !dismissed) return false;
  if (isSemverLike(latest) && isSemverLike(dismissed)) {
    return compareSemver(latest, dismissed) === 0;
  }
  return latest === dismissed;
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateOrLocalIpv4(hostname: string): boolean {
  const octets = parseIpv4(hostname);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateOrLocalIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}

function isHostAllowlisted(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.some((entry) => {
    const normalized = entry.toLowerCase().trim();
    if (!normalized) return false;
    if (normalized === hostname) return true;
    if (normalized.startsWith('*.')) {
      const suffix = normalized.slice(1);
      return hostname.endsWith(suffix);
    }
    return false;
  });
}

function resolveUpdateFeedHostAllowlist(raw: unknown): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function validateUpdateFeedUrl(
  urlRaw: string,
  allowlist: string[],
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlRaw);
  } catch {
    return { ok: false, error: 'UPDATE_FEED_UNSAFE_TARGET: invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `UPDATE_FEED_UNSAFE_TARGET: unsupported scheme ${parsed.protocol}` };
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (!hostname) {
    return { ok: false, error: 'UPDATE_FEED_UNSAFE_TARGET: missing hostname' };
  }
  if (UPDATE_CHECKER_BLOCKED_HOSTNAMES.has(hostname) || UPDATE_CHECKER_BLOCKED_IP_LITERALS.has(hostname)) {
    return { ok: false, error: `UPDATE_FEED_UNSAFE_TARGET: blocked host ${hostname}` };
  }
  if (isPrivateOrLocalIpv4(hostname) || isPrivateOrLocalIpv6(hostname)) {
    return { ok: false, error: `UPDATE_FEED_UNSAFE_TARGET: private/local host ${hostname}` };
  }
  if (!isHostAllowlisted(hostname, allowlist)) {
    return { ok: false, error: `UPDATE_FEED_UNSAFE_TARGET: host ${hostname} not allowlisted` };
  }
  return { ok: true, url: parsed };
}

export function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) {
    throw new Error(`INVALID_SEMVER_COMPARE: "${a}" vs "${b}"`);
  }
  return compareParsedSemver(parsedA, parsedB);
}

function computeUpdateAvailability(latestVersion: string | null, currentVersion: string, dismissedVersion: string | null): boolean {
  if (!latestVersion) return false;
  const latestParsed = parseSemver(latestVersion);
  if (!latestParsed) return false;
  const currentParsed = parseSemver(currentVersion);
  if (!currentParsed) {
    logger.warn('Invalid current version semver for update comparison', { currentVersion });
    return false;
  }
  return compareParsedSemver(latestParsed, currentParsed) > 0 && !isDismissedVersionEquivalent(latestVersion, dismissedVersion);
}

function ensureValidFeedVersion(version: string): void {
  if (parseSemver(version)) return;
  throw new Error(`UPDATE_FEED_INVALID_VERSION: "${version}"`);
}

function parseSemver(version: string): ParsedSemver | null {
  const value = String(version || '').trim();
  if (!value) return null;
  const cleaned = value.replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2] || '0');
  const patch = Number(match[3] || '0');
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) return null;
  const prereleaseRaw = String(match[4] || '').trim();
  const prerelease = prereleaseRaw ? prereleaseRaw.split('.') : [];
  for (const token of prerelease) {
    if (!token || !/^[0-9A-Za-z-]+$/.test(token)) return null;
  }
  return { major, minor, patch, prerelease };
}

function compareParsedSemver(a: ParsedSemver, b: ParsedSemver): number {
  if (a.major > b.major) return 1;
  if (a.major < b.major) return -1;
  if (a.minor > b.minor) return 1;
  if (a.minor < b.minor) return -1;
  if (a.patch > b.patch) return 1;
  if (a.patch < b.patch) return -1;

  const aPre = a.prerelease;
  const bPre = b.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;

  const maxLen = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < maxLen; i += 1) {
    const ai = aPre[i];
    const bi = bPre[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    if (ai === bi) continue;
    const aiNum = /^\d+$/.test(ai);
    const biNum = /^\d+$/.test(bi);
    if (aiNum && biNum) {
      const an = Number(ai);
      const bn = Number(bi);
      if (an > bn) return 1;
      if (an < bn) return -1;
      continue;
    }
    if (aiNum && !biNum) return -1;
    if (!aiNum && biNum) return 1;
    return ai > bi ? 1 : -1;
  }
  return 0;
}

async function fetchUpdateFeedWithRetry(feedUrl: string): Promise<Response> {
  const timeoutMs = resolveUpdateFeedTimeoutMs();
  const retryCount = resolveUpdateFeedRetryCount();
  const retryBackoffMs = resolveUpdateFeedRetryBackoffMs();
  let lastError: unknown = null;
  const maxAttempts = retryCount + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchWithTimeout(feedUrl, timeoutMs);
    } catch (err) {
      lastError = err;
      if (!isRetryableUpdateFeedError(err) || attempt >= maxAttempts) {
        throw err;
      }
      await delay(retryBackoffMs * attempt);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(String(lastError || 'UPDATE_FEED_REQUEST_FAILED')));
}

async function fetchWithTimeout(feedUrl: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(feedUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`UPDATE_FEED_TIMEOUT: timed out after ${timeoutMs}ms`);
    }
    throw new Error(`UPDATE_FEED_REQUEST_FAILED: ${String(err instanceof Error ? err.message : err)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}

function isRetryableUpdateFeedError(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err || '').toLowerCase();
  return message.includes('update_feed_timeout') || message.includes('update_feed_request_failed');
}

function resolveUpdateFeedTimeoutMs(): number {
  return resolveBoundedIntEnv(
    'SVEN_UPDATE_CHECKER_FEED_TIMEOUT_MS',
    UPDATE_CHECKER_FEED_TIMEOUT_MS_DEFAULT,
    UPDATE_CHECKER_FEED_TIMEOUT_MS_MIN,
    UPDATE_CHECKER_FEED_TIMEOUT_MS_MAX,
  );
}

function resolveUpdateFeedRetryCount(): number {
  return resolveBoundedIntEnv(
    'SVEN_UPDATE_CHECKER_FEED_RETRY_COUNT',
    UPDATE_CHECKER_FEED_RETRY_COUNT_DEFAULT,
    UPDATE_CHECKER_FEED_RETRY_COUNT_MIN,
    UPDATE_CHECKER_FEED_RETRY_COUNT_MAX,
  );
}

function resolveUpdateFeedRetryBackoffMs(): number {
  return resolveBoundedIntEnv(
    'SVEN_UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS',
    UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS_DEFAULT,
    UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS_MIN,
    UPDATE_CHECKER_FEED_RETRY_BACKOFF_MS_MAX,
  );
}

function resolveBoundedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
