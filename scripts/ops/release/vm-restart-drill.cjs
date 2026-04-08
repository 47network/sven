#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const execute = process.argv.includes('--execute');
const outStatusDir = path.join(root, 'docs', 'release', 'status');
const outEvidenceDir = path.join(root, 'docs', 'release', 'evidence');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function rel(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, '/');
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    code: result.status ?? -1,
    out: String(result.stdout || '').trim(),
    err: String(result.stderr || '').trim(),
  };
}

function gitHeadSha() {
  const res = run('git', ['rev-parse', 'HEAD']);
  return res.code === 0 ? res.out.trim() : '';
}

function commandRecord(step, shellCommand, enabled) {
  const startedAt = new Date().toISOString();
  if (!enabled) {
    return {
      step,
      command: shellCommand,
      started_at: startedAt,
      ended_at: startedAt,
      pass: true,
      skipped: true,
      exit_code: 0,
      detail: 'plan-only (execution not requested)',
      stdout_tail: '',
      stderr_tail: '',
    };
  }

  const result = run('/bin/bash', ['-lc', shellCommand]);
  const endedAt = new Date().toISOString();
  return {
    step,
    command: shellCommand,
    started_at: startedAt,
    ended_at: endedAt,
    pass: result.code === 0,
    skipped: false,
    exit_code: result.code,
    detail: result.code === 0 ? 'ok' : (result.err || result.out || `exit ${result.code}`),
    stdout_tail: result.out.split('\n').slice(-20).join('\n'),
    stderr_tail: result.err.split('\n').slice(-20).join('\n'),
  };
}

function main() {
  const envFile = process.env.SVEN_MULTI_VM_ENV_FILE || 'deploy/multi-vm/.env';
  const vm5Profiles = String(process.env.SVEN_VM5_PROFILES || '').trim();
  const vm7Profiles = String(process.env.SVEN_VM7_PROFILES || 'adapters tunnel').trim();

  const vm5Compose = 'deploy/multi-vm/docker-compose.vm5-ai.yml';
  const vm7Compose = 'deploy/multi-vm/docker-compose.vm7-adapters.yml';
  const vm5ProfileArgs = vm5Profiles ? vm5Profiles.split(/\s+/).map((profile) => `--profile ${profile}`).join(' ') : '';
  const vm7ProfileArgs = vm7Profiles ? vm7Profiles.split(/\s+/).map((profile) => `--profile ${profile}`).join(' ') : '';

  const steps = [
    {
      step: 'vm5_restart_wait',
      command: `sudo docker compose -f ${vm5Compose} --env-file ${envFile} ${vm5ProfileArgs} up -d --wait`.replace(/\s+/g, ' ').trim(),
    },
    {
      step: 'vm5_status',
      command: `sudo docker compose -f ${vm5Compose} --env-file ${envFile} ps`.replace(/\s+/g, ' ').trim(),
    },
    {
      step: 'vm7_restart_wait',
      command: `sudo docker compose -f ${vm7Compose} --env-file ${envFile} ${vm7ProfileArgs} up -d --wait`.replace(/\s+/g, ' ').trim(),
    },
    {
      step: 'vm7_status',
      command: `sudo docker compose -f ${vm7Compose} --env-file ${envFile} ${vm7ProfileArgs} ps`.replace(/\s+/g, ' ').trim(),
    },
    {
      step: 'repo_contract',
      command: 'npm run -s release:multi-vm:restart:health:check',
    },
  ];

  const records = steps.map((item) => commandRecord(item.step, item.command, execute));
  const failed = records.filter((record) => !record.pass);
  const status = failed.length === 0 ? (execute ? 'pass' : 'planned') : 'fail';

  const report = {
    generated_at: new Date().toISOString(),
    status,
    execution_mode: execute ? 'executed' : 'planned',
    env_file: envFile,
    vm5_compose: vm5Compose,
    vm7_compose: vm7Compose,
    vm7_profiles: vm7Profiles.split(/\s+/).filter(Boolean),
    head_sha: gitHeadSha() || null,
    commands: records,
  };

  fs.mkdirSync(outStatusDir, { recursive: true });
  fs.mkdirSync(outEvidenceDir, { recursive: true });
  const latestJson = path.join(outStatusDir, 'vm-restart-drill-latest.json');
  const latestMd = path.join(outStatusDir, 'vm-restart-drill-latest.md');
  const datedJson = path.join(outEvidenceDir, `vm-restart-drill-${timestamp}.json`);
  const datedMd = path.join(outEvidenceDir, `vm-restart-drill-${timestamp}.md`);
  const latestEvidenceJson = path.join(outEvidenceDir, 'vm-restart-drill-latest.json');
  const latestEvidenceMd = path.join(outEvidenceDir, 'vm-restart-drill-latest.md');

  const md = [
    '# VM Restart Drill',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Execution mode: ${report.execution_mode}`,
    `Env file: ${report.env_file}`,
    `Head SHA: ${report.head_sha || '(missing)'}`,
    '',
    '## Commands',
    ...records.map((record) => `- [${record.pass ? 'x' : ' '}] ${record.step}: ${record.command} -> ${record.detail}`),
    '',
  ].join('\n');

  for (const target of [latestJson, datedJson, latestEvidenceJson]) {
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  for (const target of [latestMd, datedMd, latestEvidenceMd]) {
    fs.writeFileSync(target, `${md}\n`, 'utf8');
  }

  console.log(`Wrote ${rel(latestJson)}`);
  console.log(`Wrote ${rel(latestMd)}`);
  console.log(`Wrote ${rel(datedJson)}`);
  console.log(`Wrote ${rel(datedMd)}`);
  console.log(`Wrote ${rel(latestEvidenceJson)}`);
  console.log(`Wrote ${rel(latestEvidenceMd)}`);

  if (strict && status === 'fail') {
    process.exit(2);
  }
}

main();
