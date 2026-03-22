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
const MCP_SERVER_TOKEN = String(process.env.TEST_MCP_SERVER_TOKEN || process.env.SVEN_MCP_SERVER_TOKEN || '').trim();

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
  const outJson = path.join(outDir, 'mcp-server-http-smoke-latest.json');
  const outMd = path.join(outDir, 'mcp-server-http-smoke-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# MCP Server HTTP Smoke\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${report.checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
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

  const unauthGet = await apiCall('GET', '/v1/mcp');
  checks.push({
    id: 'mcp_get_requires_token',
    pass: unauthGet.statusCode === 401,
    detail: `status=${unauthGet.statusCode}`,
  });

  if (!MCP_SERVER_TOKEN) {
    checks.push({
      id: 'mcp_token_present',
      pass: !strict,
      detail: strict
        ? 'missing TEST_MCP_SERVER_TOKEN (or SVEN_MCP_SERVER_TOKEN)'
        : 'skipped auth checks (set TEST_MCP_SERVER_TOKEN or SVEN_MCP_SERVER_TOKEN)',
    });
  } else {
    const authHeaders = { authorization: `Bearer ${MCP_SERVER_TOKEN}` };

    const authGet = await apiCall('GET', '/v1/mcp?limit=25', undefined, authHeaders);
    checks.push({
      id: 'mcp_get_tools_ok',
      pass: authGet.statusCode === 200 && Array.isArray(authGet.json?.result?.tools),
      detail: `status=${authGet.statusCode}`,
    });

    const initialize = await apiCall(
      'POST',
      '/v1/mcp',
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      authHeaders,
    );
    checks.push({
      id: 'mcp_post_initialize_ok',
      pass: initialize.statusCode === 200 && String(initialize.json?.result?.serverInfo?.name || '').length > 0,
      detail: `status=${initialize.statusCode}`,
    });

    const list = await apiCall(
      'POST',
      '/v1/mcp',
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      authHeaders,
    );
    checks.push({
      id: 'mcp_post_tools_list_ok',
      pass: list.statusCode === 200 && Array.isArray(list.json?.result?.tools),
      detail: `status=${list.statusCode}`,
    });

    const call = await apiCall(
      'POST',
      '/v1/mcp',
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'sven.time.now', arguments: {} },
      },
      authHeaders,
    );
    checks.push({
      id: 'mcp_post_tools_call_ok',
      pass: call.statusCode === 200 && Array.isArray(call.json?.result?.content),
      detail: `status=${call.statusCode}`,
    });
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
        id: 'mcp_http_smoke_runtime',
        pass: false,
        detail: String(err && err.message ? err.message : err),
      },
    ],
  };
  writeReport(report);
  process.exit(2);
});
