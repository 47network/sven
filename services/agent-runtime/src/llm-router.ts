import pg from 'pg';
import crypto from 'node:crypto';
import { createLogger } from '@sven/shared';
import { decryptLiteLlmVirtualKey } from '@sven/shared';
import { resolveSecretRef } from '@sven/shared';
import { CitationRef, normalizeCitations } from './citation-utils.js';
import { parseBooleanSetting, parseSettingValue } from './settings-utils.js';
import { classifyPrompt, getCapabilityForCategory, type TaskCategory, type ComplexityTier } from './prompt-classifier.js';

const logger = createLogger('llm-router');

interface CompletionRequest {
  messages: Array<{ role: string; text?: string; content_type: string }>;
  systemPrompt: string;
  user_id: string;
  chat_id: string;
  agent_id?: string;
  model_override?: string;
  profile_override?: string;
  think_level?: string;
}

interface CompletionResponse {
  text: string;
  blocks?: unknown[];
  tool_calls?: any[];
  citations?: CitationRef[];
  provider_used?: string;
  model_used: string;
  tokens_used: { prompt: number; completion: number };
}

interface ModelRecord {
  id: string;
  name: string;
  endpoint: string;
  provider: string;
  is_local: boolean;
  cost_per_1k_tokens?: number | null;
}

type ProviderKeyRotationStrategy = 'round_robin' | 'random' | 'least_recently_used';

class ProviderHttpError extends Error {
  constructor(
    public status: number,
    public retryAfterSeconds: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

class ProviderTimeoutError extends Error {
  constructor(
    public provider: string,
    public timeoutMs: number,
  ) {
    super(`Provider request timed out (${provider}, ${timeoutMs}ms)`);
    this.name = 'ProviderTimeoutError';
  }
}

class LLMConcurrencySaturationError extends Error {
  constructor(
    public maxConcurrency: number,
    public queueDepth: number,
  ) {
    super('LLM concurrency queue saturated');
    this.name = 'LLMConcurrencySaturationError';
  }
}

const DEFAULT_MAX_LLM_CONCURRENCY = 4;
const MIN_LLM_CONCURRENCY = 1;
const MAX_LLM_CONCURRENCY = 64;
const LLM_QUEUE_MULTIPLIER = 4;
const MIN_LLM_QUEUE_CAP = 8;
const DEFAULT_OLLAMA_TIMEOUT_MS = 120000;
const DEFAULT_OPENAI_TIMEOUT_MS = 45000;
const MIN_PROVIDER_TIMEOUT_MS = 100;
const MAX_PROVIDER_TIMEOUT_MS = 300000;

/**
 * LLM Router – Local-first with cloud fallback.
 * Uses performance profile: gaming | balanced | performance
 *
 * - gaming: smallest local model, lowest latency, skip cloud
 * - balanced: best available local model, cloud fallback
 * - performance: prefer largest/best model, cloud preferred if available
 */
export class LLMRouter {
  private providerKeyState = new Map<string, {
    nextIndex: number;
    lastUsedAt: Map<string, number>;
    cooldownUntil: Map<string, number>;
  }>();
  private activeLlmRequests = 0;
  private pendingLlmQueue: Array<() => void> = [];
  private backendHealthStatus = new Map<string, number>();
  private static readonly BACKEND_COOLDOWN_MS = 60_000;

  constructor(private pool: pg.Pool) {}

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    let profile: string;
    let maxConcurrency: number;
    try {
      profile = await this.getPerformanceProfile(req.profile_override);
    } catch (err) {
      logger.warn('Failed to load performance profile, using default', { err: String(err) });
      profile = 'balanced';
    }

    try {
    // Check if LLM work is paused (gaming mode may pause heavy jobs)
    const pauseRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'performance.pause_jobs'`,
    );
    const paused = pauseRes.rows[0]
      ? parseBooleanSetting(pauseRes.rows[0].value, false)
      : false;
    if (paused && profile === 'gaming') {
      // In gaming mode with pause_jobs, only allow minimal model
      logger.info('Gaming mode with pause_jobs, using minimal model');
    }

    // Check concurrency limits
    const concurrencyRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'performance.max_llm_concurrency'`,
    );
    maxConcurrency = this.normalizeMaxConcurrency(
      concurrencyRes.rows[0]
        ? Number(parseSettingValue(concurrencyRes.rows[0].value))
        : DEFAULT_MAX_LLM_CONCURRENCY,
    );

    const globalBudget = await this.getBudgetValue('budgets.daily_tokens');
    const userBudget = await this.getBudgetValue(`budgets.daily_tokens.user.${req.user_id}`);
    const today = new Date().toISOString().slice(0, 10);

    if (globalBudget !== null) {
      const totalUsage = await this.getUsageValue(`usage.${today}.total`);
      if (totalUsage >= globalBudget) {
        logger.warn('Global LLM budget exceeded', { totalUsage, globalBudget });
        return {
          text: 'LLM budget exceeded. Please try again later or adjust budgets.',
          provider_used: 'system',
          model_used: 'budget_guard',
          tokens_used: { prompt: 0, completion: 0 },
        };
      }
    }

    if (userBudget !== null) {
      const userUsage = await this.getUsageValue(`usage.${today}.user.${req.user_id}`);
      if (userUsage >= userBudget) {
        logger.warn('User LLM budget exceeded', { user_id: req.user_id, userUsage, userBudget });
        return {
          text: 'Your LLM budget is exhausted for today. Please try again later or adjust budgets.',
          provider_used: 'system',
          model_used: 'budget_guard',
          tokens_used: { prompt: 0, completion: 0 },
        };
      }
    }

    const classification = classifyPrompt(req.messages);
    const candidates = await this.selectModelCandidates(profile, req.chat_id, req.user_id, req.model_override, classification.primary, classification.complexity);

    const liteLLMConfig = await this.getLiteLLMConfig();
    if (liteLLMConfig.enabled && liteLLMConfig.useVirtualKeys) {
      const keyRow = await this.getLiteLLMVirtualKeyRow(req);
      if (keyRow?.max_daily_budget_usd) {
        const budget = Number(keyRow.max_daily_budget_usd || 0);
        if (Number.isFinite(budget) && budget > 0) {
          const orgId = await this.getUserOrgId(req.user_id);
          const ok = orgId
            ? await this.checkDailyBudget(orgId, req.user_id, req.agent_id || '', budget)
            : true;
          if (!ok) {
            logger.warn('LiteLLM virtual key budget exceeded', { user_id: req.user_id, agent_id: req.agent_id });
            return {
              text: 'LiteLLM budget exceeded. Please try again later or adjust budgets.',
              provider_used: 'system',
              model_used: 'budget_guard',
              tokens_used: { prompt: 0, completion: 0 },
            };
          }
        }
      }
    }

    logger.info('Routing LLM request (HA)', {
      task: classification.primary,
      confidence: classification.confidence.toFixed(2),
      complexity: classification.complexity,
      candidates: candidates.map(c => ({ name: c.name, endpoint: c.endpoint })),
      profile,
      max_concurrency: maxConcurrency,
    });

    try {
      return await this.withConcurrencyLimit(maxConcurrency, async () => {
        let lastErr: Error | null = null;

        for (const candidate of candidates) {
          const modelBudget = await this.getBudgetValue(`budgets.daily_tokens.${candidate.name}`);
          if (modelBudget !== null) {
            const modelUsage = await this.getUsageValue(`usage.${today}.${candidate.name}`);
            if (modelUsage >= modelBudget) {
              logger.info('Skipping budget-exhausted model', { model: candidate.name });
              continue;
            }
          }

          const resolvedEndpoint = this.resolveOllamaEndpoint(candidate.endpoint, candidate.provider);
          if (!this.isBackendAvailable(resolvedEndpoint)) {
            logger.info('Skipping unhealthy backend', { model: candidate.name, endpoint: resolvedEndpoint });
            continue;
          }

          try {
            const startedAt = Date.now();
            const response = await this.callProvider(candidate, req);
            const latencyMs = Date.now() - startedAt;
            await this.recordUsage(req.user_id, req.chat_id, candidate.name, response.tokens_used);
            await this.recordUsageCost(candidate, req, response.tokens_used, latencyMs, 'success');
            return response;
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            this.markBackendUnhealthy(resolvedEndpoint);
            logger.warn('Backend failed, trying next candidate', {
              model: candidate.name,
              endpoint: resolvedEndpoint,
              err: String(err),
              remaining: candidates.length - candidates.indexOf(candidate) - 1,
            });
            continue;
          }
        }

        throw lastErr || new Error('All LLM backends exhausted — no healthy models available');
      });
    } catch (err) {
      if (err instanceof LLMConcurrencySaturationError) {
        logger.warn('LLM concurrency queue saturated', {
          max_concurrency: err.maxConcurrency,
          queue_depth: err.queueDepth,
          active_requests: this.activeLlmRequests,
        });
        return {
          text: 'LLM is temporarily saturated. Please retry shortly.',
          provider_used: 'system',
          model_used: 'concurrency_guard',
          tokens_used: { prompt: 0, completion: 0 },
        };
      }
      throw err;
    }
    } catch (err) {
      logger.error('LLM routing failed', { err: String(err), user_id: req.user_id, chat_id: req.chat_id });
      return {
        text: 'An internal error occurred while processing your request. Please try again.',
        provider_used: 'system',
        model_used: 'error_guard',
        tokens_used: { prompt: 0, completion: 0 },
      };
    }
  }

  private normalizeMaxConcurrency(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_MAX_LLM_CONCURRENCY;
    return Math.max(MIN_LLM_CONCURRENCY, Math.min(MAX_LLM_CONCURRENCY, Math.floor(raw)));
  }

  private getQueueCapacity(maxConcurrency: number): number {
    return Math.max(MIN_LLM_QUEUE_CAP, maxConcurrency * LLM_QUEUE_MULTIPLIER);
  }

  private async withConcurrencyLimit<T>(
    maxConcurrency: number,
    task: () => Promise<T>,
  ): Promise<T> {
    const release = await this.acquireConcurrencySlot(maxConcurrency);
    try {
      return await task();
    } finally {
      release();
    }
  }

  private async acquireConcurrencySlot(maxConcurrency: number): Promise<() => void> {
    if (this.activeLlmRequests < maxConcurrency) {
      this.activeLlmRequests += 1;
      return () => this.releaseConcurrencySlot();
    }

    const queueCapacity = this.getQueueCapacity(maxConcurrency);
    if (this.pendingLlmQueue.length >= queueCapacity) {
      throw new LLMConcurrencySaturationError(maxConcurrency, this.pendingLlmQueue.length);
    }

    return await new Promise<() => void>((resolve) => {
      this.pendingLlmQueue.push(() => {
        this.activeLlmRequests += 1;
        resolve(() => this.releaseConcurrencySlot());
      });
    });
  }

  private releaseConcurrencySlot(): void {
    if (this.activeLlmRequests > 0) {
      this.activeLlmRequests -= 1;
    }
    const next = this.pendingLlmQueue.shift();
    if (next) {
      next();
    }
  }

  private async getPerformanceProfile(profileOverride?: string): Promise<string> {
    if (profileOverride && ['gaming', 'balanced', 'performance'].includes(profileOverride)) {
      return profileOverride;
    }

    // Check gaming mode first (overrides profile)
    const gamingRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'performance.gaming_mode'`,
    );
    const gamingMode = gamingRes.rows[0]
      ? parseBooleanSetting(gamingRes.rows[0].value, false)
      : false;
    if (gamingMode) return 'gaming';

    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'performance.profile'`,
    );
    return res.rows[0]
      ? String(parseSettingValue(res.rows[0].value))
      : 'balanced';
  }

  private async selectModelCandidates(
    profile: string,
    chatId: string,
    userId: string,
    modelOverride?: string,
    taskCategory?: TaskCategory,
    complexity?: ComplexityTier,
  ): Promise<ModelRecord[]> {
    const candidates: ModelRecord[] = [];
    const seenIds = new Set<string>();
    const addUnique = (record: ModelRecord) => {
      if (!seenIds.has(record.id)) {
        seenIds.add(record.id);
        candidates.push(record);
      }
    };

    if (modelOverride && modelOverride.trim().length > 0) {
      const overrideRes = await this.pool.query(
        `SELECT id, name, endpoint, provider, is_local, cost_per_1k_tokens
         FROM model_registry
         WHERE (name = $1 OR model_id = $1) AND is_active = TRUE`,
        [modelOverride.trim()],
      );
      overrideRes.rows.forEach(addUnique);
    }

    if (candidates.length === 0) {
      const policyRes = await this.pool.query(
        `SELECT mr.id, mr.name, mr.endpoint, mr.provider, mr.is_local, mr.cost_per_1k_tokens
         FROM model_policies mp
         JOIN model_registry mr ON mp.model_id = mr.id
         WHERE ((mp.scope = 'chat' AND mp.target_id = $1)
            OR (mp.scope = 'user' AND mp.target_id = $2)
            OR (mp.scope = 'global'))
           AND mr.is_active = TRUE
         ORDER BY mp.priority DESC, mp.scope ASC`,
        [chatId, userId],
      );
      policyRes.rows.forEach(addUnique);
    }

    let orderClause: string;
    let whereExtra = '';
    switch (profile) {
      case 'gaming':
        whereExtra = ` AND is_local = TRUE`;
        orderClause = `COALESCE(parameters_b, 0) ASC, name ASC`;
        break;
      case 'performance':
        orderClause = `COALESCE(parameters_b, 0) DESC, is_local ASC`;
        break;
      case 'balanced':
      default:
        orderClause = `COALESCE(parameters_b, 0) DESC, is_local DESC`;
        break;
    }

    // For complex tasks, prefer models >= 7B; for moderate, >= 3B; simple can use anything
    const minParamsB = complexity === 'complex' ? 7 : complexity === 'moderate' ? 3 : 0;
    const sizeFilter = minParamsB > 0 ? ` AND COALESCE(parameters_b, 0) >= ${minParamsB}` : '';

    const preferredCap = taskCategory ? getCapabilityForCategory(taskCategory) : null;

    if (preferredCap && preferredCap !== 'chat') {
      const specializedRes = await this.pool.query(
        `SELECT id, name, endpoint, provider, is_local, cost_per_1k_tokens
         FROM model_registry
         WHERE $1 = ANY(capabilities) AND is_active = TRUE${whereExtra}${sizeFilter}
         ORDER BY ${orderClause}`,
        [preferredCap],
      );
      specializedRes.rows.forEach(addUnique);
    }

    const allRes = await this.pool.query(
      `SELECT id, name, endpoint, provider, is_local, cost_per_1k_tokens
       FROM model_registry
       WHERE 'chat' = ANY(capabilities) AND is_active = TRUE${whereExtra}${sizeFilter}
       ORDER BY ${orderClause}`,
    );
    allRes.rows.forEach(addUnique);

    // If complexity filter yielded nothing, fall back without the size constraint
    if (candidates.length === 0 && minParamsB > 0) {
      const fallbackRes = await this.pool.query(
        `SELECT id, name, endpoint, provider, is_local, cost_per_1k_tokens
         FROM model_registry
         WHERE 'chat' = ANY(capabilities) AND is_active = TRUE${whereExtra}
         ORDER BY ${orderClause}`,
      );
      fallbackRes.rows.forEach(addUnique);
    }

    if (candidates.length === 0) {
      addUnique({
        id: 'ollama-default',
        name: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:3b',
        endpoint: process.env.OLLAMA_URL || 'http://localhost:11434',
        provider: 'ollama',
        is_local: true,
        cost_per_1k_tokens: null,
      });
    }

    return candidates;
  }

  private resolveOllamaEndpoint(registeredEndpoint: string, provider: string): string {
    if (provider !== 'ollama') return registeredEndpoint;
    if (registeredEndpoint.startsWith('http://') || registeredEndpoint.startsWith('https://')) {
      return registeredEndpoint;
    }
    return process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  private isBackendAvailable(endpoint: string): boolean {
    const unhealthyUntil = this.backendHealthStatus.get(endpoint);
    if (!unhealthyUntil) return true;
    if (Date.now() >= unhealthyUntil) {
      this.backendHealthStatus.delete(endpoint);
      return true;
    }
    return false;
  }

  private markBackendUnhealthy(endpoint: string): void {
    this.backendHealthStatus.set(endpoint, Date.now() + LLMRouter.BACKEND_COOLDOWN_MS);
    logger.warn('Backend marked unhealthy', { endpoint, cooldown_ms: LLMRouter.BACKEND_COOLDOWN_MS });
  }

  /**
   * Record token usage for budget tracking via usage_counters in settings_global.
   */
  private async recordUsage(
    userId: string,
    chatId: string,
    modelName: string,
    tokens: { prompt: number; completion: number },
  ): Promise<void> {
    try {
      const totalTokens = tokens.prompt + tokens.completion;
      if (totalTokens === 0) return;

      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const modelKey = `usage.${today}.${modelName}`;
      const totalKey = `usage.${today}.total`;
      const userKey = `usage.${today}.user.${userId}`;
      const userModelKey = `usage.${today}.user.${userId}.${modelName}`;

      // Upsert daily usage counter
      const upsertUsage = async (key: string) => {
        await this.pool.query(
          `INSERT INTO settings_global (key, value, updated_at, updated_by)
           VALUES ($1, $2::jsonb, NOW(), 'system')
           ON CONFLICT (key) DO UPDATE SET
             value = (COALESCE(settings_global.value::text, '0')::int + $3)::text::jsonb,
             updated_at = NOW(),
             updated_by = 'system'`,
          [key, JSON.stringify(totalTokens), totalTokens],
        );
      };

      await upsertUsage(modelKey);
      await upsertUsage(totalKey);
      await upsertUsage(userKey);
      await upsertUsage(userModelKey);
    } catch (err) {
      // Usage tracking should never block LLM responses
      logger.warn('Failed to record usage', { err: String(err) });
    }
  }

  private async recordUsageCost(
    model: ModelRecord,
    req: CompletionRequest,
    tokens: { prompt: number; completion: number },
    latencyMs: number,
    status: string,
  ): Promise<void> {
    try {
      if (!model.id) return;
      const orgId = await this.getUserOrgId(req.user_id);
      const totalTokens = Number(tokens.prompt || 0) + Number(tokens.completion || 0);
      const costPer1k = Number(model.cost_per_1k_tokens || 0);
      const totalCost = costPer1k > 0 ? (totalTokens / 1000) * costPer1k : null;

      await this.pool.query(
        `INSERT INTO model_usage_logs
          (id, organization_id, model_id, chat_id, user_id, agent_id, request_tokens, response_tokens, total_cost, latency_ms, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          crypto.randomUUID(),
          orgId,
          model.id,
          req.chat_id,
          req.user_id,
          req.agent_id || null,
          Number(tokens.prompt || 0),
          Number(tokens.completion || 0),
          totalCost,
          latencyMs,
          status,
        ],
      );
    } catch (err) {
      logger.warn('Failed to record model usage cost', { err: String(err) });
    }
  }

  private async getBudgetValue(key: string): Promise<number | null> {
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = $1`,
      [key],
    );
    if (res.rows.length === 0) return null;
    const parsed = parseSettingValue(res.rows[0].value);
    const num = Number(parsed);
    return Number.isFinite(num) ? num : null;
  }

  private async getUsageValue(key: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = $1`,
      [key],
    );
    if (res.rows.length === 0) return 0;
    const parsed = parseSettingValue(res.rows[0].value);
    const num = Number(parsed);
    return Number.isFinite(num) ? num : 0;
  }

  private async callProvider(
    model: ModelRecord,
    req: CompletionRequest,
  ): Promise<CompletionResponse> {
    const messages = [
      { role: 'system', content: req.systemPrompt },
      ...req.messages.map((m) => ({
        role: m.role,
        content: m.text || '',
      })),
    ];

    const thinking = this.resolveThinkingParams(req.think_level);
    const temperature = thinking?.temperature ?? 0.7;
    const maxTokens = thinking?.max_tokens;

    // A14: Route through LiteLLM proxy when enabled
    const liteLLMConfig = await this.getLiteLLMConfig();
    if (liteLLMConfig.enabled) {
      const virtualKey = await this.resolveLiteLLMVirtualKey(req, model);
      return this.callOpenAICompatible(liteLLMConfig.url, model.name, messages, {
        temperature,
        max_tokens: maxTokens,
        api_key: virtualKey || liteLLMConfig.apiKey,
      });
    }

    const providerKeys = await this.getProviderApiKeys(model.provider);
    const rotationStrategy = await this.getProviderRotationStrategy(model.provider);

    if (model.provider === 'ollama') {
      const ollamaEndpoint = this.resolveOllamaEndpoint(model.endpoint, model.provider);
      return this.callOllama(ollamaEndpoint, model.name, messages, {
        temperature,
        max_tokens: maxTokens,
      });
    }

    if (model.provider === 'llama_cpp') {
      return this.callOpenAICompatible(model.endpoint, model.name, messages, {
        temperature,
        max_tokens: maxTokens,
        provider_label: 'llama_cpp',
      });
    }

    return this.callOpenAICompatibleWithProviderKeys(
      model.provider,
      model.endpoint,
      model.name,
      messages,
      {
        temperature,
        max_tokens: maxTokens,
        keys: providerKeys,
        rotation: rotationStrategy,
      },
    );
  }

  private getProviderKeyState(provider: string): {
    nextIndex: number;
    lastUsedAt: Map<string, number>;
    cooldownUntil: Map<string, number>;
  } {
    const key = provider.trim().toLowerCase();
    let state = this.providerKeyState.get(key);
    if (!state) {
      state = {
        nextIndex: 0,
        lastUsedAt: new Map<string, number>(),
        cooldownUntil: new Map<string, number>(),
      };
      this.providerKeyState.set(key, state);
    }
    return state;
  }

  private async getProviderApiKeys(provider: string): Promise<string[]> {
    const normalized = provider.trim().toLowerCase();
    const settingKey = `llm.providerKeys.${normalized}`;
    try {
      const merged: string[] = [];
      const subscriptionToken = await this.getProviderSubscriptionAuthToken(normalized);
      if (subscriptionToken) {
        merged.push(subscriptionToken);
      }

      const res = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
        [settingKey],
      );
      if (res.rows.length === 0) return merged;
      const parsed = parseSettingValue(res.rows[0].value);
      if (!Array.isArray(parsed)) return merged;
      const providerKeys = parsed
        .map((v) => String(v || '').trim())
        .filter((v) => v.length > 0);
      for (const key of providerKeys) {
        if (!merged.includes(key)) merged.push(key);
      }
      return merged;
    } catch {
      return [];
    }
  }

  private async getProviderSubscriptionAuthToken(normalizedProvider: string): Promise<string> {
    const keyPrimary = `llm.providerSubscriptionAuth.${normalizedProvider}.token_ref`;
    const keyCompat = `llm.providerOauth.${normalizedProvider}.token_ref`;
    const envKey = `LLM_PROVIDER_SUBSCRIPTION_TOKEN_${normalizedProvider.replace(/[^a-z0-9]/g, '_').toUpperCase()}`;
    const envFallback = String(process.env[envKey] || '').trim();
    try {
      const res = await this.pool.query(
        `SELECT key, value
         FROM settings_global
         WHERE key IN ($1, $2)
         ORDER BY key = $1 DESC`,
        [keyPrimary, keyCompat],
      );
      if (res.rows.length === 0) return envFallback;
      for (const row of res.rows) {
        const value = parseSettingValue(row.value);
        const ref = this.extractSecretRef(value);
        if (!ref) continue;
        try {
          const resolved = String(await resolveSecretRef(ref)).trim();
          if (resolved.length > 0) return resolved;
        } catch (err) {
          logger.warn('Failed to resolve provider subscription auth token ref', {
            provider: normalizedProvider,
            setting_key: String(row.key || ''),
            err: String(err),
          });
        }
      }
      return envFallback;
    } catch {
      return envFallback;
    }
  }

  private extractSecretRef(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      const fromTokenRef = (value as Record<string, unknown>).token_ref;
      if (typeof fromTokenRef === 'string' && fromTokenRef.trim().length > 0) {
        return fromTokenRef.trim();
      }
      const fromRef = (value as Record<string, unknown>).ref;
      if (typeof fromRef === 'string' && fromRef.trim().length > 0) {
        return fromRef.trim();
      }
    }
    return '';
  }

  private async getProviderRotationStrategy(provider: string): Promise<ProviderKeyRotationStrategy> {
    const normalized = provider.trim().toLowerCase();
    const settingKey = `llm.providerKeyRotation.${normalized}`;
    try {
      const res = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
        [settingKey],
      );
      if (res.rows.length === 0) return 'round_robin';
      const parsed = String(parseSettingValue(res.rows[0].value) || '').trim().toLowerCase();
      if (parsed === 'random' || parsed === 'least_recently_used' || parsed === 'round_robin') {
        return parsed as ProviderKeyRotationStrategy;
      }
    } catch {
      // ignore
    }
    return 'round_robin';
  }

  private isRateLimited(err: unknown): err is ProviderHttpError {
    return err instanceof ProviderHttpError && err.status === 429;
  }

  private markProviderKeyRateLimited(provider: string, key: string, retryAfterSeconds?: number | null): void {
    const state = this.getProviderKeyState(provider);
    const cooldownSeconds = Number.isFinite(Number(retryAfterSeconds)) && Number(retryAfterSeconds) > 0
      ? Number(retryAfterSeconds)
      : 30;
    state.cooldownUntil.set(key, Date.now() + (cooldownSeconds * 1000));
  }

  private selectProviderKey(
    provider: string,
    keys: string[],
    strategy: ProviderKeyRotationStrategy,
    attempted: Set<string>,
  ): string | null {
    if (keys.length === 0) return null;
    const now = Date.now();
    const state = this.getProviderKeyState(provider);

    const nonAttempted = keys.filter((k) => !attempted.has(k));
    const ready = nonAttempted.filter((k) => (state.cooldownUntil.get(k) || 0) <= now);
    const pool = ready.length > 0 ? ready : nonAttempted;
    if (pool.length === 0) return null;

    let selected: string;
    if (strategy === 'random') {
      selected = pool[Math.floor(Math.random() * pool.length)];
    } else if (strategy === 'least_recently_used') {
      selected = pool.reduce((best, current) => {
        const bestAt = state.lastUsedAt.get(best) || 0;
        const currentAt = state.lastUsedAt.get(current) || 0;
        return currentAt < bestAt ? current : best;
      }, pool[0]);
    } else {
      const start = state.nextIndex % keys.length;
      selected = pool[0];
      for (let i = 0; i < keys.length; i += 1) {
        const candidate = keys[(start + i) % keys.length];
        if (pool.includes(candidate)) {
          selected = candidate;
          break;
        }
      }
      const selectedIndex = keys.indexOf(selected);
      state.nextIndex = selectedIndex >= 0 ? selectedIndex + 1 : state.nextIndex + 1;
    }

    state.lastUsedAt.set(selected, now);
    return selected;
  }

  private async callOpenAICompatibleWithProviderKeys(
    provider: string,
    endpoint: string,
    modelName: string,
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number;
      max_tokens?: number;
      keys: string[];
      rotation: ProviderKeyRotationStrategy;
    },
  ): Promise<CompletionResponse> {
    const attempted = new Set<string>();
    const maxAttempts = options.keys.length > 0 ? options.keys.length : 1;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const selectedKey = this.selectProviderKey(provider, options.keys, options.rotation, attempted);
      if (selectedKey) attempted.add(selectedKey);

      try {
        return await this.callOpenAICompatible(endpoint, modelName, messages, {
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          api_key: selectedKey || undefined,
        });
      } catch (err) {
        lastErr = err;
        if (selectedKey && this.isRateLimited(err)) {
          this.markProviderKeyRateLimited(provider, selectedKey, err.retryAfterSeconds);
          logger.warn('Provider key rate-limited; rotating key', {
            provider,
            attempt: attempt + 1,
            maxAttempts,
          });
          continue;
        }
        throw err;
      }
    }

    throw lastErr || new Error(`No API keys available for provider ${provider}`);
  }

  private async isLiteLLMEnabled(): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = 'llm.litellm.enabled'`,
      );
      if (res.rows.length === 0) return false;
      return parseBooleanSetting(res.rows[0].value, false);
    } catch {
      return false;
    }
  }

  private async getLiteLLMConfig(): Promise<{ enabled: boolean; url: string; apiKey: string; useVirtualKeys: boolean }> {
    const defaultUrl = process.env.LITELLM_URL || 'http://litellm:4000';
    const defaultApiKey = process.env.LITELLM_MASTER_KEY || '';
    let useVirtualKeys = String(process.env.LITELLM_USE_VIRTUAL_KEYS || '').toLowerCase() === 'true';
    const enabled = await this.isLiteLLMEnabled();

    try {
      const res = await this.pool.query(
        `SELECT key, value
         FROM settings_global
         WHERE key IN ('llm.litellm.url', 'llm.litellm.api_key', 'llm.litellm.use_virtual_keys')`,
      );

      let url = defaultUrl;
      let apiKey = defaultApiKey;
      for (const row of res.rows) {
        const key = String(row.key || '');
        const value = parseSettingValue(row.value);
        if (key === 'llm.litellm.url' && typeof value === 'string' && value.trim().length > 0) {
          url = value.trim();
        }
        if (key === 'llm.litellm.api_key' && typeof value === 'string' && value.trim().length > 0) {
          apiKey = value.trim();
        }
        if (key === 'llm.litellm.use_virtual_keys') {
          if (typeof value === 'boolean') useVirtualKeys = value;
          if (typeof value === 'string') useVirtualKeys = ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        }
      }

      return { enabled, url, apiKey, useVirtualKeys };
    } catch {
      return { enabled, url: defaultUrl, apiKey: defaultApiKey, useVirtualKeys };
    }
  }

  private async resolveLiteLLMVirtualKey(
    req: CompletionRequest,
    _model: ModelRecord,
  ): Promise<string> {
    const config = await this.getLiteLLMConfig();
    if (!config.useVirtualKeys) return '';
    if (!req.user_id) return '';

    const keyRow = await this.getLiteLLMVirtualKeyRow(req);
    if (!keyRow) return '';

    await this.pool.query(
      `UPDATE litellm_virtual_keys SET last_used_at = NOW() WHERE id = $1`,
      [keyRow.id],
    ).catch(() => {});

    try {
      return decryptLiteLlmVirtualKey(String(keyRow.virtual_key || ''));
    } catch (err) {
      logger.warn('Failed to decrypt LiteLLM virtual key', { err: String(err), key_id: keyRow.id });
      return '';
    }
  }

  private async getLiteLLMVirtualKeyRow(
    req: CompletionRequest,
  ): Promise<{ id: string; virtual_key: string; max_daily_budget_usd?: number | null } | null> {
    const orgId = await this.getUserOrgId(req.user_id);
    if (!orgId) return null;

    const agentId = req.agent_id ? String(req.agent_id) : '';
    const rows = await this.pool.query(
      `SELECT id, virtual_key, max_daily_budget_usd
       FROM litellm_virtual_keys
       WHERE organization_id = $1
         AND (
           (agent_id IS NOT NULL AND agent_id = $2)
           OR (agent_id IS NULL AND user_id = $3)
         )
       ORDER BY agent_id IS NOT NULL DESC, created_at DESC
       LIMIT 1`,
      [orgId, agentId || null, req.user_id],
    );
    if (rows.rows.length === 0) return null;
    return rows.rows[0] as { id: string; virtual_key: string; max_daily_budget_usd?: number | null };
  }

  private async getUserOrgId(userId: string): Promise<string | null> {
    try {
      const res = await this.pool.query(
        `SELECT active_organization_id FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const raw = res.rows[0]?.active_organization_id;
      return raw ? String(raw) : null;
    } catch {
      return null;
    }
  }

  private async checkDailyBudget(
    orgId: string,
    userId: string,
    agentId: string,
    maxBudgetUsd: number,
  ): Promise<boolean> {
    try {
      const params: Array<string> = [orgId, userId];
      let where = `organization_id = $1 AND user_id = $2`;
      if (agentId) {
        params.push(agentId);
        where += ` AND agent_id = $3`;
      }
      const res = await this.pool.query(
        `SELECT COALESCE(SUM(total_cost), 0) AS total
         FROM model_usage_logs
         WHERE ${where} AND created_at >= DATE_TRUNC('day', NOW())`,
        params,
      );
      const spent = Number(res.rows[0]?.total || 0);
      return spent < maxBudgetUsd;
    } catch (err) {
      logger.warn('Failed to check LiteLLM virtual key budget', { err: String(err) });
      return true;
    }
  }

  private resolveThinkingParams(level?: string): { temperature: number; max_tokens?: number } | null {
    if (!level) return null;
    const normalized = level.toLowerCase();
    if (normalized === 'off') {
      return { temperature: 0.2, max_tokens: 256 };
    }
    if (normalized === 'low') {
      return { temperature: 0.4, max_tokens: 512 };
    }
    if (normalized === 'medium') {
      return { temperature: 0.7, max_tokens: 1024 };
    }
    if (normalized === 'high') {
      return { temperature: 0.7, max_tokens: 2048 };
    }
    return null;
  }

  private async callOllama(
    endpoint: string,
    modelName: string,
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; max_tokens?: number },
  ): Promise<CompletionResponse> {
    const ollamaOptions: Record<string, unknown> = {};
    if (options?.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options?.max_tokens !== undefined) ollamaOptions.num_predict = options.max_tokens;

    const response = await this.fetchWithTimeout(
      `${endpoint}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages,
          stream: false,
          ...(Object.keys(ollamaOptions).length > 0 ? { options: ollamaOptions } : {}),
        }),
      },
      this.getProviderTimeoutMs('ollama'),
      'ollama',
    );

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json() as any;

    return {
      text: data.message?.content || '',
      provider_used: 'ollama',
      model_used: modelName,
      tokens_used: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
      },
    };
  }

  private async callOpenAICompatible(
    endpoint: string,
    modelName: string,
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; max_tokens?: number; api_key?: string; provider_label?: 'openai_compatible' | 'llama_cpp' },
  ): Promise<CompletionResponse> {
    const apiKey = options?.api_key || process.env.LLM_API_KEY || '';
    const temperature = options?.temperature ?? 0.7;
    const providerLabel = options?.provider_label ?? 'openai_compatible';
    const response = await this.fetchWithTimeout(
      `${endpoint}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature,
          ...(options?.max_tokens !== undefined ? { max_tokens: options.max_tokens } : {}),
        }),
      },
      this.getProviderTimeoutMs(providerLabel),
      providerLabel,
    );

    if (!response.ok) {
      const retryAfterRaw = response.headers.get('retry-after');
      const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : null;
      throw new ProviderHttpError(
        response.status,
        Number.isFinite(retryAfter) ? retryAfter : null,
        `LLM API error: ${response.status}`,
      );
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const rawCitations =
      choice?.message?.citations ??
      choice?.message?.metadata?.citations ??
      data.citations;
    const citations = normalizeCitations(rawCitations);

    return {
      text: choice?.message?.content || '',
      tool_calls: choice?.message?.tool_calls,
      citations: citations.length > 0 ? citations : undefined,
      provider_used: 'openai_compatible',
      model_used: modelName,
      tokens_used: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
      },
    };
  }

  private getProviderTimeoutMs(provider: 'ollama' | 'openai_compatible' | 'llama_cpp'): number {
    const envKey = provider === 'ollama' || provider === 'llama_cpp'
      ? 'AGENT_RUNTIME_OLLAMA_TIMEOUT_MS'
      : 'AGENT_RUNTIME_OPENAI_TIMEOUT_MS';
    const fallback = provider === 'ollama' || provider === 'llama_cpp'
      ? DEFAULT_OLLAMA_TIMEOUT_MS
      : DEFAULT_OPENAI_TIMEOUT_MS;
    const raw = Number(process.env[envKey] ?? fallback);
    if (!Number.isFinite(raw)) return fallback;
    const normalized = Math.floor(raw);
    return Math.max(MIN_PROVIDER_TIMEOUT_MS, Math.min(MAX_PROVIDER_TIMEOUT_MS, normalized));
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    provider: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        throw new ProviderTimeoutError(provider, timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
