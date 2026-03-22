#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

function parseEnvTemplateKeys(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return new Set();
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const keys = new Set();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (key) keys.add(key);
  }
  return keys;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function parseComposeAdapterEnvVars(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return [];
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  let inServices = false;
  let currentService = null;
  const adapterVars = new Set();
  for (const line of lines) {
    if (!inServices) {
      if (/^services:\s*$/.test(line)) inServices = true;
      continue;
    }
    const svcMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (svcMatch) {
      currentService = svcMatch[1];
      continue;
    }
    if (!currentService || !currentService.startsWith('adapter-')) continue;
    const matches = [...line.matchAll(/\$\{([A-Z0-9_]+)(?::[^}]*)?\}/g)];
    for (const match of matches) adapterVars.add(match[1]);
  }
  return Array.from(adapterVars).sort();
}

function gitTrackedDotEnvFiles() {
  const result = spawnSync(
    'git',
    ['ls-files', '--', '.env', '**/.env', '.env.*', '**/.env.*'],
    { cwd: root, encoding: 'utf8' }
  );
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (rel) =>
        !/\.env(?:\.[^.]+)*\.(example|sample)$/i.test(rel),
    );
}

function scanReleaseStatusForSecretLeaks() {
  const statusRoot = path.join(root, 'docs', 'release', 'status');
  if (!fs.existsSync(statusRoot)) return [];
  const files = listFiles(statusRoot).filter((full) => /\.(json|md|log|txt)$/i.test(full));
  const suspicious = [];
  const patterns = [
    /(?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{10,}/gi,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /sk-[A-Za-z0-9]{16,}/g,
  ];

  for (const full of files) {
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const body = fs.readFileSync(full, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(body)) {
        suspicious.push(rel);
        break;
      }
    }
  }
  return suspicious;
}

function run() {
  const scopedContracts = [
    'config/env/dev.required.json',
    'config/env/staging.required.json',
    'config/env/prod.required.json',
  ];
  const workflows = listFiles(path.join(root, '.github', 'workflows'))
    .map((full) => path.relative(root, full).replace(/\\/g, '/'));
  const workflowBodies = workflows.map((rel) => fs.readFileSync(path.join(root, rel), 'utf8')).join('\n');
  const docsInventory = 'docs/security/secrets-inventory-2026.md';
  const docsRotation = 'docs/ops/key-rotation-and-propagation-runbook-2026.md';

  const trackedDotEnv = gitTrackedDotEnvFiles();
  const leakedArtifacts = scanReleaseStatusForSecretLeaks();

  const envContracts = scopedContracts.map((rel) => ({ rel, body: readJson(rel) }));
  const runtimeAuthSecretKeys = ['COOKIE_SECRET'];
  const forbiddenLegacyAuthSecretKeys = ['JWT_SECRET', 'SESSION_SECRET'];
  const canonicalEnvTemplate = '.env.example';
  const canonicalEnvKeys = parseEnvTemplateKeys(canonicalEnvTemplate);
  const composeAdapterVars = parseComposeAdapterEnvVars('docker-compose.yml');
  const envTemplateByEnvironment = {
    dev: 'config/env/.env.development.example',
    staging: 'config/env/.env.staging.example',
    prod: 'config/env/.env.production.example',
  };
  const missingCanonicalAdapterVars = composeAdapterVars.filter((key) => !canonicalEnvKeys.has(key));
  const requiredSecretTemplateCoverage = envContracts.map((contract) => {
    const envName = String(contract.body?.environment || '').trim().toLowerCase();
    const templateRel = envTemplateByEnvironment[envName];
    const templateKeys = templateRel ? parseEnvTemplateKeys(templateRel) : new Set();
    const required = Array.isArray(contract.body?.required_secrets) ? contract.body.required_secrets : [];
    const missing = required.filter((key) => !templateKeys.has(String(key)));
    return { envName, templateRel, missing };
  });
  const scopedTemplateAdapterCoverage = Object.entries(envTemplateByEnvironment).map(([envName, templateRel]) => {
    const templateKeys = parseEnvTemplateKeys(templateRel);
    const missing = composeAdapterVars.filter((key) => !templateKeys.has(key));
    return { envName, templateRel, missing };
  });

  const checks = [
    {
      id: 'scoped_secret_contract_files_present',
      pass: envContracts.every((c) => Array.isArray(c.body.required_secrets) && c.body.required_secrets.length > 0),
      detail: scopedContracts.join(', '),
    },
    {
      id: 'prod_has_superset_of_staging',
      pass: envContracts[1].body.required_secrets.every((name) => envContracts[2].body.required_secrets.includes(name)),
      detail: 'prod.required includes all staging.required secrets',
    },
    {
      id: 'required_secret_contracts_align_runtime_auth_secret',
      pass: envContracts.every((contract) => {
        const required = Array.isArray(contract.body?.required_secrets) ? contract.body.required_secrets : [];
        return (
          runtimeAuthSecretKeys.every((key) => required.includes(key)) &&
          forbiddenLegacyAuthSecretKeys.every((key) => !required.includes(key))
        );
      }),
      detail: `contracts require ${runtimeAuthSecretKeys.join(', ')} and exclude legacy ${forbiddenLegacyAuthSecretKeys.join(', ')}`,
    },
    {
      id: 'required_secrets_present_in_env_templates',
      pass: requiredSecretTemplateCoverage.every((entry) => entry.templateRel && entry.missing.length === 0),
      detail: requiredSecretTemplateCoverage
        .map((entry) => {
          if (!entry.templateRel) return `${entry.envName}:missing-template-map`;
          if (entry.missing.length === 0) return `${entry.envName}:ok`;
          return `${entry.envName}:missing(${entry.missing.join(',')})`;
        })
        .join('; '),
    },
    {
      id: 'compose_adapter_env_vars_present_in_canonical_template',
      pass: missingCanonicalAdapterVars.length === 0,
      detail: missingCanonicalAdapterVars.length
        ? `missing-from-${canonicalEnvTemplate}(${missingCanonicalAdapterVars.join(',')})`
        : `${canonicalEnvTemplate}:adapter-vars-covered(${composeAdapterVars.length})`,
    },
    {
      id: 'compose_adapter_env_vars_present_in_scoped_templates',
      pass: scopedTemplateAdapterCoverage.every((entry) => entry.missing.length === 0),
      detail: scopedTemplateAdapterCoverage
        .map((entry) => {
          if (entry.missing.length === 0) return `${entry.envName}:ok`;
          return `${entry.envName}:missing(${entry.missing.join(',')})`;
        })
        .join('; '),
    },
    {
      id: 'no_committed_dotenv_secrets',
      pass: trackedDotEnv.length === 0,
      detail: trackedDotEnv.length ? trackedDotEnv.join(', ') : 'no tracked .env files',
    },
    {
      id: 'ci_uses_secret_context',
      pass: workflowBodies.includes('${{ secrets.'),
      detail: '.github/workflows includes secrets context usage',
    },
    {
      id: 'secrets_inventory_doc_present',
      pass: fs.existsSync(path.join(root, docsInventory)),
      detail: docsInventory,
    },
    {
      id: 'key_rotation_runbook_present',
      pass: fs.existsSync(path.join(root, docsRotation)),
      detail: docsRotation,
    },
    {
      id: 'no_secret_leakage_in_release_status_artifacts',
      pass: leakedArtifacts.length === 0,
      detail: leakedArtifacts.length ? leakedArtifacts.join(', ') : 'no suspicious patterns found in docs/release/status',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    contracts: envContracts.map((c) => ({
      environment: c.body.environment,
      required_secret_count: c.body.required_secrets.length,
    })),
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'env-secrets-management-latest.json');
  const outMd = path.join(outDir, 'env-secrets-management-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Environment and Secrets Management Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Environment Secret Contracts',
    ...report.contracts.map((c) => `- ${c.environment}: ${c.required_secret_count} required secrets`),
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
