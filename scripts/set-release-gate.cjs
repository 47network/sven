#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const root = process.cwd();
const gatesPath = path.join(root, 'docs', 'release', 'status', 'ci-gates.json');
const manualGateAuditPath = path.join(root, 'docs', 'release', 'status', 'manual-gate-overrides-audit.jsonl');
const requiredWorkflowManifestPath = path.join(root, 'config', 'release', 'required-workflows.json');
const MANUAL_ALLOWED = new Set([
  'soak_72h',
  'week4_rc_complete',
  'post_release_verified'
]);
const CI_DERIVED_FALLBACK = [
  'final_dod_ci',
  'parity_e2e_ci',
  'parity_checklist_verify_ci',
  'agent_zero_parity_verify_ci',
  'websocket_contract_ci',
  'mcp_server_compat_ci',
  'a2a_compat_ci',
  'd9_keycloak_interop_ci',
  'release_ops_drill_ci',
  'desktop_release_ci',
  'client_env_governance_ci',
  'backend_capability_e2e_ci',
  'security_privacy_governance_ci',
];

function readManifestDerivedCiKeys() {
  if (!fs.existsSync(requiredWorkflowManifestPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(requiredWorkflowManifestPath, 'utf8'));
    const mapping =
      parsed && typeof parsed === 'object' && parsed.ci_gate_key_by_workflow && typeof parsed.ci_gate_key_by_workflow === 'object'
        ? parsed.ci_gate_key_by_workflow
        : null;
    if (!mapping) return [];
    return Object.values(mapping).map((value) => String(value || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const CI_DERIVED_WRITE_PROTECTED = new Set([
  ...CI_DERIVED_FALLBACK,
  ...readManifestDerivedCiKeys(),
]);

function usage() {
  console.error('Usage: npm run release:gate:set -- <gate_name> <true|false>');
  console.error('Required mode: set SVEN_RELEASE_GATE_MODE=sandbox');
  console.error('For <true> transitions, set evidence env vars: SVEN_RELEASE_GATE_EVIDENCE_RUN_ID and SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA');
  console.error(`Manual gates: ${Array.from(MANUAL_ALLOWED).join(', ')}`);
  console.error(`Write-protected CI-derived gates: ${Array.from(CI_DERIVED_WRITE_PROTECTED).join(', ')}`);
}

function readLastAuditHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return null;
  try {
    const parsed = JSON.parse(lines[lines.length - 1]);
    const hash = String(parsed.entry_hash || '').trim();
    return hash || null;
  } catch {
    return null;
  }
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

const gate = process.argv[2];
const valueRaw = process.argv[3];
if (!gate || !valueRaw) {
  usage();
  process.exit(1);
}
if (CI_DERIVED_WRITE_PROTECTED.has(gate)) {
  console.error(`Gate "${gate}" is write-protected (CI-derived). Use release-gates-sync workflow evidence updates only.`);
  process.exit(1);
}
if (!MANUAL_ALLOWED.has(gate)) {
  usage();
  process.exit(1);
}

const value = valueRaw.toLowerCase();
if (value !== 'true' && value !== 'false') {
  usage();
  process.exit(1);
}
const isPromoteToTrue = value === 'true';
const evidenceRunId = String(process.env.SVEN_RELEASE_GATE_EVIDENCE_RUN_ID || '').trim();
const evidenceHeadSha = String(process.env.SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA || '').trim();
const evidenceUrl = String(process.env.SVEN_RELEASE_GATE_EVIDENCE_URL || '').trim() || null;
if (isPromoteToTrue && (!evidenceRunId || !evidenceHeadSha)) {
  console.error(
    'Manual gate elevation to true requires evidence binding: ' +
    'set SVEN_RELEASE_GATE_EVIDENCE_RUN_ID and SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA.',
  );
  process.exit(1);
}
if (isPromoteToTrue && !/^[a-f0-9]{7,64}$/i.test(evidenceHeadSha)) {
  console.error('SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA must be a 7-64 character hex SHA.');
  process.exit(1);
}

const releaseGateMode = String(process.env.SVEN_RELEASE_GATE_MODE || '').trim().toLowerCase();
if (releaseGateMode !== 'sandbox') {
  console.error(
    'Manual gate mutation is restricted to sandbox mode. ' +
    'Set SVEN_RELEASE_GATE_MODE=sandbox for explicit non-production usage.',
  );
  process.exit(1);
}

const rawRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim();
const normalizedRef = rawRef.startsWith('refs/') ? rawRef : (rawRef ? `refs/heads/${rawRef}` : '');
const isProtectedRef = Boolean(
  normalizedRef
  && (
    normalizedRef === 'refs/heads/main'
    || normalizedRef === 'refs/heads/master'
    || normalizedRef.startsWith('refs/heads/release/')
    || normalizedRef.startsWith('refs/tags/')
  ),
);
const allowProtectedMutation = String(process.env.SVEN_ALLOW_PROTECTED_MANUAL_GATE_SET || '').trim() === '1';
const changeTicket = String(process.env.SVEN_RELEASE_GATE_CHANGE_TICKET || '').trim();
if (isProtectedRef && !allowProtectedMutation) {
  console.error(
    `Manual gate mutation is blocked on protected ref "${normalizedRef}". ` +
    'Set SVEN_ALLOW_PROTECTED_MANUAL_GATE_SET=1 and provide SVEN_RELEASE_GATE_CHANGE_TICKET for audited override.',
  );
  process.exit(1);
}
if (isProtectedRef && allowProtectedMutation && !changeTicket) {
  console.error('SVEN_RELEASE_GATE_CHANGE_TICKET is required when overriding protected-ref manual gate mutation.');
  process.exit(1);
}

const ciLike = String(process.env.GITHUB_ACTIONS || '').trim().toLowerCase() === 'true'
  || String(process.env.CI || '').trim().toLowerCase() === 'true';
const allowCiMutation = String(process.env.SVEN_ALLOW_CI_MANUAL_GATE_SET || '').trim() === '1';
if (ciLike && !allowCiMutation) {
  console.error('Manual gate mutation is blocked in CI. Set SVEN_ALLOW_CI_MANUAL_GATE_SET=1 for audited emergency override.');
  process.exit(1);
}

const gates = JSON.parse(fs.readFileSync(gatesPath, 'utf8'));
gates.generated_at = new Date().toISOString();
gates[gate] = value === 'true';
const nowIso = new Date().toISOString();
const actor = String(process.env.GITHUB_ACTOR || process.env.USER || process.env.USERNAME || 'manual').trim() || 'manual';
if (!gates.manual_overrides || typeof gates.manual_overrides !== 'object') {
  gates.manual_overrides = {};
}
gates.manual_overrides[gate] = {
  value: gates[gate],
  updated_at: nowIso,
  source: 'manual_setter',
  actor,
  ref: normalizedRef || null,
  change_ticket: changeTicket || null,
  evidence_run_id: evidenceRunId || null,
  evidence_head_sha: evidenceHeadSha || null,
  evidence_url: evidenceUrl,
};

const previousHash = readLastAuditHash(manualGateAuditPath);
const auditCore = {
  at_utc: nowIso,
  source: 'manual_setter',
  actor,
  gate,
  value: gates[gate],
  ref: normalizedRef || null,
  change_ticket: changeTicket || null,
  evidence_run_id: evidenceRunId || null,
  evidence_head_sha: evidenceHeadSha || null,
  evidence_url: evidenceUrl,
  prev_hash: previousHash,
};
const entryHash = sha256Hex(
  JSON.stringify({
    ...auditCore,
  }),
);
const auditEntry = {
  ...auditCore,
  entry_hash: entryHash,
};

fs.mkdirSync(path.dirname(manualGateAuditPath), { recursive: true });
fs.appendFileSync(manualGateAuditPath, `${JSON.stringify(auditEntry)}\n`, 'utf8');
fs.writeFileSync(gatesPath, JSON.stringify(gates, null, 2) + '\n');

if (process.env.SVEN_RELEASE_GATE_SET_SKIP_DOWNSTREAM === '1') {
  console.log(`Updated ${gate}=${value} (downstream updates skipped by SVEN_RELEASE_GATE_SET_SKIP_DOWNSTREAM=1).`);
  process.exit(0);
}

const statusRun = spawnSync('npm', ['run', 'release:status'], { stdio: 'inherit', shell: true });
if (statusRun.status !== 0) {
  process.exit(statusRun.status || 1);
}

const checklistRun = spawnSync('npm', ['run', 'release:checklist:update'], { stdio: 'inherit', shell: true });
if (checklistRun.status !== 0) {
  process.exit(checklistRun.status || 1);
}

console.log(`Updated ${gate}=${value}.`);
