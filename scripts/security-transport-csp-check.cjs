#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const checks = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function check(name, pass, detail) {
  checks.push({ name, pass, detail });
}

function writeReport() {
  const generatedAt = new Date().toISOString();
  const pass = checks.every((c) => c.pass);
  const status = pass ? 'pass' : 'fail';
  const report = { generated_at: generatedAt, status, checks };

  const outJson = path.join(root, 'docs', 'release', 'status', 'security-transport-csp-latest.json');
  const outMd = path.join(root, 'docs', 'release', 'status', 'security-transport-csp-latest.md');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Security Transport/CSP Check',
    '',
    `Generated: ${generatedAt}`,
    `Status: ${status}`,
    '',
    ...checks.map((c) => `- ${c.pass ? '[x]' : '[ ]'} ${c.name}: ${c.detail}`),
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (!pass) process.exit(2);
}

function main() {
  const gatewayIndex = read('services/gateway-api/src/index.ts');
  check(
    'Gateway CSP enabled',
    !gatewayIndex.includes('contentSecurityPolicy: false'),
    'Fastify helmet CSP must be configured',
  );
  check(
    'Gateway HSTS enabled',
    gatewayIndex.includes('hsts:'),
    'Strict transport headers required on API responses',
  );
  check(
    'Gateway frame/referrer protections enabled',
    gatewayIndex.includes('frameguard:') && gatewayIndex.includes('referrerPolicy:'),
    'frameguard + referrerPolicy must be set',
  );

  const tauriConf = JSON.parse(read('apps/companion-desktop-tauri/src-tauri/tauri.conf.json'));
  const csp = tauriConf?.app?.security?.csp || '';
  check(
    'Desktop CSP present',
    typeof csp === 'string' && csp.includes("default-src 'self'"),
    'Tauri CSP must define default-src self',
  );
  check(
    'Desktop CSP avoids wildcard HTTPS egress',
    !/https:\/\/\*(?:[ ;]|$)/.test(String(csp)),
    'connect-src cannot use bare https://* wildcard',
  );
  const tauriMain = read('apps/companion-desktop-tauri/src-tauri/src/main.rs');
  check(
    'Desktop transport policy enforced',
    tauriMain.includes('ensure_gateway_allowed('),
    'Desktop client must block insecure non-local gateway URLs',
  );
  check(
    'Desktop cert validation not bypassed',
    !tauriMain.includes('danger_accept_invalid_certs'),
    'Desktop HTTP client cannot disable certificate validation',
  );

  const canvasChat = read('apps/canvas-ui/src/app/c/[chatId]/page.tsx');
  check(
    'Canvas A2UI HTML sanitization',
    canvasChat.includes('sanitizeA2uiHtml('),
    'A2UI HTML must be sanitized before dangerouslySetInnerHTML',
  );

  writeReport();
}

main();
