import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

const SESSION_RESET_MARKER = '[SVEN_SESSION_RESET]';
const COMPACTION_SUMMARY_PREFIX = '[SVEN_COMPACTION_SUMMARY]';

type SessionAccessContext = {
  userId: string;
  orgId: string;
};

export class CompactionService {
  constructor(private pool: pg.Pool) {}

  async ensureSessionAccess(sessionId: string, context: SessionAccessContext): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT c.id
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE c.id = $1
         AND cm.user_id = $2
         AND c.organization_id = $3
       LIMIT 1`,
      [sessionId, context.userId, context.orgId],
    );
    return res.rows.length > 0;
  }

  async compactSession(
    sessionId: string,
    context: SessionAccessContext,
    options?: { keepRecent?: number; force?: boolean },
  ): Promise<{
    compacted: boolean;
    reason?: string;
    before_tokens: number;
    after_tokens: number;
    summary_text?: string;
  }> {
    const keepRecent = Math.max(1, Number(options?.keepRecent || 10));
    const force = Boolean(options?.force || false);
    const hasAccess = await this.ensureSessionAccess(sessionId, context);
    if (!hasAccess) {
      const err = new Error('session not accessible');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    if (!force) {
      const decision = await this.shouldCompact(sessionId, context);
      if (!decision.should_compact) {
        const usage = await this.estimateTokenCount(sessionId, context);
        return {
          compacted: false,
          reason: 'below_threshold',
          before_tokens: usage.estimated_tokens,
          after_tokens: usage.estimated_tokens,
        };
      }
    }

    const boundary = await this.getContextBoundaryTimestamp(sessionId);
    const history = boundary
      ? await this.pool.query(
          `SELECT role, text
           FROM messages
           WHERE chat_id = $1 AND created_at > $2
           ORDER BY created_at ASC`,
          [sessionId, boundary],
        )
      : await this.pool.query(
          `SELECT role, text
           FROM messages
           WHERE chat_id = $1
           ORDER BY created_at ASC`,
          [sessionId],
        );

    const rows = history.rows.filter((r) => r.role === 'user' || r.role === 'assistant');
    const beforeTokens = estimateRowsTokens(rows);
    if (rows.length <= keepRecent) {
      return {
        compacted: false,
        reason: 'not_enough_messages',
        before_tokens: beforeTokens,
        after_tokens: beforeTokens,
      };
    }

    const older = rows.slice(0, Math.max(0, rows.length - keepRecent));
    const recent = rows.slice(Math.max(0, rows.length - keepRecent));
    const summaryText = await this.composeCompactionSummary(sessionId, older);

    await this.pool.query(
      `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
       VALUES ($1, $2, 'system', 'text', $3, NOW())`,
      [uuidv7(), sessionId, summaryText],
    );

    const afterTokens = estimateRowsTokens(recent) + estimateTextTokens(summaryText);
    await this.pool.query(
      `INSERT INTO compaction_events (id, session_id, before_tokens, after_tokens, summary_text, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv7(), sessionId, beforeTokens, afterTokens, summaryText],
    );

    return {
      compacted: true,
      before_tokens: beforeTokens,
      after_tokens: afterTokens,
      summary_text: summaryText,
    };
  }

  async estimateTokenCount(sessionId: string, context: SessionAccessContext): Promise<{
    message_count: number;
    estimated_tokens: number;
    model_context_window: number;
    tracked_input_tokens: number;
    tracked_output_tokens: number;
    tracked_total_tokens: number;
  }> {
    const hasAccess = await this.ensureSessionAccess(sessionId, context);
    if (!hasAccess) {
      const err = new Error('session not accessible');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
    const boundary = await this.getContextBoundaryTimestamp(sessionId);
    const usage = boundary
      ? await this.pool.query(
          `SELECT COUNT(*)::int AS message_count, COALESCE(SUM(LENGTH(COALESCE(text, ''))), 0)::int AS chars
           FROM messages
           WHERE chat_id = $1 AND created_at > $2`,
          [sessionId, boundary],
        )
      : await this.pool.query(
          `SELECT COUNT(*)::int AS message_count, COALESCE(SUM(LENGTH(COALESCE(text, ''))), 0)::int AS chars
           FROM messages
           WHERE chat_id = $1`,
          [sessionId],
        );

    const modelNameRes = await this.pool.query(
      `SELECT model_name FROM session_settings WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    const budget = await this.getContextBudget(modelNameRes.rows[0]?.model_name || null);
    let trackedInput = 0;
    let trackedOutput = 0;
    try {
      const tracked = await this.pool.query(
        `SELECT
           COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
           COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
         FROM session_token_usage
         WHERE session_id = $1`,
        [sessionId],
      );
      trackedInput = Number(tracked.rows[0]?.input_tokens || 0);
      trackedOutput = Number(tracked.rows[0]?.output_tokens || 0);
    } catch {
      // session_token_usage may not exist before migration rollout.
    }

    return {
      message_count: Number(usage.rows[0]?.message_count || 0),
      estimated_tokens: Math.max(1, Math.ceil(Number(usage.rows[0]?.chars || 0) / 4)),
      model_context_window: budget.context_window,
      tracked_input_tokens: trackedInput,
      tracked_output_tokens: trackedOutput,
      tracked_total_tokens: trackedInput + trackedOutput,
    };
  }

  async getContextBudget(modelId?: string | null): Promise<{ model_id: string | null; context_window: number }> {
    const sessionModel = modelId ? String(modelId) : null;
    if (sessionModel) {
      const model = await this.findModelRegistryEntry(sessionModel);
      if (model?.parameters?.context_window) {
        return { model_id: sessionModel, context_window: Number(model.parameters.context_window) };
      }
    }

    const settingRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'chat.model_context_window' LIMIT 1`,
    );
    const settingValue = settingRes.rows[0] ? Number(parseSetting(settingRes.rows[0].value) || 0) : 0;
    return {
      model_id: sessionModel,
      context_window: settingValue > 0 ? settingValue : 0,
    };
  }

  async shouldCompact(sessionId: string, context: SessionAccessContext): Promise<{
    should_compact: boolean;
    threshold_pct: number;
    threshold_tokens: number | null;
    warning_tokens: number | null;
    approaching_limit: boolean;
    estimated_tokens: number;
    model_context_window: number;
    auto_compact_enabled: boolean;
  }> {
    const usage = await this.estimateTokenCount(sessionId, context);
    const thresholdPct = await this.resolveCompactionThresholdPct(usage.model_context_window);
    const autoCompactEnabled = await this.getBooleanSettingWithAliases(
      ['chat.compaction.auto', 'chat.compaction.safeguard'],
      false,
    );

    const thresholdTokens = usage.model_context_window > 0
      ? Math.floor((thresholdPct / 100) * usage.model_context_window)
      : null;
    const warningTokens = usage.model_context_window > 0
      ? Math.floor(0.8 * usage.model_context_window)
      : null;

    return {
      should_compact: thresholdTokens !== null ? usage.estimated_tokens >= thresholdTokens : false,
      threshold_pct: thresholdPct,
      threshold_tokens: thresholdTokens,
      warning_tokens: warningTokens,
      approaching_limit: warningTokens !== null ? usage.estimated_tokens >= warningTokens : false,
      estimated_tokens: usage.estimated_tokens,
      model_context_window: usage.model_context_window,
      auto_compact_enabled: autoCompactEnabled,
    };
  }

  async getCompactionHistory(sessionId: string, context: SessionAccessContext): Promise<any[]> {
    const hasAccess = await this.ensureSessionAccess(sessionId, context);
    if (!hasAccess) {
      const err = new Error('session not accessible');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
    const res = await this.pool.query(
      `SELECT id, session_id, before_tokens, after_tokens, summary_text, created_at
       FROM compaction_events
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [sessionId],
    );
    return res.rows;
  }

  async getSessionCostEstimateUsd(sessionId: string, context: SessionAccessContext): Promise<number | null> {
    const hasAccess = await this.ensureSessionAccess(sessionId, context);
    if (!hasAccess) {
      const err = new Error('session not accessible');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
    const modelRes = await this.pool.query(
      `SELECT model_name FROM session_settings WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    const modelName = modelRes.rows[0]?.model_name;
    if (!modelName) return null;

    const model = await this.findModelRegistryEntry(modelName);
    const costPer1k = Number(model?.cost_per_1k_tokens || 0);
    if (!(costPer1k > 0)) return null;

    const usageRes = await this.pool.query(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0)::bigint AS total_tokens
       FROM session_token_usage
       WHERE session_id = $1`,
      [sessionId],
    );
    const totalTokens = Number(usageRes.rows[0]?.total_tokens || 0);
    return (totalTokens / 1000) * costPer1k;
  }

  private async getContextBoundaryTimestamp(sessionId: string): Promise<Date | null> {
    const res = await this.pool.query(
      `SELECT created_at
       FROM messages
       WHERE chat_id = $1
         AND role = 'system'
         AND (text = $2 OR text LIKE $3)
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId, SESSION_RESET_MARKER, `${COMPACTION_SUMMARY_PREFIX}%`],
    );
    return res.rows[0]?.created_at || null;
  }

  private async composeCompactionSummary(
    sessionId: string,
    olderRows: Array<{ role?: string; text?: string }>,
  ): Promise<string> {
    const conversation = olderRows
      .slice(-20)
      .map((r) => `- ${r.role}: ${String(r.text || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`)
      .join('\n');

    const memoryRes = await this.pool.query(
      `SELECT key, value
       FROM memories
       WHERE chat_id = $1 OR visibility = 'global'
       ORDER BY updated_at DESC
       LIMIT 40`,
      [sessionId],
    );
    const pinnedFacts = memoryRes.rows
      .filter((r) => /pinned|profile|preference/i.test(String(r.key || '')))
      .slice(0, 10)
      .map((r) => `- ${String(r.key)}: ${String(r.value || '').replace(/\s+/g, ' ').trim().slice(0, 200)}`)
      .join('\n');

    const toolRes = await this.pool.query(
      `SELECT tool_name, outputs, created_at
       FROM tool_runs
       WHERE chat_id = $1
         AND status = 'success'
       ORDER BY created_at DESC
       LIMIT 5`,
      [sessionId],
    );
    const recentTools = toolRes.rows
      .map((r) => {
        const output = r.outputs ? JSON.stringify(r.outputs) : '';
        const trimmed = output.replace(/\s+/g, ' ').slice(0, 220);
        return `- ${String(r.tool_name)}: ${trimmed || '(no output)'}`;
      })
      .join('\n');

    return [
      COMPACTION_SUMMARY_PREFIX,
      'conversation_summary:',
      conversation || '- (no summary content)',
      '',
      'preserved_facts:',
      pinnedFacts || '- (no pinned/profile facts found)',
      '',
      'recent_tool_results:',
      recentTools || '- (no recent successful tool runs)',
    ].join('\n');
  }

  private async findModelRegistryEntry(modelName: string): Promise<any | null> {
    try {
      const res = await this.pool.query(
        `SELECT cost_per_1k_tokens, parameters
         FROM model_registry
         WHERE id = $1 OR model_identifier = $1
         LIMIT 1`,
        [modelName],
      );
      return res.rows[0] || null;
    } catch {
      // Pre-governance schema fallback.
    }
    try {
      const res = await this.pool.query(
        `SELECT cost_per_1k_tokens, parameters
         FROM model_registry
         WHERE id = $1 OR model_id = $1
         LIMIT 1`,
        [modelName],
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  private async getSettingValueByAliases(keys: string[]): Promise<unknown | null> {
    for (const key of keys) {
      const res = await this.pool.query(
        `SELECT value
         FROM settings_global
         WHERE key = $1
         LIMIT 1`,
        [key],
      );
      if (res.rows.length === 0) continue;
      return parseSetting(res.rows[0].value);
    }
    return null;
  }

  private async getBooleanSettingWithAliases(keys: string[], fallback: boolean): Promise<boolean> {
    const value = await this.getSettingValueByAliases(keys);
    if (value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
    }
    return fallback;
  }

  private async getNumberSettingWithAliases(keys: string[], fallback: number): Promise<number> {
    const value = await this.getSettingValueByAliases(keys);
    if (value === null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private async resolveCompactionThresholdPct(modelContextWindow: number): Promise<number> {
    const thresholdPct = await this.getNumberSettingWithAliases(
      ['chat.compaction.threshold_pct', 'chat.compaction.memoryFlush.softThresholdPct'],
      80,
    );
    if (Number.isFinite(thresholdPct) && thresholdPct > 0) return thresholdPct;

    const softThresholdTokens = await this.getNumberSettingWithAliases(
      ['chat.compaction.memoryFlush.softThresholdTokens'],
      0,
    );
    if (modelContextWindow > 0 && Number.isFinite(softThresholdTokens) && softThresholdTokens > 0) {
      return Math.max(1, Math.min(100, (softThresholdTokens / modelContextWindow) * 100));
    }
    return 80;
  }
}

function estimateRowsTokens(rows: Array<{ text?: string }>): number {
  return rows.reduce((sum, r) => sum + estimateTextTokens(String(r.text || '')), 0);
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function parseSetting(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
