#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outJsonRel = 'docs/release/status/competitive-scorecard-latest.json';
const outMdRel = 'docs/release/status/competitive-scorecard-latest.md';

const signals = {
  competitor_capability_proof: 'docs/release/status/competitor-capability-proof-latest.json',
  competitor_runtime_truth: 'docs/release/status/competitor-runtime-truth-latest.json',
  framework_wave4_closeout: 'docs/release/status/framework-wave4-closeout-latest.json',
  openclaw_tools_runtime: 'docs/release/status/openclaw-tools-runtime-latest.json',
  openclaw_tools_by_provider_runtime: 'docs/release/status/openclaw-tools-by-provider-runtime-latest.json',
  openclaw_openai_compat_runtime: 'docs/release/status/openclaw-openai-compat-runtime-latest.json',
  crewai_wave5_closeout: 'docs/release/status/crewai-wave5-closeout-latest.json',
  autogen_wave7_closeout: 'docs/release/status/autogen-wave7-closeout-latest.json',
  langgraph_wave8_closeout: 'docs/release/status/langgraph-wave8-closeout-latest.json',
  letta_wave6_closeout: 'docs/release/status/letta-wave6-closeout-latest.json',
  openclaw_intelligence_runtime: 'docs/release/status/openclaw-intelligence-runtime-latest.json',
  openclaw_loop_detection_runtime: 'docs/release/status/openclaw-loop-detection-runtime-latest.json',
  parity_checklist_verify: 'docs/release/status/parity-checklist-verify-latest.json',
  admin_rbac_surface: 'docs/release/status/admin-rbac-surface-latest.json',
  runtime_security_baseline: 'docs/release/status/runtime-security-baseline-latest.json',
  openclaw_security_runtime: 'docs/release/status/openclaw-security-runtime-latest.json',
  parity_all_waves_closeout: 'docs/release/status/parity-all-waves-closeout-latest.json',
  release_rollout: 'docs/release/status/release-rollout-latest.json',
  release_bundle_hygiene: 'docs/release/status/release-bundle-hygiene-latest.json',
  competitor_delta_sheet: 'docs/release/status/competitor-delta-sheet-latest.json',
  community_ecosystem_readiness: 'docs/release/status/community-ecosystem-readiness-latest.json',
  openclaw_ui_runtime: 'docs/release/status/openclaw-ui-runtime-latest.json',
  openclaw_chat_commands_runtime: 'docs/release/status/openclaw-chat-commands-runtime-latest.json',
  openclaw_discovery_runtime: 'docs/release/status/openclaw-discovery-runtime-latest.json',
  openclaw_integrations_runtime: 'docs/release/status/openclaw-integrations-runtime-latest.json',
  n8n_wave3_closeout: 'docs/release/status/n8n-wave3-closeout-latest.json',
  openclaw_channels_runtime: 'docs/release/status/openclaw-channels-runtime-latest.json',
};

const dimensions = [
  {
    id: 'core_workflows',
    weight: 0.20,
    required: ['competitor_capability_proof', 'competitor_runtime_truth'],
    surpass: ['framework_wave4_closeout'],
  },
  {
    id: 'tooling_runtime',
    weight: 0.15,
    required: ['openclaw_tools_runtime', 'openclaw_tools_by_provider_runtime'],
    surpass: ['openclaw_openai_compat_runtime'],
  },
  {
    id: 'multi_agent_orchestration',
    weight: 0.10,
    required: ['crewai_wave5_closeout', 'autogen_wave7_closeout', 'langgraph_wave8_closeout'],
    surpass: ['framework_wave4_closeout'],
  },
  {
    id: 'memory_state',
    weight: 0.10,
    required: ['letta_wave6_closeout', 'openclaw_intelligence_runtime'],
    surpass: ['openclaw_loop_detection_runtime'],
  },
  {
    id: 'security_governance',
    weight: 0.15,
    required: ['parity_checklist_verify', 'admin_rbac_surface', 'runtime_security_baseline'],
    surpass: ['openclaw_security_runtime'],
  },
  {
    id: 'ops_release_rigor',
    weight: 0.15,
    required: ['parity_all_waves_closeout', 'release_rollout', 'release_bundle_hygiene'],
    surpass: ['competitor_delta_sheet'],
  },
  {
    id: 'ux_operator_usability',
    weight: 0.10,
    required: ['community_ecosystem_readiness', 'openclaw_ui_runtime', 'openclaw_chat_commands_runtime'],
    surpass: ['openclaw_discovery_runtime'],
  },
  {
    id: 'integration_breadth',
    weight: 0.05,
    required: ['openclaw_integrations_runtime', 'n8n_wave3_closeout'],
    surpass: ['openclaw_channels_runtime'],
  },
];

function readJson(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function artifactStatus(relPath) {
  const json = readJson(relPath);
  if (!json || typeof json !== 'object') {
    return {
      present: false,
      pass: false,
      status: 'missing',
      generated_at: null,
      path: relPath,
    };
  }
  const status = String(json.status || '').toLowerCase() || 'unknown';
  return {
    present: true,
    pass: status === 'pass',
    status,
    generated_at: json.generated_at || null,
    path: relPath,
  };
}

function baseScore(requiredSignals, signalState) {
  if (requiredSignals.length === 0) return 3;
  const passed = requiredSignals.filter((id) => signalState[id] && signalState[id].pass).length;
  const ratio = passed / requiredSignals.length;
  if (ratio === 1) return 3;
  if (ratio >= 0.67) return 2;
  if (ratio >= 0.34) return 1;
  if (ratio > 0) return 0.5;
  return 0;
}

function run() {
  const signalState = {};
  for (const [id, relPath] of Object.entries(signals)) {
    signalState[id] = artifactStatus(relPath);
  }

  const dimensionRows = dimensions.map((dimension) => {
    const requiredPassed = dimension.required.every((id) => signalState[id] && signalState[id].pass);
    const surpassPassed = dimension.surpass.every((id) => signalState[id] && signalState[id].pass);
    const base = baseScore(dimension.required, signalState);
    const score = base === 3 && surpassPassed ? 4 : base;
    return {
      id: dimension.id,
      weight: dimension.weight,
      required: dimension.required,
      surpass: dimension.surpass,
      required_pass: requiredPassed,
      surpass_pass: surpassPassed,
      score,
      weighted: Number((score * dimension.weight).toFixed(4)),
    };
  });

  const weightedScore = Number(
    dimensionRows.reduce((sum, row) => sum + row.weighted, 0).toFixed(4),
  );
  const minDimensionScore = Math.min(...dimensionRows.map((row) => row.score));
  const dimensionsAtOrAbove4 = dimensionRows.filter((row) => row.score >= 4).length;

  const gates = [
    {
      id: 'overall_weighted_score_threshold',
      pass: weightedScore >= 3.4,
      detail: `weighted_score=${weightedScore} (target>=3.4)`,
    },
    {
      id: 'minimum_dimension_score_threshold',
      pass: minDimensionScore >= 3.0,
      detail: `minimum_dimension_score=${minDimensionScore} (target>=3.0)`,
    },
    {
      id: 'differentiator_dimension_count_threshold',
      pass: dimensionsAtOrAbove4 >= 3,
      detail: `dimensions_at_or_above_4=${dimensionsAtOrAbove4} (target>=3)`,
    },
  ];

  const status = gates.every((gate) => gate.pass) ? 'pass' : 'fail';
  const sourceRunId =
    String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim()
    || `local-${Date.now()}`;
  const headSha =
    String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim()
    || (() => {
      try {
        return execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString('utf8')
          .trim();
      } catch {
        return '';
      }
    })();

  const report = {
    generated_at: new Date().toISOString(),
    status,
    summary: {
      weighted_score: weightedScore,
      min_dimension_score: minDimensionScore,
      dimensions_at_or_above_4: dimensionsAtOrAbove4,
      target: {
        weighted_score_gte: 3.4,
        min_dimension_score_gte: 3.0,
        dimensions_at_or_above_4_gte: 3,
      },
    },
    dimensions: dimensionRows,
    signals: signalState,
    gates,
    provenance: {
      source_run_id: sourceRunId,
      head_sha: headSha || null,
      evidence_mode: 'competitive_weighted_scorecard',
    },
  };

  fs.mkdirSync(path.dirname(path.join(root, outJsonRel)), { recursive: true });
  fs.writeFileSync(path.join(root, outJsonRel), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Competitive Scorecard',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- Weighted score: ${report.summary.weighted_score}`,
    `- Minimum dimension score: ${report.summary.min_dimension_score}`,
    `- Dimensions >= 4.0: ${report.summary.dimensions_at_or_above_4}`,
    '',
    '## Dimensions',
    '| Dimension | Score | Weight | Weighted | Required Pass | Surpass Pass |',
    '|---|---:|---:|---:|---|---|',
    ...dimensionRows.map(
      (row) => `| ${row.id} | ${row.score} | ${row.weight} | ${row.weighted} | ${row.required_pass ? 'yes' : 'no'} | ${row.surpass_pass ? 'yes' : 'no'} |`,
    ),
    '',
    '## Gates',
    ...gates.map((gate) => `- [${gate.pass ? 'x' : ' '}] ${gate.id}: ${gate.detail}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, outMdRel), `${md}\n`, 'utf8');

  console.log(`Wrote ${outJsonRel}`);
  console.log(`Wrote ${outMdRel}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
