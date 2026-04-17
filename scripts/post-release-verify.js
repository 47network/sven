import fs from 'node:fs';
import path from 'node:path';

const RAW_API_URL = String(process.env.API_URL || '').trim();
const DATABASE_URL = process.env.DATABASE_URL || '';
const strict = process.argv.includes('--strict');
const OUT_DIR = path.join(process.cwd(), 'docs', 'release', 'status');
const now = new Date();
const RELEASE_ENVIRONMENT = String(process.env.RELEASE_ENVIRONMENT || process.env.SVEN_RELEASE_ENVIRONMENT || '').trim();
const CI_LIKE = String(process.env.CI || '').trim().toLowerCase() === 'true'
  || String(process.env.GITHUB_ACTIONS || '').trim().toLowerCase() === 'true';

function check(name, status, details = {}) {
  return { name, status, details };
}

function resolveApiUrlOrThrow() {
  if (!RAW_API_URL) {
    throw new Error('API_URL is required for post-release verification (no implicit default).');
  }
  return RAW_API_URL.replace(/\/+$/, '');
}

function isLocalTarget(apiUrl) {
  try {
    const host = new URL(apiUrl).hostname.toLowerCase();
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

function deriveTargetEnvironment(apiUrl) {
  if (RELEASE_ENVIRONMENT) return RELEASE_ENVIRONMENT;
  try {
    const host = new URL(apiUrl).hostname.toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost') return 'local';
    if (host === 'app.sven.example.com' || host === 'app.sven.systems') return 'production';
    return 'custom';
  } catch {
    return 'custom';
  }
}

function isProtectedDeploymentTarget(targetEnvironment) {
  return targetEnvironment === 'production' || targetEnvironment === 'staging';
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { ok: response.ok, status: response.status, body };
}

async function run() {
  const API_URL = resolveApiUrlOrThrow();
  const targetEnvironment = deriveTargetEnvironment(API_URL);
  const failOnWarn = strict && isProtectedDeploymentTarget(targetEnvironment);
  if (CI_LIKE && isProtectedDeploymentTarget(targetEnvironment) && isLocalTarget(API_URL)) {
    throw new Error(`Invalid API_URL for ${targetEnvironment} CI verification: local target (${API_URL}) is not allowed.`);
  }
  const checks = [];
  checks.push(check('api_url_explicit', 'pass', { api_url: API_URL }));
  checks.push(check('target_environment_present', targetEnvironment ? 'pass' : 'fail', { target_environment: targetEnvironment || '(missing)' }));
  checks.push(
    check(
      'production_target_not_local_in_ci',
      !(CI_LIKE && isProtectedDeploymentTarget(targetEnvironment) && isLocalTarget(API_URL)) ? 'pass' : 'fail',
      { ci_like: CI_LIKE, target_environment: targetEnvironment, api_url: API_URL },
    ),
  );

  try {
    const health = await fetchJson(`${API_URL}/healthz`);
    checks.push(check('gateway_healthz', health.ok ? 'pass' : 'fail', { status: health.status }));
  } catch (err) {
    checks.push(check('gateway_healthz', 'fail', { error: String(err) }));
  }

  try {
    const ready = await fetchJson(`${API_URL}/readyz`);
    checks.push(check('gateway_readyz', ready.ok ? 'pass' : 'fail', { status: ready.status }));
  } catch (err) {
    checks.push(check('gateway_readyz', 'fail', { error: String(err) }));
  }

  if (!DATABASE_URL) {
    checks.push(
      check('database_metrics', failOnWarn ? 'fail' : 'warn', {
        message: 'DATABASE_URL not set; queue/error/approval DB checks were skipped',
      }),
    );
  } else {
    const pg = await import('pg');
    const PgClient = pg.default?.Client || pg.Client;
    const client = new PgClient({ connectionString: DATABASE_URL });
    try {
      await client.connect();

      const outboxPending = await client.query(
        `SELECT COUNT(*)::int AS count, COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))),0)::int AS oldest_age_seconds
         FROM outbox
         WHERE status = 'pending'`,
      );
      const pending = Number(outboxPending.rows[0]?.count || 0);
      const oldestAge = Number(outboxPending.rows[0]?.oldest_age_seconds || 0);
      checks.push(
        check('outbox_queue_lag', pending <= 50 && oldestAge <= 300 ? 'pass' : (failOnWarn ? 'fail' : 'warn'), {
          pending_count: pending,
          oldest_pending_age_seconds: oldestAge,
        }),
      );

      const approvalsPending = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM approvals
         WHERE status = 'pending'`,
      );
      checks.push(
        check('approval_pipeline', Number(approvalsPending.rows[0]?.count || 0) <= 100 ? 'pass' : (failOnWarn ? 'fail' : 'warn'), {
          pending_approvals: Number(approvalsPending.rows[0]?.count || 0),
        }),
      );

      try {
        const relayErrors = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM browser_relay_commands
           WHERE status IN ('error', 'denied')
             AND created_at > NOW() - interval '15 minutes'`,
        );
        checks.push(
          check('relay_error_rate_15m', Number(relayErrors.rows[0]?.count || 0) <= 5 ? 'pass' : (failOnWarn ? 'fail' : 'warn'), {
            relay_errors_15m: Number(relayErrors.rows[0]?.count || 0),
          }),
        );
      } catch (err) {
        const code = String((err && typeof err === 'object' && 'code' in err ? err.code : '') || '');
        if (code === '42P01') {
          checks.push(
            check('relay_error_rate_15m', 'pass', {
              skipped: true,
              message: 'browser_relay_commands table not present in this migration baseline',
            }),
          );
        } else {
          throw err;
        }
      }
    } catch (err) {
      checks.push(check('database_metrics', 'fail', { error: String(err) }));
    } finally {
      await client.end().catch(() => {});
    }
  }

  const failed = checks.filter((item) => item.status === 'fail').length;
  const warned = checks.filter((item) => item.status === 'warn').length;
  const summary = {
    generated_at: now.toISOString(),
    api_url: API_URL,
    target_environment: targetEnvironment,
    api_url_explicit: true,
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    strict_mode: strict,
    fail_on_warn: failOnWarn,
    checks,
    status: failed > 0 ? 'fail' : warned > 0 ? (failOnWarn ? 'fail' : 'warn') : 'pass',
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'post-release-verification-latest.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  const lines = [
    '# Post-Release Verification Snapshot',
    '',
    `Generated: ${summary.generated_at}`,
    `API URL: ${API_URL}`,
    `Target environment: ${summary.target_environment}`,
    `API URL explicit: yes`,
    `Overall status: ${summary.status.toUpperCase()}`,
    '',
  ];
  for (const item of checks) {
    lines.push(`- [${item.status.toUpperCase()}] ${item.name}: ${JSON.stringify(item.details)}`);
  }
  lines.push('');
  fs.writeFileSync(path.join(OUT_DIR, 'post-release-verification-latest.md'), `${lines.join('\n')}\n`);

  console.log(JSON.stringify(summary, null, 2));
  if (failed > 0) {
    process.exit(1);
  }
  if (failOnWarn && warned > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
