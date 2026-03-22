#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const configPath = path.join(root, 'services', 'gateway-api', 'jest.config.cjs');
const summaryPath = path.join(root, 'services', 'gateway-api', 'coverage', 'coverage-summary.json');
const outDir = path.join(root, 'docs', 'release', 'status');

function normalizeMetricName(name) {
  if (name === 'statements') return 'statements';
  if (name === 'branches') return 'branches';
  if (name === 'functions') return 'functions';
  if (name === 'lines') return 'lines';
  return name;
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8').replace(/^\uFEFF/, ''));
}

function resolveTargetRef() {
  const raw = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim();
  return raw || null;
}

function resolveTargetSha() {
  const raw = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  return raw || null;
}

function main() {
  if (!fs.existsSync(configPath)) {
    console.error(`Missing Jest config: ${path.relative(root, configPath)}`);
    process.exit(2);
  }
  if (!fs.existsSync(summaryPath)) {
    console.error(`Missing coverage summary: ${path.relative(root, summaryPath)}`);
    process.exit(2);
  }

  const cfg = require(configPath);
  const thresholds = cfg?.coverageThreshold?.global || null;
  if (!thresholds || typeof thresholds !== 'object') {
    console.error('Missing coverageThreshold.global in Jest config.');
    process.exit(2);
  }

  const summary = readJson(summaryPath);
  const total = summary?.total || null;
  if (!total || typeof total !== 'object') {
    console.error('Invalid coverage summary format: expected .total metrics');
    process.exit(2);
  }

  const checks = [];
  const requiredMetrics = ['branches', 'functions', 'lines', 'statements'];
  for (const metric of requiredMetrics) {
    const threshold = Number(thresholds[metric]);
    const actualPct = Number(total[normalizeMetricName(metric)]?.pct);
    const hasValues = Number.isFinite(threshold) && Number.isFinite(actualPct);
    const pass = hasValues && actualPct >= threshold;
    checks.push({
      id: `coverage_${metric}_threshold_met`,
      pass,
      threshold_pct: hasValues ? threshold : null,
      actual_pct: hasValues ? actualPct : null,
      detail: hasValues
        ? `actual=${actualPct.toFixed(2)} threshold=${threshold.toFixed(2)}`
        : 'missing metric or threshold',
    });
  }

  const status = checks.every((c) => c.pass) ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    provenance: {
      target_ref: resolveTargetRef(),
      target_sha: resolveTargetSha(),
      source_coverage_summary: path.relative(root, summaryPath).replace(/\\/g, '/'),
      source_jest_config: path.relative(root, configPath).replace(/\\/g, '/'),
    },
    coverage_summary: {
      lines_pct: Number(total.lines?.pct ?? NaN),
      statements_pct: Number(total.statements?.pct ?? NaN),
      functions_pct: Number(total.functions?.pct ?? NaN),
      branches_pct: Number(total.branches?.pct ?? NaN),
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'gateway-coverage-gate-latest.json');
  const outMd = path.join(outDir, 'gateway-coverage-gate-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Gateway Coverage Gate\n\nGenerated: ${report.generated_at}\nStatus: ${status}\n\n## Metrics\n- lines_pct: ${String(report.coverage_summary.lines_pct)}\n- statements_pct: ${String(report.coverage_summary.statements_pct)}\n- functions_pct: ${String(report.coverage_summary.functions_pct)}\n- branches_pct: ${String(report.coverage_summary.branches_pct)}\n\n## Checks\n${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`).join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (status !== 'pass') process.exit(2);
}

main();

