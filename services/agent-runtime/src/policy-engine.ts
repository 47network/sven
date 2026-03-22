import pg from 'pg';
import { createLogger } from '@sven/shared';
import { parseSettingValue } from './settings-utils.js';
import type { PolicyDecision } from '@sven/shared';

const logger = createLogger('policy-engine');

interface PolicyEvalRequest {
  scope: string;
  user_id: string;
  chat_id: string;
  tool_name: string;
  inputs: Record<string, unknown>;
  provider_name?: string;
  model_name?: string;
}

interface AllowlistEntry {
  type: string;
  pattern: string;
  danger_tier: number | null;
  enabled: boolean;
}

interface ToolBindingRule {
  allow?: string[];
  deny?: string[];
}

interface ToolBindingConfig {
  providers?: Record<string, ToolBindingRule>;
  models?: Record<string, ToolBindingRule>;
}

function normalizeNasPathForMatch(pathValue: string): string {
  const normalized = pathValue
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .trim();
  if (!normalized) return '';
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function isPathWithinPrefix(pathValue: string, prefixValue: string): boolean {
  const path = normalizeNasPathForMatch(pathValue);
  const prefix = normalizeNasPathForMatch(prefixValue);
  if (!path || !prefix) return false;
  return path === prefix || path.startsWith(`${prefix}/`);
}

function normalizeLegacyWebDomains(value: unknown): string[] {
  const parsed = parseSettingValue<unknown>(value);
  if (Array.isArray(parsed)) {
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

/**
 * Deny-by-default policy engine.
 * Scopes evaluation: explicit allow required, any deny overrides.
 * HA entity/service allowlist with danger tiers (1=safe, 2=approval, 3=quorum+short expiry).
 * Git repo allowlist.
 */
export class PolicyEngine {
  constructor(private pool: pg.Pool) {}

  private async getOrganizationIdForChat(chatId: string): Promise<string | null> {
    const id = String(chatId || '').trim();
    if (!id) return null;
    const res = await this.pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [id]);
    const orgId = String(res.rows[0]?.organization_id || '').trim();
    return orgId || null;
  }

  async evaluateToolCall(params: {
    scope?: string;
    tool_name: string;
    user_id: string;
    chat_id: string;
    inputs: Record<string, unknown>;
    provider_name?: string;
    model_name?: string;
  }): Promise<PolicyDecision> {
    const scopesFromTool = await this.getToolScopes(params.tool_name);
    const providedScope = typeof params.scope === 'string' ? params.scope.trim() : '';
    if (providedScope && scopesFromTool.length > 0 && !scopesFromTool.includes(providedScope)) {
      return {
        allowed: false,
        scope: providedScope,
        reason: `Provided scope "${providedScope}" is not allowed for tool "${params.tool_name}"`,
        matching_rules: [],
        requires_approval: false,
      };
    }
    const uniqueScopes = Array.from(
      new Set(scopesFromTool.filter((s) => s && s.length > 0)),
    );
    if (uniqueScopes.length === 0) {
      uniqueScopes.push(`tool.${params.tool_name}`);
    }

    const denyReasons: string[] = [];
    const approvalReasons: string[] = [];
    let approvalQuorum = 1;
    let approvalExpiry: number | undefined;
    let approvalScope = uniqueScopes[0];
    const matchingRules: any[] = [];

    for (const scope of uniqueScopes) {
      const decision = await this.evaluate({
        scope,
        user_id: params.user_id,
        chat_id: params.chat_id,
        tool_name: params.tool_name,
        inputs: params.inputs,
        provider_name: params.provider_name,
        model_name: params.model_name,
      });

      if (decision.matching_rules?.length) {
        matchingRules.push(...decision.matching_rules);
      }

      if (!decision.allowed) {
        if (!decision.requires_approval) {
          denyReasons.push(`[${scope}] ${decision.reason}`);
        } else {
          approvalReasons.push(`[${scope}] ${decision.reason}`);
          const quorum = decision.approval_quorum || 1;
          if (quorum > approvalQuorum) {
            approvalQuorum = quorum;
            approvalScope = scope;
          }
          if (decision.approval_expires_in_ms) {
            approvalExpiry = approvalExpiry
              ? Math.min(approvalExpiry, decision.approval_expires_in_ms)
              : decision.approval_expires_in_ms;
            approvalScope = scope;
          }
        }
      }
    }

    if (denyReasons.length > 0) {
      return {
        allowed: false,
        scope: uniqueScopes[0],
        reason: denyReasons.join(' | '),
        matching_rules: matchingRules,
        requires_approval: false,
      };
    }

    if (approvalReasons.length > 0) {
      return {
        allowed: false,
        scope: approvalScope,
        reason: approvalReasons.join(' | '),
        matching_rules: matchingRules,
        requires_approval: true,
        approval_quorum: approvalQuorum,
        approval_expires_in_ms: approvalExpiry,
      };
    }

    return {
      allowed: true,
      scope: uniqueScopes[0],
      reason: 'Allowed by policy',
      matching_rules: matchingRules,
      requires_approval: false,
    };
  }

  async evaluate(req: PolicyEvalRequest): Promise<PolicyDecision> {
    // Check kill switch first
    const incidentRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'incident.mode'`,
    );
    const incidentMode = incidentRes.rows[0]
      ? String(parseSettingValue(incidentRes.rows[0].value))
      : 'normal';

    if (incidentMode === 'kill_switch') {
      if (req.scope.includes('write') || req.scope.includes('delete')) {
        return {
          allowed: false,
          scope: req.scope,
          reason: 'Kill switch active – all write operations blocked',
          matching_rules: [],
          requires_approval: false,
        };
      }
    }

    // Lockdown mode: block all non-read scopes
    if (incidentMode === 'lockdown') {
      if (!req.scope.endsWith('.read') && !req.scope.endsWith('.list')) {
        return {
          allowed: false,
          scope: req.scope,
          reason: 'Lockdown mode active – only read/list operations permitted',
          matching_rules: [],
          requires_approval: false,
        };
      }
    }

    const orgId = await this.getOrganizationIdForChat(req.chat_id);
    if (!orgId) {
      return {
        allowed: false,
        scope: req.scope,
        reason: 'No organization context resolved for chat',
        matching_rules: [],
        requires_approval: false,
      };
    }

    // Load all relevant permissions (deny-by-default)
    const permsRes = await this.pool.query(
      `SELECT id, scope, effect, target_type, target_id, conditions
       FROM permissions
       WHERE organization_id = $1
         AND scope = $2
         AND (
           (target_type = 'global')
           OR (target_type = 'user' AND target_id = $3)
           OR (target_type = 'chat' AND target_id = $4)
         )
       ORDER BY
         CASE effect WHEN 'deny' THEN 0 ELSE 1 END,
         CASE target_type WHEN 'user' THEN 0 WHEN 'chat' THEN 1 ELSE 2 END`,
      [orgId, req.scope, req.user_id, req.chat_id],
    );

    const matchingRules = permsRes.rows.map((r: any) => ({
      id: r.id,
      effect: r.effect,
      source: `${r.target_type}:${r.target_id || 'global'}`,
    }));

    // Any deny → denied
    const hasDeny = permsRes.rows.some((r: any) => r.effect === 'deny');
    if (hasDeny) {
      return {
        allowed: false,
        scope: req.scope,
        reason: 'Explicit deny rule matched',
        matching_rules: matchingRules,
        requires_approval: false,
      };
    }

    // Must have explicit allow
    const hasAllow = permsRes.rows.some((r: any) => r.effect === 'allow');
    if (!hasAllow) {
      return {
        allowed: false,
        scope: req.scope,
        reason: 'No explicit allow rule found (deny-by-default)',
        matching_rules: matchingRules,
        requires_approval: false,
      };
    }

    // Validate allowlists (NAS, web, HA, git)
    const allowlistCheck = await this.checkAllowlists(req);
    if (!allowlistCheck.allowed) {
      if (allowlistCheck.requires_approval) {
        return {
          allowed: false,
          scope: req.scope,
          reason: allowlistCheck.reason,
          matching_rules: matchingRules,
          requires_approval: true,
          approval_quorum: allowlistCheck.approval_quorum || 1,
          approval_expires_in_ms: allowlistCheck.approval_expires_in_ms,
        };
      }
      return {
        allowed: false,
        scope: req.scope,
        reason: allowlistCheck.reason,
        matching_rules: matchingRules,
        requires_approval: false,
      };
    }

    const providerBindingCheck = await this.checkProviderModelBindings(req);
    if (!providerBindingCheck.allowed) {
      return {
        allowed: false,
        scope: req.scope,
        reason: providerBindingCheck.reason,
        matching_rules: matchingRules,
        requires_approval: false,
      };
    }

    // Check if scope requires approval via permission conditions (guarded scopes)
    const guardedScopes = ['ha.write', 'nas.write', 'git.write', 'calendar.write'];
    const isGuarded = guardedScopes.some((gs) => req.scope.startsWith(gs));

    if (isGuarded) {
      const allowRule = permsRes.rows.find((r: any) => r.effect === 'allow');
      const conditions = allowRule?.conditions;

      if (conditions?.requires_approval) {
        return {
          allowed: false,
          scope: req.scope,
          reason: 'Guarded scope requires approval',
          matching_rules: matchingRules,
          requires_approval: true,
          approval_quorum: conditions.quorum || 1,
        };
      }
    }

    return {
      allowed: true,
      scope: req.scope,
      reason: 'Allowed by policy',
      matching_rules: matchingRules,
      requires_approval: false,
    };
  }

  /**
   * Load allowlist entries of a given type from the DB.
   */
  private async loadAllowlist(type: string, chatId: string): Promise<AllowlistEntry[]> {
    const orgId = await this.getOrganizationIdForChat(chatId);
    const res = await this.pool.query(
      `SELECT type, pattern, danger_tier, enabled
       FROM allowlists
       WHERE (organization_id = $2 OR organization_id IS NULL)
         AND type = $1
         AND enabled = TRUE`,
      [type, orgId],
    );
    return res.rows;
  }

  private async getToolScopes(toolName: string): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT permissions_required FROM tools WHERE name = $1`,
      [toolName],
    );
    if (res.rows.length === 0) return [];
    const permissions = res.rows[0].permissions_required as string[] | null;
    return Array.isArray(permissions) ? permissions : [];
  }

  private normalizeBindingConfig(raw: unknown): ToolBindingConfig {
    const parsed = parseSettingValue<ToolBindingConfig | Record<string, unknown>>(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const root = parsed as Record<string, unknown>;
    const normalizeRuleMap = (value: unknown): Record<string, ToolBindingRule> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      const out: Record<string, ToolBindingRule> = {};
      for (const [key, ruleRaw] of Object.entries(value)) {
        if (!key || !ruleRaw || typeof ruleRaw !== 'object' || Array.isArray(ruleRaw)) continue;
        const rule = ruleRaw as Record<string, unknown>;
        const allow = Array.isArray(rule.allow)
          ? rule.allow.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [];
        const deny = Array.isArray(rule.deny)
          ? rule.deny.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [];
        if (allow.length === 0 && deny.length === 0) continue;
        out[String(key).trim().toLowerCase()] = { ...(allow.length > 0 ? { allow } : {}), ...(deny.length > 0 ? { deny } : {}) };
      }
      return out;
    };
    return {
      providers: normalizeRuleMap(root.providers),
      models: normalizeRuleMap(root.models),
    };
  }

  private matchesToolBinding(toolName: string, patterns: string[]): boolean {
    const name = String(toolName || '').trim().toLowerCase();
    if (!name) return false;
    return patterns.some((patternRaw) => {
      const pattern = String(patternRaw || '').trim().toLowerCase();
      if (!pattern) return false;
      if (pattern === '*') return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return name === prefix || name.startsWith(`${prefix}.`);
      }
      return name === pattern;
    });
  }

  private matchesModelBindingKey(
    ruleKeyRaw: string,
    provider: string,
    model: string,
  ): boolean {
    const ruleKey = String(ruleKeyRaw || '').trim().toLowerCase();
    if (!ruleKey) return false;
    const modelLower = model.trim().toLowerCase();
    const providerModel = provider && modelLower ? `${provider}/${modelLower}` : '';

    const wildcardToRegex = (pattern: string): RegExp => {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 'i');
    };

    const regex = wildcardToRegex(ruleKey);
    if (regex.test(modelLower)) return true;
    if (providerModel && regex.test(providerModel)) return true;
    return false;
  }

  private collectMatchingModelRules(
    config: ToolBindingConfig,
    provider: string,
    model: string,
  ): Array<{ key: string; rule: ToolBindingRule }> {
    const out: Array<{ key: string; rule: ToolBindingRule }> = [];
    if (!config.models) return out;
    for (const [key, rule] of Object.entries(config.models)) {
      if (!rule) continue;
      if (this.matchesModelBindingKey(key, provider, model)) {
        out.push({ key, rule });
      }
    }
    return out;
  }

  private async loadToolBindingConfig(chatId: string): Promise<ToolBindingConfig> {
    const orgId = await this.getOrganizationIdForChat(chatId);
    if (orgId) {
      const orgRes = await this.pool.query(
        `SELECT value FROM organization_settings
         WHERE organization_id = $1 AND key = 'tool_policy.by_provider'
         LIMIT 1`,
        [orgId],
      );
      if (orgRes.rows.length > 0) return this.normalizeBindingConfig(orgRes.rows[0].value);
    }
    const globalRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'tool_policy.by_provider' LIMIT 1`,
    );
    return globalRes.rows.length > 0 ? this.normalizeBindingConfig(globalRes.rows[0].value) : {};
  }

  private async checkProviderModelBindings(
    req: PolicyEvalRequest,
  ): Promise<{ allowed: boolean; reason: string }> {
    const provider = String(req.provider_name || '').trim().toLowerCase();
    const model = String(req.model_name || '').trim();
    if (!provider && !model) {
      return { allowed: true, reason: '' };
    }

    const config = await this.loadToolBindingConfig(req.chat_id);
    const providerRule = provider && config.providers ? config.providers[provider] : undefined;
    const matchedModelRules = this.collectMatchingModelRules(config, provider, model);
    const matchedRules = [
      ...(providerRule ? [{ key: `provider:${provider}`, rule: providerRule }] : []),
      ...matchedModelRules,
    ];
    if (matchedRules.length === 0) {
      return { allowed: true, reason: '' };
    }

    const denyHits = matchedRules.filter(
      ({ rule }) => Array.isArray(rule.deny) && this.matchesToolBinding(req.tool_name, rule.deny as string[]),
    );
    if (denyHits.length > 0) {
      const bindingRefs = denyHits.map((hit) => hit.key).join(', ');
      return { allowed: false, reason: `Tool ${req.tool_name} denied by tool binding rules (${bindingRefs})` };
    }

    const allowRules = matchedRules.filter(({ rule }) => Array.isArray(rule.allow) && (rule.allow as string[]).length > 0);
    if (allowRules.length > 0) {
      const allowedByAtLeastOneRule = allowRules.some(({ rule }) =>
        this.matchesToolBinding(req.tool_name, (rule.allow as string[])),
      );
      if (!allowedByAtLeastOneRule) {
        const bindingRefs = allowRules.map((hit) => hit.key).join(', ');
        return {
          allowed: false,
          reason: `Tool ${req.tool_name} not allowlisted by active tool binding rules (${bindingRefs})`,
        };
      }
    }

    return { allowed: true, reason: '' };
  }

  private async checkAllowlists(
    req: PolicyEvalRequest,
  ): Promise<{
    allowed: boolean;
    reason: string;
    requires_approval?: boolean;
    approval_quorum?: number;
    approval_expires_in_ms?: number;
  }> {
    const scope = req.scope;
    const hasInput = (key: string): boolean =>
      Object.prototype.hasOwnProperty.call(req.inputs, key);

    // ── NAS path allowlist ──
    if (scope.startsWith('nas.')) {
      if (hasInput('path') && typeof req.inputs.path !== 'string') {
        return { allowed: false, reason: 'Invalid nas.path input type; expected string' };
      }
      const path = req.inputs.path as string;
      if (path) {
        // Default safe paths + DB allowlist entries
        const defaultPrefixes = ['/nas/shared', `/nas/users/${req.user_id}`];
        const dbEntries = await this.loadAllowlist('nas_path', req.chat_id);
        const allPrefixes = [
          ...defaultPrefixes,
          ...dbEntries.map((e) => e.pattern),
        ];
        const isAllowed = allPrefixes.some((p) => isPathWithinPrefix(path, p));
        if (!isAllowed) {
          return { allowed: false, reason: `Path ${path} not in NAS allowlist` };
        }
      }
    }

    // ── Web domain allowlist ──
    if (scope.startsWith('web.')) {
      if (hasInput('url') && typeof req.inputs.url !== 'string') {
        return { allowed: false, reason: 'Invalid web.url input type; expected string' };
      }
      const url = req.inputs.url as string;
      if (url) {
        const dbEntries = await this.loadAllowlist('web_domain', req.chat_id);
        // Also check legacy settings_global key
        const orgId = await this.getOrganizationIdForChat(req.chat_id);
        let legacyDomains: string[] = [];
        if (orgId) {
          const orgRes = await this.pool.query(
            `SELECT value FROM organization_settings
             WHERE organization_id = $1 AND key = 'allowlist.web_domains'
             LIMIT 1`,
            [orgId],
          );
          if (orgRes.rows.length > 0) {
            legacyDomains = normalizeLegacyWebDomains(orgRes.rows[0].value);
          } else {
            const globalRes = await this.pool.query(
              `SELECT value FROM settings_global WHERE key = 'allowlist.web_domains' LIMIT 1`,
            );
            legacyDomains = globalRes.rows[0]
              ? normalizeLegacyWebDomains(globalRes.rows[0].value)
              : [];
          }
        }
        const allDomains = [
          ...legacyDomains,
          ...dbEntries.map((e) => e.pattern),
        ];
        if (allDomains.length > 0) {
          let hostname = '';
          try {
            hostname = new URL(url).hostname;
          } catch {
            return { allowed: false, reason: `Invalid URL for web allowlist: ${url}` };
          }
          const isAllowed = allDomains.some(
            (d) => hostname === d || hostname.endsWith(`.${d}`),
          );
          if (!isAllowed) {
            return { allowed: false, reason: `Domain ${hostname} not in web allowlist` };
          }
        }
      }
    }

    // ── HA entity/service allowlist with danger tiers ──
    if (scope.startsWith('ha.')) {
      if (hasInput('entity_id') && typeof req.inputs.entity_id !== 'string') {
        return { allowed: false, reason: 'Invalid ha.entity_id input type; expected string' };
      }
      if (hasInput('data') && (typeof req.inputs.data !== 'object' || req.inputs.data === null || Array.isArray(req.inputs.data))) {
        return { allowed: false, reason: 'Invalid ha.data input type; expected object' };
      }
      if (
        hasInput('data')
        && req.inputs.data
        && typeof req.inputs.data === 'object'
        && Object.prototype.hasOwnProperty.call(req.inputs.data, 'entity_id')
        && typeof (req.inputs.data as Record<string, unknown>).entity_id !== 'string'
      ) {
        return { allowed: false, reason: 'Invalid ha.data.entity_id input type; expected string' };
      }
      if (hasInput('service') && typeof req.inputs.service !== 'string') {
        return { allowed: false, reason: 'Invalid ha.service input type; expected string' };
      }
      const rootEntityId =
        typeof req.inputs.entity_id === 'string' ? req.inputs.entity_id.trim() : '';
      const nestedEntityId =
        req.inputs.data && typeof req.inputs.data === 'object' && typeof (req.inputs.data as Record<string, unknown>).entity_id === 'string'
          ? String((req.inputs.data as Record<string, unknown>).entity_id).trim()
          : '';
      if (rootEntityId && nestedEntityId && rootEntityId !== nestedEntityId) {
        return { allowed: false, reason: 'Conflicting HA entity identifiers provided' };
      }
      const entityId = rootEntityId || nestedEntityId;
      const service = req.inputs.service as string;

      if (entityId) {
        const entries = await this.loadAllowlist('ha_entity', req.chat_id);
        const match = entries.find(
          (e) => e.pattern === entityId || entityId.startsWith(e.pattern + '.'),
        );
        if (!match) {
          return { allowed: false, reason: `HA entity ${entityId} not in allowlist` };
        }
        // Danger tier enforcement for write scopes
        if (scope.includes('write') || scope.includes('delete')) {
          const tier = match.danger_tier ?? 1;
          if (tier === 2) {
            // Tier 2: requires single-admin approval
            return {
              allowed: false,
              reason: `HA entity ${entityId} is danger tier 2 – requires approval`,
              requires_approval: true,
              approval_quorum: 1,
            };
          }
          if (tier === 3) {
            // Tier 3: requires quorum=2, short expiry handled by approval manager
            return {
              allowed: false,
              reason: `HA entity ${entityId} is danger tier 3 – requires quorum approval`,
              requires_approval: true,
              approval_quorum: 2,
              approval_expires_in_ms: 10 * 60 * 1000,
            };
          }
          // Tier 1: safe, proceed
        }
      }

      if (service) {
        const entries = await this.loadAllowlist('ha_service', req.chat_id);
        const match = entries.find(
          (e) => e.pattern === service || service.startsWith(e.pattern + '.'),
        );
        if (!match) {
          return { allowed: false, reason: `HA service ${service} not in allowlist` };
        }
        if (scope.includes('write') || scope.includes('delete')) {
          const tier = match.danger_tier ?? 1;
          if (tier === 2) {
            return {
              allowed: false,
              reason: `HA service ${service} is danger tier 2 – requires approval`,
              requires_approval: true,
              approval_quorum: 1,
            };
          }
          if (tier === 3) {
            return {
              allowed: false,
              reason: `HA service ${service} is danger tier 3 – requires quorum approval`,
              requires_approval: true,
              approval_quorum: 2,
              approval_expires_in_ms: 10 * 60 * 1000,
            };
          }
        }
      }
    }

    // ── Git repo allowlist ──
    if (scope.startsWith('git.')) {
      const hasRepo = hasInput('repo');
      const hasRepository = hasInput('repository');
      const hasRepoId = hasInput('repo_id');
      if (hasRepo && typeof req.inputs.repo !== 'string') {
        return { allowed: false, reason: 'Invalid git.repo input type; expected string' };
      }
      if (!hasRepo && hasRepository && typeof req.inputs.repository !== 'string') {
        return { allowed: false, reason: 'Invalid git.repository input type; expected string' };
      }
      if (hasRepoId && typeof req.inputs.repo_id !== 'string') {
        return { allowed: false, reason: 'Invalid git.repo_id input type; expected string' };
      }

      let repo = (req.inputs.repo as string ?? req.inputs.repository as string ?? '').trim();
      let repoCandidates: string[] = [];

      if (repo) {
        repoCandidates = [repo];
      } else if (hasRepoId) {
        const repoId = String(req.inputs.repo_id || '').trim();
        if (!repoId) {
          return { allowed: false, reason: 'Repository id is required for git allowlist check' };
        }
        const repoRes = await this.pool.query(
          `SELECT repo_url, repo_owner, repo_name
             FROM git_repos
            WHERE id = $1
              AND user_id = $2
            LIMIT 1`,
          [repoId, req.user_id],
        );
        if (repoRes.rows.length === 0) {
          return { allowed: false, reason: `Repository ${repoId} not found` };
        }
        const row = repoRes.rows[0];
        const owner = String(row.repo_owner || '').trim();
        const name = String(row.repo_name || '').trim();
        const ownerName = owner && name ? `${owner}/${name}` : '';
        const repoUrl = String(row.repo_url || '').trim();
        repoCandidates = [repoUrl, ownerName, name].filter((entry) => entry.length > 0);
        repo = ownerName || repoUrl || name || repoId;
      }

      if (repoCandidates.length > 0) {
        const entries = await this.loadAllowlist('git_repo', req.chat_id);
        if (entries.length > 0) {
          const normalizedRepos = repoCandidates.map((entry) => entry.replace(/\.git$/, '').toLowerCase());
          const isAllowed = entries.some((e) => {
            const normalizedPattern = e.pattern.replace(/\.git$/, '').toLowerCase();
            return normalizedRepos.some((normalizedRepo) =>
              normalizedRepo === normalizedPattern
              || normalizedRepo.startsWith(normalizedPattern + '/'),
            );
          });
          if (!isAllowed) {
            return { allowed: false, reason: `Repository ${repo} not in git allowlist` };
          }
        }
        // If no allowlist entries, git is open (admin hasn't restricted yet)
      }
    }

    return { allowed: true, reason: '' };
  }

  /**
   * Policy simulator: same logic, returns the decision object for inspection.
   */
  async simulate(req: PolicyEvalRequest): Promise<PolicyDecision> {
    return this.evaluate(req);
  }
}
