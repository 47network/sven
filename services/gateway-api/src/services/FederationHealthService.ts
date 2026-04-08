import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.8 Federation Health Service
 * Federated health checks with automatic graceful degradation.
 * Monitors peer connectivity, capability status, and overall mesh health.
 */

interface PeerHealthRecord {
  id: string;
  organization_id: string;
  peer_id: string;
  check_type: string;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  peer_version: string | null;
  peer_capabilities: string[];
  checked_at: string;
}

interface MeshHealthSummary {
  total_peers: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unreachable: number;
  mesh_status: string;
  avg_response_time_ms: number | null;
  last_check_at: string | null;
}

export class FederationHealthService {
  constructor(private pool: pg.Pool) {}

  /**
   * Record a health check result for a peer.
   */
  async recordHealthCheck(
    organizationId: string,
    peerId: string,
    input: {
      check_type: string;
      status: string;
      response_time_ms?: number;
      error_message?: string;
      peer_version?: string;
      peer_capabilities?: string[];
    },
  ): Promise<PeerHealthRecord> {
    const validTypes = ['ping', 'handshake', 'capability', 'full'];
    if (!validTypes.includes(input.check_type)) {
      throw new Error(`Invalid check type. Must be one of: ${validTypes.join(', ')}`);
    }
    const validStatuses = ['healthy', 'degraded', 'unhealthy', 'unreachable', 'unknown'];
    if (!validStatuses.includes(input.status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_peer_health (
        id, organization_id, peer_id, check_type, status,
        response_time_ms, error_message, peer_version,
        peer_capabilities, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        id,
        organizationId,
        peerId,
        input.check_type,
        input.status,
        input.response_time_ms ?? null,
        input.error_message || null,
        input.peer_version || null,
        JSON.stringify(input.peer_capabilities || []),
      ],
    );

    // Update peer status based on health check
    const peerStatus = input.status === 'healthy' ? 'active'
      : input.status === 'degraded' ? 'degraded'
      : input.status === 'unreachable' ? 'offline'
      : 'degraded';

    await this.pool.query(
      `UPDATE federation_peers
       SET status = CASE WHEN status = 'blocked' THEN 'blocked' ELSE $3 END,
           last_seen_at = CASE WHEN $4 != 'unreachable' THEN NOW() ELSE last_seen_at END,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [peerId, organizationId, peerStatus, input.status],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Run a ping check against a peer (simulated via DB record + peer status).
   */
  async pingPeer(organizationId: string, peerId: string): Promise<PeerHealthRecord> {
    const peer = await this.pool.query(
      `SELECT id, address, status FROM federation_peers
       WHERE id = $1 AND organization_id = $2`,
      [peerId, organizationId],
    );
    if (!peer.rows[0]) throw new Error('Peer not found');

    // In production, this would make an HTTP request to peer's /healthz
    // For now, record based on peer's last known state
    const startTime = Date.now();
    const status = peer.rows[0].status === 'blocked' ? 'unhealthy'
      : peer.rows[0].status === 'active' ? 'healthy'
      : peer.rows[0].status === 'degraded' ? 'degraded'
      : 'unreachable';

    return this.recordHealthCheck(organizationId, peerId, {
      check_type: 'ping',
      status,
      response_time_ms: Date.now() - startTime,
    });
  }

  /**
   * Get health history for a specific peer.
   */
  async getPeerHealth(
    organizationId: string,
    peerId: string,
    options?: { limit?: number; check_type?: string },
  ): Promise<PeerHealthRecord[]> {
    const conditions = ['organization_id = $1', 'peer_id = $2'];
    const params: unknown[] = [organizationId, peerId];
    let idx = 3;

    if (options?.check_type) {
      conditions.push(`check_type = $${idx++}`);
      params.push(options.check_type);
    }

    const limit = Math.min(options?.limit || 20, 100);

    const result = await this.pool.query(
      `SELECT * FROM federation_peer_health
       WHERE ${conditions.join(' AND ')}
       ORDER BY checked_at DESC LIMIT $${idx}`,
      [...params, limit],
    );

    return result.rows.map((r: any) => this.mapRow(r));
  }

  /**
   * Get overall federation mesh health summary.
   */
  async getMeshHealth(organizationId: string): Promise<MeshHealthSummary> {
    // Get latest health status per peer
    const result = await this.pool.query(
      `WITH latest_health AS (
        SELECT DISTINCT ON (peer_id)
          peer_id, status, response_time_ms, checked_at
        FROM federation_peer_health
        WHERE organization_id = $1
        ORDER BY peer_id, checked_at DESC
      )
      SELECT
        COUNT(*) AS total_peers,
        COUNT(*) FILTER (WHERE status = 'healthy') AS healthy,
        COUNT(*) FILTER (WHERE status = 'degraded') AS degraded,
        COUNT(*) FILTER (WHERE status = 'unhealthy') AS unhealthy,
        COUNT(*) FILTER (WHERE status = 'unreachable') AS unreachable,
        AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) AS avg_response_time_ms,
        MAX(checked_at) AS last_check_at
      FROM latest_health`,
      [organizationId],
    );

    const row = result.rows[0];
    const total = parseInt(row.total_peers, 10);
    const healthy = parseInt(row.healthy, 10);
    const degraded = parseInt(row.degraded, 10);
    const unhealthy = parseInt(row.unhealthy, 10);
    const unreachable = parseInt(row.unreachable, 10);

    // Determine overall mesh status
    let meshStatus = 'unknown';
    if (total === 0) meshStatus = 'no_peers';
    else if (unhealthy > 0 || unreachable > total / 2) meshStatus = 'unhealthy';
    else if (degraded > 0 || unreachable > 0) meshStatus = 'degraded';
    else meshStatus = 'healthy';

    return {
      total_peers: total,
      healthy,
      degraded,
      unhealthy,
      unreachable,
      mesh_status: meshStatus,
      avg_response_time_ms: row.avg_response_time_ms
        ? Math.round(parseFloat(row.avg_response_time_ms))
        : null,
      last_check_at: row.last_check_at?.toISOString?.() ?? row.last_check_at ?? null,
    };
  }

  /**
   * Prune old health records to prevent unbounded growth.
   */
  async pruneOldRecords(organizationId: string, retainDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000).toISOString();
    const result = await this.pool.query(
      `DELETE FROM federation_peer_health
       WHERE organization_id = $1 AND checked_at < $2`,
      [organizationId, cutoff],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Write an audit log entry for federation events.
   */
  async auditLog(
    organizationId: string,
    input: {
      event_type: string;
      action: string;
      peer_id?: string;
      user_id?: string;
      details?: Record<string, unknown>;
      source_ip?: string;
    },
  ): Promise<void> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO federation_audit_log (
        id, organization_id, event_type, peer_id, user_id,
        action, details, source_ip, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        organizationId,
        input.event_type,
        input.peer_id || null,
        input.user_id || null,
        input.action,
        JSON.stringify(input.details || {}),
        input.source_ip || null,
      ],
    );
  }

  private mapRow(row: any): PeerHealthRecord {
    return {
      id: row.id,
      organization_id: row.organization_id,
      peer_id: row.peer_id,
      check_type: row.check_type,
      status: row.status,
      response_time_ms: row.response_time_ms,
      error_message: row.error_message,
      peer_version: row.peer_version,
      peer_capabilities: Array.isArray(row.peer_capabilities)
        ? row.peer_capabilities
        : JSON.parse(row.peer_capabilities || '[]'),
      checked_at: row.checked_at?.toISOString?.() ?? row.checked_at,
    };
  }
}
