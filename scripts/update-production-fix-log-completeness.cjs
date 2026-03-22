#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const issuesPath = path.join(
  repoRoot,
  'archive',
  'docs-hygiene',
  '2026-03-12',
  'docs-root-development-ledgers',
  'issues.txt'
);
const logPath = path.join(
  repoRoot,
  'archive',
  'docs-hygiene',
  '2026-03-12',
  'docs-root-development-ledgers',
  'production-fix-implementation-log.md'
);
const checkOnly = process.argv.includes('--check');

function percent(numerator, denominator) {
  if (denominator <= 0) return '0.00';
  return ((numerator / denominator) * 100).toFixed(2);
}

function collectIssueWaves(issuesText) {
  const waves = new Set();
  const regex = /Deep Inspection Wave\s+(\d+)/g;
  let match = regex.exec(issuesText);
  while (match) {
    waves.add(Number(match[1]));
    match = regex.exec(issuesText);
  }
  return waves;
}

function parseFixRows(logText) {
  const lines = logText.split(/\r?\n/);
  const rows = lines.filter((line) => /^\|\s*FIX-/i.test(line));
  function splitMarkdownRowCells(line) {
    const cells = [];
    let current = '';
    let inBackticks = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const prev = i > 0 ? line[i - 1] : '';
      if (ch === '`' && prev !== '\\') {
        inBackticks = !inBackticks;
        current += ch;
        continue;
      }
      if (ch === '|' && !inBackticks) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells.filter((_, idx, arr) => !(idx === 0 && arr[idx] === '') && !(idx === arr.length - 1 && arr[idx] === ''));
  }

  const parsed = rows.map((line) => {
    const cols = splitMarkdownRowCells(line);
    return {
      source: cols[1] || '',
      status: cols[3] || '',
    };
  });
  return parsed;
}

function collectImplementedWaves(rows) {
  const waves = new Set();
  for (const row of rows) {
    if (row.status.toLowerCase() !== 'implemented') continue;
    const matches = row.source.match(/\d+/g) || [];
    for (const waveText of matches) {
      waves.add(Number(waveText));
    }
  }
  return waves;
}

function replaceLine(text, prefix, replacement) {
  const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'm');
  if (!regex.test(text)) {
    throw new Error(`Missing required header line: ${prefix}`);
  }
  return text.replace(regex, replacement);
}

function main() {
  if (!fs.existsSync(issuesPath)) throw new Error(`Missing issues file: ${issuesPath}`);
  if (!fs.existsSync(logPath)) throw new Error(`Missing log file: ${logPath}`);

  const issuesText = fs.readFileSync(issuesPath, 'utf8');
  const logText = fs.readFileSync(logPath, 'utf8');

  const issueWaves = collectIssueWaves(issuesText);
  const fixRows = parseFixRows(logText);
  const implementedRows = fixRows.filter((row) => row.status.toLowerCase() === 'implemented').length;
  const implementedWaves = collectImplementedWaves(fixRows);
  const coveredIssueWaves = [...implementedWaves].filter((wave) => issueWaves.has(wave)).length;

  const queuePct = percent(implementedRows, fixRows.length);
  const coveragePct = percent(coveredIssueWaves, issueWaves.size);
  const minWave = issueWaves.size ? Math.min(...issueWaves) : 0;
  const maxWave = issueWaves.size ? Math.max(...issueWaves) : 0;

  let updated = logText;
  updated = replaceLine(
    updated,
    'Queue completeness (tracked implementation queue):',
    `Queue completeness (tracked implementation queue): \`${implementedRows} / ${fixRows.length}\` (\`${queuePct}%\`)`
  );
  updated = replaceLine(
    updated,
    'Overall issue-wave coverage (docs corpus):',
    `Overall issue-wave coverage (docs corpus): \`${coveredIssueWaves} / ${issueWaves.size}\` (\`${coveragePct}%\`)`
  );
  updated = replaceLine(
    updated,
    'Coverage basis:',
    `Coverage basis: unique \`Wave <n>\` entries currently present in \`archive/docs-hygiene/2026-03-12/docs-root-development-ledgers/issues.txt\` (\`min=${minWave}\`, \`max=${maxWave}\`)`
  );

  if (checkOnly) {
    if (updated !== logText) {
      console.error('production-fix-implementation-log completeness header is stale. Run: node scripts/update-production-fix-log-completeness.cjs');
      process.exit(2);
    }
    console.log(`production-fix-implementation-log completeness header is current (${implementedRows}/${fixRows.length} rows, ${coveredIssueWaves}/${issueWaves.size} waves).`);
    return;
  }

  if (updated !== logText) {
    fs.writeFileSync(logPath, updated, 'utf8');
  }
  console.log(`Updated production fix completeness header (${implementedRows}/${fixRows.length} rows, ${coveredIssueWaves}/${issueWaves.size} waves).`);
}

main();
