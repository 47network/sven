#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const statusDir = path.join(root, 'docs', 'release', 'status');
const includeSoak = process.argv.includes('--include-soak');
const dateStamp = new Date().toISOString().slice(0, 10);
const archiveDir = path.join(
  root,
  'archive',
  'docs-hygiene',
  dateStamp,
  'release-status-snapshots-and-logs'
);

const keepExact = new Set([
  'ci-gates.json',
  'latest.json',
  'latest.md',
  'production-gap-closure-checklist.md',
]);

function keepFile(name) {
  if (keepExact.has(name)) return true;
  if (/-latest\.(json|md)$/.test(name)) return true;
  if (/-next-steps\.ps1$/.test(name)) return true;
  if (!includeSoak && (/^soak-/.test(name) || /^c1-1-rss-soak/.test(name))) return true;
  return false;
}

function ephemeralFile(name) {
  if (!keepFile(name)) return true;
  if (includeSoak && (/^soak-/.test(name) || /^c1-1-rss-soak/.test(name))) return true;
  if (/\.(log|err|out|jsonl)$/.test(name)) return true;
  return false;
}

function run() {
  if (!fs.existsSync(statusDir)) {
    console.error('Missing docs/release/status directory');
    process.exit(2);
  }
  fs.mkdirSync(archiveDir, { recursive: true });

  const files = fs.readdirSync(statusDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name).sort();
  const candidates = files.filter((name) => ephemeralFile(name));

  const moved = [];
  const skipped = [];
  for (const name of candidates) {
    const src = path.join(statusDir, name);
    const dst = path.join(archiveDir, name);
    try {
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
        moved.push(name);
      }
    } catch (err) {
      skipped.push({ name, reason: String(err?.message || err) });
    }
  }

  const manifestPath = path.join(root, 'archive', 'docs-hygiene', dateStamp, 'archive-manifest.release-status-ephemeral.json');
  const manifest = {
    generated_at: new Date().toISOString(),
    include_soak: includeSoak,
    source: 'docs/release/status',
    destination: path.relative(root, archiveDir).replace(/\\/g, '/'),
    moved_count: moved.length,
    skipped_count: skipped.length,
    moved,
    skipped,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Moved: ${moved.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Manifest: ${path.relative(root, manifestPath)}`);
}

run();

