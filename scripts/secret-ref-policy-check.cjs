#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'secret-ref-policy-latest.json');
const outMd = path.join(outDir, 'secret-ref-policy-latest.md');

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function add(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });
}

function run() {
  const checks = [];
  const sharedSecrets = read('packages/shared/src/secrets.ts');
  const skillRunnerEnvRef = read('services/skill-runner/src/secret-env-ref.ts');
  const skillRunnerFileRef = read('services/skill-runner/src/secret-file-ref.ts');
  const notificationService = read('services/notification-service/src/index.ts');
  const masterChecklist = read('docs/Sven_Master_Checklist.md');

  add(
    checks,
    'skill_runner_env_ref_allowlist_enforced',
    skillRunnerEnvRef.includes('SVEN_SECRET_ENV_ALLOWLIST') && skillRunnerEnvRef.includes('enforceAllowlist'),
    'services/skill-runner/src/secret-env-ref.ts',
  );
  add(
    checks,
    'skill_runner_file_ref_allowlist_enforced',
    skillRunnerFileRef.includes('SVEN_SECRET_FILE_REF_ENABLED')
      && skillRunnerFileRef.includes('SVEN_SECRET_FILE_ALLOWLIST')
      && skillRunnerFileRef.includes('outside allowed roots'),
    'services/skill-runner/src/secret-file-ref.ts',
  );
  add(
    checks,
    'shared_secret_resolver_has_env_allowlist_policy',
    sharedSecrets.includes('SVEN_SECRET_ENV_ALLOWLIST')
      && sharedSecrets.includes('env:// secret ref key is not allowlisted'),
    'packages/shared/src/secrets.ts',
  );
  add(
    checks,
    'shared_secret_resolver_has_file_allowlist_policy',
    sharedSecrets.includes('SVEN_SECRET_FILE_REF_ENABLED')
      && sharedSecrets.includes('SVEN_SECRET_FILE_ALLOWLIST')
      && sharedSecrets.includes('outside allowed roots'),
    'packages/shared/src/secrets.ts',
  );
  add(
    checks,
    'notification_secret_resolver_has_env_allowlist_policy',
    notificationService.includes('SVEN_SECRET_ENV_ALLOWLIST')
      && notificationService.includes('env:// secret ref key is not allowlisted'),
    'services/notification-service/src/index.ts',
  );
  add(
    checks,
    'notification_secret_resolver_has_file_allowlist_policy',
    notificationService.includes('SVEN_SECRET_FILE_REF_ENABLED')
      && notificationService.includes('SVEN_SECRET_FILE_ALLOWLIST')
      && notificationService.includes('outside allowed roots'),
    'services/notification-service/src/index.ts',
  );
  add(
    checks,
    'master_checklist_secret_policy_wording_present',
    masterChecklist.includes('`env://`/`file://` are policy-gated'),
    'docs/Sven_Master_Checklist.md',
  );

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    strict,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Secret Ref Policy Check',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
