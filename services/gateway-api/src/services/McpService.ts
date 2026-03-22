import pg from 'pg';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

type McpServerRow = {
  id: string;
  organization_id?: string | null;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  url: string;
  auth_token?: string | null;
};

type GatewayMcpSharedTokenConfig = {
  enabled: boolean;
  token: string;
};

function parseSettingValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseBoolValue(value: unknown, fallback = false): boolean {
  const parsed = parseSettingValue(value);
  if (typeof parsed === 'boolean') return parsed;
  if (typeof parsed === 'number') return parsed !== 0;
  if (typeof parsed === 'string') {
    const normalized = parsed.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
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

export class McpService {
  private authTokenColumnAvailable: boolean | null = null;
  private lastConnectedColumnAvailable: boolean | null = null;
  private orgColumnAvailability = new Map<string, boolean>();
  private columnAvailability = new Map<string, boolean>();

  constructor(private pool: pg.Pool) {}

  private createOrgScopeRequiredError(surface: string): Error & { code: string } {
    const error = new Error(`MCP ${surface} requires organization-scoped schema`) as Error & { code: string };
    error.code = 'MCP_ORG_SCOPE_REQUIRED';
    return error;
  }

  private async requireOrganizationScopedTable(tableName: string, surface: string): Promise<void> {
    const hasOrgColumn = await this.hasOrganizationIdColumn(tableName);
    if (!hasOrgColumn) {
      throw this.createOrgScopeRequiredError(surface);
    }
  }

  private async hasAuthTokenColumn(): Promise<boolean> {
    if (this.authTokenColumnAvailable !== null) return this.authTokenColumnAvailable;
    const res = await this.pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'mcp_servers'
         AND column_name = 'auth_token'
       LIMIT 1`,
    );
    this.authTokenColumnAvailable = res.rows.length > 0;
    return this.authTokenColumnAvailable;
  }

  private async hasLastConnectedColumn(): Promise<boolean> {
    if (this.lastConnectedColumnAvailable !== null) return this.lastConnectedColumnAvailable;
    const res = await this.pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'mcp_servers'
         AND column_name = 'last_connected'
       LIMIT 1`,
    );
    this.lastConnectedColumnAvailable = res.rows.length > 0;
    return this.lastConnectedColumnAvailable;
  }

  private async hasOrganizationIdColumn(tableName: string): Promise<boolean> {
    return this.hasColumn(tableName, 'organization_id');
  }

  private async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const cacheKey = `${tableName}:${columnName}`;
    if (this.columnAvailability.has(cacheKey)) {
      return this.columnAvailability.get(cacheKey) ?? false;
    }
    if (this.orgColumnAvailability.has(tableName)) {
      if (columnName === 'organization_id') {
        return this.orgColumnAvailability.get(tableName) ?? false;
      }
    }
    const res = await this.pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
       LIMIT 1`,
      [tableName, columnName],
    );
    const available = res.rows.length > 0;
    this.columnAvailability.set(cacheKey, available);
    if (columnName === 'organization_id') {
      this.orgColumnAvailability.set(tableName, available);
    }
    return available;
  }

  async listServers(orgId: string): Promise<any[]> {
    const hasAuthToken = await this.hasAuthTokenColumn();
    const hasLastConnected = await this.hasLastConnectedColumn();
    await this.requireOrganizationScopedTable('mcp_servers', 'servers');
    const hasServerOrg = true;
    const res = await this.pool.query(
      `SELECT id,
              ${hasServerOrg ? 'organization_id' : 'NULL::text AS organization_id'},
              name,
              transport,
              url,
              ${hasAuthToken ? 'COALESCE(LENGTH(TRIM(auth_token)) > 0, false)' : 'false'} AS auth_token_configured,
              status,
              capabilities_json,
              ${hasLastConnected ? 'last_connected' : 'NULL::timestamptz AS last_connected'},
              created_at,
              updated_at
       FROM mcp_servers
       ${hasServerOrg ? 'WHERE organization_id = $1' : ''}
       ORDER BY created_at DESC`,
      hasServerOrg ? [orgId] : [],
    );
    return res.rows;
  }

  async createServer(
    orgId: string,
    params: {
      id: string;
      name: string;
      transport: 'stdio' | 'http' | 'sse';
      url: string;
      authToken?: string | null;
    },
  ): Promise<void> {
    await this.requireOrganizationScopedTable('mcp_servers', 'servers');
    const hasServerOrg = true;
    const hasAuthToken = await this.hasAuthTokenColumn();
    if (hasAuthToken) {
      await this.pool.query(
        hasServerOrg
          ? `INSERT INTO mcp_servers (id, organization_id, name, transport, url, auth_token, status, capabilities_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'disconnected', '{}'::jsonb, NOW(), NOW())`
          : `INSERT INTO mcp_servers (id, name, transport, url, auth_token, status, capabilities_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'disconnected', '{}'::jsonb, NOW(), NOW())`,
        hasServerOrg
          ? [params.id, orgId, params.name, params.transport, params.url, params.authToken || null]
          : [params.id, params.name, params.transport, params.url, params.authToken || null],
      );
      return;
    }
    await this.pool.query(
      hasServerOrg
        ? `INSERT INTO mcp_servers (id, organization_id, name, transport, url, status, capabilities_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'disconnected', '{}'::jsonb, NOW(), NOW())`
        : `INSERT INTO mcp_servers (id, name, transport, url, status, capabilities_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'disconnected', '{}'::jsonb, NOW(), NOW())`,
      hasServerOrg
        ? [params.id, orgId, params.name, params.transport, params.url]
        : [params.id, params.name, params.transport, params.url],
    );
  }

  async deleteServer(orgId: string, id: string): Promise<boolean> {
    await this.requireOrganizationScopedTable('mcp_servers', 'servers');
    const hasToolOrg = await this.hasOrganizationIdColumn('mcp_server_tools');
    const hasServerOrg = true;
    const toolsHasName = await this.hasColumn('tools', 'name');
    const toolsHasSource = await this.hasColumn('tools', 'source');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (toolsHasName && toolsHasSource) {
        await client.query(
          `DELETE FROM tools
           WHERE source = 'mcp'
             AND name IN (
               SELECT qualified_name
               FROM mcp_server_tools
                WHERE server_id = $1
                 ${hasToolOrg ? 'AND organization_id = $2' : ''}
             )`,
          hasToolOrg ? [id, orgId] : [id],
        );
      }
      await client.query(
        `DELETE FROM mcp_server_tools
         WHERE server_id = $1
           ${hasToolOrg ? 'AND organization_id = $2' : ''}`,
        hasToolOrg ? [id, orgId] : [id],
      );
      const res = await client.query(
        `DELETE FROM mcp_servers
         WHERE id = $1
           ${hasServerOrg ? 'AND organization_id = $2' : ''}
         RETURNING id`,
        hasServerOrg ? [id, orgId] : [id],
      );
      await client.query('COMMIT');
      return res.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getServer(orgId: string, id: string): Promise<McpServerRow | null> {
    await this.requireOrganizationScopedTable('mcp_servers', 'servers');
    const hasServerOrg = true;
    const hasAuthToken = await this.hasAuthTokenColumn();
    const res = await this.pool.query(
      `SELECT id, ${hasServerOrg ? 'organization_id' : 'NULL::text AS organization_id'}, name, transport, url, ${hasAuthToken ? 'auth_token' : 'NULL::text AS auth_token'}
       FROM mcp_servers
       WHERE id = $1
         ${hasServerOrg ? 'AND organization_id = $2' : ''}`,
      hasServerOrg ? [id, orgId] : [id],
    );
    return res.rows[0] || null;
  }

  async testConnection(
    orgId: string,
    id: string,
  ): Promise<{
    ok: boolean;
    transport: string;
    tools?: any[];
    resources?: any[];
    capabilities?: any;
    error?: string;
  }> {
    const server = await this.getServer(orgId, id);
    if (!server) return { ok: false, transport: 'unknown', error: 'Server not found' };
    const hasLastConnected = await this.hasLastConnectedColumn();
    const hasServerOrg = true;

    try {
      const init = await this.rpc(server, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'sven-gateway', version: '0.1.0' },
      });

      const toolsRes = await this.rpc(server, 'tools/list', {});
      const resourcesRes = await this.rpc(server, 'resources/list', {});
      const tools = toolsRes?.result?.tools || [];
      const capabilities = init?.result?.capabilities || {};

      if (hasLastConnected) {
        await this.pool.query(
          `UPDATE mcp_servers
           SET status = 'connected',
               capabilities_json = $2,
               last_connected = NOW(),
               updated_at = NOW()
           WHERE id = $1
             ${hasServerOrg ? 'AND organization_id = $3' : ''}`,
          hasServerOrg ? [id, JSON.stringify(capabilities), orgId] : [id, JSON.stringify(capabilities)],
        );
      } else {
        await this.pool.query(
          `UPDATE mcp_servers
           SET status = 'connected',
               capabilities_json = $2,
               updated_at = NOW()
           WHERE id = $1
             ${hasServerOrg ? 'AND organization_id = $3' : ''}`,
          hasServerOrg ? [id, JSON.stringify(capabilities), orgId] : [id, JSON.stringify(capabilities)],
        );
      }
      await this.refreshServerTools(orgId, id, server.name, tools);

      return {
        ok: true,
        transport: server.transport,
        tools,
        resources: resourcesRes?.result?.resources || [],
        capabilities,
      };
    } catch (err) {
      await this.pool.query(
        `UPDATE mcp_servers
         SET status = 'error',
             updated_at = NOW()
         WHERE id = $1
           ${hasServerOrg ? 'AND organization_id = $2' : ''}`,
        hasServerOrg ? [id, orgId] : [id],
      );
      return {
        ok: false,
        transport: server.transport,
        error: String(err),
      };
    }
  }

  async listTools(orgId: string, id: string): Promise<any[]> {
    const server = await this.getServer(orgId, id);
    if (!server) throw new Error('Server not found');
    const res = await this.rpc(server, 'tools/list', {});
    const tools = res?.result?.tools || [];
    await this.refreshServerTools(orgId, id, server.name, tools);
    return tools;
  }

  async listResources(orgId: string, id: string): Promise<any[]> {
    const server = await this.getServer(orgId, id);
    if (!server) throw new Error('Server not found');
    const res = await this.rpc(server, 'resources/list', {});
    return res?.result?.resources || [];
  }

  async callTool(orgId: string, id: string, toolName: string, input: Record<string, unknown>): Promise<any> {
    const server = await this.getServer(orgId, id);
    if (!server) throw new Error('Server not found');
    const started = Date.now();
    const policy = await this.evaluatePolicy(orgId, toolName);
    const hasToolCallsOrg = await this.hasOrganizationIdColumn('mcp_tool_calls');
    if (!policy.allowed) {
      await this.pool.query(
        hasToolCallsOrg
          ? `INSERT INTO mcp_tool_calls (id, organization_id, server_id, tool_name, input, output, duration_ms, status, error, created_at)
             VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, 'error', $7, NOW())`
          : `INSERT INTO mcp_tool_calls (id, server_id, tool_name, input, output, duration_ms, status, error, created_at)
             VALUES ($1, $2, $3, $4, '{}'::jsonb, $5, 'error', $6, NOW())`,
        hasToolCallsOrg
          ? [cryptoRandomId(), orgId, id, toolName, JSON.stringify(input || {}), Date.now() - started, policy.reason || 'policy_denied']
          : [cryptoRandomId(), id, toolName, JSON.stringify(input || {}), Date.now() - started, policy.reason || 'policy_denied'],
      );
      throw new Error(policy.reason || 'MCP tool call denied by policy');
    }
    try {
      const result = await this.rpc(server, 'tools/call', { name: toolName, arguments: input });
      await this.pool.query(
        hasToolCallsOrg
          ? `INSERT INTO mcp_tool_calls (id, organization_id, server_id, tool_name, input, output, duration_ms, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', NOW())`
          : `INSERT INTO mcp_tool_calls (id, server_id, tool_name, input, output, duration_ms, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'success', NOW())`,
        hasToolCallsOrg
          ? [
              cryptoRandomId(),
              orgId,
              id,
              toolName,
              JSON.stringify(input || {}),
              JSON.stringify(result?.result || {}),
              Date.now() - started,
            ]
          : [
              cryptoRandomId(),
              id,
              toolName,
              JSON.stringify(input || {}),
              JSON.stringify(result?.result || {}),
              Date.now() - started,
            ],
      );
      return result?.result || {};
    } catch (err) {
      await this.pool.query(
        hasToolCallsOrg
          ? `INSERT INTO mcp_tool_calls (id, organization_id, server_id, tool_name, input, output, duration_ms, status, error, created_at)
             VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, 'error', $7, NOW())`
          : `INSERT INTO mcp_tool_calls (id, server_id, tool_name, input, output, duration_ms, status, error, created_at)
             VALUES ($1, $2, $3, $4, '{}'::jsonb, $5, 'error', $6, NOW())`,
        hasToolCallsOrg
          ? [cryptoRandomId(), orgId, id, toolName, JSON.stringify(input || {}), Date.now() - started, String(err)]
          : [cryptoRandomId(), id, toolName, JSON.stringify(input || {}), Date.now() - started, String(err)],
      );
      throw err;
    }
  }

  async listToolCalls(orgId: string, query?: { serverId?: string; status?: 'success' | 'error'; limit?: number }): Promise<any[]> {
    const hasToolCallsOrg = await this.hasOrganizationIdColumn('mcp_tool_calls');
    const params: unknown[] = hasToolCallsOrg ? [orgId] : [];
    let where = hasToolCallsOrg ? 'WHERE organization_id = $1' : 'WHERE 1=1';
    if (query?.serverId) {
      params.push(query.serverId);
      where += ` AND server_id = $${params.length}`;
    }
    if (query?.status) {
      params.push(query.status);
      where += ` AND status = $${params.length}`;
    }
    const requestedLimit = query?.limit ?? 100;
    const safeLimit = (Number.isFinite(requestedLimit) && Number.isInteger(requestedLimit) && requestedLimit > 0)
      ? Math.min(500, requestedLimit)
      : 100;
    params.push(safeLimit);
    const res = await this.pool.query(
      `SELECT id, ${hasToolCallsOrg ? 'organization_id' : 'NULL::text AS organization_id'}, server_id, tool_name, input, output, duration_ms, status, error, created_at
       FROM mcp_tool_calls
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return res.rows;
  }

  async listCatalog(orgId: string, chatId?: string): Promise<any[]> {
    const hasOverrideOrg = await this.hasOrganizationIdColumn('mcp_chat_overrides');
    const hasServerOrg = await this.hasOrganizationIdColumn('mcp_servers');
    const hasToolOrg = await this.hasOrganizationIdColumn('mcp_server_tools');
    if (chatId) {
      const hasOverrides = await this.pool.query(
        `SELECT COUNT(*)::int AS c
         FROM mcp_chat_overrides o
         JOIN chats c ON c.id = o.chat_id
         WHERE o.chat_id = $1 AND c.organization_id = $2 ${hasOverrideOrg ? 'AND o.organization_id = $2' : ''}`,
        [chatId, orgId],
      );
      if (Number(hasOverrides.rows[0]?.c || 0) > 0) {
        const rows = await this.pool.query(
          `SELECT t.id, t.server_id, s.name AS server_name, t.tool_name, t.qualified_name, t.description, t.input_schema, t.updated_at
           FROM mcp_server_tools t
           JOIN mcp_servers s ON s.id = t.server_id
           JOIN mcp_chat_overrides o ON o.server_id = s.id
           JOIN chats c ON c.id = o.chat_id
           WHERE o.chat_id = $1 AND c.organization_id = $2 ${hasOverrideOrg ? 'AND o.organization_id = $2' : ''} ${hasServerOrg ? 'AND s.organization_id = $2' : ''} ${hasToolOrg ? 'AND t.organization_id = $2' : ''} AND o.enabled = true
           ORDER BY t.qualified_name ASC`,
          [chatId, orgId],
        );
        return rows.rows;
      }
    }
    const rows = await this.pool.query(
      `SELECT t.id, t.server_id, s.name AS server_name, t.tool_name, t.qualified_name, t.description, t.input_schema, t.updated_at
       FROM mcp_server_tools t
       JOIN mcp_servers s ON s.id = t.server_id
       WHERE 1=1
         ${hasServerOrg ? 'AND s.organization_id = $1' : ''}
         ${hasToolOrg ? 'AND t.organization_id = $1' : ''}
       ORDER BY t.qualified_name ASC`,
      (hasServerOrg || hasToolOrg) ? [orgId] : [],
    );
    return rows.rows;
  }

  async listChatOverrides(orgId: string, chatId?: string): Promise<any[]> {
    const hasOverrideOrg = await this.hasOrganizationIdColumn('mcp_chat_overrides');
    const hasServerOrg = await this.hasOrganizationIdColumn('mcp_servers');
    const params: unknown[] = [orgId];
    let where = `WHERE c.organization_id = $1
                   ${hasOverrideOrg ? 'AND o.organization_id = $1' : ''}
                   ${hasServerOrg ? 'AND s.organization_id = $1' : ''}`;
    if (chatId) {
      params.push(chatId);
      where += ` AND o.chat_id = $${params.length}`;
    }
    const rows = await this.pool.query(
      `SELECT o.id, o.chat_id, o.server_id, s.name AS server_name, o.enabled, o.created_at, o.updated_at
       FROM mcp_chat_overrides o
       JOIN chats c ON c.id = o.chat_id
       JOIN mcp_servers s ON s.id = o.server_id
       ${where}
       ORDER BY o.updated_at DESC`,
      params,
    );
    return rows.rows;
  }

  async upsertChatOverride(orgId: string, chatId: string, serverId: string, enabled: boolean): Promise<any> {
    const id = cryptoRandomId();
    const hasOverrideOrg = await this.hasOrganizationIdColumn('mcp_chat_overrides');
    const row = await this.pool.query(
      hasOverrideOrg
        ? `INSERT INTO mcp_chat_overrides (id, organization_id, chat_id, server_id, enabled, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (organization_id, chat_id, server_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
           RETURNING id, chat_id, server_id, enabled, updated_at`
        : `INSERT INTO mcp_chat_overrides (id, chat_id, server_id, enabled, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (chat_id, server_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
           RETURNING id, chat_id, server_id, enabled, updated_at`,
      hasOverrideOrg ? [id, orgId, chatId, serverId, enabled] : [id, chatId, serverId, enabled],
    );
    return row.rows[0];
  }

  async deleteChatOverride(orgId: string, chatId: string, serverId: string): Promise<boolean> {
    const hasOverrideOrg = await this.hasOrganizationIdColumn('mcp_chat_overrides');
    const row = await this.pool.query(
      `DELETE FROM mcp_chat_overrides
       WHERE ${hasOverrideOrg ? 'organization_id = $1 AND' : ''} chat_id = $${hasOverrideOrg ? 2 : 1} AND server_id = $${hasOverrideOrg ? 3 : 2}
       RETURNING id`,
      hasOverrideOrg ? [orgId, chatId, serverId] : [chatId, serverId],
    );
    return row.rows.length > 0;
  }

  async reconnectAll(orgId: string): Promise<{ total: number; connected: number; failed: number; errors: string[] }> {
    await this.requireOrganizationScopedTable('mcp_servers', 'servers');
    const hasServerOrg = true;
    const servers = await this.pool.query(
      `SELECT id, name
       FROM mcp_servers
       ${hasServerOrg ? 'WHERE organization_id = $1' : ''}
       ORDER BY created_at DESC`,
      hasServerOrg ? [orgId] : [],
    );
    let connected = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const row of servers.rows) {
      const result = await this.testConnection(orgId, String(row.id));
      if (result.ok) {
        connected += 1;
      } else {
        failed += 1;
        errors.push(`${row.name}: ${result.error || 'unknown error'}`);
      }
    }
    return {
      total: servers.rows.length,
      connected,
      failed,
      errors,
    };
  }

  private async refreshServerTools(orgId: string, serverId: string, serverName: string, tools: any[]): Promise<void> {
    const hasToolOrg = await this.hasOrganizationIdColumn('mcp_server_tools');
    const toolsHasSource = await this.hasColumn('tools', 'source');
    const toolsHasManifest = await this.hasColumn('tools', 'manifest');
    const toolsHasPermissionsRequired = await this.hasColumn('tools', 'permissions_required');
    const normalizedOrg = normalizeName(orgId);
    const normalizedServer = normalizeName(serverName);
    const seen = new Set<string>();
    const existingRows = await this.pool.query(
      `DELETE FROM mcp_server_tools
       WHERE server_id = $1
         ${hasToolOrg ? 'AND organization_id = $2' : ''}
       RETURNING qualified_name`,
      hasToolOrg ? [serverId, orgId] : [serverId],
    );
    const previousQualifiedNames = existingRows.rows.map((row) => String(row.qualified_name || '')).filter(Boolean);
    for (const tool of tools || []) {
      const toolName = String(tool?.name || '').trim();
      if (!toolName) continue;
      const qualifiedName = `mcp.${normalizedOrg}.${normalizedServer}.${normalizeName(toolName)}`;
      seen.add(qualifiedName);
      await this.pool.query(
        hasToolOrg
          ? `INSERT INTO mcp_server_tools (id, organization_id, server_id, tool_name, qualified_name, description, input_schema, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`
          : `INSERT INTO mcp_server_tools (id, server_id, tool_name, qualified_name, description, input_schema, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        hasToolOrg
          ? [
              cryptoRandomId(),
              orgId,
              serverId,
              toolName,
              qualifiedName,
              String(tool?.description || ''),
              JSON.stringify(tool?.inputSchema || {}),
            ]
          : [
              cryptoRandomId(),
              serverId,
              toolName,
              qualifiedName,
              String(tool?.description || ''),
              JSON.stringify(tool?.inputSchema || {}),
            ],
      );

      if (toolsHasSource && toolsHasManifest && toolsHasPermissionsRequired) {
        await this.pool.query(
          `INSERT INTO tools
           (name, source, version, trust_level, execution_mode, is_first_party, status, manifest, permissions_required, created_at, updated_at)
           VALUES ($1, 'mcp', '1.0.0', 'trusted', 'in_process', true, 'active', $2, ARRAY['mcp.call']::text[], NOW(), NOW())
           ON CONFLICT (name) DO UPDATE SET
             source = EXCLUDED.source,
             trust_level = EXCLUDED.trust_level,
             execution_mode = EXCLUDED.execution_mode,
             is_first_party = EXCLUDED.is_first_party,
             status = EXCLUDED.status,
             manifest = EXCLUDED.manifest,
             permissions_required = EXCLUDED.permissions_required,
             updated_at = NOW()`,
          [
            qualifiedName,
            JSON.stringify({
              title: toolName,
              description: String(tool?.description || ''),
              type: 'mcp_proxy',
              server_id: serverId,
              organization_id: orgId,
              remote_tool_name: toolName,
            }),
          ],
        );
      }
    }
    const removedQualifiedNames = previousQualifiedNames.filter((qualifiedName) => !seen.has(qualifiedName));
    if (removedQualifiedNames.length > 0 && toolsHasSource) {
      await this.pool.query(
        `DELETE FROM tools
         WHERE source = 'mcp'
           AND name = ANY($1::text[])`,
        [removedQualifiedNames],
      );
    }
  }

  private async rpc(server: McpServerRow, method: string, params: Record<string, unknown>): Promise<any> {
    if (server.transport === 'stdio') {
      return this.rpcStdio(server, method, params);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const sharedGatewayToken = await this.resolveGatewayMcpSharedToken(server);
    const effectiveAuthToken = server.auth_token || sharedGatewayToken;
    if (effectiveAuthToken) {
      headers.Authorization = `Bearer ${effectiveAuthToken}`;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.MCP_RPC_TIMEOUT_MS || 15000));
    let response: Response;
    try {
      response = await fetch(server.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: cryptoRandomId(),
          method,
          params,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const payload: any = await response.json();
    if (!response.ok || payload?.error) {
      throw new Error(payload?.error?.message || `MCP ${method} failed with status ${response.status}`);
    }
    return payload;
  }

  private async rpcStdio(server: McpServerRow, method: string, params: Record<string, unknown>): Promise<any> {
    const spec = parseStdioSpec(server.url);
    const timeoutMs = Number(process.env.MCP_RPC_TIMEOUT_MS || 15000);

    return new Promise((resolve, reject) => {
      const child = spawn(spec.command, spec.args, {
        cwd: spec.cwd || process.cwd(),
        env: { ...process.env, ...(spec.env || {}) },
        shell: spec.shell ?? false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const requestId = cryptoRandomId();
      let settled = false;
      let stderrText = '';
      let stdoutBuffer = '';

      const finish = (err: Error | null, payload?: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (!child.killed) child.kill();
        } catch {
          // Ignore process cleanup errors.
        }
        if (err) reject(err);
        else resolve(payload);
      };

      const timer = setTimeout(() => {
        finish(new Error(`MCP stdio ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('error', (err) => {
        finish(new Error(`MCP stdio spawn failed: ${String(err)}`));
      });

      child.stderr.on('data', (chunk) => {
        stderrText += String(chunk || '');
      });

      child.stdout.on('data', (chunk) => {
        stdoutBuffer += String(chunk || '');
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          let message: any;
          try {
            message = JSON.parse(line);
          } catch {
            continue;
          }
          if (String(message?.id || '') !== requestId) {
            continue;
          }
          if (message?.error) {
            finish(new Error(String(message.error?.message || `MCP ${method} failed`)));
            return;
          }
          finish(null, message);
          return;
        }
      });

      child.on('close', () => {
        if (settled) return;
        const err = stderrText.trim()
          ? `MCP stdio ${method} exited before response: ${stderrText.trim()}`
          : `MCP stdio ${method} exited before response`;
        finish(new Error(err));
      });

      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params,
      });
      child.stdin.write(`${payload}\n`);
      child.stdin.end();
    });
  }

  private async evaluatePolicy(orgId: string, toolName: string): Promise<{ allowed: boolean; reason?: string }> {
    const tenantRows = await this.pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1
         AND key = ANY($2::text[])`,
      [orgId, ['mcp.policy.block_all', 'mcp.policy.allow_tools']],
    );
    const globalRows = await this.pool.query(
      `SELECT key, value
       FROM settings_global
       WHERE key = ANY($1::text[])`,
      [['mcp.policy.global.block_all', 'mcp.policy.global.allow_tools']],
    );

    const tenantMap = new Map<string, unknown>();
    for (const row of tenantRows.rows) {
      tenantMap.set(String(row.key), parseSetting(row.value));
    }
    const globalMap = new Map<string, unknown>();
    for (const row of globalRows.rows) {
      globalMap.set(String(row.key), parseSetting(row.value));
    }

    const tenantBlockAll = tenantMap.get('mcp.policy.block_all');
    const globalBlockAll = globalMap.get('mcp.policy.global.block_all');

    if (Boolean(tenantBlockAll) || Boolean(globalBlockAll)) {
      return { allowed: false, reason: 'MCP tool call denied by policy: block_all=true' };
    }

    const tenantAllow = tenantMap.get('mcp.policy.allow_tools');
    const globalAllow = globalMap.get('mcp.policy.global.allow_tools');
    const allowTools = tenantAllow !== undefined
      ? tenantAllow
      : globalAllow;

    if (Array.isArray(allowTools) && allowTools.length > 0) {
      const allowed = allowTools.map((t) => String(t));
      if (!allowed.includes(toolName)) {
        return { allowed: false, reason: `MCP tool "${toolName}" denied by allow-list policy` };
      }
    }
    return { allowed: true };
  }

  private async loadGatewayMcpSharedTokenConfig(): Promise<GatewayMcpSharedTokenConfig> {
    const res = await this.pool.query(
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
      ? parseBoolValue(map.get('mcp.server.sharedTokenEnabled'), false)
      : String(process.env.MCP_SERVER_ALLOW_SHARED_TOKEN || 'false').trim().toLowerCase() === 'true';
    const token = map.has('mcp.server.sharedToken')
      ? String(parseSettingValue(map.get('mcp.server.sharedToken')) || '').trim()
      : String(process.env.SVEN_MCP_SERVER_TOKEN || '').trim();
    return { enabled, token };
  }

  private async resolveGatewayMcpSharedToken(server: McpServerRow): Promise<string | null> {
    const sharedTokenConfig = await this.loadGatewayMcpSharedTokenConfig();
    if (!sharedTokenConfig.enabled || !sharedTokenConfig.token) {
      return null;
    }

    const serverUrl = validHttpUrl(server.url);
    if (!serverUrl) {
      return null;
    }

    const gatewayCandidates = [
      validHttpUrl(process.env.SVEN_MCP_LOCAL_GATEWAY_URL || ''),
      validHttpUrl(process.env.SVEN_GATEWAY_PUBLIC_URL || ''),
      'http://localhost:3000/',
      'http://127.0.0.1:3000/',
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
        return `${normalized}/v1/mcp`;
      });

    if (!gatewayCandidates.includes(serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl)) {
      return null;
    }

    return sharedTokenConfig.token;
  }
}

function cryptoRandomId(): string {
  return `mcp_${randomBytes(8).toString('hex')}_${Date.now()}`;
}

function parseSetting(value: unknown): unknown {
  return parseSettingValue(value);
}

function parseStdioSpec(url: string): {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
} {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    throw new Error('Invalid stdio config: empty command');
  }

  if (!trimmed.startsWith('{')) {
    throw new Error('Invalid stdio config: JSON object required');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid stdio config JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid stdio config: JSON object required');
  }
  const record = parsed as Record<string, unknown>;
  const command = String(record.command || '').trim();
  if (!command) {
    throw new Error('Invalid stdio config: command is required');
  }
  const args = Array.isArray(record.args) ? record.args.map((a: unknown) => String(a)) : [];
  const cwd = typeof record.cwd === 'string' ? record.cwd : undefined;
  const env = record.env && typeof record.env === 'object'
    ? Object.fromEntries(Object.entries(record.env as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
    : undefined;
  const shell = typeof record.shell === 'boolean' ? record.shell : undefined;
  if (shell === true) {
    throw new Error('Invalid stdio config: shell=true is not allowed');
  }
  enforceStdioCommandAllowlist(command);
  return { command, args, cwd, env, shell };
}

function resolveStdioCommandAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = String(env.SVEN_MCP_STDIO_COMMAND_ALLOWLIST || '').trim();
  const values = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

function enforceStdioCommandAllowlist(command: string): void {
  const allowlist = resolveStdioCommandAllowlist();
  if (allowlist.size === 0) {
    throw new Error('Invalid stdio config: command allowlist is not configured');
  }
  const commandName = path.basename(String(command || '')).trim().toLowerCase();
  if (!commandName || !allowlist.has(commandName)) {
    throw new Error(`Invalid stdio config: command "${commandName}" is not allowlisted`);
  }
}

function normalizeName(input: string): string {
  return String(input || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
