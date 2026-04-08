import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { McpService } from '../../services/McpService.js';
import path from 'node:path';

type McpPresetRecord = {
  id: string;
  name: string;
  transport: 'http' | 'sse' | 'stdio';
  url: string;
  description: string;
  mode: 'install' | 'template';
  badge: string;
  verification_unavailable?: boolean;
};

type McpSharedTokenAdminConfig = {
  enabled: boolean;
  token_configured: boolean;
  token_preview: string | null;
};

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703' || code === 'MCP_ORG_SCOPE_REQUIRED';
}

function sendMcpSchemaUnavailable(reply: any, surface: string): void {
  reply.status(503).send({
    success: false,
    error: {
      code: 'FEATURE_UNAVAILABLE',
      message: `MCP ${surface} schema not available in this environment`,
    },
  });
}

function validHttpUrl(value: string): string | null {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveMcpReconnectIntervalMs(raw: unknown): { reconnectMs: number; invalid: boolean } {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(parsed)) {
    return { reconnectMs: 60000, invalid: raw !== undefined && raw !== null && String(raw).trim().length > 0 };
  }
  const reconnectMs = Math.min(300000, Math.max(10000, parsed));
  return { reconnectMs, invalid: false };
}

function resolveMcpManualReconnectCooldownMs(raw: unknown): { cooldownMs: number; invalid: boolean } {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(parsed)) {
    return { cooldownMs: 30000, invalid: raw !== undefined && raw !== null && String(raw).trim().length > 0 };
  }
  const cooldownMs = Math.min(300000, Math.max(1000, parsed));
  return { cooldownMs, invalid: false };
}

function parseOptionalBoolean(raw: unknown): { valid: boolean; value: boolean | undefined } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: raw };
}

function parseBool(raw: unknown, fallback = false): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseJsonSetting(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function previewToken(value: string): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

function resolveStdioCommandAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = String(env.SVEN_MCP_STDIO_COMMAND_ALLOWLIST || '').trim();
  const values = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

function parseStdioServerConfigForCreate(url: string): { command: string; shell?: boolean } {
  const trimmed = String(url || '').trim();
  if (!trimmed.startsWith('{')) {
    throw new Error('stdio url must be JSON object config');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('stdio url must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('stdio url must be JSON object config');
  }
  const record = parsed as Record<string, unknown>;
  const command = String(record.command || '').trim();
  if (!command) {
    throw new Error('stdio command is required');
  }
  const shell = typeof record.shell === 'boolean' ? record.shell : undefined;
  if (shell === true) {
    throw new Error('stdio shell=true is not allowed');
  }
  return { command, shell };
}

function parseLimit(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

type SanitizedMcpError = {
  statusCode: number;
  code: string;
  message: string;
};

function sanitizeMcpRouteError(err: unknown): SanitizedMcpError {
  const message = String(err instanceof Error ? err.message : err || '').trim();
  const lower = message.toLowerCase();
  if (lower.includes('server not found')) {
    return { statusCode: 404, code: 'MCP_SERVER_NOT_FOUND', message: 'MCP server not found' };
  }
  if (
    lower.includes('unauthorized mcp request') ||
    lower.includes('missing required mcp scope') ||
    lower.includes('401')
  ) {
    return {
      statusCode: 412,
      code: 'MCP_AUTH_REQUIRED',
      message: 'MCP authentication is not configured for this server. Configure a token or enable a shared local MCP token first.',
    };
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return { statusCode: 504, code: 'MCP_TIMEOUT', message: 'MCP request timed out' };
  }
  if (lower.includes('denied by policy')) {
    return { statusCode: 400, code: 'MCP_POLICY_DENIED', message: 'MCP tool call denied by policy' };
  }
  if (
    lower.includes('spawn failed') ||
    lower.includes('exited before response') ||
    lower.includes('econn') ||
    lower.includes('enotfound') ||
    lower.includes('refused')
  ) {
    return { statusCode: 502, code: 'MCP_CONNECT_FAILED', message: 'Failed to connect to MCP server' };
  }
  return { statusCode: 502, code: 'MCP_RPC_FAILED', message: 'MCP request failed' };
}

function sanitizeMcpServerRowForResponse(row: Record<string, unknown>): Record<string, unknown> {
  const token = String(row.auth_token || '').trim();
  const explicitConfigured = typeof row.auth_token_configured === 'boolean'
    ? row.auth_token_configured
    : null;
  const { auth_token: _authToken, ...rest } = row;
  return {
    ...rest,
    auth_token_configured: explicitConfigured ?? token.length > 0,
  };
}

export function resolveMcpPresets(env: NodeJS.ProcessEnv = process.env): McpPresetRecord[] {
  const gatewayBase =
    validHttpUrl(env.SVEN_MCP_LOCAL_GATEWAY_URL || env.SVEN_GATEWAY_PUBLIC_URL || '') ||
    'http://localhost:3000';
  const gatewayBaseNormalized = gatewayBase.endsWith('/') ? gatewayBase.slice(0, -1) : gatewayBase;
  const sharedTokenEnabled =
    String(env.MCP_SERVER_ALLOW_SHARED_TOKEN || 'false').trim().toLowerCase() === 'true' &&
    String(env.SVEN_MCP_SERVER_TOKEN || '').trim().length > 0;

  return [
    {
      id: 'local-sven-gateway',
      name: 'Local Sven Gateway MCP',
      transport: 'http',
      url: `${gatewayBaseNormalized}/v1/mcp`,
      description: sharedTokenEnabled
        ? 'Best default for this machine. Uses your local Sven gateway MCP endpoint.'
        : 'Best default for this machine. Uses your local Sven gateway MCP endpoint, but automatic verification is unavailable until MCP auth is configured.',
      mode: 'install',
      badge: 'Local Ready',
      verification_unavailable: !sharedTokenEnabled,
    },
    {
      id: 'filesystem-template',
      name: 'Filesystem MCP (Template)',
      transport: 'stdio',
      url: 'npx -y @modelcontextprotocol/server-filesystem .',
      description: 'Local file operations server. Replace "." with your target workspace directory.',
      mode: 'template',
      badge: 'Template',
    },
    {
      id: 'github-template',
      name: 'GitHub MCP (Template)',
      transport: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      description: 'Template for GitHub MCP endpoint. Requires token/header configuration.',
      mode: 'template',
      badge: 'Template',
    },
    {
      id: 'postgres-template',
      name: 'Postgres MCP (Template)',
      transport: 'stdio',
      url: 'npx -y @modelcontextprotocol/server-postgres postgres://user:pass@localhost:5432/db',
      description: 'Template for local Postgres MCP server command with DSN.',
      mode: 'template',
      badge: 'Template',
    },
  ];
}

async function loadSharedTokenAdminConfig(pool: pg.Pool): Promise<McpSharedTokenAdminConfig> {
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
    ? parseBool(parseJsonSetting(map.get('mcp.server.sharedTokenEnabled')), false)
    : parseBool(process.env.MCP_SERVER_ALLOW_SHARED_TOKEN, false);
  const token = map.has('mcp.server.sharedToken')
    ? String(parseJsonSetting(map.get('mcp.server.sharedToken')) || '').trim()
    : String(process.env.SVEN_MCP_SERVER_TOKEN || '').trim();
  return {
    enabled,
    token_configured: token.length > 0,
    token_preview: previewToken(token),
  };
}

export async function registerMcpRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    const orgId = String(request.orgId || '').trim();
    return orgId || null;
  }

  async function ensureChatBelongsToOrg(chatId: string, orgId: string): Promise<boolean> {
    const res = await pool.query(
      `SELECT 1
       FROM chats
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [chatId, orgId],
    );
    return res.rows.length > 0;
  }

  app.addHook('preHandler', async (request: any, reply) => {
    if (String(request.userRole || '').trim() === 'platform_admin') return;
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
  });

  app.addHook('preHandler', async (request: any, reply) => {
    const orgId = currentOrgId(request);
    if (orgId) return;
    return reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
  });

  const mcp = new McpService(pool);
  const reconnectResolution = resolveMcpReconnectIntervalMs(process.env.MCP_RECONNECT_INTERVAL_MS);
  const reconnectMs = reconnectResolution.reconnectMs;
  const manualReconnectCooldownResolution = resolveMcpManualReconnectCooldownMs(
    process.env.MCP_MANUAL_RECONNECT_COOLDOWN_MS
  );
  const manualReconnectCooldownMs = manualReconnectCooldownResolution.cooldownMs;
  if (reconnectResolution.invalid) {
    app.log.warn(
      { value: process.env.MCP_RECONNECT_INTERVAL_MS, reconnectMs },
      'Invalid MCP_RECONNECT_INTERVAL_MS; using bounded default'
    );
  }
  if (manualReconnectCooldownResolution.invalid) {
    app.log.warn(
      { value: process.env.MCP_MANUAL_RECONNECT_COOLDOWN_MS, cooldownMs: manualReconnectCooldownMs },
      'Invalid MCP_MANUAL_RECONNECT_COOLDOWN_MS; using bounded default'
    );
  }
  let reconnectInFlight: Promise<{ total: number; connected: number; failed: number; errors: string[] }> | null = null;
  let lastManualReconnectStartedAt = 0;
  const runReconnectSweep = async (orgId: string) => {
    if (reconnectInFlight) {
      return reconnectInFlight;
    }
    reconnectInFlight = mcp.reconnectAll(orgId).finally(() => {
      reconnectInFlight = null;
    });
    return reconnectInFlight;
  };
  const runReconnectSweepAll = async () => {
    if (reconnectInFlight) {
      return reconnectInFlight;
    }
    reconnectInFlight = (async () => {
      const orgs = await pool.query(
        `SELECT DISTINCT organization_id
         FROM mcp_servers
         WHERE organization_id IS NOT NULL`,
      );
      let total = 0;
      let connected = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const row of orgs.rows) {
        const orgId = String(row.organization_id || '').trim();
        if (!orgId) continue;
        const result = await mcp.reconnectAll(orgId);
        total += result.total;
        connected += result.connected;
        failed += result.failed;
        errors.push(...result.errors);
      }
      return { total, connected, failed, errors };
    })().finally(() => {
      reconnectInFlight = null;
    });
    return reconnectInFlight;
  };
  const reconnectTimer = setInterval(() => {
    runReconnectSweepAll().catch(() => undefined);
  }, reconnectMs);
  reconnectTimer.unref?.();
  app.addHook('onClose', async () => {
    clearInterval(reconnectTimer);
  });

  app.get('/mcp-servers', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    try {
      const rows = await mcp.listServers(orgId);
      const sanitizedRows = rows.map((row) => sanitizeMcpServerRowForResponse(row as Record<string, unknown>));
      reply.send({ success: true, data: sanitizedRows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendMcpSchemaUnavailable(reply, 'servers');
        return;
      }
      throw err;
    }
  });

  app.get('/mcp-tool-calls', async (request, reply) => {
    const query = request.query as { server_id?: string; status?: 'success' | 'error'; limit?: string };
    const limit = parseLimit(query.limit, 100, 1, 500);
    if (limit === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a finite integer between 1 and 500' },
      });
      return;
    }
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    try {
      const rows = await mcp.listToolCalls(orgId, {
        serverId: query.server_id,
        status: query.status,
        limit,
      });
      reply.send({ success: true, data: rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendMcpSchemaUnavailable(reply, 'tool calls');
        return;
      }
      throw err;
    }
  });

  app.get('/mcp-catalog', async (request, reply) => {
    const query = request.query as { chat_id?: string };
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    if (query.chat_id) {
      const chatOwned = await ensureChatBelongsToOrg(String(query.chat_id), orgId);
      if (!chatOwned) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Chat not found in active account' },
        });
        return;
      }
    }
    try {
      const rows = await mcp.listCatalog(orgId, query.chat_id ? String(query.chat_id) : undefined);
      reply.send({ success: true, data: rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendMcpSchemaUnavailable(reply, 'catalog');
        return;
      }
      throw err;
    }
  });

  app.get('/mcp-presets', async (_request, reply) => {
    const sharedTokenConfig = await loadSharedTokenAdminConfig(pool);
    const rows = resolveMcpPresets().map((preset) => {
      if (preset.id !== 'local-sven-gateway') return preset;
      return {
        ...preset,
        description: sharedTokenConfig.enabled && sharedTokenConfig.token_configured
          ? 'Best default for this machine. Uses your local Sven gateway MCP endpoint.'
          : 'Best default for this machine. Uses your local Sven gateway MCP endpoint, but automatic verification is unavailable until MCP auth is configured.',
        verification_unavailable: !(sharedTokenConfig.enabled && sharedTokenConfig.token_configured),
      };
    });
    const orgId = currentOrgId(_request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    try {
      const serversRes = await pool.query(
        `SELECT name, status
         FROM mcp_servers
         WHERE organization_id = $1`,
        [orgId],
      );
      const stateByName = new Map<string, { connected: boolean }>();
      for (const row of serversRes.rows) {
        const normalizedName = String(row.name || '').trim().toLowerCase();
        if (!normalizedName) continue;
        const connected = String(row.status || '').trim().toLowerCase() === 'connected';
        const prior = stateByName.get(normalizedName);
        stateByName.set(normalizedName, { connected: Boolean(prior?.connected || connected) });
      }
      const data = rows.map((preset) => {
        const state = stateByName.get(preset.name.trim().toLowerCase());
        return {
          ...preset,
          installed: Boolean(state),
          connected: Boolean(state?.connected),
        };
      });
      reply.send({ success: true, data, count: data.length, updated_at: new Date().toISOString() });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        const data = rows.map((preset) => ({
          ...preset,
          installed: false,
          connected: false,
          verification_unavailable: true,
        }));
        reply.send({ success: true, data, count: data.length, updated_at: new Date().toISOString() });
        return;
      }
      throw err;
    }
  });

  app.get('/mcp-shared-token-config', async (_request, reply) => {
    const data = await loadSharedTokenAdminConfig(pool);
    reply.send({ success: true, data });
  });

  app.put('/mcp-shared-token-config', async (request, reply) => {
    const body = request.body as { enabled?: unknown; token?: unknown } | undefined;
    const enabledParsed = parseOptionalBoolean(body?.enabled);
    if (!enabledParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be boolean when provided' },
      });
      return;
    }
    const token = body?.token === undefined ? undefined : String(body.token || '').trim();
    if (token !== undefined && token.length > 0 && token.length < 16) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'token must be at least 16 characters when provided' },
      });
      return;
    }
    if (enabledParsed.value === true && token !== undefined && token.length === 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'token cannot be empty when enabling shared MCP auth' },
      });
      return;
    }

    const current = await loadSharedTokenAdminConfig(pool);
    const updates: Array<{ key: string; value: string }> = [];
    if (enabledParsed.value !== undefined) {
      updates.push({ key: 'mcp.server.sharedTokenEnabled', value: JSON.stringify(enabledParsed.value) });
    }
    if (token !== undefined) {
      updates.push({ key: 'mcp.server.sharedToken', value: JSON.stringify(token) });
    }
    for (const update of updates) {
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), 'admin-mcp')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'admin-mcp'`,
        [update.key, update.value],
      );
    }
    const data = await loadSharedTokenAdminConfig(pool);
    reply.send({
      success: true,
      data,
      meta: {
        changed: {
          enabled: enabledParsed.value !== undefined && current.enabled !== data.enabled,
          token: token !== undefined,
        },
      },
    });
  });

  app.get('/mcp-chat-overrides', async (request, reply) => {
    const query = request.query as { chat_id?: string };
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    if (query.chat_id) {
      const chatOwned = await ensureChatBelongsToOrg(String(query.chat_id), orgId);
      if (!chatOwned) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Chat not found in active account' },
        });
        return;
      }
    }
    try {
      const rows = await mcp.listChatOverrides(orgId, query.chat_id ? String(query.chat_id) : undefined);
      reply.send({ success: true, data: rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendMcpSchemaUnavailable(reply, 'chat overrides');
        return;
      }
      throw err;
    }
  });

  app.put('/mcp-chat-overrides/:chatId/:serverId', async (request, reply) => {
    const { chatId, serverId } = request.params as { chatId: string; serverId: string };
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const chatOwned = await ensureChatBelongsToOrg(chatId, orgId);
    if (!chatOwned) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found in active account' },
      });
      return;
    }
    const server = await mcp.getServer(orgId, serverId);
    if (!server) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'MCP server not found' },
      });
      return;
    }
    const body = (request.body as { enabled?: boolean }) || {};
    const enabledParsed = parseOptionalBoolean((body as { enabled?: unknown }).enabled);
    if (!enabledParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
      });
      return;
    }
    const row = await mcp.upsertChatOverride(orgId, chatId, serverId, enabledParsed.value ?? true);
    reply.send({ success: true, data: row });
  });

  app.delete('/mcp-chat-overrides/:chatId/:serverId', async (request, reply) => {
    const { chatId, serverId } = request.params as { chatId: string; serverId: string };
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const chatOwned = await ensureChatBelongsToOrg(chatId, orgId);
    if (!chatOwned) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found in active account' },
      });
      return;
    }
    const server = await mcp.getServer(orgId, serverId);
    if (!server) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'MCP server not found' },
      });
      return;
    }
    const deleted = await mcp.deleteChatOverride(orgId, chatId, serverId);
    if (!deleted) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Override not found' } });
      return;
    }
    reply.send({ success: true, data: { chat_id: chatId, server_id: serverId } });
  });

  app.post('/mcp-servers', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const body = (request.body as {
      name?: string;
      transport?: 'stdio' | 'http' | 'sse';
      url?: string;
      auth_token?: string;
      reason?: string;
    }) || {};

    const name = String(body.name || '').trim();
    const transport = body.transport;
    const url = String(body.url || '').trim();
    if (!name || !transport || !url) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name, transport, and url are required' },
      });
      return;
    }
    if (!['stdio', 'http', 'sse'].includes(transport)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'transport must be stdio|http|sse' },
      });
      return;
    }

    if (transport === 'stdio') {
      if (!parseBool(process.env.SVEN_MCP_STDIO_ENABLED, false)) {
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'MCP stdio transport is disabled by policy' },
        });
        return;
      }

      const reason = String(body.reason || '').trim();
      if (!reason || reason.length < 8 || reason.length > 500) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'reason is required (8-500 chars) for stdio server creation' },
        });
        return;
      }

      let stdioSpec: { command: string; shell?: boolean };
      try {
        stdioSpec = parseStdioServerConfigForCreate(url);
      } catch (err) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: err instanceof Error ? err.message : 'invalid stdio config' },
        });
        return;
      }

      const allowlist = resolveStdioCommandAllowlist();
      if (allowlist.size === 0) {
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'MCP stdio command allowlist is not configured' },
        });
        return;
      }
      const commandName = path.basename(stdioSpec.command).toLowerCase();
      if (!allowlist.has(commandName)) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: `stdio command "${commandName}" is not allowlisted` },
        });
        return;
      }

      request.log.info(
        {
          org_id: orgId,
          actor_user_id: String((request as any).userId || ''),
          actor_role: String((request as any).userRole || ''),
          stdio_command: commandName,
          reason,
        },
        'mcp stdio server creation allowed by policy',
      );
    }

    if (transport === 'http' || transport === 'sse') {
      const validated = validHttpUrl(url);
      if (!validated) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'url must be a valid http(s) URL for http/sse transport' },
        });
        return;
      }
      try {
        const parsed = new URL(validated);
        const h = parsed.hostname.toLowerCase();
        if (
          h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0' ||
          h === 'metadata.google.internal' || h === '169.254.169.254'
        ) {
          reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION', message: 'url cannot point to localhost, private, or metadata service addresses' },
          });
          return;
        }
        const v4Parts = h.split('.');
        if (v4Parts.length === 4 && v4Parts.every((p: string) => /^\d+$/.test(p))) {
          const [a, b] = v4Parts.map(Number);
          if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
            reply.status(400).send({
              success: false,
              error: { code: 'VALIDATION', message: 'url cannot point to private or internal network addresses' },
            });
            return;
          }
        }
      } catch { /* validated already checked above */ }
    }

    const id = uuidv7();
    await mcp.createServer(orgId, {
      id,
      name,
      transport,
      url,
      authToken: body.auth_token || null,
    });
    reply.status(201).send({ success: true, data: { id } });
  });

  app.delete('/mcp-servers/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const { id } = request.params as { id: string };
    const deleted = await mcp.deleteServer(orgId, id);
    if (!deleted) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'MCP server not found' } });
      return;
    }
    reply.send({ success: true });
  });

  app.post('/mcp-servers/:id/test', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const { id } = request.params as { id: string };
    const result = await mcp.testConnection(orgId, id);
    if (!result.ok) {
      request.log.error(
        { server_id: id, error: result.error || 'unknown', transport: result.transport },
        'MCP server test connection failed'
      );
      const sanitized = sanitizeMcpRouteError(result.error || 'failed');
      reply.status(sanitized.statusCode).send({
        success: false,
        error: { code: sanitized.code, message: sanitized.message },
      });
      return;
    }
    reply.send({ success: true, data: result });
  });

  app.post('/mcp-servers/reconnect', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    if (reconnectInFlight) {
      reply.status(409).send({
        success: false,
        error: { code: 'MCP_RECONNECT_IN_PROGRESS', message: 'MCP reconnect sweep already in progress' },
      });
      return;
    }
    const now = Date.now();
    const elapsedMs = now - lastManualReconnectStartedAt;
    if (lastManualReconnectStartedAt > 0 && elapsedMs < manualReconnectCooldownMs) {
      const retryAfterMs = manualReconnectCooldownMs - elapsedMs;
      reply.status(429).send({
        success: false,
        error: {
          code: 'MCP_RECONNECT_COOLDOWN',
          message: `Manual reconnect is rate-limited; retry in ${retryAfterMs}ms`,
        },
        data: {
          retry_after_ms: retryAfterMs,
        },
      });
      return;
    }
    lastManualReconnectStartedAt = now;
    const result = await runReconnectSweep(orgId);
    reply.send({ success: true, data: result });
  });

  app.get('/mcp-servers/:id/tools', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const { id } = request.params as { id: string };
    try {
      const tools = await mcp.listTools(orgId, id);
      reply.send({ success: true, data: tools });
    } catch (err) {
      request.log.error({ err, server_id: id }, 'MCP tools listing failed');
      const sanitized = sanitizeMcpRouteError(err);
      reply.status(sanitized.statusCode).send({ success: false, error: { code: sanitized.code, message: sanitized.message } });
    }
  });

  app.get('/mcp-servers/:id/resources', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const { id } = request.params as { id: string };
    try {
      const resources = await mcp.listResources(orgId, id);
      reply.send({ success: true, data: resources });
    } catch (err) {
      request.log.error({ err, server_id: id }, 'MCP resources listing failed');
      const sanitized = sanitizeMcpRouteError(err);
      reply.status(sanitized.statusCode).send({ success: false, error: { code: sanitized.code, message: sanitized.message } });
    }
  });

  app.post('/mcp-servers/:id/tools/call', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const { id } = request.params as { id: string };
    const body = (request.body as { tool_name?: string; input?: Record<string, unknown> }) || {};
    const toolName = String(body.tool_name || '').trim();
    if (!toolName) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'tool_name is required' } });
      return;
    }
    try {
      const result = await mcp.callTool(orgId, id, toolName, body.input || {});
      reply.send({ success: true, data: result });
    } catch (err) {
      request.log.error({ err, server_id: id, tool_name: toolName }, 'MCP tool call failed');
      const sanitized = sanitizeMcpRouteError(err);
      reply.status(sanitized.statusCode).send({ success: false, error: { code: sanitized.code, message: sanitized.message } });
    }
  });
}
