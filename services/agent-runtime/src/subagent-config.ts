import type pg from 'pg';

export type ResolvedAgentConfig = {
  system_prompt?: string;
  model_name?: string;
  profile_name?: string;
  policy_scope?: string[]; // undefined => no restriction configured, [] => explicit deny-all
  resolution_error?: string;
};

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function parseRoutingRules(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function mergePolicyScopes(parent: string[], child: string[]): string[] {
  if (parent.length === 0) return child;
  if (child.length === 0) return parent;
  const parentSet = new Set(parent);
  return child.filter((scope) => parentSet.has(scope));
}

export async function resolveSubagentConfig(
  pool: pg.Pool,
  chatId: string,
  agentId: string,
): Promise<ResolvedAgentConfig | null> {
  if (!chatId || !agentId) return null;
  try {
    const sessionRes = await pool.query(
      `SELECT routing_rules
       FROM agent_sessions
       WHERE session_id = $1 AND agent_id = $2
       LIMIT 1`,
      [chatId, agentId],
    );
    const routingRules = parseRoutingRules(sessionRes.rows[0]?.routing_rules);
    const parentAgentId = String(routingRules.parent_agent_id || '').trim();
    const overridesRaw = routingRules.subordinate_overrides;
    const overrides = (overridesRaw && typeof overridesRaw === 'object' && !Array.isArray(overridesRaw))
      ? (overridesRaw as Record<string, unknown>)
      : {};
    const ownPolicyScope = toStringArray(routingRules.policy_scope);

    const ids = [agentId, parentAgentId].filter(Boolean);
    const cfgRes = ids.length > 0
      ? await pool.query(
        `SELECT agent_id, system_prompt, model_name, profile_name, settings
         FROM agent_configs
         WHERE agent_id = ANY($1::text[])`,
        [ids],
      )
      : { rows: [] as any[] };

    const byId = new Map(cfgRes.rows.map((row) => [String(row.agent_id), row]));
    const parentCfg = parentAgentId ? byId.get(parentAgentId) : null;
    const childCfg = byId.get(agentId) || null;
    const parentSettings = parentCfg?.settings && typeof parentCfg.settings === 'object' && !Array.isArray(parentCfg.settings)
      ? (parentCfg.settings as Record<string, unknown>)
      : {};
    const childSettings = childCfg?.settings && typeof childCfg.settings === 'object' && !Array.isArray(childCfg.settings)
      ? (childCfg.settings as Record<string, unknown>)
      : {};
    const parentPolicy = toStringArray(parentSettings.policy_scope);
    const childPolicyFromSettings = toStringArray(childSettings.policy_scope);
    const ownScope = ownPolicyScope.length > 0 ? ownPolicyScope : childPolicyFromSettings;
    const mergedScope = mergePolicyScopes(parentPolicy, ownScope);
    const hasExplicitPolicyScope = parentPolicy.length > 0 || ownScope.length > 0;

    const resolved: ResolvedAgentConfig = {
      system_prompt: String(
        overrides.system_prompt
          || childCfg?.system_prompt
          || parentCfg?.system_prompt
          || '',
      ).trim() || undefined,
      model_name: String(
        overrides.model_name
          || childCfg?.model_name
          || parentCfg?.model_name
          || '',
      ).trim() || undefined,
      profile_name: String(
        overrides.profile_name
          || childCfg?.profile_name
          || parentCfg?.profile_name
          || '',
      ).trim() || undefined,
      policy_scope: hasExplicitPolicyScope ? mergedScope : undefined,
    };

    if (
      !resolved.system_prompt
      && !resolved.model_name
      && !resolved.profile_name
      && resolved.policy_scope === undefined
    ) {
      return null;
    }
    return resolved;
  } catch (err) {
    return {
      resolution_error: String(err instanceof Error ? err.message : err || 'unknown subagent config resolution error'),
    };
  }
}

export function isScopeAllowedForSubagent(
  requestedScope: string,
  allowedScopes?: string[],
): boolean {
  if (allowedScopes === undefined) return true;
  if (allowedScopes.length === 0) return false;
  if (!requestedScope) return false;
  return allowedScopes.some((scope) => {
    if (scope.endsWith('.*')) {
      const prefix = scope.slice(0, -1);
      return requestedScope.startsWith(prefix);
    }
    return scope === requestedScope;
  });
}
