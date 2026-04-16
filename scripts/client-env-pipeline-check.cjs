#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const CLIENT_WORKFLOWS = [
  '.github/workflows/ui-e2e-accessibility.yml',
  '.github/workflows/flutter-user-app-ci.yml',
  '.github/workflows/desktop-tauri-release.yml',
  '.github/workflows/onboarding-readiness.yml',
];
const CLIENT_WORKFLOW_RUN_NAMES = [
  'ui-e2e-accessibility',
  'flutter-user-app-ci',
  'desktop-tauri-release',
  'onboarding-readiness',
];
const runFreshnessMaxAgeHours = Number(process.env.CLIENT_ENV_PIPELINE_RUN_MAX_AGE_HOURS || 168);
const targetRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null;
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
const targetBranch = (() => {
  if (!targetRef) return null;
  if (targetRef.startsWith('refs/heads/')) return targetRef.slice('refs/heads/'.length);
  if (targetRef.startsWith('refs/tags/')) return targetRef.slice('refs/tags/'.length);
  return targetRef;
})();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function hasForbiddenPattern(body) {
  const patterns = [
    /cat\s+>\s*\.env\b/i,
    /cat\s+>\s*.+\/\.env\b/i,
    /echo\s+.+\s+>>?\s*\.env\b/i,
    /echo\s+.+\s+>>?\s*.+\/\.env\b/i,
    /\bsource\s+\.env\b/i,
    /\bdotenv\b/i,
  ];
  return patterns.some((rx) => rx.test(body));
}

function hasSensitiveGithubEnvWrite(body) {
  // Block writing secret-like variables to GITHUB_ENV.
  return /(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)\s*=.*GITHUB_ENV/i.test(body);
}

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

function evaluateWorkflowRunHealth(workflowName) {
  const runListArgs = ['run', 'list', '--workflow', workflowName, '--limit', '50', '--json', 'status,conclusion,createdAt,databaseId,headSha,headBranch,name'];
  if (targetBranch) runListArgs.push('--branch', targetBranch);
  const runs = runCmd('gh', runListArgs);
  if (runs.code !== 0) {
    return {
      workflow: workflowName,
      pass: false,
      detail: `gh run list failed: ${runs.err || runs.out || `exit ${runs.code}`}`,
      provenance: {
        workflow: workflowName,
        run_id: null,
        head_sha: null,
        head_branch: null,
        target_sha: targetSha,
        target_branch: targetBranch,
      },
    };
  }

  const data = parseJsonSafe(runs.out);
  const runsList = Array.isArray(data) ? data : [];
  const latest = targetSha
    ? runsList.find((row) => String(row?.headSha || '').trim() === targetSha) || null
    : runsList[0] || null;
  if (!latest) {
    return {
      workflow: workflowName,
      pass: false,
      detail: targetSha
        ? `no runs found for target sha ${targetSha}`
        : 'no runs found',
      provenance: {
        workflow: workflowName,
        run_id: null,
        head_sha: null,
        head_branch: null,
        target_sha: targetSha,
        target_branch: targetBranch,
      },
    };
  }

  const createdAtMs = latest?.createdAt ? Date.parse(String(latest.createdAt)) : Number.NaN;
  const runAgeHours = Number.isNaN(createdAtMs)
    ? null
    : Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60));
  const fresh = typeof runAgeHours === 'number' && runAgeHours <= runFreshnessMaxAgeHours;
  const shaMatch = Boolean(targetSha) && String(latest.headSha || '').trim() === targetSha;
  const pass = Boolean(
    latest.status === 'completed'
    && latest.conclusion === 'success'
    && fresh
    && (!targetSha || shaMatch),
  );
  return {
    workflow: workflowName,
    pass,
    detail: `${latest.status}/${latest.conclusion} run_id=${latest.databaseId || '(missing)'} head_sha=${latest.headSha || '(missing)'} branch=${latest.headBranch || '(missing)'} sha_match=${String(!targetSha || shaMatch)} age_h=${runAgeHours === null ? 'unknown' : runAgeHours.toFixed(2)}`,
    provenance: {
      workflow: workflowName,
      run_id: latest.databaseId || null,
      head_sha: latest.headSha || null,
      head_branch: latest.headBranch || null,
      target_sha: targetSha,
      target_branch: targetBranch,
      created_at: latest.createdAt || null,
      run_age_hours: runAgeHours,
      run_max_age_hours: runFreshnessMaxAgeHours,
      sha_match: !targetSha || shaMatch,
    },
  };
}

function run() {
  const results = CLIENT_WORKFLOWS.map((rel) => {
    const body = read(rel);
    return {
      rel,
      has_forbidden_pattern: hasForbiddenPattern(body),
      has_sensitive_github_env_write: hasSensitiveGithubEnvWrite(body),
      uses_secret_context: body.includes('${{ secrets.'),
    };
  });

  const workflowRunHealth = CLIENT_WORKFLOW_RUN_NAMES.map((workflowName) => evaluateWorkflowRunHealth(workflowName));

  const checks = [
    {
      id: 'client_workflows_present',
      pass: results.length === CLIENT_WORKFLOWS.length,
      detail: CLIENT_WORKFLOWS.join(', '),
    },
    {
      id: 'no_adhoc_dotenv_materialization_in_client_pipelines',
      pass: results.every((r) => !r.has_forbidden_pattern),
      detail: results
        .filter((r) => r.has_forbidden_pattern)
        .map((r) => r.rel)
        .join(', ') || 'none',
    },
    {
      id: 'no_sensitive_values_written_to_github_env_in_client_pipelines',
      pass: results.every((r) => !r.has_sensitive_github_env_write),
      detail: results
        .filter((r) => r.has_sensitive_github_env_write)
        .map((r) => r.rel)
        .join(', ') || 'none',
    },
    {
      id: 'client_pipelines_use_secret_context_when_needed',
      pass: results.some((r) => r.uses_secret_context),
      detail: results.filter((r) => r.uses_secret_context).map((r) => r.rel).join(', '),
    },
    {
      id: 'client_workflow_run_success_latest',
      pass: workflowRunHealth.every((entry) => entry.pass),
      detail: workflowRunHealth.map((entry) => `${entry.workflow}=${entry.pass ? 'pass' : 'fail'}`).join(', '),
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    workflows: results,
    workflow_run_health: workflowRunHealth,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'client-env-pipeline-latest.json');
  const outMd = path.join(outDir, 'client-env-pipeline-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Client Pipeline Env Governance Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
