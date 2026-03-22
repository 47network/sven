#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'pr-dor-metadata-latest.json');
const outMd = path.join(outDir, 'pr-dor-metadata-latest.md');

const REQUIRED_FIELDS = [
  { key: 'story_id', label: 'Story ID' },
  { key: 'acceptance_criteria', label: 'Acceptance criteria' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'feature_flag_decision', label: 'Feature flag decision' },
  { key: 'observability_requirement', label: 'Observability requirement' },
  { key: 'security_privacy_impact', label: 'Security/privacy impact' },
  { key: 'migration_strategy', label: 'Migration strategy' },
  { key: 'rollback_killswitch_path', label: 'Rollback/kill switch path' },
];

const SCOPE_PATTERNS = [
  /^(services|apps|packages|scripts|deploy)\//,
  /^\.github\/workflows\//,
  /^docs\/(api|release|ops|runbooks)\//,
];

function readEventJson() {
  const p = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!p || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function getEventPrBody(eventJson) {
  if (!eventJson || typeof eventJson !== 'object') return '';
  const body = eventJson.pull_request?.body;
  return typeof body === 'string' ? body : '';
}

function getBaseHead(eventJson) {
  const base = String(
    process.env.SVEN_BASE_SHA
      || process.env.GITHUB_BASE_SHA
      || eventJson?.pull_request?.base?.sha
      || '',
  ).trim();
  const head = String(
    process.env.SVEN_HEAD_SHA
      || process.env.GITHUB_SHA
      || eventJson?.pull_request?.head?.sha
      || '',
  ).trim();
  return { base, head };
}

function listChangedFiles(base, head) {
  if (!base || !head) return [];
  try {
    const out = cp.execSync(`git diff --name-only ${base} ${head}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
    return out.split(/\r?\n/).map((v) => v.trim().replace(/\\/g, '/')).filter(Boolean);
  } catch {
    return [];
  }
}

function extractField(body, key) {
  const rx = new RegExp(`\\b${key}\\s*=\\s*([^\\r\\n]+)`, 'i');
  const m = body.match(rx);
  return m ? String(m[1] || '').trim() : '';
}

function isMeaningful(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  const lowered = v.toLowerCase();
  if (['tbd', 'todo', 'unknown', 'pending', 'placeholder'].includes(lowered)) return false;
  if (/^<[^>]+>$/.test(v)) return false;
  return true;
}

function parseStoryIds(value) {
  const tokens = String(value || '')
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const token of tokens) {
    const normalized = token.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      out.push(normalized);
      seen.add(normalized);
    }
  }
  return out;
}

function isValidStoryId(id) {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(id) || /^STORY-\d+-\d+$/.test(id);
}

function main() {
  const eventJson = readEventJson();
  const prBody = String(process.env.GITHUB_PR_BODY || getEventPrBody(eventJson) || '').trim();
  const { base, head } = getBaseHead(eventJson);
  const changedFiles = listChangedFiles(base, head);
  const scopeSensitive = changedFiles.some((file) => SCOPE_PATTERNS.some((rx) => rx.test(file)));

  const checks = [];
  checks.push({
    id: 'pr_dor_scope_sensitive_change_detected',
    pass: true,
    detail: scopeSensitive
      ? `true (${changedFiles.length} changed files)`
      : `false (${changedFiles.length} changed files)`,
  });
  checks.push({
    id: 'pr_dor_body_present_when_required',
    pass: !scopeSensitive || prBody.length > 0,
    detail: scopeSensitive
      ? (prBody.length > 0 ? 'present' : 'missing')
      : 'not required (scope clean)',
  });

  const fieldValues = {};
  const validatedStoryIds = [];
  for (const field of REQUIRED_FIELDS) {
    const value = extractField(prBody, field.key);
    fieldValues[field.key] = value || null;
    if (field.key === 'story_id') {
      const storyIds = parseStoryIds(value);
      const validStoryIds = storyIds.filter(isValidStoryId);
      for (const id of validStoryIds) {
        if (!validatedStoryIds.includes(id)) validatedStoryIds.push(id);
      }
      checks.push({
        id: 'pr_story_id_present_when_required',
        pass: !scopeSensitive || storyIds.length > 0,
        detail: scopeSensitive
          ? (storyIds.length > 0 ? `story_ids=${storyIds.join(', ')}` : 'story_id missing')
          : 'not required (scope clean)',
      });
      checks.push({
        id: 'pr_story_id_format_valid',
        pass: !scopeSensitive || (storyIds.length > 0 && validStoryIds.length === storyIds.length),
        detail: scopeSensitive
          ? (storyIds.length > 0
            ? `valid_story_ids=${validStoryIds.join(', ') || 'none'}`
            : 'story_id missing')
          : 'not required (scope clean)',
      });
      continue;
    }
    checks.push({
      id: `pr_dor_field_${field.key}`,
      pass: !scopeSensitive || isMeaningful(value),
      detail: scopeSensitive
        ? (isMeaningful(value) ? `${field.label} captured` : `${field.label} missing/placeholder`)
        : 'not required (scope clean)',
    });
  }

  const status = checks.every((c) => c.pass) ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null,
    head_sha: String(head || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null,
    base_sha: base || null,
    scope_sensitive_change: scopeSensitive,
    changed_files_count: changedFiles.length,
    changed_files_sample: changedFiles.slice(0, 100),
    validated_story_ids: validatedStoryIds,
    fields: fieldValues,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const md = [
    '# PR DoR Metadata Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Scope-sensitive change: ${report.scope_sensitive_change}`,
    `Changed files: ${report.changed_files_count}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (strict && status !== 'pass') process.exit(2);
}

main();
