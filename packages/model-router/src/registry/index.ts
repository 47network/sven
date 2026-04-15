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
// These entries reflect actually deployed local models — not aspirational.
// VM5 (sven-ai, 10.47.47.9): llama-server on port 8080, OpenAI-compat,
//   RX 9070 XT (15.9 GiB) + RX 6750 XT (12 GiB) = 28 GiB, ROCm/HIP.
// VM13 (kaldorei, 10.47.47.13): Ollama on port 11434, RTX 3060 (12 GiB).

const BUILT_IN_MODELS: ModelEntry[] = [
  {
    id: 'qwen2.5-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'local',
    version: '2.5',
    parameterCount: '32B',
    quantization: 'gguf',
    supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
    vramRequirementMb: 18_500,
    diskSizeMb: 19_000,
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: 'http://10.47.47.9:8080/v1',
    hostDevice: 'vm5-sven-ai',
    status: 'ready',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {
      runtime: 'llama-server',
      quantFile: 'qwen2.5-coder-32b.gguf',
      quantVariant: 'Q4_K_M',
      tensorSplit: '57/43',
      gpus: ['RX 9070 XT (15.9 GiB)', 'RX 6750 XT (12 GiB)'],
      apiFormat: 'openai',
    },
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B',
    provider: 'local',
    version: '2.5',
    parameterCount: '7B',
    quantization: 'gguf',
    supportedTasks: ['coding', 'reasoning', 'chat', 'summarization', 'translation'],
    vramRequirementMb: 4_500,
    diskSizeMb: 4_700,
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: 'http://10.47.47.13:11434',
    hostDevice: 'vm13-kaldorei',
    status: 'ready',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {
      runtime: 'ollama',
      ollamaModel: 'qwen2.5:7b',
      gpu: 'RTX 3060 (12 GiB)',
      apiFormat: 'ollama',
    },
  },
  {
    id: 'deepseek-r1-7b',
    name: 'DeepSeek R1 7B',
    provider: 'local',
    version: '1.0',
    parameterCount: '7B',
    quantization: 'gguf',
    supportedTasks: ['reasoning', 'coding', 'chat'],
    vramRequirementMb: 4_500,
    diskSizeMb: 4_700,
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    license: 'MIT',
    licenseCommercialUse: true,
    endpoint: 'http://10.47.47.13:11434',
    hostDevice: 'vm13-kaldorei',
    status: 'ready',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {
      runtime: 'ollama',
      ollamaModel: 'deepseek-r1:7b',
      gpu: 'RTX 3060 (12 GiB)',
      apiFormat: 'ollama',
    },
  },
  {
    id: 'llama3.2-3b',
    name: 'Llama 3.2 3B',
    provider: 'local',
    version: '3.2',
    parameterCount: '3B',
    quantization: 'gguf',
    supportedTasks: ['chat', 'summarization'],
    vramRequirementMb: 2_000,
    diskSizeMb: 2_000,
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    license: 'Llama 3.2 Community',
    licenseCommercialUse: true,
    endpoint: 'http://10.47.47.13:11434',
    hostDevice: 'vm13-kaldorei',
    status: 'ready',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {
      runtime: 'ollama',
      ollamaModel: 'llama3.2:3b',
      gpu: 'RTX 3060 (12 GiB)',
      apiFormat: 'ollama',
    },
  },
  {
    id: 'nomic-embed-text',
    name: 'Nomic Embed Text',
    provider: 'local',
    version: '1.5',
    parameterCount: '0.1B',
    quantization: 'fp16',
    supportedTasks: ['embedding'],
    vramRequirementMb: 300,
    diskSizeMb: 280,
    contextWindow: 8_192,
    maxOutputTokens: 0,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: 'http://10.47.47.13:11434',
    hostDevice: 'vm13-kaldorei',
    status: 'ready',
    tokensPerSecond: null,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {
      runtime: 'ollama',
      ollamaModel: 'nomic-embed-text',
      gpu: 'RTX 3060 (12 GiB)',
      apiFormat: 'ollama',
      embeddingDim: 768,
    },
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
