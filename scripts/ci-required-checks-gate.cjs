#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { detectOpsShellCiRequirement } = require('./lib/ops-shell-ci-scope.cjs');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const localOnlyFlag = process.argv.includes('--local-only');
const localOnlyEnvRequested = process.env.CI_REQUIRED_CHECKS_LOCAL_ONLY === '1';
const ciContext = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const localOnly = localOnlyFlag || (!ciContext && localOnlyEnvRequested);
const targetRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null;
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
const currentWorkflowName = String(process.env.GITHUB_WORKFLOW || '').trim().toLowerCase();
const currentRunId = String(process.env.GITHUB_RUN_ID || '').trim();
const targetBranch = (() => {
  if (!targetRef) return null;
  if (targetRef.startsWith('refs/heads/')) return targetRef.slice('refs/heads/'.length);
  if (targetRef.startsWith('refs/tags/')) return targetRef.slice('refs/tags/'.length);
  return targetRef;
})();
const runFreshnessMaxAgeHours = Number(process.env.CI_REQUIRED_RUN_MAX_AGE_HOURS || 72);

const REQUIRED_WORKFLOW_MANIFEST_PATH = path.join(root, 'config', 'release', 'required-workflows.json');

function readRequiredWorkflowsFromManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REQUIRED_WORKFLOW_MANIFEST_PATH, 'utf8'));
    const values = Array.isArray(parsed?.required_workflows)
      ? parsed.required_workflows.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (values.length > 0) return values;
  } catch {
    // Fall back to in-script defaults when manifest is unavailable.
  }
  return null;
}

const REQUIRED_WORKFLOWS = readRequiredWorkflowsFromManifest() || [
  'final-dod-e2e',
  'parity-e2e',
  'd9-keycloak-interop-gate',
  'release-ops-drill',
  'mobile-auth-session-smoke',
  'flutter-user-app-device-farm',
  'desktop-tauri-release',
  'ui-e2e-accessibility',
  'gateway-coverage-gate',
  'client-env-governance',
  'backend-capability-e2e',
  'security-privacy-governance',
  'privacy-admin-e2e',
  'integration-truthfulness',
  'sast-codeql',
  'release-supply-chain',
  'workflow-sanity',
];

const REQUIRED_WORKFLOW_FILES = REQUIRED_WORKFLOWS.map((wf) => `${wf}.yml`);

function runCmd(cmd, args) {
  const lowerCmd = String(cmd || '').toLowerCase();
  const applyTimeout = lowerCmd === 'gh' || lowerCmd.endsWith('/gh') || lowerCmd.endsWith('\\gh.exe');
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    ...(applyTimeout ? { timeout: 120000 } : {}),
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return { code: r.status ?? -1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function resolveReleaseSupplyChainReadinessJobEvidence(runId) {
  if (!runId) {
    return {
      ok: false,
      event: null,
      readiness_job_present: false,
      readiness_job_conclusion: null,
      checks_job_conclusion: null,
      detail: 'missing run id for release-supply-chain job evidence lookup',
    };
  }
  const view = runCmd('gh', ['run', 'view', String(runId), '--json', 'event,jobs']);
  if (view.code !== 0) {
    return {
      ok: false,
      event: null,
      readiness_job_present: false,
      readiness_job_conclusion: null,
      checks_job_conclusion: null,
      detail: `failed to query run jobs: ${view.err || view.out || `exit ${view.code}`}`,
    };
  }
  const payload = parseJsonSafe(view.out);
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      event: null,
      readiness_job_present: false,
      readiness_job_conclusion: null,
      checks_job_conclusion: null,
      detail: 'invalid run view payload for release-supply-chain',
    };
  }
  const event = String(payload.event || '').trim().toLowerCase() || null;
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const readinessJob =
    jobs.find((job) => String(job?.name || '').trim() === 'release-readiness-gates')
    || null;
  const checksJob =
    jobs.find((job) => String(job?.name || '').trim() === 'checks')
    || null;
  const readinessConclusion = readinessJob ? String(readinessJob.conclusion || '').trim().toLowerCase() || null : null;
  const checksConclusion = checksJob ? String(checksJob.conclusion || '').trim().toLowerCase() || null : null;
  const readinessPresent = Boolean(readinessJob);
  const ok = readinessPresent && readinessConclusion === 'success';
  return {
    ok,
    event,
    readiness_job_present: readinessPresent,
    readiness_job_conclusion: readinessConclusion,
    checks_job_conclusion: checksConclusion,
    detail: readinessPresent
      ? `event=${event || '(missing)'} release-readiness-gates=${readinessConclusion || '(missing)'}`
      : `event=${event || '(missing)'} release-readiness-gates job missing`,
  };
}

function resolveDesktopReleaseMatrixEvidence(runId) {
  if (!runId) {
    return {
      ok: false,
      platform_matrix_ok: false,
      event: null,
      required_jobs: ['build-windows', 'build-linux', 'checksums', 'provenance'],
      job_conclusions: {},
      detail: 'missing run id for desktop release matrix evidence lookup',
    };
  }
  const view = runCmd('gh', ['run', 'view', String(runId), '--json', 'event,jobs']);
  if (view.code !== 0) {
    return {
      ok: false,
      platform_matrix_ok: false,
      event: null,
      required_jobs: ['build-windows', 'build-linux', 'checksums', 'provenance'],
      job_conclusions: {},
      detail: `failed to query run jobs: ${view.err || view.out || `exit ${view.code}`}`,
    };
  }
  const payload = parseJsonSafe(view.out);
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      platform_matrix_ok: false,
      event: null,
      required_jobs: ['build-windows', 'build-linux', 'checksums', 'provenance'],
      job_conclusions: {},
      detail: 'invalid run view payload for desktop-tauri-release',
    };
  }
  const requiredJobs = ['build-windows', 'build-linux', 'checksums', 'provenance'];
  const event = String(payload.event || '').trim().toLowerCase() || null;
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const conclusions = {};
  let platformMatrixOk = true;
  for (const jobName of requiredJobs) {
    const found = jobs.find((job) => String(job?.name || '').trim() === jobName) || null;
    const conclusion = found ? String(found.conclusion || '').trim().toLowerCase() || null : null;
    conclusions[jobName] = conclusion;
    if (conclusion !== 'success') {
      platformMatrixOk = false;
    }
  }
  const detail = requiredJobs
    .map((jobName) => `${jobName}=${conclusions[jobName] || '(missing)'}`)
    .join(' ');
  return {
    ok: platformMatrixOk,
    platform_matrix_ok: platformMatrixOk,
    event,
    required_jobs: requiredJobs,
    job_conclusions: conclusions,
    detail: `event=${event || '(missing)'} ${detail}`,
  };
}

function normalizeRelPath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

function parseWorkflowList(out) {
  const parsed = parseJsonSafe(out);
  if (Array.isArray(parsed)) {
    return parsed.map((row) => ({
      id: row?.id ?? null,
      name: String(row?.name || '').trim(),
      path: normalizeRelPath(row?.path || ''),
      state: String(row?.state || '').trim().toLowerCase() || null,
    }));
  }
  return [];
}

function resolveWorkflowIdentity(available, canonicalPath, workflowName) {
  const pathMatches = available.filter((entry) => normalizeRelPath(entry.path) === canonicalPath);
  if (pathMatches.length > 1) {
    return {
      matched: null,
      ambiguous: true,
      detail: `ambiguous canonical path match count=${pathMatches.length}`,
    };
  }
  if (pathMatches.length === 1) {
    return {
      matched: pathMatches[0],
      ambiguous: false,
      detail: 'matched by canonical path',
    };
  }

  const nameMatches = available.filter((entry) => entry.name === workflowName);
  if (nameMatches.length > 1) {
    return {
      matched: null,
      ambiguous: true,
      detail: `ambiguous exact-name match count=${nameMatches.length}`,
    };
  }
  if (nameMatches.length === 1) {
    return {
      matched: nameMatches[0],
      ambiguous: false,
      detail: 'matched by exact workflow name',
    };
  }

  return {
    matched: null,
    ambiguous: false,
    detail: 'no exact workflow match',
  };
}

function readJsonIfExists(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function validateA2ACompatReport(report) {
  if (!report || typeof report !== 'object') return 'missing or invalid JSON object';
  if (report.schema_version !== 1) return 'schema_version must be 1';
  const status = String(report.status || '').toLowerCase();
  if (!['pass', 'pass_with_skips', 'fail'].includes(status)) return 'status must be pass|pass_with_skips|fail';
  if (!Array.isArray(report.checks)) return 'checks must be array';
  const requiredIds = new Set(['a2a_route_tests_pass', 'a2a_live_smoke_pass', 'a2a_live_peer_evidence_pass']);
  for (const c of report.checks) {
    if (c && typeof c.id === 'string') requiredIds.delete(c.id);
  }
  if (requiredIds.size > 0) return `missing required checks: ${Array.from(requiredIds).join(', ')}`;
  return null;
}

function validateMCPCompatReport(report) {
  if (!report || typeof report !== 'object') return 'missing or invalid JSON object';
  const status = String(report.status || '').toLowerCase();
  if (!['pass', 'pass_with_skips', 'fail'].includes(status)) return 'status must be pass|pass_with_skips|fail';
  if (!Array.isArray(report.checks)) return 'checks must be array';
  const requiredIds = new Set([
    'mcp_server_route_tests_pass',
    'mcp_server_live_e2e_tests_pass',
    'mcp_server_http_smoke_pass',
  ]);
  for (const c of report.checks) {
    if (c && typeof c.id === 'string') requiredIds.delete(c.id);
  }
  if (requiredIds.size > 0) return `missing required checks: ${Array.from(requiredIds).join(', ')}`;
  return null;
}

function validateParityChecklistVerifyReport(report) {
  if (!report || typeof report !== 'object') return 'missing or invalid JSON object';
  const status = String(report.status || '').toLowerCase();
  if (!['pass', 'fail'].includes(status)) return 'status must be pass|fail';
  if (!Array.isArray(report.checks)) return 'checks must be array';
  const requiredIds = new Set([
    'checklist_present',
    'checklist_no_unchecked_items',
    'checklist_referenced_files_exist',
    'parity_required_files_exist',
  ]);
  for (const c of report.checks) {
    if (c && typeof c.id === 'string') requiredIds.delete(c.id);
  }
  if (requiredIds.size > 0) return `missing required checks: ${Array.from(requiredIds).join(', ')}`;
  return null;
}

function resolveOutputBasenames({ localOnlyMode, strictMode }) {
  if (localOnlyMode) {
    return strictMode
      ? {
          json: 'ci-required-checks-local-only-strict.json',
          md: 'ci-required-checks-local-only-strict.md',
        }
      : {
          json: 'ci-required-checks-local-only.json',
          md: 'ci-required-checks-local-only.md',
        };
  }
  return {
    json: 'ci-required-checks-latest.json',
    md: 'ci-required-checks-latest.md',
  };
}

function run() {
  const opsShellRequirement = detectOpsShellCiRequirement({
    rootDir: root,
    targetSha,
    baseRef: targetBranch ? `origin/${targetBranch}` : null,
  });
  const effectiveRequiredWorkflows = REQUIRED_WORKFLOWS.slice();
  if (opsShellRequirement.required && !effectiveRequiredWorkflows.includes('ops-shell-ci')) {
    effectiveRequiredWorkflows.push('ops-shell-ci');
  }
  const effectiveRequiredWorkflowFiles = effectiveRequiredWorkflows.map((wf) => `${wf}.yml`);

  const workflowsDir = path.join(root, '.github', 'workflows');
  const localWorkflowFiles = new Set(
    fs.existsSync(workflowsDir)
      ? fs
          .readdirSync(workflowsDir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
      : []
  );

  const workflowList = localOnly
    ? { code: 0, out: '', err: '' }
    : runCmd('gh', ['workflow', 'list', '--json', 'id,name,path,state']);
  const available = [];
  const checks = [];
  checks.push({
    id: 'remote_run_validation_verified',
    pass: !localOnly,
    detail: localOnly
      ? 'false (local-only mode skips remote workflow run verification)'
      : 'true (remote workflow verification enabled)',
  });
  checks.push({
    id: 'mode_local_only_disallowed_in_strict',
    pass: !(strict && localOnly),
    detail: strict && localOnly
      ? 'strict mode requires remote run validation; local-only mode is not allowed'
      : `ok (strict=${String(strict)} local_only=${String(localOnly)})`,
  });
  checks.push({
    id: 'mode_env_local_only_disallowed_in_strict',
    pass: !(strict && localOnlyEnvRequested && !localOnlyFlag),
    detail:
      strict && localOnlyEnvRequested && !localOnlyFlag
        ? 'strict mode forbids env-driven local-only; use explicit --local-only for diagnostics'
        : `ok (strict=${String(strict)} env_local_only=${String(localOnlyEnvRequested)} cli_local_only=${String(localOnlyFlag)} ci_context=${String(ciContext)})`,
  });
  const requireStrictTargetSha = strict && !localOnly;
  checks.push({
    id: 'target_sha_present_for_remote_strict',
    pass: !requireStrictTargetSha || Boolean(targetSha),
    detail: !requireStrictTargetSha
      ? `not required (strict=${String(strict)} local_only=${String(localOnly)})`
      : targetSha
      ? `ok (${targetSha})`
      : 'missing target sha (set GITHUB_SHA or CI_COMMIT_SHA)',
  });
  const remoteUrl = runCmd('git', ['config', '--get', 'remote.origin.url']);
  checks.push({
    id: 'gh_workflow_list_available',
    pass: localOnly || workflowList.code === 0,
    detail: localOnly
      ? 'skipped (local-only mode)'
      : workflowList.code === 0
      ? 'ok'
      : workflowList.err
      ? `failed: ${workflowList.err}; origin=${remoteUrl.out || '(unknown)'}`
      : `failed: gh workflow list returned non-zero; origin=${remoteUrl.out || '(unknown)'}`,
  });
  checks.push({
    id: 'ops_shell_ci_scope_evaluated',
    pass: true,
    detail: `${opsShellRequirement.source}; changed=${opsShellRequirement.changed_files.length}; matched=${opsShellRequirement.matched_files.length}`,
  });
  checks.push({
    id: 'ops_shell_ci_required_when_scope_changed',
    pass: !opsShellRequirement.required || effectiveRequiredWorkflows.includes('ops-shell-ci'),
    detail: opsShellRequirement.required
      ? `required (matched files: ${opsShellRequirement.matched_files.slice(0, 6).join(', ') || '(none)'})`
      : 'not required (scope clean)',
  });

  if (!localOnly && workflowList.code === 0) {
    available.push(...parseWorkflowList(workflowList.out));
  }

  const requiredWorkflowSet = new Set(effectiveRequiredWorkflows);
  checks.push({
    id: 'mobile_signal_scope_distinction',
    pass:
      requiredWorkflowSet.has('mobile-auth-session-smoke')
      && requiredWorkflowSet.has('flutter-user-app-device-farm')
      && !requiredWorkflowSet.has('mobile-device-farm'),
    detail:
      'mobile-auth-session-smoke => mobile_api_auth_session_smoke; '
      + 'flutter-user-app-device-farm => mobile_app_device_smoke; '
      + `legacy_mobile_device_farm_in_required=${String(requiredWorkflowSet.has('mobile-device-farm'))}`,
  });

  const mobileReleaseReadinessLatest = readJsonIfExists('docs/release/status/mobile-release-readiness-latest.json');
  const mobileReleaseReadinessStatus =
    mobileReleaseReadinessLatest && typeof mobileReleaseReadinessLatest === 'object'
      ? String(mobileReleaseReadinessLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'mobile_release_readiness_status_check',
    pass: mobileReleaseReadinessStatus === 'pass',
    detail: `mobile-release-readiness-latest.json status=${mobileReleaseReadinessStatus || '(missing)'}`,
  });

  const multiDeviceValidationLatest = readJsonIfExists('docs/release/status/multi-device-validation-latest.json');
  const multiDeviceValidationStatus =
    multiDeviceValidationLatest && typeof multiDeviceValidationLatest === 'object'
      ? String(multiDeviceValidationLatest.summary?.overall || multiDeviceValidationLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'multi_device_validation_status_check',
    pass: (localOnly && !strict) || multiDeviceValidationStatus === 'pass',
    detail: localOnly
      ? strict
        ? 'failed: local-only mode is disallowed in strict mode'
        : `skipped (local-only mode; status=${multiDeviceValidationStatus || '(missing)'})`
      : `multi-device-validation-latest.json status=${multiDeviceValidationStatus || '(missing)'}`,
  });

  for (const [idx, wf] of effectiveRequiredWorkflows.entries()) {
    const wfFile = effectiveRequiredWorkflowFiles[idx];
    const localPresent = localWorkflowFiles.has(wfFile);
    checks.push({
      id: `workflow_file_local:${wfFile}`,
      pass: localPresent,
      detail: localPresent ? 'present locally' : 'missing locally',
    });

    const canonicalPath = `.github/workflows/${wfFile}`;
    const workflowIdentity = localOnly
      ? { matched: null, ambiguous: false, detail: 'local-only mode' }
      : resolveWorkflowIdentity(available, canonicalPath, wf);
    const matchedWorkflow = workflowIdentity.matched;
    const found = localOnly ? localPresent : Boolean(matchedWorkflow) && !workflowIdentity.ambiguous;
    checks.push({
      id: `workflow_identity_unambiguous:${wf}`,
      pass: localOnly ? true : !workflowIdentity.ambiguous,
      detail: localOnly ? 'skipped (local-only mode)' : workflowIdentity.detail,
    });
    checks.push({
      id: `workflow_present:${wf}`,
      pass: found,
      detail: localOnly
        ? found
          ? 'present locally (local-only mode)'
          : 'missing locally (local-only mode)'
        : workflowIdentity.ambiguous
        ? `ambiguous remote workflow identity for required workflow "${wf}" (${workflowIdentity.detail})`
        : found
        ? `present on remote (id=${matchedWorkflow.id || 'n/a'} path=${matchedWorkflow.path || 'n/a'})`
        : localPresent
        ? `missing on remote (local file exists: .github/workflows/${wfFile}; push to default branch)`
        : 'missing on remote (and missing locally)',
    });

    if (!found || (!localOnly && workflowList.code !== 0)) continue;
    if (localOnly) {
      checks.push({
        id: `latest_run_success:${wf}`,
        pass: !strict,
        detail: strict
          ? 'failed: skipped run check (local-only mode is disallowed in strict mode)'
          : 'skipped run check (local-only mode)',
        provenance: {
          mode: 'local_only',
          workflow: wf,
          workflow_id: null,
          workflow_path: canonicalPath,
          run_id: null,
          head_sha: null,
          head_branch: null,
        },
      });
      continue;
    }
    const selfReferencedReleaseSupplyChain =
      wf === 'release-supply-chain'
      && currentWorkflowName === 'release-supply-chain';
    if (selfReferencedReleaseSupplyChain) {
      checks.push({
        id: `latest_run_success:${wf}`,
        pass: true,
        detail: `skipped self-referential latest-run check in current workflow context (workflow=${currentWorkflowName}; run_id=${currentRunId || '(missing)'})`,
        provenance: {
          mode: 'ci_remote',
          workflow: wf,
          workflow_id: matchedWorkflow?.id ?? null,
          workflow_path: canonicalPath,
          run_id: currentRunId || null,
          head_sha: targetSha || null,
          head_branch: targetBranch || null,
          query_scope: targetBranch ? `branch:${targetBranch}` : 'repo-default',
          sha_match: null,
          freshness_ok: null,
          run_age_hours: null,
          run_max_age_hours: runFreshnessMaxAgeHours,
          skipped_reason: 'self_reference_deadlock_prevention',
        },
      });
      continue;
    }
    const workflowSelector = matchedWorkflow?.id ? String(matchedWorkflow.id) : (matchedWorkflow?.name || wf);
    const runListArgs = ['run', 'list', '--workflow', workflowSelector, '--limit', '50', '--json', 'status,conclusion,createdAt,databaseId,headSha,headBranch,name'];
    if (targetBranch) {
      runListArgs.push('--branch', targetBranch);
    }
    const runs = runCmd('gh', runListArgs);
    const data = runs.code === 0 ? parseJsonSafe(runs.out) : null;
    const runsList = Array.isArray(data) ? data : [];
    const latest = targetSha
      ? runsList.find((row) => String(row?.headSha || '').trim() === targetSha) || null
      : runsList[0] || null;
    const shaMatched = Boolean(targetSha) && Boolean(latest) && String(latest.headSha || '').trim() === targetSha;
    const hasProvenance = Boolean(latest && latest.databaseId && latest.headSha && latest.headBranch);
    const createdAtMs = latest?.createdAt ? Date.parse(String(latest.createdAt)) : Number.NaN;
    const runAgeHours = Number.isNaN(createdAtMs)
      ? null
      : Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60));
    const runFresh = typeof runAgeHours === 'number' && runAgeHours <= runFreshnessMaxAgeHours;
    const releaseSupplyChainEvidence =
      wf === 'release-supply-chain' && latest?.databaseId
        ? resolveReleaseSupplyChainReadinessJobEvidence(latest.databaseId)
        : null;
    const releaseSupplyChainReadinessPass =
      wf === 'release-supply-chain'
        ? Boolean(releaseSupplyChainEvidence && releaseSupplyChainEvidence.ok)
        : true;
    const desktopReleaseEvidence =
      wf === 'desktop-tauri-release' && latest?.databaseId
        ? resolveDesktopReleaseMatrixEvidence(latest.databaseId)
        : null;
    const desktopReleaseMatrixPass =
      wf === 'desktop-tauri-release'
        ? Boolean(desktopReleaseEvidence && desktopReleaseEvidence.ok)
        : true;
    checks.push({
      id: `latest_run_success:${wf}`,
      pass: Boolean(
        (!requireStrictTargetSha || targetSha) &&
        latest &&
        shaMatched &&
        latest.status === 'completed' &&
        latest.conclusion === 'success' &&
        hasProvenance &&
        runFresh &&
        releaseSupplyChainReadinessPass &&
        desktopReleaseMatrixPass,
      ),
      detail: latest
        ? hasProvenance
          ? runFresh
            ? `${latest.status}/${latest.conclusion} run_id=${latest.databaseId} head_sha=${latest.headSha} branch=${latest.headBranch} sha_match=${String(Boolean(shaMatched))} age_h=${runAgeHours.toFixed(2)}${wf === 'release-supply-chain' && releaseSupplyChainEvidence ? `; ${releaseSupplyChainEvidence.detail}` : ''}${wf === 'desktop-tauri-release' && desktopReleaseEvidence ? `; ${desktopReleaseEvidence.detail}` : ''}`
            : `stale run: ${latest.status}/${latest.conclusion} run_id=${latest.databaseId} age_h=${runAgeHours === null ? 'unknown' : runAgeHours.toFixed(2)} > max_h=${runFreshnessMaxAgeHours}`
          : `${latest.status}/${latest.conclusion} run metadata incomplete`
        : requireStrictTargetSha && !targetSha
        ? 'missing target sha for strict remote commit binding'
        : targetSha
        ? `no runs found for target sha ${targetSha}`
        : 'no runs found',
      provenance: {
        mode: 'remote',
        workflow: latest?.name || matchedWorkflow?.name || wf,
        workflow_id: matchedWorkflow?.id || null,
        workflow_path: matchedWorkflow?.path || canonicalPath,
        run_id: latest?.databaseId || null,
        head_sha: latest?.headSha || null,
        head_branch: latest?.headBranch || null,
        target_ref: targetRef,
        target_branch: targetBranch,
        target_sha: targetSha,
        sha_match: Boolean(shaMatched),
        run_query_scope: targetBranch ? `workflow+branch(${targetBranch})` : 'workflow_only',
        created_at: latest?.createdAt || null,
        run_age_hours: runAgeHours,
        freshness_ok: Boolean(runFresh),
        run_max_age_hours: runFreshnessMaxAgeHours,
        release_supply_chain_event:
          wf === 'release-supply-chain' && releaseSupplyChainEvidence
            ? releaseSupplyChainEvidence.event
            : null,
        release_supply_chain_readiness_job_present:
          wf === 'release-supply-chain' && releaseSupplyChainEvidence
            ? releaseSupplyChainEvidence.readiness_job_present
            : null,
        release_supply_chain_readiness_job_conclusion:
          wf === 'release-supply-chain' && releaseSupplyChainEvidence
            ? releaseSupplyChainEvidence.readiness_job_conclusion
            : null,
        desktop_release_event:
          wf === 'desktop-tauri-release' && desktopReleaseEvidence
            ? desktopReleaseEvidence.event
            : null,
        desktop_release_platform_matrix_ok:
          wf === 'desktop-tauri-release' && desktopReleaseEvidence
            ? desktopReleaseEvidence.platform_matrix_ok
            : null,
        desktop_release_job_conclusions:
          wf === 'desktop-tauri-release' && desktopReleaseEvidence
            ? desktopReleaseEvidence.job_conclusions
            : null,
      },
    });
    if (wf === 'release-supply-chain') {
      checks.push({
        id: 'release_supply_chain_readiness_profile_verified',
        pass: releaseSupplyChainReadinessPass,
        detail: releaseSupplyChainEvidence
          ? releaseSupplyChainEvidence.detail
          : 'missing release-supply-chain job evidence',
      });
    }
    if (wf === 'desktop-tauri-release') {
      checks.push({
        id: 'desktop_release_platform_matrix_verified',
        pass: desktopReleaseMatrixPass,
        detail: desktopReleaseEvidence
          ? desktopReleaseEvidence.detail
          : 'missing desktop-tauri-release job evidence',
      });
    }
  }

  const securityRuntimeLatest = readJsonIfExists('docs/release/status/security-runtime-e2e-latest.json');
  const securityRuntimeStatus =
    securityRuntimeLatest && typeof securityRuntimeLatest === 'object'
      ? String(securityRuntimeLatest.status || '').toLowerCase()
      : '';
  const securityRuntimeLiveChecksExecuted = Boolean(
    securityRuntimeLatest
    && typeof securityRuntimeLatest === 'object'
    && securityRuntimeLatest.live_checks_executed === true,
  );
  const securityRuntimeSkippedRequired = Number(
    securityRuntimeLatest && typeof securityRuntimeLatest === 'object'
      ? securityRuntimeLatest.required_categories_skipped
      : Number.NaN,
  );
  checks.push({
    id: 'security_runtime_e2e_status_check',
    pass:
      (localOnly && !strict)
      || (
        securityRuntimeStatus === 'pass'
        && securityRuntimeLiveChecksExecuted
        && Number.isFinite(securityRuntimeSkippedRequired)
        && securityRuntimeSkippedRequired === 0
      ),
    detail: localOnly
      ? strict
        ? 'failed: local-only mode is disallowed in strict mode'
        : 'skipped (local-only mode)'
      : securityRuntimeLatest && typeof securityRuntimeLatest === 'object'
        ? `status=${securityRuntimeStatus || '(missing)'} live_checks_executed=${String(securityRuntimeLiveChecksExecuted)} required_categories_skipped=${Number.isFinite(securityRuntimeSkippedRequired) ? String(securityRuntimeSkippedRequired) : '(missing)'}`
        : 'missing docs/release/status/security-runtime-e2e-latest.json',
  });

  const parityArgs = ['scripts/release-parity-checklist-verify.cjs'];
  if (!localOnly) {
    parityArgs.push('--strict');
  } else {
    parityArgs.push('--local-only');
  }
  const parityRun = runCmd(process.execPath, parityArgs);
  const parityLatest = readJsonIfExists('docs/release/status/parity-checklist-verify-latest.json');
  const paritySchemaError = validateParityChecklistVerifyReport(parityLatest);
  const parityStatus =
    parityLatest && typeof parityLatest === 'object' ? String(parityLatest.status || '').toLowerCase() : 'missing';
  checks.push({
    id: 'parity_checklist_verify',
    pass:
      (localOnly && !strict)
      || (
        parityRun.code === 0 &&
        !paritySchemaError &&
        parityStatus === 'pass'
      ),
    detail:
      localOnly
        ? strict
          ? 'failed: local-only mode is disallowed in strict mode'
          : `skipped (local-only mode; status=${parityStatus || '(missing)'})`
        : parityRun.code === 0
          ? paritySchemaError
            ? `failed: invalid parity-checklist-verify report (${paritySchemaError})`
            : `ok (status=${parityStatus})`
          : `failed: ${parityRun.err || parityRun.out || `exit ${parityRun.code}`}`,
  });
  const parityAllWavesCloseoutArgs = ['scripts/parity-all-waves-closeout-status.cjs'];
  if (!localOnly) {
    parityAllWavesCloseoutArgs.push('--strict');
  }
  const parityAllWavesCloseoutRun = runCmd(process.execPath, parityAllWavesCloseoutArgs);
  const parityAllWavesCloseoutLatest = readJsonIfExists('docs/release/status/parity-all-waves-closeout-latest.json');
  const parityAllWavesCloseoutStatus =
    parityAllWavesCloseoutLatest && typeof parityAllWavesCloseoutLatest === 'object'
      ? String(parityAllWavesCloseoutLatest.status || '').toLowerCase()
      : 'missing';
  checks.push({
    id: 'parity_all_waves_closeout',
    pass:
      parityAllWavesCloseoutRun.code === 0 &&
      parityAllWavesCloseoutStatus === 'pass',
    detail:
      parityAllWavesCloseoutRun.code === 0
        ? `ok (status=${parityAllWavesCloseoutStatus})`
        : `failed: ${parityAllWavesCloseoutRun.err || parityAllWavesCloseoutRun.out || `exit ${parityAllWavesCloseoutRun.code}`}`,
  });

  const skipLocalLiveAndHeavyChecks = localOnly && !strict;

  const finalDodExecutionArgs = ['scripts/final-dod-execution-check.cjs'];
  if (!localOnly) {
    finalDodExecutionArgs.push('--strict');
  } else {
    finalDodExecutionArgs.push('--local-only');
  }
  const finalDodExecutionRun = skipLocalLiveAndHeavyChecks
    ? { code: 0, out: '', err: '' }
    : runCmd(process.execPath, finalDodExecutionArgs);
  const finalDodExecutionLatest = readJsonIfExists('docs/release/status/final-dod-execution-latest.json');
  const finalDodExecutionStatus =
    finalDodExecutionLatest && typeof finalDodExecutionLatest === 'object'
      ? String(finalDodExecutionLatest.status || '').toLowerCase()
      : '';
  const finalDodLiveChecksExecuted = Boolean(
    finalDodExecutionLatest
    && typeof finalDodExecutionLatest === 'object'
    && finalDodExecutionLatest.live_checks_executed === true,
  );
  checks.push({
    id: 'final_dod_execution_check',
    pass:
      (localOnly && !strict)
      || (
        finalDodExecutionRun.code === 0 &&
        (finalDodExecutionStatus ? finalDodExecutionStatus === 'pass' : true)
      ),
    detail:
      localOnly
        ? strict
          ? 'failed: local-only mode is disallowed in strict mode'
          : 'skipped (local-only mode)'
        : finalDodExecutionRun.code === 0
          ? `ok${finalDodExecutionStatus ? ` (status=${finalDodExecutionStatus})` : ''}`
          : `failed: ${finalDodExecutionRun.err || finalDodExecutionRun.out || `exit ${finalDodExecutionRun.code}`}`,
  });
  checks.push({
    id: 'final_dod_execution_live_checks_executed',
    pass: (localOnly && !strict) || finalDodLiveChecksExecuted === true,
    detail: localOnly
      ? strict
        ? 'failed: local-only mode is disallowed in strict mode'
        : 'skipped (local-only mode)'
      : finalDodLiveChecksExecuted
        ? 'true'
        : 'false (final-dod-execution-latest.json must set live_checks_executed=true in required CI gates)',
  });

  const mcpCompatArgs = ['scripts/mcp-server-compat-check.cjs'];
  if (!localOnly) {
    mcpCompatArgs.push('--strict');
    mcpCompatArgs.push('--with-live');
  }
  const mcpCompatRun = skipLocalLiveAndHeavyChecks
    ? { code: 0, out: '', err: '' }
    : runCmd(process.execPath, mcpCompatArgs);
  const mcpCompatLatest = readJsonIfExists('docs/release/status/mcp-server-compat-latest.json');
  const mcpCompatSchemaError = validateMCPCompatReport(mcpCompatLatest);
  const mcpCompatStatus =
    mcpCompatLatest && typeof mcpCompatLatest === 'object' ? String(mcpCompatLatest.status || '').toLowerCase() : '';
  checks.push({
    id: 'mcp_server_compat_check',
    pass:
      skipLocalLiveAndHeavyChecks
      || (
        mcpCompatRun.code === 0 &&
        !mcpCompatSchemaError &&
        mcpCompatStatus === 'pass'
      ),
    detail:
      skipLocalLiveAndHeavyChecks
        ? 'skipped (local-only mode; live MCP compatibility checks are CI-authoritative)'
        : mcpCompatRun.code === 0
        ? mcpCompatSchemaError
          ? `failed: invalid mcp-server-compat report (${mcpCompatSchemaError})`
          : `ok (status=${mcpCompatStatus})`
        : `failed: ${mcpCompatRun.err || mcpCompatRun.out || `exit ${mcpCompatRun.code}`}`,
  });

  const a2aCompatArgs = ['scripts/a2a-compat-check.cjs'];
  if (!localOnly) {
    a2aCompatArgs.push('--strict');
    a2aCompatArgs.push('--with-live');
    a2aCompatArgs.push('--with-live-peer-evidence');
  }
  const a2aCompatRun = skipLocalLiveAndHeavyChecks
    ? { code: 0, out: '', err: '' }
    : runCmd(process.execPath, a2aCompatArgs);
  const a2aCompatLatest = readJsonIfExists('docs/release/status/a2a-compat-latest.json');
  const a2aCompatSchemaError = validateA2ACompatReport(a2aCompatLatest);
  const a2aCompatStatus =
    a2aCompatLatest && typeof a2aCompatLatest === 'object' ? String(a2aCompatLatest.status || '').toLowerCase() : 'missing';
  checks.push({
    id: 'a2a_compat_check',
    pass:
      skipLocalLiveAndHeavyChecks
      || (
        a2aCompatRun.code === 0 &&
        !a2aCompatSchemaError &&
        a2aCompatStatus === 'pass'
      ),
    detail:
      skipLocalLiveAndHeavyChecks
        ? 'skipped (local-only mode; live A2A compatibility checks are CI-authoritative)'
        : a2aCompatRun.code === 0
        ? a2aCompatSchemaError
          ? `failed: invalid a2a-compat report (${a2aCompatSchemaError})`
          : `ok (status=${a2aCompatStatus})`
        : `failed: ${a2aCompatRun.err || a2aCompatRun.out || `exit ${a2aCompatRun.code}`}`,
  });

  const mcpLiveChecksExecuted =
    Boolean(mcpCompatLatest) && typeof mcpCompatLatest.live_checks_executed === 'boolean'
      ? mcpCompatLatest.live_checks_executed
      : false;
  checks.push({
    id: 'mcp_compat_live_checks_executed',
    pass: mcpLiveChecksExecuted === true,
    detail: mcpLiveChecksExecuted
      ? 'true'
      : 'false (mcp-server-compat-latest.json must set live_checks_executed=true in required CI gates)',
  });

  const a2aLiveChecksExecuted =
    Boolean(a2aCompatLatest) && typeof a2aCompatLatest.live_checks_executed === 'boolean'
      ? a2aCompatLatest.live_checks_executed
      : false;
  checks.push({
    id: 'a2a_compat_live_checks_executed',
    pass: a2aLiveChecksExecuted === true,
    detail: a2aLiveChecksExecuted
      ? 'true'
      : 'false (a2a-compat-latest.json must set live_checks_executed=true in required CI gates)',
  });

  const resumableStreamArgs = ['scripts/resumable-stream-check.cjs'];
  if (!localOnly) {
    resumableStreamArgs.push('--strict');
  }
  const resumableStreamRun = runCmd(process.execPath, resumableStreamArgs);
  const resumableStreamLatest = readJsonIfExists('docs/release/status/resumable-stream-latest.json');
  const resumableStreamStatus =
    resumableStreamLatest && typeof resumableStreamLatest === 'object'
      ? String(resumableStreamLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'resumable_stream_check',
    pass:
      resumableStreamRun.code === 0 &&
      (resumableStreamStatus ? resumableStreamStatus === 'pass' : true),
    detail:
      resumableStreamRun.code === 0
        ? `ok${resumableStreamStatus ? ` (status=${resumableStreamStatus})` : ''}`
        : `failed: ${resumableStreamRun.err || resumableStreamRun.out || `exit ${resumableStreamRun.code}`}`,
  });

  const webEgressSecurityArgs = ['scripts/web-egress-security-check.cjs'];
  if (!localOnly) {
    webEgressSecurityArgs.push('--strict');
  }
  const webEgressSecurityRun = runCmd(process.execPath, webEgressSecurityArgs);
  const webEgressSecurityLatest = readJsonIfExists('docs/release/status/web-egress-security-latest.json');
  const webEgressSecurityStatus =
    webEgressSecurityLatest && typeof webEgressSecurityLatest === 'object'
      ? String(webEgressSecurityLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'web_egress_security_check',
    pass:
      webEgressSecurityRun.code === 0 &&
      (webEgressSecurityStatus ? webEgressSecurityStatus === 'pass' : true),
    detail:
      webEgressSecurityRun.code === 0
        ? `ok${webEgressSecurityStatus ? ` (status=${webEgressSecurityStatus})` : ''}`
        : `failed: ${webEgressSecurityRun.err || webEgressSecurityRun.out || `exit ${webEgressSecurityRun.code}`}`,
  });

  const quarantineIsolationArgs = ['scripts/quarantine-isolation-check.cjs'];
  if (!localOnly) {
    quarantineIsolationArgs.push('--strict');
  }
  const quarantineIsolationRun = runCmd(process.execPath, quarantineIsolationArgs);
  const quarantineIsolationLatest = readJsonIfExists('docs/release/status/quarantine-isolation-latest.json');
  const quarantineIsolationStatus =
    quarantineIsolationLatest && typeof quarantineIsolationLatest === 'object'
      ? String(quarantineIsolationLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'quarantine_isolation_check',
    pass:
      quarantineIsolationRun.code === 0 &&
      (quarantineIsolationStatus ? quarantineIsolationStatus === 'pass' : true),
    detail:
      quarantineIsolationRun.code === 0
        ? `ok${quarantineIsolationStatus ? ` (status=${quarantineIsolationStatus})` : ''}`
        : `failed: ${quarantineIsolationRun.err || quarantineIsolationRun.out || `exit ${quarantineIsolationRun.code}`}`,
  });

  const seedBaselineArgs = ['scripts/seed-baseline-check.cjs'];
  if (!localOnly) {
    seedBaselineArgs.push('--strict');
  }
  const seedBaselineRun = runCmd(process.execPath, seedBaselineArgs);
  const seedBaselineLatest = readJsonIfExists('docs/release/status/seed-baseline-latest.json');
  const seedBaselineStatus =
    seedBaselineLatest && typeof seedBaselineLatest === 'object'
      ? String(seedBaselineLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'seed_baseline_check',
    pass:
      seedBaselineRun.code === 0 &&
      (seedBaselineStatus ? seedBaselineStatus === 'pass' : true),
    detail:
      seedBaselineRun.code === 0
        ? `ok${seedBaselineStatus ? ` (status=${seedBaselineStatus})` : ''}`
        : `failed: ${seedBaselineRun.err || seedBaselineRun.out || `exit ${seedBaselineRun.code}`}`,
  });

  const soakHardwareEvidenceArgs = ['scripts/soak-hardware-evidence-check.cjs'];
  if (!localOnly) {
    soakHardwareEvidenceArgs.push('--strict');
  }
  const soakHardwareEvidenceRun = runCmd(process.execPath, soakHardwareEvidenceArgs);
  const soakHardwareEvidenceLatest = readJsonIfExists('docs/release/status/soak-hardware-evidence-latest.json');
  const soakHardwareEvidenceStatus =
    soakHardwareEvidenceLatest && typeof soakHardwareEvidenceLatest === 'object'
      ? String(soakHardwareEvidenceLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'soak_hardware_evidence_check',
    pass:
      soakHardwareEvidenceRun.code === 0 &&
      (soakHardwareEvidenceStatus ? soakHardwareEvidenceStatus === 'pass' : true),
    detail:
      soakHardwareEvidenceRun.code === 0
        ? `ok${soakHardwareEvidenceStatus ? ` (status=${soakHardwareEvidenceStatus})` : ''}`
        : `failed: ${soakHardwareEvidenceRun.err || soakHardwareEvidenceRun.out || `exit ${soakHardwareEvidenceRun.code}`}`,
  });

  const benchmarkSuiteArgs = ['scripts/benchmark-suite-check.cjs'];
  if (!localOnly) {
    benchmarkSuiteArgs.push('--strict');
  }
  const benchmarkSuiteRun = skipLocalLiveAndHeavyChecks
    ? { code: 0, out: '', err: '' }
    : runCmd(process.execPath, benchmarkSuiteArgs);
  const benchmarkSuiteLatest = readJsonIfExists('docs/release/status/benchmark-suite-latest.json');
  const benchmarkSuiteStatus =
    benchmarkSuiteLatest && typeof benchmarkSuiteLatest === 'object'
      ? String(benchmarkSuiteLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'benchmark_suite_check',
    pass:
      skipLocalLiveAndHeavyChecks
      || (
        benchmarkSuiteRun.code === 0 &&
        (benchmarkSuiteStatus ? benchmarkSuiteStatus === 'pass' : true)
      ),
    detail:
      skipLocalLiveAndHeavyChecks
        ? 'skipped (local-only mode; benchmark suite is CI-authoritative)'
        : benchmarkSuiteRun.code === 0
        ? `ok${benchmarkSuiteStatus ? ` (status=${benchmarkSuiteStatus})` : ''}`
        : `failed: ${benchmarkSuiteRun.err || benchmarkSuiteRun.out || `exit ${benchmarkSuiteRun.code}`}`,
  });

  const competitorRuntimeGuardArgs = ['scripts/competitor-runtime-guard-check.cjs'];
  if (!localOnly) {
    competitorRuntimeGuardArgs.push('--strict');
  }
  const competitorRuntimeGuardRun = skipLocalLiveAndHeavyChecks
    ? { code: 0, out: '', err: '' }
    : runCmd(process.execPath, competitorRuntimeGuardArgs);
  const competitorRuntimeGuardLatest = readJsonIfExists('docs/release/status/competitor-runtime-guard-latest.json');
  const competitorRuntimeGuardStatus =
    competitorRuntimeGuardLatest && typeof competitorRuntimeGuardLatest === 'object'
      ? String(competitorRuntimeGuardLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'competitor_runtime_guard_check',
    pass:
      skipLocalLiveAndHeavyChecks
      || (
        competitorRuntimeGuardRun.code === 0 &&
        (competitorRuntimeGuardStatus ? competitorRuntimeGuardStatus === 'pass' : true)
      ),
    detail:
      skipLocalLiveAndHeavyChecks
        ? 'skipped (local-only mode; competitor runtime guard is CI-authoritative)'
        : competitorRuntimeGuardRun.code === 0
        ? `ok${competitorRuntimeGuardStatus ? ` (status=${competitorRuntimeGuardStatus})` : ''}`
        : `failed: ${competitorRuntimeGuardRun.err || competitorRuntimeGuardRun.out || `exit ${competitorRuntimeGuardRun.code}`}`,
  });

  const websocketContractArgs = ['scripts/websocket-contract-check.cjs'];
  if (!localOnly) {
    websocketContractArgs.push('--strict');
  }
  const websocketContractRun = runCmd(process.execPath, websocketContractArgs);
  const websocketContractLatest = readJsonIfExists('docs/release/status/websocket-contract-latest.json');
  const websocketContractStatus =
    websocketContractLatest && typeof websocketContractLatest === 'object'
      ? String(websocketContractLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'websocket_contract_check',
    pass:
      websocketContractRun.code === 0 &&
      (websocketContractStatus ? websocketContractStatus === 'pass' : true),
    detail:
      websocketContractRun.code === 0
        ? `ok${websocketContractStatus ? ` (status=${websocketContractStatus})` : ''}`
        : `failed: ${websocketContractRun.err || websocketContractRun.out || `exit ${websocketContractRun.code}`}`,
  });

  const externalInputResolutionArgs = ['scripts/external-input-resolution-check.cjs'];
  if (!localOnly) {
    externalInputResolutionArgs.push('--strict');
  }
  const externalInputResolutionRun = runCmd(process.execPath, externalInputResolutionArgs);
  const externalInputResolutionLatest = readJsonIfExists('docs/release/status/external-input-resolution-latest.json');
  const externalInputResolutionStatus =
    externalInputResolutionLatest && typeof externalInputResolutionLatest === 'object'
      ? String(externalInputResolutionLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'external_input_resolution_check',
    pass:
      externalInputResolutionRun.code === 0 &&
      (externalInputResolutionStatus ? externalInputResolutionStatus === 'pass' : true),
    detail:
      externalInputResolutionRun.code === 0
        ? `ok${externalInputResolutionStatus ? ` (status=${externalInputResolutionStatus})` : ''}`
        : `failed: ${externalInputResolutionRun.err || externalInputResolutionRun.out || `exit ${externalInputResolutionRun.code}`}`,
  });

  const rcPackageArgs = ['scripts/release-candidate-package-check.cjs'];
  if (!localOnly) {
    rcPackageArgs.push('--strict');
  }
  const rcPackageRun = runCmd(process.execPath, rcPackageArgs);
  const rcPackageLatest = readJsonIfExists('docs/release/status/release-candidate-package-latest.json');
  const rcPackageStatus =
    rcPackageLatest && typeof rcPackageLatest === 'object'
      ? String(rcPackageLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'release_candidate_package_check',
    pass:
      rcPackageRun.code === 0 &&
      (rcPackageStatus ? rcPackageStatus === 'pass' : true),
    detail:
      rcPackageRun.code === 0
        ? `ok${rcPackageStatus ? ` (status=${rcPackageStatus})` : ''}`
        : `failed: ${rcPackageRun.err || rcPackageRun.out || `exit ${rcPackageRun.code}`}`,
  });

  const operabilityAuthSuiteArgs = ['scripts/operability-auth-suite-check.cjs'];
  if (!localOnly) {
    operabilityAuthSuiteArgs.push('--strict');
  }
  const operabilityAuthSuiteRun = runCmd(process.execPath, operabilityAuthSuiteArgs);
  const operabilityAuthSuiteLatest = readJsonIfExists('docs/release/status/operability-auth-suite-latest.json');
  const operabilityAuthSuiteStatus =
    operabilityAuthSuiteLatest && typeof operabilityAuthSuiteLatest === 'object'
      ? String(operabilityAuthSuiteLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'operability_auth_suite_check',
    pass:
      operabilityAuthSuiteRun.code === 0 &&
      (operabilityAuthSuiteStatus ? operabilityAuthSuiteStatus === 'pass' : true),
    detail:
      operabilityAuthSuiteRun.code === 0
        ? `ok${operabilityAuthSuiteStatus ? ` (status=${operabilityAuthSuiteStatus})` : ''}`
        : `failed: ${operabilityAuthSuiteRun.err || operabilityAuthSuiteRun.out || `exit ${operabilityAuthSuiteRun.code}`}`,
  });

  const performanceE2eStatusArgs = ['scripts/performance-e2e-status-check.cjs'];
  if (!localOnly) {
    performanceE2eStatusArgs.push('--strict');
  } else {
    performanceE2eStatusArgs.push('--local-only');
  }
  const performanceE2eStatusRun = skipLocalLiveAndHeavyChecks
    ? { code: 0, out: '', err: '' }
    : runCmd(process.execPath, performanceE2eStatusArgs);
  const performanceE2eStatusLatest = readJsonIfExists('docs/release/status/performance-e2e-latest.json');
  const performanceE2eStatus =
    performanceE2eStatusLatest && typeof performanceE2eStatusLatest === 'object'
      ? String(performanceE2eStatusLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'performance_e2e_status_check',
    pass:
      skipLocalLiveAndHeavyChecks
      || (
        performanceE2eStatusRun.code === 0 &&
        (performanceE2eStatus ? performanceE2eStatus === 'pass' : true)
      ),
    detail:
      skipLocalLiveAndHeavyChecks
        ? 'skipped (local-only mode; performance e2e status is CI-authoritative)'
        : performanceE2eStatusRun.code === 0
        ? `ok${performanceE2eStatus ? ` (status=${performanceE2eStatus})` : ''}`
        : `failed: ${performanceE2eStatusRun.err || performanceE2eStatusRun.out || `exit ${performanceE2eStatusRun.code}`}`,
  });

  const adminRbacPenetrationArgs = ['scripts/admin-rbac-penetration-check.cjs'];
  if (!localOnly) {
    adminRbacPenetrationArgs.push('--strict');
  }
  const adminRbacPenetrationRun = runCmd(process.execPath, adminRbacPenetrationArgs);
  const adminRbacPenetrationLatest = readJsonIfExists('docs/release/status/admin-rbac-penetration-latest.json');
  const adminRbacPenetrationStatus =
    adminRbacPenetrationLatest && typeof adminRbacPenetrationLatest === 'object'
      ? String(adminRbacPenetrationLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'admin_rbac_penetration_check',
    pass:
      adminRbacPenetrationRun.code === 0 &&
      (adminRbacPenetrationStatus ? adminRbacPenetrationStatus === 'pass' : true),
    detail:
      adminRbacPenetrationRun.code === 0
        ? `ok${adminRbacPenetrationStatus ? ` (status=${adminRbacPenetrationStatus})` : ''}`
        : `failed: ${adminRbacPenetrationRun.err || adminRbacPenetrationRun.out || `exit ${adminRbacPenetrationRun.code}`}`,
  });

  const runbookScenarioMatrixArgs = ['scripts/runbook-scenario-matrix-check.cjs'];
  if (!localOnly) {
    runbookScenarioMatrixArgs.push('--strict');
  }
  const runbookScenarioMatrixRun = runCmd(process.execPath, runbookScenarioMatrixArgs);
  const runbookScenarioMatrixLatest = readJsonIfExists('docs/release/status/runbook-scenario-matrix-latest.json');
  const runbookScenarioMatrixStatus =
    runbookScenarioMatrixLatest && typeof runbookScenarioMatrixLatest === 'object'
      ? String(runbookScenarioMatrixLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'runbook_scenario_matrix_check',
    pass:
      runbookScenarioMatrixRun.code === 0 &&
      (runbookScenarioMatrixStatus ? runbookScenarioMatrixStatus === 'pass' : true),
    detail:
      runbookScenarioMatrixRun.code === 0
        ? `ok${runbookScenarioMatrixStatus ? ` (status=${runbookScenarioMatrixStatus})` : ''}`
        : `failed: ${runbookScenarioMatrixRun.err || runbookScenarioMatrixRun.out || `exit ${runbookScenarioMatrixRun.code}`}`,
  });

  const traceabilityMatrixArgs = ['scripts/traceability-matrix-check.cjs'];
  if (!localOnly) {
    traceabilityMatrixArgs.push('--strict');
  }
  const traceabilityMatrixRun = runCmd(process.execPath, traceabilityMatrixArgs);
  const traceabilityMatrixLatest = readJsonIfExists('docs/release/status/traceability-matrix-latest.json');
  const traceabilityMatrixStatus =
    traceabilityMatrixLatest && typeof traceabilityMatrixLatest === 'object'
      ? String(traceabilityMatrixLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'traceability_matrix_check',
    pass:
      traceabilityMatrixRun.code === 0 &&
      (traceabilityMatrixStatus ? traceabilityMatrixStatus === 'pass' : true),
    detail:
      traceabilityMatrixRun.code === 0
        ? `ok${traceabilityMatrixStatus ? ` (status=${traceabilityMatrixStatus})` : ''}`
        : `failed: ${traceabilityMatrixRun.err || traceabilityMatrixRun.out || `exit ${traceabilityMatrixRun.code}`}`,
  });

  const thirdChecklistIntegrationArgs = ['scripts/third-checklist-integration-check.cjs'];
  if (!localOnly) {
    thirdChecklistIntegrationArgs.push('--strict');
  }
  const thirdChecklistIntegrationRun = runCmd(process.execPath, thirdChecklistIntegrationArgs);
  const thirdChecklistIntegrationLatest = readJsonIfExists('docs/release/status/third-checklist-integration-latest.json');
  const thirdChecklistIntegrationStatus =
    thirdChecklistIntegrationLatest && typeof thirdChecklistIntegrationLatest === 'object'
      ? String(thirdChecklistIntegrationLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'third_checklist_integration_check',
    pass:
      thirdChecklistIntegrationRun.code === 0 &&
      (thirdChecklistIntegrationStatus ? thirdChecklistIntegrationStatus === 'pass' : true),
    detail:
      thirdChecklistIntegrationRun.code === 0
        ? `ok${thirdChecklistIntegrationStatus ? ` (status=${thirdChecklistIntegrationStatus})` : ''}`
        : `failed: ${thirdChecklistIntegrationRun.err || thirdChecklistIntegrationRun.out || `exit ${thirdChecklistIntegrationRun.code}`}`,
  });

  const stagingMigrationVerificationArgs = ['scripts/staging-migration-verification-check.cjs'];
  if (!localOnly) {
    stagingMigrationVerificationArgs.push('--strict');
  }
  const stagingMigrationVerificationRun = runCmd(process.execPath, stagingMigrationVerificationArgs);
  const stagingMigrationVerificationLatest = readJsonIfExists('docs/release/status/staging-migration-verification-latest.json');
  const stagingMigrationVerificationStatus =
    stagingMigrationVerificationLatest && typeof stagingMigrationVerificationLatest === 'object'
      ? String(stagingMigrationVerificationLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'staging_migration_verification_check',
    pass:
      stagingMigrationVerificationRun.code === 0 &&
      (stagingMigrationVerificationStatus ? stagingMigrationVerificationStatus === 'pass' : true),
    detail:
      stagingMigrationVerificationRun.code === 0
        ? `ok${stagingMigrationVerificationStatus ? ` (status=${stagingMigrationVerificationStatus})` : ''}`
        : `failed: ${stagingMigrationVerificationRun.err || stagingMigrationVerificationRun.out || `exit ${stagingMigrationVerificationRun.code}`}`,
  });

  const runbookScopeUpdateArgs = ['scripts/runbook-scope-update-check.cjs'];
  if (!localOnly) {
    runbookScopeUpdateArgs.push('--strict');
  }
  const runbookScopeUpdateRun = runCmd(process.execPath, runbookScopeUpdateArgs);
  const runbookScopeUpdateLatest = readJsonIfExists('docs/release/status/runbook-scope-update-latest.json');
  const runbookScopeUpdateStatus =
    runbookScopeUpdateLatest && typeof runbookScopeUpdateLatest === 'object'
      ? String(runbookScopeUpdateLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'runbook_scope_update_check',
    pass:
      runbookScopeUpdateRun.code === 0 &&
      (runbookScopeUpdateStatus ? runbookScopeUpdateStatus === 'pass' : true),
    detail:
      runbookScopeUpdateRun.code === 0
        ? `ok${runbookScopeUpdateStatus ? ` (status=${runbookScopeUpdateStatus})` : ''}`
        : `failed: ${runbookScopeUpdateRun.err || runbookScopeUpdateRun.out || `exit ${runbookScopeUpdateRun.code}`}`,
  });

  const featureFlagGovernanceArgs = ['scripts/feature-flag-governance-check.cjs'];
  if (!localOnly) {
    featureFlagGovernanceArgs.push('--strict');
  }
  const featureFlagGovernanceRun = runCmd(process.execPath, featureFlagGovernanceArgs);
  const featureFlagGovernanceLatest = readJsonIfExists('docs/release/status/feature-flag-governance-latest.json');
  const featureFlagGovernanceStatus =
    featureFlagGovernanceLatest && typeof featureFlagGovernanceLatest === 'object'
      ? String(featureFlagGovernanceLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'feature_flag_governance_check',
    pass:
      featureFlagGovernanceRun.code === 0 &&
      (featureFlagGovernanceStatus ? featureFlagGovernanceStatus === 'pass' : true),
    detail:
      featureFlagGovernanceRun.code === 0
        ? `ok${featureFlagGovernanceStatus ? ` (status=${featureFlagGovernanceStatus})` : ''}`
        : `failed: ${featureFlagGovernanceRun.err || featureFlagGovernanceRun.out || `exit ${featureFlagGovernanceRun.code}`}`,
  });

  const releaseEvidenceBundleArgs = ['scripts/release-evidence-bundle-check.cjs'];
  if (!localOnly) {
    releaseEvidenceBundleArgs.push('--strict');
  }
  const releaseEvidenceBundleRun = runCmd(process.execPath, releaseEvidenceBundleArgs);
  const releaseEvidenceBundleLatest = readJsonIfExists('docs/release/status/release-evidence-bundle-latest.json');
  const releaseEvidenceBundleStatus =
    releaseEvidenceBundleLatest && typeof releaseEvidenceBundleLatest === 'object'
      ? String(releaseEvidenceBundleLatest.status || '').toLowerCase()
      : '';
  checks.push({
    id: 'release_evidence_bundle_check',
    pass:
      releaseEvidenceBundleRun.code === 0 &&
      (releaseEvidenceBundleStatus ? releaseEvidenceBundleStatus === 'pass' : true),
    detail:
      releaseEvidenceBundleRun.code === 0
        ? `ok${releaseEvidenceBundleStatus ? ` (status=${releaseEvidenceBundleStatus})` : ''}`
        : `failed: ${releaseEvidenceBundleRun.err || releaseEvidenceBundleRun.out || `exit ${releaseEvidenceBundleRun.code}`}`,
  });

  // In local-only diagnostic mode, keep live-environment checks visible but non-blocking.
  // Strict/CI runs remain authoritative and unchanged.
  if (localOnly && !strict) {
    const localOnlyLiveGateIds = new Set([
      'remote_run_validation_verified',
      'mcp_server_compat_check',
      'a2a_compat_check',
      'mcp_compat_live_checks_executed',
      'a2a_compat_live_checks_executed',
      'resumable_stream_check',
      'web_egress_security_check',
      'quarantine_isolation_check',
      'seed_baseline_check',
      'soak_hardware_evidence_check',
      'external_input_resolution_check',
      'release_candidate_package_check',
      'operability_auth_suite_check',
      'performance_e2e_status_check',
      'admin_rbac_penetration_check',
      'runbook_scenario_matrix_check',
      'third_checklist_integration_check',
      'staging_migration_verification_check',
      'feature_flag_governance_check',
      'release_evidence_bundle_check',
    ]);
    for (const check of checks) {
      if (!localOnlyLiveGateIds.has(check.id)) continue;
      const priorDetail = String(check.detail || '').trim();
      check.pass = true;
      check.detail = priorDetail
        ? `skipped (local-only mode; requires live environment validation): ${priorDetail}`
        : 'skipped (local-only mode; requires live environment validation)';
      check.local_only_override = true;
    }
  }

  const workflowAndPolicyChecksPass = checks
    .filter((check) => check.id !== 'mobile_release_readiness_status_check')
    .every((check) => check.pass);
  const domainArtifactsPass =
    mobileReleaseReadinessStatus === 'pass'
    && multiDeviceValidationStatus === 'pass';
  const compositeReleaseGateStatus = localOnly
    ? 'provisional'
    : workflowAndPolicyChecksPass && domainArtifactsPass
      ? 'pass'
      : 'fail';
  const status = compositeReleaseGateStatus;
  const report = {
    generated_at: new Date().toISOString(),
    status,
    execution: {
      strict,
      local_only: localOnly,
      validation_mode: localOnly ? 'local-only' : 'ci-remote',
      authority: localOnly ? 'local_diagnostic' : 'release_authoritative',
      target_ref: targetRef,
      target_branch: targetBranch,
      target_sha: targetSha,
      ops_shell_ci_required: opsShellRequirement.required,
      ops_shell_ci_scope_source: opsShellRequirement.source,
      required_workflow_count: effectiveRequiredWorkflows.length,
    },
    composite_release_gate: {
      status: compositeReleaseGateStatus,
      workflow_and_policy_status: workflowAndPolicyChecksPass ? 'pass' : 'fail',
      domain_artifacts_status: domainArtifactsPass ? 'pass' : 'fail',
      required_domain_artifacts: {
        mobile_release_readiness: mobileReleaseReadinessStatus || 'missing',
        multi_device_validation: multiDeviceValidationStatus || 'missing',
      },
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outputBasenames = resolveOutputBasenames({ localOnlyMode: localOnly, strictMode: strict });
  const outJson = path.join(outDir, outputBasenames.json);
  const outMd = path.join(outDir, outputBasenames.md);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# CI Required Checks Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Execution\n- strict: ${String(report.execution.strict)}\n- local_only: ${String(report.execution.local_only)}\n- validation_mode: ${report.execution.validation_mode}\n- authority: ${report.execution.authority}\n- target_ref: ${report.execution.target_ref || '(unset)'}\n- target_sha: ${report.execution.target_sha || '(unset)'}\n\n## Composite Release Gate\n- status: ${report.composite_release_gate.status}\n- workflow_and_policy_status: ${report.composite_release_gate.workflow_and_policy_status}\n- domain_artifacts_status: ${report.composite_release_gate.domain_artifacts_status}\n- mobile_release_readiness: ${report.composite_release_gate.required_domain_artifacts.mobile_release_readiness}\n- multi_device_validation: ${report.composite_release_gate.required_domain_artifacts.multi_device_validation}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
