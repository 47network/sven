#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const outputJson = path.resolve(root, argValue('--output-json', 'docs/release/status/master-checklist-metrics-latest.json'));
const outputMd = path.resolve(root, argValue('--output-md', 'docs/release/status/master-checklist-metrics-latest.md'));

function listFilesRecursive(dir, matcher) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (!matcher || matcher(entry.name, full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function countRoutes(routeFiles) {
  const routeRegex = /\.(get|post|put|patch|delete|head|options)\s*\(/g;
  let count = 0;
  for (const file of routeFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(routeRegex);
    if (matches) count += matches.length;
  }
  return count;
}

function countTestCases(testFiles) {
  const testRegex = /\bit\s*\(/g;
  let count = 0;
  for (const file of testFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(testRegex);
    if (matches) count += matches.length;
  }
  return count;
}

function countOptionalLabeledTestCases(testFiles) {
  const titleRegex = /\bit\s*\(\s*(['"`])([\s\S]*?)\1/g;
  let count = 0;
  for (const file of testFiles) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = titleRegex.exec(text)) !== null) {
      const title = String(match[2] || '');
      if (/\boptional\b/i.test(title)) {
        count += 1;
      }
    }
  }
  return count;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function main() {
  const migrationsDir = path.join(root, 'services/gateway-api/src/db/migrations');
  const servicesDir = path.join(root, 'services');
  const routesDir = path.join(root, 'services/gateway-api/src/routes');
  const testsDir = path.join(root, 'services/gateway-api/src/__tests__');

  const migrationFiles = listFilesRecursive(migrationsDir, (name) => name.toLowerCase().endsWith('.sql'));
  const serviceDirs = fs.existsSync(servicesDir)
    ? fs.readdirSync(servicesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const adapterServiceDirs = serviceDirs.filter((name) => name.startsWith('adapter-')).sort();
  const serviceTsFiles = listFilesRecursive(servicesDir, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
  const routeFiles = listFilesRecursive(routesDir, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
  const e2eFiles = listFilesRecursive(
    testsDir,
    (name) =>
      (name.endsWith('.ts') || name.endsWith('.js')) &&
      /e2e/i.test(name),
  );
  const gatewayE2eTestCasesDetected = countTestCases(e2eFiles);
  const gatewayE2eOptionalLabeledTestCasesDetected = countOptionalLabeledTestCases(e2eFiles);
  const gatewayE2eRequiredTestCasesDetected = Math.max(
    0,
    gatewayE2eTestCasesDetected - gatewayE2eOptionalLabeledTestCasesDetected,
  );

  const metrics = {
    status: 'pass',
    generated_at: new Date().toISOString(),
    metrics: {
      migrations_sql_files: migrationFiles.length,
      services_directories: serviceDirs.length,
      adapter_services_count: adapterServiceDirs.length,
      adapter_service_names: adapterServiceDirs,
      services_ts_files: serviceTsFiles.length,
      gateway_route_files: routeFiles.length,
      gateway_route_endpoints_detected: countRoutes(routeFiles),
      gateway_e2e_files: e2eFiles.length,
      gateway_e2e_test_cases_detected: gatewayE2eTestCasesDetected,
      gateway_e2e_required_test_cases_detected: gatewayE2eRequiredTestCasesDetected,
      gateway_e2e_optional_labeled_test_cases_detected: gatewayE2eOptionalLabeledTestCasesDetected,
    },
    sources: {
      migrations_dir: rel(migrationsDir),
      services_dir: rel(servicesDir),
      routes_dir: rel(routesDir),
      tests_dir: rel(testsDir),
    },
  };

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMd), { recursive: true });
  fs.writeFileSync(outputJson, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

  const lines = [
    '# Master Checklist Metrics Snapshot',
    '',
    `Generated: ${metrics.generated_at}`,
    '',
    '## Metrics',
    `- migrations_sql_files: ${metrics.metrics.migrations_sql_files}`,
    `- services_directories: ${metrics.metrics.services_directories}`,
    `- adapter_services_count: ${metrics.metrics.adapter_services_count}`,
    `- adapter_service_names: ${metrics.metrics.adapter_service_names.join(', ')}`,
    `- services_ts_files: ${metrics.metrics.services_ts_files}`,
    `- gateway_route_files: ${metrics.metrics.gateway_route_files}`,
    `- gateway_route_endpoints_detected: ${metrics.metrics.gateway_route_endpoints_detected}`,
    `- gateway_e2e_files: ${metrics.metrics.gateway_e2e_files}`,
    `- gateway_e2e_test_cases_detected: ${metrics.metrics.gateway_e2e_test_cases_detected}`,
    `- gateway_e2e_required_test_cases_detected: ${metrics.metrics.gateway_e2e_required_test_cases_detected}`,
    `- gateway_e2e_optional_labeled_test_cases_detected: ${metrics.metrics.gateway_e2e_optional_labeled_test_cases_detected}`,
    '',
    '## Sources',
    `- ${metrics.sources.migrations_dir}`,
    `- ${metrics.sources.services_dir}`,
    `- ${metrics.sources.routes_dir}`,
    `- ${metrics.sources.tests_dir}`,
    '',
  ];
  fs.writeFileSync(outputMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outputJson)}`);
  console.log(`Wrote ${rel(outputMd)}`);
}

main();
