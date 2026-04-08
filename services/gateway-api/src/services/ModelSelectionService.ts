import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.1 Model Selection Service
 * Platform-aware model selection: E2B for Flutter mobile, E4B for Tauri desktop,
 * 26B MoE / 31B Dense for server-side. All Apache 2.0 licensed.
 */

type PlatformType = 'flutter_mobile' | 'tauri_desktop' | 'server' | 'web' | 'cli';

interface ModelProfile {
  id: string;
  organization_id: string;
  model_key: string;
  model_name: string;
  provider: string;
  platform_type: PlatformType;
  parameter_count: string;
  quantization: string;
  context_window: number;
  supports_audio: boolean;
  supports_vision: boolean;
  supports_function_calling: boolean;
  license: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

/** Well-known Gemma 4 model variants mapped to platforms */
const GEMMA4_DEFAULTS: Record<PlatformType, Omit<ModelProfile, 'id' | 'organization_id' | 'created_at'>> = {
  flutter_mobile: {
    model_key: 'gemma4-e2b-mobile',
    model_name: 'Gemma 4 E2B (Mobile)',
    provider: 'on_device',
    platform_type: 'flutter_mobile',
    parameter_count: '2B',
    quantization: 'int4',
    context_window: 128_000,
    supports_audio: true,
    supports_vision: true,
    supports_function_calling: true,
    license: 'Apache-2.0',
    is_default: true,
    is_active: true,
  },
  tauri_desktop: {
    model_key: 'gemma4-e4b-desktop',
    model_name: 'Gemma 4 E4B (Desktop)',
    provider: 'on_device',
    platform_type: 'tauri_desktop',
    parameter_count: '4B',
    quantization: 'int8',
    context_window: 128_000,
    supports_audio: true,
    supports_vision: true,
    supports_function_calling: true,
    license: 'Apache-2.0',
    is_default: true,
    is_active: true,
  },
  server: {
    model_key: 'gemma4-27b-server',
    model_name: 'Gemma 4 27B MoE (Server)',
    provider: 'ollama',
    platform_type: 'server',
    parameter_count: '27B',
    quantization: 'fp16',
    context_window: 128_000,
    supports_audio: true,
    supports_vision: true,
    supports_function_calling: true,
    license: 'Apache-2.0',
    is_default: true,
    is_active: true,
  },
  web: {
    model_key: 'gemma4-cloud-web',
    model_name: 'Gemma 4 (Cloud Proxy)',
    provider: 'litellm',
    platform_type: 'web',
    parameter_count: '27B',
    quantization: 'fp16',
    context_window: 128_000,
    supports_audio: true,
    supports_vision: true,
    supports_function_calling: true,
    license: 'Apache-2.0',
    is_default: true,
    is_active: true,
  },
  cli: {
    model_key: 'gemma4-server-cli',
    model_name: 'Gemma 4 27B (CLI)',
    provider: 'ollama',
    platform_type: 'cli',
    parameter_count: '27B',
    quantization: 'fp16',
    context_window: 128_000,
    supports_audio: false,
    supports_vision: false,
    supports_function_calling: true,
    license: 'Apache-2.0',
    is_default: true,
    is_active: true,
  },
};

export class ModelSelectionService {
  constructor(private pool: pg.Pool) {}

  /** Seed default Gemma 4 profiles for an organization */
  async seedDefaults(organizationId: string): Promise<ModelProfile[]> {
    const seeded: ModelProfile[] = [];
    for (const [, defaults] of Object.entries(GEMMA4_DEFAULTS)) {
      const id = uuidv7();
      await this.pool.query(
        `INSERT INTO gemma4_model_profiles (
          id, organization_id, model_key, model_name, provider, platform_type,
          parameter_count, quantization, context_window,
          supports_audio, supports_vision, supports_function_calling,
          license, is_default, is_active, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
        ON CONFLICT (organization_id, model_key) DO NOTHING`,
        [
          id, organizationId, defaults.model_key, defaults.model_name,
          defaults.provider, defaults.platform_type, defaults.parameter_count,
          defaults.quantization, defaults.context_window,
          defaults.supports_audio, defaults.supports_vision,
          defaults.supports_function_calling, defaults.license,
          defaults.is_default, defaults.is_active,
        ],
      );
      seeded.push({ id, organization_id: organizationId, ...defaults, created_at: new Date().toISOString() });
    }
    return seeded;
  }

  /** Get the recommended model for a given platform */
  async selectForPlatform(organizationId: string, platform: PlatformType): Promise<ModelProfile | null> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_model_profiles
       WHERE organization_id = $1 AND platform_type = $2 AND is_active = TRUE
       ORDER BY is_default DESC, created_at DESC LIMIT 1`,
      [organizationId, platform],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** List all model profiles for an org */
  async listProfiles(organizationId: string, opts?: { platform?: PlatformType; activeOnly?: boolean }): Promise<ModelProfile[]> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    if (opts?.platform) { params.push(opts.platform); conditions.push(`platform_type = $${params.length}`); }
    if (opts?.activeOnly !== false) { conditions.push('is_active = TRUE'); }
    const result = await this.pool.query(
      `SELECT * FROM gemma4_model_profiles WHERE ${conditions.join(' AND ')} ORDER BY platform_type, is_default DESC`,
      params,
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  /** Register a custom model profile (model agnosticism support) */
  async registerProfile(organizationId: string, input: Partial<ModelProfile>): Promise<ModelProfile> {
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO gemma4_model_profiles (
        id, organization_id, model_key, model_name, provider, platform_type,
        parameter_count, quantization, context_window,
        supports_audio, supports_vision, supports_function_calling,
        license, is_default, is_active, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
      RETURNING *`,
      [
        id, organizationId, input.model_key, input.model_name, input.provider || 'custom',
        input.platform_type || 'server', input.parameter_count || 'unknown',
        input.quantization || 'unknown', input.context_window || 4096,
        input.supports_audio || false, input.supports_vision || false,
        input.supports_function_calling || false, input.license || 'unknown',
        input.is_default || false, true,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  /** Deactivate a model profile */
  async deactivateProfile(organizationId: string, profileId: string): Promise<void> {
    await this.pool.query(
      `UPDATE gemma4_model_profiles SET is_active = FALSE WHERE id = $1 AND organization_id = $2`,
      [profileId, organizationId],
    );
  }

  /** Export GEMMA4_DEFAULTS for external use */
  static getDefaults(): typeof GEMMA4_DEFAULTS { return GEMMA4_DEFAULTS; }

  private mapRow(r: Record<string, unknown>): ModelProfile {
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      model_key: String(r.model_key),
      model_name: String(r.model_name),
      provider: String(r.provider),
      platform_type: r.platform_type as PlatformType,
      parameter_count: String(r.parameter_count),
      quantization: String(r.quantization),
      context_window: Number(r.context_window),
      supports_audio: Boolean(r.supports_audio),
      supports_vision: Boolean(r.supports_vision),
      supports_function_calling: Boolean(r.supports_function_calling),
      license: String(r.license),
      is_default: Boolean(r.is_default),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    };
  }
}
