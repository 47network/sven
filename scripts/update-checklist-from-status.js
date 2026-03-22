import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const canonicalChecklistPath = path.join(root, 'docs', 'parity', 'Sven_Parity_Checklist.md');
const checklistPath = process.env.SVEN_CHECKLIST_SYNC_MAIN_PATH
  ? path.resolve(root, process.env.SVEN_CHECKLIST_SYNC_MAIN_PATH)
  : canonicalChecklistPath;
const releaseChecklistPath = process.env.SVEN_CHECKLIST_SYNC_RELEASE_PATH
  ? path.resolve(root, process.env.SVEN_CHECKLIST_SYNC_RELEASE_PATH)
  : path.join(root, 'docs', 'release', 'checklists', 'sven-production-parity-checklist-2026.md');
const gatesPath = process.env.SVEN_CHECKLIST_SYNC_GATES_PATH
  ? path.resolve(root, process.env.SVEN_CHECKLIST_SYNC_GATES_PATH)
  : path.join(root, 'docs', 'release', 'status', 'ci-gates.json');
const latestStatusPath = process.env.SVEN_CHECKLIST_SYNC_LATEST_STATUS_PATH
  ? path.resolve(root, process.env.SVEN_CHECKLIST_SYNC_LATEST_STATUS_PATH)
  : path.join(root, 'docs', 'release', 'status', 'latest.json');
const reportJsonPath = process.env.SVEN_CHECKLIST_SYNC_REPORT_JSON_PATH
  ? path.resolve(root, process.env.SVEN_CHECKLIST_SYNC_REPORT_JSON_PATH)
  : path.join(root, 'docs', 'release', 'status', 'checklist-sync-diff-latest.json');
const reportMdPath = process.env.SVEN_CHECKLIST_SYNC_REPORT_MD_PATH
  ? path.resolve(root, process.env.SVEN_CHECKLIST_SYNC_REPORT_MD_PATH)
  : path.join(root, 'docs', 'release', 'status', 'checklist-sync-diff-latest.md');

if (!fs.existsSync(gatesPath)) {
  console.error(`Missing gate status file: ${path.relative(root, gatesPath)}`);
  process.exit(1);
}
if (!fs.existsSync(checklistPath)) {
  console.error(`Missing checklist sync target: ${path.relative(root, checklistPath)}`);
  process.exit(1);
}
if (!fs.existsSync(releaseChecklistPath)) {
  console.error(`Missing checklist sync target: ${path.relative(root, releaseChecklistPath)}`);
  process.exit(1);
}

const gates = JSON.parse(fs.readFileSync(gatesPath, 'utf8'));
const latestStatus = fs.existsSync(latestStatusPath) ? JSON.parse(fs.readFileSync(latestStatusPath, 'utf8')) : null;
const REQUIRED_PROVENANCE_KEYS = [
  'final_dod_ci',
  'parity_e2e_ci',
  'parity_checklist_verify_ci',
  'agent_zero_parity_verify_ci',
  'websocket_contract_ci',
  'mcp_server_compat_ci',
  'a2a_compat_ci',
  'release_ops_drill_ci',
  'd9_keycloak_interop_ci',
  'desktop_release_ci',
  'client_env_governance_ci',
  'backend_capability_e2e_ci',
  'security_privacy_governance_ci',
  'privacy_admin_e2e_ci',
  'skill_quarantine_scan_ci',
  'security_audit_unified_ci',
  'security_baseline_ci',
];

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateGateProvenance(ciGates) {
  const failures = [];
  if (!hasText(ciGates?.source_head_sha)) failures.push('missing source_head_sha');
  if (!hasText(ciGates?.source_branch)) failures.push('missing source_branch');
  if (!ciGates?.gate_provenance || typeof ciGates.gate_provenance !== 'object') {
    failures.push('missing gate_provenance object');
    return failures;
  }
  for (const key of REQUIRED_PROVENANCE_KEYS) {
    const entry = ciGates.gate_provenance[key];
    if (!entry || typeof entry !== 'object') {
      failures.push(`missing gate_provenance.${key}`);
      continue;
    }
    if (!hasText(entry.workflow_name)) failures.push(`missing gate_provenance.${key}.workflow_name`);
    if (!hasText(entry.decision)) failures.push(`missing gate_provenance.${key}.decision`);
  }
  return failures;
}

function hasCiGateAttestation(ciGates, gateKey) {
  if (ciGates?.[gateKey] !== true) return false;
  const sourceHeadSha = String(ciGates?.source_head_sha || '').trim();
  const sourceBranch = String(ciGates?.source_branch || '').trim();
  if (!sourceHeadSha || !sourceBranch) return false;

  const manualOverride = ciGates?.manual_overrides && typeof ciGates.manual_overrides === 'object'
    ? ciGates.manual_overrides[gateKey]
    : null;
  if (manualOverride) return false;

  const provenance = ciGates?.gate_provenance && typeof ciGates.gate_provenance === 'object'
    ? ciGates.gate_provenance[gateKey]
    : null;
  if (!provenance || typeof provenance !== 'object') return false;
  if (!hasText(provenance.workflow_name) || !hasText(provenance.decision)) return false;
  if (!hasText(provenance.head_sha) || String(provenance.head_sha).trim() !== sourceHeadSha) return false;

  const requiredWorkflowGates =
    ciGates?.required_workflow_gates && typeof ciGates.required_workflow_gates === 'object'
      ? ciGates.required_workflow_gates
      : null;
  if (!requiredWorkflowGates) return false;

  const binding = Object.values(requiredWorkflowGates).find(
    (entry) =>
      entry
      && typeof entry === 'object'
      && String(entry.gate_key || '').trim() === gateKey,
  );
  if (!binding || typeof binding !== 'object') return false;
  if (binding.pass !== true) return false;
  const bindingProvenance = binding.provenance && typeof binding.provenance === 'object' ? binding.provenance : null;
  if (!bindingProvenance) return false;
  if (String(bindingProvenance.head_sha || '').trim() !== sourceHeadSha) return false;

  return true;
}

const provenanceFailures = validateGateProvenance(gates);
if (provenanceFailures.length > 0) {
  console.error('Checklist sync failed: ci-gates provenance metadata is incomplete.');
  for (const failure of provenanceFailures) {
    console.error(`- ${failure}`);
  }
  process.exit(2);
}

const d9LocalSelfcheckPass =
  latestStatus &&
  typeof latestStatus === 'object' &&
  latestStatus.d9_keycloak_interop &&
  typeof latestStatus.d9_keycloak_interop === 'object' &&
  String(latestStatus.d9_keycloak_interop.local_selfcheck_status || '').toLowerCase() === 'pass' &&
  String(latestStatus.d9_keycloak_interop.local_selfcheck_validation_status || '').toLowerCase() === 'valid';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function syncLiteralCheckbox(text, lineWithoutPrefix, shouldCheck) {
  const target = shouldCheck ? `[x] ${lineWithoutPrefix}` : `[ ] ${lineWithoutPrefix}`;
  const eitherRe = new RegExp(`^\\s*-\\s*\\[(?:x| )\\]\\s+${escapeRegex(lineWithoutPrefix)}\\s*$`, 'm');
  if (!eitherRe.test(text)) {
    return { text, changed: false, status: 'missing' };
  }
  const next = text.replace(eitherRe, `- ${target}`);
  return { text: next, changed: next !== text, status: next !== text ? 'changed' : 'noop' };
}

function syncRegexCheckbox(text, pattern, targetLine) {
  if (!pattern.test(text)) {
    return { text, changed: false, status: 'missing' };
  }
  const next = text.replace(pattern, targetLine);
  return { text: next, changed: next !== text, status: next !== text ? 'changed' : 'noop' };
}

function applyChecklistSync(filePath, syncPlan) {
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  const diagnostics = [];
  for (const item of syncPlan) {
    if (item.kind === 'literal') {
      const result = syncLiteralCheckbox(text, item.line, item.checked);
      text = result.text;
      if (result.changed) changed = true;
      diagnostics.push({ id: item.id, status: result.status, target: item.checked ? 'checked' : 'unchecked' });
      continue;
    }
    if (item.kind === 'regex') {
      const result = syncRegexCheckbox(text, item.pattern, item.to);
      text = result.text;
      if (result.changed) changed = true;
      diagnostics.push({ id: item.id, status: result.status, target: item.target });
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, text);
  }
  return { changed, diagnostics };
}

const checklistSyncPlan = [
  {
    id: 'final_dod_ci',
    kind: 'literal',
    line: '`final-dod.e2e.ts` passes in CI',
    checked: hasCiGateAttestation(gates, 'final_dod_ci'),
  },
  {
    id: 'parity_e2e_ci',
    kind: 'literal',
    line: 'New parity E2E suite passes in CI',
    checked: hasCiGateAttestation(gates, 'parity_e2e_ci'),
  },
  {
    id: 'd9_keycloak_interop_ci',
    kind: 'literal',
    line: 'D9 Keycloak live OIDC interop gate passes in CI',
    checked: hasCiGateAttestation(gates, 'd9_keycloak_interop_ci'),
  },
  {
    id: 'd9_local_selfcheck',
    kind: 'regex',
    pattern: /^\s*-\s\[(?:x| )\] D9 Keycloak local selfcheck passes \(.*selfcheck:local.*\)$/m,
    to: d9LocalSelfcheckPass
      ? '- [x] D9 Keycloak local selfcheck passes (`release:sso:keycloak:interop:selfcheck:local`)'
      : '- [ ] D9 Keycloak local selfcheck passes (`release:sso:keycloak:interop:selfcheck:local`)',
    target: d9LocalSelfcheckPass ? 'checked' : 'unchecked',
  },
  {
    id: 'soak_72h',
    kind: 'literal',
    line: 'Release candidate runs 72h soak without Sev1/Sev2 incident',
    checked: gates.soak_72h === true,
  },
  {
    id: 'week4_rc_complete',
    kind: 'literal',
    line: 'Week 4 target: v0.2.0 RC + soak + cut release',
    checked: gates.week4_rc_complete === true,
  },
  {
    id: 'post_release_verified',
    kind: 'literal',
    line: 'Post-release verification checklist completed (health, queue lag, error rate, approvals)',
    checked: gates.post_release_verified === true,
  },
];

const releaseChecklistSyncPlan = [
  {
    id: 'release_d9_keycloak_interop_ci',
    kind: 'literal',
    line: 'Keycloak live interop gate passes in CI (`d9-keycloak-interop-gate`).',
    checked: hasCiGateAttestation(gates, 'd9_keycloak_interop_ci'),
  },
  {
    id: 'release_d9_local_selfcheck',
    kind: 'regex',
    pattern: /^\s*-\s\[(?:x| )\] Keycloak local selfcheck passes \(.*selfcheck:local.*\)\.$/m,
    to: d9LocalSelfcheckPass
      ? '- [x] Keycloak local selfcheck passes (`release:sso:keycloak:interop:selfcheck:local`).'
      : '- [ ] Keycloak local selfcheck passes (`release:sso:keycloak:interop:selfcheck:local`).',
    target: d9LocalSelfcheckPass ? 'checked' : 'unchecked',
  },
];

const mainChecklistResult = applyChecklistSync(checklistPath, checklistSyncPlan);
const releaseChecklistResult = applyChecklistSync(releaseChecklistPath, releaseChecklistSyncPlan);
const mainChecklistChanged = mainChecklistResult.changed;
const releaseChecklistChanged = releaseChecklistResult.changed;

const allDiagnostics = [
  ...mainChecklistResult.diagnostics.map((entry) => ({ file: path.relative(root, checklistPath), ...entry })),
  ...releaseChecklistResult.diagnostics.map((entry) => ({ file: path.relative(root, releaseChecklistPath), ...entry })),
];
const changedCount = allDiagnostics.filter((d) => d.status === 'changed').length;
const noopCount = allDiagnostics.filter((d) => d.status === 'noop').length;
const missingCount = allDiagnostics.filter((d) => d.status === 'missing').length;

const report = {
  generated_at: new Date().toISOString(),
  status: missingCount > 0 ? 'fail' : 'pass',
  summary: {
    changed: changedCount,
    noop: noopCount,
    missing: missingCount,
  },
  files: {
    main_checklist: path.relative(root, checklistPath).replace(/\\/g, '/'),
    release_checklist: path.relative(root, releaseChecklistPath).replace(/\\/g, '/'),
  },
  diagnostics: allDiagnostics,
};
fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  reportMdPath,
  [
    '# Checklist Sync Diff Report',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- changed: ${changedCount}`,
    `- noop: ${noopCount}`,
    `- missing: ${missingCount}`,
    '',
    '## Diagnostics',
    ...allDiagnostics.map((entry) => `- file=${entry.file} id=${entry.id} status=${entry.status} target=${entry.target}`),
    '',
  ].join('\n'),
  'utf8',
);

if (mainChecklistChanged || releaseChecklistChanged) {
  console.log('Updated checklist from CI gate status.');
} else {
  console.log('No checklist changes needed from current CI gate status.');
}
console.log(
  `Checklist sync diagnostics: changed=${changedCount}, noop=${noopCount}, missing=${missingCount}`,
);

if (missingCount > 0) {
  console.error('Checklist sync failed: missing expected checklist target(s).');
  for (const missing of allDiagnostics.filter((d) => d.status === 'missing')) {
    console.error(`- file=${missing.file} id=${missing.id} target=${missing.target}`);
  }
  console.error(`- report_json=${path.relative(root, reportJsonPath)}`);
  process.exit(2);
}
