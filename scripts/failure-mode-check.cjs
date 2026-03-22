#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function nowIso() {
  return new Date().toISOString();
}

const API_URL = argValue('--api-url', process.env.API_URL || 'http://localhost:3000');
const COOKIE = argValue('--cookie', process.env.COOKIE || '');
const OUTPUT_JSON = argValue('--output-json', 'docs/release/status/failure-mode-latest.json');
const OUTPUT_MD = argValue('--output-md', 'docs/release/status/failure-mode-latest.md');

const SCENARIOS = [
  {
    id: 'postgres_pool_exhaustion',
    title: 'PostgreSQL Connection Pool Exhaustion',
    checklist: 'PostgreSQL connection pool exhaustion: verify graceful degradation',
    envPrefix: 'FM_POSTGRES',
  },
  {
    id: 'nats_disconnect',
    title: 'NATS Disconnect',
    checklist: 'NATS disconnect: verify reconnection + message replay',
    envPrefix: 'FM_NATS',
  },
  {
    id: 'opensearch_down',
    title: 'OpenSearch Down',
    checklist: 'OpenSearch down: verify RAG degrades to vector-only (pgvector)',
    envPrefix: 'FM_OPENSEARCH',
  },
  {
    id: 'llm_provider_down',
    title: 'LLM Provider Down',
    checklist: 'LLM provider down: verify failover to next provider',
    envPrefix: 'FM_LLM',
  },
  {
    id: 'disk_full',
    title: 'Disk Full',
    checklist: 'Disk full: verify alerting + service stability',
    envPrefix: 'FM_DISK',
  },
  {
    id: 'oom_restart',
    title: 'OOM Restart',
    checklist: 'OOM: verify container restart with state recovery',
    envPrefix: 'FM_OOM',
  },
];

async function request(path) {
  const headers = {};
  if (COOKIE) headers.Cookie = COOKIE;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(`${API_URL}${path}`, { method: 'GET', headers });
      return { status: res.status, error: '' };
    } catch (err) {
      const error = err && typeof err === 'object' && 'message' in err ? String(err.message || '') : String(err);
      if (attempt === 4) {
        return { status: 0, error };
      }
      // transient socket errors happen during restart drills; retry before failing the step.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return { status: 0, error: 'unexpected request retry exhaustion' };
}

function runCommand(label, command) {
  if (!command) return { ok: true, skipped: true, command: '', output: '' };
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, skipped: false, command, output: String(output || '').trim() };
  } catch (err) {
    const output = err && typeof err === 'object' && 'stderr' in err
      ? String(err.stderr || '').trim()
      : String(err);
    return { ok: false, skipped: false, command, output: `${label} failed: ${output}` };
  }
}

async function runScenario(scenario) {
  const p = scenario.envPrefix;
  const induce = process.env[`${p}_INDUCE_CMD`] || '';
  const verifyDegraded = process.env[`${p}_VERIFY_DEGRADED_CMD`] || '';
  const recover = process.env[`${p}_RECOVER_CMD`] || '';
  const verifyRecovered = process.env[`${p}_VERIFY_RECOVERED_CMD`] || '';

  if (!induce || !verifyDegraded || !recover || !verifyRecovered) {
    return {
      id: scenario.id,
      title: scenario.title,
      checklist: scenario.checklist,
      status: 'skipped',
      reason: `Missing one or more required env commands: ${p}_INDUCE_CMD, ${p}_VERIFY_DEGRADED_CMD, ${p}_RECOVER_CMD, ${p}_VERIFY_RECOVERED_CMD`,
      started_at: nowIso(),
      finished_at: nowIso(),
      steps: [],
    };
  }

  const startedAt = nowIso();
  const steps = [];

  const baselineHealth = await request('/healthz');
  steps.push({
    step: 'baseline_health',
    ok: baselineHealth.status === 200,
    detail: baselineHealth.error
      ? `GET /healthz => ${baselineHealth.status} (${baselineHealth.error})`
      : `GET /healthz => ${baselineHealth.status}`,
  });

  const induceRes = runCommand('induce', induce);
  steps.push({ step: 'induce', ok: induceRes.ok, detail: induceRes.command });
  if (!induceRes.ok) {
    return {
      id: scenario.id,
      title: scenario.title,
      checklist: scenario.checklist,
      status: 'failed',
      started_at: startedAt,
      finished_at: nowIso(),
      reason: induceRes.output,
      steps,
    };
  }

  const degradedRes = runCommand('verify_degraded', verifyDegraded);
  steps.push({ step: 'verify_degraded', ok: degradedRes.ok, detail: degradedRes.command });

  const recoverRes = runCommand('recover', recover);
  steps.push({ step: 'recover', ok: recoverRes.ok, detail: recoverRes.command });

  const recoveredRes = runCommand('verify_recovered', verifyRecovered);
  steps.push({ step: 'verify_recovered', ok: recoveredRes.ok, detail: recoveredRes.command });

  const postHealth = await request('/healthz');
  steps.push({
    step: 'post_health',
    ok: postHealth.status === 200,
    detail: postHealth.error
      ? `GET /healthz => ${postHealth.status} (${postHealth.error})`
      : `GET /healthz => ${postHealth.status}`,
  });

  const passed = steps.every((s) => s.ok);
  return {
    id: scenario.id,
    title: scenario.title,
    checklist: scenario.checklist,
    status: passed ? 'passed' : 'failed',
    started_at: startedAt,
    finished_at: nowIso(),
    reason: passed ? '' : 'One or more steps failed',
    steps,
  };
}

function writeOutputs(payload) {
  mkdirSync(dirname(OUTPUT_JSON), { recursive: true });
  mkdirSync(dirname(OUTPUT_MD), { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push('# Failure Mode Check');
  lines.push('');
  lines.push(`Generated: ${payload.generated_at}`);
  lines.push(`API base: ${payload.api_url}`);
  lines.push(`Status: ${payload.status}`);
  lines.push('');
  lines.push('## Scenarios');
  for (const s of payload.scenarios) {
    lines.push(`- ${s.id}: ${s.status}`);
    if (s.reason) lines.push(`  reason: ${s.reason}`);
  }
  lines.push('');
  lines.push('## Env Command Contract');
  lines.push('- For each scenario, set four env vars:');
  lines.push('- `<PREFIX>_INDUCE_CMD`');
  lines.push('- `<PREFIX>_VERIFY_DEGRADED_CMD`');
  lines.push('- `<PREFIX>_RECOVER_CMD`');
  lines.push('- `<PREFIX>_VERIFY_RECOVERED_CMD`');
  lines.push('');
  lines.push('Prefixes:');
  lines.push('- `FM_POSTGRES`, `FM_NATS`, `FM_OPENSEARCH`, `FM_LLM`, `FM_DISK`, `FM_OOM`');
  lines.push('');
  writeFileSync(OUTPUT_MD, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const scenarios = [];
  for (const scenario of SCENARIOS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runScenario(scenario);
    scenarios.push(result);
  }

  const failed = scenarios.filter((s) => s.status === 'failed').length;
  const passed = scenarios.filter((s) => s.status === 'passed').length;
  const skipped = scenarios.filter((s) => s.status === 'skipped').length;
  const status = failed > 0 ? 'fail' : 'pass';

  const payload = {
    generated_at: nowIso(),
    api_url: API_URL,
    status,
    summary: { passed, failed, skipped, total: scenarios.length },
    scenarios,
  };

  writeOutputs(payload);
  console.log(`failure-mode-check: ${status} (passed=${passed} failed=${failed} skipped=${skipped})`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('failure-mode-check fatal:', err);
  process.exit(1);
});
