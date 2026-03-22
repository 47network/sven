#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const latestJsonPath = path.join(root, 'docs', 'release', 'status', 'd9-keycloak-interop-live-latest.json');
const browserFlowJsonPath = path.join(root, 'docs', 'release', 'status', 'd9-keycloak-browser-flow-latest.json');
const smokeChecksJsonPath = path.join(root, 'docs', 'release', 'status', 'd9-keycloak-interop-smoke-checks-latest.json');

function parseArgs(argv) {
  const maxAgeDays = Math.max(1, Number(process.env.SSO_KEYCLOAK_EVIDENCE_MAX_AGE_DAYS || 3));
  const overrideJustification = String(
    process.env.SSO_KEYCLOAK_EVIDENCE_MAX_AGE_JUSTIFICATION
    || process.env.SSO_KEYCLOAK_EVIDENCE_OVERRIDE_JUSTIFICATION
    || '',
  ).trim();
  const ciLike = String(process.env.CI || '').trim().toLowerCase() === 'true'
    || String(process.env.GITHUB_ACTIONS || '').trim().toLowerCase() === 'true';
  return {
    strict: argv.includes('--strict'),
    maxAgeDays,
    overrideJustification,
    ciLike,
    defaultMaxAgeDays: 3,
    expectedRunId: String(process.env.SVEN_RELEASE_RUN_ID || process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    expectedHeadSha: String(process.env.SVEN_RELEASE_HEAD_SHA || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
  };
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [];
  const strictLike = Boolean(args.strict || args.ciLike);

  checks.push({
    id: 'evidence_freshness_default_release_grade',
    pass: args.defaultMaxAgeDays <= 3,
    detail: `default_max_age_days=${args.defaultMaxAgeDays}`,
  });
  checks.push({
    id: 'evidence_freshness_window_release_grade_or_justified',
    pass: args.maxAgeDays <= 3 || !strictLike || args.overrideJustification.length >= 12,
    detail:
      args.maxAgeDays <= 3
        ? `max_age_days=${args.maxAgeDays} (within release-grade window)`
        : strictLike
          ? `max_age_days=${args.maxAgeDays}; override_justification=${args.overrideJustification ? 'provided' : 'missing'}`
          : `max_age_days=${args.maxAgeDays}; non-strict context`,
  });

  if (!fs.existsSync(latestJsonPath)) {
    checks.push({
      id: 'latest_evidence_file_exists',
      pass: false,
      detail: `${path.relative(root, latestJsonPath)} not found`,
    });
  } else {
    checks.push({
      id: 'latest_evidence_file_exists',
      pass: true,
      detail: `${path.relative(root, latestJsonPath)} exists`,
    });
  }

  let report = null;
  let browserFlowReport = null;
  let smokeChecksReport = null;
  if (fs.existsSync(latestJsonPath)) {
    try {
      report = loadJson(latestJsonPath);
      checks.push({
        id: 'latest_evidence_file_valid_json',
        pass: true,
        detail: 'JSON parse succeeded',
      });
    } catch (err) {
      checks.push({
        id: 'latest_evidence_file_valid_json',
        pass: false,
        detail: `JSON parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  }

  if (report && typeof report === 'object') {
    const generatedAt = String(report.generated_at_utc || '').trim();
    const ts = generatedAt ? Date.parse(generatedAt) : NaN;
    const now = Date.now();
    const ageMs = Number.isFinite(ts) ? Math.max(0, now - ts) : Number.POSITIVE_INFINITY;
    const maxAgeMs = args.maxAgeDays * 24 * 60 * 60 * 1000;
    const ageDays = Number.isFinite(ageMs) ? ageMs / (24 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;

    checks.push({
      id: 'latest_evidence_has_timestamp',
      pass: Number.isFinite(ts),
      detail: Number.isFinite(ts) ? generatedAt : 'generated_at_utc missing/invalid',
    });

    checks.push({
      id: 'latest_evidence_fresh_enough',
      pass: Number.isFinite(ageMs) && ageMs <= maxAgeMs,
      detail: Number.isFinite(ageDays)
        ? `age_days=${ageDays.toFixed(2)} max_age_days=${args.maxAgeDays}`
        : `age unknown max_age_days=${args.maxAgeDays}`,
    });

    checks.push({
      id: 'latest_evidence_success_true',
      pass: Boolean(report.success) === true,
      detail: `success=${String(report.success)}`,
    });

    const runId = String(report.source_run_id || report.run_id || '').trim();
    const headSha = String(report.head_sha || '').trim();
    checks.push({
      id: 'latest_evidence_has_run_identity_fields',
      pass: Boolean(runId) && /^[a-f0-9]{7,40}$/i.test(headSha),
      detail: `run_id=${runId || '(missing)'}; head_sha=${headSha || '(missing)'}`,
    });

    if (args.expectedRunId || args.expectedHeadSha) {
      checks.push({
        id: 'latest_evidence_identity_matches_gate_context',
        pass:
          (!args.expectedRunId || runId === args.expectedRunId)
          && (!args.expectedHeadSha || headSha === args.expectedHeadSha),
        detail: `expected_run_id=${args.expectedRunId || '(none)'}; observed_run_id=${runId || '(missing)'}; expected_head_sha=${args.expectedHeadSha || '(none)'}; observed_head_sha=${headSha || '(missing)'}`,
      });
    }
  }

  if (!fs.existsSync(browserFlowJsonPath)) {
    checks.push({
      id: 'browser_flow_companion_artifact_exists',
      pass: false,
      detail: `${path.relative(root, browserFlowJsonPath)} not found`,
    });
  } else {
    checks.push({
      id: 'browser_flow_companion_artifact_exists',
      pass: true,
      detail: `${path.relative(root, browserFlowJsonPath)} exists`,
    });
    try {
      browserFlowReport = loadJson(browserFlowJsonPath);
      checks.push({
        id: 'browser_flow_companion_artifact_valid_json',
        pass: true,
        detail: 'JSON parse succeeded',
      });
    } catch (err) {
      checks.push({
        id: 'browser_flow_companion_artifact_valid_json',
        pass: false,
        detail: `JSON parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  }

  if (browserFlowReport && typeof browserFlowReport === 'object') {
    const browserFlowStatus = String(browserFlowReport.status || '').toLowerCase();
    checks.push({
      id: 'browser_flow_companion_status_pass',
      pass: browserFlowStatus === 'pass',
      detail: `status=${browserFlowStatus || '(missing)'}`,
    });
  }

  if (!fs.existsSync(smokeChecksJsonPath)) {
    checks.push({
      id: 'smoke_state_correlation_artifact_exists',
      pass: false,
      detail: `${path.relative(root, smokeChecksJsonPath)} not found`,
    });
  } else {
    checks.push({
      id: 'smoke_state_correlation_artifact_exists',
      pass: true,
      detail: `${path.relative(root, smokeChecksJsonPath)} exists`,
    });
    try {
      smokeChecksReport = loadJson(smokeChecksJsonPath);
      checks.push({
        id: 'smoke_state_correlation_artifact_valid_json',
        pass: true,
        detail: 'JSON parse succeeded',
      });
    } catch (err) {
      checks.push({
        id: 'smoke_state_correlation_artifact_valid_json',
        pass: false,
        detail: `JSON parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  }

  if (smokeChecksReport && typeof smokeChecksReport === 'object') {
    checks.push({
      id: 'smoke_state_correlation_pass',
      pass: Boolean(smokeChecksReport?.checks?.state_correlation_pass),
      detail: `state_correlation_pass=${String(smokeChecksReport?.checks?.state_correlation_pass)}`,
    });
    checks.push({
      id: 'smoke_redirect_target_match_pass',
      pass: Boolean(smokeChecksReport?.checks?.redirect_target_matches_callback_uri),
      detail: `redirect_target_matches_callback_uri=${String(smokeChecksReport?.checks?.redirect_target_matches_callback_uri)}`,
    });
    const credentialSources = smokeChecksReport?.credentials_source
      && typeof smokeChecksReport.credentials_source === 'object'
      ? smokeChecksReport.credentials_source
      : {};
    const nonExplicit = Object.entries(credentialSources)
      .filter(([, value]) => String(value || '').trim() !== 'explicit_env')
      .map(([key]) => key);
    checks.push({
      id: 'smoke_credentials_source_explicit',
      pass: nonExplicit.length === 0,
      detail: nonExplicit.length === 0 ? 'all credentials sourced from explicit env' : `fallback_used=${nonExplicit.join(', ')}`,
    });
    checks.push({
      id: 'smoke_setup_auth_bootstrap_source_present',
      pass: Boolean(String(smokeChecksReport?.setup_auth_bootstrap?.source || '').trim()),
      detail: `setup_auth_bootstrap.source=${String(smokeChecksReport?.setup_auth_bootstrap?.source || '(missing)')}`,
    });

    const liveProof = smokeChecksReport?.oidc_live_proof && typeof smokeChecksReport.oidc_live_proof === 'object'
      ? smokeChecksReport.oidc_live_proof
      : null;
    checks.push({
      id: 'smoke_oidc_live_proof_present',
      pass: Boolean(liveProof),
      detail: liveProof ? 'oidc_live_proof present' : 'oidc_live_proof missing',
    });
    if (liveProof) {
      const issuer = String(liveProof.issuer || '').trim();
      checks.push({
        id: 'smoke_oidc_live_proof_issuer_present',
        pass: Boolean(issuer),
        detail: issuer ? `issuer=${issuer}` : 'issuer missing',
      });
      const startPass = Boolean(
        liveProof?.acquisition?.oidc_start_completed
        && liveProof?.acquisition?.authorization_url_present
        && liveProof?.acquisition?.state_issued,
      );
      checks.push({
        id: 'smoke_oidc_live_proof_start_pass',
        pass: startPass,
        detail: `oidc_start_completed=${String(liveProof?.acquisition?.oidc_start_completed)}; authorization_url_present=${String(liveProof?.acquisition?.authorization_url_present)}; state_issued=${String(liveProof?.acquisition?.state_issued)}`,
      });
      const authCodePass = Boolean(
        liveProof?.authorization_code?.acquired
        && Number(liveProof?.authorization_code?.code_length || 0) > 0,
      );
      checks.push({
        id: 'smoke_oidc_live_proof_auth_code_acquired',
        pass: authCodePass,
        detail: `acquired=${String(liveProof?.authorization_code?.acquired)}; code_length=${String(liveProof?.authorization_code?.code_length || 0)}`,
      });
      const exchangePass = Boolean(
        liveProof?.exchange?.callback_completed
        && liveProof?.exchange?.access_token_issued
        && liveProof?.exchange?.auth_me_validated,
      );
      checks.push({
        id: 'smoke_oidc_live_proof_exchange_pass',
        pass: exchangePass,
        detail: `callback_completed=${String(liveProof?.exchange?.callback_completed)}; access_token_issued=${String(liveProof?.exchange?.access_token_issued)}; auth_me_validated=${String(liveProof?.exchange?.auth_me_validated)}`,
      });

      const smokeRunId = String(smokeChecksReport?.source_run_id || liveProof?.run_id || '').trim();
      checks.push({
        id: 'smoke_oidc_live_proof_run_identity_present',
        pass: Boolean(smokeRunId),
        detail: `run_id=${smokeRunId || '(missing)'}`,
      });
      if (args.expectedRunId) {
        checks.push({
          id: 'smoke_oidc_live_proof_run_identity_matches_gate_context',
          pass: smokeRunId === args.expectedRunId,
          detail: `expected_run_id=${args.expectedRunId}; observed_run_id=${smokeRunId || '(missing)'}`,
        });
      }
    }
  }

  const failed = checks.filter((c) => !c.pass);
  const passed = checks.filter((c) => c.pass);
  const status = failed.length === 0 ? 'pass' : 'fail';

  const out = {
    type: 'd9_keycloak_oidc_live_interop_evidence_check',
    generated_at_utc: new Date().toISOString(),
    strict: args.strict,
    ci_like: args.ciLike,
    max_age_days: args.maxAgeDays,
    max_age_override_justification: args.overrideJustification || null,
    status,
    summary: {
      passed: passed.length,
      failed: failed.length,
      total: checks.length,
    },
    checks,
  };

  const outDir = path.join(root, 'docs', 'release', 'status');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'd9-keycloak-interop-evidence-check-latest.json');
  const outMd = path.join(outDir, 'd9-keycloak-interop-evidence-check-latest.md');
  fs.writeFileSync(outJson, JSON.stringify(out, null, 2));

  const md = [
    '# D9 Keycloak Interop Evidence Check',
    '',
    `- Generated: ${out.generated_at_utc}`,
    `- Status: ${status.toUpperCase()}`,
    `- Strict: ${args.strict ? 'yes' : 'no'}`,
    `- Max age days: ${args.maxAgeDays}`,
    '',
    '## Checks',
    '',
  ];
  for (const check of checks) {
    md.push(`- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`);
  }
  md.push('');
  fs.writeFileSync(outMd, md.join('\n'));

  console.log(`wrote: ${path.relative(root, outJson)}`);
  console.log(`wrote: ${path.relative(root, outMd)}`);
  console.log(`status: ${status}`);

  if (failed.length > 0 && args.strict) process.exit(1);
}

main();
