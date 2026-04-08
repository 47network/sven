import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.2 Federation Discovery Service
 * Extends existing mDNS discovery with peer registration, verification,
 * and .well-known endpoint data for cross-internet federation.
 */

interface FederationPeer {
  id: string;
  organization_id: string;
  instance_id: string;
  instance_name: string;
  public_key: string | null;
  fingerprint: string | null;
  address: string;
  nats_leaf_url: string | null;
  capabilities: string[];
  trust_level: string;
  status: string;
  last_seen_at: string | null;
  last_handshake_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class FederationDiscoveryService {
  constructor(private pool: pg.Pool) {}

  /**
   * Register a discovered peer (from mDNS or manual).
   */
  async registerPeer(
    organizationId: string,
    input: {
      instance_id: string;
      instance_name: string;
      address: string;
      public_key?: string;
      fingerprint?: string;
      nats_leaf_url?: string;
      capabilities?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<FederationPeer> {
    if (!input.instance_id?.trim()) throw new Error('Instance ID is required');
    if (!input.instance_name?.trim()) throw new Error('Instance name is required');
    if (!input.address?.trim()) throw new Error('Address is required');

    // Validate address format (URL)
    try {
      new URL(input.address);
    } catch {
      throw new Error('Address must be a valid URL');
    }

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_peers (
        id, organization_id, instance_id, instance_name,
        public_key, fingerprint, address, nats_leaf_url,
        capabilities, trust_level, status, last_seen_at,
        metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'untrusted', 'discovered', NOW(), $10, NOW(), NOW())
      ON CONFLICT (organization_id, instance_id) DO UPDATE SET
        instance_name = EXCLUDED.instance_name,
        address = EXCLUDED.address,
        public_key = COALESCE(EXCLUDED.public_key, federation_peers.public_key),
        fingerprint = COALESCE(EXCLUDED.fingerprint, federation_peers.fingerprint),
        nats_leaf_url = COALESCE(EXCLUDED.nats_leaf_url, federation_peers.nats_leaf_url),
        capabilities = EXCLUDED.capabilities,
        last_seen_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        organizationId,
        input.instance_id.trim(),
        input.instance_name.trim(),
        input.public_key || null,
        input.fingerprint || null,
        input.address.trim(),
        input.nats_leaf_url || null,
        JSON.stringify(input.capabilities || []),
        JSON.stringify(input.metadata || {}),
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Initiate handshake with a peer (exchange public keys, verify identity).
   */
  async initiateHandshake(organizationId: string, peerId: string): Promise<FederationPeer> {
    const result = await this.pool.query(
      `UPDATE federation_peers
       SET status = 'handshake', last_handshake_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [peerId, organizationId],
    );
    if (!result.rows[0]) throw new Error('Peer not found');
    return this.mapRow(result.rows[0]);
  }

  /**
   * Complete handshake: store peer's public key, upgrade trust.
   */
  async completeHandshake(
    organizationId: string,
    peerId: string,
    publicKey: string,
    fingerprint: string,
  ): Promise<FederationPeer> {
    const result = await this.pool.query(
      `UPDATE federation_peers
       SET public_key = $3, fingerprint = $4, status = 'active',
           trust_level = 'verified', last_handshake_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [peerId, organizationId, publicKey, fingerprint],
    );
    if (!result.rows[0]) throw new Error('Peer not found');
    return this.mapRow(result.rows[0]);
  }

  /**
   * Update peer trust level.
   */
  async updateTrustLevel(
    organizationId: string,
    peerId: string,
    trustLevel: string,
  ): Promise<FederationPeer> {
    const validLevels = ['untrusted', 'verified', 'trusted', 'blocked'];
    if (!validLevels.includes(trustLevel)) {
      throw new Error(`Invalid trust level. Must be one of: ${validLevels.join(', ')}`);
    }

    const newStatus = trustLevel === 'blocked' ? 'blocked' : undefined;
    const result = await this.pool.query(
      `UPDATE federation_peers
       SET trust_level = $3,
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [peerId, organizationId, trustLevel, newStatus ?? null],
    );
    if (!result.rows[0]) throw new Error('Peer not found');
    return this.mapRow(result.rows[0]);
  }

  /**
   * List known peers with optional filters.
   */
  async listPeers(
    organizationId: string,
    options?: { status?: string; trust_level?: string; limit?: number; offset?: number },
  ): Promise<{ peers: FederationPeer[]; total: number }> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (options?.status) {
      conditions.push(`status = $${idx++}`);
      params.push(options.status);
    }
    if (options?.trust_level) {
      conditions.push(`trust_level = $${idx++}`);
      params.push(options.trust_level);
    }

    const where = conditions.join(' AND ');
    const limit = Math.min(options?.limit || 50, 200);
    const offset = Math.max(options?.offset || 0, 0);

    const [data, count] = await Promise.all([
      this.pool.query(
        `SELECT * FROM federation_peers WHERE ${where}
         ORDER BY last_seen_at DESC NULLS LAST
         LIMIT $${idx++} OFFSET $${idx}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*) AS total FROM federation_peers WHERE ${where}`,
        params,
      ),
    ]);

    return {
      peers: data.rows.map((r: any) => this.mapRow(r)),
      total: parseInt(count.rows[0].total, 10),
    };
  }

  /**
   * Get peer by ID.
   */
  async getPeer(organizationId: string, peerId: string): Promise<FederationPeer | null> {
    const result = await this.pool.query(
      `SELECT * FROM federation_peers WHERE id = $1 AND organization_id = $2`,
      [peerId, organizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Generate .well-known/sven/instance response data.
   */
  async getWellKnownData(organizationId: string): Promise<Record<string, unknown>> {
    const identity = await this.pool.query(
      `SELECT public_key, fingerprint, algorithm FROM federation_instance_identity
       WHERE organization_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId],
    );

    const sovereignty = await this.pool.query(
      `SELECT federation_enabled FROM federation_data_sovereignty
       WHERE organization_id = $1`,
      [organizationId],
    );

    const instanceId = process.env.SVEN_INSTANCE_ID || organizationId;
    const instanceName = process.env.SVEN_INSTANCE_NAME || 'Sven Instance';
    const publicUrl = process.env.GATEWAY_URL || process.env.SVEN_PUBLIC_URL || '';

    return {
      instance_id: instanceId,
      instance_name: instanceName,
      version: process.env.npm_package_version || '0.1.0',
      federation_enabled: sovereignty.rows[0]?.federation_enabled ?? false,
      public_key: identity.rows[0]?.public_key || null,
      fingerprint: identity.rows[0]?.fingerprint || null,
      algorithm: identity.rows[0]?.algorithm || 'ed25519',
      base_url: publicUrl,
      protocol_version: '1.0',
      capabilities: ['community', 'agent_delegation', 'health_check'],
    };
  }

  /**
   * Remove stale peers not seen within TTL.
   */
  async pruneStale(organizationId: string, staleTtlMs: number = 300000): Promise<number> {
    const cutoff = new Date(Date.now() - staleTtlMs).toISOString();
    const result = await this.pool.query(
      `UPDATE federation_peers SET status = 'offline', updated_at = NOW()
       WHERE organization_id = $1 AND status NOT IN ('blocked', 'offline')
         AND last_seen_at < $2`,
      [organizationId, cutoff],
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: any): FederationPeer {
    return {
      id: row.id,
      organization_id: row.organization_id,
      instance_id: row.instance_id,
      instance_name: row.instance_name,
      public_key: row.public_key,
      fingerprint: row.fingerprint,
      address: row.address,
      nats_leaf_url: row.nats_leaf_url,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : JSON.parse(row.capabilities || '[]'),
      trust_level: row.trust_level,
      status: row.status,
      last_seen_at: row.last_seen_at?.toISOString?.() ?? row.last_seen_at,
      last_handshake_at: row.last_handshake_at?.toISOString?.() ?? row.last_handshake_at,
      metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'),
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    };
  }
}
