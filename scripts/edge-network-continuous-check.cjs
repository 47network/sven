#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const INSTALL_HOST = process.env.SVEN_INSTALL_HOST || 'https://sven.systems:44747';
const APP_HOST = process.env.SVEN_APP_HOST || 'https://app.sven.systems:44747';
const CYCLES = Number.parseInt(process.env.EDGE_SMOKE_CYCLES || '3', 10);
const INTERVAL_SECONDS = Number.parseInt(process.env.EDGE_SMOKE_INTERVAL_SECONDS || '5', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostname(url) {
  return new URL(url).hostname;
}

async function probe(url, expected) {
  try {
    const r = await fetch(url, { redirect: 'manual' });
    return { pass: r.status === expected, detail: `${url} -> ${r.status} (expected ${expected})` };
  } catch (err) {
    return { pass: false, detail: `${url} -> error: ${String(err.message || err)}` };
  }
}

async function runCycle(index) {
  const checks = [
    { id: 'install_redirect', ...(await probe(`http://${hostname(INSTALL_HOST)}/`, 301)) },
    { id: 'app_redirect', ...(await probe(`http://${hostname(APP_HOST)}/`, 301)) },
    { id: 'install_sh', ...(await probe(`${INSTALL_HOST}/install.sh`, 200)) },
    { id: 'install_ps1', ...(await probe(`${INSTALL_HOST}/install.ps1`, 200)) },
    { id: 'install_cmd', ...(await probe(`${INSTALL_HOST}/install.cmd`, 200)) },
    { id: 'app_readyz', ...(await probe(`${APP_HOST}/readyz`, 200)) },
  ];
  return {
    cycle: index + 1,
    at: new Date().toISOString(),
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    checks,
  };
}

async function run() {
  const cycles = [];
  for (let i = 0; i < CYCLES; i += 1) {
    cycles.push(await runCycle(i));
    if (i < CYCLES - 1) {
      await sleep(INTERVAL_SECONDS * 1000);
    }
  }

  const status = cycles.some((c) => c.status !== 'pass') ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    config: {
      install_host: INSTALL_HOST,
      app_host: APP_HOST,
      cycles: CYCLES,
      interval_seconds: INTERVAL_SECONDS,
    },
    cycles,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'edge-network-continuous-latest.json');
  const outMd = path.join(outDir, 'edge-network-continuous-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Edge Network Continuous Smoke',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Cycles: ${CYCLES}`,
    `Interval: ${INTERVAL_SECONDS}s`,
    '',
    '## Cycle Summary',
    ...cycles.map((c) => `- cycle ${c.cycle}: ${c.status} (${c.at})`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run().catch((err) => {
  console.error('Continuous edge smoke failed:', err);
  process.exit(1);
});
