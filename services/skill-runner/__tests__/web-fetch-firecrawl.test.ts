import {
  fetchWebWithOptionalFirecrawl,
  FirecrawlRequestError,
  fetchWithFirecrawl,
  getWebFetchFirecrawlConfig,
  isCaptchaChallengeContent,
  shouldRetryWithFirecrawl,
} from '../src/web-fetch-firecrawl';
import type pg from 'pg';

describe('web-fetch firecrawl fallback signals', () => {
  it('enables fallback for 403 responses', () => {
    expect(shouldRetryWithFirecrawl(new Error('HTTP 403: Forbidden'))).toBe(true);
  });

  it('enables fallback when captcha text is detected', () => {
    expect(
      isCaptchaChallengeContent('Attention Required! Please verify you are human'),
    ).toBe(true);
    expect(shouldRetryWithFirecrawl(new Error('captcha challenge detected in direct fetch'))).toBe(true);
  });

  it('does not fallback for unrelated errors', () => {
    expect(shouldRetryWithFirecrawl(new Error('HTTP 404: Not Found'))).toBe(false);
    expect(shouldRetryWithFirecrawl(new Error('Content too large'))).toBe(false);
  });
});

describe('web-fetch firecrawl config', () => {
  function poolWithRows(rows: Array<{ key: string; value: unknown }>): pg.Pool {
    return {
      query: async () => ({ rows }),
    } as unknown as pg.Pool;
  }

  it('respects admin settings and resolves API key reference', async () => {
    const pool = poolWithRows([
      { key: 'webFetch.firecrawlEnabled', value: true },
      { key: 'webFetch.firecrawlApiUrl', value: 'https://firecrawl.example' },
      { key: 'webFetch.firecrawlApiKeyRef', value: 'env:FIRECRAWL_TEST_KEY' },
    ]);

    const config = await getWebFetchFirecrawlConfig(pool, {
      parseSettingValue: (value) => value as any,
      resolveSecretRef: async () => 'secret-token',
      env: {},
    });

    expect(config.enabled).toBe(true);
    expect(config.apiUrl).toBe('https://firecrawl.example');
    expect(config.apiKey).toBe('secret-token');
  });

  it('stays disabled when setting is false', async () => {
    const pool = poolWithRows([
      { key: 'webFetch.firecrawlEnabled', value: false },
    ]);

    const config = await getWebFetchFirecrawlConfig(pool, {
      parseSettingValue: (value) => value as any,
      resolveSecretRef: async () => '',
      env: {},
    });

    expect(config.enabled).toBe(false);
  });
});

describe('web-fetch firecrawl fallback flow', () => {
  it('falls back when direct fetch fails with 403 and firecrawl is enabled', async () => {
    const result = await fetchWebWithOptionalFirecrawl({
      url: 'https://example.com/protected',
      directFetch: async () => {
        throw new Error('HTTP 403: Forbidden');
      },
      loadConfig: async () => ({ enabled: true, apiUrl: 'https://firecrawl.example' }),
      fetchFallback: async () => ({ backend: 'firecrawl', textContent: 'ok' }),
    });

    expect(result.backend).toBe('firecrawl');
    expect(result.textContent).toBe('ok');
  });

  it('does not fallback when firecrawl is disabled', async () => {
    await expect(
      fetchWebWithOptionalFirecrawl({
        url: 'https://example.com/protected',
        directFetch: async () => {
          throw new Error('HTTP 403: Forbidden');
        },
        loadConfig: async () => ({ enabled: false }),
        fetchFallback: async () => ({ backend: 'firecrawl' }),
      }),
    ).rejects.toThrow(/403/i);
  });
});

describe('web-fetch firecrawl size policy', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects fallback payloads above max_content_length budget', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          markdown: 'x'.repeat(110),
          html: '',
          metadata: {},
        },
      }),
    })) as any;

    await expect(
      fetchWithFirecrawl(
        { enabled: true, apiUrl: 'https://firecrawl.example', apiKey: 'secret' },
        'https://example.com',
        false,
        100,
      ),
    ).rejects.toThrow('Content too large');
  });

  it('accepts fallback payloads within max_content_length budget', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          markdown: 'ok',
          html: '',
          metadata: { title: 'Example' },
        },
      }),
    })) as any;

    const result = await fetchWithFirecrawl(
      { enabled: true, apiUrl: 'https://firecrawl.example' },
      'https://example.com',
      false,
      100,
    );

    expect(result.textContent).toBe('ok');
    expect(result.contentLength).toBe(2);
  });

  it('bounds upstream error detail and does not reflect raw body in thrown message', async () => {
    const oversizedBody = `SECRET_TOKEN=${'x'.repeat(2000)}`;
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => oversizedBody,
    })) as any;

    await expect(
      fetchWithFirecrawl(
        { enabled: true, apiUrl: 'https://firecrawl.example', apiKey: 'secret' },
        'https://example.com',
        false,
        100,
      ),
    ).rejects.toMatchObject({
      name: 'FirecrawlRequestError',
      message: 'Firecrawl request failed (status 502)',
      status: 502,
    } satisfies Partial<FirecrawlRequestError>);
  });
});
