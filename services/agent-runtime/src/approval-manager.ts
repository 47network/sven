import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, ApprovalCreatedEvent, NotifyPushEvent } from '@sven/shared';

const logger = createLogger('approval-manager');
const jc = JSONCodec();

interface CreateApprovalParams {
  chat_id: string;
  tool_name: string;
  scope: string;
  requester_user_id: string;
  quorum_required: number;
  details: Record<string, unknown>;
  /** Custom expiry in ms (default: 1h). Tier 3 HA actions use shorter expiry. */
  expires_in_ms?: number;
}

interface ApprovalVoteContext {
  chatId?: string;
}

export class ApprovalManager {
  private expirationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private pool: pg.Pool,
    private nc: NatsConnection,
  ) {}

  async createApproval(params: CreateApprovalParams): Promise<string> {
    const id = uuidv7();
    const expiryMs = params.expires_in_ms ?? 60 * 60 * 1000; // 1 hour default
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.pool.query(
      `INSERT INTO approvals (id, chat_id, tool_name, scope, requester_user_id, quorum_required, expires_at, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [id, params.chat_id, params.tool_name, params.scope, params.requester_user_id, params.quorum_required, expiresAt, JSON.stringify(params.details)],
    );

    // Publish approval event
    const envelope: EventEnvelope<ApprovalCreatedEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        approval_id: id,
        chat_id: params.chat_id,
        tool_name: params.tool_name,
        scope: params.scope,
        requester_user_id: params.requester_user_id,
        quorum_required: params.quorum_required,
        expires_at: expiresAt.toISOString(),
        details: params.details,
      },
    };

    try {
      this.nc.publish(NATS_SUBJECTS.APPROVAL_CREATED, jc.encode(envelope));
    } catch (pubErr) {
      logger.error('Failed to publish approval created event', {
        approval_id: id,
        err: String(pubErr),
      });
    }

    const notifyEnvelope: EventEnvelope<NotifyPushEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'approval.pending',
        channel: 'outbox',
        title: 'Approval Required',
        body: `Tool "${params.tool_name}" requests approval for scope "${params.scope}".\n\nApprove: /approve ${id}\nDeny: /deny ${id}`,
        data: {
          approval_id: id,
          chat_id: params.chat_id,
          tool_name: params.tool_name,
          scope: params.scope,
          quorum_required: params.quorum_required,
          expires_at: expiresAt.toISOString(),
          actions: [
            { id: 'approve', label: 'Approve', value: id },
            { id: 'deny', label: 'Deny', value: id },
          ],
          commands: {
            approve: `/approve ${id}`,
            deny: `/deny ${id}`,
          },
        },
        priority: 'high',
      },
    };

    try {
      this.nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(notifyEnvelope));
    } catch (pubErr) {
      logger.error('Failed to publish approval notify event', {
        approval_id: id,
        err: String(pubErr),
      });
    }
    logger.info('Approval created', {
      approval_id: id,
      tool: params.tool_name,
      scope: params.scope,
      expires_at: expiresAt.toISOString(),
    });
    return id;
  }

  async vote(
    approvalId: string,
    voterUserId: string,
    vote: 'approve' | 'deny',
    context: ApprovalVoteContext = {},
  ): Promise<void> {
    const client = await this.pool.connect();
    let newStatus: string | null = null;
    let resolvedApproves = 0;
    let resolvedDenies = 0;
    let expiredInline = false;

    try {
      await client.query('BEGIN');

      // Lock the approval row to prevent concurrent vote-count races
      const approvalRes = context.chatId
        ? await client.query(
          `SELECT id, status, quorum_required, expires_at, requester_user_id
             FROM approvals
            WHERE id = $1
              AND chat_id = $2
            FOR UPDATE`,
          [approvalId, context.chatId],
        )
        : await client.query(
          `SELECT id, status, quorum_required, expires_at, requester_user_id
             FROM approvals
            WHERE id = $1
            FOR UPDATE`,
          [approvalId],
        );

      if (approvalRes.rows.length === 0) {
        throw new Error(`Approval ${approvalId} not found`);
      }

      const approval = approvalRes.rows[0];

      if (approval.status !== 'pending') {
        throw new Error(`Approval ${approvalId} is already ${approval.status}`);
      }

      // Check expiry — handle within the same transaction
      if (new Date(approval.expires_at) < new Date()) {
        await client.query(
          `UPDATE approvals SET status = 'expired', resolved_at = NOW() WHERE id = $1`,
          [approvalId],
        );
        await client.query('COMMIT');
        expiredInline = true;

        try {
          this.nc.publish(
            NATS_SUBJECTS.APPROVAL_UPDATED,
            jc.encode({
              schema_version: '1.0',
              event_id: uuidv7(),
              occurred_at: new Date().toISOString(),
              data: {
                approval_id: approvalId,
                voter_user_id: 'system',
                vote: 'deny',
                status: 'expired',
              },
            }),
          );
        } catch (pubErr) {
          logger.error('Failed to publish approval expiry event', {
            approval_id: approvalId,
            err: String(pubErr),
          });
        }
        logger.info('Approval expired', { approval_id: approvalId });
        throw new Error(`Approval ${approvalId} has expired`);
      }

      // Prevent self-approval
      if (approval.requester_user_id === voterUserId) {
        throw new Error('Requester cannot vote on their own approval');
      }

      const voteId = uuidv7();

      // Record vote (upsert)
      await client.query(
        `INSERT INTO approval_votes (id, approval_id, voter_user_id, vote, voted_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (approval_id, voter_user_id) DO UPDATE SET vote = $4, voted_at = NOW()`,
        [voteId, approvalId, voterUserId, vote],
      );

      // Count votes — atomic within the locked transaction
      const countRes = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE vote = 'approve')::int as approves,
           COUNT(*) FILTER (WHERE vote = 'deny')::int as denies
         FROM approval_votes WHERE approval_id = $1`,
        [approvalId],
      );

      resolvedApproves = countRes.rows[0].approves;
      resolvedDenies = countRes.rows[0].denies;
      const { approves, denies } = countRes.rows[0];
      const quorum = approval.quorum_required;

      // Evaluate outcome — deny-first, then quorum check
      if (denies > 0) {
        newStatus = 'denied';
      } else if (approves >= quorum) {
        newStatus = 'approved';
      }

      if (newStatus) {
        await client.query(
          `UPDATE approvals SET status = $1, votes_approve = $2, votes_deny = $3, resolved_at = NOW()
           WHERE id = $4`,
          [newStatus, resolvedApproves, resolvedDenies, approvalId],
        );
      } else {
        await client.query(
          `UPDATE approvals SET votes_approve = $1, votes_deny = $2 WHERE id = $3`,
          [resolvedApproves, resolvedDenies, approvalId],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      if (!expiredInline) {
        await client.query('ROLLBACK').catch(() => {});
      }
      throw err;
    } finally {
      client.release();
    }

    // Publish NATS event after commit — not inside the transaction
    if (newStatus) {
      try {
        this.nc.publish(
          NATS_SUBJECTS.APPROVAL_UPDATED,
          jc.encode({
            schema_version: '1.0',
            event_id: uuidv7(),
            occurred_at: new Date().toISOString(),
            data: {
              approval_id: approvalId,
              voter_user_id: voterUserId,
              vote,
              status: newStatus,
            },
          }),
        );
      } catch (pubErr) {
        logger.error('Failed to publish approval resolution event', {
          approval_id: approvalId,
          status: newStatus,
          err: String(pubErr),
        });
      }

      logger.info('Approval resolved', { approval_id: approvalId, status: newStatus });
    }
  }

  /**
   * Expire a single approval and publish the event.
   */
  private async expireApproval(approvalId: string): Promise<void> {
    await this.pool.query(
      `UPDATE approvals SET status = 'expired', resolved_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [approvalId],
    );
    try {
      this.nc.publish(
        NATS_SUBJECTS.APPROVAL_UPDATED,
        jc.encode({
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            approval_id: approvalId,
            voter_user_id: 'system',
            vote: 'deny',
            status: 'expired',
          },
        }),
      );
    } catch (pubErr) {
      logger.error('Failed to publish approval expiry event', {
        approval_id: approvalId,
        err: String(pubErr),
      });
    }
    logger.info('Approval expired', { approval_id: approvalId });
  }

  /**
   * Start the expiration worker that periodically checks for and expires timed-out approvals.
   * Runs every 30 seconds.
   */
  startExpirationWorker(): void {
    if (this.expirationTimer) return;

    const runExpiration = async () => {
      try {
        // Find all pending approvals past their expiry
        const res = await this.pool.query(
          `SELECT id FROM approvals
           WHERE status = 'pending' AND expires_at < NOW()
           ORDER BY expires_at ASC
           LIMIT 100`,
        );

        if (res.rows.length > 0) {
          logger.info('Expiring approvals', { count: res.rows.length });
          for (const row of res.rows) {
            try {
              await this.expireApproval(row.id);
            } catch (itemErr) {
              logger.error('Failed to expire individual approval', {
                approval_id: row.id,
                err: String(itemErr),
              });
            }
          }
        }
      } catch (err) {
        logger.error('Expiration worker error', { err: String(err) });
      }
    };

    // Run immediately, then every 30 seconds
    runExpiration();
    this.expirationTimer = setInterval(runExpiration, 30_000);
    logger.info('Approval expiration worker started (30s interval)');
  }

  /**
   * Stop the expiration worker.
   */
  stopExpirationWorker(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
      this.expirationTimer = null;
      logger.info('Approval expiration worker stopped');
    }
  }
}
