#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'mobile-binary-artifacts-latest.json');
const outMd = path.join(outDir, 'mobile-binary-artifacts-latest.md');

const SEARCH_ROOTS = [
  'apps/companion-user-flutter/build/app/outputs/flutter-apk',
  'apps/companion-user-flutter/build/app/outputs/bundle',
  'apps/companion-user-flutter/build/ios/ipa',
];

const MOBILE_BINARY_EXTS = new Set(['.apk', '.aab', '.ipa']);

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function walkFiles(baseDir, out) {
  if (!fs.existsSync(baseDir)) return;
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
}

function hashFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function inferBuildType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('release')) return 'release';
  if (lower.includes('profile')) return 'profile';
  if (lower.includes('debug')) return 'debug';
  return 'unknown';
}

function inferFlavor(name) {
  const lower = name.toLowerCase();
  if (lower.includes('prod')) return 'prod';
  if (lower.includes('staging')) return 'staging';
  if (lower.includes('dev')) return 'dev';
  return 'unknown';
}

function inferAbi(name) {
  const lower = name.toLowerCase();
  if (lower.includes('arm64-v8a') || lower.includes('arm64')) return 'arm64-v8a';
  if (lower.includes('armeabi-v7a') || lower.includes('arm-v7')) return 'armeabi-v7a';
  if (lower.includes('x86_64')) return 'x86_64';
  if (lower.includes('universal')) return 'universal';
  return 'unknown';
}

function findArtifacts() {
  const candidates = [];
  for (const relDir of SEARCH_ROOTS) {
    walkFiles(path.join(root, relDir), candidates);
  }

  return candidates
    .filter((filePath) => MOBILE_BINARY_EXTS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      return {
        path: rel(filePath),
        file_name: fileName,
        extension: path.extname(fileName).toLowerCase(),
        flavor: inferFlavor(fileName),
        build_type: inferBuildType(fileName),
        abi: inferAbi(fileName),
        size_bytes: stat.size,
        sha256: hashFileSha256(filePath),
        build_time: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function writeArtifacts(payload) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# Mobile Binary Artifacts Snapshot',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    '',
    '## Summary',
    `- total_artifacts: ${payload.summary.total_artifacts}`,
    `- release_artifacts: ${payload.summary.release_artifacts}`,
    `- release_arm64_artifacts: ${payload.summary.release_arm64_artifacts}`,
    '',
    '## Artifacts',
  ];

  if (payload.artifacts.length === 0) {
    lines.push('- (none detected)');
  } else {
    for (const artifact of payload.artifacts) {
      lines.push(
        `- ${artifact.path} | flavor=${artifact.flavor} | build_type=${artifact.build_type} | abi=${artifact.abi} | size_bytes=${artifact.size_bytes} | sha256=${artifact.sha256}`,
      );
    }
  }
  lines.push('');

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
}

function main() {
  const artifacts = findArtifacts();
  const releaseArtifacts = artifacts.filter((a) => a.build_type === 'release');
  const releaseArm64Artifacts = releaseArtifacts.filter((a) => a.abi === 'arm64-v8a');
  const status = releaseArtifacts.length > 0 ? 'pass' : 'warn';

  const payload = {
    generated_at: new Date().toISOString(),
    status,
    strict,
    summary: {
      total_artifacts: artifacts.length,
      release_artifacts: releaseArtifacts.length,
      release_arm64_artifacts: releaseArm64Artifacts.length,
      search_roots: SEARCH_ROOTS,
    },
    artifacts,
  };

  writeArtifacts(payload);

  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

main();
