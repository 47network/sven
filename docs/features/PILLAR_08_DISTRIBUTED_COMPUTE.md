# Pillar 8 — Distributed Compute Mesh

> **Source**: User Vision + Video 11 (AirLLM)
> **Priority**: HIGH | **Complexity**: Very High
> **Status**: Specification Complete — Implementation Not Started

---

## Executive Summary

Build a distributed compute mesh that allows Sven to scatter processing workloads across all devices he has access to — VMs, user phones (S24 Ultra), desktop companions, federated devices — creating a collective processing swarm. Heavy tasks (backtesting, simulations, model inference, batch analysis) are decomposed into work units and distributed across this mesh. Devices opt-in, contribute compute capacity, and Sven orchestrates the entire fabric.

**User Vision**: "Can we make sven like able to send processing stuff to all the devices he has access to — like my S24 Ultra, it has enough power, other deployment PCs that I connect sven to, other users with same scenario device etc since we also do the federation — so that he can do complex tasks or make agents that runs the tasks on the devices but scattered across a whole nest of processing power?"

---

## Table of Contents

1. [Concept & Motivation](#1-concept--motivation)
2. [Architecture Overview](#2-architecture-overview)
3. [Compute Mesh Coordinator](#3-compute-mesh-coordinator)
4. [Device Agents (Workers)](#4-device-agents-workers)
5. [Work Decomposition & Scheduling](#5-work-decomposition--scheduling)
6. [AirLLM-Style Layer-by-Layer Inference](#6-airllm-style-layer-by-layer-inference)
7. [Security & Isolation](#7-security--isolation)
8. [Federation Integration](#8-federation-integration)
9. [Use Cases](#9-use-cases)
10. [Communication Protocol](#10-communication-protocol)
11. [Implementation Phases](#11-implementation-phases)
12. [Granular Checklist](#12-granular-checklist)

---

## 1. Concept & Motivation

### The Problem

Sven runs heavy workloads that benefit from parallelization:
- MiroFish simulations with 100,000+ agents
- Backtesting across years of data and multiple strategies
- Kronos inference on 50+ symbols in parallel
- Competitive intelligence scraping across dozens of targets
- Batch document OCR processing
- Large model inference (70B+ parameter models)

Currently all compute runs on 6 VMs. The user has additional devices (S24 Ultra, desktop companions, and federated user devices) sitting idle with unused compute capacity.

### The Solution

A mesh network where:
1. **Coordinator** (VM4) decomposes jobs into work units
2. **Workers** (VMs, phones, desktops, federated devices) pull and execute units
3. **Results** aggregate back to the coordinator
4. Devices opt-in and opt-out dynamically
5. Work units are isolated, encrypted, and verifiable

### AirLLM Inspiration (Video 11)

> "Air LLM loads one layer at a time, runs the computation, and then frees the memory before loading the next layer. Think of it like reading a book one page at a time instead of holding the whole library in your hands."

This layer-by-layer approach enables running large models on small devices. We extend this: split model layers across multiple devices, each processing their assigned layers and passing activations forward.

---

## 2. Architecture Overview

```
                    ┌──────────────────────────────────┐
                    │     Compute Mesh Coordinator      │
                    │  (Job decomposition, scheduling,  │
                    │   result aggregation, monitoring)  │
                    │         Service: compute-mesh      │
                    └──────┬───────┬──────┬─────┬──────┘
                           │       │      │     │
              ┌────────────▼┐ ┌────▼───┐ ┌▼────┐│┌──────────────┐
              │  VM Workers  │ │ Mobile │ │Desk-│││  Federated   │
              │ VM4,5,6,7,  │ │Workers │ │ top ││| Device       │
              │ 12,13       │ │ S24    │ │Comp │││  Workers     │
              └─────────────┘ └────────┘ └─────┘│└──────────────┘
                                                │
                                       ┌────────▼────────┐
                                       │  NATS JetStream  │
                                       │ (Work Queue &    │
                                       │  Result Stream)  │
                                       └─────────────────┘
```

### Service Layout

```
services/
└── compute-mesh/
    ├── src/
    │   ├── index.ts                    — Service entry, health check
    │   ├── coordinator/
    │   │   ├── job-manager.ts          — Job lifecycle management
    │   │   ├── decomposer.ts          — Break jobs into work units
    │   │   ├── scheduler.ts           — Assign units to workers
    │   │   ├── result-aggregator.ts   — Collect and combine results
    │   │   ├── device-registry.ts     — Track registered devices
    │   │   └── monitor.ts            — Health, progress, metrics
    │   ├── protocol/
    │   │   ├── messages.ts            — Message type definitions
    │   │   ├── encryption.ts          — Work unit encryption
    │   │   └── verification.ts        — Result integrity verification
    │   └── strategies/
    │       ├── map-reduce.ts          — MapReduce decomposition
    │       ├── pipeline.ts            — Pipeline decomposition
    │       ├── scatter-gather.ts      — Scatter-gather pattern
    │       └── layer-split.ts         — AirLLM-style layer splitting
    ├── Dockerfile
    └── package.json

packages/
└── mesh-worker/                       — Lightweight worker agent
    ├── src/
    │   ├── index.ts                   — Worker entry point
    │   ├── executor.ts                — Execute work units
    │   ├── sandbox.ts                 — Sandboxed execution environment
    │   ├── capabilities.ts            — Report device capabilities
    │   ├── heartbeat.ts               — Keepalive and status reporting
    │   └── transfer.ts                — Data transfer (chunked, compressed)
    ├── mobile/                        — Mobile-specific worker
    │   ├── android-worker.ts          — Android (S24 Ultra) worker
    │   └── battery-aware.ts           — Battery-aware scheduling
    ├── desktop/                       — Desktop companion worker
    │   └── tauri-worker.ts            — Tauri desktop worker
    └── package.json
```

---

## 3. Compute Mesh Coordinator

### 3.1 Device Registry

```sql
CREATE TABLE mesh_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name     TEXT NOT NULL,
  device_type     TEXT NOT NULL,  -- 'vm', 'mobile', 'desktop', 'federated'
  owner_id        TEXT NOT NULL,  -- user or org that owns the device
  capabilities    JSONB NOT NULL, -- CPU, RAM, GPU, storage, model support
  status          TEXT NOT NULL DEFAULT 'offline',  -- 'online', 'offline', 'busy', 'draining'
  last_heartbeat  TIMESTAMPTZ,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opt_in          BOOLEAN NOT NULL DEFAULT FALSE,  -- explicit opt-in required
  max_work_units  INTEGER DEFAULT 4,               -- concurrent work unit limit
  battery_min_pct INTEGER DEFAULT 20,              -- mobile: don't schedule below this
  network_type    TEXT,           -- 'wired', 'wifi', 'cellular'
  wireguard_ip    TEXT,           -- WireGuard mesh IP if connected
  metadata        JSONB
);

CREATE INDEX idx_mesh_devices_status ON mesh_devices (status);
CREATE INDEX idx_mesh_devices_type ON mesh_devices (device_type);
```

### 3.2 Device Capabilities Report

```typescript
interface DeviceCapabilities {
  cpu: {
    cores: number;
    architecture: string;    // 'x86_64', 'aarch64'
    clock_mhz: number;
    available_cores: number; // cores not currently in use
  };
  memory: {
    total_mb: number;
    available_mb: number;
  };
  gpu?: {
    name: string;
    vram_mb: number;
    available_vram_mb: number;
    compute_capability?: string;  // CUDA compute capability
    supports_inference: boolean;
  };
  storage: {
    available_mb: number;
  };
  network: {
    type: 'wired' | 'wifi' | 'cellular';
    bandwidth_mbps?: number;
    latency_ms?: number;
  };
  battery?: {
    level_pct: number;
    charging: boolean;
  };
  supported_runtimes: string[];  // 'node', 'python', 'wasm', 'onnx', 'tflite'
}
```

### 3.3 Job Management

```sql
CREATE TABLE mesh_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT NOT NULL,            -- 'sven', 'admin', skill ID
  job_type        TEXT NOT NULL,            -- 'backtest', 'simulation', 'inference', 'batch_ocr', 'scrape'
  description     TEXT,
  priority        INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending','decomposing','running','aggregating','completed','failed'
  total_units     INTEGER,
  completed_units INTEGER DEFAULT 0,
  failed_units    INTEGER DEFAULT 0,
  input_data      JSONB,                    -- job configuration
  result          JSONB,                    -- aggregated result
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  deadline        TIMESTAMPTZ,              -- optional deadline
  error           TEXT
);

CREATE TABLE mesh_work_units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES mesh_jobs(id),
  unit_index      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending','assigned','running','completed','failed','retry'
  assigned_to     UUID REFERENCES mesh_devices(id),
  assigned_at     TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  input_payload   BYTEA,                    -- encrypted work unit input
  result_payload  BYTEA,                    -- encrypted result
  result_hash     TEXT,                     -- integrity hash of result
  error           TEXT,
  resource_reqs   JSONB                     -- minimum requirements for this unit
);

CREATE INDEX idx_work_units_job ON mesh_work_units (job_id);
CREATE INDEX idx_work_units_status ON mesh_work_units (status);
CREATE INDEX idx_work_units_assigned ON mesh_work_units (assigned_to);
```

### 3.4 Scheduler

The scheduler assigns work units to available devices using:

1. **Capability matching** — Does the device meet the unit's resource requirements?
2. **Load balancing** — Prefer devices with the most available capacity
3. **Locality** — Prefer devices on the same WireGuard segment (lower latency)
4. **Battery awareness** — Don't schedule on mobile devices below battery threshold
5. **Network awareness** — Heavy data transfer units prefer wired/wifi over cellular
6. **Priority** — Higher priority jobs preempt lower priority work
7. **Affinity** — Same-job units prefer the same device (reduce data transfer)
8. **Fair share** — No single device monopolized; spread across mesh

```typescript
interface SchedulingPolicy {
  // Scoring function: higher = better fit
  scoreDevice(unit: WorkUnit, device: MeshDevice): number;

  // Weight factors (tunable)
  weights: {
    capability_match: number;   // 0.3
    available_capacity: number; // 0.25
    network_locality: number;   // 0.15
    battery_health: number;     // 0.1
    historical_speed: number;   // 0.1
    affinity_bonus: number;     // 0.1
  };
}
```

---

## 4. Device Agents (Workers)

### 4.1 Worker Lifecycle

```
Install → Register → Opt-In → Heartbeat Loop → Receive Work → Execute → Return Result → Repeat
```

### 4.2 VM Workers

VMs already in the mesh (VM4–VM13) run workers as Docker containers:

```yaml
# docker-compose.mesh.yml
mesh-worker:
  image: sven-mesh-worker:latest
  environment:
    - MESH_COORDINATOR_URL=nats://10.47.47.4:4222
    - DEVICE_ID=${HOSTNAME}
    - DEVICE_TYPE=vm
    - MAX_WORK_UNITS=4
    - SUPPORTED_RUNTIMES=node,python,onnx
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

### 4.3 Mobile Workers (S24 Ultra)

The Flutter companion app includes a mesh worker module:

```dart
// companion-user-flutter/lib/mesh/mesh_worker.dart
class MeshWorker {
  final String coordinatorUrl;
  final DeviceCapabilities capabilities;

  // Only process when:
  // - Battery > threshold (default 20%)
  // - On WiFi (never cellular for heavy work)
  // - Device is idle or screen off
  // - User has opted in
  bool shouldProcess() {
    return batteryLevel > batteryThreshold &&
           networkType == NetworkType.wifi &&
           isIdle &&
           userOptedIn;
  }

  // Execute lightweight work units:
  // - Data aggregation
  // - Simple inference (TFLite models)
  // - Text processing
  // - Scraping tasks
  Future<WorkResult> execute(WorkUnit unit) async { ... }
}
```

### 4.4 Desktop Workers (Tauri Companion)

The Tauri desktop app includes a mesh worker:

```rust
// companion-desktop-tauri/src-tauri/src/mesh_worker.rs
struct MeshWorker {
    coordinator_url: String,
    capabilities: DeviceCapabilities,
    max_units: usize,
}

impl MeshWorker {
    // Desktop workers handle heavier work:
    // - Model inference (ONNX runtime)
    // - Backtesting computation
    // - Simulation agents
    // - Batch processing
    async fn execute(&self, unit: WorkUnit) -> Result<WorkResult> { ... }
}
```

### 4.5 Federated Workers

Devices from federated 47Network instances contribute compute via the federation protocol:

```
Federated Instance → WireGuard Mesh → NATS Federation → Work Queue → Execute → Return
```

- Federated workers only receive work from jobs flagged as `federation_allowed`
- All work unit payloads encrypted end-to-end
- Results verified via hash + signature
- Resource contribution tracked per federated instance

---

## 5. Work Decomposition & Scheduling

### 5.1 Decomposition Strategies

| Strategy | Use Case | How It Works |
|----------|----------|-------------|
| **MapReduce** | Backtesting, batch OCR, scraping | Split data into chunks → map function per chunk → reduce results |
| **Pipeline** | Model inference, data processing chains | Each stage runs on a different device sequentially |
| **Scatter-Gather** | MiroFish simulation, parameter search | Spawn N independent tasks → gather all results |
| **Layer-Split** | Large model inference (AirLLM-style) | Assign model layers to different devices → chain activations |

### 5.2 MapReduce Example: Distributed Backtesting

```
Job: Backtest strategy X on 5 years of 1-minute data for 50 symbols

Decompose:
  Unit 1: Backtest BTCUSDT 2021-01-01 to 2021-06-30
  Unit 2: Backtest BTCUSDT 2021-07-01 to 2021-12-31
  Unit 3: Backtest BTCUSDT 2022-01-01 to 2022-06-30
  ...
  Unit N: Backtest ETHUSDT 2025-07-01 to 2025-12-31

Assign: Units distributed across all available workers
Aggregate: Combine per-unit equity curves and metrics into global result
```

### 5.3 Layer-Split Example: 70B Model Inference

```
Job: Run 70B parameter model inference

Decompose (AirLLM-style):
  Device A (VM5, 8GB VRAM): Layers 0-15 → pass activations to B
  Device B (VM13, 4GB VRAM): Layers 16-25 → pass activations to C
  Device C (S24 Ultra, TFLite): Layers 26-35 → pass activations to D
  Device D (Desktop, 6GB VRAM): Layers 36-50 → final output

Pipeline: A → B → C → D → Result
```

### 5.4 Scheduling Algorithm

```typescript
async function scheduleUnit(unit: WorkUnit): Promise<MeshDevice> {
  // 1. Get all online, opted-in devices
  const candidates = await getAvailableDevices();

  // 2. Filter by capability requirements
  const capable = candidates.filter(d =>
    meetsRequirements(d.capabilities, unit.resource_reqs)
  );

  // 3. Filter by constraints
  const eligible = capable.filter(d => {
    if (d.device_type === 'mobile' && d.capabilities.battery?.level_pct < d.battery_min_pct) return false;
    if (unit.requires_gpu && !d.capabilities.gpu) return false;
    if (d.current_units >= d.max_work_units) return false;
    return true;
  });

  // 4. Score and rank
  const scored = eligible.map(d => ({
    device: d,
    score: policy.scoreDevice(unit, d),
  })).sort((a, b) => b.score - a.score);

  // 5. Assign to top scorer
  return scored[0]?.device ?? null;
}
```

---

## 6. AirLLM-Style Layer-by-Layer Inference

> Video 11: "loads one layer at a time, runs the computation, and then frees the memory before loading the next layer"

### 6.1 Single-Device Layer Execution

For devices with limited memory, execute model inference one layer at a time:

```typescript
interface LayerByLayerRunner {
  modelPath: string;
  totalLayers: number;

  // Load single layer into memory
  loadLayer(layerIndex: number): Promise<ModelLayer>;

  // Execute layer on input activations
  executeLayer(layer: ModelLayer, activations: Float32Array): Promise<Float32Array>;

  // Free layer memory
  unloadLayer(layer: ModelLayer): void;

  // Full inference: iterate all layers
  async infer(input: Float32Array): Promise<Float32Array> {
    let activations = input;
    for (let i = 0; i < this.totalLayers; i++) {
      const layer = await this.loadLayer(i);
      activations = await this.executeLayer(layer, activations);
      this.unloadLayer(layer);
    }
    return activations;
  }
}
```

### 6.2 Multi-Device Layer Distribution

Split layers across mesh devices for parallel execution:

```typescript
interface DistributedInferenceConfig {
  model: string;
  totalLayers: number;
  assignments: {
    deviceId: string;
    startLayer: number;
    endLayer: number;
  }[];
}

// Pipeline execution:
// Device A processes layers 0-N, sends activations to Device B
// Device B processes layers N+1-M, sends to Device C
// ... until final device produces output
```

### 6.3 Activation Transfer

- Activations serialized as compressed Float32Array
- Transferred via NATS or direct WireGuard connection
- Compression reduces transfer size by ~60%
- Latency budget: < 100ms per device hop

---

## 7. Security & Isolation

### 7.1 Work Unit Encryption

All work unit payloads encrypted in transit and at rest:

```typescript
interface EncryptedWorkUnit {
  id: string;
  job_id: string;
  encrypted_payload: Uint8Array;  // AES-256-GCM encrypted
  iv: Uint8Array;
  auth_tag: Uint8Array;
  key_id: string;                  // reference to encryption key
}
```

### 7.2 Sandboxed Execution

Work units execute in sandboxed environments:

| Platform | Sandbox |
|----------|---------|
| VMs (Docker) | Separate container per work unit with resource limits |
| Desktop (Tauri) | WebAssembly sandbox or subprocess with rlimits |
| Mobile (Flutter) | Isolate (Dart) or platform sandbox |

### 7.3 Result Verification

- Every result includes a SHA-256 hash of the output
- Coordinator verifies hash matches expected computation
- For critical calculations: send same unit to 2+ devices, compare results
- Tampered results → device flagged, unit reassigned

### 7.4 Access Control

- Devices must be explicitly registered and opted-in
- Each device has a unique authentication token (rotated periodically)
- Federated devices require federation trust + device enrollment
- Admin can revoke device access at any time
- Work units marked with sensitivity levels: `public`, `internal`, `confidential`
- Confidential units only run on admin-owned VMs

### 7.5 Data Minimization

- Work units contain only the minimum data needed for computation
- No raw user data or PII included in work payloads
- Model weights distributed only to trusted devices
- Device agents do not persist work unit data after completion

---

## 8. Federation Integration

### 8.1 Cross-Instance Compute Sharing

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Sven Instance A  │     │ Sven Instance B  │     │ Sven Instance C  │
│ (47Network HQ)   │◄───►│ (Partner Org)    │◄───►│ (Community)      │
│                  │     │                  │     │                  │
│ Coordinator +    │ WG  │ Worker agents    │ WG  │ Worker agents    │
│ Worker agents    │mesh │ contribute       │mesh │ contribute       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 8.2 Federation Compute Rules

| Rule | Description |
|------|-------------|
| Opt-in only | Federated instances explicitly enable compute sharing |
| Reciprocity | Instances that contribute compute earn priority on shared jobs |
| Sensitivity gating | Only `public` and `internal` jobs shared; `confidential` stays local |
| Bandwidth aware | Federated work units are smaller (minimize cross-WAN transfer) |
| Credit system | Compute contributions tracked; credits redeemable for priority |

### 8.3 Compute Credit Schema

```sql
CREATE TABLE mesh_compute_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     TEXT NOT NULL,    -- federated instance identifier
  device_id       UUID REFERENCES mesh_devices(id),
  credits_earned  DOUBLE PRECISION NOT NULL DEFAULT 0,
  credits_spent   DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mesh_compute_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     TEXT NOT NULL,
  device_id       UUID REFERENCES mesh_devices(id),
  job_id          UUID REFERENCES mesh_jobs(id),
  unit_id         UUID REFERENCES mesh_work_units(id),
  credit_amount   DOUBLE PRECISION NOT NULL,
  credit_type     TEXT NOT NULL,  -- 'earned' | 'spent'
  compute_seconds DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. Use Cases

### 9.1 Pillar Integration

| Use Case | Pillar | Job Type | Decomposition | Workers |
|----------|--------|----------|---------------|---------|
| Backtest 50 symbols × 5 years | Pillar 6 (Trading) | MapReduce | Per-symbol-per-period chunks | All VMs + desktops |
| MiroFish 100K agent sim | Pillar 6 (Trading) | Scatter-Gather | Agent batches of 10K | VMs + GPU devices |
| Kronos batch prediction | Pillar 6 (Trading) | MapReduce | Per-symbol batches | GPU devices |
| Competitive intel scraping | Pillar 7 (Marketing) | Scatter-Gather | Per-competitor | All devices |
| Batch OCR processing | Pillar 3 (OCR) | MapReduce | Per-document | All devices with GPU |
| Large model inference (70B+) | Pillar 2 (Multi-Model) | Layer-Split | Per-layer pipeline | Multi-device chain |
| Security scan sweep | Pillar 5 (Security) | Scatter-Gather | Per-target | VMs only |
| Design asset generation | Pillar 1 (Design) | Scatter-Gather | Per-variant | GPU devices |

### 9.2 Gemma 4 on Devices

The user specifically asked about running Gemma 4 on devices like the S24 Ultra:

```
Gemma 4 (compact variants) → TFLite/ONNX conversion → Push to device
→ Layer-by-layer inference on mobile GPU → Results sent back to coordinator
```

Benefits:
- No cloud API costs for simple inference
- Latency for local queries: under 5 seconds
- Device stays useful even when WiFi is spotty (offline inference)
- Battery-aware: only infer when charging or battery > threshold

---

## 10. Communication Protocol

### 10.1 NATS Subjects

```
sven.mesh.devices.register       — Device registration
sven.mesh.devices.heartbeat      — Device keepalive
sven.mesh.devices.capabilities   — Capability updates

sven.mesh.jobs.submit            — New job submission
sven.mesh.jobs.status.{job_id}   — Job status updates
sven.mesh.jobs.cancel.{job_id}   — Job cancellation

sven.mesh.units.assign.{device}  — Work unit assignment to device
sven.mesh.units.result.{job_id}  — Work unit result submission
sven.mesh.units.status.{unit_id} — Unit status updates
sven.mesh.units.error.{unit_id}  — Unit error reports

sven.mesh.metrics                — Mesh-wide metrics
```

### 10.2 Message Types

```typescript
// Device → Coordinator
interface HeartbeatMessage {
  device_id: string;
  timestamp: number;
  status: 'online' | 'busy' | 'draining';
  current_units: number;
  capabilities: DeviceCapabilities;  // refreshed each heartbeat
}

// Coordinator → Device
interface AssignmentMessage {
  unit_id: string;
  job_id: string;
  job_type: string;
  encrypted_payload: Uint8Array;
  resource_requirements: ResourceRequirements;
  deadline?: number;
}

// Device → Coordinator
interface ResultMessage {
  unit_id: string;
  job_id: string;
  device_id: string;
  encrypted_result: Uint8Array;
  result_hash: string;
  compute_seconds: number;
  peak_memory_mb: number;
}
```

---

## 11. Implementation Phases

### Phase 8A — Core Mesh (Weeks 5-7)

- [ ] `compute-mesh` coordinator service
- [ ] Device registry and heartbeat system
- [ ] Job decomposition framework (MapReduce, Scatter-Gather)
- [ ] Work unit scheduling with capability matching
- [ ] Result aggregation
- [ ] VM worker deployment (Docker containers on VM4-VM13)
- [ ] NATS subjects and streams configured
- [ ] Database tables provisioned
- [ ] Health monitoring and metrics

### Phase 8B — Multi-Platform Workers (Weeks 7-9)

- [ ] Desktop worker (Tauri companion integration)
- [ ] Mobile worker (Flutter companion integration)
- [ ] Battery-aware and network-aware scheduling
- [ ] AirLLM-style layer-by-layer inference
- [ ] Work unit encryption and verification
- [ ] Sandboxed execution environments
- [ ] Gemma 4 on-device inference support

### Phase 8C — Federation & Advanced (Weeks 9-10)

- [ ] Federation compute sharing protocol
- [ ] Compute credit system
- [ ] Layer-split distributed inference across devices
- [ ] Pipeline decomposition for multi-stage jobs
- [ ] Admin dashboard: mesh topology, device status, job monitoring
- [ ] Automated job distribution for Pillar 6 (trading) workloads

---

## 12. Granular Checklist

### Coordinator Service
- [ ] `compute-mesh` service scaffolded in services/
- [ ] Device registry: register, update, deregister
- [ ] Heartbeat processing: timeout detection, status updates
- [ ] Job manager: create, decompose, schedule, aggregate, complete
- [ ] Decomposition strategies: MapReduce, Scatter-Gather, Pipeline, Layer-Split
- [ ] Scheduler: capability matching, load balancing, locality awareness
- [ ] Battery-aware scheduling for mobile devices
- [ ] Network-aware scheduling (prefer wired/wifi over cellular)
- [ ] Priority-based job ordering
- [ ] Affinity-based unit placement (same job → same device)
- [ ] Fair share across devices
- [ ] Result aggregation framework
- [ ] Result verification (hash comparison)
- [ ] Duplicate computation for critical units
- [ ] Job cancellation and cleanup
- [ ] Retry logic: unit fails → reassign to different device
- [ ] Dead worker detection: unresponsive → reassign units
- [ ] Health endpoint: /healthz, /readyz

### Worker Agents
- [ ] VM worker: Docker container with Node.js runtime
- [ ] Desktop worker: Tauri integration module
- [ ] Mobile worker: Flutter integration module
- [ ] Worker registration and capability reporting
- [ ] Heartbeat loop (30s interval)
- [ ] Work unit execution with sandboxing
- [ ] Result encryption and submission
- [ ] Graceful shutdown: finish current unit, stop accepting new
- [ ] Resource monitoring: CPU, memory, GPU utilization
- [ ] Error reporting and retry signaling

### AirLLM-Style Inference
- [ ] Layer-by-layer model loader
- [ ] Single-device sequential layer execution
- [ ] Multi-device layer distribution
- [ ] Activation serialization and compression
- [ ] Activation transfer via NATS or direct WireGuard
- [ ] Pipeline coordination: layer A → B → C → output
- [ ] Memory management: load/execute/free cycle
- [ ] TFLite support for mobile devices
- [ ] ONNX runtime support for desktops
- [ ] Gemma 4 compact variant on S24 Ultra

### Security
- [ ] Work unit payload encryption (AES-256-GCM)
- [ ] Device authentication tokens (rotating)
- [ ] Result integrity hashing (SHA-256)
- [ ] Sandboxed execution per platform
- [ ] Sensitivity levels: public, internal, confidential
- [ ] Confidential units restricted to admin VMs
- [ ] No PII in work payloads
- [ ] No persistent data after unit completion
- [ ] Admin device revocation
- [ ] Audit logging for all mesh operations

### Federation
- [ ] Federation compute sharing protocol
- [ ] Opt-in mechanism per federated instance
- [ ] Sensitivity gating: only public/internal shared
- [ ] Reciprocity tracking
- [ ] Compute credit ledger
- [ ] Bandwidth-aware unit sizing for cross-WAN
- [ ] Trust verification for federated devices

### Monitoring & Observability
- [ ] Prometheus metrics: job count, unit throughput, device utilization
- [ ] Grafana dashboard: mesh topology visualization
- [ ] Per-device utilization tracking
- [ ] Job completion time histograms
- [ ] Unit failure rate monitoring
- [ ] Network transfer volume tracking
- [ ] Alert rules: device offline, job stalled, high failure rate
- [ ] Structured logging (JSON) for all mesh events
- [ ] NATS JetStream monitoring

### Database
- [ ] `mesh_devices` table
- [ ] `mesh_jobs` table
- [ ] `mesh_work_units` table
- [ ] `mesh_compute_credits` table
- [ ] `mesh_compute_ledger` table
- [ ] Indexes for status, type, assignment queries
- [ ] Data retention: completed jobs archived after 90 days

### Infrastructure
- [ ] Docker container for compute-mesh coordinator on VM4
- [ ] Worker containers on VM4-VM13
- [ ] NATS subjects and JetStream streams configured
- [ ] WireGuard routes verified for all mesh nodes
- [ ] Monitoring targets added to Prometheus
- [ ] Dashboard added to Grafana
- [ ] docker-compose.mesh.yml integrated into main compose

---

## Cross-References

- **Pillar 2** (Multi-Model): Large model inference distributed across mesh
- **Pillar 3** (OCR): Batch OCR processing distributed
- **Pillar 5** (Security): Security scan distribution
- **Pillar 6** (Trading): Backtesting and simulation distributed
- **Pillar 7** (Marketing): Competitive scraping distributed
- **Master Plan**: `docs/features/EXPANSION_MASTER_PLAN.md`
