import pg from 'pg';
import type { ChannelEndpoint, ChannelType } from '@sven/proactive-notifier/channels';
import type { NotificationSeverity } from '@sven/proactive-notifier/triggers';

export class PgChannelEndpointStore {
  constructor(private readonly pool: pg.Pool) {}

  async list(opts?: { channel?: ChannelType; enabled?: boolean; orgId?: string; limit?: number }): Promise<ChannelEndpoint[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (opts?.channel) { conditions.push(`channel = $${idx++}`); params.push(opts.channel); }
    if (opts?.enabled !== undefined) { conditions.push(`enabled = $${idx++}`); params.push(opts.enabled); }
    if (opts?.orgId) { conditions.push(`(organization_id = $${idx++} OR organization_id IS NULL)`); params.push(opts.orgId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(opts?.limit ?? 200, 500);

    const { rows } = await this.pool.query(
      `SELECT * FROM proactive_channel_endpoints ${where} ORDER BY channel, label LIMIT ${limit}`,
      params,
    );
    return rows as ChannelEndpoint[];
  }

  async getById(id: string): Promise<ChannelEndpoint | null> {
    const { rows } = await this.pool.query(`SELECT * FROM proactive_channel_endpoints WHERE id = $1`, [id]);
    return (rows[0] as ChannelEndpoint) ?? null;
  }

  async create(endpoint: Omit<ChannelEndpoint, 'created_at' | 'updated_at'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO proactive_channel_endpoints (id, channel, channel_chat_id, label, enabled, min_severity, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [endpoint.id, endpoint.channel, endpoint.channel_chat_id, endpoint.label, endpoint.enabled, endpoint.min_severity, endpoint.organization_id],
    );
  }

  async update(id: string, patch: Partial<Pick<ChannelEndpoint, 'label' | 'enabled' | 'min_severity' | 'channel_chat_id'>>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (patch.label !== undefined) { sets.push(`label = $${idx++}`); params.push(patch.label); }
    if (patch.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(patch.enabled); }
    if (patch.min_severity !== undefined) { sets.push(`min_severity = $${idx++}`); params.push(patch.min_severity); }
    if (patch.channel_chat_id !== undefined) { sets.push(`channel_chat_id = $${idx++}`); params.push(patch.channel_chat_id); }

    if (sets.length === 0) return;
    sets.push(`updated_at = NOW()`);

    await this.pool.query(
      `UPDATE proactive_channel_endpoints SET ${sets.join(', ')} WHERE id = $${idx}`,
      [...params, id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM proactive_channel_endpoints WHERE id = $1`, [id]);
  }
}
