/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Batch 29 — Model Fleet (GPU management, VRAM scheduling, benchmarks)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Validates:
 *   1. Migration SQL structure (4 tables, indexes, CHECK constraints)
 *   2. Shared types (interfaces, enums, constants, utility functions)
 *   3. Skill YAML structure (fleet-manage, 5 actions)
 *   4. Task executor wiring (3 new handlers)
 *   5. NATS/Eidolon integration (4 events, gpu_cluster building, districtFor)
 *   6. Integration coherence (cross-file consistency)
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ── Source loaders ──────────────────────────────────────────────────────── */

const migration = fs.readFileSync(
  path.join(ROOT, 'services/gateway-api/migrations/20260503120000_model_fleet.sql'),
  'utf-8',
);

const sharedTypes = fs.readFileSync(
  path.join(ROOT, 'packages/shared/src/model-fleet.ts'),
  'utf-8',
);

const skillMd = fs.readFileSync(
  path.join(ROOT, 'skills/autonomous-economy/fleet-manage/SKILL.md'),
  'utf-8',
);

const taskExecutor = fs.readFileSync(
  path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
  'utf-8',
);

const eidolonTypes = fs.readFileSync(
  path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
  'utf-8',
);

const eventBus = fs.readFileSync(
  path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
  'utf-8',
);

const sharedIndex = fs.readFileSync(
  path.join(ROOT, 'packages/shared/src/index.ts'),
  'utf-8',
);

/* ═══════════════════════════════════════════════════════════════════════════
   1. Migration SQL structure
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Batch 29 — Migration structure', () => {
  it('creates gpu_devices table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS gpu_devices');
  });

  it('creates model_deployments table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS model_deployments');
  });

  it('creates model_benchmarks table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS model_benchmarks');
  });

  it('creates vram_allocation_log table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS vram_allocation_log');
  });

  it('gpu_devices has required columns', () => {
    for (const col of [
      'gpu_model',
      'vram_total_mb',
      'vram_used_mb',
      'vram_reserved_mb',
      'status',
      'wireguard_ip',
      'driver_version',
      'temperature_c',
      'power_draw_w',
      'utilization_pct',
      'last_heartbeat',
    ]) {
      expect(migration).toContain(col);
    }
  });

  it('model_deployments has required columns', () => {
    for (const col of [
      'model_name',
      'model_variant',
      'gpu_device_id',
      'vram_required_mb',
      'quantization',
      'status',
      'priority',
      'port',
      'pid',
      'last_inference',
      'load_time_ms',
      'request_count',
      'error_count',
    ]) {
      expect(migration).toContain(col);
    }
  });

  it('model_benchmarks has required columns', () => {
    for (const col of [
      'deployment_id',
      'benchmark_type',
      'prompt_tokens',
      'completion_tokens',
      'latency_ms',
      'tokens_per_second',
      'quality_score',
      'cost_per_1k_tokens',
      'vram_peak_mb',
      'context_length',
      'batch_size',
    ]) {
      expect(migration).toContain(col);
    }
  });

  it('vram_allocation_log has required columns', () => {
    for (const col of [
      'gpu_device_id',
      'deployment_id',
      'action',
      'vram_mb',
      'vram_before_mb',
      'vram_after_mb',
      'reason',
    ]) {
      expect(migration).toContain(col);
    }
  });

  it('gpu_devices status CHECK has 4 values', () => {
    for (const val of ['online', 'offline', 'degraded', 'maintenance']) {
      expect(migration).toContain(`'${val}'`);
    }
  });

  it('deployment status CHECK has 6 values', () => {
    for (const val of ['pending', 'loading', 'ready', 'unloading', 'failed', 'evicted']) {
      expect(migration).toContain(`'${val}'`);
    }
  });

  it('benchmark_type CHECK has 5 values', () => {
    for (const val of ['latency', 'throughput', 'quality', 'cost', 'memory']) {
      expect(migration).toContain(`'${val}'`);
    }
  });

  it('vram action CHECK has 4 values', () => {
    for (const val of ['allocate', 'release', 'evict', 'reserve']) {
      expect(migration).toContain(`'${val}'`);
    }
  });

  it('quantization CHECK includes common formats', () => {
    for (const val of ['fp16', 'fp32', 'q8_0', 'q4_k_m', 'q4_0', 'awq', 'gptq', 'exl2']) {
      expect(migration).toContain(`'${val}'`);
    }
  });

  it('has foreign keys from deployments to gpu_devices', () => {
    expect(migration).toContain('REFERENCES gpu_devices(id)');
  });

  it('has foreign keys from benchmarks to model_deployments', () => {
    expect(migration).toContain('REFERENCES model_deployments(id)');
  });

  it('creates indexes for gpu_devices', () => {
    expect(migration).toContain('idx_gpu_devices_org');
    expect(migration).toContain('idx_gpu_devices_status');
  });

  it('creates indexes for model_deployments', () => {
    expect(migration).toContain('idx_model_deployments_org');
    expect(migration).toContain('idx_model_deployments_gpu');
    expect(migration).toContain('idx_model_deployments_status');
    expect(migration).toContain('idx_model_deployments_model');
  });

  it('creates indexes for model_benchmarks', () => {
    expect(migration).toContain('idx_model_benchmarks_org');
    expect(migration).toContain('idx_model_benchmarks_deployment');
    expect(migration).toContain('idx_model_benchmarks_type');
  });

  it('creates indexes for vram_allocation_log', () => {
    expect(migration).toContain('idx_vram_log_org');
    expect(migration).toContain('idx_vram_log_gpu');
    expect(migration).toContain('idx_vram_log_action');
  });

  it('ALTERs marketplace_tasks with fleet task types', () => {
    expect(migration).toContain('marketplace_tasks_task_type_check');
    expect(migration).toContain("'fleet_deploy'");
    expect(migration).toContain("'fleet_benchmark'");
    expect(migration).toContain("'fleet_evict'");
  });

  it('has 28 task types in CHECK constraint', () => {
    const match = migration.match(/task_type IN \(([\s\S]*?)\)/);
    expect(match).toBeTruthy();
    const types = match![1].match(/'[a-z_]+'/g);
    expect(types).toHaveLength(28);
  });

  it('inserts default fleet config into settings_global', () => {
    expect(migration).toContain("'fleet.vram_reserve_pct'");
    expect(migration).toContain("'fleet.eviction_policy'");
    expect(migration).toContain("'fleet.heartbeat_interval_s'");
    expect(migration).toContain("'fleet.auto_benchmark'");
    expect(migration).toContain("'fleet.max_deployments_per_gpu'");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. Shared types
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Batch 29 — Shared types', () => {
  it('exports GpuDeviceStatus type', () => {
    expect(sharedTypes).toContain('GpuDeviceStatus');
    expect(sharedTypes).toContain("'online'");
    expect(sharedTypes).toContain("'offline'");
    expect(sharedTypes).toContain("'degraded'");
    expect(sharedTypes).toContain("'maintenance'");
  });

  it('exports DeploymentStatus type', () => {
    expect(sharedTypes).toContain('DeploymentStatus');
    expect(sharedTypes).toContain("'pending'");
    expect(sharedTypes).toContain("'loading'");
    expect(sharedTypes).toContain("'ready'");
    expect(sharedTypes).toContain("'evicted'");
  });

  it('exports ModelQuantization type', () => {
    expect(sharedTypes).toContain('ModelQuantization');
    expect(sharedTypes).toContain("'fp16'");
    expect(sharedTypes).toContain("'q4_k_m'");
    expect(sharedTypes).toContain("'exl2'");
  });

  it('exports BenchmarkType type', () => {
    expect(sharedTypes).toContain('BenchmarkType');
    expect(sharedTypes).toContain("'latency'");
    expect(sharedTypes).toContain("'throughput'");
  });

  it('exports VramAction type', () => {
    expect(sharedTypes).toContain('VramAction');
    expect(sharedTypes).toContain("'allocate'");
    expect(sharedTypes).toContain("'release'");
  });

  it('exports EvictionPolicy type', () => {
    expect(sharedTypes).toContain('EvictionPolicy');
    expect(sharedTypes).toContain("'lru'");
    expect(sharedTypes).toContain("'lfu'");
    expect(sharedTypes).toContain("'priority'");
    expect(sharedTypes).toContain("'fifo'");
  });

  it('exports GpuDevice interface', () => {
    expect(sharedTypes).toContain('interface GpuDevice');
    expect(sharedTypes).toContain('gpuModel');
    expect(sharedTypes).toContain('vramTotalMb');
    expect(sharedTypes).toContain('vramUsedMb');
    expect(sharedTypes).toContain('vramReservedMb');
    expect(sharedTypes).toContain('temperatureC');
    expect(sharedTypes).toContain('utilizationPct');
  });

  it('exports ModelDeployment interface', () => {
    expect(sharedTypes).toContain('interface ModelDeployment');
    expect(sharedTypes).toContain('modelName');
    expect(sharedTypes).toContain('gpuDeviceId');
    expect(sharedTypes).toContain('vramRequiredMb');
    expect(sharedTypes).toContain('quantization');
    expect(sharedTypes).toContain('loadTimeMs');
    expect(sharedTypes).toContain('requestCount');
  });

  it('exports ModelBenchmark interface', () => {
    expect(sharedTypes).toContain('interface ModelBenchmark');
    expect(sharedTypes).toContain('deploymentId');
    expect(sharedTypes).toContain('benchmarkType');
    expect(sharedTypes).toContain('latencyMs');
    expect(sharedTypes).toContain('tokensPerSecond');
    expect(sharedTypes).toContain('qualityScore');
    expect(sharedTypes).toContain('vramPeakMb');
  });

  it('exports VramAllocationEntry interface', () => {
    expect(sharedTypes).toContain('interface VramAllocationEntry');
    expect(sharedTypes).toContain('vramMb');
    expect(sharedTypes).toContain('vramBeforeMb');
    expect(sharedTypes).toContain('vramAfterMb');
  });

  it('exports FleetConfig interface', () => {
    expect(sharedTypes).toContain('interface FleetConfig');
    expect(sharedTypes).toContain('vramReservePct');
    expect(sharedTypes).toContain('evictionPolicy');
    expect(sharedTypes).toContain('heartbeatIntervalS');
    expect(sharedTypes).toContain('autoBenchmark');
    expect(sharedTypes).toContain('maxDeploymentsPerGpu');
  });
});

describe('Batch 29 — Shared constants', () => {
  it('exports GPU_DEVICE_STATUSES array', () => {
    expect(sharedTypes).toContain('GPU_DEVICE_STATUSES');
  });

  it('exports DEPLOYMENT_STATUSES array', () => {
    expect(sharedTypes).toContain('DEPLOYMENT_STATUSES');
  });

  it('exports DEPLOYMENT_TERMINAL_STATUSES array', () => {
    expect(sharedTypes).toContain('DEPLOYMENT_TERMINAL_STATUSES');
  });

  it('exports BENCHMARK_TYPES array', () => {
    expect(sharedTypes).toContain('BENCHMARK_TYPES');
  });

  it('exports VRAM_ACTIONS array', () => {
    expect(sharedTypes).toContain('VRAM_ACTIONS');
  });

  it('exports MODEL_QUANTIZATIONS array', () => {
    expect(sharedTypes).toContain('MODEL_QUANTIZATIONS');
  });

  it('exports DEFAULT_FLEET_CONFIG', () => {
    expect(sharedTypes).toContain('DEFAULT_FLEET_CONFIG');
    expect(sharedTypes).toContain('vramReservePct: 15');
    expect(sharedTypes).toContain("evictionPolicy: 'lru'");
    expect(sharedTypes).toContain('heartbeatIntervalS: 30');
    expect(sharedTypes).toContain('maxDeploymentsPerGpu: 4');
  });

  it('exports KNOWN_GPU_PROFILES with Sven infrastructure GPUs', () => {
    expect(sharedTypes).toContain('KNOWN_GPU_PROFILES');
    expect(sharedTypes).toContain("'RTX 3060'");
    expect(sharedTypes).toContain("'RX 6750 XT'");
    expect(sharedTypes).toContain("'RX 9070 XT'");
  });

  it('RTX 3060 profile has 12288 MB VRAM', () => {
    expect(sharedTypes).toMatch(/RTX 3060.*vramMb:\s*12288/);
  });

  it('RX 9070 XT profile has 16384 MB VRAM', () => {
    expect(sharedTypes).toMatch(/RX 9070 XT.*vramMb:\s*16384/);
  });
});

describe('Batch 29 — Utility functions', () => {
  it('exports availableVram function', () => {
    expect(sharedTypes).toContain('function availableVram');
    expect(sharedTypes).toContain('vramReservePct');
  });

  it('exports canFitModel function', () => {
    expect(sharedTypes).toContain('function canFitModel');
    expect(sharedTypes).toContain('availableVram');
  });

  it('exports selectBestGpu function', () => {
    expect(sharedTypes).toContain('function selectBestGpu');
    expect(sharedTypes).toContain("d.status === 'online'");
  });

  it('exports selectEvictionCandidates function', () => {
    expect(sharedTypes).toContain('function selectEvictionCandidates');
    expect(sharedTypes).toContain('EvictionPolicy');
  });

  it('selectEvictionCandidates handles all 4 policies', () => {
    expect(sharedTypes).toContain("case 'lru':");
    expect(sharedTypes).toContain("case 'lfu':");
    expect(sharedTypes).toContain("case 'priority':");
    expect(sharedTypes).toContain("case 'fifo':");
  });

  it('exports costEfficiency function', () => {
    expect(sharedTypes).toContain('function costEfficiency');
    expect(sharedTypes).toContain('qualityScore');
    expect(sharedTypes).toContain('costPer1kTokens');
  });

  it('exports vramUtilization function', () => {
    expect(sharedTypes).toContain('function vramUtilization');
    expect(sharedTypes).toContain('vramTotalMb');
  });

  it('exports isTerminalDeployment function', () => {
    expect(sharedTypes).toContain('function isTerminalDeployment');
    expect(sharedTypes).toContain('DEPLOYMENT_TERMINAL_STATUSES');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. Skill YAML structure
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Batch 29 — fleet-manage SKILL.md', () => {
  it('has correct skill name', () => {
    expect(skillMd).toContain('name: fleet-manage');
  });

  it('has operator archetype', () => {
    expect(skillMd).toContain('archetype: operator');
  });

  it('has infrastructure category', () => {
    expect(skillMd).toContain('category: infrastructure');
  });

  it('has deploy action', () => {
    expect(skillMd).toContain('id: deploy');
    expect(skillMd).toContain('modelName');
    expect(skillMd).toContain('vramRequiredMb');
  });

  it('has benchmark action', () => {
    expect(skillMd).toContain('id: benchmark');
    expect(skillMd).toContain('benchmarkType');
  });

  it('has evict action', () => {
    expect(skillMd).toContain('id: evict');
    expect(skillMd).toContain('freed_vram_mb');
  });

  it('has status action', () => {
    expect(skillMd).toContain('id: status');
    expect(skillMd).toContain('utilizationPct');
  });

  it('has hot-swap action', () => {
    expect(skillMd).toContain('id: hot-swap');
    expect(skillMd).toContain('swapTimeMs');
  });

  it('has 5 actions total', () => {
    const actions = skillMd.match(/- id: /g);
    expect(actions).toHaveLength(5);
  });

  it('mentions VRAM management in description', () => {
    expect(skillMd).toMatch(/[Vv][Rr][Aa][Mm]/);
  });

  it('has gpu and model-fleet tags', () => {
    expect(skillMd).toContain('gpu');
    expect(skillMd).toContain('model-fleet');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. Task executor handlers
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Batch 29 — Task executor', () => {
  it('has fleet_deploy case', () => {
    expect(taskExecutor).toContain("case 'fleet_deploy':");
  });

  it('has fleet_benchmark case', () => {
    expect(taskExecutor).toContain("case 'fleet_benchmark':");
  });

  it('has fleet_evict case', () => {
    expect(taskExecutor).toContain("case 'fleet_evict':");
  });

  it('has handleFleetDeploy handler', () => {
    expect(taskExecutor).toContain('handleFleetDeploy');
    expect(taskExecutor).toContain('sven.fleet.model_deployed');
  });

  it('has handleFleetBenchmark handler', () => {
    expect(taskExecutor).toContain('handleFleetBenchmark');
    expect(taskExecutor).toContain('sven.fleet.benchmark_completed');
  });

  it('has handleFleetEvict handler', () => {
    expect(taskExecutor).toContain('handleFleetEvict');
    expect(taskExecutor).toContain('sven.fleet.model_evicted');
  });

  it('handleFleetDeploy returns deployment details', () => {
    expect(taskExecutor).toMatch(/handleFleetDeploy[\s\S]*deploymentId[\s\S]*modelName[\s\S]*quantization/);
  });

  it('handleFleetBenchmark returns benchmark metrics', () => {
    expect(taskExecutor).toMatch(/handleFleetBenchmark[\s\S]*benchmarkId[\s\S]*latencyMs[\s\S]*tokensPerSecond/);
  });

  it('handleFleetEvict returns eviction result', () => {
    expect(taskExecutor).toMatch(/handleFleetEvict[\s\S]*evicted[\s\S]*freedVramMb/);
  });

  it('has 28 total switch cases', () => {
    const cases = taskExecutor.match(/case\s+'/g);
    expect(cases).toHaveLength(28);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. Eidolon / NATS integration
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Batch 29 — EidolonBuildingKind', () => {
  it('includes gpu_cluster', () => {
    expect(eidolonTypes).toContain("'gpu_cluster'");
  });

  it('has 14 building kinds (14 pipe characters)', () => {
    const match = eidolonTypes.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
    expect(match).toBeTruthy();
    const pipes = (match![1].match(/\|/g) || []).length;
    expect(pipes).toBe(14);
  });
});

describe('Batch 29 — EidolonEventKind', () => {
  it('includes fleet.model_deployed', () => {
    expect(eidolonTypes).toContain("'fleet.model_deployed'");
  });

  it('includes fleet.model_evicted', () => {
    expect(eidolonTypes).toContain("'fleet.model_evicted'");
  });

  it('includes fleet.benchmark_completed', () => {
    expect(eidolonTypes).toContain("'fleet.benchmark_completed'");
  });

  it('includes fleet.vram_alert', () => {
    expect(eidolonTypes).toContain("'fleet.vram_alert'");
  });

  it('has 68 event kinds (68 pipe characters)', () => {
    const match = eidolonTypes.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
    expect(match).toBeTruthy();
    const pipes = (match![1].match(/\|/g) || []).length;
    expect(pipes).toBe(68);
  });
});

describe('Batch 29 — districtFor', () => {
  it('maps gpu_cluster to infrastructure', () => {
    expect(eidolonTypes).toContain("case 'gpu_cluster':");
    expect(eidolonTypes).toMatch(/gpu_cluster[\s\S]*?return 'infrastructure'/);
  });

  it('has 14 cases total', () => {
    const fn = eidolonTypes.match(/function districtFor[\s\S]*?^\}/m);
    expect(fn).toBeTruthy();
    const cases = fn![0].match(/case\s+'/g);
    expect(cases).toHaveLength(14);
  });
});

describe('Batch 29 — SUBJECT_MAP entries', () => {
  it('has fleet.model_deployed mapping', () => {
    expect(eventBus).toContain("'sven.fleet.model_deployed': 'fleet.model_deployed'");
  });

  it('has fleet.model_evicted mapping', () => {
    expect(eventBus).toContain("'sven.fleet.model_evicted': 'fleet.model_evicted'");
  });

  it('has fleet.benchmark_completed mapping', () => {
    expect(eventBus).toContain("'sven.fleet.benchmark_completed': 'fleet.benchmark_completed'");
  });

  it('has fleet.vram_alert mapping', () => {
    expect(eventBus).toContain("'sven.fleet.vram_alert': 'fleet.vram_alert'");
  });

  it('has 67 total SUBJECT_MAP entries', () => {
    const entries = eventBus.match(/'sven\./g);
    expect(entries).toHaveLength(67);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. Integration coherence
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Batch 29 — Integration coherence', () => {
  it('migration task types match task executor cases', () => {
    for (const taskType of ['fleet_deploy', 'fleet_benchmark', 'fleet_evict']) {
      expect(migration).toContain(`'${taskType}'`);
      expect(taskExecutor).toContain(`case '${taskType}':`);
    }
  });

  it('eidolon event kinds match SUBJECT_MAP', () => {
    for (const event of [
      'fleet.model_deployed',
      'fleet.model_evicted',
      'fleet.benchmark_completed',
      'fleet.vram_alert',
    ]) {
      expect(eidolonTypes).toContain(`'${event}'`);
      expect(eventBus).toContain(`'sven.${event}'`);
    }
  });

  it('skill actions cover task executor handlers', () => {
    expect(skillMd).toContain('id: deploy');
    expect(skillMd).toContain('id: benchmark');
    expect(skillMd).toContain('id: evict');
    expect(taskExecutor).toContain('handleFleetDeploy');
    expect(taskExecutor).toContain('handleFleetBenchmark');
    expect(taskExecutor).toContain('handleFleetEvict');
  });

  it('shared types exported from shared/index.ts', () => {
    expect(sharedIndex).toContain("'./model-fleet.js'");
  });

  it('pre-existing models.ts admin API is not modified', () => {
    const modelsApi = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/src/routes/admin/models.ts'),
      'utf-8',
    );
    expect(modelsApi).toContain('/models/registry');
    expect(modelsApi).toContain('/models/policies');
    expect(modelsApi).toContain('/models/rollouts');
    expect(modelsApi).toContain('/models/usage');
  });

  it('pre-existing llm-router.ts is not modified', () => {
    const router = fs.readFileSync(
      path.join(ROOT, 'services/agent-runtime/src/llm-router.ts'),
      'utf-8',
    );
    expect(router).toContain('CompletionRequest');
    expect(router).toContain('ModelRecord');
  });

  it('pre-existing device-registry.ts is not modified', () => {
    const registry = fs.readFileSync(
      path.join(ROOT, 'services/compute-mesh/src/coordinator/device-registry.ts'),
      'utf-8',
    );
    expect(registry).toContain('PgDeviceRegistry');
    expect(registry).toContain('DeviceRow');
  });
});
