import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';
import { CompactionService } from '../../services/CompactionService.js';
import { basename } from 'path';

const logger = createLogger('admin-debug');
const SESSION_RESET_MARKER = '[SVEN_SESSION_RESET]';
const COMPACTION_SUMMARY_PREFIX = '[SVEN_COMPACTION_SUMMARY]';
const MAX_MESSAGES = 50;
const MAX_PROACTIVE_HEALTH_SERVICE_LENGTH = 128;
const MAX_PROACTIVE_HEALTH_MESSAGE_LENGTH = 1024;
const REDACTED = '[REDACTED]';
const SENSITIVE_FIELD_PATTERN = /(secret|token|password|api[_-]?key|authorization|cookie|session|credential|private[_-]?key|refresh[_-]?token|access[_-]?token)/i;
const SENSITIVE_ASSIGNMENT_PATTERN = /((?:api[_-]?key|token|secret|password|authorization|cookie|session|private[_-]?key|refresh[_-]?token|access[_-]?token)\s*[:=]\s*)([^\s,;]+)/ig;
const SENSITIVE_QUERY_PATTERN = /([?&](?:token|api[_-]?key|key|secret|sig|signature)=)([^&\s]+)/ig;

type IdentityDocRow = {
  id: string;
  scope: 'global' | 'chat' | 'project';
  chat_id?: string | null;
  project_key?: string | null;
  content: string;
  version: number;
  updated_by: string;
  updated_at: string;
};

function deriveProjectKey(workspacePath: string): string {
  return basename(String(workspacePath || '').replace(/[\\/]+$/, '')).trim().toLowerCase();
}

function composeSystemPrompt(rows: IdentityDocRow[]): string {
  const globalDoc = rows.find((row) => row.scope === 'global')?.content?.trim() || '';
  const projectDoc = rows.find((row) => row.scope === 'project')?.content?.trim() || '';
  const chatDoc = rows.find((row) => row.scope === 'chat')?.content?.trim() || '';
  const sections = [globalDoc, projectDoc, chatDoc].filter(Boolean);
  if (sections.length === 0) return 'You are Sven, the AI platform built by 47 Network (sven.systems, github.com/47network/sven).';
  return sections.join('\n\n');
}

function redactSensitiveString(value: string): string {
  return String(value)
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED}`);
}

function redactSensitiveValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSensitiveString(value);
  if (Array.isArray(value)) return value.map((entry) => redactSensitiveValue(entry));
  if (typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(input)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      output[key] = REDACTED;
      continue;
    }
    output[key] = redactSensitiveValue(entry);
  }
  return output;
}

export async function registerDebugRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  app.get('/debug/context/:sessionId', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const { sessionId } = request.params as { sessionId: string };
    const chatRes = await pool.query(
      `SELECT id, name, type, channel, channel_chat_id, organization_id
       FROM chats
       WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    if (chatRes.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found' },
      });
    }

    const lastIdentityRes = await pool.query(
      `SELECT sender_identity_id
       FROM messages
       WHERE chat_id = $1 AND sender_identity_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId],
    );
    const senderIdentityId = lastIdentityRes.rows[0]?.sender_identity_id || null;

    let userId: string | null = null;
    if (senderIdentityId) {
      const identityRes = await pool.query(
        `SELECT user_id FROM identities WHERE id = $1`,
        [senderIdentityId],
      );
      userId = identityRes.rows[0]?.user_id || null;
    }

    let projectKey: string | null = null;
    try {
      const workspaceRes = await pool.query(
        `SELECT a.workspace_path
         FROM agent_sessions s
         JOIN agents a ON a.id = s.agent_id
         WHERE s.session_id = $1
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [sessionId],
      );
      const workspacePath = String(workspaceRes.rows[0]?.workspace_path || '').trim();
      if (workspacePath) {
        const derived = deriveProjectKey(workspacePath);
        if (derived) projectKey = derived;
      }
    } catch {
      projectKey = null;
    }

    let identityDocs: IdentityDocRow[] = [];
    try {
      const identityDocsRes = await pool.query(
        `SELECT id, scope, chat_id, project_key, content, version, updated_by, updated_at
         FROM sven_identity_docs
         WHERE organization_id = $3
           AND (
             scope = 'global'
             OR (scope = 'project' AND project_key = $2)
             OR (scope = 'chat' AND chat_id = $1)
           )
         ORDER BY CASE scope WHEN 'global' THEN 1 WHEN 'project' THEN 2 WHEN 'chat' THEN 3 ELSE 99 END ASC, updated_at DESC`,
        [sessionId, projectKey, orgId],
      );
      identityDocs = identityDocsRes.rows as IdentityDocRow[];
    } catch {
      const legacyRes = await pool.query(
        `SELECT id, scope, chat_id, NULL::text AS project_key, content, version, updated_by, updated_at
         FROM sven_identity_docs
         WHERE organization_id = $2
           AND (scope = 'global' OR (scope = 'chat' AND chat_id = $1))
         ORDER BY CASE scope WHEN 'global' THEN 1 WHEN 'chat' THEN 2 ELSE 99 END ASC, updated_at DESC`,
        [sessionId, orgId],
      );
      identityDocs = legacyRes.rows as IdentityDocRow[];
    }
    const baseSystemPrompt = composeSystemPrompt(identityDocs);

    const resetMarkerRes = await pool.query(
      `SELECT created_at
       FROM messages
       WHERE chat_id = $1
         AND role = 'system'
         AND (text = $2 OR text LIKE $3)
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId, SESSION_RESET_MARKER, `${COMPACTION_SUMMARY_PREFIX}%`],
    );
    const resetAfter = resetMarkerRes.rows[0]?.created_at || null;

    const messageCountRes = resetAfter
      ? await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM messages
         WHERE chat_id = $1 AND created_at > $2`,
        [sessionId, resetAfter],
      )
      : await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM messages
         WHERE chat_id = $1`,
        [sessionId],
      );
    const totalMessages = Number(messageCountRes.rows[0]?.total || 0);

    const messagesRes = resetAfter
      ? await pool.query(
        `SELECT role, content_type, text, blocks, created_at
         FROM messages
         WHERE chat_id = $1 AND created_at > $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [sessionId, resetAfter, MAX_MESSAGES],
      )
      : await pool.query(
        `SELECT role, content_type, text, blocks, created_at
         FROM messages
         WHERE chat_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [sessionId, MAX_MESSAGES],
      );
    const messages = messagesRes.rows.reverse().map((row) => ({
      ...row,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    }));

    const recentToolRunsRes = await pool.query(
      `SELECT tool_name, outputs, created_at
       FROM tool_runs
       WHERE chat_id = $1 AND status IN ('success', 'completed')
       ORDER BY created_at DESC
       LIMIT 5`,
      [sessionId],
    );
    if (recentToolRunsRes.rows.length > 0) {
      const toolSummary = recentToolRunsRes.rows
        .map((row: any) => {
          const out = row.outputs
            ? redactSensitiveString(JSON.stringify(row.outputs).replace(/\s+/g, ' ').slice(0, 200))
            : '(no output)';
          return `- ${String(row.tool_name)}: ${out}`;
        })
        .join('\n');
      messages.push({
        role: 'system',
        content_type: 'text',
        text: `Recent tool outputs:\n${toolSummary}`,
        created_at: new Date().toISOString(),
        synthetic: true,
      });
    }

    let sessionSettings: any = {};
    try {
      const sessionSettingsRes = await pool.query(
        `SELECT think_level, "verbose" AS verbose, usage_mode, model_name, profile_name, rag_enabled
         FROM session_settings
         WHERE session_id = $1
         LIMIT 1`,
        [sessionId],
      );
      sessionSettings = sessionSettingsRes.rows[0] || {};
    } catch {
      sessionSettings = {};
    }

    let agentConfig: { agent_id?: string; system_prompt?: string; model_name?: string; profile_name?: string } | null = null;
    try {
      const agentRes = await pool.query(
        `SELECT s.agent_id, ac.system_prompt, ac.model_name, ac.profile_name
         FROM agent_sessions s
         LEFT JOIN agent_configs ac ON ac.agent_id = s.agent_id
         WHERE s.session_id = $1
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [sessionId],
      );
      if (agentRes.rows.length > 0) {
        agentConfig = agentRes.rows[0];
      }
    } catch {
      agentConfig = null;
    }

    const settingKeys = ['chat.think.default', 'buddy.enabled', 'buddy.proactivity'];
    const settingsRes = await pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1
         AND key = ANY($2::text[])`,
      [orgId, settingKeys],
    );
    const settingsMap = new Map<string, unknown>();
    for (const row of settingsRes.rows) {
      settingsMap.set(row.key, parseSettingValue(row.value));
    }

    const defaultThinkLevel = settingsMap.get('chat.think.default');
    const buddyEnabled = Boolean(settingsMap.get('buddy.enabled'));
    const buddyProactivity = String(settingsMap.get('buddy.proactivity') ?? 'off');

    const availableToolsPrompt = await buildAvailableToolsPrompt(pool, sessionId, orgId);
    const deviceContextPrompt = await buildDeviceContextPrompt(pool, sessionId);

    let systemPrompt = baseSystemPrompt;
    if (agentConfig?.system_prompt) {
      systemPrompt = `${agentConfig.system_prompt}\n\n${systemPrompt}`;
    }
    if (buddyEnabled && isProactivityEnabled(buddyProactivity)) {
      systemPrompt = `${systemPrompt}\n\nIf the request is ambiguous, ask a brief clarifying question before taking action.`;
    }
    if (sessionSettings.verbose) {
      systemPrompt = `${systemPrompt}\n\nRespond with additional implementation detail, tradeoffs, and explicit steps.`;
    }
    const effectiveThinkLevel = sessionSettings.think_level || defaultThinkLevel || null;
    if (effectiveThinkLevel) {
      const thinkLevel = String(effectiveThinkLevel).toLowerCase();
      if (thinkLevel === 'off') {
        systemPrompt = `${systemPrompt}\n\nKeep reasoning concise and avoid long internal deliberation output.`;
      } else if (thinkLevel === 'high') {
        systemPrompt = `${systemPrompt}\n\nUse deeper reasoning and double-check assumptions before answering.`;
      } else {
        systemPrompt = `${systemPrompt}\n\nReasoning depth preference: ${thinkLevel}.`;
      }
    }
    if (sessionSettings.rag_enabled === false) {
      systemPrompt = `${systemPrompt}\n\nDo not rely on retrieval context or citations for this session unless explicitly requested by the user.`;
    }
    if (availableToolsPrompt) {
      systemPrompt = `${systemPrompt}\n\n${availableToolsPrompt}`;
    }
    if (deviceContextPrompt) {
      systemPrompt = `${systemPrompt}\n\n${deviceContextPrompt}`;
    }

    const memoriesRes = await pool.query(
      `SELECT id, key, value, visibility, created_at, updated_at
       FROM memories
       WHERE (visibility = 'global')
          OR (visibility = 'chat_shared' AND chat_id = $1)
          OR ($2::text IS NOT NULL AND visibility = 'user_private' AND user_id = $2)
       ORDER BY updated_at DESC
       LIMIT 20`,
      [sessionId, userId],
    );

    const toolsPayload = await loadToolsForChat(pool, sessionId, orgId);

    const systemTokens = estimateTextTokens(systemPrompt);
    const memoryTokens = estimateRowsTokens(
      memoriesRes.rows.map((row: any) => ({ text: `${row.key}: ${row.value}` })),
    );
    const ragTokens = 0;
    const conversationTokens = estimateRowsTokens(
      messages.map((m: any) => ({ text: m.text || JSON.stringify(m.blocks || '') })),
    );
    const toolsTokens = estimateRowsTokens(
      toolsPayload.tokensSource.map((t) => ({ text: t })),
    );
    const totalTokens = systemTokens + memoryTokens + ragTokens + conversationTokens + toolsTokens;

    const compactionService = new CompactionService(pool);
    let contextWindow = 0;
    try {
      const budget = await compactionService.getContextBudget(
        sessionSettings.model_name || agentConfig?.model_name || null,
      );
      contextWindow = Number(budget.context_window || 0);
    } catch (err) {
      logger.warn('Failed to resolve context window', { err: String(err) });
    }

    const redactedIdentityDocs = identityDocs.map((doc) => ({
      ...doc,
      content: redactSensitiveString(String(doc.content || '')),
    }));
    const redactedMessages = messages.map((message: any) => ({
      ...message,
      text: typeof message.text === 'string' ? redactSensitiveString(message.text) : message.text,
      blocks: redactSensitiveValue(message.blocks),
    }));
    const redactedMemories = memoriesRes.rows.map((row: any) => ({
      ...row,
      key: redactSensitiveString(String(row.key || '')),
      value: redactSensitiveValue(row.value),
    }));
    const redactedToolsPrompt = availableToolsPrompt ? redactSensitiveString(availableToolsPrompt) : '';
    const redactedDevicePrompt = deviceContextPrompt ? redactSensitiveString(deviceContextPrompt) : '';
    const redactedBaseSystemPrompt = redactSensitiveString(baseSystemPrompt);
    const redactedSystemPrompt = redactSensitiveString(systemPrompt);

    reply.send({
      success: true,
      data: {
        session_id: sessionId,
        chat: chatRes.rows[0],
        user_id: userId,
        agent: agentConfig,
        identity_docs: {
          rows: redactedIdentityDocs,
          global: redactedIdentityDocs.find((doc) => doc.scope === 'global') || null,
          project: redactedIdentityDocs.find((doc) => doc.scope === 'project') || null,
          chat: redactedIdentityDocs.find((doc) => doc.scope === 'chat') || null,
        },
        system_prompt: {
          text: redactedSystemPrompt,
          base: redactedBaseSystemPrompt,
          tokens: systemTokens,
          tools_prompt: redactedToolsPrompt,
          device_prompt: redactedDevicePrompt,
        },
        memories: {
          rows: redactedMemories,
          tokens: memoryTokens,
        },
        rag_results: {
          rows: [],
          tokens: ragTokens,
          note: 'RAG results are not persisted for this session. Live retrieval only.',
        },
        conversation: {
          messages: redactedMessages,
          tokens: conversationTokens,
          total_messages: totalMessages,
          truncated: totalMessages > MAX_MESSAGES,
          boundary: resetAfter ? new Date(resetAfter).toISOString() : null,
        },
        tools: {
          first_party: toolsPayload.firstParty,
          mcp: toolsPayload.mcp,
          tokens: toolsTokens,
          count: toolsPayload.firstParty.length + toolsPayload.mcp.length,
        },
        totals: {
          tokens: totalTokens,
          context_window: contextWindow,
          remaining_tokens: contextWindow > 0 ? Math.max(0, contextWindow - totalTokens) : null,
          exceeded: contextWindow > 0 ? totalTokens > contextWindow : false,
        },
        session_settings: {
          think_level: sessionSettings.think_level || null,
          verbose: Boolean(sessionSettings.verbose || false),
          usage_mode: String(sessionSettings.usage_mode || 'off'),
          model_name: sessionSettings.model_name || null,
          profile_name: sessionSettings.profile_name || null,
          rag_enabled: sessionSettings.rag_enabled !== false,
        },
      },
    });
  });

  app.post('/debug/proactive-health/simulate', async (request: any, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
    const body = (request.body || {}) as {
      enabled?: boolean;
      service?: string;
      message?: string;
      severity?: 'info' | 'warning' | 'critical';
    };
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
      });
    }
    const enabled = body.enabled === true;
    const key = 'proactive.health.simulatedIssue';

    if (!enabled) {
      await pool.query(
        `DELETE FROM organization_settings WHERE organization_id = $1 AND key = $2`,
        [orgId, key],
      );
      return reply.send({ success: true, data: { enabled: false } });
    }

    if (body.service !== undefined && typeof body.service !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'service must be a string when provided' },
      });
    }
    if (body.message !== undefined && typeof body.message !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'message must be a string when provided' },
      });
    }

    const service = String(body.service || 'simulated').trim() || 'simulated';
    const message = String(body.message || 'Simulated service degradation').trim() || 'Simulated service degradation';
    if (service.length > MAX_PROACTIVE_HEALTH_SERVICE_LENGTH) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `service must be ${MAX_PROACTIVE_HEALTH_SERVICE_LENGTH} characters or fewer`,
        },
      });
    }
    if (message.length > MAX_PROACTIVE_HEALTH_MESSAGE_LENGTH) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `message must be ${MAX_PROACTIVE_HEALTH_MESSAGE_LENGTH} characters or fewer`,
        },
      });
    }
    const severity = ['info', 'warning', 'critical'].includes(String(body.severity || 'warning'))
      ? String(body.severity)
      : 'warning';

    const payload = { service, message, severity, enabled: true };
    await pool.query(
      `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
       VALUES ($1, $2, $3::jsonb, NOW(), $4)
       ON CONFLICT (organization_id, key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [orgId, key, JSON.stringify(payload), String(request.userId || 'system')],
    );

    return reply.send({ success: true, data: payload });
  });
}

function parseSettingValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isProactivityEnabled(value: string): boolean {
  const normalized = (value || '').toLowerCase();
  return normalized !== 'off' && normalized !== 'disabled' && normalized !== 'false';
}

async function loadToolsForChat(pool: pg.Pool, chatId: string, orgId: string): Promise<{
  firstParty: Array<Record<string, unknown>>;
  mcp: Array<Record<string, unknown>>;
  tokensSource: string[];
}> {
  let toolsRes;
  try {
    toolsRes = await pool.query(
      `SELECT t.name, t.display_name, t.description, t.inputs_schema, t.outputs_schema, t.trust_level, t.is_first_party
       FROM tools t
       JOIN skills_installed si ON si.tool_id = t.id
       WHERE si.organization_id = $1
         AND si.trust_level <> 'blocked'
         AND t.status = 'active'
       ORDER BY t.name ASC
       LIMIT 200`,
      [orgId],
    );
  } catch {
    toolsRes = { rows: [] };
  }

  let mcpRows: Array<Record<string, unknown>> = [];
  try {
    const overrideCount = await pool.query(
      `SELECT COUNT(*)::int AS c FROM mcp_chat_overrides WHERE chat_id = $1`,
      [chatId],
    );
    if (Number(overrideCount.rows[0]?.c || 0) > 0) {
      const res = await pool.query(
        `SELECT t.qualified_name, t.tool_name, t.description, t.input_schema, t.server_id
          FROM mcp_server_tools t
          JOIN mcp_chat_overrides o ON o.server_id = t.server_id
          WHERE o.chat_id = $1 AND o.enabled = true
          ORDER BY t.qualified_name ASC
          LIMIT 200`,
        [chatId],
      );
      mcpRows = res.rows;
    }
  } catch {
    mcpRows = [];
  }

  const tokensSource: string[] = [];
  for (const row of toolsRes.rows) {
    tokensSource.push(`${row.name}: ${row.description || ''}`);
  }
  for (const row of mcpRows) {
    tokensSource.push(`${row.qualified_name}: ${row.description || ''}`);
  }

  return {
    firstParty: toolsRes.rows,
    mcp: mcpRows,
    tokensSource,
  };
}

async function buildAvailableToolsPrompt(pool: pg.Pool, chatId: string, orgId: string): Promise<string> {
  let toolsRes;
  try {
    toolsRes = await pool.query(
      `SELECT DISTINCT t.name
       FROM tools t
       JOIN skills_installed si ON si.tool_id = t.id
       WHERE si.organization_id = $1
         AND si.trust_level <> 'blocked'
         AND t.status = 'active'
       ORDER BY t.name ASC
       LIMIT 80`,
      [orgId],
    );
  } catch {
    return '';
  }
  let mcpRows: Array<{ qualified_name: string }> = [];
  try {
    const overrideCount = await pool.query(
      `SELECT COUNT(*)::int AS c FROM mcp_chat_overrides WHERE chat_id = $1`,
      [chatId],
    );
    if (Number(overrideCount.rows[0]?.c || 0) > 0) {
      const res = await pool.query(
        `SELECT t.qualified_name
         FROM mcp_server_tools t
         JOIN mcp_chat_overrides o ON o.server_id = t.server_id
         WHERE o.chat_id = $1 AND o.enabled = true
         ORDER BY t.qualified_name ASC
         LIMIT 80`,
        [chatId],
      );
      mcpRows = res.rows;
    }
  } catch {
    mcpRows = [];
  }

  const names = new Set<string>();
  for (const row of toolsRes.rows) names.add(String((row as any).name));
  for (const row of mcpRows) names.add(String(row.qualified_name));
  if (names.size === 0) return '';

  return [
    'Available tools (call by exact tool name when needed):',
    ...Array.from(names).sort().map((name) => `- ${name}`),
  ].join('\n');
}

async function buildDeviceContextPrompt(pool: pg.Pool, chatId: string): Promise<string> {
  try {
    const chatRes = await pool.query(
      `SELECT organization_id FROM chats WHERE id = $1`,
      [chatId],
    );
    const orgId = chatRes.rows[0]?.organization_id;
    if (!orgId) return '';

    const devicesRes = await pool.query(
      `SELECT name, device_type, status, capabilities, last_seen_at
       FROM devices
       WHERE organization_id = $1
       ORDER BY status ASC, name ASC
       LIMIT 20`,
      [orgId],
    );
    if (devicesRes.rows.length === 0) return '';

    const lines = devicesRes.rows.map((d: any) => {
      const caps = Array.isArray(d.capabilities) ? d.capabilities.join(', ') : '';
      const lastSeen = d.last_seen_at
        ? ` (last seen: ${new Date(d.last_seen_at).toISOString().slice(0, 16).replace('T', ' ')})`
        : '';
      return `- ${String(d.name)} (${String(d.device_type)}, ${String(d.status)}${caps ? `, capabilities: ${caps}` : ''}${d.status === 'offline' ? lastSeen : ''})`;
    });

    return [
      'Connected devices you can control via device.* tools:',
      ...lines,
      '',
      'Use device.list to refresh, device.send_command / device.display / device.speak / device.camera_snapshot / device.sensor_read to interact.',
    ].join('\n');
  } catch {
    return '';
  }
}

function estimateRowsTokens(rows: Array<{ text?: string }>): number {
  return rows.reduce((sum, r) => sum + estimateTextTokens(String(r.text || '')), 0);
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}
