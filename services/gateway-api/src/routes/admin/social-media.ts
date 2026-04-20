// ---------------------------------------------------------------------------
// Admin API — Social Media Management (Batch 25)
// ---------------------------------------------------------------------------
// CRUD for social accounts, posts, campaigns, analytics, and content calendar.
// ---------------------------------------------------------------------------

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch { /* silent */ }
}

export function registerSocialMediaRoutes(app: FastifyInstance, pool: pg.Pool, nc?: NatsConnection | null): void {
  const nats = nc ?? null;

  // ── Social Accounts ─────────────────────────────────────────────────────

  app.get('/social/accounts', async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT id, platform, account_name, display_name, followers_count, status,
              managed_by_agent, token_expires_at, account_meta, created_at, updated_at
       FROM social_accounts ORDER BY created_at DESC`,
    );
    return reply.send({ accounts: rows });
  });

  app.get<{ Params: { accountId: string } }>('/social/accounts/:accountId', async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM social_accounts WHERE id = $1', [req.params.accountId]);
    if (!rows.length) return reply.code(404).send({ error: 'Account not found' });
    return reply.send({ account: rows[0] });
  });

  app.post('/social/accounts', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId('sa');
    await pool.query(
      `INSERT INTO social_accounts (id, platform, account_name, display_name, access_token, refresh_token,
        token_expires_at, account_meta, status, managed_by_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, b.platform, b.accountName, b.displayName ?? '', b.accessToken ?? '',
       b.refreshToken ?? '', b.tokenExpiresAt ?? null, JSON.stringify(b.accountMeta ?? {}),
       b.status ?? 'pending_setup', b.managedByAgent ?? null],
    );
    publishNats(nats, 'sven.social.account_connected', { accountId: id, platform: b.platform });
    return reply.code(201).send({ id });
  });

  app.patch<{ Params: { accountId: string } }>('/social/accounts/:accountId', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const col of ['platform', 'account_name', 'display_name', 'access_token', 'refresh_token',
      'token_expires_at', 'followers_count', 'status', 'managed_by_agent']) {
      const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (b[camel] !== undefined) { sets.push(`${col} = $${idx}`); vals.push(b[camel]); idx++; }
    }
    if (b.accountMeta !== undefined) { sets.push(`account_meta = $${idx}`); vals.push(JSON.stringify(b.accountMeta)); idx++; }
    if (!sets.length) return reply.code(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = now()`);
    vals.push(req.params.accountId);
    await pool.query(`UPDATE social_accounts SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return reply.send({ updated: true });
  });

  app.delete<{ Params: { accountId: string } }>('/social/accounts/:accountId', async (req, reply) => {
    await pool.query(`UPDATE social_accounts SET status = 'revoked', updated_at = now() WHERE id = $1`, [req.params.accountId]);
    return reply.send({ revoked: true });
  });

  // ── Social Posts ────────────────────────────────────────────────────────

  app.get('/social/posts', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const conditions = ['1=1'];
    const vals: unknown[] = [];
    let idx = 1;
    if (q.accountId) { conditions.push(`account_id = $${idx++}`); vals.push(q.accountId); }
    if (q.status) { conditions.push(`status = $${idx++}`); vals.push(q.status); }
    if (q.campaignId) { conditions.push(`campaign_id = $${idx++}`); vals.push(q.campaignId); }
    const { rows } = await pool.query(
      `SELECT * FROM social_posts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, vals,
    );
    return reply.send({ posts: rows });
  });

  app.get<{ Params: { postId: string } }>('/social/posts/:postId', async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM social_posts WHERE id = $1', [req.params.postId]);
    if (!rows.length) return reply.code(404).send({ error: 'Post not found' });
    const { rows: analytics } = await pool.query('SELECT * FROM social_analytics WHERE post_id = $1', [req.params.postId]);
    return reply.send({ post: rows[0], analytics });
  });

  app.post('/social/posts', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId('sp');
    await pool.query(
      `INSERT INTO social_posts (id, account_id, campaign_id, content_type, caption,
        media_urls, hashtags, scheduled_at, status, created_by_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, b.accountId, b.campaignId ?? null, b.contentType ?? 'image', b.caption ?? '',
       JSON.stringify(b.mediaUrls ?? []), JSON.stringify(b.hashtags ?? []),
       b.scheduledAt ?? null, b.status ?? 'draft', b.createdByAgent ?? null,
       JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nats, 'sven.social.post_created', { postId: id, accountId: b.accountId });
    return reply.code(201).send({ id });
  });

  app.patch<{ Params: { postId: string } }>('/social/posts/:postId', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const col of ['caption', 'content_type', 'scheduled_at', 'status', 'external_id', 'error_message']) {
      const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (b[camel] !== undefined) { sets.push(`${col} = $${idx}`); vals.push(b[camel]); idx++; }
    }
    if (b.mediaUrls !== undefined) { sets.push(`media_urls = $${idx}`); vals.push(JSON.stringify(b.mediaUrls)); idx++; }
    if (b.hashtags !== undefined) { sets.push(`hashtags = $${idx}`); vals.push(JSON.stringify(b.hashtags)); idx++; }
    if (b.metadata !== undefined) { sets.push(`metadata = $${idx}`); vals.push(JSON.stringify(b.metadata)); idx++; }
    if (!sets.length) return reply.code(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = now()`);
    vals.push(req.params.postId);
    await pool.query(`UPDATE social_posts SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return reply.send({ updated: true });
  });

  app.post<{ Params: { postId: string } }>('/social/posts/:postId/publish', async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM social_posts WHERE id = $1', [req.params.postId]);
    if (!rows.length) return reply.code(404).send({ error: 'Post not found' });
    const post = rows[0];
    if (post.status !== 'draft' && post.status !== 'scheduled') {
      return reply.code(400).send({ error: `Cannot publish post with status '${post.status}'` });
    }
    await pool.query(
      `UPDATE social_posts SET status = 'published', published_at = now(), updated_at = now() WHERE id = $1`,
      [req.params.postId],
    );
    publishNats(nats, 'sven.social.post_published', { postId: req.params.postId, accountId: post.account_id });
    return reply.send({ published: true });
  });

  app.delete<{ Params: { postId: string } }>('/social/posts/:postId', async (req, reply) => {
    await pool.query(`UPDATE social_posts SET status = 'deleted', updated_at = now() WHERE id = $1`, [req.params.postId]);
    return reply.send({ deleted: true });
  });

  // ── Social Campaigns ────────────────────────────────────────────────────

  app.get('/social/campaigns', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const conditions = ['1=1'];
    const vals: unknown[] = [];
    let idx = 1;
    if (q.status) { conditions.push(`status = $${idx++}`); vals.push(q.status); }
    if (q.goal) { conditions.push(`goal = $${idx++}`); vals.push(q.goal); }
    const { rows } = await pool.query(
      `SELECT * FROM social_campaigns WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, vals,
    );
    return reply.send({ campaigns: rows });
  });

  app.get<{ Params: { campaignId: string } }>('/social/campaigns/:campaignId', async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM social_campaigns WHERE id = $1', [req.params.campaignId]);
    if (!rows.length) return reply.code(404).send({ error: 'Campaign not found' });
    const { rows: posts } = await pool.query('SELECT * FROM social_posts WHERE campaign_id = $1 ORDER BY created_at DESC', [req.params.campaignId]);
    return reply.send({ campaign: rows[0], posts });
  });

  app.post('/social/campaigns', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId('sc');
    await pool.query(
      `INSERT INTO social_campaigns (id, name, description, goal, status, target_platforms,
        budget_tokens, start_date, end_date, managed_by_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, b.name, b.description ?? '', b.goal ?? 'engagement', b.status ?? 'planning',
       JSON.stringify(b.targetPlatforms ?? []), b.budgetTokens ?? 0,
       b.startDate ?? null, b.endDate ?? null, b.managedByAgent ?? null,
       JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nats, 'sven.social.campaign_started', { campaignId: id, name: b.name });
    return reply.code(201).send({ id });
  });

  app.patch<{ Params: { campaignId: string } }>('/social/campaigns/:campaignId', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const col of ['name', 'description', 'goal', 'status', 'budget_tokens', 'spent_tokens',
      'start_date', 'end_date', 'managed_by_agent']) {
      const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (b[camel] !== undefined) { sets.push(`${col} = $${idx}`); vals.push(b[camel]); idx++; }
    }
    if (b.targetPlatforms !== undefined) { sets.push(`target_platforms = $${idx}`); vals.push(JSON.stringify(b.targetPlatforms)); idx++; }
    if (b.metadata !== undefined) { sets.push(`metadata = $${idx}`); vals.push(JSON.stringify(b.metadata)); idx++; }
    if (!sets.length) return reply.code(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = now()`);
    vals.push(req.params.campaignId);
    await pool.query(`UPDATE social_campaigns SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return reply.send({ updated: true });
  });

  // ── Social Analytics ────────────────────────────────────────────────────

  app.get<{ Params: { postId: string } }>('/social/posts/:postId/analytics', async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT * FROM social_analytics WHERE post_id = $1 ORDER BY tracked_at DESC', [req.params.postId],
    );
    return reply.send({ analytics: rows });
  });

  app.post<{ Params: { postId: string } }>('/social/posts/:postId/analytics', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId('san');
    const { rows: postRows } = await pool.query('SELECT account_id FROM social_posts WHERE id = $1', [req.params.postId]);
    if (!postRows.length) return reply.code(404).send({ error: 'Post not found' });
    const impressions = Number(b.impressions ?? 0);
    const reach = Number(b.reach ?? 0);
    const likes = Number(b.likes ?? 0);
    const comments = Number(b.comments ?? 0);
    const shares = Number(b.shares ?? 0);
    const saves = Number(b.saves ?? 0);
    const clicks = Number(b.clicks ?? 0);
    const engagementRate = reach > 0 ? Number((((likes + comments + shares + saves) / reach) * 100).toFixed(4)) : 0;
    await pool.query(
      `INSERT INTO social_analytics (id, post_id, account_id, impressions, reach, likes, comments,
        shares, saves, clicks, engagement_rate, audience_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, req.params.postId, postRows[0].account_id, impressions, reach, likes, comments,
       shares, saves, clicks, engagementRate, JSON.stringify(b.audienceData ?? {})],
    );
    publishNats(nats, 'sven.social.engagement_milestone', { postId: req.params.postId, engagementRate });
    return reply.code(201).send({ id, engagementRate });
  });

  app.get('/social/analytics/overview', async (_req, reply) => {
    const { rows: [summary] } = await pool.query(
      `SELECT COUNT(*)::int AS total_posts,
              COALESCE(SUM(impressions), 0)::int AS total_impressions,
              COALESCE(SUM(reach), 0)::int AS total_reach,
              COALESCE(SUM(likes), 0)::int AS total_likes,
              COALESCE(SUM(comments), 0)::int AS total_comments,
              COALESCE(SUM(shares), 0)::int AS total_shares,
              COALESCE(AVG(engagement_rate), 0)::numeric(8,4) AS avg_engagement_rate
       FROM social_analytics`,
    );
    const { rows: byPlatform } = await pool.query(
      `SELECT sa2.platform,
              COUNT(*)::int AS post_count,
              COALESCE(SUM(san.likes), 0)::int AS total_likes,
              COALESCE(AVG(san.engagement_rate), 0)::numeric(8,4) AS avg_engagement
       FROM social_analytics san
       JOIN social_posts sp ON san.post_id = sp.id
       JOIN social_accounts sa2 ON sp.account_id = sa2.id
       GROUP BY sa2.platform`,
    );
    return reply.send({ summary, byPlatform });
  });

  // ── Content Calendar ────────────────────────────────────────────────────

  app.get('/social/calendar', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const conditions = ['1=1'];
    const vals: unknown[] = [];
    let idx = 1;
    if (q.from) { conditions.push(`planned_date >= $${idx++}`); vals.push(q.from); }
    if (q.to) { conditions.push(`planned_date <= $${idx++}`); vals.push(q.to); }
    if (q.status) { conditions.push(`status = $${idx++}`); vals.push(q.status); }
    if (q.category) { conditions.push(`category = $${idx++}`); vals.push(q.category); }
    const { rows } = await pool.query(
      `SELECT * FROM content_calendar WHERE ${conditions.join(' AND ')} ORDER BY planned_date ASC LIMIT 200`, vals,
    );
    return reply.send({ entries: rows });
  });

  app.post('/social/calendar', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId('cal');
    await pool.query(
      `INSERT INTO content_calendar (id, account_id, campaign_id, title, description, content_type,
        planned_date, status, assigned_agent, category, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, b.accountId ?? null, b.campaignId ?? null, b.title, b.description ?? '',
       b.contentType ?? 'image', b.plannedDate, b.status ?? 'planned',
       b.assignedAgent ?? null, b.category ?? 'promotional',
       JSON.stringify(b.metadata ?? {})],
    );
    return reply.code(201).send({ id });
  });

  app.patch<{ Params: { entryId: string } }>('/social/calendar/:entryId', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const col of ['title', 'description', 'content_type', 'planned_date', 'actual_post_id',
      'status', 'assigned_agent', 'category', 'account_id', 'campaign_id']) {
      const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (b[camel] !== undefined) { sets.push(`${col} = $${idx}`); vals.push(b[camel]); idx++; }
    }
    if (b.metadata !== undefined) { sets.push(`metadata = $${idx}`); vals.push(JSON.stringify(b.metadata)); idx++; }
    if (!sets.length) return reply.code(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = now()`);
    vals.push(req.params.entryId);
    await pool.query(`UPDATE content_calendar SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return reply.send({ updated: true });
  });

  app.delete<{ Params: { entryId: string } }>('/social/calendar/:entryId', async (req, reply) => {
    await pool.query(`UPDATE content_calendar SET status = 'skipped', updated_at = now() WHERE id = $1`, [req.params.entryId]);
    return reply.send({ skipped: true });
  });
}
