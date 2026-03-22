#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxAgeHours = Number(process.env.SVEN_BENCHMARK_SUITE_MAX_AGE_HOURS || 72);
const relaxedLocalMode = process.env.SVEN_BENCHMARK_RELAXED_LOCAL === '1'
  || (process.env.SVEN_BENCHMARK_RELAXED_LOCAL !== '0' && !process.env.GITHUB_ACTIONS);

const BENCHMARKS = [
  {
    id: 'f1_onboarding',
    run: ['scripts/f1-onboarding-first-reply-benchmark.cjs', '--strict'],
    artifact: 'docs/release/status/f1-onboarding-benchmark-latest.json',
    allowInconclusiveInRelaxed: true,
  },
  {
    id: 'f2_ui_operability',
    run: ['scripts/f2-ui-operability-benchmark.cjs', '--strict'],
    artifact: 'docs/release/status/f2-ui-operability-benchmark-latest.json',
    allowInconclusiveInRelaxed: true,
  },
  {
    id: 'f3_reliability_recovery',
    run: ['scripts/run-f3-benchmark-local.cjs'],
    artifact: 'docs/release/status/f3-reliability-recovery-benchmark-latest.json',
    allowInconclusiveInRelaxed: true,
  },
  {
    id: 'f4_security_defaults',
    run: ['scripts/f4-security-defaults-benchmark.cjs', '--strict'],
    artifact: 'docs/release/status/f4-security-defaults-benchmark-latest.json',
    allowInconclusiveInRelaxed: true,
  },
  {
    id: 'competitor_runtime_guard',
    run: ['scripts/competitor-runtime-guard-check.cjs', '--strict'],
    artifact: 'docs/release/status/competitor-runtime-guard-latest.json',
  },
  {
    id: 'competitor_capability_proof',
    run: ['scripts/competitor-capability-proof-status.cjs', '--strict'],
    artifact: 'docs/release/status/competitor-capability-proof-latest.json',
  },
  {
    id: 'competitor_runtime_truth',
    run: ['scripts/competitor-runtime-truth-check.cjs', '--strict'],
    artifact: 'docs/release/status/competitor-runtime-truth-latest.json',
  },
  {
    id: 'competitive_scorecard',
    run: ['scripts/competitive-scorecard-status.cjs', '--strict'],
    artifact: 'docs/release/status/competitive-scorecard-latest.json',
  },
];

function runNode(args) {
  const env = { ...process.env };
  if (!env.GITHUB_SHA && !env.CI_COMMIT_SHA) {
    const rev = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' });
    const sha = String(rev.stdout || '').trim();
    if (sha) env.GITHUB_SHA = sha;
  }
  if (!env.GITHUB_RUN_ID && !env.CI_PIPELINE_ID) {
    env.GITHUB_RUN_ID = `local-${Date.now()}`;
  }
  if (!env.API_URL) {
    env.API_URL = 'http://127.0.0.1:15811';
  }
  if (!env.F4_REMEDIATION_MINUTES) {
    env.F4_REMEDIATION_MINUTES = '5';
  }
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env,
  });
  return {
    code: result.status ?? -1,
    out: (result.stdout || '').trim(),
    err: (result.stderr || '').trim(),
  };
}

function readJsonSafe(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['generated_at', 'timestamp', 'updated_at']) {
    const raw = value[key];
    if (!raw) continue;
    const parsed = Date.parse(String(raw));
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const checks = [];

  for (const bench of BENCHMARKS) {
    const exec = runNode(bench.run);
    const executionPass = exec.code === 0
      || (relaxedLocalMode && bench.allowInconclusiveInRelaxed && exec.code === 2);
    checks.push({
      id: `${bench.id}_executed`,
      pass: executionPass,
      detail: executionPass
        ? `benchmark script executed successfully (exit=${exec.code})`
        : `exit=${exec.code} ${exec.err || exec.out}`,
    });

    const report = readJsonSafe(bench.artifact);
    checks.push({
      id: `${bench.id}_artifact_present`,
      pass: Boolean(report),
      detail: report ? bench.artifact : `missing/invalid JSON: ${bench.artifact}`,
    });
    if (!report) continue;

    const status = String(report.status || report?.summary?.status || '').toLowerCase();
    const statusPass = status === 'pass'
      || (relaxedLocalMode && bench.allowInconclusiveInRelaxed && status === 'inconclusive');
    checks.push({
      id: `${bench.id}_status_pass`,
      pass: statusPass,
      detail: statusPass && status === 'inconclusive'
        ? `status=${status} (accepted in relaxed-local mode)`
        : `status=${status || '(missing)'}`,
    });

    const ts = extractTimestampIso(report);
    const age = ageHours(ts);
    const fresh = typeof age === 'number' && age <= maxAgeHours;
    checks.push({
      id: `${bench.id}_fresh`,
      pass: fresh,
      detail: fresh ? `${age.toFixed(2)}h <= ${maxAgeHours}h` : ts ? `${(age || 0).toFixed(2)}h > ${maxAgeHours}h` : 'missing timestamp',
    });

    const provenance = report.provenance && typeof report.provenance === 'object' ? report.provenance : {};
    const runId = String(provenance.source_run_id || report.source_run_id || '').trim();
    const headSha = String(provenance.head_sha || report.head_sha || '').trim();
    const evidenceMode = String(provenance.evidence_mode || report.evidence_mode || '').trim();
    const shaOk = /^[a-f0-9]{7,40}$/i.test(headSha);
    checks.push({
      id: `${bench.id}_provenance_present`,
      pass: Boolean(runId && evidenceMode && shaOk),
      detail: `run_id=${runId || '(missing)'} evidence_mode=${evidenceMode || '(missing)'} head_sha=${headSha || '(missing)'}`,
    });
  }

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    max_age_hours: maxAgeHours,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'benchmark-suite-latest.json');
  const outMd = path.join(outDir, 'benchmark-suite-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Benchmark Suite Gate\n\nGenerated: ${payload.generated_at}\nStatus: ${payload.status}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
