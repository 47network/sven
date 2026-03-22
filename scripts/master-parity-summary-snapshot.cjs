#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const azDoc = path.resolve(root, argValue('--az-doc', 'docs/parity/sven-vs-agent-zero-feature-comparison.md'));
const ocDoc = path.resolve(root, argValue('--oc-doc', 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md'));
const outJson = path.resolve(root, argValue('--output-json', 'docs/release/status/master-parity-summary-latest.json'));
const outMd = path.resolve(root, argValue('--output-md', 'docs/release/status/master-parity-summary-latest.md'));

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function parseAgentZero(text) {
  const normalized = text.replace(/\*\*/g, '').replace(/[–—]/g, '-');
  const line = normalized.match(/Parity status\s*\((rev[^)]*)\)\s*:\s*(\d+)\s+Agent Zero features tracked\.\s*(\d+)\s+matched\s*\((\d+)%\),\s*(\d+)\s+partial\s*\((\d+)%\),\s*(\d+)\s+missing\s*\((\d+)%\)\s*-\s*with\s*(\d+)\s+Sven-only/i);
  if (!line) {
    throw new Error('Unable to parse Agent Zero parity status line');
  }
  const updated = normalized.match(/Last updated:\s*([^*\n]+)\*/i) || normalized.match(/Last updated:\s*([^\n]+)/i);
  return {
    revision: line[1],
    totals: Number(line[2]),
    matched: Number(line[3]),
    matched_pct: Number(line[4]),
    partial: Number(line[5]),
    partial_pct: Number(line[6]),
    missing: Number(line[7]),
    missing_pct: Number(line[8]),
    sven_only: Number(line[9]),
    last_updated: updated ? updated[1].trim() : null,
  };
}

function parseOpenClaw(text) {
  const normalized = text.replace(/\*\*/g, '');
  const totals = normalized.match(/\|\s*TOTALS\s*\|\s*~?(\d+)\s*\|\s*~?(\d+)\s*\((\d+)%\)\s*\|\s*~?(\d+)\s*\((\d+)%\)\s*\|\s*~?(\d+)\s*\((\d+)%\)\s*\|\s*(\d+)\s*\|/i);
  if (!totals) {
    throw new Error('Unable to parse OpenClaw totals row');
  }
  const rev = normalized.match(/Updated parity scorecard:\s*([^(\n]+)\((rev[^)]*)\)/i);
  const updated = normalized.match(/Last updated:\s*([^*\n]+)\*/i) || normalized.match(/Last updated:\s*([^\n]+)/i);
  return {
    revision: rev ? rev[2] : null,
    revision_note: rev ? rev[1].trim() : null,
    totals: Number(totals[1]),
    matched: Number(totals[2]),
    matched_pct: Number(totals[3]),
    partial: Number(totals[4]),
    partial_pct: Number(totals[5]),
    missing: Number(totals[6]),
    missing_pct: Number(totals[7]),
    sven_only: Number(totals[8]),
    last_updated: updated ? updated[1].trim() : null,
  };
}

function main() {
  if (!fs.existsSync(azDoc)) throw new Error(`Agent Zero parity doc not found: ${rel(azDoc)}`);
  if (!fs.existsSync(ocDoc)) throw new Error(`OpenClaw parity doc not found: ${rel(ocDoc)}`);

  const az = parseAgentZero(fs.readFileSync(azDoc, 'utf8'));
  const oc = parseOpenClaw(fs.readFileSync(ocDoc, 'utf8'));

  const payload = {
    generated_at: new Date().toISOString(),
    sources: {
      agent_zero_doc: rel(azDoc),
      openclaw_doc: rel(ocDoc),
    },
    agent_zero: az,
    openclaw: oc,
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# Master Parity Summary Snapshot',
    '',
    `Generated: ${payload.generated_at}`,
    '',
    '## Agent Zero',
    `- revision: ${az.revision}`,
    `- totals: ${az.totals}`,
    `- matched: ${az.matched} (${az.matched_pct}%)`,
    `- partial: ${az.partial} (${az.partial_pct}%)`,
    `- missing: ${az.missing} (${az.missing_pct}%)`,
    `- sven_only: ${az.sven_only}`,
    `- last_updated: ${az.last_updated || '(unknown)'}`,
    '',
    '## OpenClaw',
    `- revision: ${oc.revision || '(unknown)'}`,
    `- totals: ${oc.totals}`,
    `- matched: ${oc.matched} (${oc.matched_pct}%)`,
    `- partial: ${oc.partial} (${oc.partial_pct}%)`,
    `- missing: ${oc.missing} (${oc.missing_pct}%)`,
    `- sven_only: ${oc.sven_only}`,
    `- last_updated: ${oc.last_updated || '(unknown)'}`,
    '',
    '## Sources',
    `- ${payload.sources.agent_zero_doc}`,
    `- ${payload.sources.openclaw_doc}`,
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
}

main();
