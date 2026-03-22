#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const dns = require('node:dns').promises;
const net = require('node:net');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const writeLatestAlias = process.env.SVEN_LEGAL_WRITE_LATEST_ALIAS !== '0';

function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }
function safeHost(host) { return String(host || 'unknown').replace(/[^A-Za-z0-9.-]/g, '_'); }
function writeAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function requestUrl(url, method = 'HEAD', timeoutMs = 15000) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      resolve({
        ok: false,
        status: 0,
        location: null,
        error: `invalid_url:${err.message}`,
        method,
      });
      return;
    }

    const scheme = parsed.protocol.toLowerCase();
    const transport = scheme === 'http:' ? http : (scheme === 'https:' ? https : null);
    if (!transport) {
      resolve({
        ok: false,
        status: 0,
        location: null,
        error: `unsupported_protocol:${scheme}`,
        method,
      });
      return;
    }

    const req = transport.request(parsed, { method, timeout: timeoutMs }, (res) => {
      const status = res.statusCode || 0;
      const location = res.headers.location || null;
      resolve({
        ok: status >= 200 && status < 400,
        status,
        location,
        error: null,
        method,
      });
      req.destroy();
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => {
      resolve({
        ok: false,
        status: 0,
        location: null,
        error: err.message,
        method,
      });
    });
    req.end();
  });
}

async function checkHttp(url, timeoutMs = 15000) {
  const head = await requestUrl(url, 'HEAD', timeoutMs);
  if (head.ok) return head;
  const get = await requestUrl(url, 'GET', timeoutMs);
  if (get.ok) return get;
  return {
    ...head,
    error: head.error || get.error,
    detail: `head=${head.error || head.status}; get=${get.error || get.status}`,
  };
}

async function resolveHost(hostname) {
  try {
    const records = await dns.lookup(hostname, { all: true });
    return {
      ok: records.length > 0,
      records: records.map((r) => `${r.address}/IPv${r.family}`),
      error: null,
    };
  } catch (err) {
    return { ok: false, records: [], error: err.message };
  }
}

function checkTcp(hostname, port = 443, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done({ ok: true, error: null }));
    socket.on('timeout', () => done({ ok: false, error: 'timeout' }));
    socket.on('error', (err) => done({ ok: false, error: err.message }));
  });
}

async function run() {
  const base = process.env.SVEN_LEGAL_BASE_URL || process.env.API_URL || process.env.SVEN_APP_HOST || 'https://app.sven.systems:44747';
  const parsedBase = new URL(base);
  const basePort = Number(parsedBase.port || (parsedBase.protocol === 'http:' ? 80 : 443));
  const privacyUrl = `${base.replace(/\/$/, '')}/privacy`;
  const termsUrl = `${base.replace(/\/$/, '')}/terms`;
  const host = parsedBase.hostname;

  const [dnsResult, tcp443Result, tcp80Result, privacy, terms] = await Promise.all([
    resolveHost(host),
    checkTcp(host, basePort),
    checkTcp(host, 80),
    checkHttp(privacyUrl),
    checkHttp(termsUrl),
  ]);

  const checks = [
    {
      id: 'legal_host_dns_resolves',
      pass: dnsResult.ok,
      detail: dnsResult.ok
        ? `${host} -> ${dnsResult.records.join(', ')}`
        : `${host} -> error=${dnsResult.error || 'resolve_failed'}`,
    },
    {
      id: 'legal_host_tcp_443_reachable',
      pass: tcp443Result.ok,
      detail: tcp443Result.ok
        ? `${host}:${basePort} reachable (target port)`
        : `${host}:${basePort} error=${tcp443Result.error || 'unreachable'} (target port)`,
    },
    {
      id: 'legal_host_tcp_80_reachable',
      pass: tcp80Result.ok,
      detail: tcp80Result.ok
        ? `${host}:80 reachable`
        : `${host}:80 error=${tcp80Result.error || 'unreachable'}`,
    },
    {
      id: 'privacy_url_http_2xx_or_3xx',
      pass: privacy.ok,
      detail: privacy.ok
        ? `${privacyUrl} -> ${privacy.status} (${privacy.method})`
        : `${privacyUrl} -> error=${privacy.error || privacy.status} (${privacy.method})${privacy.detail ? ` [${privacy.detail}]` : ''}`,
    },
    {
      id: 'terms_url_http_2xx_or_3xx',
      pass: terms.ok,
      detail: terms.ok
        ? `${termsUrl} -> ${terms.status} (${terms.method})`
        : `${termsUrl} -> error=${terms.error || terms.status} (${terms.method})${terms.detail ? ` [${terms.detail}]` : ''}`,
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    target_base_url: base,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-legal-urls-latest.json');
  const outMd = path.join(outDir, 'mobile-legal-urls-latest.md');
  const hostSuffix = safeHost(host);
  const outHostJson = path.join(outDir, `mobile-legal-urls-${hostSuffix}-latest.json`);
  const outHostMd = path.join(outDir, `mobile-legal-urls-${hostSuffix}-latest.md`);
  if (writeLatestAlias) {
    writeAtomic(outJson, `${JSON.stringify(report, null, 2)}\n`);
  }
  writeAtomic(outHostJson, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    '# Mobile Legal URL Publication Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  if (writeLatestAlias) {
    writeAtomic(outMd, `${md.join('\n')}\n`);
  }
  writeAtomic(outHostMd, `${md.join('\n')}\n`);

  if (writeLatestAlias) {
    console.log(`Wrote ${rel(outJson)}`);
    console.log(`Wrote ${rel(outMd)}`);
  }
  console.log(`Wrote ${rel(outHostJson)}`);
  console.log(`Wrote ${rel(outHostMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
