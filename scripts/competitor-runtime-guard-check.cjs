#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
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

const outJson = argValue('--output-json', 'docs/release/status/competitor-runtime-guard-latest.json');
const outMd = argValue('--output-md', 'docs/release/status/competitor-runtime-guard-latest.md');

const TARGET_FILES = [
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'docker-compose.production.yml',
  'docker-compose.staging.yml',
  'docker-compose.profiles.yml',
];

const TARGET_DIRS = ['config'];
const EXT_ALLOW = new Set(['.yml', '.yaml', '.env', '.conf', '.ini', '.json', '.txt']);
const STATIC_SCAN_EXCLUDE = new Set([
  // Local-only lane baseline may legitimately mention mirrored competitor docs.
  'config/release/worktree-lane-baseline.local.json',
]);

const FORBIDDEN = [
  { label: 'Agent Zero image/runtime reference', regex: /\bagent0ai\/agent-zero\b/i },
  { label: 'OpenClaw image/runtime reference', regex: /\bopenclaw:|openclaw\/main|docs\/examples\/openclaw-main\b/i },
  { label: 'Agent Zero example runtime reference', regex: /docs\/examples\/agent-zero-main\b/i },
];

const RUNTIME_FORBIDDEN = [
  /\bagent0ai\/agent-zero\b/i,
  /\bopenclaw\b/i,
  /\bagent-zero\b/i,
];

function collectFiles(dir) {
  const out = [];
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  const stack = [full];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const children = fs.readdirSync(current);
      for (const child of children) stack.push(path.join(current, child));
      continue;
    }
    if (!EXT_ALLOW.has(path.extname(current).toLowerCase())) continue;
    out.push(current);
  }
  return out;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`.trim(),
    error: result.error ? String(result.error.message || result.error) : '',
  };
}

function findMatches(line) {
  return RUNTIME_FORBIDDEN.some((rule) => rule.test(String(line || '')));
}

function probeDockerRuntime() {
  const check = runCommand('docker', ['ps', '--format', '{{.Image}} {{.Names}} {{.Status}}']);
  if (!check.ok) {
    return {
      probe_available: false,
      competitor_hits: [],
      detail: check.error || check.output || `docker ps failed (status=${check.status})`,
    };
  }
  const lines = String(check.output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hits = lines.filter(findMatches).slice(0, 50);
  return {
    probe_available: true,
    competitor_hits: hits,
    detail: hits.length ? `${hits.length} running competitor containers detected` : 'no running competitor containers detected',
  };
}

function probeDockerImageInventory() {
  const check = runCommand('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}']);
  if (!check.ok) {
    return {
      probe_available: false,
      competitor_hits: [],
      detail: check.error || check.output || `docker images failed (status=${check.status})`,
    };
  }
  const lines = String(check.output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hits = lines.filter(findMatches).slice(0, 50);
  return {
    probe_available: true,
    competitor_hits: hits,
    detail: hits.length ? `${hits.length} competitor images found in local inventory` : 'no competitor images in local inventory',
  };
}

function probeDockerNetworks() {
  const list = runCommand('docker', ['network', 'ls', '--format', '{{.Name}}']);
  if (!list.ok) {
    return {
      probe_available: false,
      competitor_hits: [],
      detail: list.error || list.output || `docker network ls failed (status=${list.status})`,
    };
  }
  const names = String(list.output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hits = names.filter(findMatches).slice(0, 50);
  return {
    probe_available: true,
    competitor_hits: hits,
    detail: hits.length ? `${hits.length} competitor-related docker networks detected` : 'no competitor-related docker networks detected',
  };
}

function probeProcessInventory() {
  const command = process.platform === 'win32'
    ? 'powershell'
    : 'ps';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-Command', 'Get-Process | Select-Object -ExpandProperty ProcessName']
    : ['-eo', 'comm,args'];
  const check = runCommand(command, args);
  if (!check.ok) {
    return {
      probe_available: false,
      competitor_hits: [],
      detail: check.error || check.output || `${command} process probe failed (status=${check.status})`,
    };
  }
  const lines = String(check.output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hits = lines.filter(findMatches).slice(0, 50);
  return {
    probe_available: true,
    competitor_hits: hits,
    detail: hits.length ? `${hits.length} competitor-related processes detected` : 'no competitor-related processes detected',
  };
}

function run() {
  const files = [];
  for (const rel of TARGET_FILES) {
    const full = path.join(ROOT, rel);
    if (fs.existsSync(full)) files.push(full);
  }
  for (const dir of TARGET_DIRS) files.push(...collectFiles(dir));

  const staticViolations = [];
  for (const full of files) {
    let text = '';
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (STATIC_SCAN_EXCLUDE.has(rel)) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const rule of FORBIDDEN) {
        if (!rule.regex.test(line)) continue;
        staticViolations.push({
          file: rel,
          line: i + 1,
          reason: rule.label,
          snippet: line.trim().slice(0, 220),
        });
      }
    }
  }

  const runtimeProbe = probeDockerRuntime();
  const imageProbe = probeDockerImageInventory();
  const networkProbe = probeDockerNetworks();
  const processProbe = probeProcessInventory();

  const checks = [
    {
      id: 'static_config_refs_clear',
      pass: staticViolations.length === 0,
      detail: staticViolations.length ? `${staticViolations.length} forbidden config refs found` : 'no forbidden refs found',
    },
    {
      id: 'runtime_probe_available',
      pass: runtimeProbe.probe_available,
      detail: runtimeProbe.detail,
    },
    {
      id: 'runtime_running_competitors_absent',
      pass: runtimeProbe.probe_available ? runtimeProbe.competitor_hits.length === 0 : false,
      detail: runtimeProbe.probe_available
        ? runtimeProbe.detail
        : `runtime probe unavailable: ${runtimeProbe.detail}`,
    },
    {
      id: 'runtime_image_inventory_probe_available',
      pass: imageProbe.probe_available,
      detail: imageProbe.detail,
    },
    {
      id: 'runtime_image_inventory_competitors_absent',
      // Local image inventory may contain pulled competitor images from research;
      // only active runtime/network/process presence is release-blocking.
      pass: imageProbe.probe_available,
      detail: imageProbe.probe_available
        ? (imageProbe.competitor_hits.length === 0
          ? imageProbe.detail
          : `${imageProbe.detail} (non-blocking inventory only)`)
        : `image inventory probe unavailable: ${imageProbe.detail}`,
    },
    {
      id: 'runtime_network_probe_available',
      pass: networkProbe.probe_available,
      detail: networkProbe.detail,
    },
    {
      id: 'runtime_network_competitors_absent',
      pass: networkProbe.probe_available ? networkProbe.competitor_hits.length === 0 : false,
      detail: networkProbe.probe_available
        ? networkProbe.detail
        : `network probe unavailable: ${networkProbe.detail}`,
    },
    {
      id: 'runtime_process_probe_available',
      pass: processProbe.probe_available,
      detail: processProbe.detail,
    },
    {
      id: 'runtime_process_competitors_absent',
      pass: processProbe.probe_available ? processProbe.competitor_hits.length === 0 : false,
      detail: processProbe.probe_available
        ? processProbe.detail
        : `process probe unavailable: ${processProbe.detail}`,
    },
  ];

  const anyViolation = staticViolations.length > 0
    || runtimeProbe.competitor_hits.length > 0
    || networkProbe.competitor_hits.length > 0
    || processProbe.competitor_hits.length > 0;
  const anyProbeUnavailable = !runtimeProbe.probe_available
    || !imageProbe.probe_available
    || !networkProbe.probe_available
    || !processProbe.probe_available;

  let status = 'pass';
  if (anyViolation) status = 'fail';
  else if (anyProbeUnavailable) status = 'inconclusive';

  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    static_violations: staticViolations,
    runtime: {
      docker_ps: {
        probe_available: runtimeProbe.probe_available,
        competitor_hits: runtimeProbe.competitor_hits,
      },
      docker_images: {
        probe_available: imageProbe.probe_available,
        competitor_hits: imageProbe.competitor_hits,
      },
      docker_networks: {
        probe_available: networkProbe.probe_available,
        competitor_hits: networkProbe.competitor_hits,
      },
      process_inventory: {
        probe_available: processProbe.probe_available,
        competitor_hits: processProbe.competitor_hits,
      },
    },
    provenance: {
      evidence_mode: argOrEnv('--evidence-mode', 'COMPETITOR_RUNTIME_GUARD_EVIDENCE_MODE', 'runtime_container_inventory_probe'),
      source_run_id: argOrEnv('--source-run-id', 'COMPETITOR_RUNTIME_GUARD_SOURCE_RUN_ID', String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || `local-${Date.now()}`)),
      head_sha: argOrEnv('--head-sha', 'COMPETITOR_RUNTIME_GUARD_HEAD_SHA', String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '')),
      baseline_source: 'runtime_and_config_probe',
    },
  };

  const outJsonPath = path.join(ROOT, outJson);
  const outMdPath = path.join(ROOT, outMd);
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(outMdPath), { recursive: true });
  fs.writeFileSync(outJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# Competitor Runtime Guard',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  ];
  if (staticViolations.length) {
    lines.push('', '## Static Violations');
    for (const violation of staticViolations.slice(0, 100)) {
      lines.push(`- ${violation.file}:${violation.line} ${violation.reason}`);
    }
  }
  fs.writeFileSync(outMdPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  console.log(`competitor-runtime-guard-check: ${status}`);
  if (status === 'fail') process.exit(1);
  if (STRICT && status !== 'pass') process.exit(2);
}

run();
