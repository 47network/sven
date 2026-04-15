import pg from 'pg';
import type { TriggerRule, TriggerCategory, NotificationSeverity } from '@sven/proactive-notifier/triggers';

export class PgTriggerRuleStore {
  constructor(private readonly pool: pg.Pool) {}

  async list(opts?: { category?: TriggerCategory; enabled?: boolean; orgId?: string; limit?: number }): Promise<TriggerRule[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (opts?.category) { conditions.push(`category = $${idx++}`); params.push(opts.category); }
    if (opts?.enabled !== undefined) { conditions.push(`enabled = $${idx++}`); params.push(opts.enabled); }
    if (opts?.orgId) { conditions.push(`(organization_id = $${idx++} OR organization_id IS NULL)`); params.push(opts.orgId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(opts?.limit ?? 200, 500);

    const { rows } = await this.pool.query(
      `SELECT * FROM proactive_trigger_rules ${where} ORDER BY category, name LIMIT ${limit}`,
      params,
    );
    return rows as TriggerRule[];
  }

  async getById(id: string): Promise<TriggerRule | null> {
    const { rows } = await this.pool.query(`SELECT * FROM proactive_trigger_rules WHERE id = $1`, [id]);
    return (rows[0] as TriggerRule) ?? null;
  }

  async create(rule: Omit<TriggerRule, 'last_fired_at' | 'created_at' | 'updated_at'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO proactive_trigger_rules (id, name, category, enabled, min_severity, cooldown_seconds, max_per_hour, condition_expression, body_template, target_channels, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [rule.id, rule.name, rule.category, rule.enabled, rule.min_severity, rule.cooldown_seconds, rule.max_per_hour, rule.condition_expression, rule.body_template, rule.target_channels, rule.organization_id],
    );
  }

  async update(id: string, patch: Partial<Pick<TriggerRule, 'name' | 'enabled' | 'min_severity' | 'cooldown_seconds' | 'max_per_hour' | 'condition_expression' | 'body_template' | 'target_channels'>>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name); }
    if (patch.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(patch.enabled); }
    if (patch.min_severity !== undefined) { sets.push(`min_severity = $${idx++}`); params.push(patch.min_severity); }
    if (patch.cooldown_seconds !== undefined) { sets.push(`cooldown_seconds = $${idx++}`); params.push(patch.cooldown_seconds); }
    if (patch.max_per_hour !== undefined) { sets.push(`max_per_hour = $${idx++}`); params.push(patch.max_per_hour); }
    if (patch.condition_expression !== undefined) { sets.push(`condition_expression = $${idx++}`); params.push(patch.condition_expression); }
    if (patch.body_template !== undefined) { sets.push(`body_template = $${idx++}`); params.push(patch.body_template); }
    if (patch.target_channels !== undefined) { sets.push(`target_channels = $${idx++}`); params.push(patch.target_channels); }

    if (sets.length === 0) return;
    sets.push(`updated_at = NOW()`);

    await this.pool.query(
      `UPDATE proactive_trigger_rules SET ${sets.join(', ')} WHERE id = $${idx}`,
      [...params, id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM proactive_trigger_rules WHERE id = $1`, [id]);
  }

  async seedDefaults(defaults: Array<Omit<TriggerRule, 'last_fired_at' | 'created_at' | 'updated_at'>>): Promise<number> {
    let seeded = 0;
    for (const rule of defaults) {
      const existing = await this.pool.query(
        `SELECT 1 FROM proactive_trigger_rules WHERE name = $1 AND organization_id IS NOT DISTINCT FROM $2 LIMIT 1`,
        [rule.name, rule.organization_id],
      );
      if (existing.rows.length === 0) {
        await this.create(rule);
        seeded++;
      }
    }
    return seeded;
  }
}
