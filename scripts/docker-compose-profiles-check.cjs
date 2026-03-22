#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function listServices(files, profiles) {
  const fileArgs = files.map((f) => `-f ${f}`).join(' ');
  const profileArgs = profiles.map((profile) => `--profile ${profile}`).join(' ');
  const cmd = `docker compose ${fileArgs} ${profileArgs} config --services`;
  const raw = execSync(cmd, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SEARXNG_SECRET: process.env.SEARXNG_SECRET || 'local-check-searxng-secret',
      GRAFANA_ADMIN_PASSWORD: process.env.GRAFANA_ADMIN_PASSWORD || 'local-check-grafana-password',
      LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY || 'local-check-litellm-master-key',
      SVEN_ADAPTER_TOKEN: process.env.SVEN_ADAPTER_TOKEN || 'local-check-adapter-token',
    },
  }).toString('utf8');
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function run() {
  const requiredFiles = [
    'docker-compose.yml',
    'docker-compose.profiles.yml',
    'docker-compose.dev.yml',
    'docker-compose.staging.yml',
    'docker-compose.production.yml',
  ];
  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

  let baseDev = [];
  let baseAdapters = [];
  let dev = [];
  let staging = [];
  let production = [];
  let devAdapters = [];
  let stagingAdapters = [];
  let productionAdapters = [];
  let commandError = null;

  try {
    baseDev = listServices(['docker-compose.yml'], ['dev']);
    baseAdapters = listServices(['docker-compose.yml'], ['adapters']);
    dev = listServices(['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.dev.yml'], ['dev']);
    staging = listServices(['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.staging.yml'], ['staging']);
    production = listServices(['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.production.yml'], ['production']);
    devAdapters = listServices(['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.dev.yml'], ['dev', 'adapters']);
    stagingAdapters = listServices(['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.staging.yml'], ['staging', 'adapters']);
    productionAdapters = listServices(['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.production.yml'], ['production', 'adapters']);
  } catch (error) {
    commandError = error instanceof Error ? error.message : String(error);
  }

  const expectedDev = baseDev;
  const expectedAdapters = baseAdapters;
  const envRowsDev = [
    { name: 'dev', list: dev },
    { name: 'staging', list: staging },
    { name: 'production', list: production },
  ];
  const envRowsAdapters = [
    { name: 'dev.adapters', list: devAdapters },
    { name: 'staging.adapters', list: stagingAdapters },
    { name: 'production.adapters', list: productionAdapters },
  ];

  const devProfileParityViolations = [];
  for (const row of envRowsDev) {
    if (row.list.length === 0) {
      devProfileParityViolations.push(`${row.name}:no_services`);
      continue;
    }
    const missing = expectedDev.filter((svc) => !row.list.includes(svc));
    const extra = row.list.filter((svc) => !expectedDev.includes(svc));
    if (missing.length) devProfileParityViolations.push(`${row.name}:missing:${missing.join(',')}`);
    if (extra.length) devProfileParityViolations.push(`${row.name}:extra:${extra.join(',')}`);
  }

  const adapterProfileParityViolations = [];
  for (const row of envRowsAdapters) {
    if (row.list.length === 0) {
      adapterProfileParityViolations.push(`${row.name}:no_services`);
      continue;
    }
    const missing = expectedAdapters.filter((svc) => !row.list.includes(svc));
    const extra = row.list.filter((svc) => !expectedAdapters.includes(svc));
    if (missing.length) adapterProfileParityViolations.push(`${row.name}:missing:${missing.join(',')}`);
    if (extra.length) adapterProfileParityViolations.push(`${row.name}:extra:${extra.join(',')}`);
  }

  const checks = [
    {
      id: 'required_profile_compose_files_present',
      pass: missingFiles.length === 0,
      detail: missingFiles.length ? missingFiles.join(', ') : requiredFiles.join(', '),
    },
    {
      id: 'docker_compose_profile_resolution_succeeds',
      pass: commandError === null,
      detail: commandError || 'docker compose config --services succeeded for dev/staging/production profiles',
    },
    {
      id: 'profile_service_sets_match_base_dev',
      pass: commandError === null && devProfileParityViolations.length === 0,
      detail: devProfileParityViolations.length
        ? devProfileParityViolations.join(' | ')
        : `base_dev=${expectedDev.length}, dev=${dev.length}, staging=${staging.length}, production=${production.length}`,
    },
    {
      id: 'profile_service_sets_match_base_adapters',
      pass: commandError === null && adapterProfileParityViolations.length === 0,
      detail: adapterProfileParityViolations.length
        ? adapterProfileParityViolations.join(' | ')
        : `base_adapters=${expectedAdapters.length}, dev_adapters=${devAdapters.length}, staging_adapters=${stagingAdapters.length}, production_adapters=${productionAdapters.length}`,
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((check) => !check.pass) ? 'fail' : 'pass',
    checks,
    counts: {
      base_dev: baseDev.length,
      base_adapters: baseAdapters.length,
      dev: dev.length,
      staging: staging.length,
      production: production.length,
      dev_adapters: devAdapters.length,
      staging_adapters: stagingAdapters.length,
      production_adapters: productionAdapters.length,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'docker-compose-profiles-latest.json');
  const outMd = path.join(outDir, 'docker-compose-profiles-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Docker Compose Profiles Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Counts',
    `- base_dev: ${report.counts.base_dev}`,
    `- base_adapters: ${report.counts.base_adapters}`,
    `- dev: ${report.counts.dev}`,
    `- staging: ${report.counts.staging}`,
    `- production: ${report.counts.production}`,
    `- dev_adapters: ${report.counts.dev_adapters}`,
    `- staging_adapters: ${report.counts.staging_adapters}`,
    `- production_adapters: ${report.counts.production_adapters}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
