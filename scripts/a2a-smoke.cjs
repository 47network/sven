#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const API_BASE = String(process.env.API_URL || 'http://127.0.0.1:3001').trim().replace(/\/+$/, '');
const A2A_API_KEY = String(process.env.TEST_A2A_API_KEY || process.env.SVEN_A2A_API_KEY || '').trim();

function jsonParseSafe(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        method: opts.method || 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: opts.headers || {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += String(chunk);
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            raw,
            json: jsonParseSafe(raw),
          });
        });
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function apiCall(method, endpoint, body, headers = {}) {
  let payload = '';
  const reqHeaders = { ...headers };
  if (body !== undefined) {
    payload = JSON.stringify(body);
    reqHeaders['content-type'] = 'application/json';
    reqHeaders['content-length'] = String(Buffer.byteLength(payload));
  }
  return request(`${API_BASE}${endpoint}`, { method, headers: reqHeaders, body: payload });
}

function preview(res) {
  if (!res) return '';
  const raw = String(res.raw || '').trim();
  return raw.length > 280 ? `${raw.slice(0, 280)}...` : raw;
}

function writeReport(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'a2a-smoke-latest.json');
  const outMd = path.join(outDir, 'a2a-smoke-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# A2A Smoke\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${report.checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
}

async function runForwardCheck(checks) {
  const peerApiKey = 'peer-a2a-smoke-key';
  const peer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      const auth = String(req.headers.authorization || '');
      const payload = jsonParseSafe(raw);
      if (auth !== `Bearer ${peerApiKey}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { code: 'INVALID_A2A_API_KEY' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            request_id: payload.request_id || null,
            status: 'completed',
            result: { echoed_action: payload.action || null },
          },
        }),
      );
    });
  });

  await new Promise((resolve) => peer.listen(0, '127.0.0.1', () => resolve()));
  const addr = peer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const peerUrl = `http://127.0.0.1:${port}/v1/a2a`;

  try {
    const forward = await apiCall(
      'POST',
      '/v1/a2a',
      {
        request_id: 'a2a-smoke-forward-1',
        action: 'forward',
        peer: {
          url: peerUrl,
          api_key: peerApiKey,
        },
        task: { action: 'status' },
      },
      { authorization: `Bearer ${A2A_API_KEY}` },
    );

    checks.push({
      id: 'a2a_forward_ok',
      pass:
        forward.statusCode === 200 &&
        forward.json?.success === true &&
        forward.json?.data?.result?.upstream_response?.success === true,
      detail: `status=${forward.statusCode}`,
    });
  } finally {
    await new Promise((resolve) => peer.close(() => resolve()));
  }
}

async function run() {
  const checks = [];

  let health = null;
  try {
    health = await apiCall('GET', '/healthz');
  } catch (err) {
    health = { statusCode: 0, raw: String(err && err.message ? err.message : err), json: {} };
  }
  const reachable = Number(health.statusCode) >= 200 && Number(health.statusCode) < 500;
  checks.push({
    id: 'gateway_reachable',
    pass: reachable || !strict,
    detail: reachable
      ? `healthz status=${health.statusCode}`
      : strict
      ? `unreachable: ${preview(health) || 'connection failed'}`
      : `skipped (gateway unreachable: ${preview(health) || 'connection failed'})`,
  });

  if (!reachable) {
    const report = {
      generated_at: new Date().toISOString(),
      status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
      checks,
    };
    writeReport(report);
    if (strict && report.status !== 'pass') process.exit(2);
    return;
  }

  const unauth = await apiCall('POST', '/v1/a2a', { action: 'status' });
  checks.push({
    id: 'a2a_requires_api_key',
    pass: unauth.statusCode === 401,
    detail: `status=${unauth.statusCode}`,
  });

  if (!A2A_API_KEY) {
    checks.push({
      id: 'a2a_api_key_present',
      pass: !strict,
      detail: strict
        ? 'missing TEST_A2A_API_KEY (or SVEN_A2A_API_KEY)'
        : 'skipped auth checks (set TEST_A2A_API_KEY or SVEN_A2A_API_KEY)',
    });
  } else {
    const statusCall = await apiCall(
      'POST',
      '/v1/a2a',
      { request_id: 'a2a-smoke-1', action: 'status' },
      { authorization: `Bearer ${A2A_API_KEY}` },
    );
    checks.push({
      id: 'a2a_status_ok',
      pass: statusCall.statusCode === 200 && statusCall.json?.success === true,
      detail: `status=${statusCall.statusCode}`,
    });

    const toolsList = await apiCall(
      'POST',
      '/v1/a2a',
      { request_id: 'a2a-smoke-2', action: 'tools.list' },
      { authorization: `Bearer ${A2A_API_KEY}` },
    );
    checks.push({
      id: 'a2a_tools_list_ok',
      pass: toolsList.statusCode === 200 && Array.isArray(toolsList.json?.data?.result?.tools),
      detail: `status=${toolsList.statusCode}`,
    });

    await runForwardCheck(checks);
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    checks,
  };
  writeReport(report);
  if (strict && report.status !== 'pass') process.exit(2);
}

run().catch((err) => {
  const report = {
    generated_at: new Date().toISOString(),
    status: 'fail',
    checks: [
      {
        id: 'a2a_smoke_runtime',
        pass: false,
        detail: String(err && err.message ? err.message : err),
      },
    ],
  };
  writeReport(report);
  process.exit(2);
});
