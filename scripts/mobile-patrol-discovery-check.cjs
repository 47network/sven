#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const evidencePath = String(
  process.env.SVEN_MOBILE_PATROL_MATRIX_EVIDENCE
    || 'docs/release/evidence/mobile/mirror-mode-non-patrol-test-matrix-2026-02-24.md',
).trim();
const patrolSourceRoots = [
  'apps/companion-user-flutter/integration_test',
  'apps/companion-user-flutter/patrol_test',
];

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function listDartFiles(relDir) {
  const absDir = path.join(root, relDir);
  if (!fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      const nested = listDartFiles(path.join(relDir, entry.name));
      files.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.dart')) continue;
    files.push(path.join(relDir, entry.name).replace(/\\/g, '/'));
  }
  return files;
}

function countPatrolTestsFromSource() {
  const files = patrolSourceRoots.flatMap((dir) => listDartFiles(dir));
  let count = 0;
  for (const relPath of files) {
    const body = fs.readFileSync(path.join(root, relPath), 'utf8');
    const matches = body.match(/patrolTest\s*\(/g) || [];
    count += matches.length;
  }
  return { count, files };
}

function run() {
  const absEvidencePath = path.join(root, evidencePath);
  const evidenceExists = fs.existsSync(absEvidencePath);
  const body = evidenceExists ? fs.readFileSync(absEvidencePath, 'utf8') : '';

  const totalMatch = body.match(/Total:\s*([0-9]+)/i);
  const discoveredTotal = totalMatch ? Number(totalMatch[1]) : null;
  const hasZeroDiscoveryClaim = /zero discovered tests/i.test(body);
  const sourceDiscovery = countPatrolTestsFromSource();

  const checks = [
    {
      id: 'mobile_patrol_matrix_evidence_present',
      pass: evidenceExists,
      detail: evidencePath,
    },
    {
      id: 'mobile_patrol_discovery_total_parseable',
      pass: typeof discoveredTotal === 'number' && Number.isFinite(discoveredTotal),
      detail: totalMatch ? `Total=${String(discoveredTotal)}` : 'missing `Total: <n>` marker in evidence',
    },
    {
      id: 'mobile_patrol_source_tests_discovered_nonzero',
      pass: sourceDiscovery.count > 0,
      detail: `source_patrol_tests=${String(sourceDiscovery.count)} from ${sourceDiscovery.files.length} dart files`,
    },
    {
      id: 'mobile_patrol_discovery_total_nonzero',
      pass: typeof discoveredTotal === 'number' && discoveredTotal > 0,
      detail:
        typeof discoveredTotal === 'number'
          ? `Total=${String(discoveredTotal)}`
          : 'unable to evaluate total discovered tests',
    },
    {
      id: 'mobile_patrol_zero_discovery_claim_absent',
      pass: !hasZeroDiscoveryClaim,
      detail: hasZeroDiscoveryClaim
        ? 'evidence states zero discovered Patrol tests'
        : 'no zero-discovery claim found',
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((check) => !check.pass) ? 'fail' : 'pass',
    evidence: {
      path: evidencePath,
      discovered_total: discoveredTotal,
      zero_discovery_claim_detected: hasZeroDiscoveryClaim,
      source_patrol_tests: sourceDiscovery.count,
      source_patrol_files: sourceDiscovery.files,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-patrol-discovery-latest.json');
  const outMd = path.join(outDir, 'mobile-patrol-discovery-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Mobile Patrol Discovery Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Evidence',
    `- path: ${report.evidence.path}`,
    `- discovered_total: ${report.evidence.discovered_total === null ? '(missing)' : String(report.evidence.discovered_total)}`,
    `- zero_discovery_claim_detected: ${String(report.evidence.zero_discovery_claim_detected)}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
