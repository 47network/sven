const { spawnSync } = require('node:child_process');
const { resolve, join } = require('node:path');
const { existsSync, readFileSync, rmSync, writeFileSync, statSync } = require('node:fs');

const CLI_PATH = resolve(__dirname, '..', 'bin', 'sven.js');

function runCli(args) {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
  });
}

function runCliWithEnv(args, env = {}) {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function runCliWithInput(args, input, env = {}) {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input,
  });
}

describe('sven cli', () => {
  it('renders top-level help', () => {
    const proc = runCli(['--help']);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain('Sven CLI');
    expect(proc.stdout).toContain('sven gateway status');
    expect(proc.stdout).toContain('sven doctor');
    expect(proc.stdout).toContain('sven wizard');
  });

  it('renders command help for key subcommands', () => {
    const commands = [
      ['gateway', '--help'],
      ['doctor', '--help'],
      ['install', '--help'],
      ['agent', '--help'],
      ['send', '--help'],
      ['channels', '--help'],
      ['skills', '--help'],
      ['approvals', '--help'],
      ['pairing', '--help'],
      ['update', '--help'],
      ['config', '--help'],
    ];
    for (const cmd of commands) {
      const proc = runCli(cmd);
      expect(proc.status).toBe(0);
      expect(proc.stdout).toContain('Usage');
    }
  });

  it('parses skills install args and reaches HTTP layer', () => {
    const proc = runCli([
      'skills',
      'install',
      'test-skill',
      '--tool-id',
      'tool-test',
      '--cookie',
      'session=test',
      '--url',
      'http://127.0.0.1:1',
      '--json',
    ]);
    expect(proc.status).toBe(1);
    expect(proc.stdout).toContain('"status": "error"');
    expect(proc.stdout).toContain('Failed to query catalog');
  });

  it('rejects pairing approve when args are missing', () => {
    const proc = runCli(['pairing', 'approve']);
    expect(proc.status).toBe(1);
    expect(proc.stderr).toContain('Usage: sven pairing approve <channel> <code>');
  });

  const gatewayUrlForDoctorIntegration = process.env.TEST_GATEWAY_URL || '';
  (gatewayUrlForDoctorIntegration ? it : it.skip)('integration: doctor connects to running services', () => {
    const gatewayUrl = gatewayUrlForDoctorIntegration;
    const proc = runCliWithEnv(['doctor', '--url', gatewayUrl, '--json'], {
      SVEN_SESSION_COOKIE: process.env.TEST_SESSION_COOKIE || '',
    });
    expect([0, 1, 2]).toContain(proc.status);
    const out = JSON.parse(proc.stdout || '{}');
    expect(typeof out.status).toBe('string');
    expect(Array.isArray(out.checks)).toBe(true);
  });

  const gatewayUrlForAgentIntegration = process.env.TEST_GATEWAY_URL || '';
  const adapterTokenForAgentIntegration = process.env.TEST_ADAPTER_TOKEN || '';
  const channelForAgentIntegration = process.env.TEST_CHANNEL || '';
  const chatIdForAgentIntegration = process.env.TEST_CHAT_ID || '';
  const senderIdForAgentIntegration = process.env.TEST_SENDER_ID || '';
  const hasAgentIntegrationEnv = Boolean(
    gatewayUrlForAgentIntegration
    && adapterTokenForAgentIntegration
    && channelForAgentIntegration
    && chatIdForAgentIntegration
    && senderIdForAgentIntegration,
  );
  (hasAgentIntegrationEnv ? it : it.skip)('integration: agent --message queues response', () => {
    const gatewayUrl = gatewayUrlForAgentIntegration;
    const adapterToken = adapterTokenForAgentIntegration;
    const channel = channelForAgentIntegration;
    const chatId = chatIdForAgentIntegration;
    const senderId = senderIdForAgentIntegration;
    const proc = runCliWithEnv(
      [
        'agent',
        '--message',
        'integration test from cli',
        '--channel',
        channel,
        '--chat-id',
        chatId,
        '--sender-identity-id',
        senderId,
        '--url',
        gatewayUrl,
        '--adapter-token',
        adapterToken,
        '--json',
      ],
      {},
    );
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.queued).toBe(true);
  });

  it('supports interactive agent mode with explicit exit command', () => {
    const proc = runCliWithInput(
      [
        'agent',
        '--channel',
        'discord',
        '--chat-id',
        'chat-test',
        '--sender-identity-id',
        'user-test',
        '--adapter-token',
        'token-test',
        '--url',
        'http://127.0.0.1:1',
      ],
      '/exit\n',
    );
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain('Interactive agent mode');
  });

  it('e2e: wizard completes mock setup flow', () => {
    const outPath = resolve(__dirname, '..', '.tmp-test-wizard.json');
    if (existsSync(outPath)) rmSync(outPath, { force: true });
    const proc = runCli([
      'wizard',
      '--defaults',
      '--output',
      outPath,
      '--json',
    ]);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.post_setup_doctor).toBeTruthy();
    expect(typeof out.post_setup_doctor.status).toBe('string');
    expect(existsSync(outPath)).toBe(true);
    const file = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(typeof file.gateway_url).toBe('string');
    expect(typeof file.database_url).toBe('string');
    expect(typeof file.nats_url).toBe('string');
    expect(file.version).toBe(1);
    expect(typeof file.gateway?.url).toBe('string');
    expect(typeof file.database?.url).toBe('string');
    expect(typeof file.nats?.url).toBe('string');
    expect(file.wizard?.answers).toBeTruthy();
    rmSync(outPath, { force: true });
  });

  it('e2e: wizard resumes from state file in defaults mode', () => {
    const outPath = resolve(__dirname, '..', '.tmp-test-wizard-resume.json');
    const statePath = `${outPath}.wizard-state.json`;
    if (existsSync(outPath)) rmSync(outPath, { force: true });
    if (existsSync(statePath)) rmSync(statePath, { force: true });
    const resumeState = {
      version: 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed: false,
      answers: {
        gateway_url: 'http://127.0.0.1:3999',
        database_url: 'postgresql://resume:resume@localhost:5432/resume',
        nats_url: 'nats://127.0.0.1:4999',
        opensearch_url: '',
        inference_url: 'http://127.0.0.1:5999',
        first_channel: 'slack',
        daemon_install: 'none',
        bootstrap_admin: 'no',
      },
    };
    require('node:fs').writeFileSync(statePath, `${JSON.stringify(resumeState, null, 2)}\n`, 'utf8');

    const proc = runCli([
      'wizard',
      '--defaults',
      '--resume',
      '--output',
      outPath,
      '--json',
    ]);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.resumed).toBe(true);
    expect(existsSync(outPath)).toBe(true);
    const file = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(file.gateway_url).toBe('http://127.0.0.1:3999');
    expect(file.database_url).toBe('postgresql://resume:resume@localhost:5432/resume');
    expect(file.nats_url).toBe('nats://127.0.0.1:4999');
    expect(file.first_channel).toBe('slack');
    expect(existsSync(statePath)).toBe(false);
    rmSync(outPath, { force: true });
  });

  it('config validate: invalid file returns actionable error details', () => {
    const configPath = resolve(__dirname, '..', '.tmp-invalid-config.json');
    if (existsSync(configPath)) rmSync(configPath, { force: true });
    writeFileSync(
      configPath,
      JSON.stringify({ gateway: { port: '3000' }, database: { url: 123 } }, null, 2),
      'utf8',
    );

    const proc = runCli(['config', 'validate', '--config', configPath, '--json']);
    expect(proc.status).toBe(1);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('error');
    expect(out.message).toContain('Config validation failed');
    expect(out.path).toBe(configPath);
    expect(Array.isArray(out.errors)).toBe(true);
    expect(out.errors.join('\n')).toMatch(/gateway\.port|database\.url/i);

    rmSync(configPath, { force: true });
  });

  it('supports ndjson automation output format', () => {
    const proc = runCli(['auth', 'status', '--format', 'ndjson']);
    expect(proc.status).toBe(0);
    const line = String(proc.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0];
    const out = JSON.parse(line);
    expect(out.status).toBe('ok');
    expect(out.data).toBeTruthy();
  });

  it('emits HTTP trace logs when --trace is enabled', () => {
    const proc = runCli(['doctor', '--url', 'http://127.0.0.1:1', '--json', '--trace']);
    expect([0, 1, 2]).toContain(proc.status);
    expect(proc.stderr).toContain('[trace]');
    expect(proc.stderr).toContain('http.request');
  });

  it('doctor includes host runtime dependency checks', () => {
    const proc = runCli(['doctor', '--url', 'http://127.0.0.1:1', '--json']);
    expect([0, 1, 2]).toContain(proc.status);
    const out = JSON.parse(proc.stdout || '{}');
    const checkNames = Array.isArray(out?.checks) ? out.checks.map((c) => c.check) : [];
    expect(checkNames).toContain('runtime.node');
    expect(checkNames).toContain('runtime.python');
    expect(checkNames).toContain('runtime.ffmpeg');
    expect(checkNames).toContain('runtime.gpu_driver');
  });

  it('doctor emits actionable next steps for failing or warning checks', () => {
    const proc = runCli(['doctor', '--url', 'http://127.0.0.1:1', '--doctor-profile', 'release-strict', '--json']);
    expect([1, 2]).toContain(proc.status);
    const out = JSON.parse(proc.stdout || '{}');
    expect(Array.isArray(out.next_steps)).toBe(true);
    expect(out.next_steps.some((step) => step.check === 'gateway.health')).toBe(true);
    expect(out.next_steps.some((step) => String(step.suggested_fix || '').includes('sven auth login-device'))).toBe(true);
  });

  it('install supports dry-run planning without mutating host', () => {
    const proc = runCli(['install', '--mode', 'systemd', '--dry-run', '--json']);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.requested_mode).toBe('systemd');
    expect(out.resolved_mode).toBe('systemd');
    expect(Array.isArray(out.supported_runtime_models)).toBe(true);
    expect(out.supported_runtime_models).toContain('docker-compose-supervised');
    expect(out.compose_context).toBeTruthy();
    expect(out.compose_context.project_directory).toBe(process.cwd());
    expect(out.compose_context.compose_file).toBe(join(process.cwd(), 'docker-compose.yml'));
    expect(out.install).toBeTruthy();
    expect(out.install.status).toBe('planned');
    expect(out.install.dry_run).toBe(true);
    expect(out.install.runtime_model).toBe('docker-compose-supervised');
    expect(out.install.runtime_target).toBe('gateway-api');
    expect(out.install.project_directory).toBe(process.cwd());
    expect(out.install.compose_file).toBe(join(process.cwd(), 'docker-compose.yml'));
    expect(typeof out.install.unit_path).toBe('string');
  });

  it('update supports dry-run planning without executing updates', () => {
    const proc = runCli(['update', '--service', 'gateway-api', '--dry-run', '--json']);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.dry_run).toBe(true);
    expect(out.service).toBe('gateway-api');
    expect(out.compose_context).toBeTruthy();
    expect(out.compose_context.project_directory).toBe(process.cwd());
    expect(out.compose_context.compose_file).toBe(join(process.cwd(), 'docker-compose.yml'));
    expect(Array.isArray(out.steps)).toBe(true);
    expect(out.steps.some((s) => s.step === 'cli.update' && s.status === 'planned')).toBe(true);
    expect(out.steps.some((s) => s.step === 'gateway.pull' && s.status === 'planned' && String(s.command || '').includes('--project-directory'))).toBe(true);
    expect(out.steps.some((s) => s.step === 'gateway.restart' && s.status === 'planned' && String(s.command || '').includes('--project-directory'))).toBe(true);
  });

  it('update supports release channel selection in dry-run plan', () => {
    const proc = runCli(['update', '--service', 'gateway-api', '--channel', 'beta', '--dry-run', '--json']);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.channel).toBe('beta');
    expect(out.cli_package).toBe('@sven/cli@beta');
    expect(Array.isArray(out.steps)).toBe(true);
    expect(out.steps.some((s) => s.step === 'cli.update' && String(s.command || '').includes('@sven/cli@beta'))).toBe(true);
    expect(out.steps.some((s) => s.step === 'gateway.pull' && String(s.command || '').includes('SVEN_RELEASE_CHANNEL=beta') && String(s.command || '').includes('--project-directory'))).toBe(true);
    expect(out.steps.some((s) => s.step === 'gateway.restart' && String(s.command || '').includes('SVEN_RELEASE_CHANNEL=beta') && String(s.command || '').includes('--project-directory'))).toBe(true);
  });

  it('update rejects invalid release channel values', () => {
    const proc = runCli(['update', '--channel', 'nightly', '--dry-run']);
    expect(proc.status).toBe(2);
    expect(proc.stderr).toContain('Invalid --channel');
  });

  it('strict-config blocks operational commands through shared release-strict remediation path', () => {
    const proc = runCli(['update', '--dry-run', '--strict-config', '--json', '--url', 'http://127.0.0.1:1']);
    expect(proc.status).toBe(2);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('error');
    expect(out.code).toBe('STRICT_CONFIG_BLOCKED');
    expect(out.command).toBe('update');
    expect(out.doctor).toBeTruthy();
    expect(out.doctor.doctor_profile).toBe('release-strict');
    expect(String(out.remediation || '')).toContain('sven doctor --doctor-profile release-strict');
  });

  it('strict-config can be enabled via environment for operational commands', () => {
    const proc = runCliWithEnv(['install', '--mode', 'systemd', '--dry-run', '--json', '--url', 'http://127.0.0.1:1'], {
      SVEN_STRICT_CONFIG: '1',
    });
    expect(proc.status).toBe(2);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.code).toBe('STRICT_CONFIG_BLOCKED');
    expect(out.command).toBe('install');
  });

  it('supports profile-scoped secure store path', () => {
    const proc = runCli(['auth', 'status', '--profile', 'ci-smoke', '--json']);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(typeof out?.data?.store_path).toBe('string');
    expect(String(out.data.store_path)).toMatch(/profiles[\\/]ci-smoke[\\/]secure-store\.json$/);
  });

  it('exposes a stable exit-code contract', () => {
    const proc = runCli(['exit-codes', '--json']);
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.data.ok).toBe(0);
    expect(out.data.runtime_error).toBe(1);
    expect(out.data.policy_or_validation_error).toBe(2);
  });

  it('does not print token values in auth status output', () => {
    const setProc = runCli(['auth', 'set-adapter-token', 'super-secret-token-value', '--json']);
    expect(setProc.status).toBe(0);

    const statusProc = runCli(['auth', 'status', '--json']);
    expect(statusProc.status).toBe(0);
    const out = JSON.parse(statusProc.stdout || '{}');
    expect(out.status).toBe('ok');
    expect(out.data.adapter_token).toBe(true);
    expect(statusProc.stdout).not.toContain('super-secret-token-value');

    const clearProc = runCli(['auth', 'clear', '--json']);
    expect(clearProc.status).toBe(0);
  });

  it('enforces owner-only permissions for CLI-managed secure-store artifacts on POSIX', () => {
    const tmpRoot = resolve(__dirname, '..', '.tmp-secure-store-perms');
    const secureStorePath = join(tmpRoot, 'profile', 'secure-store.json');
    rmSync(tmpRoot, { recursive: true, force: true });

    const proc = runCliWithEnv(['auth', 'set-cookie', 'session=test', '--json'], {
      SVEN_SECURE_STORE: secureStorePath,
    });

    expect(proc.status).toBe(0);
    expect(existsSync(secureStorePath)).toBe(true);

    if (process.platform !== 'win32') {
      expect(statSync(join(tmpRoot, 'profile')).mode & 0o777).toBe(0o700);
      expect(statSync(secureStorePath).mode & 0o777).toBe(0o600);
    }

    rmSync(tmpRoot, { recursive: true, force: true });
  });
});
