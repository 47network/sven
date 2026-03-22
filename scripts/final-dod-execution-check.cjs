#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const localOnly = process.argv.includes('--local-only') || process.env.CI_REQUIRED_CHECKS_LOCAL_ONLY === '1';
const minExecuted = Number(process.env.SVEN_FINAL_DOD_MIN_EXECUTED_CASES || 6);
const maxSkipped = Number(process.env.SVEN_FINAL_DOD_MAX_SKIPPED_CASES || 0);
const testPath = path.join(root, 'services', 'gateway-api', 'src', '__tests__', 'final-dod.e2e.ts');
const jestResultsPath = (() => {
  const idx = process.argv.indexOf('--jest-results');
  if (idx >= 0 && process.argv[idx + 1]) return path.resolve(root, process.argv[idx + 1]);
  return path.join(root, 'docs', 'release', 'status', 'final-dod-e2e-jest-results.json');
})();
const outJson = path.join(root, 'docs', 'release', 'status', 'final-dod-execution-latest.json');
const outMd = path.join(root, 'docs', 'release', 'status', 'final-dod-execution-latest.md');

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function countDeclaredCases() {
  if (!fs.existsSync(testPath)) return 0;
  const source = fs.readFileSync(testPath, 'utf8');
  const matches = source.match(/\bit\s*\(/g);
  return matches ? matches.length : 0;
}

function parseExecutedSummary(report) {
  if (!report || typeof report !== 'object') {
    return {
      parsed: false,
      passed: 0,
      failed: 0,
      skipped: 0,
      todo: 0,
      total: 0,
      executed: 0,
      success: false,
      liveChecksExecuted: false,
    };
  }
  const passed = Number(report.numPassedTests || 0);
  const failed = Number(report.numFailedTests || 0);
  const skipped = Number(report.numPendingTests || 0);
  const todo = Number(report.numTodoTests || 0);
  const total = Number(report.numTotalTests || 0);
  const executed = passed + failed;
  return {
    parsed: true,
    passed,
    failed,
    skipped,
    todo,
    total,
    executed,
    success: Boolean(report.success === true),
    liveChecksExecuted: executed > 0 && skipped === 0,
  };
}

function run() {
  const checks = [];
  const declaredCases = countDeclaredCases();
  const jestReport = fs.existsSync(jestResultsPath) ? readJsonSafe(jestResultsPath) : null;
  const summary = parseExecutedSummary(jestReport);

  checks.push({
    id: 'final_dod_declared_cases_present',
    pass: declaredCases > 0,
    detail: `declared_cases=${declaredCases}`,
  });
  checks.push({
    id: 'final_dod_jest_results_present',
    pass: summary.parsed,
    detail: summary.parsed
      ? `parsed ${path.relative(root, jestResultsPath).replace(/\\/g, '/')}`
      : `missing/unparseable ${path.relative(root, jestResultsPath).replace(/\\/g, '/')}`,
  });
  checks.push({
    id: 'final_dod_jest_success',
    pass: summary.success,
    detail: `success=${String(summary.success)} passed=${summary.passed} failed=${summary.failed}`,
  });
  checks.push({
    id: 'final_dod_executed_cases_min',
    pass: summary.executed >= minExecuted,
    detail: `executed_cases=${summary.executed} min_required=${minExecuted}`,
  });
  checks.push({
    id: 'final_dod_skipped_cases_max',
    pass: summary.skipped <= maxSkipped,
    detail: `skipped_cases=${summary.skipped} max_allowed=${maxSkipped}`,
  });
  checks.push({
    id: 'final_dod_live_checks_executed',
    pass: summary.liveChecksExecuted,
    detail: `live_checks_executed=${String(summary.liveChecksExecuted)} (executed=${summary.executed}, skipped=${summary.skipped})`,
  });

  let status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  if (localOnly && !summary.parsed) {
    status = 'inconclusive';
  }

  const report = {
    generated_at: new Date().toISOString(),
    status,
    declared_cases: declaredCases,
    executed_cases: summary.executed,
    guarded_skipped_cases: summary.skipped,
    jest_success: summary.success,
    live_checks_executed: summary.liveChecksExecuted,
    min_executed_cases_required: minExecuted,
    max_skipped_cases_allowed: maxSkipped,
    source_run_id: process.env.GITHUB_RUN_ID || null,
    head_sha: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null,
    checks,
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Final DoD Execution Status

Generated: ${report.generated_at}
Status: ${report.status}

Declared cases: ${report.declared_cases}
Executed cases: ${report.executed_cases}
Guarded/skipped cases: ${report.guarded_skipped_cases}
Live checks executed: ${String(report.live_checks_executed)}

## Checks
${checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`).join('\n')}
`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  console.log(`final-dod-execution-check: ${status}`);
  if (status === 'fail') process.exit(1);
  if (strict && status !== 'pass') process.exit(2);
}

run();
