import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.4 Local ↔ Cloud Smart Routing Service
 * Simple tasks → local model. Complex tasks → cloud. Offline → local handles everything.
 * Seamless fallback with no user-visible interruption.
 */

type RoutingTarget = 'local' | 'cloud' | 'fallback_local';
type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'unknown';

interface RoutingDecision {
  id: string;
  organization_id: string;
  user_id: string;
  target: RoutingTarget;
  complexity: TaskComplexity;
  reason: string;
  model_profile_id: string | null;
  is_offline: boolean;
  latency_estimate_ms: number;
  created_at: string;
}

interface RoutingPolicy {
  id: string;
  organization_id: string;
  local_complexity_threshold: TaskComplexity;
  prefer_local: boolean;
  offline_mode_enabled: boolean;
  cloud_fallback_enabled: boolean;
  max_local_token_count: number;
  max_cloud_token_count: number;
  created_at: string;
}

/** Heuristic: token count + presence of multi-step/code/analysis keywords */
const COMPLEXITY_THRESHOLDS = {
  simple: 200,
  moderate: 1000,
  complex: Infinity,
} as const;

const COMPLEX_KEYWORDS = [
  'analyze', 'compare', 'synthesize', 'debug', 'refactor', 'architecture',
  'multi-step', 'research', 'summarize this document', 'translate entire',
  'write a full', 'build a', 'design a system',
];

export class SmartRoutingService {
  constructor(private pool: pg.Pool) {}

  /** Get or create routing policy for an org */
  async getPolicy(organizationId: string): Promise<RoutingPolicy> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_routing_policies WHERE organization_id = $1`,
      [organizationId],
    );
    if (result.rows[0]) return this.mapPolicy(result.rows[0]);

    // Create default: prefer local, cloud fallback enabled
    const id = uuidv7();
    const ins = await this.pool.query(
      `INSERT INTO gemma4_routing_policies (
        id, organization_id, local_complexity_threshold, prefer_local,
        offline_mode_enabled, cloud_fallback_enabled,
        max_local_token_count, max_cloud_token_count, created_at
      ) VALUES ($1,$2,'moderate',TRUE,FALSE,TRUE,4096,32768,NOW())
      ON CONFLICT (organization_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [id, organizationId],
    );
    return this.mapPolicy(ins.rows[0]);
  }

  /** Update routing policy */
  async updatePolicy(organizationId: string, updates: Partial<RoutingPolicy>): Promise<RoutingPolicy> {
    const fields: string[] = [];
    const params: unknown[] = [organizationId];

    if (updates.local_complexity_threshold !== undefined) {
      const valid: TaskComplexity[] = ['simple', 'moderate', 'complex'];
      if (!valid.includes(updates.local_complexity_threshold)) throw new Error('Invalid complexity threshold');
      params.push(updates.local_complexity_threshold);
      fields.push(`local_complexity_threshold = $${params.length}`);
    }
    if (updates.prefer_local !== undefined) { params.push(updates.prefer_local); fields.push(`prefer_local = $${params.length}`); }
    if (updates.offline_mode_enabled !== undefined) { params.push(updates.offline_mode_enabled); fields.push(`offline_mode_enabled = $${params.length}`); }
    if (updates.cloud_fallback_enabled !== undefined) { params.push(updates.cloud_fallback_enabled); fields.push(`cloud_fallback_enabled = $${params.length}`); }
    if (updates.max_local_token_count !== undefined) {
      if (updates.max_local_token_count < 128 || updates.max_local_token_count > 128_000) throw new Error('max_local_token_count must be 128–128000');
      params.push(updates.max_local_token_count);
      fields.push(`max_local_token_count = $${params.length}`);
    }
    if (updates.max_cloud_token_count !== undefined) {
      if (updates.max_cloud_token_count < 128 || updates.max_cloud_token_count > 1_000_000) throw new Error('max_cloud_token_count must be 128–1000000');
      params.push(updates.max_cloud_token_count);
      fields.push(`max_cloud_token_count = $${params.length}`);
    }

    if (fields.length === 0) return this.getPolicy(organizationId);

    fields.push('updated_at = NOW()');
    const result = await this.pool.query(
      `UPDATE gemma4_routing_policies SET ${fields.join(', ')} WHERE organization_id = $1 RETURNING *`,
      params,
    );
    return this.mapPolicy(result.rows[0]);
  }

  /** Determine routing target for a given prompt */
  async routeRequest(
    organizationId: string,
    userId: string,
    input: { prompt: string; is_offline: boolean; platform: string },
  ): Promise<RoutingDecision> {
    const policy = await this.getPolicy(organizationId);
    const complexity = this.estimateComplexity(input.prompt);
    const id = uuidv7();

    let target: RoutingTarget;
    let reason: string;
    let latencyEstimate: number;

    if (input.is_offline || policy.offline_mode_enabled) {
      // Offline: all requests go local regardless of complexity
      target = 'local';
      reason = 'offline_mode';
      latencyEstimate = complexity === 'complex' ? 5000 : complexity === 'moderate' ? 2000 : 500;
    } else if (policy.prefer_local && this.isLocalCapable(complexity, policy.local_complexity_threshold)) {
      target = 'local';
      reason = 'local_preferred_and_capable';
      latencyEstimate = complexity === 'moderate' ? 1500 : 400;
    } else if (complexity === 'complex' || complexity === 'moderate') {
      target = 'cloud';
      reason = 'complexity_exceeds_local_threshold';
      latencyEstimate = 1000;
    } else {
      target = policy.prefer_local ? 'local' : 'cloud';
      reason = policy.prefer_local ? 'default_local_preference' : 'default_cloud';
      latencyEstimate = 500;
    }

    // Record routing decision
    await this.pool.query(
      `INSERT INTO gemma4_routing_decisions (
        id, organization_id, user_id, target, complexity, reason,
        is_offline, latency_estimate_ms, prompt_length, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [id, organizationId, userId, target, complexity, reason, input.is_offline, latencyEstimate, input.prompt.length],
    );

    return {
      id,
      organization_id: organizationId,
      user_id: userId,
      target,
      complexity,
      reason,
      model_profile_id: null,
      is_offline: input.is_offline,
      latency_estimate_ms: latencyEstimate,
      created_at: new Date().toISOString(),
    };
  }

  /** Get routing analytics for an org */
  async getRoutingStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT target, complexity, COUNT(*) as count,
              AVG(latency_estimate_ms) as avg_latency_ms,
              SUM(CASE WHEN is_offline THEN 1 ELSE 0 END) as offline_count
       FROM gemma4_routing_decisions
       WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY target, complexity
       ORDER BY count DESC`,
      [organizationId],
    );
    const total = result.rows.reduce((s, r) => s + Number(r.count), 0);
    const localCount = result.rows.filter((r) => r.target === 'local').reduce((s, r) => s + Number(r.count), 0);
    return {
      period: '7_days',
      total_requests: total,
      local_percentage: total > 0 ? Math.round((localCount / total) * 100) : 0,
      breakdown: result.rows,
    };
  }

  /** Estimate task complexity from prompt content */
  estimateComplexity(prompt: string): TaskComplexity {
    const tokenEstimate = Math.ceil(prompt.length / 4);
    const lower = prompt.toLowerCase();
    const hasComplexKeyword = COMPLEX_KEYWORDS.some((kw) => lower.includes(kw));

    if (hasComplexKeyword || tokenEstimate > COMPLEXITY_THRESHOLDS.moderate) return 'complex';
    if (tokenEstimate > COMPLEXITY_THRESHOLDS.simple) return 'moderate';
    return 'simple';
  }

  private isLocalCapable(complexity: TaskComplexity, threshold: TaskComplexity): boolean {
    const order: TaskComplexity[] = ['simple', 'moderate', 'complex'];
    return order.indexOf(complexity) <= order.indexOf(threshold);
  }

  private mapPolicy(r: Record<string, unknown>): RoutingPolicy {
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      local_complexity_threshold: r.local_complexity_threshold as TaskComplexity,
      prefer_local: Boolean(r.prefer_local),
      offline_mode_enabled: Boolean(r.offline_mode_enabled),
      cloud_fallback_enabled: Boolean(r.cloud_fallback_enabled),
      max_local_token_count: Number(r.max_local_token_count),
      max_cloud_token_count: Number(r.max_cloud_token_count),
      created_at: String(r.created_at),
    };
  }
}
