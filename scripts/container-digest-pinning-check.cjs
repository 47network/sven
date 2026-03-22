#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const DEFAULT_SCAN_ROOTS = ['services', 'packages', 'apps'];
const DEFAULT_EXCLUDED_PATH_PREFIXES = ['docs/examples/'];
const ALLOWED_SOURCES_ENV = 'SVEN_DIGEST_PINNING_ALLOWED_SOURCES';
const DENIED_SOURCES_ENV = 'SVEN_DIGEST_PINNING_DENIED_SOURCES';
const SCAN_ROOTS_ENV = 'SVEN_DIGEST_PINNING_SCAN_ROOTS';
const EXCLUDED_PREFIXES_ENV = 'SVEN_DIGEST_PINNING_EXCLUDED_PATH_PREFIXES';

function parseCsv(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseScanRoots(raw) {
  const configured = parseCsv(raw);
  return configured.length > 0 ? configured : [...DEFAULT_SCAN_ROOTS];
}

function parseExcludedPathPrefixes(raw) {
  const configured = parseCsv(raw);
  const merged = [...DEFAULT_EXCLUDED_PATH_PREFIXES, ...configured];
  return Array.from(new Set(merged.map((entry) => entry.replace(/\\/g, '/'))));
}

function normalizeRelPath(relPath) {
  return String(relPath || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function isPathUnderAnyRoot(relPath, scanRoots) {
  const normalized = normalizeRelPath(relPath);
  return scanRoots.some((rootPath) => {
    const normalizedRoot = normalizeRelPath(rootPath).replace(/\/+$/, '');
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
  });
}

function isExcludedByPrefix(relPath, excludedPrefixes) {
  const normalized = normalizeRelPath(relPath);
  return excludedPrefixes.some((prefix) => {
    const normalizedPrefix = normalizeRelPath(prefix).replace(/\/+$/, '');
    return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}/`);
  });
}

function shouldScanDockerfilePath(relPath, scanRoots, excludedPrefixes) {
  if (isExcludedByPrefix(relPath, excludedPrefixes)) return false;
  return isPathUnderAnyRoot(relPath, scanRoots);
}

function parseImageRegistry(imageRef) {
  const image = String(imageRef || '').trim();
  if (!image) return '';
  const withoutDigest = image.split('@')[0] || image;
  const hasExplicitPath = withoutDigest.includes('/');
  if (!hasExplicitPath) {
    return 'docker.io';
  }
  const firstSegment = (withoutDigest.split('/')[0] || '').toLowerCase();
  if (firstSegment.includes('.') || firstSegment.includes(':') || firstSegment === 'localhost') {
    return firstSegment;
  }
  return 'docker.io';
}

function evaluateSourcePolicy(image, allowedSources, deniedSources) {
  const source = parseImageRegistry(image);
  if (!source) {
    return {
      source,
      pass: false,
      reason: 'unable to derive image source',
    };
  }
  if (deniedSources.includes(source)) {
    return {
      source,
      pass: false,
      reason: `denied source: ${source}`,
    };
  }
  if (allowedSources.length > 0 && !allowedSources.includes(source)) {
    return {
      source,
      pass: false,
      reason: `source not in allowlist: ${source}`,
    };
  }
  return {
    source,
    pass: true,
    reason: 'source allowed',
  };
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && entry.name === 'Dockerfile') {
      out.push(full);
    }
  }
  return out;
}

function parseDockerfiles(scanRoots, excludedPrefixes) {
  const scanTargets = scanRoots
    .map((scanRoot) => path.join(root, scanRoot))
    .filter((scanRootAbs) => fs.existsSync(scanRootAbs));
  const files = scanTargets.flatMap((scanRootAbs) => walk(scanRootAbs));
  const results = [];
  const fromRe = /^\s*FROM\s+([^\s]+).*/gim;
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (!shouldScanDockerfilePath(rel, scanRoots, excludedPrefixes)) continue;
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = fromRe.exec(content)) !== null) {
      const image = String(m[1] || '').trim();
      const pinned = image.includes('@sha256:');
      results.push({
        source: rel,
        kind: 'dockerfile_from',
        image,
        pinned,
      });
    }
  }
  return results;
}

function parseComposeFiles() {
  const composeCandidates = [
    'docker-compose.yml',
    'docker-compose.dev.yml',
    'docker-compose.staging.yml',
    'docker-compose.production.yml',
    'docker-compose.profiles.yml',
  ].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));

  const results = [];
  const imageRe = /^\s*image:\s*["']?([^"'\s#]+)["']?.*$/gim;
  for (const file of composeCandidates) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = imageRe.exec(content)) !== null) {
      const image = String(m[1] || '').trim();
      const pinned = image.includes('@sha256:');
      results.push({
        source: rel,
        kind: 'compose_image',
        image,
        pinned,
      });
    }
  }
  return results;
}

function main() {
  const scanRoots = parseScanRoots(process.env[SCAN_ROOTS_ENV]);
  const excludedPrefixes = parseExcludedPathPrefixes(process.env[EXCLUDED_PREFIXES_ENV]);
  const allowedSources = parseCsv(process.env[ALLOWED_SOURCES_ENV]).map((entry) => entry.toLowerCase());
  const deniedSources = parseCsv(process.env[DENIED_SOURCES_ENV]).map((entry) => entry.toLowerCase());

  const dockerRefs = parseDockerfiles(scanRoots, excludedPrefixes);
  const composeRefs = parseComposeFiles();
  const refs = [];
  const seen = new Set();
  for (const row of [...dockerRefs, ...composeRefs]) {
    const key = `${row.kind}|${row.source}|${row.image}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(row);
  }
  const unpinned = refs.filter((r) => !r.pinned);
  const latestTags = unpinned.filter((r) => /:latest$/i.test(r.image));
  const sourcePolicyChecks = refs.map((ref) => ({
    source: ref.source,
    kind: ref.kind,
    image: ref.image,
    ...evaluateSourcePolicy(ref.image, allowedSources, deniedSources),
  }));
  const sourcePolicyViolations = sourcePolicyChecks.filter((row) => !row.pass);

  const report = {
    generated_at: new Date().toISOString(),
    status: unpinned.length === 0 && sourcePolicyViolations.length === 0 ? 'pass' : 'fail',
    scope: {
      scan_roots: scanRoots,
      excluded_path_prefixes: excludedPrefixes,
    },
    source_policy: {
      allowed_sources_env: ALLOWED_SOURCES_ENV,
      denied_sources_env: DENIED_SOURCES_ENV,
      allowed_sources: allowedSources,
      denied_sources: deniedSources,
    },
    totals: {
      references: refs.length,
      pinned: refs.length - unpinned.length,
      unpinned: unpinned.length,
      latest_tag: latestTags.length,
      source_policy_violations: sourcePolicyViolations.length,
    },
    unpinned,
    source_policy_violations: sourcePolicyViolations,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'security-docker-digest-pinning-latest.json');
  const outMd = path.join(outDir, 'security-docker-digest-pinning-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Docker Digest Pinning Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Totals',
    `- references: ${report.totals.references}`,
    `- pinned: ${report.totals.pinned}`,
    `- unpinned: ${report.totals.unpinned}`,
    `- latest_tag: ${report.totals.latest_tag}`,
    `- source_policy_violations: ${report.totals.source_policy_violations}`,
    '',
    '## Scope',
    `- scan_roots: ${report.scope.scan_roots.join(', ') || '(none)'}`,
    `- excluded_path_prefixes: ${report.scope.excluded_path_prefixes.join(', ') || '(none)'}`,
    '',
    '## Source Policy',
    `- allowed_sources_env: ${report.source_policy.allowed_sources_env}`,
    `- denied_sources_env: ${report.source_policy.denied_sources_env}`,
    `- allowed_sources: ${report.source_policy.allowed_sources.join(', ') || '(not enforced)'}`,
    `- denied_sources: ${report.source_policy.denied_sources.join(', ') || '(none)'}`,
    '',
    '## Unpinned References',
  ];

  if (unpinned.length === 0) {
    lines.push('- [x] none');
  } else {
    for (const row of unpinned) {
      lines.push(`- [ ] ${row.kind}: ${row.image} (${row.source})`);
    }
  }

  lines.push('');
  lines.push('## Source Policy Violations');
  if (sourcePolicyViolations.length === 0) {
    lines.push('- [x] none');
  } else {
    for (const row of sourcePolicyViolations) {
      lines.push(`- [ ] ${row.kind}: ${row.image} (${row.source}) -> ${row.reason}`);
    }
  }

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_SCAN_ROOTS,
  DEFAULT_EXCLUDED_PATH_PREFIXES,
  parseCsv,
  parseScanRoots,
  parseExcludedPathPrefixes,
  shouldScanDockerfilePath,
  parseImageRegistry,
  evaluateSourcePolicy,
};
