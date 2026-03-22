#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'release-ops-prep-latest.json');
const outMd = path.join(outDir, 'release-ops-prep-latest.md');
const outPs1 = path.join(outDir, 'release-ops-next-steps.ps1');
const checklistPath = path.join(root, 'docs', 'parity', 'Sven_Parity_Checklist.md');
const soakSummaryPath = path.join(root, 'docs', 'release', 'status', 'soak-72h-summary.json');
const soakEventsPath = path.join(root, 'docs', 'release', 'status', 'soak-72h-events.jsonl');
const multiDeviceValidationSummaryPath = path.join(root, 'docs', 'release', 'status', 'multi-device-validation-latest.json');
const mirrorAgentHostValidationSummaryPath = path.join(root, 'docs', 'release', 'status', 'mirror-agent-host-validation-latest.json');
const defaultApiUrl = String(
  process.env.API_URL
  || process.env.SVEN_APP_HOST
  || 'https://app.sven.systems:44747',
).replace(/\/+$/, '');

function readJsonIfExists(fullPath) {
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function runNodeScript(relPath) {
  const fullPath = path.join(root, relPath);
  const output = execFileSync(process.execPath, [fullPath], {
    cwd: root,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

function extractUncheckedChecklistItems(strictProfile = 'production-cutover') {
  if (!fs.existsSync(checklistPath)) return [];
  const checklistWaiverMatchersByProfile = {
    'android-mobile-rc': [
      /week 4 target:/i,
      /post-release verification checklist completed/i,
    ],
  };
  const checklistWaiverMatchers = checklistWaiverMatchersByProfile[String(strictProfile || '').trim().toLowerCase()] || [];
  const normalizedChecklist = fs.readFileSync(checklistPath, 'utf8').replace(/\r/g, '\n');
  const lines = normalizedChecklist.split(/\n/);
  return lines
    .map((line, index) => ({ line, line_number: index + 1 }))
    .filter(({ line_number, line }) => line_number >= 895 && /^\s*-\s*\[\s\]\s+/.test(line))
    .filter(({ line }) => !checklistWaiverMatchers.some((matcher) => matcher.test(line)))
    .map(({ line, line_number }) => ({
      line_number,
      path: `docs/parity/Sven_Parity_Checklist.md:${line_number}`,
      text: line.replace(/^\s*-\s*\[\s\]\s+/, '').trim(),
    }));
}

function readJsonlEvents(fullPath) {
  if (!fs.existsSync(fullPath)) return [];
  return fs.readFileSync(fullPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildSoakView(soakSummary, latestStatus) {
  const events = readJsonlEvents(soakEventsPath);
  const currentApiUrl = soakSummary?.api_url || latestStatus?.soak_72h?.api_url || null;
  const relevantEvents = currentApiUrl
    ? events.filter((event) => String(event.api_url || '') === String(currentApiUrl))
    : events;
  const eventSamples = relevantEvents.length;
  const eventFailures = relevantEvents.filter((event) => String(event.status || '').toLowerCase() === 'fail').length;
  const lastEvent = relevantEvents.length > 0 ? relevantEvents[relevantEvents.length - 1] : null;
  const status = soakSummary?.status || latestStatus?.soak_72h?.summary_status || null;
  const isLive = String(status || '').toLowerCase() === 'running';

  return {
    status,
    started_at: soakSummary?.started_at || null,
    expected_end_at: soakSummary?.expected_end_at || null,
    finished_at: soakSummary?.finished_at || null,
    samples: isLive ? eventSamples : (soakSummary?.samples ?? eventSamples ?? null),
    failures: isLive ? eventFailures : (soakSummary?.failures ?? eventFailures ?? null),
    last_event: lastEvent,
    artifact_paths: [
      { label: 'soak summary', path: 'docs/release/status/soak-72h-summary.json' },
      { label: 'soak events', path: 'docs/release/status/soak-72h-events.jsonl' },
      { label: 'soak log', path: 'docs/release/status/soak-72h.log' },
      { label: 'soak gateway log', path: 'docs/release/status/soak-gateway.log' },
    ],
    commands: [
      { step: 'status', command: 'npm run release:soak:status' },
      { step: 'watch_refresh_status', command: 'npm run ops:release:watch-soak-refresh-status' },
      { step: 'watch_and_finalize', command: 'npm run ops:release:watch-soak-and-finalize' },
      { step: 'finalize', command: 'npm run release:soak:finalize' },
      { step: 'restart', command: 'npm run release:soak:restart' },
      { step: 'promote', command: 'npm run release:soak:promote' },
    ],
  };
}

function buildNextSteps({ soak, mobile, signoff, checklist, rollout, multi_device, strict_profile_applied }) {
  const steps = [];

  const soakStatus = String(soak?.status || '').toLowerCase();
  if (soakStatus === 'fail') {
    steps.push('Decide whether to restart soak or accept the failed soak evidence.');
    steps.push('If restarting, run npm run release:soak:restart.');
  } else if (soakStatus === 'running') {
    steps.push('Let soak continue until it reaches a terminal pass/fail result.');
    steps.push('Use npm run release:soak:status to monitor progress while the other evidence lanes are refreshed.');
    steps.push('Run npm run ops:release:watch-soak-refresh-status to continuously refresh latest.json and release prep artifacts during soak.');
    steps.push('Or run npm run ops:release:watch-soak-and-finalize to auto-finalize immediately when soak reaches pass.');
  } else if (soakStatus && soakStatus !== 'pass') {
    steps.push('Resolve the soak blocker first using the soak commands listed below.');
  }

  if (String(rollout?.status || '').toLowerCase() !== 'pass') {
    steps.push('Refresh release rollout execution evidence using the rollout commands listed below.');
  }
  const enforceMirrorHostValidation = String(strict_profile_applied || '').toLowerCase() !== 'android-mobile-rc';
  if (enforceMirrorHostValidation && String(rollout?.mirror_agent_host_validation?.status || '').toLowerCase() !== 'pass') {
    steps.push('Complete mirror-agent host validation evidence (Linux/Windows/macOS install + pairing heartbeat), then finalize host validation.');
  }

  if (String(mobile?.readiness_status || '').toLowerCase() !== 'pass') {
    steps.push('Run the emitted mobile evidence refresh commands.');
  }

  if (String(signoff?.final_signoff_status || '').toLowerCase() !== 'pass') {
    steps.push('Run the emitted signoff commands with real approver names after evidence review.');
  }

  if (Array.isArray(checklist?.unchecked_items) && checklist.unchecked_items.length > 0) {
    steps.push('Close the remaining checklist rows after soak, mobile evidence, and signoff are complete.');
  }

  if (String(multi_device?.summary?.overall || '').toLowerCase() !== 'pass') {
    steps.push('Run multi-device validation evidence finalize in strict mode after completing relay/policy checks.');
  }

  steps.push('Rerun npm run release:status -- --strict after the blocking lanes above are complete.');
  return steps;
}

function renderMarkdown(summary) {
  const lines = [
    '# Release Ops Prep',
    '',
    `- Generated at: ${summary.generated_at}`,
    `- Release ID: ${summary.release_id || '(missing)'}`,
    `- Head SHA: ${summary.head_sha || '(missing)'}`,
    `- Artifact manifest hash: ${summary.artifact_manifest_hash || '(missing)'}`,
    '',
    '## Execution Model',
    '',
    '- Soak commands can run without mobile or signoff placeholders.',
    '- Mobile define-file and mobile evidence sections validate only mobile inputs.',
    '- Signoff regeneration validates only signoff approver inputs.',
    '',
    '## Artifacts',
    '',
    ...((summary.artifacts?.status_files || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.artifacts?.selected_signoff_docs || []).map((artifact) => `- signoff/${artifact.role}: ${artifact.path || '(missing)'}`)),
    '',
    '## Overall',
    '',
    `- Checklist unchecked count: ${summary.latest_status?.checklist?.unchecked_count ?? '(missing)'}`,
    `- Soak status: ${summary.latest_status?.soak_72h?.summary_status ?? '(missing)'}`,
    `- Mobile readiness: ${summary.mobile?.readiness_status ?? '(missing)'}`,
    `- Final signoff: ${summary.signoff?.final_signoff_status ?? '(missing)'}`,
    `- Release rollout: ${summary.rollout?.status ?? '(missing)'}`,
    `- Mirror-agent host validation: ${summary.rollout?.mirror_agent_host_validation?.status ?? '(missing)'}`,
    `- Multi-device validation: ${summary.multi_device?.summary?.overall ?? '(missing)'}`,
    '',
    '## Checklist',
    '',
    ...((summary.checklist?.unchecked_items || []).map((item) => `- ${item.path}: ${item.text}`)),
    '',
    '## Soak',
    '',
    `- Status: ${summary.soak?.status ?? '(missing)'}`,
    `- Started at: ${summary.soak?.started_at ?? '(missing)'}`,
    `- Expected end at: ${summary.soak?.expected_end_at ?? '(missing)'}`,
    `- Samples: ${summary.soak?.samples ?? '(missing)'}`,
    `- Failures: ${summary.soak?.failures ?? '(missing)'}`,
    ...((summary.soak?.artifact_paths || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.soak?.commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    '',
    '## Release Rollout',
    '',
    `- Status: ${summary.rollout?.status ?? '(missing)'}`,
    `- Mirror-agent host validation: ${summary.rollout?.mirror_agent_host_validation?.status ?? '(missing)'}`,
    `- Selected execution evidence: ${summary.rollout?.selected_execution_evidence ?? '(missing)'}`,
    ...((summary.rollout?.blockers || []).map((blocker) => `- ${blocker.id}: ${blocker.detail}`)),
    ...((summary.rollout?.artifact_paths || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.rollout?.mirror_agent_host_validation?.artifact_paths || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.rollout?.source_materials || []).map((item) => `- source: ${item}`)),
    ...(summary.rollout?.validation_commands?.length ? [
      '- rollout validation prerequisites:',
      ...summary.rollout.validation_commands.map((command) => `  - ${command.step}: ${command.command}`),
    ] : []),
    ...(summary.rollout?.observed_phase_evidence?.length
      ? summary.rollout.observed_phase_evidence.map((item) => `- observed phase evidence: ${item}`)
      : ['- observed phase evidence: (none found; only templates are present)']),
    ...((summary.rollout?.commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    ...((summary.rollout?.mirror_agent_host_validation?.commands || []).map((command) => `- mirror_host_${command.step}: ${command.command}`)),
    '',
    '## Mobile',
    '',
    ...((summary.mobile?.blockers || []).map((blocker) => `- ${blocker.id}: ${blocker.detail}`)),
    ...(summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe ? [
      '',
      '### Mobile TLS Probe',
      '',
      `- Status: ${summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.status ?? '(missing)'}`,
      `- Host: ${summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.host ?? '(missing)'}`,
      `- Subject: ${summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.subject ?? '(missing)'}`,
      `- Issuer: ${summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.issuer ?? '(missing)'}`,
      `- Fingerprint SHA-256: ${summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.fingerprint_sha256 ?? '(missing)'}`,
      `- Authorization error: ${summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.authorization_error ?? '(none)'}`,
      `- Suspicious: ${String(summary.mobile.firebase_tls_define_hints.repo_observed.tls_probe.suspicious ?? false)}`,
    ] : []),
    ...(summary.mobile?.perf_capture_hint ? [
      '',
      '### Mobile Perf Capture',
      '',
      `- Status: ${summary.mobile.perf_capture_hint.status}`,
      `- Frames total: ${summary.mobile.perf_capture_hint.frames_total}`,
      `- Detail: ${summary.mobile.perf_capture_hint.detail}`,
      `- Operator note: ${summary.mobile.perf_capture_hint.operator_note}`,
    ] : []),
    ...(summary.mobile?.define_file_mutation ? [
      '',
      '### Mobile Define File',
      '',
      `- Target file: ${summary.mobile.define_file_mutation.target_file}`,
      `- Backup file: ${summary.mobile.define_file_mutation.backup_file}`,
      `- Rollback command: ${summary.mobile.define_file_mutation.rollback_command}`,
    ] : []),
    ...(summary.mobile?.source_materials?.length ? [
      '',
      '### Mobile Source Materials',
      '',
      ...summary.mobile.source_materials.map((item) => `- source: ${item.label}: ${item.path}`),
    ] : []),
    ...(summary.mobile?.input_mapping?.length ? [
      '',
      '### Mobile Input Mapping',
      '',
      ...summary.mobile.input_mapping.map((item) => `- ${item.blocker_id}: ${item.resolve_with}${item.handoff_input ? ` [inputs: ${item.handoff_input.join(', ')}]` : ''}${item.command_step ? ` [step: ${item.command_step}]` : ''}`),
    ] : []),
    '',
    '### Mobile Commands',
    '',
    ...((summary.mobile?.commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    '',
    '## Multi-device Validation',
    '',
    `- Overall: ${summary.multi_device?.summary?.overall ?? '(missing)'}`,
    `- relay_deterministic: ${summary.multi_device?.summary?.relay_deterministic ?? '(missing)'}`,
    `- relay_alias: ${summary.multi_device?.summary?.relay_alias ?? '(missing)'}`,
    `- natural_phrase: ${summary.multi_device?.summary?.natural_phrase ?? '(missing)'}`,
    `- fail_closed_behavior: ${summary.multi_device?.summary?.fail_closed_behavior ?? '(missing)'}`,
    `- desktop_policy_enforcement: ${summary.multi_device?.summary?.desktop_policy_enforcement ?? '(missing)'}`,
    ...((summary.multi_device?.artifact_paths || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.multi_device?.commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    '',
    '## Signoff',
    '',
    ...((summary.signoff?.artifact_paths || []).map((artifact) => `- ${artifact.label}: ${artifact.path}`)),
    ...((summary.signoff?.final_signoff_role_summary || []).flatMap((role) => {
      const header = `- ${role.role}: ${role.selected_doc || '(no selected doc)'}`;
      const failures = (role.failing_checks || []).map((check) => `  - ${check.id}: ${check.detail}`);
      return [header, ...failures];
    })),
    '',
    '### Signoff Commands',
    '',
    ...((summary.signoff?.commands || []).map((command) => `- ${command.role}: ${command.command}`)),
    '',
    '## Next Steps',
    '',
    ...((summary.next_steps || []).map((step) => `- ${step}`)),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderPs1(summary) {
  const replacePlaceholders = (command, replacements) => {
    let result = command;
    for (const [needle, replacement] of replacements) {
      result = result.replaceAll(needle, replacement);
    }
    return result;
  };

  const mobileCommands = (summary.mobile?.commands || []).map((command) => {
    const replacements = [
      ['<branch>', '$Branch'],
      ['<sha>', '$TargetSha'],
      ['<ios-build-ref>', '$IosBuildRef'],
      ['<android-build-ref>', '$AndroidBuildRef'],
      ['<alias>', '$AndroidSigningAlias'],
      ['<path-to-aab-or-apk>', '$AndroidArtifactPath'],
      ['<command>', '$VerificationCommand'],
      ['<summary>', '$VerificationSummary'],
      ['<identity>', '$IosSigningIdentity'],
      ['<profile>', '$IosProvisioningProfile'],
      ['<path-to-ipa>', '$IosArtifactPath'],
      ['<name>', '$ApproverName'],
      ['<pct>', '$MetricPercent'],
      ['<count>', '$SampleSizeSessions'],
      ['<firebase-console-or-monitoring-source>', '$MetricSource'],
    ];
    return {
      ...command,
      command: replacePlaceholders(command.command, replacements),
    };
  });

  const signoffCommands = (summary.signoff?.commands || []).map((command) => {
    const approverVarByRole = {
      engineering: '$EngineeringApprover',
      security: '$SecurityApprover',
      operations: '$OperationsApprover',
      product: '$ProductApprover',
      release_owner: '$ReleaseOwnerApprover',
    };
    return {
      ...command,
      command: replacePlaceholders(command.command, [['<name>', approverVarByRole[command.role] || '$ApproverName']]),
    };
  });

  const lines = [
    '# Release ops next steps generated by scripts/release-ops-prep.cjs',
    `$releaseId = '${summary.release_id || ''}'`,
    `$headSha = '${summary.head_sha || ''}'`,
    `$artifactManifestHash = '${summary.artifact_manifest_hash || ''}'`,
    '',
    '# Section-scoped validation',
    '# - soak commands can run without mobile or signoff placeholders',
    '# - mobile define-file and mobile evidence sections validate only mobile inputs',
    '# - signoff regeneration validates only signoff approver inputs',
    '',
    '# Current blocker summary',
    `# - soak_status: ${summary.soak?.status ?? '(missing)'}`,
    `# - mobile_readiness: ${summary.mobile?.readiness_status ?? '(missing)'}`,
    `# - final_signoff: ${summary.signoff?.final_signoff_status ?? '(missing)'}`,
    `# - release_rollout: ${summary.rollout?.status ?? '(missing)'}`,
    `# - mirror_agent_host_validation: ${summary.rollout?.mirror_agent_host_validation?.status ?? '(missing)'}`,
    `# - multi_device_validation: ${summary.multi_device?.summary?.overall ?? '(missing)'}`,
    `# - checklist_unchecked_count: ${summary.latest_status?.checklist?.unchecked_count ?? '(missing)'}`,
    '',
    '# Remaining checklist rows',
    ...((summary.checklist?.unchecked_items || []).map((item) => `# - ${item.path}: ${item.text}`)),
    '',
    '# Mobile blockers',
    ...((summary.mobile?.blockers || []).map((blocker) => `# - ${blocker.id}: ${blocker.detail}`)),
    '',
    '# Mobile TLS probe',
    `# - status: ${summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.status ?? '(missing)'}`,
    `# - host: ${summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.host ?? '(missing)'}`,
    `# - subject: ${summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.subject ?? '(missing)'}`,
    `# - issuer: ${summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.issuer ?? '(missing)'}`,
    `# - fingerprint_sha256: ${summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.fingerprint_sha256 ?? '(missing)'}`,
    `# - authorization_error: ${summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.authorization_error ?? '(none)'}`,
    `# - suspicious: ${String(summary.mobile?.firebase_tls_define_hints?.repo_observed?.tls_probe?.suspicious ?? false)}`,
    '',
    '# Mobile perf capture',
    `# - status: ${summary.mobile?.perf_capture_hint?.status ?? '(none)'}`,
    `# - frames_total: ${summary.mobile?.perf_capture_hint?.frames_total ?? '(missing)'}`,
    `# - detail: ${summary.mobile?.perf_capture_hint?.detail ?? '(none)'}`,
    `# - operator_note: ${summary.mobile?.perf_capture_hint?.operator_note ?? '(none)'}`,
    '',
    '# Missing mobile define values',
    ...((summary.mobile?.firebase_tls_define_hints?.missing_values || []).map((item) => `# - ${item.id}: ${item.detail}`)),
    '',
    '# Mobile source materials',
    ...((summary.mobile?.source_materials || []).map((item) => `# - ${item.label}: ${item.path}`)),
    '',
    '# Mobile input mapping',
    ...((summary.mobile?.input_mapping || []).map((item) => `# - ${item.blocker_id}: ${item.resolve_with}${item.handoff_input ? ` [inputs: ${item.handoff_input.join(', ')}]` : ''}${item.command_step ? ` [step: ${item.command_step}]` : ''}`)),
    '',
    '# Multi-device validation',
    `# - overall: ${summary.multi_device?.summary?.overall ?? '(missing)'}`,
    `# - relay_deterministic: ${summary.multi_device?.summary?.relay_deterministic ?? '(missing)'}`,
    `# - relay_alias: ${summary.multi_device?.summary?.relay_alias ?? '(missing)'}`,
    `# - natural_phrase: ${summary.multi_device?.summary?.natural_phrase ?? '(missing)'}`,
    `# - fail_closed_behavior: ${summary.multi_device?.summary?.fail_closed_behavior ?? '(missing)'}`,
    `# - desktop_policy_enforcement: ${summary.multi_device?.summary?.desktop_policy_enforcement ?? '(missing)'}`,
    ...((summary.multi_device?.artifact_paths || []).map((artifact) => `# - ${artifact.label}: ${artifact.path}`)),
    '',
    '# Signoff docs currently selected',
    ...((summary.signoff?.final_signoff_role_summary || []).map((role) => `# - ${role.role}: ${role.selected_doc || '(missing)'}`)),
    '',
    '# Signoff artifact paths',
    ...((summary.signoff?.artifact_paths || []).map((artifact) => `# - ${artifact.label}: ${artifact.path}`)),
    '',
    '# Signoff failing checks',
    ...((summary.signoff?.final_signoff_role_summary || []).flatMap((role) => [
      `# - ${role.role}:`,
      ...((role.failing_checks || []).map((check) => `#   - ${check.id}: ${check.detail}`)),
    ])),
    '',
    '# Release rollout blockers',
    ...((summary.rollout?.blockers || []).map((blocker) => `# - ${blocker.id}: ${blocker.detail}`)),
    ...((summary.rollout?.mirror_agent_host_validation?.blockers || []).map((blocker) => `# - ${blocker.id}: ${blocker.detail}`)),
    `# - selected_execution_evidence: ${summary.rollout?.selected_execution_evidence || '(missing)'}`,
    '# - rollout_prep_json: docs/release/status/release-rollout-prep-latest.json',
    '# - rollout_prep_markdown: docs/release/status/release-rollout-prep-latest.md',
    ...((summary.rollout?.source_materials || []).map((item) => `# - rollout_source: ${item}`)),
    ...((summary.rollout?.mirror_agent_host_validation?.artifact_paths || []).map((item) => `# - mirror_host_artifact: ${item.path}`)),
    ...((summary.rollout?.validation_commands || []).map((command) => `# - rollout_validation_${command.step}: ${command.command}`)),
    ...((summary.rollout?.mirror_agent_host_validation?.commands || []).map((command) => `# - mirror_host_${command.step}: ${command.command}`)),
    ...(summary.rollout?.observed_phase_evidence?.length
      ? summary.rollout.observed_phase_evidence.map((item) => `# - rollout_observed_phase_evidence: ${item}`)
      : ['# - rollout_observed_phase_evidence: (none found; only templates are present)']),
    '',
    '# Fill these placeholders before running the commands below.',
    "$Branch = '<branch>'",
    `$TargetSha = '${summary.head_sha || '<sha>'}'`,
    "$IosBuildRef = '<ios-build-ref>'",
    `$AndroidBuildRef = '${summary.mobile?.firebase_tls_define_hints?.repo_observed?.android_google_services?.android_app_id || '<android-build-ref>'}'`,
    "$AndroidSigningAlias = '<alias>'",
    "$AndroidArtifactPath = '<path-to-aab-or-apk>'",
    "$IosSigningIdentity = '<identity>'",
    "$IosProvisioningProfile = '<profile>'",
    "$IosArtifactPath = '<path-to-ipa>'",
    "$AndroidVerificationCommand = '<android-verify-command>'",
    "$AndroidVerificationSummary = '<android-verify-summary>'",
    "$IosVerificationCommand = '<ios-verify-command>'",
    "$IosVerificationSummary = '<ios-verify-summary>'",
    "$CrashFreeSessionsPct = '<crash-free-pct>'",
    "$AnrFreeSessionsPct = '<anr-free-pct>'",
    "$SampleSizeSessions = '<count>'",
    "$MetricSource = '<firebase-console-or-monitoring-source>'",
    "$ApiCertSha256Pins = '<sha256-pin-1,sha256-pin-2>'",
    "$FirebaseIosAppId = '<ios-prod-app-id>'",
    "$FirebaseWebAppId = '<web-app-id>'",
    "$ApproverName = '<name>'",
    "$MobileEngineeringApprover = '<mobile-engineering-approver>'",
    "$MobileSecurityApprover = '<mobile-security-approver>'",
    "$MobileReleaseOwnerApprover = '<mobile-release-owner-approver>'",
    "$EngineeringApprover = '<engineering-approver>'",
    "$SecurityApprover = '<security-approver>'",
    "$OperationsApprover = '<operations-approver>'",
    "$ProductApprover = '<product-approver>'",
    "$ReleaseOwnerApprover = '<release-owner-approver>'",
    "$RolloutRunId = '<rollout-run-id>'",
    `$RolloutApiUrl = '${summary.rollout?.target_probe?.api_url || defaultApiUrl}'`,
    "$RolloutAdminUsername = '<rollout-admin-username>'",
    "$RolloutAdminPassword = '<rollout-admin-password>'",
    "$RolloutAdminTotpCode = ''",
    '$RolloutPerfDurationSeconds = 8',
    '$RolloutPerfConcurrency = 8',
    "$RolloutImmutableLogUri = 'docs/release/evidence/release-rollout-immutable-log-latest.txt'",
    "$MirrorHostEvidenceFile = ''",
    "$MirrorHostOperator = '<name/email>'",
    "$MirrorHostEnvironment = 'prod'",
    "$MirrorHostRelease = '<tag-or-sha>'",
    `$FirebaseIosBundleId = '${summary.mobile?.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_BUNDLE_ID || ''}'`,
    `$FirebaseIosApiKey = '${summary.mobile?.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_API_KEY || ''}'`,
    `$FirebaseWebApiKey = '${summary.mobile?.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_WEB_API_KEY || ''}'`,
    "$MobileDefineFile = 'config/env/mobile-dart-defines.release.local.json'",
    "$MobileDefineBackupFile = \"$MobileDefineFile.bak\"",
    "$MultiDeviceEvidenceFile = ''",
    '',
    'function Assert-NoPlaceholder([string]$Name, [string]$Value) {',
    "  if ($null -eq $Value -or $Value -match '^<.+>$') {",
    '    throw \"Unresolved placeholder for $Name: $Value\"',
    '  }',
    '}',
    '',
    'function Assert-NoPlaceholderIfPresent([string]$Name, [string]$Value) {',
    "  if ($null -ne $Value -and $Value -ne '' -and $Value -match '^<.+>$') {",
    '    throw \"Unresolved placeholder for $Name: $Value\"',
    '  }',
    '}',
    '',
    'function Assert-MobileDefineInputs() {',
    "  Assert-NoPlaceholder 'ApiCertSha256Pins' $ApiCertSha256Pins",
    "  Assert-NoPlaceholder 'FirebaseIosAppId' $FirebaseIosAppId",
    "  Assert-NoPlaceholder 'FirebaseWebAppId' $FirebaseWebAppId",
    '}',
    '',
    'function Assert-MobileEvidenceInputs() {',
    '  Assert-MobileDefineInputs',
    "  Assert-NoPlaceholder 'Branch' $Branch",
    "  Assert-NoPlaceholder 'TargetSha' $TargetSha",
    "  Assert-NoPlaceholder 'IosBuildRef' $IosBuildRef",
    "  Assert-NoPlaceholder 'AndroidBuildRef' $AndroidBuildRef",
    "  Assert-NoPlaceholder 'AndroidSigningAlias' $AndroidSigningAlias",
    "  Assert-NoPlaceholder 'AndroidArtifactPath' $AndroidArtifactPath",
    "  Assert-NoPlaceholder 'IosSigningIdentity' $IosSigningIdentity",
    "  Assert-NoPlaceholder 'IosProvisioningProfile' $IosProvisioningProfile",
    "  Assert-NoPlaceholder 'IosArtifactPath' $IosArtifactPath",
    "  Assert-NoPlaceholder 'AndroidVerificationCommand' $AndroidVerificationCommand",
    "  Assert-NoPlaceholder 'AndroidVerificationSummary' $AndroidVerificationSummary",
    "  Assert-NoPlaceholder 'IosVerificationCommand' $IosVerificationCommand",
    "  Assert-NoPlaceholder 'IosVerificationSummary' $IosVerificationSummary",
    "  Assert-NoPlaceholder 'CrashFreeSessionsPct' $CrashFreeSessionsPct",
    "  Assert-NoPlaceholder 'AnrFreeSessionsPct' $AnrFreeSessionsPct",
    "  Assert-NoPlaceholder 'SampleSizeSessions' $SampleSizeSessions",
    "  Assert-NoPlaceholder 'MetricSource' $MetricSource",
    "  Assert-NoPlaceholder 'MobileEngineeringApprover' $MobileEngineeringApprover",
    "  Assert-NoPlaceholder 'MobileSecurityApprover' $MobileSecurityApprover",
    "  Assert-NoPlaceholder 'MobileReleaseOwnerApprover' $MobileReleaseOwnerApprover",
    '}',
    '',
    'function Assert-RolloutInputs() {',
    "  Assert-NoPlaceholder 'RolloutRunId' $RolloutRunId",
    "  Assert-NoPlaceholder 'RolloutApiUrl' $RolloutApiUrl",
    "  Assert-NoPlaceholder 'RolloutAdminUsername' $RolloutAdminUsername",
    "  Assert-NoPlaceholder 'RolloutAdminPassword' $RolloutAdminPassword",
    "  Assert-NoPlaceholderIfPresent 'RolloutAdminTotpCode' $RolloutAdminTotpCode",
    "  Assert-NoPlaceholder 'RolloutImmutableLogUri' $RolloutImmutableLogUri",
    '}',
    '',
    'function Assert-SignoffInputs() {',
    "  Assert-NoPlaceholder 'EngineeringApprover' $EngineeringApprover",
    "  Assert-NoPlaceholder 'SecurityApprover' $SecurityApprover",
    "  Assert-NoPlaceholder 'OperationsApprover' $OperationsApprover",
    "  Assert-NoPlaceholder 'ProductApprover' $ProductApprover",
    "  Assert-NoPlaceholder 'ReleaseOwnerApprover' $ReleaseOwnerApprover",
    '}',
    '',
    '# Repo-observed values already available for reuse',
    'Write-Host "Known iOS bundle id: $FirebaseIosBundleId"',
    'Write-Host "Known iOS API key: $FirebaseIosApiKey"',
    'Write-Host "Known web API key: $FirebaseWebApiKey"',
    'Write-Host "Mobile define rollback: Copy-Item -Force $MobileDefineBackupFile $MobileDefineFile"',
    'Write-Host "Multi-device strict finalize: npm run ops:release:multi-device:evidence:finalize -- -Strict"',
    '',
    'Write-Host "Release ops handoff"',
    'Write-Host "Release ID: $releaseId"',
    'Write-Host "Head SHA: $headSha"',
    'Write-Host "Artifact Manifest Hash: $artifactManifestHash"',
    '',
    '# 1. Resolve soak state first.',
  ];

  for (const command of summary.soak?.commands || []) {
    lines.push(`# ${command.step}`);
    lines.push(command.command);
    lines.push('');
  }

  lines.push('# 2. Run release rollout Phase 0 validation.');
  lines.push('Assert-RolloutInputs');
  for (const command of summary.rollout?.validation_commands || []) {
    lines.push(`# ${command.step}`);
    let rendered = command.command
      .replaceAll('$env:API_URL = $ApiUrl', '$env:API_URL = $RolloutApiUrl')
      .replaceAll('$ApiUrl', '$RolloutApiUrl')
      .replaceAll(defaultApiUrl, '$RolloutApiUrl')
      .replaceAll('<admin-username>', '$RolloutAdminUsername')
      .replaceAll('<admin-password>', '$RolloutAdminPassword')
      .replaceAll('<admin-totp-code>', '$RolloutAdminTotpCode')
      .replaceAll(' -DurationSeconds 8', ' -DurationSeconds $RolloutPerfDurationSeconds')
      .replaceAll(' -Concurrency 8', ' -Concurrency $RolloutPerfConcurrency');
    lines.push(rendered);
    lines.push('');
  }

  lines.push('# 3. Refresh release rollout evidence.');
  for (const command of summary.rollout?.commands || []) {
    lines.push(`# ${command.step}`);
    let rendered = command.command
      .replaceAll(String(summary.rollout?.execution_evidence_defaults?.run_id || ''), '$RolloutRunId')
      .replaceAll(String(summary.rollout?.execution_evidence_defaults?.head_sha || ''), '$TargetSha')
      .replaceAll('docs/release/evidence/release-rollout-immutable-log-latest.txt', '$RolloutImmutableLogUri');
    lines.push(rendered);
    lines.push('');
  }

  lines.push('# 3b. Refresh mirror-agent host validation evidence.');
  for (const command of summary.rollout?.mirror_agent_host_validation?.commands || []) {
    lines.push(`# mirror_host_${command.step}`);
    let rendered = command.command;
    if (command.step === 'init_evidence') {
      rendered = rendered
        .replaceAll('<name/email>', '$MirrorHostOperator')
        .replaceAll('"prod"', '$MirrorHostEnvironment')
        .replaceAll('<tag-or-sha>', '$MirrorHostRelease');
    }
    if (command.step === 'append_check') {
      rendered = rendered
        .replaceAll('<linux-host>', '$env:COMPUTERNAME')
        .replaceAll('<service-name>', 'sven-mirror-agent')
        .replaceAll('<heartbeat-id>', 'hb-local')
        .replaceAll('<name/email>', '$MirrorHostOperator')
        .replaceAll('<windows-host>', '$env:COMPUTERNAME')
        .replaceAll('<startup-path>', '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\sven-mirror-agent.lnk')
        .replaceAll('<mac-host>', 'mac-host')
        .replaceAll('<launchd-label>', 'online.matrix47.sven.mirror-agent')
        .replaceAll('<host-or-device>', '$env:COMPUTERNAME')
        .replaceAll('<pairing-id>', 'pair-local')
        .replaceAll('<heartbeat-latency-ms>', '200');
    }
    if (command.step === 'finalize') {
      rendered = rendered.replaceAll('"<optional-path-to-run-file>"', '$MirrorHostEvidenceFile');
    }
    if (command.step === 'finalize_strict') {
      rendered = rendered.replaceAll('"<optional-path-to-run-file>"', '$MirrorHostEvidenceFile');
    }
    lines.push(rendered);
    lines.push('');
  }

  lines.push('# 4. Populate missing mobile define values.');
  lines.push('Assert-MobileDefineInputs');
  lines.push('$mobileDefines = @{}');
  lines.push('if (Test-Path $MobileDefineFile) {');
  lines.push("  $mobileDefines = Get-Content $MobileDefineFile -Raw | ConvertFrom-Json -AsHashtable");
  lines.push('  Copy-Item -Force $MobileDefineFile $MobileDefineBackupFile');
  lines.push('  Write-Host "Backed up mobile define file: $MobileDefineBackupFile"');
  lines.push('}');
  lines.push("$mobileDefines['SVEN_API_CERT_SHA256_PINS'] = $ApiCertSha256Pins");
  lines.push("$mobileDefines['SVEN_FIREBASE_IOS_PROD_APP_ID'] = $FirebaseIosAppId");
  lines.push("$mobileDefines['SVEN_FIREBASE_WEB_APP_ID'] = $FirebaseWebAppId");
  lines.push("if (-not $mobileDefines.ContainsKey('SVEN_FIREBASE_IOS_PROD_BUNDLE_ID') -and $FirebaseIosBundleId) { $mobileDefines['SVEN_FIREBASE_IOS_PROD_BUNDLE_ID'] = $FirebaseIosBundleId }");
  lines.push("if (-not $mobileDefines.ContainsKey('SVEN_FIREBASE_IOS_PROD_API_KEY') -and $FirebaseIosApiKey) { $mobileDefines['SVEN_FIREBASE_IOS_PROD_API_KEY'] = $FirebaseIosApiKey }");
  lines.push("if (-not $mobileDefines.ContainsKey('SVEN_FIREBASE_WEB_API_KEY') -and $FirebaseWebApiKey) { $mobileDefines['SVEN_FIREBASE_WEB_API_KEY'] = $FirebaseWebApiKey }");
  lines.push('$mobileDefines | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $MobileDefineFile');
  lines.push('Write-Host "Updated mobile define file: $MobileDefineFile"');
  lines.push('Write-Host "Rollback command: Copy-Item -Force $MobileDefineBackupFile $MobileDefineFile"');
  lines.push('');

  lines.push('# 5. Refresh mobile evidence.');
  lines.push('Assert-MobileEvidenceInputs');
  for (const command of mobileCommands) {
    lines.push(`# ${command.step}`);
    let rendered = command.command;
    if (command.step === 'signing_evidence') {
      rendered = rendered
        .replaceAll('$VerificationCommand', '$AndroidVerificationCommand')
        .replaceAll('$VerificationSummary', '$AndroidVerificationSummary')
        .replace('-IosVerifyCommand $AndroidVerificationCommand', '-IosVerifyCommand $IosVerificationCommand')
        .replace('-IosVerifySummary $AndroidVerificationSummary', '-IosVerifySummary $IosVerificationSummary')
        .replace('-ApproverEngineering $ApproverName', '-ApproverEngineering $MobileEngineeringApprover')
        .replace('-ApproverSecurity $ApproverName', '-ApproverSecurity $MobileSecurityApprover')
        .replace('-ApproverReleaseOwner $ApproverName', '-ApproverReleaseOwner $MobileReleaseOwnerApprover');
    }
    if (command.step === 'crash_anr_evidence') {
      rendered = rendered
        .replaceAll('$MetricPercent', '$CrashFreeSessionsPct')
        .replace('-AnrFreeSessionsPct $CrashFreeSessionsPct', '-AnrFreeSessionsPct $AnrFreeSessionsPct');
    }
    lines.push(rendered);
    lines.push('');
  }

  lines.push('# 6. Regenerate final signoffs with real approver names.');
  lines.push('Assert-SignoffInputs');
  for (const command of signoffCommands) {
    lines.push(`# ${command.role}`);
    lines.push(command.command);
    lines.push('');
  }

  lines.push('# 7. Re-run strict release status.');
  lines.push('npm run release:status -- --strict');
  lines.push('');
  lines.push('# Optional: enforce multi-device strict finalization after matrix completion.');
  lines.push("if ($MultiDeviceEvidenceFile) { npm run ops:release:multi-device:evidence:finalize -- -EvidenceFile $MultiDeviceEvidenceFile -Strict } else { npm run ops:release:multi-device:evidence:finalize -- -Strict }");
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const mobile = runNodeScript(path.join('scripts', 'mobile-release-prep.cjs'));
  const signoff = runNodeScript(path.join('scripts', 'release-signoff-prep.cjs'));
  const rolloutPrep = runNodeScript(path.join('scripts', 'release-rollout-prep.cjs'));
  const soakSummary = readJsonIfExists(soakSummaryPath);
  const multiDeviceValidationSummary = readJsonIfExists(multiDeviceValidationSummaryPath);
  const mirrorAgentHostValidationSummary = readJsonIfExists(mirrorAgentHostValidationSummaryPath);
  const latestStatus = readJsonIfExists(path.join(outDir, 'latest.json')) || signoff.latest_status;
  const strictProfileApplied = String(latestStatus?.strict_policy?.strict_profile_applied || '').trim().toLowerCase() || 'production-cutover';
  const shouldEnforceMirrorAgentHostValidation = strictProfileApplied !== 'android-mobile-rc';
  const uncheckedChecklistItems = extractUncheckedChecklistItems(strictProfileApplied);

  const soak = buildSoakView(soakSummary, latestStatus);
  const mirrorAgentHostValidationStatus = String(
    (mirrorAgentHostValidationSummary?.summary?.overall || mirrorAgentHostValidationSummary?.status || 'unknown')
  ).toLowerCase();
  const mirrorAgentHostValidationBlockers = [];
  if (shouldEnforceMirrorAgentHostValidation && (!mirrorAgentHostValidationSummary || typeof mirrorAgentHostValidationSummary !== 'object')) {
    mirrorAgentHostValidationBlockers.push({
      id: 'mirror_agent_host_validation_missing',
      detail: 'missing docs/release/status/mirror-agent-host-validation-latest.json',
    });
  } else if (shouldEnforceMirrorAgentHostValidation && mirrorAgentHostValidationStatus !== 'pass') {
    mirrorAgentHostValidationBlockers.push({
      id: 'mirror_agent_host_validation_status',
      detail: `mirror-agent host validation status=${mirrorAgentHostValidationStatus} (expected pass)`,
    });
  }

  const rollout = {
    status: rolloutPrep.rollout_status || null,
    blockers: [...(rolloutPrep.rollout_failures || []), ...mirrorAgentHostValidationBlockers],
    artifact_paths: [
      { label: 'release rollout status', path: 'docs/release/status/release-rollout-latest.json' },
      { label: 'release rollout status markdown', path: 'docs/release/status/release-rollout-latest.md' },
      { label: 'release rollout prep json', path: 'docs/release/status/release-rollout-prep-latest.json' },
      { label: 'release rollout prep markdown', path: 'docs/release/status/release-rollout-prep-latest.md' },
      { label: 'release rollout next steps ps1', path: 'docs/release/status/release-rollout-next-steps.ps1' },
      { label: 'release rollout execution evidence', path: 'docs/release/evidence/release-rollout-execution-latest.json' },
    ],
    selected_execution_evidence: rolloutPrep.selected_execution_evidence || null,
    execution_evidence_defaults: rolloutPrep.execution_evidence_defaults || null,
    source_materials: rolloutPrep.source_materials || [],
    validation_commands: rolloutPrep.validation_commands || [],
    observed_phase_evidence: rolloutPrep.observed_phase_evidence || [],
    commands: rolloutPrep.commands || [],
      mirror_agent_host_validation: {
        status: mirrorAgentHostValidationStatus || null,
        enforced_in_profile: shouldEnforceMirrorAgentHostValidation,
        blockers: mirrorAgentHostValidationBlockers,
      artifact_paths: [
        { label: 'mirror-agent host validation latest json', path: 'docs/release/status/mirror-agent-host-validation-latest.json' },
        { label: 'mirror-agent host validation latest markdown', path: 'docs/release/status/mirror-agent-host-validation-latest.md' },
      ],
      commands: [
        { step: 'init_evidence', command: 'npm run ops:release:mirror-agent:evidence:init -- -Operator "<name/email>" -Environment "prod" -Release "<tag-or-sha>"' },
        { step: 'append_check', command: 'npm run ops:release:mirror-agent:evidence:append -- -Check linux_install_service -Status pass -Result "validated on <linux-host>" -Notes "systemctl active for <service-name>; heartbeat=<heartbeat-id>" -Operator "<name/email>"' },
        { step: 'append_check_windows', command: 'npm run ops:release:mirror-agent:evidence:append -- -Check windows_install_startup -Status pass -Result "validated on <windows-host>" -Notes "startup entry present at <startup-path>" -Operator "<name/email>"' },
        { step: 'append_check_macos', command: 'npm run ops:release:mirror-agent:evidence:append -- -Check macos_install_launchd -Status pass -Result "validated on <mac-host>" -Notes "launchctl label <launchd-label> active" -Operator "<name/email>"' },
        { step: 'append_check_pairing', command: 'npm run ops:release:mirror-agent:evidence:append -- -Check pairing_heartbeat -Status pass -Result "pairing + heartbeat validated on <host-or-device>" -Notes "pairing=<pairing-id>; latency_ms=<heartbeat-latency-ms>" -Operator "<name/email>"' },
        { step: 'finalize', command: 'if ($MirrorHostEvidenceFile) { npm run ops:release:mirror-agent:evidence:finalize -- -EvidenceFile $MirrorHostEvidenceFile } else { npm run ops:release:mirror-agent:evidence:finalize }' },
        { step: 'finalize_strict', command: 'if ($MirrorHostEvidenceFile) { npm run ops:release:mirror-agent:evidence:finalize -- -EvidenceFile $MirrorHostEvidenceFile -Strict } else { npm run ops:release:mirror-agent:evidence:finalize -- -Strict }' },
      ],
    },
  };

  const summary = {
      generated_at: new Date().toISOString(),
      release_id: signoff.release_id || null,
      head_sha: signoff.head_sha || null,
      artifact_manifest_hash: signoff.artifact_manifest_hash || null,
      execution_model: {
        soak_requires_mobile_inputs: false,
        soak_requires_signoff_inputs: false,
        mobile_sections_require_mobile_inputs_only: true,
        signoff_sections_require_signoff_inputs_only: true,
      },
      artifacts: {
        status_files: [
        { label: 'strict latest', path: 'docs/release/status/latest.json' },
        { label: 'mobile readiness', path: 'docs/release/status/mobile-release-readiness-latest.json' },
        { label: 'final signoff', path: 'docs/release/status/final-signoff-latest.json' },
        { label: 'release rollout status', path: 'docs/release/status/release-rollout-latest.json' },
        { label: 'release rollout prep json', path: 'docs/release/status/release-rollout-prep-latest.json' },
        { label: 'release rollout prep markdown', path: 'docs/release/status/release-rollout-prep-latest.md' },
        { label: 'release rollout next steps ps1', path: 'docs/release/status/release-rollout-next-steps.ps1' },
        { label: 'mirror-agent host validation latest json', path: 'docs/release/status/mirror-agent-host-validation-latest.json' },
        { label: 'mirror-agent host validation latest markdown', path: 'docs/release/status/mirror-agent-host-validation-latest.md' },
        { label: 'release signoff prep json', path: 'docs/release/status/release-signoff-prep-latest.json' },
        { label: 'release signoff prep markdown', path: 'docs/release/status/release-signoff-prep-latest.md' },
        { label: 'release signoff next steps ps1', path: 'docs/release/status/release-signoff-next-steps.ps1' },
        { label: 'release ops prep json', path: 'docs/release/status/release-ops-prep-latest.json' },
        { label: 'release ops prep markdown', path: 'docs/release/status/release-ops-prep-latest.md' },
        { label: 'release ops next steps ps1', path: 'docs/release/status/release-ops-next-steps.ps1' },
        { label: 'multi-device validation latest json', path: 'docs/release/status/multi-device-validation-latest.json' },
        { label: 'multi-device validation latest markdown', path: 'docs/release/status/multi-device-validation-latest.md' },
      ],
      selected_signoff_docs: (signoff.final_signoff_role_summary || []).map((role) => ({
        role: role.role,
        path: role.selected_doc ? String(role.selected_doc).split(' ')[0] : null,
      })),
    },
    latest_status: latestStatus || null,
    checklist: {
      unchecked_items: uncheckedChecklistItems,
    },
    soak,
    rollout,
    mobile: {
      readiness_status: mobile.readiness_status || null,
      blockers: mobile.blockers || [],
      artifact_ages_hours: mobile.artifact_ages_hours || {},
      perf_capture_hint: mobile.perf_capture_hint || null,
      firebase_tls_define_hints: mobile.firebase_tls_define_hints || null,
      source_materials: mobile.source_materials || [],
      input_mapping: mobile.input_mapping || [],
      define_file_mutation: {
        target_file: 'config/env/mobile-dart-defines.release.local.json',
        backup_file: 'config/env/mobile-dart-defines.release.local.json.bak',
        rollback_command: 'Copy-Item -Force config/env/mobile-dart-defines.release.local.json.bak config/env/mobile-dart-defines.release.local.json',
      },
      commands: mobile.commands || [],
    },
    multi_device: {
      summary: multiDeviceValidationSummary?.summary || null,
      evidence_file: multiDeviceValidationSummary?.evidence_file || null,
      strict: multiDeviceValidationSummary?.strict ?? null,
      artifact_paths: [
        { label: 'multi-device validation summary json', path: 'docs/release/status/multi-device-validation-latest.json' },
        { label: 'multi-device validation summary markdown', path: 'docs/release/status/multi-device-validation-latest.md' },
      ],
      commands: [
        { step: 'init_evidence', command: 'npm run ops:release:multi-device:evidence:init -- -Operator "<name/email>" -Environment "prod" -Release "<tag-or-sha>" -OrganizationId "<org-id>"' },
        { step: 'append_check', command: 'npm run ops:release:multi-device:evidence:append -- -Check deterministic_relay -Status pass -Input "/relay kitchen -> office" -Result "Relay complete" -SnapshotCommandId "<cmd-snap>" -DisplayCommandId "<cmd-disp>"' },
        { step: 'finalize', command: 'npm run ops:release:multi-device:evidence:finalize' },
        { step: 'finalize_strict', command: 'npm run ops:release:multi-device:evidence:finalize -- -Strict' },
      ],
    },
    signoff: {
      final_signoff_status: signoff.final_signoff_status || null,
      expires_at_default: signoff.expires_at_default || null,
      signoff_defaults: signoff.signoff_defaults || null,
      artifact_paths: signoff.artifacts?.status_files || [],
      final_signoff_role_summary: signoff.final_signoff_role_summary || [],
      commands: signoff.commands || [],
    },
  };

  summary.strict_profile_applied = strictProfileApplied;
  summary.next_steps = buildNextSteps(summary);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, renderMarkdown(summary), 'utf8');
  fs.writeFileSync(outPs1, renderPs1(summary), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main();
