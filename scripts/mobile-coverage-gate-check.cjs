#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const lcovPath = path.join(root, 'apps', 'companion-user-flutter', 'coverage', 'lcov.info');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'mobile-coverage-gate-latest.json');
const outMd = path.join(outDir, 'mobile-coverage-gate-latest.md');

const SERVICE_THRESHOLD = 80;
const WIDGET_THRESHOLD = 60;

function resolveTargetRef() {
  const raw = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim();
  return raw || null;
}

function resolveTargetSha() {
  const raw = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  return raw || null;
}

function normalizePath(rawPath) {
  return rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function parseLcov(content) {
  const files = new Map();
  let current = null;
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const filePath = normalizePath(line.slice(3).trim());
      current = filePath;
      if (!files.has(current)) {
        files.set(current, { instrumented: 0, covered: 0, lineHits: new Map() });
      }
      continue;
    }
    if (!current) continue;
    if (line.startsWith('DA:')) {
      const payload = line.slice(3);
      const [lineNoRaw, hitsRaw] = payload.split(',');
      const lineNo = Number(lineNoRaw);
      const hits = Number(hitsRaw);
      if (!Number.isFinite(lineNo) || !Number.isFinite(hits)) continue;

      const entry = files.get(current);
      if (!entry.lineHits.has(lineNo)) {
        entry.lineHits.set(lineNo, hits);
      } else {
        entry.lineHits.set(lineNo, entry.lineHits.get(lineNo) + hits);
      }
      continue;
    }
    if (line === 'end_of_record') {
      current = null;
    }
  }

  for (const entry of files.values()) {
    let instrumented = 0;
    let covered = 0;
    for (const hits of entry.lineHits.values()) {
      instrumented += 1;
      if (hits > 0) covered += 1;
    }
    entry.instrumented = instrumented;
    entry.covered = covered;
    delete entry.lineHits;
  }

  return files;
}

function isServiceFile(filePath) {
  return /\/[^/]*service\.dart$/i.test(filePath);
}

function isWidgetFile(filePath) {
  return /\/[^/]*(page|screen|sheet|widget)\.dart$/i.test(filePath);
}

function bucketCoverage(files, predicate) {
  let fileCount = 0;
  let instrumented = 0;
  let covered = 0;

  for (const [filePath, stats] of files.entries()) {
    if (!predicate(filePath)) continue;
    fileCount += 1;
    instrumented += stats.instrumented;
    covered += stats.covered;
  }

  const pct = instrumented > 0 ? (covered / instrumented) * 100 : 0;
  return { fileCount, instrumented, covered, pct };
}

function writeReports(report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const checksMd = report.checks
    .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
    .join('\n');
  fs.writeFileSync(
    outMd,
    `# Mobile Coverage Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Metrics\n- service_line_coverage_pct: ${report.metrics.service_line_coverage_pct}\n- service_threshold_pct: ${report.metrics.service_threshold_pct}\n- service_files: ${report.metrics.service_files}\n- widget_line_coverage_pct: ${report.metrics.widget_line_coverage_pct}\n- widget_threshold_pct: ${report.metrics.widget_threshold_pct}\n- widget_files: ${report.metrics.widget_files}\n\n## Checks\n${checksMd}\n`,
    'utf8',
  );
}

function main() {
  const checks = [];
  let files = new Map();
  let lcovExists = fs.existsSync(lcovPath);

  checks.push({
    id: 'mobile_lcov_exists',
    pass: lcovExists,
    detail: lcovExists
      ? `found ${path.relative(root, lcovPath).replace(/\\/g, '/')}`
      : `missing ${path.relative(root, lcovPath).replace(/\\/g, '/')}`,
  });

  let serviceBucket = { fileCount: 0, instrumented: 0, covered: 0, pct: 0 };
  let widgetBucket = { fileCount: 0, instrumented: 0, covered: 0, pct: 0 };

  if (lcovExists) {
    const content = fs.readFileSync(lcovPath, 'utf8');
    files = parseLcov(content);
    serviceBucket = bucketCoverage(files, isServiceFile);
    widgetBucket = bucketCoverage(files, isWidgetFile);
  }

  checks.push({
    id: 'mobile_service_files_discovered',
    pass: serviceBucket.fileCount > 0,
    detail: `files=${serviceBucket.fileCount}`,
  });
  checks.push({
    id: 'mobile_widget_files_discovered',
    pass: widgetBucket.fileCount > 0,
    detail: `files=${widgetBucket.fileCount}`,
  });
  checks.push({
    id: 'mobile_service_line_coverage_threshold_met',
    pass: serviceBucket.pct >= SERVICE_THRESHOLD,
    detail: `actual=${serviceBucket.pct.toFixed(2)} threshold=${SERVICE_THRESHOLD.toFixed(2)}`,
  });
  checks.push({
    id: 'mobile_widget_line_coverage_threshold_met',
    pass: widgetBucket.pct >= WIDGET_THRESHOLD,
    detail: `actual=${widgetBucket.pct.toFixed(2)} threshold=${WIDGET_THRESHOLD.toFixed(2)}`,
  });

  const status = checks.every((c) => c.pass) ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    provenance: {
      target_ref: resolveTargetRef(),
      target_sha: resolveTargetSha(),
      source_lcov: path.relative(root, lcovPath).replace(/\\/g, '/'),
    },
    metrics: {
      service_line_coverage_pct: Number(serviceBucket.pct.toFixed(2)),
      service_threshold_pct: SERVICE_THRESHOLD,
      service_files: serviceBucket.fileCount,
      widget_line_coverage_pct: Number(widgetBucket.pct.toFixed(2)),
      widget_threshold_pct: WIDGET_THRESHOLD,
      widget_files: widgetBucket.fileCount,
    },
    checks,
  };

  writeReports(report);
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && status !== 'pass') process.exit(2);
}

main();
