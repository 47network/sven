// ═══════════════════════════════════════════════════════════════════════════
// OpenAI-Compatible API Routes
// Provides /v1/chat/completions, /v1/responses, and /v1/models endpoints that are drop-in
// compatible with the OpenAI API, allowing third-party tools (Cursor, Continue,
// Open Interpreter, etc.) to use Sven as an LLM provider.
// ═══════════════════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';
import crypto from 'node:crypto';
import { createLogger } from '@sven/shared';
import { loadStreamingPacingConfig, StreamingChunkPlanner, type StreamingPacingConfig } from '../services/streaming-pacing.js';

const logger = createLogger('openai-compat');

// ─── Types ──────────────────────────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | null;
  name?: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
}

interface ResponsesRequest {
  model: string;
  input: unknown;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  stream?: boolean;
  user?: string;
}

interface ChatCompletionChoice {
  index: number;
  message: { role: 'assistant'; content: string };
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunkDelta {
  role?: 'assistant';
  content?: string;
}

interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: StreamChunkDelta;
    finish_reason: 'stop' | 'length' | null;
  }>;
}

interface ModelRecord {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  endpoint: string;
  capabilities: string[];
  is_local: boolean;
  created_at: string;
}

type OpenAIRateLimitSubject = {
  callerKey: string;
  userId: string;
  orgId: string | null;
};

type OpenAIRateLimitDecision = {
  limited: boolean;
  retryAfterSec: number;
};

type OpenAIEndpointScope = 'chat.complete' | 'responses.create' | 'models.read';

class OpenAiCompatUpstreamTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`OpenAI compat upstream request timed out after ${timeoutMs}ms`);
    this.name = 'OpenAiCompatUpstreamTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

const DEFAULT_GLOBAL_KEY_FORWARD_ALLOWLIST = ['api.openai.com'];
const PRIVATE_ENDPOINT_BLOCKLIST = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.aws.internal',
]);
const OPENAI_COMPAT_KID_REGEX = /^[a-f0-9]{16}$/i;
const OPENAI_COMPAT_ALLOW_LEGACY_API_KEYS =
  String(process.env.OPENAI_COMPAT_ALLOW_LEGACY_API_KEYS || 'true').trim().toLowerCase() !== 'false';

// ─── Auth Helpers ───────────────────────────────────────────────────────

function extractBearerToken(authHeader: unknown): string {
  const header = String(authHeader || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function extractApiKeyKid(token: string): string | null {
  const match = /^sk-sven-([^.]+)\./i.exec(token);
  if (!match) return null;
  const kid = String(match[1] || '').trim().toLowerCase();
  if (!OPENAI_COMPAT_KID_REGEX.test(kid)) return null;
  return kid;
}

/**
 * Authenticate via API key (sk-sven-xxx) or session token.
 * Returns userId on success, null on failure.
 */
async function authenticateOpenAI(
  request: any,
  reply: any,
  pool: pg.Pool,
  requiredScope: OpenAIEndpointScope,
): Promise<{ userId: string; orgId: string | null; callerKey: string } | null> {
  const token = extractBearerToken(request.headers?.authorization);
  if (!token) {
    reply.status(401).send({
      error: {
        message: 'Missing API key. Include `Authorization: Bearer sk-sven-...` header.',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key',
      },
    });
    return null;
  }

  // Try API key first (sk-sven-xxx)
  if (token.startsWith('sk-sven-')) {
    const kid = extractApiKeyKid(token);
    let row: any | null = null;

    if (kid) {
      const candidate = await pool.query(
        `SELECT ak.id, ak.key_hash, ak.user_id, ak.scopes, ak.expires_at, ak.revoked_at,
                ak.organization_id, ak.kid
         FROM api_keys ak
         WHERE ak.kid = $1 AND ak.revoked_at IS NULL
         LIMIT 1`,
        [kid],
      );
      row = candidate.rows[0] || null;
    } else if (OPENAI_COMPAT_ALLOW_LEGACY_API_KEYS) {
      const prefix = token.slice(0, 12);
      const legacy = await pool.query(
        `SELECT ak.id, ak.key_hash, ak.user_id, ak.scopes, ak.expires_at, ak.revoked_at,
                ak.organization_id, ak.kid
         FROM api_keys ak
         WHERE ak.prefix = $1 AND ak.revoked_at IS NULL
         ORDER BY ak.created_at DESC
         LIMIT 2`,
        [prefix],
      );
      if (legacy.rows.length === 1) {
        row = legacy.rows[0];
      }
    }

    if (row && (!row.expires_at || new Date(row.expires_at) >= new Date())) {
      const startedAt = Date.now();
      const match = await bcrypt.compare(token, row.key_hash);
      const compareMs = Date.now() - startedAt;
      logger.debug('OpenAI API-key bcrypt verify', {
        key_id: row.id,
        kid: row.kid || null,
        compare_ms: compareMs,
        matched: match,
      });
      if (match) {
        if (!isApiKeyScopeAllowed(row.scopes, requiredScope)) {
          reply.status(403).send({
            error: {
              message: `API key does not include required scope: ${requiredScope}`,
              type: 'invalid_request_error',
              param: 'scope',
              code: 'insufficient_scope',
            },
          });
          return null;
        }
        // Update last_used_at (fire-and-forget)
        pool.query(
          `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
          [row.id],
        ).catch(() => {});
        const callerIdentity = row.kid
          ? `api:${row.kid}:${hashCallerToken(token)}`
          : `api:${token.slice(0, 12)}:${hashCallerToken(token)}`;
        return {
          userId: row.user_id,
          orgId: row.organization_id || null,
          callerKey: callerIdentity,
        };
      }
    }

    reply.status(401).send({
      error: {
        message: 'Invalid API key.',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key',
      },
    });
    return null;
  }

  // Fall back to session token
  const sessionRes = await pool.query(
    `SELECT s.user_id, u.active_organization_id
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1 AND s.status = 'active' AND s.expires_at > NOW()`,
    [token],
  );

  if (sessionRes.rows.length === 0) {
    reply.status(401).send({
      error: {
        message: 'Invalid authentication token.',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key',
      },
    });
    return null;
  }

  return {
    userId: sessionRes.rows[0].user_id,
    orgId: sessionRes.rows[0].active_organization_id || null,
    callerKey: `session:${hashCallerToken(token)}`,
  };
}

function normalizeApiKeyScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function isApiKeyScopeAllowed(rawScopes: unknown, requiredScope: OpenAIEndpointScope): boolean {
  const scopes = normalizeApiKeyScopes(rawScopes);
  if (scopes.length === 0) return false;
  if (scopes.includes('openai') || scopes.includes('openai.*') || scopes.includes('*')) {
    return true;
  }

  const [domain, action] = requiredScope.split('.');
  const domainWildcard = `${domain}.*`;
  if (scopes.includes(requiredScope) || scopes.includes(domainWildcard)) {
    return true;
  }
  if (action === 'read' && scopes.includes(`${domain}.list`)) {
    return true;
  }
  return false;
}

async function requireBearerSessionUser(
  request: any,
  reply: any,
  pool: pg.Pool,
  purpose: 'create' | 'revoke' | 'list',
): Promise<string | null> {
  const bearer = extractBearerToken(request.headers?.authorization);
  if (!bearer) {
    reply.status(401).send({
      error: {
        message: 'Bearer session token required.',
        type: 'invalid_request_error',
        param: null,
        code: null,
      },
    });
    return null;
  }

  const sessionRes = await pool.query(
    `SELECT s.user_id FROM sessions s WHERE s.id = $1 AND s.status = 'active' AND s.expires_at > NOW()`,
    [bearer],
  );
  if (sessionRes.rows.length === 0) {
    reply.status(401).send({
      error: {
        message: purpose === 'list' ? 'Session expired.' : 'Bearer session expired.',
        type: 'invalid_request_error',
        param: null,
        code: null,
      },
    });
    return null;
  }
  return String(sessionRes.rows[0].user_id);
}

async function listActiveOrganizationIdsForUser(
  pool: pg.Pool,
  userId: string,
): Promise<string[]> {
  const memberships = await pool.query(
    `SELECT organization_id
     FROM organization_memberships
     WHERE user_id = $1 AND status = 'active'
     ORDER BY organization_id ASC`,
    [userId],
  );
  return memberships.rows
    .map((row: any) => String(row.organization_id || '').trim())
    .filter(Boolean);
}

function resolveSelectedOrganizationId(
  candidateOrgId: unknown,
  request: any,
  activeOrgIds: string[],
): { ok: true; organizationId: string } | { ok: false; statusCode: number; message: string; param: string | null } {
  const requestedOrgId = String(candidateOrgId || '').trim();
  const requestOrgId = String(request.orgId || '').trim();

  if (requestedOrgId) {
    if (!activeOrgIds.includes(requestedOrgId)) {
      return {
        ok: false,
        statusCode: 403,
        message: 'organization_id is not an active organization for this user.',
        param: 'organization_id',
      };
    }
    return { ok: true, organizationId: requestedOrgId };
  }

  if (requestOrgId && activeOrgIds.includes(requestOrgId)) {
    return { ok: true, organizationId: requestOrgId };
  }

  if (activeOrgIds.length === 1) {
    return { ok: true, organizationId: activeOrgIds[0] };
  }

  if (activeOrgIds.length > 1) {
    return {
      ok: false,
      statusCode: 400,
      message: '`organization_id` is required for users with multiple active organizations.',
      param: 'organization_id',
    };
  }

  return {
    ok: false,
    statusCode: 403,
    message: 'No active organization membership found for this user.',
    param: 'organization_id',
  };
}

// ─── LLM Provider Callers ──────────────────────────────────────────────

async function resolveModel(
  pool: pg.Pool,
  modelName: string,
  orgId: string | null,
): Promise<ModelRecord | null> {
  const params = [modelName.trim()];
  const orgScopedPredicate = orgId
    ? `AND (organization_id = $2 OR organization_id IS NULL)
       ORDER BY CASE WHEN organization_id = $2 THEN 0 ELSE 1 END, created_at ASC`
    : `AND organization_id IS NULL
       ORDER BY created_at ASC`;
  if (orgId) params.push(orgId);
  const res = await pool.query(
    `SELECT id, name, provider, model_id, endpoint, capabilities, is_local, created_at
     FROM model_registry
     WHERE (name = $1 OR model_id = $1)
     ${orgScopedPredicate}
     LIMIT 1`,
    params,
  );
  return res.rows[0] || null;
}

async function callProviderNonStreaming(
  model: ModelRecord,
  messages: OpenAIMessage[],
  params: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string | string[];
    presence_penalty?: number;
    frequency_penalty?: number;
  },
): Promise<{ text: string; prompt_tokens: number; completion_tokens: number; finish_reason: string }> {
  if (model.provider === 'ollama') {
    return callOllamaNonStreaming(model, messages, params);
  }
  return callOpenAINonStreaming(model, messages, params);
}

async function callOllamaNonStreaming(
  model: ModelRecord,
  messages: OpenAIMessage[],
  params: { temperature?: number; max_tokens?: number },
): Promise<{ text: string; prompt_tokens: number; completion_tokens: number; finish_reason: string }> {
  const endpointUrl = validateModelEndpointTarget(model);
  const ollamaMessages = messages.map((m) => ({
    role: m.role,
    content: m.content || '',
  }));

  const ollamaOptions: Record<string, unknown> = {};
  if (params.temperature !== undefined) ollamaOptions.temperature = params.temperature;
  if (params.max_tokens !== undefined) ollamaOptions.num_predict = params.max_tokens;

  const response = await fetchOpenAiCompatUpstream(`${endpointUrl.toString().replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.model_id || model.name,
      messages: ollamaMessages,
      stream: false,
      ...(Object.keys(ollamaOptions).length > 0 ? { options: ollamaOptions } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('Ollama upstream error', { status: response.status, detail: errText.slice(0, 1024) });
    throw new Error(`LLM provider returned ${response.status}`);
  }

  const data = (await response.json()) as any;
  return {
    text: data.message?.content || '',
    prompt_tokens: data.prompt_eval_count || 0,
    completion_tokens: data.eval_count || 0,
    finish_reason: data.done_reason || 'stop',
  };
}

async function callOpenAINonStreaming(
  model: ModelRecord,
  messages: OpenAIMessage[],
  params: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string | string[];
    presence_penalty?: number;
    frequency_penalty?: number;
  },
): Promise<{ text: string; prompt_tokens: number; completion_tokens: number; finish_reason: string }> {
  const endpointUrl = validateModelEndpointTarget(model);
  const apiKey = resolveForwardedUpstreamApiKey(endpointUrl);
  const body: Record<string, unknown> = {
    model: model.model_id || model.name,
    messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
  };

  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.max_tokens !== undefined) body.max_tokens = params.max_tokens;
  if (params.top_p !== undefined) body.top_p = params.top_p;
  if (params.stop !== undefined) body.stop = params.stop;
  if (params.presence_penalty !== undefined) body.presence_penalty = params.presence_penalty;
  if (params.frequency_penalty !== undefined) body.frequency_penalty = params.frequency_penalty;

  const response = await fetchOpenAiCompatUpstream(`${endpointUrl.toString().replace(/\/+$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('OpenAI-compat upstream error', { status: response.status, detail: errText.slice(0, 1024) });
    throw new Error(`LLM provider returned ${response.status}`);
  }

  const data = (await response.json()) as any;
  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content || '',
    prompt_tokens: data.usage?.prompt_tokens || 0,
    completion_tokens: data.usage?.completion_tokens || 0,
    finish_reason: choice?.finish_reason || 'stop',
  };
}

// ─── Streaming Helpers ─────────────────────────────────────────────────

function writeSSE(raw: any, data: unknown): void {
  raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function normalizeOpenAiCompatBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

function buildInitialRoleChunk(
  completionId: string,
  created: number,
  modelName: string,
): StreamChunk {
  return {
    id: completionId,
    object: 'chat.completion.chunk',
    created,
    model: modelName,
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
  };
}

const openAiCompatUserWindow = new Map<string, { count: number; windowStartMs: number }>();
const openAiCompatOrgWindow = new Map<string, { count: number; windowStartMs: number }>();
const openAiCompatCallerWindow = new Map<string, { count: number; windowStartMs: number }>();
const OPENAI_COMPAT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_MAP_SIZE = 50_000;

function pruneExpiredWindows(nowMs: number): void {
  const expiry = OPENAI_COMPAT_WINDOW_MS * 2;
  for (const bucket of [openAiCompatUserWindow, openAiCompatOrgWindow, openAiCompatCallerWindow]) {
    if (bucket.size <= MAX_RATE_LIMIT_MAP_SIZE) continue;
    for (const [key, data] of bucket) {
      if (nowMs - data.windowStartMs >= expiry) bucket.delete(key);
    }
  }
}

function hashCallerToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseHostAllowlist(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateLikeHostname(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return true;
  if (PRIVATE_ENDPOINT_BLOCKLIST.has(host)) return true;
  if (host.endsWith('.local')) return true;
  if (host === '::1') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split('.').map((part) => Number(part));
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  return false;
}

function isHostAllowlisted(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const normalized = hostname.toLowerCase();
  return allowlist.some((entry) => {
    if (entry === normalized) return true;
    if (entry.startsWith('*.')) {
      return normalized.endsWith(entry.slice(1));
    }
    return false;
  });
}

function validateModelEndpointTarget(model: ModelRecord): URL {
  let parsed: URL;
  try {
    parsed = new URL(String(model.endpoint || '').trim());
  } catch {
    throw new Error('MODEL_ENDPOINT_INVALID: endpoint must be a valid absolute URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('MODEL_ENDPOINT_INVALID: endpoint must use http or https');
  }

  const host = parsed.hostname.toLowerCase();
  const endpointAllowlist = parseHostAllowlist(process.env.OPENAI_COMPAT_ENDPOINT_ALLOWLIST_HOSTS);
  if (!isHostAllowlisted(host, endpointAllowlist)) {
    throw new Error(`MODEL_ENDPOINT_FORBIDDEN: host ${host} not allowlisted`);
  }

  const allowPrivateLocal = String(process.env.OPENAI_COMPAT_LOCAL_ENDPOINTS_ALLOW_PRIVATE || 'true').toLowerCase() !== 'false';
  const privateLike = isPrivateLikeHostname(host);
  if (privateLike && !(Boolean(model.is_local) && allowPrivateLocal)) {
    throw new Error(`MODEL_ENDPOINT_UNSAFE_TARGET: private/local host ${host}`);
  }
  return parsed;
}

function resolveForwardedUpstreamApiKey(endpointUrl: URL): string {
  const candidate = String(process.env.LLM_API_KEY || '').trim();
  if (!candidate) return '';
  const host = endpointUrl.hostname.toLowerCase();
  const configured = parseHostAllowlist(process.env.OPENAI_COMPAT_GLOBAL_KEY_FORWARD_ALLOWLIST_HOSTS);
  const allowlist = configured.length > 0 ? configured : DEFAULT_GLOBAL_KEY_FORWARD_ALLOWLIST;
  return isHostAllowlisted(host, allowlist) ? candidate : '';
}

function getOpenAiCompatUpstreamTimeoutMs(): number {
  return parsePositiveInt(process.env.OPENAI_COMPAT_UPSTREAM_TIMEOUT_MS, 45_000);
}

function isAbortLikeError(error: unknown): boolean {
  const name = String((error as { name?: string })?.name || '');
  return name === 'AbortError' || name === 'TimeoutError';
}

function isOpenAiCompatUpstreamTimeoutError(error: unknown): error is OpenAiCompatUpstreamTimeoutError {
  return error instanceof OpenAiCompatUpstreamTimeoutError;
}

async function fetchOpenAiCompatUpstream(input: string, init: RequestInit): Promise<Response> {
  const timeoutMs = getOpenAiCompatUpstreamTimeoutMs();
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new OpenAiCompatUpstreamTimeoutError(timeoutMs);
    }
    throw error;
  }
}

function consumeFixedWindow(
  bucket: Map<string, { count: number; windowStartMs: number }>,
  key: string,
  nowMs: number,
  limit: number,
): OpenAIRateLimitDecision {
  const current = bucket.get(key);
  if (!current || nowMs - current.windowStartMs >= OPENAI_COMPAT_WINDOW_MS) {
    bucket.set(key, { count: 1, windowStartMs: nowMs });
    return { limited: false, retryAfterSec: 0 };
  }
  if (current.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((OPENAI_COMPAT_WINDOW_MS - (nowMs - current.windowStartMs)) / 1000));
    return { limited: true, retryAfterSec };
  }
  current.count += 1;
  bucket.set(key, current);
  return { limited: false, retryAfterSec: 0 };
}

function shouldRateLimitOpenAiCompat(
  endpoint: 'chat_completions' | 'responses' | 'models',
  subject: OpenAIRateLimitSubject,
): OpenAIRateLimitDecision {
  const nowMs = Date.now();
  pruneExpiredWindows(nowMs);
  const baseUserLimit = parsePositiveInt(process.env.OPENAI_COMPAT_USER_RPM, 60);
  const baseOrgLimit = parsePositiveInt(process.env.OPENAI_COMPAT_ORG_RPM, 180);
  const baseCallerLimit = parsePositiveInt(process.env.OPENAI_COMPAT_CALLER_RPM, 90);
  const modelsMultiplier = endpoint === 'models' ? 3 : 1;

  const userDecision = consumeFixedWindow(
    openAiCompatUserWindow,
    `${endpoint}:user:${subject.userId}`,
    nowMs,
    baseUserLimit * modelsMultiplier,
  );
  if (userDecision.limited) return userDecision;

  if (subject.orgId) {
    const orgDecision = consumeFixedWindow(
      openAiCompatOrgWindow,
      `${endpoint}:org:${subject.orgId}`,
      nowMs,
      baseOrgLimit * modelsMultiplier,
    );
    if (orgDecision.limited) return orgDecision;
  }

  const callerDecision = consumeFixedWindow(
    openAiCompatCallerWindow,
    `${endpoint}:caller:${subject.callerKey}`,
    nowMs,
    baseCallerLimit * modelsMultiplier,
  );
  return callerDecision;
}

async function streamOllama(
  model: ModelRecord,
  messages: OpenAIMessage[],
  params: { temperature?: number; max_tokens?: number },
  raw: any,
  completionId: string,
  created: number,
  pacing: StreamingPacingConfig,
): Promise<void> {
  const endpointUrl = validateModelEndpointTarget(model);
  const modelName = model.model_id || model.name;
  // Emit first SSE chunk immediately to reduce TTFB for streaming clients.
  writeSSE(raw, buildInitialRoleChunk(completionId, created, modelName));

  const ollamaMessages = messages.map((m) => ({
    role: m.role,
    content: m.content || '',
  }));

  const ollamaOptions: Record<string, unknown> = {};
  if (params.temperature !== undefined) ollamaOptions.temperature = params.temperature;
  if (params.max_tokens !== undefined) ollamaOptions.num_predict = params.max_tokens;

  const response = await fetchOpenAiCompatUpstream(`${endpointUrl.toString().replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.model_id || model.name,
      messages: ollamaMessages,
      stream: true,
      ...(Object.keys(ollamaOptions).length > 0 ? { options: ollamaOptions } : {}),
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama streaming error: ${response.status}`);
  }

  const planner = new StreamingChunkPlanner(pacing);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          for (const planned of planner.push(String(parsed.message.content))) {
            const chunk: StreamChunk & { x_sven_streaming?: { delay_ms: number } } = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: modelName,
              choices: [{
                index: 0,
                delta: { content: planned.content },
                finish_reason: null,
              }],
              x_sven_streaming: { delay_ms: planned.delayMs },
            };
            writeSSE(raw, chunk);
          }
        }
        if (parsed.done) {
          for (const planned of planner.flush()) {
            const chunk: StreamChunk & { x_sven_streaming?: { delay_ms: number } } = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: modelName,
              choices: [{
                index: 0,
                delta: { content: planned.content },
                finish_reason: null,
              }],
              x_sven_streaming: { delay_ms: planned.delayMs },
            };
            writeSSE(raw, chunk);
          }
          const finalChunk: StreamChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: modelName,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop',
            }],
          };
          writeSSE(raw, finalChunk);
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  }

  raw.write('data: [DONE]\n\n');
}

async function streamOpenAI(
  model: ModelRecord,
  messages: OpenAIMessage[],
  params: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string | string[];
    presence_penalty?: number;
    frequency_penalty?: number;
  },
  raw: any,
  completionId: string,
  created: number,
  pacing: StreamingPacingConfig,
): Promise<void> {
  const endpointUrl = validateModelEndpointTarget(model);
  const modelName = model.model_id || model.name;
  // Emit first SSE chunk immediately to reduce TTFB for streaming clients.
  writeSSE(raw, buildInitialRoleChunk(completionId, created, modelName));

  const apiKey = resolveForwardedUpstreamApiKey(endpointUrl);
  const body: Record<string, unknown> = {
    model: modelName,
    messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
    stream: true,
  };

  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.max_tokens !== undefined) body.max_tokens = params.max_tokens;
  if (params.top_p !== undefined) body.top_p = params.top_p;
  if (params.stop !== undefined) body.stop = params.stop;
  if (params.presence_penalty !== undefined) body.presence_penalty = params.presence_penalty;
  if (params.frequency_penalty !== undefined) body.frequency_penalty = params.frequency_penalty;

  const response = await fetchOpenAiCompatUpstream(`${endpointUrl.toString().replace(/\/+$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`LLM streaming error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const planner = new StreamingChunkPlanner(pacing);
  let emittedRole = true;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') {
        for (const planned of planner.flush()) {
          const flushChunk: StreamChunk & { x_sven_streaming?: { delay_ms: number } } = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: modelName,
            choices: [{
              index: 0,
              delta: { content: planned.content },
              finish_reason: null,
            }],
            x_sven_streaming: { delay_ms: planned.delayMs },
          };
          writeSSE(raw, flushChunk);
        }
        raw.write('data: [DONE]\n\n');
        return;
      }
      try {
        const parsed = JSON.parse(payload);
        const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
        for (const choice of choices) {
          const content = String(choice?.delta?.content || '');
          if (content) {
            for (const planned of planner.push(content)) {
              const chunk: StreamChunk & { x_sven_streaming?: { delay_ms: number } } = {
                id: completionId,
                object: 'chat.completion.chunk',
                created,
                model: modelName,
                choices: [{
                  index: Number(choice?.index ?? 0),
                  delta: { content: planned.content },
                  finish_reason: null,
                }],
                x_sven_streaming: { delay_ms: planned.delayMs },
              };
              writeSSE(raw, chunk);
            }
          }
          if (choice?.delta?.role && !emittedRole) {
            const roleChunk: StreamChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: modelName,
              choices: [{
                index: Number(choice?.index ?? 0),
                delta: { role: choice.delta.role },
                finish_reason: null,
              }],
            };
            writeSSE(raw, roleChunk);
            emittedRole = true;
          }
          if (choice?.finish_reason) {
            for (const planned of planner.flush()) {
              const flushChunk: StreamChunk & { x_sven_streaming?: { delay_ms: number } } = {
                id: completionId,
                object: 'chat.completion.chunk',
                created,
                model: modelName,
                choices: [{
                  index: Number(choice?.index ?? 0),
                  delta: { content: planned.content },
                  finish_reason: null,
                }],
                x_sven_streaming: { delay_ms: planned.delayMs },
              };
              writeSSE(raw, flushChunk);
            }
            const finishChunk: StreamChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: modelName,
              choices: [{
                index: Number(choice?.index ?? 0),
                delta: {},
                finish_reason: choice.finish_reason,
              }],
            };
            writeSSE(raw, finishChunk);
          }
        }
      } catch {
        // skip malformed
      }
    }
  }

  raw.write('data: [DONE]\n\n');
}

// ─── Route Registration ────────────────────────────────────────────────

export async function registerOpenAIRoutes(app: FastifyInstance, pool: pg.Pool) {
  function resolveAgentId(request: any, userField?: unknown): string | undefined {
    const header = String(request.headers?.['x-sven-agent-id'] || '').trim();
    if (header) return header;
    const user = String(userField || '').trim();
    if (user.startsWith('agent:')) {
      const parsed = user.slice('agent:'.length).trim();
      return parsed || undefined;
    }
    return undefined;
  }

  function normalizeResponsesInputToMessages(input: unknown): OpenAIMessage[] {
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }

    if (!Array.isArray(input)) return [];

    const out: OpenAIMessage[] = [];
    for (const item of input as any[]) {
      if (!item || typeof item !== 'object') continue;
      const role = String(item.role || 'user') as OpenAIMessage['role'];
      const contentRaw = (item as any).content;

      if (typeof contentRaw === 'string') {
        out.push({ role, content: contentRaw });
        continue;
      }

      if (Array.isArray(contentRaw)) {
        const textParts = contentRaw
          .map((part) => {
            if (!part || typeof part !== 'object') return '';
            const type = String((part as any).type || '').toLowerCase();
            if (type === 'input_text' || type === 'text') {
              return String((part as any).text || '');
            }
            return '';
          })
          .filter(Boolean);
        out.push({ role, content: textParts.join('\n').trim() || null });
      }
    }

    return out.filter((m) => typeof m.content === 'string' && m.content.trim().length > 0);
  }

  // ─── POST /v1/chat/completions ───
  app.post('/v1/chat/completions', async (request, reply) => {
    const auth = await authenticateOpenAI(request, reply, pool, 'chat.complete');
    if (!auth) return;
    const rateLimit = shouldRateLimitOpenAiCompat('chat_completions', {
      callerKey: auth.callerKey,
      userId: auth.userId,
      orgId: auth.orgId,
    });
    if (rateLimit.limited) {
      reply.header('Retry-After', String(rateLimit.retryAfterSec));
      return reply.status(429).send({
        error: {
          message: 'OpenAI-compatible chat/completions rate limit exceeded. Please retry later.',
          type: 'rate_limit_error',
          param: null,
          code: 'rate_limited',
        },
      });
    }

    const bodyParsed = normalizeOpenAiCompatBody<ChatCompletionRequest>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        error: {
          message: bodyParsed.message,
          type: 'invalid_request_error',
          param: null,
          code: null,
        },
      });
    }
    const body = bodyParsed.value;

    // Validate required fields
    if (typeof body.model !== 'string' || body.model.trim().length === 0) {
      return reply.status(400).send({
        error: {
          message: '`model` is required.',
          type: 'invalid_request_error',
          param: 'model',
          code: null,
        },
      });
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return reply.status(400).send({
        error: {
          message: '`messages` is required and must be a non-empty array.',
          type: 'invalid_request_error',
          param: 'messages',
          code: null,
        },
      });
    }

    if (body.messages.length > 2048) {
      return reply.status(400).send({
        error: {
          message: '`messages` array exceeds maximum length of 2048.',
          type: 'invalid_request_error',
          param: 'messages',
          code: null,
        },
      });
    }

    // Resolve model from registry
    const model = await resolveModel(pool, body.model, auth.orgId);
    if (!model) {
      return reply.status(404).send({
        error: {
          message: `Model '${body.model}' not found. Use GET /v1/models to see available models.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
        },
      });
    }

    const completionId = `chatcmpl-${uuidv7().replace(/-/g, '')}`;
    const created = Math.floor(Date.now() / 1000);

    const params = {
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      top_p: body.top_p,
      stop: body.stop,
      presence_penalty: body.presence_penalty,
      frequency_penalty: body.frequency_penalty,
    };

    // ── Streaming mode ──
    if (body.stream) {
      const agentId = resolveAgentId(request, body.user);
      const pacing = await loadStreamingPacingConfig(pool, agentId);
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        if (model.provider === 'ollama') {
          await streamOllama(model, body.messages, params, reply.raw, completionId, created, pacing);
        } else {
          await streamOpenAI(model, body.messages, params, reply.raw, completionId, created, pacing);
        }
      } catch (err) {
        const timeout = isOpenAiCompatUpstreamTimeoutError(err);
        logger.error('Streaming error', { err: String(err), model: model.name, timeout });
        // Write error as SSE event for well-behaved clients
        try {
          writeSSE(reply.raw, {
            error: {
              message: timeout
                ? 'Upstream provider timed out during streaming.'
                : 'Internal server error during streaming.',
              type: 'server_error',
              param: null,
              code: timeout ? 'upstream_timeout' : null,
            },
          });
          reply.raw.write('data: [DONE]\n\n');
        } catch {
          // client may have disconnected
        }
      } finally {
        try {
          reply.raw.end();
        } catch {
          // already closed
        }
      }
      return;
    }

    // ── Non-streaming mode ──
    try {
      const result = await callProviderNonStreaming(model, body.messages, params);

      const response: ChatCompletionResponse = {
        id: completionId,
        object: 'chat.completion',
        created,
        model: model.model_id || model.name,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: result.text },
            finish_reason: (result.finish_reason as ChatCompletionChoice['finish_reason']) || 'stop',
          },
        ],
        usage: {
          prompt_tokens: result.prompt_tokens,
          completion_tokens: result.completion_tokens,
          total_tokens: result.prompt_tokens + result.completion_tokens,
        },
      };

      reply.send(response);
    } catch (err) {
      const timeout = isOpenAiCompatUpstreamTimeoutError(err);
      logger.error('Completion error', { err: String(err), model: model.name, timeout });
      reply.status(timeout ? 504 : 502).send({
        error: {
          message: timeout
            ? 'Upstream LLM provider timed out.'
            : 'Error communicating with the upstream LLM provider.',
          type: 'server_error',
          param: null,
          code: timeout ? 'upstream_timeout' : null,
        },
      });
    }
  });

  // ─── GET /v1/models ───
  app.get('/v1/models', async (request, reply) => {
    const auth = await authenticateOpenAI(request, reply, pool, 'models.read');
    if (!auth) return;
    const rateLimit = shouldRateLimitOpenAiCompat('models', {
      callerKey: auth.callerKey,
      userId: auth.userId,
      orgId: auth.orgId,
    });
    if (rateLimit.limited) {
      reply.header('Retry-After', String(rateLimit.retryAfterSec));
      return reply.status(429).send({
        error: {
          message: 'OpenAI-compatible models rate limit exceeded. Please retry later.',
          type: 'rate_limit_error',
          param: null,
          code: 'rate_limited',
        },
      });
    }

    try {
      const orgFilter = auth.orgId
        ? `WHERE organization_id = $1 OR organization_id IS NULL`
        : `WHERE organization_id IS NULL`;
      const params = auth.orgId ? [auth.orgId] : [];

      const result = await pool.query(
        `SELECT id, name, model_id, provider, is_local, created_at
         FROM model_registry
         ${orgFilter}
         ORDER BY name ASC`,
        params,
      );

      const models = result.rows.map((row: any) => ({
        id: row.model_id || row.name,
        object: 'model' as const,
        created: Math.floor(new Date(row.created_at).getTime() / 1000),
        owned_by: row.provider || 'sven',
        permission: [],
        root: row.model_id || row.name,
        parent: null,
      }));

      reply.send({
        object: 'list',
        data: models,
      });
    } catch (err) {
      logger.error('Models listing error', { err: String(err) });
      reply.send({ object: 'list', data: [] });
    }
  });

  // ─── POST /v1/responses ───
  app.post('/v1/responses', async (request, reply) => {
    const auth = await authenticateOpenAI(request, reply, pool, 'responses.create');
    if (!auth) return;
    const rateLimit = shouldRateLimitOpenAiCompat('responses', {
      callerKey: auth.callerKey,
      userId: auth.userId,
      orgId: auth.orgId,
    });
    if (rateLimit.limited) {
      reply.header('Retry-After', String(rateLimit.retryAfterSec));
      return reply.status(429).send({
        error: {
          message: 'OpenAI-compatible responses rate limit exceeded. Please retry later.',
          type: 'rate_limit_error',
          param: null,
          code: 'rate_limited',
        },
      });
    }

    const body = request.body as ResponsesRequest;
    if (!body?.model) {
      return reply.status(400).send({
        error: {
          message: '`model` is required.',
          type: 'invalid_request_error',
          param: 'model',
          code: null,
        },
      });
    }

    const messages = normalizeResponsesInputToMessages(body.input);
    if (messages.length === 0) {
      return reply.status(400).send({
        error: {
          message: '`input` must be a string or a non-empty message array.',
          type: 'invalid_request_error',
          param: 'input',
          code: null,
        },
      });
    }

    if (messages.length > 2048) {
      return reply.status(400).send({
        error: {
          message: '`input` array exceeds maximum length of 2048.',
          type: 'invalid_request_error',
          param: 'input',
          code: null,
        },
      });
    }

    const model = await resolveModel(pool, body.model, auth.orgId);
    if (!model) {
      return reply.status(404).send({
        error: {
          message: `Model '${body.model}' not found. Use GET /v1/models to see available models.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
        },
      });
    }

    const responseId = `resp_${uuidv7().replace(/-/g, '')}`;
    const created = Math.floor(Date.now() / 1000);
    const params = {
      temperature: body.temperature,
      max_tokens: body.max_output_tokens,
      top_p: body.top_p,
      stop: undefined as string | string[] | undefined,
      presence_penalty: undefined as number | undefined,
      frequency_penalty: undefined as number | undefined,
    };

    try {
      const result = await callProviderNonStreaming(model, messages, params);
      const text = result.text || '';

      if (body.stream) {
        const agentId = resolveAgentId(request, body.user);
        const pacing = await loadStreamingPacingConfig(pool, agentId);
        const planner = new StreamingChunkPlanner(pacing);
        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        for (const planned of [...planner.push(text), ...planner.flush()]) {
          writeSSE(reply.raw, {
            type: 'response.output_text.delta',
            response_id: responseId,
            delta: planned.content,
            x_sven_streaming: { delay_ms: planned.delayMs },
          });
        }
        writeSSE(reply.raw, {
          type: 'response.completed',
          response: {
            id: responseId,
            object: 'response',
            created_at: created,
            model: model.model_id || model.name,
            status: 'completed',
          },
        });
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }

      return reply.send({
        id: responseId,
        object: 'response',
        created_at: created,
        model: model.model_id || model.name,
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text },
            ],
          },
        ],
        output_text: text,
        usage: {
          input_tokens: result.prompt_tokens,
          output_tokens: result.completion_tokens,
          total_tokens: result.prompt_tokens + result.completion_tokens,
        },
      });
    } catch (err) {
      const timeout = isOpenAiCompatUpstreamTimeoutError(err);
      logger.error('Responses API error', { err: String(err), model: model.name, timeout });
      return reply.status(timeout ? 504 : 502).send({
        error: {
          message: timeout
            ? 'Upstream LLM provider timed out.'
            : 'Error communicating with the upstream LLM provider.',
          type: 'server_error',
          param: null,
          code: timeout ? 'upstream_timeout' : null,
        },
      });
    }
  });

  // ─── POST /v1/api-keys ── Generate a new API key ───
  app.post('/v1/api-keys', async (request, reply) => {
    const userId = await requireBearerSessionUser(request, reply, pool, 'create');
    if (!userId) return;
    const body = (request.body || {}) as { name?: string; expires_in_days?: number; organization_id?: string };
    const keyName = String(body.name || 'default').trim().slice(0, 64);
    const activeOrgIds = await listActiveOrganizationIdsForUser(pool, userId);
    const selectedOrg = resolveSelectedOrganizationId(body.organization_id, request, activeOrgIds);
    if (!selectedOrg.ok) {
      return reply.status(selectedOrg.statusCode).send({
        error: {
          message: selectedOrg.message,
          type: 'invalid_request_error',
          param: selectedOrg.param,
          code: selectedOrg.statusCode === 403 ? 'organization_forbidden' : null,
        },
      });
    }

    const kid = crypto.randomBytes(8).toString('hex');
    // Generate key: sk-sven-<kid>.<secret>
    const rawKey = `sk-sven-${kid}.${crypto.randomBytes(24).toString('hex')}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyId = uuidv7();

    const expiresAt = body.expires_in_days
      ? new Date(Date.now() + body.expires_in_days * 86400000).toISOString()
      : null;

    await pool.query(
      `INSERT INTO api_keys (id, user_id, organization_id, kid, name, prefix, key_hash, scopes, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [keyId, userId, selectedOrg.organizationId, kid, keyName, prefix, keyHash, ['openai'], expiresAt],
    );

    logger.info('API key created', {
      key_id: keyId,
      user_id: userId,
      kid,
      organization_id: selectedOrg.organizationId,
      name: keyName,
    });

    // Return key only once — user must store it
    reply.status(201).send({
      success: true,
      data: {
        id: keyId,
        kid,
        organization_id: selectedOrg.organizationId,
        name: keyName,
        key: rawKey,
        prefix,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
    });
  });

  // ─── GET /v1/api-keys ── List user's API keys ───
  app.get('/v1/api-keys', async (request, reply) => {
    const userId = await requireBearerSessionUser(request, reply, pool, 'list');
    if (!userId) return;
    const query = (request.query || {}) as { organization_id?: string };
    const activeOrgIds = await listActiveOrganizationIdsForUser(pool, userId);
    const selectedOrg = resolveSelectedOrganizationId(query.organization_id, request, activeOrgIds);
    if (!selectedOrg.ok) {
      return reply.status(selectedOrg.statusCode).send({
        error: {
          message: selectedOrg.message,
          type: 'invalid_request_error',
          param: selectedOrg.param,
          code: selectedOrg.statusCode === 403 ? 'organization_forbidden' : null,
        },
      });
    }
    const result = await pool.query(
      `SELECT id, kid, organization_id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at
       FROM api_keys
       WHERE user_id = $1 AND organization_id = $2
       ORDER BY created_at DESC`,
      [userId, selectedOrg.organizationId],
    );

    reply.send({ success: true, data: result.rows });
  });

  // ─── DELETE /v1/api-keys/:id ── Revoke an API key ───
  app.delete('/v1/api-keys/:id', async (request, reply) => {
    const userId = await requireBearerSessionUser(request, reply, pool, 'revoke');
    if (!userId) return;
    const { id } = request.params as { id: string };
    const query = (request.query || {}) as { organization_id?: string };
    const activeOrgIds = await listActiveOrganizationIdsForUser(pool, userId);
    const selectedOrg = resolveSelectedOrganizationId(query.organization_id, request, activeOrgIds);
    if (!selectedOrg.ok) {
      return reply.status(selectedOrg.statusCode).send({
        error: {
          message: selectedOrg.message,
          type: 'invalid_request_error',
          param: selectedOrg.param,
          code: selectedOrg.statusCode === 403 ? 'organization_forbidden' : null,
        },
      });
    }

    const result = await pool.query(
      `UPDATE api_keys SET revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND organization_id = $3 AND revoked_at IS NULL
       RETURNING id`,
      [id, userId, selectedOrg.organizationId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: { message: 'API key not found or already revoked.', type: 'invalid_request_error', param: null, code: null },
      });
    }

    logger.info('API key revoked', { key_id: id, user_id: userId });
    reply.send({ success: true, data: { id, revoked: true } });
  });
}


