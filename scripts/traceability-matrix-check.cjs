#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const matrixRel = process.env.SVEN_TRACEABILITY_MATRIX_PATH || 'docs/release/evidence/traceability-matrix-latest.json';
const matrixPath = path.join(root, matrixRel);
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'traceability-matrix-latest.json');
const outMd = path.join(outDir, 'traceability-matrix-latest.md');

const DELIVERED_STATUSES = new Set(['done', 'delivered', 'completed', 'released']);
const REQUIRED_ARRAY_COLUMNS = [
  'code_refs',
  'api_refs',
  'db_refs',
  'test_refs',
  'observability_refs',
  'evidence_refs',
];
const REQUIRED_SCALAR_COLUMNS = ['strategy_id', 'epic_id', 'story_id'];

function normalizeRef(ref) {
  return String(ref || '').trim().replace(/\\/g, '/');
}

function isLocalFileRef(ref) {
  const value = normalizeRef(ref);
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.startsWith('/v1/')) return false;
  return value.includes('/');
}

function run() {
  const checks = [];
  let matrix = null;

  checks.push({
    id: 'traceability_matrix_file_present',
    pass: fs.existsSync(matrixPath),
    detail: matrixRel,
  });

  if (fs.existsSync(matrixPath)) {
    try {
      matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8').replace(/^\uFEFF/, ''));
      checks.push({
        id: 'traceability_matrix_json_valid',
        pass: true,
        detail: matrixRel,
      });
    } catch (err) {
      checks.push({
        id: 'traceability_matrix_json_valid',
        pass: false,
        detail: String(err && err.message ? err.message : err),
      });
    }
  } else {
    checks.push({
      id: 'traceability_matrix_json_valid',
      pass: false,
      detail: `${matrixRel} missing`,
    });
  }

  const rows = Array.isArray(matrix && matrix.rows) ? matrix.rows : [];
  checks.push({
    id: 'traceability_matrix_rows_present',
    pass: rows.length > 0,
    detail: `rows=${rows.length}`,
  });

  const storyIds = new Set();
  const duplicateStoryIds = [];
  const columnViolations = [];
  const missingRefs = [];
  const deliveredRows = rows.filter((row) => DELIVERED_STATUSES.has(String(row?.delivery_status || '').toLowerCase()));

  for (let i = 0; i < deliveredRows.length; i += 1) {
    const row = deliveredRows[i] || {};
    const storyId = String(row.story_id || '').trim();
    if (storyId) {
      if (storyIds.has(storyId)) duplicateStoryIds.push(storyId);
      storyIds.add(storyId);
    }

    for (const key of REQUIRED_SCALAR_COLUMNS) {
      const value = String(row[key] || '').trim();
      if (!value) columnViolations.push(`${storyId || `row_${i + 1}`}:${key}`);
    }
    for (const key of REQUIRED_ARRAY_COLUMNS) {
      const value = row[key];
      if (!Array.isArray(value) || value.length === 0) {
        columnViolations.push(`${storyId || `row_${i + 1}`}:${key}`);
        continue;
      }
      for (const ref of value) {
        const normalized = normalizeRef(ref);
        if (!isLocalFileRef(normalized)) continue;
        if (!fs.existsSync(path.join(root, normalized))) {
          missingRefs.push(`${storyId || `row_${i + 1}`}:${normalized}`);
        }
      }
    }
  }

  checks.push({
    id: 'traceability_matrix_delivered_rows_present',
    pass: deliveredRows.length > 0,
    detail: `delivered_rows=${deliveredRows.length}`,
  });
  checks.push({
    id: 'traceability_matrix_required_columns_valid',
    pass: columnViolations.length === 0,
    detail: columnViolations.length === 0 ? 'all required columns populated' : `violations=${columnViolations.join(', ')}`,
  });
  checks.push({
    id: 'traceability_matrix_story_ids_unique',
    pass: duplicateStoryIds.length === 0,
    detail: duplicateStoryIds.length === 0 ? `unique_story_ids=${storyIds.size}` : `duplicates=${duplicateStoryIds.join(', ')}`,
  });
  checks.push({
    id: 'traceability_matrix_references_resolve',
    pass: missingRefs.length === 0,
    detail: missingRefs.length === 0 ? 'all local references resolve' : `missing_refs=${missingRefs.join(', ')}`,
  });

  const fallbackHeadSha = (() => {
    try {
      return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  })();
  const derivedRunId = `local-traceability-matrix-${Date.now()}`;

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    matrix_path: matrixRel,
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || derivedRunId,
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || fallbackHeadSha || null,
    rows_count: rows.length,
    delivered_rows_count: deliveredRows.length,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Traceability Matrix Check',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      `Matrix path: ${matrixRel}`,
      `Rows: ${report.rows_count}`,
      `Delivered rows: ${report.delivered_rows_count}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
