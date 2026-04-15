// ---------------------------------------------------------------------------
// Fleet Monitoring & Hot-Swap
// ---------------------------------------------------------------------------
// Real-time GPU VRAM monitoring, model load/unload (hot-swap), and fleet
// health aggregation for local inference nodes.
//
// Supports two runtimes:
//   - Ollama  → GET /api/ps (VRAM per model), POST /api/pull (load), keep_alive=0 (unload)
//   - llama-server (llama.cpp) → GET /health, GET /slots (loaded model info)
// ---------------------------------------------------------------------------

import type { ModelEntry, ModelStatus } from '../registry/index.js';

/* ------------------------------------------------------------------ types */

export type RuntimeType = 'ollama' | 'llama-server';

export interface FleetNode {
  id: string;
  name: string;
  endpoint: string;
  runtime: RuntimeType;
  gpus: GpuInfo[];
  totalVramMb: number;
  healthy: boolean;
  lastProbe: string | null;
}

export interface GpuInfo {
  index: number;
  name: string;
  vramTotalMb: number;
  vramUsedMb: number;
  vramFreeMb: number;
  utilizationPercent: number | null;
}

export interface LoadedModel {
  modelId: string;
  name: string;
  vramMb: number;
  sizeBytes: number;
  parameterCount: string | null;
  quantization: string | null;
  expiresAt: string | null;
}

export interface FleetStatus {
  nodes: FleetNodeStatus[];
  totalVramMb: number;
  usedVramMb: number;
  freeVramMb: number;
  loadedModels: number;
  healthyNodes: number;
  degradedNodes: number;
}

export interface FleetNodeStatus {
  node: FleetNode;
  loadedModels: LoadedModel[];
  vramUsedMb: number;
  vramFreeMb: number;
}

export interface HotSwapResult {
  success: boolean;
  action: 'load' | 'unload';
  modelId: string;
  nodeId: string;
  message: string;
  durationMs: number;
}

/* ------------------------------------------------- Ollama /api/ps types */

interface OllamaPsModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  expires_at: string;
  size_vram: number;
}

interface OllamaPsResponse {
  models: OllamaPsModel[];
}

/* ------------------------------------------ llama-server /health types */

interface LlamaHealthResponse {
  status: string;
  slots_idle?: number;
  slots_processing?: number;
}

interface LlamaSlot {
  id: number;
  state: number;
  model: string;
  n_ctx: number;
  n_predict: number;
}

/* -------------------------------------------------------- probe helpers */

const PROBE_TIMEOUT_MS = 5_000;

async function fetchJson<T>(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<{ ok: boolean; data: T | null; status: number }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    clearTimeout(timer);
    const data = res.ok ? ((await res.json()) as T) : null;
    return { ok: res.ok, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0 };
  }
}

/* ---------------------------------------------------- Ollama probing */

export async function probeOllamaVram(endpoint: string): Promise<FleetNodeStatus | null> {
  const ps = await fetchJson<OllamaPsResponse>(`${endpoint}/api/ps`);
  if (!ps) return null;

  const loadedModels: LoadedModel[] = ps.models.map((m) => ({
    modelId: m.model || m.name,
    name: m.name,
    vramMb: Math.round(m.size_vram / (1024 * 1024)),
    sizeBytes: m.size,
    parameterCount: m.details?.parameter_size ?? null,
    quantization: m.details?.quantization_level ?? null,
    expiresAt: m.expires_at || null,
  }));

  const vramUsedMb = loadedModels.reduce((s, m) => s + m.vramMb, 0);

  return {
    node: {
      id: '',
      name: '',
      endpoint,
      runtime: 'ollama',
      gpus: [],
      totalVramMb: 0,
      healthy: true,
      lastProbe: new Date().toISOString(),
    },
    loadedModels,
    vramUsedMb,
    vramFreeMb: 0,
  };
}

/* ------------------------------------------- llama-server probing */

export async function probeLlamaServerVram(endpoint: string): Promise<FleetNodeStatus | null> {
  const health = await fetchJson<LlamaHealthResponse>(`${endpoint}/health`);
  if (!health) return null;

  const slots = await fetchJson<LlamaSlot[]>(`${endpoint}/slots`);

  const modelName = slots?.[0]?.model ?? 'unknown';
  const loadedModels: LoadedModel[] = modelName !== 'unknown'
    ? [{
        modelId: modelName,
        name: modelName,
        vramMb: 0,
        sizeBytes: 0,
        parameterCount: null,
        quantization: null,
        expiresAt: null,
      }]
    : [];

  return {
    node: {
      id: '',
      name: '',
      endpoint,
      runtime: 'llama-server',
      gpus: [],
      totalVramMb: 0,
      healthy: health.status === 'ok',
      lastProbe: new Date().toISOString(),
    },
    loadedModels,
    vramUsedMb: 0,
    vramFreeMb: 0,
  };
}

/* -------------------------------------------------------- Fleet Manager */

export class FleetManager {
  private nodes = new Map<string, FleetNode>();
  private cachedStatus = new Map<string, FleetNodeStatus>();
  private probeIntervalMs: number;
  private probeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(probeIntervalMs = 30_000) {
    this.probeIntervalMs = probeIntervalMs;
  }

  /* ----------- node registration ----------- */

  registerNode(node: FleetNode): void {
    this.nodes.set(node.id, { ...node });
  }

  unregisterNode(id: string): boolean {
    this.cachedStatus.delete(id);
    return this.nodes.delete(id);
  }

  getNode(id: string): FleetNode | undefined {
    return this.nodes.get(id);
  }

  listNodes(): FleetNode[] {
    return [...this.nodes.values()];
  }

  /* ----------- VRAM probing ----------- */

  async probeNode(id: string): Promise<FleetNodeStatus | null> {
    const node = this.nodes.get(id);
    if (!node) return null;

    let status: FleetNodeStatus | null = null;

    if (node.runtime === 'ollama') {
      status = await probeOllamaVram(node.endpoint);
    } else if (node.runtime === 'llama-server') {
      status = await probeLlamaServerVram(node.endpoint);
    }

    if (status) {
      status.node = { ...node, healthy: status.node.healthy, lastProbe: new Date().toISOString() };
      // Inherit known total VRAM from node registration
      status.vramFreeMb = Math.max(0, node.totalVramMb - status.vramUsedMb);
      this.cachedStatus.set(id, status);
      // Update node health
      node.healthy = status.node.healthy;
      node.lastProbe = status.node.lastProbe;
    } else {
      node.healthy = false;
      node.lastProbe = new Date().toISOString();
    }

    return status;
  }

  async probeAll(): Promise<FleetStatus> {
    const results: FleetNodeStatus[] = [];

    for (const [id] of this.nodes) {
      const status = await this.probeNode(id);
      if (status) results.push(status);
    }

    return this.buildFleetStatus(results);
  }

  getCachedStatus(): FleetStatus {
    return this.buildFleetStatus([...this.cachedStatus.values()]);
  }

  getCachedNodeStatus(id: string): FleetNodeStatus | undefined {
    return this.cachedStatus.get(id);
  }

  private buildFleetStatus(nodeStatuses: FleetNodeStatus[]): FleetStatus {
    const totalVramMb = nodeStatuses.reduce((s, n) => s + n.node.totalVramMb, 0);
    const usedVramMb = nodeStatuses.reduce((s, n) => s + n.vramUsedMb, 0);
    const loadedModels = nodeStatuses.reduce((s, n) => s + n.loadedModels.length, 0);
    const healthyNodes = nodeStatuses.filter((n) => n.node.healthy).length;

    return {
      nodes: nodeStatuses,
      totalVramMb,
      usedVramMb,
      freeVramMb: Math.max(0, totalVramMb - usedVramMb),
      loadedModels,
      healthyNodes,
      degradedNodes: nodeStatuses.length - healthyNodes,
    };
  }

  /* ----------- model hot-swap ----------- */

  /**
   * Load a model on an Ollama node. llama-server does not support hot-swap
   * (model is set at process startup via --model flag).
   */
  async loadModel(nodeId: string, modelName: string): Promise<HotSwapResult> {
    const start = Date.now();
    const node = this.nodes.get(nodeId);

    if (!node) {
      return { success: false, action: 'load', modelId: modelName, nodeId, message: 'Node not found', durationMs: 0 };
    }

    if (node.runtime !== 'ollama') {
      return {
        success: false,
        action: 'load',
        modelId: modelName,
        nodeId,
        message: `Hot-swap not supported on ${node.runtime} — model is set at process startup`,
        durationMs: 0,
      };
    }

    // Ollama: POST /api/pull to ensure the model is downloaded,
    // then POST /api/generate with a tiny prompt to warm it into VRAM.
    const pullResult = await postJson(
      `${node.endpoint}/api/pull`,
      { name: modelName, stream: false },
      120_000,
    );

    if (!pullResult.ok) {
      return {
        success: false,
        action: 'load',
        modelId: modelName,
        nodeId,
        message: `Pull failed (HTTP ${pullResult.status})`,
        durationMs: Date.now() - start,
      };
    }

    // Warm the model into GPU memory with a minimal generation
    const warmResult = await postJson(
      `${node.endpoint}/api/generate`,
      { model: modelName, prompt: 'hi', stream: false, options: { num_predict: 1 } },
      60_000,
    );

    if (!warmResult.ok) {
      return {
        success: false,
        action: 'load',
        modelId: modelName,
        nodeId,
        message: `Model pulled but warm-up failed (HTTP ${warmResult.status})`,
        durationMs: Date.now() - start,
      };
    }

    // Re-probe to update cached VRAM state
    await this.probeNode(nodeId);

    return {
      success: true,
      action: 'load',
      modelId: modelName,
      nodeId,
      message: `Model ${modelName} loaded on ${node.name}`,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Unload a model from an Ollama node by setting keep_alive to 0.
   */
  async unloadModel(nodeId: string, modelName: string): Promise<HotSwapResult> {
    const start = Date.now();
    const node = this.nodes.get(nodeId);

    if (!node) {
      return { success: false, action: 'unload', modelId: modelName, nodeId, message: 'Node not found', durationMs: 0 };
    }

    if (node.runtime !== 'ollama') {
      return {
        success: false,
        action: 'unload',
        modelId: modelName,
        nodeId,
        message: `Hot-swap not supported on ${node.runtime} — model is set at process startup`,
        durationMs: 0,
      };
    }

    // Ollama: POST /api/generate with keep_alive=0 evicts the model from VRAM
    const result = await postJson(
      `${node.endpoint}/api/generate`,
      { model: modelName, prompt: '', keep_alive: 0, stream: false },
      15_000,
    );

    // Re-probe to update cached VRAM state
    await this.probeNode(nodeId);

    return {
      success: result.ok,
      action: 'unload',
      modelId: modelName,
      nodeId,
      message: result.ok
        ? `Model ${modelName} unloaded from ${node.name}`
        : `Unload failed (HTTP ${result.status})`,
      durationMs: Date.now() - start,
    };
  }

  /* ----------- periodic probing ----------- */

  startProbing(): void {
    if (this.probeTimer) return;
    this.probeTimer = setInterval(() => {
      void this.probeAll();
    }, this.probeIntervalMs);
    if (this.probeTimer.unref) this.probeTimer.unref();
    // Initial probe
    void this.probeAll();
  }

  stopProbing(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }
}

/* ----------------------------------------------- default fleet setup */

/**
 * Create a FleetManager pre-configured with the Sven local GPU fleet.
 * VM5 (sven-ai): llama-server, 28 GiB VRAM (RX 9070 XT + RX 6750 XT)
 * VM13 (kaldorei): Ollama, 12 GiB VRAM (RTX 3060)
 */
export function createDefaultFleet(overrides?: {
  vm5Endpoint?: string;
  vm13Endpoint?: string;
  probeIntervalMs?: number;
}): FleetManager {
  const fm = new FleetManager(overrides?.probeIntervalMs ?? 30_000);

  fm.registerNode({
    id: 'vm5-power',
    name: 'VM5 sven-ai (dual AMD)',
    endpoint: overrides?.vm5Endpoint ?? (process.env.SVEN_LLM_POWER_ENDPOINT || 'http://10.47.47.9:8080'),
    runtime: 'llama-server',
    gpus: [
      { index: 0, name: 'RX 9070 XT', vramTotalMb: 16_282, vramUsedMb: 0, vramFreeMb: 16_282, utilizationPercent: null },
      { index: 1, name: 'RX 6750 XT', vramTotalMb: 12_288, vramUsedMb: 0, vramFreeMb: 12_288, utilizationPercent: null },
    ],
    totalVramMb: 28_570,
    healthy: true,
    lastProbe: null,
  });

  fm.registerNode({
    id: 'vm13-fast',
    name: 'VM13 kaldorei (RTX 3060)',
    endpoint: overrides?.vm13Endpoint ?? (process.env.SVEN_LLM_ENDPOINT || 'http://10.47.47.13:11434'),
    runtime: 'ollama',
    gpus: [
      { index: 0, name: 'RTX 3060', vramTotalMb: 12_288, vramUsedMb: 0, vramFreeMb: 12_288, utilizationPercent: null },
    ],
    totalVramMb: 12_288,
    healthy: true,
    lastProbe: null,
  });

  return fm;
}
