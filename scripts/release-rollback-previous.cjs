#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return String(process.argv[index + 1] || '').trim();
}

function run() {
  const rollbackCmd =
    parseArg('--command') ||
    String(process.env.SVEN_ROLLBACK_PREVIOUS_CMD || '').trim();

  if (!rollbackCmd) {
    console.error(
      'Missing rollback command. Provide --command "<cmd>" or set SVEN_ROLLBACK_PREVIOUS_CMD.',
    );
    process.exit(2);
  }

  const startedAt = new Date();
  let ok = false;
  let error = '';
  try {
    console.log(`[rollback] executing previous-release command: ${rollbackCmd}`);
    execSync(rollbackCmd, { stdio: 'inherit', cwd: root, shell: true });

    console.log('[rollback] running post-rollback verification: release:verify:post');
    execSync('npm run release:verify:post', { stdio: 'inherit', cwd: root, shell: true });

    console.log('[rollback] running admin SLO verification: release:admin:dashboard:slo:auth');
    execSync('npm run release:admin:dashboard:slo:auth', { stdio: 'inherit', cwd: root, shell: true });
    ok = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    ok = false;
  }

  const finishedAt = new Date();
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generated_at: finishedAt.toISOString(),
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    status: ok ? 'pass' : 'fail',
    rollback_command: rollbackCmd,
    checks: [
      {
        id: 'rollback_command_executed',
        pass: ok,
        detail: ok ? 'previous release command + post-verify checks completed' : error || 'failed',
      },
    ],
  };
  fs.writeFileSync(
    path.join(outDir, 'rollback-last-run.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  const lines = [
    '# Rollback Last Run',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Command: \`${rollbackCmd}\``,
    '',
    '## Checks',
    `- [${ok ? 'x' : ' '}] rollback_command_executed: ${report.checks[0].detail}`,
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'rollback-last-run.md'), `${lines.join('\n')}\n`, 'utf8');

  if (!ok) {
    process.exit(1);
  }
}

run();
