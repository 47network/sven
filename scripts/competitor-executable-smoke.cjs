#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outJsonRel = 'docs/release/status/competitor-executable-smoke-latest.json';
const outMdRel = 'docs/release/status/competitor-executable-smoke-latest.md';

const commands = [
  {
    id: 'shared_build',
    command: 'npm run --workspace packages/shared build',
  },
  {
    id: 'gateway_parity_contracts',
    command: [
      'npm run --workspace services/gateway-api test -- --runTestsByPath',
      'src/__tests__/parity-integration-runtime-truthfulness-2026-03-12.contract.test.ts',
      'src/__tests__/parity-integration-skills-truthfulness-2026-03-12.contract.test.ts',
      'src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts',
      'src/__tests__/parity-all-waves-closeout-contract.test.ts',
      'src/__tests__/parity-checklist-verify-wave-closeout.contract.test.ts',
    ].join(' '),
  },
];

function runCommand(entry) {
  const started = Date.now();
  const localTemp = path.join(root, 'tmp', 'competitor-exec-smoke', 'temp');
  const localCache = path.join(root, 'tmp', 'competitor-exec-smoke', 'cache');
  fs.mkdirSync(localTemp, { recursive: true });
  fs.mkdirSync(localCache, { recursive: true });
  try {
    execSync(entry.command, {
      cwd: root,
      stdio: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        TEMP: localTemp,
        TMP: localTemp,
        TMPDIR: localTemp,
        XDG_CACHE_HOME: localCache,
      },
    });
    return {
      id: entry.id,
      command: entry.command,
      status: 'pass',
      duration_ms: Date.now() - started,
    };
  } catch (error) {
    const stderr = String(error?.stderr || '').trim();
    const stdout = String(error?.stdout || '').trim();
    return {
      id: entry.id,
      command: entry.command,
      status: 'fail',
      duration_ms: Date.now() - started,
      exit_code: Number.isFinite(error?.status) ? error.status : 1,
      output_excerpt: (stderr || stdout).split(/\r?\n/).slice(-60),
    };
  }
}

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function run() {
  const startedAt = new Date().toISOString();
  const results = commands.map(runCommand);
  const passed = results.filter((row) => row.status === 'pass').length;
  const failed = results.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';

  const sourceRunId =
    String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim()
    || `local-${Date.now()}`;
  const headSha =
    String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim()
    || (() => {
      try {
        return execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString('utf8')
          .trim();
      } catch {
        return '';
      }
    })();

  const payload = {
    generated_at: new Date().toISOString(),
    status,
    summary: {
      total_commands: results.length,
      passed,
      failed,
    },
    commands: results,
    provenance: {
      source_run_id: sourceRunId,
      head_sha: headSha || null,
      evidence_mode: 'competitor_executable_smoke',
      started_at: startedAt,
    },
  };

  write(outJsonRel, `${JSON.stringify(payload, null, 2)}\n`);

  const md = [
    '# Competitor Executable Smoke',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    '',
    '## Summary',
    `- total commands: ${payload.summary.total_commands}`,
    `- passed: ${payload.summary.passed}`,
    `- failed: ${payload.summary.failed}`,
    '',
    '## Commands',
    ...results.map((row) => `- [${row.status === 'pass' ? 'x' : ' '}] ${row.id}: ${row.command}`),
    '',
  ];

  const failures = results.filter((row) => row.status !== 'pass');
  if (failures.length > 0) {
    md.push('## Failure Excerpts');
    for (const failure of failures) {
      md.push(`- ${failure.id} (exit=${failure.exit_code})`);
      for (const line of failure.output_excerpt || []) {
        md.push(`  - ${line}`);
      }
    }
    md.push('');
  }

  write(outMdRel, `${md.join('\n')}\n`);

  console.log(`Wrote ${outJsonRel}`);
  console.log(`Wrote ${outMdRel}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
