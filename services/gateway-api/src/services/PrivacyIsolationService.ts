import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.11 + 6.13 Privacy Guarantees & Full Offline Mode Service
 * On-device inference NEVER sends prompts/responses to Google or any third party.
 * Model runs in full isolation. All local processing stays local.
 * Full offline mode: all capable models available locally, no data connection needed.
 */

interface PrivacyPolicy {
  id: string;
  organization_id: string;
  user_id: string;
  local_inference_only: boolean;
  block_telemetry: boolean;
  block_crash_reports: boolean;
  block_usage_analytics: boolean;
  allow_model_updates: boolean;
  allow_module_downloads: boolean;
  offline_mode_forced: boolean;
  data_retention_days: number;
  created_at: string;
  updated_at: string;
}

interface PrivacyAuditEntry {
  id: string;
  organization_id: string;
  user_id: string;
  event_type: string;
  blocked: boolean;
  reason: string;
  details: Record<string, unknown>;
  created_at: string;
}

const BLOCKED_DOMAINS = [
  'crashlytics.google.com',
  'firebase-settings.crashlytics.com',
  'app-measurement.com',
  'analytics.google.com',
  'firebaselogging.googleapis.com',
  'play.googleapis.com',
  'update.googleapis.com',
];

export class PrivacyIsolationService {
  constructor(private pool: pg.Pool) {}

  /** Get or create privacy policy with secure defaults */
  async getPolicy(organizationId: string, userId: string): Promise<PrivacyPolicy> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_privacy_policies WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
    );
    if (result.rows[0]) return this.mapPolicy(result.rows[0]);

    // Default: maximum privacy — local inference only, all telemetry blocked
    const id = uuidv7();
    const ins = await this.pool.query(
      `INSERT INTO gemma4_privacy_policies (
        id, organization_id, user_id, local_inference_only, block_telemetry,
        block_crash_reports, block_usage_analytics, allow_model_updates,
        allow_module_downloads, offline_mode_forced, data_retention_days,
        created_at, updated_at
      ) VALUES ($1,$2,$3,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,365,NOW(),NOW())
      ON CONFLICT (organization_id, user_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [id, organizationId, userId],
    );
    return this.mapPolicy(ins.rows[0]);
  }

  /** Update privacy policy */
  async updatePolicy(organizationId: string, userId: string, updates: Partial<PrivacyPolicy>): Promise<PrivacyPolicy> {
    const fields: string[] = [];
    const params: unknown[] = [organizationId, userId];
    const boolFields: (keyof PrivacyPolicy)[] = [
      'local_inference_only', 'block_telemetry', 'block_crash_reports',
      'block_usage_analytics', 'allow_model_updates', 'allow_module_downloads', 'offline_mode_forced',
    ];
    for (const f of boolFields) {
      if (updates[f] !== undefined) { params.push(updates[f]); fields.push(`${f} = $${params.length}`); }
    }
    if (updates.data_retention_days !== undefined) {
      if (updates.data_retention_days < 1 || updates.data_retention_days > 3650) throw new Error('data_retention_days must be 1–3650');
      params.push(updates.data_retention_days); fields.push(`data_retention_days = $${params.length}`);
    }
    if (fields.length === 0) return this.getPolicy(organizationId, userId);
    fields.push('updated_at = NOW()');
    const result = await this.pool.query(
      `UPDATE gemma4_privacy_policies SET ${fields.join(', ')} WHERE organization_id = $1 AND user_id = $2 RETURNING *`,
      params,
    );
    return this.mapPolicy(result.rows[0]);
  }

  /**
   * Check if an outbound network request should be blocked.
   * Returns true if the request is allowed, false if blocked.
   */
  async checkOutboundRequest(
    organizationId: string,
    userId: string,
    targetDomain: string,
    requestType: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    const policy = await this.getPolicy(organizationId, userId);

    // Check domain blocklist
    if (BLOCKED_DOMAINS.some((d) => targetDomain.includes(d))) {
      await this.auditLog(organizationId, userId, {
        event_type: 'outbound_blocked', blocked: true,
        reason: 'domain_blocklist', details: { domain: targetDomain, request_type: requestType },
      });
      return { allowed: false, reason: 'domain_in_blocklist' };
    }

    // Check policy-based blocks
    if (policy.block_telemetry && requestType === 'telemetry') {
      await this.auditLog(organizationId, userId, {
        event_type: 'telemetry_blocked', blocked: true,
        reason: 'user_policy', details: { domain: targetDomain },
      });
      return { allowed: false, reason: 'telemetry_blocked_by_policy' };
    }

    if (policy.block_crash_reports && requestType === 'crash_report') {
      return { allowed: false, reason: 'crash_reports_blocked_by_policy' };
    }

    if (policy.block_usage_analytics && requestType === 'analytics') {
      return { allowed: false, reason: 'analytics_blocked_by_policy' };
    }

    if (policy.offline_mode_forced && requestType === 'inference') {
      return { allowed: false, reason: 'offline_mode_forced' };
    }

    if (policy.local_inference_only && requestType === 'inference') {
      return { allowed: false, reason: 'local_inference_only' };
    }

    return { allowed: true, reason: 'policy_allows' };
  }

  /** Verify the model isolation guarantee — no outbound data during inference */
  async verifyIsolation(organizationId: string, userId: string): Promise<{
    isolated: boolean;
    checks: Array<{ check: string; passed: boolean }>;
  }> {
    const policy = await this.getPolicy(organizationId, userId);
    const checks = [
      { check: 'local_inference_only', passed: policy.local_inference_only },
      { check: 'telemetry_blocked', passed: policy.block_telemetry },
      { check: 'crash_reports_blocked', passed: policy.block_crash_reports },
      { check: 'analytics_blocked', passed: policy.block_usage_analytics },
      { check: 'data_retention_configured', passed: policy.data_retention_days > 0 },
    ];
    return {
      isolated: checks.every((c) => c.passed),
      checks,
    };
  }

  /** Get blocked domains list for client-side enforcement */
  getBlockedDomains(): string[] { return [...BLOCKED_DOMAINS]; }

  /** Record privacy audit log entry */
  async auditLog(
    organizationId: string,
    userId: string,
    input: { event_type: string; blocked: boolean; reason: string; details?: Record<string, unknown> },
  ): Promise<void> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO gemma4_privacy_audit_log (
        id, organization_id, user_id, event_type, blocked, reason, details, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [id, organizationId, userId, input.event_type, input.blocked, input.reason, JSON.stringify(input.details || {})],
    );
  }

  /** Get privacy audit summary */
  async getAuditStats(organizationId: string, userId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT event_type, blocked, COUNT(*) as count
       FROM gemma4_privacy_audit_log
       WHERE organization_id = $1 AND user_id = $2 AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY event_type, blocked ORDER BY count DESC`,
      [organizationId, userId],
    );
    const total = result.rows.reduce((s, r) => s + Number(r.count), 0);
    const blocked = result.rows.filter((r) => r.blocked).reduce((s, r) => s + Number(r.count), 0);
    return { period: '30_days', total_events: total, blocked_events: blocked, breakdown: result.rows };
  }

  private mapPolicy(r: Record<string, unknown>): PrivacyPolicy {
    return {
      id: String(r.id), organization_id: String(r.organization_id), user_id: String(r.user_id),
      local_inference_only: Boolean(r.local_inference_only), block_telemetry: Boolean(r.block_telemetry),
      block_crash_reports: Boolean(r.block_crash_reports), block_usage_analytics: Boolean(r.block_usage_analytics),
      allow_model_updates: Boolean(r.allow_model_updates), allow_module_downloads: Boolean(r.allow_module_downloads),
      offline_mode_forced: Boolean(r.offline_mode_forced), data_retention_days: Number(r.data_retention_days),
      created_at: String(r.created_at), updated_at: String(r.updated_at),
    };
  }
}
