import crypto from 'crypto';
import { createLogger } from '@sven/shared';
import { getPool } from '../db/pool.js';

export type EmbeddingsProvider = 'ollama' | 'openrouter';

export interface EmbeddingsConfig {
  enabled: boolean;
  provider: EmbeddingsProvider;
  url: string;
  model: string;
  dim: number;
  openrouterApiKey?: string;
  openrouterReferer?: string;
  openrouterTitle?: string;
  timeoutMs: number;
}

const logger = createLogger('embeddings');
const EMBEDDINGS_CACHE_TOOL_NAME = 'embedding.vector';
const DEFAULT_EMBEDDINGS_TIMEOUT_MS = 10000;
const MIN_EMBEDDINGS_TIMEOUT_MS = 100;
const MAX_EMBEDDINGS_TIMEOUT_MS = 120000;
const DEFAULT_EMBEDDINGS_CACHE_TTL_SECONDS = 86400;
const MIN_EMBEDDINGS_CACHE_TTL_SECONDS = 60;
const MAX_EMBEDDINGS_CACHE_TTL_SECONDS = 604800;

type EmbeddingCacheEntry = {
  value: number[];
  expiresAt: number;
};

const memoryCache = new Map<string, EmbeddingCacheEntry>();
const DEFAULT_EMBEDDINGS_CACHE_MAX_ENTRIES = 5000;
const MIN_EMBEDDINGS_CACHE_MAX_ENTRIES = 1;
const MAX_EMBEDDINGS_CACHE_MAX_ENTRIES = 100000;

class EmbeddingsTimeoutError extends Error {
  constructor(
    public provider: EmbeddingsProvider,
    public timeoutMs: number,
  ) {
    super(`Embeddings request timed out (${provider}, ${timeoutMs}ms)`);
    this.name = 'EmbeddingsTimeoutError';
  }
}

function normalizeProvider(raw: unknown): EmbeddingsProvider {
  const provider = String(raw || 'ollama').trim().toLowerCase();
  return provider === 'openrouter' ? 'openrouter' : 'ollama';
}

function normalizeDimension(raw: unknown, fallback = 1536): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
}

function normalizeTimeoutMs(raw: unknown, fallback = DEFAULT_EMBEDDINGS_TIMEOUT_MS): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return fallback;
  return Math.max(MIN_EMBEDDINGS_TIMEOUT_MS, Math.min(MAX_EMBEDDINGS_TIMEOUT_MS, normalized));
}

function trimTrailingSlashes(input: string): string {
  return input.replace(/\/+$/, '');
}

function normalizeCacheTtlSeconds(raw: unknown, fallback = DEFAULT_EMBEDDINGS_CACHE_TTL_SECONDS): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return fallback;
  return Math.max(MIN_EMBEDDINGS_CACHE_TTL_SECONDS, Math.min(MAX_EMBEDDINGS_CACHE_TTL_SECONDS, normalized));
}

function normalizeCacheMaxEntries(raw: unknown, fallback = DEFAULT_EMBEDDINGS_CACHE_MAX_ENTRIES): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return fallback;
  return Math.max(MIN_EMBEDDINGS_CACHE_MAX_ENTRIES, Math.min(MAX_EMBEDDINGS_CACHE_MAX_ENTRIES, normalized));
}

function isCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.EMBEDDINGS_CACHE_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function getEmbeddingsCacheTtlSeconds(env: NodeJS.ProcessEnv = process.env): number {
  return normalizeCacheTtlSeconds(env.EMBEDDINGS_CACHE_TTL_SECONDS, DEFAULT_EMBEDDINGS_CACHE_TTL_SECONDS);
}

function getEmbeddingsCacheMaxEntries(env: NodeJS.ProcessEnv = process.env): number {
  return normalizeCacheMaxEntries(env.EMBEDDINGS_CACHE_MAX_ENTRIES, DEFAULT_EMBEDDINGS_CACHE_MAX_ENTRIES);
}

function generateEmbeddingsCacheKey(text: string, config: EmbeddingsConfig): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      provider: config.provider,
      model: config.model,
      dim: config.dim,
      text,
    }))
    .digest('hex');
  return `${config.provider}:${config.model}:${config.dim}:${hash}`;
}

async function getCachedEmbedding(cacheKey: string): Promise<number[] | null> {
  const memoryEntry = memoryCache.get(cacheKey);
  if (memoryEntry) {
    if (memoryEntry.expiresAt > Date.now()) {
      // LRU touch on cache hit.
      memoryCache.delete(cacheKey);
      memoryCache.set(cacheKey, memoryEntry);
      return memoryEntry.value;
    }
    memoryCache.delete(cacheKey);
  }

  try {
    const result = await getPool().query(
      `SELECT cached_output, expires_at
         FROM tool_cache
        WHERE tool_name = $1
          AND cache_key = $2
          AND expires_at > CURRENT_TIMESTAMP`,
      [EMBEDDINGS_CACHE_TOOL_NAME, cacheKey],
    );
    if (result.rows.length === 0) return null;
    const raw = JSON.parse(String(result.rows[0].cached_output || 'null'));
    if (!Array.isArray(raw) || raw.length === 0 || raw.some((value) => !Number.isFinite(Number(value)))) {
      return null;
    }
    const value = raw.map((item) => Number(item));
    memoryCache.set(cacheKey, {
      value,
      expiresAt: new Date(result.rows[0].expires_at).getTime(),
    });
    pruneMemoryCache(getEmbeddingsCacheMaxEntries(process.env));
    return value;
  } catch {
    return null;
  }
}

function pruneMemoryCache(maxEntries: number): void {
  if (memoryCache.size <= maxEntries) return;
  while (memoryCache.size > maxEntries) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
}

async function cacheEmbedding(cacheKey: string, embedding: number[], ttlSeconds: number, maxEntries: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, {
    value: embedding,
    expiresAt: expiresAt.getTime(),
  });
  pruneMemoryCache(maxEntries);

  try {
    await getPool().query(
      `INSERT INTO tool_cache (tool_name, cache_key, cached_output, expires_at, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (tool_name, cache_key) DO UPDATE
       SET cached_output = $3,
           expires_at = $4,
           updated_at = CURRENT_TIMESTAMP`,
      [EMBEDDINGS_CACHE_TOOL_NAME, cacheKey, JSON.stringify(embedding), expiresAt],
    );
  } catch {
    // Cache persistence is opportunistic; provider-backed embedding remains authoritative.
  }
}

export function readEmbeddingsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EmbeddingsConfig {
  const provider = normalizeProvider(env.EMBEDDINGS_PROVIDER);
  if (provider === 'openrouter') {
    const url =
      trimTrailingSlashes(
        env.EMBEDDINGS_URL || env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      );
    return {
      enabled: (env.EMBEDDINGS_ENABLED || env.MEMORY_EMBEDDINGS_ENABLED || 'true').toLowerCase() !== 'false',
      provider,
      url,
      model: env.EMBEDDINGS_MODEL || 'openai/text-embedding-3-small',
      dim: normalizeDimension(env.EMBEDDINGS_DIM, 1536),
      openrouterApiKey: env.OPENROUTER_API_KEY || undefined,
      openrouterReferer: env.OPENROUTER_HTTP_REFERER || env.OPENROUTER_REFERER || undefined,
      openrouterTitle: env.OPENROUTER_APP_NAME || env.OPENROUTER_TITLE || 'Sven',
      timeoutMs: normalizeTimeoutMs(
        env.OPENROUTER_EMBEDDINGS_TIMEOUT_MS ?? env.EMBEDDINGS_TIMEOUT_MS,
        DEFAULT_EMBEDDINGS_TIMEOUT_MS,
      ),
    };
  }

  const url = trimTrailingSlashes(env.EMBEDDINGS_URL || env.OLLAMA_URL || 'http://localhost:11434');
  return {
    enabled: (env.EMBEDDINGS_ENABLED || env.MEMORY_EMBEDDINGS_ENABLED || 'true').toLowerCase() !== 'false',
    provider,
    url,
    model: env.EMBEDDINGS_MODEL || env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    dim: normalizeDimension(env.EMBEDDINGS_DIM, 1536),
    timeoutMs: normalizeTimeoutMs(env.OLLAMA_EMBEDDINGS_TIMEOUT_MS ?? env.EMBEDDINGS_TIMEOUT_MS),
  };
}

function parseEmbeddingResponse(data: any): number[] | null {
  if (Array.isArray(data?.embedding) && data.embedding.length > 0) {
    return data.embedding as number[];
  }
  if (Array.isArray(data?.data) && Array.isArray(data.data[0]?.embedding) && data.data[0].embedding.length > 0) {
    return data.data[0].embedding as number[];
  }
  return null;
}

function isValidEmbeddingVector(embedding: number[], expectedDim: number): boolean {
  return embedding.length === expectedDim && embedding.every((value) => Number.isFinite(Number(value)));
}

function validateEmbeddingVector(
  embedding: number[] | null,
  config: EmbeddingsConfig,
): number[] | null {
  if (!embedding) return null;
  if (!isValidEmbeddingVector(embedding, config.dim)) {
    logger.warn('Embedding vector rejected: invalid dimension or values', {
      provider: config.provider,
      model: config.model,
      expected_dim: config.dim,
      received_dim: embedding.length,
    });
    return null;
  }
  return embedding;
}

async function fetchWithTimeout(
  provider: EmbeddingsProvider,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new EmbeddingsTimeoutError(provider, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function embedTextWithConfig(text: string, config: EmbeddingsConfig): Promise<number[] | null> {
  if (!config.enabled) return null;

  try {
    if (config.provider === 'openrouter') {
      if (!config.openrouterApiKey) return null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openrouterApiKey}`,
      };
      if (config.openrouterReferer) headers['HTTP-Referer'] = config.openrouterReferer;
      if (config.openrouterTitle) headers['X-Title'] = config.openrouterTitle;
      const res = await fetchWithTimeout(
        config.provider,
        `${config.url}/embeddings`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: config.model, input: text }),
        },
        config.timeoutMs,
      );
      if (!res.ok) {
        logger.warn('Embedding provider request failed', {
          provider: config.provider,
          model: config.model,
          status: res.status,
        });
        return null;
      }
      const data = await res.json();
      return validateEmbeddingVector(parseEmbeddingResponse(data), config);
    }

    const res = await fetchWithTimeout(
      config.provider,
      `${config.url}/api/embeddings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, prompt: text }),
      },
      config.timeoutMs,
    );
    if (!res.ok) {
      logger.warn('Embedding provider request failed', {
        provider: config.provider,
        model: config.model,
        status: res.status,
      });
      return null;
    }
    const data = await res.json();
    return validateEmbeddingVector(parseEmbeddingResponse(data), config);
  } catch (err) {
    if (err instanceof EmbeddingsTimeoutError) {
      logger.warn('Embedding request timed out', {
        provider: err.provider,
        timeout_ms: err.timeoutMs,
      });
      return null;
    }
    logger.warn('Embedding provider request errored', {
      provider: config.provider,
      model: config.model,
      error: String(err),
    });
    return null;
  }
}

export async function embedTextFromEnv(text: string, env: NodeJS.ProcessEnv = process.env): Promise<number[] | null> {
  const config = readEmbeddingsConfigFromEnv(env);
  if (!config.enabled) return null;

  const cacheEnabled = isCacheEnabled(env);
  const maxEntries = getEmbeddingsCacheMaxEntries(env);
  const cacheKey = generateEmbeddingsCacheKey(text, config);
  if (cacheEnabled) {
    const cached = await getCachedEmbedding(cacheKey);
    if (cached && isValidEmbeddingVector(cached, config.dim)) {
      return cached;
    }
  }

  const embedding = await embedTextWithConfig(text, config);
  if (embedding && cacheEnabled) {
    await cacheEmbedding(cacheKey, embedding, getEmbeddingsCacheTtlSeconds(env), maxEntries);
  }
  return embedding;
}
