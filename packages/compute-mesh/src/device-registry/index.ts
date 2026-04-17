// ---------------------------------------------------------------------------
// Device Registry
// ---------------------------------------------------------------------------
// Tracks all devices in the compute mesh — VMs, phones, desktops, and
// federated instances. Records capabilities, status, opt-in preferences,
// battery awareness, and network topology.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type DeviceType = 'vm' | 'mobile' | 'desktop' | 'federated';

export type DeviceStatus = 'online' | 'offline' | 'busy' | 'draining' | 'error';

export interface GpuInfo {
  name: string;
  vramMb: number;
  computeCapability: string;
}

export interface BatteryInfo {
  levelPct: number;
  charging: boolean;
  estimatedMinutes: number;
}

export interface DeviceCapabilities {
  cpuCores: number;
  cpuFrequencyMhz: number;
  ramMb: number;
  gpu: GpuInfo | null;
  storageFreeGb: number;
  networkBandwidthMbps: number;
  battery: BatteryInfo | null;
  runtimes: string[];             // 'docker', 'wasm', 'dart-isolate', 'node', 'python'
  maxWorkUnits: number;
}

export interface MeshDevice {
  id: string;
  name: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  wireguardIp: string | null;
  federationInstanceId: string | null;
  optedIn: boolean;
  batteryMinPct: number;          // only accept work above this battery level
  currentWorkUnits: number;
  totalJobsCompleted: number;
  totalComputeMs: number;
  lastHeartbeat: string;
  registeredAt: string;
  metadata: Record<string, unknown>;
}

/* --------------------------------------------------------- registry class */

const BUILT_IN_DEVICES: MeshDevice[] = [
  createDevice('vm4-coordinator', 'VM4 Coordinator', 'vm', {
    cpuCores: 8, cpuFrequencyMhz: 3400, ramMb: 32_768,
    gpu: null, storageFreeGb: 200, networkBandwidthMbps: 1000,
    battery: null, runtimes: ['docker', 'node', 'python'], maxWorkUnits: 20,
  }),
  createDevice('vm5-gpu', 'VM5 GPU Worker', 'vm', {
    cpuCores: 16, cpuFrequencyMhz: 3600, ramMb: 65_536,
    gpu: { name: 'NVIDIA A100', vramMb: 40_960, computeCapability: '8.0' },
    storageFreeGb: 500, networkBandwidthMbps: 10_000,
    battery: null, runtimes: ['docker', 'node', 'python'], maxWorkUnits: 10,
  }),
  createDevice('vm13-inference', 'VM13 Inference', 'vm', {
    cpuCores: 8, cpuFrequencyMhz: 3200, ramMb: 32_768,
    gpu: { name: 'NVIDIA T4', vramMb: 16_384, computeCapability: '7.5' },
    storageFreeGb: 100, networkBandwidthMbps: 1000,
    battery: null, runtimes: ['docker', 'node'], maxWorkUnits: 8,
  }),
  createDevice('s24-ultra', 'S24 Ultra Mobile', 'mobile', {
    cpuCores: 8, cpuFrequencyMhz: 3390, ramMb: 12_288,
    gpu: { name: 'Adreno 750', vramMb: 4_096, computeCapability: 'mobile' },
    storageFreeGb: 64, networkBandwidthMbps: 100,
    battery: { levelPct: 85, charging: false, estimatedMinutes: 480 },
    runtimes: ['dart-isolate', 'wasm'], maxWorkUnits: 3,
  }),
  createDevice('desktop-workstation', 'Desktop Workstation', 'desktop', {
    cpuCores: 12, cpuFrequencyMhz: 4200, ramMb: 32_768,
    gpu: { name: 'RTX 4070', vramMb: 12_288, computeCapability: '8.9' },
    storageFreeGb: 300, networkBandwidthMbps: 500,
    battery: null, runtimes: ['docker', 'node', 'python', 'wasm'], maxWorkUnits: 8,
  }),
];

function createDevice(id: string, name: string, deviceType: DeviceType, caps: DeviceCapabilities): MeshDevice {
  const now = new Date().toISOString();
  return {
    id, name, deviceType,
    status: 'online',
    capabilities: caps,
    wireguardIp: null,
    federationInstanceId: null,
    optedIn: true,
    batteryMinPct: 20,
    currentWorkUnits: 0,
    totalJobsCompleted: 0,
    totalComputeMs: 0,
    lastHeartbeat: now,
    registeredAt: now,
    metadata: {},
  };
}

export class DeviceRegistry {
  private devices = new Map<string, MeshDevice>();

  constructor() {
    for (const d of BUILT_IN_DEVICES) {
      this.devices.set(d.id, { ...d });
    }
  }

  register(device: MeshDevice): void {
    this.devices.set(device.id, { ...device });
  }

  unregister(id: string): boolean {
    return this.devices.delete(id);
  }

  get(id: string): MeshDevice | undefined {
    return this.devices.get(id);
  }

  list(): MeshDevice[] {
    return [...this.devices.values()];
  }

  listOnline(): MeshDevice[] {
    return this.list().filter((d) => d.status === 'online' && d.optedIn);
  }

  listByType(type: DeviceType): MeshDevice[] {
    return this.list().filter((d) => d.deviceType === type);
  }

  heartbeat(id: string, caps?: Partial<DeviceCapabilities>): void {
    const d = this.devices.get(id);
    if (d) {
      d.lastHeartbeat = new Date().toISOString();
      d.status = 'online';
      if (caps) Object.assign(d.capabilities, caps);
    }
  }

  setStatus(id: string, status: DeviceStatus): void {
    const d = this.devices.get(id);
    if (d) d.status = status;
  }

  optIn(id: string): void {
    const d = this.devices.get(id);
    if (d) d.optedIn = true;
  }

  optOut(id: string): void {
    const d = this.devices.get(id);
    if (d) d.optedIn = false;
  }

  recordCompletion(id: string, computeMs: number): void {
    const d = this.devices.get(id);
    if (d) {
      d.totalJobsCompleted++;
      d.totalComputeMs += computeMs;
    }
  }

  /** Get available VRAM across all online GPU devices */
  totalAvailableVram(): number {
    return this.listOnline()
      .filter((d) => d.capabilities.gpu)
      .reduce((s, d) => s + (d.capabilities.gpu?.vramMb ?? 0), 0);
  }

  /** Aggregate mesh stats */
  meshStats(): { devices: number; online: number; gpuDevices: number; totalVramMb: number; totalRamMb: number; totalCores: number } {
    const all = this.list();
    const online = this.listOnline();
    return {
      devices: all.length,
      online: online.length,
      gpuDevices: online.filter((d) => d.capabilities.gpu).length,
      totalVramMb: this.totalAvailableVram(),
      totalRamMb: online.reduce((s, d) => s + d.capabilities.ramMb, 0),
      totalCores: online.reduce((s, d) => s + d.capabilities.cpuCores, 0),
    };
  }
}
