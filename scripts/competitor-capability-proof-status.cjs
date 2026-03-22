#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const requirePass = process.argv.includes('--require-pass');

const openClawDocRel = 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md';
const agentZeroDocRel = 'docs/parity/sven-vs-agent-zero-feature-comparison.md';
const programStatusRel = 'docs/release/status/competitive-reproduction-program-completion-latest.json';
const parityChecklistVerifyRel = 'docs/release/status/parity-checklist-verify-latest.json';
const runtimeTruthRel = 'docs/release/status/competitor-runtime-truth-latest.json';
const waveArtifacts = [
  { wave: 'wave1', competitor: 'OpenHands', file: 'docs/release/status/openhands-wave1-closeout-latest.json' },
  { wave: 'wave2', competitor: 'LibreChat', file: 'docs/release/status/librechat-wave2-closeout-latest.json' },
  { wave: 'wave3', competitor: 'n8n', file: 'docs/release/status/n8n-wave3-closeout-latest.json' },
  { wave: 'wave4', competitor: 'FrameworkAbsorption', file: 'docs/release/status/framework-wave4-closeout-latest.json' },
  { wave: 'wave5', competitor: 'CrewAI', file: 'docs/release/status/crewai-wave5-closeout-latest.json' },
  { wave: 'wave6', competitor: 'Letta', file: 'docs/release/status/letta-wave6-closeout-latest.json' },
  { wave: 'wave7', competitor: 'AutoGen', file: 'docs/release/status/autogen-wave7-closeout-latest.json' },
  { wave: 'wave8', competitor: 'LangGraph', file: 'docs/release/status/langgraph-wave8-closeout-latest.json' },
];
const outJsonRel = 'docs/release/status/competitor-capability-proof-latest.json';
const outMdRel = 'docs/release/status/competitor-capability-proof-latest.md';

function readUtf8(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function readJson(rel) {
  const raw = readUtf8(rel);
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function parseRows(markdown) {
  if (!markdown) return [];
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\|\s*\d+\.\d+\s*\|/.test(line)) continue;
    const idMatch = line.match(/^\|\s*([0-9]+\.[0-9]+)\s*\|/);
    const statusMatch = line.match(/\|\s*(✅\+?|⚠️|❌)\s*\|/);
    if (!idMatch || !statusMatch) continue;
    const statusToken = String(statusMatch[1]).trim();
    const statusEnd = (statusMatch.index || 0) + statusMatch[0].length;
    const lastPipe = line.lastIndexOf('|');
    const notes = lastPipe > statusEnd ? line.slice(statusEnd, lastPipe).trim() : '';
    rows.push({
      id: idMatch[1],
      status: statusToken,
      notes,
      raw: line,
    });
  }
  return rows;
}

function extractRefs(text) {
  const refs = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    refs.push(String(m[1]).trim().replace(/\\/g, '/'));
  }
  return refs;
}

function statusArtifactPass(rel) {
  const json = readJson(rel);
  if (!json || typeof json !== 'object') return false;
  return String(json.status || '').toLowerCase() === 'pass';
}

function classifyRows(rows) {
  const details = [];
  let proven = 0;
  let partial = 0;
  let unproven = 0;

  for (const row of rows) {
    const st = row.status;
    const refs = extractRefs(row.notes);
    const statusRefs = refs.filter((r) => r.startsWith('docs/release/status/') && r.endsWith('.json'));
    const evidenceRefs = refs.filter((r) => r.startsWith('docs/release/evidence/'));

    let rowClass = 'unproven';
    let reason = 'no executable evidence reference';

    if (st === '⚠️') {
      rowClass = 'partial';
      reason = 'explicit partial status';
    } else if (st === '❌') {
      rowClass = 'unproven';
      reason = 'explicit missing status';
    } else if (st === '✅' || st === '✅+') {
      const passingStatusRefs = statusRefs.filter((r) => statusArtifactPass(r));
      const existingEvidenceRefs = evidenceRefs.filter((r) => fs.existsSync(path.join(root, r)));
      if (passingStatusRefs.length > 0) {
        rowClass = 'proven-pass';
        reason = `passing status artifact refs: ${passingStatusRefs.join(', ')}`;
      } else if (existingEvidenceRefs.length > 0 || refs.length > 0) {
        rowClass = 'partial';
        reason = 'claim references exist but no passing machine status artifact bound';
      } else {
        rowClass = 'unproven';
        reason = 'matched claim without evidence refs';
      }
    }

    if (rowClass === 'proven-pass') proven += 1;
    if (rowClass === 'partial') partial += 1;
    if (rowClass === 'unproven') unproven += 1;

    details.push({
      feature_id: row.id,
      status: st,
      classification: rowClass,
      reason,
    });
  }

  return { proven, partial, unproven, details };
}

function run() {
  const openClawRows = parseRows(readUtf8(openClawDocRel));
  const agentZeroRows = parseRows(readUtf8(agentZeroDocRel));
  const openClaw = classifyRows(openClawRows);
  const agentZero = classifyRows(agentZeroRows);

  const program = readJson(programStatusRel);
  const parityVerify = readJson(parityChecklistVerifyRel);
  const runtimeTruth = readJson(runtimeTruthRel);
  const programPass = String(program?.status || '').toLowerCase() === 'pass';
  const parityPass = String(parityVerify?.status || '').toLowerCase() === 'pass';
  const runtimeTruthPass = String(runtimeTruth?.status || '').toLowerCase() === 'pass';
  const runtimeTruthCoverage100 = Number(runtimeTruth?.summary?.runtime_proof_coverage_percent || 0) === 100;
  const waves = waveArtifacts.map((w) => {
    const json = readJson(w.file);
    const status = String(json?.status || 'missing').toLowerCase();
    return {
      wave: w.wave,
      competitor: w.competitor,
      file: w.file,
      status,
      pass: status === 'pass',
      generated_at: json?.generated_at || null,
    };
  });
  const allWaveCompetitorsPass = waves.every((w) => w.pass);

  const totalRows = openClawRows.length + agentZeroRows.length;
  const totalProven = openClaw.proven + agentZero.proven;
  const totalPartial = openClaw.partial + agentZero.partial;
  const totalUnproven = openClaw.unproven + agentZero.unproven;

  const claim100 = runtimeTruthCoverage100
    && totalPartial === 0
    && totalUnproven === 0
    && programPass
    && parityPass
    && runtimeTruthPass;
  const status = (
    claim100
    && allWaveCompetitorsPass
    && runtimeTruthPass
    && runtimeTruthCoverage100
    && totalPartial === 0
    && totalUnproven === 0
    && programPass
    && parityPass
  ) ? 'pass' : 'fail';

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
      claim_100_percent_parity: claim100,
      total_rows: totalRows,
      proven_pass_rows: totalProven,
      partial_rows: totalPartial,
      unproven_rows: totalUnproven,
      wave_program_status: programPass ? 'pass' : 'fail',
      parity_checklist_verify_status: parityPass ? 'pass' : 'fail',
      runtime_truth_status: runtimeTruthPass ? 'pass' : 'fail',
      runtime_truth_coverage_status: runtimeTruthCoverage100 ? 'pass' : 'fail',
      all_program_competitors_wave_status: allWaveCompetitorsPass ? 'pass' : 'fail',
    },
    competitors: {
      openclaw: {
        total_rows: openClawRows.length,
        proven_pass_rows: openClaw.proven,
        partial_rows: openClaw.partial,
        unproven_rows: openClaw.unproven,
        unresolved_feature_ids: openClaw.details
          .filter((d) => d.classification !== 'proven-pass')
          .map((d) => d.feature_id),
      },
      agent_zero: {
        total_rows: agentZeroRows.length,
        proven_pass_rows: agentZero.proven,
        partial_rows: agentZero.partial,
        unproven_rows: agentZero.unproven,
        unresolved_feature_ids: agentZero.details
          .filter((d) => d.classification !== 'proven-pass')
          .map((d) => d.feature_id),
      },
    },
    source: {
      openclaw_comparison: openClawDocRel,
      agentzero_comparison: agentZeroDocRel,
      program_status: programStatusRel,
      parity_checklist_verify: parityChecklistVerifyRel,
      runtime_truth_status: runtimeTruthRel,
      wave_closeouts: waveArtifacts.map((w) => w.file),
    },
    coverage_scope: {
      row_level_feature_matrices: ['openclaw', 'agent_zero'],
      wave_level_competitors: waves.map((w) => w.competitor),
    },
    provenance: {
      source_run_id: sourceRunId,
      head_sha: headSha || null,
      evidence_mode: 'competitor_feature_row_proof',
    },
    gates: [
      {
        id: 'no_100_percent_claim_without_full_proof',
        pass: !(claim100 === true && status !== 'pass'),
        detail: claim100 ? 'claim_100_percent_parity=true with full proof' : 'claim_100_percent_parity=false until all rows proven',
      },
      {
        id: 'all_program_competitor_waves_pass',
        pass: allWaveCompetitorsPass,
        detail: waves.map((w) => `${w.wave}:${w.competitor}:${w.status}`).join(', '),
      },
      {
        id: 'runtime_truth_coverage_pass',
        pass: runtimeTruthPass && runtimeTruthCoverage100,
        detail: runtimeTruthPass && runtimeTruthCoverage100
          ? 'runtime truth lane status=pass; coverage=100%'
          : `runtime truth lane status=${String(runtimeTruth?.status || 'missing')}; coverage=${String(runtimeTruth?.summary?.runtime_proof_coverage_percent ?? 'missing')}%`,
      },
    ],
    unresolved_rows: {
      openclaw: openClaw.details.filter((d) => d.classification !== 'proven-pass'),
      agent_zero: agentZero.details.filter((d) => d.classification !== 'proven-pass'),
    },
    waves,
  };

  fs.mkdirSync(path.dirname(path.join(root, outJsonRel)), { recursive: true });
  fs.writeFileSync(path.join(root, outJsonRel), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(root, outMdRel),
    [
      '# Competitor Capability Proof',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${payload.status}`,
      `Claim 100% parity: ${payload.summary.claim_100_percent_parity ? 'true' : 'false'}`,
      '',
      '## Totals',
      `- rows: ${payload.summary.total_rows}`,
      `- proven-pass: ${payload.summary.proven_pass_rows}`,
      `- partial: ${payload.summary.partial_rows}`,
      `- unproven: ${payload.summary.unproven_rows}`,
      '',
      '## Competitors',
      `- openclaw: proven=${payload.competitors.openclaw.proven_pass_rows}, partial=${payload.competitors.openclaw.partial_rows}, unproven=${payload.competitors.openclaw.unproven_rows}`,
      `- agent_zero: proven=${payload.competitors.agent_zero.proven_pass_rows}, partial=${payload.competitors.agent_zero.partial_rows}, unproven=${payload.competitors.agent_zero.unproven_rows}`,
      '',
      '## Program Competitors (Wave Coverage)',
      ...payload.waves.map((w) => `- ${w.wave} ${w.competitor}: ${w.status} (${w.file})`),
      '',
      '## Remaining Unproven Rows',
      ...(payload.unresolved_rows.openclaw.length === 0
        ? ['- openclaw: none']
        : payload.unresolved_rows.openclaw.map((d) => `- openclaw ${d.feature_id}: ${d.reason}`)),
      ...(payload.unresolved_rows.agent_zero.length === 0
        ? ['- agent_zero: none']
        : payload.unresolved_rows.agent_zero.map((d) => `- agent_zero ${d.feature_id}: ${d.reason}`)),
      '',
      '## Gates',
      ...payload.gates.map((g) => `- [${g.pass ? 'x' : ' '}] ${g.id}: ${g.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${outJsonRel}`);
  console.log(`Wrote ${outMdRel}`);

  if (strict && status !== 'pass') process.exit(2);
  if (requirePass && status !== 'pass') process.exit(2);
}

run();
