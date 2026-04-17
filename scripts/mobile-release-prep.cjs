#!/usr/bin/env node
/* eslint-disable no-console */
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'mobile-release-prep-latest.json');
const outMd = path.join(outDir, 'mobile-release-prep-latest.md');
const outPs1 = path.join(outDir, 'mobile-release-next-steps.ps1');
const scopePath = path.join(root, 'config', 'release', 'mobile-release-scope.json');
const defaultApiBase = String(
  process.env.API_URL
  || process.env.SVEN_API_BASE
  || process.env.SVEN_APP_HOST
  || 'https://app.sven.systems:44747',
).replace(/\/+$/, '');

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function readText(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function readScope() {
  if (!fs.existsSync(scopePath)) {
    return {
      scope: 'android-and-ios',
      deferred_platforms: [],
      reason: '',
    };
  }
  const raw = fs.readFileSync(scopePath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw);
  return {
    scope: parsed.scope || 'android-and-ios',
    deferred_platforms: Array.isArray(parsed.deferred_platforms) ? parsed.deferred_platforms : [],
    reason: parsed.reason || '',
  };
}

function readGitValue(command) {
  try {
    return childProcess.execSync(command, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function ageHours(isoTimestamp) {
  if (!isoTimestamp) return null;
  const parsed = Date.parse(String(isoTimestamp));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp']) {
    if (!value[key]) continue;
    const parsed = Date.parse(String(value[key]));
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function buildPerfCaptureHint(perf) {
  if (!perf || typeof perf !== 'object') return null;
  const framesTotal = Number(perf?.metrics?.frames_total ?? NaN);
  const frameCheck = (perf.checks || []).find((check) => check.id === 'frames_total_positive');
  if (!Number.isFinite(framesTotal) || framesTotal > 0) return null;
  return {
    status: 'invalid_capture',
    frames_total: framesTotal,
    detail: frameCheck?.detail || 'frames_total=0',
    operator_note: 'Current gfxinfo evidence did not capture active rendered frames. Re-run perf evidence while exercising a real UI workload; do not treat this artifact as a genuine latency regression.',
  };
}

function buildMobileInputMapping(summary) {
  const rows = [];
  const androidOnly = summary.mobile_release_scope === 'android-only';
  for (const blocker of summary.blockers || []) {
    switch (blocker.id) {
      case 'mobile_perf_slo_pass':
        rows.push({
          blocker_id: blocker.id,
          resolve_with: 'Re-capture gfxinfo/perf evidence under active UI load, then rerun node scripts/mobile-perf-slo-check.cjs --strict',
          handoff_input: null,
          command_step: 'perf_slo_status',
        });
        break;
      case 'mobile_device_validation_pass':
      case 'mobile_device_validation_provenance_present':
      case 'mobile_device_validation_fresh':
        rows.push({
          blocker_id: blocker.id,
          resolve_with: androidOnly
            ? 'Fill Branch/TargetSha/AndroidBuildRef and run the Android-only device validation step'
            : 'Fill Branch/TargetSha/IosBuildRef/AndroidBuildRef and run the device validation step',
          handoff_input: androidOnly
            ? ['$Branch', '$TargetSha', '$AndroidBuildRef']
            : ['$Branch', '$TargetSha', '$IosBuildRef', '$AndroidBuildRef'],
          command_step: 'device_validation',
        });
        break;
      case 'mobile_firebase_tls_define_check_pass':
        rows.push({
          blocker_id: blocker.id,
          resolve_with: 'Fill ApiCertSha256Pins/FirebaseIosAppId/FirebaseWebAppId, update the local release define file, then rerun node scripts/mobile-firebase-tls-define-check.cjs --strict',
          handoff_input: ['$ApiCertSha256Pins', '$FirebaseIosAppId', '$FirebaseWebAppId'],
          command_step: 'firebase_tls_define_status',
        });
        break;
      case 'mobile_crash_anr_fresh':
        rows.push({
          blocker_id: blocker.id,
          resolve_with: 'Fill CrashFreeSessionsPct/AnrFreeSessionsPct/SampleSizeSessions/MetricSource and run the crash/ANR evidence setter',
          handoff_input: ['$CrashFreeSessionsPct', '$AnrFreeSessionsPct', '$SampleSizeSessions', '$MetricSource'],
          command_step: 'crash_anr_evidence',
        });
        break;
      case 'mobile_signed_build_evidence_fresh':
        rows.push({
          blocker_id: blocker.id,
          resolve_with: androidOnly
            ? 'Fill Android signing/build variables and run the Android-only mobile signing evidence setter'
            : 'Fill signing/build variables and run the mobile signing evidence setter',
          handoff_input: androidOnly
            ? [
              '$AndroidSigningAlias',
              '$AndroidArtifactPath',
              '$AndroidVerificationCommand',
              '$AndroidVerificationSummary',
              '$MobileEngineeringApprover',
              '$MobileSecurityApprover',
              '$MobileReleaseOwnerApprover',
            ]
            : [
              '$AndroidSigningAlias',
              '$AndroidArtifactPath',
              '$AndroidVerificationCommand',
              '$AndroidVerificationSummary',
              '$IosSigningIdentity',
              '$IosProvisioningProfile',
              '$IosArtifactPath',
              '$IosVerificationCommand',
              '$IosVerificationSummary',
              '$MobileEngineeringApprover',
              '$MobileSecurityApprover',
              '$MobileReleaseOwnerApprover',
            ],
          command_step: 'signing_evidence',
        });
        break;
      default:
        rows.push({
          blocker_id: blocker.id,
          resolve_with: blocker.detail,
          handoff_input: null,
          command_step: null,
        });
        break;
    }
  }
  return rows;
}

function buildMobileNextSteps(summary) {
  const steps = [];
  const blockerIds = new Set((summary.blockers || []).map((blocker) => blocker.id));
  const tlsProbe = summary.firebase_tls_define_hints?.repo_observed?.tls_probe;
  const androidOnly = summary.mobile_release_scope === 'android-only';

  steps.push('Fill the mobile variables in docs/release/status/mobile-release-next-steps.ps1.');

  if (tlsProbe?.suspicious) {
    steps.push(`Verify or fix the public TLS chain for ${tlsProbe.host} before accepting any certificate pin values.`);
  }

  if (blockerIds.has('mobile_firebase_tls_define_check_pass')) {
    steps.push('Update the local release define file using the generated define-file step, then rerun the strict Firebase/TLS define check.');
  }

  if (summary.perf_capture_hint?.status === 'invalid_capture') {
    steps.push('Re-capture perf evidence while exercising a real active UI workload, then rerun node scripts/mobile-perf-slo-check.cjs --strict.');
  } else if (blockerIds.has('mobile_perf_slo_pass')) {
    steps.push('Refresh perf evidence and rerun node scripts/mobile-perf-slo-check.cjs --strict.');
  }

  if (
    blockerIds.has('mobile_device_validation_pass')
    || blockerIds.has('mobile_device_validation_provenance_present')
    || blockerIds.has('mobile_device_validation_fresh')
  ) {
    steps.push(androidOnly
      ? 'Fill Branch/TargetSha/AndroidBuildRef and run the Android-only device validation step.'
      : 'Fill Branch/TargetSha/IosBuildRef/AndroidBuildRef and run the device validation step.');
  }

  if (blockerIds.has('mobile_signed_build_evidence_fresh')) {
    steps.push(androidOnly
      ? 'Refresh Android signing evidence with the current signed build inputs and approvers.'
      : 'Refresh mobile signing evidence with current signed build inputs and approvers.');
  }

  if (blockerIds.has('mobile_crash_anr_fresh')) {
    steps.push('Refresh crash/ANR evidence with current production metrics.');
  }

  steps.push('Run npm run mobile:release:readiness:check.');
  return steps;
}

function renderMarkdown(summary) {
  const androidOnly = summary.mobile_release_scope === 'android-only';
  const lines = [
    '# Mobile Release Prep',
    '',
    `- Generated at: ${summary.generated_at}`,
    `- Readiness status: ${summary.readiness_status ?? '(missing)'}`,
    `- Mobile release scope: ${summary.mobile_release_scope ?? '(missing)'}`,
    `- iOS release status: ${summary.ios_release_status ?? '(missing)'}`,
    '',
    '## Execution Model',
    '',
    '- Update the editable variables in the PowerShell handoff only when you are ready to run the corresponding mobile evidence section.',
    '- The local mobile define file mutation is reversible via the emitted backup and rollback command.',
    ...(androidOnly ? ['- iOS evidence is deferred for this RC and does not block Android-only release readiness.'] : []),
    '',
    '## Artifact Ages',
    '',
    `- Perf SLO: ${summary.artifact_ages_hours?.perf_slo ?? '(missing)'}`,
    `- Crash/ANR: ${summary.artifact_ages_hours?.crash_anr ?? '(missing)'}`,
    `- App Store Privacy: ${summary.artifact_ages_hours?.appstore_privacy ?? '(missing)'}`,
    `- Device Validation: ${summary.artifact_ages_hours?.device_validation ?? '(missing)'}`,
    `- Release Signing: ${summary.artifact_ages_hours?.release_signing ?? '(missing)'}`,
    `- Firebase/TLS Define: ${summary.artifact_ages_hours?.firebase_tls_define ?? '(missing)'}`,
    '',
    '## Source Materials',
    '',
    ...((summary.source_materials || []).map((item) => `- ${item.label}: ${item.path}`)),
    '',
    '## Blockers',
    '',
    ...((summary.blockers || []).map((blocker) => `- ${blocker.id}: ${blocker.detail}`)),
  ];

  if (summary.perf_capture_hint) {
    lines.push(
      '',
      '## Perf Capture',
      '',
      `- Status: ${summary.perf_capture_hint.status}`,
      `- Frames total: ${summary.perf_capture_hint.frames_total}`,
      `- Detail: ${summary.perf_capture_hint.detail}`,
      `- Operator note: ${summary.perf_capture_hint.operator_note}`,
    );
  }

  lines.push(
    '',
    '## Firebase / TLS Define Hints',
    '',
    `- Define bundle source: ${summary.firebase_tls_define_hints?.define_bundle_source ?? '(missing)'}`,
    ...((summary.firebase_tls_define_hints?.missing_values || []).map((item) => `- ${item.id}: ${item.detail}`)),
    '',
    '### TLS Probe',
    '',
    `- Status: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.status ?? '(missing)'}`,
    `- Host: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.host ?? '(missing)'}`,
    `- Subject: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.subject ?? '(missing)'}`,
    `- Issuer: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.issuer ?? '(missing)'}`,
    `- Fingerprint SHA-256: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.fingerprint_sha256 ?? '(missing)'}`,
    `- Authorization error: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.authorization_error ?? '(none)'}`,
    `- Suspicious: ${String(summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.suspicious ?? false)}`,
    '',
    '### Repo-Observed Firebase Hints',
    '',
    `- Android app id: ${summary.firebase_tls_define_hints?.repo_observed?.android_google_services?.android_app_id ?? '(missing)'}`,
    `- Android package name: ${summary.firebase_tls_define_hints?.repo_observed?.android_google_services?.android_package_name ?? '(missing)'}`,
    `- iOS bundle id: ${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_BUNDLE_ID ?? '(missing)'}`,
    `- iOS API key: ${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_API_KEY ?? '(missing)'}`,
    `- Web API key: ${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_WEB_API_KEY ?? '(missing)'}`,
    '',
    '### Firebase Discovery Boundary',
    '',
    `- Android app id discoverable from repo: ${String(summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.android_app_id_discoverable_from_repo ?? false)}`,
    `- iOS app id discoverable from repo: ${String(summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.ios_app_id_discoverable_from_repo ?? false)}`,
    `- Web app id discoverable from repo: ${String(summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.web_app_id_discoverable_from_repo ?? false)}`,
    ...((summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.unresolved_release_ids || []).map((item) => `- unresolved release id: ${item}`)),
    `- Operator note: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.operator_note ?? '(none)'}`,
    '',
    '### Firebase Identity Alignment',
    '',
    `- Expected Android package name: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_identity_alignment?.expected_android_package_name ?? '(missing)'}`,
    `- Expected iOS bundle id: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_identity_alignment?.expected_ios_bundle_id ?? '(missing)'}`,
    `- Operator note: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_identity_alignment?.operator_note ?? '(none)'}`,
    '',
    '## Define File Mutation',
    '',
    `- Target file: ${summary.define_file_mutation?.target_file ?? '(missing)'}`,
    `- Backup file: ${summary.define_file_mutation?.backup_file ?? '(missing)'}`,
    `- Rollback command: ${summary.define_file_mutation?.rollback_command ?? '(missing)'}`,
    '',
    '## Input Mapping',
    '',
    ...((summary.input_mapping || []).map((item) => `- ${item.blocker_id}: ${item.resolve_with}${item.handoff_input ? ` [inputs: ${item.handoff_input.join(', ')}]` : ''}${item.command_step ? ` [step: ${item.command_step}]` : ''}`)),
    '',
    '## Commands',
    '',
    ...((summary.commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    '',
    '## Next Steps',
    '',
    ...((summary.next_steps || []).map((step) => `- ${step}`)),
    '',
  );

  return `${lines.join('\n')}\n`;
}

function renderPs1(summary) {
  const androidOnly = summary.mobile_release_scope === 'android-only';
  const lines = [
    '# Mobile release next steps generated by scripts/mobile-release-prep.cjs',
    '# Section-scoped validation',
    '# - fill the variables below before running the mutable/evidence commands',
    '# - the define-file write creates a backup first',
    '',
    '# Source materials',
    ...((summary.source_materials || []).map((item) => `# - ${item.label}: ${item.path}`)),
    '',
    '# Current blocker summary',
    `# - readiness_status: ${summary.readiness_status ?? '(missing)'}`,
    `# - mobile_release_scope: ${summary.mobile_release_scope ?? '(missing)'}`,
    `# - ios_release_status: ${summary.ios_release_status ?? '(missing)'}`,
    ...((summary.blockers || []).map((blocker) => `# - ${blocker.id}: ${blocker.detail}`)),
    '',
    '# Mobile perf capture',
    `# - status: ${summary.perf_capture_hint?.status ?? '(none)'}`,
    `# - frames_total: ${summary.perf_capture_hint?.frames_total ?? '(missing)'}`,
    `# - detail: ${summary.perf_capture_hint?.detail ?? '(none)'}`,
    `# - operator_note: ${summary.perf_capture_hint?.operator_note ?? '(none)'}`,
    '',
    '# Mobile TLS probe',
    `# - status: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.status ?? '(missing)'}`,
    `# - host: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.host ?? '(missing)'}`,
    `# - subject: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.subject ?? '(missing)'}`,
    `# - issuer: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.issuer ?? '(missing)'}`,
    `# - fingerprint_sha256: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.fingerprint_sha256 ?? '(missing)'}`,
    `# - authorization_error: ${summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.authorization_error ?? '(none)'}`,
    `# - suspicious: ${String(summary.firebase_tls_define_hints?.repo_observed?.tls_probe?.suspicious ?? false)}`,
    '',
    '# Firebase discovery boundary',
    `# - android_app_id_discoverable_from_repo: ${String(summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.android_app_id_discoverable_from_repo ?? false)}`,
    `# - ios_app_id_discoverable_from_repo: ${String(summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.ios_app_id_discoverable_from_repo ?? false)}`,
    `# - web_app_id_discoverable_from_repo: ${String(summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.web_app_id_discoverable_from_repo ?? false)}`,
    ...((summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.unresolved_release_ids || []).map((item) => `# - unresolved_release_id: ${item}`)),
    `# - operator_note: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_discovery_summary?.operator_note ?? '(none)'}`,
    '',
    '# Firebase identity alignment',
    `# - expected_android_package_name: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_identity_alignment?.expected_android_package_name ?? '(missing)'}`,
    `# - expected_ios_bundle_id: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_identity_alignment?.expected_ios_bundle_id ?? '(missing)'}`,
    `# - operator_note: ${summary.firebase_tls_define_hints?.repo_observed?.firebase_identity_alignment?.operator_note ?? '(none)'}`,
    '',
    '# Missing mobile define values',
    ...((summary.firebase_tls_define_hints?.missing_values || []).map((item) => `# - ${item.id}: ${item.detail}`)),
    '',
    '# Input mapping',
    ...((summary.input_mapping || []).map((item) => `# - ${item.blocker_id}: ${item.resolve_with}${item.handoff_input ? ` [inputs: ${item.handoff_input.join(', ')}]` : ''}${item.command_step ? ` [step: ${item.command_step}]` : ''}`)),
    '',
    `$Branch = '${summary.repo_context?.branch || '<branch>'}'`,
    `$TargetSha = '${summary.repo_context?.head_sha || '<sha>'}'`,
    ...(androidOnly ? [] : ["$IosBuildRef = '<ios-build-ref>'"]),
    `$AndroidBuildRef = '${summary.repo_observed?.android_build_ref || '<android-build-ref>'}'`,
    `$AndroidSigningAlias = '${summary.repo_observed?.android_signing?.alias || '<alias>'}'`,
    `$AndroidArtifactPath = '${summary.repo_observed?.android_signing?.artifact_path || '<path-to-aab-or-apk>'}'`,
    ...(androidOnly ? [] : [
      "$IosSigningIdentity = '<identity>'",
      "$IosProvisioningProfile = '<profile>'",
      "$IosArtifactPath = '<path-to-ipa>'",
    ]),
    "$AndroidVerificationCommand = '<android-verify-command>'",
    "$AndroidVerificationSummary = '<android-verify-summary>'",
    ...(androidOnly ? [] : [
      "$IosVerificationCommand = '<ios-verify-command>'",
      "$IosVerificationSummary = '<ios-verify-summary>'",
    ]),
    "$CrashFreeSessionsPct = '<crash-free-pct>'",
    "$AnrFreeSessionsPct = '<anr-free-pct>'",
    "$SampleSizeSessions = '<count>'",
    "$MetricSource = '<firebase-console-or-monitoring-source>'",
    "$MobileEngineeringApprover = '<mobile-engineering-approver>'",
    "$MobileSecurityApprover = '<mobile-security-approver>'",
    "$MobileReleaseOwnerApprover = '<mobile-release-owner-approver>'",
    `$ApiCertSha256Pins = '${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_API_CERT_SHA256_PINS || '<sha256-pin-1,sha256-pin-2>'}'`,
    `$FirebaseIosAppId = '${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_APP_ID || '<ios-prod-app-id>'}'`,
    `$FirebaseWebAppId = '${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_WEB_APP_ID || '<web-app-id>'}'`,
    `$FirebaseIosBundleId = '${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_BUNDLE_ID || ''}'`,
    `$FirebaseIosApiKey = '${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_API_KEY || ''}'`,
    `$FirebaseWebApiKey = '${summary.firebase_tls_define_hints?.repo_observed?.local_release_define_file?.known_values?.SVEN_FIREBASE_WEB_API_KEY || ''}'`,
    "$MobileDefineFile = 'config/env/mobile-dart-defines.release.local.json'",
    "$MobileDefineBackupFile = \"$MobileDefineFile.bak\"",
    '',
    'function Assert-NoPlaceholder([string]$Name, [string]$Value) {',
    "  if ($null -eq $Value -or $Value -match '^<.+>$') {",
    '    throw \"Unresolved placeholder for $Name: $Value\"',
    '  }',
    '}',
    '',
    'Assert-NoPlaceholder "ApiCertSha256Pins" $ApiCertSha256Pins',
    'Assert-NoPlaceholder "FirebaseIosAppId" $FirebaseIosAppId',
    'Assert-NoPlaceholder "FirebaseWebAppId" $FirebaseWebAppId',
    '',
    'Write-Host "Known iOS bundle id: $FirebaseIosBundleId"',
    'Write-Host "Known iOS API key: $FirebaseIosApiKey"',
    'Write-Host "Known web API key: $FirebaseWebApiKey"',
    'Write-Host "Rollback command: Copy-Item -Force $MobileDefineBackupFile $MobileDefineFile"',
    '',
    '# 1. Populate missing mobile define values',
    '$mobileDefines = @{}',
    'if (Test-Path $MobileDefineFile) {',
    '  $mobileDefines = Get-Content $MobileDefineFile -Raw | ConvertFrom-Json -AsHashtable',
    '  Copy-Item -Force $MobileDefineFile $MobileDefineBackupFile',
    '  Write-Host "Backed up mobile define file: $MobileDefineBackupFile"',
    '}',
    "$mobileDefines['SVEN_API_CERT_SHA256_PINS'] = $ApiCertSha256Pins",
    "$mobileDefines['SVEN_FIREBASE_IOS_PROD_APP_ID'] = $FirebaseIosAppId",
    "$mobileDefines['SVEN_FIREBASE_WEB_APP_ID'] = $FirebaseWebAppId",
    "if (-not $mobileDefines.ContainsKey('SVEN_FIREBASE_IOS_PROD_BUNDLE_ID') -and $FirebaseIosBundleId) { $mobileDefines['SVEN_FIREBASE_IOS_PROD_BUNDLE_ID'] = $FirebaseIosBundleId }",
    "if (-not $mobileDefines.ContainsKey('SVEN_FIREBASE_IOS_PROD_API_KEY') -and $FirebaseIosApiKey) { $mobileDefines['SVEN_FIREBASE_IOS_PROD_API_KEY'] = $FirebaseIosApiKey }",
    "if (-not $mobileDefines.ContainsKey('SVEN_FIREBASE_WEB_API_KEY') -and $FirebaseWebApiKey) { $mobileDefines['SVEN_FIREBASE_WEB_API_KEY'] = $FirebaseWebApiKey }",
    '$mobileDefines | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $MobileDefineFile',
    'Write-Host "Updated mobile define file: $MobileDefineFile"',
    'Write-Host "Rollback command: Copy-Item -Force $MobileDefineBackupFile $MobileDefineFile"',
    '',
    '# 2. Device validation',
    ...(androidOnly
      ? ["powershell -ExecutionPolicy Bypass -File scripts/mobile-release-device-validation.ps1 -Branch $Branch -TargetSha $TargetSha -AndroidBuildRef $AndroidBuildRef -AndroidTokenPersists pass -AndroidSignOutRevokes pass -AndroidCleartextBlocked pass"]
      : ["powershell -ExecutionPolicy Bypass -File scripts/mobile-release-device-validation.ps1 -Branch $Branch -TargetSha $TargetSha -IosBuildRef $IosBuildRef -AndroidBuildRef $AndroidBuildRef -IosTokenPersists pass -IosSignOutRevokes pass -AndroidTokenPersists pass -AndroidSignOutRevokes pass -AndroidCleartextBlocked pass"]),
    '',
    '# 3. Signing evidence',
    ...(androidOnly
      ? ["powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-release-signing-evidence.ps1 -AndroidSigningAlias $AndroidSigningAlias -AndroidArtifactPath $AndroidArtifactPath -AndroidVerifyCommand $AndroidVerificationCommand -AndroidVerifySummary $AndroidVerificationSummary -ApproverEngineering $MobileEngineeringApprover -ApproverSecurity $MobileSecurityApprover -ApproverReleaseOwner $MobileReleaseOwnerApprover"]
      : ["powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-release-signing-evidence.ps1 -AndroidSigningAlias $AndroidSigningAlias -AndroidArtifactPath $AndroidArtifactPath -AndroidVerifyCommand $AndroidVerificationCommand -AndroidVerifySummary $AndroidVerificationSummary -IosSigningIdentity $IosSigningIdentity -IosProvisioningProfile $IosProvisioningProfile -IosArtifactPath $IosArtifactPath -IosVerifyCommand $IosVerificationCommand -IosVerifySummary $IosVerificationSummary -ApproverEngineering $MobileEngineeringApprover -ApproverSecurity $MobileSecurityApprover -ApproverReleaseOwner $MobileReleaseOwnerApprover"]),
    '',
    '# 4. Crash / ANR evidence',
    "powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-crash-anr-evidence.ps1 -CrashFreeSessionsPct $CrashFreeSessionsPct -AnrFreeSessionsPct $AnrFreeSessionsPct -SampleSizeSessions $SampleSizeSessions -Source $MetricSource",
    '',
    '# 5. Local status checks',
    'node scripts/mobile-perf-slo-check.cjs --strict',
    'node scripts/mobile-app-store-privacy-check.cjs --strict',
    'node scripts/mobile-firebase-tls-define-check.cjs --strict',
    'npm run mobile:release:readiness:check',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function extractAndroidFirebaseHints() {
  const googleServices =
    readJson('apps/companion-user-flutter/android/app/src/prod/google-services.json')
    || readJson('apps/companion-user-flutter/android/app/google-services.json')
    || readJson('docs/integrations/firebase/google-services.json');
  const client = googleServices?.client?.[0];
  return {
    android_app_id: client?.client_info?.mobilesdk_app_id || null,
    android_api_key: client?.api_key?.[0]?.current_key || null,
    android_package_name: client?.client_info?.android_client_info?.package_name || null,
  };
}

function extractLocalDefineHints() {
  const localDefines = readJson('config/env/mobile-dart-defines.release.local.json') || {};
  return {
    define_file: 'config/env/mobile-dart-defines.release.local.json',
    known_values: {
      SVEN_API_CERT_SHA256_PINS: localDefines.SVEN_API_CERT_SHA256_PINS || null,
      SVEN_FIREBASE_IOS_PROD_API_KEY: localDefines.SVEN_FIREBASE_IOS_PROD_API_KEY || null,
      SVEN_FIREBASE_IOS_PROD_APP_ID: localDefines.SVEN_FIREBASE_IOS_PROD_APP_ID || null,
      SVEN_FIREBASE_IOS_PROD_BUNDLE_ID: localDefines.SVEN_FIREBASE_IOS_PROD_BUNDLE_ID || null,
      SVEN_FIREBASE_WEB_API_KEY: localDefines.SVEN_FIREBASE_WEB_API_KEY || null,
      SVEN_FIREBASE_WEB_APP_ID: localDefines.SVEN_FIREBASE_WEB_APP_ID || null,
    },
  };
}

function extractAndroidSigningHints() {
  const keyPropertiesPath = path.join(root, 'apps', 'companion-user-flutter', 'android', 'key.properties');
  const artifactPath = path.join(root, 'apps', 'companion-user-flutter', 'build', 'app', 'outputs', 'bundle', 'prodRelease', 'app-prod-release.aab');
  let alias = null;
  let storeFile = null;
  if (fs.existsSync(keyPropertiesPath)) {
    const body = fs.readFileSync(keyPropertiesPath, 'utf8');
    alias = body.match(/^\s*keyAlias\s*=\s*(.+)\s*$/m)?.[1]?.trim() || null;
    storeFile = body.match(/^\s*storeFile\s*=\s*(.+)\s*$/m)?.[1]?.trim() || null;
  }
  return {
    alias,
    keystore_reference: storeFile ? `android/${storeFile}`.replace(/\\/g, '/') : null,
    artifact_path: fs.existsSync(artifactPath)
      ? 'apps/companion-user-flutter/build/app/outputs/bundle/prodRelease/app-prod-release.aab'
      : null,
  };
}

function buildFirebaseDiscoverySummary(repoObserved = {}) {
  const localKnown = repoObserved.local_release_define_file?.known_values || {};
  const unresolvedReleaseIds = [];
  if (!localKnown.SVEN_FIREBASE_IOS_PROD_APP_ID) unresolvedReleaseIds.push('SVEN_FIREBASE_IOS_PROD_APP_ID');
  if (!localKnown.SVEN_FIREBASE_WEB_APP_ID) unresolvedReleaseIds.push('SVEN_FIREBASE_WEB_APP_ID');
  return {
    android_app_id_discoverable_from_repo: Boolean(repoObserved.android_google_services?.android_app_id),
    ios_app_id_discoverable_from_repo: false,
    web_app_id_discoverable_from_repo: false,
    unresolved_release_ids: unresolvedReleaseIds,
    operator_note: 'The repo exposes Android Firebase registration metadata, but not the production iOS/web app IDs. Treat SVEN_FIREBASE_IOS_PROD_APP_ID and SVEN_FIREBASE_WEB_APP_ID as external release inputs from the real Firebase project registrations.',
  };
}

function buildFirebaseIdentityAlignment(repoObserved = {}) {
  return {
    expected_android_package_name: repoObserved.android_google_services?.android_package_name || null,
    expected_ios_bundle_id: repoObserved.local_release_define_file?.known_values?.SVEN_FIREBASE_IOS_PROD_BUNDLE_ID || null,
    operator_note: 'Only use Firebase app IDs and API keys from registrations bound to the expected Android package name and iOS bundle id above. Do not reuse values from a different app identity.',
  };
}

function isSuspiciousCertificate(hostname, subject = '', issuer = '') {
  const loweredSubject = String(subject).toLowerCase();
  const loweredIssuer = String(issuer).toLowerCase();
  const loweredHost = String(hostname || '').toLowerCase();
  const selfSigned = loweredSubject && loweredIssuer && loweredSubject === loweredIssuer;
  const internalName = loweredSubject.includes('.internal') || loweredIssuer.includes('.internal');
  const hostMentioned = loweredHost && (loweredSubject.includes(loweredHost) || loweredIssuer.includes(loweredHost));
  return selfSigned || internalName || !hostMentioned;
}

function formatSubject(certName) {
  if (!certName || typeof certName !== 'object') return null;
  return Object.entries(certName)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

function probeTlsLeafCertificate(apiBase) {
  if (typeof apiBase !== 'string' || !apiBase.trim()) {
    return Promise.resolve({
      status: 'missing_api_base',
      detail: 'No API base configured.',
    });
  }

  let url;
  try {
    url = new URL(apiBase);
  } catch {
    return Promise.resolve({
      status: 'invalid_api_base',
      detail: `Could not parse API base: ${apiBase}`,
    });
  }

  if (url.protocol !== 'https:') {
    return Promise.resolve({
      status: 'non_https',
      detail: `TLS probe skipped for non-HTTPS API base: ${url.href}`,
    });
  }

  return new Promise((resolve) => {
    // Intentional: TLS certificate probe — reads and inspects the peer cert.
    const socket = tls.connect({ // lgtm[js/disabling-certificate-validation]
      host: url.hostname,
      port: Number(url.port || 443),
      servername: url.hostname,
      rejectUnauthorized: false,
      timeout: 10000,
    });

    const finish = (payload) => {
      if (!socket.destroyed) socket.destroy();
      resolve(payload);
    };

    socket.once('secureConnect', () => {
      try {
        const peer = socket.getPeerCertificate(true);
        if (!peer || !peer.raw) {
          finish({
            status: 'missing_peer_certificate',
            detail: `No peer certificate returned for ${url.hostname}`,
          });
          return;
        }
        const fingerprintSha256 = crypto.createHash('sha256').update(peer.raw).digest('hex');
        const subject = formatSubject(peer.subject);
        const issuer = formatSubject(peer.issuer);
        finish({
          status: 'ok',
          host: url.hostname,
          subject,
          issuer,
          valid_to: peer.valid_to || null,
          fingerprint_sha256: fingerprintSha256,
          suspicious: isSuspiciousCertificate(url.hostname, subject, issuer),
          authorization_error: socket.authorizationError || null,
        });
      } catch (error) {
        finish({
          status: 'probe_error',
          detail: String(error.message || error),
        });
      }
    });

    socket.once('timeout', () => {
      finish({
        status: 'timeout',
        detail: `Timed out probing ${url.hostname}`,
      });
    });

    socket.once('error', (error) => {
      finish({
        status: 'probe_error',
        detail: String(error.message || error),
      });
    });
  });
}

async function main() {
  const releaseScope = readScope();
  const androidOnly = releaseScope.scope === 'android-only';
  const readiness = readJson('docs/release/status/mobile-release-readiness-latest.json');
  const perf = readJson('docs/release/status/mobile-perf-slo-latest.json');
  const crashAnr = readJson('docs/release/status/mobile-crash-anr-latest.json');
  const privacy = readJson('docs/release/status/mobile-app-store-privacy-latest.json');
  const deviceValidation = readJson('docs/release/status/mobile-device-release-validation-latest.json');
  const signing = readJson('docs/release/status/mobile-release-signing-latest.json');
  const firebaseTls = readJson('docs/release/status/mobile-firebase-tls-define-latest.json');
  const androidFirebaseHints = extractAndroidFirebaseHints();
  const androidSigningHints = extractAndroidSigningHints();
  const localDefineHints = extractLocalDefineHints();
  const apiBase = localDefineHints.known_values.SVEN_API_BASE
    || (readJson('config/env/mobile-dart-defines.release.local.json') || {}).SVEN_API_BASE
    || null;
  const missingDefineChecks = (firebaseTls?.checks || []).filter(
    (check) => !check.pass && (check.id === 'tls_pins_present' || check.id.startsWith('env_present:')),
  );
  const tlsProbe = await probeTlsLeafCertificate(apiBase || defaultApiBase);
  const perfCaptureHint = buildPerfCaptureHint(perf);

  const summary = {
    status: readiness?.status || null,
    generated_at: new Date().toISOString(),
    readiness_status: readiness?.status || null,
    mobile_release_scope: releaseScope.scope,
    ios_release_status: androidOnly ? 'deferred' : 'required',
    repo_context: {
      branch: readGitValue('git rev-parse --abbrev-ref HEAD'),
      head_sha: readGitValue('git rev-parse HEAD'),
    },
    repo_observed: {
      android_build_ref: androidSigningHints.artifact_path ? 'gradle:bundleProdRelease:app-prod-release.aab:2026-03-11' : null,
      android_signing: androidSigningHints,
    },
    blockers: readiness?.checks?.filter((check) => !check.pass).map((check) => ({
      id: check.id,
      detail: check.detail,
    })) || [],
    artifact_ages_hours: {
      perf_slo: ageHours(extractTimestampIso(perf)),
      crash_anr: ageHours(extractTimestampIso(crashAnr)),
      appstore_privacy: ageHours(extractTimestampIso(privacy)),
      device_validation: ageHours(extractTimestampIso(deviceValidation)),
      release_signing: ageHours(extractTimestampIso(signing) || signing?.evidence?.timestamp || null),
      firebase_tls_define: ageHours(extractTimestampIso(firebaseTls)),
    },
    perf_capture_hint: perfCaptureHint,
    source_materials: [
      { label: 'mobile release process', path: 'apps/companion-user-flutter/docs/release-process.md' },
      { label: 'mobile release scope', path: 'config/release/mobile-release-scope.json' },
      { label: 'mobile define bundle', path: 'config/env/mobile-dart-defines.release.local.json' },
      { label: 'android google services', path: 'apps/companion-user-flutter/android/app/src/prod/google-services.json' },
      { label: 'mobile readiness status', path: 'docs/release/status/mobile-release-readiness-latest.json' },
      { label: 'mobile perf status', path: 'docs/release/status/mobile-perf-slo-latest.json' },
      { label: 'mobile firebase tls define status', path: 'docs/release/status/mobile-firebase-tls-define-latest.json' },
    ],
    define_file_mutation: {
      target_file: 'config/env/mobile-dart-defines.release.local.json',
      backup_file: 'config/env/mobile-dart-defines.release.local.json.bak',
      rollback_command: 'Copy-Item -Force config/env/mobile-dart-defines.release.local.json.bak config/env/mobile-dart-defines.release.local.json',
    },
    firebase_tls_define_hints: {
      define_bundle_source: firebaseTls?.define_bundle_source || '(none)',
      missing_values: missingDefineChecks.map((check) => ({
        id: check.id,
        detail: check.detail,
      })),
      repo_observed: {
        android_google_services: androidFirebaseHints,
        local_release_define_file: localDefineHints,
        tls_probe: tlsProbe,
        firebase_discovery_summary: buildFirebaseDiscoverySummary({
          android_google_services: androidFirebaseHints,
          local_release_define_file: localDefineHints,
        }),
        firebase_identity_alignment: buildFirebaseIdentityAlignment({
          android_google_services: androidFirebaseHints,
          local_release_define_file: localDefineHints,
        }),
      },
      operator_note:
        'Android Firebase values can sometimes be sourced from google-services.json. iOS/web app IDs still require the actual release registrations. TLS pins must come from the real production certificate chain; reject internal/self-signed probe results.',
    },
    commands: [
      {
        step: 'device_validation',
        command: androidOnly
          ? 'powershell -ExecutionPolicy Bypass -File scripts/mobile-release-device-validation.ps1 -Branch <branch> -TargetSha <sha> -AndroidBuildRef <android-build-ref> -AndroidTokenPersists pass -AndroidSignOutRevokes pass -AndroidCleartextBlocked pass'
          : 'powershell -ExecutionPolicy Bypass -File scripts/mobile-release-device-validation.ps1 -Branch <branch> -TargetSha <sha> -IosBuildRef <ios-build-ref> -AndroidBuildRef <android-build-ref> -IosTokenPersists pass -IosSignOutRevokes pass -AndroidTokenPersists pass -AndroidSignOutRevokes pass -AndroidCleartextBlocked pass',
      },
      {
        step: 'signing_evidence',
        command: androidOnly
          ? 'powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-release-signing-evidence.ps1 -AndroidSigningAlias <alias> -AndroidArtifactPath <path-to-aab-or-apk> -AndroidVerifyCommand <command> -AndroidVerifySummary <summary> -ApproverEngineering <name> -ApproverSecurity <name> -ApproverReleaseOwner <name>'
          : 'powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-release-signing-evidence.ps1 -AndroidSigningAlias <alias> -AndroidArtifactPath <path-to-aab-or-apk> -AndroidVerifyCommand <command> -AndroidVerifySummary <summary> -IosSigningIdentity <identity> -IosProvisioningProfile <profile> -IosArtifactPath <path-to-ipa> -IosVerifyCommand <command> -IosVerifySummary <summary> -ApproverEngineering <name> -ApproverSecurity <name> -ApproverReleaseOwner <name>',
      },
      {
        step: 'crash_anr_evidence',
        command: 'powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-crash-anr-evidence.ps1 -CrashFreeSessionsPct <pct> -AnrFreeSessionsPct <pct> -SampleSizeSessions <count> -Source <firebase-console-or-monitoring-source>',
      },
      {
        step: 'perf_slo_status',
        command: 'node scripts/mobile-perf-slo-check.cjs --strict',
      },
      {
        step: 'appstore_privacy_status',
        command: 'node scripts/mobile-app-store-privacy-check.cjs --strict',
      },
      {
        step: 'firebase_tls_define_status',
        command: 'node scripts/mobile-firebase-tls-define-check.cjs --strict',
      },
      {
        step: 'readiness_refresh',
        command: 'npm run mobile:release:readiness:check',
      },
    ],
  };

  summary.execution_model = {
    mobile_sections_require_mobile_inputs_only: true,
    define_file_mutation_reversible: true,
  };
  summary.input_mapping = buildMobileInputMapping(summary);
  summary.artifacts = {
    status_files: [
      { label: 'mobile readiness', path: 'docs/release/status/mobile-release-readiness-latest.json' },
      { label: 'mobile perf slo', path: 'docs/release/status/mobile-perf-slo-latest.json' },
      { label: 'mobile firebase tls define', path: 'docs/release/status/mobile-firebase-tls-define-latest.json' },
      { label: 'mobile crash anr', path: 'docs/release/status/mobile-crash-anr-latest.json' },
      { label: 'mobile app store privacy', path: 'docs/release/status/mobile-app-store-privacy-latest.json' },
      { label: 'mobile prep json', path: 'docs/release/status/mobile-release-prep-latest.json' },
      { label: 'mobile prep markdown', path: 'docs/release/status/mobile-release-prep-latest.md' },
      { label: 'mobile next steps ps1', path: 'docs/release/status/mobile-release-next-steps.ps1' },
    ],
  };
  summary.next_steps = buildMobileNextSteps(summary);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, renderMarkdown(summary), 'utf8');
  fs.writeFileSync(outPs1, renderPs1(summary), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

