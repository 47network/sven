import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.5 Agent Delegation Service
 * Enables cross-instance agent consultation: one user's Sven agent
 * can consult another user's Sven agent (with permission) to solve
 * problems neither could alone.
 */

interface AgentDelegation {
  id: string;
  organization_id: string;
  local_agent_id: string;
  remote_peer_id: string;
  remote_agent_id: string | null;
  task_description: string;
  task_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  status: string;
  timeout_ms: number;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export class AgentDelegationService {
  constructor(private pool: pg.Pool) {}

  /**
   * Create a delegation request to a remote agent.
   */
  async createDelegation(
    organizationId: string,
    input: {
      local_agent_id: string;
      remote_peer_id: string;
      remote_agent_id?: string;
      task_description: string;
      task_payload?: Record<string, unknown>;
      timeout_ms?: number;
    },
  ): Promise<AgentDelegation> {
    if (!input.local_agent_id?.trim()) throw new Error('Local agent ID is required');
    if (!input.remote_peer_id?.trim()) throw new Error('Remote peer ID is required');
    if (!input.task_description?.trim()) throw new Error('Task description is required');

    // Verify peer exists, is active, and at least verified trust
    const peer = await this.pool.query(
      `SELECT id, status, trust_level FROM federation_peers
       WHERE id = $1 AND organization_id = $2`,
      [input.remote_peer_id, organizationId],
    );
    if (!peer.rows[0]) throw new Error('Remote peer not found');
    if (peer.rows[0].status !== 'active') throw new Error('Remote peer is not active');
    if (!['verified', 'trusted'].includes(peer.rows[0].trust_level)) {
      throw new Error('Remote peer must be verified or trusted for agent delegation');
    }

    const timeoutMs = Math.min(Math.max(input.timeout_ms || 30000, 5000), 120000);

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_agent_delegations (
        id, organization_id, local_agent_id, remote_peer_id,
        remote_agent_id, task_description, task_payload,
        status, timeout_ms, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW(), NOW())
      RETURNING *`,
      [
        id,
        organizationId,
        input.local_agent_id,
        input.remote_peer_id,
        input.remote_agent_id || null,
        input.task_description.trim(),
        JSON.stringify(input.task_payload || {}),
        timeoutMs,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update delegation status (for incoming status updates from remote peer).
   */
  async updateStatus(
    organizationId: string,
    delegationId: string,
    status: string,
    responsePayload?: Record<string, unknown>,
  ): Promise<AgentDelegation> {
    const validStatuses = ['sent', 'accepted', 'in_progress', 'completed', 'failed', 'rejected', 'timeout'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const isTerminal = ['completed', 'failed', 'rejected', 'timeout'].includes(status);

    const result = await this.pool.query(
      `UPDATE federation_agent_delegations
       SET status = $3,
           response_payload = COALESCE($4, response_payload),
           completed_at = CASE WHEN $5 THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [
        delegationId,
        organizationId,
        status,
        responsePayload ? JSON.stringify(responsePayload) : null,
        isTerminal,
      ],
    );
    if (!result.rows[0]) throw new Error('Delegation not found');
    return this.mapRow(result.rows[0]);
  }

  /**
   * List delegations with filters.
   */
  async listDelegations(
    organizationId: string,
    options?: { status?: string; peer_id?: string; agent_id?: string; limit?: number },
  ): Promise<AgentDelegation[]> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (options?.status) {
      conditions.push(`status = $${idx++}`);
      params.push(options.status);
    }
    if (options?.peer_id) {
      conditions.push(`remote_peer_id = $${idx++}`);
      params.push(options.peer_id);
    }
    if (options?.agent_id) {
      conditions.push(`local_agent_id = $${idx++}`);
      params.push(options.agent_id);
    }

    const limit = Math.min(options?.limit || 50, 200);

    const result = await this.pool.query(
      `SELECT * FROM federation_agent_delegations
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${idx}`,
      [...params, limit],
    );

    return result.rows.map((r: any) => this.mapRow(r));
  }

  /**
   * Expire timed-out delegations.
   */
  async expireTimedOut(organizationId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE federation_agent_delegations
       SET status = 'timeout', completed_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1
         AND status IN ('pending', 'sent', 'accepted', 'in_progress')
         AND created_at + (timeout_ms || ' milliseconds')::INTERVAL < NOW()`,
      [organizationId],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get delegation summary stats.
   */
  async getSummary(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) FILTER (WHERE status = 'timeout') AS timed_out,
        COUNT(*) FILTER (WHERE status IN ('pending', 'sent', 'accepted', 'in_progress')) AS active,
        COUNT(DISTINCT remote_peer_id) AS unique_peers,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000)
          FILTER (WHERE completed_at IS NOT NULL) AS avg_duration_ms
       FROM federation_agent_delegations
       WHERE organization_id = $1`,
      [organizationId],
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      completed: parseInt(row.completed, 10),
      failed: parseInt(row.failed, 10),
      timed_out: parseInt(row.timed_out, 10),
      active: parseInt(row.active, 10),
      unique_peers: parseInt(row.unique_peers, 10),
      avg_duration_ms: row.avg_duration_ms ? Math.round(parseFloat(row.avg_duration_ms)) : null,
    };
  }

  private mapRow(row: any): AgentDelegation {
    return {
      id: row.id,
      organization_id: row.organization_id,
      local_agent_id: row.local_agent_id,
      remote_peer_id: row.remote_peer_id,
      remote_agent_id: row.remote_agent_id,
      task_description: row.task_description,
      task_payload: typeof row.task_payload === 'object' ? row.task_payload : JSON.parse(row.task_payload || '{}'),
      response_payload: row.response_payload
        ? (typeof row.response_payload === 'object' ? row.response_payload : JSON.parse(row.response_payload))
        : null,
      status: row.status,
      timeout_ms: row.timeout_ms,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      completed_at: row.completed_at?.toISOString?.() ?? row.completed_at ?? null,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    };
  }
}
