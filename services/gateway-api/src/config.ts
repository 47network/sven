import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { createLogger } from '@sven/shared';

const logger = createLogger('gateway-config');

const ConfigSchema = z
  .object({
    env: z.record(z.string(), z.string()).optional(),
    gateway: z
      .object({
        host: z.string().optional(),
        port: z.number().int().optional(),
        public_url: z.string().optional(),
        cors_origin: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
      })
      .optional(),
    auth: z
      .object({
        cookie_secret: z.string().optional(),
        deeplink_secret: z.string().optional(),
        device_verify_url: z.string().optional(),
      })
      .optional(),
    database: z
      .object({
        url: z.string().optional(),
      })
      .optional(),
    nats: z
      .object({
        url: z.string().optional(),
      })
      .optional(),
    opensearch: z
      .object({
        url: z.string().optional(),
        user: z.string().optional(),
        password: z.string().optional(),
        disable_security: z.boolean().optional(),
      })
      .optional(),
    inference: z
      .object({
        url: z.string().optional(),
        embeddings_url: z.string().optional(),
        embeddings_model: z.string().optional(),
        embeddings_dim: z.number().int().optional(),
        embeddings_provider: z.string().optional(),
      })
      .optional(),
    stream: z
      .object({
        resume_max_events: z.number().int().optional(),
        resume_ttl_ms: z.number().int().optional(),
        cleanup_ms: z.number().int().optional(),
      })
      .optional(),
    tailscale: z
      .object({
        mode: z.enum(['off', 'serve', 'funnel']).optional(),
        reset_on_shutdown: z.boolean().optional(),
        bin: z.string().optional(),
        cmd_timeout_ms: z.number().int().optional(),
      })
      .optional(),
    browser: z
      .object({
        headless: z.boolean().optional(),
        proxy_url: z.string().optional(),
        enforce_container: z.boolean().optional(),
      })
      .optional(),
    wake_word: z
      .object({
        base_url: z.string().optional(),
      })
      .optional(),
    email: z
      .object({
        gmail_pubsub_token: z.string().optional(),
      })
      .optional(),
    adapter: z
      .object({
        token: z.string().optional(),
      })
      .optional(),
    logging: z
      .object({
        level: z.string().optional(),
        redact_sensitive: z.boolean().optional(),
        redact_patterns: z.array(z.string()).optional(),
      })
      .optional(),
    settings: z.record(z.any()).optional(),
  })
  .passthrough();

const LEGACY_ENV_MAP: Record<string, string> = {
  gateway_url: 'GATEWAY_URL',
  database_url: 'DATABASE_URL',
  nats_url: 'NATS_URL',
  opensearch_url: 'OPENSEARCH_URL',
  inference_url: 'OLLAMA_URL',
};

const REDACT_KEYS = ['password', 'secret', 'token', 'key'];
const MAX_CONFIG_INCLUDE_DEPTH = 10;

function shouldRedact(name: string) {
  const lower = name.toLowerCase();
  return REDACT_KEYS.some((key) => lower.includes(key));
}

function defaultConfigPathForProfile(): string {
  const profileRaw = String(process.env.SVEN_PROFILE || 'default');
  const profile = profileRaw.replace(/[^a-zA-Z0-9._-]/g, '') || 'default';
  if (profile === 'default') {
    return path.join(os.homedir(), '.sven', 'sven.json');
  }
  return path.join(os.homedir(), '.sven', 'profiles', profile, 'sven.json');
}

function deepMerge(base: unknown, incoming: unknown): unknown {
  if (Array.isArray(incoming)) return incoming.slice();
  if (incoming && typeof incoming === 'object') {
    const out: Record<string, unknown> = {
      ...(base && typeof base === 'object' && !Array.isArray(base) ? (base as Record<string, unknown>) : {}),
    };
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      out[k] = deepMerge(out[k], v);
    }
    return out;
  }
  return incoming !== undefined ? incoming : base;
}

function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, key: string) => {
      const envVal = process.env[key];
      return envVal !== undefined ? envVal : `\${${key}}`;
    });
  }
  if (Array.isArray(value)) return value.map((item) => substituteEnvVars(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteEnvVars(v);
    }
    return out;
  }
  return value;
}

function parseJsonConfigFile(configPath: string): Record<string, unknown> {
  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in config file ${configPath}: ${String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid config file ${configPath}: top-level JSON object is required`);
  }
  return parsed as Record<string, unknown>;
}

function loadConfigWithIncludes(
  configPath: string,
  depth = 0,
  seen = new Set<string>(),
): Record<string, unknown> {
  const resolvedPath = path.resolve(configPath);
  if (seen.has(resolvedPath)) {
    throw new Error(`Config include cycle detected at ${resolvedPath}`);
  }
  if (depth > MAX_CONFIG_INCLUDE_DEPTH) {
    throw new Error(`Config include depth exceeded (${MAX_CONFIG_INCLUDE_DEPTH}) at ${resolvedPath}`);
  }
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Included config file not found: ${resolvedPath}`);
  }

  seen.add(resolvedPath);
  const parsed = parseJsonConfigFile(resolvedPath);
  const includesRaw = (parsed as Record<string, unknown>)['$include'];
  const includes = Array.isArray(includesRaw)
    ? includesRaw.map((x) => String(x)).filter(Boolean)
    : includesRaw
      ? [String(includesRaw)]
      : [];

  let merged: Record<string, unknown> = {};
  for (const includeEntry of includes) {
    const includePath = path.isAbsolute(includeEntry)
      ? includeEntry
      : path.resolve(path.dirname(resolvedPath), includeEntry);
    const includedConfig = loadConfigWithIncludes(includePath, depth + 1, seen);
    merged = deepMerge(merged, includedConfig) as Record<string, unknown>;
  }

  const current = { ...parsed };
  delete (current as Record<string, unknown>)['$include'];
  merged = deepMerge(merged, current) as Record<string, unknown>;
  seen.delete(resolvedPath);
  return merged;
}

function setEnv(key: string, value: unknown, applied: string[]) {
  if (value === undefined || value === null) return;
  if (process.env[key] !== undefined) return;
  process.env[key] = String(value);
  if (!shouldRedact(key)) applied.push(key);
}

function mapLegacyKeys(config: Record<string, unknown>, applied: string[]) {
  for (const [key, envKey] of Object.entries(LEGACY_ENV_MAP)) {
    if (config[key] !== undefined) setEnv(envKey, config[key], applied);
  }
}

function applyConfig(config: Record<string, unknown>, applied: string[]) {
  const env = config.env as Record<string, string> | undefined;
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      setEnv(key, value, applied);
    }
  }

  mapLegacyKeys(config, applied);

  const gateway = config.gateway as any;
  if (gateway) {
    setEnv('GATEWAY_HOST', gateway.host, applied);
    setEnv('GATEWAY_PORT', gateway.port, applied);
    setEnv('GATEWAY_URL', gateway.public_url, applied);
    setEnv('CORS_ORIGIN', gateway.cors_origin, applied);
  }

  const auth = config.auth as any;
  if (auth) {
    setEnv('COOKIE_SECRET', auth.cookie_secret, applied);
    setEnv('DEEPLINK_SECRET', auth.deeplink_secret, applied);
    setEnv('AUTH_DEVICE_VERIFY_URL', auth.device_verify_url, applied);
  }

  const database = config.database as any;
  if (database) {
    setEnv('DATABASE_URL', database.url, applied);
  }

  const nats = config.nats as any;
  if (nats) {
    setEnv('NATS_URL', nats.url, applied);
  }

  const opensearch = config.opensearch as any;
  if (opensearch) {
    setEnv('OPENSEARCH_URL', opensearch.url, applied);
    setEnv('OPENSEARCH_USER', opensearch.user, applied);
    setEnv('OPENSEARCH_PASSWORD', opensearch.password, applied);
    setEnv('OPENSEARCH_DISABLE_SECURITY', opensearch.disable_security, applied);
  }

  const inference = config.inference as any;
  if (inference) {
    setEnv('OLLAMA_URL', inference.url, applied);
    setEnv('EMBEDDINGS_URL', inference.embeddings_url, applied);
    setEnv('EMBEDDINGS_MODEL', inference.embeddings_model, applied);
    setEnv('EMBEDDINGS_DIM', inference.embeddings_dim, applied);
    setEnv('EMBEDDINGS_PROVIDER', inference.embeddings_provider, applied);
  }

  const stream = config.stream as any;
  if (stream) {
    setEnv('STREAM_RESUME_MAX_EVENTS', stream.resume_max_events, applied);
    setEnv('STREAM_RESUME_TTL_MS', stream.resume_ttl_ms, applied);
    setEnv('STREAM_RESUME_CLEANUP_MS', stream.cleanup_ms, applied);
  }

  const tailscale = config.tailscale as any;
  if (tailscale) {
    setEnv('GATEWAY_TAILSCALE_MODE', tailscale.mode, applied);
    setEnv('GATEWAY_TAILSCALE_RESET_ON_SHUTDOWN', tailscale.reset_on_shutdown, applied);
    setEnv('TAILSCALE_BIN', tailscale.bin, applied);
    setEnv('TAILSCALE_CMD_TIMEOUT_MS', tailscale.cmd_timeout_ms, applied);
  }

  const browser = config.browser as any;
  if (browser) {
    setEnv('BROWSER_HEADLESS', browser.headless, applied);
    setEnv('BROWSER_PROXY_URL', browser.proxy_url, applied);
    setEnv('BROWSER_ENFORCE_CONTAINER', browser.enforce_container, applied);
  }

  const wakeWord = config.wake_word as any;
  if (wakeWord) {
    setEnv('WAKE_WORD_BASE_URL', wakeWord.base_url, applied);
  }

  const email = config.email as any;
  if (email) {
    setEnv('GMAIL_PUBSUB_TOKEN', email.gmail_pubsub_token, applied);
  }

  const adapter = config.adapter as any;
  if (adapter) {
    setEnv('SVEN_ADAPTER_TOKEN', adapter.token, applied);
  }

  const logging = config.logging as any;
  if (logging) {
    setEnv('LOG_LEVEL', logging.level, applied);
    setEnv('LOGGING_REDACT_SENSITIVE', logging.redact_sensitive, applied);
    setEnv('LOGGING_REDACT_PATTERNS', logging.redact_patterns ? JSON.stringify(logging.redact_patterns) : undefined, applied);
  }
}

export function loadConfigFile() {
  const configPath = process.env.SVEN_CONFIG || defaultConfigPathForProfile();
  if (!fs.existsSync(configPath)) {
    return { status: 'missing', path: configPath };
  }

  const resolved = loadConfigWithIncludes(configPath);
  const substituted = substituteEnvVars(resolved);
  const result = ConfigSchema.safeParse(substituted);
  if (!result.success) {
    throw new Error(`Invalid config file ${configPath}: ${result.error.message}`);
  }

  const applied: string[] = [];
  applyConfig(result.data as Record<string, unknown>, applied);
  logger.info('Loaded config file', { path: configPath, applied_keys: applied });
  return { status: 'loaded', path: configPath, applied_keys: applied };
}

export function validateConfigFile(configPath?: string) {
  const resolved = configPath || process.env.SVEN_CONFIG || defaultConfigPathForProfile();
  if (!fs.existsSync(resolved)) {
    return { ok: false, path: resolved, error: 'config file not found' };
  }
  try {
    const withIncludes = loadConfigWithIncludes(resolved);
    const substituted = substituteEnvVars(withIncludes);
    const result = ConfigSchema.safeParse(substituted);
    if (!result.success) {
      return { ok: false, path: resolved, error: result.error.message };
    }
    return { ok: true, path: resolved };
  } catch (err) {
    return { ok: false, path: resolved, error: String(err) };
  }
}
