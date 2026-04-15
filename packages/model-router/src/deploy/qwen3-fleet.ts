// ---------------------------------------------------------------------------
// Qwen3 Fleet Deployment Manifest (G.1.4)
// ---------------------------------------------------------------------------
// Concrete deployment specifications for Qwen3 models across the 47Network
// GPU cluster. Maps hardware inventory (Decision 1) to optimal model configs.
//
// Cluster:
//   VM5/VM9 — AMD RX 9070 XT (16 GiB) + RX 6750 XT (12 GiB) = 28 GiB
//   VM13    — NVIDIA RTX 3060 (12 GiB)
//   S24     — Adreno 750 (~4 GiB)
// ---------------------------------------------------------------------------

import {
  type DeployTarget,
  type QuantLevel,
  type DeployPipelineResult,
  recommendQuantization,
  runDeployPipeline,
} from './index.js';

/* ------------------------------------------------------------------ types */

export interface FleetNode {
  nodeId: string;
  hostname: string;
  ip: string;
  gpus: string[];
  totalVramMb: number;
  target: DeployTarget;
  endpoint: string;
  role: 'primary' | 'fast' | 'mobile';
}

export interface ModelAssignment {
  nodeId: string;
  modelName: string;
  modelFamily: string;
  parameterCountB: number;
  quantLevel: QuantLevel;
  estimatedVramMb: number;
  purpose: string;
  ollamaTag?: string;
  ggufFile?: string;
  llamaServerArgs?: string[];
}

export interface FleetDeployPlan {
  assignments: ModelAssignment[];
  totalModels: number;
  totalVramUsedMb: number;
  totalVramAvailableMb: number;
  utilizationPct: number;
  warnings: string[];
}

export interface FleetDeployResult {
  plan: FleetDeployPlan;
  results: Array<{
    assignment: ModelAssignment;
    pipeline: DeployPipelineResult | null;
    skipped: boolean;
    skipReason?: string;
  }>;
  successCount: number;
  failCount: number;
  skipCount: number;
}

/* ------------------------------------------------------- fleet inventory */

export const FLEET_NODES: FleetNode[] = [
  {
    nodeId: 'vm5',
    hostname: 'sven-ai',
    ip: '10.47.47.9',
    gpus: ['AMD RX 9070 XT (16 GiB)', 'AMD RX 6750 XT (12 GiB)'],
    totalVramMb: 28_672, // 28 GiB
    target: 'llama-server',
    endpoint: 'http://10.47.47.9:8080',
    role: 'primary',
  },
  {
    nodeId: 'vm13',
    hostname: 'kaldorei',
    ip: '10.47.47.13',
    gpus: ['NVIDIA RTX 3060 (12 GiB)'],
    totalVramMb: 12_288, // 12 GiB
    target: 'ollama',
    endpoint: 'http://10.47.47.13:11434',
    role: 'fast',
  },
  {
    nodeId: 's24',
    hostname: 's24-ultra',
    ip: '', // on-device, no remote endpoint
    gpus: ['Adreno 750 (~4 GiB)'],
    totalVramMb: 4_096, // ~4 GiB
    target: 'llama-server', // NNAPI/QNN runtime, not Ollama
    endpoint: '', // local on device
    role: 'mobile',
  },
];

/* -------------------------------------------------- model assignments */

export const QWEN3_ASSIGNMENTS: ModelAssignment[] = [
  // VM5 — Flagship: Qwen3-32B Q4_K_M via tensor-split across both GPUs
  {
    nodeId: 'vm5',
    modelName: 'Qwen/Qwen3-32B-GGUF',
    modelFamily: 'qwen3',
    parameterCountB: 32,
    quantLevel: 'Q4_K_M',
    estimatedVramMb: 18_432, // ~18 GiB
    purpose: 'Flagship reasoning — council deliberation, complex code generation, architecture decisions',
    ggufFile: 'qwen3-32b-q4_k_m.gguf',
    llamaServerArgs: [
      '--model', '/models/qwen3-32b-q4_k_m.gguf',
      '--tensor-split', '16,12', // 16 GiB on 9070 XT, 12 GiB on 6750 XT
      '--ctx-size', '8192',
      '--n-gpu-layers', '99', // offload all layers to GPU
      '--threads', '8',
      '--host', '0.0.0.0',
      '--port', '8080',
    ],
  },

  // VM13 — Fast workhorse: Qwen3-8B via Ollama
  {
    nodeId: 'vm13',
    modelName: 'qwen3:8b',
    modelFamily: 'qwen3',
    parameterCountB: 8,
    quantLevel: 'Q8_0', // FP8 ≈ Q8 in Ollama terminology
    estimatedVramMb: 6_144, // ~6 GiB
    purpose: 'Fast inference — quick code reviews, chat, tool routing',
    ollamaTag: 'qwen3:8b',
  },

  // S24 Ultra — On-device: Qwen3-4B Q4 for mobile inference
  {
    nodeId: 's24',
    modelName: 'Qwen/Qwen3-4B-GGUF',
    modelFamily: 'qwen3',
    parameterCountB: 4,
    quantLevel: 'Q4_K_M',
    estimatedVramMb: 2_048, // ~2 GiB
    purpose: 'On-device mobile inference — offline capable, privacy-first, low-latency local tasks',
    ggufFile: 'qwen3-4b-q4_k_m.gguf',
    llamaServerArgs: [
      '--model', '/models/qwen3-4b-q4_k_m.gguf',
      '--ctx-size', '2048',
      '--n-gpu-layers', '99',
      '--threads', '4',
    ],
  },
];

/* ---------------------------------------- alternative: MoE for coding */

export const QWEN3_MOE_ALTERNATIVE: ModelAssignment = {
  nodeId: 'vm5',
  modelName: 'Qwen/Qwen3-30B-A3B-GGUF',
  modelFamily: 'qwen3-moe',
  parameterCountB: 30, // 30B total, 3B active per token
  quantLevel: 'Q4_K_M',
  estimatedVramMb: 17_408, // ~17 GiB (MoE stores all experts but activates few)
  purpose: 'Alternative to 32B dense — faster inference with MoE architecture, excellent for coding tasks',
  ggufFile: 'qwen3-30b-a3b-q4_k_m.gguf',
  llamaServerArgs: [
    '--model', '/models/qwen3-30b-a3b-q4_k_m.gguf',
    '--tensor-split', '16,12',
    '--ctx-size', '8192',
    '--n-gpu-layers', '99',
    '--threads', '8',
    '--host', '0.0.0.0',
    '--port', '8080',
  ],
};

/* ---------------------------------------- alternative: VM13 upgrade */

export const QWEN3_14B_ALTERNATIVE: ModelAssignment = {
  nodeId: 'vm13',
  modelName: 'qwen3:14b-q4_K_M',
  modelFamily: 'qwen3',
  parameterCountB: 14,
  quantLevel: 'Q4_K_M',
  estimatedVramMb: 8_192, // ~8 GiB
  purpose: 'Alternative upgrade for VM13 — stronger reasoning at Q4 quantization, fits 12 GiB',
  ollamaTag: 'qwen3:14b-q4_K_M',
};

/* -------------------------------------------------- plan generation */

export function generateDeployPlan(
  assignments: ModelAssignment[] = QWEN3_ASSIGNMENTS,
  nodes: FleetNode[] = FLEET_NODES,
): FleetDeployPlan {
  const warnings: string[] = [];
  let totalVramUsed = 0;
  let totalVramAvailable = 0;

  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));

  for (const assignment of assignments) {
    const node = nodeMap.get(assignment.nodeId);
    if (!node) {
      warnings.push(`Assignment for ${assignment.modelName} references unknown node ${assignment.nodeId}`);
      continue;
    }

    totalVramUsed += assignment.estimatedVramMb;

    // Verify quant recommendation matches
    const rec = recommendQuantization(
      assignment.modelName,
      assignment.parameterCountB,
      node.totalVramMb,
    );

    // Warn if assigned quant doesn't fit
    const fitsVram = assignment.estimatedVramMb <= node.totalVramMb;
    if (!fitsVram) {
      warnings.push(
        `${assignment.modelName} at ${assignment.quantLevel} (~${assignment.estimatedVramMb} MB) ` +
        `exceeds ${node.nodeId} VRAM (${node.totalVramMb} MB). ` +
        `Recommended: ${rec.recommended}`,
      );
    }

    // Warn if significantly below optimal quant
    if (rec.recommended !== assignment.quantLevel && fitsVram) {
      const recAlt = rec.alternatives.find((a) => a.level === rec.recommended);
      const assignAlt = rec.alternatives.find((a) => a.level === assignment.quantLevel);
      if (recAlt && assignAlt && assignAlt.estimatedVramMb < recAlt.estimatedVramMb * 0.6) {
        warnings.push(
          `${assignment.modelName} could run at higher quality ${rec.recommended} on ${node.nodeId}. ` +
          `Currently assigned ${assignment.quantLevel}.`,
        );
      }
    }
  }

  for (const node of nodes) {
    totalVramAvailable += node.totalVramMb;
  }

  return {
    assignments,
    totalModels: assignments.length,
    totalVramUsedMb: totalVramUsed,
    totalVramAvailableMb: totalVramAvailable,
    utilizationPct: totalVramAvailable > 0
      ? Math.round((totalVramUsed / totalVramAvailable) * 100)
      : 0,
    warnings,
  };
}

/* ------------------------------------------------- fleet deployment */

export async function deployFleet(
  assignments: ModelAssignment[] = QWEN3_ASSIGNMENTS,
  nodes: FleetNode[] = FLEET_NODES,
  opts: { skipMobile?: boolean; force?: boolean } = {},
): Promise<FleetDeployResult> {
  const plan = generateDeployPlan(assignments, nodes);
  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));
  const results: FleetDeployResult['results'] = [];
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const assignment of assignments) {
    const node = nodeMap.get(assignment.nodeId);

    // Skip mobile deployments if requested
    if (opts.skipMobile && node?.role === 'mobile') {
      results.push({
        assignment,
        pipeline: null,
        skipped: true,
        skipReason: 'Mobile deployment skipped (deploy on-device manually)',
      });
      skipCount++;
      continue;
    }

    // Skip nodes without endpoints (mobile on-device)
    if (!node?.endpoint) {
      results.push({
        assignment,
        pipeline: null,
        skipped: true,
        skipReason: `Node ${assignment.nodeId} has no remote endpoint — deploy on-device`,
      });
      skipCount++;
      continue;
    }

    // llama-server models need manual GGUF download — just run health check + profile
    const isLlamaServer = node.target === 'llama-server';

    const pipeline = await runDeployPipeline({
      modelName: assignment.ollamaTag || assignment.modelName,
      target: node.target,
      nodeEndpoint: node.endpoint,
      parameterCountB: assignment.parameterCountB,
      availableVramMb: node.totalVramMb,
      skipDownload: isLlamaServer, // llama-server: GGUF must be pre-placed
      skipProfile: false,
      force: opts.force,
    });

    results.push({ assignment, pipeline, skipped: false });

    if (pipeline.overallSuccess) {
      successCount++;
    } else {
      failCount++;
    }
  }

  return { plan, results, successCount, failCount, skipCount };
}

/* ------------------------------------------------ status summary */

export function formatFleetSummary(plan: FleetDeployPlan): string {
  const lines: string[] = [
    '# Qwen3 Fleet Deployment Plan',
    '',
    `Models: ${plan.totalModels}`,
    `VRAM usage: ${(plan.totalVramUsedMb / 1024).toFixed(1)} GiB / ${(plan.totalVramAvailableMb / 1024).toFixed(1)} GiB (${plan.utilizationPct}%)`,
    '',
    '## Assignments',
  ];

  const nodeMap = new Map(FLEET_NODES.map((n) => [n.nodeId, n]));

  for (const a of plan.assignments) {
    const node = nodeMap.get(a.nodeId);
    lines.push(
      `- **${node?.hostname || a.nodeId}** (${node?.role || 'unknown'}): ` +
      `${a.modelName} @ ${a.quantLevel} (~${(a.estimatedVramMb / 1024).toFixed(1)} GiB) — ${a.purpose}`,
    );
  }

  if (plan.warnings.length > 0) {
    lines.push('', '## Warnings');
    for (const w of plan.warnings) {
      lines.push(`- ⚠️ ${w}`);
    }
  }

  return lines.join('\n');
}
