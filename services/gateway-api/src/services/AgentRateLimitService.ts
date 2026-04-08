import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

const VALID_CADENCE_PROFILES = ['natural', 'burst', 'steady', 'quiet'] as const;
const VALID_POST_TYPES = ['community', 'agent_message', 'changelog', 'report'] as const;

interface RateLimitConfig {
  agent_id: string;
  organization_id: string;
  max_posts_per_hour: number;
  max_posts_per_day: number;
  min_interval_seconds: number;
  cadence_profile: string;
  cooldown_after_rejection_seconds: number;
}

interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  next_allowed_at?: string;
  hourly_remaining: number;
  daily_remaining: number;
}

/**
 * Agent rate limiting and cadence control.
 * Enforces per-agent posting frequency limits with natural-feeling intervals.
 * Natural cadence adds random jitter (±30%) to min_interval for human-like timing.
 */
export class AgentRateLimitService {
  constructor(private pool: pg.Pool) {}

  async getOrCreateConfig(agentId: string, organizationId: string): Promise<RateLimitConfig> {
    const existing = await this.pool.query(
      `SELECT * FROM agent_rate_limits WHERE agent_id = $1 AND organization_id = $2`,
      [agentId, organizationId],
    );
    if (existing.rows[0]) return this.mapConfig(existing.rows[0]);

    // Create default config
    const result = await this.pool.query(
      `INSERT INTO agent_rate_limits (id, organization_id, agent_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id, organization_id) DO NOTHING
       RETURNING *`,
      [uuidv7(), organizationId, agentId],
    );

    if (result.rows[0]) return this.mapConfig(result.rows[0]);
    // Race: another insert won, re-read
    const reread = await this.pool.query(
      `SELECT * FROM agent_rate_limits WHERE agent_id = $1 AND organization_id = $2`,
      [agentId, organizationId],
    );
    return this.mapConfig(reread.rows[0]);
  }

  async updateConfig(
    agentId: string,
    organizationId: string,
    updates: Partial<Omit<RateLimitConfig, 'agent_id' | 'organization_id'>>,
  ): Promise<RateLimitConfig> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [agentId, organizationId];
    let idx = 3;

    if (updates.max_posts_per_hour !== undefined) {
      const v = Math.min(Math.max(updates.max_posts_per_hour, 1), 1000);
      setClauses.push(`max_posts_per_hour = $${idx++}`);
      params.push(v);
    }
    if (updates.max_posts_per_day !== undefined) {
      const v = Math.min(Math.max(updates.max_posts_per_day, 1), 10000);
      setClauses.push(`max_posts_per_day = $${idx++}`);
      params.push(v);
    }
    if (updates.min_interval_seconds !== undefined) {
      const v = Math.min(Math.max(updates.min_interval_seconds, 5), 3600);
      setClauses.push(`min_interval_seconds = $${idx++}`);
      params.push(v);
    }
    if (updates.cadence_profile !== undefined) {
      const profile = updates.cadence_profile.trim().toLowerCase();
      if (!VALID_CADENCE_PROFILES.includes(profile as any)) {
        throw new Error(`Invalid cadence profile: ${profile}`);
      }
      setClauses.push(`cadence_profile = $${idx++}`);
      params.push(profile);
    }
    if (updates.cooldown_after_rejection_seconds !== undefined) {
      const v = Math.min(Math.max(updates.cooldown_after_rejection_seconds, 0), 86400);
      setClauses.push(`cooldown_after_rejection_seconds = $${idx++}`);
      params.push(v);
    }

    const result = await this.pool.query(
      `UPDATE agent_rate_limits SET ${setClauses.join(', ')}
       WHERE agent_id = $1 AND organization_id = $2
       RETURNING *`,
      params,
    );
    if (!result.rows[0]) throw new Error('Rate limit config not found');
    return this.mapConfig(result.rows[0]);
  }

  async checkRateLimit(agentId: string, organizationId: string): Promise<RateLimitCheck> {
    const config = await this.getOrCreateConfig(agentId, organizationId);

    // Check last rejection cooldown
    const lastRejection = await this.pool.query(
      `SELECT created_at FROM agent_post_log
       WHERE agent_id = $1 AND organization_id = $2 AND moderation_status = 'rejected'
       ORDER BY created_at DESC LIMIT 1`,
      [agentId, organizationId],
    );
    if (lastRejection.rows[0]) {
      const rejectedAt = new Date(lastRejection.rows[0].created_at);
      const cooldownEnd = new Date(rejectedAt.getTime() + config.cooldown_after_rejection_seconds * 1000);
      if (cooldownEnd > new Date()) {
        return {
          allowed: false,
          reason: 'Cooldown after rejection',
          next_allowed_at: cooldownEnd.toISOString(),
          hourly_remaining: 0,
          daily_remaining: 0,
        };
      }
    }

    // Check minimum interval (with cadence jitter)
    const lastPost = await this.pool.query(
      `SELECT created_at FROM agent_post_log
       WHERE agent_id = $1 AND organization_id = $2
         AND moderation_status IN ('approved', 'auto_approved', 'pending')
       ORDER BY created_at DESC LIMIT 1`,
      [agentId, organizationId],
    );
    if (lastPost.rows[0]) {
      const effectiveInterval = this.applyJitter(config.min_interval_seconds, config.cadence_profile);
      const nextAllowed = new Date(new Date(lastPost.rows[0].created_at).getTime() + effectiveInterval * 1000);
      if (nextAllowed > new Date()) {
        return {
          allowed: false,
          reason: 'Minimum interval not elapsed',
          next_allowed_at: nextAllowed.toISOString(),
          hourly_remaining: 0,
          daily_remaining: 0,
        };
      }
    }

    // Check hourly limit
    const hourlyCount = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS cnt FROM agent_post_log
       WHERE agent_id = $1 AND organization_id = $2
         AND created_at > NOW() - INTERVAL '1 hour'
         AND moderation_status IN ('approved', 'auto_approved', 'pending')`,
      [agentId, organizationId],
    );
    const hourlyUsed = hourlyCount.rows[0]?.cnt || 0;
    if (hourlyUsed >= config.max_posts_per_hour) {
      return {
        allowed: false,
        reason: 'Hourly limit reached',
        hourly_remaining: 0,
        daily_remaining: 0,
      };
    }

    // Check daily limit
    const dailyCount = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS cnt FROM agent_post_log
       WHERE agent_id = $1 AND organization_id = $2
         AND created_at > NOW() - INTERVAL '1 day'
         AND moderation_status IN ('approved', 'auto_approved', 'pending')`,
      [agentId, organizationId],
    );
    const dailyUsed = dailyCount.rows[0]?.cnt || 0;
    if (dailyUsed >= config.max_posts_per_day) {
      return {
        allowed: false,
        reason: 'Daily limit reached',
        hourly_remaining: 0,
        daily_remaining: 0,
      };
    }

    return {
      allowed: true,
      hourly_remaining: config.max_posts_per_hour - hourlyUsed,
      daily_remaining: config.max_posts_per_day - dailyUsed,
    };
  }

  async recordPost(
    agentId: string,
    organizationId: string,
    postType: string,
    contentPreview?: string,
  ): Promise<string> {
    const type = postType?.trim().toLowerCase() || 'community';
    if (!VALID_POST_TYPES.includes(type as any)) {
      throw new Error(`Invalid post type: ${type}`);
    }

    const result = await this.pool.query(
      `INSERT INTO agent_post_log (id, organization_id, agent_id, post_type, content_preview)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [uuidv7(), organizationId, agentId, type, contentPreview?.slice(0, 500) || null],
    );
    return result.rows[0].id;
  }

  private applyJitter(baseSeconds: number, cadenceProfile: string): number {
    switch (cadenceProfile) {
      case 'natural': {
        // ±30% random jitter for human-like intervals
        const jitter = 0.7 + Math.random() * 0.6;
        return Math.round(baseSeconds * jitter);
      }
      case 'burst':
        return Math.round(baseSeconds * 0.5); // 50% of min interval
      case 'steady':
        return baseSeconds; // No jitter
      case 'quiet':
        return Math.round(baseSeconds * 2); // Double interval
      default:
        return baseSeconds;
    }
  }

  private mapConfig(row: any): RateLimitConfig {
    return {
      agent_id: row.agent_id,
      organization_id: row.organization_id,
      max_posts_per_hour: row.max_posts_per_hour,
      max_posts_per_day: row.max_posts_per_day,
      min_interval_seconds: row.min_interval_seconds,
      cadence_profile: row.cadence_profile,
      cooldown_after_rejection_seconds: row.cooldown_after_rejection_seconds,
    };
  }
}
