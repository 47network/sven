#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const skipSmoke = process.argv.includes('--skip-smoke') || process.env.COMPETITOR_RUNTIME_SKIP_SMOKE === '1';

const OPENCLAW_DOC = 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md';
const AGENT_ZERO_DOC = 'docs/parity/sven-vs-agent-zero-feature-comparison.md';
const EXECUTABLE_SMOKE_JSON = 'docs/release/status/competitor-executable-smoke-latest.json';
const OUT_JSON = 'docs/release/status/competitor-runtime-truth-latest.json';
const OUT_MD = 'docs/release/status/competitor-runtime-truth-latest.md';

const GENERIC_STATUS_REFS = new Set([
  'docs/release/status/parity-checklist-verify-latest.json',
  'docs/release/status/parity-checklist-verify-latest.md',
  'docs/release/status/competitive-reproduction-program-completion-latest.json',
  'docs/release/status/competitive-reproduction-program-completion-latest.md',
  'docs/release/status/master-parity-summary-latest.json',
  'docs/release/status/master-parity-summary-latest.md',
]);
const artifactRefCache = new Map();

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
    const statusEnd = (statusMatch.index || 0) + statusMatch[0].length;
    const lastPipe = line.lastIndexOf('|');
    const notes = lastPipe > statusEnd ? line.slice(statusEnd, lastPipe).trim() : '';
    rows.push({
      id: idMatch[1],
      status: String(statusMatch[1]).trim(),
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

function statusPass(rel) {
  const json = readJson(rel);
  if (!json || typeof json !== 'object') return false;
  return String(json.status || '').toLowerCase() === 'pass';
}

function hoursSince(iso) {
  const ts = Date.parse(String(iso || ''));
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ts) / 36e5;
}

function isEvidenceRef(ref) {
  return ref.startsWith('docs/release/evidence/');
}

function sourceRefExists(ref) {
  return fs.existsSync(path.join(root, ref));
}

function isCodeRef(ref) {
  if (!/^(services|apps|packages|scripts|config|deploy|infra)\//.test(ref)) return false;
  if (isTestRef(ref)) return false;
  return sourceRefExists(ref);
}

function isTestRef(ref) {
  if (!sourceRefExists(ref)) return false;
  return /\/__tests__\//.test(ref)
    || /\/tests?\//.test(ref)
    || /\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs)$/.test(ref);
}

function collectArtifactSourceRefs(artifact) {
  const refs = [];
  if (!artifact || typeof artifact !== 'object') return refs;

  if (Array.isArray(artifact.source_files)) {
    refs.push(...artifact.source_files);
  }

  const source = artifact.source;
  if (source && typeof source === 'object') {
    for (const value of Object.values(source)) {
      if (typeof value === 'string') refs.push(value);
      if (Array.isArray(value)) refs.push(...value.filter((item) => typeof item === 'string'));
    }
  }

  return refs
    .map((ref) => String(ref || '').trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

function extractRefsFromRuntimeArtifacts(runtimePassRefs) {
  const codeRefs = [];
  const testRefs = [];

  for (const ref of runtimePassRefs) {
    if (!artifactRefCache.has(ref)) {
      const artifact = readJson(ref);
      const sourceRefs = collectArtifactSourceRefs(artifact);
      const code = sourceRefs.filter((item) => isCodeRef(item));
      const test = sourceRefs.filter((item) => isTestRef(item));
      artifactRefCache.set(ref, {
        code,
        test,
      });
    }
    const cached = artifactRefCache.get(ref) || { code: [], test: [] };
    codeRefs.push(...cached.code);
    testRefs.push(...cached.test);
  }

  return {
    codeRefs: Array.from(new Set(codeRefs)),
    testRefs: Array.from(new Set(testRefs)),
  };
}

function classifyRows(rows, competitor) {
  let proven = 0;
  let partial = 0;
  let unproven = 0;
  const details = [];

  for (const row of rows) {
    const refs = extractRefs(row.notes);
    const statusRefs = refs.filter((r) => r.startsWith('docs/release/status/') && r.endsWith('.json'));
    const runtimeStatusRefs = statusRefs.filter((r) => !GENERIC_STATUS_REFS.has(r));
    const runtimePassRefs = runtimeStatusRefs.filter((r) => statusPass(r));
    const evidenceRefs = refs.filter((r) => isEvidenceRef(r) && fs.existsSync(path.join(root, r)));
    const rowCodeRefs = refs.filter((r) => isCodeRef(r));
    const rowTestRefs = refs.filter((r) => isTestRef(r));
    const inferredRefs = extractRefsFromRuntimeArtifacts(runtimePassRefs);
    const codeRefs = Array.from(new Set([...rowCodeRefs, ...inferredRefs.codeRefs]));
    const testRefs = Array.from(new Set([...rowTestRefs, ...inferredRefs.testRefs]));

    let classification = 'unproven';
    let reason = 'missing runtime-bound evidence';

    if (row.status === '⚠️') {
      classification = 'partial';
      reason = 'explicit partial status';
    } else if (row.status === '❌') {
      classification = 'unproven';
      reason = 'explicit missing status';
    } else if (row.status === '✅' || row.status === '✅+') {
      if (runtimePassRefs.length > 0 && codeRefs.length > 0 && testRefs.length > 0) {
        classification = 'proven-runtime';
        reason = `runtime status refs pass: ${runtimePassRefs.join(', ')}; code refs: ${codeRefs.join(', ')}; test refs: ${testRefs.join(', ')}`;
      } else if (runtimePassRefs.length > 0) {
        classification = 'partial';
        const missing = [];
        if (codeRefs.length === 0) missing.push('code_ref');
        if (testRefs.length === 0) missing.push('test_ref');
        reason = `runtime status present but missing ${missing.join('+')}`;
      } else if (evidenceRefs.length > 0) {
        classification = 'partial';
        reason = `evidence refs present but missing runtime status/code/test anchors: ${evidenceRefs.join(', ')}`;
      } else if (statusRefs.length > 0) {
        classification = 'partial';
        reason = 'claim references only generic summary status artifacts';
      } else if (refs.length > 0) {
        classification = 'partial';
        reason = 'claim references provided but none are runtime status/evidence refs';
      }
    }

    if (classification === 'proven-runtime') proven += 1;
    if (classification === 'partial') partial += 1;
    if (classification === 'unproven') unproven += 1;

    details.push({
      competitor,
      feature_id: row.id,
      status: row.status,
      classification,
      reason,
      references: {
        runtime_status_refs: runtimePassRefs,
        code_refs: codeRefs,
        test_refs: testRefs,
      },
    });
  }

  return { proven, partial, unproven, details };
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(path.join(root, OUT_JSON)), { recursive: true });
  fs.writeFileSync(path.join(root, OUT_JSON), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [];
  md.push('# Competitor Runtime Truth Check');
  md.push('');
  md.push(`Generated: ${report.generated_at}`);
  md.push(`Status: ${report.status}`);
  md.push('');
  md.push('## Summary');
  md.push(`- total rows: ${report.summary.total_rows}`);
  md.push(`- runtime-proven rows: ${report.summary.runtime_proven_rows}`);
  md.push(`- partial rows: ${report.summary.partial_rows}`);
  md.push(`- unproven rows: ${report.summary.unproven_rows}`);
  md.push(`- runtime-proof coverage: ${report.summary.runtime_proof_coverage_percent}%`);
  md.push(`- executable smoke status: ${report.summary.executable_smoke_status}`);
  md.push(`- executable smoke age (hours): ${report.summary.executable_smoke_age_hours ?? 'missing'}`);
  md.push('');
  md.push('## Competitors');
  md.push(`- openclaw: proven=${report.competitors.openclaw.runtime_proven_rows}, partial=${report.competitors.openclaw.partial_rows}, unproven=${report.competitors.openclaw.unproven_rows}`);
  md.push(`- agent_zero: proven=${report.competitors.agent_zero.runtime_proven_rows}, partial=${report.competitors.agent_zero.partial_rows}, unproven=${report.competitors.agent_zero.unproven_rows}`);
  md.push('');
  md.push('## Gates');
  for (const gate of report.gates) {
    md.push(`- [${gate.pass ? 'x' : ' '}] ${gate.id}: ${gate.detail}`);
  }
  md.push('');
  md.push('## Top Unproven/Partial Rows');
  const top = report.rows.filter((r) => r.classification !== 'proven-runtime').slice(0, 30);
  if (top.length === 0) {
    md.push('- none');
  } else {
    for (const row of top) {
      md.push(`- ${row.competitor} ${row.feature_id}: ${row.classification} (${row.reason})`);
    }
  }
  md.push('');

  fs.writeFileSync(path.join(root, OUT_MD), `${md.join('\n')}\n`, 'utf8');
}

function run() {
  let executableSmokeRunStatus = 'skipped';
  if (!skipSmoke) {
    try {
      execSync('npm run -s release:competitor:executable:smoke', {
        cwd: root,
        stdio: 'inherit',
      });
      executableSmokeRunStatus = 'executed';
    } catch {
      executableSmokeRunStatus = 'failed';
    }
  }

  const executableSmoke = readJson(EXECUTABLE_SMOKE_JSON);
  const executableSmokePass = String(executableSmoke?.status || '').toLowerCase() === 'pass';
  const executableSmokeAgeHours = hoursSince(executableSmoke?.generated_at);
  const executableSmokeFresh = executableSmokeAgeHours <= 24;

  const openRows = parseRows(readUtf8(OPENCLAW_DOC));
  const azRows = parseRows(readUtf8(AGENT_ZERO_DOC));

  const open = classifyRows(openRows, 'openclaw');
  const az = classifyRows(azRows, 'agent_zero');

  const totalRows = openRows.length + azRows.length;
  const runtimeProven = open.proven + az.proven;
  const partialRows = open.partial + az.partial;
  const unprovenRows = open.unproven + az.unproven;
  const runtimeCoverage = totalRows > 0
    ? Number(((runtimeProven / totalRows) * 100).toFixed(2))
    : 0;

  const gates = [
    {
      id: 'executable_smoke_pass_and_fresh',
      pass: executableSmokePass && executableSmokeFresh,
      detail: `status=${String(executableSmoke?.status || 'missing')}; age_hours=${Number.isFinite(executableSmokeAgeHours) ? executableSmokeAgeHours.toFixed(2) : 'missing'}; run_status=${executableSmokeRunStatus}`,
    },
    {
      id: 'no_claim_only_rows',
      pass: partialRows === 0 && unprovenRows === 0,
      detail: `partial=${partialRows}, unproven=${unprovenRows}`,
    },
    {
      id: 'runtime_coverage_100_percent',
      pass: runtimeCoverage === 100,
      detail: `coverage=${runtimeCoverage}%`,
    },
  ];

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

  const report = {
    generated_at: new Date().toISOString(),
    status: gates.every((g) => g.pass) ? 'pass' : 'fail',
    source_run_id: sourceRunId,
    head_sha: headSha || null,
    summary: {
      total_rows: totalRows,
      runtime_proven_rows: runtimeProven,
      partial_rows: partialRows,
      unproven_rows: unprovenRows,
      runtime_proof_coverage_percent: runtimeCoverage,
      executable_smoke_status: String(executableSmoke?.status || 'missing'),
      executable_smoke_age_hours: Number.isFinite(executableSmokeAgeHours)
        ? Number(executableSmokeAgeHours.toFixed(4))
        : null,
    },
    competitors: {
      openclaw: {
        total_rows: openRows.length,
        runtime_proven_rows: open.proven,
        partial_rows: open.partial,
        unproven_rows: open.unproven,
      },
      agent_zero: {
        total_rows: azRows.length,
        runtime_proven_rows: az.proven,
        partial_rows: az.partial,
        unproven_rows: az.unproven,
      },
    },
    gates,
    rows: [...open.details, ...az.details],
    provenance: {
      source_run_id: sourceRunId,
      head_sha: headSha || null,
      evidence_mode: 'runtime_truth_strict',
      executable_smoke_artifact: EXECUTABLE_SMOKE_JSON,
      executable_smoke_run_status: executableSmokeRunStatus,
    },
  };

  writeReport(report);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
  if (strict && report.status !== 'pass') {
    process.exit(2);
  }
}

run();
