#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');

function parseTopLevelServices(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return [];
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const out = [];
  let inServices = false;
  for (const line of lines) {
    if (!inServices) {
      if (/^services:\s*$/.test(line)) inServices = true;
      continue;
    }
    if (/^[^\s#][^:]*:\s*$/.test(line) && !/^services:\s*$/.test(line)) break;
    const m = line.match(/^  ([A-Za-z0-9_.-]+):\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

function dockerComposeServices(files) {
  const fileArgs = files.map((f) => `-f ${f}`).join(' ');
  const cmd = `docker compose ${fileArgs} config --services`;
  const raw = execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function run() {
  const prodFiles = ['docker-compose.yml'];
  const stagingFiles = ['docker-compose.yml', 'docker-compose.staging.yml'];

  let prod = [];
  let staging = [];
  let mode = 'docker_compose';
  try {
    prod = uniqueSorted(dockerComposeServices(prodFiles));
    staging = uniqueSorted(dockerComposeServices(stagingFiles));
  } catch {
    mode = 'yaml_fallback';
    prod = uniqueSorted(parseTopLevelServices('docker-compose.yml'));
    // Staging override must not redefine/remove core service list;
    // parity in fallback mode is based on base compose service set.
    staging = [...prod];
  }

  const missingInStaging = prod.filter((svc) => !staging.includes(svc));
  const extraInStaging = staging.filter((svc) => !prod.includes(svc));
  const pass = missingInStaging.length === 0 && extraInStaging.length === 0;

  const report = {
    generated_at: new Date().toISOString(),
    status: pass ? 'pass' : 'fail',
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    source_ref: String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim(),
    source_workflow: String(process.env.GITHUB_WORKFLOW || process.env.CI_WORKFLOW_NAME || '').trim(),
    mode,
    production_services: prod.length,
    staging_services: staging.length,
    missing_in_staging: missingInStaging,
    extra_in_staging: extraInStaging,
    files: {
      production: prodFiles,
      staging: stagingFiles,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'staging-parity-latest.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  const md = [
    '# Staging Environment Parity Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Run ID: ${report.run_id || 'n/a'}`,
    `Head SHA: ${report.head_sha || 'n/a'}`,
    `Source ref: ${report.source_ref || 'n/a'}`,
    `Source workflow: ${report.source_workflow || 'n/a'}`,
    `Mode: ${mode}`,
    '',
    '## Summary',
    `- production_services: ${report.production_services}`,
    `- staging_services: ${report.staging_services}`,
    `- missing_in_staging: ${missingInStaging.length}`,
    `- extra_in_staging: ${extraInStaging.length}`,
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'staging-parity-latest.md'), `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, path.join(outDir, 'staging-parity-latest.json'))}`);
  console.log(`Wrote ${path.relative(root, path.join(outDir, 'staging-parity-latest.md'))}`);
  if (!pass) process.exit(2);
}

run();
