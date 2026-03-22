#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const withLive = process.argv.includes('--with-live') || process.env.A2A_COMPAT_WITH_LIVE === '1';
const withLivePeerEvidence =
  process.argv.includes('--with-live-peer-evidence') || process.env.A2A_COMPAT_WITH_LIVE_PEER_EVIDENCE === '1';
const gatewayDir = path.join(root, 'services', 'gateway-api');
const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');
const outJson = path.join(outDir, 'a2a-compat-latest.json');
const outMd = path.join(outDir, 'a2a-compat-latest.md');
const smokeJson = path.join(outDir, 'a2a-smoke-latest.json');
const peerEvidenceJson = path.join(outDir, 'a2a-live-peer-evidence-latest.json');

function runCmd(cwd, args, env = process.env) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env });
  return {
    code: r.status ?? -1,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim(),
  };
}

function runJestInGateway(testPath) {
  return runCmd(gatewayDir, [
    '--experimental-vm-modules',
    jestBin,
    '--config',
    'jest.config.cjs',
    '--runTestsByPath',
    testPath,
  ]);
}

function parseJsonIfExists(absPath) {
  if (!fs.existsSync(absPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
}

function validateCompatReport(report) {
  if (!report || typeof report !== 'object') return 'report must be a JSON object';
  if (typeof report.generated_at !== 'string' || !report.generated_at) return 'generated_at is required';
  if (!['pass', 'pass_with_skips', 'fail'].includes(String(report.status || ''))) {
    return 'status must be pass|pass_with_skips|fail';
  }
  if (!Array.isArray(report.checks)) return 'checks must be an array';
  const requiredIds = ['a2a_route_tests_pass', 'a2a_live_smoke_pass', 'a2a_live_peer_evidence_pass'];
  const idSet = new Set(report.checks.map((c) => String(c?.id || '')));
  for (const id of requiredIds) {
    if (!idSet.has(id)) return `missing required check id: ${id}`;
  }
  for (const c of report.checks) {
    if (!c || typeof c !== 'object') return 'each check must be an object';
    if (typeof c.id !== 'string' || !c.id) return 'check.id must be non-empty string';
    if (typeof c.pass !== 'boolean') return `check.pass must be boolean for ${c.id || '(unknown id)'}`;
    if (typeof c.detail !== 'string') return `check.detail must be string for ${c.id || '(unknown id)'}`;
  }
  return null;
}

function run() {
  const checks = [];
  let skippedChecks = 0;

  if (strict) {
    checks.push({
      id: 'a2a_live_smoke_mode_required_in_strict',
      pass: withLive,
      detail: withLive
        ? 'live smoke enabled in strict mode'
        : 'strict mode requires --with-live (or A2A_COMPAT_WITH_LIVE=1)',
    });
    checks.push({
      id: 'a2a_live_peer_evidence_mode_required_in_strict',
      pass: withLivePeerEvidence,
      detail: withLivePeerEvidence
        ? 'live peer evidence enabled in strict mode'
        : 'strict mode requires --with-live-peer-evidence (or A2A_COMPAT_WITH_LIVE_PEER_EVIDENCE=1)',
    });
  }

  const routeTest = runJestInGateway('src/__tests__/a2a-route.test.ts');
  checks.push({
    id: 'a2a_route_tests_pass',
    pass: routeTest.code === 0,
    detail:
      routeTest.code === 0
        ? 'a2a-route.test.ts passed'
        : `failed: ${routeTest.err || routeTest.out || `exit ${routeTest.code}`}`,
  });

  if (!withLive) {
    checks.push({
      id: 'a2a_live_smoke_pass',
      pass: true,
      detail: 'skipped (enable with --with-live or A2A_COMPAT_WITH_LIVE=1)',
    });
    skippedChecks += 1;
  } else {
    const smoke = runCmd(root, [path.join('scripts', 'a2a-smoke.cjs'), '--strict']);
    checks.push({
      id: 'a2a_live_smoke_pass',
      pass: smoke.code === 0,
      detail:
        smoke.code === 0
          ? 'a2a-smoke.cjs passed'
          : `failed: ${smoke.err || smoke.out || `exit ${smoke.code}`}`,
    });
  }

  if (!withLivePeerEvidence) {
    checks.push({
      id: 'a2a_live_peer_evidence_pass',
      pass: true,
      detail: 'skipped (enable with --with-live-peer-evidence or A2A_COMPAT_WITH_LIVE_PEER_EVIDENCE=1)',
    });
    skippedChecks += 1;
  } else {
    const livePeerEvidence = runCmd(root, [path.join('scripts', 'a2a-live-peer-evidence.cjs'), '--strict']);
    checks.push({
      id: 'a2a_live_peer_evidence_pass',
      pass: livePeerEvidence.code === 0,
      detail:
        livePeerEvidence.code === 0
          ? 'a2a-live-peer-evidence.cjs passed'
          : `failed: ${livePeerEvidence.err || livePeerEvidence.out || `exit ${livePeerEvidence.code}`}`,
    });
  }

  const hasFailure = checks.some((c) => !c.pass);
  const status = hasFailure ? 'fail' : skippedChecks > 0 ? 'pass_with_skips' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    schema_version: 1,
    status,
    live_checks_executed: Boolean(withLive && withLivePeerEvidence),
    skipped_checks: skippedChecks,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# A2A Compatibility Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  const artifactIssues = [];
  if (!fs.existsSync(outJson)) artifactIssues.push('missing docs/release/status/a2a-compat-latest.json');
  if (!fs.existsSync(outMd)) artifactIssues.push('missing docs/release/status/a2a-compat-latest.md');
  const parsedReport = parseJsonIfExists(outJson);
  const schemaErr = validateCompatReport(parsedReport);
  if (schemaErr) artifactIssues.push(`invalid a2a-compat-latest.json schema: ${schemaErr}`);

  if (withLive) {
    const smokeReport = parseJsonIfExists(smokeJson);
    if (!smokeReport) {
      artifactIssues.push('missing/invalid docs/release/status/a2a-smoke-latest.json (required in --with-live mode)');
    } else if (!['pass', 'fail'].includes(String(smokeReport.status || ''))) {
      artifactIssues.push('invalid a2a-smoke-latest.json: status must be pass|fail');
    }
  }

  if (withLivePeerEvidence) {
    const peerReport = parseJsonIfExists(peerEvidenceJson);
    if (!peerReport) {
      artifactIssues.push(
        'missing/invalid docs/release/status/a2a-live-peer-evidence-latest.json (required in --with-live-peer-evidence mode)',
      );
    } else if (!['pass', 'fail', 'skip'].includes(String(peerReport.status || '').toLowerCase())) {
      artifactIssues.push('invalid a2a-live-peer-evidence-latest.json: status must be pass|fail|skip');
    }
  }

  if (artifactIssues.length) {
    for (const issue of artifactIssues) {
      console.error(`[a2a-compat-check] ${issue}`);
    }
  }

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (artifactIssues.length > 0) process.exit(2);
  if (strict && status !== 'pass') process.exit(2);
  if (status === 'fail') process.exit(1);
}

run();
