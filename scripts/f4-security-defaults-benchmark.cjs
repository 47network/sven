#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const API_BASE = String(process.env.API_URL || process.env.F4_API_BASE || 'http://127.0.0.1:8080').replace(/\/+$/, '');

const OUT_JSON = path.join(root, 'docs', 'release', 'status', 'f4-security-defaults-benchmark-latest.json');
const OUT_MD = path.join(root, 'docs', 'release', 'status', 'f4-security-defaults-benchmark-latest.md');
const STRICT = process.argv.includes('--strict');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function argOrEnv(name, envName, fallback = '') {
  const cli = argValue(name, '');
  if (cli) return cli;
  const envValue = String(process.env[envName] || '').trim();
  if (envValue) return envValue;
  return fallback;
}

const CHECKS = [
  {
    id: 'adapter_events_message_missing_token_denied',
    method: 'POST',
    path: '/v1/events/message',
    body: { channel: 'discord', channel_message_id: 'f4-probe', chat_id: 'f4-probe', sender_identity_id: 'f4-probe', text: 'f4 probe' },
    mode: 'no_auth',
    expect: [401],
  },
  {
    id: 'adapter_events_message_bad_token_denied',
    method: 'POST',
    path: '/v1/events/message',
    body: { channel: 'discord', channel_message_id: 'f4-probe', chat_id: 'f4-probe', sender_identity_id: 'f4-probe', text: 'f4 probe' },
    mode: 'bad_adapter_token',
    expect: [403],
  },
  {
    id: 'adapter_events_file_missing_token_denied',
    method: 'POST',
    path: '/v1/events/file',
    body: {
      channel: 'discord',
      channel_message_id: 'f4-probe',
      chat_id: 'f4-probe',
      sender_identity_id: 'f4-probe',
      file_url: 'https://example.invalid/file.txt',
      file_name: 'file.txt',
      file_mime: 'text/plain',
    },
    mode: 'no_auth',
    expect: [401],
  },
  {
    id: 'adapter_events_audio_missing_token_denied',
    method: 'POST',
    path: '/v1/events/audio',
    body: {
      channel: 'discord',
      channel_message_id: 'f4-probe',
      chat_id: 'f4-probe',
      sender_identity_id: 'f4-probe',
      audio_url: 'https://example.invalid/audio.mp3',
    },
    mode: 'no_auth',
    expect: [401],
  },
  {
    id: 'adapter_identity_resolve_missing_token_denied',
    method: 'POST',
    path: '/v1/adapter/identity/resolve',
    body: { channel: 'discord', channel_user_id: 'f4-probe-user', display_name: 'F4 Probe' },
    mode: 'no_auth',
    expect: [401],
  },
  {
    id: 'admin_webhooks_unauth_denied',
    method: 'POST',
    path: '/v1/admin/webhooks',
    body: { name: 'f4-probe', path: 'f4-probe', handler: 'nats_event' },
    mode: 'no_auth',
    expect: [401, 403],
  },
  {
    id: 'admin_webhooks_forged_session_denied',
    method: 'POST',
    path: '/v1/admin/webhooks',
    body: { name: 'f4-probe', path: 'f4-probe', handler: 'nats_event' },
    mode: 'forged_session',
    expect: [401, 403],
  },
  {
    id: 'tools_browser_action_unauth_denied',
    method: 'POST',
    path: '/v1/tools/browser/action',
    body: { action: 'noop' },
    mode: 'no_auth',
    expect: [401, 403],
  },
  {
    id: 'push_register_unauth_denied',
    method: 'POST',
    path: '/v1/push/register',
    body: { token: 'f4-probe', platform: 'web' },
    mode: 'no_auth',
    expect: [401, 403],
  },
  {
    id: 'openai_chat_completions_missing_bearer_denied',
    method: 'POST',
    path: '/v1/chat/completions',
    body: { model: 'f4-probe-model', messages: [{ role: 'user', content: 'hello' }] },
    mode: 'no_auth',
    expect: [401],
  },
];

function nowIso() {
  return new Date().toISOString();
}

async function probeGatewayHealth() {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${API_BASE}/healthz`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const status = Number(response.status || 0);
    return {
      reachable: status === 200 || status === 503,
      status_code: status,
      duration_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      reachable: false,
      status_code: null,
      duration_ms: Date.now() - startedAt,
      detail: String(err && err.message ? err.message : err),
    };
  }
}

function parseJsonLoose(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function doRequest(check) {
  const headers = { 'content-type': 'application/json' };
  if (check.mode === 'forged_session') {
    headers.cookie = 'sven_session=00000000-0000-4000-8000-000000000000';
  } else if (check.mode === 'bad_adapter_token') {
    headers['x-sven-adapter-token'] = 'invalid-f4-probe-token';
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(`${API_BASE}${check.path}`, {
      method: check.method,
      headers,
      body: JSON.stringify(check.body || {}),
      signal: AbortSignal.timeout(8000),
    });
    const durationMs = Date.now() - startedAt;
    const status = Number(response.status || 0);
    return {
      id: check.id,
      method: check.method,
      path: check.path,
      mode: check.mode,
      expected_statuses: check.expect,
      status_code: status,
      pass: check.expect.includes(status),
      duration_ms: durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    return {
      id: check.id,
      method: check.method,
      path: check.path,
      mode: check.mode,
      expected_statuses: check.expect,
      status_code: null,
      pass: false,
      skipped: true,
      detail: String(err && err.message ? err.message : err),
      duration_ms: durationMs,
    };
  }
}

function runSecurityAuditMetaCheck() {
  const child = spawnSync(
    'node',
    ['packages/cli/bin/sven.js', 'security', 'audit', '--url', API_BASE, '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const combinedOut = `${child.stdout || ''}\n${child.stderr || ''}`.trim();
  const parsed = parseJsonLoose(combinedOut);
  const findings = Array.isArray(parsed?.findings) ? parsed.findings : [];
  const highRisk = findings.filter((f) => ['critical', 'high'].includes(String(f?.severity || '').toLowerCase()));

  const partialMeta = highRisk.filter((f) => {
    const configPath = String(f?.config_path || '').trim();
    const remediation = String(f?.remediation || '').trim();
    const hasConfigPath = configPath.length > 0;
    const hasRemediation = remediation.length > 0;
    return hasConfigPath !== hasRemediation;
  });
  const highRiskWithMeta = highRisk.filter((f) => {
    const configPath = String(f?.config_path || '').trim();
    const remediation = String(f?.remediation || '').trim();
    return configPath.length > 0 && remediation.length > 0;
  });

  return {
    id: 'security_audit_remediation_metadata',
    pass: parsed !== null && partialMeta.length === 0 && highRiskWithMeta.length > 0,
    skipped: parsed === null,
    detail: parsed === null
      ? 'security audit JSON parse failed'
      : `high_risk_findings=${highRisk.length}, high_risk_with_meta=${highRiskWithMeta.length}, partial_meta=${partialMeta.length}`,
    totals: {
      findings: findings.length,
      high_risk: highRisk.length,
      high_risk_with_meta: highRiskWithMeta.length,
      high_risk_partial_meta: partialMeta.length,
    },
    exit_code: Number.isInteger(child.status) ? child.status : null,
  };
}

function summarize(results, auditMeta, healthProbe) {
  const unavailableByProbe = !healthProbe.reachable;
  const unavailableByStatus = results.length > 0 && results.every((r) => r.status_code != null && Number(r.status_code) >= 500);
  const gatewayUnavailable = unavailableByProbe || unavailableByStatus;

  const normalized = results.map((row) => {
    if (!gatewayUnavailable) return row;
    return {
      ...row,
      pass: false,
      skipped: true,
      detail: [row.detail, `gateway_unavailable(healthz=${healthProbe.status_code == null ? 'n/a' : healthProbe.status_code})`]
        .filter(Boolean)
        .join('; '),
    };
  });

  const deniedChecks = normalized.filter((r) => !r.skipped);
  const skipped = normalized.filter((r) => r.skipped);
  const deniedPass = deniedChecks.filter((r) => r.pass);
  const deniedFail = deniedChecks.filter((r) => !r.pass);

  const manualRaw = String(process.env.F4_REMEDIATION_MINUTES || '').trim();
  const requiresManual = manualRaw ? Number(manualRaw) : NaN;
  const manualPresent = manualRaw.length > 0 && Number.isFinite(requiresManual) && requiresManual >= 0;
  const manualPass = manualPresent && requiresManual <= 10;

  let status = 'pass';
  if (gatewayUnavailable || skipped.length > 0 || auditMeta.skipped || !manualPresent) {
    status = 'inconclusive';
  }
  if (deniedFail.length > 0 || !auditMeta.pass || (manualPresent && !manualPass)) {
    status = 'fail';
  }

  return {
    generated_at: nowIso(),
    api_base: API_BASE,
    status,
    provenance: {
      evidence_mode: argOrEnv('--evidence-mode', 'F4_EVIDENCE_MODE', 'runtime_security_probe'),
      source_run_id: argOrEnv('--source-run-id', 'F4_SOURCE_RUN_ID', String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || `local-${Date.now()}`)),
      head_sha: argOrEnv('--head-sha', 'F4_HEAD_SHA', String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '')),
      baseline_source: 'runtime_probe',
    },
    gateway_probe: healthProbe,
    summary: {
      denial_checks_total: normalized.length,
      denial_checks_passed: deniedPass.length,
      denial_checks_failed: deniedFail.length,
      denial_checks_skipped: skipped.length,
      unauthenticated_actions_accepted: deniedFail.length,
      security_audit_meta_pass: auditMeta.pass,
      remediation_minutes: manualPresent ? requiresManual : null,
      remediation_minutes_pass: manualPresent ? manualPass : null,
    },
    criteria: {
      zero_unauthenticated_inbound_actions_accepted: deniedFail.length === 0,
      security_audit_includes_severity_config_path_remediation: auditMeta.pass,
      operator_remediation_lte_10m: manualPresent ? manualPass : null,
    },
    checks: normalized,
    security_audit_meta: auditMeta,
    notes: [
      ...(gatewayUnavailable ? ['Gateway unreachable/degraded for auth matrix; run again against healthy gateway API target.'] : []),
      ...(!manualPresent ? ['Set F4_REMEDIATION_MINUTES to finalize the third pass criterion.'] : []),
    ],
  };
}

function toMarkdown(report) {
  const lines = [
    '# F4 Security Defaults Benchmark',
    '',
    `Generated: ${report.generated_at}`,
    `API base: ${report.api_base}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- denial_checks_total: ${report.summary.denial_checks_total}`,
    `- denial_checks_passed: ${report.summary.denial_checks_passed}`,
    `- denial_checks_failed: ${report.summary.denial_checks_failed}`,
    `- denial_checks_skipped: ${report.summary.denial_checks_skipped}`,
    `- unauthenticated_actions_accepted: ${report.summary.unauthenticated_actions_accepted}`,
    `- security_audit_meta_pass: ${report.summary.security_audit_meta_pass}`,
    `- remediation_minutes: ${report.summary.remediation_minutes == null ? 'n/a' : report.summary.remediation_minutes}`,
    `- remediation_minutes_pass: ${report.summary.remediation_minutes_pass == null ? 'n/a' : report.summary.remediation_minutes_pass}`,
    `- gateway_probe: ${report.gateway_probe.status_code == null ? 'n/a' : report.gateway_probe.status_code} (reachable=${report.gateway_probe.reachable})`,
    '',
    '## Criteria',
    `- [${report.criteria.zero_unauthenticated_inbound_actions_accepted ? 'x' : ' '}] 0 unauthenticated inbound actions accepted`,
    `- [${report.criteria.security_audit_includes_severity_config_path_remediation ? 'x' : ' '}] Security audit includes severity + config_path + remediation (high-risk findings)`,
    `- [${report.criteria.operator_remediation_lte_10m === true ? 'x' : report.criteria.operator_remediation_lte_10m === false ? ' ' : '~'}] Operator remediation <= 10 minutes`,
    '',
    '## Denial Matrix',
  ];

  for (const row of report.checks) {
    lines.push(
      `- [${row.pass ? 'x' : row.skipped ? '~' : ' '}] ${row.id}: status=${row.status_code == null ? 'n/a' : row.status_code} expected=${row.expected_statuses.join('/')} mode=${row.mode}${row.detail ? ` detail=${row.detail}` : ''}`,
    );
  }

  lines.push('');
  lines.push('## Security Audit Metadata Check');
  lines.push(`- [${report.security_audit_meta.pass ? 'x' : report.security_audit_meta.skipped ? '~' : ' '}] ${report.security_audit_meta.id}: ${report.security_audit_meta.detail}`);

  if (Array.isArray(report.notes) && report.notes.length > 0) {
    lines.push('');
    lines.push('## Notes');
    for (const note of report.notes) lines.push(`- ${note}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const healthProbe = await probeGatewayHealth();
  const checks = [];
  for (const check of CHECKS) {
    checks.push(await doRequest(check));
  }

  const auditMeta = runSecurityAuditMetaCheck();
  const report = summarize(checks, auditMeta, healthProbe);

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_MD, toMarkdown(report), 'utf8');

  console.log(`Wrote ${path.relative(root, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(root, OUT_MD)}`);
  console.log(
    `f4-security-defaults-benchmark: ${report.status} (passed=${report.summary.denial_checks_passed} failed=${report.summary.denial_checks_failed} skipped=${report.summary.denial_checks_skipped})`,
  );
  if (report.status === 'fail') process.exit(1);
  if (STRICT && report.status !== 'pass') process.exit(2);
}

main().catch((err) => {
  console.error('f4-security-defaults-benchmark fatal:', err);
  process.exit(1);
});
