#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const statusDir = path.join(root, 'docs', 'release', 'status');

function readJson(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function check(id, pass, detail) {
  return { id, pass: Boolean(pass), detail };
}

const waveArtifacts = [
  { id: 'wave1', file: 'docs/release/status/openhands-wave1-closeout-latest.json' },
  { id: 'wave2', file: 'docs/release/status/librechat-wave2-closeout-latest.json' },
  { id: 'wave3', file: 'docs/release/status/n8n-wave3-closeout-latest.json' },
  { id: 'wave4', file: 'docs/release/status/framework-wave4-closeout-latest.json' },
  { id: 'wave5', file: 'docs/release/status/crewai-wave5-closeout-latest.json' },
  { id: 'wave6', file: 'docs/release/status/letta-wave6-closeout-latest.json' },
  { id: 'wave7', file: 'docs/release/status/autogen-wave7-closeout-latest.json' },
  { id: 'wave8', file: 'docs/release/status/langgraph-wave8-closeout-latest.json' },
];

const waveStatuses = waveArtifacts.map((w) => {
  const json = readJson(w.file);
  return {
    id: w.id,
    file: w.file,
    present: Boolean(json),
    status: json && typeof json.status === 'string' ? json.status : 'missing',
    generated_at: json && json.generated_at ? json.generated_at : null,
  };
});

const parityAllWaves = readJson('docs/release/status/parity-all-waves-closeout-latest.json');
const parityChecklistVerify = readJson('docs/release/status/parity-checklist-verify-latest.json');
const competitiveScorecard = readJson('docs/release/status/competitive-scorecard-latest.json');
const strictLatest = readJson('docs/release/status/latest.json');
const parityWorkflow = fs.existsSync(path.join(root, '.github', 'workflows', 'parity-e2e.yml'))
  ? fs.readFileSync(path.join(root, '.github', 'workflows', 'parity-e2e.yml'), 'utf8')
  : '';

const allWaveCloseoutsPass = waveStatuses.every((w) => w.present && w.status === 'pass');
const allWavesUnifiedPass = parityAllWaves && parityAllWaves.status === 'pass';
const checklistVerifyPass = parityChecklistVerify && parityChecklistVerify.status === 'pass';
const competitiveScorecardPass = competitiveScorecard && competitiveScorecard.status === 'pass';
const langgraphHardGateWired =
  /id:\s*langgraph_wave8/.test(parityWorkflow)
  && /steps\.langgraph_wave8\.outcome/.test(parityWorkflow)
  && /id:\s*'langgraph_wave8'/.test(parityWorkflow)
  && /outcome:\s*langgraphOutcome/.test(parityWorkflow);

const blockers = Array.isArray(strictLatest && strictLatest.blocking_reasons)
  ? strictLatest.blocking_reasons.map((b) => String(b.id || 'unknown'))
  : [];
const nonSelfBlockers = blockers.filter((id) => id !== 'competitive_program_completion_status');
const competitiveWorkCompleteOnlyBlockers = (nonSelfBlockers.length === 0) || nonSelfBlockers.every((id) => [
  'checklist_unchecked_items',
  'mandatory_gate_final_dod_ci',
  'mandatory_gate_d9_keycloak_interop_ci',
  'mandatory_gate_release_ops_drill_ci',
  'soak_72h_summary_status',
  'soak_72h_samples_below_expected',
  'final_signoff_status',
  'multi_device_validation_status',
  'mirror_agent_host_validation_status',
].includes(id));

const checks = [
  check(
    'competitive_program_wave_closeouts_pass',
    allWaveCloseoutsPass,
    waveStatuses.map((w) => `${w.id}:${w.status}`).join(', '),
  ),
  check(
    'competitive_program_unified_all_waves_closeout_pass',
    Boolean(allWavesUnifiedPass),
    `status=${parityAllWaves && parityAllWaves.status ? parityAllWaves.status : 'missing'}`,
  ),
  check(
    'competitive_program_parity_checklist_verify_pass',
    Boolean(checklistVerifyPass),
    `status=${parityChecklistVerify && parityChecklistVerify.status ? parityChecklistVerify.status : 'missing'}`,
  ),
  check(
    'competitive_program_scorecard_thresholds_pass',
    Boolean(competitiveScorecardPass),
    competitiveScorecard
      ? `status=${competitiveScorecard.status}; weighted=${competitiveScorecard?.summary?.weighted_score ?? 'n/a'}; min_dimension=${competitiveScorecard?.summary?.min_dimension_score ?? 'n/a'}; dimensions_at_or_above_4=${competitiveScorecard?.summary?.dimensions_at_or_above_4 ?? 'n/a'}`
      : 'missing docs/release/status/competitive-scorecard-latest.json',
  ),
  check(
    'competitive_program_langgraph_wave8_hard_gate_wired',
    langgraphHardGateWired,
    'parity-e2e includes langgraph wave8 step + summary binding',
  ),
  check(
    'competitive_program_remaining_blockers_non_competitive_only',
    competitiveWorkCompleteOnlyBlockers,
    `blockers=${nonSelfBlockers.join(', ') || 'none'}`,
  ),
];

const failed = checks.filter((c) => !c.pass);
const report = {
  generated_at: new Date().toISOString(),
  status: failed.length === 0 ? 'pass' : 'warn',
  passed: checks.length - failed.length,
  failed: failed.length,
  checks,
  waves: waveStatuses,
  strict_blocking_reasons: nonSelfBlockers,
};

fs.mkdirSync(statusDir, { recursive: true });
const outJson = path.join(statusDir, 'competitive-reproduction-program-completion-latest.json');
const outMd = path.join(statusDir, 'competitive-reproduction-program-completion-latest.md');
fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const md = [
  '# Competitive Reproduction Program Completion',
  '',
  `Generated: ${report.generated_at}`,
  `Status: ${report.status}`,
  '',
  '## Checks',
  ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
  '',
  '## Wave Closeouts',
  ...waveStatuses.map((w) => `- ${w.id}: ${w.status} (${w.file})`),
  '',
  '## Strict Blocking Reasons',
  ...(blockers.length ? blockers.map((b) => `- ${b}`) : ['- none']),
];
fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

console.log(JSON.stringify(report, null, 2));
if (strict && report.status !== 'pass') {
  process.exit(2);
}
