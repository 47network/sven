#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const evidenceDir = path.join(root, 'docs', 'release', 'evidence', 'mobile');
const outDir = path.join(root, 'docs', 'release', 'status');

const LIMITS = {
  p50_ms: 20,
  p90_ms: 45,
  p95_ms: 60,
  p99_ms: 180,
  janky_pct: 25,
  total_pss_kb: 250000,
};

function listCandidates(suffix) {
  return fs
    .readdirSync(evidenceDir)
    .filter((name) => name.startsWith('rc_perf_') && name.endsWith(suffix))
    .map((name) => {
      const full = path.join(evidenceDir, name);
      return { name, full, mtimeMs: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function listCapturePairs() {
  const gfx = listCandidates('_gfxinfo.txt');
  const mem = listCandidates('_meminfo.txt');
  const byKey = new Map();
  for (const item of gfx) {
    const key = item.name.slice(0, -'_gfxinfo.txt'.length);
    const existing = byKey.get(key) || {};
    existing.gfx = item;
    existing.mtimeMs = Math.max(existing.mtimeMs || 0, item.mtimeMs || 0);
    byKey.set(key, existing);
  }
  for (const item of mem) {
    const key = item.name.slice(0, -'_meminfo.txt'.length);
    const existing = byKey.get(key) || {};
    existing.mem = item;
    existing.mtimeMs = Math.max(existing.mtimeMs || 0, item.mtimeMs || 0);
    byKey.set(key, existing);
  }
  return [...byKey.entries()]
    .filter(([, v]) => v.gfx && v.mem)
    .map(([key, v]) => ({ key, gfx: v.gfx, mem: v.mem, mtimeMs: v.mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function parseNumber(text, re) {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function readTextAuto(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le');
  }
  return buf.toString('utf8');
}

function parseMetrics(gfxText, memText) {
  return {
    frames_total: parseNumber(gfxText, /Total frames rendered:\s*(\d+)/),
    janky_pct: parseNumber(gfxText, /Janky frames:\s*\d+\s*\(([\d.]+)%\)/),
    p50_ms: parseNumber(gfxText, /50th percentile:\s*(\d+)ms/),
    p90_ms: parseNumber(gfxText, /90th percentile:\s*(\d+)ms/),
    p95_ms: parseNumber(gfxText, /95th percentile:\s*(\d+)ms/),
    p99_ms: parseNumber(gfxText, /99th percentile:\s*(\d+)ms/),
    total_pss_kb: parseNumber(memText, /TOTAL PSS:\s*(\d+)/),
  };
}

function evaluate(metrics) {
  const hasFrames = typeof metrics.frames_total === 'number' && metrics.frames_total > 0;
  const percentileDetail = (metricName, limit) => {
    if (!hasFrames) return 'no rendered frames; capture active UI workload';
    return `${metrics[metricName]} <= ${limit}`;
  };
  const checks = [
    { id: 'frames_total_positive', pass: hasFrames, detail: hasFrames ? `${metrics.frames_total} > 0` : `frames_total=${metrics.frames_total}` },
    { id: 'p50_ms', pass: hasFrames && metrics.p50_ms !== null && metrics.p50_ms <= LIMITS.p50_ms, detail: percentileDetail('p50_ms', LIMITS.p50_ms) },
    { id: 'p90_ms', pass: hasFrames && metrics.p90_ms !== null && metrics.p90_ms <= LIMITS.p90_ms, detail: percentileDetail('p90_ms', LIMITS.p90_ms) },
    { id: 'p95_ms', pass: hasFrames && metrics.p95_ms !== null && metrics.p95_ms <= LIMITS.p95_ms, detail: percentileDetail('p95_ms', LIMITS.p95_ms) },
    { id: 'p99_ms', pass: hasFrames && metrics.p99_ms !== null && metrics.p99_ms <= LIMITS.p99_ms, detail: percentileDetail('p99_ms', LIMITS.p99_ms) },
    { id: 'janky_pct', pass: hasFrames && metrics.janky_pct !== null && metrics.janky_pct <= LIMITS.janky_pct, detail: hasFrames ? `${metrics.janky_pct}% <= ${LIMITS.janky_pct}%` : 'no rendered frames; capture active UI workload' },
    { id: 'total_pss_kb', pass: metrics.total_pss_kb !== null && metrics.total_pss_kb <= LIMITS.total_pss_kb, detail: `${metrics.total_pss_kb} <= ${LIMITS.total_pss_kb}` },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : passed >= checks.length - 1 ? 'warn' : 'fail';
  return { checks, passed, failed, status };
}

function run() {
  if (!fs.existsSync(evidenceDir)) {
    throw new Error(`Evidence directory not found: ${evidenceDir}`);
  }

  const capturePairs = listCapturePairs();
  if (!capturePairs.length) {
    throw new Error('Missing rc_perf gfxinfo/meminfo artifacts. Run ops:mobile:adb:perf first.');
  }

  let selectedPair = null;
  let selectedMetrics = null;
  let selectedSummary = null;
  // Prefer the latest capture pair that actually meets SLOs.
  for (const pair of capturePairs) {
    const gfxText = readTextAuto(pair.gfx.full);
    const memText = readTextAuto(pair.mem.full);
    const metrics = parseMetrics(gfxText, memText);
    const summary = evaluate(metrics);
    if (summary.status === 'pass') {
      selectedPair = pair;
      selectedMetrics = metrics;
      selectedSummary = summary;
      break;
    }
  }

  // Fallback: latest pair with non-zero frames (even if it misses SLO).
  for (const pair of capturePairs) {
    if (selectedPair) break;
    const gfxText = readTextAuto(pair.gfx.full);
    const memText = readTextAuto(pair.mem.full);
    const metrics = parseMetrics(gfxText, memText);
    const hasFrames = typeof metrics.frames_total === 'number' && metrics.frames_total > 0;
    if (!hasFrames) continue;
    selectedPair = pair;
    selectedMetrics = metrics;
    selectedSummary = evaluate(metrics);
    break;
  }

  if (!selectedPair) {
    selectedPair = capturePairs[0];
    const gfxText = readTextAuto(selectedPair.gfx.full);
    const memText = readTextAuto(selectedPair.mem.full);
    selectedMetrics = parseMetrics(gfxText, memText);
    selectedSummary = evaluate(selectedMetrics);
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: selectedSummary.status,
    source: {
      gfxinfo: path.relative(root, selectedPair.gfx.full).replace(/\\/g, '/'),
      meminfo: path.relative(root, selectedPair.mem.full).replace(/\\/g, '/'),
    },
    capture_selection: {
      strategy: 'latest_pair_with_slo_pass_else_latest_pair_with_frames_total_positive_else_latest_pair',
      capture_key: selectedPair.key,
    },
    limits: LIMITS,
    metrics: selectedMetrics,
    checks: selectedSummary.checks,
    passed: selectedSummary.passed,
    failed: selectedSummary.failed,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-perf-slo-latest.json');
  const outMd = path.join(outDir, 'mobile-perf-slo-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Mobile Perf SLO Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Sources',
    `- gfxinfo: ${report.source.gfxinfo}`,
    `- meminfo: ${report.source.meminfo}`,
    '',
    '## Metrics',
    `- p50: ${selectedMetrics.p50_ms}ms`,
    `- p90: ${selectedMetrics.p90_ms}ms`,
    `- p95: ${selectedMetrics.p95_ms}ms`,
    `- p99: ${selectedMetrics.p99_ms}ms`,
    `- janky: ${selectedMetrics.janky_pct}%`,
    `- total_pss_kb: ${selectedMetrics.total_pss_kb}`,
    '',
    '## Checks',
    ...selectedSummary.checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (report.status === 'fail') process.exit(2);
}

run();
