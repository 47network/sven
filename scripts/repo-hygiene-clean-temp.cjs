#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const now = new Date().toISOString().replace(/[:.]/g, "-");
const archiveBase = path.join(root, "archive", "repo-hygiene", `temp-snapshot-${now}`);

const tempDirs = [".tmp", ".tmp_run_artifacts", "test-results", "playwright-report"];

function exists(p) {
  return fs.existsSync(p);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function moveDir(src, dest) {
  ensureDir(path.dirname(dest));
  fs.renameSync(src, dest);
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const moved = [];

  for (const rel of tempDirs) {
    const src = path.join(root, rel);
    if (!exists(src)) continue;
    const dest = path.join(archiveBase, rel);
    if (dryRun) {
      moved.push({ rel, dest, action: "would_move" });
      continue;
    }
    moveDir(src, dest);
    moved.push({ rel, dest, action: "moved" });
  }

  const output = {
    status: "pass",
    dry_run: dryRun,
    generated_at: new Date().toISOString(),
    archive_base: archiveBase,
    moved,
  };
  console.log(JSON.stringify(output, null, 2));
}

main();

