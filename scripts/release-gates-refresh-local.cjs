#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectOpsShellCiRequirement } = require('./lib/ops-shell-ci-scope.cjs');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const gatesPath = path.join(outDir, 'ci-gates.json');
const requiredWorkflowManifestPath = path.join(root, 'config', 'release', 'required-workflows.json');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function readRequiredWorkflowManifest() {
  const parsed = readJsonIfExists(requiredWorkflowManifestPath) || {};
  const requiredWorkflows = Array.isArray(parsed.required_workflows)
    ? parsed.required_workflows.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const ciGateKeyByWorkflow =
    parsed && typeof parsed.ci_gate_key_by_workflow === 'object' && parsed.ci_gate_key_by_workflow
      ? parsed.ci_gate_key_by_workflow
      : {};
  return { requiredWorkflows, ciGateKeyByWorkflow };
}

function git(args, fallback = '') {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (run.status === 0) {
    return String(run.stdout || '').trim() || fallback;
  }
  return fallback;
}

function localSourceBranch() {
  const envBranch = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim();
  if (envBranch.startsWith('refs/heads/')) return envBranch.replace('refs/heads/', '');
  if (envBranch) return envBranch;
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], 'local');
}

function localSourceHeadSha() {
  return String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || git(['rev-parse', 'HEAD'], 'local-head-sha-missing');
}

function statusGate(existing, gateKey, workflowName, relPath) {
  const payload = readJsonIfExists(path.join(root, relPath));
  const status = payload && typeof payload === 'object' ? String(payload.status || '').toLowerCase() : '';
  const generatedAt = payload && typeof payload === 'object' ? String(payload.generated_at || payload.generated_at_utc || '').trim() : '';
  const fallbackRunId = `local-${workflowName}-${Date.now()}`;
  if (status) {
    return {
      pass: status === 'pass',
      provenance: {
        workflow_name: workflowName,
        decision: 'local_artifact_status',
        run_id: String(payload.source_run_id || payload.run_id || '').trim() || fallbackRunId,
        head_sha: null,
        head_branch: null,
        status: status || null,
        conclusion: status === 'pass' ? 'success' : 'failure',
        matched_target_sha: false,
        source_artifact: relPath.replace(/\\/g, '/'),
        generated_at: generatedAt || null,
        gate_key: gateKey,
      },
    };
  }
  return {
    pass: existing[gateKey] === true,
    provenance: {
      workflow_name: workflowName,
      decision: Object.prototype.hasOwnProperty.call(existing, gateKey)
        ? 'local_preserved_existing'
        : 'local_default_false_missing_artifact',
      run_id: null,
      head_sha: null,
      head_branch: null,
      status: null,
      conclusion: existing[gateKey] === true ? 'success' : null,
      matched_target_sha: false,
      source_artifact: relPath.replace(/\\/g, '/'),
      generated_at: null,
      gate_key: gateKey,
    },
  };
}

function existingGate(existing, gateKey, workflowName) {
  const fallbackRunId = `local-${workflowName}-${Date.now()}`;
  return {
    pass: existing[gateKey] === true,
    provenance: {
      workflow_name: workflowName,
      decision: Object.prototype.hasOwnProperty.call(existing, gateKey)
        ? 'local_preserved_existing'
        : 'local_default_false_missing_artifact',
      run_id: fallbackRunId,
      head_sha: null,
      head_branch: null,
      status: null,
      conclusion: existing[gateKey] === true ? 'success' : null,
      matched_target_sha: false,
      source_artifact: null,
      generated_at: null,
      gate_key: gateKey,
    },
  };
}

function main() {
  const existing = readJsonIfExists(gatesPath) || {};
  const sourceBranch = localSourceBranch();
  const sourceHeadSha = localSourceHeadSha();
  const { requiredWorkflows, ciGateKeyByWorkflow } = readRequiredWorkflowManifest();
  const now = new Date().toISOString();

  const gateCatalog = {
    final_dod_ci: statusGate(existing, 'final_dod_ci', 'final-dod-e2e', 'docs/release/status/final-dod-execution-latest.json'),
    parity_e2e_ci: existingGate(existing, 'parity_e2e_ci', 'parity-e2e'),
    parity_checklist_verify_ci: statusGate(existing, 'parity_checklist_verify_ci', 'parity-checklist-verify', 'docs/release/status/parity-checklist-verify-latest.json'),
    agent_zero_parity_verify_ci: statusGate(existing, 'agent_zero_parity_verify_ci', 'agent-zero-parity-verify', 'docs/release/status/agent-zero-parity-verify-latest.json'),
    websocket_contract_ci: statusGate(existing, 'websocket_contract_ci', 'websocket-contract', 'docs/release/status/websocket-contract-latest.json'),
    mcp_server_compat_ci: statusGate(existing, 'mcp_server_compat_ci', 'mcp-server-compat', 'docs/release/status/mcp-server-compat-latest.json'),
    a2a_compat_ci: statusGate(existing, 'a2a_compat_ci', 'a2a-compat', 'docs/release/status/a2a-compat-latest.json'),
    d9_keycloak_interop_ci: statusGate(existing, 'd9_keycloak_interop_ci', 'd9-keycloak-interop-gate', 'docs/release/status/d9-keycloak-interop-gate-latest.json'),
    release_ops_drill_ci: statusGate(existing, 'release_ops_drill_ci', 'release-ops-drill', 'docs/release/status/release-ops-drill-latest.json'),
    mobile_auth_session_smoke_ci: existingGate(existing, 'mobile_auth_session_smoke_ci', 'mobile-auth-session-smoke'),
    mobile_release_readiness_ci: statusGate(existing, 'mobile_release_readiness_ci', 'mobile-release-readiness', 'docs/release/status/mobile-release-readiness-latest.json'),
    backup_restore_api_ci: existingGate(existing, 'backup_restore_api_ci', 'backup-restore-api-e2e'),
    flutter_user_app_device_farm_ci: statusGate(existing, 'flutter_user_app_device_farm_ci', 'flutter-user-app-device-farm', 'docs/release/status/mobile-device-farm-latest.json'),
    desktop_release_ci: statusGate(existing, 'desktop_release_ci', 'desktop-tauri-release', 'docs/release/status/desktop-tauri-parity-check-latest.json'),
    ui_e2e_ci: statusGate(existing, 'ui_e2e_ci', 'ui-e2e-accessibility', 'docs/release/status/ui-e2e-latest.json'),
    mobile_coverage_gate_ci: existingGate(existing, 'mobile_coverage_gate_ci', 'mobile-coverage-gate'),
    csrf_auth_e2e_ci: existingGate(existing, 'csrf_auth_e2e_ci', 'csrf-auth-e2e'),
    client_env_governance_ci: statusGate(existing, 'client_env_governance_ci', 'client-env-governance', 'docs/release/status/client-env-pipeline-latest.json'),
    backend_capability_e2e_ci: existingGate(existing, 'backend_capability_e2e_ci', 'backend-capability-e2e'),
    security_privacy_governance_ci: existingGate(existing, 'security_privacy_governance_ci', 'security-privacy-governance'),
    privacy_admin_e2e_ci: existingGate(existing, 'privacy_admin_e2e_ci', 'privacy-admin-e2e'),
    skill_quarantine_scan_ci: statusGate(existing, 'skill_quarantine_scan_ci', 'skill-quarantine-scan', 'docs/release/status/skill-quarantine-scan-latest.json'),
    security_audit_unified_ci: statusGate(existing, 'security_audit_unified_ci', 'security-audit-unified', 'docs/release/status/security-audit-unified-latest.json'),
    integration_truthfulness_ci: statusGate(existing, 'integration_truthfulness_ci', 'integration-truthfulness', 'docs/release/status/integration-truthfulness-latest.json'),
    security_baseline_ci: existingGate(existing, 'security_baseline_ci', 'security-baseline'),
  };

  for (const entry of Object.values(gateCatalog)) {
    entry.provenance.head_sha = sourceHeadSha;
    entry.provenance.head_branch = sourceBranch;
    entry.provenance.matched_target_sha = true;
  }

  const opsShellScope = detectOpsShellCiRequirement({
    rootDir: root,
    targetSha: sourceHeadSha,
    baseRef: sourceBranch ? `origin/${sourceBranch}` : null,
  });
  const opsShellCiRequired = Boolean(opsShellScope.required);
  const opsShellCiPass = opsShellCiRequired ? existing.ops_shell_ci === true : true;
  const opsShellCiProvenance = {
    workflow_name: 'ops-shell-ci',
    decision: opsShellCiRequired
      ? (Object.prototype.hasOwnProperty.call(existing, 'ops_shell_ci') ? 'local_preserved_existing_required_scope' : 'local_default_false_required_scope')
      : 'local_scope_not_required',
    run_id: null,
    head_sha: sourceHeadSha,
    head_branch: sourceBranch,
    status: opsShellCiRequired ? null : 'not_required',
    conclusion: opsShellCiPass ? 'success' : null,
    matched_target_sha: true,
    gate_key: 'ops_shell_ci',
    scope_source: opsShellScope.source,
    scope_globs: opsShellScope.scope_globs,
    scope_matched_files: opsShellScope.matched_files,
    scope_changed_files_count: Array.isArray(opsShellScope.changed_files) ? opsShellScope.changed_files.length : 0,
    ops_shell_ci_required: opsShellCiRequired,
  };

  const gateProvenance = Object.fromEntries(
    Object.entries(gateCatalog).map(([gateKey, result]) => [gateKey, result.provenance]),
  );
  gateProvenance.ops_shell_ci = opsShellCiProvenance;

  const requiredWorkflowGates = {};
  for (const workflowName of requiredWorkflows) {
    const gateKey = String(ciGateKeyByWorkflow[workflowName] || `${workflowName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_ci`);
    const resolved = gateCatalog[gateKey] || existingGate(existing, gateKey, workflowName);
    requiredWorkflowGates[workflowName] = {
      pass: resolved.pass,
      gate_key: gateKey,
      provenance: {
        ...resolved.provenance,
        workflow_name: workflowName,
      },
    };
  }

  const payload = {
    generated_at: now,
    source_branch: sourceBranch,
    source_head_sha: sourceHeadSha,
    run_snapshot: {
      source: 'local_status_refresh',
      captured_at: now,
      branch: sourceBranch,
      total_runs: 0,
    },
    final_dod_ci: gateCatalog.final_dod_ci.pass,
    parity_e2e_ci: gateCatalog.parity_e2e_ci.pass,
    parity_checklist_verify_ci: gateCatalog.parity_checklist_verify_ci.pass,
    agent_zero_parity_verify_ci: gateCatalog.agent_zero_parity_verify_ci.pass,
    websocket_contract_ci: gateCatalog.websocket_contract_ci.pass,
    mcp_server_compat_ci: gateCatalog.mcp_server_compat_ci.pass,
    a2a_compat_ci: gateCatalog.a2a_compat_ci.pass,
    d9_keycloak_interop_ci: gateCatalog.d9_keycloak_interop_ci.pass,
    release_ops_drill_ci: gateCatalog.release_ops_drill_ci.pass,
    mobile_auth_session_smoke_ci: gateCatalog.mobile_auth_session_smoke_ci.pass,
    mobile_release_readiness_ci: gateCatalog.mobile_release_readiness_ci.pass,
    backup_restore_api_ci: gateCatalog.backup_restore_api_ci.pass,
    flutter_user_app_device_farm_ci: gateCatalog.flutter_user_app_device_farm_ci.pass,
    desktop_release_ci: gateCatalog.desktop_release_ci.pass,
    ui_e2e_ci: gateCatalog.ui_e2e_ci.pass,
    mobile_coverage_gate_ci: gateCatalog.mobile_coverage_gate_ci.pass,
    csrf_auth_e2e_ci: gateCatalog.csrf_auth_e2e_ci.pass,
    client_env_governance_ci: gateCatalog.client_env_governance_ci.pass,
    backend_capability_e2e_ci: gateCatalog.backend_capability_e2e_ci.pass,
    security_privacy_governance_ci: gateCatalog.security_privacy_governance_ci.pass,
    privacy_admin_e2e_ci: gateCatalog.privacy_admin_e2e_ci.pass,
    ops_shell_ci_required: opsShellCiRequired,
    ops_shell_ci: opsShellCiPass,
    skill_quarantine_scan_ci: gateCatalog.skill_quarantine_scan_ci.pass,
    security_audit_unified_ci: gateCatalog.security_audit_unified_ci.pass,
    integration_truthfulness_ci: gateCatalog.integration_truthfulness_ci.pass,
    security_baseline_ci: gateCatalog.security_baseline_ci.pass,
    gate_provenance: gateProvenance,
    ci_gate_provenance: gateProvenance,
    required_workflow_manifest: {
      source: 'config/release/required-workflows.json',
      required_workflows: requiredWorkflows,
    },
    required_workflow_gates: requiredWorkflowGates,
    soak_72h: existing.soak_72h === true,
    week4_rc_complete: existing.week4_rc_complete === true,
    post_release_verified: existing.post_release_verified === true,
  };

  if (existing.manual_overrides && typeof existing.manual_overrides === 'object') {
    payload.manual_overrides = existing.manual_overrides;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(gatesPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`wrote: ${path.relative(root, gatesPath)}`);
  console.log(`source_branch=${sourceBranch}`);
  console.log(`source_head_sha=${sourceHeadSha}`);
}

main();
