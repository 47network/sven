import type pg from 'pg';

export type FirecrawlConfig = {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
};

export class FirecrawlRequestError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Firecrawl request failed (status ${status})`);
    this.name = 'FirecrawlRequestError';
    this.status = status;
    this.detail = detail;
  }
}

type ParseSettingValue = <T>(value: unknown) => T | null;
type ResolveSecretRef = (ref: string) => Promise<string>;
type LoadSettingsMap = (keys: string[]) => Promise<Map<string, unknown>>;

export function isCaptchaChallengeContent(value: unknown): boolean {
  const text = String(value || '').toLowerCase();
  if (!text) return false;
  const signals = [
    'captcha',
    'verify you are human',
    'are you human',
    'attention required',
    'cloudflare',
    'bot protection',
    'press and hold',
    'security check',
  ];
  return signals.some((signal) => text.includes(signal));
}

export function shouldRetryWithFirecrawl(error: unknown): boolean {
  const message = String(
    error instanceof Error ? error.message : error ?? '',
  ).toLowerCase();
  if (!message) return false;
  if (message.includes('http 403') || message.includes('forbidden')) return true;
  if (isCaptchaChallengeContent(message)) return true;
  return false;
}

export async function getWebFetchFirecrawlConfig(
  pool: pg.Pool,
  deps: {
    parseSettingValue: ParseSettingValue;
    resolveSecretRef: ResolveSecretRef;
    loadSettingsMap?: LoadSettingsMap;
    env?: NodeJS.ProcessEnv;
    warn?: (message: string, meta?: Record<string, unknown>) => void;
  },
): Promise<FirecrawlConfig> {
  const env = deps.env || process.env;
  let enabled = String(env.FIRECRAWL_ENABLED || '').toLowerCase() === 'true';
  let apiUrl = env.FIRECRAWL_API_URL?.trim();
  let apiKey = env.FIRECRAWL_API_KEY?.trim();

  try {
    const keys = ['webFetch.firecrawlEnabled', 'webFetch.firecrawlApiUrl', 'webFetch.firecrawlApiKeyRef'];
    const settings = deps.loadSettingsMap
      ? await deps.loadSettingsMap(keys)
      : (() => new Map<string, unknown>())();
    if (!deps.loadSettingsMap) {
      const settingsRes = await pool.query(
        `SELECT key, value
         FROM settings_global
         WHERE key = ANY($1::text[])`,
        [keys],
      );
      for (const row of settingsRes.rows) settings.set(String(row.key), row.value);
    }

    const enabledSetting = deps.parseSettingValue<boolean | string>(settings.get('webFetch.firecrawlEnabled'));
    if (typeof enabledSetting === 'boolean') enabled = enabledSetting;
    if (typeof enabledSetting === 'string') enabled = enabledSetting.toLowerCase() === 'true';

    const urlSetting = deps.parseSettingValue<string>(settings.get('webFetch.firecrawlApiUrl'))?.trim();
    if (urlSetting) apiUrl = urlSetting;

    const keyRef = deps.parseSettingValue<string>(settings.get('webFetch.firecrawlApiKeyRef'))?.trim();
    if (keyRef) {
      try {
        apiKey = await deps.resolveSecretRef(keyRef);
      } catch (err) {
        deps.warn?.('Failed to resolve Firecrawl API key reference', { err: String(err) });
      }
    }
  } catch {
    // Use environment values only.
  }

  return {
    enabled,
    apiUrl: apiUrl || undefined,
    apiKey: apiKey || undefined,
  };
}

export async function fetchWithFirecrawl(
  config: FirecrawlConfig,
  url: string,
  extractHtml: boolean,
  maxContentLength: number = 10 * 1024 * 1024,
): Promise<Record<string, unknown>> {
  if (!config.enabled || !config.apiUrl) {
    throw new Error('Firecrawl fallback is disabled');
  }

  const endpoint = new URL('/v1/scrape', config.apiUrl).toString();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      url,
      formats: extractHtml ? ['markdown', 'html'] : ['markdown'],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let filtered = '';
    for (const ch of String(text || '')) {
      const code = ch.charCodeAt(0);
      filtered += (code <= 31 || code === 127) ? ' ' : ch;
    }
    const detail = filtered.replace(/\s+/g, ' ').trim().slice(0, 512);
    throw new FirecrawlRequestError(response.status, detail);
  }

  const data = await response.json() as any;
  const payload = data?.data || data || {};
  const markdown = String(payload.markdown || '');
  const html = String(payload.html || '');
  const metadata = payload.metadata || {};
  const contentLength = markdown.length + html.length;
  if (contentLength > maxContentLength) {
    throw new Error(`Content too large: ${contentLength} bytes (max ${maxContentLength})`);
  }

  return {
    url,
    status: 200,
    title: String(metadata.title || ''),
    description: String(metadata.description || ''),
    author: String(metadata.author || ''),
    textContent: markdown,
    htmlContent: extractHtml ? html.slice(0, 65536) : undefined,
    contentLength,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    backend: 'firecrawl',
  };
}

export async function fetchWebWithOptionalFirecrawl(
  args: {
    url: string;
    directFetch: () => Promise<Record<string, unknown>>;
    loadConfig: () => Promise<FirecrawlConfig>;
    fetchFallback: (config: FirecrawlConfig) => Promise<Record<string, unknown>>;
  },
): Promise<Record<string, unknown>> {
  try {
    const result = await args.directFetch();
    if (
      isCaptchaChallengeContent(result.title) ||
      isCaptchaChallengeContent(result.textContent)
    ) {
      throw new Error('captcha challenge detected in direct fetch');
    }
    return {
      ...result,
      backend: 'direct',
    };
  } catch (err) {
    if (!shouldRetryWithFirecrawl(err)) {
      throw err;
    }
    const config = await args.loadConfig();
    if (!config.enabled || !config.apiUrl) {
      throw err;
    }
    return args.fetchFallback(config);
  }
}
