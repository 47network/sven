#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const evidenceRel = String(
  process.env.SVEN_FEATURE_FLAG_GOVERNANCE_PATH || 'docs/release/evidence/feature-flag-governance-latest.json',
).trim();
const evidencePath = path.join(root, evidenceRel);
const maxAgeHours = Number(process.env.SVEN_FEATURE_FLAG_GOVERNANCE_MAX_AGE_HOURS || 72);
const changedFilesEnv = String(process.env.SVEN_CHANGED_FILES || '').trim();
const baseSha = String(process.env.SVEN_BASE_SHA || process.env.GITHUB_EVENT_BEFORE || '').trim();
const headSha = String(process.env.SVEN_HEAD_SHA || process.env.GITHUB_SHA || '').trim();
const naApproved = String(process.env.SVEN_FEATURE_FLAG_NA_APPROVED || '').trim() === '1';

const riskyScopePrefixes = [
  'services/gateway-api/src/routes/',
  'services/gateway-api/src/services/',
  'services/gateway-api/src/db/migrations/',
  'services/skill-runner/src/',
  'apps/companion-user-flutter/lib/',
  'deploy/',
  '.github/workflows/',
];

const riskyClasses = new Set(['risky', 'high', 'security', 'migration', 'incident']);
const offDefaults = new Set(['off', 'false', '0', 'disabled', 'default_off']);

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
  const fallback = runCmd('git', ['diff', '--name-only', 'HEAD~1..HEAD']);
  return {
    mode: 'git_head',
    files: fallback.code === 0 ? parseChangedFiles(fallback.out) : [],
    error: fallback.code === 0 ? '' : fallback.err || fallback.out || `git diff exit ${fallback.code}`,
  };
}

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function ageHours(timestampIso) {
  const parsed = Date.parse(String(timestampIso || ''));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function isRiskyScopePath(relPath) {
  const normalized = String(relPath || '').trim().replace(/\\/g, '/').toLowerCase();
  return riskyScopePrefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

function run() {
  const checks = [];
  const changed = detectChangedFiles();
  const changedFiles = changed.files;
  const riskyScopeChangedFiles = changedFiles.filter(isRiskyScopePath);
  const riskyScopeTouched = riskyScopeChangedFiles.length > 0;

  checks.push({
    id: 'feature_flag_changed_files_discovered',
    pass: changedFiles.length > 0,
    detail: changedFiles.length > 0
      ? `count=${changedFiles.length}; mode=${changed.mode}`
      : `none detected (mode=${changed.mode}${changed.error ? `; ${changed.error}` : ''})`,
  });
  checks.push({
    id: 'feature_flag_risky_scope_detected',
    pass: true,
    detail: riskyScopeTouched ? `required; risky_files=${riskyScopeChangedFiles.length}` : 'not_required',
  });

  if (!fs.existsSync(evidencePath)) {
    checks.push({
      id: 'feature_flag_governance_evidence_present',
      pass: !riskyScopeTouched,
      detail: riskyScopeTouched ? `${evidenceRel} missing` : `${evidenceRel} missing (not required)`,
    });
  } else {
    let evidence = null;
    try {
      evidence = readJson(evidencePath);
      checks.push({
        id: 'feature_flag_governance_evidence_valid_json',
        pass: true,
        detail: evidenceRel,
      });
    } catch (err) {
      checks.push({
        id: 'feature_flag_governance_evidence_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }

    const entries = Array.isArray(evidence?.entries) ? evidence.entries : [];
    checks.push({
      id: 'feature_flag_governance_entries_present',
      pass: riskyScopeTouched ? entries.length > 0 || naApproved : true,
      detail: riskyScopeTouched
        ? entries.length > 0
          ? `entries=${entries.length}`
          : naApproved
            ? 'na_approved=true'
            : 'entries[] missing for risky scope'
        : `entries=${entries.length}`,
    });

    const schemaErrors = [];
    const riskyEntryErrors = [];
    let riskyEntryCount = 0;
    for (let idx = 0; idx < entries.length; idx += 1) {
      const entry = entries[idx] || {};
      const flagId = String(entry.flag_id || '').trim();
      const defaultState = String(entry.default_state || '').trim().toLowerCase();
      const riskClass = String(entry.risk_class || '').trim().toLowerCase();
      const docsLink = String(entry.docs_link || '').trim();
      if (!flagId) schemaErrors.push(`row_${idx}: missing flag_id`);
      if (!defaultState) schemaErrors.push(`row_${idx}: missing default_state`);
      if (!riskClass) schemaErrors.push(`row_${idx}: missing risk_class`);
      if (!docsLink) schemaErrors.push(`row_${idx}: missing docs_link`);
      if (riskyClasses.has(riskClass)) {
        riskyEntryCount += 1;
        if (!offDefaults.has(defaultState)) {
          riskyEntryErrors.push(`row_${idx}: risky default_state must be OFF (got ${defaultState || '(missing)'})`);
        }
        if (!(docsLink.startsWith('docs/') || /^https?:\/\//i.test(docsLink))) {
          riskyEntryErrors.push(`row_${idx}: risky docs_link invalid (${docsLink || '(missing)'})`);
        }
      }
    }

    checks.push({
      id: 'feature_flag_governance_entry_schema_valid',
      pass: schemaErrors.length === 0,
      detail: schemaErrors.length === 0 ? `validated=${entries.length}` : schemaErrors.slice(0, 12).join('; '),
    });
    checks.push({
      id: 'feature_flag_risky_entries_default_off_and_documented',
      pass: riskyEntryErrors.length === 0,
      detail: riskyEntryErrors.length === 0
        ? `risky_entries=${riskyEntryCount}`
        : riskyEntryErrors.slice(0, 12).join('; '),
    });
    checks.push({
      id: 'feature_flag_risky_scope_has_risky_entry_or_approved_na',
      pass: riskyScopeTouched ? riskyEntryCount > 0 || naApproved : true,
      detail: riskyScopeTouched
        ? riskyEntryCount > 0
          ? `risky_entries=${riskyEntryCount}`
          : naApproved
            ? 'na_approved=true'
            : 'missing risky entry for risky scope'
        : 'not_required',
    });

    const generatedAt = String(evidence?.generated_at || '').trim();
    const age = ageHours(generatedAt);
    checks.push({
      id: 'feature_flag_governance_fresh',
      pass: typeof age === 'number' && age <= maxAgeHours,
      detail: typeof age === 'number'
        ? `${age.toFixed(2)}h <= ${maxAgeHours}h`
        : 'missing/invalid generated_at',
    });

    const runId = String(evidence?.source_run_id || evidence?.run_id || '').trim();
    const evidenceHeadSha = String(evidence?.head_sha || '').trim();
    checks.push({
      id: 'feature_flag_governance_provenance_present',
      pass: Boolean(runId) && /^[a-f0-9]{7,40}$/i.test(evidenceHeadSha),
      detail: `run_id=${runId || '(missing)'}; head_sha=${evidenceHeadSha || '(missing)'}`,
    });
  }

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence: evidenceRel,
    changed_files_mode: changed.mode,
    changed_files: changedFiles,
    risky_scope_changed_files: riskyScopeChangedFiles,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'feature-flag-governance-latest.json');
  const outMd = path.join(outDir, 'feature-flag-governance-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Feature Flag Governance Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nEvidence: ${evidenceRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
