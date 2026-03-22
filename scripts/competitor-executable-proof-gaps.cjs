#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const inRel = 'docs/release/status/competitor-runtime-truth-latest.json';
const outJsonRel = 'docs/release/status/competitor-executable-proof-gaps-latest.json';
const outMdRel = 'docs/release/status/competitor-executable-proof-gaps-latest.md';

function readJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function main() {
  const src = readJson(inRel);
  if (!src || !Array.isArray(src.rows)) {
    console.error(`Missing/invalid source artifact: ${inRel}`);
    process.exit(1);
  }

  const rows = src.rows.filter((r) => r.classification !== 'proven-runtime');
  const byCompetitor = rows.reduce((acc, row) => {
    const key = row.competitor || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const byRuntimeLane = {};
  for (const row of rows) {
    const lanes = row.references?.runtime_status_refs || ['(none)'];
    for (const lane of lanes) {
      if (!byRuntimeLane[lane]) byRuntimeLane[lane] = [];
      byRuntimeLane[lane].push({
        competitor: row.competitor,
        feature_id: row.feature_id,
        reason: row.reason,
      });
    }
  }

  const topRuntimeLanes = Object.entries(byRuntimeLane)
    .map(([lane, list]) => ({ lane, count: list.length }))
    .sort((a, b) => b.count - a.count);

  const report = {
    generated_at: new Date().toISOString(),
    status: rows.length === 0 ? 'pass' : 'fail',
    source: inRel,
    summary: {
      unresolved_rows: rows.length,
      unresolved_by_competitor: Object.fromEntries(
        Object.entries(byCompetitor).map(([k, v]) => [k, v.length]),
      ),
      top_runtime_lanes: topRuntimeLanes.slice(0, 20),
    },
    unresolved_rows: rows,
  };

  write(outJsonRel, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    '# Competitor Executable Proof Gaps',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Source: \`${inRel}\``,
    '',
    '## Summary',
    `- unresolved_rows: ${report.summary.unresolved_rows}`,
    ...Object.entries(report.summary.unresolved_by_competitor).map(
      ([k, v]) => `- ${k}: ${v}`,
    ),
    '',
    '## Top Runtime Lanes Missing Code/Test Anchors',
    ...report.summary.top_runtime_lanes.map((x) => `- ${x.lane}: ${x.count}`),
    '',
    '## First 100 Unresolved Rows',
    ...rows.slice(0, 100).map((r) => `- ${r.competitor} ${r.feature_id}: ${r.reason}`),
    '',
  ];
  write(outMdRel, `${md.join('\n')}\n`);

  console.log(`Wrote ${outJsonRel}`);
  console.log(`Wrote ${outMdRel}`);
}

main();

