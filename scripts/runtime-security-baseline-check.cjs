#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const baselineRelPath = 'docs/release/security/runtime-security-baseline.md';

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function fieldValue(md, label) {
  const m = md.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, 'im'));
  return m ? String(m[1] || '').trim() : '';
}

function hasHeading(md, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escaped}\\s*$`, 'im').test(md);
}

function run() {
  const packageJson = readJson('package.json');
  const engineNode = packageJson?.engines?.node || '';
  const baseline = read(baselineRelPath);
  const minimumPatchedNode = fieldValue(baseline, 'Minimum patched Node');
  const declaredEngineLine = fieldValue(baseline, 'Current repo engine line');

  const checks = [
    {
      id: 'runtime_security_baseline_doc_present',
      pass: Boolean(baseline),
      detail: baselineRelPath,
    },
    {
      id: 'runtime_security_baseline_declares_minimum_patched_node',
      pass: /^(\d+)\.(\d+)\.(\d+)$/.test(minimumPatchedNode),
      detail: minimumPatchedNode || 'missing',
    },
    {
      id: 'runtime_security_baseline_declares_engine_line',
      pass: Boolean(declaredEngineLine),
      detail: declaredEngineLine || 'missing',
    },
    {
      id: 'runtime_security_baseline_engine_matches_package_json',
      pass: Boolean(engineNode) && declaredEngineLine === engineNode,
      detail: `doc=${declaredEngineLine || 'missing'}; package.json=${engineNode || 'missing'}`,
    },
    {
      id: 'runtime_security_baseline_has_patch_policy_section',
      pass: hasHeading(baseline, 'Patch Policy'),
      detail: '## Patch Policy',
    },
    {
      id: 'runtime_security_baseline_has_uplift_plan_section',
      pass: hasHeading(baseline, 'Node 22 Uplift Plan'),
      detail: '## Node 22 Uplift Plan',
    },
    {
      id: 'runtime_security_baseline_has_cve_rationale',
      pass: /CVE-\d{4}-\d{4,}/i.test(baseline),
      detail: 'CVE rationale present',
    },
  ];

  if (String(engineNode).trim() === '20.x') {
    checks.push({
      id: 'runtime_security_baseline_has_node20_compensating_controls',
      pass: hasHeading(baseline, 'Compensating Controls (Node 20.x)'),
      detail: 'required when package.json engines.node is 20.x',
    });
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    baseline_doc: baselineRelPath,
    engine_node: engineNode || null,
    minimum_patched_node: minimumPatchedNode || null,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'runtime-security-baseline-latest.json');
  const outMd = path.join(outDir, 'runtime-security-baseline-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Runtime Security Baseline Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();

