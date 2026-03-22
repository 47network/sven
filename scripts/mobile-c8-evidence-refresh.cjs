#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);
const evidenceDir = path.join(root, 'docs', 'release', 'evidence');
const telemetryDir = path.join(evidenceDir, 'telemetry');
const outPath = path.join(evidenceDir, `mobile-c8-remaining-validation-${today}.md`);
const maxEvidenceAgeHours = Number(process.env.SVEN_MOBILE_EVIDENCE_MAX_AGE_HOURS || 168);

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function readNumericSamples(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number(line))
    .filter((n) => Number.isFinite(n));
}

function readSingleNumber(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function findArtifactFiles() {
  const candidates = [];
  const scanRoots = [
    path.join(root, 'apps', 'companion-user-flutter'),
  ];
  for (const dir of scanRoots) {
    if (!fs.existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.isFile() && (/\.apk$/i.test(entry.name) || /\.ipa$/i.test(entry.name))) {
          const stat = fs.statSync(full);
          candidates.push({ full, mtimeMs: stat.mtimeMs, sizeMb: stat.size / (1024 * 1024) });
        }
      }
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const apkCandidates = candidates.filter((f) => /\.apk$/i.test(f.full));
  const ipaCandidates = candidates.filter((f) => /\.ipa$/i.test(f.full));
  const releaseApks = apkCandidates.filter((f) => /release/i.test(f.full));
  const apkRelease = releaseApks.sort((a, b) => {
    const score = (p) => {
      const s = p.toLowerCase();
      if (s.includes('arm64-v8a')) return 5;
      if (s.includes('armeabi-v7a')) return 4;
      if (s.includes('universal')) return 3;
      if (s.includes('x86_64')) return 2;
      if (s.includes('x86')) return 1;
      return 0;
    };
    const sa = score(a.full);
    const sb = score(b.full);
    if (sa !== sb) return sb - sa;
    return b.mtimeMs - a.mtimeMs;
  })[0] || null;
  const apk = apkRelease || apkCandidates[0] || null;
  const ipa = ipaCandidates[0] || null;
  return { apk, ipa };
}

function parseEvidenceTimestamp(markdown, evidenceStat) {
  const match = markdown.match(/^Date:\s*(.+)$/im);
  if (match && match[1]) {
    const parsed = Date.parse(String(match[1]).trim());
    if (!Number.isNaN(parsed)) return parsed;
  }
  return evidenceStat?.mtimeMs || null;
}

function isFreshTimestamp(timestampMs) {
  if (!Number.isFinite(timestampMs)) return false;
  const ageHours = (Date.now() - timestampMs) / (1000 * 60 * 60);
  return ageHours <= maxEvidenceAgeHours;
}

function findLatestFreshSigningEvidence() {
  if (!fs.existsSync(evidenceDir)) return null;
  const files = fs.readdirSync(evidenceDir)
    .filter((name) => /^mobile-release-signing-\d{4}-\d{2}-\d{2}\.md$/i.test(name))
    .map((name) => path.join(evidenceDir, name));
  const candidates = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const stat = fs.statSync(file);
    const text = fs.readFileSync(file, 'utf8');
    const ts = parseEvidenceTimestamp(text, stat);
    if (!isFreshTimestamp(ts)) continue;
    candidates.push({ full: file, timestampMs: ts, text });
  }
  candidates.sort((a, b) => b.timestampMs - a.timestampMs);
  return candidates[0] || null;
}

function readSigningEvidenceArtifactPath(sectionHeading) {
  const latest = findLatestFreshSigningEvidence();
  if (!latest) return null;
  const text = latest.text;
  const sectionRe = new RegExp(`##\\s*${sectionHeading}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
  const section = text.match(sectionRe);
  if (!section) return null;
  const line = section[0].match(/artifact\s+path:\s*([^\r\n]+)/i);
  if (!line) return null;
  const raw = line[1].trim();
  const normalized = raw.replace(/\\/g, path.sep);
  const full = path.resolve(root, normalized);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  return { full, mtimeMs: stat.mtimeMs, sizeMb: stat.size / (1024 * 1024) };
}

function fallbackApkSizeFromEvidence() {
  const files = fs.readdirSync(evidenceDir)
    .filter((name) => /\.md$/i.test(name))
    .filter((name) => !/^mobile-c8-remaining-validation-\d{4}-\d{2}-\d{2}\.md$/i.test(name))
    .map((name) => path.join(evidenceDir, name));
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const m = text.match(/APK Size[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*MB/i);
    if (m) hits.push(Number(m[1]));
  }
  if (!hits.length) return null;
  return Math.min(...hits);
}

function formatMetric(n, suffix = '') {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'n/a';
  if (suffix) return `${n}${suffix}`;
  return String(n);
}

function run() {
  const coldAndroidSamples = readNumericSamples(path.join(telemetryDir, 'cold_start_android_samples.txt'));
  const coldIosSamples = readNumericSamples(path.join(telemetryDir, 'cold_start_ios_samples.txt'));
  const bgAndroidSamples = readNumericSamples(path.join(telemetryDir, 'background_network_android_samples.txt'));
  const bgIosSamples = readNumericSamples(path.join(telemetryDir, 'background_network_ios_samples.txt'));
  const ipaSizeOverrideMb = readSingleNumber(path.join(telemetryDir, 'ipa_size_mb.txt'));

  const coldAndroidP95 = percentile(coldAndroidSamples, 0.95);
  const coldIosP95 = percentile(coldIosSamples, 0.95);
  const bgAndroidP95 = percentile(bgAndroidSamples, 0.95);
  const bgIosP95 = percentile(bgIosSamples, 0.95);

  const discovered = findArtifactFiles();
  const signingApk = readSigningEvidenceArtifactPath('Android Signing');
  const signingIpa = readSigningEvidenceArtifactPath('iOS Signing');
  const apk = discovered.apk || signingApk;
  const ipa = discovered.ipa || signingIpa;
  const apkIsRelease = apk ? /release/i.test(apk.full) : false;
  const apkSizeMb = (apk && apkIsRelease) ? Number(apk.sizeMb.toFixed(1)) : fallbackApkSizeFromEvidence();
  const ipaSizeMb = ipa ? Number(ipa.sizeMb.toFixed(1)) : ipaSizeOverrideMb;

  const lines = [
    '# C8 Remaining Validation',
    '',
    `Date: ${today}`,
    'Scope: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.3`',
    '',
    '## C8.3 Evidence Snapshot',
    '',
    'Sources used:',
    '- telemetry samples under `docs/release/evidence/telemetry/`',
    '- local mobile build artifacts (`.apk`, `.ipa`) if present',
    '- fallback existing evidence docs for APK size if no local APK artifact found',
    '',
    'Validation block:',
    `- cold_start_android_p95_ms: ${formatMetric(coldAndroidP95)} (samples=${coldAndroidSamples.length})`,
    `- cold_start_ios_p95_ms: ${formatMetric(coldIosP95)} (samples=${coldIosSamples.length})`,
    `- apk_size_mb: ${formatMetric(apkSizeMb)}`,
    `- ipa_size_mb: ${formatMetric(ipaSizeMb)}`,
    `- background_network_sample: android_p95=${formatMetric(bgAndroidP95)} bytes/min (samples=${bgAndroidSamples.length}), ios_p95=${formatMetric(bgIosP95)} bytes/min (samples=${bgIosSamples.length})`,
    `- apk_size_source: ${apk && apkIsRelease ? rel(apk.full) : 'fallback from evidence markdown'}`,
    `- ipa_size_source: ${ipa ? rel(ipa.full) : (ipaSizeOverrideMb !== null ? 'telemetry/ipa_size_mb.txt' : 'n/a')}`,
    '',
    '## Current Conclusion',
    '',
    '- This file is auto-generated from available artifacts/samples.',
    '- Any `n/a` value indicates required evidence is not yet captured in this workspace.',
    '',
    '## Commands for Remaining Capture',
    '',
    '- Android startup telemetry samples:',
    '  - `npm run ops:mobile:adb:startup-telemetry`',
    '- Android background network sample:',
    '  - `npm run ops:mobile:adb:network-idle`',
    '- iOS cold start and background network samples:',
    '  - `npm run ops:mobile:ios:c8:set-metrics -- -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"`',
    '  - provenance file: `docs/release/evidence/mobile-c8-ios-metrics-capture-latest.md`',
    '- C8.3 gate:',
    '  - `npm run mobile:c8:performance:check`',
    '',
  ];

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${rel(outPath)}`);
  if (apk) console.log(`Detected APK artifact: ${rel(apk.full)} (${apkSizeMb} MB)`);
  if (ipa) console.log(`Detected IPA artifact: ${rel(ipa.full)} (${ipaSizeMb} MB)`);
}

run();
