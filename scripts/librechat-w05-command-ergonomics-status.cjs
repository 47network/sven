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

function run() {
  const commandSource = read('services/agent-runtime/src/chat-commands.ts');
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/command-ergonomics.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w05_directive_parser_present',
    commandSource.includes('function parseDirective(text: string): CommandParseResult | null') &&
      commandSource.includes('/^\\s*sven(?::|\\s+)(.+)$/i') &&
      commandSource.includes("viaDirective: true"),
    'directive parsing supports sven: and sven ... forms',
  );

  add(
    'librechat_w05_prefix_config_present',
    commandSource.includes('async function getCommandPrefix(pool: pg.Pool): Promise<string>') &&
      commandSource.includes("SELECT value FROM settings_global WHERE key = 'chat.commands.prefix' LIMIT 1"),
    'command parser resolves configurable prefix from settings',
  );

  add(
    'librechat_w05_alias_surface_present',
    commandSource.includes("case 'skills':") &&
      commandSource.includes("case 'skill':") &&
      commandSource.includes('Active skills:'),
    'skills command alias surface is present and unified',
  );

  add(
    'librechat_w05_runtime_test_coverage_present',
    runtimeTestSource.includes('supports directive form (sven: version)') &&
      runtimeTestSource.includes('supports configurable command prefix') &&
      runtimeTestSource.includes('keeps /skill and /skills aliases equivalent'),
    'runtime tests cover directive/prefix/alias ergonomics',
  );

  add(
    'librechat_w05_matrix_binding_present',
    matrixSource.includes('| LC-W05 | Slash-command ergonomics parity (help, aliases, directive mode) | implemented |') &&
      matrixSource.includes('librechat_parity_w05_command_ergonomics_contract'),
    'Wave 2 matrix binds LC-W05 to contract test and evidence ID',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = {
    generated_at: generatedAt,
    status,
    passed,
    failed,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'librechat-w05-command-ergonomics-latest.json');
  const outMd = path.join(outDir, 'librechat-w05-command-ergonomics-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W05 Command Ergonomics Status',
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
