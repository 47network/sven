#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const repoFlagIndex = process.argv.findIndex((arg) => arg === '--repo');
const repoFromArg = repoFlagIndex >= 0 ? String(process.argv[repoFlagIndex + 1] || '').trim() : '';
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'bridge-ci-lanes-remote-latest.json');
const outMd = path.join(outDir, 'bridge-ci-lanes-remote-latest.md');
const maxAgeHours = Number(process.env.BRIDGE_CI_LANES_REMOTE_MAX_AGE_HOURS || 168);
const targetBranch = String(process.env.BRIDGE_CI_LANES_TARGET_BRANCH || '').trim();
const githubRepo = repoFromArg || String(process.env.BRIDGE_CI_LANES_GH_REPO || process.env.GH_REPO || '').trim();

const REQUIRED_WORKFLOWS = [
  'bridge-runtime-tests',
  'gateway-bridge-contract-tests',
];

function runGh(args, options = {}) {
  const useRepo = options.useRepo !== false;
  const effectiveArgs = (useRepo && githubRepo) ? ['-R', githubRepo, ...args] : args;
  const result = spawnSync('gh', effectiveArgs, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return {
    code: result.status ?? -1,
    out: String(result.stdout || '').trim(),
    err: String(result.stderr || '').trim(),
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseIsoAgeHours(value) {
  if (!value) return null;
  const ts = Date.parse(String(value));
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60);
}

function normalizeRun(run) {
  if (!run || typeof run !== 'object') return null;
  const id = run.databaseId ?? run.id ?? null;
  const createdAt = String(run.createdAt || run.created_at || '').trim();
  const conclusion = String(run.conclusion || '').trim().toLowerCase();
  const status = String(run.status || '').trim().toLowerCase();
  const headSha = String(run.headSha || run.head_sha || '').trim();
  const headBranch = String(run.headBranch || run.head_branch || '').trim();
  const htmlUrl = String(run.url || run.htmlUrl || run.html_url || '').trim();
  return {
    id: id === null ? null : String(id),
    created_at: createdAt || null,
    status: status || null,
    conclusion: conclusion || null,
    head_sha: headSha || null,
    head_branch: headBranch || null,
    url: htmlUrl || null,
  };
}

function pickLatestCompletedSuccess(runs) {
  const normalized = runs
    .map(normalizeRun)
    .filter(Boolean)
    .sort((a, b) => Date.parse(String(b.created_at || '')) - Date.parse(String(a.created_at || '')));
  const latest = normalized[0] || null;
  const latestSuccess = normalized.find((run) => run.status === 'completed' && run.conclusion === 'success') || null;
  return { latest, latestSuccess };
}

const checks = [];
const workflowEvidence = [];

const ghAuth = runGh(['auth', 'status', '-h', 'github.com'], { useRepo: false });
checks.push({
  id: 'gh_auth_status_available',
  pass: ghAuth.code === 0,
  detail: ghAuth.code === 0 ? 'gh auth status ok' : (ghAuth.err || ghAuth.out || `exit ${ghAuth.code}`),
});
checks.push({
  id: 'gh_repo_target_available',
  pass: Boolean(githubRepo),
  detail: githubRepo ? `repo=${githubRepo}` : 'missing repo target; set BRIDGE_CI_LANES_GH_REPO or pass --repo <owner/name>',
});

for (const workflow of REQUIRED_WORKFLOWS) {
  if (!githubRepo) {
    checks.push({
      id: `gh_run_list:${workflow}`,
      pass: false,
      detail: 'repo target missing',
    });
    workflowEvidence.push({ workflow, latest: null, latest_success: null });
    continue;
  }
  const args = ['run', 'list', '--workflow', workflow, '--limit', '30', '--json', 'databaseId,status,conclusion,createdAt,headSha,headBranch,url'];
  const runList = runGh(args);
  if (runList.code !== 0) {
    checks.push({
      id: `gh_run_list:${workflow}`,
      pass: false,
      detail: runList.err || runList.out || `exit ${runList.code}`,
    });
    workflowEvidence.push({ workflow, latest: null, latest_success: null });
    continue;
  }

  const parsed = parseJson(runList.out);
  const runs = Array.isArray(parsed) ? parsed : [];
  checks.push({
    id: `gh_run_list:${workflow}`,
    pass: Array.isArray(parsed),
    detail: Array.isArray(parsed) ? `runs=${runs.length}` : 'invalid JSON from gh run list',
  });

  const { latest, latestSuccess } = pickLatestCompletedSuccess(runs);
  workflowEvidence.push({
    workflow,
    latest,
    latest_success: latestSuccess,
  });

  checks.push({
    id: `latest_run_exists:${workflow}`,
    pass: Boolean(latest),
    detail: latest ? `run_id=${latest.id || '(missing)'} status=${latest.status || '(missing)'} conclusion=${latest.conclusion || '(missing)'}` : 'no runs found',
  });

  checks.push({
    id: `latest_success_exists:${workflow}`,
    pass: Boolean(latestSuccess),
    detail: latestSuccess
      ? `run_id=${latestSuccess.id || '(missing)'} created_at=${latestSuccess.created_at || '(missing)'}`
      : 'no successful completed run found',
  });

  const age = parseIsoAgeHours(latestSuccess?.created_at);
  checks.push({
    id: `latest_success_fresh:${workflow}`,
    pass: age !== null && age <= maxAgeHours,
    detail: age === null
      ? `invalid or missing created_at (max_age_hours=${maxAgeHours})`
      : `age_hours=${age.toFixed(2)} max_age_hours=${maxAgeHours}`,
  });

  if (targetBranch) {
    checks.push({
      id: `latest_success_branch_match:${workflow}`,
      pass: String(latestSuccess?.head_branch || '') === targetBranch,
      detail: `head_branch=${String(latestSuccess?.head_branch || '(missing)')} target_branch=${targetBranch}`,
    });
  }
}

const status = checks.every((check) => Boolean(check.pass)) ? 'pass' : 'fail';

const report = {
  generated_at: new Date().toISOString(),
  status,
  execution: {
    strict,
    github_repo: githubRepo || null,
    target_branch: targetBranch || null,
    max_age_hours: maxAgeHours,
  },
  checks,
  workflows: workflowEvidence,
  artifacts: {
    output_json: path.relative(root, outJson).replace(/\\/g, '/'),
    output_md: path.relative(root, outMd).replace(/\\/g, '/'),
  },
};

const md = [
  '# Bridge CI Lanes Remote Check',
  '',
  `- Generated at: ${report.generated_at}`,
  `- Status: ${report.status}`,
  `- Strict: ${String(strict)}`,
  `- GitHub repo: ${githubRepo || '(not set)'}`,
  `- Max age hours: ${String(maxAgeHours)}`,
  `- Target branch: ${targetBranch || '(not set)'}`,
  '',
  '## Checks',
  ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Workflow Evidence',
  ...workflowEvidence.flatMap((entry) => {
    const latest = entry.latest;
    const latestSuccess = entry.latest_success;
    return [
      `- workflow: ${entry.workflow}`,
      `  - latest: ${latest ? `${latest.id || '(missing)'} status=${latest.status || '(missing)'} conclusion=${latest.conclusion || '(missing)'} branch=${latest.head_branch || '(missing)'} created_at=${latest.created_at || '(missing)'}` : '(none)'}`,
      `  - latest_success: ${latestSuccess ? `${latestSuccess.id || '(missing)'} branch=${latestSuccess.head_branch || '(missing)'} created_at=${latestSuccess.created_at || '(missing)'}` : '(none)'}`,
      `  - latest_success_url: ${latestSuccess?.url || '(missing)'}`,
    ];
  }),
  '',
].join('\n');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');
fs.writeFileSync(outMd, md, 'utf8');

console.log(`Wrote ${path.relative(root, outJson).replace(/\\/g, '/')}`);
console.log(`Wrote ${path.relative(root, outMd).replace(/\\/g, '/')}`);

if (strict && status !== 'pass') {
  process.exitCode = 1;
}
