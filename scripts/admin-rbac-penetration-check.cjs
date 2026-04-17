#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const API_BASE = process.env.API_URL || process.env.SVEN_APP_HOST || 'https://app.sven.systems';

const TARGETS = [
  '/v1/admin/approvals?status=pending&per_page=5',
  '/v1/admin/runs?per_page=5',
  '/v1/admin/incident/status',
  '/v1/admin/performance/metrics/summary',
];

function denied(status) {
  return status === 401 || status === 403;
}

async function probe(endpoint, cookie = '') {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: cookie ? { cookie } : {},
    });
    return { ok: denied(res.status), status: res.status };
  } catch (err) {
    return { ok: false, status: -1, error: String(err.message || err) };
  }
}

async function run() {
  const checks = [];
  for (const endpoint of TARGETS) {
    const unauth = await probe(endpoint);
    checks.push({
      id: `unauth_denied:${endpoint}`,
      pass: unauth.ok,
      detail: unauth.status >= 0 ? `status=${unauth.status}` : unauth.error,
    });

    const forged = await probe(endpoint, 'sven_session=00000000-0000-4000-8000-000000000000');
    checks.push({
      id: `forged_session_denied:${endpoint}`,
      pass: forged.ok,
      detail: forged.status >= 0 ? `status=${forged.status}` : forged.error,
    });
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'admin-rbac-penetration-latest.json');
  const outMd = path.join(outDir, 'admin-rbac-penetration-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Admin RBAC Penetration Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nAPI: ${report.api_base}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run().catch((err) => {
  console.error('RBAC penetration check failed:', err);
  process.exit(1);
});
