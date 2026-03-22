#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxEvidenceAgeHours = Number(process.env.SVEN_MOBILE_EVIDENCE_MAX_AGE_HOURS || 168);
const scopePath = path.join(root, 'config', 'release', 'mobile-release-scope.json');

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

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function section(md, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = md.search(new RegExp(`^##\\s+${escaped}\\s*$`, 'im'));
  if (start < 0) return '';
  const rest = md.slice(start);
  const afterHeader = rest.replace(/^##\s+[^\n]+\r?\n?/m, '');
  const next = afterHeader.search(/^##\s+/im);
  if (next < 0) return rest;
  const offset = rest.length - afterHeader.length;
  return rest.slice(0, offset + next);
}

function fieldValue(md, label) {
  const pattern = new RegExp(`${label}\\s*:\\s*(.+)`, 'im');
  const m = md.match(pattern);
  return m ? String(m[1] || '').trim() : '';
}

function meaningful(value) {
  if (!value) return false;
  return !/^(pending|tbd|todo|n\/a|na|none|unknown|-)$/.test(value.toLowerCase());
}

function normalizeRel(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function resolveArtifactPath(rawValue) {
  const raw = String(rawValue || '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw) {
    return {
      raw,
      rel: '',
      abs: '',
      exists: false,
      in_repo: false,
      allowed_prefix: false,
    };
  }
  const abs = path.isAbsolute(raw) ? raw : path.join(root, raw);
  const rel = normalizeRel(path.relative(root, abs));
  const inRepo = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  const allowedPrefix = inRepo && rel.startsWith('apps/companion-user-flutter/');
  const exists = fs.existsSync(abs);
  return {
    raw,
    rel: inRepo ? rel : '',
    abs,
    exists,
    in_repo: inRepo,
    allowed_prefix: allowedPrefix,
  };
}

function relPath(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, '/');
}

function selectNewestMarkdownByPrefix(evidenceDir, prefix) {
  const latestAlias = `${prefix}-latest.md`;
  const candidates = fs.readdirSync(evidenceDir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .filter((name) => name.toLowerCase() !== latestAlias.toLowerCase())
    .filter((name) => name.startsWith(`${prefix}-`));
  if (!candidates.length) return null;
  const ranked = candidates
    .map((name) => {
      const full = path.join(evidenceDir, name);
      const stat = fs.statSync(full);
      return { name, mtimeMs: stat.mtimeMs || 0 };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
  return path.join(evidenceDir, ranked[0].name);
}

function resolveSigningEvidencePath() {
  const override = process.env.SVEN_MOBILE_RELEASE_SIGNING_EVIDENCE_PATH;
  if (override) {
    const resolved = path.isAbsolute(override) ? override : path.join(root, override);
    if (!/mobile-release-signing-template\.md$/i.test(resolved)) {
      return resolved;
    }
  }
  const latestPath = path.join(root, 'docs', 'release', 'evidence', 'mobile-release-signing-latest.md');
  if (fs.existsSync(latestPath)) return latestPath;
  const evidenceDir = path.join(root, 'docs', 'release', 'evidence');
  if (!fs.existsSync(evidenceDir)) return null;
  return selectNewestMarkdownByPrefix(evidenceDir, 'mobile-release-signing');
}

function parseEvidenceTimestamp(markdown, evidenceStat) {
  const match = markdown.match(/^Date:\s*(.+)$/im);
  if (match && match[1]) {
    const parsed = Date.parse(String(match[1]).trim());
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return evidenceStat?.mtime?.toISOString?.() || null;
}

function ageHours(isoTimestamp) {
  if (!isoTimestamp) return null;
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const releaseScope = readScope();
  const androidOnly = releaseScope.scope === 'android-only';
  const evidenceFullPath = resolveSigningEvidencePath();
  const evidencePath = evidenceFullPath ? relPath(evidenceFullPath) : 'missing';
  const evidence = evidenceFullPath ? read(evidencePath) : '';
  const evidenceStat = evidenceFullPath && fs.existsSync(evidenceFullPath) ? fs.statSync(evidenceFullPath) : null;
  const evidenceTimestamp = parseEvidenceTimestamp(evidence, evidenceStat);
  const evidenceAge = ageHours(evidenceTimestamp);
  const evidenceFresh = typeof evidenceAge === 'number' && evidenceAge <= maxEvidenceAgeHours;

  const androidSection = section(evidence, 'Android Signing');
  const iosSection = section(evidence, 'iOS Signing');
  const approvalSection = section(evidence, 'Approval');
  const androidAlias = fieldValue(androidSection, 'keystore alias');
  const androidArtifactPath = fieldValue(androidSection, 'artifact path');
  const androidCmd = fieldValue(androidSection, 'signature verification command');
  const androidSummary = fieldValue(androidSection, 'verification output summary');
  const iosIdentity = fieldValue(iosSection, 'signing identity');
  const iosArtifactPath = fieldValue(iosSection, 'artifact path');
  const iosCmd = fieldValue(iosSection, 'verification command');
  const iosSummary = fieldValue(iosSection, 'verification output summary');
  const iosStatus = fieldValue(iosSection, 'status');
  const approvalEngineering = fieldValue(approvalSection, 'Engineering');
  const approvalSecurity = fieldValue(approvalSection, 'Security');
  const approvalOwner = fieldValue(approvalSection, 'Release owner');
  const androidArtifact = resolveArtifactPath(androidArtifactPath);
  const iosArtifact = resolveArtifactPath(iosArtifactPath);

  const checks = [
    { id: 'mobile_release_signing_evidence_present', pass: Boolean(evidence), detail: evidencePath },
    {
      id: 'mobile_release_signing_evidence_fresh',
      pass: evidenceFresh,
      detail: evidenceFresh
        ? `${evidenceAge.toFixed(2)}h <= ${maxEvidenceAgeHours}h`
        : evidenceTimestamp
          ? `${(evidenceAge || 0).toFixed(2)}h > ${maxEvidenceAgeHours}h`
          : 'missing/invalid evidence timestamp',
    },
    {
      id: 'android_signing_fields_present',
      pass: evidence.includes('## Android Signing')
        && evidence.includes('keystore alias:')
        && evidence.includes('artifact path:')
        && evidence.includes('signature verification command:')
        && evidence.includes('verification output summary:')
        && meaningful(androidAlias)
        && meaningful(androidArtifactPath)
        && meaningful(androidCmd)
        && meaningful(androidSummary),
      detail: 'android signing field set',
    },
    {
      id: 'ios_signing_fields_present',
      pass: androidOnly
        ? evidence.includes('## iOS Signing') && String(iosStatus).toLowerCase() === 'deferred'
        : evidence.includes('## iOS Signing')
          && evidence.includes('signing identity:')
          && evidence.includes('artifact path:')
          && evidence.includes('verification command:')
          && evidence.includes('verification output summary:')
          && meaningful(iosIdentity)
          && meaningful(iosArtifactPath)
          && meaningful(iosCmd)
          && meaningful(iosSummary),
      detail: androidOnly ? 'ios signing deferred for android-only rc' : 'ios signing field set',
    },
    {
      id: 'android_signing_artifact_path_exists_and_scoped',
      pass: androidArtifact.in_repo && androidArtifact.allowed_prefix && androidArtifact.exists,
      detail: `path=${androidArtifact.rel || androidArtifact.raw || '(missing)'}; in_repo=${String(androidArtifact.in_repo)}; allowed_prefix=${String(androidArtifact.allowed_prefix)}; exists=${String(androidArtifact.exists)}`,
    },
    {
      id: 'ios_signing_artifact_path_exists_and_scoped',
      pass: androidOnly ? true : iosArtifact.in_repo && iosArtifact.allowed_prefix && iosArtifact.exists,
      detail: androidOnly
        ? 'deferred for android-only rc'
        : `path=${iosArtifact.rel || iosArtifact.raw || '(missing)'}; in_repo=${String(iosArtifact.in_repo)}; allowed_prefix=${String(iosArtifact.allowed_prefix)}; exists=${String(iosArtifact.exists)}`,
    },
    {
      id: 'mobile_signing_approvals_present',
      pass: evidence.includes('Engineering:')
        && evidence.includes('Security:')
        && evidence.includes('Release owner:')
        && meaningful(approvalEngineering)
        && meaningful(approvalSecurity)
        && meaningful(approvalOwner),
      detail: 'engineering/security/release-owner approvals',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    mobile_release_scope: releaseScope.scope,
    ios_signing_status: androidOnly ? 'deferred' : 'required',
    status,
    checks,
    evidence: {
      path: evidencePath,
      timestamp: evidenceTimestamp,
      age_hours: typeof evidenceAge === 'number' ? Number(evidenceAge.toFixed(2)) : null,
      max_age_hours: maxEvidenceAgeHours,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-release-signing-latest.json');
  const outMd = path.join(outDir, 'mobile-release-signing-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Mobile Release Signing Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
