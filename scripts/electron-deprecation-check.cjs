#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const roots = [
  path.join(process.cwd(), 'package.json'),
  path.join(process.cwd(), '.github', 'workflows'),
  path.join(process.cwd(), 'scripts'),
];

const patterns = [
  /apps\/companion-desktop(?!-tauri)/i,
  /--workspace\s+apps\/companion-desktop\b/i,
];

const allowFiles = new Set([
  'scripts/electron-deprecation-check.cjs',
  'scripts/legacy-cleanup-check.cjs',
  '.github/workflows/legacy-cleanup.yml',
]);

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      walk(abs, out);
      continue;
    }
    if (!e.isFile()) continue;
    out.push(abs);
  }
}

function run() {
  const files = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    const stat = fs.statSync(r);
    if (stat.isDirectory()) {
      walk(r, files);
    } else {
      files.push(r);
    }
  }

  const hits = [];
  for (const abs of files) {
    const rel = path.relative(process.cwd(), abs).replace(/\\/g, '/');
    if (allowFiles.has(rel)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (patterns.some((p) => p.test(line))) {
        hits.push(`${rel}:${i + 1}:${line.trim()}`);
      }
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: hits.length === 0 ? 'pass' : 'warn',
    findings: hits,
  };

  const outJson = path.join(process.cwd(), 'docs/release/status/electron-deprecation-check-latest.json');
  const outMd = path.join(process.cwd(), 'docs/release/status/electron-deprecation-check-latest.md');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Electron Deprecation Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    ...(hits.length
      ? ['Findings:', ...hits.map((h) => `- ${h}`)]
      : ['No active Electron CI/package/script references detected.']),
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
}

run();
