// ---------------------------------------------------------------------------
// Publishing Pipeline — Admin API routes for editorial workflow management.
// ---------------------------------------------------------------------------
// Provides CRUD for publishing projects, stage management with ordered
// progression, quality reviews with scoring, and book catalog publishing.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';
import {
  canAdvanceTo,
  stageTypeToProjectStatus,
  PUBLISHING_STATUS_ORDER,
  MIN_APPROVAL_SCORE,
} from '@sven/shared';
import type {
  PublishingStatus,
  EditorialStageType,
  StageStatus,
  BookFormat,
  QualityCategory,
} from '@sven/shared';

const logger = createLogger('publishing-api');

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

const VALID_STATUSES: PublishingStatus[] = [
  'manuscript', 'editing', 'proofreading', 'formatting',
  'cover_design', 'review', 'approved', 'published', 'rejected',
];

const VALID_STAGE_TYPES: EditorialStageType[] = [
  'editing', 'proofreading', 'formatting', 'cover_design', 'review', 'genre_research',
];

const VALID_FORMATS: BookFormat[] = [
  'epub', 'kindle_mobi', 'pdf', 'paperback', 'hardcover', 'audiobook',
];

const VALID_CATEGORIES: QualityCategory[] = [
  'grammar', 'style', 'plot', 'pacing', 'characters',
  'worldbuilding', 'formatting', 'cover', 'overall',
];

// ────────────────────────────── Route Registration ──────────────────────────────

export function registerPublishingRoutes(
  app: FastifyInstance,
  pool: Pool,
  nc?: NatsConnection | null,
): void {
  const natsConn = nc ?? null;

  // ── Project CRUD ──────────────────────────────────────────────────

  /** List publishing projects with optional filters. */
  app.get('/publishing/projects', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(Math.max(1, Number(q.limit) || 50), 200);
    const offset = Math.max(0, Number(q.offset) || 0);
    const values: unknown[] = [limit, offset];
    const clauses: string[] = [];

    if (q.status && VALID_STATUSES.includes(q.status as PublishingStatus)) {
      values.push(q.status); clauses.push(`status = $${values.length}`);
    }
    if (q.genre) {
      values.push(q.genre); clauses.push(`genre = $${values.length}`);
    }
    if (q.authorAgentId) {
      values.push(q.authorAgentId); clauses.push(`author_agent_id = $${values.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const res = await pool.query(
      `SELECT * FROM publishing_projects ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      values,
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM publishing_projects ${where}`,
      values.slice(2),
    );
    reply.send({ items: res.rows, total: countRes.rows[0]?.total ?? 0 });
  });

  /** Get single project with stages and reviews. */
  app.get('/publishing/projects/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const projRes = await pool.query('SELECT * FROM publishing_projects WHERE id = $1', [projectId]);
    if (!projRes.rows[0]) return reply.status(404).send({ error: 'Project not found' });

    const stagesRes = await pool.query(
      'SELECT * FROM editorial_stages WHERE project_id = $1 ORDER BY created_at ASC', [projectId],
    );
    const reviewsRes = await pool.query(
      'SELECT * FROM quality_reviews WHERE project_id = $1 ORDER BY created_at DESC', [projectId],
    );

    reply.send({
      project: projRes.rows[0],
      stages: stagesRes.rows,
      reviews: reviewsRes.rows,
    });
  });

  /** Create a new publishing project. */
  app.post('/publishing/projects', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const id = newId('pub');
    const orgId = String(body.orgId ?? 'default');
    const authorAgentId = String(body.authorAgentId ?? '');
    const title = String(body.title ?? '');
    const genre = String(body.genre ?? '');
    const language = String(body.language ?? 'en');
    const synopsis = body.synopsis ? String(body.synopsis) : null;
    const wordCount = Number(body.wordCount) || 0;
    const chapterCount = Number(body.chapterCount) || 0;
    const targetFormat = VALID_FORMATS.includes(body.targetFormat as BookFormat)
      ? (body.targetFormat as string) : 'epub';
    const manuscriptUrl = body.manuscriptUrl ? String(body.manuscriptUrl) : null;
    const metadata = body.metadata ?? {};

    if (!authorAgentId || !title || !genre) {
      return reply.status(400).send({ error: 'authorAgentId, title, and genre are required' });
    }

    await pool.query(
      `INSERT INTO publishing_projects
       (id, org_id, author_agent_id, title, genre, language, synopsis, word_count,
        chapter_count, target_format, manuscript_url, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [id, orgId, authorAgentId, title, genre, language, synopsis,
       wordCount, chapterCount, targetFormat, manuscriptUrl, JSON.stringify(metadata)],
    );

    publishNats(natsConn, 'sven.publishing.project_created', {
      projectId: id, title, genre, authorAgentId, language,
    });

    const res = await pool.query('SELECT * FROM publishing_projects WHERE id = $1', [id]);
    reply.status(201).send(res.rows[0]);
  });

  /** Update a publishing project. */
  app.patch('/publishing/projects/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const values: unknown[] = [];

    const allowedFields = ['title', 'genre', 'language', 'synopsis', 'word_count',
      'chapter_count', 'target_format', 'manuscript_url', 'metadata'];

    for (const field of allowedFields) {
      const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (body[camelKey] !== undefined) {
        values.push(field === 'metadata' ? JSON.stringify(body[camelKey]) : body[camelKey]);
        sets.push(`${field} = $${values.length}`);
      }
    }

    if (!sets.length) return reply.status(400).send({ error: 'No fields to update' });

    sets.push('updated_at = NOW()');
    values.push(projectId);
    await pool.query(
      `UPDATE publishing_projects SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values,
    );

    const res = await pool.query('SELECT * FROM publishing_projects WHERE id = $1', [projectId]);
    reply.send(res.rows[0] ?? { error: 'Project not found' });
  });

  /** Soft-delete (archive) a project. */
  app.delete('/publishing/projects/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    await pool.query(
      `UPDATE publishing_projects SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [projectId],
    );
    reply.send({ ok: true, projectId });
  });

  // ── Stage Management ────────────────────────────────────────────────

  /** Create the next editorial stage for a project. */
  app.post('/publishing/projects/:projectId/stages', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as Record<string, unknown>;
    const stageType = String(body.stageType ?? '') as EditorialStageType;

    if (!VALID_STAGE_TYPES.includes(stageType)) {
      return reply.status(400).send({ error: `Invalid stageType. Must be: ${VALID_STAGE_TYPES.join(', ')}` });
    }

    // Validate progression
    const projRes = await pool.query('SELECT status FROM publishing_projects WHERE id = $1', [projectId]);
    if (!projRes.rows[0]) return reply.status(404).send({ error: 'Project not found' });

    const currentStatus = projRes.rows[0].status as PublishingStatus;
    const targetStatus = stageTypeToProjectStatus(stageType);

    if (targetStatus && !canAdvanceTo(currentStatus, targetStatus)) {
      return reply.status(409).send({
        error: `Cannot advance from '${currentStatus}' to '${targetStatus}'. ` +
               `Valid next: ${PUBLISHING_STATUS_ORDER[PUBLISHING_STATUS_ORDER.indexOf(currentStatus) + 1] ?? 'none'}`,
      });
    }

    const id = newId('stg');
    const assignedAgentId = body.assignedAgentId ? String(body.assignedAgentId) : null;
    const inputData = body.inputData ?? {};
    const notes = body.notes ? String(body.notes) : null;

    await pool.query(
      `INSERT INTO editorial_stages (id, project_id, stage_type, assigned_agent_id, input_data, notes)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [id, projectId, stageType, assignedAgentId, JSON.stringify(inputData), notes],
    );

    // Advance project status
    if (targetStatus) {
      await pool.query(
        `UPDATE publishing_projects SET status = $2, updated_at = NOW() WHERE id = $1`,
        [projectId, targetStatus],
      );
    }

    publishNats(natsConn, 'sven.publishing.stage_advanced', {
      projectId, stageId: id, stageType, assignedAgentId,
    });

    const res = await pool.query('SELECT * FROM editorial_stages WHERE id = $1', [id]);
    reply.status(201).send(res.rows[0]);
  });

  /** Update a stage (assign agent, update status). */
  app.patch('/publishing/stages/:stageId', async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const body = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.assignedAgentId !== undefined) {
      values.push(body.assignedAgentId); sets.push(`assigned_agent_id = $${values.length}`);
    }
    if (body.status !== undefined) {
      const status = String(body.status) as StageStatus;
      values.push(status); sets.push(`status = $${values.length}`);
      if (status === 'in_progress') sets.push('started_at = NOW()');
      if (status === 'completed' || status === 'failed') sets.push('completed_at = NOW()');
    }
    if (body.outputData !== undefined) {
      values.push(JSON.stringify(body.outputData)); sets.push(`output_data = $${values.length}::jsonb`);
    }
    if (body.notes !== undefined) {
      values.push(body.notes); sets.push(`notes = $${values.length}`);
    }

    if (!sets.length) return reply.status(400).send({ error: 'No fields to update' });

    sets.push('updated_at = NOW()');
    values.push(stageId);
    await pool.query(
      `UPDATE editorial_stages SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values,
    );

    const res = await pool.query('SELECT * FROM editorial_stages WHERE id = $1', [stageId]);
    reply.send(res.rows[0] ?? { error: 'Stage not found' });
  });

  /** Complete a stage and optionally auto-create the next one. */
  app.post('/publishing/stages/:stageId/complete', async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const body = req.body as Record<string, unknown>;

    // Mark stage as completed
    await pool.query(
      `UPDATE editorial_stages SET status = 'completed', completed_at = NOW(), updated_at = NOW(),
       output_data = COALESCE($2::jsonb, output_data)
       WHERE id = $1`,
      [stageId, body.outputData ? JSON.stringify(body.outputData) : null],
    );

    const stageRes = await pool.query('SELECT * FROM editorial_stages WHERE id = $1', [stageId]);
    const stage = stageRes.rows[0];
    if (!stage) return reply.status(404).send({ error: 'Stage not found' });

    // Check if we should auto-create next stage
    const autoAdvance = body.autoAdvance !== false;
    let nextStage = null;

    if (autoAdvance) {
      const projRes = await pool.query('SELECT status FROM publishing_projects WHERE id = $1', [stage.project_id]);
      const currentStatus = projRes.rows[0]?.status as PublishingStatus;
      const currentIdx = PUBLISHING_STATUS_ORDER.indexOf(currentStatus);

      if (currentIdx >= 0 && currentIdx < PUBLISHING_STATUS_ORDER.length - 1) {
        const nextStatus = PUBLISHING_STATUS_ORDER[currentIdx + 1];
        // Map status back to stage type
        const stageMap: Record<string, EditorialStageType> = {
          proofreading: 'proofreading', formatting: 'formatting',
          cover_design: 'cover_design', review: 'review',
        };
        const nextStageType = stageMap[nextStatus];
        if (nextStageType) {
          const nextId = newId('stg');
          await pool.query(
            `INSERT INTO editorial_stages (id, project_id, stage_type) VALUES ($1,$2,$3)`,
            [nextId, stage.project_id, nextStageType],
          );
          await pool.query(
            `UPDATE publishing_projects SET status = $2, updated_at = NOW() WHERE id = $1`,
            [stage.project_id, nextStatus],
          );
          const nextRes = await pool.query('SELECT * FROM editorial_stages WHERE id = $1', [nextId]);
          nextStage = nextRes.rows[0];

          publishNats(natsConn, 'sven.publishing.stage_advanced', {
            projectId: stage.project_id, stageId: nextId, stageType: nextStageType, auto: true,
          });
        }
      }
    }

    reply.send({ completedStage: stage, nextStage });
  });

  // ── Quality Reviews ────────────────────────────────────────────────

  /** Submit a quality review for a stage. */
  app.post('/publishing/stages/:stageId/reviews', async (req, reply) => {
    const { stageId } = req.params as { stageId: string };
    const body = req.body as Record<string, unknown>;

    const stageRes = await pool.query('SELECT project_id FROM editorial_stages WHERE id = $1', [stageId]);
    if (!stageRes.rows[0]) return reply.status(404).send({ error: 'Stage not found' });

    const projectId = stageRes.rows[0].project_id;
    const id = newId('qr');
    const reviewerAgentId = String(body.reviewerAgentId ?? '');
    const score = Math.min(100, Math.max(0, Number(body.score) || 0));
    const category = VALID_CATEGORIES.includes(body.category as QualityCategory)
      ? String(body.category) : 'overall';
    const feedback = body.feedback ? String(body.feedback) : null;
    const approved = score >= MIN_APPROVAL_SCORE;
    const criteria = body.criteria ?? {};

    if (!reviewerAgentId) {
      return reply.status(400).send({ error: 'reviewerAgentId is required' });
    }

    await pool.query(
      `INSERT INTO quality_reviews (id, stage_id, project_id, reviewer_agent_id, score, category, feedback, approved, criteria)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [id, stageId, projectId, reviewerAgentId, score, category, feedback, approved, JSON.stringify(criteria)],
    );

    publishNats(natsConn, 'sven.publishing.review_submitted', {
      reviewId: id, stageId, projectId, reviewerAgentId, score, category, approved,
    });

    const res = await pool.query('SELECT * FROM quality_reviews WHERE id = $1', [id]);
    reply.status(201).send(res.rows[0]);
  });

  /** Get all reviews for a project. */
  app.get('/publishing/projects/:projectId/reviews', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const res = await pool.query(
      'SELECT * FROM quality_reviews WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId],
    );
    reply.send({ items: res.rows, total: res.rows.length });
  });

  // ── Book Catalog ───────────────────────────────────────────────────

  /** Publish a book — creates catalog entry + marketplace listing. */
  app.post('/publishing/projects/:projectId/publish', async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as Record<string, unknown>;

    const projRes = await pool.query('SELECT * FROM publishing_projects WHERE id = $1', [projectId]);
    const project = projRes.rows[0];
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    if (project.status !== 'approved' && project.status !== 'review') {
      return reply.status(409).send({
        error: `Project must be in 'approved' or 'review' status to publish. Current: '${project.status}'`,
      });
    }

    const catalogId = newId('book');
    const isbn = body.isbn ? String(body.isbn) : null;
    const coverUrl = body.coverUrl ? String(body.coverUrl) : null;
    const format = VALID_FORMATS.includes(body.format as BookFormat)
      ? String(body.format) : project.target_format;
    const pageCount = Number(body.pageCount) || 0;
    const price = Number(body.price) || 9.99;

    // Create marketplace listing for the book
    const listingId = newId('lst');
    const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);

    await pool.query(
      `INSERT INTO marketplace_listings
       (id, org_id, seller_agent_id, slug, title, description, kind, pricing_model,
        unit_price, currency, tags, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'digital_good','one_time',$7,'EUR',
        $8::text[],'published',$9::jsonb)`,
      [listingId, project.org_id, project.author_agent_id, slug,
       project.title,
       project.synopsis || `${project.title} — a ${project.genre} book`,
       price,
       `{${project.genre},book,${project.language}}`,
       JSON.stringify({
         bookMeta: {
           genre: project.genre,
           language: project.language,
           wordCount: project.word_count,
           chapterCount: project.chapter_count,
           isbn,
           format,
           pageCount,
           projectId,
         },
       })],
    );

    // Create catalog entry
    await pool.query(
      `INSERT INTO book_catalog (id, project_id, listing_id, isbn, cover_url, format, page_count, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [catalogId, projectId, listingId, isbn, coverUrl, format, pageCount,
       JSON.stringify(body.metadata ?? {})],
    );

    // Update project status
    await pool.query(
      `UPDATE publishing_projects SET status = 'published', updated_at = NOW() WHERE id = $1`,
      [projectId],
    );

    publishNats(natsConn, 'sven.publishing.book_published', {
      catalogId, projectId, listingId, title: project.title,
      genre: project.genre, authorAgentId: project.author_agent_id,
    });

    reply.status(201).send({ catalogId, listingId, projectId });
  });

  /** List published books in the catalog. */
  app.get('/publishing/catalog', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(Math.max(1, Number(q.limit) || 50), 200);
    const offset = Math.max(0, Number(q.offset) || 0);

    const res = await pool.query(
      `SELECT bc.*, pp.title, pp.genre, pp.language, pp.author_agent_id, pp.synopsis
       FROM book_catalog bc
       JOIN publishing_projects pp ON pp.id = bc.project_id
       ORDER BY bc.published_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM book_catalog');

    reply.send({ items: res.rows, total: countRes.rows[0]?.total ?? 0 });
  });
}
