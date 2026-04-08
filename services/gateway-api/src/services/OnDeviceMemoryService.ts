import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.5 On-Device Memory Sync Service
 * Local SQLite/Drift memory store on device, quantum-fade decay runs locally,
 * syncs with server when connected. Conflict resolution via last-write-wins
 * with vector clock tie-breaking.
 */

interface SyncManifest {
  id: string;
  organization_id: string;
  user_id: string;
  device_id: string;
  platform: string;
  last_sync_at: string | null;
  sync_cursor: string;
  memories_on_device: number;
  pending_uploads: number;
  pending_downloads: number;
  sync_status: string;
  created_at: string;
}

interface SyncBatch {
  id: string;
  manifest_id: string;
  direction: 'upload' | 'download';
  record_count: number;
  byte_size: number;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export class OnDeviceMemoryService {
  constructor(private pool: pg.Pool) {}

  /** Register or update a device sync manifest */
  async registerDevice(
    organizationId: string,
    userId: string,
    input: { device_id: string; platform: string },
  ): Promise<SyncManifest> {
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO gemma4_device_sync_manifests (
        id, organization_id, user_id, device_id, platform,
        sync_cursor, memories_on_device, pending_uploads, pending_downloads,
        sync_status, created_at
      ) VALUES ($1,$2,$3,$4,$5,''::TEXT,0,0,0,'registered',NOW())
      ON CONFLICT (organization_id, user_id, device_id)
      DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
      RETURNING *`,
      [id, organizationId, userId, input.device_id, input.platform],
    );
    return this.mapManifest(result.rows[0]);
  }

  /** Get device sync manifest */
  async getManifest(organizationId: string, userId: string, deviceId: string): Promise<SyncManifest | null> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_device_sync_manifests
       WHERE organization_id = $1 AND user_id = $2 AND device_id = $3`,
      [organizationId, userId, deviceId],
    );
    return result.rows[0] ? this.mapManifest(result.rows[0]) : null;
  }

  /** List all devices for a user */
  async listDevices(organizationId: string, userId: string): Promise<SyncManifest[]> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_device_sync_manifests
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY last_sync_at DESC NULLS LAST`,
      [organizationId, userId],
    );
    return result.rows.map((r) => this.mapManifest(r));
  }

  /**
   * Calculate what the device needs to sync (delta since cursor).
   * Returns memory IDs that changed since the device's last sync cursor.
   */
  async calculateDownloadDelta(
    organizationId: string,
    userId: string,
    deviceId: string,
  ): Promise<{ memoryIds: string[]; newCursor: string }> {
    const manifest = await this.getManifest(organizationId, userId, deviceId);
    if (!manifest) throw new Error('Device not registered');

    const cursor = manifest.sync_cursor || '1970-01-01T00:00:00Z';
    const result = await this.pool.query(
      `SELECT id FROM memories
       WHERE organization_id = $1 AND user_id = $2 AND updated_at > $3
       ORDER BY updated_at ASC LIMIT 500`,
      [organizationId, userId, cursor],
    );

    const ids = result.rows.map((r) => String(r.id));
    const newCursor = ids.length > 0
      ? new Date().toISOString()
      : cursor;

    return { memoryIds: ids, newCursor };
  }

  /** Record an upload batch from device to server */
  async recordUploadBatch(
    organizationId: string,
    userId: string,
    deviceId: string,
    input: { record_count: number; byte_size: number },
  ): Promise<SyncBatch> {
    const manifest = await this.getManifest(organizationId, userId, deviceId);
    if (!manifest) throw new Error('Device not registered');

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO gemma4_sync_batches (
        id, manifest_id, direction, record_count, byte_size, status, created_at
      ) VALUES ($1,$2,'upload',$3,$4,'completed',NOW())
      RETURNING *`,
      [id, manifest.id, input.record_count, input.byte_size],
    );

    // Update manifest counters
    await this.pool.query(
      `UPDATE gemma4_device_sync_manifests
       SET last_sync_at = NOW(), pending_uploads = GREATEST(0, pending_uploads - $2),
           sync_status = 'synced', updated_at = NOW()
       WHERE id = $1`,
      [manifest.id, input.record_count],
    );

    return this.mapBatch(result.rows[0]);
  }

  /** Acknowledge download completion on device */
  async acknowledgeDownload(
    organizationId: string,
    userId: string,
    deviceId: string,
    input: { record_count: number; new_cursor: string },
  ): Promise<void> {
    const manifest = await this.getManifest(organizationId, userId, deviceId);
    if (!manifest) throw new Error('Device not registered');

    await this.pool.query(
      `UPDATE gemma4_device_sync_manifests
       SET last_sync_at = NOW(), sync_cursor = $2,
           memories_on_device = memories_on_device + $3,
           pending_downloads = GREATEST(0, pending_downloads - $3),
           sync_status = 'synced', updated_at = NOW()
       WHERE id = $1`,
      [manifest.id, input.new_cursor, input.record_count],
    );

    // Record batch
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO gemma4_sync_batches (id, manifest_id, direction, record_count, byte_size, status, created_at)
       VALUES ($1,$2,'download',$3,0,'completed',NOW())`,
      [id, manifest.id, input.record_count],
    );
  }

  /** Get sync history for a device */
  async getSyncHistory(manifestId: string, limit = 20): Promise<SyncBatch[]> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_sync_batches WHERE manifest_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [manifestId, limit],
    );
    return result.rows.map((r) => this.mapBatch(r));
  }

  /** Get aggregate sync stats across all devices for an org */
  async getSyncStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as total_devices,
              COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced,
              COUNT(CASE WHEN sync_status = 'registered' THEN 1 END) as pending_initial,
              SUM(memories_on_device) as total_device_memories,
              SUM(pending_uploads) as total_pending_uploads
       FROM gemma4_device_sync_manifests
       WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0];
  }

  private mapManifest(r: Record<string, unknown>): SyncManifest {
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      user_id: String(r.user_id),
      device_id: String(r.device_id),
      platform: String(r.platform),
      last_sync_at: r.last_sync_at ? String(r.last_sync_at) : null,
      sync_cursor: String(r.sync_cursor || ''),
      memories_on_device: Number(r.memories_on_device),
      pending_uploads: Number(r.pending_uploads),
      pending_downloads: Number(r.pending_downloads),
      sync_status: String(r.sync_status),
      created_at: String(r.created_at),
    };
  }

  private mapBatch(r: Record<string, unknown>): SyncBatch {
    return {
      id: String(r.id),
      manifest_id: String(r.manifest_id),
      direction: r.direction as 'upload' | 'download',
      record_count: Number(r.record_count),
      byte_size: Number(r.byte_size),
      status: String(r.status),
      error_message: r.error_message ? String(r.error_message) : null,
      created_at: String(r.created_at),
      completed_at: r.completed_at ? String(r.completed_at) : null,
    };
  }
}
