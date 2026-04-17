// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------
// Tracks all available models, their capabilities, resource requirements,
// quantization formats, and health status. Hot-reloadable YAML config.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type TaskType =
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'ocr'
  | 'translation'
  | 'summarization'
  | 'financial'
  | 'embedding'
  | 'chat'
  | 'image_generation';

export type QuantFormat = 'fp32' | 'fp16' | 'bf16' | 'int8' | 'int4' | 'gguf' | 'gptq' | 'awq';

export type ModelStatus = 'available' | 'loading' | 'ready' | 'error' | 'evicted' | 'downloading';

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;             // 'google', 'nvidia', 'alibaba', 'xiaomi', 'thudm', 'meta', 'local'
  version: string;
  parameterCount: string;       // '0.9B', '7B', '70B', '120B'
  quantization: QuantFormat;
  supportedTasks: TaskType[];
  vramRequirementMb: number;
  diskSizeMb: number;
  contextWindow: number;
  maxOutputTokens: number;
  license: string;
  licenseCommercialUse: boolean;
  endpoint: string | null;      // inference URL (null = not deployed)
  hostDevice: string | null;    // device/VM running the model
  status: ModelStatus;
  tokensPerSecond: number | null;
  lastHealthCheck: string | null;
  registeredAt: string;
  metadata: Record<string, unknown>;
}

export interface ModelManifest {
  models: ModelEntry[];
  defaultModels: Partial<Record<TaskType, string>>; // task → model ID
}

/* -------------------------------------------------------- built-in models */

const BUILT_IN_MODELS: ModelEntry[] = [
  {
    id: 'gemma-4',
    name: 'Gemma 4',
    provider: 'google',
    version: '4.0',
    parameterCount: '27B',
    quantization: 'int8',
    supportedTasks: ['reasoning', 'coding', 'chat', 'summarization', 'translation'],
    vramRequirementMb: 14_000,
    diskSizeMb: 27_000,
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    license: 'Gemma',
    licenseCommercialUse: true,
    endpoint: null,
    hostDevice: null,
    status: 'available',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {},
  },
  {
    id: 'nemotron-3-super',
    name: 'Nemotron 3 Super',
    provider: 'nvidia',
    version: '3.0',
    parameterCount: '120B',
    quantization: 'int4',
    supportedTasks: ['reasoning', 'coding', 'chat', 'summarization'],
    vramRequirementMb: 40_000,
    diskSizeMb: 65_000,
    contextWindow: 32_000,
    maxOutputTokens: 4_096,
    license: 'Nvidia Community',
    licenseCommercialUse: true,
    endpoint: null,
    hostDevice: null,
    status: 'available',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {},
  },
  {
    id: 'qwen-3.5',
    name: 'Qwen 3.5',
    provider: 'alibaba',
    version: '3.5',
    parameterCount: '72B',
    quantization: 'int4',
    supportedTasks: ['reasoning', 'coding', 'vision', 'chat', 'translation'],
    vramRequirementMb: 24_000,
    diskSizeMb: 40_000,
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: null,
    hostDevice: null,
    status: 'available',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {},
  },
  {
    id: 'mimo-v2-pro',
    name: 'MIMO V2 Pro',
    provider: 'xiaomi',
    version: '2.0',
    parameterCount: '7B',
    quantization: 'fp16',
    supportedTasks: ['vision', 'ocr', 'chat'],
    vramRequirementMb: 14_000,
    diskSizeMb: 14_000,
    contextWindow: 32_000,
    maxOutputTokens: 4_096,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: null,
    hostDevice: null,
    status: 'available',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {},
  },
  {
    id: 'glm-ocr',
    name: 'GLM-OCR',
    provider: 'thudm',
    version: '1.0',
    parameterCount: '0.9B',
    quantization: 'int8',
    supportedTasks: ['ocr'],
    vramRequirementMb: 1_000,
    diskSizeMb: 2_000,
    contextWindow: 8_000,
    maxOutputTokens: 4_096,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: null,
    hostDevice: null,
    status: 'available',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: { note: '16000x cheaper than cloud alternatives' },
  },
  {
    id: 'kronos-financial',
    name: 'Kronos Financial',
    provider: 'local',
    version: '0.1.0',
    parameterCount: 'TBD',
    quantization: 'fp16',
    supportedTasks: ['financial'],
    vramRequirementMb: 8_000,
    diskSizeMb: 16_000,
    contextWindow: 16_000,
    maxOutputTokens: 2_048,
    license: 'Proprietary',
    licenseCommercialUse: true,
    endpoint: null,
    hostDevice: null,
    status: 'available',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: { pillar: 6, purpose: 'Financial time-series prediction' },
  },
];

/* -------------------------------------------------------- registry class */

export class ModelRegistry {
  private models = new Map<string, ModelEntry>();
  private taskDefaults = new Map<TaskType, string>();

  constructor() {
    for (const m of BUILT_IN_MODELS) {
      this.models.set(m.id, { ...m });
    }
  }

  register(model: ModelEntry): void {
    this.models.set(model.id, { ...model });
  }

  unregister(id: string): boolean {
    return this.models.delete(id);
  }

  get(id: string): ModelEntry | undefined {
    return this.models.get(id);
  }

  list(): ModelEntry[] {
    return [...this.models.values()];
  }

  listByTask(task: TaskType): ModelEntry[] {
    return this.list().filter((m) => m.supportedTasks.includes(task));
  }

  listByStatus(status: ModelStatus): ModelEntry[] {
    return this.list().filter((m) => m.status === status);
  }

  listReady(): ModelEntry[] {
    return this.listByStatus('ready');
  }

  setStatus(id: string, status: ModelStatus): void {
    const m = this.models.get(id);
    if (m) m.status = status;
  }

  setEndpoint(id: string, endpoint: string, host: string): void {
    const m = this.models.get(id);
    if (m) {
      m.endpoint = endpoint;
      m.hostDevice = host;
      m.status = 'ready';
    }
  }

  recordHealthCheck(id: string, tokensPerSecond: number): void {
    const m = this.models.get(id);
    if (m) {
      m.tokensPerSecond = tokensPerSecond;
      m.lastHealthCheck = new Date().toISOString();
    }
  }

  setDefaultModel(task: TaskType, modelId: string): void {
    this.taskDefaults.set(task, modelId);
  }

  getDefaultModel(task: TaskType): ModelEntry | undefined {
    const id = this.taskDefaults.get(task);
    return id ? this.models.get(id) : undefined;
  }

  getManifest(): ModelManifest {
    return {
      models: this.list(),
      defaultModels: Object.fromEntries(this.taskDefaults.entries()) as Partial<Record<TaskType, string>>,
    };
  }

  /** VRAM consumption of all ready or loading models */
  totalVramUsageMb(): number {
    return this.list()
      .filter((m) => m.status === 'ready' || m.status === 'loading')
      .reduce((s, m) => s + m.vramRequirementMb, 0);
  }

  /** Check if a model fits in the given VRAM budget */
  fitsInVram(modelId: string, availableVramMb: number): boolean {
    const m = this.models.get(modelId);
    return m ? m.vramRequirementMb <= availableVramMb : false;
  }
}
