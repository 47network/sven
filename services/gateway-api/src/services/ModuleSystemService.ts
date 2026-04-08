import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.7 + 6.8 Auto-Download Module System Service
 * Like Google AI Edge Gallery but automated through Sven.
 * Auto-detect platform capabilities, recommend modules, permission-gated download.
 * Manual module picker UI support. Works on all platforms.
 */

type ModuleCategory = 'model' | 'voice' | 'vision' | 'tool' | 'language' | 'plugin';
type PlatformCompat = 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'all';

interface ModuleDefinition {
  id: string;
  module_key: string;
  name: string;
  description: string;
  category: ModuleCategory;
  version: string;
  size_bytes: number;
  platforms: PlatformCompat[];
  min_ram_mb: number;
  min_storage_mb: number;
  requires_gpu: boolean;
  download_url: string;
  checksum_sha256: string;
  license: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface DeviceModuleInstall {
  id: string;
  organization_id: string;
  user_id: string;
  device_id: string;
  module_id: string;
  module_key: string;
  installed_version: string;
  status: string;
  download_progress: number;
  installed_at: string | null;
  last_used_at: string | null;
  disk_usage_bytes: number;
  created_at: string;
}

interface DeviceCapabilities {
  platform: PlatformCompat;
  ram_mb: number;
  storage_available_mb: number;
  has_gpu: boolean;
  cpu_cores: number;
}

export class ModuleSystemService {
  constructor(private pool: pg.Pool) {}

  /** Register a module in the catalog */
  async registerModule(input: Partial<ModuleDefinition>): Promise<ModuleDefinition> {
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO gemma4_module_catalog (
        id, module_key, name, description, category, version,
        size_bytes, platforms, min_ram_mb, min_storage_mb, requires_gpu,
        download_url, checksum_sha256, license, is_default, is_active, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      RETURNING *`,
      [
        id, input.module_key, input.name, input.description || '',
        input.category || 'model', input.version || '1.0.0',
        input.size_bytes || 0, JSON.stringify(input.platforms || ['all']),
        input.min_ram_mb || 0, input.min_storage_mb || 0,
        input.requires_gpu || false, input.download_url || '',
        input.checksum_sha256 || '', input.license || 'Apache-2.0',
        input.is_default || false, true,
      ],
    );
    return this.mapModule(result.rows[0]);
  }

  /** List available modules, optionally filtered by platform/category */
  async listModules(opts?: { category?: ModuleCategory; platform?: PlatformCompat; activeOnly?: boolean }): Promise<ModuleDefinition[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts?.category) { params.push(opts.category); conditions.push(`category = $${params.length}`); }
    if (opts?.activeOnly !== false) conditions.push('is_active = TRUE');
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM gemma4_module_catalog ${where} ORDER BY category, is_default DESC, name`,
      params,
    );
    let modules = result.rows.map((r) => this.mapModule(r));
    if (opts?.platform) {
      modules = modules.filter((m) => m.platforms.includes('all') || m.platforms.includes(opts.platform!));
    }
    return modules;
  }

  /**
   * Auto-recommend modules based on device capabilities.
   * Filters by platform, RAM, storage, and GPU requirements.
   */
  async recommendModules(capabilities: DeviceCapabilities): Promise<ModuleDefinition[]> {
    const allModules = await this.listModules({ platform: capabilities.platform, activeOnly: true });
    return allModules.filter((m) => {
      if (m.min_ram_mb > capabilities.ram_mb) return false;
      if (m.min_storage_mb > capabilities.storage_available_mb) return false;
      if (m.requires_gpu && !capabilities.has_gpu) return false;
      return true;
    });
  }

  /** Record a module install on a device */
  async installModule(
    organizationId: string,
    userId: string,
    deviceId: string,
    moduleId: string,
  ): Promise<DeviceModuleInstall> {
    // Get module info
    const modResult = await this.pool.query(`SELECT * FROM gemma4_module_catalog WHERE id = $1`, [moduleId]);
    if (modResult.rows.length === 0) throw new Error('Module not found');
    const mod = this.mapModule(modResult.rows[0]);

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO gemma4_device_module_installs (
        id, organization_id, user_id, device_id, module_id, module_key,
        installed_version, status, download_progress, disk_usage_bytes, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'downloading',0,$8,NOW())
      ON CONFLICT (organization_id, user_id, device_id, module_id)
      DO UPDATE SET status = 'downloading', download_progress = 0, updated_at = NOW()
      RETURNING *`,
      [id, organizationId, userId, deviceId, moduleId, mod.module_key, mod.version, mod.size_bytes],
    );
    return this.mapInstall(result.rows[0]);
  }

  /** Update module install progress */
  async updateProgress(installId: string, progress: number, status?: string): Promise<void> {
    const finalStatus = status || (progress >= 100 ? 'installed' : 'downloading');
    const installedAt = progress >= 100 ? 'NOW()' : 'NULL';
    await this.pool.query(
      `UPDATE gemma4_device_module_installs
       SET download_progress = $2, status = $3,
           installed_at = ${installedAt === 'NOW()' ? 'NOW()' : 'installed_at'},
           updated_at = NOW()
       WHERE id = $1`,
      [installId, Math.min(progress, 100), finalStatus],
    );
  }

  /** Uninstall a module from a device */
  async uninstallModule(installId: string): Promise<void> {
    await this.pool.query(
      `UPDATE gemma4_device_module_installs SET status = 'uninstalled', updated_at = NOW() WHERE id = $1`,
      [installId],
    );
  }

  /** List installed modules on a device */
  async listInstalled(organizationId: string, userId: string, deviceId: string): Promise<DeviceModuleInstall[]> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_device_module_installs
       WHERE organization_id = $1 AND user_id = $2 AND device_id = $3 AND status != 'uninstalled'
       ORDER BY installed_at DESC NULLS LAST`,
      [organizationId, userId, deviceId],
    );
    return result.rows.map((r) => this.mapInstall(r));
  }

  /** Get module summary stats */
  async getStats(): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT category, COUNT(*) as count, SUM(size_bytes) as total_size
       FROM gemma4_module_catalog WHERE is_active = TRUE GROUP BY category ORDER BY count DESC`,
    );
    const installs = await this.pool.query(
      `SELECT status, COUNT(*) as count FROM gemma4_device_module_installs GROUP BY status`,
    );
    return { catalog: result.rows, installs: installs.rows };
  }

  private mapModule(r: Record<string, unknown>): ModuleDefinition {
    let platforms: PlatformCompat[];
    if (typeof r.platforms === 'string') { try { platforms = JSON.parse(r.platforms as string); } catch { platforms = ['all']; } }
    else if (Array.isArray(r.platforms)) { platforms = r.platforms as PlatformCompat[]; }
    else { platforms = ['all']; }
    return {
      id: String(r.id), module_key: String(r.module_key), name: String(r.name),
      description: String(r.description), category: r.category as ModuleCategory,
      version: String(r.version), size_bytes: Number(r.size_bytes), platforms,
      min_ram_mb: Number(r.min_ram_mb), min_storage_mb: Number(r.min_storage_mb),
      requires_gpu: Boolean(r.requires_gpu), download_url: String(r.download_url),
      checksum_sha256: String(r.checksum_sha256), license: String(r.license),
      is_default: Boolean(r.is_default), is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    };
  }

  private mapInstall(r: Record<string, unknown>): DeviceModuleInstall {
    return {
      id: String(r.id), organization_id: String(r.organization_id),
      user_id: String(r.user_id), device_id: String(r.device_id),
      module_id: String(r.module_id), module_key: String(r.module_key),
      installed_version: String(r.installed_version), status: String(r.status),
      download_progress: Number(r.download_progress),
      installed_at: r.installed_at ? String(r.installed_at) : null,
      last_used_at: r.last_used_at ? String(r.last_used_at) : null,
      disk_usage_bytes: Number(r.disk_usage_bytes), created_at: String(r.created_at),
    };
  }
}
