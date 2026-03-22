#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  const waveArtifacts = [
    { id: 'wave1', relPath: path.join('docs', 'release', 'status', 'openhands-wave1-closeout-latest.json') },
    { id: 'wave2', relPath: path.join('docs', 'release', 'status', 'librechat-wave2-closeout-latest.json') },
    { id: 'wave3', relPath: path.join('docs', 'release', 'status', 'n8n-wave3-closeout-latest.json') },
    { id: 'wave4', relPath: path.join('docs', 'release', 'status', 'framework-wave4-closeout-latest.json') },
    { id: 'wave5', relPath: path.join('docs', 'release', 'status', 'crewai-wave5-closeout-latest.json') },
    { id: 'wave6', relPath: path.join('docs', 'release', 'status', 'letta-wave6-closeout-latest.json') },
    { id: 'wave7', relPath: path.join('docs', 'release', 'status', 'autogen-wave7-closeout-latest.json') },
    { id: 'wave8', relPath: path.join('docs', 'release', 'status', 'langgraph-wave8-closeout-latest.json') },
  ];

  const waveResults = waveArtifacts.map((wave) => {
    if (!exists(wave.relPath)) {
      return { ...wave, present: false, status: 'missing' };
    }
    const report = readJson(wave.relPath);
    return { ...wave, present: true, status: String(report.status || 'unknown') };
  });

  add(
    'parity_all_waves_closeout_artifacts_present',
    waveResults.every((wave) => wave.present),
    waveResults.map((wave) => `${wave.id}:${wave.present ? 'present' : 'missing'}`).join(', '),
  );

  add(
    'parity_all_waves_closeout_status_pass',
    waveResults.every((wave) => wave.status === 'pass'),
    waveResults.map((wave) => `${wave.id}:${wave.status}`).join(', '),
  );

  const workflow = read('.github/workflows/parity-e2e.yml');
  add(
    'parity_all_waves_ci_binding_present',
    workflow.includes('npm run -s release:parity:all-waves:closeout') &&
      workflow.includes('parity-all-waves-closeout-latest.json') &&
      workflow.includes('parity-all-waves-closeout-latest.md'),
    'parity-e2e workflow executes and uploads the unified all-waves closeout artifact',
  );

  const pkg = read('package.json');
  add(
    'parity_all_waves_npm_aliases_present',
    pkg.includes('"release:parity:all-waves:closeout"') &&
      pkg.includes('"release:parity:all-waves:closeout:local"'),
    'package.json exposes all-waves closeout aliases',
  );

  const program = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  add(
    'parity_all_waves_program_snapshot_present',
    program.includes('Unified all-waves closeout:') &&
      program.includes('docs/release/status/parity-all-waves-closeout-latest.json'),
    'competitive reproduction program includes all-waves closeout snapshot pointer',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = { generated_at: generatedAt, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'parity-all-waves-closeout-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'parity-all-waves-closeout-latest.md'),
    [
      '# Parity All-Waves Closeout Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
