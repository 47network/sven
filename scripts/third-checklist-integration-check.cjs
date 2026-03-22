#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'third-checklist-integration-latest.json');
const outMd = path.join(outDir, 'third-checklist-integration-latest.md');

function readUtf8(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

function hasAll(text, required) {
  return required.every((token) => text.includes(token));
}

function readJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function extractChecklist3Ids(markdown) {
  const out = new Set();
  const re = /\b(C\.\d{1,6})\b/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out).sort();
}

function run() {
  const checks = [];

  const prTemplateRel = '.github/pull_request_template.md';
  const prDorWorkflowRel = '.github/workflows/pr-dor-metadata.yml';
  const releaseSupplyChainRel = '.github/workflows/release-supply-chain.yml';
  const releaseStatusWorkflowRel = '.github/workflows/release-status.yml';
  const prDorScriptRel = 'scripts/pr-dor-metadata-check.cjs';
  const traceabilityScriptRel = 'scripts/traceability-matrix-check.cjs';
  const traceabilityEvidenceRel = 'docs/release/evidence/traceability-matrix-latest.json';
  const checklistAuthorityRel = 'docs/release/checklists/checklist-authority.json';

  const prTemplate = readUtf8(prTemplateRel);
  const prDorWorkflow = readUtf8(prDorWorkflowRel);
  const releaseSupplyChain = readUtf8(releaseSupplyChainRel);
  const releaseStatus = readUtf8(releaseStatusWorkflowRel);
  const traceabilityEvidence = readUtf8(traceabilityEvidenceRel);
  const masterChecklist = readUtf8('docs/Sven_Master_Checklist.md');
  const appChecklist = readUtf8('docs/SVEN_APP_CHECKLIST.md');
  const checklistAuthority = readJson(checklistAuthorityRel);

  checks.push({
    id: 'third_checklist_pr_dor_script_present',
    pass: fs.existsSync(path.join(root, prDorScriptRel)),
    detail: prDorScriptRel,
  });
  checks.push({
    id: 'third_checklist_traceability_script_present',
    pass: fs.existsSync(path.join(root, traceabilityScriptRel)),
    detail: traceabilityScriptRel,
  });
  checks.push({
    id: 'third_checklist_pr_template_dor_fields_present',
    pass: hasAll(prTemplate, [
      '## DoR Metadata (Required For Scope-Sensitive Changes)',
      'story_id=',
      'acceptance_criteria=',
      'dependencies=',
      'feature_flag_decision=',
      'observability_requirement=',
      'security_privacy_impact=',
      'migration_strategy=',
      'rollback_killswitch_path=',
    ]),
    detail: prTemplateRel,
  });
  checks.push({
    id: 'third_checklist_pr_template_dod_evidence_fields_present',
    pass: hasAll(prTemplate, [
      '## DoD Evidence Links (Required For Staging-Validated Changes)',
      'staging_run_url_or_artifact=',
      'dashboard_url=',
      'alerts_url=',
    ]),
    detail: prTemplateRel,
  });
  checks.push({
    id: 'third_checklist_pr_dor_workflow_wired',
    pass: hasAll(prDorWorkflow, [
      'name: pr-dor-metadata',
      'pull_request:',
      'npm run release:pr:dor:metadata:check -- --strict',
      'docs/release/status/pr-dor-metadata-latest.json',
    ]),
    detail: prDorWorkflowRel,
  });
  checks.push({
    id: 'third_checklist_traceability_evidence_present',
    pass: Boolean(traceabilityEvidence),
    detail: traceabilityEvidenceRel,
  });
  checks.push({
    id: 'third_checklist_traceability_release_gates_wired',
    pass:
      releaseSupplyChain.includes('npm run release:traceability:matrix:check') &&
      releaseStatus.includes('npm run release:traceability:matrix:check'),
    detail: `${releaseSupplyChainRel} + ${releaseStatusWorkflowRel}`,
  });

  const authorityValid =
    checklistAuthority
    && checklistAuthority.authority_model === 'sven_primary_plus_reference'
    && Array.isArray(checklistAuthority.primary_checklists)
    && checklistAuthority.primary_checklists.length >= 2
    && checklistAuthority.third_checklist
    && ['authoritative', 'reference_only'].includes(String(checklistAuthority.third_checklist.authority || ''));
  checks.push({
    id: 'third_checklist_authority_config_present',
    pass: Boolean(authorityValid),
    detail: checklistAuthorityRel,
  });

  const requiredScopeLabels = Array.isArray(checklistAuthority?.third_checklist?.required_scope_labels)
    ? checklistAuthority.third_checklist.required_scope_labels.map((value) => String(value || '').trim())
    : [];
  const hasRequiredScopeLabels =
    requiredScopeLabels.includes('in_scope_now')
    && requiredScopeLabels.includes('planned_later')
    && requiredScopeLabels.includes('out_of_scope');
  checks.push({
    id: 'third_checklist_scope_labels_declared',
    pass: hasRequiredScopeLabels,
    detail: hasRequiredScopeLabels
      ? `labels=${requiredScopeLabels.join(', ')}`
      : 'required labels missing (in_scope_now, planned_later, out_of_scope)',
  });

  const thirdAuthority = String(checklistAuthority?.third_checklist?.authority || '').trim();
  const thirdChecklistPath = String(checklistAuthority?.third_checklist?.path || '').trim();
  const thirdScopeMapPath = String(checklistAuthority?.third_checklist?.scope_map_path || '').trim();
  const scopeMap = thirdScopeMapPath ? readJson(thirdScopeMapPath) : null;

  checks.push({
    id: 'third_checklist_scope_map_present',
    pass: Boolean(scopeMap),
    detail: thirdScopeMapPath || 'missing scope_map_path',
  });

  const masterHasAuthorityNote = masterChecklist.includes('checklist-authority.json') && masterChecklist.includes('reference_only');
  const appHasAuthorityNote = appChecklist.includes('checklist-authority.json') && appChecklist.includes('reference_only');
  checks.push({
    id: 'third_checklist_scope_bounded_claims_present',
    pass: masterHasAuthorityNote && appHasAuthorityNote,
    detail: masterHasAuthorityNote && appHasAuthorityNote
      ? 'master/app checklist authority note present'
      : 'missing checklist-authority scope note in master and/or app checklist',
  });

  if (thirdAuthority === 'authoritative') {
    const thirdChecklistBody = readUtf8(thirdChecklistPath);
    const checklistExists = Boolean(thirdChecklistBody);
    checks.push({
      id: 'third_checklist_repo_copy_present_when_authoritative',
      pass: checklistExists,
      detail: thirdChecklistPath || 'missing path',
    });

    const itemIds = checklistExists ? extractChecklist3Ids(thirdChecklistBody) : [];
    const mappedItems = scopeMap && scopeMap.items && typeof scopeMap.items === 'object' ? scopeMap.items : {};
    const missingIds = itemIds.filter((id) => !mappedItems[id]);
    const invalidScopeIds = itemIds.filter((id) => {
      const scope = String(mappedItems[id]?.scope || '').trim();
      return !requiredScopeLabels.includes(scope);
    });
    checks.push({
      id: 'third_checklist_item_scope_mapping_complete_when_authoritative',
      pass: checklistExists && missingIds.length === 0 && invalidScopeIds.length === 0,
      detail:
        checklistExists && missingIds.length === 0 && invalidScopeIds.length === 0
          ? `mapped_items=${itemIds.length}`
          : `missing=${missingIds.length}; invalid_scope=${invalidScopeIds.length}`,
    });
  } else {
    checks.push({
      id: 'third_checklist_reference_mode_explicit',
      pass: thirdAuthority === 'reference_only',
      detail: thirdAuthority || 'missing authority',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null,
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Third Checklist Integration Check',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
