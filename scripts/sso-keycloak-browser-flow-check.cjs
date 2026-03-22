#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'd9-keycloak-browser-flow-latest.json');
const outMd = path.join(outDir, 'd9-keycloak-browser-flow-latest.md');
const smokeScript = path.join(root, 'scripts', 'sso-keycloak-interop-smoke.cjs');
const strict = process.argv.includes('--strict');

function run() {
  fs.mkdirSync(outDir, { recursive: true });

  const smoke = spawnSync(
    process.execPath,
    [
      smokeScript,
      '--browser-flow-only',
      '--report-json',
      path.relative(root, outJson),
      ...(strict ? ['--strict'] : []),
    ],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    },
  );

  let report = null;
  if (fs.existsSync(outJson)) {
    try {
      report = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    } catch {
      report = null;
    }
  }

  const checks = [
    {
      id: 'browser_flow_smoke_exit_zero',
      pass: smoke.status === 0,
      detail: `exit=${String(smoke.status)}`,
    },
    {
      id: 'browser_flow_report_written',
      pass: Boolean(report),
      detail: report ? 'report present' : 'missing/invalid report',
    },
    {
      id: 'browser_flow_redirect_chain_verified',
      pass: Boolean(report?.checks?.browser_redirect_chain_verified),
      detail: `browser_redirect_chain_verified=${String(report?.checks?.browser_redirect_chain_verified)}`,
    },
    {
      id: 'browser_flow_state_correlation_pass',
      pass: Boolean(report?.checks?.state_correlation_pass),
      detail: `state_correlation_pass=${String(report?.checks?.state_correlation_pass)}`,
    },
    {
      id: 'browser_flow_callback_target_match_pass',
      pass: Boolean(report?.checks?.redirect_target_matches_callback_uri),
      detail: `redirect_target_matches_callback_uri=${String(report?.checks?.redirect_target_matches_callback_uri)}`,
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const gateReport = {
    type: 'd9_keycloak_oidc_browser_flow_check',
    generated_at_utc: new Date().toISOString(),
    status,
    smoke_stdout: String(smoke.stdout || ''),
    smoke_stderr: String(smoke.stderr || ''),
    checks,
    browser_flow_report: report || null,
  };

  fs.writeFileSync(outJson, `${JSON.stringify(gateReport, null, 2)}\n`, 'utf8');
  const md = [
    '# D9 Keycloak Browser Flow Check',
    '',
    `- Generated: ${gateReport.generated_at_utc}`,
    `- Status: ${status.toUpperCase()}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');
  console.log(`wrote: ${path.relative(root, outJson)}`);
  console.log(`wrote: ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(1);
}

run();
