import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

const VALID_ENTRY_TYPES = ['learned', 'improved', 'fixed', 'observed', 'milestone', 'community'] as const;
const VALID_VISIBILITY = ['public', 'community', 'admin_only'] as const;

interface ChangelogEntry {
  id: string;
  organization_id: string;
  author_agent_id: string | null;
  entry_type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  visibility: string;
  published_at: string | null;
  created_at: string;
}

/**
 * Transparency Changelog Service.
 * Sven writes own public changelog in first person:
 * "Today I learned to handle..." / "I improved my understanding of..."
 * Community agents are the authors of this story.
 */
export class TransparencyChangelogService {
  constructor(private pool: pg.Pool) {}

  async createEntry(
    organizationId: string,
    input: {
      author_agent_id?: string;
      entry_type: string;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
      visibility?: string;
      publish_immediately?: boolean;
    },
  ): Promise<ChangelogEntry> {
    const entryType = input.entry_type?.trim().toLowerCase();
    if (!VALID_ENTRY_TYPES.includes(entryType as any)) {
      throw new Error(`Invalid entry type: ${entryType}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
    }
    if (!input.title?.trim()) throw new Error('Title is required');
    if (input.title.trim().length > 500) throw new Error('Title must be ≤500 characters');
    if (!input.body?.trim()) throw new Error('Body is required');
    if (input.body.trim().length > 10000) throw new Error('Body must be ≤10000 characters');

    const visibility = (input.visibility || 'public').trim().toLowerCase();
    if (!VALID_VISIBILITY.includes(visibility as any)) {
      throw new Error(`Invalid visibility: ${visibility}`);
    }

    const id = uuidv7();
    const publishedAt = input.publish_immediately ? 'NOW()' : 'NULL';

    const result = await this.pool.query(
      `INSERT INTO transparency_changelog (
        id, organization_id, author_agent_id, entry_type,
        title, body, metadata, visibility, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${input.publish_immediately ? 'NOW()' : 'NULL'})
      RETURNING *`,
      [
        id,
        organizationId,
        input.author_agent_id || null,
        entryType,
        input.title.trim(),
        input.body.trim(),
        JSON.stringify(input.metadata || {}),
        visibility,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async publishEntry(organizationId: string, entryId: string): Promise<ChangelogEntry | null> {
    const result = await this.pool.query(
      `UPDATE transparency_changelog
       SET published_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND published_at IS NULL
       RETURNING *`,
      [entryId, organizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listEntries(
    organizationId: string,
    options?: {
      entry_type?: string;
      visibility?: string;
      published_only?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ entries: ChangelogEntry[]; total: number }> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (options?.entry_type) {
      conditions.push(`entry_type = $${idx++}`);
      params.push(options.entry_type.trim().toLowerCase());
    }
    if (options?.visibility) {
      conditions.push(`visibility = $${idx++}`);
      params.push(options.visibility.trim().toLowerCase());
    }
    if (options?.published_only !== false) {
      conditions.push('published_at IS NOT NULL');
    }

    const where = conditions.join(' AND ');
    const limit = Math.min(Math.max(options?.limit || 50, 1), 200);
    const offset = Math.max(options?.offset || 0, 0);

    const [data, count] = await Promise.all([
      this.pool.query(
        `SELECT * FROM transparency_changelog WHERE ${where}
         ORDER BY COALESCE(published_at, created_at) DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM transparency_changelog WHERE ${where}`,
        params,
      ),
    ]);

    return {
      entries: data.rows.map((r: any) => this.mapRow(r)),
      total: count.rows[0]?.total || 0,
    };
  }

  async getEntry(organizationId: string, entryId: string): Promise<ChangelogEntry | null> {
    const result = await this.pool.query(
      `SELECT * FROM transparency_changelog WHERE id = $1 AND organization_id = $2`,
      [entryId, organizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: any): ChangelogEntry {
    return {
      id: row.id,
      organization_id: row.organization_id,
      author_agent_id: row.author_agent_id,
      entry_type: row.entry_type,
      title: row.title,
      body: row.body,
      metadata: row.metadata || {},
      visibility: row.visibility,
      published_at: row.published_at,
      created_at: row.created_at,
    };
  }
}
