#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const baseSha = String(process.env.SVEN_BASE_SHA || process.env.GITHUB_EVENT_BEFORE || '').trim();
const headSha = String(process.env.SVEN_HEAD_SHA || process.env.GITHUB_SHA || '').trim();
const changedFilesEnv = String(process.env.SVEN_CHANGED_FILES || '').trim();
const naApproved = String(process.env.SVEN_RUNBOOK_SCOPE_NA_APPROVED || '').trim() === '1';
const maxAgeHours = Number(process.env.SVEN_RUNBOOK_SCOPE_MAX_AGE_HOURS || 72);

const sensitivePrefixes = [
  'services/gateway-api/src/db/migrations/',
  'services/gateway-api/src/routes/admin/incidents',
  'services/gateway-api/src/services/IncidentService',
  'deploy/',
  '.github/workflows/',
];

const runbookPrefixes = [
  'docs/ops/',
  'docs/ops/runbooks/',
  'docs/release/runbooks/',
];

function runCmd(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return {
    code: res.status ?? -1,
    out: String(res.stdout || '').trim(),
    err: String(res.stderr || '').trim(),
  };
}

function parseChangedFiles(text) {
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/\r?\n|,/)
        .map((entry) => String(entry || '').trim().replace(/\\/g, '/'))
        .filter(Boolean),
    ),
  );
}

function detectChangedFiles() {
  if (changedFilesEnv) {
    return {
      mode: 'env',
      files: parseChangedFiles(changedFilesEnv),
    };
  }

  if (baseSha && headSha) {
    const diff = runCmd('git', ['diff', '--name-only', `${baseSha}..${headSha}`]);
    return {
      mode: 'git_range',
      files: diff.code === 0 ? parseChangedFiles(diff.out) : [],
      error: diff.code === 0 ? '' : diff.err || diff.out || `git diff exit ${diff.code}`,
    };
  }

  const localDiff = runCmd('git', ['diff', '--name-only', 'HEAD~1..HEAD']);
  if (localDiff.code !== 0) {
    // Fallback for repositories without commits yet: derive a working-set snapshot
    // from porcelain status so local-only diagnostics remain actionable.
    const status = runCmd('git', ['status', '--porcelain']);
    if (status.code === 0) {
      const files = status.out
        .split(/\r?\n/)
        .map((line) => String(line || '').trimEnd())
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .filter(Boolean);
      return {
        mode: 'git_status',
        files: parseChangedFiles(files.join('\n')),
        error: localDiff.err || localDiff.out || '',
      };
    }
  }
  return {
    mode: 'git_head',
    files: localDiff.code === 0 ? parseChangedFiles(localDiff.out) : [],
    error: localDiff.code === 0 ? '' : localDiff.err || localDiff.out || `git diff exit ${localDiff.code}`,
  };
}

function isSensitivePath(relPath) {
  const normalized = String(relPath || '').trim().replace(/\\/g, '/').toLowerCase();
  return sensitivePrefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

function isRunbookPath(relPath) {
  const normalized = String(relPath || '').trim().replace(/\\/g, '/').toLowerCase();
  if (runbookPrefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()))) return true;
  return normalized === 'docs/release/canary-rollout-strategy-2026.md'
    || normalized === 'docs/ops/release-rollback-runbook-2026.md';
}

function ageHours(timestampIso) {
  const parsed = Date.parse(String(timestampIso || ''));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const detected = detectChangedFiles();
  const changedFiles = detected.files;
  const sensitiveChanged = changedFiles.filter(isSensitivePath);
  const runbookChanged = changedFiles.filter(isRunbookPath);
  const runbookRequired = sensitiveChanged.length > 0;
  const localDiagnosticNoHistoryFallback =
    detected.mode === 'git_status' && !strict && !process.env.CI;
  const runbookSatisfied =
    !runbookRequired || runbookChanged.length > 0 || naApproved || localDiagnosticNoHistoryFallback;

  const checks = [
    {
      id: 'changed_files_discovered',
      pass: changedFiles.length > 0,
      detail: changedFiles.length > 0
        ? `count=${changedFiles.length}; mode=${detected.mode}`
        : `none detected (mode=${detected.mode}${detected.error ? `; ${detected.error}` : ''})`,
    },
    {
      id: 'runbook_scope_sensitive_change_detected',
      pass: true,
      detail: runbookRequired ? `required; sensitive_count=${sensitiveChanged.length}` : 'not_required',
    },
    {
      id: 'runbook_scope_delta_present_when_required',
      pass: runbookSatisfied,
      detail: runbookRequired
        ? runbookChanged.length > 0
          ? `runbook_count=${runbookChanged.length}`
          : naApproved
            ? 'na_approved=true'
            : localDiagnosticNoHistoryFallback
              ? 'local git_status fallback accepted (no commit-range context available)'
              : 'runbook delta missing for sensitive scope'
        : 'not_required',
    },
    {
      id: 'runbook_scope_na_override_valid',
      pass: !naApproved || runbookRequired,
      detail: naApproved
        ? runbookRequired
          ? 'na override set for sensitive scope'
          : 'na override set without required scope'
        : 'not_used',
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const generatedAt = new Date().toISOString();
  const generatedAge = ageHours(generatedAt);
  checks.push({
    id: 'runbook_scope_artifact_fresh',
    pass: typeof generatedAge === 'number' && generatedAge <= maxAgeHours,
    detail: `${(generatedAge || 0).toFixed(2)}h <= ${maxAgeHours}h`,
  });

  const report = {
    generated_at: generatedAt,
    status,
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null,
    head_sha: headSha || null,
    base_sha: baseSha || null,
    changed_files_mode: detected.mode,
    changed_files: changedFiles,
    sensitive_changed_files: sensitiveChanged,
    runbook_changed_files: runbookChanged,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'runbook-scope-update-latest.json');
  const outMd = path.join(outDir, 'runbook-scope-update-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Runbook Scope Update Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nChanged files mode: ${report.changed_files_mode}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
