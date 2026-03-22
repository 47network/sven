#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const crypto = require('node:crypto');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const INSTALL_HOST = process.env.SVEN_INSTALL_HOST || 'https://sven.systems:44747';
const APP_HOST = process.env.SVEN_APP_HOST || 'https://app.sven.systems:44747';
const MIN_TLS_VALID_DAYS = Number.parseInt(process.env.MIN_TLS_VALID_DAYS || '14', 10);

function hostnameFromUrl(value) {
  return new URL(value).hostname;
}

function portFromUrl(value) {
  const parsed = new URL(value);
  if (parsed.port) return Number.parseInt(parsed.port, 10);
  return parsed.protocol === 'https:' ? 443 : 80;
}

function hostFromUrl(value) {
  return new URL(value).hostname;
}

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

async function checkHttp(url, expectedStatus = 200) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const pass = res.status === expectedStatus;
    return { pass, detail: `${url} -> ${res.status} (expected ${expectedStatus})` };
  } catch (err) {
    return { pass: false, detail: `${url} -> error: ${String(err.message || err)}` };
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function checkInstallerIntegrity(url, localRelPath) {
  const localPath = path.join(root, localRelPath);
  if (!fs.existsSync(localPath)) {
    return { pass: false, detail: `${url} -> local file missing: ${localRelPath}` };
  }

  try {
    const response = await fetch(url, { redirect: 'manual' });
    const body = await response.text();
    if (response.status !== 200) {
      return { pass: false, detail: `${url} -> ${response.status} (expected 200)` };
    }

    const remoteHash = sha256(body);
    const localHash = sha256(fs.readFileSync(localPath, 'utf8'));
    const pass = remoteHash === localHash;
    return {
      pass,
      detail: `${url} -> sha256 remote=${remoteHash} local=${localHash} (${localRelPath})`,
    };
  } catch (err) {
    return { pass: false, detail: `${url} -> error: ${String(err.message || err)}` };
  }
}

function tlsValidity(hostname, port, minDays) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: true,
      },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          socket.end();
          resolve({ pass: false, detail: `${hostname}: no certificate metadata` });
          return;
        }
        const validTo = new Date(cert.valid_to);
        const msRemaining = validTo.getTime() - Date.now();
        const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
        const pass = daysRemaining >= minDays;
        socket.end();
        resolve({
          pass,
          detail: `${hostname}: cert valid_to=${validTo.toISOString().slice(0, 10)}, days_remaining=${daysRemaining}, min_required=${minDays}`,
        });
      }
    );
    socket.on('error', (err) => {
      resolve({ pass: false, detail: `${hostname}:${port}: tls error ${String(err.message || err)}` });
    });
  });
}

async function run() {
  const installersConf = read('config/nginx/extnginx-sven-installers.conf');
  const appEdgeConf = read('config/nginx/extnginx-sven-app.conf');
  const rateLimitConf = read('config/nginx/extnginx-rate-limit-policy.conf');
  const rateLimitDocPath = 'docs/deploy/edge-rate-limit-and-abuse-controls-2026.md';
  const rateLimitDoc = read(rateLimitDocPath);

  const installSh = await checkHttp(`${INSTALL_HOST}/install.sh`, 200);
  const installPs1 = await checkHttp(`${INSTALL_HOST}/install.ps1`, 200);
  const installCmd = await checkHttp(`${INSTALL_HOST}/install.cmd`, 200);
  const installShIntegrity = await checkInstallerIntegrity(
    `${INSTALL_HOST}/install.sh`,
    'deploy/quickstart/install.sh'
  );
  const installPs1Integrity = await checkInstallerIntegrity(
    `${INSTALL_HOST}/install.ps1`,
    'deploy/quickstart/install.ps1'
  );
  const installCmdIntegrity = await checkInstallerIntegrity(
    `${INSTALL_HOST}/install.cmd`,
    'deploy/quickstart/install.cmd'
  );
  const appHealth = await checkHttp(`${APP_HOST}/readyz`, 200);
  const installHttpRedirect = await checkHttp(
    `http://${hostnameFromUrl(INSTALL_HOST)}/`,
    301
  );
  const appHttpRedirect = await checkHttp(`http://${hostnameFromUrl(APP_HOST)}/`, 301);

  const installTls = await tlsValidity(
    hostnameFromUrl(INSTALL_HOST),
    portFromUrl(INSTALL_HOST),
    MIN_TLS_VALID_DAYS
  );
  const appTls = await tlsValidity(
    hostnameFromUrl(APP_HOST),
    portFromUrl(APP_HOST),
    MIN_TLS_VALID_DAYS
  );

  const checks = [
    {
      id: 'domain_split_installers_conf_present',
      pass: installersConf.includes(`server_name ${hostFromUrl(INSTALL_HOST)};`),
      detail: `config/nginx/extnginx-sven-installers.conf has ${hostFromUrl(INSTALL_HOST)}`,
    },
    {
      id: 'domain_split_app_conf_present',
      pass: appEdgeConf.includes(`server_name ${hostFromUrl(APP_HOST)};`),
      detail: `config/nginx/extnginx-sven-app.conf has ${hostFromUrl(APP_HOST)}`,
    },
    {
      id: 'http_to_https_redirect_install_host',
      pass: installHttpRedirect.pass,
      detail: installHttpRedirect.detail,
    },
    {
      id: 'http_to_https_redirect_app_host',
      pass: appHttpRedirect.pass,
      detail: appHttpRedirect.detail,
    },
    {
      id: 'install_sh_served',
      pass: installSh.pass,
      detail: installSh.detail,
    },
    {
      id: 'install_sh_integrity_match',
      pass: installShIntegrity.pass,
      detail: installShIntegrity.detail,
    },
    {
      id: 'install_ps1_served',
      pass: installPs1.pass,
      detail: installPs1.detail,
    },
    {
      id: 'install_ps1_integrity_match',
      pass: installPs1Integrity.pass,
      detail: installPs1Integrity.detail,
    },
    {
      id: 'install_cmd_served',
      pass: installCmd.pass,
      detail: installCmd.detail,
    },
    {
      id: 'install_cmd_integrity_match',
      pass: installCmdIntegrity.pass,
      detail: installCmdIntegrity.detail,
    },
    {
      id: 'app_ready_endpoint_ok',
      pass: appHealth.pass,
      detail: appHealth.detail,
    },
    {
      id: 'tls_monitor_install_host',
      pass: installTls.pass,
      detail: installTls.detail,
    },
    {
      id: 'tls_monitor_app_host',
      pass: appTls.pass,
      detail: appTls.detail,
    },
    {
      id: 'rate_limit_policy_config_present',
      pass: rateLimitConf.includes('limit_req_zone') && rateLimitConf.includes('limit_req'),
      detail: 'config/nginx/extnginx-rate-limit-policy.conf includes limit_req_zone and limit_req',
    },
    {
      id: 'abuse_controls_doc_present',
      pass: rateLimitDoc.includes('## Rate Limit Controls') && rateLimitDoc.includes('## Abuse Response'),
      detail: rateLimitDocPath,
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    install_host: INSTALL_HOST,
    app_host: APP_HOST,
    min_tls_valid_days: MIN_TLS_VALID_DAYS,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'edge-network-delivery-latest.json');
  const outMd = path.join(outDir, 'edge-network-delivery-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Edge and Network Delivery Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Install host: ${report.install_host}`,
    `App host: ${report.app_host}`,
    `Min TLS validity days: ${report.min_tls_valid_days}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run().catch((err) => {
  console.error('Edge/network delivery check failed:', err);
  process.exit(1);
});
