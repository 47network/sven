#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const STRICT_MODE = process.env.API_OBSERVABILITY_STRICT === '1';

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

async function apiCall(method, endpoint, body, opts) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (opts && opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts && opts.cookie) headers.cookie = opts.cookie;
  const started = Date.now();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const latency_ms = Date.now() - started;
  const text = await res.text().catch(() => '');
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data, latency_ms };
}

function summarizeRuns(runs) {
  const ok = runs.filter((r) => r.ok).length;
  const err = runs.length - ok;
  const latencies = runs.map((r) => r.latency_ms);
  return {
    requests: runs.length,
    success: ok,
    error: err,
    success_rate: runs.length ? Number((ok / runs.length).toFixed(4)) : 0,
    error_rate: runs.length ? Number((err / runs.length).toFixed(4)) : 0,
    latency_ms: {
      min: latencies.length ? Math.min(...latencies) : null,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? Math.max(...latencies) : null,
    },
  };
}

async function run() {
  const probes = [];
  const warnings = [];

  const healthRuns = [];
  for (let i = 0; i < 8; i += 1) {
    healthRuns.push(await apiCall('GET', '/healthz'));
  }
  probes.push({ endpoint: '/healthz', ...summarizeRuns(healthRuns) });

  if (TEST_SESSION_COOKIE) {
    const started = await apiCall('POST', '/v1/auth/device/start', {
      client_name: 'api-reliability-probe',
      client_type: 'ci',
      scope: 'chat approvals',
    });
    if (!started.ok) {
      warnings.push('Device flow start failed; user flow probes skipped.');
    } else {
      const deviceCode = String(started.data?.data?.device_code || '');
      const userCode = String(started.data?.data?.user_code || '');
      const confirmed = await apiCall(
        'POST',
        '/v1/auth/device/confirm',
        { user_code: userCode },
        { cookie: TEST_SESSION_COOKIE },
      );
      if (!confirmed.ok) {
        warnings.push('Device confirmation failed; user flow probes skipped.');
      } else {
        const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
        const token = String(tokenResp.data?.data?.access_token || '');
        if (!token) {
          warnings.push('Device token exchange did not return access token.');
        } else {
          const endpointDefs = [
            { key: '/v1/me', method: 'GET', path: '/v1/me' },
            { key: '/v1/chats', method: 'GET', path: '/v1/chats' },
            { key: '/v1/approvals?status=pending', method: 'GET', path: '/v1/approvals?status=pending' },
            { key: '/v1/auth/refresh', method: 'POST', path: '/v1/auth/refresh' },
          ];
          for (const def of endpointDefs) {
            const runs = [];
            let localToken = token;
            for (let i = 0; i < 6; i += 1) {
              const res = await apiCall(def.method, def.path, undefined, { bearer: localToken });
              runs.push(res);
              if (def.path === '/v1/auth/refresh' && res.ok) {
                localToken = String(res.data?.data?.access_token || localToken);
              }
            }
            probes.push({ endpoint: def.key, ...summarizeRuns(runs) });
          }
        }
      }
    }
  } else {
    warnings.push('TEST_SESSION_COOKIE not set; authenticated latency probes skipped.');
  }

  const hasHardFailure = probes.some(
    (p) => p.error_rate > 0.2 || (p.latency_ms.p95 !== null && p.latency_ms.p95 > 3000),
  );
  const hasNoHealthyProbe = probes.every((p) => p.success === 0);
  if (hasNoHealthyProbe) {
    warnings.push('No healthy probe responses observed (gateway may be offline in this environment).');
  }

  const nonBlockingWarningPatterns = [
    'TEST_SESSION_COOKIE not set; authenticated latency probes skipped.',
  ];
  const blockingWarnings = warnings.filter(
    (warning) => !nonBlockingWarningPatterns.some((pattern) => warning.includes(pattern)),
  );

  const status = hasHardFailure && (STRICT_MODE || !hasNoHealthyProbe)
    ? 'fail'
    : blockingWarnings.length > 0
      ? 'warn'
      : 'pass';

  const report = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    status,
    warnings,
    probes,
  };

  const outJson = path.join(process.cwd(), 'docs/release/status/api-reliability-observability-latest.json');
  const outMd = path.join(process.cwd(), 'docs/release/status/api-reliability-observability-latest.md');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const mdLines = [];
  mdLines.push('# API Reliability Observability');
  mdLines.push('');
  mdLines.push(`Generated: ${report.generated_at}`);
  mdLines.push(`API base: ${report.api_base}`);
  mdLines.push(`Status: ${report.status}`);
  mdLines.push('');
  if (warnings.length) {
    mdLines.push('## Warnings');
    for (const w of warnings) mdLines.push(`- ${w}`);
    mdLines.push('');
  }
  mdLines.push('## Probe Summary');
  for (const probe of probes) {
    mdLines.push(
      `- ${probe.endpoint}: success=${probe.success}/${probe.requests}, error_rate=${probe.error_rate}, p50=${probe.latency_ms.p50}ms, p95=${probe.latency_ms.p95}ms, p99=${probe.latency_ms.p99}ms`,
    );
  }
  mdLines.push('');
  fs.writeFileSync(outMd, `${mdLines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (status === 'fail') {
    process.exit(2);
  }
}

run().catch((err) => {
  console.error('Failed to run API reliability observability check:', err);
  process.exit(1);
});
