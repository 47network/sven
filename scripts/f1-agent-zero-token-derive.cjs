#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('node:crypto');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function required(name, value) {
  const v = String(value || '').trim();
  if (!v) {
    console.error(`f1-agent-zero-token-derive: missing ${name}`);
    process.exit(2);
  }
  return v;
}

const runtimeId = required('--runtime-id', argValue('--runtime-id', process.env.F1_AGENT0_PERSISTENT_ID || ''));
const username = required('--username', argValue('--username', process.env.AUTH_LOGIN || process.env.F1_AGENT0_AUTH_LOGIN || ''));
const password = required('--password', argValue('--password', process.env.AUTH_PASSWORD || process.env.F1_AGENT0_AUTH_PASSWORD || ''));

const input = `${runtimeId}:${username}:${password}`;
const token = crypto
  .createHash('sha256')
  .update(input)
  .digest('base64url')
  .replace(/=/g, '')
  .slice(0, 16);

console.log(token);
