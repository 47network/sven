#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const statusDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(statusDir, 'local-temp-cache-governance-latest.json');
const outMd = path.join(statusDir, 'local-temp-cache-governance-latest.md');

function walkFiles(startDir, predicate, acc = []) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, acc);
      continue;
    }
    if (predicate(full)) acc.push(full);
  }
  return acc;
}

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function check(id, pass, detail) {
  return { id, pass: Boolean(pass), detail };
}

function readText(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8');
}

const helperRel = 'scripts/lib/set-project-temp-cache.ps1';
const npmrcRel = '.npmrc';
const quickstartCmdRel = 'deploy/quickstart/install.cmd';

const scriptsDir = path.join(root, 'scripts');
const ps1Files = walkFiles(
  scriptsDir,
  (full) => full.toLowerCase().endsWith('.ps1'),
).map(rel).sort();

const missingBootstrap = [];
for (const file of ps1Files) {
  if (file === helperRel) continue;
  const content = readText(file) || '';
  const hasBootstrap =
    /\bSet-SvenProjectTempAndCache\b/.test(content)
    || /\bSet-ProjectTempAndCache\b/.test(content);
  if (!hasBootstrap) {
    missingBootstrap.push(file);
  }
}

const helperText = readText(helperRel) || '';
const helperExists = fs.existsSync(path.join(root, helperRel));
const helperSetsEnv =
  /\$env:TEMP\s*=/.test(helperText)
  && /\$env:TMP\s*=/.test(helperText)
  && /\$env:npm_config_cache\s*=/.test(helperText);

const npmrcText = readText(npmrcRel) || '';
const npmrcCachePinned = /^cache\s*=\s*\.\/tmp\/npm-cache\s*$/im.test(npmrcText);

const quickstartText = readText(quickstartCmdRel) || '';
const quickstartSetsTemp =
  /^\s*set\s+"TEMP=/im.test(quickstartText)
  && /^\s*set\s+"TMP=/im.test(quickstartText)
  && /^\s*set\s+"npm_config_cache=/im.test(quickstartText);

const checks = [
  check('helper_script_present', helperExists, helperExists ? helperRel : `${helperRel} missing`),
  check(
    'helper_sets_temp_tmp_npm_cache',
    helperSetsEnv,
    helperSetsEnv ? 'TEMP/TMP/npm_config_cache are assigned in helper' : 'helper missing one or more env assignments',
  ),
  check(
    'all_powershell_scripts_bootstrap_project_temp_cache',
    missingBootstrap.length === 0,
    missingBootstrap.length === 0
      ? `covered=${ps1Files.length - 1} scripts`
      : `missing=${missingBootstrap.length}; ${missingBootstrap.join(', ')}`,
  ),
  check(
    'npmrc_cache_pinned_to_repo_tmp',
    npmrcCachePinned,
    npmrcCachePinned ? `${npmrcRel} => ./tmp/npm-cache` : `${npmrcRel} missing cache=./tmp/npm-cache`,
  ),
  check(
    'quickstart_install_cmd_sets_repo_local_temp_cache',
    quickstartSetsTemp,
    quickstartSetsTemp
      ? `${quickstartCmdRel} sets TEMP/TMP/npm_config_cache`
      : `${quickstartCmdRel} missing TEMP/TMP/npm_config_cache assignments`,
  ),
];

const failed = checks.filter((c) => !c.pass);
const report = {
  generated_at: new Date().toISOString(),
  status: failed.length === 0 ? 'pass' : 'fail',
  passed: checks.length - failed.length,
  failed: failed.length,
  checks,
  inventory: {
    powershell_script_count: ps1Files.length,
    powershell_scripts_missing_bootstrap: missingBootstrap,
  },
};

fs.mkdirSync(statusDir, { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const md = [
  '# Local Temp/Cache Governance',
  '',
  `Generated: ${report.generated_at}`,
  `Status: ${report.status}`,
  '',
  '## Checks',
  ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
  '',
  '## Inventory',
  `- powershell_script_count: ${report.inventory.powershell_script_count}`,
  `- powershell_scripts_missing_bootstrap: ${report.inventory.powershell_scripts_missing_bootstrap.length}`,
  ...report.inventory.powershell_scripts_missing_bootstrap.map((f) => `  - ${f}`),
];
fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

console.log(`Wrote ${rel(outJson)}`);
console.log(`Wrote ${rel(outMd)}`);

if (strict && report.status !== 'pass') {
  process.exit(2);
}

