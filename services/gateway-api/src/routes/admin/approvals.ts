import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { JSONCodec, NatsConnection } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { NATS_SUBJECTS } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';

const jc = JSONCodec();

function normalizeConfirmPhrase(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function expectedConfirmPhraseFromDetails(details: unknown): string {
  if (!details || typeof details !== 'object') return '';
  const rec = details as Record<string, unknown>;
  return String(rec.confirm_phrase || rec.expected_confirm_phrase || '').trim();
}

function normalizeApprovalBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

export async function registerApprovalRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  // ─── GET /approvals ───
  app.get('/approvals', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = request.query as { status?: string; page?: string; per_page?: string };
    const pagination = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage: 100 });
    if (!pagination.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: pagination.message },
      });
    }
    const { page, perPage, offset } = pagination;

    let sql = `SELECT a.*
               FROM approvals a
               JOIN chats c ON c.id = a.chat_id
               WHERE c.organization_id = $1`;
    const params: unknown[] = [orgId];

    if (query.status) {
      params.push(query.status);
      sql += ` AND a.status = $${params.length}`;
    }

    const countSql = `SELECT COUNT(*)::int AS count
                      FROM approvals a
                      JOIN chats c ON c.id = a.chat_id
                      WHERE c.organization_id = $1` + (query.status ? ` AND a.status = $2` : '');
    const countRes = await pool.query(countSql, query.status ? [orgId, query.status] : [orgId]);
    const total: number = countRes.rows[0].count;

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(perPage, offset);

    const result = await pool.query(sql, params);

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  // ─── GET /approvals/:id ───
  app.get('/approvals/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };

    const approval = await pool.query(
      `SELECT a.*
       FROM approvals a
       JOIN chats c ON c.id = a.chat_id
       WHERE a.id = $1 AND c.organization_id = $2`,
      [id, orgId],
    );
    if (approval.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } });
      return;
    }

    const votes = await pool.query(
      `SELECT av.*, u.username FROM approval_votes av JOIN users u ON av.voter_user_id = u.id
       WHERE av.approval_id = $1 ORDER BY av.voted_at`,
      [id],
    );

    reply.send({ success: true, data: { ...approval.rows[0], votes: votes.rows } });
  });

  // ─── POST /approvals/:id/vote ───
  app.post('/approvals/:id/vote', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeApprovalBody<{ vote?: 'approve' | 'deny'; reason?: string; confirm_phrase?: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
    }
    const body = bodyParsed.value;
    const vote = body.vote;
    const reason = String(body.reason || '').trim();
    const confirmPhrase = String(body.confirm_phrase || '').trim();
    const voterUserId = (request as any).userId as string | undefined;

    if (!vote || (vote !== 'approve' && vote !== 'deny')) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'vote must be approve|deny' },
      });
      return;
    }
    if (!reason) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'reason is required' },
      });
      return;
    }
    if (!voterUserId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const approvalRes = await client.query(
        `SELECT a.id, a.status, a.quorum_required, a.votes_approve, a.votes_deny, a.details, a.expires_at, a.requester_user_id
         FROM approvals a
         JOIN chats c ON c.id = a.chat_id
         WHERE a.id = $1 AND c.organization_id = $2
         FOR UPDATE`,
        [id, orgId],
      );
      if (approvalRes.rows.length === 0) {
        await client.query('ROLLBACK');
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Approval not found' },
        });
        return;
      }

      const approval = approvalRes.rows[0];
      if (String(approval.requester_user_id || '') === String(voterUserId)) {
        await client.query('ROLLBACK');
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Requester cannot vote on own approval' },
        });
        return;
      }
      if (approval.status !== 'pending') {
        await client.query('ROLLBACK');
        reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: `Approval already ${approval.status}` },
        });
        return;
      }
      const expiresAtMs = approval.expires_at ? Date.parse(String(approval.expires_at)) : NaN;
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        await client.query(
          `UPDATE approvals
           SET status = 'expired',
               resolved_at = COALESCE(resolved_at, NOW())
           WHERE id = $1
             AND status = 'pending'`,
          [id],
        );
        await client.query('COMMIT');
        reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Approval already expired' },
        });
        return;
      }
      const expectedConfirmPhrase = expectedConfirmPhraseFromDetails(approval.details);
      if (expectedConfirmPhrase.length > 0) {
        if (!confirmPhrase) {
          await client.query('ROLLBACK');
          reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION', message: 'confirm_phrase is required for this approval' },
          });
          return;
        }
        if (normalizeConfirmPhrase(confirmPhrase) !== normalizeConfirmPhrase(expectedConfirmPhrase)) {
          await client.query('ROLLBACK');
          reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION', message: 'confirm_phrase does not match required approval phrase' },
          });
          return;
        }
      }
      const confirmPhraseVerified = expectedConfirmPhrase.length > 0 ? true : null;

      await client.query(
        `INSERT INTO approval_votes (id, approval_id, voter_user_id, vote, reason, confirm_phrase, voted_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (approval_id, voter_user_id) DO UPDATE
         SET vote = EXCLUDED.vote,
             reason = EXCLUDED.reason,
             confirm_phrase = EXCLUDED.confirm_phrase,
             voted_at = NOW()`,
        [uuidv7(), id, voterUserId, vote, reason, null],
      );

      const votesRes = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE vote = 'approve')::int AS votes_approve,
           COUNT(*) FILTER (WHERE vote = 'deny')::int AS votes_deny
         FROM approval_votes
         WHERE approval_id = $1`,
        [id],
      );
      const votesApprove = votesRes.rows[0].votes_approve;
      const votesDeny = votesRes.rows[0].votes_deny;

      let nextStatus = 'pending';
      if (votesApprove >= approval.quorum_required) {
        nextStatus = 'approved';
      } else if (votesDeny > 0) {
        nextStatus = 'denied';
      }

      await client.query(
        `UPDATE approvals
         SET votes_approve = $2,
             votes_deny = $3,
             status = $4,
             details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
               'last_vote_by', $5::text,
               'last_vote_confirmation_verified', $6::boolean,
               'last_vote_at', NOW()::text
             ),
             resolved_at = CASE WHEN $4 IN ('approved', 'denied') THEN NOW() ELSE resolved_at END
         WHERE id = $1`,
        [id, votesApprove, votesDeny, nextStatus, voterUserId, confirmPhraseVerified],
      );

      await client.query('COMMIT');
      nc.publish(
        NATS_SUBJECTS.APPROVAL_UPDATED,
        jc.encode({
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            approval_id: id,
            voter_user_id: voterUserId,
            vote,
            status: nextStatus,
          },
        }),
      );
      reply.send({
        success: true,
        data: {
          approval_id: id,
          status: nextStatus,
          votes_approve: votesApprove,
          votes_deny: votesDeny,
          confirm_phrase_verified: confirmPhraseVerified,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
