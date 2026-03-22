#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const targets = [
  {
    rel: 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md',
    refs: [
      'docs/release/status/parity-checklist-verify-latest.json',
      'docs/release/status/competitive-reproduction-program-completion-latest.json',
      'docs/release/status/master-parity-summary-latest.json',
    ],
  },
  {
    rel: 'docs/parity/sven-vs-agent-zero-feature-comparison.md',
    refs: [
      'docs/release/status/parity-checklist-verify-latest.json',
      'docs/release/status/competitive-reproduction-program-completion-latest.json',
      'docs/release/status/agent-zero-parity-verify-latest.json',
    ],
  },
];

function bindForFile(target) {
  const full = path.join(root, target.rel);
  if (!fs.existsSync(full)) return { file: target.rel, updatedRows: 0, changed: false };

  const raw = fs.readFileSync(full, 'utf8');
  const lines = raw.split(/\r?\n/);
  let updatedRows = 0;

  const out = lines.map((line) => {
    if (!/^\|\s*\d+\.\d+\s*\|/.test(line)) return line;
    const statusMatch = line.match(/\|\s*(✅\+?|⚠️|❌)\s*\|/);
    if (!statusMatch) return line;
    const status = String(statusMatch[1]).trim();
    if (status !== '✅' && status !== '✅+') return line;

    const statusEnd = (statusMatch.index || 0) + statusMatch[0].length;
    const lastPipe = line.lastIndexOf('|');
    if (lastPipe <= statusEnd) return line;

    const notes = line.slice(statusEnd, lastPipe).trim();
    const refsToAdd = target.refs.filter((ref) => !notes.includes(ref));
    if (refsToAdd.length === 0) return line;

    const suffix = refsToAdd.map((ref) => `\`${ref}\``).join(' ');
    const mergedNotes = notes.length > 0 ? `${notes} ${suffix}` : suffix;
    const nextLine = `${line.slice(0, statusEnd)} ${mergedNotes} |`;
    updatedRows += 1;
    return nextLine;
  });

  const next = out.join('\n');
  if (next !== raw) {
    fs.writeFileSync(full, next, 'utf8');
    return { file: target.rel, updatedRows, changed: true };
  }
  return { file: target.rel, updatedRows: 0, changed: false };
}

function main() {
  const results = targets.map(bindForFile);
  for (const r of results) {
    console.log(`${r.changed ? 'updated' : 'noop'} ${r.file} rows=${r.updatedRows}`);
  }
}

main();
