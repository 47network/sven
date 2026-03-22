#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-security-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-security-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function runNpm(args) {
  if (process.platform === 'win32') {
    const cmdline = `npm ${args.join(' ')}`;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdline], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function resultPayload(id, command, result) {
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    id,
    command,
    exit_code: exitCode,
    pass: exitCode === 0,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout_excerpt: String(result.stdout || '').split(/\r?\n/).slice(-25),
    stderr_excerpt: String(result.stderr || '').split(/\r?\n/).slice(-25),
  };
}

function run() {
  const checks = [];
  const commandRuns = [];

  const webEgressRun = runNpm(['exec', '--', 'node', 'scripts/web-egress-security-check.cjs']);
  commandRuns.push(resultPayload(
    'web_egress_security_lane_check',
    'npm exec -- node scripts/web-egress-security-check.cjs',
    webEgressRun,
  ));

  const quarantineRun = runNpm(['exec', '--', 'node', 'scripts/quarantine-isolation-check.cjs']);
  commandRuns.push(resultPayload(
    'quarantine_isolation_lane_check',
    'npm exec -- node scripts/quarantine-isolation-check.cjs',
    quarantineRun,
  ));

  const baselineRun = runNpm(['exec', '--', 'node', 'scripts/runtime-security-baseline-check.cjs']);
  commandRuns.push(resultPayload(
    'runtime_security_baseline_lane_check',
    'npm exec -- node scripts/runtime-security-baseline-check.cjs',
    baselineRun,
  ));

  const secretRefRun = runNpm(['exec', '--', 'node', 'scripts/secret-ref-policy-check.cjs']);
  commandRuns.push(resultPayload(
    'secret_ref_policy_lane_check',
    'npm exec -- node scripts/secret-ref-policy-check.cjs',
    secretRefRun,
  ));

  const websocketRun = runNpm(['run', '-s', 'release:websocket:contract:check']);
  commandRuns.push(resultPayload(
    'websocket_contract_lane_check',
    'npm run -s release:websocket:contract:check',
    websocketRun,
  ));

  const cliE2eRun = runNpm(['run', '-s', 'test:cli:e2e']);
  commandRuns.push(resultPayload(
    'cli_e2e_security_surface_check',
    'npm run -s test:cli:e2e',
    cliE2eRun,
  ));

  const gatewaySecurityRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'pairing.e2e.ts',
    'security.e2e.ts',
    'browser-tools.e2e.ts',
    'tailscale.e2e.test.js',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gateway_security_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- pairing.e2e.ts security.e2e.ts browser-tools.e2e.ts tailscale.e2e.test.js --runInBand',
    gatewaySecurityRun,
  ));

  const agentPolicyRun = runNpm([
    '--prefix',
    'services/agent-runtime',
    'run',
    'test',
    '--',
    'policy-engine-tool-bindings.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'agent_policy_binding_runtime_tests_check',
    'npm --prefix services/agent-runtime run test -- policy-engine-tool-bindings.test.ts --runInBand',
    agentPolicyRun,
  ));

  checks.push({
    id: 'security_lanes_and_runtime_tests_pass',
    pass: commandRuns.every((runItem) => runItem.pass),
    detail: 'security lanes + gateway/agent/cli runtime suites execute successfully',
  });

  const pairingSource = readUtf8('services/gateway-api/src/routes/admin/pairing.ts');
  checks.push({
    id: 'pairing_security_surface_present',
    pass: hasAll(pairingSource, ['/pairing/approve', '/pairing/deny', '/pairing/allowlist', 'pairing_requests', 'channel_allowlists']),
    detail: 'pairing request approval/deny/allowlist routes and persistence tables are wired',
  });

  const skillRunnerSource = readUtf8('services/skill-runner/src/index.ts');
  checks.push({
    id: 'sandbox_and_quarantine_modes_present',
    pass: hasAll(skillRunnerSource, [
      "tool.trust_level === 'quarantined'",
      'executeInGVisor(',
      'executeInFirecracker(',
      "const mode = hasNasWrite ? 'rw' : 'ro'",
    ]),
    detail: 'quarantine trust level + gVisor/firecracker execution and rw/ro workspace gating are present',
  });

  const policySource = readUtf8('services/agent-runtime/src/policy-engine.ts');
  checks.push({
    id: 'policy_allowlist_and_command_authorization_present',
    pass: hasAll(policySource, ['tool_policy.by_provider', 'checkAllowlists(', 'not allowlisted by active tool binding rules']),
    detail: 'policy engine enforces explicit allowlists and provider-bound tool authorization',
  });

  const authSource = readUtf8('services/gateway-api/src/routes/auth.ts');
  checks.push({
    id: 'session_cookie_hardening_present',
    pass: hasAll(authSource, ['function authCookieOptions', 'httpOnly: true', "sameSite: 'strict'"]),
    detail: 'session/refresh cookies are issued via hardened auth cookie options',
  });

  const cliSource = readUtf8('packages/cli/bin/sven.js');
  checks.push({
    id: 'doctor_and_security_audit_cli_surface_present',
    pass: hasAll(cliSource, ['sven doctor', 'sven security audit', '--fix', '--json', 'SEC-001']),
    detail: 'doctor + security-audit CLI surfaces with fix/json paths are exposed',
  });

  const firewallSource = readUtf8('services/agent-runtime/src/prompt-firewall.ts');
  const agentRuntimeSource = readUtf8('services/agent-runtime/src/index.ts');
  checks.push({
    id: 'prompt_injection_defense_surface_present',
    pass: hasAll(firewallSource, [
      'system prompt hash drift',
      'user_message_ids',
      'rag_citations',
      'Tool call has no justification',
    ]) && hasAll(agentRuntimeSource, ['promptFirewall.validate(', 'Prompt firewall blocked tool call']),
    detail: 'prompt firewall enforces provenance/justification and is active in runtime tool-call path',
  });

  const prodComposeSource = readUtf8('docker-compose.production.yml');
  checks.push({
    id: 'hardened_runtime_storage_profile_present',
    pass: hasAll(prodComposeSource, ['read_only: true', 'tmpfs:']),
    detail: 'production compose profile enforces read-only containers with tmpfs overlays',
  });

  const tailscaleSource = readUtf8('services/gateway-api/src/services/TailscaleService.ts');
  checks.push({
    id: 'tailscale_identity_integration_surface_present',
    pass: hasAll(tailscaleSource, ['tailscale serve --bg', 'tailscale funnel --bg', "gateway.tailscale.mode"]),
    detail: 'tailscale serve/funnel integration and mode persistence are implemented',
  });

  const browserToolsSource = readUtf8('services/gateway-api/src/routes/browser-tools.ts');
  checks.push({
    id: 'browser_profile_isolation_surface_present',
    pass: hasAll(browserToolsSource, ['/v1/tools/browser/profiles', 'profile_id', 'browser_profiles', 'browser_audit_logs']),
    detail: 'browser tooling is profile-scoped with profile-aware controls and audit logging',
  });

  const threatModel = readUtf8('docs/security/threat-model.md');
  checks.push({
    id: 'threat_model_documentation_present',
    pass: threatModel.includes('# Sven Security Threat Model') || threatModel.includes('## Sven Security Threat Model') || threatModel.includes('Threat Model'),
    detail: 'threat model documentation exists and is versioned in-repo',
  });

  const incidentPlaybook = readUtf8('docs/security/incident-response-playbook.md');
  checks.push({
    id: 'incident_response_playbook_present',
    pass: incidentPlaybook.includes('Incident Response') && incidentPlaybook.includes('Containment'),
    detail: 'incident response playbook is present with triage/containment guidance',
  });

  const securityPolicy = readUtf8('SECURITY.md');
  checks.push({
    id: 'security_reporting_channel_present',
    pass: securityPolicy.includes('/security/advisories/new') && securityPolicy.includes('Email'),
    detail: 'responsible disclosure channel is defined (private advisory + email route)',
  });

  const externalStatuses = [
    'docs/release/status/web-egress-security-latest.json',
    'docs/release/status/quarantine-isolation-latest.json',
    'docs/release/status/runtime-security-baseline-latest.json',
    'docs/release/status/websocket-contract-latest.json',
  ].map((relPath) => {
    const parsed = readJson(relPath);
    return {
      rel_path: relPath,
      status: String(parsed?.status || '').toLowerCase() || 'missing',
    };
  });

  checks.push({
    id: 'security_status_artifacts_present',
    pass: externalStatuses.every((item) => item.status === 'pass' || item.status === 'fail'),
    detail: externalStatuses.map((item) => `${item.rel_path}=${item.status}`).join('; '),
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: [
      '8.1',
      '8.2',
      '8.3',
      '8.4',
      '8.5',
      '8.6',
      '8.7',
      '8.8',
      '8.9',
      '8.10',
      '8.11',
      '8.12',
      '8.13',
      '8.14',
      '8.15',
      '8.16',
      '8.17',
      '8.18',
      '8.19',
      '8.20',
    ],
    checks,
    command_runs: commandRuns,
    external_statuses: externalStatuses,
    source_files: [
      'services/gateway-api/src/routes/admin/pairing.ts',
      'services/skill-runner/src/index.ts',
      'services/agent-runtime/src/policy-engine.ts',
      'services/gateway-api/src/routes/auth.ts',
      'services/gateway-api/src/routes/browser-tools.ts',
      'services/gateway-api/src/services/TailscaleService.ts',
      'services/agent-runtime/src/prompt-firewall.ts',
      'packages/cli/bin/sven.js',
      'docker-compose.production.yml',
      'SECURITY.md',
      'docs/security/threat-model.md',
      'docs/security/incident-response-playbook.md',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Security Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped OpenClaw rows: ${payload.mapped_openclaw_rows.join(', ')}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Command Runs',
      ...commandRuns.map((runItem) => `- ${runItem.id}: exit_code=${runItem.exit_code} (\`${runItem.command}\`)`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`openclaw-security-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
