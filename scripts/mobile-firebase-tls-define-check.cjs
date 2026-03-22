#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function readJsonIfExists(relPath) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
}

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parsePins(raw) {
  if (!isNonEmpty(raw)) return [];
  return raw
    .split(/[,\s;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function isValidSha256Hex(value) {
  return /^[a-f0-9]{64}$/.test(value);
}

function resolveDefineBundle() {
  const candidates = [
    'config/env/mobile-dart-defines.ci.release.json',
    'config/env/mobile-dart-defines.release.local.json',
  ];
  for (const relPath of candidates) {
    const payload = readJsonIfExists(relPath);
    if (payload && typeof payload === 'object') {
      return { relPath, payload };
    }
  }
  return { relPath: null, payload: null };
}

function run() {
  const defineBundle = resolveDefineBundle();
  const resolveValue = (key) => {
    const envValue = process.env[key];
    if (isNonEmpty(envValue)) return envValue;
    const fileValue = defineBundle.payload && typeof defineBundle.payload[key] === 'string'
      ? defineBundle.payload[key]
      : '';
    return fileValue;
  };

  const pinsRaw = resolveValue('SVEN_API_CERT_SHA256_PINS') || '';
  const pins = parsePins(pinsRaw);
  const invalidPins = pins.filter((p) => !isValidSha256Hex(p));

  const requiredVars = [
    'SVEN_API_CERT_SHA256_PINS',
    'SVEN_FIREBASE_IOS_PROD_API_KEY',
    'SVEN_FIREBASE_IOS_PROD_APP_ID',
    'SVEN_FIREBASE_IOS_PROD_BUNDLE_ID',
    'SVEN_FIREBASE_WEB_API_KEY',
    'SVEN_FIREBASE_WEB_APP_ID',
  ];

  const checks = [
    {
      id: 'tls_pins_present',
      pass: pins.length >= 1,
      detail: pins.length >= 1 ? `count=${pins.length}` : 'missing SVEN_API_CERT_SHA256_PINS',
    },
    {
      id: 'tls_pins_format_valid',
      pass: invalidPins.length === 0 && pins.length > 0,
      detail:
        invalidPins.length === 0
          ? `valid_count=${pins.length}`
          : `invalid_pins=${invalidPins.length} (must be 64-char lowercase hex)`,
    },
  ];

  for (const varName of requiredVars.slice(1)) {
    const value = resolveValue(varName) || '';
    const source = isNonEmpty(process.env[varName])
      ? 'env'
      : (defineBundle.relPath && isNonEmpty(value) ? defineBundle.relPath : 'missing');
    checks.push({
      id: `env_present:${varName}`,
      pass: isNonEmpty(value),
      detail: isNonEmpty(value) ? `present via ${source}` : 'missing',
    });
  }

  // Lightweight source guard so config keys cannot be accidentally removed.
  const firebaseOptionsPath = path.join(root, 'apps', 'companion-user-flutter', 'lib', 'firebase_options.dart');
  const dioClientPath = path.join(root, 'apps', 'companion-user-flutter', 'lib', 'app', 'dio_http_client.dart');
  const firebaseSource = fs.existsSync(firebaseOptionsPath) ? fs.readFileSync(firebaseOptionsPath, 'utf8') : '';
  const dioSource = fs.existsSync(dioClientPath) ? fs.readFileSync(dioClientPath, 'utf8') : '';

  const sourceTokens = [
    'SVEN_FIREBASE_IOS_PROD_API_KEY',
    'SVEN_FIREBASE_IOS_PROD_APP_ID',
    'SVEN_FIREBASE_IOS_PROD_BUNDLE_ID',
    'SVEN_FIREBASE_WEB_API_KEY',
    'SVEN_FIREBASE_WEB_APP_ID',
    'SVEN_API_CERT_SHA256_PINS',
  ];
  for (const token of sourceTokens) {
    const inFirebase = firebaseSource.includes(token);
    const inDio = dioSource.includes(token);
    const found = inFirebase || inDio;
    checks.push({
      id: `source_token_present:${token}`,
      pass: found,
      detail: found ? 'present' : 'missing in source',
    });
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    define_bundle_source: defineBundle.relPath || '(none)',
    checks,
    notes: [
      'Provide required values as CI/CD protected variables.',
      'Pipe them into flutter build via --dart-define or --dart-define-from-file.',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-firebase-tls-define-latest.json');
  const outMd = path.join(outDir, 'mobile-firebase-tls-define-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Mobile Firebase/TLS Define Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n\n## Notes\n${report.notes.map((n) => `- ${n}`).join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
