import { FastifyInstance } from 'fastify';
import pg from 'pg';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

const MAX_TOOLS_LIST_LIMIT = 500;
const MCP_KID_REGEX = /^[a-f0-9]{16}$/i;
type McpMethodScope = 'mcp.initialize' | 'mcp.tools.list' | 'mcp.tools.call' | 'mcp.resources.list';

/**
 * Safe arithmetic evaluator — recursive descent parser for +, -, *, /, %, ().
 * Replaces Function() to avoid code-injection primitive.
 */
function safeEvalArithmetic(expr: string): number {
  let pos = 0;
  const chars = expr.replace(/\s+/g, '');

  function parseExpr(): number {
    let result = parseTerm();
    while (pos < chars.length && (chars[pos] === '+' || chars[pos] === '-')) {
      const op = chars[pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < chars.length && (chars[pos] === '*' || chars[pos] === '/' || chars[pos] === '%')) {
      const op = chars[pos++];
      const right = parseFactor();
      if (op === '*') result *= right;
      else if (op === '/') result /= right;
      else result %= right;
    }
    return result;
  }

  function parseFactor(): number {
    if (chars[pos] === '(') {
      pos++;
      const result = parseExpr();
      if (chars[pos] !== ')') throw new Error('mismatched parentheses');
      pos++;
      return result;
    }
    // Handle unary minus/plus
    if (chars[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (chars[pos] === '+') {
      pos++;
      return parseFactor();
    }
    const start = pos;
    while (pos < chars.length && (chars[pos] >= '0' && chars[pos] <= '9' || chars[pos] === '.')) {
      pos++;
    }
    if (start === pos) throw new Error('unexpected token');
    return Number(chars.slice(start, pos));
  }

  const result = parseExpr();
  if (pos !== chars.length) throw new Error('unexpected trailing characters');
  return result;
}

type McpAuthContext = {
  userId: string;
  orgId: string;
  clientId: string;
  callerKey: string;
};

function getAuthToken(headers: Record<string, unknown>): string {
  const auth = String(headers.authorization || '');
  const fromBearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const fromHeader = String(headers['x-sven-mcp-token'] || '').trim();
  return fromBearer || fromHeader;
}

function normalizeScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function hasScope(rawScopes: unknown, requiredScope: McpMethodScope): boolean {
  const scopes = normalizeScopes(rawScopes);
  if (scopes.length === 0) return false;
  if (scopes.includes('*') || scopes.includes('mcp') || scopes.includes('mcp.*')) return true;
  if (scopes.includes(requiredScope)) return true;
  const [domain, action] = requiredScope.split('.');
  if (scopes.includes(`${domain}.*`)) return true;
  if (action === 'list' && scopes.includes(`${domain}.read`)) return true;
  return false;
}

function extractApiKeyKid(token: string): string | null {
  const match = /^sk-sven-([^.]+)\./i.exec(token);
  if (!match) return null;
  const kid = String(match[1] || '').trim().toLowerCase();
  if (!MCP_KID_REGEX.test(kid)) return null;
  return kid;
}

function resolveMcpClientId(request: any): string {
  const headers = (request.headers || {}) as Record<string, unknown>;
  const explicit = String(headers['x-sven-mcp-client-id'] || '').trim().slice(0, 96);
  if (explicit) return explicit;
  const ip = String(request.ip || '').trim();
  const ua = String(headers['user-agent'] || '').trim();
  const hash = crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
  return `anon:${hash}`;
}

type McpSharedTokenConfig = {
  enabled: boolean;
  token: string;
};

function parseJsonSetting(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseBoolSetting(raw: unknown, fallback = false): boolean {
  const value = parseJsonSetting(raw);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

async function loadSharedTokenConfig(pool: pg.Pool): Promise<McpSharedTokenConfig> {
  const res = await pool.query(
    `SELECT key, value
     FROM settings_global
     WHERE key = ANY($1::text[])`,
    [['mcp.server.sharedTokenEnabled', 'mcp.server.sharedToken']],
  );
  const map = new Map<string, unknown>();
  for (const row of res.rows) {
    map.set(String(row.key || ''), row.value);
  }
  const enabled = map.has('mcp.server.sharedTokenEnabled')
    ? parseBoolSetting(map.get('mcp.server.sharedTokenEnabled'), false)
    : String(process.env.MCP_SERVER_ALLOW_SHARED_TOKEN || 'false').trim().toLowerCase() === 'true';
  const token = map.has('mcp.server.sharedToken')
    ? String(parseJsonSetting(map.get('mcp.server.sharedToken')) || '').trim()
    : String(process.env.SVEN_MCP_SERVER_TOKEN || '').trim();
  return { enabled, token };
}

async function authenticateMcp(
  request: any,
  reply: any,
  pool: pg.Pool,
  requiredScope: McpMethodScope,
): Promise<McpAuthContext | null> {
  const token = getAuthToken(request.headers as Record<string, unknown>);
  if (!token) {
    reply.status(401).send(rpcErr(null, -32001, 'Unauthorized MCP request'));
    return null;
  }

  const kid = extractApiKeyKid(token);
  if (kid) {
    const candidate = await pool.query(
      `SELECT id, kid, user_id, organization_id, key_hash, scopes, expires_at, revoked_at
       FROM api_keys
       WHERE kid = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [kid],
    );
    const row = candidate.rows[0];
    if (!row || !row.organization_id) {
      reply.status(401).send(rpcErr(null, -32001, 'Unauthorized MCP request'));
      return null;
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      reply.status(401).send(rpcErr(null, -32001, 'Unauthorized MCP request'));
      return null;
    }
    const match = await bcrypt.compare(token, String(row.key_hash || ''));
    if (!match) {
      reply.status(401).send(rpcErr(null, -32001, 'Unauthorized MCP request'));
      return null;
    }
    if (!hasScope(row.scopes, requiredScope)) {
      reply.status(403).send(rpcErr(null, -32003, `Missing required MCP scope: ${requiredScope}`));
      return null;
    }
    void pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => undefined);
    const callerHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    const clientId = resolveMcpClientId(request) || String(row.kid || '');
    return {
      userId: String(row.user_id),
      orgId: String(row.organization_id),
      clientId: clientId || String(row.kid || ''),
      callerKey: `mcp:${String(row.kid || '')}:${callerHash}`,
    };
  }

  const sharedTokenConfig = await loadSharedTokenConfig(pool);
  if (sharedTokenConfig.enabled && sharedTokenConfig.token && token === sharedTokenConfig.token) {
    const clientId = resolveMcpClientId(request);
    return {
      userId: 'legacy-shared-token',
      orgId: 'legacy-shared-token',
      clientId,
      callerKey: `mcp-legacy:${crypto.createHash('sha256').update(token).digest('hex').slice(0, 24)}`,
    };
  }

  reply.status(401).send(rpcErr(null, -32001, 'Unauthorized MCP request'));
  return null;
}

async function consumeWindowRate(
  pool: pg.Pool,
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const runUpsert = async () => {
    const res = await pool.query(
      `WITH bounds AS (
         SELECT to_timestamp(floor(extract(epoch FROM NOW()) * 1000 / $2::numeric) * $2::numeric / 1000.0) AS window_start
       ), upsert AS (
         INSERT INTO mcp_server_rate_limits (bucket_key, window_start, count, updated_at)
         SELECT $1, bounds.window_start, 1, NOW()
         FROM bounds
         ON CONFLICT (bucket_key, window_start)
         DO UPDATE SET count = mcp_server_rate_limits.count + 1, updated_at = NOW()
         RETURNING count
       )
       SELECT count::int AS count FROM upsert`,
      [bucketKey, windowMs],
    );
    const count = Number(res.rows[0]?.count || 0);
    return count <= limit;
  };
  try {
    return await runUpsert();
  } catch (err) {
    const code = String((err as any)?.code || '');
    if (code === '42P01' || code === '42703') {
      await ensureMcpRateLimitTable(pool);
      return runUpsert();
    }
    throw err;
  }
}

async function ensureMcpRateLimitTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mcp_server_rate_limits (
      bucket_key TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bucket_key, window_start)
    )
  `);
}

async function enforceRateLimit(
  auth: McpAuthContext,
  request: any,
  pool: pg.Pool,
): Promise<{ allowed: true } | { allowed: false; unavailable: boolean }> {
  const windowMs = Math.max(1000, Number(process.env.MCP_SERVER_RATE_WINDOW_MS || 60000));
  const perClientLimit = Math.max(1, Number(process.env.MCP_SERVER_RATE_LIMIT || 120));
  const globalLimitRaw = Number(process.env.MCP_SERVER_RATE_LIMIT_GLOBAL || 0);
  const globalLimit = Number.isFinite(globalLimitRaw) && globalLimitRaw > 0 ? Math.floor(globalLimitRaw) : 0;
  const clientId = auth.clientId || resolveMcpClientId(request);
  try {
    const allowedClient = await consumeWindowRate(pool, `client:${auth.orgId}:${clientId}`, perClientLimit, windowMs);
    if (!allowedClient) {
      return { allowed: false, unavailable: false };
    }
    if (globalLimit > 0) {
      const allowedGlobal = await consumeWindowRate(pool, `global:${auth.orgId}`, globalLimit, windowMs);
      if (!allowedGlobal) {
        return { allowed: false, unavailable: false };
      }
    }
    return { allowed: true };
  } catch (err) {
    const code = String((err as any)?.code || '');
    if (code === '42P01' || code === '42703') {
      return { allowed: false, unavailable: true };
    }
    throw err;
  }
}

function rpcOk(id: string | number | null | undefined, result: any) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcErr(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function listActiveTools(pool: pg.Pool, requestedLimit?: number) {
  const safeLimit = Math.min(
    MAX_TOOLS_LIST_LIMIT,
    Math.max(1, Number.isFinite(Number(requestedLimit)) ? Number(requestedLimit) : 200),
  );
  const res = await pool.query(
    `SELECT name
     FROM tools
     WHERE status = 'active'
     ORDER BY name ASC
     LIMIT $1`,
    [safeLimit],
  );
  return res.rows.map((row: any) => ({
    name: String(row.name),
    description: `Sven tool ${String(row.name)}`,
    inputSchema: { type: 'object' },
  }));
}

export async function registerMcpServerRoutes(app: FastifyInstance, pool: pg.Pool) {
  await ensureMcpRateLimitTable(pool);
  app.get('/v1/mcp', async (request, reply) => {
    const auth = await authenticateMcp(request, reply, pool, 'mcp.tools.list');
    if (!auth) return;
    const rateLimit = await enforceRateLimit(auth, request, pool);
    if (!rateLimit.allowed) {
      if (rateLimit.unavailable) {
        reply.status(503).send(rpcErr(null, -32050, 'Rate limiting unavailable'));
        return;
      }
      reply.status(429).send(rpcErr(null, -32029, 'Rate limit exceeded'));
      return;
    }

    const query = (request.query || {}) as { limit?: string | number };
    const tools = await listActiveTools(pool, Number(query.limit));
    reply.send(rpcOk(null, { tools }));
  });

  app.post('/v1/mcp', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          jsonrpc: { type: 'string' },
          id: {
            anyOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'null' },
            ],
          },
          method: { type: 'string' },
          params: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = (request.body as JsonRpcRequest) || {};
    const method = String(body.method || '').trim();
    const id = body.id ?? null;
    const requiredScope: McpMethodScope = method === 'tools/call'
      ? 'mcp.tools.call'
      : method === 'resources/list'
        ? 'mcp.resources.list'
        : method === 'initialize'
          ? 'mcp.initialize'
          : 'mcp.tools.list';
    const auth = await authenticateMcp(request, reply, pool, requiredScope);
    if (!auth) return;
    const rateLimit = await enforceRateLimit(auth, request, pool);
    if (!rateLimit.allowed) {
      if (rateLimit.unavailable) {
        reply.status(503).send(rpcErr(id, -32050, 'Rate limiting unavailable'));
        return;
      }
      reply.status(429).send(rpcErr(id, -32029, 'Rate limit exceeded'));
      return;
    }

    if (method === 'initialize') {
      reply.send(
        rpcOk(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'sven-gateway-mcp', version: '0.1.0' },
        }),
      );
      return;
    }

    if (method === 'tools/list') {
      const tools = await listActiveTools(pool);
      reply.send(rpcOk(id, { tools }));
      return;
    }

    if (method === 'resources/list') {
      reply.send(rpcOk(id, { resources: [] }));
      return;
    }

    if (method === 'tools/call') {
      const toolName = String(body?.params?.name || '').trim();
      const args = (body?.params?.arguments || {}) as Record<string, unknown>;
      if (!toolName) {
        reply.send(rpcErr(id, -32602, 'Tool name is required'));
        return;
      }
      if (toolName === 'sven.time.now') {
        reply.send(
          rpcOk(id, {
            content: [{ type: 'text', text: JSON.stringify({ iso: new Date().toISOString(), unix: Date.now() }) }],
          }),
        );
        return;
      }
      if (toolName === 'sven.math.eval') {
        const expr = String(args.expression || '').trim();
        if (!expr || expr.length > 256 || /[^0-9+\-*/().%\s]/.test(expr)) {
          reply.send(rpcErr(id, -32602, 'Invalid expression'));
          return;
        }
        let value: number;
        try {
          value = safeEvalArithmetic(expr);
        } catch {
          reply.send(rpcErr(id, -32602, 'Invalid expression'));
          return;
        }
        if (!Number.isFinite(value)) {
          reply.send(rpcErr(id, -32602, 'Invalid expression'));
          return;
        }
        reply.send(
          rpcOk(id, {
            content: [{ type: 'text', text: JSON.stringify({ result: value }) }],
          }),
        );
        return;
      }
      reply.send(rpcErr(id, -32601, `Unsupported tool: ${toolName}`));
      return;
    }

    reply.send(rpcErr(id, -32601, `Method not found: ${method}`));
  });
}
