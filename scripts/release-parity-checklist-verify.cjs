#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const localOnly = process.argv.includes('--local-only') || process.env.SVEN_PARITY_VERIFY_LOCAL_ONLY === '1';
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || process.env.SVEN_TARGET_SHA || '').trim();
const outDir = path.join(root, 'docs', 'release', 'status');
const maxEvidenceAgeHours = Number(process.env.SVEN_PARITY_EVIDENCE_MAX_AGE_HOURS || 168);
const maxDemoEvidenceAgeHours = Number(process.env.SVEN_PARITY_DEMO_EVIDENCE_MAX_AGE_HOURS || 720);
const maxRuntimeEvidenceAgeHours = Number(process.env.SVEN_PARITY_RUNTIME_EVIDENCE_MAX_AGE_HOURS || 72);
const ciGatesRel = 'docs/release/status/ci-gates.json';
const runtimeValidationStatusArtifacts = [
  'docs/release/status/benchmark-suite-latest.json',
  'docs/release/status/api-reliability-observability-latest.json',
  'docs/release/status/mobile-release-readiness-latest.json',
];
const parityWaveCloseoutStatusArtifacts = [
  'docs/release/status/openhands-wave1-closeout-latest.json',
  'docs/release/status/librechat-wave2-closeout-latest.json',
  'docs/release/status/n8n-wave3-closeout-latest.json',
  'docs/release/status/framework-wave4-closeout-latest.json',
  'docs/release/status/crewai-wave5-closeout-latest.json',
  'docs/release/status/letta-wave6-closeout-latest.json',
  'docs/release/status/autogen-wave7-closeout-latest.json',
  'docs/release/status/langgraph-wave8-closeout-latest.json',
  'docs/release/status/parity-all-waves-closeout-latest.json',
];
const checklistRel = 'docs/release/checklists/sven-production-parity-checklist-2026.md';
const checklistPath = path.join(root, checklistRel);
const openClawParityRel = 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md';
const agentZeroParityRel = 'docs/parity/sven-vs-agent-zero-feature-comparison.md';
const parityChecklistRel = 'docs/parity/Sven_Parity_Checklist.md';
const trueParityChecklistRel = 'docs/release/checklists/sven-true-parity-and-beyond-checklist-2026.md';
const competitorBaselineManifestRel = 'docs/parity/competitor-baseline-manifest.json';
const masterChecklistRel = 'docs/Sven_Master_Checklist.md';
const demoEvidenceRel = 'docs/release/evidence/demo-proof-index-2026-03-04.md';
const noScaffoldingAnchor = 'No Scaffolding';
const parityNoTodoScanRoots = String(
  process.env.SVEN_PARITY_NO_TODO_SCAN_ROOTS || 'services/gateway-api/src/routes,services/agent-runtime/src,services/skill-runner/src',
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .join(',');
const parityNoPlaceholderScanRoots = String(
  process.env.SVEN_PARITY_NO_PLACEHOLDER_SCAN_ROOTS ||
    'services/gateway-api/src/routes,services/agent-runtime/src,services/skill-runner/src,services/workflow-executor/src',
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .join(',');
const forbiddenCheckedMaturityTerms = ['placeholder', 'scaffold', 'stub'];
const masterStatusLine = '## Project Status: In Progress (Evidence-Gated)';
const masterOpenItemsGuard =
  'do not treat as 100% complete until all `[ ]` items are closed and release gates are green';

const requiredFiles = [
  'apps/companion-user-flutter/lib/features/chat/chat_service.dart',
  'apps/admin-ui/src/lib/api.ts',
  'services/gateway-api/src/routes/adapter.ts',
  'services/agent-runtime/src/index.ts',
  'services/skill-runner/src/index.ts',
  '.github/workflows/release-supply-chain.yml',
  'docs/release/evidence/mobile/z2-m1-z3-parity-2026-02-24.md',
];

function readUtf8(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function normalizeRefToPath(ref) {
  // Drop markdown line anchors: path:12 or path:12:5
  const noAnchor = ref.replace(/:(\d+)(:\d+)?$/, '');
  return noAnchor.replace(/\\/g, '/');
}

function extractCandidateFileRefs(markdown) {
  const out = new Set();
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    if (raw.includes('<') || raw.includes('>')) continue; // template placeholders
    if (raw.startsWith('http://') || raw.startsWith('https://')) continue;
    if (raw.startsWith('/v1/')) continue; // API endpoint, not repo path
    if (!raw.includes('/')) continue;
    const normalized = normalizeRefToPath(raw);
    if (!/[.][a-zA-Z0-9]+$/.test(normalized)) continue;
    out.add(normalized);
  }
  return Array.from(out).sort();
}

function parseTimestampFromObject(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = ['generated_at', 'generated_at_utc', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp'];
  for (const key of keys) {
    const raw = value[key];
    if (!raw) continue;
    const parsed = Date.parse(String(raw));
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

function parseTimestampFromEvidenceMarkdown(relPath, markdown, stat) {
  const explicit = markdown.match(/^(Date|Generated)\s*:\s*(.+)$/im);
  if (explicit && explicit[2]) {
    const parsed = Date.parse(String(explicit[2]).trim());
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const fileDate = relPath.match(/-(\d{4}-\d{2}-\d{2})\.md$/i);
  if (fileDate && fileDate[1]) {
    const parsed = Date.parse(`${fileDate[1]}T00:00:00Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return stat?.mtime?.toISOString?.() || null;
}

function extractInlineCodeRefs(text) {
  const refs = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    refs.push(normalizeRefToPath(raw));
  }
  return refs;
}

function isEvidenceMarkdownBlocking(markdown) {
  // Fail checked claims when attached evidence explicitly reports partial/fail/blocked status.
  const blockers = [
    /(?:^|\n)\s*status\s*:\s*(partially\s+unblocked|partial|blocked|fail|failed|inconclusive)\b/i,
    /(?:^|\n)\s*status\s*-\s*(partially\s+unblocked|partial|blocked|fail|failed|inconclusive)\b/i,
    /\bcurrent\s+blocker\b/i,
    /\bunavailable\b/i,
    /\bnot\s+executed\s+here\b/i,
    /\btotal\s*:\s*0\b/i,
  ];
  return blockers.some((pattern) => pattern.test(markdown));
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function readJsonSafe(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function parseTrackSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tracks = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^###\s+([A-Z]\d+[^\n]*)$/);
    if (heading) {
      if (current) tracks.push(current);
      current = { title: heading[1].trim(), lines: [] };
      continue;
    }
    if (current && /^##\s+/.test(line)) {
      tracks.push(current);
      current = null;
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) tracks.push(current);
  return tracks;
}

function findNearestTrackId(lines, fromIndex) {
  for (let i = fromIndex; i >= 0; i -= 1) {
    const heading = String(lines[i] || '').match(/^###\s+([A-Z]\d+(?:\.\d+)*)\b/);
    if (heading) return heading[1];
  }
  return null;
}

function parseFeatureIds(markdown) {
  if (!markdown) return [];
  const out = new Set();
  const headingRe = /^###\s+([A-Z]\d+(?:\.\d+)*)\b/gm;
  let m;
  while ((m = headingRe.exec(markdown)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}

function parseFeatureIdsFromDemoIndex(markdown) {
  if (!markdown) return [];
  const out = new Set();
  const lineRe = /Feature IDs?\s*:\s*([^\n]+)/gi;
  let m;
  while ((m = lineRe.exec(markdown)) !== null) {
    const raw = String(m[1] || '');
    for (const token of raw.split(/[,\s]+/)) {
      const normalized = token.replace(/[^A-Za-z0-9.]/g, '').trim().toUpperCase();
      if (/^[A-Z]\d+(?:\.\d+)*$/.test(normalized)) out.add(normalized);
    }
  }
  return Array.from(out);
}

function parseDashboardTrackStatuses(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    if (!/^\|\s*\*\*[A-Z]\*\*/.test(line)) continue;
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length < 3) continue;
    const trackCell = cells[0];
    const statusCell = cells[2];
    const trackMatch = trackCell.match(/\*\*([A-Z])\*\*/);
    if (!trackMatch) continue;
    out[trackMatch[1]] = statusCell;
  }
  return out;
}

function classifyRefs(refs) {
  const testRefs = refs.filter((ref) => /(__tests__|\/test\/|\.test\.)/i.test(ref));
  const evidenceRefs = refs.filter((ref) => ref.startsWith('docs/release/evidence/') || ref.startsWith('docs/release/status/'));
  const codeRefs = refs.filter((ref) => {
    if (ref.startsWith('docs/')) return false;
    return /\.(cjs|js|mjs|ts|tsx|dart|sql|ya?ml|ps1|sh|cmd)$/i.test(ref);
  });
  return { testRefs, evidenceRefs, codeRefs };
}

function parseMatchedComparisonRows(markdown) {
  if (!markdown) return [];
  const rows = [];
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    const status = cells[2];
    if (!/^✅/.test(status)) continue;
    rows.push({
      feature_id: cells[0],
      status,
      notes: cells.slice(3).join(' | ').trim(),
    });
  }
  return rows;
}

function parseMasterChecklistReleaseControls(lines) {
  const ciHeadingIndex = lines.findIndex((line) => /^\s*-\s\[[xX ]\]\s\*\*CI pipeline\*\*/.test(line));
  if (ciHeadingIndex < 0) {
    return { ciSectionFound: false, nestedChecks: 0, nestedUnchecked: 0 };
  }
  let nestedChecks = 0;
  let nestedUnchecked = 0;
  for (let i = ciHeadingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s{2,}-\s\[[xX ]\]\s/.test(line)) {
      nestedChecks += 1;
      if (/^\s{2,}-\s\[\s\]\s/.test(line)) nestedUnchecked += 1;
      continue;
    }
    if (/^\s*-\s\[[xX ]\]\s/.test(line) || /^\s*---\s*$/.test(line)) {
      break;
    }
  }
  return { ciSectionFound: true, nestedChecks, nestedUnchecked };
}

function verifyChecklist() {
  const checks = [];
  const body = readUtf8(checklistRel);
  const masterChecklist = readUtf8(masterChecklistRel);
  if (!body) {
    checks.push({
      id: 'checklist_present',
      pass: false,
      detail: `${checklistRel} missing`,
    });
    return checks;
  }

  checks.push({
    id: 'checklist_present',
    pass: true,
    detail: checklistRel,
  });
  checks.push({
    id: 'parity_no_scaffolding_principle_present',
    pass: body.includes(noScaffoldingAnchor),
    detail: body.includes(noScaffoldingAnchor)
      ? `found="${noScaffoldingAnchor}"`
      : `missing principle "${noScaffoldingAnchor}"`,
  });
  const demoEvidenceBody = readUtf8(demoEvidenceRel);
  const checklistMentionsDemoEvidence = body.includes(demoEvidenceRel);
  const acceptedDemoArtifactPattern = /`([^`]+\.(?:mp4|mov|webm|png|jpe?g))`/gi;
  const acceptedDemoArtifactExt = /\.(mp4|mov|webm|png|jpe?g)$/i;
  const timestampedArtifactPattern = /(19|20)\d{2}(?:[-_]?)(0[1-9]|1[0-2])(?:[-_]?)(0[1-9]|[12]\d|3[01])(?:[-_]?([01]\d|2[0-3])([0-5]\d)([0-5]\d)?)?/;
  const demoArtifacts = [];
  if (demoEvidenceBody) {
    let match;
    while ((match = acceptedDemoArtifactPattern.exec(demoEvidenceBody)) !== null) {
      demoArtifacts.push(match[1]);
    }
  }
  const missingDemoArtifacts = demoArtifacts.filter((ref) => !fs.existsSync(path.join(root, normalizeRefToPath(ref))));
  checks.push({
    id: 'parity_demo_evidence_present',
    pass: Boolean(checklistMentionsDemoEvidence && demoEvidenceBody && demoArtifacts.length > 0 && missingDemoArtifacts.length === 0),
    detail:
      checklistMentionsDemoEvidence && demoEvidenceBody && demoArtifacts.length > 0 && missingDemoArtifacts.length === 0
        ? `demo index present (${demoEvidenceRel}); artifacts=${demoArtifacts.length}`
        : `missing demo evidence linkage/index/artifacts (index=${demoEvidenceRel})`,
  });
  const demoArtifactsHaveAcceptedFormat = demoArtifacts.length > 0 && demoArtifacts.every((ref) => acceptedDemoArtifactExt.test(ref));
  checks.push({
    id: 'parity_demo_evidence_format_valid',
    pass: demoArtifactsHaveAcceptedFormat,
    detail: demoArtifactsHaveAcceptedFormat
      ? `artifacts=${demoArtifacts.length}; accepted=.mp4/.mov/.webm/.png/.jpg/.jpeg`
      : 'demo artifacts missing or contain non-accepted formats',
  });
  const timestampedArtifacts = demoArtifacts.filter((ref) => timestampedArtifactPattern.test(path.basename(ref)));
  const isSingleVideo = demoArtifacts.length === 1 && /\.(mp4|mov|webm)$/i.test(demoArtifacts[0] || '');
  const timestampProofPass = isSingleVideo || timestampedArtifacts.length === demoArtifacts.length;
  checks.push({
    id: 'parity_demo_evidence_timestamped_capture',
    pass: timestampProofPass,
    detail: timestampProofPass
      ? (isSingleVideo
        ? 'single video artifact accepted'
        : `timestamped_artifacts=${timestampedArtifacts.length}/${demoArtifacts.length}`)
      : `timestamped_artifacts=${timestampedArtifacts.length}/${demoArtifacts.length}; expected timestamped sequence or single video`,
  });
  const demoEvidenceStat = fs.existsSync(path.join(root, demoEvidenceRel))
    ? fs.statSync(path.join(root, demoEvidenceRel))
    : null;
  const demoEvidenceTimestamp = demoEvidenceBody
    ? parseTimestampFromEvidenceMarkdown(demoEvidenceRel, demoEvidenceBody, demoEvidenceStat)
    : null;
  const demoEvidenceAge = ageHours(demoEvidenceTimestamp);
  const demoEvidenceFresh =
    typeof demoEvidenceAge === 'number' && Number.isFinite(demoEvidenceAge) && demoEvidenceAge <= maxDemoEvidenceAgeHours;
  checks.push({
    id: 'parity_demo_evidence_freshness',
    pass: demoEvidenceFresh,
    detail: demoEvidenceFresh
      ? `age_hours=${demoEvidenceAge.toFixed(2)}; max_age_hours=${maxDemoEvidenceAgeHours}`
      : `timestamp=${demoEvidenceTimestamp || 'missing'}; max_age_hours=${maxDemoEvidenceAgeHours}`,
  });
  const checklistFeatureIds = parseFeatureIds(body);
  const demoFeatureIds = parseFeatureIdsFromDemoIndex(demoEvidenceBody || '');
  const validDemoFeatureIds = demoFeatureIds.filter((id) => checklistFeatureIds.includes(id));
  checks.push({
    id: 'parity_demo_evidence_feature_linked',
    pass: checklistFeatureIds.length === 0 ? demoFeatureIds.length > 0 : validDemoFeatureIds.length > 0,
    detail:
      checklistFeatureIds.length === 0
        ? `checklist_feature_ids_missing; demo_feature_ids=${demoFeatureIds.join(', ') || 'none'}`
        : `linked_feature_ids=${validDemoFeatureIds.join(', ') || 'none'}; checklist_features=${checklistFeatureIds.length}`,
  });

  const lines = body.split(/\r?\n/);
  const checkedRows = [];
  const checkedRowsMissingEvidence = [];
  const checkedRowsMissingReleaseArtifactBinding = [];
  const checkedRowsWithNonPassingEvidence = [];
  const checkedClaimRows = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/^\s*-\s\[[xX]\]\s/.test(line)) continue;
    checkedRows.push(i + 1);
    let hasEvidenceRef = /`(?:docs\/|services\/|apps\/|packages\/|scripts\/|config\/)[^`]+`/.test(line);
    const rowRefs = extractInlineCodeRefs(line);
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (/^\s*-\s\[[^\]]\]\s/.test(next)) break;
      if (!/^\s*[-*]\s/.test(next) && next.trim() !== '') continue;
      rowRefs.push(...extractInlineCodeRefs(next));
      if (/evidence\s*:/i.test(next) && /`[^`]+`/.test(next)) {
        hasEvidenceRef = true;
      }
    }
    if (!hasEvidenceRef) checkedRowsMissingEvidence.push(i + 1);
    const releaseRefs = Array.from(
      new Set(
        rowRefs.filter((ref) => ref.startsWith('docs/release/evidence/') || ref.startsWith('docs/release/status/')),
      ),
    );
    const classified = classifyRefs(rowRefs);
    const rowStatusArtifactRefs = releaseRefs.filter((ref) => ref.startsWith('docs/release/status/') && /\.json$/i.test(ref));
    const trackId = findNearestTrackId(lines, i);
    checkedClaimRows.push({
      line: i + 1,
      track_id: trackId,
      claim_id: trackId ? `${trackId}@L${i + 1}` : null,
      test_refs: classified.testRefs,
      code_refs: classified.codeRefs,
      status_artifact_refs: rowStatusArtifactRefs,
      release_refs: releaseRefs,
    });
    if (releaseRefs.length === 0) {
      checkedRowsMissingReleaseArtifactBinding.push(i + 1);
      continue;
    }
    for (const rel of releaseRefs) {
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) continue;
      if (/\.json$/i.test(rel)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
          const status = String(parsed?.status || '').trim().toLowerCase();
          if (status && status !== 'pass') {
            checkedRowsWithNonPassingEvidence.push(`${i + 1}:${rel}:${status}`);
          }
        } catch {
          checkedRowsWithNonPassingEvidence.push(`${i + 1}:${rel}:invalid-json`);
        }
        continue;
      }
      if (/\.md$/i.test(rel)) {
        const markdown = fs.readFileSync(full, 'utf8');
        if (isEvidenceMarkdownBlocking(markdown)) {
          checkedRowsWithNonPassingEvidence.push(`${i + 1}:${rel}:status-partial-or-fail`);
        }
      }
    }
  }
  checks.push({
    id: 'production_checklist_checked_rows_have_evidence_refs',
    pass: checkedRowsMissingEvidence.length === 0,
    detail:
      checkedRowsMissingEvidence.length === 0
        ? `checked_rows=${checkedRows.length}; missing_evidence=0`
        : `checked_rows=${checkedRows.length}; missing_evidence=${checkedRowsMissingEvidence.length}; lines=${checkedRowsMissingEvidence.slice(0, 25).join(', ')}`,
  });
  checks.push({
    id: 'production_checklist_checked_rows_have_release_artifact_binding',
    pass: checkedRowsMissingReleaseArtifactBinding.length === 0,
    detail:
      checkedRowsMissingReleaseArtifactBinding.length === 0
        ? `checked_rows=${checkedRows.length}; missing_release_artifact_binding=0`
        : `checked_rows=${checkedRows.length}; missing_release_artifact_binding=${checkedRowsMissingReleaseArtifactBinding.length}; lines=${checkedRowsMissingReleaseArtifactBinding
            .slice(0, 25)
            .join(', ')}`,
  });
  checks.push({
    id: 'production_checklist_checked_rows_reference_non_partial_evidence',
    pass: checkedRowsWithNonPassingEvidence.length === 0,
    detail:
      checkedRowsWithNonPassingEvidence.length === 0
        ? `checked_rows=${checkedRows.length}; non_passing_evidence_refs=0`
        : `non_passing_evidence_refs=${checkedRowsWithNonPassingEvidence
            .slice(0, 25)
            .join(', ')}`,
  });
  const trackClaimEvidence = new Map();
  for (const claim of checkedClaimRows) {
    if (!claim.track_id) continue;
    const existing = trackClaimEvidence.get(claim.track_id) || {
      test_refs: new Set(),
      release_refs: new Set(),
      code_refs: new Set(),
    };
    for (const ref of claim.test_refs) existing.test_refs.add(ref);
    for (const ref of claim.release_refs) existing.release_refs.add(ref);
    for (const ref of claim.code_refs) existing.code_refs.add(ref);
    trackClaimEvidence.set(claim.track_id, existing);
  }
  const claimsMissingMachineId = checkedClaimRows.filter((claim) => !claim.claim_id).map((claim) => claim.line);
  const claimsMissingTraceability = [];
  for (const claim of checkedClaimRows) {
    const trackEvidence = claim.track_id ? trackClaimEvidence.get(claim.track_id) : null;
    const mappedTestCount = claim.test_refs.length || (trackEvidence ? trackEvidence.test_refs.size : 0);
    const mappedReleaseCount = claim.release_refs.length || (trackEvidence ? trackEvidence.release_refs.size : 0);
    const mappedCodeCount = claim.code_refs.length || (trackEvidence ? trackEvidence.code_refs.size : 0);
    if (mappedTestCount === 0 || mappedReleaseCount === 0 || mappedCodeCount === 0) {
      claimsMissingTraceability.push(claim.claim_id || `line:${claim.line}`);
    }
  }
  checks.push({
    id: 'production_checklist_checked_rows_have_machine_claim_ids',
    pass: claimsMissingMachineId.length === 0,
    detail:
      claimsMissingMachineId.length === 0
        ? `checked_claim_rows=${checkedClaimRows.length}; missing_claim_ids=0`
        : `missing_claim_ids=${claimsMissingMachineId.length}; lines=${claimsMissingMachineId.slice(0, 25).join(', ')}`,
  });
  checks.push({
    id: 'production_checklist_checked_claims_traceable_to_tests_and_status_artifacts',
    pass: claimsMissingTraceability.length === 0,
    detail:
      claimsMissingTraceability.length === 0
        ? `checked_claim_rows=${checkedClaimRows.length}; unmapped_claims=0`
        : `unmapped_claims=${claimsMissingTraceability.slice(0, 25).join(', ')}`,
  });

  const unchecked = [];
  lines.forEach((line, idx) => {
    if (/^\s*-\s\[\s\]\s/.test(line)) {
      unchecked.push({ line: idx + 1, text: line.trim() });
    }
  });
  checks.push({
    id: 'checklist_no_unchecked_items',
    pass: unchecked.length === 0,
    detail:
      unchecked.length === 0
        ? 'all checklist boxes are checked'
        : `unchecked=${unchecked.length}`,
  });

  const parityChecklistBodyForSignoff = readUtf8(parityChecklistRel);
  const parityHasSignoffSection = /##\s*48\)\s*Production Sign-off Checklist/i.test(parityChecklistBodyForSignoff || '');
  const parityWeek4ReleaseTargetChecked =
    /^\s*-\s\[[xX]\]\s*Week 4 target: v0\.2\.0 RC \+ soak \+ cut release/m.test(parityChecklistBodyForSignoff || '');
  const paritySoakGateUnchecked =
    /^\s*-\s\[\s\]\s*Release candidate runs 72h soak without Sev1\/Sev2 incident/m.test(parityChecklistBodyForSignoff || '');
  const parityD9GateUnchecked =
    /^\s*-\s\[\s\]\s*D9 Keycloak live OIDC interop gate passes in CI/m.test(parityChecklistBodyForSignoff || '');
  const parityBlockingGatesOpen = paritySoakGateUnchecked || parityD9GateUnchecked;
  checks.push({
    id: 'parity_signoff_blockers_not_overstated',
    pass: Boolean(parityChecklistBodyForSignoff) && parityHasSignoffSection && !(parityWeek4ReleaseTargetChecked && parityBlockingGatesOpen),
    detail:
      !parityChecklistBodyForSignoff
        ? `${parityChecklistRel} missing`
        : !parityHasSignoffSection
          ? 'missing production sign-off checklist section'
          : parityWeek4ReleaseTargetChecked && parityBlockingGatesOpen
            ? `week4_target_checked=true while blocking_gates_open (soak_open=${paritySoakGateUnchecked}; d9_live_open=${parityD9GateUnchecked})`
            : `week4_target_checked=${parityWeek4ReleaseTargetChecked}; soak_open=${paritySoakGateUnchecked}; d9_live_open=${parityD9GateUnchecked}`,
  });

  const trueParityChecklistBody = readUtf8(trueParityChecklistRel);
  if (!trueParityChecklistBody) {
    checks.push({
      id: 'true_parity_checklist_present',
      pass: false,
      detail: `${trueParityChecklistRel} missing`,
    });
  } else {
    checks.push({
      id: 'true_parity_checklist_present',
      pass: true,
      detail: `${trueParityChecklistRel} present`,
    });

    const uppercaseCheckboxMatches = [...trueParityChecklistBody.matchAll(/^\s*-\s*\[X\]/gm)];
    checks.push({
      id: 'true_parity_checkbox_notation_lowercase_consistent',
      pass: uppercaseCheckboxMatches.length === 0,
      detail:
        uppercaseCheckboxMatches.length === 0
          ? 'no uppercase [X] checkbox markers detected'
          : `uppercase_[X]_rows=${uppercaseCheckboxMatches.length}`,
    });

    const trueParityRefs = extractCandidateFileRefs(trueParityChecklistBody);
    const trueParityEvidenceRefs = trueParityRefs.filter((ref) => ref.startsWith('docs/release/evidence/'));
    const missingTrueParityEvidenceRefs = trueParityEvidenceRefs.filter((ref) => !fs.existsSync(path.join(root, ref)));
    checks.push({
      id: 'true_parity_referenced_evidence_files_exist',
      pass: missingTrueParityEvidenceRefs.length === 0,
      detail:
        missingTrueParityEvidenceRefs.length === 0
          ? `referenced_evidence=${trueParityEvidenceRefs.length}`
          : `missing=${missingTrueParityEvidenceRefs.join(', ')}`,
    });

  }

  const referenced = extractCandidateFileRefs(body);
  const missingReferenced = referenced.filter((rel) => !fs.existsSync(path.join(root, rel)));
  checks.push({
    id: 'checklist_referenced_files_exist',
    pass: missingReferenced.length === 0,
    detail:
      missingReferenced.length === 0
        ? `referenced_files=${referenced.length}`
        : `missing=${missingReferenced.join(', ')}`,
  });

  const missingRequired = requiredFiles.filter((rel) => !fs.existsSync(path.join(root, rel)));
  checks.push({
    id: 'parity_required_files_exist',
    pass: missingRequired.length === 0,
    detail:
      missingRequired.length === 0
        ? `required_files=${requiredFiles.length}`
        : `missing=${missingRequired.join(', ')}`,
  });
  const requiredScopeGroups = {
    mobile_app: requiredFiles.some((rel) => rel.startsWith('apps/companion-user-flutter/')),
    admin_ui: requiredFiles.some((rel) => rel.startsWith('apps/admin-ui/')),
    gateway_api: requiredFiles.some((rel) => rel.startsWith('services/gateway-api/')),
    agent_runtime: requiredFiles.some((rel) => rel.startsWith('services/agent-runtime/')),
    skill_runner: requiredFiles.some((rel) => rel.startsWith('services/skill-runner/')),
    ci_workflow: requiredFiles.some((rel) => rel.startsWith('.github/workflows/')),
    release_evidence: requiredFiles.some((rel) => rel.startsWith('docs/release/evidence/')),
  };
  const missingRequiredScopeGroups = Object.entries(requiredScopeGroups)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  checks.push({
    id: 'parity_required_files_scope_balanced',
    pass: missingRequiredScopeGroups.length === 0,
    detail:
      missingRequiredScopeGroups.length === 0
        ? `required_scope_groups=${Object.keys(requiredScopeGroups).length}`
        : `missing_scope_groups=${missingRequiredScopeGroups.join(', ')}`,
  });

  const openClawParity = readUtf8(openClawParityRel);
  const agentZeroParity = readUtf8(agentZeroParityRel);
  const parityChecklist = readUtf8(parityChecklistRel);
  const competitorBaselineManifestRaw = readUtf8(competitorBaselineManifestRel);
  if (!openClawParity) {
    checks.push({
      id: 'openclaw_skill_command_consistency',
      pass: false,
      detail: `${openClawParityRel} missing`,
    });
  } else {
    const chatCommandRowMentionsSkillImplemented =
      /\|\s*2\.14\s*\|[\s\S]*?\/skill[\s\S]*?\|\s*✅\s*\|/i.test(openClawParity);
    const skillRowSaysNoSkillChatCommandYet =
      /\|\s*5\.9\s*\|[\s\S]*?no\s+`?\/skill`?\s+chat\s+command\s+yet/i.test(openClawParity);
    checks.push({
      id: 'openclaw_skill_command_consistency',
      pass: !(chatCommandRowMentionsSkillImplemented && skillRowSaysNoSkillChatCommandYet),
      detail:
        chatCommandRowMentionsSkillImplemented && skillRowSaysNoSkillChatCommandYet
          ? 'conflict: row 2.14 marks /skill implemented while row 5.9 says /skill chat command not implemented'
          : 'skill command rows are internally consistent',
    });

    const staleGapRows = [
      { id: 'G1', marker: 'Missing Channels', featureDoneHint: 'adapter services implemented' },
      { id: 'G6', marker: 'Cross-Channel Identity', featureDoneHint: 'row 2.25' },
      { id: 'G8', marker: 'OpenAI-Compatible API', featureDoneHint: 'row 1.16' },
      { id: 'G12', marker: 'Model Picker Command', featureDoneHint: 'row 6.18' },
      { id: 'G14', marker: 'Self-Chat Mode', featureDoneHint: 'row 2.27' },
      { id: 'G15', marker: 'LiteLLM Proxy', featureDoneHint: 'row 1.22' },
      { id: 'G17', marker: 'Config Includes', featureDoneHint: 'row 1.12' },
      { id: 'P8', marker: 'Model Alias Shortcuts', featureDoneHint: 'row 6.16' },
    ];
    const staleGapConflicts = [];
    for (const row of staleGapRows) {
      const rowRegex = new RegExp(`\\|\\s*${row.id}\\s*\\|[^\\n]*${row.marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[^\\n]*\\|`, 'i');
      const rowLine = openClawParity.match(rowRegex)?.[0] || '';
      if (!rowLine) continue;
      const rowNormalized = rowLine.toLowerCase();
      const rowMarkedHistorical = /(historical|done)/i.test(rowLine);
      const rowStillOpen = /\|\s*p[123](?:\/p[123])?\s*\|/i.test(rowLine);
      if (rowStillOpen && !rowMarkedHistorical) {
        staleGapConflicts.push(`${row.id}:${row.marker}`);
      }
    }
    checks.push({
      id: 'openclaw_gap_ledger_consistency',
      pass: staleGapConflicts.length === 0,
      detail:
        staleGapConflicts.length === 0
          ? 'gap ledger reconciled with implemented ✅ feature rows (or explicitly marked historical)'
          : `stale_gap_rows=${staleGapConflicts.join(', ')}`,
    });

    const channelsScorecardMatch = openClawParity.match(
      /^\|\s*Channels\s*&\s*Messaging\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/m,
    );
    const channelsScorecard = channelsScorecardMatch
      ? {
          openclaw: Number(channelsScorecardMatch[1]),
          matched: Number(channelsScorecardMatch[2]),
          partial: Number(channelsScorecardMatch[3]),
          missing: Number(channelsScorecardMatch[4]),
          svenOnly: Number(channelsScorecardMatch[5]),
        }
      : null;
    const channelRowMatches = [...openClawParity.matchAll(/^\|\s*2\.\d+\s*\|.*\|\s*(✅\+?|⚠️|❌)\s*\|.*$/gm)];
    const channelRowCounts = {
      matched: channelRowMatches.filter((row) => row[1].startsWith('✅')).length,
      partial: channelRowMatches.filter((row) => row[1] === '⚠️').length,
      missing: channelRowMatches.filter((row) => row[1] === '❌').length,
      total: channelRowMatches.length,
    };
    const channelScorecardConsistent =
      Boolean(channelsScorecard) &&
      channelsScorecard.matched === channelRowCounts.matched &&
      channelsScorecard.partial === channelRowCounts.partial &&
      channelsScorecard.missing === channelRowCounts.missing;
    checks.push({
      id: 'openclaw_channels_scorecard_consistency',
      pass: channelScorecardConsistent,
      detail: channelsScorecard
        ? `scorecard(m=${channelsScorecard.matched},p=${channelsScorecard.partial},x=${channelsScorecard.missing}) vs rows(m=${channelRowCounts.matched},p=${channelRowCounts.partial},x=${channelRowCounts.missing},total=${channelRowCounts.total})`
        : 'channels scorecard row missing',
    });

    const matchedRows = [...openClawParity.matchAll(/^\|\s*[\w.]+\s*\|.*\|\s*(✅\+?|⚠️|❌)\s*\|\s*(.*?)\s*\|?$/gm)];
    const checklistOnlyMatchedRows = [];
    for (const row of matchedRows) {
      const status = row[1];
      const notes = String(row[2] || '');
      if (!status.startsWith('✅')) continue;
      const citesChecklistOnly =
        /Sven_Parity_Checklist\.md/i.test(notes) &&
        !/`[^`]*\.(?:ts|tsx|js|mjs|cjs|dart|sql|ya?ml|md|json)`/.test(notes) &&
        !/`[^`]*__tests__[^`]*`/.test(notes);
      if (citesChecklistOnly) checklistOnlyMatchedRows.push(notes.slice(0, 120));
    }
    checks.push({
      id: 'openclaw_no_checklist_only_evidence_for_matched_rows',
      pass: checklistOnlyMatchedRows.length === 0,
      detail:
        checklistOnlyMatchedRows.length === 0
          ? 'all ✅ rows include direct code/test/evidence references or non-circular notes'
          : `checklist_only_rows=${checklistOnlyMatchedRows.length}`,
    });
  }

  const openClawMatchedRows = parseMatchedComparisonRows(openClawParity);
  const openClawIndirectionRows = openClawMatchedRows.filter((row) =>
    /implemented\s+in\s+parity\s+track/i.test(String(row.notes || '')),
  );
  checks.push({
    id: 'openclaw_no_parity_track_indirection_for_matched_rows',
    pass: openClawIndirectionRows.length === 0,
    detail:
      openClawIndirectionRows.length === 0
        ? `matched_rows=${openClawMatchedRows.length}`
        : `indirection_rows=${openClawIndirectionRows.length}`,
  });
  const openClawRowsMissingEvidenceBinding = openClawMatchedRows.filter((row) => {
    const refs = extractCandidateFileRefs(row.notes);
    const { testRefs, evidenceRefs, codeRefs } = classifyRefs(refs);
    return testRefs.length === 0 || evidenceRefs.length === 0 || codeRefs.length === 0;
  });
  checks.push({
    id: 'openclaw_comparison_matched_rows_have_evidence_bindings',
    pass: openClawRowsMissingEvidenceBinding.length === 0,
    detail:
      openClawRowsMissingEvidenceBinding.length === 0
        ? `matched_rows=${openClawMatchedRows.length}`
        : `rows_missing_bindings=${openClawRowsMissingEvidenceBinding.length}`,
  });

  if (!agentZeroParity) {
    checks.push({
      id: 'agentzero_comparison_matched_rows_have_evidence_bindings',
      pass: false,
      detail: `${agentZeroParityRel} missing`,
    });
  } else {
    const agentZeroMatchedRows = parseMatchedComparisonRows(agentZeroParity);
    const agentZeroIndirectionRows = agentZeroMatchedRows.filter((row) =>
      /implemented\s+in\s+parity\s+track/i.test(String(row.notes || '')),
    );
    checks.push({
      id: 'agentzero_no_parity_track_indirection_for_matched_rows',
      pass: agentZeroIndirectionRows.length === 0,
      detail:
        agentZeroIndirectionRows.length === 0
          ? `matched_rows=${agentZeroMatchedRows.length}`
          : `indirection_rows=${agentZeroIndirectionRows.length}`,
    });
    const agentZeroRowsMissingEvidenceBinding = agentZeroMatchedRows.filter((row) => {
      const refs = extractCandidateFileRefs(row.notes);
      const { testRefs, evidenceRefs, codeRefs } = classifyRefs(refs);
      return testRefs.length === 0 || evidenceRefs.length === 0 || codeRefs.length === 0;
    });
    checks.push({
      id: 'agentzero_comparison_matched_rows_have_evidence_bindings',
      pass: agentZeroRowsMissingEvidenceBinding.length === 0,
      detail:
        agentZeroRowsMissingEvidenceBinding.length === 0
          ? `matched_rows=${agentZeroMatchedRows.length}`
          : `rows_missing_bindings=${agentZeroRowsMissingEvidenceBinding.length}`,
    });
  }

  const comparisonDensityTargets = [
    { id: 'openclaw', rel: openClawParityRel, body: openClawParity },
    { id: 'agentzero', rel: agentZeroParityRel, body: agentZeroParity },
  ];
  for (const target of comparisonDensityTargets) {
    if (!target.body) continue;
    const matchedRows = parseMatchedComparisonRows(target.body);
    const refCounts = matchedRows.map((row) => extractCandidateFileRefs(row.notes).length);
    const totalRefs = refCounts.reduce((acc, n) => acc + n, 0);
    const avgRefs = matchedRows.length > 0 ? totalRefs / matchedRows.length : 0;
    const pass = matchedRows.length === 0 ? true : avgRefs >= 2;
    checks.push({
      id: `${target.id}_comparison_evidence_density_minimum`,
      pass,
      detail:
        matchedRows.length === 0
          ? 'no matched rows'
          : `matched_rows=${matchedRows.length}; total_refs=${totalRefs}; avg_refs_per_row=${avgRefs.toFixed(2)}; min_required=2.00`,
    });
  }

  if (!competitorBaselineManifestRaw) {
    checks.push({
      id: 'parity_competitor_baseline_manifest_present',
      pass: false,
      detail: `${competitorBaselineManifestRel} missing`,
    });
  } else {
    checks.push({
      id: 'parity_competitor_baseline_manifest_present',
      pass: true,
      detail: competitorBaselineManifestRel,
    });
    let manifest;
    try {
      manifest = JSON.parse(competitorBaselineManifestRaw);
    } catch {
      manifest = null;
    }
    const requiredCompetitors = ['openclaw', 'agent_zero'];
    const baselines = Array.isArray(manifest?.baselines) ? manifest.baselines : [];
    const movingRefPattern = /\b(latest|main|master|head|trunk)\b/i;
    const missingOrInvalid = [];
    for (const name of requiredCompetitors) {
      const entry = baselines.find((row) => String(row?.competitor || '').toLowerCase() === name);
      if (!entry) {
        missingOrInvalid.push(`${name}:missing`);
        continue;
      }
      const baselineType = String(entry.baseline_type || '').trim().toLowerCase();
      const baselineVersion = String(entry.baseline_version || '').trim();
      const repo = String(entry.repo || '').trim();
      const snapshotDate = String(entry.source_snapshot_date || '').trim();
      if (!repo || !/^https?:\/\//i.test(repo)) {
        missingOrInvalid.push(`${name}:repo`);
      }
      if (!baselineType || !['version', 'commit', 'tag', 'snapshot'].includes(baselineType)) {
        missingOrInvalid.push(`${name}:baseline_type`);
      }
      if (!baselineVersion || movingRefPattern.test(baselineVersion)) {
        missingOrInvalid.push(`${name}:baseline_version`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
        missingOrInvalid.push(`${name}:source_snapshot_date`);
      }
    }
    checks.push({
      id: 'parity_competitor_baseline_manifest_valid',
      pass: missingOrInvalid.length === 0,
      detail:
        missingOrInvalid.length === 0
          ? 'competitor baseline manifest includes pinned non-moving baseline metadata for openclaw + agent_zero'
          : `invalid_baseline_entries=${missingOrInvalid.join(', ')}`,
    });
  }

  const baselineLinkedInOpenClaw = Boolean(openClawParity && openClawParity.includes(competitorBaselineManifestRel));
  const baselineLinkedInAgentZero = Boolean(agentZeroParity && agentZeroParity.includes(competitorBaselineManifestRel));
  checks.push({
    id: 'parity_docs_link_competitor_baseline_manifest',
    pass: baselineLinkedInOpenClaw && baselineLinkedInAgentZero,
    detail:
      baselineLinkedInOpenClaw && baselineLinkedInAgentZero
        ? 'both parity docs link competitor baseline manifest'
        : `missing_links=${[
            !baselineLinkedInOpenClaw ? openClawParityRel : null,
            !baselineLinkedInAgentZero ? agentZeroParityRel : null,
          ]
            .filter(Boolean)
            .join(', ')}`,
  });

  const sourceLine =
    parityChecklist
      ?.split(/\r?\n/)
      .find((line) => line.includes('> **Source**:') && line.includes('sven-vs-agent-zero-feature-comparison.md')) || '';
  const sourceAzRev = sourceLine.match(/sven-vs-agent-zero-feature-comparison\.md`\s*\(rev\s*(\d+)/i)?.[1] || null;
  const sourceOcRev = sourceLine.match(/Sven_vs_OpenClaw_Feature_Comparison\.md`\s*\(rev\s*(\d+)/i)?.[1] || null;
  const azCanonicalRev =
    agentZeroParity?.match(/Parity status\s*\(rev\s*(\d+)\)/i)?.[1] ||
    agentZeroParity?.match(/Last updated:[^\n]*\(rev\s*(\d+)\)/i)?.[1] ||
    null;
  const ocCanonicalRev =
    openClawParity?.match(/Updated parity status\s*\(rev\s*(\d+)\)/i)?.[1] ||
    openClawParity?.match(/Last updated:[^\n]*\(rev\s*(\d+)\)/i)?.[1] ||
    null;
  checks.push({
    id: 'parity_source_revision_metadata_consistent',
    pass:
      Boolean(parityChecklist && sourceLine && sourceAzRev && sourceOcRev && azCanonicalRev && ocCanonicalRev) &&
      sourceAzRev === azCanonicalRev &&
      sourceOcRev === ocCanonicalRev,
    detail:
      Boolean(parityChecklist && sourceLine && sourceAzRev && sourceOcRev && azCanonicalRev && ocCanonicalRev) &&
      sourceAzRev === azCanonicalRev &&
      sourceOcRev === ocCanonicalRev
        ? `source revisions aligned (AZ rev ${sourceAzRev}, OC rev ${sourceOcRev})`
        : `revision_mismatch source_az=${sourceAzRev || 'missing'} canonical_az=${azCanonicalRev || 'missing'} source_oc=${sourceOcRev || 'missing'} canonical_oc=${ocCanonicalRev || 'missing'}`,
  });

  const noTodoScript = path.join(root, 'scripts', 'check-no-todo.js');
  if (!fs.existsSync(noTodoScript)) {
    checks.push({
      id: 'parity_no_todo_scope_clean',
      pass: true,
      detail: 'skipped (scripts/check-no-todo.js missing in current workspace)',
    });
  } else {
    const noTodo = spawnSync(process.execPath, [noTodoScript], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SVEN_CHECK_NO_TODO_SCAN_ROOTS: parityNoTodoScanRoots },
    });
    checks.push({
      id: 'parity_no_todo_scope_clean',
      pass: noTodo.status === 0,
      detail:
        noTodo.status === 0
          ? `clean scope=${parityNoTodoScanRoots}`
          : `TODO/FIXME markers found in scoped production paths (${parityNoTodoScanRoots})`,
    });
  }

  const noPlaceholderScript = path.join(root, 'scripts', 'check-no-placeholder.js');
  if (!fs.existsSync(noPlaceholderScript)) {
    checks.push({
      id: 'parity_no_placeholder_scope_clean',
      pass: true,
      detail: 'skipped (scripts/check-no-placeholder.js missing in current workspace)',
    });
  } else {
    const noPlaceholder = spawnSync(process.execPath, [noPlaceholderScript], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SVEN_CHECK_NO_PLACEHOLDER_SCAN_ROOTS: parityNoPlaceholderScanRoots },
    });
    checks.push({
      id: 'parity_no_placeholder_scope_clean',
      pass: noPlaceholder.status === 0,
      detail:
        noPlaceholder.status === 0
          ? `clean scope=${parityNoPlaceholderScanRoots}`
          : `placeholder/stub markers found in scoped production paths (${parityNoPlaceholderScanRoots})`,
    });
  }

  const trackSections = parseTrackSections(body);
  const dashboardStatuses = parseDashboardTrackStatuses(body);
  const dashboardTrackPrefixes = ['A', 'Z', 'O', 'M'];
  const inconsistentDashboard = [];
  for (const prefix of dashboardTrackPrefixes) {
    const sectionLines = trackSections
      .filter((track) => track.title.startsWith(`${prefix}`))
      .flatMap((track) => track.lines);
    const checkedCount = (sectionLines.join('\n').match(/^\s*-\s\[[xX]\]\s/mg) || []).length;
    const uncheckedCount = (sectionLines.join('\n').match(/^\s*-\s\[\s\]\s/mg) || []).length;
    const sectionComplete = checkedCount > 0 && uncheckedCount === 0;
    const dashboardStatus = String(dashboardStatuses[prefix] || '').toLowerCase();
    if (!sectionComplete) continue;
    if (/(partial|scaffold|demo-like|docker-only)/i.test(dashboardStatus)) {
      inconsistentDashboard.push(`${prefix}:${dashboardStatuses[prefix]}`);
    }
  }
  checks.push({
    id: 'parity_dashboard_track_status_consistent',
    pass: inconsistentDashboard.length === 0,
    detail:
      inconsistentDashboard.length === 0
        ? 'dashboard statuses align with A/Z/O/M section completion state'
        : `stale_dashboard_status=${inconsistentDashboard.join(', ')}`,
  });

  const trackSummaries = trackSections
    .map((track) => {
      const sectionBody = track.lines.join('\n');
      const checkedItems = (sectionBody.match(/^\s*-\s\[[xX]\]\s/mg) || []).length;
      const refs = extractCandidateFileRefs(sectionBody);
      const { testRefs, evidenceRefs, codeRefs } = classifyRefs(refs);
      const statusArtifactRefs = evidenceRefs.filter((ref) => ref.startsWith('docs/release/status/') || ref.startsWith('docs/release/evidence/'));
      return {
        track: track.title,
        checked_items: checkedItems,
        test_refs: testRefs,
        evidence_refs: evidenceRefs,
        code_refs: codeRefs,
        status_artifact_refs: statusArtifactRefs,
      };
    })
    .filter((summary) => summary.checked_items > 0);
  const untraceableTracks = trackSummaries
    .filter((summary) => summary.test_refs.length === 0 || summary.evidence_refs.length === 0 || summary.code_refs.length === 0)
    .map((summary) => summary.track);
  checks.push({
    id: 'parity_track_claims_traceable_to_tests',
    pass: untraceableTracks.length === 0,
    detail:
      untraceableTracks.length === 0
        ? `tracks_with_checked_claims=${trackSummaries.length}`
        : `missing_traceability=${untraceableTracks.join(', ')}`,
  });
  const tracksMissingStatusArtifacts = trackSummaries
    .filter((summary) => summary.status_artifact_refs.length === 0)
    .map((summary) => summary.track);
  checks.push({
    id: 'parity_track_claims_bind_to_machine_status_artifacts',
    pass: tracksMissingStatusArtifacts.length === 0,
    detail:
      tracksMissingStatusArtifacts.length === 0
        ? `tracks_with_checked_claims=${trackSummaries.length}`
        : `missing_status_artifacts=${tracksMissingStatusArtifacts.join(', ')}`,
  });

  const evidenceCandidates = referenced.filter((ref) => ref.startsWith('docs/release/evidence/') || ref.startsWith('docs/release/status/'));
  const evidenceFreshness = [];
  const malformedEvidence = [];
  for (const rel of evidenceCandidates) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (/\.json$/i.test(rel)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
        const timestamp = parseTimestampFromObject(parsed);
        const statusValid =
          (typeof parsed?.status === 'string' && parsed.status.trim().length > 0)
          || rel === ciGatesRel
          || /docs\/release\/status\/d9-keycloak-.*-latest\.json$/i.test(rel);
        if (!statusValid || !timestamp) {
          malformedEvidence.push(`${rel}:missing status/timestamp`);
          continue;
        }
        const hours = ageHours(timestamp);
        evidenceFreshness.push({ rel, pass: typeof hours === 'number' && hours <= maxEvidenceAgeHours, hours });
      } catch {
        malformedEvidence.push(`${rel}:invalid json`);
      }
      continue;
    }
    if (/\.md$/i.test(rel)) {
      const markdown = fs.readFileSync(full, 'utf8');
      const timestamp = parseTimestampFromEvidenceMarkdown(rel, markdown, stat);
      const hasHeader = /^\s*#\s+/m.test(markdown);
      if (!hasHeader || !timestamp) {
        malformedEvidence.push(`${rel}:missing header/timestamp`);
        continue;
      }
      const hours = ageHours(timestamp);
      evidenceFreshness.push({ rel, pass: typeof hours === 'number' && hours <= maxEvidenceAgeHours, hours });
    }
  }
  const staleEvidence = evidenceFreshness
    .filter((entry) => !entry.pass)
    .map((entry) => `${entry.rel}:${(entry.hours || 0).toFixed(2)}h`);
  const staleEvidenceFiltered = staleEvidence.filter((entry) => {
    if (entry.startsWith(`${demoEvidenceRel}:`)) return false;
    if (localOnly && entry.startsWith('docs/release/status/')) return false;
    return true;
  });
  checks.push({
    id: 'parity_evidence_schema_valid',
    pass: malformedEvidence.length === 0,
    detail: malformedEvidence.length === 0 ? `validated=${evidenceFreshness.length}` : `invalid=${malformedEvidence.join(', ')}`,
  });
  checks.push({
    id: 'parity_evidence_freshness',
    pass: staleEvidenceFiltered.length === 0,
    detail:
      staleEvidenceFiltered.length === 0
        ? `fresh_evidence=${evidenceFreshness.length}; max_age_hours=${maxEvidenceAgeHours}`
        : `stale=${staleEvidenceFiltered.join(', ')}; max_age_hours=${maxEvidenceAgeHours}`,
  });

  if (!masterChecklist) {
    checks.push({
      id: 'master_checklist_present',
      pass: false,
      detail: `${masterChecklistRel} missing`,
    });
  } else {
    checks.push({
      id: 'master_checklist_present',
      pass: true,
      detail: masterChecklistRel,
    });
    const lines = masterChecklist.split(/\r?\n/);
    const hasFeatureCoverageLine = masterChecklist.includes('**Feature Coverage**:');
    const hasReleaseControlsLine = masterChecklist.includes('**Release Controls**:');
    checks.push({
      id: 'master_checklist_split_status_present',
      pass: hasFeatureCoverageLine && hasReleaseControlsLine,
      detail:
        hasFeatureCoverageLine && hasReleaseControlsLine
          ? 'feature/release-control status lines present'
          : `missing=${[
              !hasFeatureCoverageLine ? 'Feature Coverage' : '',
              !hasReleaseControlsLine ? 'Release Controls' : '',
            ]
              .filter(Boolean)
              .join(', ')}`,
    });
    const releaseControls = parseMasterChecklistReleaseControls(lines);
    checks.push({
      id: 'master_checklist_release_controls_section_present',
      pass: releaseControls.ciSectionFound && releaseControls.nestedChecks > 0,
      detail:
        releaseControls.ciSectionFound && releaseControls.nestedChecks > 0
          ? `ci_nested_checks=${releaseControls.nestedChecks}`
          : 'missing CI pipeline section or nested checks',
    });
    const hasProgressStatusLine = masterChecklist.includes(masterStatusLine);
    const hasOpenItemsGuard = masterChecklist.includes(masterOpenItemsGuard);
    checks.push({
      id: 'master_checklist_status_banner_matches_open_controls',
      pass:
        releaseControls.nestedUnchecked === 0 ||
        (hasProgressStatusLine && hasOpenItemsGuard && hasReleaseControlsLine),
      detail:
        releaseControls.nestedUnchecked === 0
          ? 'ci/release controls fully checked'
          : `ci_nested_unchecked=${releaseControls.nestedUnchecked}; expected in-progress banner + open-items guard`,
    });
    const violations = [];
    lines.forEach((line, idx) => {
      if (!/^\s*-\s\[[xX]\]\s/.test(line)) return;
      const normalized = line.toLowerCase();
      const matched = forbiddenCheckedMaturityTerms.find((term) => normalized.includes(term));
      if (!matched) return;
      violations.push(`line ${idx + 1}:${matched}`);
    });
    checks.push({
      id: 'master_checklist_no_placeholder_items_checked',
      pass: violations.length === 0,
      detail: violations.length === 0 ? 'no checked placeholder/scaffold/stub items' : violations.join(', '),
    });
  }

  const ciGates = readJsonSafe(ciGatesRel);
  // Avoid self-referential recursion: this verifier produces parity_checklist_verify_ci itself.
  const requiredCiGateKeys = ['final_dod_ci', 'parity_e2e_ci'];
  const missingCiKeys = [];
  const nonPassingCiKeys = [];
  for (const key of requiredCiGateKeys) {
    if (!Object.prototype.hasOwnProperty.call(ciGates || {}, key)) {
      missingCiKeys.push(key);
      continue;
    }
    if (ciGates[key] !== true) {
      nonPassingCiKeys.push(key);
    }
  }
  const ciGateProvenance = ciGates && typeof ciGates.ci_gate_provenance === 'object'
    ? ciGates.ci_gate_provenance
    : (ciGates && typeof ciGates.gate_provenance === 'object' ? ciGates.gate_provenance : null);
  const provenanceIssues = [];
  for (const key of requiredCiGateKeys) {
    const entry = ciGateProvenance && typeof ciGateProvenance[key] === 'object' ? ciGateProvenance[key] : null;
    if (!entry) {
      provenanceIssues.push(`${key}:missing_provenance`);
      continue;
    }
    if (!entry.run_id) provenanceIssues.push(`${key}:missing_run_id`);
    if (!entry.head_sha) provenanceIssues.push(`${key}:missing_head_sha`);
    if (targetSha && entry.head_sha && String(entry.head_sha).trim() !== targetSha) {
      provenanceIssues.push(`${key}:sha_mismatch`);
    }
  }
  checks.push({
    id: 'parity_verifier_remote_provenance_mode',
    pass: true,
    detail: localOnly ? 'local-only mode (remote provenance check intentionally skipped)' : 'ci-remote mode (provenance required)',
  });
  checks.push({
    id: 'parity_test_execution_ci_gates_pass',
    pass: localOnly || (Boolean(ciGates) && missingCiKeys.length === 0 && nonPassingCiKeys.length === 0),
    detail: localOnly
      ? 'skipped in local-only mode (strict release mode validates this remotely)'
      : !ciGates
      ? `${ciGatesRel} missing/invalid`
      : missingCiKeys.length || nonPassingCiKeys.length
      ? `missing_keys=${missingCiKeys.join(', ') || 'none'}; non_passing=${nonPassingCiKeys.join(', ') || 'none'}`
      : requiredCiGateKeys.join(', '),
  });
  checks.push({
    id: 'parity_test_execution_ci_gates_provenance_bound',
    pass: localOnly || (!localOnly && Boolean(ciGates) && provenanceIssues.length === 0),
    detail: localOnly
      ? 'skipped in local-only mode (strict release use requires remote provenance)'
      : provenanceIssues.length
      ? provenanceIssues.join(', ')
      : targetSha
      ? `provenance bound to target_sha=${targetSha}`
      : 'provenance present (head_sha/run_id)',
  });

  const runtimeIssues = [];
  for (const rel of runtimeValidationStatusArtifacts) {
    const parsed = readJsonSafe(rel);
    if (!parsed) {
      runtimeIssues.push(`${rel}:missing_or_invalid`);
      continue;
    }
    const status = String(parsed.status || '').trim().toLowerCase();
    if (status !== 'pass') {
      runtimeIssues.push(`${rel}:status=${status || 'missing'}`);
    }
    const ts = parseTimestampFromObject(parsed);
    const hours = ageHours(ts);
    if (typeof hours !== 'number') {
      runtimeIssues.push(`${rel}:missing_timestamp`);
      continue;
    }
    if (hours > maxRuntimeEvidenceAgeHours) {
      runtimeIssues.push(`${rel}:stale_${hours.toFixed(2)}h`);
    }
  }
  checks.push({
    id: 'parity_runtime_validation_status_artifacts_current',
    pass: localOnly || runtimeIssues.length === 0,
    detail:
      localOnly
        ? 'skipped in local-only mode (runtime validation freshness requires live/local services and CI refresh)'
        : runtimeIssues.length === 0
        ? `artifacts=${runtimeValidationStatusArtifacts.length}; max_age_hours=${maxRuntimeEvidenceAgeHours}`
        : runtimeIssues.join(', '),
  });

  const closeoutIssues = [];
  for (const rel of parityWaveCloseoutStatusArtifacts) {
    const parsed = readJsonSafe(rel);
    if (!parsed) {
      closeoutIssues.push(`${rel}:missing_or_invalid`);
      continue;
    }
    const status = String(parsed.status || '').trim().toLowerCase();
    if (status !== 'pass') {
      closeoutIssues.push(`${rel}:status=${status || 'missing'}`);
    }
    const ts = parseTimestampFromObject(parsed);
    const hours = ageHours(ts);
    if (typeof hours !== 'number') {
      closeoutIssues.push(`${rel}:missing_timestamp`);
      continue;
    }
    if (hours > maxRuntimeEvidenceAgeHours) {
      closeoutIssues.push(`${rel}:stale_${hours.toFixed(2)}h`);
    }
  }
  checks.push({
    id: 'parity_wave_closeout_status_artifacts_current',
    pass: localOnly || closeoutIssues.length === 0,
    detail:
      localOnly
        ? 'skipped in local-only mode (wave closeout freshness requires preserved parity matrices and CI refresh)'
        : closeoutIssues.length === 0
        ? `artifacts=${parityWaveCloseoutStatusArtifacts.length}; max_age_hours=${maxRuntimeEvidenceAgeHours}`
        : closeoutIssues.join(', '),
  });

  const lifecycleGateKeys = ['soak_72h', 'week4_rc_complete', 'post_release_verified'];
  const missingLifecycleKeys = [];
  const nonPassingLifecycleKeys = [];
  for (const key of lifecycleGateKeys) {
    if (!Object.prototype.hasOwnProperty.call(ciGates || {}, key)) {
      missingLifecycleKeys.push(key);
      continue;
    }
    if (ciGates[key] !== true) {
      nonPassingLifecycleKeys.push(key);
    }
  }
  checks.push({
    id: 'parity_release_lifecycle_gates_pass',
    pass: localOnly || (Boolean(ciGates) && missingLifecycleKeys.length === 0 && nonPassingLifecycleKeys.length === 0),
    detail: localOnly
      ? 'skipped in local-only mode (strict release mode enforces soak/week4/post-release lifecycle gates)'
      : !ciGates
      ? `${ciGatesRel} missing/invalid`
      : missingLifecycleKeys.length || nonPassingLifecycleKeys.length
      ? `missing_keys=${missingLifecycleKeys.join(', ') || 'none'}; non_passing=${nonPassingLifecycleKeys.join(', ') || 'none'}`
      : lifecycleGateKeys.join(', '),
  });

  return checks;
}

function computeDimensionSummary(checks) {
  const byId = new Map(checks.map((check) => [String(check.id), Boolean(check.pass)]));
  const groups = {
    document_integrity: [
      'checklist_present',
      'checklist_no_unchecked_items',
      'checklist_referenced_files_exist',
      'parity_required_files_exist',
      'parity_required_files_scope_balanced',
      'parity_no_scaffolding_principle_present',
      'production_checklist_checked_rows_have_evidence_refs',
      'production_checklist_checked_rows_have_release_artifact_binding',
      'production_checklist_checked_rows_have_machine_claim_ids',
    ],
    test_execution: [
      'production_checklist_checked_claims_traceable_to_tests_and_status_artifacts',
      'parity_track_claims_traceable_to_tests',
      'parity_track_claims_bind_to_machine_status_artifacts',
      'parity_test_execution_ci_gates_pass',
      'parity_test_execution_ci_gates_provenance_bound',
    ],
    runtime_validation: [
      'parity_evidence_schema_valid',
      'parity_evidence_freshness',
      'parity_runtime_validation_status_artifacts_current',
      'parity_wave_closeout_status_artifacts_current',
      'parity_demo_evidence_freshness',
      'parity_release_lifecycle_gates_pass',
    ],
  };

  const dimensions = {};
  for (const [name, ids] of Object.entries(groups)) {
    const missing = ids.filter((id) => !byId.has(id));
    const failing = ids.filter((id) => byId.has(id) && !byId.get(id));
    dimensions[name] = {
      pass: missing.length === 0 && failing.length === 0,
      required_check_ids: ids,
      missing_checks: missing,
      failing_checks: failing,
    };
  }

  return dimensions;
}

function writeReport(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'parity-checklist-verify-latest.json');
  const outMd = path.join(outDir, 'parity-checklist-verify-latest.md');

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Parity Checklist Verify',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      `Checklist formatting status: ${report.composite_status?.checklist_formatting_status || 'unknown'}`,
      `Release policy status: ${report.composite_status?.release_policy_status || 'unknown'}`,
      `Validation mode: ${report.execution?.validation_mode || 'unknown'}`,
      '',
      '## Dimensions',
      ...Object.entries(report.dimensions || {}).map(
        ([name, entry]) =>
          `- [${entry.pass ? 'x' : ' '}] ${name}: fail=${(entry.failing_checks || []).length}, missing=${(entry.missing_checks || []).length}`,
      ),
      '',
      '## Checks',
      ...report.checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
    ].join('\n'),
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
}

function main() {
  const checks = verifyChecklist();
  const dimensions = computeDimensionSummary(checks);
  const requiredDimensions = ['document_integrity', 'test_execution', 'runtime_validation'];
  const status = requiredDimensions.some((name) => !dimensions[name]?.pass) ? 'fail' : 'pass';
  const checklistFormattingStatus = dimensions.document_integrity?.pass ? 'pass' : 'fail';
  const releasePolicyStatus =
    dimensions.test_execution?.pass && dimensions.runtime_validation?.pass ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    composite_status: {
      checklist_formatting_status: checklistFormattingStatus,
      release_policy_status: releasePolicyStatus,
    },
    execution: {
      strict,
      local_only: localOnly,
      validation_mode: localOnly ? 'local-only' : 'ci-remote',
      target_sha: targetSha || null,
    },
    checklist: checklistRel,
    required_dimensions: requiredDimensions,
    dimensions,
    checks,
  };

  writeReport(report);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

main();
