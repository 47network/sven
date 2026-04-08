import pg from 'pg';
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.3 Homeserver Service
 * Manages client connections to this Sven instance.
 * Users connect companion apps (Flutter, Tauri, web) directly to their
 * Sven instance — like Element → Matrix homeserver.
 */

interface HomeserverConnection {
  id: string;
  organization_id: string;
  user_id: string;
  client_type: string;
  client_version: string | null;
  device_id: string | null;
  connection_token: string;
  last_active_at: string;
  status: string;
  capabilities: string[];
  created_at: string;
}

interface HomeserverConfig {
  instance_id: string;
  instance_name: string;
  base_url: string;
  websocket_url: string;
  api_version: string;
  federation_enabled: boolean;
  capabilities: string[];
}

export class HomeserverService {
  constructor(private pool: pg.Pool) {}

  /**
   * Register a new client connection to this homeserver.
   * Returns a connection token for subsequent requests.
   */
  async registerConnection(
    organizationId: string,
    userId: string,
    input: {
      client_type: string;
      client_version?: string;
      device_id?: string;
      capabilities?: string[];
    },
  ): Promise<HomeserverConnection> {
    const validTypes = ['flutter_mobile', 'tauri_desktop', 'web', 'cli', 'api'];
    if (!validTypes.includes(input.client_type)) {
      throw new Error(`Invalid client type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Generate secure connection token
    const connectionToken = crypto.randomBytes(32).toString('hex');

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_homeserver_connections (
        id, organization_id, user_id, client_type, client_version,
        device_id, connection_token, last_active_at, status, capabilities, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'active', $8, NOW())
      RETURNING *`,
      [
        id,
        organizationId,
        userId,
        input.client_type,
        input.client_version || null,
        input.device_id || null,
        connectionToken,
        JSON.stringify(input.capabilities || []),
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Heartbeat: update last_active_at for connection.
   */
  async heartbeat(connectionToken: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE federation_homeserver_connections
       SET last_active_at = NOW(), status = 'active'
       WHERE connection_token = $1 AND status != 'disconnected'`,
      [connectionToken],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Disconnect a client connection.
   */
  async disconnect(organizationId: string, connectionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE federation_homeserver_connections
       SET status = 'disconnected'
       WHERE id = $1 AND organization_id = $2`,
      [connectionId, organizationId],
    );
  }

  /**
   * List active connections for a user or organization.
   */
  async listConnections(
    organizationId: string,
    options?: { user_id?: string; status?: string; client_type?: string },
  ): Promise<HomeserverConnection[]> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (options?.user_id) {
      conditions.push(`user_id = $${idx++}`);
      params.push(options.user_id);
    }
    if (options?.status) {
      conditions.push(`status = $${idx++}`);
      params.push(options.status);
    }
    if (options?.client_type) {
      conditions.push(`client_type = $${idx++}`);
      params.push(options.client_type);
    }

    const result = await this.pool.query(
      `SELECT * FROM federation_homeserver_connections
       WHERE ${conditions.join(' AND ')}
       ORDER BY last_active_at DESC`,
      params,
    );

    return result.rows.map((r: any) => this.mapRow(r));
  }

  /**
   * Get homeserver configuration for client bootstrap.
   */
  async getConfig(organizationId: string): Promise<HomeserverConfig> {
    const sovereignty = await this.pool.query(
      `SELECT federation_enabled FROM federation_data_sovereignty
       WHERE organization_id = $1`,
      [organizationId],
    );

    const baseUrl = process.env.GATEWAY_URL || process.env.SVEN_PUBLIC_URL || '';
    const wsUrl = baseUrl.replace(/^http/, 'ws');

    return {
      instance_id: process.env.SVEN_INSTANCE_ID || organizationId,
      instance_name: process.env.SVEN_INSTANCE_NAME || 'Sven Instance',
      base_url: baseUrl,
      websocket_url: wsUrl,
      api_version: '2026-02-16.v1',
      federation_enabled: sovereignty.rows[0]?.federation_enabled ?? false,
      capabilities: [
        'chat', 'memory', 'knowledge_graph', 'agents',
        'community', 'brain_visualization', 'emotional_intelligence',
      ],
    };
  }

  /**
   * Prune idle connections (no heartbeat within TTL).
   */
  async pruneIdle(organizationId: string, idleTtlMs: number = 600000): Promise<number> {
    const cutoff = new Date(Date.now() - idleTtlMs).toISOString();
    const result = await this.pool.query(
      `UPDATE federation_homeserver_connections
       SET status = 'idle'
       WHERE organization_id = $1 AND status = 'active' AND last_active_at < $2`,
      [organizationId, cutoff],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get connection stats for the instance.
   */
  async getStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        client_type,
        status,
        COUNT(*) AS count
       FROM federation_homeserver_connections
       WHERE organization_id = $1
       GROUP BY client_type, status`,
      [organizationId],
    );

    const stats: Record<string, Record<string, number>> = {};
    for (const row of result.rows) {
      const type = row.client_type;
      if (!stats[type]) stats[type] = {};
      stats[type][row.status] = parseInt(row.count, 10);
    }

    const totals = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'idle') AS idle,
        COUNT(*) FILTER (WHERE status = 'disconnected') AS disconnected,
        COUNT(*) AS total
       FROM federation_homeserver_connections WHERE organization_id = $1`,
      [organizationId],
    );
    const t = totals.rows[0];

    return {
      by_client_type: stats,
      active: parseInt(t.active, 10),
      idle: parseInt(t.idle, 10),
      disconnected: parseInt(t.disconnected, 10),
      total: parseInt(t.total, 10),
    };
  }

  private mapRow(row: any): HomeserverConnection {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      client_type: row.client_type,
      client_version: row.client_version,
      device_id: row.device_id,
      connection_token: row.connection_token,
      last_active_at: row.last_active_at?.toISOString?.() ?? row.last_active_at,
      status: row.status,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : JSON.parse(row.capabilities || '[]'),
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
    };
  }
}
