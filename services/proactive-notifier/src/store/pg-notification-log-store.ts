import pg from 'pg';
import type { NotificationLogEntry } from '@sven/proactive-notifier/engine';

export class PgNotificationLogStore {
  constructor(private readonly pool: pg.Pool) {}

  async list(opts?: {
    status?: string;
    category?: string;
    ruleId?: string;
    orgId?: string;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLogEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (opts?.status) { conditions.push(`status = $${idx++}`); params.push(opts.status); }
    if (opts?.category) { conditions.push(`category = $${idx++}`); params.push(opts.category); }
    if (opts?.ruleId) { conditions.push(`rule_id = $${idx++}`); params.push(opts.ruleId); }
    if (opts?.orgId) { conditions.push(`organization_id = $${idx++}`); params.push(opts.orgId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(opts?.limit ?? 100, 500);
    const offset = opts?.offset ?? 0;

    const { rows } = await this.pool.query(
      `SELECT * FROM proactive_notification_log ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return rows as NotificationLogEntry[];
  }

  async getById(id: string): Promise<NotificationLogEntry | null> {
    const { rows } = await this.pool.query(`SELECT * FROM proactive_notification_log WHERE id = $1`, [id]);
    return (rows[0] as NotificationLogEntry) ?? null;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const { rows } = await this.pool.query(
      `SELECT status, COUNT(*)::int AS count FROM proactive_notification_log GROUP BY status`,
    );
    const result: Record<string, number> = {};
    for (const row of rows as Array<{ status: string; count: number }>) {
      result[row.status] = row.count;
    }
    return result;
  }

  async stats(opts?: { orgId?: string; hoursBack?: number }): Promise<{
    total: number;
    delivered: number;
    failed: number;
    suppressed: number;
    by_category: Record<string, number>;
    by_channel: Record<string, number>;
    feedback_rate: number;
  }> {
    const hoursBack = opts?.hoursBack ?? 24;
    const conditions = [`created_at >= NOW() - INTERVAL '${hoursBack} hours'`];
    const params: unknown[] = [];
    let idx = 1;

    if (opts?.orgId) { conditions.push(`organization_id = $${idx++}`); params.push(opts.orgId); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [totals, byCategory, byChannel, feedback] = await Promise.all([
      this.pool.query(
        `SELECT status, COUNT(*)::int AS count FROM proactive_notification_log ${where} GROUP BY status`,
        params,
      ),
      this.pool.query(
        `SELECT category, COUNT(*)::int AS count FROM proactive_notification_log ${where} GROUP BY category`,
        params,
      ),
      this.pool.query(
        `SELECT channel, COUNT(*)::int AS count FROM proactive_notification_log ${where} GROUP BY channel`,
        params,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(feedback_action)::int AS with_feedback FROM proactive_notification_log ${where}`,
        params,
      ),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of totals.rows as Array<{ status: string; count: number }>) {
      statusCounts[row.status] = row.count;
    }

    const catCounts: Record<string, number> = {};
    for (const row of byCategory.rows as Array<{ category: string; count: number }>) {
      catCounts[row.category] = row.count;
    }

    const chanCounts: Record<string, number> = {};
    for (const row of byChannel.rows as Array<{ channel: string; count: number }>) {
      chanCounts[row.channel] = row.count;
    }

    const feedbackRow = feedback.rows[0] as { total: number; with_feedback: number } | undefined;
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      delivered: statusCounts['delivered'] ?? 0,
      failed: statusCounts['failed'] ?? 0,
      suppressed: statusCounts['suppressed'] ?? 0,
      by_category: catCounts,
      by_channel: chanCounts,
      feedback_rate: feedbackRow && feedbackRow.total > 0
        ? Math.round((feedbackRow.with_feedback / feedbackRow.total) * 100) / 100
        : 0,
    };
  }
}
