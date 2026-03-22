#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const apiUrlRaw = String(process.env.STAGING_API_URL || process.env.API_URL || '').trim();

function normalizeBase(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

function httpGetJson(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += String(chunk || '');
      });
      res.on('end', () => {
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch {
          json = null;
        }
        resolve({
          ok: true,
          statusCode: res.statusCode || 0,
          body: json,
          raw,
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        ok: false,
        statusCode: 0,
        error: String(err && err.message ? err.message : err || 'request error'),
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function run() {
  const base = normalizeBase(apiUrlRaw);
  const checks = [];

  checks.push({
    id: 'staging_api_url_present',
    pass: Boolean(base),
    detail: base ? base : 'missing STAGING_API_URL/API_URL',
  });

  if (!base) {
    const report = {
      generated_at: new Date().toISOString(),
      environment: 'staging',
      status: 'fail',
      checks,
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'staging-live-health-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'staging-live-health-latest.md'),
      `# Staging Live Health Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
        .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
        .join('\n')}\n`,
      'utf8',
    );
    if (strict) process.exit(2);
    return;
  }

  const health = await httpGetJson(`${base}/healthz`, 5000);
  const healthPass =
    health.ok &&
    health.statusCode === 200 &&
    health.body &&
    typeof health.body === 'object' &&
    String(health.body.status || '').toLowerCase() === 'healthy';
  checks.push({
    id: 'staging_healthz_healthy',
    pass: healthPass,
    detail: health.ok
      ? `status=${health.statusCode} body.status=${String((health.body && health.body.status) || '') || '(missing)'}`
      : `request_error=${health.error || 'unknown'}`,
  });

  const auth = await httpGetJson(`${base}/v1/auth/me`, 5000);
  const authPass = auth.ok && [200, 401, 403].includes(auth.statusCode);
  checks.push({
    id: 'staging_auth_surface_reachable',
    pass: authPass,
    detail: auth.ok ? `status=${auth.statusCode}` : `request_error=${auth.error || 'unknown'}`,
  });

  const report = {
    generated_at: new Date().toISOString(),
    environment: 'staging',
    api_url: base,
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'staging-live-health-latest.json');
  const outMd = path.join(outDir, 'staging-live-health-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Staging Live Health Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson).replace(/\\/g, '/')}`);
  console.log(`Wrote ${path.relative(root, outMd).replace(/\\/g, '/')}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

