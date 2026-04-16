#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { statSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { basename, extname, resolve, join, dirname, isAbsolute } from 'node:path';
import readline from 'node:readline';
import os from 'node:os';
import tls from 'node:tls';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function readCliOption(argv, name) {
  const idx = argv.findIndex((arg) => arg === `--${name}`);
  if (idx < 0) return undefined;
  const next = argv[idx + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const RAW_ARGV = process.argv.slice(2);
const ACTIVE_PROFILE_RAW = String(readCliOption(RAW_ARGV, 'profile') || process.env.SVEN_PROFILE || 'default');
const ACTIVE_PROFILE = ACTIVE_PROFILE_RAW.replace(/[^a-zA-Z0-9._-]/g, '') || 'default';
const RAW_FORMAT = String(readCliOption(RAW_ARGV, 'format') || process.env.SVEN_OUTPUT_FORMAT || '').toLowerCase();
const OUTPUT_FORMAT = RAW_FORMAT === 'ndjson' ? 'ndjson' : RAW_FORMAT === 'json' ? 'json' : 'text';
const TRACE_ENABLED = Boolean(readCliOption(RAW_ARGV, 'trace') || process.env.SVEN_TRACE === '1');

const VERSION = process.env.SVEN_VERSION || '0.1.0';
const DEFAULT_GATEWAY_URL = process.env.SVEN_GATEWAY_URL || 'http://localhost:3000';
const DEFAULT_GATEWAY_SERVICE = process.env.SVEN_GATEWAY_SERVICE || 'gateway-api';
const VALID_UPDATE_CHANNELS = new Set(['stable', 'beta', 'dev']);
const PROFILE_DIR = ACTIVE_PROFILE === 'default'
  ? join(os.homedir(), '.sven')
  : join(os.homedir(), '.sven', 'profiles', ACTIVE_PROFILE);
const DEFAULT_CONFIG_PATH = process.env.SVEN_CONFIG || join(PROFILE_DIR, 'sven.json');
const DEFAULT_SECURE_STORE_PATH = process.env.SVEN_SECURE_STORE || join(PROFILE_DIR, 'secure-store.json');
const DEFAULT_INSTALL_CONTEXT_PATH = process.env.SVEN_INSTALL_CONTEXT || join(PROFILE_DIR, 'install-context.json');
const DEFAULT_COMPOSE_FILE = 'docker-compose.yml';
const EXIT_CODES = {
  ok: 0,
  runtime_error: 1,
  policy_or_validation_error: 2,
};

function print(text) {
  process.stdout.write(`${text}\n`);
}

function printErr(text) {
  process.stderr.write(`${text}\n`);
}

function isReadableFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isWindowsPlatform() {
  return process.platform === 'win32';
}

function applyOwnerOnlyDirectoryPermissions(dirPath) {
  if (isWindowsPlatform()) return;
  try {
    chmodSync(dirPath, 0o700);
  } catch {
    // Best-effort hardening. Keep the CLI usable on filesystems without chmod support.
  }
}

function applyOwnerOnlyFilePermissions(filePath) {
  if (isWindowsPlatform()) return;
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort hardening. Keep the CLI usable on filesystems without chmod support.
  }
}

function ensureOwnerOnlyDirectory(dirPath) {
  mkdirSync(dirPath, { recursive: true });
  applyOwnerOnlyDirectoryPermissions(dirPath);
}

function writeOwnerOnlyFileSync(filePath, content) {
  const dir = dirname(filePath);
  ensureOwnerOnlyDirectory(dir);
  writeFileSync(filePath, content, 'utf8');
  applyOwnerOnlyFilePermissions(filePath);
}

function resolveComposeContext(options = {}) {
  const requestedRoot = String(options['app-root'] || options.appRoot || process.env.SVEN_APP_ROOT || process.cwd());
  const projectDirectory = resolve(requestedRoot);
  const requestedComposeFile = String(
    options['compose-file']
      || options.composeFile
      || process.env.SVEN_COMPOSE_FILE
      || join(projectDirectory, DEFAULT_COMPOSE_FILE)
  );
  const composeFile = isAbsolute(requestedComposeFile)
    ? requestedComposeFile
    : resolve(projectDirectory, requestedComposeFile);
  return {
    project_directory: projectDirectory,
    compose_file: composeFile,
  };
}

function loadInstallContext() {
  if (!isReadableFile(DEFAULT_INSTALL_CONTEXT_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(DEFAULT_INSTALL_CONTEXT_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.project_directory !== 'string' || typeof parsed.compose_file !== 'string') return null;
    return {
      project_directory: resolve(String(parsed.project_directory)),
      compose_file: resolve(String(parsed.compose_file)),
      updated_at: parsed.updated_at ? String(parsed.updated_at) : null,
      source: 'install-context',
    };
  } catch {
    return null;
  }
}

function saveInstallContext(context) {
  writeOwnerOnlyFileSync(
    DEFAULT_INSTALL_CONTEXT_PATH,
    `${JSON.stringify({
      project_directory: context.project_directory,
      compose_file: context.compose_file,
      updated_at: new Date().toISOString(),
    }, null, 2)}\n`,
    'utf8',
  );
}

function resolveManagedComposeContext(options = {}) {
  const persisted = loadInstallContext();
  if (persisted && isReadableFile(persisted.compose_file)) {
    return persisted;
  }
  return {
    ...resolveComposeContext(options),
    source: 'cwd',
  };
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return { positionals, options };
}

function toJson(value, asJson) {
  const format = asJson ? 'json' : OUTPUT_FORMAT;
  if (format === 'ndjson') {
    if (typeof value === 'string') {
      print(JSON.stringify({ message: value }));
      return;
    }
    print(JSON.stringify(value));
    return;
  }
  if (format === 'json') {
    print(JSON.stringify(value, null, 2));
    return;
  }
  if (typeof value === 'string') {
    print(value);
    return;
  }
  print(JSON.stringify(value, null, 2));
}

function usage() {
  return [
    'Sven CLI',
    '',
    'Usage:',
    '  sven --help',
    '  sven --version',
    '  sven --profile <name> [--format <text|json|ndjson>] [--trace] [--strict-config] <command>',
    '  sven gateway status [--url <gateway_url>] [--json]',
    '  sven doctor [--url <gateway_url>] [--doctor-profile <quick|release-strict>] [--json]',
    '  sven install [--mode <none|systemd|launchd|pm2|auto>] [--dry-run] [--json]',
    '  sven wizard [--output <path>] [--resume] [--state <path>] [--json]',
    '  sven onboard [--output <path>] [--resume] [--state <path>] [--json]',
    '  sven agent --message "<text>" --channel <channel> --chat-id <chat_id> --sender-identity-id <identity_id> [--url <gateway_url>] [--adapter-token <token>] [--json]',
    '  sven send --message "<text>" --channel <channel> --chat-id <chat_id> --sender-identity-id <identity_id> [--to <channel:chat_id>] [--file <path_or_url>] [--url <gateway_url>] [--adapter-token <token>] [--json]',
    '  sven channels list [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven channels login <channel> [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven skills list [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven skills install <slug_or_id> --tool-id <tool_id> [--trust-level <quarantined|internal|trusted>] [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven plugins import-openclaw <manifest_url> [--out <dir>] [--slug <slug>] [--json]',
    '  sven approvals list [--status <pending|approved|denied|expired>] [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven pairing list [--status <pending|approved|denied|expired>] [--channel <name>] [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven pairing approve <channel> <code> [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven pairing deny <channel> <code> [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven update [--service <service_name>] [--channel <stable|beta|dev>] [--cli-only|--gateway-only] [--yes] [--dry-run] [--json]',
    '  sven config get <key> [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven config set <key> <value> [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven config validate [--config <path>] [--json]',
    '  sven config print [--config <path>] [--json]',
    '  sven souls list [--search <query>] [--installed] [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven souls install <slug> [--activate] [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '  sven auth login-device [--url <gateway_url>] [--poll-seconds <n>] [--json]',
    '  sven auth set-cookie <cookie> [--json]',
    '  sven auth set-adapter-token <token> [--json]',
    '  sven auth clear [--json]',
    '  sven auth status [--json]',
    '  sven exit-codes [--json]',
    '  sven security audit [--fix] [--url <gateway_url>] [--cookie <session_cookie>] [--json]',
    '',
    'Environment:',
    '  SVEN_GATEWAY_URL',
    '  SVEN_ADAPTER_TOKEN',
    '  SVEN_PROFILE',
    '  SVEN_OUTPUT_FORMAT',
    '  SVEN_TRACE=1',
    '  SVEN_STRICT_CONFIG=1',
    '',
  ].join('\n');
}

function usageGateway() {
  return [
    'Usage: sven gateway <subcommand> [options]',
    '',
    'Subcommands:',
    '  status    Show gateway health/uptime',
    '  start     Start gateway container via Docker Compose',
    '  stop      Stop gateway container via Docker Compose',
    '  restart   Restart gateway container via Docker Compose',
    '  logs      Tail gateway logs via Docker Compose',
    '',
    'Options:',
    '  --service <service_name>    Defaults to gateway-api',
    '  --follow                    Follow logs (gateway logs only)',
    '  --json',
  ].join('\n');
}

function usageExitCodes() {
  return [
    'Usage: sven exit-codes [--json]',
    '',
    'Returns the stable CLI exit code contract for CI/scripting.',
  ].join('\n');
}

function usageDoctor() {
  return [
    'Usage: sven doctor [options]',
    '',
    'Options:',
    '  --url <gateway_url>',
    '  --doctor-profile <quick|release-strict>   Default: quick',
    '  --json',
  ].join('\n');
}

function remediationForDoctorCheck(check, gatewayUrl, doctorProfile) {
  const profile = String(doctorProfile || 'quick');
  switch (String(check?.check || '')) {
    case 'gateway.health':
      return `Start or reach the gateway at ${gatewayUrl}, then re-run \`sven doctor --url ${gatewayUrl}\`.`;
    case 'admin.cookie':
      return `Authenticate with \`sven auth login-device --url ${gatewayUrl}\` or pass \`--cookie\` / \`SVEN_SESSION_COOKIE\`, then re-run \`sven doctor --doctor-profile ${profile} --url ${gatewayUrl}\`.`;
    case 'database.migrations':
      return `Re-run doctor with an authenticated admin session to validate migration drift before release.`;
    case 'adapters.connected':
      return 'Authenticate and inspect adapter connectivity through the admin surface before treating the environment as release-ready.';
    case 'security.settings':
      return 'Review incident/auth/buddy settings in Admin UI and return them to release-safe values before release.';
    case 'system.disk_space':
      return 'Free filesystem space on the workspace volume, then re-run doctor.';
    case 'system.nas_mounts':
      return 'Mount the required NAS paths or adjust configuration so the expected mount points are available.';
    case 'runtime.python':
      return 'Install Python 3 and ensure `python3` or `python` is available on PATH.';
    case 'runtime.ffmpeg':
      return 'Install ffmpeg and ensure it is available on PATH.';
    case 'runtime.gpu_driver':
      return 'Install or expose the required GPU driver tooling if GPU acceleration is expected in this environment.';
    case 'security.tls':
      return `Fix TLS/certificate validation for ${gatewayUrl} or use a release-valid HTTPS endpoint before strict release checks.`;
    default:
      return null;
  }
}

function usageInstall() {
  return [
    'Usage: sven install [options]',
    '',
    'Options:',
    '  --mode <none|systemd|launchd|pm2|auto>   Install mode (default: auto)',
    '  --dry-run                                 Show plan without writing files',
    '  --json',
  ].join('\n');
}

function usageWizard() {
  return [
    'Usage: sven wizard [options]',
    '       sven onboard [options]',
    '',
    'Options:',
    '  --output <path>             Defaults to ~/.sven/sven.json',
    '  --defaults                  Non-interactive mode with defaults/env',
    '  --resume                    Resume from wizard state file',
    '  --state <path>              Wizard state path (defaults to <output>.wizard-state.json)',
    '  --doctor                    Force post-setup doctor run (enabled by default)',
    '  --json',
  ].join('\n');
}

function usageChannels() {
  return [
    'Usage:',
    '  sven channels list [options]',
    '  sven channels login <channel> [options]',
    '',
    'Options:',
    '  --url <gateway_url>',
    '  --cookie <session_cookie>',
    '  --json',
  ].join('\n');
}

function usageAuth() {
  return [
    'Usage:',
    '  sven auth login-device [options]',
    '  sven auth set-cookie <cookie> [options]',
    '  sven auth set-adapter-token <token> [options]',
    '  sven auth clear [options]',
    '  sven auth status [options]',
    '',
    'Options:',
    '  --url <gateway_url>',
    '  --poll-seconds <n>',
    '  --json',
  ].join('\n');
}

function usageSkills() {
  return [
    'Usage:',
    '  sven skills list [options]',
    '  sven skills install <slug_or_id> --tool-id <tool_id> [options]',
    '',
    'Options:',
    '  --tool-id <tool_id>',
    '  --trust-level <quarantined|internal|trusted>',
    '  --url <gateway_url>',
    '  --cookie <session_cookie>',
    '  --json',
  ].join('\n');
}

function usagePlugins() {
  return [
    'Usage:',
    '  sven plugins import-openclaw <manifest_url> [options]',
    '  sven plugins import-quarantine <manifest_url> --tool-id <tool_id> [options]',
    '  sven plugins validate [target] [options]',
    '',
    'Options:',
    '  --out <dir>                 Output directory (default: ./skills/<slug>)',
    '  --slug <slug>               Override generated slug',
    '  --tool-id <tool_id>         Tool id for registry install (required for non-dry-run)',
    '  --dry-run                   Plan actions without writing to gateway registry',
    '  --strict                    Treat warnings as failures',
    '  --json',
  ].join('\n');
}

function usageApprovals() {
  return [
    'Usage: sven approvals list [options]',
    '       sven approvals approve <id> [options]',
    '       sven approvals deny <id> [options]',
    '',
    'Options:',
    '  --status <pending|approved|denied|expired>',
    '  --url <gateway_url>',
    '  --cookie <session_cookie>',
    '  --json',
  ].join('\n');
}

function usageConfig() {
  return [
    'Usage:',
    '  sven config get <key> [options]',
    '  sven config set <key> <value> [options]',
    '  sven config validate [options]',
    '  sven config print [options]',
    '',
    'Options:',
    '  --url <gateway_url>',
    '  --cookie <session_cookie>',
    '  --config <path>',
    '  --json',
  ].join('\n');
}

function usagePairing() {
  return [
    'Usage:',
    '  sven pairing list [options]',
    '  sven pairing approve <channel> <code> [options]',
    '  sven pairing deny <channel> <code> [options]',
    '',
    'Options:',
    '  --status <pending|approved|denied|expired>',
    '  --channel <channel_name>',
    '  --url <gateway_url>',
    '  --cookie <session_cookie>',
    '  --json',
  ].join('\n');
}

function usageSouls() {
  return [
    'Usage:',
    '  sven souls list [options]',
    '  sven souls install <slug> [options]',
    '  sven souls sign <slug> [options]',
    '  sven souls signatures [options]',
    '  sven souls publish <file> [options]',
    '  sven souls activate <install_id> [options]',
    '',
    'Options:',
    '  --search <query>',
    '  --installed',
    '  --activate',
    '  --signature <base64>',
    '  --public-key <pem>',
    '  --type <ed25519|rsa-sha256|ecdsa-sha256>',
    '  --trust',
    '  --soul-id <id>',
    '  --slug <slug>',
    '  --name <name>',
    '  --description <text>',
    '  --version <semver>',
    '  --author <name>',
    '  --tags <comma,separated>',
    '  --source <source>',
    '  --url <gateway_url>',
    '  --cookie <session_cookie>',
    '  --json',
  ].join('\n');
}

function usageUpdate() {
  return [
    'Usage: sven update [options]',
    '',
    'Options:',
    '  --service <service_name>    Defaults to gateway-api',
    '  --channel <stable|beta|dev> Release channel (default: stable)',
    '  --cli-only                  Update CLI only',
    '  --gateway-only              Update gateway service only',
    '  --yes                       Skip confirmation prompt',
    '  --dry-run                   Show update plan without executing commands',
    '  --json',
  ].join('\n');
}

function usageAgent() {
  return [
    'Usage: sven agent [--message "<text>"] --channel <channel> (--chat-id <chat_id> | --chat <chat_id>) --sender-identity-id <identity_id> [options]',
    '',
    'Options:',
    '  --url <gateway_url>',
    '  --adapter-token <token>',
    '  --cookie <session_cookie>   Required for --stream',
    '  --model <model_name>',
    '  --thinking <off|low|medium|high>',
    '  --stream                    Stream assistant reply (one-shot mode)',
    '  --json',
  ].join('\n');
}

function usageSend() {
  return [
    'Usage: sven send --message "<text>" --channel <channel> --target <target> --sender-identity-id <identity_id> [options]',
    '',
    'Options:',
    '  --to <channel:chat_id>    Shorthand to set channel/chat-id',
    '  --file <path_or_url>      Attach file via /v1/events/file',
    '  --chat-id <chat_id>',
    '  --target <target>         Alias for --chat-id',
    '  --url <gateway_url>',
    '  --adapter-token <token>',
    '  --yes                   Skip confirmation prompt',
    '  --json',
  ].join('\n');
}

function guessMimeType(fileName) {
  const ext = extname(fileName).toLowerCase();
  if (ext === '.txt') return 'text/plain';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.json') return 'application/json';
  if (ext === '.csv') return 'text/csv';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg') return 'audio/ogg';
  return 'application/octet-stream';
}

function toFilePayload(fileArg) {
  const raw = String(fileArg || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return {
      file_url: raw,
      file_name: basename(raw),
      file_mime: guessMimeType(raw),
    };
  }
  const absolute = resolve(raw);
  const stat = statSync(absolute);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${absolute}`);
  }
  return {
    file_url: `file://${absolute.replace(/\\/g, '/')}`,
    file_name: basename(absolute),
    file_mime: guessMimeType(absolute),
  };
}

async function getJson(url, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const startedAt = Date.now();
  if (TRACE_ENABLED) {
    printErr(
      `[trace] ${JSON.stringify({
        ts: new Date().toISOString(),
        event: 'http.request',
        method,
        url,
      })}`,
    );
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (TRACE_ENABLED) {
      printErr(
        `[trace] ${JSON.stringify({
          ts: new Date().toISOString(),
          event: 'http.response',
          method,
          url,
          status: res.status,
          ok: res.ok,
          duration_ms: Date.now() - startedAt,
        })}`,
      );
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    if (TRACE_ENABLED) {
      printErr(
        `[trace] ${JSON.stringify({
          ts: new Date().toISOString(),
          event: 'http.error',
          method,
          url,
          duration_ms: Date.now() - startedAt,
          error: String(err),
        })}`,
      );
    }
    return {
      status: 0,
      ok: false,
      data: { error: String(err) },
    };
  }
}

function secureStoreKey() {
  const seed = [
    process.env.SVEN_CLI_MASTER_KEY || '',
    os.userInfo().username || '',
    os.homedir() || '',
    os.hostname() || '',
  ].join('|');
  return createHash('sha256').update(seed).digest();
}

function encryptForSecureStore(plainText) {
  const value = String(plainText || '');
  if (!value) return '';
  const iv = randomBytes(12);
  const key = secureStoreKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptFromSecureStore(cipherText) {
  const raw = String(cipherText || '').trim();
  if (!raw) return '';
  try {
    const key = secureStoreKey();
    const packed = Buffer.from(raw, 'base64');
    if (packed.length < 29) return '';
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const enc = packed.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function loadSecureStore() {
  try {
    ensureOwnerOnlyDirectory(dirname(DEFAULT_SECURE_STORE_PATH));
    const raw = readFileSync(DEFAULT_SECURE_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveSecureStore(next) {
  writeOwnerOnlyFileSync(DEFAULT_SECURE_STORE_PATH, `${JSON.stringify(next, null, 2)}\n`);
}

function secureRead(key) {
  const store = loadSecureStore();
  const encrypted = store?.[key];
  return decryptFromSecureStore(encrypted);
}

function secureWrite(key, value) {
  const store = loadSecureStore();
  store[key] = encryptForSecureStore(value);
  saveSecureStore(store);
}

function secureDelete(key) {
  const store = loadSecureStore();
  if (Object.prototype.hasOwnProperty.call(store, key)) {
    delete store[key];
    saveSecureStore(store);
  }
}

function resolveAdapterToken(options) {
  return String(
    options['adapter-token'] ||
      process.env.SVEN_ADAPTER_TOKEN ||
      secureRead('adapter_token') ||
      '',
  );
}

function adminCookie(options) {
  return String(options.cookie || process.env.SVEN_SESSION_COOKIE || secureRead('session_cookie') || '');
}

function resolveConfigPath(options) {
  return String(options.config || DEFAULT_CONFIG_PATH);
}

const MAX_CONFIG_INCLUDE_DEPTH = 10;

function isSensitiveKey(key) {
  const lower = String(key || '').toLowerCase();
  return lower.includes('password') || lower.includes('secret') || lower.includes('token') || lower.includes('key');
}

function redactValue(value, key) {
  if (value === undefined || value === null) return value;
  if (isSensitiveKey(key)) return '***';
  return value;
}

async function readConfigFile(options) {
  const configPath = resolveConfigPath(options);
  try {
    const parsed = await loadConfigWithIncludes(configPath);
    const substituted = substituteEnvVarsInConfig(parsed);
    return { ok: true, path: configPath, data: substituted };
  } catch (err) {
    return { ok: false, path: configPath, error: String(err) };
  }
}

function deepMergeConfig(base, incoming) {
  if (Array.isArray(incoming)) return incoming.slice();
  if (incoming && typeof incoming === 'object') {
    const out = {
      ...((base && typeof base === 'object' && !Array.isArray(base)) ? base : {}),
    };
    for (const [k, v] of Object.entries(incoming)) {
      out[k] = deepMergeConfig(out[k], v);
    }
    return out;
  }
  return incoming !== undefined ? incoming : base;
}

function substituteEnvVarsInConfig(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, key) => {
      const envVal = process.env[key];
      return envVal !== undefined ? envVal : `\${${key}}`;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteEnvVarsInConfig(item));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = substituteEnvVarsInConfig(v);
    }
    return out;
  }
  return value;
}

async function loadConfigWithIncludes(configPath, depth = 0, seen = new Set()) {
  const resolvedPath = resolve(configPath);
  if (seen.has(resolvedPath)) {
    throw new Error(`Config include cycle detected at ${resolvedPath}`);
  }
  if (depth > MAX_CONFIG_INCLUDE_DEPTH) {
    throw new Error(`Config include depth exceeded (${MAX_CONFIG_INCLUDE_DEPTH}) at ${resolvedPath}`);
  }

  const raw = await readFile(resolvedPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in config file ${resolvedPath}: ${String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid config file ${resolvedPath}: top-level JSON object is required`);
  }

  seen.add(resolvedPath);
  const includeRaw = parsed.$include;
  const includes = Array.isArray(includeRaw)
    ? includeRaw.map((x) => String(x)).filter(Boolean)
    : includeRaw
      ? [String(includeRaw)]
      : [];

  let merged = {};
  for (const entry of includes) {
    const includePath = isAbsolute(entry) ? entry : resolve(dirname(resolvedPath), entry);
    const included = await loadConfigWithIncludes(includePath, depth + 1, seen);
    merged = deepMergeConfig(merged, included);
  }
  const current = { ...parsed };
  delete current.$include;
  merged = deepMergeConfig(merged, current);
  seen.delete(resolvedPath);
  return merged;
}

function validateConfigObject(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('config must be a JSON object');
    return errors;
  }
  const gateway = config.gateway;
  if (gateway) {
    if (gateway.port !== undefined && typeof gateway.port !== 'number') {
      errors.push('gateway.port must be a number');
    }
    if (
      gateway.cors_origin !== undefined &&
      typeof gateway.cors_origin !== 'string' &&
      typeof gateway.cors_origin !== 'boolean' &&
      !Array.isArray(gateway.cors_origin)
    ) {
      errors.push('gateway.cors_origin must be string, boolean, or array');
    }
  }
  const database = config.database;
  if (database && database.url !== undefined && typeof database.url !== 'string') {
    errors.push('database.url must be a string');
  }
  const nats = config.nats;
  if (nats && nats.url !== undefined && typeof nats.url !== 'string') {
    errors.push('nats.url must be a string');
  }
  const opensearch = config.opensearch;
  if (opensearch) {
    if (opensearch.url !== undefined && typeof opensearch.url !== 'string') {
      errors.push('opensearch.url must be a string');
    }
    if (opensearch.user !== undefined && typeof opensearch.user !== 'string') {
      errors.push('opensearch.user must be a string');
    }
    if (opensearch.password !== undefined && typeof opensearch.password !== 'string') {
      errors.push('opensearch.password must be a string');
    }
  }
  const inference = config.inference;
  if (inference) {
    if (inference.url !== undefined && typeof inference.url !== 'string') {
      errors.push('inference.url must be a string');
    }
    if (inference.embeddings_dim !== undefined && typeof inference.embeddings_dim !== 'number') {
      errors.push('inference.embeddings_dim must be a number');
    }
  }
  const stream = config.stream;
  if (stream) {
    if (stream.resume_max_events !== undefined && typeof stream.resume_max_events !== 'number') {
      errors.push('stream.resume_max_events must be a number');
    }
    if (stream.resume_ttl_ms !== undefined && typeof stream.resume_ttl_ms !== 'number') {
      errors.push('stream.resume_ttl_ms must be a number');
    }
    if (stream.cleanup_ms !== undefined && typeof stream.cleanup_ms !== 'number') {
      errors.push('stream.cleanup_ms must be a number');
    }
  }
  const tailscale = config.tailscale;
  if (tailscale && tailscale.mode !== undefined && !['off', 'serve', 'funnel'].includes(String(tailscale.mode))) {
    errors.push('tailscale.mode must be one of off|serve|funnel');
  }
  return errors;
}

function resolveConfigValues(config, env) {
  const defaults = {
    GATEWAY_HOST: '0.0.0.0',
    GATEWAY_PORT: '3000',
    STREAM_RESUME_MAX_EVENTS: '500',
    STREAM_RESUME_TTL_MS: '120000',
    STREAM_RESUME_CLEANUP_MS: '30000',
  };
  const mapping = [
    ['gateway.host', 'GATEWAY_HOST'],
    ['gateway.port', 'GATEWAY_PORT'],
    ['gateway.public_url', 'GATEWAY_URL'],
    ['gateway.cors_origin', 'CORS_ORIGIN'],
    ['auth.cookie_secret', 'COOKIE_SECRET'],
    ['auth.deeplink_secret', 'DEEPLINK_SECRET'],
    ['auth.device_verify_url', 'AUTH_DEVICE_VERIFY_URL'],
    ['database.url', 'DATABASE_URL'],
    ['nats.url', 'NATS_URL'],
    ['opensearch.url', 'OPENSEARCH_URL'],
    ['opensearch.user', 'OPENSEARCH_USER'],
    ['opensearch.password', 'OPENSEARCH_PASSWORD'],
    ['opensearch.disable_security', 'OPENSEARCH_DISABLE_SECURITY'],
    ['inference.url', 'OLLAMA_URL'],
    ['inference.embeddings_url', 'EMBEDDINGS_URL'],
    ['inference.embeddings_model', 'EMBEDDINGS_MODEL'],
    ['inference.embeddings_dim', 'EMBEDDINGS_DIM'],
    ['inference.embeddings_provider', 'EMBEDDINGS_PROVIDER'],
    ['stream.resume_max_events', 'STREAM_RESUME_MAX_EVENTS'],
    ['stream.resume_ttl_ms', 'STREAM_RESUME_TTL_MS'],
    ['stream.cleanup_ms', 'STREAM_RESUME_CLEANUP_MS'],
    ['tailscale.mode', 'GATEWAY_TAILSCALE_MODE'],
    ['tailscale.reset_on_shutdown', 'GATEWAY_TAILSCALE_RESET_ON_SHUTDOWN'],
    ['tailscale.bin', 'TAILSCALE_BIN'],
    ['tailscale.cmd_timeout_ms', 'TAILSCALE_CMD_TIMEOUT_MS'],
    ['browser.headless', 'BROWSER_HEADLESS'],
    ['browser.proxy_url', 'BROWSER_PROXY_URL'],
    ['browser.enforce_container', 'BROWSER_ENFORCE_CONTAINER'],
    ['wake_word.base_url', 'WAKE_WORD_BASE_URL'],
    ['email.gmail_pubsub_token', 'GMAIL_PUBSUB_TOKEN'],
    ['adapter.token', 'SVEN_ADAPTER_TOKEN'],
    ['logging.level', 'LOG_LEVEL'],
    ['gateway_url', 'GATEWAY_URL'],
    ['database_url', 'DATABASE_URL'],
    ['nats_url', 'NATS_URL'],
    ['opensearch_url', 'OPENSEARCH_URL'],
    ['inference_url', 'OLLAMA_URL'],
  ];

  const result = [];
  for (const [configKey, envKey] of mapping) {
    const configValue = configKey.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), config);
    if (envKey in env) {
      result.push({ key: envKey, value: env[envKey], source: 'env' });
      continue;
    }
    if (configValue !== undefined) {
      result.push({ key: envKey, value: configValue, source: 'config' });
      continue;
    }
    if (defaults[envKey] !== undefined) {
      result.push({ key: envKey, value: defaults[envKey], source: 'default' });
    }
  }

  if (config && config.env && typeof config.env === 'object') {
    for (const [key, value] of Object.entries(config.env)) {
      if (result.find((item) => item.key === key)) continue;
      const source = key in env ? 'env' : 'config';
      result.push({ key, value: key in env ? env[key] : value, source });
    }
  }

  return result;
}

async function getAdminJson(path, options, init = {}) {
  const url = String(options.url || DEFAULT_GATEWAY_URL);
  const cookie = adminCookie(options);
  const headers = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...(init.headers || {}),
  };
  return getJson(`${url}/v1/admin${path}`, { ...init, headers });
}

function runDockerCompose(args, asJson) {
  const proc = spawnSync('docker', ['compose', ...args], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  const ok = proc.status === 0;
  const payload = {
    status: ok ? 'ok' : 'error',
    code: proc.status,
    stdout: proc.stdout || '',
    stderr: proc.stderr || '',
    command: `docker compose ${args.join(' ')}`,
  };
  toJson(payload, asJson);
  if (!ok) process.exit(proc.status || 1);
}

async function cmdGatewayStatus(options) {
  const url = String(options.url || DEFAULT_GATEWAY_URL);
  const asJson = Boolean(options.json);
  let result = await getJson(`${url}/healthz`);
  if (!result.ok && result.status === 404) {
    result = await getJson(`${url}/health`);
  }
  if (!result.ok) {
    toJson(
      {
        status: 'error',
        message: 'Gateway health check failed',
        http_status: result.status,
        response: result.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson(
    {
      status: 'ok',
      gateway_url: url,
      health: result.data,
    },
    asJson,
  );
}

function cmdGatewayStart(options) {
  const asJson = Boolean(options.json);
  const service = String(options.service || DEFAULT_GATEWAY_SERVICE);
  runDockerCompose(['up', '-d', service], asJson);
  if (!asJson) {
    void printTunnelStartupHint();
  }
}

function extractTunnelUrlFromCloudflaredLogs() {
  const proc = spawnSync('docker', ['compose', 'logs', '--no-color', '--tail', '200', 'cloudflared'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (proc.status !== 0) return null;
  const combined = `${proc.stdout || ''}\n${proc.stderr || ''}`;
  const matches = combined.match(/https:\/\/[^\s"'<>]+/g) || [];
  if (!matches.length) return null;
  const normalized = matches
    .map((m) => m.replace(/[),.;]+$/, ''))
    .filter((m) => /^https?:\/\//i.test(m));
  if (!normalized.length) return null;
  const tryCf = normalized.find((m) => /trycloudflare\.com/i.test(m));
  return tryCf || normalized[0];
}

async function printTunnelStartupHint() {
  const explicit = String(process.env.SVEN_TUNNEL_PUBLIC_URL || '').trim();
  const url = explicit || extractTunnelUrlFromCloudflaredLogs();
  if (!url) return;

  print('');
  print(`Tunnel URL: ${url}`);
  print('Scan QR to open on mobile:');
  try {
    const qrMod = await import('qrcode-terminal');
    const qr = qrMod?.default || qrMod;
    if (qr && typeof qr.generate === 'function') {
      qr.generate(url, { small: true });
      return;
    }
  } catch {
    // Fall through to image URL fallback when terminal generator is unavailable.
  }
  print(`QR Image: https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`);
}

function cmdGatewayStop(options) {
  const asJson = Boolean(options.json);
  const service = String(options.service || DEFAULT_GATEWAY_SERVICE);
  runDockerCompose(['stop', service], asJson);
}

function cmdGatewayRestart(options) {
  const asJson = Boolean(options.json);
  const service = String(options.service || DEFAULT_GATEWAY_SERVICE);
  runDockerCompose(['restart', service], asJson);
}

function cmdGatewayLogs(options) {
  const asJson = Boolean(options.json);
  const service = String(options.service || DEFAULT_GATEWAY_SERVICE);
  const follow = Boolean(options.follow);
  if (follow && !asJson) {
    const child = spawn('docker', ['compose', 'logs', ...(follow ? ['-f'] : []), service], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => process.exit(code || 0));
    return;
  }
  runDockerCompose(['logs', ...(follow ? ['-f'] : []), service], asJson);
}

async function cmdDoctor(options) {
  const url = String(options.url || DEFAULT_GATEWAY_URL);
  const asJson = Boolean(options.json);
  const noExit = Boolean(options.noExit || options['no-exit']);
  const silent = Boolean(options.silent);
  const doctorProfile = String(options['doctor-profile'] || process.env.SVEN_DOCTOR_PROFILE || 'quick')
    .trim()
    .toLowerCase();
  const releaseStrict = doctorProfile === 'release-strict';
  if (!['quick', 'release-strict'].includes(doctorProfile)) {
    printErr(`Invalid --doctor-profile: ${doctorProfile}. Expected one of: quick, release-strict`);
    process.exit(EXIT_CODES.policy_or_validation_error);
    return;
  }
  const checks = [];

  let health = await getJson(`${url}/healthz`);
  if (!health.ok && health.status === 404) {
    health = await getJson(`${url}/health`);
  }
  checks.push({
    check: 'gateway.health',
    status: health.ok ? 'pass' : 'fail',
    http_status: health.status,
  });

  const ready = await getJson(`${url}/readyz`);
  checks.push({
    check: 'gateway.readyz',
    status: ready.ok ? 'pass' : 'fail',
    http_status: ready.status,
  });

  const healthChecks = Array.isArray(health?.data?.checks) ? health.data.checks : [];
  const postgres = healthChecks.find((c) => c?.name === 'postgres');
  const nats = healthChecks.find((c) => c?.name === 'nats');
  if (postgres) {
    checks.push({
      check: 'dependency.postgres',
      status: postgres.status === 'pass' ? 'pass' : 'fail',
      http_status: health.status,
    });
  }
  if (nats) {
    checks.push({
      check: 'dependency.nats',
      status: nats.status === 'pass' ? 'pass' : 'fail',
      http_status: health.status,
    });
  }

  const cookie = adminCookie(options);
  if (cookie) {
    const migrationStatus = await getAdminJson('/db/migrations/status', options);
    let migrationCheckStatus = migrationStatus.ok ? 'pass' : 'fail';
    let migrationNote = '';
    if (migrationStatus.ok) {
      const pendingCount = Number(migrationStatus?.data?.data?.pending_count || 0);
      if (pendingCount > 0) {
        migrationCheckStatus = 'warn';
        migrationNote = `${pendingCount} pending migrations`;
      }
    }
    checks.push({
      check: 'database.migrations',
      status: migrationCheckStatus,
      http_status: migrationStatus.status,
      ...(migrationNote ? { note: migrationNote } : {}),
    });

    const channels = await getAdminJson('/admin/channels', options);
    checks.push({
      check: 'admin.channels',
      status: channels.ok ? 'pass' : 'fail',
      http_status: channels.status,
    });

    const inference = await getAdminJson('/performance/inference/nodes', options);
    let inferenceStatus = inference.ok ? 'pass' : 'fail';
    let inferenceNote = '';
    if (inference.ok) {
      const nodes = Array.isArray(inference?.data?.data) ? inference.data.data : [];
      if (nodes.length === 0) {
        inferenceStatus = 'warn';
        inferenceNote = 'no inference nodes registered';
      } else {
        const healthy = nodes.filter((n) => n?.isHealthy === true);
        if (healthy.length === 0) {
          inferenceStatus = 'fail';
          inferenceNote = 'all inference nodes unhealthy';
        } else if (healthy.length < nodes.length) {
          inferenceStatus = 'warn';
          inferenceNote = `${healthy.length}/${nodes.length} nodes healthy`;
        }
      }
    }
    checks.push({
      check: 'admin.inference',
      status: inferenceStatus,
      http_status: inference.status,
      ...(inferenceNote ? { note: inferenceNote } : {}),
    });

    const rag = await getAdminJson('/rag/sources', options);
    checks.push({
      check: 'admin.rag',
      status: rag.ok ? 'pass' : 'fail',
      http_status: rag.status,
    });

    const ragProbe = await getAdminJson('/rag/search', options, {
      method: 'POST',
      body: JSON.stringify({
        query: 'health check',
        top_n: 1,
        top_k: 0,
      }),
    });
    checks.push({
      check: 'dependency.opensearch',
      status: ragProbe.ok ? 'pass' : 'fail',
      http_status: ragProbe.status,
      ...(ragProbe.ok ? {} : { note: 'rag/search probe failed' }),
    });

    if (channels.ok) {
      const list = Array.isArray(channels?.data?.data?.channels) ? channels.data.data.channels : [];
      const enabled = list.filter((c) => c?.enabled === true);
      const connected = enabled.filter((c) => Number(c?.stats?.identities || 0) > 0);
      let channelStatus = 'pass';
      let channelNote = '';
      if (enabled.length === 0) {
        channelStatus = 'warn';
        channelNote = 'no channel adapters enabled';
      } else if (connected.length === 0) {
        channelStatus = 'warn';
        channelNote = 'enabled adapters have zero linked identities';
      } else if (connected.length < enabled.length) {
        channelStatus = 'warn';
        channelNote = `${connected.length}/${enabled.length} enabled adapters have linked identities`;
      }
      checks.push({
        check: 'adapters.connected',
        status: releaseStrict && channelStatus !== 'pass' ? 'fail' : channelStatus,
        http_status: 200,
        ...(channelNote ? { note: channelNote } : {}),
      });
    } else {
      checks.push({
        check: 'adapters.connected',
        status: releaseStrict ? 'fail' : 'warn',
        http_status: channels.status,
        note: releaseStrict
          ? 'release-strict requires authenticated adapter connectivity inspection'
          : 'unable to inspect channel adapter connectivity',
      });
    }

    const settings = await getAdminJson('/settings', options);
    if (settings.ok) {
      const rows = Array.isArray(settings?.data?.data) ? settings.data.data : [];
      const settingMap = new Map(rows.map((r) => [String(r.key), parseSetting(r.value)]));
      const findings = [];
      const incidentMode = String(settingMap.get('incident.mode') || 'normal');
      if (incidentMode !== 'normal') {
        findings.push(`incident.mode=${incidentMode}`);
      }
      const buddyEnabled = Boolean(settingMap.get('buddy.enabled'));
      if (buddyEnabled) {
        findings.push('buddy.enabled=true (review data-handling policy)');
      }
      const authTotp = settingMap.get('auth.require_totp');
      if (authTotp === false) {
        findings.push('auth.require_totp=false');
      }
      checks.push({
        check: 'security.settings',
        status: releaseStrict && findings.length > 0 ? 'fail' : findings.length > 0 ? 'warn' : 'pass',
        http_status: settings.status,
        ...(findings.length > 0 ? { note: findings.join('; ') } : {}),
      });
    } else {
      checks.push({
        check: 'security.settings',
        status: releaseStrict ? 'fail' : 'warn',
        http_status: settings.status,
        note: releaseStrict
          ? 'release-strict requires authenticated security settings evaluation'
          : 'unable to evaluate settings risk flags',
      });
    }
  } else {
    checks.push({
      check: 'admin.cookie',
      status: releaseStrict ? 'fail' : 'warn',
      http_status: 0,
      note: releaseStrict
        ? 'release-strict requires --cookie or SVEN_SESSION_COOKIE'
        : 'set --cookie or SVEN_SESSION_COOKIE for extended checks',
    });
    checks.push({
      check: 'database.migrations',
      status: releaseStrict ? 'fail' : 'warn',
      http_status: 0,
      note: releaseStrict
        ? 'release-strict requires authenticated migration drift validation'
        : 'set --cookie or SVEN_SESSION_COOKIE to validate migration drift',
    });
  }

  const disk = getDiskUsageCheck();
  checks.push({
    check: 'system.disk_space',
    status: disk.status,
    http_status: 0,
    note: disk.note,
  });

  const nasMount = getNasMountCheck();
  checks.push({
    check: 'system.nas_mounts',
    status: nasMount.status,
    http_status: 0,
    note: nasMount.note,
  });

  const nodeRuntime = getNodeRuntimeCheck();
  checks.push({
    check: 'runtime.node',
    status: nodeRuntime.status,
    http_status: 0,
    note: nodeRuntime.note,
  });

  const pythonRuntime = getPythonCheck();
  checks.push({
    check: 'runtime.python',
    status: pythonRuntime.status,
    http_status: 0,
    note: pythonRuntime.note,
  });

  const ffmpegRuntime = getFfmpegCheck();
  checks.push({
    check: 'runtime.ffmpeg',
    status: ffmpegRuntime.status,
    http_status: 0,
    note: ffmpegRuntime.note,
  });

  const gpuDriver = getGpuDriverCheck();
  checks.push({
    check: 'runtime.gpu_driver',
    status: gpuDriver.status,
    http_status: 0,
    note: gpuDriver.note,
  });

  const tlsCheck = await getTlsCheck(url);
  checks.push({
    check: 'security.tls',
    status: tlsCheck.status,
    http_status: 0,
    note: tlsCheck.note,
  });

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const overall = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
  const nextSteps = checks
    .filter((check) => check.status === 'fail' || check.status === 'warn')
    .map((check) => {
      const suggestedFix = remediationForDoctorCheck(check, url, doctorProfile);
      return suggestedFix
        ? {
            check: check.check,
            status: check.status,
            suggested_fix: suggestedFix,
          }
        : null;
    })
    .filter(Boolean);
  const payload = { status: overall, gateway_url: url, doctor_profile: doctorProfile, checks, next_steps: nextSteps };

  if (asJson && !silent) {
    toJson(payload, true);
  } else if (!asJson && !silent) {
    const icon = (status) => {
      if (status === 'pass') return '✅';
      if (status === 'warn') return '⚠️';
      return '❌';
    };
    print(`Doctor status: ${overall.toUpperCase()}`);
    print(`Gateway: ${url}`);
    for (const check of checks) {
      const note = check.note ? ` (${check.note})` : '';
      print(`${icon(check.status)} ${check.check}: ${String(check.status).toUpperCase()} [http=${check.http_status}]${note}`);
    }
    if (nextSteps.length > 0) {
      print('');
      print('Suggested next steps:');
      for (const step of nextSteps) {
        print(`- ${step.check}: ${step.suggested_fix}`);
      }
    }
  }

  if (!noExit) {
    if (overall === 'fail') {
      process.exit(1);
    } else if (overall === 'warn') {
      process.exit(2);
    }
  }
  return payload;
}

function isStrictConfigEnabled(options) {
  return Boolean(options['strict-config']) || String(process.env.SVEN_STRICT_CONFIG || '').trim() === '1';
}

function strictConfigTargetUrl(options) {
  return String(options.url || DEFAULT_GATEWAY_URL);
}

function getStrictConfigGuardLabel(cmd, sub) {
  if (cmd === 'gateway' && ['start', 'stop', 'restart', 'logs'].includes(String(sub || ''))) {
    return `gateway.${String(sub)}`;
  }
  if (cmd === 'install') return 'install';
  if (cmd === 'agent') return 'agent';
  if (cmd === 'send') return 'send';
  if (cmd === 'channels' && sub === 'login') return 'channels.login';
  if (cmd === 'skills' && sub === 'install') return 'skills.install';
  if (cmd === 'plugins' && ['import-openclaw', 'import-quarantine'].includes(String(sub || ''))) {
    return `plugins.${String(sub)}`;
  }
  if (cmd === 'approvals' && ['approve', 'deny'].includes(String(sub || ''))) {
    return `approvals.${String(sub)}`;
  }
  if (cmd === 'config' && sub === 'set') return 'config.set';
  if (cmd === 'pairing' && ['approve', 'deny'].includes(String(sub || ''))) {
    return `pairing.${String(sub)}`;
  }
  if (cmd === 'souls' && ['install', 'sign', 'publish', 'activate'].includes(String(sub || ''))) {
    return `souls.${String(sub)}`;
  }
  if (cmd === 'update') return 'update';
  if (cmd === 'security' && sub === 'audit') return 'security.audit';
  if (cmd === 'wizard' || cmd === 'onboard') return cmd;
  return null;
}

async function enforceStrictConfigPreflight(commandLabel, options) {
  const url = strictConfigTargetUrl(options);
  const doctor = await cmdDoctor({
    ...options,
    json: true,
    noExit: true,
    silent: true,
    'doctor-profile': 'release-strict',
  });
  if (doctor?.status === 'pass') return;

  const payload = {
    status: 'error',
    code: 'STRICT_CONFIG_BLOCKED',
    command: commandLabel,
    doctor,
    remediation: `Run \`sven doctor --doctor-profile release-strict --url ${url}\` and resolve all fail/warn findings before retrying \`sven ${commandLabel}\`.`,
  };
  if (Boolean(options.json) || OUTPUT_FORMAT === 'json' || OUTPUT_FORMAT === 'ndjson') {
    toJson(payload, true);
  } else {
    print(`Strict config blocked: ${commandLabel}`);
    print(payload.remediation);
  }
  process.exit(EXIT_CODES.policy_or_validation_error);
}

function parseSetting(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getDiskUsageCheck() {
  try {
    const stats = fs.statfsSync(process.cwd(), { bigint: true });
    const bsize = Number(stats.bsize);
    const blocks = Number(stats.blocks);
    const bavail = Number(stats.bavail);
    if (!Number.isFinite(bsize) || !Number.isFinite(blocks) || !Number.isFinite(bavail)) {
      return { status: 'warn', note: 'filesystem capacity unavailable for current workspace' };
    }
    const totalBytes = blocks * bsize;
    const freeBytes = bavail * bsize;
    const freePct = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;
    if (freePct < 10) {
      return { status: 'fail', note: `low filesystem free space (${freePct.toFixed(1)}%)` };
    }
    if (freePct < 20) {
      return { status: 'warn', note: `moderate filesystem free space (${freePct.toFixed(1)}%)` };
    }
    return { status: 'pass', note: `filesystem free space ${freePct.toFixed(1)}%` };
  } catch (err) {
    return {
      status: 'warn',
      note: `filesystem capacity probe unavailable (${String(err && err.message ? err.message : err)})`,
    };
  }
}

function parseSemverMajor(versionText) {
  const match = String(versionText || '').match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

function runProbe(cmd, args = [], timeoutMs = 4000) {
  try {
    const proc = spawnSync(cmd, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
    });
    const output = `${String(proc.stdout || '')}\n${String(proc.stderr || '')}`.trim();
    if (proc.error) {
      return { ok: false, note: String(proc.error.message || proc.error) };
    }
    return {
      ok: proc.status === 0,
      note: output || `exit=${String(proc.status)}`,
      exitCode: proc.status,
    };
  } catch (err) {
    return { ok: false, note: String(err) };
  }
}

function getNodeRuntimeCheck() {
  const current = process.version;
  const major = parseSemverMajor(current);
  if (major === null) {
    return { status: 'warn', note: `unable to parse Node.js version: ${current}` };
  }
  if (major < 18) {
    return { status: 'fail', note: `Node.js ${current} detected; >=18 is required` };
  }
  if (major < 20) {
    return { status: 'warn', note: `Node.js ${current} detected; >=20 recommended` };
  }
  return { status: 'pass', note: `Node.js ${current}` };
}

function getPythonCheck() {
  const py3 = runProbe('python3', ['--version']);
  if (py3.ok) {
    return { status: 'pass', note: py3.note };
  }
  const py = runProbe('python', ['--version']);
  if (py.ok) {
    return { status: 'pass', note: py.note };
  }
  return { status: 'warn', note: 'python/python3 not found on PATH' };
}

function getFfmpegCheck() {
  const ff = runProbe('ffmpeg', ['-version']);
  if (ff.ok) {
    const firstLine = String(ff.note || '').split(/\r?\n/).find(Boolean) || 'ffmpeg detected';
    return { status: 'pass', note: firstLine };
  }
  return { status: 'warn', note: 'ffmpeg not found on PATH' };
}

function getGpuDriverCheck() {
  const probe = runProbe('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader']);
  if (probe.ok) {
    const version = String(probe.note || '').split(/\r?\n/).find(Boolean) || 'unknown';
    return { status: 'pass', note: `nvidia driver ${version}` };
  }
  return { status: 'warn', note: 'nvidia-smi not available (NVIDIA driver not detected)' };
}

function getNasMountCheck() {
  const configured = process.env.NAS_BASE_PATH || process.env.NAS_MOUNT_PATH || '';
  if (!configured) {
    return { status: 'warn', note: 'NAS path env not configured (NAS_BASE_PATH/NAS_MOUNT_PATH)' };
  }
  try {
    const s = statSync(configured);
    if (!s.isDirectory()) {
      return { status: 'fail', note: `configured NAS path is not a directory: ${configured}` };
    }
    return { status: 'pass', note: `NAS path reachable: ${configured}` };
  } catch {
    return { status: 'fail', note: `NAS path not accessible: ${configured}` };
  }
}

async function getTlsCheck(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { status: 'warn', note: 'invalid gateway url; TLS not checked' };
  }
  if (parsed.protocol !== 'https:') {
    return { status: 'warn', note: 'gateway is not using https' };
  }

  const host = parsed.hostname;
  const port = Number(parsed.port || 443);
  return new Promise((resolveCheck) => {
    // Intentional: TLS certificate probe — reads and validates the peer cert.
    const socket = tls.connect( // lgtm[js/disabling-certificate-validation]
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          resolveCheck({ status: 'warn', note: 'no peer certificate metadata' });
          return;
        }
        const expires = new Date(cert.valid_to);
        const daysLeft = Math.floor((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (Number.isNaN(daysLeft)) {
          resolveCheck({ status: 'warn', note: 'could not parse TLS certificate expiry' });
          return;
        }
        if (daysLeft < 0) {
          resolveCheck({ status: 'fail', note: `certificate expired ${Math.abs(daysLeft)} days ago` });
          return;
        }
        if (daysLeft < 14) {
          resolveCheck({ status: 'warn', note: `certificate expires in ${daysLeft} days` });
          return;
        }
        resolveCheck({ status: 'pass', note: `certificate valid, ${daysLeft} days remaining` });
      },
    );
    socket.on('error', (err) => {
      resolveCheck({ status: 'fail', note: `TLS handshake failed: ${String(err)}` });
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolveCheck({ status: 'fail', note: 'TLS handshake timeout' });
    });
  });
}

async function readWizardState(statePath) {
  try {
    const raw = await readFile(statePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    return data;
  } catch {
    return {};
  }
}

async function writeWizardState(statePath, state) {
  await mkdir(dirname(statePath), { recursive: true }).catch(() => {});
  applyOwnerOnlyDirectoryPermissions(dirname(statePath));
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  applyOwnerOnlyFilePermissions(statePath);
}

async function cmdAuthLoginDevice(options) {
  const asJson = Boolean(options.json);
  const gatewayUrl = String(options.url || DEFAULT_GATEWAY_URL);
  const pollSeconds = Math.max(2, Number(options['poll-seconds'] || 5));

  const start = await getJson(`${gatewayUrl}/v1/auth/device/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Sven CLI',
      client_type: 'cli',
      scope: 'chat approvals admin',
    }),
  });
  if (!start.ok) {
    toJson(
      {
        status: 'error',
        message: 'Device login start failed',
        http_status: start.status,
        response: start.data,
      },
      asJson,
    );
    process.exit(1);
  }

  const device = start.data?.data || start.data || {};
  const deviceCode = String(device.device_code || '');
  const userCode = String(device.user_code || '');
  const verifyLink = String(device.verification_uri_complete || device.verification_uri || '');
  if (!deviceCode) {
    toJson({ status: 'error', message: 'No device code returned by gateway' }, asJson);
    process.exit(1);
  }

  if (!asJson) {
    print(`Open: ${verifyLink}`);
    print(`Code: ${userCode}`);
    print('Waiting for authorization...');
  }

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const poll = await getJson(`${gatewayUrl}/v1/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_code: deviceCode }),
    });
    if (!poll.ok) {
      toJson(
        {
          status: 'error',
          message: 'Device token polling failed',
          http_status: poll.status,
          response: poll.data,
        },
        asJson,
      );
      process.exit(1);
    }
    const payload = poll.data?.data || poll.data || {};
    if (String(payload.status || '').toLowerCase() === 'authorized') {
      const accessToken = String(payload.access_token || '').trim();
      if (!accessToken) {
        toJson({ status: 'error', message: 'Authorization completed but no access token returned' }, asJson);
        process.exit(1);
      }
      secureWrite('access_token', accessToken);
      secureWrite('gateway_url', gatewayUrl);
      toJson(
        {
          status: 'ok',
          authorized: true,
          stored: ['access_token', 'gateway_url'],
        },
        asJson,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }

  toJson({ status: 'error', message: 'Device login timed out' }, asJson);
  process.exit(1);
}

function cmdAuthSetCookie(cookie, options) {
  const asJson = Boolean(options.json);
  const value = String(cookie || '').trim();
  if (!value) {
    printErr('Missing cookie value. Usage: sven auth set-cookie <cookie>');
    process.exit(1);
  }
  secureWrite('session_cookie', value);
  toJson({ status: 'ok', stored: 'session_cookie' }, asJson);
}

function cmdAuthSetAdapterToken(token, options) {
  const asJson = Boolean(options.json);
  const value = String(token || '').trim();
  if (!value) {
    printErr('Missing adapter token value. Usage: sven auth set-adapter-token <token>');
    process.exit(1);
  }
  secureWrite('adapter_token', value);
  toJson({ status: 'ok', stored: 'adapter_token' }, asJson);
}

function cmdAuthClear(options) {
  const asJson = Boolean(options.json);
  secureDelete('session_cookie');
  secureDelete('adapter_token');
  secureDelete('access_token');
  toJson({ status: 'ok', cleared: ['session_cookie', 'adapter_token', 'access_token'] }, asJson);
}

function cmdAuthStatus(options) {
  const asJson = Boolean(options.json);
  const status = {
    session_cookie: Boolean(secureRead('session_cookie')),
    adapter_token: Boolean(secureRead('adapter_token')),
    access_token: Boolean(secureRead('access_token')),
    store_path: DEFAULT_SECURE_STORE_PATH,
  };
  toJson({ status: 'ok', data: status }, asJson);
}

function cmdExitCodes(options) {
  const asJson = Boolean(options.json);
  toJson(
    {
      status: 'ok',
      data: {
        ...EXIT_CODES,
      },
    },
    asJson,
  );
}

async function cmdAgent(options) {
  const message = options.message ? String(options.message) : '';
  const channel = options.channel ? String(options.channel) : '';
  const chatId = options['chat-id']
    ? String(options['chat-id'])
    : options.chat
      ? String(options.chat)
      : '';
  const senderIdentityId = options['sender-identity-id']
    ? String(options['sender-identity-id'])
    : '';
  const model = options.model ? String(options.model) : '';
  const thinking = options.thinking ? String(options.thinking) : '';
  const gatewayUrl = String(options.url || DEFAULT_GATEWAY_URL);
  const adapterToken = resolveAdapterToken(options);
  const sessionCookie = String(options.cookie || process.env.SVEN_SESSION_COOKIE || '');
  const asJson = Boolean(options.json);
  const stream = Boolean(options.stream);

  if (!channel || !chatId || !senderIdentityId) {
    printErr('Missing required flags for `sven agent`.');
    printErr('Required: --channel, --chat-id/--chat, --sender-identity-id');
    process.exit(1);
  }
  if (!adapterToken) {
    printErr('Missing adapter token. Provide --adapter-token or set SVEN_ADAPTER_TOKEN.');
    process.exit(1);
  }

  const sendMessage = async (text) => {
    const result = await getJson(`${gatewayUrl}/v1/events/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SVEN-ADAPTER-TOKEN': adapterToken,
      },
      body: JSON.stringify({
        channel,
        channel_message_id: `cli-${Date.now()}`,
        chat_id: chatId,
        sender_identity_id: senderIdentityId,
        text,
        metadata: {
          source: 'sven-cli',
          ...(model ? { model } : {}),
          ...(thinking ? { thinking } : {}),
        },
      }),
    });
    return result;
  };

  if (message) {
    const startedAtMs = Date.now();
    const result = await sendMessage(message);
    if (!result.ok) {
      toJson(
        {
          status: 'error',
          message: 'Failed to enqueue agent message',
          http_status: result.status,
          response: result.data,
        },
        asJson,
      );
      process.exit(1);
    }
    toJson(
      {
        status: 'ok',
        queued: true,
        response: result.data,
      },
      asJson,
    );
    if (stream) {
      if (!sessionCookie) {
        printErr('Streaming requires --cookie or SVEN_SESSION_COOKIE.');
        process.exit(1);
      }
      const streamed = await streamAssistantReply({
        gatewayUrl,
        cookie: sessionCookie,
        chatId,
        sinceMs: startedAtMs,
        asJson,
      });
      if (!streamed) {
        process.exit(1);
      }
    }
    return;
  }

  print(`Interactive agent mode. Chat: ${chatId}. Type /exit to quit.`);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = () =>
    new Promise((resolve) => {
      rl.question('you> ', (answer) => resolve(answer));
    });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const answer = String(await ask()).trim();
    if (!answer) continue;
    if (answer === '/exit' || answer === '/quit') break;

    // eslint-disable-next-line no-await-in-loop
    const result = await sendMessage(answer);
    if (!result.ok) {
      printErr(`enqueue failed: http=${result.status}`);
      continue;
    }
    print(`queued: ${result.data?.data?.event_id || 'ok'}`);
  }
  rl.close();
}

async function streamAssistantReply(params) {
  const timeoutMs = 60000;
  const startedAt = Date.now();
  const res = await fetch(`${params.gatewayUrl}/v1/stream`, {
    method: 'GET',
    headers: {
      Cookie: params.cookie,
      Accept: 'text/event-stream',
    },
  });
  if (!res.ok || !res.body) {
    toJson(
      {
        status: 'error',
        message: 'Failed to connect to stream endpoint',
        http_status: res.status,
      },
      params.asJson,
    );
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';

  const emitText = (text) => {
    for (const token of String(text || '').split(/\s+/).filter(Boolean)) {
      process.stdout.write(`${token} `);
    }
    process.stdout.write('\n');
  };

  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    // eslint-disable-next-line no-cond-assign
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);

      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        const payloadRaw = line.slice(5).trim();
        if (eventName !== 'message') continue;
        let payload;
        try {
          payload = JSON.parse(payloadRaw);
        } catch {
          continue;
        }
        const chatId = String(payload?.chat_id || '');
        const role = String(payload?.role || '');
        const createdAt = payload?.created_at ? Date.parse(String(payload.created_at)) : 0;
        if (chatId !== params.chatId) continue;
        if (role !== 'assistant') continue;
        if (createdAt > 0 && createdAt < params.sinceMs - 1000) continue;
        if (params.asJson) {
          toJson(
            {
              status: 'ok',
              streamed: true,
              message_id: payload?.id,
              text: payload?.text || '',
            },
            true,
          );
        } else {
          emitText(payload?.text || '');
        }
        try {
          reader.cancel();
        } catch {}
        return true;
      }
    }
  }

  toJson(
    {
      status: 'error',
      message: 'Timed out waiting for streamed assistant reply',
    },
    params.asJson,
  );
  try {
    reader.cancel();
  } catch {}
  return false;
}

async function cmdSend(options) {
  const to = options.to ? String(options.to) : '';
  if (options.target && !options['chat-id'] && !options.chat) {
    options['chat-id'] = String(options.target);
  }
  if (to && to.includes(':')) {
    const [channel, chatId] = to.split(':');
    if (!options.channel) options.channel = channel;
    if (!options['chat-id']) options['chat-id'] = chatId;
  }

  const fileArg = options.file ? String(options.file) : '';
  const filePayload = fileArg ? toFilePayload(fileArg) : null;
  const shouldConfirm = !Boolean(options.yes);
  if (shouldConfirm) {
    const channel = options.channel ? String(options.channel) : '';
    const target = options['chat-id'] ? String(options['chat-id']) : options.chat ? String(options.chat) : '';
    const message = options.message ? String(options.message) : '';
    const fileLabel = filePayload ? ` file=${filePayload.file_name}` : '';

    if (!process.stdin.isTTY) {
      printErr('Confirmation required for send in non-interactive mode. Re-run with --yes.');
      process.exit(1);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const confirm = await new Promise((resolve) => {
      rl.question(`Send message to ${channel}:${target}? "${message}"${fileLabel} [y/N]: `, (ans) => resolve(ans));
    });
    rl.close();
    const normalized = String(confirm || '').trim().toLowerCase();
    if (normalized !== 'y' && normalized !== 'yes') {
      print('Send cancelled.');
      return;
    }
  }

  if (!filePayload) {
    await cmdAgent(options);
    return;
  }

  const channel = options.channel ? String(options.channel) : '';
  const chatId = options['chat-id'] ? String(options['chat-id']) : options.chat ? String(options.chat) : '';
  const senderIdentityId = options['sender-identity-id'] ? String(options['sender-identity-id']) : '';
  const gatewayUrl = String(options.url || DEFAULT_GATEWAY_URL);
  const adapterToken = resolveAdapterToken(options);
  const asJson = Boolean(options.json);
  const message = options.message ? String(options.message) : '';

  if (!channel || !chatId || !senderIdentityId) {
    printErr('Missing required flags for `sven send --file`.');
    printErr('Required: --channel, --chat-id/--chat, --sender-identity-id');
    process.exit(1);
  }
  if (!adapterToken) {
    printErr('Missing adapter token. Provide --adapter-token or set SVEN_ADAPTER_TOKEN.');
    process.exit(1);
  }

  const result = await getJson(`${gatewayUrl}/v1/events/file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': adapterToken,
    },
    body: JSON.stringify({
      channel,
      channel_message_id: `cli-file-${Date.now()}`,
      chat_id: chatId,
      sender_identity_id: senderIdentityId,
      text: message,
      file_url: filePayload.file_url,
      file_name: filePayload.file_name,
      file_mime: filePayload.file_mime,
      metadata: { source: 'sven-cli' },
    }),
  });
  if (!result.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to enqueue file message',
        http_status: result.status,
        response: result.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson(
    {
      status: 'ok',
      queued: true,
      response: result.data,
    },
    asJson,
  );
}

async function cmdChannelsList(options) {
  const asJson = Boolean(options.json);
  const res = await getAdminJson('/admin/channels', options);
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to list channels',
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdChannelsLogin(channel, options) {
  const asJson = Boolean(options.json);
  const value = String(channel || '').trim();
  if (!value) {
    printErr('Missing channel. Usage: sven channels login <channel>');
    process.exit(1);
  }
  const res = await getAdminJson(`/admin/channels/${encodeURIComponent(value)}/token`, options, { method: 'POST' });
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to login/pair channel ${value}`,
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  const token = res.data?.data?.token || '';
  toJson(
    {
      status: 'ok',
      channel: value,
      token,
      next: `configure adapter.${value}.token with this value`,
    },
    asJson,
  );
}

async function cmdSkillsList(options) {
  const asJson = Boolean(options.json);
  const res = await getAdminJson('/registry/installed', options);
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to list installed skills',
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSkillsInstall(slugOrId, options) {
  const asJson = Boolean(options.json);
  const query = String(slugOrId || '').trim();
  const toolId = options['tool-id'] ? String(options['tool-id']).trim() : '';
  const trustLevel = options['trust-level'] ? String(options['trust-level']).trim() : '';
  if (!query) {
    printErr('Missing skill slug/id. Usage: sven skills install <slug_or_id> --tool-id <tool_id>');
    process.exit(1);
  }
  if (!toolId) {
    printErr('Missing --tool-id. Usage: sven skills install <slug_or_id> --tool-id <tool_id>');
    process.exit(1);
  }

  const catalogRes = await getAdminJson(`/registry/catalog?name=${encodeURIComponent(query)}&per_page=200`, options);
  if (!catalogRes.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to query catalog for ${query}`,
        http_status: catalogRes.status,
        response: catalogRes.data,
      },
      asJson,
    );
    process.exit(1);
  }
  const entries = Array.isArray(catalogRes.data?.data) ? catalogRes.data.data : [];
  const exact = entries.find((e) => e?.id === query || e?.name === query) || entries[0];
  if (!exact?.id) {
    toJson(
      {
        status: 'error',
        message: `No catalog entry found for ${query}`,
      },
      asJson,
    );
    process.exit(1);
  }

  const body = {
    catalog_entry_id: String(exact.id),
    tool_id: toolId,
    ...(trustLevel ? { trust_level: trustLevel } : {}),
  };
  const installRes = await getAdminJson('/registry/installed', options, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!installRes.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to install skill ${query}`,
        http_status: installRes.status,
        response: installRes.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson(
    {
      status: 'ok',
      catalog_entry_id: exact.id,
      installed: installRes.data,
    },
    asJson,
  );
}

async function cmdApprovalsList(options) {
  const asJson = Boolean(options.json);
  const status = options.status ? `?status=${encodeURIComponent(String(options.status))}` : '';
  const res = await getAdminJson(`/approvals${status}`, options);
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to list approvals',
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdApprovalsVote(id, vote, options) {
  const asJson = Boolean(options.json);
  const res = await getAdminJson(`/approvals/${encodeURIComponent(id)}/vote`, options, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to ${vote} approval ${id}`,
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdConfigGet(key, options) {
  const asJson = Boolean(options.json);
  const res = await getAdminJson(`/settings/${encodeURIComponent(key)}`, options);
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to get config key ${key}`,
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdConfigSet(key, value, options) {
  const asJson = Boolean(options.json);
  let parsedValue = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value;
  }
  const res = await getAdminJson(`/settings/${encodeURIComponent(key)}`, options, {
    method: 'PUT',
    body: JSON.stringify({ value: parsedValue }),
  });
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to set config key ${key}`,
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdConfigValidate(options) {
  const asJson = Boolean(options.json);
  const file = await readConfigFile(options);
  if (!file.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to read config file',
        path: file.path,
        error: file.error,
      },
      asJson,
    );
    process.exit(1);
  }
  const errors = validateConfigObject(file.data);
  if (errors.length > 0) {
    toJson(
      {
        status: 'error',
        message: 'Config validation failed',
        path: file.path,
        errors,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', path: file.path }, asJson);
}

async function cmdConfigPrint(options) {
  const asJson = Boolean(options.json);
  const file = await readConfigFile(options);
  if (!file.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to read config file',
        path: file.path,
        error: file.error,
      },
      asJson,
    );
    process.exit(1);
  }
  const resolved = resolveConfigValues(file.data || {}, process.env || {});
  const printable = resolved.map((item) => ({
    key: item.key,
    value: redactValue(item.value, item.key),
    source: item.source,
  }));
  toJson(
    {
      status: 'ok',
      path: file.path,
      values: printable,
    },
    asJson,
  );
}

async function cmdPairingList(options) {
  const asJson = Boolean(options.json);
  const qs = [];
  if (options.status) qs.push(`status=${encodeURIComponent(String(options.status))}`);
  if (options.channel) qs.push(`channel=${encodeURIComponent(String(options.channel))}`);
  const query = qs.length > 0 ? `?${qs.join('&')}` : '';
  const res = await getAdminJson(`/pairing${query}`, options);
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to list pairing requests',
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdPairingDecision(action, channel, code, options) {
  const asJson = Boolean(options.json);
  if (!channel || !code) {
    printErr(`Usage: sven pairing ${action} <channel> <code>`);
    process.exit(1);
  }
  const res = await getAdminJson(`/pairing/${action}`, options, {
    method: 'POST',
    body: JSON.stringify({
      channel: String(channel),
      code: String(code),
    }),
  });
  if (!res.ok) {
    toJson(
      {
        status: 'error',
        message: `Failed to ${action} pairing request`,
        http_status: res.status,
        response: res.data,
      },
      asJson,
    );
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSoulsList(options) {
  const asJson = Boolean(options.json);
  const installed = Boolean(options.installed);
  if (installed) {
    const res = await getAdminJson('/souls/installed', options);
    if (!res.ok) {
      toJson({ status: 'error', message: 'Failed to list installed souls', http_status: res.status, response: res.data }, asJson);
      process.exit(1);
    }
    toJson({ status: 'ok', data: res.data }, asJson);
    return;
  }

  const search = options.search ? `?search=${encodeURIComponent(String(options.search))}` : '';
  const res = await getAdminJson(`/souls/catalog${search}`, options);
  if (!res.ok) {
    toJson({ status: 'error', message: 'Failed to list soul catalog', http_status: res.status, response: res.data }, asJson);
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSoulsInstall(slug, options) {
  const asJson = Boolean(options.json);
  if (!slug) {
    printErr('Missing soul slug. Usage: sven souls install <slug>');
    process.exit(1);
  }
  const payload = { slug: String(slug), activate: Boolean(options.activate) };
  const res = await getAdminJson('/souls/install', options, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    toJson({ status: 'error', message: `Failed to install soul ${slug}`, http_status: res.status, response: res.data }, asJson);
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSoulsSign(slug, options) {
  const asJson = Boolean(options.json);
  const signature = String(options.signature || '');
  const publicKey = String(options['public-key'] || '');
  const signatureType = String(options.type || 'ed25519');
  if (!slug || !signature || !publicKey) {
    printErr('Usage: sven souls sign <slug> --signature <base64> --public-key <pem> [--type <ed25519|rsa-sha256|ecdsa-sha256>] [--trust]');
    process.exit(1);
  }
  const res = await getAdminJson('/souls/signatures', options, {
    method: 'POST',
    body: JSON.stringify({
      slug: String(slug),
      signature_type: signatureType,
      signature,
      public_key: publicKey,
      trusted: Boolean(options.trust),
    }),
  });
  if (!res.ok) {
    toJson({ status: 'error', message: `Failed to add signature for ${slug}`, http_status: res.status, response: res.data }, asJson);
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSoulsSignatures(options) {
  const asJson = Boolean(options.json);
  const soulId = options['soul-id'] ? `?soul_id=${encodeURIComponent(String(options['soul-id']))}` : '';
  const res = await getAdminJson(`/souls/signatures${soulId}`, options);
  if (!res.ok) {
    toJson({ status: 'error', message: 'Failed to list soul signatures', http_status: res.status, response: res.data }, asJson);
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSoulsPublish(filePath, options) {
  const asJson = Boolean(options.json);
  if (!filePath) {
    printErr('Usage: sven souls publish <file> [--slug <slug>] [--name <name>] [--version <semver>] [--author <name>] [--tags <a,b>] [--source <source>]');
    process.exit(1);
  }
  let content;
  try {
    content = await readFile(resolve(filePath), 'utf8');
  } catch (err) {
    printErr(`Failed to read file: ${String(err)}`);
    process.exit(1);
  }

  const payload = {
    slug: options.slug || undefined,
    name: options.name || undefined,
    description: options.description || undefined,
    version: options.version || undefined,
    author: options.author || undefined,
    tags: options.tags ? String(options.tags).split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    source: options.source || undefined,
    content,
  };

  if (!payload.slug || !payload.name) {
    printErr('Missing --slug or --name. These are required for publish.');
    process.exit(1);
  }

  const res = await getAdminJson('/souls/catalog', options, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    toJson({ status: 'error', message: 'Failed to publish soul', http_status: res.status, response: res.data }, asJson);
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdSoulsActivate(installId, options) {
  const asJson = Boolean(options.json);
  if (!installId) {
    printErr('Usage: sven souls activate <install_id>');
    process.exit(1);
  }
  const res = await getAdminJson(`/souls/activate/${encodeURIComponent(String(installId))}`, options, {
    method: 'POST',
  });
  if (!res.ok) {
    toJson({ status: 'error', message: `Failed to activate soul ${installId}`, http_status: res.status, response: res.data }, asJson);
    process.exit(1);
  }
  toJson({ status: 'ok', data: res.data }, asJson);
}

async function cmdUpdate(options) {
  const asJson = Boolean(options.json);
  const service = String(options.service || DEFAULT_GATEWAY_SERVICE);
  const channel = String(options.channel || 'stable').trim().toLowerCase();
  const cliOnly = Boolean(options['cli-only']);
  const gatewayOnly = Boolean(options['gateway-only']);
  const dryRun = Boolean(options['dry-run'] || options.dryRun);
  if (!VALID_UPDATE_CHANNELS.has(channel)) {
    printErr('Invalid --channel. Supported values: stable, beta, dev');
    process.exit(EXIT_CODES.policy_or_validation_error);
  }
  const cliChannelTag = channel === 'stable' ? 'latest' : channel;
  const cliPackageSpec = `@sven/cli@${cliChannelTag}`;
  if (cliOnly && gatewayOnly) {
    printErr('Use only one of --cli-only or --gateway-only.');
    process.exit(EXIT_CODES.policy_or_validation_error);
  }
  const composeContext = resolveManagedComposeContext(options);
  if (!cliOnly && !dryRun && !isReadableFile(composeContext.compose_file)) {
    toJson(
      {
        status: 'error',
        message: `Compose file not found: ${composeContext.compose_file}`,
        compose_context: {
          ...composeContext,
          install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
        },
      },
      asJson,
    );
    process.exit(EXIT_CODES.runtime_error);
  }

  if (dryRun) {
    const steps = [];
    if (!gatewayOnly) {
      steps.push({
        step: 'cli.update',
        status: 'planned',
        command: `npm install -g ${cliPackageSpec}`,
      });
    }
    if (!cliOnly) {
      steps.push({
        step: 'gateway.pull',
        status: 'planned',
        command: `SVEN_RELEASE_CHANNEL=${channel} docker compose --project-directory "${composeContext.project_directory}" -f "${composeContext.compose_file}" pull ${service}`,
      });
      steps.push({
        step: 'gateway.restart',
        status: 'planned',
        command: `SVEN_RELEASE_CHANNEL=${channel} docker compose --project-directory "${composeContext.project_directory}" -f "${composeContext.compose_file}" up -d ${service}`,
      });
    }
    toJson(
      {
        status: 'ok',
        dry_run: true,
        service,
        channel,
        cli_package: cliPackageSpec,
        compose_context: {
          ...composeContext,
          install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
        },
        steps,
      },
      asJson,
    );
    return;
  }

  if (!Boolean(options.yes) && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const confirm = await new Promise((resolve) => {
      rl.question(`Run update${cliOnly ? ' (cli only)' : gatewayOnly ? ' (gateway only)' : ''}? [y/N]: `, (ans) => resolve(ans));
    });
    rl.close();
    const normalized = String(confirm || '').trim().toLowerCase();
    if (normalized !== 'y' && normalized !== 'yes') {
      toJson({ status: 'cancelled' }, asJson);
      return;
    }
  } else if (!Boolean(options.yes) && !process.stdin.isTTY) {
    printErr('Confirmation required in non-interactive mode. Re-run with --yes.');
    process.exit(1);
  }

  const steps = [];
  if (!gatewayOnly) {
    const cliProc = spawnSync('npm', ['install', '-g', cliPackageSpec], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    steps.push({
      step: 'cli.update',
      status: cliProc.status === 0 ? 'ok' : 'error',
      code: cliProc.status,
      stdout: cliProc.stdout || '',
      stderr: cliProc.stderr || '',
    });
  }

  if (!cliOnly) {
    const pullProc = spawnSync('docker', ['compose', '--project-directory', composeContext.project_directory, '-f', composeContext.compose_file, 'pull', service], {
      cwd: composeContext.project_directory,
      stdio: 'pipe',
      encoding: 'utf8',
      env: {
        ...process.env,
        SVEN_RELEASE_CHANNEL: channel,
      },
    });
    steps.push({
      step: 'gateway.pull',
      status: pullProc.status === 0 ? 'ok' : 'error',
      code: pullProc.status,
      stdout: pullProc.stdout || '',
      stderr: pullProc.stderr || '',
    });
    if (pullProc.status === 0) {
      const upProc = spawnSync('docker', ['compose', '--project-directory', composeContext.project_directory, '-f', composeContext.compose_file, 'up', '-d', service], {
        cwd: composeContext.project_directory,
        stdio: 'pipe',
        encoding: 'utf8',
        env: {
          ...process.env,
          SVEN_RELEASE_CHANNEL: channel,
        },
      });
      steps.push({
        step: 'gateway.restart',
        status: upProc.status === 0 ? 'ok' : 'error',
        code: upProc.status,
        stdout: upProc.stdout || '',
        stderr: upProc.stderr || '',
      });
    }
  }

  const hasError = steps.some((s) => s.status !== 'ok');
  toJson(
    {
      status: hasError ? 'error' : 'ok',
      channel,
      cli_package: cliPackageSpec,
      compose_context: {
        ...composeContext,
        install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
      },
      steps,
    },
    asJson,
  );
  if (hasError) process.exit(1);
}

async function cmdWizard(options) {
  const asJson = Boolean(options.json);
  const defaultsMode = Boolean(options.defaults);
  if (!process.stdin.isTTY && !defaultsMode) {
    printErr('Wizard requires an interactive terminal.');
    process.exit(1);
  }

  const rl = defaultsMode
    ? null
    : readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
  const ask = async (label, defaultValue = '') => {
    if (defaultsMode) return defaultValue;
    return new Promise((resolveAnswer) => {
      const suffix = defaultValue ? ` [${defaultValue}]` : '';
      rl.question(`${label}${suffix}: `, (ans) => {
        const trimmed = String(ans || '').trim();
        resolveAnswer(trimmed || defaultValue);
      });
    });
  };

  const defaultOut = join(os.homedir(), '.sven', 'sven.json');
  const outputPath = String(options.output || defaultOut);
  const statePath = String(options.state || `${outputPath}.wizard-state.json`);
  const resumeMode = Boolean(options.resume);
  const priorState = resumeMode ? await readWizardState(statePath) : {};
  const answers = { ...(priorState.answers || {}) };
  const state = {
    version: 1,
    started_at: priorState.started_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed: false,
    answers,
  };

  const askAndPersist = async (key, label, defaultValue = '') => {
    const stateDefault = answers[key] !== undefined ? String(answers[key]) : defaultValue;
    const value = String(await ask(label, stateDefault));
    answers[key] = value;
    state.updated_at = new Date().toISOString();
    await writeWizardState(statePath, state);
    return value;
  };

  const gatewayUrl = await askAndPersist('gateway_url', 'Gateway URL', process.env.SVEN_GATEWAY_URL || 'http://localhost:3001');
  const bootstrapAdmin = (await askAndPersist('bootstrap_admin', 'Create bootstrap admin now? (yes/no)', defaultsMode ? 'no' : 'yes')).toLowerCase() === 'yes';
  let bootstrapResult = null;
  if (bootstrapAdmin) {
    const adminUsername = await askAndPersist('admin_username', 'Admin username', process.env.SVEN_BOOTSTRAP_USERNAME || 'admin');
    const adminPassword = await askAndPersist('admin_password', 'Admin password', process.env.SVEN_BOOTSTRAP_PASSWORD || 'changeme');
    const adminDisplayName = await askAndPersist('admin_display_name', 'Admin display name', process.env.SVEN_BOOTSTRAP_DISPLAY_NAME || 'Sven Admin');
    const bootstrapRes = await getJson(`${gatewayUrl}/v1/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: adminUsername,
        password: adminPassword,
        display_name: adminDisplayName,
        enable_totp: true,
      }),
    });
    bootstrapResult = {
      ok: bootstrapRes.ok,
      http_status: bootstrapRes.status,
      data: bootstrapRes.data,
    };
    state.bootstrap_admin = bootstrapResult;
    state.updated_at = new Date().toISOString();
    await writeWizardState(statePath, state);
  }

  const databaseUrl = await askAndPersist('database_url', 'Postgres URL', process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven');
  const natsUrl = await askAndPersist('nats_url', 'NATS URL', process.env.NATS_URL || 'nats://localhost:4222');
  const openSearchUrl = await askAndPersist('opensearch_url', 'OpenSearch URL (optional)', process.env.OPENSEARCH_URL || '');
  const inferenceUrl = await askAndPersist('inference_url', 'Inference endpoint URL', process.env.OLLAMA_URL || 'http://localhost:11434');
  const channel = await askAndPersist('first_channel', 'First channel (discord/slack/telegram/...)', 'discord');
  const installMode = (await askAndPersist('daemon_install', 'Daemon install mode (none/systemd/launchd/pm2)', 'none')).toLowerCase();

  const config = {
    version: 1,
    gateway_url: gatewayUrl,
    database_url: databaseUrl,
    nats_url: natsUrl,
    opensearch_url: openSearchUrl || null,
    inference_url: inferenceUrl,
    first_channel: channel,
    daemon_install: installMode,
    generated_at: new Date().toISOString(),
    gateway: {
      url: gatewayUrl,
      host: process.env.GATEWAY_HOST || '0.0.0.0',
      port: Number(process.env.GATEWAY_PORT || 3000),
    },
    database: {
      url: databaseUrl,
    },
    nats: {
      url: natsUrl,
    },
    opensearch: {
      url: openSearchUrl || null,
    },
    inference: {
      url: inferenceUrl,
    },
    channels: {
      first: channel,
    },
    daemon: {
      install_mode: installMode,
    },
    auth: {
      bootstrap_requested: bootstrapAdmin,
      admin_username: state.answers.admin_username || null,
      admin_display_name: state.answers.admin_display_name || null,
    },
    wizard: {
      resumed: resumeMode,
      generated_at: new Date().toISOString(),
      answers: { ...(state.answers || {}) },
    },
  };

  const checks = [];
  const gateway = await getJson(`${gatewayUrl}/healthz`);
  checks.push({
    check: 'gateway.health',
    status: gateway.ok ? 'pass' : 'warn',
    note: gateway.ok ? 'reachable' : 'not reachable yet',
  });
  if (openSearchUrl) {
    const osRes = await getJson(openSearchUrl);
    checks.push({
      check: 'opensearch.endpoint',
      status: osRes.ok ? 'pass' : 'warn',
      note: osRes.ok ? 'reachable' : 'not reachable',
    });
  }
  const inferRes = await getJson(inferenceUrl);
  checks.push({
    check: 'inference.endpoint',
    status: inferRes.ok ? 'pass' : 'warn',
    note: inferRes.ok ? 'reachable' : 'not reachable',
  });

  await mkdir(dirname(outputPath), { recursive: true }).catch(() => {});
  applyOwnerOnlyDirectoryPermissions(dirname(outputPath));
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  applyOwnerOnlyFilePermissions(outputPath);
  if (rl) rl.close();
  const daemonInstall = await installDaemonIfRequested(installMode, { dryRun: false });
  const doctorReport = await cmdDoctor({
    url: gatewayUrl,
    json: true,
    noExit: true,
    silent: true,
    cookie: adminCookie(options),
  });

  state.completed = true;
  state.updated_at = new Date().toISOString();
  await writeWizardState(statePath, state);
  await unlink(statePath).catch(() => {});

  const result = {
    status: 'ok',
    config_path: outputPath,
    state_path: statePath,
    resumed: resumeMode,
    checks,
    bootstrap_admin: bootstrapResult,
    daemon_install: daemonInstall,
    post_setup_doctor: doctorReport,
    notes: [
      bootstrapResult
        ? 'Bootstrap admin flow attempted; store the returned TOTP secret in a secure authenticator app.'
        : 'Bootstrap admin skipped in wizard.',
      doctorReport
        ? `Post-setup doctor completed with status=${doctorReport.status}.`
        : 'Post-setup doctor not available.',
      `Channel "${channel}" selected for first adapter setup.`,
    ],
  };
  toJson(result, asJson);
}

function resolveInstallMode(mode) {
  const requested = String(mode || 'auto').toLowerCase();
  if (requested && requested !== 'auto') return requested;
  if (process.platform === 'linux') return 'systemd';
  if (process.platform === 'darwin') return 'launchd';
  return 'none';
}

function plannedDaemonPaths(mode) {
  const normalized = String(mode || 'none').toLowerCase();
  if (normalized === 'systemd') {
    return {
      mode: 'systemd',
      runtime_model: 'docker-compose-supervised',
      runtime_target: 'gateway-api',
      unit_path: join(os.homedir(), '.config', 'systemd', 'user', 'sven-gateway.service'),
    };
  }
  if (normalized === 'launchd') {
    return {
      mode: 'launchd',
      runtime_model: 'docker-compose-supervised',
      runtime_target: 'gateway-api',
      plist_path: join(os.homedir(), 'Library', 'LaunchAgents', 'com.sven.gateway.plist'),
    };
  }
  if (normalized === 'pm2') {
    return {
      mode: 'pm2',
      runtime_model: 'docker-compose-supervised',
      runtime_target: 'gateway-api',
      process_name: 'sven-gateway',
    };
  }
  return {
    mode: normalized,
    runtime_model: normalized === 'none' ? 'not-installed' : 'unsupported',
  };
}

async function installDaemonIfRequested(mode, opts = {}) {
  const dryRun = Boolean(opts.dryRun || opts['dry-run']);
  const normalized = resolveInstallMode(mode);
  const composeContext = opts.composeContext || resolveComposeContext(opts);
  if (dryRun) {
    return {
      ...plannedDaemonPaths(normalized),
      ...composeContext,
      install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
      status: normalized === 'none' ? 'skipped' : 'planned',
      dry_run: true,
    };
  }
  if (!normalized || normalized === 'none') {
    return { mode: 'none', status: 'skipped' };
  }
  if (normalized === 'pm2') {
    const proc = spawnSync(
      'pm2',
      [
        'start',
        'docker',
        '--name',
        'sven-gateway',
        '--',
        'compose',
        '--project-directory',
        composeContext.project_directory,
        '-f',
        composeContext.compose_file,
        'up',
        'gateway-api',
      ],
      { stdio: 'pipe', encoding: 'utf8' },
    );
    return {
      mode: 'pm2',
      runtime_model: 'docker-compose-supervised',
      runtime_target: 'gateway-api',
      project_directory: composeContext.project_directory,
      compose_file: composeContext.compose_file,
      install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
      status: proc.status === 0 ? 'installed' : 'error',
      code: proc.status,
      stderr: proc.stderr || '',
    };
  }
  if (normalized === 'systemd') {
    const unitPath = join(os.homedir(), '.config', 'systemd', 'user', 'sven-gateway.service');
    const unitContent = [
      '[Unit]',
      'Description=Sven Gateway',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      `WorkingDirectory=${composeContext.project_directory}`,
      `ExecStart=/usr/bin/env docker compose --project-directory "${composeContext.project_directory}" -f "${composeContext.compose_file}" up gateway-api`,
      `ExecStop=/usr/bin/env docker compose --project-directory "${composeContext.project_directory}" -f "${composeContext.compose_file}" stop gateway-api`,
      'Restart=always',
      'RestartSec=5',
      '',
      '[Install]',
      'WantedBy=default.target',
      '',
    ].join('\n');
    await mkdir(dirname(unitPath), { recursive: true });
    applyOwnerOnlyDirectoryPermissions(dirname(unitPath));
    await writeFile(unitPath, unitContent, 'utf8');
    applyOwnerOnlyFilePermissions(unitPath);
    const reload = spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'pipe', encoding: 'utf8' });
    const enable = spawnSync('systemctl', ['--user', 'enable', '--now', 'sven-gateway.service'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return {
      mode: 'systemd',
      runtime_model: 'docker-compose-supervised',
      runtime_target: 'gateway-api',
      project_directory: composeContext.project_directory,
      compose_file: composeContext.compose_file,
      install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
      status: reload.status === 0 && enable.status === 0 ? 'installed' : 'error',
      unit_path: unitPath,
      reload_code: reload.status,
      enable_code: enable.status,
      stderr: `${reload.stderr || ''}\n${enable.stderr || ''}`.trim(),
    };
  }
  if (normalized === 'launchd') {
    const plistPath = join(os.homedir(), 'Library', 'LaunchAgents', 'com.sven.gateway.plist');
    const plist = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>Label</key><string>com.sven.gateway</string>',
      '  <key>ProgramArguments</key>',
      '  <array>',
      '    <string>/usr/bin/env</string>',
      '    <string>docker</string>',
      '    <string>compose</string>',
      '    <string>--project-directory</string>',
      `    <string>${composeContext.project_directory}</string>`,
      '    <string>-f</string>',
      `    <string>${composeContext.compose_file}</string>`,
      '    <string>up</string>',
      '    <string>gateway-api</string>',
      '  </array>',
      `  <key>WorkingDirectory</key><string>${composeContext.project_directory}</string>`,
      '  <key>RunAtLoad</key><true/>',
      '  <key>KeepAlive</key><true/>',
      '</dict>',
      '</plist>',
      '',
    ].join('\n');
    await mkdir(dirname(plistPath), { recursive: true });
    applyOwnerOnlyDirectoryPermissions(dirname(plistPath));
    await writeFile(plistPath, plist, 'utf8');
    applyOwnerOnlyFilePermissions(plistPath);
    const load = spawnSync('launchctl', ['load', plistPath], { stdio: 'pipe', encoding: 'utf8' });
    return {
      mode: 'launchd',
      runtime_model: 'docker-compose-supervised',
      runtime_target: 'gateway-api',
      project_directory: composeContext.project_directory,
      compose_file: composeContext.compose_file,
      install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
      status: load.status === 0 ? 'installed' : 'error',
      plist_path: plistPath,
      code: load.status,
      stderr: load.stderr || '',
    };
  }
  return {
    mode: normalized,
    status: 'error',
    note: 'unsupported daemon mode (use none/systemd/launchd/pm2)',
  };
}

async function cmdInstall(options) {
  const asJson = Boolean(options.json);
  const requestedMode = String(options.mode || 'auto').toLowerCase();
  const dryRun = Boolean(options['dry-run'] || options.dryRun);
  const resolvedMode = resolveInstallMode(requestedMode);
  const composeContext = resolveComposeContext(options);
  if (!dryRun && !isReadableFile(composeContext.compose_file)) {
    toJson(
      {
        status: 'error',
        requested_mode: requestedMode,
        resolved_mode: resolvedMode,
        message: `Compose file not found: ${composeContext.compose_file}`,
        compose_context: {
          ...composeContext,
          source: 'requested',
          install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
        },
      },
      asJson,
    );
    process.exit(1);
  }
  const install = await installDaemonIfRequested(resolvedMode, { dryRun, composeContext });
  if (install.status === 'installed' || install.status === 'planned' || install.status === 'skipped') {
    saveInstallContext(composeContext);
  }
  const payload = {
    status: install.status === 'error' ? 'error' : 'ok',
    requested_mode: requestedMode,
    resolved_mode: resolvedMode,
    supported_runtime_models: ['docker-compose-supervised'],
    compose_context: {
      ...composeContext,
      source: 'requested',
      install_context_path: DEFAULT_INSTALL_CONTEXT_PATH,
    },
    install,
  };
  toJson(payload, asJson);
  if (install.status === 'error') {
    process.exit(1);
  }
}

function toSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'imported-plugin';
}

async function cmdPluginsImportOpenClaw(manifestUrl, options) {
  const asJson = Boolean(options.json);
  if (!manifestUrl) {
    printErr('Missing manifest URL. Usage: sven plugins import-openclaw <manifest_url>');
    process.exit(1);
    return;
  }

  const imported = await importOpenClawManifest(manifestUrl, options, asJson);
  toJson({ status: 'ok', command: 'plugins.import-openclaw', ...imported }, asJson);
}

function parseYamlFrontmatter(raw) {
  const text = String(raw || '');
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---', 4);
  if (end < 0) return {};
  const yaml = text.slice(4, end).split('\n');
  const out = {};
  for (const line of yaml) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function pushFinding(arr, severity, code, message, recommendation) {
  arr.push({ severity, code, message, recommendation });
}

function validateSkillMarkdown(skillText, findings) {
  const fm = parseYamlFrontmatter(skillText);
  if (!fm.name) {
    pushFinding(
      findings,
      'error',
      'SKILL_NAME_MISSING',
      'SKILL.md is missing frontmatter field: name',
      'Add `name:` to SKILL.md frontmatter.',
    );
  }
  if (!fm.version) {
    pushFinding(
      findings,
      'warning',
      'SKILL_VERSION_MISSING',
      'SKILL.md frontmatter does not include version.',
      'Add semantic `version:` field for upgrade tracking.',
    );
  }

  const lower = String(skillText || '').toLowerCase();
  if (!lower.includes('approval')) {
    pushFinding(
      findings,
      'warning',
      'APPROVAL_POLICY_UNSPECIFIED',
      'No approval policy notes found in SKILL.md.',
      'Document which actions require approval/quorum.',
    );
  }
  if (!lower.includes('egress')) {
    pushFinding(
      findings,
      'warning',
      'EGRESS_POLICY_UNSPECIFIED',
      'No egress/network policy notes found in SKILL.md.',
      'Document network allowlist/denylist expectations.',
    );
  }
  if (!lower.includes('scope')) {
    pushFinding(
      findings,
      'warning',
      'SCOPE_POLICY_UNSPECIFIED',
      'No scope mapping found in SKILL.md.',
      'Map actions to Sven scopes (read/write/admin).',
    );
  }
}

function validateOpenClawManifest(manifest, findings) {
  if (!manifest || typeof manifest !== 'object') {
    pushFinding(
      findings,
      'error',
      'MANIFEST_INVALID',
      'Plugin manifest JSON is missing or invalid.',
      'Provide a valid OpenClaw manifest JSON object.',
    );
    return;
  }

  if (!manifest.name) {
    pushFinding(
      findings,
      'error',
      'MANIFEST_NAME_MISSING',
      'Manifest is missing `name`.',
      'Add `name` to plugin manifest.',
    );
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  if (permissions.length === 0) {
    pushFinding(
      findings,
      'warning',
      'PERMISSIONS_MISSING',
      'Manifest has no explicit permissions array.',
      'Declare least-privilege permissions explicitly.',
    );
  }

  const network = manifest.network || manifest.egress || {};
  const allow = Array.isArray(network.allow) ? network.allow : [];
  const deny = Array.isArray(network.deny) ? network.deny : [];
  if (allow.some((x) => String(x).trim() === '*' || String(x).includes('0.0.0.0/0'))) {
    pushFinding(
      findings,
      'error',
      'EGRESS_WILDCARD',
      'Manifest egress allowlist contains wildcard/all-network entry.',
      'Replace wildcard egress with explicit domains.',
    );
  } else if (allow.length === 0) {
    pushFinding(
      findings,
      'warning',
      'EGRESS_ALLOWLIST_MISSING',
      'No egress allowlist detected in manifest.',
      'Define explicit outbound domain allowlist.',
    );
  }

  if (deny.length === 0) {
    pushFinding(
      findings,
      'info',
      'EGRESS_DENYLIST_EMPTY',
      'No explicit egress denylist detected.',
      'Consider deny rules for metadata/internal ranges.',
    );
  }

  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  if (tools.length === 0) {
    pushFinding(
      findings,
      'warning',
      'TOOLS_UNDECLARED',
      'Manifest has no declared tools.',
      'Declare tools for traceability and scope mapping.',
    );
  }
}

async function cmdPluginsValidate(target, options) {
  const asJson = Boolean(options.json);
  const strict = Boolean(options.strict);
  const findings = [];
  const resolvedTarget = target || process.cwd();
  const summary = {
    target: resolvedTarget,
    type: 'unknown',
    checked: [],
    findings,
  };

  const isLikelyUrl = /^https?:\/\//i.test(String(resolvedTarget));
  if (isLikelyUrl) {
    const res = await fetch(String(resolvedTarget), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      pushFinding(
        findings,
        'error',
        'FETCH_FAILED',
        `Failed to fetch manifest URL (${res.status}).`,
        'Ensure URL is reachable and returns JSON.',
      );
    } else {
      const manifest = await res.json().catch(() => null);
      summary.type = 'manifest-url';
      summary.checked.push(String(resolvedTarget));
      validateOpenClawManifest(manifest, findings);
    }
  } else {
    const path = resolve(String(resolvedTarget));
    let stat = null;
    try {
      stat = statSync(path);
    } catch {
      pushFinding(
        findings,
        'error',
        'TARGET_NOT_FOUND',
        `Validation target not found: ${path}`,
        'Pass a valid directory/file path or manifest URL.',
      );
    }

    if (stat) {
      if (stat.isDirectory()) {
        summary.type = 'directory';
        const skillPath = join(path, 'SKILL.md');
        const manifestPath = join(path, 'openclaw.plugin.json');
        try {
          const skillText = await readFile(skillPath, 'utf8');
          summary.checked.push(skillPath);
          validateSkillMarkdown(skillText, findings);
        } catch {
          pushFinding(
            findings,
            'warning',
            'SKILL_NOT_FOUND',
            'No SKILL.md found in target directory.',
            'Add SKILL.md or validate a specific file path.',
          );
        }
        try {
          const rawManifest = await readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(rawManifest);
          summary.checked.push(manifestPath);
          validateOpenClawManifest(manifest, findings);
        } catch {
          pushFinding(
            findings,
            'info',
            'MANIFEST_NOT_FOUND',
            'No openclaw.plugin.json found in target directory.',
            'Run `sven plugins import-openclaw` first for migration workflows.',
          );
        }
      } else {
        const ext = extname(path).toLowerCase();
        if (ext === '.md') {
          summary.type = 'skill-markdown';
          const skillText = await readFile(path, 'utf8');
          summary.checked.push(path);
          validateSkillMarkdown(skillText, findings);
        } else if (ext === '.json') {
          summary.type = 'manifest-json';
          const rawManifest = await readFile(path, 'utf8');
          const manifest = JSON.parse(rawManifest);
          summary.checked.push(path);
          validateOpenClawManifest(manifest, findings);
        } else {
          pushFinding(
            findings,
            'error',
            'UNSUPPORTED_TARGET',
            `Unsupported file type for validation: ${path}`,
            'Use a directory, SKILL.md, manifest.json, or manifest URL.',
          );
        }
      }
    }
  }

  const counts = {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
  const ok = strict ? counts.errors === 0 && counts.warnings === 0 : counts.errors === 0;
  const output = {
    status: ok ? 'ok' : 'failed',
    strict,
    ...summary,
    counts,
  };

  toJson(output, asJson);
  if (!ok) process.exit(2);
}

async function importOpenClawManifest(manifestUrl, options, asJson) {
  let parsedUrl;
  try {
    parsedUrl = new URL(String(manifestUrl));
  } catch {
    printErr('Invalid manifest URL');
    process.exit(1);
    return null;
  }

  const res = await fetch(parsedUrl.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const response = await res.text().catch(() => '');
    toJson(
      {
        status: 'error',
        message: 'Failed to fetch OpenClaw plugin manifest',
        http_status: res.status,
        response,
      },
      asJson,
    );
    process.exit(1);
    return null;
  }

  const manifest = await res.json().catch(() => null);
  if (!manifest || typeof manifest !== 'object') {
    printErr('Manifest JSON is invalid');
    process.exit(1);
    return null;
  }

  const name = String(manifest.name || manifest.displayName || manifest.title || 'Imported OpenClaw Plugin');
  const description = String(manifest.description || 'Imported from OpenClaw plugin manifest');
  const version = String(manifest.version || '0.1.0');
  const source = String(manifest.repository || manifest.source || parsedUrl.origin);
  const toolNames = Array.isArray(manifest.tools)
    ? manifest.tools.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
    : [];

  const slug = toSlug(options.slug || manifest.slug || name);
  const outDir = resolve(String(options.out || join(process.cwd(), 'skills', slug)));
  await mkdir(outDir, { recursive: true });
  applyOwnerOnlyDirectoryPermissions(outDir);

  const skillMd = [
    '---',
    `name: ${name}`,
    `slug: ${slug}`,
    `version: ${version}`,
    'source: openclaw-plugin',
    '---',
    '',
    `# ${name}`,
    '',
    description,
    '',
    '## Origin',
    `- Manifest: ${parsedUrl.toString()}`,
    `- Source: ${source}`,
    '',
    '## Imported Tool Hints',
    ...(toolNames.length > 0
      ? toolNames.map((toolName) => `- ${toolName}`)
      : ['- No explicit tool list found in plugin manifest']),
    '',
    '## Next Steps',
    '- Map each imported tool to a Sven tool id.',
    '- Add explicit approval scopes and egress policy constraints.',
    '- Validate in quarantine before promotion.',
    '',
  ].join('\n');

  const manifestJsonPath = join(outDir, 'openclaw.plugin.json');
  const skillPath = join(outDir, 'SKILL.md');
  await writeFile(manifestJsonPath, JSON.stringify(manifest, null, 2), 'utf8');
  applyOwnerOnlyFilePermissions(manifestJsonPath);
  await writeFile(skillPath, skillMd, 'utf8');
  applyOwnerOnlyFilePermissions(skillPath);

  return {
    slug,
    out_dir: outDir,
    files: [skillPath, manifestJsonPath],
    tools_discovered: toolNames.length,
    manifest_url: parsedUrl.toString(),
    manifest,
    name,
    description,
    version,
    source,
  };
}

async function ensureImportRegistrySource(options, manifestUrl, asJson) {
  const listRes = await getAdminJson('/registry/sources?per_page=200', options);
  if (!listRes.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to list registry sources',
        http_status: listRes.status,
        response: listRes.data,
      },
      asJson,
    );
    process.exit(1);
  }
  const rows = Array.isArray(listRes.data?.data) ? listRes.data.data : [];
  const found = rows.find((r) => String(r?.name || '') === 'OpenClaw Import');
  if (found?.id) return String(found.id);

  const created = await getAdminJson('/registry/sources', options, {
    method: 'POST',
    body: JSON.stringify({
      name: 'OpenClaw Import',
      type: 'public',
      url: new URL(manifestUrl).origin,
      enabled: true,
    }),
  });
  if (!created.ok) {
    toJson(
      {
        status: 'error',
        message: 'Failed to create OpenClaw import registry source',
        http_status: created.status,
        response: created.data,
      },
      asJson,
    );
    process.exit(1);
  }
  return String(created.data?.data?.id || '');
}

async function cmdPluginsImportQuarantine(manifestUrl, options) {
  const asJson = Boolean(options.json);
  const strict = Boolean(options.strict);
  const dryRun = Boolean(options['dry-run'] || options.dryRun);
  const toolId = String(options['tool-id'] || '').trim();
  const imported = await importOpenClawManifest(manifestUrl, options, asJson);
  const outDir = String(imported.out_dir);

  const target = outDir;
  const validation = await (async () => {
    const findings = [];
    const skillPath = join(target, 'SKILL.md');
    const manifestPath = join(target, 'openclaw.plugin.json');
    const skillText = await readFile(skillPath, 'utf8').catch(() => '');
    const manifestRaw = await readFile(manifestPath, 'utf8').catch(() => '{}');
    validateSkillMarkdown(skillText, findings);
    validateOpenClawManifest(JSON.parse(manifestRaw), findings);
    const counts = {
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    };
    const ok = strict ? counts.errors === 0 && counts.warnings === 0 : counts.errors === 0;
    return { status: ok ? 'ok' : 'failed', strict, findings, counts };
  })();

  if (validation.status !== 'ok') {
    toJson(
      {
        status: 'failed',
        command: 'plugins.import-quarantine',
        phase: 'validate',
        imported: {
          slug: imported.slug,
          out_dir: imported.out_dir,
          files: imported.files,
        },
        validation,
      },
      asJson,
    );
    process.exit(2);
    return;
  }

  const plan = [
    'Imported manifest to local skill scaffold',
    strict ? 'Validated with strict mode' : 'Validated (errors must be zero)',
    dryRun
      ? 'Dry-run: no registry writes'
      : 'Will create/find registry source, catalog entry, and install as quarantined',
  ];

  if (dryRun) {
    toJson(
      {
        status: 'ok',
        command: 'plugins.import-quarantine',
        dry_run: true,
        plan,
        imported: {
          slug: imported.slug,
          out_dir: imported.out_dir,
          files: imported.files,
          tools_discovered: imported.tools_discovered,
        },
        validation,
      },
      asJson,
    );
    return;
  }

  if (!toolId) {
    printErr('Missing --tool-id for non-dry-run install.');
    process.exit(1);
    return;
  }

  const sourceId = await ensureImportRegistrySource(options, imported.manifest_url, asJson);
  const catalogRes = await getAdminJson('/registry/catalog', options, {
    method: 'POST',
    body: JSON.stringify({
      source_id: sourceId,
      name: imported.name,
      description: imported.description,
      version: imported.version,
      format: 'openclaw',
      manifest: imported.manifest,
    }),
  });
  if (!catalogRes.ok) {
    toJson(
      {
        status: 'error',
        command: 'plugins.import-quarantine',
        message: 'Failed to create catalog entry',
        http_status: catalogRes.status,
        response: catalogRes.data,
      },
      asJson,
    );
    process.exit(1);
  }

  const catalogEntryId = String(catalogRes.data?.data?.id || '');
  const installRes = await getAdminJson('/registry/installed', options, {
    method: 'POST',
    body: JSON.stringify({
      catalog_entry_id: catalogEntryId,
      tool_id: toolId,
      trust_level: 'quarantined',
    }),
  });
  if (!installRes.ok) {
    toJson(
      {
        status: 'error',
        command: 'plugins.import-quarantine',
        message: 'Failed to install imported plugin in quarantined mode',
        http_status: installRes.status,
        response: installRes.data,
      },
      asJson,
    );
    process.exit(1);
  }

  toJson(
    {
      status: 'ok',
      command: 'plugins.import-quarantine',
      dry_run: false,
      imported: {
        slug: imported.slug,
        out_dir: imported.out_dir,
        files: imported.files,
        tools_discovered: imported.tools_discovered,
      },
      validation,
      registry: {
        source_id: sourceId,
        catalog_entry_id: catalogEntryId,
        installed: installRes.data?.data || installRes.data,
      },
    },
    asJson,
  );
}

function usageSecurityAudit() {
  return [
    'Usage: sven security audit [options]',
    '',
    'Run security audit checks against a Sven deployment.',
    '',
    'Options:',
    '  --fix                    Auto-remediate fixable issues',
    '  --deep                   Run extended auth/session security probes',
    '  --url <gateway_url>      Gateway URL (default: $SVEN_GATEWAY_URL)',
    '  --cookie <session_cookie> Admin session cookie',
    '  --json                   Machine-readable JSON output',
    '',
    'Check IDs:',
    '  SEC-001  TLS enabled for external endpoints',
    '  SEC-002  Default passwords/secrets changed',
    '  SEC-003  Admin 2FA enabled',
    '  SEC-004  Egress proxy active',
    '  SEC-005  Kill switch accessible',
    '  SEC-006  Backup configured',
    '  SEC-007  Docker containers running as non-root',
    '  SEC-008  CORS restricted to allowed origins',
    '  SEC-009  Rate limiting configured',
    '  SEC-010  Secrets not in plaintext config',
    '  SEC-011  Admin settings endpoint requires auth',
    '  SEC-012  Admin users endpoint requires auth',
    '  SEC-013  Canvas API endpoint requires auth',
    '  SEC-014  Login endpoint does not allow GET',
    '  SEC-015  Invalid login request fails safely (not 5xx)',
    '  SEC-016  Refresh endpoint rejects unauthenticated access',
    '  SEC-017  Cookie secret configured and non-default',
    '  SEC-018  Config CORS value not wildcard',
    '  SEC-019  Config gateway URL uses HTTPS',
    '  SEC-020  Cookie secure flag enabled in config',
    '  SEC-021  Logout rejects hostile-origin requests (deep mode)',
    '  SEC-022  Token-exchange endpoint requires auth (deep mode)',
    '',
    'Exit code is non-zero if any critical or high severity findings exist.',
  ].join('\n');
}

async function cmdSecurityAudit(options) {
  const url = String(options.url || DEFAULT_GATEWAY_URL);
  const asJson = Boolean(options.json);
  const autoFix = Boolean(options.fix);
  const deepMode = Boolean(options.deep);
  const cookie = adminCookie(options);
  const findings = [];
  const configResult = await readConfigFile(options);
  const configData = configResult.ok ? (configResult.data || {}) : {};

  const remediationCatalog = {
    'SEC-001': {
      config_path: 'gateway.public_url',
      remediation: 'Set HTTPS public URL and terminate TLS at ingress/reverse proxy.',
    },
    'SEC-003': {
      config_path: 'auth.totp_required',
      remediation: 'Enable admin MFA/TOTP requirement.',
    },
    'SEC-004': {
      config_path: 'network.egress_proxy',
      remediation: 'Set egress proxy URL for outbound HTTP traffic.',
    },
    'SEC-005': {
      config_path: '/v1/admin/kill-switch',
      remediation: 'Expose a protected admin kill-switch endpoint (or disable this check in environments where kill-switch is intentionally unsupported).',
    },
    'SEC-006': {
      config_path: 'backup.enabled',
      remediation: 'Enable scheduled backups and retention policy.',
    },
    'SEC-008': {
      config_path: 'cors.origin',
      remediation: 'Set CORS origin to explicit trusted origins (not "*").',
    },
    'SEC-009': {
      config_path: 'rate_limit.enabled',
      remediation: 'Enable API rate limiting and verify per-route policy.',
    },
    'SEC-010': {
      config_path: '<secret_key_path>',
      remediation: 'Move plaintext secret to env/vault reference and rotate credential.',
    },
    'SEC-017': {
      config_path: 'auth.cookie_secret',
      remediation: 'Set strong random cookie secret (>= 16 chars).',
    },
    'SEC-018': {
      config_path: 'gateway.cors_origin',
      remediation: 'Set explicit allowed origins and disable wildcard.',
    },
    'SEC-019': {
      config_path: 'gateway.public_url',
      remediation: 'Use HTTPS URL for public gateway endpoint.',
    },
    'SEC-020': {
      config_path: 'auth.cookie_secure',
      remediation: 'Set auth.cookie_secure=true in production.',
    },
  };

  function finding(id, severity, title, detail, optionsOrFixable = false) {
    const base = remediationCatalog[id] || {};
    const opts =
      typeof optionsOrFixable === 'boolean'
        ? { fixable: optionsOrFixable }
        : (optionsOrFixable || {});
    findings.push({
      id,
      severity,
      title,
      detail,
      fixable: Boolean(opts.fixable),
      fixed: false,
      config_path: opts.config_path || base.config_path,
      remediation: opts.remediation || base.remediation,
    });
  }

  function markFixed(id) {
    const f = findings.find((x) => x.id === id);
    if (f) f.fixed = true;
  }

  function getConfigValue(path) {
    if (!path) return undefined;
    return String(path)
      .split('.')
      .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), configData);
  }

  // ── SEC-001: TLS enabled ──
  const tlsResult = await getTlsCheck(url);
  if (tlsResult.status === 'fail') {
    finding('SEC-001', 'critical', 'TLS not enabled or failing', tlsResult.note || 'TLS handshake failed');
  } else if (tlsResult.status === 'warn') {
    const note = tlsResult.note || '';
    if (note.includes('not using https')) {
      finding('SEC-001', 'critical', 'Gateway not using HTTPS', note);
    } else {
      finding('SEC-001', 'medium', 'TLS warning', note);
    }
  }

  // ── SEC-002: Default passwords/secrets changed ──
  if (cookie) {
    const settingsRes = await getAdminJson('/settings', options);
    if (settingsRes.ok) {
      const settings = settingsRes.data?.data || settingsRes.data || {};
      const flat = typeof settings === 'object' ? settings : {};
      const dangerousDefaults = [
        'changeme', 'password', 'admin', 'secret', 'default', '123456',
        'sven', 'test', 'password123',
      ];
      for (const [key, val] of Object.entries(flat)) {
        if (isSensitiveKey(key) && typeof val === 'string') {
          const lower = val.toLowerCase();
          if (dangerousDefaults.includes(lower)) {
            finding(
              'SEC-002',
              'critical',
              `Default secret detected: ${key}`,
              `Key "${key}" appears to use a default/weak value`,
              {
                config_path: key,
                remediation: 'Replace with strong secret and rotate credential.',
              },
            );
          }
        }
      }
    }
    // Also check via config file
    if (configResult.ok && configData) {
      const dangerousDefaults = ['changeme', 'password', 'admin', 'secret', 'default', '123456'];
      function scanConfig(obj, path) {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          const fullKey = path ? `${path}.${k}` : k;
          if (typeof v === 'string' && isSensitiveKey(k)) {
            if (dangerousDefaults.includes(v.toLowerCase())) {
              finding(
                'SEC-002',
                'critical',
                `Default secret in config: ${fullKey}`,
                `Config key "${fullKey}" uses a default/weak value`,
                {
                  config_path: fullKey,
                  remediation: 'Replace with strong secret and store via env/vault reference.',
                },
              );
            }
          } else if (typeof v === 'object' && v !== null) {
            scanConfig(v, fullKey);
          }
        }
      }
      scanConfig(configData, '');
    }
  } else {
    finding('SEC-002', 'medium', 'Cannot check default secrets', 'No admin cookie provided; skipping default-password check');
  }

  // ── SEC-003: Admin 2FA enabled ──
  if (cookie) {
    const authSettingsRes = await getAdminJson('/settings/global/auth', options);
    if (authSettingsRes.ok) {
      const authSettings = authSettingsRes.data?.data || authSettingsRes.data || {};
      const totpRequired = authSettings.totp_required === true || authSettings.mfa_required === true;
      if (!totpRequired) {
        finding('SEC-003', 'high', 'Admin 2FA not enforced', 'TOTP/MFA is not required for admin accounts', true);
        if (autoFix) {
          const fixRes = await getAdminJson('/settings/global', options, {
            method: 'PATCH',
            body: JSON.stringify({ key: 'auth.totp_required', value: true }),
          });
          if (fixRes.ok) markFixed('SEC-003');
        }
      }
    } else {
      // Try alternative settings path
      const globalRes = await getAdminJson('/settings/global', options);
      if (globalRes.ok) {
        const data = globalRes.data?.data || globalRes.data || {};
        const totpKey = data['auth.totp_required'] || data['auth.mfa_required'];
        if (totpKey !== true && totpKey !== 'true') {
          finding('SEC-003', 'high', 'Admin 2FA not enforced', 'TOTP/MFA is not required for admin accounts', true);
          if (autoFix) {
            const fixRes = await getAdminJson('/settings/global', options, {
              method: 'PATCH',
              body: JSON.stringify({ key: 'auth.totp_required', value: true }),
            });
            if (fixRes.ok) markFixed('SEC-003');
          }
        }
      }
    }
  } else {
    finding('SEC-003', 'medium', 'Cannot check 2FA enforcement', 'No admin cookie provided; skipping 2FA check');
  }

  // ── SEC-004: Egress proxy active ──
  if (cookie) {
    const egressRes = await getAdminJson('/settings/global', options);
    if (egressRes.ok) {
      const data = egressRes.data?.data || egressRes.data || {};
      const egressProxy = data['network.egress_proxy'] || data['egress_proxy'] || data['http_proxy'];
      if (!egressProxy) {
        finding('SEC-004', 'medium', 'No egress proxy configured', 'Outbound HTTP traffic is not routed through a proxy');
      }
    }
  }

  // ── SEC-005: Kill switch accessible ──
  {
    const killRes = await getJson(`${url}/v1/admin/kill-switch`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    if (killRes.status === 401 || killRes.status === 403) {
      // Expected when no auth — good, it's protected
    } else if (!killRes.ok && killRes.status === 404) {
      finding('SEC-005', 'high', 'Kill switch endpoint not found', 'No /v1/admin/kill-switch endpoint detected');
    } else if (killRes.ok) {
      // Accessible with auth — good
    } else {
      finding('SEC-005', 'medium', 'Kill switch status unknown', `Received HTTP ${killRes.status}`);
    }
  }

  // ── SEC-006: Backup configured ──
  if (cookie) {
    const backupRes = await getAdminJson('/settings/global', options);
    if (backupRes.ok) {
      const data = backupRes.data?.data || backupRes.data || {};
      const backupEnabled = data['backup.enabled'] || data['backup.schedule'];
      if (!backupEnabled) {
        finding('SEC-006', 'high', 'Backup not configured', 'No backup schedule or backup.enabled setting found');
      }
    }
  }

  // ── SEC-007: Docker non-root ──
  {
    if (process.env.SVEN_SECURITY_AUDIT_SKIP_DOCKER === '1') {
      finding('SEC-007', 'info', 'Docker container non-root check skipped', 'SVEN_SECURITY_AUDIT_SKIP_DOCKER=1');
    } else {
      const proc = spawnSync('docker', ['compose', 'ps', '--format', 'json'], {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 15000,
      });
      if (proc.status === 0 && proc.stdout) {
        const lines = proc.stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const container = JSON.parse(line);
            const name = container.Name || container.Service || 'unknown';
            // Inspect for root user
            const inspect = spawnSync('docker', ['inspect', '--format', '{{.Config.User}}', name], {
              stdio: 'pipe',
              encoding: 'utf8',
              timeout: 10000,
            });
            const user = (inspect.stdout || '').trim();
            if (!user || user === 'root' || user === '0') {
              finding('SEC-007', 'medium', `Container runs as root: ${name}`, `Container "${name}" has User="${user || '(empty/root)'}"`);
            }
          } catch {
            // Ignore parse errors
          }
        }
      } else {
        finding('SEC-007', 'low', 'Cannot check Docker containers', 'docker compose ps failed or docker not available');
      }
    }
  }

  // ── SEC-008: CORS restricted ──
  {
    const corsRes = await getJson(`${url}/healthz`, {
      headers: { Origin: 'https://evil-attacker.example.com' },
    });
    const acao = '';
    // Check via settings API if admin access available
    if (cookie) {
      const settingsRes = await getAdminJson('/settings/global', options);
      if (settingsRes.ok) {
        const data = settingsRes.data?.data || settingsRes.data || {};
        const corsOrigin = data['cors.origin'] || data['CORS_ORIGIN'] || '';
        if (corsOrigin === 'true' || corsOrigin === '*') {
          finding('SEC-008', 'high', 'CORS allows all origins', `CORS_ORIGIN is set to "${corsOrigin}" — all origins accepted`, true);
          if (autoFix) {
            const fixRes = await getAdminJson('/settings/global', options, {
              method: 'PATCH',
              body: JSON.stringify({ key: 'cors.origin', value: '' }),
            });
            if (fixRes.ok) markFixed('SEC-008');
          }
        }
      }
    }
  }

  // ── SEC-009: Rate limiting configured ──
  if (cookie) {
    const rlRes = await getAdminJson('/settings/global', options);
    if (rlRes.ok) {
      const data = rlRes.data?.data || rlRes.data || {};
      const rlEnabled = data['rate_limit.enabled'] ?? data['rateLimit.enabled'];
      if (rlEnabled === false || rlEnabled === 'false') {
        finding('SEC-009', 'high', 'Rate limiting disabled', 'Rate limiting is explicitly disabled in settings', true);
        if (autoFix) {
          const fixRes = await getAdminJson('/settings/global', options, {
            method: 'PATCH',
            body: JSON.stringify({ key: 'rate_limit.enabled', value: true }),
          });
          if (fixRes.ok) markFixed('SEC-009');
        }
      }
    }
  } else {
    // Probe: send rapid requests and check for 429
    let got429 = false;
    for (let i = 0; i < 5; i++) {
      const probe = await getJson(`${url}/healthz`);
      if (probe.status === 429) {
        got429 = true;
        break;
      }
    }
    // Can't determine definitively from outside, note it
    finding('SEC-009', 'info', 'Rate limiting check inconclusive', 'No admin cookie; cannot verify rate-limit settings');
  }

  // ── SEC-010: Secrets not in plaintext config ──
  {
    if (configResult.ok && configData) {
      function scanForPlaintext(obj, path) {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          const fullKey = path ? `${path}.${k}` : k;
          if (typeof v === 'string' && isSensitiveKey(k)) {
            // Check if it looks like an unencrypted secret (not a reference/env var)
            if (v && !v.startsWith('${') && !v.startsWith('env:') && !v.startsWith('vault:') && !v.startsWith('***') && v.length > 0) {
              finding(
                'SEC-010',
                'high',
                `Plaintext secret in config: ${fullKey}`,
                `Config key "${fullKey}" contains a plaintext secret value`,
                {
                  config_path: fullKey,
                  remediation: 'Replace plaintext with ${ENV_VAR} / env: / vault: reference and rotate secret.',
                },
              );
            }
          } else if (typeof v === 'object' && v !== null) {
            scanForPlaintext(v, fullKey);
          }
        }
      }
      scanForPlaintext(configData, '');
    }
  }

  // ── SEC-011: Admin settings endpoint requires auth ──
  {
    const probe = await getJson(`${url}/v1/admin/settings`);
    if (probe.ok) {
      finding('SEC-011', 'critical', 'Admin settings endpoint exposed', 'Unauthenticated request to /v1/admin/settings succeeded');
    } else if (probe.status !== 401 && probe.status !== 403 && probe.status !== 404 && probe.status !== 0) {
      finding('SEC-011', 'medium', 'Admin settings auth unclear', `Unexpected status from /v1/admin/settings: HTTP ${probe.status}`);
    }
  }

  // ── SEC-012: Admin users endpoint requires auth ──
  {
    const probe = await getJson(`${url}/v1/admin/users`);
    if (probe.ok) {
      finding('SEC-012', 'critical', 'Admin users endpoint exposed', 'Unauthenticated request to /v1/admin/users succeeded');
    } else if (probe.status !== 401 && probe.status !== 403 && probe.status !== 404 && probe.status !== 0) {
      finding('SEC-012', 'medium', 'Admin users auth unclear', `Unexpected status from /v1/admin/users: HTTP ${probe.status}`);
    }
  }

  // ── SEC-013: Canvas endpoint requires auth ──
  {
    const probe = await getJson(`${url}/v1/canvas/chats`);
    if (probe.ok) {
      finding('SEC-013', 'high', 'Canvas chats endpoint exposed', 'Unauthenticated request to /v1/canvas/chats succeeded');
    } else if (probe.status !== 401 && probe.status !== 403 && probe.status !== 404 && probe.status !== 0) {
      finding('SEC-013', 'medium', 'Canvas auth unclear', `Unexpected status from /v1/canvas/chats: HTTP ${probe.status}`);
    }
  }

  // ── SEC-014: Login endpoint should not allow GET ──
  {
    const probe = await getJson(`${url}/v1/auth/login`);
    if (probe.ok) {
      finding('SEC-014', 'high', 'Login endpoint accepts GET', 'GET /v1/auth/login responded with success');
    } else if (probe.status === 405 || probe.status === 400 || probe.status === 404) {
      // Expected: no finding.
    } else if (probe.status !== 0) {
      finding('SEC-014', 'low', 'Login endpoint behavior unclear', `GET /v1/auth/login returned HTTP ${probe.status}`);
    }
  }

  // ── SEC-015: Invalid login request fails safely ──
  {
    const probe = await getJson(`${url}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '__invalid__', password: '__invalid__' }),
    });
    if (probe.status >= 500) {
      finding('SEC-015', 'high', 'Invalid login caused server error', `POST /v1/auth/login returned HTTP ${probe.status}`);
    } else if (probe.status === 0) {
      finding('SEC-015', 'low', 'Login safety check skipped', 'Gateway was unreachable during invalid-login probe');
    }
  }

  // ── SEC-016: Refresh endpoint rejects unauthenticated access ──
  {
    const probe = await getJson(`${url}/v1/auth/refresh`, { method: 'POST' });
    if (probe.ok) {
      finding('SEC-016', 'high', 'Refresh endpoint allows unauthenticated access', 'POST /v1/auth/refresh succeeded without session cookie');
    } else if (probe.status !== 401 && probe.status !== 403 && probe.status !== 404 && probe.status !== 0) {
      finding('SEC-016', 'low', 'Refresh endpoint behavior unclear', `POST /v1/auth/refresh returned HTTP ${probe.status}`);
    }
  }

  // ── SEC-017: Cookie secret configured and non-default ──
  {
    const cookieSecret = getConfigValue('auth.cookie_secret') ?? process.env.COOKIE_SECRET;
    if (!cookieSecret || String(cookieSecret).trim().length < 16) {
      finding('SEC-017', 'high', 'Cookie secret missing or weak', 'auth.cookie_secret / COOKIE_SECRET is missing or too short (<16 chars)');
    } else {
      const weak = ['changeme', 'default', 'secret', 'password', 'admin'];
      if (weak.includes(String(cookieSecret).toLowerCase())) {
        finding('SEC-017', 'critical', 'Cookie secret uses weak default', 'auth.cookie_secret / COOKIE_SECRET appears to be default/weak');
      }
    }
  }

  // ── SEC-018: Config CORS value not wildcard ──
  {
    const cors = getConfigValue('gateway.cors_origin') ?? process.env.CORS_ORIGIN;
    if (cors === true || cors === '*' || cors === 'true') {
      finding('SEC-018', 'high', 'Config allows wildcard CORS', `gateway.cors_origin/CORS_ORIGIN is "${String(cors)}"`);
    }
  }

  // ── SEC-019: Config gateway URL uses HTTPS ──
  {
    const gatewayUrl = getConfigValue('gateway.public_url') || getConfigValue('gateway_url') || process.env.GATEWAY_URL || '';
    if (gatewayUrl && /^http:\/\//i.test(String(gatewayUrl))) {
      finding('SEC-019', 'critical', 'Gateway URL is plain HTTP', `Configured gateway URL is not HTTPS: ${String(gatewayUrl)}`);
    }
  }

  // ── SEC-020: Cookie secure flag enabled in config ──
  {
    const secure = getConfigValue('auth.cookie_secure');
    if (secure === false || secure === 'false') {
      finding('SEC-020', 'high', 'Cookie secure flag disabled', 'auth.cookie_secure is explicitly disabled');
    } else if (secure === undefined) {
      finding('SEC-020', 'info', 'Cookie secure flag not explicitly set', 'Set auth.cookie_secure=true in production config');
    }
  }

  // ── SEC-021..SEC-022: Deep checks ──
  if (deepMode) {
    {
      const headers = { Origin: 'https://evil-attacker.example.com' };
      if (cookie) headers.Cookie = cookie;
      const probe = await getJson(`${url}/v1/auth/logout`, {
        method: 'POST',
        headers,
      });
      if (probe.ok) {
        finding(
          'SEC-021',
          'high',
          'Logout endpoint accepted hostile-origin request',
          'POST /v1/auth/logout succeeded for untrusted Origin; enforce strict origin checks for cookie-auth requests',
        );
      } else if (![401, 403, 404, 405, 0].includes(probe.status)) {
        finding(
          'SEC-021',
          'low',
          'Logout CSRF hardening check inconclusive',
          `POST /v1/auth/logout returned HTTP ${probe.status}`,
        );
      }
    }

    {
      const headers = { 'Content-Type': 'application/json' };
      if (cookie) headers.Cookie = cookie;
      const probe = await getJson(`${url}/v1/auth/token-exchange`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: 'invalid' }),
      });
      if (probe.ok) {
        finding(
          'SEC-022',
          'high',
          'Token-exchange endpoint exposed without strict auth boundary',
          'POST /v1/auth/token-exchange succeeded under low-trust probe conditions',
        );
      } else if (![400, 401, 403, 404, 405, 0].includes(probe.status)) {
        finding(
          'SEC-022',
          'low',
          'Token-exchange auth hardening check inconclusive',
          `POST /v1/auth/token-exchange returned HTTP ${probe.status}`,
        );
      }
    }
  }

  // ── Format output ──
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

  const hasCritical = findings.some((f) => f.severity === 'critical' && !f.fixed);
  const hasHigh = findings.some((f) => f.severity === 'high' && !f.fixed);
  const summary = {
    total: findings.length,
    critical: findings.filter((f) => f.severity === 'critical' && !f.fixed).length,
    high: findings.filter((f) => f.severity === 'high' && !f.fixed).length,
    medium: findings.filter((f) => f.severity === 'medium' && !f.fixed).length,
    low: findings.filter((f) => f.severity === 'low' && !f.fixed).length,
    info: findings.filter((f) => f.severity === 'info' && !f.fixed).length,
    fixed: findings.filter((f) => f.fixed).length,
  };

  if (asJson) {
    toJson({
      status: hasCritical || hasHigh ? 'fail' : 'pass',
      summary,
      findings,
      mode: { deep: deepMode },
    }, true);
  } else {
    if (findings.length === 0) {
      print('Security audit passed — no findings.');
    } else {
      print(`\nSven Security Audit Report`);
      print(`${'─'.repeat(60)}`);
      const severityColors = {
        critical: '\x1b[31m', // red
        high: '\x1b[33m',     // yellow
        medium: '\x1b[36m',   // cyan
        low: '\x1b[37m',      // white
        info: '\x1b[90m',     // gray
      };
      const reset = '\x1b[0m';
      for (const f of findings) {
        const color = severityColors[f.severity] || '';
        const fixedTag = f.fixed ? ' [FIXED]' : '';
        print(`  ${color}[${f.severity.toUpperCase()}]${reset} ${f.id}: ${f.title}${fixedTag}`);
        print(`           ${f.detail}`);
        if (f.config_path) {
          print(`           config: ${f.config_path}`);
        }
        if (f.remediation) {
          print(`           fix: ${f.remediation}`);
        }
        if (f.fixable && !f.fixed) {
          print(`           (fixable with --fix)`);
        }
      }
      print(`${'─'.repeat(60)}`);
      print(`Summary: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low, ${summary.info} info`);
      if (summary.fixed > 0) {
        print(`Auto-fixed: ${summary.fixed} issue(s)`);
      }
    }
  }

  if (hasCritical || hasHigh) {
    process.exit(1);
  }
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [cmd, sub] = positionals;

  if (options.trace) {
    printErr(`[trace] ${JSON.stringify({ ts: new Date().toISOString(), event: 'cli.start', profile: ACTIVE_PROFILE, format: OUTPUT_FORMAT })}`);
  }

  if (options.version || cmd === 'version') {
    print(VERSION);
    return;
  }
  if (!cmd) {
    print(usage());
    return;
  }

  const strictConfigGuard = getStrictConfigGuardLabel(cmd, sub);
  if (strictConfigGuard && isStrictConfigEnabled(options)) {
    await enforceStrictConfigPreflight(strictConfigGuard, options);
  }

  if (cmd === 'gateway') {
    if (options.help || sub === 'help') {
      print(usageGateway());
      return;
    }
    if (sub === 'status') {
      await cmdGatewayStatus(options);
      return;
    }
    if (sub === 'start') {
      cmdGatewayStart(options);
      return;
    }
    if (sub === 'stop') {
      cmdGatewayStop(options);
      return;
    }
    if (sub === 'restart') {
      cmdGatewayRestart(options);
      return;
    }
    if (sub === 'logs') {
      cmdGatewayLogs(options);
      return;
    }
    printErr('Unknown gateway subcommand. Use: status|start|stop|restart|logs');
    process.exit(1);
    return;
  }

  if (cmd === 'doctor') {
    if (options.help || sub === 'help') {
      print(usageDoctor());
      return;
    }
    await cmdDoctor(options);
    return;
  }

  if (cmd === 'install') {
    if (options.help || sub === 'help') {
      print(usageInstall());
      return;
    }
    await cmdInstall(options);
    return;
  }

  if (cmd === 'agent') {
    if (options.help || sub === 'help') {
      print(usageAgent());
      return;
    }
    await cmdAgent(options);
    return;
  }

  if (cmd === 'send') {
    if (options.help || sub === 'help') {
      print(usageSend());
      return;
    }
    await cmdSend(options);
    return;
  }

  if (cmd === 'channels') {
    if (options.help || sub === 'help') {
      print(usageChannels());
      return;
    }
    if (sub === 'list') {
      await cmdChannelsList(options);
      return;
    }
    if (sub === 'login') {
      const channel = positionals[2];
      await cmdChannelsLogin(channel, options);
      return;
    }
    printErr('Unknown channels subcommand. Use: list|login');
    process.exit(1);
    return;
  }

  if (cmd === 'auth') {
    if (options.help || sub === 'help') {
      print(usageAuth());
      return;
    }
    if (sub === 'login-device') {
      await cmdAuthLoginDevice(options);
      return;
    }
    if (sub === 'set-cookie') {
      const cookie = positionals[2];
      cmdAuthSetCookie(cookie, options);
      return;
    }
    if (sub === 'set-adapter-token') {
      const token = positionals[2];
      cmdAuthSetAdapterToken(token, options);
      return;
    }
    if (sub === 'clear') {
      cmdAuthClear(options);
      return;
    }
    if (sub === 'status') {
      cmdAuthStatus(options);
      return;
    }
    printErr('Unknown auth subcommand. Use: login-device|set-cookie|set-adapter-token|clear|status');
    process.exit(1);
    return;
  }

  if (cmd === 'exit-codes') {
    if (options.help || sub === 'help') {
      print(usageExitCodes());
      return;
    }
    cmdExitCodes(options);
    return;
  }

  if (cmd === 'skills') {
    if (options.help || sub === 'help') {
      print(usageSkills());
      return;
    }
    if (sub === 'list') {
      await cmdSkillsList(options);
      return;
    }
    if (sub === 'install') {
      const slugOrId = positionals[2];
      await cmdSkillsInstall(slugOrId, options);
      return;
    }
    printErr('Unknown skills subcommand. Use: list|install');
    process.exit(1);
    return;
  }

  if (cmd === 'plugins') {
    if (options.help || sub === 'help') {
      print(usagePlugins());
      return;
    }
    if (sub === 'import-openclaw') {
      const manifestUrl = positionals[2];
      await cmdPluginsImportOpenClaw(manifestUrl, options);
      return;
    }
    if (sub === 'import-quarantine') {
      const manifestUrl = positionals[2];
      await cmdPluginsImportQuarantine(manifestUrl, options);
      return;
    }
    if (sub === 'validate') {
      const target = positionals[2];
      await cmdPluginsValidate(target, options);
      return;
    }
    printErr('Unknown plugins subcommand. Use: import-openclaw|import-quarantine|validate');
    process.exit(1);
    return;
  }

  if (cmd === 'approvals') {
    if (options.help || sub === 'help') {
      print(usageApprovals());
      return;
    }
    if (sub === 'list') {
      await cmdApprovalsList(options);
      return;
    }
    if (sub === 'approve') {
      const id = positionals[2];
      if (!id) {
        printErr('Missing approval id. Usage: sven approvals approve <id>');
        process.exit(1);
        return;
      }
      await cmdApprovalsVote(id, 'approve', options);
      return;
    }
    if (sub === 'deny') {
      const id = positionals[2];
      if (!id) {
        printErr('Missing approval id. Usage: sven approvals deny <id>');
        process.exit(1);
        return;
      }
      await cmdApprovalsVote(id, 'deny', options);
      return;
    }
    printErr('Unknown approvals subcommand. Use: list|approve|deny');
    process.exit(1);
    return;
  }

  if (cmd === 'config') {
    if (options.help || sub === 'help') {
      print(usageConfig());
      return;
    }
    if (sub === 'validate') {
      await cmdConfigValidate(options);
      return;
    }
    if (sub === 'print') {
      await cmdConfigPrint(options);
      return;
    }
    if (sub === 'get') {
      const key = positionals[2];
      if (!key) {
        printErr('Missing config key. Usage: sven config get <key>');
        process.exit(1);
        return;
      }
      await cmdConfigGet(key, options);
      return;
    }
    if (sub === 'set') {
      const key = positionals[2];
      const value = positionals[3];
      if (!key || value === undefined) {
        printErr('Missing key/value. Usage: sven config set <key> <value>');
        process.exit(1);
        return;
      }
      await cmdConfigSet(key, value, options);
      return;
    }
    printErr('Unknown config subcommand. Use: get|set');
    process.exit(1);
    return;
  }

  if (cmd === 'pairing') {
    if (options.help || sub === 'help') {
      print(usagePairing());
      return;
    }
    if (sub === 'list') {
      await cmdPairingList(options);
      return;
    }
    if (sub === 'approve') {
      const channel = positionals[2];
      const code = positionals[3];
      await cmdPairingDecision('approve', channel, code, options);
      return;
    }
    if (sub === 'deny') {
      const channel = positionals[2];
      const code = positionals[3];
      await cmdPairingDecision('deny', channel, code, options);
      return;
    }
    printErr('Unknown pairing subcommand. Use: list|approve|deny');
    process.exit(1);
    return;
  }

  if (cmd === 'souls') {
    if (options.help || sub === 'help') {
      print(usageSouls());
      return;
    }
    if (sub === 'list') {
      await cmdSoulsList(options);
      return;
    }
    if (sub === 'install') {
      const slug = positionals[2];
      await cmdSoulsInstall(slug, options);
      return;
    }
    if (sub === 'sign') {
      const slug = positionals[2];
      await cmdSoulsSign(slug, options);
      return;
    }
    if (sub === 'signatures') {
      await cmdSoulsSignatures(options);
      return;
    }
    if (sub === 'publish') {
      const filePath = positionals[2];
      await cmdSoulsPublish(filePath, options);
      return;
    }
    if (sub === 'activate') {
      const installId = positionals[2];
      await cmdSoulsActivate(installId, options);
      return;
    }
    printErr('Unknown souls subcommand. Use: list|install|sign|signatures|publish|activate');
    process.exit(1);
    return;
  }

  if (cmd === 'update') {
    if (options.help || sub === 'help') {
      print(usageUpdate());
      return;
    }
    await cmdUpdate(options);
    return;
  }

  if (cmd === 'security') {
    if (options.help || sub === 'help') {
      print(usageSecurityAudit());
      return;
    }
    if (sub === 'audit') {
      await cmdSecurityAudit(options);
      return;
    }
    printErr('Unknown security subcommand. Use: audit');
    process.exit(1);
    return;
  }

  if (cmd === 'wizard' || cmd === 'onboard') {
    if (options.help || sub === 'help') {
      print(usageWizard());
      return;
    }
    await cmdWizard(options);
    return;
  }

  printErr(`Unknown command: ${cmd}`);
  print(usage());
  process.exit(1);
}

main().catch((err) => {
  printErr(`CLI error: ${String(err)}`);
  process.exit(1);
});
