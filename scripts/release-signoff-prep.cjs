#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'release-signoff-prep-latest.json');
const outMd = path.join(outDir, 'release-signoff-prep-latest.md');
const outPs1 = path.join(outDir, 'release-signoff-next-steps.ps1');
const manifestPath = path.join(root, 'docs', 'release', 'status', 'release-artifacts-latest.json');
const signoffScriptPath = 'scripts/ops/release/set-final-signoff.ps1';
const roles = ['engineering', 'security', 'operations', 'product', 'release_owner'];
const defaultStagingEvidenceUrl = 'docs/release/evidence/staging-migration-verification-latest.json';
const defaultDashboardUrl = 'docs/release/status/latest.md';
const parityIntegrationTruthfulnessTests = [
  'services/gateway-api/src/__tests__/parity-integration-skills-truthfulness-2026-03-12.contract.test.ts',
  'services/gateway-api/src/__tests__/parity-integration-runtime-truthfulness-2026-03-12.contract.test.ts',
];

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function resolveHeadSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function sha256File(fullPath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fullPath));
  return hash.digest('hex');
}

function collectRoleFailures(finalSignoff, role) {
  const checks = Array.isArray(finalSignoff?.checks) ? finalSignoff.checks : [];
  return checks
    .filter((check) => String(check.id || '').endsWith(`:${role}`) && check.pass === false)
    .map((check) => ({
      id: check.id,
      detail: check.detail,
    }));
}

function findSelectedDoc(finalSignoff, role) {
  const checks = Array.isArray(finalSignoff?.checks) ? finalSignoff.checks : [];
  const selected = checks.find((check) => check.id === `signoff_doc_selected_latest:${role}`);
  return selected?.detail || null;
}

function buildNextSteps(summary) {
  const steps = [];
  if (String(summary.final_signoff_status || '').toLowerCase() !== 'pass') {
    steps.push('Fill the approver variables in docs/release/status/release-signoff-next-steps.ps1.');
    steps.push('Run the per-role signoff regeneration commands with real approver names after evidence review.');
    steps.push('Run npm run release:final:signoff:check -- --strict.');
    return steps;
  }
  steps.push('Final signoff is already passing; keep it fresh until release cut.');
  return steps;
}

function renderMarkdown(summary) {
  const lines = [
    '# Release Signoff Prep',
    '',
    `- Generated at: ${summary.generated_at}`,
    `- Release ID: ${summary.release_id || '(missing)'}`,
    `- Head SHA: ${summary.head_sha || '(missing)'}`,
    `- Artifact manifest hash: ${summary.artifact_manifest_hash || '(missing)'}`,
    `- Final signoff status: ${summary.final_signoff_status ?? '(missing)'}`,
    '',
    '## Execution Model',
    '',
    '- Fill only the signoff approver variables in the dedicated PowerShell handoff.',
    '- Signoff regeneration requires real approver identities and current evidence review.',
    '',
    '## Artifacts',
    '',
    ...((summary.artifacts?.status_files || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.artifacts?.selected_signoff_docs || []).map((artifact) => `- signoff/${artifact.role}: ${artifact.path || '(missing)'}`)),
    '',
    '## Defaults',
    '',
    `- staging evidence url: ${summary.signoff_defaults?.staging_evidence_url ?? '(missing)'}`,
    `- dashboard url: ${summary.signoff_defaults?.dashboard_url ?? '(missing)'}`,
    `- expires at default: ${summary.expires_at_default ?? '(missing)'}`,
    '',
    '## Per-Role Failures',
    '',
    ...((summary.final_signoff_role_summary || []).flatMap((role) => {
      const header = `- ${role.role}: ${role.selected_doc || '(no selected doc)'}`;
      const failures = (role.failing_checks || []).map((check) => `  - ${check.id}: ${check.detail}`);
      return [header, ...failures];
    })),
    '',
    '## Commands',
    '',
    ...((summary.commands || []).map((command) => `- ${command.role}: ${command.command}`)),
    '',
    '## Next Steps',
    '',
    ...((summary.next_steps || []).map((step) => `- ${step}`)),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderPs1(summary) {
  const approverVarByRole = {
    engineering: '$EngineeringApprover',
    security: '$SecurityApprover',
    operations: '$OperationsApprover',
    product: '$ProductApprover',
    release_owner: '$ReleaseOwnerApprover',
  };

  const renderedCommands = (summary.commands || []).map((command) => ({
    ...command,
    command: command.command.replaceAll('<name>', approverVarByRole[command.role] || '$ApproverName'),
  }));

  const lines = [
    '# Release signoff next steps generated by scripts/release-signoff-prep.cjs',
    '# Section-scoped validation',
    '# - fill only the approver variables below before running the signoff commands',
    '',
    '# Current signoff blocker summary',
    `# - final_signoff_status: ${summary.final_signoff_status ?? '(missing)'}`,
    ...((summary.final_signoff_role_summary || []).flatMap((role) => [
      `# - ${role.role}: ${role.selected_doc || '(missing)'}`,
      ...((role.failing_checks || []).map((check) => `#   - ${check.id}: ${check.detail}`)),
    ])),
    '',
    `$ReleaseId = '${summary.release_id || ''}'`,
    `$HeadSha = '${summary.head_sha || ''}'`,
    `$ArtifactManifestHash = '${summary.artifact_manifest_hash || ''}'`,
    `$ExpiresAt = '${summary.expires_at_default || ''}'`,
    `$StagingEvidenceUrl = '${summary.signoff_defaults?.staging_evidence_url || ''}'`,
    `$DashboardUrl = '${summary.signoff_defaults?.dashboard_url || ''}'`,
    "$EngineeringApprover = '<engineering-approver>'",
    "$SecurityApprover = '<security-approver>'",
    "$OperationsApprover = '<operations-approver>'",
    "$ProductApprover = '<product-approver>'",
    "$ReleaseOwnerApprover = '<release-owner-approver>'",
    '',
    'function Assert-NoPlaceholder([string]$Name, [string]$Value) {',
    "  if ($null -eq $Value -or $Value -match '^<.+>$') {",
    '    throw "Unresolved placeholder for ${Name}: $Value"',
    '  }',
    '}',
    '',
    'Assert-NoPlaceholder "EngineeringApprover" $EngineeringApprover',
    'Assert-NoPlaceholder "SecurityApprover" $SecurityApprover',
    'Assert-NoPlaceholder "OperationsApprover" $OperationsApprover',
    'Assert-NoPlaceholder "ProductApprover" $ProductApprover',
    'Assert-NoPlaceholder "ReleaseOwnerApprover" $ReleaseOwnerApprover',
    '',
  ];

  for (const command of renderedCommands) {
    lines.push(`# ${command.role}`);
    lines.push(command.command);
    lines.push('');
  }

  lines.push('npm run release:final:signoff:check -- --strict');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const releaseId = String(process.env.SVEN_RELEASE_ID || '').trim() || `${new Date().toISOString().slice(0, 10)}-rc`;
  const headSha = resolveHeadSha();
  const artifactManifestHash = fs.existsSync(manifestPath) ? sha256File(manifestPath) : null;
  const expiresAt = new Date(Date.now() + (167 * 60 * 60 * 1000)).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const latest = readJson('docs/release/status/latest.json');
  const finalSignoff = readJson('docs/release/status/final-signoff-latest.json');
  const mobileReadiness = readJson('docs/release/status/mobile-release-readiness-latest.json');

  const summary = {
    generated_at: new Date().toISOString(),
    release_id: releaseId,
    head_sha: headSha,
    artifact_manifest_path: fs.existsSync(manifestPath)
      ? path.relative(root, manifestPath).replace(/\\/g, '/')
      : null,
    artifact_manifest_hash: artifactManifestHash,
    expires_at_default: expiresAt,
    signoff_defaults: {
      staging_evidence_url: defaultStagingEvidenceUrl,
      dashboard_url: defaultDashboardUrl,
    },
    latest_status: latest ? {
      checklist_unchecked_count: latest?.checklist?.unchecked_count ?? null,
      soak_summary_status: latest?.soak_72h?.summary_status ?? null,
      final_signoff_status: latest?.final_signoff?.status ?? null,
      mobile_release_readiness_status: latest?.mobile_release_readiness?.status ?? null,
    } : null,
    final_signoff_status: finalSignoff?.status || null,
    mobile_release_readiness_status: mobileReadiness?.status || null,
    final_signoff_role_summary: roles.map((role) => ({
      role,
      selected_doc: findSelectedDoc(finalSignoff, role),
      failing_checks: collectRoleFailures(finalSignoff, role),
    })),
    commands: roles.map((role) => ({
      role,
      command: [
        'powershell -ExecutionPolicy Bypass -File',
        signoffScriptPath,
        `-Role ${role}`,
        '-Approver <name>',
        '-Status approved',
        `-ReleaseId ${releaseId}`,
        `-ArtifactManifestHash ${artifactManifestHash || '<missing-release-artifact-manifest-hash>'}`,
        `-ExpiresAt ${expiresAt}`,
        `-StagingEvidenceUrl ${defaultStagingEvidenceUrl}`,
        `-DashboardUrl ${defaultDashboardUrl}`,
        '-Notes "approval captured after evidence review"',
      ].join(' '),
    })),
  };

  summary.execution_model = {
    signoff_sections_require_signoff_inputs_only: true,
  };
  summary.truthfulness_sources = {
    integration_parity_contract_tests: parityIntegrationTruthfulnessTests,
  };
  summary.artifacts = {
    status_files: [
      { label: 'final signoff status', path: 'docs/release/status/final-signoff-latest.json' },
      { label: 'release signoff prep json', path: 'docs/release/status/release-signoff-prep-latest.json' },
      { label: 'release signoff prep markdown', path: 'docs/release/status/release-signoff-prep-latest.md' },
      { label: 'release signoff next steps ps1', path: 'docs/release/status/release-signoff-next-steps.ps1' },
      ...parityIntegrationTruthfulnessTests.map((testPath) => ({
        label: 'integration parity truthfulness test source',
        path: testPath,
      })),
    ],
    selected_signoff_docs: summary.final_signoff_role_summary.map((role) => ({
      role: role.role,
      path: role.selected_doc,
    })),
  };
  summary.next_steps = buildNextSteps(summary);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, renderMarkdown(summary), 'utf8');
  fs.writeFileSync(outPs1, renderPs1(summary), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main();
