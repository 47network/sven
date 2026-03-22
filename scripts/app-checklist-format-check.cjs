#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'app-checklist-format-latest.json');
const outMd = path.join(outDir, 'app-checklist-format-latest.md');

const targets = [
  { rel: 'docs/SVEN_APP_CHECKLIST.md', maxLineLength: Number(process.env.SVEN_CHECKLIST_MAX_LINE_LENGTH || 1500) },
  { rel: 'docs/Sven_Master_Checklist.md', maxLineLength: Number(process.env.SVEN_CHECKLIST_MAX_LINE_LENGTH || 1500) },
  { rel: 'docs/release/checklists/sven-production-parity-checklist-2026.md', maxLineLength: Number(process.env.SVEN_CHECKLIST_MAX_LINE_LENGTH || 1500) },
  { rel: 'docs/release/checklists/flutter-user-app-checklist-2026.md', maxLineLength: Number(process.env.SVEN_CHECKLIST_MAX_LINE_LENGTH || 1500) },
];

function add(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail });
}

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    return null;
  }
  return fs.readFileSync(full, 'utf8');
}

function duplicateWindowCheck(text, wordWindowSize) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const seen = new Set();
  for (let i = 0; i + wordWindowSize <= tokens.length; i += 1) {
    const window = tokens.slice(i, i + wordWindowSize).join(' ');
    if (seen.has(window)) {
      return window;
    }
    seen.add(window);
  }
  return null;
}

function extractSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRe = new RegExp(`^\\*\\*${escaped}\\*\\*[\\s\\S]*?(?=^\\*\\*[^\\n]+\\*\\*|\\n---\\n|$)`, 'im');
  const match = text.match(sectionRe);
  return match ? match[0] : '';
}

function hasPositiveReleaseReadyLine(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  if (/\bnot\s+(?:fully\s+)?release[- ]ready\b/i.test(text)) return false;
  if (/\bnot\s+(?:fully\s+)?production[- ]ready\b/i.test(text)) return false;
  return /\brelease[- ]ready\b/i.test(text) || /\bproduction[- ]ready\b/i.test(text);
}

function writeArtifacts(payload) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`);

  const lines = [
    '# App Checklist Format Check',
    '',
    `- Status: ${payload.status}`,
    `- Checked at: ${payload.generated_at}`,
    '',
    '## Checks',
    ...payload.checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, lines.join('\n'));
}

function main() {
  const checks = [];

  for (const target of targets) {
    const body = read(target.rel);
    if (!body) {
      add(checks, `present:${target.rel}`, false, 'missing');
      continue;
    }
    add(checks, `present:${target.rel}`, true, 'present');

    const lines = body.split(/\r?\n/);
    const longLines = lines
      .map((line, idx) => ({ line: idx + 1, length: line.length }))
      .filter((entry) => entry.length > target.maxLineLength);
    add(
      checks,
      `line_length:${target.rel}`,
      longLines.length === 0,
      longLines.length === 0
        ? `all lines <= ${target.maxLineLength}`
        : `${longLines.length} lines exceed ${target.maxLineLength} (e.g. line ${longLines[0].line} = ${longLines[0].length})`,
    );
  }

  const appChecklist = read('docs/SVEN_APP_CHECKLIST.md');
  if (appChecklist) {
    add(
      checks,
      'app_header_current_snapshot_section_present',
      appChecklist.includes('**Current Snapshot**'),
      'SVEN_APP_CHECKLIST.md includes "**Current Snapshot**" section',
    );
    add(
      checks,
      'app_header_sprint_highlights_section_present',
      appChecklist.includes('**Sprint Highlights (Latest)**'),
      'SVEN_APP_CHECKLIST.md includes "**Sprint Highlights (Latest)**" section',
    );
    add(
      checks,
      'app_header_no_legacy_current_state_mega_line',
      !appChecklist.includes('**Current state:**'),
      'legacy "**Current state:**" mega-line removed',
    );
    const appHeaderBlock = appChecklist.split(/\r?\n---\r?\n/)[0] || appChecklist;
    const completionPercentMatch = appHeaderBlock.match(/~?\s*\d+(?:\.\d+)?%\s*complete/i);
    add(
      checks,
      'app_header_no_percent_complete_claims',
      !completionPercentMatch,
      completionPercentMatch
        ? `remove percent-complete claim from header: "${completionPercentMatch[0]}"`
        : 'no percent-complete claims in checklist header',
    );
    const passFailMatch = appHeaderBlock.match(/\b\d+\s*pass\s*\/\s*\d+\s*fail\b/i);
    add(
      checks,
      'app_header_no_pass_fail_snapshot_claims',
      !passFailMatch,
      passFailMatch
        ? `remove pass/fail snapshot claim from header: "${passFailMatch[0]}"`
        : 'no pass/fail snapshot claims in checklist header',
    );
    const requiredCurrentArtifactRefs = [
      'docs/release/status/app-checklist-format-latest.json',
      'docs/release/status/app-checklist-metrics-latest.json',
      'docs/release/status/app-checklist-metrics-latest.md',
      'docs/release/status/mobile-binary-artifacts-latest.json',
      'docs/release/status/mobile-binary-artifacts-latest.md',
      'docs/release/status/parity-checklist-verify-latest.json',
    ];
    const missingCurrentArtifactRefs = requiredCurrentArtifactRefs.filter((ref) => !appHeaderBlock.includes(ref));
    add(
      checks,
      'app_header_current_readiness_artifact_refs_present',
      missingCurrentArtifactRefs.length === 0,
      missingCurrentArtifactRefs.length === 0
        ? 'header references canonical current readiness artifacts'
        : `missing header artifact refs: ${missingCurrentArtifactRefs.join(', ')}`,
    );
    add(
      checks,
      'app_release_pipeline_no_overstated_dual_store_automation',
      !appChecklist.includes('upload to Play Store / App Store'),
      'app checklist must not claim fully automated dual-store upload when iOS path is manual',
    );
    add(
      checks,
      'app_release_pipeline_platform_split_explicit',
      appChecklist.includes('Play Store (automated)') && appChecklist.includes('App Store (manual'),
      'app checklist explicitly distinguishes Android automated vs iOS manual release paths',
    );
    const testflightAutomationOverclaim = /Auto-deploy to internal testing[^\n]*TestFlight(?!.*manual)/i.test(appChecklist);
    add(
      checks,
      'app_internal_testing_no_testflight_automation_overclaim',
      !testflightAutomationOverclaim,
      testflightAutomationOverclaim
        ? 'TestFlight referenced without manual qualifier in internal testing row'
        : 'internal testing row does not over-claim TestFlight automation',
    );
    const openApiStaticCountClaim = /OpenAPI[^\n]*\b\d+\s*paths?\b[^\n]*\b\d+\s*schemas?\b[^\n]*\b\d+\s*tag/i.test(appChecklist);
    add(
      checks,
      'app_openapi_no_static_count_claims',
      !openApiStaticCountClaim,
      openApiStaticCountClaim
        ? 'replace static OpenAPI path/schema/tag counts with generated artifact references'
        : 'OpenAPI row does not use static count claims',
    );
    const openApiArtifactRefsPresent =
      appChecklist.includes('docs/release/status/openapi-metrics-latest.json')
      && appChecklist.includes('docs/release/status/openapi-metrics-latest.md')
      && appChecklist.includes('docs/release/status/api-openapi-contract-latest.json');
    add(
      checks,
      'app_openapi_artifact_refs_present',
      openApiArtifactRefsPresent,
      openApiArtifactRefsPresent
        ? 'OpenAPI row references generated metrics + contract status artifacts'
        : 'OpenAPI row missing generated metrics/contract artifact references',
    );
    const staleDependencyVersionClaims = [
      /go_router[^\n]*\b14\.8\.1\b/i,
      /freezed[^\n]*\b2\.5\.8\b/i,
      /json_serializable[^\n]*\b6\.9\.5\b/i,
      /home_widget[^\n]*\^?4\.1\.0\b/i,
    ].filter((pattern) => pattern.test(appChecklist));
    add(
      checks,
      'app_dependency_claims_no_stale_pinned_versions',
      staleDependencyVersionClaims.length === 0,
      staleDependencyVersionClaims.length === 0
        ? 'no known stale dependency version claims found in app checklist'
        : `stale dependency version claims detected (${staleDependencyVersionClaims.length})`,
    );
    const appChecklistUsesPubspecAsDependencySource = appChecklist.includes(
      'apps/companion-user-flutter/pubspec.yaml',
    );
    add(
      checks,
      'app_dependency_claims_reference_pubspec_source_of_truth',
      appChecklistUsesPubspecAsDependencySource,
      appChecklistUsesPubspecAsDependencySource
        ? 'app checklist references pubspec as dependency version source of truth'
        : 'app checklist is missing pubspec source-of-truth dependency reference',
    );
    const legacyReleaseDocRef = 'docs/release-process.md';
    const canonicalReleaseDocRef = 'apps/companion-user-flutter/docs/release-process.md';
    const appChangelogRef = 'apps/companion-user-flutter/CHANGELOG.md';
    const legacyReleaseDocStandaloneRefPattern = /(^|[^A-Za-z0-9_./-])docs\/release-process\.md([^A-Za-z0-9_./-]|$)/m;
    add(
      checks,
      'app_evidence_no_legacy_release_process_path',
      !legacyReleaseDocStandaloneRefPattern.test(appChecklist),
      `${legacyReleaseDocRef} not referenced as standalone legacy path in app checklist evidence notes`,
    );
    add(
      checks,
      'app_evidence_uses_canonical_release_process_path',
      appChecklist.includes(canonicalReleaseDocRef) && fs.existsSync(path.join(root, canonicalReleaseDocRef)),
      `${canonicalReleaseDocRef} is referenced and exists`,
    );
    add(
      checks,
      'app_changelog_artifact_exists',
      fs.existsSync(path.join(root, appChangelogRef)),
      `${appChangelogRef} exists as changelog workflow target artifact`,
    );
    if (appChecklist.includes(appChangelogRef)) {
      add(
        checks,
        'app_evidence_changelog_path_exists',
        fs.existsSync(path.join(root, appChangelogRef)),
        `${appChangelogRef} referenced by checklist and exists`,
      );
    }

    const headerBlock = appChecklist.split(/\r?\n---\r?\n/)[0] || appChecklist;
    const duplicateWindow = duplicateWindowCheck(headerBlock, Number(process.env.SVEN_CHECKLIST_DUP_WINDOW_WORDS || 14));
    add(
      checks,
      'app_header_no_duplicate_long_phrase_windows',
      !duplicateWindow,
      duplicateWindow ? `duplicate phrase window detected: "${duplicateWindow}"` : 'no duplicate long phrase windows detected in header block',
    );

    const checkedPartialRows = appChecklist
      .split(/\r?\n/)
      .map((line, idx) => ({ line: idx + 1, text: line }))
      .filter(
        (entry) =>
          /^\s*-\s*\[x\]/i.test(entry.text)
          && /\b(partial|deferred|sse only|basic exists)\b/i.test(entry.text),
      );
    add(
      checks,
      'app_checked_rows_no_partial_qualifiers',
      checkedPartialRows.length === 0,
      checkedPartialRows.length === 0
        ? 'no [x] rows contain partial/deferred/basic exists/SSE only qualifiers'
        : `downgrade rows to [~] or [ ] at lines ${checkedPartialRows.map((row) => row.line).join(', ')}`,
    );

    const mixedCounterLine = headerBlock
      .split(/\r?\n/)
      .find((line) => /unit\s*tests?/i.test(line) && /\b\d+\s*pass\s*\/\s*\d+\s*fail\b/i.test(line));
    add(
      checks,
      'app_header_no_mixed_counter_claim_lines',
      !mixedCounterLine,
      mixedCounterLine
        ? `mixed early/late maturity counters in one line: "${mixedCounterLine.trim().slice(0, 200)}"`
        : 'no header line mixes unit-test counts with pass/fail counters',
    );

    const sprintHighlights = extractSection(appChecklist, 'Sprint Highlights (Latest)');
    const sprintLabelLines = sprintHighlights
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter((line) => /^-\s*Sprint\s+\d+:/i.test(line));
    const normalizedSprintLabels = sprintLabelLines.map((line) =>
      line.replace(/^-\s*Sprint\s+\d+:\s*/i, '').toLowerCase().replace(/\s+/g, ' ').trim(),
    );
    const seenSprintLabels = new Set();
    let duplicateSprintLabel = '';
    for (const label of normalizedSprintLabels) {
      if (!label) continue;
      if (seenSprintLabels.has(label)) {
        duplicateSprintLabel = label;
        break;
      }
      seenSprintLabels.add(label);
    }
    add(
      checks,
      'app_sprint_highlights_no_duplicate_labels',
      !duplicateSprintLabel,
      duplicateSprintLabel
        ? `duplicate sprint highlight label detected: "${duplicateSprintLabel}"`
        : 'latest sprint highlight labels are unique',
    );

    const mobileReadinessRaw = read('docs/release/status/mobile-release-readiness-latest.json');
    const mobileReadinessStatus = (() => {
      if (!mobileReadinessRaw) return '';
      try {
        const parsed = JSON.parse(mobileReadinessRaw.replace(/^\uFEFF/, ''));
        return String(parsed?.status || '').trim().toLowerCase();
      } catch {
        return '';
      }
    })();
    const overclaimLines = appChecklist
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter((line) => /\b~?\s*100%\s*complete\b/i.test(line) || hasPositiveReleaseReadyLine(line));
    add(
      checks,
      'app_mobile_readiness_no_completion_overclaim_when_mobile_not_pass',
      mobileReadinessStatus === 'pass' || overclaimLines.length === 0,
      mobileReadinessStatus !== 'pass' && overclaimLines.length > 0
        ? `mobile readiness is "${mobileReadinessStatus || 'unknown'}" but checklist contains completion/release-ready claim`
        : `mobile readiness status=${mobileReadinessStatus || 'unknown'}; no contradictory completion framing`,
    );

    const mobileBinaryArtifactsRaw = read('docs/release/status/mobile-binary-artifacts-latest.json');
    const mobileBinaryArtifactsStatus = (() => {
      if (!mobileBinaryArtifactsRaw) return '';
      try {
        const parsed = JSON.parse(mobileBinaryArtifactsRaw.replace(/^\uFEFF/, ''));
        return String(parsed?.status || '').trim().toLowerCase();
      } catch {
        return '';
      }
    })();
    add(
      checks,
      'app_mobile_binary_artifacts_no_completion_overclaim_when_binary_not_pass',
      mobileBinaryArtifactsStatus === 'pass' || overclaimLines.length === 0,
      mobileBinaryArtifactsStatus !== 'pass' && overclaimLines.length > 0
        ? `mobile binary artifacts status is "${mobileBinaryArtifactsStatus || 'unknown'}" but checklist contains completion/release-ready claim`
        : `mobile binary artifacts status=${mobileBinaryArtifactsStatus || 'unknown'}; no contradictory completion framing`,
    );

    const inlineReplyChecked = /^\s*-\s*\[x\]\s*Reply from notification \(inline reply\)/im.test(appChecklist);
    const notificationManager = read('apps/companion-user-flutter/lib/features/notifications/push_notification_manager.dart') || '';
    const hasInlineReplyImplementationMarkers =
      /RemoteInput/i.test(notificationManager)
      || /selectedNotificationAction/i.test(notificationManager)
      || /input/i.test(notificationManager);
    add(
      checks,
      'app_inline_reply_claim_matches_runtime',
      !inlineReplyChecked || hasInlineReplyImplementationMarkers,
      inlineReplyChecked
        ? 'inline reply row is checked; runtime markers (RemoteInput/selectedNotificationAction/input) must exist'
        : 'inline reply row is not marked complete, matching tap-to-open current implementation',
    );

    const abService = read('apps/companion-user-flutter/lib/app/ab_test_service.dart') || '';
    const appRuntime = read('apps/companion-user-flutter/lib/app/sven_user_app.dart') || '';
    const abBindContractPresent = /bind\s*\(\s*\{\s*required\s+String\s+userId\s*\}\s*\)/.test(abService);
    const abBindRuntimeCallPresent = /AbTestService>\(\)\.bind\s*\(\s*userId:\s*userId\s*\)/.test(appRuntime);
    add(
      checks,
      'app_ab_framework_bind_runtime_wired',
      abBindContractPresent && abBindRuntimeCallPresent,
      abBindContractPresent && abBindRuntimeCallPresent
        ? 'A/B bind contract exists and runtime executes bind(userId) after authentication'
        : 'missing A/B bind contract or runtime bind(userId) call path',
    );
  }

  const flutterReleaseChecklist = read('docs/release/checklists/flutter-user-app-checklist-2026.md');
  if (flutterReleaseChecklist) {
    const contradictionMatches = flutterReleaseChecklist
      .split(/\r?\n/)
      .map((line, idx) => ({ line: idx + 1, text: line }))
      .filter(
        (entry) =>
          /^\s*-\s*\[x\]/i.test(entry.text) &&
          /\b(pending|todo|tbd)\b/i.test(entry.text),
      );
    add(
      checks,
      'flutter_release_checklist_no_complete_pending_contradictions',
      contradictionMatches.length === 0,
      contradictionMatches.length === 0
        ? 'no [x] rows contain pending/todo/tbd qualifiers'
        : `contradictory [x] rows at lines ${contradictionMatches.map((m) => m.line).join(', ')}`,
    );
  }

  const masterChecklist = read('docs/Sven_Master_Checklist.md');
  if (masterChecklist) {
    const checkedPlaceholderRows = masterChecklist
      .split(/\r?\n/)
      .map((line, idx) => ({ line: idx + 1, text: line }))
      .filter(
        (entry) =>
          /^\s*-\s*\[x\]/i.test(entry.text) &&
          /\b(placeholder|stubbed?|todo|phase later|scaffold)\b/i.test(entry.text),
      );
    add(
      checks,
      'master_checked_rows_no_placeholder_qualifiers',
      checkedPlaceholderRows.length === 0,
      checkedPlaceholderRows.length === 0
        ? 'no [x] rows contain placeholder/stub/todo/scaffold qualifiers'
        : `downgrade rows to [~] or [ ] at lines ${checkedPlaceholderRows.map((row) => row.line).join(', ')}`,
    );
  }

  const status = checks.every((c) => c.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    strict,
    checks,
  };
  writeArtifacts(payload);

  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

main();
