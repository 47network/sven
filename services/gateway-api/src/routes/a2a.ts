import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import bcrypt from 'bcrypt';
import { isIP } from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';

type A2ARequestBody = {
  request_id?: string;
  action?: string;
  task?: unknown;
  context?: Record<string, unknown>;
  peer?: {
    url?: string;
    api_key?: string;
    timeout_ms?: number;
  };
};

const FORWARD_ACTION_PATTERN = /^[a-z0-9._-]{1,64}$/;
const A2A_SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|api.?key|credential|cookie|session)/i;
const A2A_REDACTED = '***';
const A2A_KID_REGEX = /^[a-f0-9]{16}$/i;
const DEFAULT_A2A_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_A2A_RATE_LIMIT_MAX_REQUESTS = 120;
const MIN_A2A_RATE_LIMIT_WINDOW_MS = 1000;
const MAX_A2A_RATE_LIMIT_WINDOW_MS = 600000;
const MIN_A2A_RATE_LIMIT_MAX_REQUESTS = 1;
const MAX_A2A_RATE_LIMIT_MAX_REQUESTS = 10000;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const a2aRateLimitState = new Map<string, { windowStartedAtMs: number; count: number }>();

export function resetA2aRateLimitStateForTests(): void {
  a2aRateLimitState.clear();
}

function parseAllowlistHosts(raw: string): Set<string> {
  return new Set(
    String(raw || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function isForbiddenForwardHost(hostnameRaw: string): boolean {
  const hostname = String(hostnameRaw || '').trim().toLowerCase();
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    const parts = hostname.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (ipVersion === 6) {
    if (hostname === '::1') return true;
    if (hostname.startsWith('fe80:')) return true;
    if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
    return false;
  }

  return false;
}

function validateForwardPeerUrl(peerUrlRaw: string): { ok: true; url: URL } | { ok: false; code: string; message: string } {
  let parsed: URL;
  try {
    parsed = new URL(peerUrlRaw);
  } catch {
    return {
      ok: false,
      code: 'A2A_FORWARD_PEER_URL_REQUIRED',
      message: 'peer.url (http/https) is required for forward action',
    };
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return {
      ok: false,
      code: 'A2A_FORWARD_PEER_URL_REQUIRED',
      message: 'peer.url (http/https) is required for forward action',
    };
  }
  const allowHttpForward = parseBool(process.env.SVEN_A2A_FORWARD_ALLOW_HTTP, false);
  if (parsed.protocol.toLowerCase() !== 'https:' && !allowHttpForward) {
    return {
      ok: false,
      code: 'A2A_FORWARD_TLS_REQUIRED',
      message: 'peer.url must use https',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      code: 'A2A_FORWARD_PEER_URL_INVALID',
      message: 'peer.url must not include embedded credentials',
    };
  }

  const allowlist = parseAllowlistHosts(process.env.SVEN_A2A_FORWARD_ALLOWLIST_HOSTS || '');
  const allowPrivateHosts = parseBool(process.env.SVEN_A2A_FORWARD_ALLOW_PRIVATE_HOSTS, false);
  if (allowlist.size === 0) {
    return {
      ok: false,
      code: 'A2A_FORWARD_ALLOWLIST_REQUIRED',
      message: 'SVEN_A2A_FORWARD_ALLOWLIST_HOSTS must be configured for forward action',
    };
  }
  if (!allowPrivateHosts && isForbiddenForwardHost(parsed.hostname)) {
    return {
      ok: false,
      code: 'A2A_FORWARD_PEER_HOST_FORBIDDEN',
      message: 'peer.url host is not permitted for A2A forward',
    };
  }
  if (allowlist.size > 0 && !allowlist.has(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      code: 'A2A_FORWARD_PEER_HOST_FORBIDDEN',
      message: 'peer.url host is not permitted by SVEN_A2A_FORWARD_ALLOWLIST_HOSTS',
    };
  }

  return { ok: true, url: parsed };
}

function getA2aApiKey(headers: Record<string, unknown>): string {
  const auth = String(headers.authorization || '');
  const fromBearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const fromHeader = String(headers['x-sven-a2a-key'] || '').trim();
  return fromBearer || fromHeader;
}

function extractApiKeyKid(token: string): string | null {
  const match = /^sk-sven-([^.]+)\./i.exec(token);
  if (!match) return null;
  const kid = String(match[1] || '').trim().toLowerCase();
  if (!A2A_KID_REGEX.test(kid)) return null;
  return kid;
}

type A2AAuthContext = {
  organizationId: string | null;
  rateLimitKey: string;
};

function hashA2aApiKey(token: string): string {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function parseA2aRateLimitWindowMs(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_A2A_RATE_LIMIT_WINDOW_MS;
  if (parsed < MIN_A2A_RATE_LIMIT_WINDOW_MS) return MIN_A2A_RATE_LIMIT_WINDOW_MS;
  if (parsed > MAX_A2A_RATE_LIMIT_WINDOW_MS) return MAX_A2A_RATE_LIMIT_WINDOW_MS;
  return parsed;
}

function parseA2aRateLimitMaxRequests(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_A2A_RATE_LIMIT_MAX_REQUESTS;
  if (parsed < MIN_A2A_RATE_LIMIT_MAX_REQUESTS) return MIN_A2A_RATE_LIMIT_MAX_REQUESTS;
  if (parsed > MAX_A2A_RATE_LIMIT_MAX_REQUESTS) return MAX_A2A_RATE_LIMIT_MAX_REQUESTS;
  return parsed;
}

function consumeA2aRateLimit(
  rateLimitKey: string,
  nowMs: number,
  windowMs: number,
  maxRequests: number,
): { limited: false } | { limited: true; retryAfterSeconds: number } {
  const current = a2aRateLimitState.get(rateLimitKey);
  if (!current || nowMs - current.windowStartedAtMs >= windowMs) {
    a2aRateLimitState.set(rateLimitKey, { windowStartedAtMs: nowMs, count: 1 });
    return { limited: false };
  }
  if (current.count >= maxRequests) {
    const remainingMs = Math.max(0, windowMs - (nowMs - current.windowStartedAtMs));
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return { limited: true, retryAfterSeconds };
  }
  current.count += 1;
  a2aRateLimitState.set(rateLimitKey, current);
  return { limited: false };
}

async function authenticateA2A(
  request: any,
  reply: any,
  pool: pg.Pool,
): Promise<A2AAuthContext | null> {
  const suppliedApiKey = getA2aApiKey(request.headers as Record<string, unknown>);
  if (!suppliedApiKey) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_A2A_API_KEY',
        message: 'Valid A2A API key is required',
      },
    });
    return null;
  }

  const kid = extractApiKeyKid(suppliedApiKey);
  if (kid) {
    const candidate = await pool.query(
      `SELECT id, kid, organization_id, key_hash, expires_at, revoked_at
       FROM api_keys
       WHERE kid = $1
         AND revoked_at IS NULL
       LIMIT 1`,
      [kid],
    );
    const row = candidate.rows[0];
    if (row?.organization_id) {
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_A2A_API_KEY',
            message: 'Valid A2A API key is required',
          },
        });
        return null;
      }
      const match = await bcrypt.compare(suppliedApiKey, String(row.key_hash || ''));
      if (!match) {
        reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_A2A_API_KEY',
            message: 'Valid A2A API key is required',
          },
        });
        return null;
      }
      void pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => undefined);
      return {
        organizationId: String(row.organization_id),
        rateLimitKey: `org:${String(row.organization_id)}:kid:${String(row.kid || kid)}`,
      };
    }
  }

  const expectedApiKey = String(process.env.SVEN_A2A_API_KEY || '').trim();
  if (expectedApiKey && safeEqual(suppliedApiKey, expectedApiKey)) {
    return {
      organizationId: null,
      rateLimitKey: `static:${hashA2aApiKey(suppliedApiKey)}`,
    };
  }

  reply.status(401).send({
    success: false,
    error: {
      code: 'INVALID_A2A_API_KEY',
      message: 'Valid A2A API key is required',
    },
  });
  return null;
}

function redactA2APayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactA2APayload(entry));
  }
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(input)) {
      if (A2A_SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = A2A_REDACTED;
        continue;
      }
      output[key] = redactA2APayload(nested);
    }
    return output;
  }
  if (typeof value === 'string') {
    if (/bearer\s+[a-z0-9._\-+/=]{8,}/i.test(value)) return A2A_REDACTED;
    return value;
  }
  return value;
}

async function writeA2aAudit(
  pool: pg.Pool,
  row: {
    organizationId: string | null;
    requestId: string;
    action: string;
    status: 'success' | 'error';
    traceId: string | null;
    upstreamTraceId: string | null;
    peerUrl: string | null;
    requestPayload: unknown;
    responsePayload: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
) {
  await pool.query(
    `INSERT INTO a2a_audit_log
       (id, organization_id, request_id, action, direction, status, trace_id, upstream_trace_id, peer_url,
        request_payload, response_payload, error_code, error_message, created_at)
     VALUES
       ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, NOW())`,
    [
      `a2a_audit_${uuidv7()}`,
      row.organizationId,
      row.requestId,
      row.action,
      row.status,
      row.traceId,
      row.upstreamTraceId,
      row.peerUrl,
      JSON.stringify(redactA2APayload(row.requestPayload ?? null)),
      JSON.stringify(redactA2APayload(row.responsePayload ?? null)),
      row.errorCode || null,
      row.errorMessage || null,
    ],
  );
}

export async function registerA2ARoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/v1/a2a', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          request_id: { type: 'string' },
          action: { type: 'string' },
          task: {},
          context: { type: 'object', additionalProperties: true },
          peer: {
            type: 'object',
            additionalProperties: false,
            properties: {
              url: { type: 'string' },
              api_key: { type: 'string' },
              timeout_ms: { type: 'number' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const auth = await authenticateA2A(request, reply, pool);
    if (!auth) {
      return;
    }
    const rateLimitWindowMs = parseA2aRateLimitWindowMs(process.env.A2A_RATE_LIMIT_WINDOW_MS);
    const rateLimitMaxRequests = parseA2aRateLimitMaxRequests(process.env.A2A_RATE_LIMIT_MAX_REQUESTS);
    const rateLimitDecision = consumeA2aRateLimit(auth.rateLimitKey, Date.now(), rateLimitWindowMs, rateLimitMaxRequests);
    if (rateLimitDecision.limited) {
      reply.header('Retry-After', String(rateLimitDecision.retryAfterSeconds));
      reply.status(429).send({
        success: false,
        error: {
          code: 'A2A_RATE_LIMITED',
          message: 'A2A request rate limit exceeded',
        },
        data: {
          retry_after_seconds: rateLimitDecision.retryAfterSeconds,
        },
      });
      return;
    }

    const body = (request.body || {}) as A2ARequestBody;
    const requestId = String(body.request_id || `${Date.now()}`);
    const action = String(body.action || '').trim().toLowerCase();
    const traceId = request.correlationId || String(request.id || requestId);
    const organizationId = auth.organizationId;

    if (!action) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'A2A_ACTION_REQUIRED',
          message: 'action is required',
        },
        data: {
          request_id: requestId,
          trace_id: traceId,
        },
      });
      return;
    }

    if (action === 'status') {
      reply.send({
        success: true,
        data: {
          request_id: requestId,
          trace_id: traceId,
          status: 'completed',
          result: {
            service: 'sven-gateway',
            now_iso: new Date().toISOString(),
            actions_supported: ['status', 'echo', 'tools.list'],
          },
        },
      });
      return;
    }

    if (action === 'tools.list') {
      if (!organizationId) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'A2A_ORG_CONTEXT_REQUIRED',
            message: 'Organization-bound A2A API key is required for tools.list',
          },
          data: {
            request_id: requestId,
            trace_id: traceId,
          },
        });
        return;
      }

      let res: { rows: Array<{ name: string }> };
      try {
        res = await pool.query(
          `SELECT DISTINCT t.name
           FROM tools t
           JOIN skills_installed si
             ON si.tool_id = t.id
          WHERE si.organization_id = $1
            AND t.status = 'active'
            AND si.trust_level <> 'blocked'
          ORDER BY t.name ASC
          LIMIT 200`,
          [organizationId],
        );
      } catch (error) {
        const code = String((error as any)?.code || '');
        if (code === '42P01' || code === '42703') {
          reply.status(503).send({
            success: false,
            error: {
              code: 'A2A_TOOL_SCOPE_UNAVAILABLE',
              message: 'A2A tool scope inventory is unavailable',
            },
            data: {
              request_id: requestId,
              trace_id: traceId,
            },
          });
          return;
        }
        throw error;
      }
      reply.send({
        success: true,
        data: {
          request_id: requestId,
          trace_id: traceId,
          status: 'completed',
          result: {
            tools: res.rows.map((row: any) => String(row.name)),
          },
        },
      });
      return;
    }

    if (action === 'echo') {
      reply.send({
        success: true,
        data: {
          request_id: requestId,
          trace_id: traceId,
          status: 'completed',
          result: {
            task: body.task || null,
            context: body.context || {},
          },
        },
      });
      return;
    }

    if (action === 'forward') {
      if (!organizationId) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'A2A_ORG_CONTEXT_REQUIRED',
            message: 'Organization-bound A2A API key is required for forward action',
          },
          data: {
            request_id: requestId,
            trace_id: traceId,
          },
        });
        return;
      }
      const peerUrl = String(body.peer?.url || process.env.SVEN_A2A_DEFAULT_PEER_URL || '').trim();
      const peerApiKey = String(body.peer?.api_key || process.env.SVEN_A2A_DEFAULT_PEER_API_KEY || '').trim();
      const timeoutMsRaw = Number(body.peer?.timeout_ms || process.env.SVEN_A2A_FORWARD_TIMEOUT_MS || 15000);
      const timeoutMs = Math.min(60000, Math.max(1000, Number.isFinite(timeoutMsRaw) ? timeoutMsRaw : 15000));

      const peerValidation = validateForwardPeerUrl(peerUrl);
      if (!peerValidation.ok) {
        reply.status(400).send({
          success: false,
          error: {
            code: peerValidation.code,
            message: peerValidation.message,
          },
          data: {
            request_id: requestId,
            trace_id: traceId,
          },
        });
        return;
      }
      if (!peerApiKey) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'A2A_FORWARD_PEER_API_KEY_REQUIRED',
            message: 'peer.api_key is required for forward action',
          },
          data: {
            request_id: requestId,
            trace_id: traceId,
          },
        });
        return;
      }

      const forwardTask = (body.task || {}) as Record<string, unknown>;
      const forwardAction = String(forwardTask.action || 'status').trim().toLowerCase();
      if (!FORWARD_ACTION_PATTERN.test(forwardAction)) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'A2A_FORWARD_ACTION_INVALID',
            message: 'task.action must match [a-z0-9._-] and be 1-64 chars',
          },
          data: {
            request_id: requestId,
            trace_id: traceId,
          },
        });
        return;
      }
      const forwardPayload = {
        request_id: requestId,
        action: forwardAction,
        task: Object.prototype.hasOwnProperty.call(forwardTask, 'task') ? forwardTask.task : null,
        context: (forwardTask.context as Record<string, unknown> | undefined) || body.context || {},
      };

      const abortController = new AbortController();
      const timer = setTimeout(() => abortController.abort(), timeoutMs);
      try {
        const upstream = await fetch(peerUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${peerApiKey}`,
            'x-correlation-id': traceId,
          },
          body: JSON.stringify(forwardPayload),
          signal: abortController.signal,
        });
        const MAX_A2A_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
        const chunks: Buffer[] = [];
        let total = 0;
        if (upstream.body) {
          const reader = (upstream.body as any).getReader ? (upstream.body as any).getReader() : null;
          if (reader) {
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > MAX_A2A_RESPONSE_BYTES) {
                  try { await reader.cancel(); } catch { /* best effort */ }
                  throw new Error('A2A forward response too large');
                }
                chunks.push(Buffer.from(value));
              }
            } finally {
              reader.releaseLock();
            }
          }
        }
        const raw = chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : await upstream.text();
        let parsed: unknown = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }

        if (!upstream.ok) {
          const upstreamTraceId =
            String(upstream.headers.get('x-correlation-id') || '').trim()
            || String((parsed as any)?.data?.trace_id || '').trim()
            || null;
          try {
            await writeA2aAudit(pool, {
              organizationId,
              requestId,
              action,
              status: 'error',
              traceId,
              upstreamTraceId,
              peerUrl,
              requestPayload: forwardPayload,
              responsePayload: parsed || raw || null,
              errorCode: 'A2A_FORWARD_FAILED',
              errorMessage: `Upstream A2A peer returned ${upstream.status}`,
            });
          } catch {
            reply.status(503).send({
              success: false,
              error: {
                code: 'A2A_AUDIT_WRITE_FAILED',
                message: 'A2A audit persistence failed',
              },
              data: {
                request_id: requestId,
                trace_id: traceId,
                upstream_trace_id: upstreamTraceId,
              },
            });
            return;
          }
          reply.status(502).send({
            success: false,
            error: {
              code: 'A2A_FORWARD_FAILED',
              message: `Upstream A2A peer returned ${upstream.status}`,
            },
            data: {
              request_id: requestId,
              trace_id: traceId,
              upstream_trace_id: upstreamTraceId,
              upstream_status: upstream.status,
              upstream_body_redacted: true,
            },
          });
          return;
        }

        const upstreamTraceId =
          String(upstream.headers.get('x-correlation-id') || '').trim()
          || String((parsed as any)?.data?.trace_id || '').trim()
          || null;

        try {
          await writeA2aAudit(pool, {
            organizationId,
            requestId,
            action,
            status: 'success',
            traceId,
            upstreamTraceId,
            peerUrl,
            requestPayload: forwardPayload,
            responsePayload: parsed || raw || null,
          });
        } catch {
          reply.status(503).send({
            success: false,
            error: {
              code: 'A2A_AUDIT_WRITE_FAILED',
              message: 'A2A audit persistence failed',
            },
            data: {
              request_id: requestId,
              trace_id: traceId,
              upstream_trace_id: upstreamTraceId,
            },
          });
          return;
        }
        reply.send({
          success: true,
          data: {
            request_id: requestId,
            trace_id: traceId,
            upstream_trace_id: upstreamTraceId,
            status: 'completed',
            result: {
              peer_url: peerUrl,
              upstream_status: upstream.status,
              upstream_response: parsed || raw || null,
            },
          },
        });
        return;
      } catch (err: any) {
        const message = String(err?.message || err || 'A2A forward failed');
        const isAbort = /aborted|abort/i.test(message);
        try {
          await writeA2aAudit(pool, {
            organizationId,
            requestId,
            action,
            status: 'error',
            traceId,
            upstreamTraceId: null,
            peerUrl,
            requestPayload: forwardPayload,
            responsePayload: null,
            errorCode: isAbort ? 'A2A_FORWARD_TIMEOUT' : 'A2A_FORWARD_FAILED',
            errorMessage: message,
          });
        } catch {
          reply.status(503).send({
            success: false,
            error: {
              code: 'A2A_AUDIT_WRITE_FAILED',
              message: 'A2A audit persistence failed',
            },
            data: {
              request_id: requestId,
              trace_id: traceId,
            },
          });
          return;
        }
        reply.status(isAbort ? 504 : 502).send({
          success: false,
          error: {
            code: isAbort ? 'A2A_FORWARD_TIMEOUT' : 'A2A_FORWARD_FAILED',
            message,
          },
          data: {
            request_id: requestId,
            trace_id: traceId,
          },
        });
        return;
      } finally {
        clearTimeout(timer);
      }
    }

    reply.status(400).send({
      success: false,
      error: {
        code: 'A2A_ACTION_UNSUPPORTED',
        message: `Unsupported action: ${action}`,
      },
      data: {
        request_id: requestId,
        trace_id: traceId,
      },
    });
  });
}
