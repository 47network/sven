#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'agent-zero-community-runtime-latest.json');
const outMd = path.join(outDir, 'agent-zero-community-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
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

  const communityTestsRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'community-status.unit.test.ts',
    'community-persona-verification.unit.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'community_runtime_unit_tests_check',
    'npm --prefix services/gateway-api run test -- community-status.unit.test.ts community-persona-verification.unit.test.ts --runInBand',
    communityTestsRun,
  ));

  checks.push({
    id: 'community_runtime_tests_pass',
    pass: commandRuns.every((runItem) => runItem.pass),
    detail: 'community status policy + persona verification runtime unit tests pass',
  });

  const communityRouteSource = readUtf8('services/gateway-api/src/routes/admin/community.ts');
  checks.push({
    id: 'community_public_endpoints_surface_present',
    pass: hasAll(communityRouteSource, [
      '/v1/public/community/status',
      '/v1/public/community/feed',
      '/v1/public/community/leaderboard',
      '/v1/public/community/capability-proof',
      '/v1/public/community/access-request',
    ]),
    detail: 'public community status/feed/leaderboard/capability/access-request endpoints are implemented',
  });

  checks.push({
    id: 'verified_persona_safety_posture_surface_present',
    pass: hasAll(communityRouteSource, [
      'verified_persona_only',
      'reviewed_only',
      'moderation_guardrails',
      'resolvePersonaVerificationEvidence(',
      'SVEN_COMMUNITY_PERSONA_ALLOWLIST',
      'SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED',
    ]),
    detail: 'verified-persona + strict moderation + baseline readiness safety posture is implemented',
  });

  const canvasCommunitySource = readUtf8('apps/canvas-ui/src/app/community/page.tsx');
  const adminCommunitySource = readUtf8('apps/admin-ui/src/app/community-public/page.tsx');
  checks.push({
    id: 'community_ui_runtime_surface_present',
    pass: hasAll(canvasCommunitySource, [
      "/v1/public/community/status",
      "/v1/public/community/feed",
      "/v1/public/community/leaderboard",
      "/v1/public/community/capability-proof",
      "/v1/public/community/access-request",
    ]) && hasAll(adminCommunitySource, [
      "/v1/public/community/status",
      "/v1/public/community/feed",
      "/v1/public/community/leaderboard",
      "/v1/public/community/capability-proof",
    ]),
    detail: 'community pages consume public community endpoints in runtime UI surfaces',
  });

  checks.push({
    id: 'community_governance_docs_present',
    pass:
      exists('docs/community/sven-community-platform-and-trust-model.md') &&
      exists('docs/community/skill-submission-process.md') &&
      exists('docs/community/verified-publisher-badges.md'),
    detail: 'community trust/governance documentation set is present',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_agent_zero_rows: ['9.6'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/routes/admin/community.ts',
      'services/gateway-api/src/__tests__/community-status.unit.test.ts',
      'services/gateway-api/src/__tests__/community-persona-verification.unit.test.ts',
      'apps/canvas-ui/src/app/community/page.tsx',
      'apps/admin-ui/src/app/community-public/page.tsx',
      'docs/community/sven-community-platform-and-trust-model.md',
      'docs/community/skill-submission-process.md',
      'docs/community/verified-publisher-badges.md',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Agent Zero Community Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped Agent Zero rows: ${payload.mapped_agent_zero_rows.join(', ')}`,
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
  console.log(`agent-zero-community-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();

