import { describe, expect, it, jest } from '@jest/globals';
import { embedTextFromEnv, readEmbeddingsConfigFromEnv } from '../services/embeddings';

describe('embeddings provider support', () => {
  it('uses ollama endpoint and prompt payload', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    })) as any;
    (global as any).fetch = fetchMock;

    const env = {
      EMBEDDINGS_PROVIDER: 'ollama',
      EMBEDDINGS_URL: 'http://ollama:11434',
      EMBEDDINGS_MODEL: 'nomic-embed-text',
      EMBEDDINGS_DIM: '3',
      EMBEDDINGS_ENABLED: 'true',
    } as NodeJS.ProcessEnv;

    const embedding = await embedTextFromEnv('hello', env);
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ollama:11434/api/embeddings',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('uses openrouter endpoint and openai embeddings response format', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 2, 3] }] }),
    })) as any;
    (global as any).fetch = fetchMock;

    const env = {
      EMBEDDINGS_PROVIDER: 'openrouter',
      EMBEDDINGS_URL: 'https://openrouter.ai/api/v1',
      EMBEDDINGS_MODEL: 'openai/text-embedding-3-small',
      EMBEDDINGS_DIM: '3',
      OPENROUTER_API_KEY: 'sk-or-test',
      OPENROUTER_HTTP_REFERER: 'https://sven.local',
      OPENROUTER_APP_NAME: 'Sven Test',
      EMBEDDINGS_ENABLED: 'true',
    } as NodeJS.ProcessEnv;

    const embedding = await embedTextFromEnv('hello', env);
    expect(embedding).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-test',
          'HTTP-Referer': 'https://sven.local',
          'X-Title': 'Sven Test',
        }),
      }),
    );
  });

  it('returns null for openrouter when key is missing', async () => {
    const fetchMock = jest.fn() as any;
    (global as any).fetch = fetchMock;
    const embedding = await embedTextFromEnv(
      'hello',
      {
        EMBEDDINGS_PROVIDER: 'openrouter',
        EMBEDDINGS_URL: 'https://openrouter.ai/api/v1',
        EMBEDDINGS_MODEL: 'openai/text-embedding-3-small',
        EMBEDDINGS_ENABLED: 'true',
      } as NodeJS.ProcessEnv,
    );
    expect(embedding).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when embedding dimension mismatches expected config dimension', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    })) as any;
    (global as any).fetch = fetchMock;

    const embedding = await embedTextFromEnv('hello', {
      EMBEDDINGS_PROVIDER: 'ollama',
      EMBEDDINGS_URL: 'http://ollama:11434',
      EMBEDDINGS_MODEL: 'nomic-embed-text',
      EMBEDDINGS_DIM: '1536',
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_CACHE_ENABLED: 'false',
    } as NodeJS.ProcessEnv);

    expect(embedding).toBeNull();
  });

  it('normalizes openrouter defaults in config', () => {
    const cfg = readEmbeddingsConfigFromEnv({
      EMBEDDINGS_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'sk-or-test',
    } as NodeJS.ProcessEnv);
    expect(cfg.provider).toBe('openrouter');
    expect(cfg.url).toBe('https://openrouter.ai/api/v1');
    expect(cfg.model).toBe('openai/text-embedding-3-small');
    expect(cfg.timeoutMs).toBe(10000);
  });

  it('returns null within timeout budget when provider hangs', async () => {
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      }, { once: true });
    })) as any;
    (global as any).fetch = fetchMock;

    const started = Date.now();
    const embedding = await embedTextFromEnv('hello', {
      EMBEDDINGS_PROVIDER: 'ollama',
      EMBEDDINGS_URL: 'http://ollama:11434',
      EMBEDDINGS_MODEL: 'nomic-embed-text',
      EMBEDDINGS_DIM: '3',
      EMBEDDINGS_TIMEOUT_MS: '120',
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_CACHE_ENABLED: 'false',
    } as NodeJS.ProcessEnv);

    const elapsed = Date.now() - started;
    expect(embedding).toBeNull();
    expect(elapsed).toBeLessThan(1200);
  });

  it('reuses cached embeddings for the same provider/model/text tuple', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    })) as any;
    (global as any).fetch = fetchMock;

    const env = {
      EMBEDDINGS_PROVIDER: 'ollama',
      EMBEDDINGS_URL: 'http://ollama:11434',
      EMBEDDINGS_MODEL: 'nomic-embed-text',
      EMBEDDINGS_DIM: '3',
      EMBEDDINGS_ENABLED: 'true',
    } as NodeJS.ProcessEnv;

    const first = await embedTextFromEnv('cache me', env);
    const second = await embedTextFromEnv('cache me', env);

    expect(first).toEqual([0.1, 0.2, 0.3]);
    expect(second).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('evicts least-recently-used in-memory embeddings when cache exceeds max entries', async () => {
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as { prompt?: string };
      const p = String(body.prompt || '');
      if (p === 'one') return { ok: true, json: async () => ({ embedding: [1, 0, 0] }) };
      if (p === 'two') return { ok: true, json: async () => ({ embedding: [0, 1, 0] }) };
      return { ok: true, json: async () => ({ embedding: [0, 0, 1] }) };
    }) as any;
    (global as any).fetch = fetchMock;

    const env = {
      EMBEDDINGS_PROVIDER: 'ollama',
      EMBEDDINGS_URL: 'http://ollama:11434',
      EMBEDDINGS_MODEL: 'nomic-embed-text',
      EMBEDDINGS_DIM: '3',
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_CACHE_ENABLED: 'true',
      EMBEDDINGS_CACHE_MAX_ENTRIES: '2',
      EMBEDDINGS_CACHE_TTL_SECONDS: '3600',
    } as NodeJS.ProcessEnv;

    await embedTextFromEnv('one', env);
    await embedTextFromEnv('two', env);
    await embedTextFromEnv('three', env); // should evict "one"
    await embedTextFromEnv('two', env);   // still cached (LRU hit)
    await embedTextFromEnv('one', env);   // fetch again due to eviction

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
