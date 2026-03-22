#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const routesRoot = path.join(root, 'services', 'gateway-api', 'src', 'routes');
const openapiPath = path.join(root, 'docs', 'api', 'openapi.yaml');
const outDir = path.join(root, 'docs', 'release', 'status');
const METHOD_RE = /^(get|post|put|patch|delete)$/i;

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

function normalizePath(p) {
  return p
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\{[^}]+\}/g, '{}');
}

function parseOpenApiRequestBodyEndpoints(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  let inPaths = false;
  let currentPath = null;
  let currentMethod = null;
  const out = [];

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
      currentMethod = null;
      continue;
    }
    if (!currentPath) continue;

    const methodMatch = line.match(/^    ([a-z]+):\s*$/i);
    if (methodMatch) {
      const m = methodMatch[1].toLowerCase();
      currentMethod = METHOD_RE.test(m) ? m : null;
      continue;
    }
    if (!currentMethod) continue;

    if (/^      requestBody:\s*$/.test(line)) {
      out.push({ method: currentMethod.toUpperCase(), path: currentPath });
    }
  }
  return out;
}

function resolveRoutePath(filePath, rawPath) {
  const normalizedRaw = String(rawPath || '').trim().replace(/\\/g, '/');
  if (!normalizedRaw) return normalizedRaw;
  if (normalizedRaw.startsWith('/v1') || normalizedRaw.startsWith('/healthz') || normalizedRaw.startsWith('/readyz') || normalizedRaw.startsWith('/metrics')) {
    return normalizedRaw;
  }
  const rel = path.relative(routesRoot, filePath).replace(/\\/g, '/');
  if (rel.startsWith('admin/')) {
    return normalizedRaw.startsWith('/') ? `/v1/admin${normalizedRaw}` : `/v1/admin/${normalizedRaw}`;
  }
  return normalizedRaw.startsWith('/') ? normalizedRaw : `/${normalizedRaw}`;
}

function collectRouteBodySchemaStatus(files) {
  const routeMap = new Map();

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    const decls = [];

    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/);
      if (!m) continue;
      decls.push({
        index: i,
        method: m[1].toUpperCase(),
        path: normalizePath(resolveRoutePath(filePath, m[2])),
        file: path.relative(root, filePath),
        line: i + 1,
      });
    }

    for (let d = 0; d < decls.length; d += 1) {
      const curr = decls[d];
      const nextIndex = d + 1 < decls.length ? decls[d + 1].index : lines.length;
      const block = lines.slice(curr.index, nextIndex).join('\n');
      const hasBodySchema = /schema\s*:\s*\{[\s\S]*?body\s*:/.test(block);
      const key = `${curr.method} ${curr.path}`;
      routeMap.set(key, {
        method: curr.method,
        path: curr.path,
        file: curr.file,
        line: curr.line,
        hasBodySchema,
      });
    }
  }

  return routeMap;
}

function main() {
  if (!fs.existsSync(routesRoot)) {
    console.error(`Missing routes directory: ${routesRoot}`);
    process.exit(1);
  }
  if (!fs.existsSync(openapiPath)) {
    console.error(`Missing OpenAPI file: ${openapiPath}`);
    process.exit(1);
  }

  const files = walkFiles(routesRoot);
  const openapi = fs.readFileSync(openapiPath, 'utf8');
  const expected = parseOpenApiRequestBodyEndpoints(openapi);
  const routeMap = collectRouteBodySchemaStatus(files);

  const missing = [];
  const passes = [];
  const missingRoutes = [];

  for (const endpoint of expected) {
    const key = `${endpoint.method} ${endpoint.path}`;
    const route = routeMap.get(key);
    if (!route) {
      missingRoutes.push({
        method: endpoint.method,
        path: endpoint.path,
      });
      continue;
    }
    if (route.hasBodySchema) {
      passes.push(route);
      continue;
    }
    missing.push(route);
  }

  const sourceRunId =
    String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim()
    || `local-${Date.now()}`;
  const headSha =
    String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim()
    || (() => {
      try {
        return execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString('utf8')
          .trim();
      } catch {
        return '';
      }
    })();

  const report = {
    generated_at: new Date().toISOString(),
    status: missing.length === 0 && missingRoutes.length === 0 ? 'pass' : 'fail',
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: sourceRunId,
    head_sha: headSha || null,
    expected_request_body_routes: expected.length,
    validated_count: passes.length,
    missing_count: missing.length,
    missing_route_count: missingRoutes.length,
    missing_routes: missingRoutes,
    missing,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'api-request-body-schema-coverage-latest.json');
  const mdPath = path.join(outDir, 'api-request-body-schema-coverage-latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# API Request Body Schema Coverage',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Expected request-body routes (OpenAPI): ${report.expected_request_body_routes}`,
    `Validated routes: ${report.validated_count}`,
    `Missing body schema: ${report.missing_count}`,
    `Missing routes: ${report.missing_route_count}`,
    '',
    '## Missing Routes',
    ...(missingRoutes.length
      ? missingRoutes.map((m) => `- ${m.method} ${m.path}`)
      : ['(none)']),
    '',
    '## Missing',
    ...(missing.length
      ? missing.slice(0, 200).map((m) => `- ${m.method} ${m.path} (${m.file}:${m.line})`)
      : ['(none)']),
    '',
  ];
  fs.writeFileSync(mdPath, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  if (report.status !== 'pass') process.exit(2);
}

main();
