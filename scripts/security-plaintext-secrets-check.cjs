#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const STATUS_DIR = path.join(ROOT, 'docs', 'release', 'status');
const STATUS_JSON = path.join(STATUS_DIR, 'security-plaintext-secrets-latest.json');
const STATUS_MD = path.join(STATUS_DIR, 'security-plaintext-secrets-latest.md');
const MAX_FILE_BYTES = 512 * 1024;
const ALLOW_PATTERNS = [
  /example/i,
  /change-me/i,
  /generate-a/i,
  /changeme/i,
  /localhost/i,
  /dummy/i,
  /test/i,
  /placeholder/i,
  /process\.env/i,
  /token\s*=/i,
  /secret\s*=/i,
  /accessToken/i,
  /11111111-1111-4111-8111-111111111111/i,
  /22222222-2222-4222-8222-222222222222/i,
  /REDACTED/i,
  /\*{3,}/,
];
const TARGET_PATTERNS = [
  /(api[_-]?key|secret|token|session[_-]?cookie|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_+/=-]{24,}["']?/i,
  /Bearer\s+[A-Za-z0-9\-._~+/=]{20,}/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  'coverage',
  '.expo',
  '.venv',
  '.venv-1',
  'build',
  'out',
  'tmp',
]);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tgz', '.exe', '.dll']);
const FIRST_PARTY_NATIVE_ROOTS = [
  'apps/companion-user-flutter/android',
  'apps/companion-user-flutter/ios',
];
const NATIVE_SKIP_DIRS = new Set(['build', '.gradle', '.cxx', 'Pods', 'DerivedData', '.symlinks']);
const NATIVE_ALLOWED_EXT = new Set([
  '.gradle',
  '.kts',
  '.properties',
  '.xml',
  '.kt',
  '.java',
  '.swift',
  '.plist',
  '.m',
  '.mm',
  '.h',
  '.hpp',
  '.entitlements',
  '.pbxproj',
  '.json',
  '.yaml',
  '.yml',
  '.xcconfig',
  '.strings',
  '.sh',
  '.txt',
]);
const NATIVE_ALLOWED_BASENAMES = new Set([
  'podfile',
  'podfile.lock',
  'gemfile',
  'gemfile.lock',
  'gradle.properties',
  'build.gradle',
  'build.gradle.kts',
  'androidmanifest.xml',
  'google-services.json',
  'googleService-Info.plist',
  'Info.plist',
]);

function isNativePath(filePath) {
  const lower = filePath.toLowerCase();
  return lower.startsWith('apps/companion-user-flutter/android/')
    || lower.startsWith('apps/companion-user-flutter/ios/');
}

function shouldSkipFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXT.has(ext)) return true;
  const lower = filePath.toLowerCase();
  if (lower.includes('package-lock.json')) return true;
  if (lower.includes('pnpm-lock.yaml')) return true;
  if (lower.includes('.min.')) return true;
  if (isNativePath(filePath)) {
    const base = path.basename(filePath).toLowerCase();
    if (!NATIVE_ALLOWED_EXT.has(ext) && !NATIVE_ALLOWED_BASENAMES.has(base)) return true;
  }
  return false;
}

function walk(dir, output) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (NATIVE_SKIP_DIRS.has(entry.name)) continue;
      walk(abs, output);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldSkipFile(rel)) continue;
    output.push(abs);
  }
}

function collectFirstPartyNativeFiles() {
  const files = [];
  for (const relRoot of FIRST_PARTY_NATIVE_ROOTS) {
    const absRoot = path.join(ROOT, relRoot);
    if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) continue;
    walk(absRoot, files);
  }
  return files;
}

function hasAllowedContext(line) {
  return ALLOW_PATTERNS.some((p) => p.test(line));
}

function scanFile(absPath) {
  const stat = fs.statSync(absPath);
  if (stat.size > MAX_FILE_BYTES) return [];
  const text = fs.readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || hasAllowedContext(line)) continue;
    for (const pattern of TARGET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          file: path.relative(ROOT, absPath).replace(/\\/g, '/'),
          line: i + 1,
          preview: line.slice(0, 140),
        });
        break;
      }
    }
  }
  return findings;
}

function writeStatusArtifact(payload) {
  fs.mkdirSync(STATUS_DIR, { recursive: true });
  fs.writeFileSync(STATUS_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const lines = [
    '# Security Plaintext Secrets Check',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    '',
    `- scanned_files: ${payload.summary.scanned_files}`,
    `- native_files_scanned: ${payload.summary.native_files_scanned}`,
    `- findings: ${payload.summary.findings}`,
    '',
    '## Findings',
  ];
  if (!Array.isArray(payload.findings) || payload.findings.length === 0) {
    lines.push('- [x] none');
  } else {
    for (const finding of payload.findings.slice(0, 50)) {
      lines.push(`- [ ] ${finding.file}:${finding.line} ${finding.preview}`);
    }
  }
  fs.writeFileSync(STATUS_MD, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const files = [];
  walk(ROOT, files);
  const firstPartyNativeFiles = collectFirstPartyNativeFiles();
  const scanned = new Set();
  const findings = [];
  for (const file of files) {
    scanned.add(file);
    findings.push(...scanFile(file));
    if (findings.length >= 50) break;
  }
  if (findings.length < 50) {
    for (const file of firstPartyNativeFiles) {
      if (scanned.has(file)) continue;
      findings.push(...scanFile(file));
      if (findings.length >= 50) break;
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    status: findings.length > 0 ? 'fail' : 'pass',
    summary: {
      scanned_files: files.length,
      native_files_scanned: firstPartyNativeFiles.length,
      findings: findings.length,
    },
    findings: findings.slice(0, 50),
  };

  if (findings.length > 0) {
    writeStatusArtifact(payload);
    console.error('Potential plaintext secrets detected:');
    for (const f of findings) {
      console.error(`- ${f.file}:${f.line} ${f.preview}`);
    }
    process.exit(2);
    return;
  }

  const nativeRootsPresent = FIRST_PARTY_NATIVE_ROOTS.some((rel) => fs.existsSync(path.join(ROOT, rel)));
  if (nativeRootsPresent && firstPartyNativeFiles.length === 0) {
    writeStatusArtifact({
      generated_at: new Date().toISOString(),
      status: 'fail',
      summary: {
        scanned_files: files.length,
        native_files_scanned: firstPartyNativeFiles.length,
        findings: findings.length,
      },
      findings: [],
      error: 'native_scan_coverage_failure',
    });
    console.error('Native secret scan coverage failure: first-party Android/iOS roots exist but no scan-eligible files were inspected.');
    process.exit(2);
    return;
  }

  writeStatusArtifact(payload);
  console.log('No plaintext secrets/tokens detected by heuristic scan.');
  console.log(`Scanned files: ${files.length} (first-party native files: ${firstPartyNativeFiles.length})`);
}

main();
