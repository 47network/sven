import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.10 + 6.17 Model Agnosticism & Full Gemma 4 Capabilities Service
 * On-device slot not locked to Gemma 4 — architecture allows any GGUF model.
 * Gemma 4 is default, user brings their own.
 * Full capabilities: function calling, audio, vision, 140+ languages,
 * structured JSON, system instructions, agentic workflows.
 */

type CapabilityType =
  | 'function_calling' | 'audio_input' | 'audio_output'
  | 'vision' | 'structured_json' | 'system_instructions'
  | 'agentic_workflows' | 'multilingual' | 'code_generation'
  | 'image_processing' | 'speech_to_text' | 'device_control';

interface ModelCapabilityMap {
  id: string;
  organization_id: string;
  model_profile_id: string;
  capability: CapabilityType;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

interface CustomModelSlot {
  id: string;
  organization_id: string;
  user_id: string;
  slot_name: string;
  model_format: string;
  model_path: string;
  model_size_bytes: number;
  quantization: string;
  context_window: number;
  capabilities: CapabilityType[];
  is_active: boolean;
  created_at: string;
}

/** All capabilities Gemma 4 supports natively */
const GEMMA4_NATIVE_CAPABILITIES: CapabilityType[] = [
  'function_calling', 'audio_input', 'audio_output', 'vision',
  'structured_json', 'system_instructions', 'agentic_workflows',
  'multilingual', 'code_generation', 'image_processing',
  'speech_to_text', 'device_control',
];

/** Supported model formats for custom model slots */
const SUPPORTED_MODEL_FORMATS = ['gguf', 'safetensors', 'onnx', 'tflite', 'mediapipe'];

export class GemmaCapabilitiesService {
  constructor(private pool: pg.Pool) {}

  /** Seed all Gemma 4 native capabilities for a model profile */
  async seedCapabilities(organizationId: string, modelProfileId: string): Promise<ModelCapabilityMap[]> {
    const seeded: ModelCapabilityMap[] = [];
    for (const cap of GEMMA4_NATIVE_CAPABILITIES) {
      const id = uuidv7();
      await this.pool.query(
        `INSERT INTO gemma4_capability_maps (
          id, organization_id, model_profile_id, capability, enabled, config, created_at
        ) VALUES ($1,$2,$3,$4,TRUE,'{}',NOW())
        ON CONFLICT (organization_id, model_profile_id, capability) DO NOTHING`,
        [id, organizationId, modelProfileId, cap],
      );
      seeded.push({
        id, organization_id: organizationId, model_profile_id: modelProfileId,
        capability: cap, enabled: true, config: {}, created_at: new Date().toISOString(),
      });
    }
    return seeded;
  }

  /** List capabilities for a model profile */
  async listCapabilities(organizationId: string, modelProfileId: string): Promise<ModelCapabilityMap[]> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_capability_maps WHERE organization_id = $1 AND model_profile_id = $2 ORDER BY capability`,
      [organizationId, modelProfileId],
    );
    return result.rows.map((r) => this.mapCapability(r));
  }

  /** Toggle a specific capability */
  async toggleCapability(organizationId: string, modelProfileId: string, capability: CapabilityType, enabled: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE gemma4_capability_maps SET enabled = $4, updated_at = NOW()
       WHERE organization_id = $1 AND model_profile_id = $2 AND capability = $3`,
      [organizationId, modelProfileId, capability, enabled],
    );
  }

  /** Update capability config (e.g., language list for multilingual) */
  async updateCapabilityConfig(organizationId: string, modelProfileId: string, capability: CapabilityType, config: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `UPDATE gemma4_capability_maps SET config = $4, updated_at = NOW()
       WHERE organization_id = $1 AND model_profile_id = $2 AND capability = $3`,
      [organizationId, modelProfileId, capability, JSON.stringify(config)],
    );
  }

  /** Register a custom model slot (BYOM — bring your own model) */
  async registerCustomModel(
    organizationId: string,
    userId: string,
    input: Partial<CustomModelSlot>,
  ): Promise<CustomModelSlot> {
    if (!input.model_format || !SUPPORTED_MODEL_FORMATS.includes(input.model_format)) {
      throw new Error(`Unsupported model format. Supported: ${SUPPORTED_MODEL_FORMATS.join(', ')}`);
    }
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO gemma4_custom_model_slots (
        id, organization_id, user_id, slot_name, model_format, model_path,
        model_size_bytes, quantization, context_window, capabilities,
        is_active, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,NOW())
      RETURNING *`,
      [
        id, organizationId, userId, input.slot_name || 'custom-model',
        input.model_format, input.model_path || '',
        input.model_size_bytes || 0, input.quantization || 'unknown',
        input.context_window || 4096, JSON.stringify(input.capabilities || []),
      ],
    );
    return this.mapSlot(result.rows[0]);
  }

  /** List custom model slots for a user */
  async listCustomModels(organizationId: string, userId: string): Promise<CustomModelSlot[]> {
    const result = await this.pool.query(
      `SELECT * FROM gemma4_custom_model_slots
       WHERE organization_id = $1 AND user_id = $2 AND is_active = TRUE
       ORDER BY created_at DESC`,
      [organizationId, userId],
    );
    return result.rows.map((r) => this.mapSlot(r));
  }

  /** Deactivate a custom model slot */
  async deactivateSlot(slotId: string): Promise<void> {
    await this.pool.query(`UPDATE gemma4_custom_model_slots SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [slotId]);
  }

  /** Get native capabilities list */
  static getNativeCapabilities(): CapabilityType[] { return [...GEMMA4_NATIVE_CAPABILITIES]; }

  /** Get supported model formats */
  static getSupportedFormats(): string[] { return [...SUPPORTED_MODEL_FORMATS]; }

  private mapCapability(r: Record<string, unknown>): ModelCapabilityMap {
    return {
      id: String(r.id), organization_id: String(r.organization_id),
      model_profile_id: String(r.model_profile_id), capability: r.capability as CapabilityType,
      enabled: Boolean(r.enabled),
      config: (r.config as Record<string, unknown>) || {},
      created_at: String(r.created_at),
    };
  }

  private mapSlot(r: Record<string, unknown>): CustomModelSlot {
    let capabilities: CapabilityType[];
    if (typeof r.capabilities === 'string') { try { capabilities = JSON.parse(r.capabilities as string); } catch { capabilities = []; } }
    else if (Array.isArray(r.capabilities)) { capabilities = r.capabilities as CapabilityType[]; }
    else { capabilities = []; }
    return {
      id: String(r.id), organization_id: String(r.organization_id), user_id: String(r.user_id),
      slot_name: String(r.slot_name), model_format: String(r.model_format),
      model_path: String(r.model_path), model_size_bytes: Number(r.model_size_bytes),
      quantization: String(r.quantization), context_window: Number(r.context_window),
      capabilities, is_active: Boolean(r.is_active), created_at: String(r.created_at),
    };
  }
}
