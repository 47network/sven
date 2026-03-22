#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const openapiPath = path.join(root, 'docs', 'api', 'openapi.yaml');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openapi-metrics-latest.json');
const outMd = path.join(outDir, 'openapi-metrics-latest.md');

function countOpenApiMetrics(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  let inPaths = false;
  let inComponents = false;
  let inSchemas = false;
  let inTags = false;

  let pathCount = 0;
  let schemaCount = 0;
  let tagCount = 0;

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      inComponents = false;
      inSchemas = false;
      inTags = false;
      continue;
    }
    if (/^components:\s*$/.test(line)) {
      inComponents = true;
      inPaths = false;
      inTags = false;
      continue;
    }
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      inPaths = false;
      inComponents = false;
      inSchemas = false;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(line) && !/^ {2,}/.test(line)) {
      inPaths = false;
      inComponents = false;
      inSchemas = false;
      inTags = false;
    }

    if (inPaths && /^  \/[^:]+:\s*$/.test(line)) {
      pathCount += 1;
      continue;
    }

    if (inComponents && /^  schemas:\s*$/.test(line)) {
      inSchemas = true;
      continue;
    }
    if (inSchemas && /^  [a-zA-Z_][\w-]*:\s*$/.test(line)) {
      inSchemas = false;
    }
    if (inSchemas && /^    [A-Za-z0-9_][A-Za-z0-9_.-]*:\s*$/.test(line)) {
      schemaCount += 1;
      continue;
    }

    if (inTags && /^  - name:\s+.+$/.test(line)) {
      tagCount += 1;
    }
  }

  return { pathCount, schemaCount, tagCount };
}

function main() {
  if (!fs.existsSync(openapiPath)) {
    console.error(`Missing OpenAPI spec: ${openapiPath}`);
    process.exit(1);
  }

  const yaml = fs.readFileSync(openapiPath, 'utf8');
  const { pathCount, schemaCount, tagCount } = countOpenApiMetrics(yaml);
  const generatedAt = new Date().toISOString();
  const report = {
    generated_at: generatedAt,
    metrics: {
      openapi_paths_count: pathCount,
      openapi_schemas_count: schemaCount,
      openapi_tags_count: tagCount,
    },
    sources: {
      openapi_spec: 'docs/api/openapi.yaml',
      generator: 'scripts/openapi-metrics-snapshot.cjs',
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# OpenAPI Metrics Snapshot',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Metrics',
    `- openapi_paths_count: ${pathCount}`,
    `- openapi_schemas_count: ${schemaCount}`,
    `- openapi_tags_count: ${tagCount}`,
    '',
    '## Sources',
    '- docs/api/openapi.yaml',
    '- scripts/openapi-metrics-snapshot.cjs',
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
}

main();

