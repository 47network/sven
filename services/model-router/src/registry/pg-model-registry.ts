// ---------------------------------------------------------------------------
// Postgres-Backed Model Registry
// ---------------------------------------------------------------------------
// Replaces the in-memory ModelRegistry from @sven/model-router with
// Postgres persistence. Reuses types from the package.
// ---------------------------------------------------------------------------

import pg from 'pg';
import type {
  ModelEntry, TaskType, ModelStatus, QuantFormat,
} from '@sven/model-router/registry';

export class PgModelRegistry {
  constructor(private pool: pg.Pool) {}

  async register(model: ModelEntry, orgId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO model_registry (
        id, name, provider, version, parameter_count, quantization,
        supported_tasks, vram_requirement_mb, disk_size_mb, context_window,
        max_output_tokens, license, license_commercial, endpoint, host_device,
        status, tokens_per_second, last_health_check, org_id, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        provider = EXCLUDED.provider,
        version = EXCLUDED.version,
        parameter_count = EXCLUDED.parameter_count,
        quantization = EXCLUDED.quantization,
        supported_tasks = EXCLUDED.supported_tasks,
        vram_requirement_mb = EXCLUDED.vram_requirement_mb,
        disk_size_mb = EXCLUDED.disk_size_mb,
        context_window = EXCLUDED.context_window,
        max_output_tokens = EXCLUDED.max_output_tokens,
        license = EXCLUDED.license,
        license_commercial = EXCLUDED.license_commercial,
        endpoint = EXCLUDED.endpoint,
        host_device = EXCLUDED.host_device,
        status = EXCLUDED.status,
        tokens_per_second = EXCLUDED.tokens_per_second,
        last_health_check = EXCLUDED.last_health_check,
        metadata = EXCLUDED.metadata,
        updated_at = now()`,
      [
        model.id, model.name, model.provider, model.version,
        model.parameterCount, model.quantization,
        model.supportedTasks, model.vramRequirementMb, model.diskSizeMb,
        model.contextWindow, model.maxOutputTokens, model.license,
        model.licenseCommercialUse, model.endpoint, model.hostDevice,
        model.status, model.tokensPerSecond, model.lastHealthCheck,
        orgId, JSON.stringify(model.metadata),
      ],
    );
  }

  async unregister(id: string, orgId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM model_registry WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async get(id: string, orgId: string): Promise<ModelEntry | null> {
    const res = await this.pool.query(
      `SELECT * FROM model_registry WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    return res.rows[0] ? this.rowToEntry(res.rows[0]) : null;
  }

  async list(orgId: string): Promise<ModelEntry[]> {
    const res = await this.pool.query(
      `SELECT * FROM model_registry WHERE org_id = $1 ORDER BY name`,
      [orgId],
    );
    return res.rows.map((r) => this.rowToEntry(r));
  }

  async listByTask(task: TaskType, orgId: string): Promise<ModelEntry[]> {
    const res = await this.pool.query(
      `SELECT * FROM model_registry WHERE org_id = $1 AND $2 = ANY(supported_tasks) ORDER BY name`,
      [orgId, task],
    );
    return res.rows.map((r) => this.rowToEntry(r));
  }

  async listByStatus(status: ModelStatus, orgId: string): Promise<ModelEntry[]> {
    const res = await this.pool.query(
      `SELECT * FROM model_registry WHERE org_id = $1 AND status = $2 ORDER BY name`,
      [orgId, status],
    );
    return res.rows.map((r) => this.rowToEntry(r));
  }

  async listReady(orgId: string): Promise<ModelEntry[]> {
    return this.listByStatus('ready', orgId);
  }

  async setStatus(id: string, status: ModelStatus): Promise<void> {
    await this.pool.query(
      `UPDATE model_registry SET status = $2, updated_at = now() WHERE id = $1`,
      [id, status],
    );
  }

  async setEndpoint(id: string, endpoint: string, host: string): Promise<void> {
    await this.pool.query(
      `UPDATE model_registry SET endpoint = $2, host_device = $3, status = 'ready', updated_at = now() WHERE id = $1`,
      [id, endpoint, host],
    );
  }

  async recordHealthCheck(id: string, tokensPerSecond: number): Promise<void> {
    await this.pool.query(
      `UPDATE model_registry SET tokens_per_second = $2, last_health_check = now(), updated_at = now() WHERE id = $1`,
      [id, tokensPerSecond],
    );
  }

  async totalVramUsageMb(orgId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COALESCE(SUM(vram_requirement_mb), 0)::integer AS total
       FROM model_registry WHERE org_id = $1 AND status IN ('ready', 'loading')`,
      [orgId],
    );
    return res.rows[0].total;
  }

  private rowToEntry(row: Record<string, unknown>): ModelEntry {
    return {
      id: row.id as string,
      name: row.name as string,
      provider: row.provider as string,
      version: row.version as string,
      parameterCount: row.parameter_count as string,
      quantization: row.quantization as QuantFormat,
      supportedTasks: row.supported_tasks as TaskType[],
      vramRequirementMb: row.vram_requirement_mb as number,
      diskSizeMb: row.disk_size_mb as number,
      contextWindow: row.context_window as number,
      maxOutputTokens: row.max_output_tokens as number,
      license: row.license as string,
      licenseCommercialUse: row.license_commercial as boolean,
      endpoint: (row.endpoint as string) || null,
      hostDevice: (row.host_device as string) || null,
      status: row.status as ModelStatus,
      tokensPerSecond: (row.tokens_per_second as number) || null,
      lastHealthCheck: row.last_health_check
        ? (row.last_health_check as Date).toISOString()
        : null,
      registeredAt: (row.registered_at as Date).toISOString(),
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }
}
