#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const openapiPath = path.join(root, 'docs', 'api', 'openapi.yaml');
const routesRoot = path.join(root, 'services', 'gateway-api', 'src', 'routes');
const undocumentedAllowlistPath = path.join(root, 'config', 'release', 'openapi-undocumented-route-allowlist.json');
const outDir = path.join(root, 'docs', 'release', 'status');
function resolveUndocumentedRoutesMax(allowlistEntryCount) {
  const raw = String(process.env.SVEN_OPENAPI_UNDOCUMENTED_ROUTES_MAX || '').trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return {
        value: parsed,
        source: 'env',
      };
    }
  }
  return {
    value: allowlistEntryCount,
    source: 'allowlist_default',
  };
}

const METHOD_RE = /^(get|post|put|patch|delete)$/i;

function normalizePath(p) {
  const withBraces = p
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\{[^}]+\}/g, '{}');
  if (withBraces.length > 1 && withBraces.endsWith('/')) return withBraces.slice(0, -1);
  return withBraces;
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function parseOpenApiEndpoints(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  let inPaths = false;
  let currentPath = null;
  const endpoints = [];

  for (const raw of lines) {
    const line = raw;
    if (!inPaths) {
      if (/^paths:\s*$/.test(line)) inPaths = true;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(line)) break;

    const pathMatch = line.match(/^  (\/v[0-9]+\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = normalizePath(pathMatch[1]);
      continue;
    }
    if (!currentPath) continue;

    const methodMatch = line.match(/^    ([a-z]+):\s*$/i);
    if (!methodMatch) continue;
    const method = methodMatch[1].toLowerCase();
    if (!METHOD_RE.test(method)) continue;
    endpoints.push({ method, path: currentPath });
  }

  return endpoints;
}

function resolveRoutePath(filePath, rawPath) {
  const normalizedRaw = String(rawPath || '').trim();
  if (!normalizedRaw) return normalizedRaw;

  const normalizedSlashes = normalizedRaw.replace(/\\/g, '/');
  if (normalizedSlashes.startsWith('/v1') || normalizedSlashes.startsWith('/healthz') || normalizedSlashes.startsWith('/readyz') || normalizedSlashes.startsWith('/metrics')) {
    return normalizedSlashes;
  }

  const rel = path.relative(routesRoot, filePath).replace(/\\/g, '/');
  if (rel.startsWith('admin/')) {
    if (normalizedSlashes.startsWith('/')) {
      return `/v1/admin${normalizedSlashes}`;
    }
    return `/v1/admin/${normalizedSlashes}`;
  }

  return normalizedSlashes.startsWith('/') ? normalizedSlashes : `/${normalizedSlashes}`;
}

function parseRouteEndpoints(filePath, tsText) {
  const endpoints = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = re.exec(tsText)) !== null) {
    const resolvedPath = resolveRoutePath(filePath, match[2]);
    endpoints.push({ method: match[1].toLowerCase(), path: normalizePath(resolvedPath) });
  }
  return endpoints;
}

function readUndocumentedAllowlist(filePath) {
  if (!fs.existsSync(filePath)) {
    return { set: new Set(), diagnostics: { present: false, entries: 0 } };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const normalized = entries
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  return {
    set: new Set(normalized),
    diagnostics: {
      present: true,
      entries: normalized.length,
    },
  };
}

function resolveSourceRunId() {
  const explicit = String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim();
  if (explicit) return explicit;
  return `local-openapi-contract-${Date.now()}`;
}

function resolveHeadSha() {
  const explicit = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  if (explicit) return explicit;
  const git = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (git.status === 0) {
    const head = String(git.stdout || '').trim();
    if (head) return head;
  }
  return null;
}

function main() {
  if (!fs.existsSync(openapiPath)) {
    console.error(`Missing OpenAPI file: ${openapiPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(routesRoot)) {
    console.error(`Missing routes directory: ${routesRoot}`);
    process.exit(1);
  }

  const openapi = fs.readFileSync(openapiPath, 'utf8');
  const specEndpoints = parseOpenApiEndpoints(openapi);
  const routeFiles = walkFiles(routesRoot);
  const allowlist = readUndocumentedAllowlist(undocumentedAllowlistPath);

  const routeEndpoints = [];
  for (const file of routeFiles) {
    const text = fs.readFileSync(file, 'utf8');
    routeEndpoints.push(...parseRouteEndpoints(file, text));
  }

  const routeSet = new Set(routeEndpoints.map((e) => `${e.method} ${e.path}`));
  const specSet = new Set(specEndpoints.map((e) => `${e.method} ${e.path}`));
  const undocumentedRoutesMax = resolveUndocumentedRoutesMax(allowlist.diagnostics.entries);

  const missingInRoutes = specEndpoints
    .map((e) => `${e.method} ${e.path}`)
    .filter((key) => !routeSet.has(key));
  const undocumentedRoutes = routeEndpoints
    .map((e) => `${e.method} ${e.path}`)
    .filter((key) => key.startsWith('get /v1') || key.startsWith('post /v1') || key.startsWith('put /v1') || key.startsWith('patch /v1') || key.startsWith('delete /v1'))
    .filter((key) => !specSet.has(key));
  const unexpectedUndocumentedRoutes = undocumentedRoutes.filter((key) => !allowlist.set.has(String(key).toLowerCase()));
  const allowlistMissing = !allowlist.diagnostics.present;

  const report = {
    generated_at: new Date().toISOString(),
    status:
      missingInRoutes.length === 0
      && unexpectedUndocumentedRoutes.length === 0
      && !allowlistMissing
      && undocumentedRoutes.length <= undocumentedRoutesMax.value
        ? 'pass'
        : 'fail',
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: resolveSourceRunId(),
    head_sha: resolveHeadSha(),
    undocumented_allowlist_path: path.relative(root, undocumentedAllowlistPath),
    undocumented_allowlist_present: allowlist.diagnostics.present,
    undocumented_allowlist_entries: allowlist.diagnostics.entries,
    spec_endpoint_count: specSet.size,
    route_endpoint_count: new Set(routeEndpoints.map((e) => `${e.method} ${e.path}`)).size,
    missing_in_routes: missingInRoutes,
    undocumented_routes_count: undocumentedRoutes.length,
    undocumented_routes: undocumentedRoutes,
    undocumented_routes_sample: undocumentedRoutes.slice(0, 30),
    undocumented_routes_max: undocumentedRoutesMax.value,
    undocumented_routes_max_source: undocumentedRoutesMax.source,
    undocumented_routes_threshold_exceeded: undocumentedRoutes.length > undocumentedRoutesMax.value,
    unexpected_undocumented_routes_count: unexpectedUndocumentedRoutes.length,
    unexpected_undocumented_routes_sample: unexpectedUndocumentedRoutes.slice(0, 30),
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'api-openapi-contract-latest.json');
  const mdPath = path.join(outDir, 'api-openapi-contract-latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# API OpenAPI Contract Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Spec endpoints: ${report.spec_endpoint_count}`,
    `Route endpoints (all): ${report.route_endpoint_count}`,
    `Missing in routes: ${report.missing_in_routes.length}`,
    `Undocumented route count: ${report.undocumented_routes_count}`,
    `Undocumented route max: ${report.undocumented_routes_max}`,
    `Undocumented route threshold exceeded: ${report.undocumented_routes_threshold_exceeded}`,
    `Undocumented allowlist present: ${report.undocumented_allowlist_present}`,
    `Undocumented allowlist entries: ${report.undocumented_allowlist_entries}`,
    `Unexpected undocumented route count: ${report.unexpected_undocumented_routes_count}`,
    '',
    '## Missing in Routes',
    ...((report.missing_in_routes.length ? report.missing_in_routes : ['(none)']).map((s) => `- ${s}`)),
    '',
    '## Undocumented Route Sample',
    ...((report.undocumented_routes_sample.length ? report.undocumented_routes_sample : ['(none)']).map((s) => `- ${s}`)),
    '',
    '## Unexpected Undocumented Route Sample',
    ...((report.unexpected_undocumented_routes_sample.length ? report.unexpected_undocumented_routes_sample : ['(none)']).map((s) => `- ${s}`)),
    '',
  ];
  fs.writeFileSync(mdPath, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  if (
    missingInRoutes.length > 0
    || unexpectedUndocumentedRoutes.length > 0
    || allowlistMissing
    || undocumentedRoutes.length > undocumentedRoutesMax.value
  ) process.exit(2);
}

main();
