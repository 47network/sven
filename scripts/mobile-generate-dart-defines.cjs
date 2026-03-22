#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const args = process.argv.slice(2);

function getArg(flag, fallback = null) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const outRel = getArg('--out', 'config/env/mobile-dart-defines.release.local.json');
const strict = args.includes('--strict');

const required = [
  'SVEN_API_CERT_SHA256_PINS',
  'SVEN_FIREBASE_IOS_PROD_API_KEY',
  'SVEN_FIREBASE_IOS_PROD_APP_ID',
  'SVEN_FIREBASE_IOS_PROD_BUNDLE_ID',
  'SVEN_FIREBASE_WEB_API_KEY',
  'SVEN_FIREBASE_WEB_APP_ID',
];

const optionalDefaults = {
  SVEN_FLAVOR: 'prod',
  SVEN_ENV: 'production',
  SVEN_API_BASE: 'https://app.sven.example.com',
  SVEN_FIREBASE_WEB_AUTH_DOMAIN: 'thesven.firebaseapp.com',
};

function nonEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function parsePins(raw) {
  if (!nonEmpty(raw)) return [];
  return raw
    .split(/[,\s;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function isSha256Hex(v) {
  return /^[a-f0-9]{64}$/.test(v);
}

function run() {
  const missing = [];
  for (const key of required) {
    if (!nonEmpty(process.env[key])) missing.push(key);
  }

  const pins = parsePins(process.env.SVEN_API_CERT_SHA256_PINS || '');
  const invalidPins = pins.filter((p) => !isSha256Hex(p));

  const payload = {
    SVEN_FLAVOR: process.env.SVEN_FLAVOR || optionalDefaults.SVEN_FLAVOR,
    SVEN_ENV: process.env.SVEN_ENV || optionalDefaults.SVEN_ENV,
    SVEN_API_BASE: process.env.SVEN_API_BASE || optionalDefaults.SVEN_API_BASE,
    SVEN_API_CERT_SHA256_PINS: process.env.SVEN_API_CERT_SHA256_PINS || '',
    SVEN_FIREBASE_IOS_PROD_API_KEY: process.env.SVEN_FIREBASE_IOS_PROD_API_KEY || '',
    SVEN_FIREBASE_IOS_PROD_APP_ID: process.env.SVEN_FIREBASE_IOS_PROD_APP_ID || '',
    SVEN_FIREBASE_IOS_PROD_BUNDLE_ID: process.env.SVEN_FIREBASE_IOS_PROD_BUNDLE_ID || '',
    SVEN_FIREBASE_WEB_API_KEY: process.env.SVEN_FIREBASE_WEB_API_KEY || '',
    SVEN_FIREBASE_WEB_APP_ID: process.env.SVEN_FIREBASE_WEB_APP_ID || '',
    SVEN_FIREBASE_WEB_AUTH_DOMAIN:
      process.env.SVEN_FIREBASE_WEB_AUTH_DOMAIN || optionalDefaults.SVEN_FIREBASE_WEB_AUTH_DOMAIN,
  };

  const outAbs = path.join(root, outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const summary = {
    generated_at: new Date().toISOString(),
    out_file: outRel.replace(/\\/g, '/'),
    missing_required_env: missing,
    invalid_tls_pins: invalidPins,
    tls_pin_count: pins.length,
    status: missing.length === 0 && invalidPins.length === 0 ? 'pass' : 'fail',
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${outRel}`);

  if (strict && summary.status !== 'pass') process.exit(2);
}

run();

