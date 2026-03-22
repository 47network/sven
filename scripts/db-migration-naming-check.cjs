#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const migrationsDir = path.join(root, 'services', 'gateway-api', 'src', 'db', 'migrations');
const allowlistPath = path.join(
  root,
  'services',
  'gateway-api',
  'src',
  'db',
  'migrations-legacy-allowlist.json',
);

const TIMESTAMP_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const FORBIDDEN_MIGRATION_PATTERNS = [
  {
    id: 'calendar_demo_account_id',
    description: 'calendar demo account seed identifier',
    pattern: /INSERT\s+INTO\s+calendar_accounts[\s\S]*\bcal_account_demo_radicale\b/i,
  },
  {
    id: 'calendar_demo_password_ref',
    description: 'calendar demo password ref literal',
    pattern: /INSERT\s+INTO\s+calendar_accounts[\s\S]*\benv:\/\/RADICALE_PASSWORD\b/i,
  },
  {
    id: 'calendar_demo_user_id',
    description: 'hardcoded demo user id literal in calendar seed',
    pattern: /INSERT\s+INTO\s+calendar_accounts[\s\S]*'47'/i,
  },
  {
    id: 'calendar_demo_seed_comment',
    description: 'demo seed migration comment marker',
    pattern: /Test data:\s*seed a Radicale account for demo purposes/i,
  },
];

function fail(msg) {
  console.error(`db-migration-naming-check: FAIL - ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) fail(`migrations directory not found: ${migrationsDir}`);
if (!fs.existsSync(allowlistPath)) fail(`allowlist file not found: ${allowlistPath}`);

const allowlistRaw = fs.readFileSync(allowlistPath, 'utf8');
let allowlist = new Set();
try {
  const parsed = JSON.parse(allowlistRaw);
  allowlist = new Set(Array.isArray(parsed.legacy_allowed) ? parsed.legacy_allowed : []);
} catch (err) {
  fail(`invalid allowlist JSON: ${String(err)}`);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const nonCompliant = [];
const duplicateTimestampPrefixes = new Map();
const duplicateSeriesPrefixes = new Map();
const hygieneViolations = [];
let timestampNamed = 0;
let legacyAllowed = 0;

for (const file of files) {
  const tsMatch = file.match(TIMESTAMP_PATTERN);
  let isTimestampNamed = false;
  if (tsMatch) {
    timestampNamed += 1;
    const prefix = tsMatch[1];
    if (!duplicateTimestampPrefixes.has(prefix)) {
      duplicateTimestampPrefixes.set(prefix, []);
    }
    duplicateTimestampPrefixes.get(prefix).push(file);
    isTimestampNamed = true;
  }

  if (!isTimestampNamed) {
    if (allowlist.has(file)) {
      legacyAllowed += 1;
    } else {
      nonCompliant.push(file);
      const seriesMatch = /^(\d+)_/.exec(file);
      if (seriesMatch) {
        const series = seriesMatch[1];
        if (!duplicateSeriesPrefixes.has(series)) {
          duplicateSeriesPrefixes.set(series, []);
        }
        duplicateSeriesPrefixes.get(series).push(file);
      }
    }
  }

  if (!isTimestampNamed) {
    continue;
  }
  const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  for (const rule of FORBIDDEN_MIGRATION_PATTERNS) {
    if (rule.pattern.test(source)) {
      hygieneViolations.push({ file, rule: rule.id, description: rule.description });
    }
  }
}

const duplicateProblems = Array.from(duplicateTimestampPrefixes.entries())
  .filter(([, names]) => names.length > 1)
  .map(([prefix, names]) => ({ prefix, names }));
const duplicateSeriesProblems = Array.from(duplicateSeriesPrefixes.entries())
  .filter(([, names]) => names.length > 1)
  .map(([prefix, names]) => ({ prefix, names }));

if (
  nonCompliant.length > 0 ||
  duplicateProblems.length > 0 ||
  duplicateSeriesProblems.length > 0 ||
  hygieneViolations.length > 0
) {
  if (nonCompliant.length > 0) {
    console.error('Non-compliant migration file names (must use YYYYMMDDHHMMSS_slug.sql):');
    for (const file of nonCompliant) console.error(`- ${file}`);
  }
  if (duplicateProblems.length > 0) {
    console.error('Duplicate timestamp prefixes found:');
    for (const p of duplicateProblems) {
      console.error(`- ${p.prefix}: ${p.names.join(', ')}`);
    }
  }
  if (duplicateSeriesProblems.length > 0) {
    console.error('Duplicate numeric-series prefixes found outside legacy allowlist:');
    for (const p of duplicateSeriesProblems) {
      console.error(`- ${p.prefix}: ${p.names.join(', ')}`);
    }
  }
  if (hygieneViolations.length > 0) {
    console.error('Forbidden production migration seed/content patterns found:');
    for (const item of hygieneViolations) {
      console.error(`- ${item.file}: ${item.rule} (${item.description})`);
    }
  }
  process.exit(1);
}

console.log(
  `db-migration-naming-check: PASS (${files.length} total; ${timestampNamed} timestamp-named; ${legacyAllowed} legacy-allowlisted)`,
);
