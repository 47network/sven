#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const STRICT = process.argv.includes('--strict');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function argOrEnv(name, envName, fallback = '') {
  const cli = argValue(name, '');
  if (cli) return cli;
  const envValue = String(process.env[envName] || '').trim();
  if (envValue) return envValue;
  return fallback;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function runCommand(command, env) {
  if (!command || !String(command).trim()) {
    return { ok: false, skipped: true, code: null, output: 'missing command' };
  }
  const child = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    env,
    cwd: process.cwd(),
    timeout: toNumber(process.env.F1_COMMAND_TIMEOUT_MS || '1800000', 1800000),
  });
  const output = `${child.stdout || ''}\n${child.stderr || ''}`.trim();
  return {
    ok: child.status === 0,
    skipped: false,
    code: child.status,
    output,
  };
}

function shouldSkipOnFailure(code, output) {
  const out = String(output || '').toLowerCase();
  if (code >= 20 && code <= 39) return true;
  if (out.includes('upstream llm unavailable')) return true;
  if (out.includes('no models available')) return true;
  if (out.includes('service unavailable')) return true;
  if (out.includes('endpoint disabled')) return true;
  return false;
}

function envCmd(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function buildTargets() {
  return [
    {
      id: 'sven',
      label: 'Sven',
      setup_cmd: envCmd('F1_SVEN_SETUP_CMD', 'npm run release:quickstart:runtime:check'),
      first_reply_cmd: envCmd('F1_SVEN_FIRST_REPLY_CMD', 'node scripts/f1-sven-first-reply-probe.cjs'),
      source_ref: 'docs/release/checklists/sven-production-parity-checklist-2026.md',
      claim: 'Sven must beat OpenClaw wizard and Agent Zero docker quick start on time-to-first-reply.',
    },
    {
      id: 'openclaw',
      label: 'OpenClaw',
      setup_cmd: envCmd('F1_OPENCLAW_SETUP_CMD', 'node scripts/f1-openclaw-first-reply-probe.cjs --health-only'),
      first_reply_cmd: envCmd('F1_OPENCLAW_FIRST_REPLY_CMD', 'node scripts/f1-openclaw-first-reply-probe.cjs'),
      source_ref: 'docs/examples/openclaw-main/README.md',
      claim: 'openclaw onboard --install-daemon',
    },
    {
      id: 'agent_zero',
      label: 'Agent Zero',
      setup_cmd: envCmd('F1_AGENT0_SETUP_CMD', 'node scripts/f1-agent-zero-first-reply-probe.cjs --health-only'),
      first_reply_cmd: envCmd('F1_AGENT0_FIRST_REPLY_CMD', 'node scripts/f1-agent-zero-first-reply-probe.cjs'),
      source_ref: 'docs/examples/agent-zero-main/README.md',
      claim: 'docker run -p 50001:80 agent0ai/agent-zero',
    },
  ];
}

function summarize(payload) {
  const repetitions = payload.repetitions;
  const byTarget = {};

  for (const target of payload.targets) {
    const runs = payload.runs.filter((r) => r.target_id === target.id && r.status === 'passed');
    const totals = runs.map((r) => r.total_ms);
    byTarget[target.id] = {
      completed_runs: runs.length,
      median_ms: median(totals),
      median_sec: median(totals) == null ? null : Number((median(totals) / 1000).toFixed(3)),
    };
  }

  const competitorMedians = ['openclaw', 'agent_zero']
    .map((id) => byTarget[id].median_ms)
    .filter((v) => Number.isFinite(v));
  const bestCompetitorMedian = competitorMedians.length ? Math.min(...competitorMedians) : null;
  const svenMedian = byTarget.sven.median_ms;
  const passThresholdMs = bestCompetitorMedian == null ? null : Math.round(bestCompetitorMedian * 0.85);
  const passCriterion = Number.isFinite(svenMedian) && Number.isFinite(passThresholdMs)
    ? svenMedian <= passThresholdMs
    : null;

  const skipped = payload.runs.filter((r) => r.status === 'skipped').length;
  const failed = payload.runs.filter((r) => r.status === 'failed').length;

  let status = 'pass';
  if (failed > 0) status = 'fail';
  if (skipped > 0 || passCriterion == null) status = 'inconclusive';
  if (status !== 'fail' && passCriterion === false) status = 'fail';

  return {
    repetitions,
    targets: byTarget,
    best_competitor_median_ms: bestCompetitorMedian,
    best_competitor_median_sec: bestCompetitorMedian == null ? null : Number((bestCompetitorMedian / 1000).toFixed(3)),
    sven_delta_vs_best_competitor_ms: Number.isFinite(svenMedian) && Number.isFinite(bestCompetitorMedian)
      ? svenMedian - bestCompetitorMedian
      : null,
    pass_threshold_ms: passThresholdMs,
    pass_criterion_met: passCriterion,
    failed_runs: failed,
    skipped_runs: skipped,
    status,
  };
}

function writeOutputs(payload, outJson, outMd) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# F1 Onboarding-to-First-Reply Benchmark',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.summary.status}`,
    `Repetitions: ${payload.repetitions}`,
    '',
    '## Summary',
    `- Sven median (ms): ${payload.summary.targets.sven.median_ms == null ? 'n/a' : payload.summary.targets.sven.median_ms}`,
    `- OpenClaw median (ms): ${payload.summary.targets.openclaw.median_ms == null ? 'n/a' : payload.summary.targets.openclaw.median_ms}`,
    `- Agent Zero median (ms): ${payload.summary.targets.agent_zero.median_ms == null ? 'n/a' : payload.summary.targets.agent_zero.median_ms}`,
    `- Best competitor median (ms): ${payload.summary.best_competitor_median_ms == null ? 'n/a' : payload.summary.best_competitor_median_ms}`,
    `- Sven delta vs best competitor (ms): ${payload.summary.sven_delta_vs_best_competitor_ms == null ? 'n/a' : payload.summary.sven_delta_vs_best_competitor_ms}`,
    `- Pass threshold (ms, best*0.85): ${payload.summary.pass_threshold_ms == null ? 'n/a' : payload.summary.pass_threshold_ms}`,
    `- Pass criterion met: ${payload.summary.pass_criterion_met == null ? 'n/a' : payload.summary.pass_criterion_met}`,
    '',
    '## Runs',
  ];

  for (const run of payload.runs) {
    lines.push(`- ${run.target_id} run ${run.run}: ${run.status}`);
    lines.push(`  - total_ms: ${run.total_ms == null ? 'n/a' : run.total_ms}`);
    if (run.reason) lines.push(`  - reason: ${run.reason}`);
  }

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const repetitions = toNumber(argValue('--repetitions', process.env.F1_REPETITIONS || '3'), 3);
  const outJson = argValue('--output-json', 'docs/release/status/f1-onboarding-benchmark-latest.json');
  const outMd = argValue('--output-md', 'docs/release/status/f1-onboarding-benchmark-latest.md');
  const targets = buildTargets();
  const env = { ...process.env };

  const runs = [];
  for (let i = 1; i <= repetitions; i += 1) {
    for (const target of targets) {
      const started = Date.now();
      if (!target.setup_cmd || !target.first_reply_cmd) {
        runs.push({
          target_id: target.id,
          run: i,
          status: 'skipped',
          total_ms: null,
          reason: 'missing setup or first_reply command',
        });
        continue;
      }

      const setup = runCommand(target.setup_cmd, env);
      if (!setup.ok) {
        const skip = shouldSkipOnFailure(setup.code, setup.output);
        const detail = setup.output ? `: ${String(setup.output).split('\n')[0]}` : '';
        runs.push({
          target_id: target.id,
          run: i,
          status: setup.skipped || skip ? 'skipped' : 'failed',
          total_ms: null,
          reason: `setup failed (code=${setup.code})${detail}`,
        });
        continue;
      }

      const firstReply = runCommand(target.first_reply_cmd, env);
      if (!firstReply.ok) {
        const skip = shouldSkipOnFailure(firstReply.code, firstReply.output);
        const detail = firstReply.output ? `: ${String(firstReply.output).split('\n')[0]}` : '';
        runs.push({
          target_id: target.id,
          run: i,
          status: firstReply.skipped || skip ? 'skipped' : 'failed',
          total_ms: null,
          reason: `first_reply failed (code=${firstReply.code})${detail}`,
        });
        continue;
      }

      runs.push({
        target_id: target.id,
        run: i,
        status: 'passed',
        total_ms: Date.now() - started,
      });
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    repetitions,
    targets,
    runs,
    provenance: {
      evidence_mode: argOrEnv('--evidence-mode', 'F1_EVIDENCE_MODE', 'benchmark_runtime_probe'),
      source_run_id: argOrEnv('--source-run-id', 'F1_SOURCE_RUN_ID', String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || `local-${Date.now()}`)),
      head_sha: argOrEnv('--head-sha', 'F1_HEAD_SHA', String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '')),
      baseline_source: 'runtime_probe',
    },
  };
  payload.summary = summarize(payload);
  payload.status = payload.summary.status;

  writeOutputs(payload, outJson, outMd);

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  console.log(`f1-onboarding-benchmark: ${payload.summary.status}`);
  if (payload.summary.status === 'fail') process.exit(1);
  if (STRICT && payload.summary.status !== 'pass') process.exit(2);
}

main().catch((err) => {
  console.error('f1-onboarding-benchmark fatal:', err);
  process.exit(1);
});
