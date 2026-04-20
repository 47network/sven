// ---------------------------------------------------------------------------
// Batch 29 — Model Fleet shared types
// ---------------------------------------------------------------------------
// GPU device management, VRAM-aware scheduling, model deployments, benchmarks.
// ---------------------------------------------------------------------------

/* ─── Enums / unions ───────────────────────────────────────────────────── */

export type GpuDeviceStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

export type DeploymentStatus = 'pending' | 'loading' | 'ready' | 'unloading' | 'failed' | 'evicted';

export type ModelQuantization =
  | 'fp16' | 'fp32'
  | 'q8_0' | 'q6_k' | 'q5_k_m' | 'q4_k_m' | 'q4_0' | 'q3_k_m' | 'q2_k'
  | 'gguf' | 'awq' | 'gptq' | 'exl2';

export type BenchmarkType = 'latency' | 'throughput' | 'quality' | 'cost' | 'memory';

export type VramAction = 'allocate' | 'release' | 'evict' | 'reserve';

export type EvictionPolicy = 'lru' | 'lfu' | 'priority' | 'fifo';

/* ─── Interfaces ───────────────────────────────────────────────────────── */

export interface GpuDevice {
  id: string;
  orgId: string;
  hostname: string;
  deviceName: string;
  gpuModel: string;
  vramTotalMb: number;
  vramUsedMb: number;
  vramReservedMb: number;
  status: GpuDeviceStatus;
  wireguardIp?: string;
  driverVersion?: string;
  computeCapability?: string;
  temperatureC?: number;
  powerDrawW?: number;
  utilizationPct: number;
  lastHeartbeat?: Date;
  registeredAt: Date;
  metadata: Record<string, unknown>;
}

export interface ModelDeployment {
  id: string;
  orgId: string;
  modelName: string;
  modelVariant?: string;
  gpuDeviceId: string;
  vramRequiredMb: number;
  quantization?: ModelQuantization;
  status: DeploymentStatus;
  priority: number;
  port?: number;
  pid?: number;
  lastInference?: Date;
  loadTimeMs?: number;
  requestCount: number;
  errorCount: number;
  deployedAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface ModelBenchmark {
  id: string;
  orgId: string;
  deploymentId: string;
  benchmarkType: BenchmarkType;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  tokensPerSecond?: number;
  qualityScore?: number;
  costPer1kTokens?: number;
  vramPeakMb?: number;
  contextLength?: number;
  batchSize: number;
  measuredAt: Date;
  metadata: Record<string, unknown>;
}

export interface VramAllocationEntry {
  id: string;
  orgId: string;
  gpuDeviceId: string;
  deploymentId?: string;
  action: VramAction;
  vramMb: number;
  vramBeforeMb: number;
  vramAfterMb: number;
  reason?: string;
  createdAt: Date;
}

export interface FleetConfig {
  vramReservePct: number;
  evictionPolicy: EvictionPolicy;
  heartbeatIntervalS: number;
  autoBenchmark: boolean;
  maxDeploymentsPerGpu: number;
}

/* ─── Constants ────────────────────────────────────────────────────────── */

export const GPU_DEVICE_STATUSES: GpuDeviceStatus[] = ['online', 'offline', 'degraded', 'maintenance'];

export const DEPLOYMENT_STATUSES: DeploymentStatus[] = ['pending', 'loading', 'ready', 'unloading', 'failed', 'evicted'];

export const DEPLOYMENT_TERMINAL_STATUSES: DeploymentStatus[] = ['failed', 'evicted'];

export const BENCHMARK_TYPES: BenchmarkType[] = ['latency', 'throughput', 'quality', 'cost', 'memory'];

export const VRAM_ACTIONS: VramAction[] = ['allocate', 'release', 'evict', 'reserve'];

export const MODEL_QUANTIZATIONS: ModelQuantization[] = [
  'fp16', 'fp32', 'q8_0', 'q6_k', 'q5_k_m', 'q4_k_m', 'q4_0', 'q3_k_m', 'q2_k',
  'gguf', 'awq', 'gptq', 'exl2',
];

export const DEFAULT_FLEET_CONFIG: FleetConfig = {
  vramReservePct: 15,
  evictionPolicy: 'lru',
  heartbeatIntervalS: 30,
  autoBenchmark: true,
  maxDeploymentsPerGpu: 4,
};

/* ─── Known GPU profiles (VRAM capacity lookup) ────────────────────────── */

export const KNOWN_GPU_PROFILES: Record<string, { vramMb: number; arch: string }> = {
  'RTX 3060':       { vramMb: 12288, arch: 'Ampere' },
  'RTX 3070':       { vramMb: 8192,  arch: 'Ampere' },
  'RTX 3080':       { vramMb: 10240, arch: 'Ampere' },
  'RTX 3090':       { vramMb: 24576, arch: 'Ampere' },
  'RTX 4060':       { vramMb: 8192,  arch: 'Ada Lovelace' },
  'RTX 4070':       { vramMb: 12288, arch: 'Ada Lovelace' },
  'RTX 4080':       { vramMb: 16384, arch: 'Ada Lovelace' },
  'RTX 4090':       { vramMb: 24576, arch: 'Ada Lovelace' },
  'RX 6750 XT':     { vramMb: 12288, arch: 'RDNA 2' },
  'RX 7900 XTX':    { vramMb: 24576, arch: 'RDNA 3' },
  'RX 9070 XT':     { vramMb: 16384, arch: 'RDNA 4' },
  'A100 40GB':      { vramMb: 40960, arch: 'Ampere' },
  'A100 80GB':      { vramMb: 81920, arch: 'Ampere' },
  'H100':           { vramMb: 81920, arch: 'Hopper' },
};

/* ─── Utility functions ────────────────────────────────────────────────── */

/** Available VRAM on a device accounting for reservation */
export function availableVram(device: GpuDevice, config: FleetConfig = DEFAULT_FLEET_CONFIG): number {
  const reserveMb = Math.ceil(device.vramTotalMb * config.vramReservePct / 100);
  return Math.max(0, device.vramTotalMb - device.vramUsedMb - device.vramReservedMb - reserveMb);
}

/** Check if a model can fit on a device */
export function canFitModel(device: GpuDevice, vramRequiredMb: number, config?: FleetConfig): boolean {
  return availableVram(device, config) >= vramRequiredMb;
}

/** Select the best GPU for a deployment (most available VRAM among online devices) */
export function selectBestGpu(devices: GpuDevice[], vramRequiredMb: number, config?: FleetConfig): GpuDevice | null {
  const candidates = devices
    .filter(d => d.status === 'online' && canFitModel(d, vramRequiredMb, config))
    .sort((a, b) => availableVram(b, config) - availableVram(a, config));
  return candidates[0] ?? null;
}

/** Pick deployments to evict from a device to free targetMb of VRAM */
export function selectEvictionCandidates(
  deployments: ModelDeployment[],
  targetMb: number,
  policy: EvictionPolicy = 'lru',
): ModelDeployment[] {
  const ready = deployments.filter(d => d.status === 'ready');
  let sorted: ModelDeployment[];
  switch (policy) {
    case 'lru':
      sorted = [...ready].sort((a, b) =>
        (a.lastInference?.getTime() ?? 0) - (b.lastInference?.getTime() ?? 0));
      break;
    case 'lfu':
      sorted = [...ready].sort((a, b) => a.requestCount - b.requestCount);
      break;
    case 'priority':
      sorted = [...ready].sort((a, b) => a.priority - b.priority);
      break;
    case 'fifo':
      sorted = [...ready].sort((a, b) => a.deployedAt.getTime() - b.deployedAt.getTime());
      break;
  }
  const result: ModelDeployment[] = [];
  let freed = 0;
  for (const d of sorted) {
    if (freed >= targetMb) break;
    result.push(d);
    freed += d.vramRequiredMb;
  }
  return result;
}

/** Estimate cost efficiency: quality per dollar */
export function costEfficiency(benchmark: ModelBenchmark): number {
  if (!benchmark.qualityScore || !benchmark.costPer1kTokens || benchmark.costPer1kTokens === 0) return 0;
  return benchmark.qualityScore / benchmark.costPer1kTokens;
}

/** VRAM utilization percentage for a device */
export function vramUtilization(device: GpuDevice): number {
  if (device.vramTotalMb === 0) return 0;
  return Math.round((device.vramUsedMb / device.vramTotalMb) * 100);
}

/** Check if a deployment status is terminal */
export function isTerminalDeployment(status: DeploymentStatus): boolean {
  return DEPLOYMENT_TERMINAL_STATUSES.includes(status);
}
