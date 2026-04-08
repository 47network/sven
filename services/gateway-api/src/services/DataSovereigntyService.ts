import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.7 Data Sovereignty Service
 * Organization-level controls for where data lives and how federation is scoped.
 * Users control federation scope. No data leaves instance without explicit consent.
 */

interface DataSovereignty {
  id: string;
  organization_id: string;
  federation_enabled: boolean;
  allowed_regions: string[];
  blocked_peers: string[];
  data_retention_days: number;
  max_federation_peers: number;
  require_mutual_tls: boolean;
  require_peer_verification: boolean;
  export_policy: string;
  audit_federation_traffic: boolean;
  created_at: string;
  updated_at: string;
}

export class DataSovereigntyService {
  constructor(private pool: pg.Pool) {}

  /**
   * Get data sovereignty settings for org. Creates defaults if none exist.
   */
  async getSettings(organizationId: string): Promise<DataSovereignty> {
    const result = await this.pool.query(
      `SELECT * FROM federation_data_sovereignty WHERE organization_id = $1`,
      [organizationId],
    );

    if (result.rows[0]) return this.mapRow(result.rows[0]);

    // Create default (conservative) settings
    const id = uuidv7();
    const inserted = await this.pool.query(
      `INSERT INTO federation_data_sovereignty (
        id, organization_id, federation_enabled, allowed_regions, blocked_peers,
        data_retention_days, max_federation_peers, require_mutual_tls,
        require_peer_verification, export_policy, audit_federation_traffic,
        created_at, updated_at
      ) VALUES ($1, $2, FALSE, '[]', '[]', 90, 10, TRUE, TRUE, 'none', TRUE, NOW(), NOW())
      ON CONFLICT (organization_id) DO NOTHING
      RETURNING *`,
      [id, organizationId],
    );

    if (inserted.rows[0]) return this.mapRow(inserted.rows[0]);

    // Race condition: another request created it first
    const retry = await this.pool.query(
      `SELECT * FROM federation_data_sovereignty WHERE organization_id = $1`,
      [organizationId],
    );
    return this.mapRow(retry.rows[0]);
  }

  /**
   * Update data sovereignty settings.
   */
  async updateSettings(
    organizationId: string,
    input: Partial<{
      federation_enabled: boolean;
      allowed_regions: string[];
      blocked_peers: string[];
      data_retention_days: number;
      max_federation_peers: number;
      require_mutual_tls: boolean;
      require_peer_verification: boolean;
      export_policy: string;
      audit_federation_traffic: boolean;
    }>,
  ): Promise<DataSovereignty> {
    // Ensure settings exist
    await this.getSettings(organizationId);

    if (input.export_policy) {
      const validPolicies = ['none', 'anonymized', 'pseudonymized', 'full'];
      if (!validPolicies.includes(input.export_policy)) {
        throw new Error(`Invalid export policy. Must be one of: ${validPolicies.join(', ')}`);
      }
    }
    if (input.data_retention_days !== undefined) {
      if (input.data_retention_days < 1 || input.data_retention_days > 3650) {
        throw new Error('Data retention must be between 1 and 3650 days');
      }
    }
    if (input.max_federation_peers !== undefined) {
      if (input.max_federation_peers < 0 || input.max_federation_peers > 1000) {
        throw new Error('Max federation peers must be between 0 and 1000');
      }
    }

    const setClauses: string[] = [];
    const params: unknown[] = [organizationId];
    let idx = 2;

    const fields: Array<[string, unknown]> = [
      ['federation_enabled', input.federation_enabled],
      ['allowed_regions', input.allowed_regions !== undefined ? JSON.stringify(input.allowed_regions) : undefined],
      ['blocked_peers', input.blocked_peers !== undefined ? JSON.stringify(input.blocked_peers) : undefined],
      ['data_retention_days', input.data_retention_days],
      ['max_federation_peers', input.max_federation_peers],
      ['require_mutual_tls', input.require_mutual_tls],
      ['require_peer_verification', input.require_peer_verification],
      ['export_policy', input.export_policy],
      ['audit_federation_traffic', input.audit_federation_traffic],
    ];

    for (const [field, value] of fields) {
      if (value !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) return this.getSettings(organizationId);

    setClauses.push('updated_at = NOW()');

    const result = await this.pool.query(
      `UPDATE federation_data_sovereignty
       SET ${setClauses.join(', ')}
       WHERE organization_id = $1
       RETURNING *`,
      params,
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Check if federation is allowed with a specific peer.
   */
  async canFederateWith(organizationId: string, peerId: string): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getSettings(organizationId);

    if (!settings.federation_enabled) {
      return { allowed: false, reason: 'Federation is disabled for this organization' };
    }

    if (settings.blocked_peers.includes(peerId)) {
      return { allowed: false, reason: 'Peer is explicitly blocked' };
    }

    // Check peer count limit
    const peerCount = await this.pool.query(
      `SELECT COUNT(*) AS count FROM federation_peers
       WHERE organization_id = $1 AND status = 'active'`,
      [organizationId],
    );

    if (parseInt(peerCount.rows[0].count, 10) >= settings.max_federation_peers) {
      return { allowed: false, reason: 'Maximum federation peer limit reached' };
    }

    return { allowed: true };
  }

  /**
   * Check if data export is allowed under current policy.
   */
  async canExportData(organizationId: string): Promise<{ allowed: boolean; policy: string }> {
    const settings = await this.getSettings(organizationId);
    return {
      allowed: settings.export_policy !== 'none',
      policy: settings.export_policy,
    };
  }

  private mapRow(row: any): DataSovereignty {
    return {
      id: row.id,
      organization_id: row.organization_id,
      federation_enabled: row.federation_enabled,
      allowed_regions: Array.isArray(row.allowed_regions) ? row.allowed_regions : JSON.parse(row.allowed_regions || '[]'),
      blocked_peers: Array.isArray(row.blocked_peers) ? row.blocked_peers : JSON.parse(row.blocked_peers || '[]'),
      data_retention_days: row.data_retention_days,
      max_federation_peers: row.max_federation_peers,
      require_mutual_tls: row.require_mutual_tls,
      require_peer_verification: row.require_peer_verification,
      export_policy: row.export_policy,
      audit_federation_traffic: row.audit_federation_traffic,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    };
  }
}
