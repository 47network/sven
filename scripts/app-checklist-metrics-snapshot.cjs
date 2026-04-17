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

const outputJson = path.resolve(root, argValue('--output-json', 'docs/release/status/app-checklist-metrics-latest.json'));
const outputMd = path.resolve(root, argValue('--output-md', 'docs/release/status/app-checklist-metrics-latest.md'));
const appLibDir = path.join(root, 'apps/companion-user-flutter/lib');
const appTestDir = path.join(root, 'apps/companion-user-flutter/test');

function listFilesRecursive(dir, matcher) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (!matcher || matcher(entry.name, full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function countMatches(files, pattern) {
  let total = 0;
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const matches = source.match(pattern);
    if (matches) total += matches.length;
  }
  return total;
}

function main() {
  const libDartFiles = listFilesRecursive(appLibDir, (name) => name.endsWith('.dart'));
  const testDartFiles = listFilesRecursive(appTestDir, (name) => name.endsWith('.dart'));
  const testDeclarations = countMatches(testDartFiles, /\btestWidgets\s*\(|\btest\s*\(/g);

  const payload = {
    status: 'pass',
    generated_at: new Date().toISOString(),
    metrics: {
      companion_lib_dart_files: libDartFiles.length,
      companion_test_dart_files: testDartFiles.length,
      companion_test_declarations: testDeclarations,
    },
    sources: {
      companion_lib_dir: rel(appLibDir),
      companion_test_dir: rel(appTestDir),
      command_snapshot: [
        `rg --files ${rel(appLibDir)} | Measure-Object`,
        `rg --files ${rel(appTestDir)} | Measure-Object`,
        'rg -n "\\btestWidgets\\(|\\btest\\(" apps/companion-user-flutter/test | Measure-Object',
      ],
    },
  };

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMd), { recursive: true });
  fs.writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# App Checklist Metrics Snapshot',
    '',
    `Generated: ${payload.generated_at}`,
    '',
    '## Metrics',
    `- companion_lib_dart_files: ${payload.metrics.companion_lib_dart_files}`,
    `- companion_test_dart_files: ${payload.metrics.companion_test_dart_files}`,
    `- companion_test_declarations: ${payload.metrics.companion_test_declarations}`,
    '',
    '## Sources',
    `- companion_lib_dir: ${payload.sources.companion_lib_dir}`,
    `- companion_test_dir: ${payload.sources.companion_test_dir}`,
    '',
    '## Command Snapshot',
    ...payload.sources.command_snapshot.map((command) => `- ${command}`),
    '',
    '## Last Verified',
    `- ${payload.generated_at}`,
    '',
  ];
  fs.writeFileSync(outputMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outputJson)}`);
  console.log(`Wrote ${rel(outputMd)}`);
}

main();
