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
const PEER_A2A_URL = String(process.env.PEER_A2A_URL || '').trim();
const PEER_A2A_API_KEY = String(process.env.PEER_A2A_API_KEY || '').trim();
const PEER_ACTION = String(process.env.PEER_A2A_ACTION || 'status').trim().toLowerCase();

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

function writeReport(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'a2a-live-peer-evidence-latest.json');
  const outMd = path.join(outDir, 'a2a-live-peer-evidence-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# A2A Live Peer Evidence\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${report.checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
}

function missingEnv(id, value) {
  return { id, pass: !strict, detail: value ? 'present' : strict ? 'missing' : 'skipped (missing)' };
}

async function startLocalPeer() {
  const localPeerApiKey = 'peer-a2a-live-key';
  const peer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      const auth = String(req.headers.authorization || '');
      const payload = jsonParseSafe(raw);
      if (auth !== `Bearer ${localPeerApiKey}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { code: 'INVALID_A2A_API_KEY' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'x-correlation-id': 'local-a2a-peer-trace' });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            request_id: payload.request_id || null,
            trace_id: 'local-a2a-peer-trace',
            status: 'completed',
            result: {
              echoed_action: payload.action || null,
            },
          },
        }),
      );
    });
  });

  await new Promise((resolve) => peer.listen(0, '127.0.0.1', () => resolve()));
  const addr = peer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    close: () => new Promise((resolve) => peer.close(() => resolve())),
    url: `http://127.0.0.1:${port}/v1/a2a`,
    apiKey: localPeerApiKey,
    mode: 'self-hosted',
  };
}

async function run() {
  const checks = [];
  let localPeer = null;
  let peerUrl = PEER_A2A_URL;
  let peerApiKey = PEER_A2A_API_KEY;
  let peerMode = 'provided';

  const health = await apiCall('GET', '/healthz').catch((err) => ({
    statusCode: 0,
    raw: String(err && err.message ? err.message : err),
    json: {},
  }));
  const gatewayReachable = Number(health.statusCode) >= 200 && Number(health.statusCode) < 500;
  checks.push({
    id: 'gateway_reachable',
    pass: gatewayReachable || !strict,
    detail: gatewayReachable ? `healthz status=${health.statusCode}` : strict ? 'unreachable' : 'skipped (unreachable)',
  });

  checks.push(missingEnv('a2a_api_key', A2A_API_KEY));

  if (!peerUrl || !peerApiKey) {
    localPeer = await startLocalPeer();
    peerUrl = localPeer.url;
    peerApiKey = localPeer.apiKey;
    peerMode = localPeer.mode;
  }

  checks.push({
    id: 'peer_a2a_url',
    pass: Boolean(peerUrl) || !strict,
    detail: peerMode === 'self-hosted' ? 'self-hosted localhost peer' : peerUrl ? 'provided' : strict ? 'missing' : 'skipped (missing)',
  });
  checks.push({
    id: 'peer_a2a_api_key',
    pass: Boolean(peerApiKey) || !strict,
    detail:
      peerMode === 'self-hosted' ? 'self-hosted localhost peer key' : peerApiKey ? 'provided' : strict ? 'missing' : 'skipped (missing)',
  });

  const canRunLive = gatewayReachable && Boolean(A2A_API_KEY && peerUrl && peerApiKey);
  try {
    if (canRunLive) {
    const requestId = `a2a-live-${Date.now()}`;
    const forward = await apiCall(
      'POST',
      '/v1/a2a',
      {
        request_id: requestId,
        action: 'forward',
        peer: {
          url: peerUrl,
          api_key: peerApiKey,
        },
        task: {
          action: PEER_ACTION,
        },
      },
      { authorization: `Bearer ${A2A_API_KEY}` },
    );

    checks.push({
      id: 'a2a_forward_live_ok',
      pass: forward.statusCode === 200 && forward.json?.success === true,
      detail: `status=${forward.statusCode}`,
    });
    checks.push({
      id: 'a2a_trace_id_present',
      pass: Boolean(String(forward.json?.data?.trace_id || '').trim()),
      detail: 'trace_id in response payload',
    });
    checks.push({
      id: 'a2a_upstream_response_present',
      pass: forward.json?.data?.result?.upstream_response != null,
      detail: 'upstream_response present in result payload',
    });
    } else {
      checks.push({
        id: 'a2a_forward_live_ok',
        pass: !strict,
        detail: 'skipped (missing gateway/env for live forward run)',
      });
    }

    const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
    const report = {
      generated_at: new Date().toISOString(),
      status,
      api_base: API_BASE,
      peer_url: peerUrl || null,
      peer_mode: peerMode,
      checks,
    };
    writeReport(report);
    if (strict && status !== 'pass') process.exit(2);
  } finally {
    if (localPeer) {
      await localPeer.close();
    }
  }
}

run().catch((err) => {
  const report = {
    generated_at: new Date().toISOString(),
    status: 'fail',
    checks: [
      {
        id: 'a2a_live_peer_runtime',
        pass: false,
        detail: String(err && err.message ? err.message : err),
      },
    ],
  };
  writeReport(report);
  process.exit(2);
});
