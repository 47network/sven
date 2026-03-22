import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { upsertChatMember } from '../chat-members.js';

function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeChannel(input: string): string {
  return input.trim().toLowerCase();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
}

function mergeSettingsCapabilities(
  settings: Record<string, unknown> | undefined,
  capabilities: unknown,
): Record<string, unknown> {
  const merged = { ...(settings || {}) };
  const normalized = toStringArray(capabilities);
  if (normalized.length > 0) {
    merged.capabilities = normalized;
  }
  return merged;
}

function parseAgentCapabilities(row: any): string[] {
  const raw = row?.settings?.capabilities;
  return toStringArray(raw);
}

function parsePolicyScope(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function parseOptionalBoolean(value: unknown, fieldName: string): { ok: true; value: boolean | undefined } | { ok: false; message: string } {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'boolean') {
    return { ok: false, message: `${fieldName} must be a boolean when provided` };
  }
  return { ok: true, value };
}

function parseAgentSessionHistoryLimit(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 50;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return Math.max(1, Math.min(200, parsed));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function validateSettingsPayload(settings: unknown): { ok: true; value: Record<string, unknown> | undefined } | { ok: false; message: string } {
  if (settings === undefined) return { ok: true, value: undefined };
  if (!isPlainRecord(settings)) {
    return { ok: false, message: 'settings must be an object when provided' };
  }
  return { ok: true, value: settings };
}

const VALID_ROUTING_RULE_KEYS = new Set([
  'channel',
  'channels',
  'channel_chat_id',
  'user_id',
  'sender_identity_id',
  'parent_agent_id',
  'nesting_depth',
  'policy_scope',
  'subordinate_overrides',
]);

const VALID_SUBORDINATE_OVERRIDE_KEYS = new Set([
  'system_prompt',
  'model_name',
  'profile_name',
]);

function validateRoutingRulesPayload(
  routingRules: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (routingRules === undefined) return { ok: true, value: {} };
  if (!isPlainRecord(routingRules)) {
    return { ok: false, message: 'routing_rules must be an object when provided' };
  }
  const keys = Object.keys(routingRules);
  for (const key of keys) {
    if (!VALID_ROUTING_RULE_KEYS.has(key)) {
      return { ok: false, message: `routing_rules.${key} is not supported` };
    }
  }
  if (routingRules.channel !== undefined && String(routingRules.channel || '').trim() === '') {
    return { ok: false, message: 'routing_rules.channel must be a non-empty string when provided' };
  }
  if (routingRules.channels !== undefined) {
    if (!Array.isArray(routingRules.channels)) {
      return { ok: false, message: 'routing_rules.channels must be an array of strings when provided' };
    }
    if ((routingRules.channels as unknown[]).some((entry) => typeof entry !== 'string' || !entry.trim())) {
      return { ok: false, message: 'routing_rules.channels must contain only non-empty strings' };
    }
  }
  if (routingRules.nesting_depth !== undefined) {
    const parsedDepth = Number(routingRules.nesting_depth);
    if (!Number.isFinite(parsedDepth) || !Number.isInteger(parsedDepth) || parsedDepth < 0) {
      return { ok: false, message: 'routing_rules.nesting_depth must be a non-negative integer when provided' };
    }
  }
  if (routingRules.policy_scope !== undefined) {
    if (!Array.isArray(routingRules.policy_scope)) {
      return { ok: false, message: 'routing_rules.policy_scope must be an array of strings when provided' };
    }
    if ((routingRules.policy_scope as unknown[]).some((entry) => typeof entry !== 'string' || !entry.trim())) {
      return { ok: false, message: 'routing_rules.policy_scope must contain only non-empty strings' };
    }
  }
  if (routingRules.subordinate_overrides !== undefined) {
    if (!isPlainRecord(routingRules.subordinate_overrides)) {
      return { ok: false, message: 'routing_rules.subordinate_overrides must be an object when provided' };
    }
    for (const key of Object.keys(routingRules.subordinate_overrides)) {
      if (!VALID_SUBORDINATE_OVERRIDE_KEYS.has(key)) {
        return { ok: false, message: `routing_rules.subordinate_overrides.${key} is not supported` };
      }
      const raw = (routingRules.subordinate_overrides as Record<string, unknown>)[key];
      if (raw !== undefined && typeof raw !== 'string') {
        return { ok: false, message: `routing_rules.subordinate_overrides.${key} must be a string when provided` };
      }
    }
  }
  return { ok: true, value: routingRules };
}

function validateRequiredCapabilitiesPayload(
  value: unknown,
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, message: 'required_capabilities must be an array of strings when provided' };
  }
  if (value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    return { ok: false, message: 'required_capabilities must contain only non-empty strings' };
  }
  return { ok: true, value: value.map((entry) => String(entry).trim().toLowerCase()) };
}

async function getSubagentMaxDepth(pool: pg.Pool): Promise<number> {
  try {
    const res = await pool.query(
      `SELECT value FROM settings_global WHERE key = 'agent.subordinate.maxNestingDepth' LIMIT 1`,
    );
    const raw = res.rows[0]?.value;
    const parsed = typeof raw === 'string' ? Number(JSON.parse(raw)) : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(20, Math.floor(parsed)));
    }
  } catch {
    // Fallback to default.
  }
  return 5;
}

type CandidateAgent = {
  agent_id: string;
  agent_name: string;
  capabilities: string[];
  capability_score: number;
  created_at: string;
};

const VALID_CONFLICT_RESOLUTION = ['priority', 'first', 'merge'] as const;
const VALID_AGGREGATION = ['all', 'best', 'first'] as const;

const nonEmptyStringSchema = { type: 'string', minLength: 1 } as const;
const settingsPayloadSchema = { type: 'object', additionalProperties: true } as const;
const routingRulesPayloadSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    channel: nonEmptyStringSchema,
    channels: {
      type: 'array',
      items: nonEmptyStringSchema,
    },
    channel_chat_id: nonEmptyStringSchema,
    user_id: nonEmptyStringSchema,
    sender_identity_id: nonEmptyStringSchema,
    parent_agent_id: nonEmptyStringSchema,
    nesting_depth: { type: 'integer', minimum: 0 },
    policy_scope: {
      type: 'array',
      items: nonEmptyStringSchema,
    },
    subordinate_overrides: {
      type: 'object',
      additionalProperties: false,
      properties: {
        system_prompt: { type: 'string' },
        model_name: { type: 'string' },
        profile_name: { type: 'string' },
      },
    },
  },
} as const;

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function sendAgentsSchemaUnavailable(reply: any, surface: string): void {
  reply.status(503).send({
    success: false,
    error: {
      code: 'FEATURE_UNAVAILABLE',
      message: `Agents ${surface} schema not initialized`,
    },
  });
}

function requireGlobalAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '') === 'platform_admin') return true;
  reply.status(403).send({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
  });
  return false;
}

function requireActiveOrg(request: any, reply: any): boolean {
  if (String(request.orgId || '').trim()) return true;
  reply.status(403).send({
    success: false,
    error: { code: 'ORG_REQUIRED', message: 'Active account required' },
  });
  return false;
}

export async function registerAgentRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/agents', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    try {
      const res = await pool.query(
        `SELECT id, name, workspace_path, model, status, created_at, updated_at
         FROM agents
         ORDER BY created_at DESC`,
      );
      reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendAgentsSchemaUnavailable(reply, 'list');
        return;
      }
      throw err;
    }
  });

  app.post('/agents', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: nonEmptyStringSchema,
          workspace_path: { type: 'string' },
          model: { type: 'string' },
          system_prompt: { type: 'string' },
          model_name: { type: 'string' },
          profile_name: { type: 'string' },
          settings: settingsPayloadSchema,
          capabilities: {
            type: 'array',
            items: nonEmptyStringSchema,
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const body = (request.body as {
      name?: string;
      workspace_path?: string;
      model?: string;
      system_prompt?: string;
      model_name?: string;
      profile_name?: string;
      settings?: Record<string, unknown>;
      capabilities?: string[];
    }) || {};
    const rawName = String(body.name || '').trim();
    if (!rawName) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name is required' } });
      return;
    }
    const settingsValidation = validateSettingsPayload(body.settings);
    if (!settingsValidation.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: settingsValidation.message } });
      return;
    }
    const name = normalizeName(rawName);
    const id = uuidv7();
    const workspacePath = String(body.workspace_path || `/agents/${name}`);
    await pool.query(
      `INSERT INTO agents (id, name, workspace_path, model, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())`,
      [id, name, workspacePath, body.model || null],
    );
    if (body.system_prompt || body.model_name || body.profile_name || body.settings || body.capabilities) {
      const mergedSettings = mergeSettingsCapabilities(settingsValidation.value, body.capabilities);
      await pool.query(
        `INSERT INTO agent_configs (agent_id, system_prompt, model_name, profile_name, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (agent_id) DO UPDATE SET
           system_prompt = EXCLUDED.system_prompt,
           model_name = EXCLUDED.model_name,
           profile_name = EXCLUDED.profile_name,
           settings = EXCLUDED.settings,
           updated_at = NOW()`,
        [
          id,
          String(body.system_prompt || ''),
          body.model_name || null,
          body.profile_name || null,
          JSON.stringify(mergedSettings),
        ],
      );
    }
    reply.status(201).send({ success: true, data: { id, name, workspace_path: workspacePath } });
  });

  app.get('/agents/:id/config', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `SELECT agent_id, system_prompt, model_name, profile_name, settings, created_at, updated_at
       FROM agent_configs
       WHERE agent_id = $1`,
      [id],
    );
    if (res.rows.length === 0) {
      reply.send({ success: true, data: { agent_id: id, system_prompt: '', settings: {} } });
      return;
    }
    reply.send({ success: true, data: res.rows[0] });
  });

  app.put('/agents/:id/config', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          system_prompt: { type: 'string' },
          model_name: { type: 'string' },
          profile_name: { type: 'string' },
          settings: settingsPayloadSchema,
          capabilities: {
            type: 'array',
            items: nonEmptyStringSchema,
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = (request.body as {
      system_prompt?: string;
      model_name?: string;
      profile_name?: string;
      settings?: Record<string, unknown>;
      capabilities?: string[];
    }) || {};
    const settingsValidation = validateSettingsPayload(body.settings);
    if (!settingsValidation.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: settingsValidation.message } });
      return;
    }
    const mergedSettings = mergeSettingsCapabilities(settingsValidation.value, body.capabilities);
    const res = await pool.query(
      `INSERT INTO agent_configs (agent_id, system_prompt, model_name, profile_name, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (agent_id) DO UPDATE SET
         system_prompt = EXCLUDED.system_prompt,
         model_name = EXCLUDED.model_name,
         profile_name = EXCLUDED.profile_name,
         settings = EXCLUDED.settings,
         updated_at = NOW()
       RETURNING agent_id, system_prompt, model_name, profile_name, settings, updated_at`,
      [
        id,
        String(body.system_prompt || ''),
        body.model_name || null,
        body.profile_name || null,
        JSON.stringify(mergedSettings),
      ],
    );
    reply.send({ success: true, data: res.rows[0] });
  });

  app.post('/agents/:id/spawn-session', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          session_id: nonEmptyStringSchema,
          parent_agent_id: nonEmptyStringSchema,
          session_name: nonEmptyStringSchema,
          chat_type: { type: 'string', enum: ['dm', 'group', 'hq'] },
          routing_rules: routingRulesPayloadSchema,
          system_prompt: { type: 'string' },
          model_name: { type: 'string' },
          profile_name: { type: 'string' },
          policy_scope: {
            anyOf: [
              { type: 'string' },
              {
                type: 'array',
                items: nonEmptyStringSchema,
              },
            ],
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = (request.body as {
      session_id?: string;
      parent_agent_id?: string;
      session_name?: string;
      chat_type?: 'dm' | 'group' | 'hq';
      routing_rules?: any;
      system_prompt?: string;
      model_name?: string;
      profile_name?: string;
      policy_scope?: string[] | string;
    }) || {};
    const routingRulesValidation = validateRoutingRulesPayload(body.routing_rules);
    if (!routingRulesValidation.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: routingRulesValidation.message } });
      return;
    }
    const agent = await pool.query(`SELECT id, name FROM agents WHERE id = $1 AND status = 'active'`, [id]);
    if (agent.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
      return;
    }

    const requestedSessionId = String(body.session_id || '').trim();
    const sessionId = requestedSessionId || uuidv7();
    const chatType = body.chat_type || 'group';
    const sessionName = String(body.session_name || `${agent.rows[0].name}-session`);
    const parentAgentId = String(body.parent_agent_id || '').trim();
    const policyScope = parsePolicyScope(body.policy_scope);
    const overridePayload = {
      system_prompt: String(body.system_prompt || '').trim() || undefined,
      model_name: String(body.model_name || '').trim() || undefined,
      profile_name: String(body.profile_name || '').trim() || undefined,
    };
    const hasOverrides = Boolean(overridePayload.system_prompt || overridePayload.model_name || overridePayload.profile_name);
    const maxDepth = await getSubagentMaxDepth(pool);
    const userId = String((request as any).userId || '').trim();
    const orgId = String((request as any).orgId || '').trim();
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    if (requestedSessionId) {
      const chatAccess = await pool.query(
        `SELECT c.id
         FROM chats c
         JOIN chat_members cm
           ON cm.chat_id = c.id
         WHERE c.id = $1
           AND c.organization_id = $2
           AND cm.user_id = $3
         LIMIT 1`,
        [sessionId, orgId, userId],
      );
      if (chatAccess.rows.length === 0) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'session_id is not accessible in active account' },
        });
        return;
      }
    }

    let nestingDepth = 0;
    if (parentAgentId) {
      const parentRes = await pool.query(
        `SELECT routing_rules
         FROM agent_sessions
         WHERE session_id = $1 AND agent_id = $2
         LIMIT 1`,
        [sessionId, parentAgentId],
      );
      if (parentRes.rows.length === 0) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'parent_agent_id is not mapped to this session' },
        });
        return;
      }
      const parentRules = parentRes.rows[0]?.routing_rules || {};
      const parentDepth = Number(parentRules?.nesting_depth || 0);
      nestingDepth = Number.isFinite(parentDepth) ? parentDepth + 1 : 1;
      if (nestingDepth > maxDepth) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: `Maximum subagent nesting depth exceeded (${maxDepth})`,
          },
        });
        return;
      }
    }

    const routingRules = {
      ...routingRulesValidation.value,
      ...(parentAgentId ? { parent_agent_id: parentAgentId } : {}),
      ...(parentAgentId ? { nesting_depth: nestingDepth } : {}),
      ...(policyScope.length > 0 ? { policy_scope: policyScope } : {}),
      ...(hasOverrides ? { subordinate_overrides: overridePayload } : {}),
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!requestedSessionId) {
        await client.query(
          `INSERT INTO chats (id, organization_id, name, type, channel, channel_chat_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'agent_internal', $1, NOW(), NOW())`,
          [sessionId, orgId, sessionName, chatType],
        );
      }

      await upsertChatMember(client, { chatId: sessionId, userId, role: 'owner' });

      await client.query(
        `INSERT INTO agent_sessions (agent_id, session_id, routing_rules, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (agent_id, session_id)
         DO UPDATE SET routing_rules = EXCLUDED.routing_rules`,
        [id, sessionId, JSON.stringify(routingRules)],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    reply.status(201).send({
      success: true,
      data: {
        agent_id: id,
        session_id: sessionId,
        name: sessionName,
        parent_agent_id: parentAgentId || null,
        nesting_depth: nestingDepth,
        routing_rules: routingRules,
      },
    });
  });

  app.get('/agents/sessions/list', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const query = request.query as { agent_id?: string };
    const params: unknown[] = [orgId];
    let where = 'WHERE c.organization_id = $1';
    if (query.agent_id) {
      params.push(String(query.agent_id));
      where += ` AND asn.agent_id = $${params.length}`;
    }
    const res = await pool.query(
      `SELECT asn.agent_id, a.name AS agent_name, asn.session_id, c.name AS session_name, c.type AS chat_type, asn.routing_rules, asn.created_at
       FROM agent_sessions asn
       JOIN agents a ON a.id = asn.agent_id
       JOIN chats c ON c.id = asn.session_id
       ${where}
       ORDER BY asn.created_at DESC`,
      params,
    );
    reply.send({ success: true, data: res.rows });
  });

  app.post('/agents/sessions/:sessionId/routing', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['agent_id'],
        properties: {
          agent_id: nonEmptyStringSchema,
          routing_rules: routingRulesPayloadSchema,
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body as { agent_id?: string; routing_rules?: any }) || {};
    const routingRulesValidation = validateRoutingRulesPayload(body.routing_rules);
    if (!routingRulesValidation.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: routingRulesValidation.message } });
      return;
    }
    const agentId = String(body.agent_id || '').trim();
    if (!agentId) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'agent_id is required' } });
      return;
    }
    const updated = await pool.query(
      `UPDATE agent_sessions asn
       SET routing_rules = $3
       FROM chats c
       WHERE asn.agent_id = $1
         AND asn.session_id = $2
         AND c.id = asn.session_id
         AND c.organization_id::text = $4::text
       RETURNING asn.agent_id, asn.session_id, asn.routing_rules`,
      [agentId, sessionId, JSON.stringify(routingRulesValidation.value), orgId],
    );
    if (updated.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Agent session mapping not found' } });
      return;
    }
    reply.send({ success: true, data: updated.rows[0] });
  });

  app.post('/agents/routing/resolve', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['channel'],
        properties: {
          channel: nonEmptyStringSchema,
          channel_chat_id: { type: 'string' },
          user_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const body = (request.body as { channel?: string; channel_chat_id?: string; user_id?: string }) || {};
    const channel = normalizeChannel(String(body.channel || ''));
    const channelChatId = String(body.channel_chat_id || '').trim();
    const userId = String(body.user_id || '').trim();
    if (!channel) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel is required' } });
      return;
    }

    const ruleRes = await pool.query(
      `SELECT id, agent_id, session_id, channel, channel_chat_id, user_id, sender_identity_id, priority
       FROM agent_routing_rules rr
       JOIN chats c ON c.id = rr.session_id
       WHERE rr.enabled = true
         AND c.organization_id::text = $4::text
         AND lower(rr.channel) = $1
         AND (rr.channel_chat_id IS NULL OR rr.channel_chat_id = $2)
         AND (rr.user_id IS NULL OR rr.user_id = $3)
       ORDER BY priority DESC, created_at DESC
       LIMIT 1`,
      [channel, channelChatId, userId || null, orgId],
    );
    if (ruleRes.rows.length > 0) {
      const rule = ruleRes.rows[0];
      reply.send({
        success: true,
        data: {
          agent_id: rule.agent_id,
          session_id: rule.session_id || null,
          routing_rule_id: rule.id,
          routing_rules: {
            channel: rule.channel,
            channel_chat_id: rule.channel_chat_id,
            user_id: rule.user_id,
            sender_identity_id: rule.sender_identity_id,
            priority: rule.priority,
          },
        },
      });
      return;
    }

    const res = await pool.query(
      `SELECT asn.agent_id, a.name AS agent_name, asn.session_id, asn.routing_rules, c.channel_chat_id
       FROM agent_sessions asn
       JOIN agents a ON a.id = asn.agent_id
       JOIN chats c ON c.id = asn.session_id
       WHERE a.status = 'active'
         AND c.organization_id::text = $1::text
       ORDER BY asn.created_at DESC`,
      [orgId],
    );

    const match = res.rows.find((row: any) => {
      const rules = row.routing_rules || {};
      const singleChannel = String(rules.channel || '').toLowerCase();
      const channels = Array.isArray(rules.channels) ? rules.channels.map((x: any) => String(x).toLowerCase()) : [];
      const chatMatch = !rules.channel_chat_id || String(rules.channel_chat_id) === channelChatId;
      const userMatch = !rules.user_id || String(rules.user_id) === userId;
      const channelMatch = singleChannel === channel || channels.includes(channel);
      return channelMatch && chatMatch && userMatch;
    });

    if (!match) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No agent routing rule matched this request' },
      });
      return;
    }

    reply.send({
      success: true,
      data: {
        agent_id: match.agent_id,
        agent_name: match.agent_name,
        session_id: match.session_id,
        routing_rules: match.routing_rules,
      },
    });
  });

  app.get('/agents/routing-rules', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const query = request.query as { agent_id?: string; channel?: string; enabled?: string };
    const params: unknown[] = [orgId];
    let where = 'WHERE c.organization_id::text = $1::text';
    if (query.agent_id) {
      params.push(String(query.agent_id));
      where += ` AND agent_id = $${params.length}`;
    }
    if (query.channel) {
      params.push(normalizeChannel(String(query.channel)));
      where += ` AND lower(channel) = $${params.length}`;
    }
    if (query.enabled !== undefined) {
      if (query.enabled !== 'true' && query.enabled !== 'false') {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'enabled query must be true or false when provided' },
        });
        return;
      }
      params.push(query.enabled === 'true');
      where += ` AND enabled = $${params.length}`;
    }
    try {
      const res = await pool.query(
        `SELECT rr.id, rr.agent_id, rr.session_id, rr.channel, rr.channel_chat_id, rr.user_id, rr.sender_identity_id, rr.priority, rr.enabled, rr.created_at, rr.updated_at
         FROM agent_routing_rules rr
         JOIN chats c ON c.id = rr.session_id
         ${where}
         ORDER BY rr.priority DESC, rr.created_at DESC`,
        params,
      );
      reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendAgentsSchemaUnavailable(reply, 'routing rules');
        return;
      }
      throw err;
    }
  });

  app.post('/agents/routing-rules', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['agent_id', 'channel'],
        properties: {
          agent_id: nonEmptyStringSchema,
          session_id: { type: 'string' },
          channel: nonEmptyStringSchema,
          channel_chat_id: { type: 'string' },
          user_id: { type: 'string' },
          sender_identity_id: { type: 'string' },
          priority: { type: 'integer' },
          enabled: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const body = (request.body as {
      agent_id?: string;
      session_id?: string;
      channel?: string;
      channel_chat_id?: string;
      user_id?: string;
      sender_identity_id?: string;
      priority?: number;
      enabled?: boolean;
    }) || {};
    const agentId = String(body.agent_id || '').trim();
    const channel = normalizeChannel(String(body.channel || ''));
    if (!agentId || !channel) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'agent_id and channel are required' } });
      return;
    }
    const sessionId = String(body.session_id || '').trim();
    if (!sessionId) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'session_id is required for org-scoped routing rules' } });
      return;
    }
    const scopedSession = await pool.query(
      `SELECT id
       FROM chats
       WHERE id = $1
         AND organization_id::text = $2::text
       LIMIT 1`,
      [sessionId, orgId],
    );
    if (scopedSession.rows.length === 0) {
      reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'session_id is not accessible in active account' } });
      return;
    }
    const enabledInput = parseOptionalBoolean(body.enabled, 'enabled');
    if (!enabledInput.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: enabledInput.message } });
      return;
    }
    const id = uuidv7();
    const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100;
    await pool.query(
      `INSERT INTO agent_routing_rules
       (id, agent_id, session_id, channel, channel_chat_id, user_id, sender_identity_id, priority, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        id,
        agentId,
        sessionId,
        channel,
        body.channel_chat_id || null,
        body.user_id || null,
        body.sender_identity_id || null,
        priority,
        enabledInput.value === undefined ? true : enabledInput.value,
      ],
    );
    reply.status(201).send({ success: true, data: { id } });
  });

  app.put('/agents/routing-rules/:id', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          agent_id: { type: 'string' },
          session_id: { type: 'string' },
          channel: { type: 'string' },
          channel_chat_id: { type: 'string' },
          user_id: { type: 'string' },
          sender_identity_id: { type: 'string' },
          priority: { type: 'integer' },
          enabled: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const { id } = request.params as { id: string };
    const body = (request.body as {
      agent_id?: string;
      session_id?: string;
      channel?: string;
      channel_chat_id?: string;
      user_id?: string;
      sender_identity_id?: string;
      priority?: number;
      enabled?: boolean;
    }) || {};
    const channel = body.channel ? normalizeChannel(String(body.channel)) : undefined;
    const priority = body.priority !== undefined && Number.isFinite(Number(body.priority))
      ? Number(body.priority)
      : undefined;
    const enabledInput = parseOptionalBoolean(body.enabled, 'enabled');
    if (!enabledInput.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: enabledInput.message } });
      return;
    }

    const nextSessionId = String(body.session_id || '').trim();
    if (body.session_id !== undefined && !nextSessionId) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'session_id must be a non-empty string when provided' } });
      return;
    }
    if (body.session_id !== undefined) {
      const scopedSession = await pool.query(
        `SELECT id
         FROM chats
         WHERE id = $1
           AND organization_id::text = $2::text
         LIMIT 1`,
        [nextSessionId, orgId],
      );
      if (scopedSession.rows.length === 0) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'session_id is not accessible in active account' } });
        return;
      }
    }

    const updated = await pool.query(
      `UPDATE agent_routing_rules rr
       SET agent_id = COALESCE($2, rr.agent_id),
           session_id = COALESCE($3, rr.session_id),
           channel = COALESCE($4, rr.channel),
           channel_chat_id = COALESCE($5, rr.channel_chat_id),
           user_id = COALESCE($6, rr.user_id),
           sender_identity_id = COALESCE($7, rr.sender_identity_id),
           priority = COALESCE($8, rr.priority),
           enabled = COALESCE($9, rr.enabled),
           updated_at = NOW()
       FROM chats c
       WHERE rr.id = $1
         AND c.id = COALESCE($3, rr.session_id)
         AND c.organization_id::text = $10::text
       RETURNING rr.id, rr.agent_id, rr.session_id, rr.channel, rr.channel_chat_id, rr.user_id, rr.sender_identity_id, rr.priority, rr.enabled, rr.updated_at`,
      [
        id,
        body.agent_id || null,
        body.session_id || null,
        channel || null,
        body.channel_chat_id || null,
        body.user_id || null,
        body.sender_identity_id || null,
        priority ?? null,
        enabledInput.value === undefined ? null : enabledInput.value,
        orgId,
      ],
    );
    if (updated.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Routing rule not found' } });
      return;
    }
    reply.send({ success: true, data: updated.rows[0] });
  });

  app.delete('/agents/routing-rules/:id', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `DELETE FROM agent_routing_rules rr
       USING chats c
       WHERE rr.id = $1
         AND c.id = rr.session_id
         AND c.organization_id::text = $2::text
       RETURNING rr.id`,
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Routing rule not found' } });
      return;
    }
    reply.send({ success: true, data: { id } });
  });

  app.get('/agents/sessions/:sessionId/history', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const { sessionId } = request.params as { sessionId: string };
    const query = request.query as { limit?: string };
    const limit = parseAgentSessionHistoryLimit(query.limit);
    if (limit === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a positive integer' },
      });
      return;
    }
    const messages = await pool.query(
      `SELECT id, role, content_type, text, created_at
       FROM messages m
       JOIN chats c ON c.id = m.chat_id
       WHERE m.chat_id = $1
         AND c.organization_id::text = $3::text
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, limit, orgId],
    );
    reply.send({ success: true, data: messages.rows.reverse() });
  });

  app.post('/agents/sessions/send', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['from_agent', 'to_agent', 'session_id', 'message'],
        properties: {
          from_agent: nonEmptyStringSchema,
          to_agent: nonEmptyStringSchema,
          session_id: nonEmptyStringSchema,
          message: nonEmptyStringSchema,
          reply_back: { type: 'boolean' },
          reply_skip: { type: 'boolean' },
          announce_skip: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const body = (request.body as {
      from_agent?: string;
      to_agent?: string;
      session_id?: string;
      message?: string;
      reply_back?: boolean | unknown;
      reply_skip?: boolean | unknown;
      announce_skip?: boolean | unknown;
    }) || {};
    const fromAgent = String(body.from_agent || '').trim();
    const toAgent = String(body.to_agent || '').trim();
    const sessionId = String(body.session_id || '').trim();
    const message = String(body.message || '').trim();
    if (!fromAgent || !toAgent || !sessionId || !message) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'from_agent, to_agent, session_id, and message are required' },
      });
      return;
    }
    if (body.reply_back !== undefined && typeof body.reply_back !== 'boolean') {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'reply_back must be a boolean' },
      });
      return;
    }
    if (body.reply_skip !== undefined && typeof body.reply_skip !== 'boolean') {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'reply_skip must be a boolean' },
      });
      return;
    }
    if (body.announce_skip !== undefined && typeof body.announce_skip !== 'boolean') {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'announce_skip must be a boolean' },
      });
      return;
    }

    const exists = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM agent_sessions asn
       JOIN chats c ON c.id = asn.session_id
       WHERE asn.session_id = $1
         AND asn.agent_id = ANY($2::text[])
         AND c.organization_id::text = $3::text`,
      [sessionId, [fromAgent, toAgent], orgId],
    );
    if (Number(exists.rows[0]?.total || 0) < 2) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Both agents must be attached to target session_id' },
      });
      return;
    }

    const id = uuidv7();
    const flags = {
      reply_back: body.reply_back === true,
      reply_skip: body.reply_skip === true,
      announce_skip: body.announce_skip === true,
    };
    await pool.query(
      `INSERT INTO inter_agent_messages
       (id, from_agent, to_agent, session_id, message, status, control_flags, created_at, delivered_at)
       VALUES ($1, $2, $3, $4, $5, 'delivered', $6, NOW(), NOW())`,
      [id, fromAgent, toAgent, sessionId, message, JSON.stringify(flags)],
    );

    await pool.query(
      `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
       VALUES ($1, $2, 'system', 'text', $3, NOW())`,
      [uuidv7(), sessionId, `[AGENT:${fromAgent}->${toAgent}] ${message}`],
    );

    if (flags.reply_back && !flags.reply_skip) {
      const replyText = `ACK from ${toAgent}: received "${message.slice(0, 120)}"`;
      await pool.query(
        `UPDATE inter_agent_messages
         SET status = 'responded', response_message = $2, responded_at = NOW()
         WHERE id = $1`,
        [id, replyText],
      );
      await pool.query(
        `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
         VALUES ($1, $2, 'system', 'text', $3, NOW())`,
        [uuidv7(), sessionId, `[AGENT:${toAgent}->${fromAgent}] ${replyText}`],
      );
    }

    reply.status(201).send({
      success: true,
      data: {
        id,
        from_agent: fromAgent,
        to_agent: toAgent,
        session_id: sessionId,
        status: flags.reply_back && !flags.reply_skip ? 'responded' : 'delivered',
        control_flags: flags,
      },
    });
  });

  app.post('/agents/supervisor/orchestrate', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['supervisor_agent_id', 'session_id', 'task'],
        properties: {
          supervisor_agent_id: nonEmptyStringSchema,
          session_id: nonEmptyStringSchema,
          task: nonEmptyStringSchema,
          required_capabilities: {
            type: 'array',
            items: nonEmptyStringSchema,
          },
          max_agents: {
            anyOf: [
              { type: 'integer', minimum: 1 },
              { type: 'string', minLength: 1 },
            ],
          },
          conflict_resolution: { type: 'string' },
          aggregation: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const body = (request.body as {
      supervisor_agent_id?: string;
      session_id?: string;
      task?: string;
      required_capabilities?: string[];
      max_agents?: number | string;
      conflict_resolution?: 'priority' | 'first' | 'merge';
      aggregation?: 'all' | 'best' | 'first';
    }) || {};

    const supervisorAgentId = String(body.supervisor_agent_id || '').trim();
    const sessionId = String(body.session_id || '').trim();
    const task = String(body.task || '').trim();
    const requiredCapabilitiesValidation = validateRequiredCapabilitiesPayload(body.required_capabilities);
    if (!requiredCapabilitiesValidation.ok) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: requiredCapabilitiesValidation.message },
      });
      return;
    }
    const requiredCapabilities = requiredCapabilitiesValidation.value;
    let maxAgents = 3;
    if (body.max_agents !== undefined && body.max_agents !== null && String(body.max_agents).trim() !== '') {
      const parsed = Number(body.max_agents);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'max_agents must be a positive integer',
          },
        });
        return;
      }
      maxAgents = Math.max(1, Math.min(8, parsed));
    }
    const conflictResolution = body.conflict_resolution || 'priority';
    const aggregation = body.aggregation || 'all';

    if (!supervisorAgentId || !sessionId || !task) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: 'supervisor_agent_id, session_id, and task are required',
        },
      });
      return;
    }
    if (!VALID_CONFLICT_RESOLUTION.includes(conflictResolution as any)) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `conflict_resolution must be one of: ${VALID_CONFLICT_RESOLUTION.join(', ')}`,
        },
      });
      return;
    }
    if (!VALID_AGGREGATION.includes(aggregation as any)) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `aggregation must be one of: ${VALID_AGGREGATION.join(', ')}`,
        },
      });
      return;
    }

    const supervisorCheck = await pool.query(
      `SELECT a.id, a.name
       FROM agent_sessions asn
       JOIN agents a ON a.id = asn.agent_id
       JOIN chats c ON c.id = asn.session_id
       WHERE asn.session_id = $1
         AND asn.agent_id = $2
         AND c.organization_id::text = $3::text
         AND a.status = 'active'`,
      [sessionId, supervisorAgentId, orgId],
    );
    if (supervisorCheck.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Supervisor agent is not active in this session',
        },
      });
      return;
    }

    const candidatesRes = await pool.query(
      `SELECT a.id AS agent_id, a.name AS agent_name, asn.created_at, ac.settings
       FROM agent_sessions asn
       JOIN agents a ON a.id = asn.agent_id
       LEFT JOIN agent_configs ac ON ac.agent_id = a.id
       JOIN chats c ON c.id = asn.session_id
       WHERE asn.session_id = $1
         AND c.organization_id::text = $3::text
         AND a.status = 'active'
         AND asn.agent_id <> $2
       ORDER BY asn.created_at ASC`,
      [sessionId, supervisorAgentId, orgId],
    );

    const rankedCandidates: CandidateAgent[] = candidatesRes.rows
      .map((row: any) => {
        const capabilities = parseAgentCapabilities(row);
        const capabilityScore = requiredCapabilities.length === 0
          ? capabilities.length
          : requiredCapabilities.filter((cap) => capabilities.includes(cap)).length;
        return {
          agent_id: row.agent_id,
          agent_name: row.agent_name,
          capabilities,
          capability_score: capabilityScore,
          created_at: row.created_at,
        };
      })
      .filter((row) => (requiredCapabilities.length > 0 ? row.capability_score > 0 : true))
      .sort((left, right) => {
        if (right.capability_score !== left.capability_score) {
          return right.capability_score - left.capability_score;
        }
        return String(left.created_at).localeCompare(String(right.created_at));
      })
      .slice(0, maxAgents);

    if (rankedCandidates.length === 0) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No eligible sub-agents matched required capabilities',
        },
      });
      return;
    }

    const assignments: Array<{
      inter_agent_message_id: string;
      to_agent: string;
      to_agent_name: string;
      capability_score: number;
      capabilities: string[];
      response: string;
    }> = [];

    for (const candidate of rankedCandidates) {
      const interAgentMessageId = uuidv7();
      const response = `[${candidate.agent_name}] ${task} (capabilities: ${candidate.capabilities.join(', ') || 'none'})`;
      await pool.query(
        `INSERT INTO inter_agent_messages
         (id, from_agent, to_agent, session_id, message, status, control_flags, response_message, created_at, delivered_at, responded_at)
         VALUES ($1, $2, $3, $4, $5, 'responded', $6, $7, NOW(), NOW(), NOW())`,
        [
          interAgentMessageId,
          supervisorAgentId,
          candidate.agent_id,
          sessionId,
          task,
          JSON.stringify({
            orchestrated: true,
            required_capabilities: requiredCapabilities,
            capability_score: candidate.capability_score,
            conflict_resolution: conflictResolution,
            aggregation,
          }),
          response,
        ],
      );
      assignments.push({
        inter_agent_message_id: interAgentMessageId,
        to_agent: candidate.agent_id,
        to_agent_name: candidate.agent_name,
        capability_score: candidate.capability_score,
        capabilities: candidate.capabilities,
        response,
      });
    }

    const uniqueResponses = new Set(assignments.map((x) => x.response.trim().toLowerCase()));
    const hasConflict = uniqueResponses.size > 1;
    const top = assignments[0];

    let aggregatedResult: string;
    if (aggregation === 'first') {
      aggregatedResult = assignments[0].response;
    } else if (aggregation === 'best') {
      aggregatedResult = top.response;
    } else if (conflictResolution === 'merge') {
      aggregatedResult = assignments.map((x) => x.response).join('\n');
    } else if (conflictResolution === 'first') {
      aggregatedResult = assignments[0].response;
    } else {
      aggregatedResult = top.response;
    }

    await pool.query(
      `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
       VALUES ($1, $2, 'system', 'text', $3, NOW())`,
      [
        uuidv7(),
        sessionId,
        `[SUPERVISOR:${supervisorAgentId}] task="${task}" sub_agents=${assignments.length} conflict=${hasConflict ? 'yes' : 'no'} result="${aggregatedResult.slice(0, 500)}"`,
      ],
    );

    reply.status(201).send({
      success: true,
      data: {
        supervisor_agent_id: supervisorAgentId,
        session_id: sessionId,
        task,
        required_capabilities: requiredCapabilities,
        assignments,
        aggregation,
        conflict_resolution: conflictResolution,
        conflict_detected: hasConflict,
        aggregated_result: aggregatedResult,
      },
    });
  });

  app.delete('/agents/:id', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `UPDATE agents
       SET status = 'destroyed', updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
      return;
    }
    reply.send({ success: true, data: { id } });
  });
}
