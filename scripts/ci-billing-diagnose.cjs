#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const runLimit = Math.max(1, Number.parseInt(String(limitArg || '').split('=')[1] || '20', 10) || 20);
const maxFailedRunsToInspect = 12;
const maxJobsToInspect = 64;
const billingPattern =
  /(recent account payments have failed|spending limit needs to be increased|billing details in your account settings)/i;

function runCmd(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return {
    code: result.status ?? -1,
    out: (result.stdout || '').trim(),
    err: (result.stderr || '').trim(),
  };
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function trimText(value, max = 240) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 3))}...`;
}

function resolveRepo() {
  const fromEnv = String(process.env.GITHUB_REPOSITORY || '').trim();
  if (fromEnv) return fromEnv;
  const view = runCmd('gh', ['repo', 'view', '--json', 'nameWithOwner']);
  if (view.code !== 0) return null;
  const parsed = parseJsonSafe(view.out);
  const nameWithOwner = String(parsed && parsed.nameWithOwner ? parsed.nameWithOwner : '').trim();
  return nameWithOwner || null;
}

function findBillingDetections(repo, runs) {
  const detections = [];
  const failedRuns = runs
    .filter((run) => {
      const conclusion = String(run?.conclusion || '').toLowerCase();
      return conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out' || conclusion === 'action_required';
    })
    .slice(0, maxFailedRunsToInspect);

  for (const run of failedRuns) {
    const runId = Number(run?.databaseId || 0);
    if (!Number.isFinite(runId) || runId <= 0) continue;
    const view = runCmd('gh', ['run', 'view', String(runId), '--json', 'jobs']);
    if (view.code !== 0) continue;
    const parsed = parseJsonSafe(view.out);
    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    for (const job of jobs.slice(0, maxJobsToInspect)) {
      const checkRunId = Number(job?.databaseId || 0);
      if (!Number.isFinite(checkRunId) || checkRunId <= 0) continue;
      const ann = runCmd('gh', ['api', `repos/${repo}/check-runs/${checkRunId}/annotations`]);
      if (ann.code !== 0) continue;
      const annotations = parseJsonSafe(ann.out);
      if (!Array.isArray(annotations)) continue;
      for (const row of annotations) {
        const message = `${String(row?.title || '')} ${String(row?.message || '')} ${String(row?.raw_details || '')}`;
        if (!billingPattern.test(message)) continue;
        detections.push({
          run_id: runId,
          workflow: String(run?.workflowName || ''),
          run_url: String(run?.url || ''),
          job: String(job?.name || ''),
          check_run_id: checkRunId,
          annotation: trimText(message, 260),
        });
      }
    }
  }
  return detections;
}

function writeReports(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'ci-billing-readiness-latest.json');
  const mdPath = path.join(outDir, 'ci-billing-readiness-latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const checksMd = report.checks
    .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
    .join('\n');
  const detectionsMd =
    report.detections.length === 0
      ? '- none'
      : report.detections
          .map(
            (row) =>
              `- run ${row.run_id} (${row.workflow}) job=${row.job} check_run=${row.check_run_id}\n  - ${row.annotation}`,
          )
          .join('\n');
  const actionsMd =
    (Array.isArray(report.recommended_actions) ? report.recommended_actions : [])
      .map((step) => `- ${step}`)
      .join('\n') || '- none';
  const md = `# CI Billing Readiness\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nRepository: ${report.repo || '(unresolved)'}\nRun limit: ${report.run_limit}\n\n## Checks\n${checksMd}\n\n## Billing blocker detections\n${detectionsMd}\n\n## Recommended actions\n${actionsMd}\n`;
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Wrote ${path.relative(root, jsonPath)}`);
  console.log(`Wrote ${path.relative(root, mdPath)}`);
}

function main() {
  const checks = [];
  const version = runCmd('gh', ['--version']);
  checks.push({
    id: 'gh_cli_available',
    pass: version.code === 0,
    detail: version.code === 0 ? trimText(version.out.split('\n')[0]) : trimText(version.err || version.out || 'gh missing'),
  });

  const auth = runCmd('gh', ['auth', 'status']);
  checks.push({
    id: 'gh_auth_ready',
    pass: auth.code === 0,
    detail: auth.code === 0 ? 'authenticated' : trimText(auth.err || auth.out || 'gh auth failed'),
  });

  const repo = resolveRepo();
  checks.push({
    id: 'gh_repo_resolved',
    pass: Boolean(repo),
    detail: repo || 'unable to resolve repository from env or gh repo view',
  });

  let runs = [];
  if (repo && checks.every((check) => check.pass)) {
    const runsRes = runCmd('gh', [
      'run',
      'list',
      '--limit',
      String(runLimit),
      '--json',
      'databaseId,workflowName,status,conclusion,createdAt,headSha,url',
    ]);
    if (runsRes.code === 0) {
      const parsed = parseJsonSafe(runsRes.out);
      runs = Array.isArray(parsed) ? parsed : [];
      checks.push({
        id: 'github_runs_collected',
        pass: runs.length > 0,
        detail: runs.length > 0 ? `runs=${runs.length}` : 'no runs returned',
      });
    } else {
      checks.push({
        id: 'github_runs_collected',
        pass: false,
        detail: trimText(runsRes.err || runsRes.out || `gh run list failed (exit ${runsRes.code})`),
      });
    }
  } else {
    checks.push({
      id: 'github_runs_collected',
      pass: false,
      detail: 'skipped due to missing gh prerequisites',
    });
  }

  let detections = [];
  if (repo && runs.length > 0) {
    detections = findBillingDetections(repo, runs);
  }

  checks.push({
    id: 'ci_billing_blocker_not_detected',
    pass: detections.length === 0,
    detail: detections.length === 0 ? 'no billing annotations detected in sampled failed runs' : `detections=${detections.length}`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    repo,
    run_limit: runLimit,
    total_runs_sampled: runs.length,
    detections,
    checks,
    recommended_actions:
      detections.length > 0
        ? [
            'Open GitHub billing and resolve failed payments or raise Actions spending limit.',
            'Re-run a lightweight workflow (for example deployment-pipeline) and confirm jobs start normally.',
            'Re-run release gates sync after billing unblock to refresh provenance artifacts.',
          ]
        : [],
  };

  writeReports(report);
  if (strict && status !== 'pass') process.exit(2);
}

main();
