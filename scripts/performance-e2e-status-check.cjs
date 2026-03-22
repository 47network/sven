#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const localOnly = process.argv.includes('--local-only') || process.env.CI_REQUIRED_CHECKS_LOCAL_ONLY === '1';
const workflowName = 'performance-e2e';
const outJson = path.join(root, 'docs', 'release', 'status', 'performance-e2e-latest.json');
const outMd = path.join(root, 'docs', 'release', 'status', 'performance-e2e-latest.md');
const maxAgeHours = Number(process.env.SVEN_PERFORMANCE_E2E_MAX_AGE_HOURS || 72);

const targetRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null;
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
const targetBranch = (() => {
  if (!targetRef) return null;
  if (targetRef.startsWith('refs/heads/')) return targetRef.slice('refs/heads/'.length);
  if (targetRef.startsWith('refs/tags/')) return targetRef.slice('refs/tags/'.length);
  return targetRef;
})();

function runCmd(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? -1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const checks = [];
  const provenance = {
    workflow: workflowName,
    mode: localOnly ? 'local_only' : 'remote',
    run_id: null,
    head_sha: null,
    head_branch: null,
    target_ref: targetRef,
    target_branch: targetBranch,
    target_sha: targetSha,
    run_query_scope: targetBranch ? `workflow+branch(${targetBranch})` : 'workflow_only',
    sha_match: false,
  };

  if (localOnly) {
    checks.push({
      id: 'performance_e2e_remote_run_lookup',
      pass: false,
      detail: 'local-only mode: remote workflow lookup skipped',
    });
  } else {
    const args = ['run', 'list', '--workflow', workflowName, '--limit', '50', '--json', 'status,conclusion,createdAt,databaseId,headSha,headBranch,name,event'];
    if (targetBranch) args.push('--branch', targetBranch);
    const runs = runCmd('gh', args);
    const data = runs.code === 0 ? parseJsonSafe(runs.out) : null;
    const runsList = Array.isArray(data) ? data : [];
    const latest = targetSha
      ? runsList.find((row) => String(row?.headSha || '').trim() === targetSha) || null
      : runsList[0] || null;

    const status = latest ? String(latest.status || '').toLowerCase() : '';
    const conclusion = latest ? String(latest.conclusion || '').toLowerCase() : '';
    const ts = latest ? String(latest.createdAt || '') : '';
    const age = ageHours(ts);
    const fresh = typeof age === 'number' && age <= maxAgeHours;
    const shaMatch = !targetSha || (latest && String(latest.headSha || '').trim() === targetSha);

    provenance.run_id = latest?.databaseId || null;
    provenance.head_sha = latest?.headSha || null;
    provenance.head_branch = latest?.headBranch || null;
    provenance.sha_match = Boolean(shaMatch);

    checks.push({
      id: 'performance_e2e_remote_run_lookup',
      pass: runs.code === 0,
      detail: runs.code === 0 ? 'ok' : (runs.err || runs.out || `gh run list exit=${runs.code}`),
    });
    checks.push({
      id: 'performance_e2e_run_present',
      pass: Boolean(latest),
      detail: latest ? `run_id=${latest.databaseId}` : 'no matching run found',
    });
    checks.push({
      id: 'performance_e2e_run_success',
      pass: Boolean(latest && status === 'completed' && conclusion === 'success' && shaMatch),
      detail: latest
        ? `status=${status} conclusion=${conclusion} sha_match=${String(Boolean(shaMatch))}`
        : 'no matching run',
    });
    checks.push({
      id: 'performance_e2e_run_fresh',
      pass: Boolean(latest && fresh),
      detail: latest
        ? fresh
          ? `${age.toFixed(2)}h <= ${maxAgeHours}h`
          : `${(age || 0).toFixed(2)}h > ${maxAgeHours}h`
        : 'no matching run',
    });
    checks.push({
      id: 'performance_e2e_provenance_present',
      pass: Boolean(latest && latest.databaseId && /^[a-f0-9]{7,40}$/i.test(String(latest.headSha || ''))),
      detail: latest
        ? `run_id=${latest.databaseId || '(missing)'} head_sha=${latest.headSha || '(missing)'}`
        : 'no matching run',
    });
  }

  let status = 'pass';
  if (checks.some((check) => !check.pass)) status = 'fail';
  if (status !== 'fail' && localOnly) status = 'inconclusive';

  const report = {
    generated_at: new Date().toISOString(),
    status,
    max_age_hours: maxAgeHours,
    checks,
    provenance,
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Performance E2E Status\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  console.log(`performance-e2e-status-check: ${status}`);
  if (status === 'fail') process.exit(1);
  if (strict && status !== 'pass') process.exit(2);
}

run();
