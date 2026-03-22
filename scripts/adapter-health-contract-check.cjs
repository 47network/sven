#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const NON_HTTP_PROBEABLE_ADAPTERS = new Set([
  'adapter-discord',
  'adapter-slack',
  'adapter-telegram',
  'adapter-matrix',
  'adapter-signal',
  'adapter-imessage',
]);

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function readComposeAdapters() {
  const composePath = path.join(root, 'docker-compose.yml');
  const raw = fs.readFileSync(composePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const services = new Map();
  let currentName = null;
  let currentBody = [];
  for (const line of lines) {
    const adapterMatch = line.match(/^  (adapter-[a-z0-9-]+):$/);
    const topLevelServiceMatch = line.match(/^  [a-z0-9][a-z0-9-]*:$/);
    if (adapterMatch) {
      if (currentName) services.set(currentName, currentBody.join('\n'));
      currentName = adapterMatch[1];
      currentBody = [];
      continue;
    }
    if (topLevelServiceMatch) {
      if (currentName) services.set(currentName, currentBody.join('\n'));
      currentName = null;
      currentBody = [];
      continue;
    }
    if (currentName) {
      currentBody.push(line);
    }
  }
  if (currentName) services.set(currentName, currentBody.join('\n'));
  return services;
}

function hasRuntimeHealthz(serviceName) {
  const serviceDir = path.join(root, 'services', serviceName);
  const entryPath = path.join(serviceDir, 'src', 'index.ts');
  if (!fs.existsSync(entryPath)) return false;
  const src = fs.readFileSync(entryPath, 'utf8');
  return src.includes('/healthz');
}

function listProfileServices(files, profiles) {
  const args = files.map((f) => `-f ${f}`).join(' ');
  const profileArgs = profiles.map((profile) => `--profile ${profile}`).join(' ');
  const cmd = `docker compose ${args} ${profileArgs} config --services`;
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
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function run() {
  const services = readComposeAdapters();
  const adapterServices = [...services.keys()].sort((a, b) => a.localeCompare(b));
  const servicesWithHealthcheck = adapterServices.filter((name) => services.get(name).includes('\n    healthcheck:'));
  const runtimeHealthzServices = adapterServices.filter((name) => hasRuntimeHealthz(name));

  const runtimeHealthzMissingHealthcheck = runtimeHealthzServices
    .filter((name) => !servicesWithHealthcheck.includes(name))
    .sort((a, b) => a.localeCompare(b));

  const missingHealthcheckNoPolicy = adapterServices
    .filter((name) => !servicesWithHealthcheck.includes(name) && !NON_HTTP_PROBEABLE_ADAPTERS.has(name))
    .sort((a, b) => a.localeCompare(b));

  const profileFiles = {
    base: ['docker-compose.yml'],
    dev: ['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.dev.yml'],
    staging: ['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.staging.yml'],
    production: ['docker-compose.yml', 'docker-compose.profiles.yml', 'docker-compose.production.yml'],
  };

  let profileError = null;
  let profileCoverageGaps = [];
  try {
    for (const [envName, files] of Object.entries(profileFiles)) {
      const profileMatrix = envName === 'base' ? ['adapters'] : [envName, 'adapters'];
      const resolved = listProfileServices(files, profileMatrix).filter((svc) => svc.startsWith('adapter-'));
      const uncovered = resolved.filter((svc) => {
        return !servicesWithHealthcheck.includes(svc) && !NON_HTTP_PROBEABLE_ADAPTERS.has(svc);
      });
      if (uncovered.length > 0) {
        profileCoverageGaps.push(`${envName}:missing:${uncovered.sort((a, b) => a.localeCompare(b)).join(',')}`);
      }
    }
  } catch (err) {
    profileError = err instanceof Error ? err.message : String(err);
  }

  const checks = [
    {
      id: 'adapter_services_present_in_compose',
      pass: adapterServices.length > 0,
      detail: `adapter_services=${adapterServices.length}`,
    },
    {
      id: 'runtime_healthz_adapters_have_compose_healthcheck',
      pass: runtimeHealthzMissingHealthcheck.length === 0,
      detail: runtimeHealthzMissingHealthcheck.length
        ? runtimeHealthzMissingHealthcheck.join(', ')
        : `covered=${runtimeHealthzServices.length}`,
    },
    {
      id: 'event_only_adapters_have_explicit_non_http_probe_policy',
      pass: missingHealthcheckNoPolicy.length === 0,
      detail: missingHealthcheckNoPolicy.length
        ? missingHealthcheckNoPolicy.join(', ')
        : [...NON_HTTP_PROBEABLE_ADAPTERS].sort((a, b) => a.localeCompare(b)).join(', '),
    },
    {
      id: 'adapter_profile_readiness_coverage',
      pass: profileError === null && profileCoverageGaps.length === 0,
      detail: profileError || (profileCoverageGaps.length ? profileCoverageGaps.join(' | ') : 'adapters profile coverage validated for base/dev/staging/production'),
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    strict_mode: strict,
    policy: {
      non_http_probeable_adapters: [...NON_HTTP_PROBEABLE_ADAPTERS].sort((a, b) => a.localeCompare(b)),
    },
    counts: {
      adapter_services: adapterServices.length,
      services_with_healthcheck: servicesWithHealthcheck.length,
      runtime_healthz_services: runtimeHealthzServices.length,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'adapter-health-contract-latest.json');
  const outMd = path.join(outDir, 'adapter-health-contract-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const md = [
    '# Adapter Health Contract Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Counts',
    `- adapter_services: ${report.counts.adapter_services}`,
    `- services_with_healthcheck: ${report.counts.services_with_healthcheck}`,
    `- runtime_healthz_services: ${report.counts.runtime_healthz_services}`,
    '',
    '## Policy',
    `- non_http_probeable_adapters: ${report.policy.non_http_probeable_adapters.join(', ')}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
