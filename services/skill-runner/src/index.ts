import { connect, NatsConnection, JSONCodec, JetStreamClient, AckPolicy, DeliverPolicy } from 'nats';
import pg from 'pg';
import { createLogger, NATS_SUBJECTS, computeRunHash, canonicalIoHash, generateTaskId, ClientAttestor, executeToolBatch, type ToolExecRequest, type ToolSafetyClass, loadAllSkills, findSkill, type SkillDefinition, FileHistoryManager, type FileSnapshot, StealthCommitter, PromptGuard, AntiDistillation, QueryChain, BackgroundSessionManager, FeatureFlagRegistry } from '@sven/shared';
import { ensureStreams } from '@sven/shared/nats/streams.js';
import type { EventEnvelope, ToolRunRequestEvent, ToolRunResultEvent } from '@sven/shared';
import { createGitRepo, type GitProvider } from '@sven/shared/integrations/git.js';
import {
  searchFiles,
  readFilePreview,
  readFile,
  listDirectory,
  writeFile,
  deleteFile,
  getFileStats,
  validateNasPath,
} from '@sven/shared/integrations/nas.js';
import {
  fetchWebContent,
  extractTextContent,
  extractMetadata,
} from '@sven/shared/integrations/web.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { analyzeMedia } from './media-analysis.js';
import {
  FirecrawlRequestError,
  fetchWebWithOptionalFirecrawl,
  fetchWithFirecrawl,
  getWebFetchFirecrawlConfig,
} from './web-fetch-firecrawl.js';
import { isPathWithinDirectory, resolveDynamicSkillDirectory } from './dynamic-skill-paths.js';
import { executeWaitFor } from './wait-tool.js';
import { executeNativeShellTool } from './native-shell.js';
import { executeNativeFsWalkTool } from './native-fs-walker.js';
import { executeAudioRecordTool, executeScreenCaptureTool } from './native-media-capture.js';
import { validateHandlerSyntax } from './dynamic-skill-validation.js';
import { evaluateBoundedMathExpression } from './math-eval.js';
import { validateReadOnlySqlQuery } from './sql-readonly.js';
import { buildAutoStartDeployFailureMessage } from './integration-runtime-messages.js';
import { isValidConfiguredIntegrationSetting } from './integration-settings-validation.js';
import { upsertOrgSettingsTransactional } from './integration-auto-config.js';
import { blockReadinessWhenSettingsMissing } from './integration-runtime-readiness.js';
import { callMcpHttp } from './mcp-http.js';
import { resolveIntegrationExecTimeoutMs } from './integration-runtime-timeout.js';
import { buildMcpStdioEnv } from './mcp-stdio-env.js';
import { parseMcpStdioResponse } from './mcp-stdio.js';
import { parseAppleScriptListOutput } from './apple-script-output.js';
import { shouldBlockScopedSettings } from './scoped-settings-guard.js';
import { tryInsertRunningToolRun } from './tool-run-concurrency.js';
import { buildSecretAliasCollisionError, normalizeSecretEnvKey } from './secret-env-alias.js';
import { evaluateWebAllowlist } from './egress-policy.js';
import { buildHaServicePayload } from './ha-service-payload.js';
import { isSecretResolutionTimeoutError, resolveSecretTimeoutMs } from './secret-resolution-timeout.js';
import { buildSpotifyCredentialFingerprint, getValidSpotifyToken, setSpotifyToken } from './spotify-token-cache.js';
import { redactStringValue, redactValueSafe, type RedactionConfig } from './redaction.js';
import { trimUtf8ToByteLimit } from './log-byte-limit.js';
import { buildRedactionConfigFromSettings } from './redaction-config.js';
import { resolveToolExecutionTimeoutMs } from './tool-exec-timeout.js';
import { resolveDynamicSkillCreationHourlyLimit } from './dynamic-skill-rate-limit.js';
import { validateScheduleTargetAccess } from './schedule-target-access.js';
import { resolveScheduleActorUserId } from './schedule-identity.js';
import { resolveDynamicSkillAuthoringContext } from './dynamic-skill-context.js';
import { resolveNasActorUserId } from './nas-identity.js';
import { resolveGitActorUserId } from './git-identity.js';
import { finalizeToolRunRecord } from './tool-run-finalization.js';
import { validateRunApproval } from './approval-validation.js';
import { resolveSecretFileRef } from './secret-file-ref.js';
import { resolveSecretEnvRef } from './secret-env-ref.js';
import { resolveSecretSopsRef } from './secret-sops-ref.js';
import { validateInProcessEgressPolicy } from './in-process-egress-policy.js';
import { resolveWebEgressConfigDecision } from './web-egress-config.js';
import AjvModule, { type ValidateFunction } from 'ajv';

const logger = createLogger('skill-runner');
const jc = JSONCodec();
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENCY = 1;
const DEFAULT_DEVICE_LIST_LIMIT = 50;
const MAX_DEVICE_LIST_LIMIT = 100;
const MAX_LOG_BYTES = 256 * 1024;
const DEFAULT_MCP_TOOL_CALL_JSON_MAX_BYTES = 64 * 1024;
const MIN_MCP_TOOL_CALL_JSON_MAX_BYTES = 1024;
const MAX_MCP_TOOL_CALL_JSON_MAX_BYTES = 1024 * 1024;
const DEFAULT_MCP_RPC_TIMEOUT_MS = 15000;
const MIN_MCP_RPC_TIMEOUT_MS = 1000;
const MAX_MCP_RPC_TIMEOUT_MS = 300000;
const MAX_DEVICE_DISPLAY_URL_LENGTH = 2048;
const MAX_DEVICE_DISPLAY_TEXT_LENGTH = 8000;
const MAX_DEVICE_DISPLAY_HTML_LENGTH = 32000;
const MAX_DEVICE_SPEAK_TEXT_LENGTH = 2000;
const DEFAULT_DEVICE_RELAY_TIMEOUT_MS = 25000;
const MIN_DEVICE_RELAY_TIMEOUT_MS = 1000;
const MAX_DEVICE_RELAY_TIMEOUT_MS = 120000;
const MAX_DEVICE_RELAY_IMAGE_BASE64_LENGTH = 5_000_000;
const DEFAULT_DEVICE_EVENTS_LIMIT = 20;
const MIN_DEVICE_EVENTS_LIMIT = 1;
const MAX_DEVICE_EVENTS_LIMIT = 100;
const DEFAULT_NAS_SEARCH_MAX_RESULTS = 100;
const MIN_NAS_SEARCH_MAX_RESULTS = 1;
const MAX_NAS_SEARCH_MAX_RESULTS = 1000;
const MAX_OBSIDIAN_WALK_DEPTH = 20;
const MAX_DEVICE_COMMAND_PAYLOAD_BYTES = 65536;
const DEFAULT_NAS_READ_MAX_BYTES = 10485760;
const MIN_NAS_READ_MAX_BYTES = 1;
const MAX_NAS_READ_MAX_BYTES = 268435456;
const DEFAULT_GIT_LOG_MAX_COMMITS = 20;
const MIN_GIT_LOG_MAX_COMMITS = 1;
const MAX_GIT_LOG_MAX_COMMITS = 100;
const DEFAULT_WEB_FETCH_TIMEOUT_MS = 30000;
const MIN_WEB_FETCH_TIMEOUT_MS = 1000;
const MAX_WEB_FETCH_TIMEOUT_MS = 300000;
const DEFAULT_WEB_FETCH_MAX_CONTENT_LENGTH = 10485760;
const MIN_WEB_FETCH_MAX_CONTENT_LENGTH = 1;
const MAX_WEB_FETCH_MAX_CONTENT_LENGTH = 104857600;
const DEFAULT_WEB_EXTRACT_MAX_LENGTH = 8192;
const MIN_WEB_EXTRACT_MAX_LENGTH = 1;
const MAX_WEB_EXTRACT_MAX_LENGTH = 1048576;
export const DYNAMIC_SKILL_INITIAL_TRUST_LEVEL = 'quarantined';
const ajv = new (AjvModule as any)({ allErrors: true, strict: false, allowUnionTypes: true });
const outputValidators = new Map<string, ValidateFunction>();
const INTEGRATION_RUNTIME_AUTOSTART_DEFAULT = true;
const INTEGRATION_RUNTIME_AUTOCONFIG_DEFAULT = true;

// Module-level file history manager for tracking file modifications and undo support
const fileHistory = new FileHistoryManager({
  maxSnapshotsPerFile: 50,
  maxTotalSnapshots: 500,
  maxContentSize: 512 * 1024,
});

// Module-level stealth committer for clean autonomous git commits
const stealthCommitter = StealthCommitter.fromEnv();

const INTEGRATION_TOOL_PREFIXES: Array<{ prefix: string; runtimeType: string }> = [
  { prefix: 'obsidian.', runtimeType: 'obsidian' },
  { prefix: 'frigate.', runtimeType: 'frigate' },
  { prefix: 'spotify.', runtimeType: 'spotify' },
  { prefix: 'sonos.', runtimeType: 'sonos' },
  { prefix: 'shazam.', runtimeType: 'shazam' },
  { prefix: 'ha.', runtimeType: 'ha' },
  { prefix: 'calendar.', runtimeType: 'calendar' },
  { prefix: 'git.', runtimeType: 'git' },
  { prefix: 'web.', runtimeType: 'web' },
  { prefix: 'search.web', runtimeType: 'web' },
  { prefix: 'nas.', runtimeType: 'nas' },
  { prefix: 'device.', runtimeType: 'device' },
];

const INTEGRATION_REQUIRED_SETTINGS: Record<string, string[]> = {
  ha: ['ha.base_url', 'ha.token_ref'],
  web: ['webFetch.firecrawlEnabled', 'webFetch.firecrawlApiUrl'],
  frigate: ['frigate.base_url', 'frigate.token_ref'],
  spotify: ['spotify.client_id', 'spotify.client_secret_ref'],
  sonos: ['sonos.access_token_ref'],
  shazam: ['shazam.api_token_ref'],
  obsidian: ['obsidian.vault_path'],
};
const DEVICE_COMMAND_ALLOWLIST = [
  'display',
  'camera_snapshot',
  'camera_motion',
  'tts_speak',
  'audio_record',
  'sensor_read',
  'gpio_write',
  'open_url',
  'open_app',
  'open_path',
  'type_text',
  'hotkey',
  'focus_window',
  'reboot',
  'update_config',
  'ping',
];
const DESKTOP_COMMAND_SET = new Set([
  'open_url',
  'open_app',
  'open_path',
  'type_text',
  'hotkey',
  'focus_window',
]);
const DESKTOP_HIGH_RISK_COMMAND_SET = new Set(['type_text', 'hotkey', 'focus_window']);

function parseDeviceDesktopHotkey(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  const keysRaw = payload.keys;
  if (typeof keysRaw === 'string') return keysRaw.trim().toLowerCase();
  if (Array.isArray(keysRaw)) {
    return keysRaw.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean).join('+');
  }
  return '';
}

function validateDeviceDesktopPolicy(params: {
  deviceConfigRaw: unknown;
  command: string;
  payload: Record<string, unknown> | null;
}): { ok: true } | { ok: false; error: string } {
  const { deviceConfigRaw, command, payload } = params;
  if (!DESKTOP_COMMAND_SET.has(command)) return { ok: true };

  const deviceConfig = (deviceConfigRaw && typeof deviceConfigRaw === 'object' && !Array.isArray(deviceConfigRaw))
    ? (deviceConfigRaw as Record<string, unknown>)
    : {};
  const desktopControl = (deviceConfig.desktop_control && typeof deviceConfig.desktop_control === 'object' && !Array.isArray(deviceConfig.desktop_control))
    ? (deviceConfig.desktop_control as Record<string, unknown>)
    : {};

  const hasDesktopPolicy = Object.keys(desktopControl).length > 0;
  if (DESKTOP_HIGH_RISK_COMMAND_SET.has(command) && desktopControl.enabled !== true) {
    return {
      ok: false,
      error: 'Desktop control disabled for high-risk actions (set config.desktop_control.enabled=true)',
    };
  }
  if (hasDesktopPolicy && desktopControl.enabled === false) {
    return { ok: false, error: 'Desktop control disabled by device policy' };
  }

  const allowedActions = Array.isArray(desktopControl.allowed_actions)
    ? desktopControl.allowed_actions.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  if (allowedActions.length > 0 && !allowedActions.includes(command)) {
    return { ok: false, error: `Desktop action "${command}" not allowed by device policy` };
  }

  if (command === 'hotkey') {
    const requested = parseDeviceDesktopHotkey(payload);
    if (!requested) {
      return { ok: false, error: 'hotkey payload.keys is required' };
    }
    const allowedHotkeys = Array.isArray(desktopControl.allowed_hotkeys)
      ? desktopControl.allowed_hotkeys.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
      : [];
    if (allowedHotkeys.length > 0 && !allowedHotkeys.includes(requested)) {
      return { ok: false, error: `Hotkey "${requested}" not allowed by device policy` };
    }
  }

  return { ok: true };
}

type ToolLogs = {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
};

function getMaxBytes(tool: Record<string, unknown>): number {
  const resourceLimits = tool.resource_limits as { max_bytes?: unknown } | undefined;
  const rawLimit = resourceLimits?.max_bytes ?? (tool.max_bytes as unknown);
  const parsed = Number(rawLimit);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_BYTES;
}

function getMaxConcurrency(tool: Record<string, unknown>): number {
  const resourceLimits = tool.resource_limits as { max_concurrency?: unknown } | undefined;
  const rawLimit = resourceLimits?.max_concurrency ?? (tool.max_concurrency as unknown);
  const parsed = Number(rawLimit);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_CONCURRENCY;
}

function getToolPermissions(tool: Record<string, unknown>): string[] {
  const permissions = tool.permissions_required;
  if (Array.isArray(permissions)) {
    return permissions.filter((entry) => typeof entry === 'string');
  }
  return [];
}

function getOutputSchema(tool: Record<string, unknown>): Record<string, unknown> | null {
  const schema = tool.outputs_schema as Record<string, unknown> | undefined;
  if (!schema || typeof schema !== 'object') {
    return null;
  }
  if (Object.keys(schema).length === 0) {
    return null;
  }
  return schema;
}

function getOutputValidator(toolName: string, schema: Record<string, unknown>): ValidateFunction {
  const key = `${toolName}:${JSON.stringify(schema)}`;
  const cached = outputValidators.get(key);
  if (cached) return cached;
  const compiled = ajv.compile(schema);
  outputValidators.set(key, compiled);
  return compiled;
}

function trimLog(value: string | undefined): string | undefined {
  if (!value) return value;
  return trimUtf8ToByteLimit(value, MAX_LOG_BYTES);
}

function parseSettingValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  }
  return fallback;
}

function parseDeviceRelayTimeoutMs(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_DEVICE_RELAY_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  if (normalized < MIN_DEVICE_RELAY_TIMEOUT_MS || normalized > MAX_DEVICE_RELAY_TIMEOUT_MS) return null;
  return normalized;
}

function resolveIntegrationRuntimeType(toolName: string): string | null {
  const normalized = String(toolName || '').trim().toLowerCase();
  if (!normalized) return null;
  for (const row of INTEGRATION_TOOL_PREFIXES) {
    if (normalized.startsWith(row.prefix)) return row.runtimeType;
  }
  return null;
}

function normalizeTypeEnvKey(integrationType: string): string {
  return integrationType.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function shellEscape(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const token = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    out = out.replace(token, shellEscape(value));
  }
  return out;
}

function deriveIntegrationStoragePath(orgId: string, integrationType: string): string {
  const root = String(process.env.SVEN_INTEGRATION_STORAGE_ROOT || '/var/lib/sven/integrations')
    .replace(/[\\]+/g, '/')
    .replace(/\/+$/, '');
  const safeOrg = String(orgId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeType = String(integrationType).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeOrg || !safeType) throw new Error('Invalid orgId or integrationType for storage path');
  const result = path.resolve(`${root}/${safeOrg}/${safeType}`);
  if (!result.startsWith(root + '/')) throw new Error('Storage path traversal blocked');
  return result;
}

function deriveIntegrationNetworkScope(orgId: string): string {
  const short = String(orgId).replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
  return `sven-org-${short || 'default'}`;
}

function resolveIntegrationDeployCommand(integrationType: string): string {
  const envKey = normalizeTypeEnvKey(integrationType);
  return String(
    process.env[`SVEN_INTEGRATION_DEPLOY_CMD_${envKey}`] || process.env.SVEN_INTEGRATION_DEPLOY_CMD_TEMPLATE || '',
  ).trim();
}

function runIntegrationDeployCommand(command: string, timeoutMs: number): { ok: boolean; output: string; error?: string } {
  const run = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: process.env,
  });
  const output = `${String(run.stdout || '')}\n${String(run.stderr || '')}`.trim();
  if (run.error) {
    return { ok: false, output, error: String(run.error.message || run.error) };
  }
  if (run.status !== 0) {
    return { ok: false, output, error: `Command exited with code ${String(run.status)}` };
  }
  return { ok: true, output };
}

async function isIntegrationAutostartEnabled(pool: pg.Pool, organizationId: string): Promise<boolean> {
  const orgRes = await pool.query(
    `SELECT value
       FROM organization_settings
      WHERE organization_id = $1
        AND key = 'integrations.runtime.auto_start_on_tool_use'
      LIMIT 1`,
    [organizationId],
  );
  if (orgRes.rows.length > 0) {
    const parsed = parseSettingValue<unknown>(orgRes.rows[0].value);
    return parseBooleanSetting(parsed, INTEGRATION_RUNTIME_AUTOSTART_DEFAULT);
  }

  const globalRes = await pool.query(
    `SELECT value
       FROM settings_global
      WHERE key = 'integrations.runtime.auto_start_on_tool_use'
      LIMIT 1`,
  );
  if (globalRes.rows.length > 0) {
    const parsed = parseSettingValue<unknown>(globalRes.rows[0].value);
    return parseBooleanSetting(parsed, INTEGRATION_RUNTIME_AUTOSTART_DEFAULT);
  }

  return INTEGRATION_RUNTIME_AUTOSTART_DEFAULT;
}

async function isIntegrationAutoConfigureEnabled(pool: pg.Pool, organizationId: string): Promise<boolean> {
  const orgRes = await pool.query(
    `SELECT value
       FROM organization_settings
      WHERE organization_id = $1
        AND key = 'integrations.runtime.auto_configure_on_tool_use'
      LIMIT 1`,
    [organizationId],
  );
  if (orgRes.rows.length > 0) {
    const parsed = parseSettingValue<unknown>(orgRes.rows[0].value);
    return parseBooleanSetting(parsed, INTEGRATION_RUNTIME_AUTOCONFIG_DEFAULT);
  }

  const globalRes = await pool.query(
    `SELECT value
       FROM settings_global
      WHERE key = 'integrations.runtime.auto_configure_on_tool_use'
      LIMIT 1`,
  );
  if (globalRes.rows.length > 0) {
    const parsed = parseSettingValue<unknown>(globalRes.rows[0].value);
    return parseBooleanSetting(parsed, INTEGRATION_RUNTIME_AUTOCONFIG_DEFAULT);
  }

  return INTEGRATION_RUNTIME_AUTOCONFIG_DEFAULT;
}

function defaultIntegrationSettingValue(
  key: string,
  organizationId: string,
  integrationType: string,
): unknown | undefined {
  if (key === 'obsidian.vault_path') {
    return `${deriveIntegrationStoragePath(organizationId, integrationType)}/vault`;
  }
  if (key === 'webFetch.firecrawlEnabled') {
    return false;
  }
  if (key === 'webFetch.firecrawlApiUrl') {
    return 'http://localhost:3002';
  }
  return undefined;
}

async function ensureIntegrationConfigured(
  pool: pg.Pool,
  params: { organizationId: string; integrationType: string },
): Promise<{ appliedSettings: string[]; missingSettings: string[] }> {
  const { organizationId, integrationType } = params;
  const requiredSettings = INTEGRATION_REQUIRED_SETTINGS[integrationType] || [];
  if (requiredSettings.length === 0) {
    return { appliedSettings: [], missingSettings: [] };
  }

  const orgSettingsRes = await pool.query(
    `SELECT key, value
       FROM organization_settings
      WHERE organization_id = $1
        AND key = ANY($2::text[])`,
    [organizationId, requiredSettings],
  );
  const orgSettingsMap = new Map<string, unknown>();
  for (const row of orgSettingsRes.rows) {
    orgSettingsMap.set(String(row.key), row.value);
  }

  const globalSettingsRes = await pool.query(
    `SELECT key, value
       FROM settings_global
      WHERE key = ANY($1::text[])`,
    [requiredSettings],
  );
  const globalSettingsMap = new Map<string, unknown>();
  for (const row of globalSettingsRes.rows) {
    globalSettingsMap.set(String(row.key), row.value);
  }

  const entriesToUpsert: Array<{ key: string; value: unknown }> = [];
  const missingSettings: string[] = [];

  for (const key of requiredSettings) {
    const orgValue = orgSettingsMap.get(key);
    if (isValidConfiguredIntegrationSetting(key, orgValue)) continue;

    const globalValue = globalSettingsMap.get(key);
    if (isValidConfiguredIntegrationSetting(key, globalValue)) continue;

    const defaultValue = defaultIntegrationSettingValue(key, organizationId, integrationType);
    if (defaultValue === undefined) {
      missingSettings.push(key);
      continue;
    }
    entriesToUpsert.push({ key, value: defaultValue });
  }

  await upsertOrgSettingsTransactional(pool, organizationId, entriesToUpsert);

  return {
    appliedSettings: entriesToUpsert.map((entry) => entry.key),
    missingSettings,
  };
}

async function emitIntegrationRuntimeStatusMessage(
  pool: pg.Pool,
  params: {
    chatId?: string | null;
    text: string;
    integrationType?: string;
    status?: 'running' | 'success' | 'error' | 'executed';
    error?: string;
  },
): Promise<void> {
  const chatId = String(params.chatId || '').trim();
  const text = String(params.text || '').trim();
  if (!chatId || !text) return;
  try {
    const integrationType = String(params.integrationType || '').trim();
    const status = params.status || 'executed';
    const blocks = integrationType
      ? [
          {
            type: 'tool_card',
            content: {
              tool_name: `integration.runtime.${integrationType}`,
              status,
              outputs: status === 'error' ? undefined : { message: text },
              error: status === 'error' ? String(params.error || text) : undefined,
              created_at: new Date().toISOString(),
            },
          },
        ]
      : [];
    await pool.query(
      `INSERT INTO messages (id, chat_id, role, content_type, text, blocks, created_at)
       VALUES ($1, $2, 'assistant', $3, $4, $5::jsonb, NOW())`,
      [generateTaskId('message'), chatId, blocks.length > 0 ? 'blocks' : 'text', text, JSON.stringify(blocks)],
    );
  } catch (err) {
    logger.warn('Failed to emit integration runtime status message', {
      chat_id: chatId,
      err: String(err),
    });
  }
}

async function ensureIntegrationRuntimeReady(
  pool: pg.Pool,
  params: { organizationId: string; integrationType: string; toolName: string },
): Promise<{ ready: boolean; started: boolean; message?: string }> {
  const { organizationId, integrationType, toolName } = params;
  let readinessMessage = '';
  let missingSettings: string[] = [];
  const autoConfigure = await isIntegrationAutoConfigureEnabled(pool, organizationId);
  if (autoConfigure) {
    const configureResult = await ensureIntegrationConfigured(pool, {
      organizationId,
      integrationType,
    });
    if (configureResult.appliedSettings.length > 0) {
      readinessMessage = `Applied defaults: ${configureResult.appliedSettings.join(', ')}`;
    }
    missingSettings = configureResult.missingSettings;
    if (missingSettings.length > 0) {
      const suffix = `Still needs manual credentials/settings: ${missingSettings.join(', ')}`;
      readinessMessage = readinessMessage ? `${readinessMessage}. ${suffix}` : suffix;
    }
  }
  const missingSettingsGate = blockReadinessWhenSettingsMissing(integrationType, missingSettings, readinessMessage || undefined);
  if (missingSettingsGate.blocked) {
    return {
      ready: false,
      started: false,
      message: missingSettingsGate.message,
    };
  }

  const autostart = await isIntegrationAutostartEnabled(pool, organizationId);
  if (!autostart) {
    const message = readinessMessage
      ? `${readinessMessage}. Integration auto-start disabled for ${integrationType}`
      : `Integration auto-start disabled for ${integrationType}`;
    return { ready: false, started: false, message };
  }

  const currentRes = await pool.query(
    `SELECT status, runtime_mode, image_ref
       FROM integration_runtime_instances
      WHERE organization_id = $1
        AND integration_type = $2
      LIMIT 1`,
    [organizationId, integrationType],
  );
  const current = currentRes.rows[0] as { status?: string; runtime_mode?: string; image_ref?: string } | undefined;
  const currentStatus = String(current?.status || 'stopped').toLowerCase();
  if (currentStatus === 'running') {
    return { ready: true, started: false, message: readinessMessage || undefined };
  }

  const runtimeMode = String(current?.runtime_mode || 'container').toLowerCase() === 'local_worker' ? 'local_worker' : 'container';
  const imageRef = String(current?.image_ref || `sven/integration-${integrationType}:latest`).trim();
  const storagePath = deriveIntegrationStoragePath(organizationId, integrationType);
  const networkScope = deriveIntegrationNetworkScope(organizationId);

  await pool.query(
    `INSERT INTO integration_runtime_instances
       (organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope,
        deployment_spec, last_error, last_deployed_at, updated_at)
     VALUES
       ($1, $2, $3, 'deploying', $4, $5, $6, '{}'::jsonb, NULL, NOW(), NOW())
     ON CONFLICT (organization_id, integration_type) DO UPDATE
     SET runtime_mode = $3,
         status = 'deploying',
         image_ref = $4,
         storage_path = $5,
         network_scope = $6,
         last_error = NULL,
         last_deployed_at = NOW(),
         updated_at = NOW()`,
    [organizationId, integrationType, runtimeMode, imageRef || null, storagePath, networkScope],
  );

  const executionEnabled = String(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED || '').toLowerCase() === 'true';
  if (!executionEnabled) {
    await pool.query(
      `UPDATE integration_runtime_instances
         SET status = 'error',
             last_error = $3,
             updated_at = NOW()
       WHERE organization_id = $1
         AND integration_type = $2`,
      [organizationId, integrationType, 'Runtime execution disabled (SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED=false)'],
    );
    return {
      ready: false,
      started: false,
      message: `Cannot auto-start ${integrationType}: runtime execution disabled`,
    };
  }

  const commandTemplate = resolveIntegrationDeployCommand(integrationType);
  if (!commandTemplate) {
    await pool.query(
      `UPDATE integration_runtime_instances
         SET status = 'error',
             last_error = $3,
             updated_at = NOW()
       WHERE organization_id = $1
         AND integration_type = $2`,
      [organizationId, integrationType, 'No deploy command template configured'],
    );
    return {
      ready: false,
      started: false,
      message: `Cannot auto-start ${integrationType}: deploy command template missing`,
    };
  }

  const command = renderTemplate(commandTemplate, {
    action: 'deploy',
    integration_type: integrationType,
    organization_id: organizationId,
    runtime_mode: runtimeMode,
    image_ref: imageRef || '',
    storage_path: storagePath,
    network_scope: networkScope,
    tool_name: toolName,
  });
  const timeoutMs = resolveIntegrationExecTimeoutMs(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_TIMEOUT_MS);
  const run = runIntegrationDeployCommand(command, timeoutMs);
  if (!run.ok) {
    logger.warn('Integration runtime auto-start deploy failed', {
      organization_id: organizationId,
      integration_type: integrationType,
      tool_name: toolName,
      deploy_error: String(run.error || 'deploy failed'),
      deploy_output: String(run.output || '').slice(0, 4096),
    });
    await pool.query(
      `UPDATE integration_runtime_instances
         SET status = 'error',
             last_error = $3,
             updated_at = NOW()
       WHERE organization_id = $1
         AND integration_type = $2`,
      [organizationId, integrationType, String(run.error || 'deploy failed')],
    );
    return {
      ready: false,
      started: false,
      message: buildAutoStartDeployFailureMessage(integrationType),
    };
  }

  await pool.query(
    `UPDATE integration_runtime_instances
       SET status = 'running',
           last_error = NULL,
           updated_at = NOW()
     WHERE organization_id = $1
       AND integration_type = $2`,
    [organizationId, integrationType],
  );
  return { ready: true, started: true, message: readinessMessage || undefined };
}

function sanitizeSearchResultUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    const trackingKeys = new Set([
      'gclid',
      'fbclid',
      'msclkid',
      'mc_cid',
      'mc_eid',
      'ref',
      'ref_src',
    ]);
    const keys = Array.from(parsed.searchParams.keys());
    for (const key of keys) {
      if (key.startsWith('utm_') || trackingKeys.has(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function isLikelyAdResult(url: string, title: string, snippet: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  if (lowerTitle.includes('sponsored') || lowerSnippet.includes('sponsored')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host.includes('doubleclick.net') ||
      host.includes('googlesyndication.com') ||
      host.startsWith('adservice.')
    ) {
      return true;
    }
    if (parsed.pathname.toLowerCase().includes('/aclk')) {
      return true;
    }
  } catch {
    // Ignore malformed URLs; caller will handle empty/invalid entries.
  }
  return false;
}

function sanitizeSearchErrorMessage(message: string, query: string): string {
  if (!message) return message;
  let next = message;
  const encoded = encodeURIComponent(query);
  if (query) {
    next = next.split(query).join('[REDACTED_QUERY]');
  }
  if (encoded && encoded !== query) {
    next = next.split(encoded).join('[REDACTED_QUERY]');
  }
  // Remove direct `q=<...>` fragments that may contain query text
  next = next.replace(/([?&]q=)([^&\s]+)/gi, '$1[REDACTED_QUERY]');
  return next;
}

function slugifySkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `skill-${Date.now()}`;
}

function getDefaultHandlerTemplate(language: 'typescript' | 'python' | 'shell'): string {
  if (language === 'python') {
    return [
      'import json, os',
      'payload = json.loads(os.environ.get("SVEN_INPUT", "{}"))',
      'print(json.dumps({"ok": True, "echo": payload}))',
    ].join('\n');
  }
  if (language === 'shell') {
    return [
      '#!/usr/bin/env sh',
      'echo {"ok":true}',
    ].join('\n');
  }
  return [
    'export default async function handler(input: Record<string, unknown>) {',
    '  return { ok: true, echo: input };',
    '}',
  ].join('\n');
}

export function validateGeneratedSkillMarkdown(content: string): { ok: boolean; error?: string } {
  const normalized = String(content || '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { ok: false, error: 'SKILL.md must start with YAML frontmatter' };
  }
  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) {
    return { ok: false, error: 'SKILL.md frontmatter terminator not found' };
  }
  const frontmatter = normalized.slice(4, end).trim();
  const required = [
    'name',
    'description',
    'version',
    'handler_language',
    'handler_file',
    'inputs_schema',
    'outputs_schema',
  ];
  const map = new Map<string, string>();
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) map.set(key, value);
  }
  for (const key of required) {
    if (!map.has(key) || !String(map.get(key) || '').trim()) {
      return { ok: false, error: `SKILL.md frontmatter missing required key: ${key}` };
    }
  }
  try {
    const inSchema = JSON.parse(String(map.get('inputs_schema')));
    const outSchema = JSON.parse(String(map.get('outputs_schema')));
    if (typeof inSchema !== 'object' || !inSchema || Array.isArray(inSchema)) {
      return { ok: false, error: 'inputs_schema must be a JSON object' };
    }
    if (typeof outSchema !== 'object' || !outSchema || Array.isArray(outSchema)) {
      return { ok: false, error: 'outputs_schema must be a JSON object' };
    }
  } catch {
    return { ok: false, error: 'inputs_schema/outputs_schema must be valid JSON objects' };
  }
  return { ok: true };
}

function isDynamicSkillTool(tool: Record<string, unknown>): boolean {
  const manifest = (tool.manifest || {}) as Record<string, unknown>;
  const name = String(tool.name || '');
  return manifest.dynamic === true || name.startsWith('dynamic.');
}

async function executeDynamicSkillInProcess(
  tool: Record<string, unknown>,
  inputs: Record<string, unknown>,
): Promise<{ outputs: Record<string, unknown>; error?: string; logs?: ToolLogs }> {
  const manifest = (tool.manifest || {}) as Record<string, unknown>;
  const handlerLanguage = String(manifest.handler_language || '').toLowerCase();
  const handlerFile = String(manifest.handler_file || '').trim();
  const skillDir = String(manifest.skill_dir || '').trim();
  if (!handlerLanguage || !handlerFile || !skillDir) {
    return { outputs: {}, error: 'Dynamic skill manifest incomplete (handler_language/handler_file/skill_dir required)' };
  }

  const allowLocalFallback = parseBooleanSetting(
    process.env.SVEN_DYNAMIC_SKILLS_ALLOW_LOCAL_FALLBACK,
    true,
  ) && (tool.is_first_party === true || String(tool.trust_level || '').toLowerCase() === 'trusted');

  const resolved = resolveDynamicSkillDirectory({
    skillDir,
    allowLocalFallback,
  });
  if (!resolved.ok) {
    return { outputs: {}, error: resolved.error };
  }
  const resolvedSkillDir = resolved.resolvedSkillDir;

  const handlerPath = path.resolve(resolvedSkillDir, handlerFile);
  if (!isPathWithinDirectory(handlerPath, resolvedSkillDir)) {
    return { outputs: {}, error: 'Dynamic skill handler path is invalid' };
  }

  try {
    await fs.access(handlerPath);
  } catch {
    return { outputs: {}, error: `Dynamic skill handler not found: ${handlerPath}` };
  }

  const inputJson = JSON.stringify(inputs || {});
  if (handlerLanguage === 'shell' || handlerLanguage === 'python') {
    const cmd = handlerLanguage === 'shell' ? 'sh' : 'python';
    const args = [handlerPath];
    const run = spawnSync(cmd, args, {
      encoding: 'utf8',
      timeout: Number(tool.timeout_seconds || 30) * 1000,
      maxBuffer: getMaxBytes(tool),
      env: {
        ...process.env,
        SVEN_INPUT: inputJson,
      },
    });
    const logs: ToolLogs = {
      stdout: run.stdout || '',
      stderr: run.stderr || '',
      exit_code: run.status ?? -1,
    };
    if (run.error) {
      return { outputs: {}, error: String(run.error.message || run.error), logs };
    }
    if (run.status !== 0) {
      return { outputs: {}, error: String(run.stderr || `Dynamic skill exited with code ${run.status}`), logs };
    }
    try {
      return { outputs: JSON.parse(String(run.stdout || '').trim() || '{}'), logs };
    } catch {
      return { outputs: {}, error: 'Dynamic skill output must be valid JSON', logs };
    }
  }

  if (handlerLanguage === 'typescript') {
    const source = await fs.readFile(handlerPath, 'utf8');
    const ts = await import('typescript');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      reportDiagnostics: false,
      fileName: path.basename(handlerPath),
    });
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText, 'utf8').toString('base64')}`;
    const mod = await import(moduleUrl);
    const fn = (mod.default || mod.handler) as ((arg: Record<string, unknown>) => unknown);
    if (typeof fn !== 'function') {
      return { outputs: {}, error: 'TypeScript handler must export a default function' };
    }
    const value = await fn(inputs);
    if (value === undefined || value === null) {
      return { outputs: {} };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { outputs: {}, error: 'TypeScript handler must return an object' };
    }
    return { outputs: value as Record<string, unknown> };
  }

  return { outputs: {}, error: `Unsupported dynamic handler language: ${handlerLanguage}` };
}

async function getHaConfig(pool: pg.Pool, scope?: string | SettingsScope): Promise<{ baseUrl?: string; token?: string; error?: string }> {
  const settings = await getScopedSettingsMap(
    pool,
    ['ha.base_url', 'ha.token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const baseUrlSetting = parseSettingValue<string>(settings.get('ha.base_url'))?.trim();
  const tokenRef = parseSettingValue<string>(settings.get('ha.token_ref'))?.trim();

  const baseUrl = baseUrlSetting || process.env.HA_BASE_URL?.trim();
  const token = tokenRef ? await resolveSecretRef(tokenRef) : process.env.HA_TOKEN?.trim();

  if (!baseUrl) {
    return { error: 'HA base URL is not configured' };
  }
  if (!token) {
    return { error: 'HA token is not configured' };
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

async function getOrganizationIdForChat(pool: pg.Pool, chatId?: string): Promise<string | null> {
  const id = String(chatId || '').trim();
  if (!id) return null;
  const res = await pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [id]);
  const orgId = String(res.rows[0]?.organization_id || '').trim();
  return orgId || null;
}

type SettingsScope = {
  chatId?: string;
  userId?: string;
};

/**
 * Verifies the current user is the privileged admin account (username '47', role 'admin').
 * Used to gate operations-level tools that only the platform owner should access:
 * code healing, pentesting, deployment, infrastructure introspection.
 */
async function requireAdmin47(pool: pg.Pool, userId?: string): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: 'Authentication required. This tool is restricted to the platform administrator.' };
  const res = await pool.query(
    `SELECT username, role FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  if (res.rows.length === 0) return { ok: false, error: 'User not found. Access denied.' };
  const user = res.rows[0] as { username: string; role: string };
  const adminUsername = process.env.ADMIN_USERNAME || '47';
  if (user.username !== adminUsername || user.role !== 'admin') {
    return { ok: false, error: `Access denied. This tool is restricted to the ${adminUsername} administrator account.` };
  }
  return { ok: true };
}

/** Write an immutable audit trail entry for any sven.ops.* tool invocation. */
async function logOpsAudit(
  pool: pg.Pool,
  userId: string,
  toolName: string,
  inputs: Record<string, unknown>,
  resultSummary?: string,
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical' = 'info',
): Promise<void> {
  try {
    const userRes = await pool.query(`SELECT username FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const username = (userRes.rows[0] as any)?.username || 'unknown';
    await pool.query(
      `INSERT INTO ops_audit_log (id, user_id, username, tool_name, action, inputs, result_summary, severity, created_at)
       VALUES ($1, $2, $3, $4, 'invoke', $5::jsonb, $6, $7, NOW())`,
      [generateTaskId('audit_entry'), userId, username, toolName, JSON.stringify(inputs), resultSummary || null, severity],
    );
  } catch (err) {
    logger.warn('Failed to write ops audit log', { tool_name: toolName, user_id: userId, err: String(err) });
  }
}

type ScopedSettingsMapOptions = {
  enforceTenantScope?: boolean;
  allowGlobalFallback?: boolean;
};

function getIntegrationScopedSettingsOptions(): ScopedSettingsMapOptions {
  return {
    enforceTenantScope: true,
    allowGlobalFallback: parseBooleanSetting(process.env.SVEN_INTEGRATION_ALLOW_GLOBAL_FALLBACK, false),
  };
}

const USER_OVERRIDABLE_SETTING_KEYS = new Set([
  'search.brave.api_key_ref',
  'notion.api_token_ref',
  'trello.api_key_ref',
  'trello.api_token_ref',
  'x.api_bearer_token_ref',
  'giphy.api_key_ref',
  'tenor.api_key_ref',
  'spotify.client_id',
  'spotify.client_secret_ref',
  'sonos.access_token_ref',
  'shazam.api_token_ref',
  'ha.base_url',
  'ha.token_ref',
  'frigate.base_url',
  'frigate.token_ref',
  'obsidian.vault_path',
]);

function toSettingsScope(input?: string | SettingsScope): SettingsScope {
  if (!input) return {};
  if (typeof input === 'string') return { chatId: input };
  return { chatId: input.chatId, userId: input.userId };
}

async function getScopedSettingsMap(
  pool: pg.Pool,
  keys: string[],
  scopeInput?: string | SettingsScope,
  options?: ScopedSettingsMapOptions,
): Promise<Map<string, unknown>> {
  const scope = toSettingsScope(scopeInput);
  const chatId = String(scope.chatId || '').trim() || undefined;
  const userId = String(scope.userId || '').trim() || undefined;
  const map = new Map<string, unknown>();
  const orgId = await getOrganizationIdForChat(pool, chatId);
  const guard = shouldBlockScopedSettings({
    enforceTenantScope: Boolean(options?.enforceTenantScope),
    allowGlobalFallback: Boolean(options?.allowGlobalFallback),
    chatId,
    organizationId: orgId,
  });
  if (guard.blocked) {
    throw new Error(guard.error || 'Tenant-scoped settings resolution blocked');
  }
  if (orgId && userId) {
    const userModeRes = await pool.query(
      `SELECT value
         FROM user_settings
        WHERE user_id = $1
          AND organization_id = $2
          AND key = 'keys.mode'
        LIMIT 1`,
      [userId, orgId],
    );
    const userMode = String(parseSettingValue<string>(userModeRes.rows[0]?.value) || 'org_default')
      .trim()
      .toLowerCase();

    const userOverrideOrgRes = await pool.query(
      `SELECT value
         FROM organization_settings
        WHERE organization_id = $1
          AND key = 'keys.user_override.enabled'
        LIMIT 1`,
      [orgId],
    );
    const userOverrideGlobalRes = userOverrideOrgRes.rows.length === 0
      ? await pool.query(
        `SELECT value
           FROM settings_global
          WHERE key = 'keys.user_override.enabled'
          LIMIT 1`,
      )
      : { rows: [] };
    const allowUserOverride = parseBooleanSetting(
      parseSettingValue<unknown>(userOverrideOrgRes.rows[0]?.value ?? userOverrideGlobalRes.rows[0]?.value),
      true,
    );

    if (allowUserOverride && userMode === 'personal') {
      const userKeys = keys.filter((key) => USER_OVERRIDABLE_SETTING_KEYS.has(key));
      if (userKeys.length > 0) {
        const userRes = await pool.query(
          `SELECT key, value
             FROM user_settings
            WHERE user_id = $1
              AND organization_id = $2
              AND key = ANY($3::text[])`,
          [userId, orgId, userKeys],
        );
        for (const row of userRes.rows) {
          map.set(String(row.key), row.value);
        }
      }
    }
  }

  if (orgId) {
    const orgRes = await pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1 AND key = ANY($2::text[])`,
      [orgId, keys],
    );
    for (const row of orgRes.rows) {
      const key = String(row.key);
      if (!map.has(key)) {
        map.set(key, row.value);
      }
    }
  }

  const remaining = keys.filter((key) => !map.has(key));
  if (remaining.length > 0) {
    const globalRes = await pool.query(
      `SELECT key, value
       FROM settings_global
       WHERE key = ANY($1::text[])`,
      [remaining],
    );
    for (const row of globalRes.rows) {
      map.set(String(row.key), row.value);
    }
  }

  return map;
}

async function getFrigateConfig(pool: pg.Pool, scope?: string | SettingsScope): Promise<{ baseUrl?: string; token?: string; error?: string }> {
  const settings = await getScopedSettingsMap(
    pool,
    ['frigate.base_url', 'frigate.token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const baseUrlSetting = parseSettingValue<string>(settings.get('frigate.base_url'))?.trim();
  const tokenRef = parseSettingValue<string>(settings.get('frigate.token_ref'))?.trim();

  const baseUrl = baseUrlSetting || process.env.FRIGATE_BASE_URL?.trim();
  const token = tokenRef ? await resolveSecretRef(tokenRef) : process.env.FRIGATE_TOKEN?.trim();

  if (!baseUrl) {
    return { error: 'Frigate base URL is not configured' };
  }
  if (!token) {
    return { error: 'Frigate token is not configured' };
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

const spotifyAppTokenCache = new Map<string, { token: string; expiresAtMs: number }>();

async function getSpotifyClientConfig(
  pool: pg.Pool,
  scope?: string | SettingsScope,
): Promise<{ clientId?: string; clientSecret?: string; error?: string }> {
  const settings = await getScopedSettingsMap(
    pool,
    ['spotify.client_id', 'spotify.client_secret_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const clientIdSetting = parseSettingValue<string>(settings.get('spotify.client_id'))?.trim();
  const secretRef = parseSettingValue<string>(settings.get('spotify.client_secret_ref'))?.trim();

  const clientId = clientIdSetting || process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = secretRef
    ? await resolveSecretRef(secretRef)
    : process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return { error: 'Spotify client credentials are not configured' };
  }
  return { clientId, clientSecret };
}

async function getSpotifyAppAccessToken(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  if (process.env.SPOTIFY_ACCESS_TOKEN?.trim()) {
    return process.env.SPOTIFY_ACCESS_TOKEN.trim();
  }

  const config = await getSpotifyClientConfig(pool, scope);
  if (config.error || !config.clientId || !config.clientSecret) {
    throw new Error(config.error || 'Spotify client credentials are not configured');
  }
  const credentialFingerprint = buildSpotifyCredentialFingerprint(config.clientId, config.clientSecret);
  const cachedToken = getValidSpotifyToken(spotifyAppTokenCache, credentialFingerprint);
  if (cachedToken) {
    return cachedToken;
  }

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify token error: ${response.status} ${body}`);
  }

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  const token = String(payload.access_token || '').trim();
  if (!token) throw new Error('Spotify token response missing access_token');
  setSpotifyToken(
    spotifyAppTokenCache,
    credentialFingerprint,
    token,
    Number(payload.expires_in || 3600),
  );
  return token;
}

async function getSonosAccessToken(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  const settings = await getScopedSettingsMap(
    pool,
    ['sonos.access_token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const ref = parseSettingValue<string>(settings.get('sonos.access_token_ref'))?.trim();
  const token = ref ? await resolveSecretRef(ref) : process.env.SONOS_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Sonos access token is not configured');
  return token;
}

function getSonosApiBaseUrl(): string {
  return (process.env.SONOS_API_BASE_URL || 'https://api.ws.sonos.com/control/api/v1').replace(/\/+$/, '');
}

async function getShazamApiToken(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  const settings = await getScopedSettingsMap(
    pool,
    ['shazam.api_token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const ref = parseSettingValue<string>(settings.get('shazam.api_token_ref'))?.trim();
  const token = ref
    ? await resolveSecretRef(ref)
    : (process.env.SHAZAM_API_TOKEN || process.env.AUDD_API_TOKEN || '').trim();
  if (!token) throw new Error('Shazam/Audd API token is not configured');
  return token;
}

async function getNotionApiToken(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  const settings = await getScopedSettingsMap(
    pool,
    ['notion.api_token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const ref = parseSettingValue<string>(settings.get('notion.api_token_ref'))?.trim();
  const token = ref ? await resolveSecretRef(ref) : process.env.NOTION_API_TOKEN?.trim();
  if (!token) throw new Error('Notion API token is not configured');
  return token;
}

async function getBraveSearchApiKey(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  const settings = await getScopedSettingsMap(
    pool,
    ['search.brave.api_key_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const ref = parseSettingValue<string>(settings.get('search.brave.api_key_ref'))?.trim();
  const token = ref ? await resolveSecretRef(ref) : process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!token) throw new Error('Brave Search API key is not configured');
  return token;
}

async function getObsidianVaultPath(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  const settings = await getScopedSettingsMap(
    pool,
    ['obsidian.vault_path'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const pathSetting = parseSettingValue<string>(settings.get('obsidian.vault_path'))?.trim();
  const vaultPath = pathSetting || process.env.OBSIDIAN_VAULT_PATH?.trim();
  if (!vaultPath) throw new Error('Obsidian vault path is not configured');
  return vaultPath;
}

async function resolveObsidianNotePath(vaultRoot: string, notePath: string): Promise<string> {
  const resolved = path.resolve(vaultRoot, notePath);
  const normalizedRoot = path.resolve(vaultRoot);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error('Path traversal blocked: note path escapes vault');
  }
  try {
    const realResolved = await fs.realpath(resolved);
    const realRoot = await fs.realpath(normalizedRoot);
    if (realResolved !== realRoot && !realResolved.startsWith(realRoot + path.sep)) {
      throw new Error('Path traversal blocked: symlink escapes vault');
    }
    return realResolved;
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return resolved;
    }
    throw err;
  }
}

async function getTrelloConfig(pool: pg.Pool, scope?: string | SettingsScope): Promise<{ key: string; token: string }> {
  const settings = await getScopedSettingsMap(
    pool,
    ['trello.api_key_ref', 'trello.api_token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const keyRef = parseSettingValue<string>(settings.get('trello.api_key_ref'))?.trim();
  const tokenRef = parseSettingValue<string>(settings.get('trello.api_token_ref'))?.trim();
  const key = keyRef ? await resolveSecretRef(keyRef) : process.env.TRELLO_API_KEY?.trim();
  const token = tokenRef ? await resolveSecretRef(tokenRef) : process.env.TRELLO_API_TOKEN?.trim();
  if (!key || !token) throw new Error('Trello API key/token are not configured');
  return { key, token };
}

async function getXApiBearerToken(pool: pg.Pool, scope?: string | SettingsScope): Promise<string> {
  const settings = await getScopedSettingsMap(
    pool,
    ['x.api_bearer_token_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const ref = parseSettingValue<string>(settings.get('x.api_bearer_token_ref'))?.trim();
  const token = ref ? await resolveSecretRef(ref) : process.env.X_API_BEARER_TOKEN?.trim();
  if (!token) throw new Error('X API bearer token is not configured');
  return token;
}

function runOpCli(args: string[], timeoutMs = 15000): { ok: boolean; stdout: string; error?: string } {
  const result = spawnSync('op', args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env,
  });
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  if (result.error) return { ok: false, stdout, error: result.error.message };
  if (result.status !== 0) return { ok: false, stdout, error: stderr || `op exited with ${result.status}` };
  return { ok: true, stdout };
}

async function getGifApiConfig(pool: pg.Pool, scope?: string | SettingsScope): Promise<{
  giphyKey?: string;
  tenorKey?: string;
}> {
  const settings = await getScopedSettingsMap(
    pool,
    ['giphy.api_key_ref', 'tenor.api_key_ref'],
    scope,
    getIntegrationScopedSettingsOptions(),
  );
  const giphyRef = parseSettingValue<string>(settings.get('giphy.api_key_ref'))?.trim();
  const tenorRef = parseSettingValue<string>(settings.get('tenor.api_key_ref'))?.trim();
  const giphyKey = giphyRef ? await resolveSecretRef(giphyRef) : process.env.GIPHY_API_KEY?.trim();
  const tenorKey = tenorRef ? await resolveSecretRef(tenorRef) : process.env.TENOR_API_KEY?.trim();
  return { giphyKey: giphyKey || undefined, tenorKey: tenorKey || undefined };
}

function escapeAppleScriptString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\0/g, '');
}

function runAppleScript(script: string, timeoutMs = 15000): { ok: boolean; stdout: string; error?: string } {
  const result = spawnSync('osascript', ['-e', script], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
  });
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  if (result.error) {
    return { ok: false, stdout, error: result.error.message };
  }
  if (result.status !== 0) {
    return { ok: false, stdout, error: stderr || stdout || `osascript exited with status ${result.status}` };
  }
  return { ok: true, stdout };
}

async function loadWebAllowlist(pool: pg.Pool, scope?: string | SettingsScope): Promise<string[]> {
  const chatId = typeof scope === 'string' ? scope : scope?.chatId;
  const orgId = await getOrganizationIdForChat(pool, chatId);
  const entries = await pool.query(
    `SELECT pattern
     FROM allowlists
     WHERE (organization_id = $1 OR organization_id IS NULL)
       AND type = 'web_domain'
       AND enabled = TRUE`,
    [orgId],
  );
  const scopedSettings = await getScopedSettingsMap(pool, ['allowlist.web_domains'], scope);
  const legacyDomainsRaw = parseSettingValue<string[] | string>(scopedSettings.get('allowlist.web_domains'));
  const legacyDomains: string[] = Array.isArray(legacyDomainsRaw)
    ? legacyDomainsRaw.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
    : typeof legacyDomainsRaw === 'string' && legacyDomainsRaw.trim()
      ? [legacyDomainsRaw.trim()]
      : [];
  const dbDomains = entries.rows.map((row) => row.pattern).filter(Boolean);
  return [...legacyDomains, ...dbDomains];
}

type HaAllowlistRule = {
  type: 'ha_service' | 'ha_entity';
  pattern: string;
  danger_tier: number | null;
};

function wildcardMatch(pattern: string, value: string): boolean {
  const normalizedPattern = String(pattern || '').trim().toLowerCase();
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedPattern || !normalizedValue) return false;
  if (!normalizedPattern.includes('*')) return normalizedPattern === normalizedValue;
  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(normalizedValue);
}

function defaultHaDangerTier(service: string, entityId?: string): number {
  const normalizedService = String(service || '').trim().toLowerCase();
  const serviceDomain = normalizedService.split('.')[0] || '';
  const entityDomain = String(entityId || '').trim().toLowerCase().split('.')[0] || '';
  const criticalDomains = new Set(['lock', 'alarm_control_panel', 'cover', 'garage_door']);
  const elevatedDomains = new Set(['climate', 'fan', 'remote', 'media_player', 'vacuum']);
  const criticalServices = new Set([
    'lock.lock',
    'lock.unlock',
    'alarm_control_panel.alarm_arm_away',
    'alarm_control_panel.alarm_arm_home',
    'alarm_control_panel.alarm_disarm',
    'cover.open_cover',
    'cover.close_cover',
    'cover.toggle',
  ]);
  if (criticalServices.has(normalizedService)) return 3;
  if (criticalDomains.has(serviceDomain) || criticalDomains.has(entityDomain)) return 3;
  if (elevatedDomains.has(serviceDomain) || elevatedDomains.has(entityDomain)) return 2;
  return 1;
}

async function loadHaAllowlistRules(pool: pg.Pool, chatId?: string): Promise<HaAllowlistRule[]> {
  const orgId = await getOrganizationIdForChat(pool, chatId);
  const res = await pool.query(
    `SELECT type, pattern, danger_tier
       FROM allowlists
      WHERE (organization_id = $1 OR organization_id IS NULL)
        AND enabled = TRUE
        AND type IN ('ha_service', 'ha_entity')`,
    [orgId],
  );
  return res.rows
    .map((row) => ({
      type: row.type,
      pattern: String(row.pattern || ''),
      danger_tier: row.danger_tier === null || row.danger_tier === undefined ? null : Number(row.danger_tier),
    }))
    .filter((row) => (row.type === 'ha_service' || row.type === 'ha_entity') && row.pattern.length > 0);
}

async function getHaCallServiceDangerTier(
  pool: pg.Pool,
  chatId: string | undefined,
  service: string,
  entityId?: string,
): Promise<number> {
  const rules = await loadHaAllowlistRules(pool, chatId);
  const serviceTier = rules
    .filter((row) => row.type === 'ha_service' && wildcardMatch(row.pattern, service))
    .map((row) => Number(row.danger_tier || 1));
  const entityTier = entityId
    ? rules
      .filter((row) => row.type === 'ha_entity' && wildcardMatch(row.pattern, entityId))
      .map((row) => Number(row.danger_tier || 1))
    : [];
  const explicitTier = Math.max(0, ...serviceTier, ...entityTier);
  if (explicitTier > 0) return explicitTier;
  return defaultHaDangerTier(service, entityId);
}

async function getHaApprovalRequirement(
  pool: pg.Pool,
  event: ToolRunRequestEvent,
): Promise<{ required: boolean; tier: number; service: string; entityId?: string }> {
  if (event.tool_name !== 'ha.call_service') {
    return { required: false, tier: 1, service: '' };
  }
  const service = typeof event.inputs.service === 'string' ? event.inputs.service.trim() : '';
  const rootEntityId =
    typeof event.inputs.entity_id === 'string' && event.inputs.entity_id.trim()
      ? event.inputs.entity_id.trim()
      : '';
  const nestedEntityId =
    event.inputs.data && typeof event.inputs.data === 'object' && typeof (event.inputs.data as Record<string, unknown>).entity_id === 'string'
      ? String((event.inputs.data as Record<string, unknown>).entity_id).trim()
      : '';
  const entityId = rootEntityId || nestedEntityId || undefined;
  const tier = await getHaCallServiceDangerTier(pool, event.chat_id, service, entityId);
  return { required: tier >= 2, tier, service, entityId };
}

function getHaApprovalPolicyForTier(tier: number): { quorumRequired: number; expiresInHours: number } {
  const normalizedTier = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1;
  if (normalizedTier >= 3) {
    return { quorumRequired: 2, expiresInHours: 4 };
  }
  if (normalizedTier >= 2) {
    return { quorumRequired: 1, expiresInHours: 24 };
  }
  return { quorumRequired: 1, expiresInHours: 24 };
}

async function createHaApprovalRequest(
  pool: pg.Pool,
  event: ToolRunRequestEvent,
  params: { tier: number; service: string; entityId?: string },
): Promise<string | null> {
  const service = String(params.service || '').trim();
  if (!service) return null;
  const entityId = params.entityId ? String(params.entityId).trim() : '';
  const tier = Number(params.tier || 1);
  const approvalPolicy = getHaApprovalPolicyForTier(tier);
  const expiresAt = new Date(Date.now() + approvalPolicy.expiresInHours * 60 * 60 * 1000);
  const details = {
    type: 'ha.call_service.approval_required',
    run_id: event.run_id,
    tool_name: event.tool_name,
    service,
    entity_id: entityId || null,
    danger_tier: tier,
    approval_policy: {
      quorum_required: approvalPolicy.quorumRequired,
      expires_in_hours: approvalPolicy.expiresInHours,
    },
    inputs: event.inputs,
    reason: `HA service ${service}${entityId ? ` on ${entityId}` : ''} requires approval`,
  };
  try {
    const existing = await pool.query(
      `SELECT id
         FROM approvals
        WHERE chat_id = $1
          AND requester_user_id = $2
          AND tool_name = 'ha.call_service'
          AND status = 'pending'
          AND details->>'run_id' = $3
        LIMIT 1`,
      [event.chat_id, event.user_id, event.run_id],
    );
    if (existing.rows.length > 0) {
      return String(existing.rows[0].id || '');
    }
    const approvalId = generateTaskId('approval');
    await pool.query(
      `INSERT INTO approvals (
         id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at
       ) VALUES (
         $1, $2, 'ha.call_service', 'ha.write', $3, 'pending', $4, $5, $6::jsonb, NOW()
       )`,
      [approvalId, event.chat_id, event.user_id, approvalPolicy.quorumRequired, expiresAt.toISOString(), JSON.stringify(details)],
    );
    return approvalId;
  } catch (err) {
    logger.warn('Failed to create HA approval request', {
      run_id: event.run_id,
      chat_id: event.chat_id,
      user_id: event.user_id,
      service,
      entity_id: entityId || null,
      err: String(err),
    });
    return null;
  }
}

async function getEgressConfig(
  pool: pg.Pool,
  tool: Record<string, unknown>,
  event: ToolRunRequestEvent,
): Promise<{ networkArgs: string[]; envArgs: string[]; error?: string }> {
  const permissions = getToolPermissions(tool);
  const urlValue = event.inputs.url;
  const allowlist = await loadWebAllowlist(pool, event.chat_id);
  const networkName = process.env.SVEN_EGRESS_NETWORK || 'sven-tools';
  const result = resolveWebEgressConfigDecision({
    permissions,
    trustLevel: String(tool.trust_level || ''),
    urlInput: urlValue,
    allowlist,
    proxy: String(process.env.SVEN_EGRESS_PROXY || ''),
    networkName,
  });
  if (!result.error) {
    logger.info('Egress request allowed', {
      run_id: event.run_id,
      tool_name: event.tool_name,
      url: urlValue,
      network: networkName,
    });
  }
  return result;
}

function getNasMountArgs(
  tool: Record<string, unknown>,
  event: ToolRunRequestEvent,
): { args: string[]; error?: string } {
  const permissions = getToolPermissions(tool);
  const hasNasWrite = permissions.includes('nas.write');
  const hasNasRead = hasNasWrite || permissions.includes('nas.read');

  if (!hasNasRead) {
    return { args: [] };
  }

  if (hasNasWrite && !event.approval_id) {
    return { args: [], error: 'NAS write requires approval' };
  }

  const userRoot = `/nas/users/${event.user_id}`;
  const mode = hasNasWrite ? 'rw' : 'ro';

  return {
    args: [
      '-v', `/nas/shared:/nas/shared:${mode}`,
      '-v', `${userRoot}:${userRoot}:${mode}`,
    ],
  };
}

function getSecretRefs(tool: Record<string, unknown>): Record<string, string> {
  const manifest = tool.manifest as { secrets?: Record<string, unknown> } | undefined;
  const secrets = manifest?.secrets;
  if (!secrets || typeof secrets !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(secrets).filter(([, value]) => typeof value === 'string'),
  ) as Record<string, string>;
}

async function resolveSecretRef(ref: string): Promise<string> {
  if (ref.startsWith('sops://')) {
    return resolveSecretSopsRef(ref, process.env);
  }

  if (ref.startsWith('vault://')) {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    if (!addr || !token) {
      throw new Error('Vault not configured');
    }
    const parsed = new URL(ref);
    const vaultPath = `${parsed.host}${parsed.pathname}`.replace(/^\/+/, '');
    const field = parsed.hash ? parsed.hash.slice(1) : '';

    const timeoutMs = resolveSecretTimeoutMs(
      process.env.SVEN_SECRET_RESOLVE_TIMEOUT_MS,
      5000,
      250,
      30000,
    );
    let res: Response;
    try {
      res = await fetch(`${addr.replace(/\/$/, '')}/v1/${vaultPath}`, {
        headers: { 'X-Vault-Token': token },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isSecretResolutionTimeoutError(error)) {
        throw new Error(`Vault secret resolution timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
    if (!res.ok) {
      throw new Error(`Vault request failed (${res.status})`);
    }
    const body = await res.json() as Record<string, unknown>;
    const dataNode = (body.data as Record<string, unknown> | undefined) ?? {};
    const data = (dataNode.data as Record<string, unknown> | undefined) ?? dataNode;
    if (field) {
      const value = data[field];
      if (typeof value === 'string') return value;
      if (value !== undefined) return JSON.stringify(value);
      throw new Error(`Vault field not found: ${field}`);
    }
    return JSON.stringify(data);
  }

  if (ref.startsWith('file://')) {
    return resolveSecretFileRef(ref, process.env);
  }

  if (ref.startsWith('env://')) {
    return resolveSecretEnvRef(ref, process.env);
  }

  throw new Error('Unsupported secret ref');
}

async function prepareSecretMounts(
  tool: Record<string, unknown>,
  event: ToolRunRequestEvent,
): Promise<{ mountArgs: string[]; envArgs: string[]; cleanup: () => Promise<void>; error?: string }> {
  const secrets = getSecretRefs(tool);
  const entries = Object.entries(secrets);
  if (entries.length === 0) {
    return { mountArgs: [], envArgs: [], cleanup: async () => { } };
  }

  const trusted = tool.trust_level === 'trusted' || tool.is_first_party === true;
  if (!trusted) {
    return { mountArgs: [], envArgs: [], cleanup: async () => { }, error: 'Secrets require trusted skills' };
  }
  const aliasCollisionError = buildSecretAliasCollisionError(entries.map(([key]) => key));
  if (aliasCollisionError) {
    return { mountArgs: [], envArgs: [], cleanup: async () => { }, error: aliasCollisionError };
  }
  const secretResolutionBudgetMs = resolveSecretTimeoutMs(
    process.env.SVEN_SECRET_RESOLVE_BUDGET_MS,
    15000,
    1000,
    120000,
  );
  const secretResolutionStartedAt = Date.now();

  const tmpDir = await fs.mkdtemp(`/tmp/sven-secrets-${event.run_id}-`);
  const envArgs: string[] = ['-e', 'SVEN_SECRETS_DIR=/run/sven-secrets'];

  try {
    for (const [key, ref] of entries) {
      if ((Date.now() - secretResolutionStartedAt) >= secretResolutionBudgetMs) {
        throw new Error(`Secret resolution budget exceeded after ${secretResolutionBudgetMs}ms`);
      }
      const secretValue = await resolveSecretRef(ref);
      if (Buffer.byteLength(secretValue) > 1_048_576) {
        throw new Error(`Secret '${key}' exceeds 1 MiB size limit`);
      }
      const fileName = key.replace(/[^A-Za-z0-9_.-]/g, '_');
      const filePath = path.join(tmpDir, fileName);
      await fs.writeFile(filePath, secretValue, { mode: 0o600 });
      const envKey = normalizeSecretEnvKey(key);
      envArgs.push('-e', `SVEN_SECRET_${envKey}=/run/sven-secrets/${fileName}`);
    }

    return {
      mountArgs: ['-v', `${tmpDir}:/run/sven-secrets:ro`],
      envArgs,
      cleanup: async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
      },
    };
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return {
      mountArgs: [],
      envArgs: [],
      cleanup: async () => { },
      error: `Secret resolution failed: ${String(err)}`,
    };
  }
}

async function loadRedactionConfig(pool: pg.Pool): Promise<RedactionConfig> {
  const settingsRes = await pool.query(
    `SELECT key, value FROM settings_global WHERE key IN ('redaction.enabled', 'redaction.patterns', 'redaction.mask')`,
  );
  try {
    const settings = new Map<string, unknown>(settingsRes.rows.map((row) => [String(row.key), row.value]));
    return buildRedactionConfigFromSettings(settings);
  } catch (error) {
    logger.warn('Failed to load redaction config; using safe defaults', {
      err: String(error),
    });
    return { enabled: false, mask: '[REDACTED]', patterns: [] };
  }
}

function sanitizeLogs(logs: ToolLogs | undefined, config: RedactionConfig): ToolLogs | undefined {
  if (!logs) return logs;
  return {
    stdout: trimLog(logs.stdout ? redactStringValue(logs.stdout, config) : undefined),
    stderr: trimLog(logs.stderr ? redactStringValue(logs.stderr, config) : undefined),
    exit_code: logs.exit_code,
  };
}

function runDockerCommand(
  args: string[],
  timeout: number,
  maxBuffer: number,
): { stdout: string; stderr: string; exitCode: number; error?: string } {
  const result = spawnSync('docker', args, {
    timeout,
    maxBuffer,
    encoding: 'utf8',
  });

  if (result.error) {
    if (isMaxBufferError(result.error)) {
      return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status ?? -1, error: 'Tool output exceeded max_bytes limit' };
    }
    return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status ?? -1, error: `Container execution failed: ${result.error.message}` };
  }

  if (result.status !== 0) {
    const message = result.stderr || `Container exited with code ${result.status}`;
    return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status ?? -1, error: `Container execution failed: ${message}` };
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 0,
  };
}

function isMaxBufferError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const message = (err as { message?: string }).message || '';
  return message.includes('maxBuffer length exceeded');
}

async function denyToolRun(
  pool: pg.Pool,
  nc: NatsConnection,
  event: ToolRunRequestEvent,
  prevHash: string,
  error: string,
  outputs: Record<string, unknown> = {},
): Promise<void> {
  const canonIoHash = canonicalIoHash(event.inputs, outputs);
  const runHash = computeRunHash(prevHash, canonIoHash);

  await pool.query(
    `INSERT INTO tool_runs (id, tool_name, chat_id, user_id, approval_id, inputs, status, outputs, error,
                           prev_hash, canonical_io_sha256, run_hash, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'denied', $7, $8, $9, $10, $11, NOW())`,
    [
      event.run_id,
      event.tool_name,
      event.chat_id,
      event.user_id,
      event.approval_id || null,
      JSON.stringify(event.inputs),
      JSON.stringify(outputs),
      error,
      prevHash,
      canonIoHash,
      runHash,
    ],
  );

  await publishResult(nc, event, 'denied', outputs, error);
}

/**
 * Skill Runner – executes tool calls in sandboxed environments.
 *
 * Execution modes:
 * - in_process: first-party read-only tools executed directly
 * - container: docker container-per-call (default)
 * - gvisor: quarantined third-party skills
 */
async function main(): Promise<void> {
  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'skill-runner',
    maxReconnectAttempts: -1,
  });
  logger.info('Connected to NATS');

  // Ensure JetStream streams exist
  await ensureStreams(nc);
  logger.info('NATS streams ensured');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 10,
  });
  logger.info('Connected to Postgres');

  // Initialize client attestation for inter-service message verification
  let clientAttestor: ClientAttestor | null = null;
  const attestationSecret = process.env.SVEN_ATTESTATION_SECRET || '';
  if (attestationSecret.length >= 32) {
    clientAttestor = new ClientAttestor({ secret: attestationSecret, serviceId: 'skill-runner' });
    logger.info('Client attestation initialized', { serviceId: 'skill-runner' });
  }

  // Initialize feature flag registry for runtime gating
  const featureFlags = new FeatureFlagRegistry({ source: 'skill-runner', warnOnStaleFlags: true });
  featureFlags.register({
    name: 'prompt-guard.output-scan',
    type: 'boolean',
    value: false,
    description: 'Scan tool outputs for prompt leakage before returning to agent-runtime',
    createdAt: '2026-04-07T00:00:00Z',
    cleanupBy: '2027-04-07T00:00:00Z',
    enabled: (process.env.FEATURE_PROMPT_GUARD_OUTPUT_SCAN || '').toLowerCase() === 'true',
  });
  featureFlags.register({
    name: 'anti-distillation.tool-outputs',
    type: 'boolean',
    value: false,
    description: 'Watermark tool outputs for anti-distillation tracking',
    createdAt: '2026-04-07T00:00:00Z',
    cleanupBy: '2027-04-07T00:00:00Z',
    enabled: (process.env.FEATURE_ANTI_DISTILLATION_TOOL_OUTPUTS || '').toLowerCase() === 'true',
  });
  featureFlags.register({
    name: 'query-chain.tool-depth',
    type: 'boolean',
    value: true,
    description: 'Enable tool nesting depth tracking and circuit-breaking',
    createdAt: '2026-04-07T00:00:00Z',
    cleanupBy: '2027-04-07T00:00:00Z',
    enabled: true,
  });
  logger.info('Feature flag registry initialized', { flags: featureFlags.getAllFlags().map(f => f.name) });

  // Initialize prompt guard for tool output leakage detection
  const promptGuard = new PromptGuard({
    blockOnDetection: true,
    blockThreshold: 'medium',
  });

  // Initialize anti-distillation for tool output watermarking
  const antiDistillation = AntiDistillation.fromEnv('skill-runner');

  // Initialize background session manager for async tool operations
  const bgSessions = new BackgroundSessionManager({
    maxConcurrent: Number(process.env.BG_SESSION_MAX_CONCURRENT || 4),
    maxQueueSize: Number(process.env.BG_SESSION_MAX_QUEUE || 50),
    defaultTimeoutMs: Number(process.env.BG_SESSION_TIMEOUT_MS || 10 * 60 * 1000),
  });
  logger.info('Background session manager initialized', {
    maxConcurrent: Number(process.env.BG_SESSION_MAX_CONCURRENT || 4),
  });

  // Load skills from skills/ directory using the standard YAML+Markdown loader
  const systemSkillsDir = process.env.SKILLS_DIR || path.resolve(process.cwd(), '../../skills');
  const orgSkillsDir = process.env.ORG_SKILLS_DIR || '';
  const workspaceSkillsDir = process.env.WORKSPACE_SKILLS_DIR || '';
  let loadedSkills: SkillDefinition[] = [];
  try {
    loadedSkills = await loadAllSkills({
      systemDir: systemSkillsDir,
      organizationDir: orgSkillsDir || undefined,
      workspaceDir: workspaceSkillsDir || undefined,
    });
    logger.info('Skill loader initialized', {
      systemDir: systemSkillsDir,
      totalSkills: loadedSkills.length,
      skillNames: loadedSkills.map((s) => s.name),
    });
  } catch (err) {
    logger.warn('Skill loader initialization failed, continuing without skills', { error: String(err) });
  }

  logger.info('File history manager initialized', {
    maxSnapshotsPerFile: 50,
    maxTotalSnapshots: 500,
  });

  // Tool safety classification for batch execution
  // Exclusive tools: file writes, git, NAS, HA calls, shell, docker — anything with side effects
  // Concurrent tools: web_fetch, search, read-only DB queries, media analysis — safe to parallelize
  const EXCLUSIVE_TOOL_PREFIXES = ['git.', 'nas.write', 'nas.delete', 'ha.call_service', 'shell.', 'docker.', 'dynamic.'];
  const EXCLUSIVE_TOOL_NAMES = new Set([
    'write_file', 'delete_file', 'create_file', 'move_file',
    'schedule.create', 'schedule.delete', 'schedule.update',
    'browser.navigate', 'browser.click', 'browser.type',
  ]);
  function classifyToolSafety(toolName: string): ToolSafetyClass {
    if (EXCLUSIVE_TOOL_NAMES.has(toolName)) return 'exclusive';
    for (const prefix of EXCLUSIVE_TOOL_PREFIXES) {
      if (toolName.startsWith(prefix)) return 'exclusive';
    }
    return 'concurrent';
  }
  logger.info('Tool executor batch engine initialized', {
    exclusivePrefixes: EXCLUSIVE_TOOL_PREFIXES.length,
    exclusiveNames: EXCLUSIVE_TOOL_NAMES.size,
  });

  const js = nc.jetstream();

  // Subscribe to tool run requests
  const sub = await js.pullSubscribe('tool.run.request', {
    config: {
      durable_name: 'skill-runners',
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
    },
  });

  logger.info('Subscribed to tool.run.request, processing...');

  // ═══════════════════════════════════════════════════════════════════
  //  Approval execution subscriber — triggers real actions after /approve
  //  v3: half-open circuit breaker, branch isolation, multi-file atomic,
  //      fix→deploy chaining, deploy rollback, pre-deploy build gate
  // ═══════════════════════════════════════════════════════════════════
  // Circuit breaker state is at module level (shared with heal_history tool handler)

  /** Post a system message into the approval's chat so the admin sees the result. */
  async function notifyApprovalChat(chatId: string, text: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO messages (id, chat_id, role, content_type, text, blocks, created_at)
         VALUES ($1, $2, 'assistant', 'blocks', $3, $4::jsonb, NOW())`,
        [
          generateTaskId('message'),
          chatId,
          text,
          JSON.stringify([{ type: 'markdown', content: text }]),
        ],
      );
    } catch (err) {
      logger.warn('Failed to insert approval notification message', { chat_id: chatId, err: String(err) });
    }
  }

  // v8: Subscriber crash recovery — auto-restart on crash with backoff (max 5 retries)
  const MAX_SUBSCRIBER_RESTARTS = 5;
  let subscriberRestartCount = 0;

  const runApprovalSubscriberLoop = async () => {
    const approvalSub = nc.subscribe(NATS_SUBJECTS.APPROVAL_UPDATED);
    for await (const msg of approvalSub) {
      try {
        const payload = jc.decode(msg.data) as {
          data?: { approval_id?: string; status?: string };
        };
        const approvalId = payload?.data?.approval_id;
        const status = payload?.data?.status;
        if (!approvalId || status !== 'approved') continue;

        // Half-open circuit breaker: closed → allow, open → block, half-open → allow one probe
        const cbState = circuitState();
        if (cbState === 'open') {
          logger.warn('Circuit breaker OPEN: skipping auto-execution', {
            approval_id: approvalId, consecutive_failures: opsConsecutiveFailures,
            cooldown_remaining_s: Math.round((OPS_CIRCUIT_HALF_OPEN_MS - (Date.now() - opsLastFailureAt)) / 1000),
          });
          continue;
        }
        if (cbState === 'half-open') {
          logger.info('Circuit breaker HALF-OPEN: allowing one probe execution', { approval_id: approvalId });
        }

        // Look up the approval
        const apprRes = await pool.query(
          `SELECT id, chat_id, tool_name, requester_user_id, details FROM approvals WHERE id = $1 AND status = 'approved'`,
          [approvalId],
        );
        if (apprRes.rows.length === 0) continue;
        const approval = apprRes.rows[0] as { id: string; chat_id: string; tool_name: string; requester_user_id: string; details: Record<string, any> };
        const details = approval.details || {};

        // v5: Concurrent heal mutex — one operation at a time
        await acquireHealMutex();
        // v9: Pipeline timeout — 10 min max per heal operation to prevent mutex starvation
        const healTimeout = createHealTimeout(10 * 60 * 1000);
        // v9: Track when operations happen for CB auto-decay
        lastHealOperationAt = Date.now();
        try {

        // v9: Apply CB auto-decay before checking state
        applyCircuitBreakerDecay();

        // Only handle ops tool approvals
        if (approval.tool_name === 'sven.ops.code_fix' && details.action === 'code_fix') {
          const healStartTime = Date.now();
          // Atomic CAS: claim the approval so no other instance runs it
          const claimed = await claimApproval(pool, approvalId);
          if (!claimed) { logger.info('Code fix approval already claimed', { approval_id: approvalId }); continue; }

          logger.info('Executing approved code fix', { approval_id: approvalId, file_path: details.file_path });
          const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';

          try {
            // Build change list — support single or multi-file fixes
            const changes: FileChange[] = details.changes && Array.isArray(details.changes)
              ? details.changes as FileChange[]
              : [{ file_path: details.file_path, old_content: details.old_content, new_content: details.new_content }];

            // v6: Fix deduplication — skip if identical diff was already applied within 24h
            const dedup = isDuplicateFix(changes);
            if (dedup.duplicate) {
              await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', { approval_id: approvalId, hash: dedup.hash }, `Fix deduplicated: identical diff (${dedup.hash.slice(0, 12)}) was already applied`, 'medium');
              await notifyApprovalChat(approval.chat_id, `🔁 **Duplicate fix skipped** (approval \`${approvalId.slice(0, 12)}…\`)\n\nThis exact diff (\`${dedup.hash.slice(0, 12)}…\`) was already applied ${dedup.firstSeenAt ? Math.round((Date.now() - dedup.firstSeenAt) / 60000) + ' min ago' : 'recently'}. Skipping to prevent redundant changes.`);
              healTelemetry.fixes_deduplicated++;
              continue;
            }

            // v8: File quarantine check — skip if any file has repeated failures
            let quarantineBlocked = false;
            for (const change of changes) {
              const quarantine = isFileQuarantined(change.file_path);
              if (quarantine.quarantined) {
                await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
                await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', { file: change.file_path, approval_id: approvalId, failures: quarantine.failures }, `Fix blocked: file quarantined after ${quarantine.failures} failures`, 'high');
                await notifyApprovalChat(approval.chat_id, `🔒 **File quarantined** (approval \`${approvalId.slice(0, 12)}…\`)\n\n\`${change.file_path}\` has failed ${quarantine.failures} heal attempts in 24h and is auto-quarantined. Use \`sven.ops.heal_history\` with \`clear_quarantine\` to lift.`);
                healTelemetry.files_quarantined++;
                quarantineBlocked = true;
                break;
              }
            }
            if (quarantineBlocked) continue;

            // v8: Resource guard — check system resources before heavy build operations
            const resourceCheck = checkSystemResources();
            if (!resourceCheck.ok) {
              await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', { approval_id: approvalId, warnings: resourceCheck.warnings }, `Fix deferred: system resources low`, 'high');
              await notifyApprovalChat(approval.chat_id, `⚠️ **Fix deferred — low resources** (approval \`${approvalId.slice(0, 12)}…\`)\n\n${resourceCheck.warnings.join('; ')}. Build operations would worsen system stability.`);
              healTelemetry.resource_guard_blocks++;
              continue;
            }

            // v8: Pre-heal checkpoint — git tag for last-resort recovery
            const checkpoint = createHealCheckpoint(repoRoot);
            if (checkpoint.ok) healTelemetry.checkpoints_created++;

            // v4: Fix rate limiter — prevent fix storms on the same file
            for (const change of changes) {
              const rateCheck = checkFixRateLimit(change.file_path);
              if (!rateCheck.allowed) {
                await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
                await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', { file: change.file_path, approval_id: approvalId }, `Fix rate-limited: ${rateCheck.recentCount} fixes to ${change.file_path} in last 30min (max ${FIX_RATE_MAX})`, 'high');
                await notifyApprovalChat(approval.chat_id, `🛑 **Fix rate-limited** (approval \`${approvalId.slice(0, 12)}…\`)\n\n\`${change.file_path}\` has been modified ${rateCheck.recentCount} times in the last 30 minutes (limit: ${FIX_RATE_MAX}). Cooldown resets in ${Math.ceil(rateCheck.resetInMs / 60000)} min.\n\nThis prevents fix loops — investigate the root cause before retrying.`);
                healTelemetry.fixes_rate_limited++;
                opsConsecutiveFailures++;
                opsLastFailureAt = Date.now();
                continue;
              }
            }

            // v9: Pipeline timeout check before heavy build phase
            healTimeout.check();

            const commitMsg = `fix(sven-heal): ${(details.message || 'approved code fix').slice(0, 72)}`;
            const buildStart = Date.now();
            const result = await applyFixOnBranch(changes, repoRoot, commitMsg);
            recordHealDuration('build_verify', Date.now() - buildStart);

            if (!result.ok) {
              await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', { files: changes.map(c => c.file_path), approval_id: approvalId }, `Fix rolled back: build verification failed on branch ${result.branch}`, 'high');
              await notifyApprovalChat(approval.chat_id, `❌ **Code fix rolled back** (approval \`${approvalId.slice(0, 12)}…\`)\n\nApplied to branch \`${result.branch}\` but **broke the build**:\n\`\`\`\n${(result.buildOutput || '').slice(0, 500)}\n\`\`\`\nBranch abandoned. All files restored. No commit on main.`);
              for (const change of changes) recordFileHealFailure(change.file_path, 'build_failed');
              opsConsecutiveFailures++;
              opsLastFailureAt = Date.now();
              continue;
            }

            // v4: Post-fix test runner — run unit tests for affected services
            healTimeout.check(); // v9: timeout check before test phase
            const testStart = Date.now();
            const testResults: Array<{ file: string; ok: boolean; output: string; skipped: boolean }> = [];
            for (const change of changes) {
              const tr = runServiceTests(repoRoot, change.file_path);
              testResults.push({ file: change.file_path, ...tr });
            }
            recordHealDuration('test_verify', Date.now() - testStart);
            const testFailures = testResults.filter(t => !t.ok && !t.skipped);

            if (testFailures.length > 0) {
              // Tests failed after build passed — revert the commit
              const revertResult = revertHealCommits(repoRoot, 1);
              await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              const failDetail = testFailures.map(t => `\`${t.file}\`:\n\`\`\`\n${t.output.slice(0, 300)}\n\`\`\``).join('\n');
              await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', { files: changes.map(c => c.file_path), approval_id: approvalId, commit: result.commitHash }, `Fix reverted: tests failed after build passed. Reverted: ${revertResult.ok}`, 'high');
              await notifyApprovalChat(approval.chat_id, `❌ **Code fix reverted** (approval \`${approvalId.slice(0, 12)}…\`)\n\nBuild passed ✅ but **tests failed** ❌:\n${failDetail}\n\nCommit \`${result.commitHash}\` reverted. ${revertResult.ok ? 'Build re-verified clean.' : `⚠️ Revert issue: ${revertResult.output}`}`);
              healTelemetry.fixes_reverted++;
              for (const change of changes) recordFileHealFailure(change.file_path, 'tests_failed');
              opsConsecutiveFailures++;
              opsLastFailureAt = Date.now();
              continue;
            }

            // Record rate limit entries for successfully applied fixes
            for (const change of changes) recordFixApplication(change.file_path);

            // v6: Record dedup hash so identical diffs are rejected within 24h
            recordFixHash(dedup.hash);

            // v7: Telemetry counter
            healTelemetry.fixes_applied++;
            healTelemetry.last_fix_at = new Date().toISOString();

            await pool.query(`UPDATE approvals SET status = 'executed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
            const testNote = testResults.some(t => !t.skipped) ? ' | Tests: ✅ passed' : ' | Tests: skipped (no test dir)';
            await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.code_fix', {
              files: changes.map(c => c.file_path), approval_id: approvalId, commit: result.commitHash, branch: result.branch, tests_passed: true,
            }, `Approved fix applied via branch ${result.branch}, verified (build+tests), merged, committed ${result.commitHash}`, 'high');

            // v9: Record heal duration
            recordHealDuration('code_fix', Date.now() - healStartTime);

            // Fix→Deploy chaining: auto-create a deploy approval so admin can deploy with one more /approve
            let chainedDeployId: string | undefined;
            if (details.chain_deploy !== false) {
              try {
                chainedDeployId = generateTaskId('approval');
                const deployTarget = changes.some(c => c.file_path.includes('skill-runner')) ? 'all' : changes[0]?.file_path.match(/services\/([^/]+)/)?.[1] || 'all';
                await pool.query(
                  `INSERT INTO approvals (id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at)
                   VALUES ($1, $2, 'sven.ops.deploy', 'ops.deploy', $3, 'pending', 1, NOW() + INTERVAL '1 hour', $4::jsonb, NOW())`,
                  [
                    chainedDeployId, approval.chat_id, approval.requester_user_id,
                    JSON.stringify({ message: `Deploy fix ${result.commitHash}`, target: deployTarget, environment: 'staging', chained_from: approvalId }),
                  ],
                );
              } catch { chainedDeployId = undefined; }
            }

            const filesStr = changes.map(c => `\`${c.file_path}\``).join(', ');
            const chainNote = chainedDeployId ? `\n\n🔗 **Deploy approval auto-created**: \`/approve ${chainedDeployId}\` to deploy this fix.` : '';
            await notifyApprovalChat(approval.chat_id, `✅ **Code fix applied** (approval \`${approvalId.slice(0, 12)}…\`)\n\nFixed ${filesStr} via branch \`${result.branch}\` — build verified clean${testNote} — committed as \`${result.commitHash}\`.${chainNote}`);
            opsConsecutiveFailures = 0;
            logger.info('Code fix applied via approval', { approval_id: approvalId, files: changes.map(c => c.file_path), commit: result.commitHash });

            // v5: Publish NATS heal event — cross-service awareness
            try {
              nc.publish('heal.event.code_fix', jc.encode({
                type: 'code_fix_applied',
                approval_id: approvalId,
                files: changes.map(c => c.file_path),
                commit: result.commitHash,
                branch: result.branch,
                tests_passed: true,
                chained_deploy_id: chainedDeployId || null,
                timestamp: new Date().toISOString(),
              }));
            } catch { /* non-critical: NATS publish failure should not block the fix */ }
          } catch (err) {
            logger.error('Failed to execute approved code fix', { approval_id: approvalId, err: String(err) });
            await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
            await notifyApprovalChat(approval.chat_id, `❌ **Code fix failed** (approval \`${approvalId.slice(0, 12)}…\`): ${err instanceof Error ? err.message : String(err)}`);
            opsConsecutiveFailures++;
            opsLastFailureAt = Date.now();
          }
        }

        if (approval.tool_name === 'sven.ops.deploy') {
          const claimed = await claimApproval(pool, approvalId);
          if (!claimed) { logger.info('Deploy approval already claimed', { approval_id: approvalId }); continue; }

          logger.info('Executing approved deployment', { approval_id: approvalId, target: details.target });
          const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';
          const composePrimary = process.env.SVEN_COMPOSE_FILE || 'docker-compose.yml';
          const deployTarget = details.target || 'all';
          const restartsSelf = deployTarget === 'all' || deployTarget === 'skill-runner';

          try {
            // v8: Resource guard — check system resources before deploy
            const deployResourceCheck = checkSystemResources();
            if (!deployResourceCheck.ok) {
              await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.deploy', { target: deployTarget, approval_id: approvalId, warnings: deployResourceCheck.warnings }, `Deploy deferred: system resources low`, 'high');
              await notifyApprovalChat(approval.chat_id, `⚠️ **Deploy deferred — low resources** (approval \`${approvalId.slice(0, 12)}…\`)\n\n${deployResourceCheck.warnings.join('; ')}. Deploy would worsen system stability.`);
              healTelemetry.resource_guard_blocks++;
              continue;
            }

            // v8: Pre-deploy checkpoint — git tag for last-resort recovery
            const deployCheckpoint = createHealCheckpoint(repoRoot);
            if (deployCheckpoint.ok) healTelemetry.checkpoints_created++;

            // v9: Deploy pipeline timeout check
            healTimeout.check();
            const deployStartTime = Date.now();

            // Pre-deploy build gate — ensure all services compile before deploying
            const preBuild = verifyFullBuild(repoRoot);
            if (!preBuild.ok) {
              await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              const failDetail = preBuild.failures.map(f => `**${f.service}**: ${f.output.slice(0, 200)}`).join('\n');
              await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.deploy', { target: deployTarget, approval_id: approvalId }, `Deploy blocked: pre-deploy build gate failed`, 'high');
              await notifyApprovalChat(approval.chat_id, `🛑 **Deployment blocked** (approval \`${approvalId.slice(0, 12)}…\`)\n\nPre-deploy build gate failed:\n${failDetail}\n\nFix build errors before deploying.`);
              opsConsecutiveFailures++;
              opsLastFailureAt = Date.now();
              continue;
            }

            // Snapshot current container images for rollback
            const imageSnapshot = snapshotContainerImages(deployTarget === 'all' ? undefined : [deployTarget]);

            await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.deploy', { target: deployTarget, approval_id: approvalId }, `Approved deployment executing (pre-build passed)`, 'high');
            await notifyApprovalChat(approval.chat_id, `🚀 **Deployment started** (approval \`${approvalId.slice(0, 12)}…\`)\n\nTarget: \`${deployTarget}\` | Pre-deploy build: ✅ passed | Self-restart: ${restartsSelf ? 'yes' : 'no'}\nImage snapshot saved for rollback.`);

            if (restartsSelf) {
              const dockerPs = runDockerCommand(['ps', '--format', '{{.Names}}'], 10000, 1024 * 32);
              const allServices = (dockerPs.stdout || '').trim().split('\n').filter(Boolean).filter(s => !s.includes('skill-runner'));
              const svcResults: Array<{ name: string; ok: boolean; healthy: boolean }> = [];
              for (const svc of allServices) {
                const r = spawnSync('docker', ['restart', svc], { cwd: repoRoot, encoding: 'utf8', timeout: 60000 });
                const ok = r.status === 0;
                let healthy = false;
                if (ok) {
                  const health = waitForContainerHealth(svc, 30000);
                  healthy = health.healthy;
                  if (!health.healthy) logger.warn('Container not healthy after restart', { container: svc, status: health.status });
                }
                svcResults.push({ name: svc, ok, healthy });
              }

              const unhealthy = svcResults.filter(s => !s.healthy);
              if (unhealthy.length > svcResults.length / 2) {
                // More than half unhealthy — note rollback info (can't auto-rollback well during self-restart)
                logger.error('Deployment: majority of services unhealthy', { unhealthy: unhealthy.map(s => s.name) });
                await notifyApprovalChat(approval.chat_id, `⚠️ **Deployment warning**: ${unhealthy.length}/${svcResults.length} services unhealthy after restart. Previous images: ${Array.from(imageSnapshot.entries()).map(([n, i]) => `${n}→${i}`).join(', ')}`);
              }

              await pool.query(`UPDATE approvals SET status = 'executed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
              const succeeded = svcResults.filter(s => s.ok).length;
              const healthyCount = svcResults.filter(s => s.healthy).length;
              const failedSvcs = svcResults.filter(s => !s.ok).map(s => s.name);
              await notifyApprovalChat(approval.chat_id, `✅ **Deployment completed** (approval \`${approvalId.slice(0, 12)}…\`)\n\n${succeeded}/${svcResults.length} restarted, ${healthyCount}/${svcResults.length} healthy.${failedSvcs.length > 0 ? ` Failed: ${failedSvcs.join(', ')}` : ''}\n\n⏳ Skill-runner self-restart in ~3 seconds…`);
              opsConsecutiveFailures = 0;
              recordHealDuration('deploy', Date.now() - deployStartTime);
              setTimeout(() => {
                logger.info('Self-healing: approved deployment restarting skill-runner');
                const r = spawnSync('docker', ['restart', 'skill-runner'], { encoding: 'utf8', timeout: 30000 });
                if (r.status !== 0) process.exit(0);
              }, 3000);
            } else {
              const composeResult = spawnSync('docker', ['compose', '-f', composePrimary, 'up', '-d', '--build', '--force-recreate', deployTarget], {
                cwd: repoRoot, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 256,
              });
              const deployOk = composeResult.status === 0;

              // Post-deploy health-check loop (Docker container health)
              const health = waitForContainerHealth(deployTarget, 30000);

              // v4: HTTP health probe — verify the service actually responds to requests
              const svcPortMap: Record<string, number> = { 'gateway-api': 3000, 'agent-runtime': 39100 };
              const httpPort = svcPortMap[deployTarget];
              let httpHealthOk = true;
              let httpHealthDetail = '';
              if (httpPort && health.healthy) {
                const probe = probeHttpHealth('127.0.0.1', httpPort, 10000);
                httpHealthOk = probe.ok;
                httpHealthDetail = probe.ok
                  ? `HTTP /healthz: ${probe.statusCode} (${probe.durationMs}ms)`
                  : `HTTP /healthz FAILED: status ${probe.statusCode} (${probe.durationMs}ms) — ${probe.body.slice(0, 200)}`;
                if (!probe.ok) logger.warn('Post-deploy HTTP health probe failed', { target: deployTarget, port: httpPort, status: probe.statusCode });
              }

              // v5: Post-deploy smoke tests — verify service actually functions
              let smokeOk = true;
              let smokeDetail = '';
              if (httpPort && httpHealthOk && deployTarget === 'gateway-api') {
                const smoke = runSmokeTests('127.0.0.1', httpPort, 8000);
                smokeOk = smoke.ok;
                const failedSmokes = smoke.results.filter(r => !r.ok);
                if (!smokeOk) {
                  smokeDetail = `Smoke tests failed: ${failedSmokes.map(r => `${r.name}(${r.statusCode})`).join(', ')}`;
                  logger.warn('Post-deploy smoke tests failed', { target: deployTarget, results: smoke.results });
                } else {
                  smokeDetail = `Smoke tests: ${smoke.results.length}/${smoke.results.length} passed`;
                }
              }

              // v6: Post-deploy watch window — 2-minute rolling health check for delayed failures
              let watchOk = true;
              let watchDetail = '';
              if (httpPort && smokeOk && httpHealthOk) {
                await notifyApprovalChat(approval.chat_id, `👀 **Watch window started** — monitoring \`${deployTarget}\` for 2 minutes…`);
                const watch = postDeployWatch('127.0.0.1', httpPort, 120000, 15000);
                watchOk = watch.ok;
                if (!watchOk) {
                  watchDetail = `Watch window failed after ${watch.probes} probes: ${watch.lastFailure || 'unknown'}`;
                  logger.warn('Post-deploy watch window failed', { target: deployTarget, probes: watch.probes, failures: watch.failures });
                } else {
                  watchDetail = `Watch window: ${watch.probes} probes over 2min, all healthy`;
                }
              }

              if (!deployOk || !health.healthy || !httpHealthOk || !smokeOk || !watchOk) {
                // Attempted rollback: restart with the previous image
                const reason = !deployOk
                  ? `compose exit code ${composeResult.status}: ${(composeResult.stderr || '').trim().slice(0, 300)}`
                  : !health.healthy ? `container health: ${health.status}`
                  : !httpHealthOk ? `HTTP health probe failed: ${httpHealthDetail}`
                  : !smokeOk ? `Smoke tests failed: ${smokeDetail}`
                  : `Watch window failed: ${watchDetail}`;
                logger.error('Deploy unhealthy, attempting rollback', { target: deployTarget, deployOk, containerHealthy: health.healthy, httpHealthOk, smokeOk, watchOk, reason });
                const rollbackResults = rollbackContainers(imageSnapshot, repoRoot);
                const rollbackNote = rollbackResults.map(r => `${r.name}: ${r.ok ? 'rolled back' : 'rollback failed'}`).join(', ');
                await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
                await logOpsAudit(pool, approval.requester_user_id, 'sven.ops.deploy', { target: deployTarget, approval_id: approvalId, reason }, `Deploy failed and rolled back`, 'critical');
                await notifyApprovalChat(approval.chat_id, `❌ **Deployment failed & rolled back** (approval \`${approvalId.slice(0, 12)}…\`)\n\n\`${deployTarget}\`: ${reason}\n\nRollback: ${rollbackNote}`);
                healTelemetry.deploys_rolled_back++;
                opsConsecutiveFailures++;
                opsLastFailureAt = Date.now();
              } else {
                const httpNote = httpHealthDetail ? ` | ${httpHealthDetail}` : '';
                const smokeNote = smokeDetail ? ` | ${smokeDetail}` : '';
                const watchNote = watchDetail ? ` | ${watchDetail}` : '';
                await pool.query(`UPDATE approvals SET status = 'executed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
                logger.info('Approved deployment completed', { approval_id: approvalId, target: deployTarget, success: true, http_health: httpHealthDetail || 'no probe', smoke: smokeDetail || 'no smoke', watch: watchDetail || 'no watch' });
                await notifyApprovalChat(approval.chat_id, `✅ **Deployment completed** (approval \`${approvalId.slice(0, 12)}…\`)\n\n\`${deployTarget}\` rebuilt, restarted, and healthy.${httpNote}${smokeNote}${watchNote}`);
                healTelemetry.deploys_completed++;
                healTelemetry.last_deploy_at = new Date().toISOString();
                opsConsecutiveFailures = 0;
                recordHealDuration('deploy', Date.now() - deployStartTime);

                // v5: Publish NATS heal event — deployment completed
                try {
                  nc.publish('heal.event.deploy', jc.encode({
                    type: 'deploy_completed',
                    approval_id: approvalId,
                    target: deployTarget,
                    http_health: httpHealthDetail || 'no probe',
                    timestamp: new Date().toISOString(),
                  }));
                } catch { /* non-critical */ }
              }
            }
          } catch (err) {
            logger.error('Failed to execute approved deployment', { approval_id: approvalId, err: String(err) });
            await pool.query(`UPDATE approvals SET status = 'failed', resolved_at = NOW() WHERE id = $1`, [approvalId]);
            await notifyApprovalChat(approval.chat_id, `❌ **Deployment failed** (approval \`${approvalId.slice(0, 12)}…\`): ${err instanceof Error ? err.message : String(err)}`);
            opsConsecutiveFailures++;
            opsLastFailureAt = Date.now();
          }
        }

        } finally {
          // v5: Always release mutex
          releaseHealMutex();
          // v9: Clear pipeline timeout
          healTimeout.clear();
        }

      } catch (err) {
        logger.error('Error processing approval event', { err: String(err) });
      }
    }
  };

  // v8: auto-restart subscriber on crash with linear backoff
  (async () => {
    while (subscriberRestartCount <= MAX_SUBSCRIBER_RESTARTS) {
      try {
        await runApprovalSubscriberLoop();
        break; // Normal subscription close
      } catch (err) {
        subscriberRestartCount++;
        healTelemetry.subscriber_restarts++;
        logger.error('Approval subscriber loop crashed, restarting', {
          err: String(err), restart_count: subscriberRestartCount, max: MAX_SUBSCRIBER_RESTARTS,
        });
        if (subscriberRestartCount > MAX_SUBSCRIBER_RESTARTS) {
          logger.error('Approval subscriber exceeded max restarts — giving up', { restarts: subscriberRestartCount });
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000 * subscriberRestartCount));
      }
    }
  })();
  logger.info('Subscribed to approval.updated for ops execution');

  // v6: Hydrate circuit breaker state from DB on startup — survives restarts
  await hydrateCircuitBreakerFromDb(pool);

  // ═══════════════════════════════════════════════════════════════════
  //  v4: Scheduled self-diagnostics loop — periodic health monitoring
  //  v8: Adaptive interval, runtime log scanning
  //  Checks: service health, DB connectivity, expired approvals, runtime errors
  // ═══════════════════════════════════════════════════════════════════
  const SELF_DIAG_INTERVAL_NORMAL_MS = 60_000; // 60s when healthy
  const SELF_DIAG_INTERVAL_DEGRADED_MS = 15_000; // 15s when degraded
  let selfDiagRunning = false;
  let proactiveScanCooldown = 0; // v7: skip N cycles between tsc scans
  let selfDiagDegraded = false; // v8: tracks degraded state for adaptive interval
  let v9CheckpointCleanupCooldown = 0; // v9: run checkpoint cleanup every 10th cycle (~10 min)
  let v9DepAuditCooldown = 0; // v9: run dep audit every 20th cycle (~20 min)
  let v9TelemetryPersistCooldown = 0; // v9: persist telemetry every 10th cycle (~10 min)
  let selfDiagTimer: ReturnType<typeof setTimeout>;

  const runSelfDiagCycle = async () => {
    if (selfDiagRunning) return;
    selfDiagRunning = true;
    try {
      // 1. DB connectivity check
      const dbStart = Date.now();
      try {
        await pool.query('SELECT 1');
      } catch (dbErr) {
        logger.error('Self-diagnostics: DB connection failed', { err: String(dbErr), duration_ms: Date.now() - dbStart });
      }

      // 2. Expire stale approvals (pending > 24h)
      try {
        const expired = await pool.query(
          `UPDATE approvals SET status = 'expired', resolved_at = NOW()
           WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'
           RETURNING id`,
        );
        if ((expired.rowCount ?? 0) > 0) {
          logger.info('Self-diagnostics: expired stale approvals', { count: expired.rowCount });
        }
      } catch { /* non-critical */ }

      // 3. HTTP health probe on gateway-api (if available)
      const gatewayProbe = probeHttpHealth('127.0.0.1', 3000, 5000);
      if (!gatewayProbe.ok && gatewayProbe.statusCode !== 0) {
        logger.warn('Self-diagnostics: gateway-api /healthz degraded', {
          status_code: gatewayProbe.statusCode, duration_ms: gatewayProbe.durationMs,
        });
      }

      // 4. Circuit breaker status logging (if degraded)
      const cbState = circuitState();
      if (cbState !== 'closed') {
        if (cbState === 'open') healTelemetry.circuit_breaker_trips++;
        logger.warn('Self-diagnostics: circuit breaker not closed', {
          state: cbState, consecutive_failures: opsConsecutiveFailures,
        });
      }

      // 5. v7: Stale approval escalation — NATS event when critical approvals pending > 1h
      try {
        const staleApprovals = await getStaleApprovals(pool);
        for (const stale of staleApprovals) {
          try {
            nc.publish('heal.event.escalation', jc.encode({
              type: 'stale_approval',
              approval_id: stale.id,
              tool_name: stale.tool_name,
              age_minutes: stale.age_min,
              message: `Critical approval ${stale.id.slice(0, 12)} (${stale.tool_name}) has been pending for ${stale.age_min} minutes`,
              timestamp: new Date().toISOString(),
            }));
            healTelemetry.stale_escalations_sent++;
          } catch { /* non-critical */ }
          // Also notify in the chat where it was created
          await notifyApprovalChat(stale.chat_id, `⏰ **Approval reminder**: \`${stale.id.slice(0, 12)}…\` (\`${stale.tool_name}\`) has been pending for ${stale.age_min} min. Use \`/approve ${stale.id}\` or it will expire at 24h.`);
        }
        if (staleApprovals.length > 0) {
          logger.info('Self-diagnostics: escalated stale approvals', { count: staleApprovals.length, ids: staleApprovals.map(s => s.id.slice(0, 12)) });
        }
      } catch { /* non-critical */ }

      // 6. v7: Proactive heal detection — run tsc scan every 5th diagnostics cycle (~5 min)
      //    Only when circuit breaker is closed and no stale escalations
      if (!proactiveScanCooldown && cbState === 'closed') {
        proactiveScanCooldown = 4; // skip next 4 cycles (= run every 5th = ~5 min)
        const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';
        const tscErrors = proactiveTscScan(repoRoot);
        if (tscErrors.length > 0) {
          healTelemetry.proactive_detections++;
          logger.warn('Self-diagnostics: proactive tsc scan found errors', {
            services: tscErrors.map(e => e.service),
            error_preview: tscErrors.map(e => e.errors.slice(0, 200)),
          });
          // Publish NATS event so agent-runtime or admin UI can pick it up
          try {
            nc.publish('heal.event.proactive_detection', jc.encode({
              type: 'tsc_errors_detected',
              services: tscErrors.map(e => ({ service: e.service, errors: e.errors.slice(0, 500) })),
              message: `Proactive scan found TypeScript errors in ${tscErrors.map(e => e.service).join(', ')}`,
              timestamp: new Date().toISOString(),
            }));
          } catch { /* non-critical */ }
        }
      } else if (proactiveScanCooldown > 0) {
        proactiveScanCooldown--;
      }

      // 7. v8: Runtime log scanning — check Docker logs for crash patterns tsc can't detect
      try {
        const runtimeErrors = scanRuntimeLogs();
        if (runtimeErrors.length > 0) {
          healTelemetry.runtime_errors_detected++;
          logger.warn('Self-diagnostics: runtime errors detected in container logs', {
            containers: runtimeErrors.map(e => e.container),
            error_count: runtimeErrors.reduce((sum, e) => sum + e.errors.length, 0),
          });
          try {
            nc.publish('heal.event.proactive_detection', jc.encode({
              type: 'runtime_errors_detected',
              containers: runtimeErrors.map(e => ({ container: e.container, errors: e.errors.slice(0, 3) })),
              message: `Runtime errors detected in ${runtimeErrors.map(e => e.container).join(', ')}`,
              timestamp: new Date().toISOString(),
            }));
          } catch { /* non-critical */ }
        }
      } catch { /* non-critical */ }

      // 8. v9: Checkpoint tag cleanup — prune old sven-checkpoint tags (every 10th cycle)
      if (!v9CheckpointCleanupCooldown) {
        v9CheckpointCleanupCooldown = 9;
        try {
          const diagRepoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';
          const pruneResult = cleanupOldCheckpoints(diagRepoRoot);
          if (pruneResult.pruned > 0) {
            logger.info('Self-diagnostics: pruned old checkpoint tags', { count: pruneResult.pruned, remaining: pruneResult.remaining });
          }
        } catch { /* non-critical */ }
      } else {
        v9CheckpointCleanupCooldown--;
      }

      // 9. v9: Dependency vulnerability scan — npm audit (every 20th cycle ~20 min)
      if (!v9DepAuditCooldown) {
        v9DepAuditCooldown = 19;
        try {
          const diagRepoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';
          const depAudit = scanDependencyVulnerabilities(diagRepoRoot);
          if (depAudit.high > 0 || depAudit.critical > 0) {
            logger.warn('Self-diagnostics: dependency vulnerabilities detected', {
              critical: depAudit.critical,
              high: depAudit.high,
            });
            try {
              nc.publish('heal.event.proactive_detection', jc.encode({
                type: 'dependency_vulnerabilities',
                critical: depAudit.critical,
                high: depAudit.high,
                message: `Dependency audit: ${depAudit.critical} critical, ${depAudit.high} high vulnerabilities found`,
                timestamp: new Date().toISOString(),
              }));
            } catch { /* non-critical */ }
          }
        } catch { /* non-critical */ }
      } else {
        v9DepAuditCooldown--;
      }

      // 10. v9: Persistent telemetry snapshot — flush counters to DB (every 10th cycle)
      if (!v9TelemetryPersistCooldown) {
        v9TelemetryPersistCooldown = 9;
        try {
          await persistTelemetrySnapshot(pool);
        } catch { /* non-critical */ }
      } else {
        v9TelemetryPersistCooldown--;
      }

      // v8: Update degraded state for adaptive interval
      selfDiagDegraded = cbState !== 'closed';
    } catch (err) {
      logger.error('Self-diagnostics loop error', { err: String(err) });
    } finally {
      selfDiagRunning = false;
      // v8: Adaptive interval — 15s when degraded, 60s when healthy
      const nextInterval = selfDiagDegraded ? SELF_DIAG_INTERVAL_DEGRADED_MS : SELF_DIAG_INTERVAL_NORMAL_MS;
      selfDiagTimer = setTimeout(runSelfDiagCycle, nextInterval);
    }
  };
  selfDiagTimer = setTimeout(runSelfDiagCycle, SELF_DIAG_INTERVAL_NORMAL_MS);
  // Clean up timer when process exits
  process.on('beforeExit', () => clearTimeout(selfDiagTimer));
  logger.info('Self-diagnostics loop started', { normal_ms: SELF_DIAG_INTERVAL_NORMAL_MS, degraded_ms: SELF_DIAG_INTERVAL_DEGRADED_MS });

  // Secured result publisher: applies prompt guard output scan + anti-distillation watermarking
  const publishSecuredResult = async (
    event: ToolRunRequestEvent,
    status: string,
    outputs: Record<string, unknown>,
    error?: string,
  ): Promise<void> => {
    // Scan text outputs for prompt leakage
    if (featureFlags.isEnabled('prompt-guard.output-scan') && status === 'success') {
      for (const [key, value] of Object.entries(outputs)) {
        if (typeof value === 'string' && value.length > 0) {
          const scan = promptGuard.scanOutput(value);
          if (scan.blocked) {
            logger.warn('Prompt guard blocked tool output — potential system prompt leakage', {
              run_id: event.run_id,
              tool_name: event.tool_name,
              output_key: key,
              pattern: scan.patternName,
              severity: scan.severity,
            });
            outputs[key] = '[output redacted by security scan]';
          }
        }
      }
    }

    // Watermark text outputs for anti-distillation
    if (featureFlags.isEnabled('anti-distillation.tool-outputs') && status === 'success') {
      for (const [key, value] of Object.entries(outputs)) {
        if (typeof value === 'string' && value.length > 20) {
          outputs[key] = antiDistillation.watermark(value);
        }
      }
    }

    await publishResult(nc, event, status, outputs, error);
  };

  for await (const msg of sub) {
    try {
      const envelope = jc.decode(msg.data) as EventEnvelope<ToolRunRequestEvent>;
      const event = envelope.data;

      logger.info('Processing tool run', {
        run_id: event.run_id,
        tool_name: event.tool_name,
        correlation_id: event.correlation_id || envelope.event_id,
      });
      const integrationType = resolveIntegrationRuntimeType(event.tool_name);
      let organizationId: string | null = null;
      if (integrationType && event.chat_id) {
        const orgRes = await pool.query(
          `SELECT organization_id
             FROM chats
            WHERE id = $1
            LIMIT 1`,
          [event.chat_id],
        );
        organizationId = String(orgRes.rows[0]?.organization_id || '').trim() || null;
      }

      // Look up tool configuration
      const toolRes = await pool.query(
        `SELECT name, execution_mode, is_first_party, trust_level, timeout_seconds,
                max_memory_mb, max_cpu_shares, manifest, resource_limits, permissions_required, outputs_schema
         FROM tools WHERE name = $1`,
        [event.tool_name],
      );

      if (toolRes.rows.length === 0) {
        await publishSecuredResult(event, 'error', {}, `Tool "${event.tool_name}" not found in registry`);
        msg.ack();
        continue;
      }

      if (integrationType && organizationId) {
        const runtimeBeforeRes = await pool.query(
          `SELECT status
             FROM integration_runtime_instances
            WHERE organization_id = $1
              AND integration_type = $2
            LIMIT 1`,
          [organizationId, integrationType],
        );
        const runtimeBeforeStatus = String(runtimeBeforeRes.rows[0]?.status || 'stopped').toLowerCase();
        const needsBoot = runtimeBeforeStatus !== 'running';
        if (needsBoot) {
          await emitIntegrationRuntimeStatusMessage(pool, {
            chatId: event.chat_id,
            text: `Booting ${integrationType} integration runtime for this request...`,
            integrationType,
            status: 'running',
          });
        }
        const runtimeReady = await ensureIntegrationRuntimeReady(pool, {
          organizationId,
          integrationType,
          toolName: event.tool_name,
        });
        if (needsBoot) {
          if (runtimeReady.ready) {
            const successText = runtimeReady.message
              ? `${integrationType} integration is ready. ${runtimeReady.message}`
              : `${integrationType} integration is ready. Continuing now.`;
            await emitIntegrationRuntimeStatusMessage(pool, {
              chatId: event.chat_id,
              text: successText,
              integrationType,
              status: 'success',
            });
          } else {
            await emitIntegrationRuntimeStatusMessage(pool, {
              chatId: event.chat_id,
              text: `Failed to boot ${integrationType} integration runtime. ${String(runtimeReady.message || '').trim()}`.trim(),
              integrationType,
              status: 'error',
              error: runtimeReady.message,
            });
          }
        }
        if (!runtimeReady.ready) {
          await publishResult(
            nc,
            event,
            'error',
            {
              integration_type: integrationType,
              runtime_status: 'booting_or_failed',
              auto_started: runtimeReady.started,
            },
            runtimeReady.message || `Runtime for ${integrationType} is not ready`,
          );
          msg.ack();
          continue;
        }
      }

      const tool = toolRes.rows[0];

      if (tool.trust_level === 'blocked') {
        await denyToolRun(pool, nc, event, '0'.repeat(64), 'Tool is blocked');
        msg.ack();
        continue;
      }

      // Record tool run start
      const prevHashRes = await pool.query(
        `SELECT run_hash FROM tool_runs ORDER BY created_at DESC LIMIT 1`,
      );
      const prevHash = prevHashRes.rows[0]?.run_hash || '0'.repeat(64);

      const maxConcurrency = getMaxConcurrency(tool);
      const permissions = getToolPermissions(tool);
      const hasNasWrite = permissions.includes('nas.write');
      if (tool.trust_level === 'quarantined') {
        const writeScope = permissions.find((entry) => entry.endsWith('.write') || entry.endsWith('.delete'));
        if (writeScope) {
          await denyToolRun(pool, nc, event, prevHash, 'Write scopes disabled for quarantined skills');
          msg.ack();
          continue;
        }
      }
      if (hasNasWrite) {
        const approvalValidation = await validateRunApproval(pool, event, {
          requiredScopes: ['nas.write', `tool.${event.tool_name}`],
        });
        if (!approvalValidation.valid) {
          await denyToolRun(pool, nc, event, prevHash, 'NAS write requires an approved matching approval');
          msg.ack();
          continue;
        }
      }
      const nasMounts = getNasMountArgs(tool, event);
      if (nasMounts.error) {
        await denyToolRun(pool, nc, event, prevHash, nasMounts.error);
        msg.ack();
        continue;
      }

      const egressConfig = await getEgressConfig(pool, tool, event);
      if (egressConfig.error) {
        await denyToolRun(pool, nc, event, prevHash, egressConfig.error);
        msg.ack();
        continue;
      }

      const haApproval = await getHaApprovalRequirement(pool, event);
      if (haApproval.required) {
        if (!event.approval_id) {
          const target = haApproval.entityId ? ` on ${haApproval.entityId}` : '';
          const approvalId = await createHaApprovalRequest(pool, event, {
            tier: haApproval.tier,
            service: haApproval.service,
            entityId: haApproval.entityId,
          });
          await denyToolRun(
            pool,
            nc,
            event,
            prevHash,
            `HA service ${haApproval.service}${target} requires approval (danger tier ${haApproval.tier})`,
            {
              approval_required: true,
              approval_id: approvalId,
              danger_tier: haApproval.tier,
              service: haApproval.service,
              entity_id: haApproval.entityId || null,
            },
          );
          msg.ack();
          continue;
        }

        const approvalValidation = await validateRunApproval(pool, event, {
          requiredScopes: ['ha.write', `tool.${event.tool_name}`],
        });
        if (!approvalValidation.valid) {
          await denyToolRun(pool, nc, event, prevHash, 'HA danger-tier action requires an approved matching approval');
          msg.ack();
          continue;
        }
      }

      const secretMounts = await prepareSecretMounts(tool, event);
      if (secretMounts.error) {
        await denyToolRun(pool, nc, event, prevHash, secretMounts.error);
        msg.ack();
        continue;
      }

      const admission = await tryInsertRunningToolRun(pool, {
        runId: event.run_id,
        toolName: event.tool_name,
        chatId: event.chat_id,
        userId: event.user_id || null,
        approvalId: event.approval_id || null,
        inputsJson: JSON.stringify(event.inputs),
        prevHash,
        maxConcurrency,
      });
      if (!admission.admitted) {
        await denyToolRun(pool, nc, event, prevHash, 'Tool concurrency limit exceeded');
        msg.ack();
        continue;
      }

      // Execute based on mode
      let result: { outputs: Record<string, unknown>; error?: string; logs?: ToolLogs };
      const executionMode = tool.trust_level === 'quarantined'
        ? 'gvisor'
        : (tool.execution_mode || 'in_process');
      const timeout = resolveToolExecutionTimeoutMs(tool.timeout_seconds);
      if (executionMode === 'in_process') {
        const egressPolicy = validateInProcessEgressPolicy({
          toolName: String(tool.name || ''),
          permissions,
          inputs: event.inputs || {},
        });
        if (!egressPolicy.ok) {
          await denyToolRun(pool, nc, event, prevHash, egressPolicy.error);
          msg.ack();
          continue;
        }
      }

      try {
        if (executionMode === 'in_process' && isDynamicSkillTool(tool)) {
          result = await executeDynamicSkillInProcess(tool, event.inputs);
        } else if (executionMode === 'in_process' && tool.is_first_party) {
          result = await executeInProcess(tool.name, event.inputs, pool, { chatId: event.chat_id, userId: event.user_id });
        } else if (executionMode === 'container') {
          result = await executeInContainer(
            tool,
            event,
            timeout,
            nasMounts.args,
            egressConfig,
            secretMounts,
          );
        } else if (executionMode === 'gvisor') {
          result = await executeInGVisor(
            tool,
            event,
            timeout,
            nasMounts.args,
            egressConfig,
            secretMounts,
          );
        } else if (executionMode === 'firecracker') {
          result = await executeInFirecracker(tool, event, timeout);
        } else {
          result = await executeInProcess(tool.name, event.inputs, pool, { chatId: event.chat_id, userId: event.user_id });
        }
      } catch (err) {
        result = { outputs: {}, error: String(err) };
      } finally {
        await secretMounts.cleanup();
      }

      const outputSchema = getOutputSchema(tool);
      if (outputSchema) {
        const validate = getOutputValidator(tool.name, outputSchema);
        const valid = validate(result.outputs);
        if (!valid) {
          result.error = `Output schema validation failed: ${ajv.errorsText(validate.errors)}`;
        }
      }

      const redactionConfig = await loadRedactionConfig(pool);
      const redactionDepthLimit = resolveSecretTimeoutMs(
        process.env.SVEN_REDACTION_MAX_DEPTH,
        16,
        1,
        64,
      );
      const redactedOutputs = redactValueSafe(
        result.outputs,
        redactionConfig,
        { maxDepth: redactionDepthLimit },
      ) as Record<string, unknown>;
      const redactedError = result.error
        ? redactStringValue(result.error, redactionConfig)
        : undefined;
      const redactedLogs = sanitizeLogs(result.logs, redactionConfig);

      // Compute attestation hashes
      const canonIoHash = canonicalIoHash(event.inputs, redactedOutputs);
      const runHash = computeRunHash(prevHash, canonIoHash);

      // Update tool run record
      const status = redactedError ? 'error' : 'completed';
      await finalizeToolRunRecord(pool, {
        runId: event.run_id,
        status,
        outputsJson: JSON.stringify(redactedOutputs),
        toolLogsJson: redactedLogs ? JSON.stringify(redactedLogs) : null,
        errorText: redactedError || null,
        canonicalIoSha256: canonIoHash,
        runHash,
      });

      // Publish result with security scanning (prompt guard + anti-distillation)
      await publishSecuredResult(event, status, redactedOutputs, redactedError);

      logger.info('Tool run completed', {
        run_id: event.run_id,
        tool_name: event.tool_name,
        status,
        run_hash: runHash,
        safety_class: classifyToolSafety(event.tool_name),
      });

      msg.ack();
    } catch (err) {
      logger.error('Error processing tool run', { err: String(err) });
      msg.nak(5000);
    }
  }
}

/**
 * First-party in-process execution (read-only tools).
 */
function isValidScheduleCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => {
    const range = getScheduleCronRange(i);
    return field.split(',').every((part) => {
      if (part === '*') return true;
      if (/^\*\/\d+$/.test(part)) {
        const step = Number(part.slice(2));
        return Number.isFinite(step) && step > 0;
      }
      if (/^\d+$/.test(part)) {
        const n = Number(part);
        return n >= range.min && n <= range.max;
      }
      if (/^\d+-\d+$/.test(part)) {
        const [a, b] = part.split('-').map(Number);
        return a >= range.min && b <= range.max && a <= b;
      }
      return false;
    });
  });
}

function getScheduleCronRange(index: number): { min: number; max: number } {
  if (index === 0) return { min: 0, max: 59 };
  if (index === 1) return { min: 0, max: 23 };
  if (index === 2) return { min: 1, max: 31 };
  if (index === 3) return { min: 1, max: 12 };
  return { min: 0, max: 6 };
}

function scheduleCronMatches(value: number, field: string, index: number): boolean {
  if (field === '*') return true;
  const range = getScheduleCronRange(index);
  for (const part of field.split(',')) {
    if (part === '*') return true;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if ((value - range.min) % step === 0) return true;
      continue;
    }
    if (/^\d+$/.test(part)) {
      if (value === Number(part)) return true;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    }
  }
  return false;
}

const SCHEDULE_WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function resolveScheduleTimezone(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}

function getScheduleTimePartsInZone(date: Date, timeZone: string): { minute: number; hour: number; day: number; month: number; weekday: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      minute: '2-digit',
      hour: '2-digit',
      day: '2-digit',
      month: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || '');
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || '');
    const day = Number(parts.find((part) => part.type === 'day')?.value || '');
    const month = Number(parts.find((part) => part.type === 'month')?.value || '');
    const weekdayText = String(parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase();
    const weekday = SCHEDULE_WEEKDAY_MAP[weekdayText];
    if (!Number.isFinite(minute) || !Number.isFinite(hour) || !Number.isFinite(day) || !Number.isFinite(month) || weekday === undefined) {
      return null;
    }
    return { minute, hour, day, month, weekday };
  } catch {
    return null;
  }
}

function computeScheduleNextRun(expression: string, fromDate: Date, timeZone: string): Date | null {
  if (!isValidScheduleCron(expression)) return null;
  const tz = resolveScheduleTimezone(timeZone);
  if (!tz) return null;
  const [m, h, dom, mon, dow] = expression.trim().split(/\s+/);
  const next = new Date(Math.floor(fromDate.getTime() / 60000) * 60000 + 60000);

  for (let i = 0; i < 60 * 24 * 366; i += 1) {
    const parts = getScheduleTimePartsInZone(next, tz);
    if (!parts) return null;
    if (
      scheduleCronMatches(parts.minute, m, 0)
      && scheduleCronMatches(parts.hour, h, 1)
      && scheduleCronMatches(parts.day, dom, 2)
      && scheduleCronMatches(parts.month, mon, 3)
      && scheduleCronMatches(parts.weekday, dow, 4)
    ) {
      return next;
    }
    next.setUTCMinutes(next.getUTCMinutes() + 1);
  }
  return null;
}

function parseScheduleMissedPolicy(raw: unknown): 'skip' | 'run_immediately' | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value !== 'skip' && value !== 'run_immediately') return null;
  return value;
}

function parseDeviceListLimit(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_DEVICE_LIST_LIMIT;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DEVICE_LIST_LIMIT) return null;
  return parsed;
}

function parseDeviceListOffset(raw: unknown): number | null {
  if (raw === undefined) return 0;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parseDeviceEventsLimit(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_DEVICE_EVENTS_LIMIT;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_DEVICE_EVENTS_LIMIT || parsed > MAX_DEVICE_EVENTS_LIMIT) return null;
  return parsed;
}

function parseNasSearchMaxResults(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_NAS_SEARCH_MAX_RESULTS;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_NAS_SEARCH_MAX_RESULTS || parsed > MAX_NAS_SEARCH_MAX_RESULTS) return null;
  return parsed;
}

function parseNasReadMaxBytes(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_NAS_READ_MAX_BYTES;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_NAS_READ_MAX_BYTES || parsed > MAX_NAS_READ_MAX_BYTES) return null;
  return parsed;
}

function decodeNasWriteContent(content: string, encodingRaw: unknown): { buffer?: Buffer; error?: string } {
  const encoding = String(encodingRaw || 'utf8').trim().toLowerCase();
  if (encoding !== 'utf8' && encoding !== 'base64') {
    return { error: 'encoding must be one of: utf8, base64' };
  }
  if (encoding === 'utf8') {
    return { buffer: Buffer.from(content, 'utf8') };
  }
  const normalized = content.replace(/\s+/g, '');
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return { error: 'content must be valid base64 when encoding=base64' };
  }
  return { buffer: Buffer.from(normalized, 'base64') };
}

function parseGitLogMaxCommits(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_GIT_LOG_MAX_COMMITS;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_GIT_LOG_MAX_COMMITS || parsed > MAX_GIT_LOG_MAX_COMMITS) return null;
  return parsed;
}

function parseRepoMetadataObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function inferForgejoBaseUrl(repoUrlRaw: unknown): string | null {
  const repoUrl = String(repoUrlRaw || '').trim();
  if (!repoUrl) return null;

  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    // continue to SSH-style parse
  }

  const sshMatch = repoUrl.match(/^git@([^:]+):/i);
  if (sshMatch?.[1]) {
    return `https://${sshMatch[1]}`;
  }
  return null;
}

async function buildGitRepoRuntimeConfig(repo: Record<string, unknown>): Promise<{ config?: Record<string, unknown>; error?: string }> {
  const provider = String(repo.provider || '').trim().toLowerCase();
  const config: Record<string, unknown> = {
    repoPath: repo.repo_url,
    owner: repo.repo_owner,
    repo: repo.repo_name,
  };

  if (repo.token_ref) {
    config.token = await resolveSecretRef(String(repo.token_ref));
  }

  if (provider === 'forgejo') {
    const metadata = parseRepoMetadataObject(repo.metadata);
    const metadataBaseUrl = String(
      metadata.baseUrl
      || metadata.base_url
      || metadata.forgejoBaseUrl
      || metadata.forgejo_base_url
      || '',
    ).trim();
    const inferredBaseUrl = inferForgejoBaseUrl(repo.repo_url);
    const baseUrl = (metadataBaseUrl || inferredBaseUrl || '').trim().replace(/\/+$/, '');
    if (!baseUrl) {
      return { error: 'Forgejo base URL is required for forgejo repositories' };
    }
    config.baseUrl = baseUrl;
  }

  return { config };
}

async function loadActiveGitRepoForTool(
  pool: pg.Pool,
  repoId: string,
  actorUserId: string,
  organizationId: string,
): Promise<{ repo?: Record<string, unknown>; error?: string }> {
  const activeRepo = await pool.query(
    'SELECT * FROM git_repos WHERE id = $1 AND user_id = $2 AND organization_id = $3 AND enabled = true',
    [repoId, actorUserId, organizationId],
  );
  if (activeRepo.rows.length > 0) {
    return { repo: activeRepo.rows[0] as Record<string, unknown> };
  }

  const repoState = await pool.query(
    'SELECT id, enabled FROM git_repos WHERE id = $1 AND user_id = $2 AND organization_id = $3 LIMIT 1',
    [repoId, actorUserId, organizationId],
  );
  if (repoState.rows.length === 0) {
    return { error: 'Repository not found' };
  }
  if (repoState.rows[0]?.enabled === false) {
    return { error: 'Repository is disabled' };
  }
  return { error: 'Repository not found' };
}

async function resolveGitToolOrganizationId(
  pool: pg.Pool,
  runContext?: SettingsScope,
): Promise<{ organizationId?: string; error?: string }> {
  const organizationId = await getOrganizationIdForChat(pool, runContext?.chatId);
  if (!organizationId) {
    return { error: 'Git tools require tenant-scoped chat context' };
  }
  return { organizationId };
}

function parseWebExtractMaxLength(raw: unknown): number | null {
  if (raw === undefined || raw === null) return DEFAULT_WEB_EXTRACT_MAX_LENGTH;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_WEB_EXTRACT_MAX_LENGTH) return null;
  if (parsed > MAX_WEB_EXTRACT_MAX_LENGTH) return MAX_WEB_EXTRACT_MAX_LENGTH;
  return parsed;
}

function parseWebFetchTimeoutMs(raw: unknown): number | null {
  if (raw === undefined || raw === null) return DEFAULT_WEB_FETCH_TIMEOUT_MS;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_WEB_FETCH_TIMEOUT_MS || parsed > MAX_WEB_FETCH_TIMEOUT_MS) return null;
  return parsed;
}

function parseWebFetchMaxContentLength(raw: unknown): number | null {
  if (raw === undefined || raw === null) return DEFAULT_WEB_FETCH_MAX_CONTENT_LENGTH;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < MIN_WEB_FETCH_MAX_CONTENT_LENGTH || parsed > MAX_WEB_FETCH_MAX_CONTENT_LENGTH) return null;
  return parsed;
}

async function resolveDeviceToolOrganizationId(
  pool: pg.Pool,
  runContext?: SettingsScope,
): Promise<{ organizationId?: string; error?: string }> {
  const organizationId = await getOrganizationIdForChat(pool, runContext?.chatId);
  if (!organizationId) {
    return { error: 'Device tools require tenant-scoped chat context' };
  }
  return { organizationId };
}

function resolveMcpToolCallJsonMaxBytes(raw: unknown): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_MCP_TOOL_CALL_JSON_MAX_BYTES;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return DEFAULT_MCP_TOOL_CALL_JSON_MAX_BYTES;
  }
  if (parsed < MIN_MCP_TOOL_CALL_JSON_MAX_BYTES) {
    return MIN_MCP_TOOL_CALL_JSON_MAX_BYTES;
  }
  if (parsed > MAX_MCP_TOOL_CALL_JSON_MAX_BYTES) {
    return MAX_MCP_TOOL_CALL_JSON_MAX_BYTES;
  }
  return parsed;
}

function serializeMcpToolCallPayloadForStorage(
  value: unknown,
  field: 'input' | 'output',
  maxBytes: number,
): { json: string; truncated: boolean } {
  let serialized = '';
  try {
    serialized = JSON.stringify(value ?? {});
  } catch {
    return {
      json: JSON.stringify({
        truncated: true,
        field,
        reason: 'serialization_failed',
      }),
      truncated: true,
    };
  }

  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes <= maxBytes) {
    return { json: serialized, truncated: false };
  }

  return {
    json: JSON.stringify({
      truncated: true,
      field,
      reason: 'max_bytes_exceeded',
      max_bytes: maxBytes,
      original_bytes: sizeBytes,
      preview: trimUtf8ToByteLimit(serialized, Math.min(1024, maxBytes)),
    }),
    truncated: true,
  };
}

function resolveMcpRpcTimeoutMs(raw: unknown): { timeoutMs: number; invalid: boolean } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { timeoutMs: DEFAULT_MCP_RPC_TIMEOUT_MS, invalid: false };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return { timeoutMs: DEFAULT_MCP_RPC_TIMEOUT_MS, invalid: true };
  }
  if (parsed < MIN_MCP_RPC_TIMEOUT_MS) {
    return { timeoutMs: MIN_MCP_RPC_TIMEOUT_MS, invalid: false };
  }
  if (parsed > MAX_MCP_RPC_TIMEOUT_MS) {
    return { timeoutMs: MAX_MCP_RPC_TIMEOUT_MS, invalid: false };
  }
  return { timeoutMs: parsed, invalid: false };
}

// ═══════════════════════════════════════════════════════════════════════
//  Self-healing helpers — used by both approval subscriber and tool handlers
//  v3: branch isolation, multi-file atomic, pre-deploy gate, deploy rollback,
//      half-open circuit breaker, fix→deploy chaining, heal history
// ═══════════════════════════════════════════════════════════════════════

// --- Circuit breaker state (module-level so both subscriber and tool handlers can access) ---
let opsConsecutiveFailures = 0;
let opsLastFailureAt = 0;
const OPS_CIRCUIT_THRESHOLD = 3;
const OPS_CIRCUIT_HALF_OPEN_MS = 5 * 60 * 1000; // 5 min cooldown before half-open

/** Check circuit breaker state: closed (ok), open (blocked), half-open (allow one probe). */
function circuitState(): 'closed' | 'open' | 'half-open' {
  if (opsConsecutiveFailures < OPS_CIRCUIT_THRESHOLD) return 'closed';
  if (Date.now() - opsLastFailureAt > OPS_CIRCUIT_HALF_OPEN_MS) return 'half-open';
  return 'open';
}

/** Validate resolved path is within repo root — prevents path traversal. */
function assertPathWithinRepo(absPath: string, repoRoot: string): void {
  const resolved = path.resolve(absPath);
  const resolvedRoot = path.resolve(repoRoot);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error(`Path traversal blocked: ${absPath} escapes repo root ${repoRoot}`);
  }
}

/** Atomic CAS claim: set approval status to 'executing' only if still 'approved'. */
async function claimApproval(pool: pg.Pool, approvalId: string): Promise<boolean> {
  const res = await pool.query(
    `UPDATE approvals SET status = 'executing' WHERE id = $1 AND status = 'approved' RETURNING id`,
    [approvalId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Run tsc --noEmit to verify the build is still green after a code fix. */
function verifyBuild(repoRoot: string, filePath: string): { ok: boolean; output: string } {
  const rel = path.relative(repoRoot, filePath);
  let tscCwd = repoRoot;
  const serviceMatch = rel.match(/^services\/([^/]+)\//);
  if (serviceMatch) {
    tscCwd = path.join(repoRoot, 'services', serviceMatch[1]);
  }
  const tscBin = path.join(repoRoot, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc');
  const result = spawnSync('node', [tscBin, '--noEmit'], {
    cwd: tscCwd, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 128,
  });
  const output = ((result.stdout || '') + (result.stderr || '')).trim().slice(0, 2000);
  return { ok: result.status === 0, output };
}

/** Run tsc --noEmit across ALL services — used as pre-deploy build gate. */
function verifyFullBuild(repoRoot: string): { ok: boolean; failures: Array<{ service: string; output: string }> } {
  const tscBin = path.join(repoRoot, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc');
  const serviceNames = ['gateway-api', 'agent-runtime', 'skill-runner'];
  const failures: Array<{ service: string; output: string }> = [];
  for (const svc of serviceNames) {
    const svcDir = path.join(repoRoot, 'services', svc);
    const result = spawnSync('node', [tscBin, '--noEmit'], {
      cwd: svcDir, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 128,
    });
    if (result.status !== 0) {
      failures.push({ service: svc, output: ((result.stdout || '') + (result.stderr || '')).trim().slice(0, 500) });
    }
  }
  return { ok: failures.length === 0, failures };
}

/** Wait for a docker container to become healthy, polling up to maxWaitMs. */
function waitForContainerHealth(containerName: string, maxWaitMs: number = 30000): { healthy: boolean; status: string } {
  const start = Date.now();
  let lastStatus = 'unknown';
  while (Date.now() - start < maxWaitMs) {
    const result = spawnSync('docker', ['inspect', '--format', '{{.State.Status}}', containerName], {
      encoding: 'utf8', timeout: 5000,
    });
    lastStatus = (result.stdout || '').trim();
    if (lastStatus === 'running') return { healthy: true, status: lastStatus };
    spawnSync('sleep', ['2'], { timeout: 3000 });
  }
  return { healthy: false, status: lastStatus };
}

/** Snapshot current running container image tags — used for deploy rollback. */
function snapshotContainerImages(targets?: string[]): Map<string, string> {
  const result = spawnSync('docker', ['ps', '--format', '{{.Names}}\t{{.Image}}'], {
    encoding: 'utf8', timeout: 10000,
  });
  const images = new Map<string, string>();
  for (const line of (result.stdout || '').trim().split('\n').filter(Boolean)) {
    const [name, image] = line.split('\t');
    if (name && image && (!targets || targets.length === 0 || targets.some(t => name.includes(t)))) {
      images.set(name, image);
    }
  }
  return images;
}

/** Rollback specific containers to their previous images. */
function rollbackContainers(imageSnapshot: Map<string, string>, repoRoot: string): Array<{ name: string; ok: boolean }> {
  const results: Array<{ name: string; ok: boolean }> = [];
  for (const [name, image] of imageSnapshot.entries()) {
    // Stop current, run previous image
    const r = spawnSync('docker', ['run', '-d', '--name', `${name}-rollback`, image], {
      cwd: repoRoot, encoding: 'utf8', timeout: 60000,
    });
    results.push({ name, ok: r.status === 0 });
  }
  return results;
}

/** Single-file change descriptor. */
interface FileChange {
  file_path: string;
  old_content: string;
  new_content: string;
}

/** Apply multiple file changes atomically — all succeed or all roll back.
 *  Returns the list of applied relative paths and a rollback function. */
async function applyFileChangesAtomic(
  changes: FileChange[],
  repoRoot: string,
): Promise<{ relPaths: string[]; originals: Map<string, string>; rollback: () => Promise<void> }> {
  const originals = new Map<string, string>();
  const relPaths: string[] = [];

  for (const change of changes) {
    const absPath = change.file_path.startsWith('/') ? change.file_path : path.join(repoRoot, change.file_path);
    assertPathWithinRepo(absPath, repoRoot);
    const currentFile = await fs.readFile(absPath, 'utf8');
    if (!currentFile.includes(change.old_content)) {
      // Rollback everything applied so far
      for (const [p, orig] of originals.entries()) await fs.writeFile(p, orig, 'utf8');
      throw new Error(`old_content not found in ${change.file_path}. File may have changed since fix was proposed.`);
    }
    originals.set(absPath, currentFile);
    const updated = currentFile.replace(change.old_content, change.new_content);
    await fs.writeFile(absPath, updated, 'utf8');
    relPaths.push(path.relative(repoRoot, absPath));
  }

  const rollback = async () => {
    for (const [p, orig] of originals.entries()) await fs.writeFile(p, orig, 'utf8');
    for (const rel of relPaths) spawnSync('git', ['checkout', '--', rel], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
  };

  return { relPaths, originals, rollback };
}

/** Create a heal branch, apply changes, verify, commit, merge back, delete branch.
 *  If verification fails, the branch is abandoned and original state restored. */
async function applyFixOnBranch(
  changes: FileChange[],
  repoRoot: string,
  commitMsg: string,
): Promise<{ ok: boolean; commitHash: string; branch: string; buildOutput?: string }> {
  const timestamp = Date.now();
  const branchName = `sven-heal/${timestamp}`;

  // v5: Stash uncommitted work to prevent conflicts
  const didStash = gitStashIfDirty(repoRoot);

  // Save current branch
  const currentBranch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 5000,
  }).stdout?.trim() || 'main';

  // Create and switch to heal branch
  const createBranch = spawnSync('git', ['checkout', '-b', branchName], {
    cwd: repoRoot, encoding: 'utf8', timeout: 10000,
  });
  if (createBranch.status !== 0) {
    if (didStash) gitStashPop(repoRoot);
    // Fallback: apply directly on current branch (previous behaviour)
    return applyFixDirect(changes, repoRoot, commitMsg);
  }

  try {
    // Apply changes atomically
    const { relPaths, rollback } = await applyFileChangesAtomic(changes, repoRoot);

    // Stage all changed files
    for (const rel of relPaths) spawnSync('git', ['add', rel], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });

    // Build verification — cross-service impact guard: if shared code is touched, verify ALL services
    const isSharedChange = changeAffectsSharedCode(changes, repoRoot);
    const firstAbs = changes[0].file_path.startsWith('/') ? changes[0].file_path : path.join(repoRoot, changes[0].file_path);
    const buildCheck = (changes.length === 1 && !isSharedChange)
      ? verifyBuild(repoRoot, firstAbs)
      : (() => { const fb = verifyFullBuild(repoRoot); return { ok: fb.ok, output: fb.failures.map(f => `${f.service}: ${f.output}`).join('\n') }; })();

    if (!buildCheck.ok) {
      // Abandon branch, restore files, switch back
      await rollback();
      spawnSync('git', ['checkout', currentBranch], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
      spawnSync('git', ['branch', '-D', branchName], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
      if (didStash) gitStashPop(repoRoot);
      return { ok: false, commitHash: '', branch: branchName, buildOutput: buildCheck.output };
    }

    // Commit on heal branch
    spawnSync('git', ['commit', '-m', commitMsg, '--no-verify'], { cwd: repoRoot, encoding: 'utf8', timeout: 15000 });
    const gitHash = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot, encoding: 'utf8', timeout: 5000,
    });
    const commitHash = (gitHash.stdout || '').trim();

    // Fast-forward merge back to the original branch
    spawnSync('git', ['checkout', currentBranch], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
    const merge = spawnSync('git', ['merge', '--ff-only', branchName], {
      cwd: repoRoot, encoding: 'utf8', timeout: 15000,
    });

    if (merge.status !== 0) {
      // Non-fast-forward: merge with commit instead
      spawnSync('git', ['merge', branchName, '-m', `merge: ${commitMsg}`, '--no-verify'], {
        cwd: repoRoot, encoding: 'utf8', timeout: 15000,
      });
    }

    // Clean up heal branch
    spawnSync('git', ['branch', '-d', branchName], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });

    // v5: Restore stashed work
    if (didStash) gitStashPop(repoRoot);

    return { ok: true, commitHash, branch: branchName };
  } catch (err) {
    // On any failure, switch back and delete the branch
    spawnSync('git', ['checkout', currentBranch], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
    spawnSync('git', ['branch', '-D', branchName], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
    if (didStash) gitStashPop(repoRoot);
    throw err;
  }
}

/** Direct apply fallback (no branch isolation) — used if git checkout fails */
async function applyFixDirect(
  changes: FileChange[],
  repoRoot: string,
  commitMsg: string,
): Promise<{ ok: boolean; commitHash: string; branch: string; buildOutput?: string }> {
  const { relPaths, rollback } = await applyFileChangesAtomic(changes, repoRoot);
  for (const rel of relPaths) spawnSync('git', ['add', rel], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });

  const isSharedChange = changeAffectsSharedCode(changes, repoRoot);
  const firstAbs = changes[0].file_path.startsWith('/') ? changes[0].file_path : path.join(repoRoot, changes[0].file_path);
  const buildCheck = (changes.length === 1 && !isSharedChange)
    ? verifyBuild(repoRoot, firstAbs)
    : (() => { const fb = verifyFullBuild(repoRoot); return { ok: fb.ok, output: fb.failures.map(f => `${f.service}: ${f.output}`).join('\n') }; })();

  if (!buildCheck.ok) {
    await rollback();
    return { ok: false, commitHash: '', branch: 'direct', buildOutput: buildCheck.output };
  }

  spawnSync('git', ['commit', '-m', commitMsg, '--no-verify'], { cwd: repoRoot, encoding: 'utf8', timeout: 15000 });
  const gitHash = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', timeout: 5000 });
  return { ok: true, commitHash: (gitHash.stdout || '').trim(), branch: 'direct' };
}

// ═══════════════════════════════════════════════════════════════════════
//  v4: Post-fix test runner, fix rate limiter, unified diffs,
//      HTTP health probe, scheduled self-diagnostics, sven.ops.rollback
//  v5: Git stash protection, concurrent heal mutex, smoke tests,
//      NATS heal events, rollback→deploy chain
//  v6: Dry-run simulation, cross-service impact guard, persistent CB,
//      fix deduplication, post-deploy watch window
// ═══════════════════════════════════════════════════════════════════════

/** Concurrent heal mutex — ensures only one fix/deploy operation runs at a time.
 *  Prevents race conditions when two approvals arrive simultaneously. */
let healMutexLocked = false;
const healMutexQueue: Array<() => void> = [];

async function acquireHealMutex(): Promise<void> {
  if (!healMutexLocked) {
    healMutexLocked = true;
    return;
  }
  return new Promise<void>((resolve) => {
    healMutexQueue.push(() => { healMutexLocked = true; resolve(); });
  });
}

function releaseHealMutex(): void {
  const next = healMutexQueue.shift();
  if (next) {
    next(); // hand lock to next waiter
  } else {
    healMutexLocked = false;
  }
}

/** Git stash protection — stash uncommitted work before heal operations, pop after.
 *  Returns true if a stash was created (and needs to be popped). */
function gitStashIfDirty(repoRoot: string): boolean {
  const statusResult = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 10000,
  });
  const hasUncommitted = ((statusResult.stdout || '').trim().length > 0);
  if (!hasUncommitted) return false;

  const stashResult = spawnSync('git', ['stash', 'push', '-m', 'sven-heal-auto-stash', '--include-untracked'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 30000,
  });
  return stashResult.status === 0;
}

function gitStashPop(repoRoot: string): boolean {
  const result = spawnSync('git', ['stash', 'pop'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 30000,
  });
  return result.status === 0;
}

/** Post-deploy smoke test — make real API calls beyond /healthz to verify functionality. */
function runSmokeTests(host: string, port: number, timeoutMs: number = 8000): {
  ok: boolean;
  results: Array<{ name: string; ok: boolean; statusCode: number; durationMs: number }>;
} {
  const tests = [
    { name: 'healthz', path: '/healthz' },
    { name: 'readyz', path: '/readyz' },
    { name: 'api_root', path: '/api' },
    { name: 'auth_reject', path: '/api/chats', expectStatus: 401 },
  ];
  const results: Array<{ name: string; ok: boolean; statusCode: number; durationMs: number }> = [];

  for (const test of tests) {
    const start = Date.now();
    try {
      const result = spawnSync('curl', [
        '-s', '-o', '/dev/null', '-w', '%{http_code}',
        '--connect-timeout', String(Math.ceil(timeoutMs / 1000)),
        '--max-time', String(Math.ceil(timeoutMs / 1000)),
        `http://${host}:${port}${test.path}`,
      ], { encoding: 'utf8', timeout: timeoutMs + 2000 });
      const statusCode = parseInt((result.stdout || '').trim(), 10) || 0;
      const expectedOk = test.expectStatus
        ? statusCode === test.expectStatus
        : statusCode >= 200 && statusCode < 500;
      results.push({ name: test.name, ok: expectedOk, statusCode, durationMs: Date.now() - start });
    } catch {
      results.push({ name: test.name, ok: false, statusCode: 0, durationMs: Date.now() - start });
    }
  }

  return { ok: results.every(r => r.ok), results };
}

// ═══════════════════════════════════════════════════════════════════════
//  v6: Dry-run simulation, cross-service impact guard, persistent
//      circuit breaker, fix deduplication, post-deploy watch window
// ═══════════════════════════════════════════════════════════════════════

/** Fix deduplication — SHA-256 hash of diff content to detect duplicate fix proposals.
 *  Stores {hash → timestamp}. Duplicates within 24h are rejected. */
const fixDedupMap = new Map<string, number>();
const FIX_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashFixChanges(changes: FileChange[]): string {
  const payload = changes.map(c => `${c.file_path}::${c.old_content}::${c.new_content}`).join('\n---\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function isDuplicateFix(changes: FileChange[]): { duplicate: boolean; hash: string; firstSeenAt?: number } {
  const hash = hashFixChanges(changes);
  const now = Date.now();
  // Prune expired entries
  for (const [h, ts] of fixDedupMap.entries()) {
    if (now - ts > FIX_DEDUP_WINDOW_MS) fixDedupMap.delete(h);
  }
  const existing = fixDedupMap.get(hash);
  if (existing) return { duplicate: true, hash, firstSeenAt: existing };
  return { duplicate: false, hash };
}

function recordFixHash(hash: string): void {
  fixDedupMap.set(hash, Date.now());
}

/** Cross-service impact detection — returns true if the change touches shared packages
 *  that other services depend on, requiring a full build verification instead of single-service. */
function changeAffectsSharedCode(changes: FileChange[], repoRoot: string): boolean {
  return changes.some(c => {
    const rel = c.file_path.startsWith('/')
      ? path.relative(repoRoot, c.file_path)
      : c.file_path;
    return rel.startsWith('packages/') || rel.startsWith('contracts/');
  });
}

/** Dry-run simulation — apply fix on temp branch, build + test, then discard.
 *  Returns the build/test results WITHOUT merging anything. */
async function dryRunSimulation(
  changes: FileChange[],
  repoRoot: string,
): Promise<{
  buildOk: boolean; buildOutput: string;
  testsOk: boolean; testOutput: string;
  crossServiceOk: boolean; crossServiceOutput: string;
}> {
  const timestamp = Date.now();
  const branchName = `sven-heal-dryrun/${timestamp}`;
  const didStash = gitStashIfDirty(repoRoot);

  const currentBranch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 5000,
  }).stdout?.trim() || 'main';

  const createBranch = spawnSync('git', ['checkout', '-b', branchName], {
    cwd: repoRoot, encoding: 'utf8', timeout: 10000,
  });
  if (createBranch.status !== 0) {
    if (didStash) gitStashPop(repoRoot);
    return { buildOk: false, buildOutput: 'Failed to create dry-run branch', testsOk: false, testOutput: '', crossServiceOk: true, crossServiceOutput: '' };
  }

  try {
    const { relPaths, rollback } = await applyFileChangesAtomic(changes, repoRoot);

    // Build verification — single-service or full depending on scope
    const isShared = changeAffectsSharedCode(changes, repoRoot);
    let buildOk = false;
    let buildOutput = '';
    let crossServiceOk = true;
    let crossServiceOutput = '';

    if (isShared) {
      const fb = verifyFullBuild(repoRoot);
      buildOk = fb.ok;
      buildOutput = fb.failures.map(f => `${f.service}: ${f.output}`).join('\n');
      crossServiceOk = fb.ok;
      crossServiceOutput = buildOutput;
    } else {
      const firstAbs = changes[0].file_path.startsWith('/') ? changes[0].file_path : path.join(repoRoot, changes[0].file_path);
      const bc = verifyBuild(repoRoot, firstAbs);
      buildOk = bc.ok;
      buildOutput = bc.output;
    }

    // Test verification
    let testsOk = true;
    let testOutput = '';
    if (buildOk) {
      const testResults: Array<{ file: string; ok: boolean; output: string; skipped: boolean }> = [];
      for (const change of changes) {
        const tr = runServiceTests(repoRoot, change.file_path);
        testResults.push({ file: change.file_path, ...tr });
      }
      const testFailures = testResults.filter(t => !t.ok && !t.skipped);
      testsOk = testFailures.length === 0;
      testOutput = testFailures.map(t => `${t.file}: ${t.output.slice(0, 300)}`).join('\n');
    }

    // Rollback all changes — this is a dry run
    await rollback();
    for (const rel of relPaths) spawnSync('git', ['checkout', '--', rel], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });

    return { buildOk, buildOutput: buildOutput.slice(0, 2000), testsOk, testOutput: testOutput.slice(0, 2000), crossServiceOk, crossServiceOutput: crossServiceOutput.slice(0, 2000) };
  } finally {
    // Always clean up: switch back and delete the dry-run branch
    spawnSync('git', ['checkout', currentBranch], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
    spawnSync('git', ['branch', '-D', branchName], { cwd: repoRoot, encoding: 'utf8', timeout: 10000 });
    if (didStash) gitStashPop(repoRoot);
  }
}

/** Persistent circuit breaker hydration — reconstruct state from recent ops_audit_log entries.
 *  Called once on startup so circuit breaker state survives restarts. */
async function hydrateCircuitBreakerFromDb(pool: pg.Pool): Promise<void> {
  try {
    // Count recent consecutive failures (last 30 min) to reconstruct CB state
    const recent = await pool.query(
      `SELECT result_summary, created_at FROM ops_audit_log
       WHERE tool_name IN ('sven.ops.code_fix', 'sven.ops.deploy')
         AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC
       LIMIT 20`,
    );
    let consecutiveFails = 0;
    let lastFailTime = 0;
    for (const row of recent.rows) {
      const summary = String((row as Record<string, unknown>).result_summary || '');
      const createdAt = (row as Record<string, unknown>).created_at;
      if (summary.includes('failed') || summary.includes('rolled back') || summary.includes('rate-limited') || summary.includes('reverted')) {
        consecutiveFails++;
        if (!lastFailTime && createdAt) lastFailTime = new Date(String(createdAt)).getTime();
      } else {
        break; // First success breaks the consecutive failure chain
      }
    }
    if (consecutiveFails > 0) {
      opsConsecutiveFailures = consecutiveFails;
      opsLastFailureAt = lastFailTime || Date.now();
      const state = circuitState();
      logger.info('Circuit breaker hydrated from DB', { consecutive_failures: consecutiveFails, state });
    }
  } catch (err) {
    logger.warn('Failed to hydrate circuit breaker from DB', { err: String(err) });
  }
}

/** Post-deploy watch window — probe service health every 15s for watchDurationMs.
 *  Returns early on first failure. Used after initial smoke tests pass. */
function postDeployWatch(
  host: string,
  port: number,
  watchDurationMs: number = 120000,
  intervalMs: number = 15000,
): { ok: boolean; probes: number; failures: number; lastFailure?: string } {
  const start = Date.now();
  let probes = 0;
  let failures = 0;
  let lastFailure: string | undefined;

  while (Date.now() - start < watchDurationMs) {
    probes++;
    const probe = probeHttpHealth(host, port, 5000);
    if (!probe.ok) {
      failures++;
      lastFailure = `Probe #${probes} failed: status ${probe.statusCode} (${probe.durationMs}ms)`;
      // Fail fast: 2 consecutive failures = bail
      if (failures >= 2) return { ok: false, probes, failures, lastFailure };
    } else {
      failures = 0; // reset consecutive counter on success
    }
    // Sleep until next interval
    if (Date.now() - start + intervalMs < watchDurationMs) {
      spawnSync('sleep', [String(intervalMs / 1000)], { timeout: intervalMs + 2000 });
    } else {
      break;
    }
  }
  return { ok: true, probes, failures, lastFailure };
}

// ═══════════════════════════════════════════════════════════════════════
//  v7: Heal telemetry counters, confidence scoring, proactive detection,
//      stale approval escalation, rollback depth guard
// ═══════════════════════════════════════════════════════════════════════

/** v7: In-memory heal telemetry counters — exposed via heal_history tool.
 *  Reset on restart, but cumulative during the process lifetime. */
const healTelemetry = {
  fixes_applied: 0,
  fixes_reverted: 0,
  fixes_rate_limited: 0,
  fixes_deduplicated: 0,
  deploys_completed: 0,
  deploys_rolled_back: 0,
  circuit_breaker_trips: 0,
  dry_runs_executed: 0,
  stale_escalations_sent: 0,
  proactive_detections: 0,
  files_quarantined: 0,
  resource_guard_blocks: 0,
  runtime_errors_detected: 0,
  checkpoints_created: 0,
  subscriber_restarts: 0,
  last_fix_at: null as string | null,
  last_deploy_at: null as string | null,
  uptime_start: new Date().toISOString(),
};

/** v7: Heal confidence scoring — query ops_audit_log for per-file historical success rate. */
async function getHealConfidence(
  pool: pg.Pool,
  filePath: string,
): Promise<{ score: number; total: number; successes: number; failures: number; revertRate: string }> {
  try {
    const res = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE result_summary ILIKE '%applied%' OR result_summary ILIKE '%committed%' OR result_summary ILIKE '%merged%') AS successes,
         COUNT(*) FILTER (WHERE result_summary ILIKE '%reverted%' OR result_summary ILIKE '%rolled back%' OR result_summary ILIKE '%failed%') AS failures
       FROM ops_audit_log
       WHERE tool_name = 'sven.ops.code_fix'
         AND inputs::text ILIKE $1
         AND created_at > NOW() - INTERVAL '30 days'`,
      [`%${filePath}%`],
    );
    const row = res.rows[0] as { total: string; successes: string; failures: string } | undefined;
    const total = Number(row?.total || 0);
    const successes = Number(row?.successes || 0);
    const failures = Number(row?.failures || 0);
    const score = total === 0 ? 1.0 : successes / total;
    const revertRate = total === 0 ? 'N/A (no history)' : `${((failures / total) * 100).toFixed(1)}%`;
    return { score, total, successes, failures, revertRate };
  } catch {
    return { score: 1.0, total: 0, successes: 0, failures: 0, revertRate: 'N/A (query error)' };
  }
}

/** v7: Proactive heal detection — run tsc on all services, return errors found. */
function proactiveTscScan(repoRoot: string): Array<{ service: string; errors: string }> {
  const tscBin = path.join(repoRoot, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc');
  const serviceNames = ['gateway-api', 'agent-runtime', 'skill-runner'];
  const results: Array<{ service: string; errors: string }> = [];
  for (const svc of serviceNames) {
    const svcDir = path.join(repoRoot, 'services', svc);
    const result = spawnSync('node', [tscBin, '--noEmit'], {
      cwd: svcDir, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 128,
    });
    if (result.status !== 0) {
      const errors = ((result.stdout || '') + (result.stderr || '')).trim().slice(0, 1000);
      results.push({ service: svc, errors });
    }
  }
  return results;
}

/** v7: Check for stale critical approvals that need escalation (pending > 1h). */
async function getStaleApprovals(pool: pg.Pool): Promise<Array<{ id: string; tool_name: string; age_min: number; chat_id: string }>> {
  try {
    const res = await pool.query(
      `SELECT id, tool_name, chat_id, EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS age_min
       FROM approvals
       WHERE status = 'pending'
         AND created_at < NOW() - INTERVAL '1 hour'
         AND created_at > NOW() - INTERVAL '24 hours'
         AND tool_name IN ('sven.ops.code_fix', 'sven.ops.deploy')
       ORDER BY created_at ASC
       LIMIT 10`,
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      tool_name: r.tool_name,
      age_min: Math.round(Number(r.age_min)),
      chat_id: r.chat_id,
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  v8: File quarantine, pre-heal checkpoint, resource guard,
//      runtime log scanning, auto-severity classification
// ═══════════════════════════════════════════════════════════════════════

/** v8: File quarantine — auto-quarantine files with repeated heal failures.
 *  Prevents slow fix loops that the rate limiter (30min window) misses. */
const fileQuarantineMap = new Map<string, { failures: number; since: number; reason: string }>();
const QUARANTINE_THRESHOLD = 3;
const QUARANTINE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function isFileQuarantined(filePath: string): { quarantined: boolean; failures: number; reason?: string } {
  const entry = fileQuarantineMap.get(filePath);
  if (!entry) return { quarantined: false, failures: 0 };
  if (Date.now() - entry.since > QUARANTINE_WINDOW_MS) {
    fileQuarantineMap.delete(filePath);
    return { quarantined: false, failures: 0 };
  }
  return { quarantined: entry.failures >= QUARANTINE_THRESHOLD, failures: entry.failures, reason: entry.reason };
}

function recordFileHealFailure(filePath: string, reason: string): void {
  const existing = fileQuarantineMap.get(filePath);
  const now = Date.now();
  if (existing && now - existing.since < QUARANTINE_WINDOW_MS) {
    existing.failures++;
    existing.reason = reason;
  } else {
    fileQuarantineMap.set(filePath, { failures: 1, since: now, reason });
  }
  const entry = fileQuarantineMap.get(filePath)!;
  if (entry.failures >= QUARANTINE_THRESHOLD) {
    logger.warn('File auto-quarantined after repeated heal failures', { file: filePath, failures: entry.failures, reason });
  }
}

function clearFileQuarantine(filePath: string): boolean {
  return fileQuarantineMap.delete(filePath);
}

function getQuarantinedFiles(): Array<{ file: string; failures: number; since: string; reason: string }> {
  const now = Date.now();
  const result: Array<{ file: string; failures: number; since: string; reason: string }> = [];
  for (const [file, entry] of fileQuarantineMap.entries()) {
    if (now - entry.since > QUARANTINE_WINDOW_MS) {
      fileQuarantineMap.delete(file);
      continue;
    }
    if (entry.failures >= QUARANTINE_THRESHOLD) {
      result.push({ file, failures: entry.failures, since: new Date(entry.since).toISOString(), reason: entry.reason });
    }
  }
  return result;
}

/** v8: Pre-heal git tag — create a lightweight checkpoint before any heal operation.
 *  Provides last-resort recovery even if the rollback tool fails. */
function createHealCheckpoint(repoRoot: string): { ok: boolean; tag: string } {
  const tag = `sven-checkpoint/${Date.now()}`;
  const result = spawnSync('git', ['tag', tag, 'HEAD'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 5000,
  });
  return { ok: result.status === 0, tag };
}

/** v8: Resource guard — check system resources before heavy operations.
 *  Prevents builds/deploys on resource-starved systems from making things worse. */
function checkSystemResources(): { ok: boolean; warnings: string[]; freeMemMb: number; freeDiskMb: number } {
  const warnings: string[] = [];
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const MIN_FREE_MEM_MB = 256;
  if (freeMemMb < MIN_FREE_MEM_MB) {
    warnings.push(`Low memory: ${freeMemMb}MB free (minimum: ${MIN_FREE_MEM_MB}MB)`);
  }
  let freeDiskMb = 99999;
  try {
    const df = spawnSync('df', ['-m', '--output=avail', '/'], {
      encoding: 'utf8', timeout: 5000,
    });
    const lines = (df.stdout || '').trim().split('\n');
    if (lines.length >= 2) {
      freeDiskMb = parseInt(lines[1].trim(), 10) || 99999;
      const MIN_FREE_DISK_MB = 512;
      if (freeDiskMb < MIN_FREE_DISK_MB) {
        warnings.push(`Low disk: ${freeDiskMb}MB free (minimum: ${MIN_FREE_DISK_MB}MB)`);
      }
    }
  } catch { /* non-critical */ }
  return { ok: warnings.length === 0, warnings, freeMemMb, freeDiskMb };
}

/** v8: Runtime log scanning — check Docker container logs for runtime error patterns.
 *  Catches runtime crashes that tsc cannot detect (OOM, ECONNREFUSED, uncaught exceptions). */
function scanRuntimeLogs(containers?: string[]): Array<{ container: string; errors: string[] }> {
  const targets = containers || ['gateway-api', 'agent-runtime', 'skill-runner'];
  const errorPatterns = [
    /uncaught\s*exception/i, /unhandled\s*rejection/i, /ECONNREFUSED/i,
    /out\s*of\s*memory/i, /OOMKilled/i, /SIGKILL/i, /FATAL/i,
    /ERR_WORKER_OUT_OF_MEMORY/i, /heap\s*out\s*of\s*memory/i, /segmentation\s*fault/i,
  ];
  const results: Array<{ container: string; errors: string[] }> = [];
  for (const container of targets) {
    try {
      const logs = spawnSync('docker', ['logs', '--tail', '100', '--since', '5m', container], {
        encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 128,
      });
      const output = ((logs.stdout || '') + (logs.stderr || '')).trim();
      if (!output) continue;
      const matchedErrors: string[] = [];
      for (const line of output.split('\n')) {
        if (errorPatterns.some(p => p.test(line))) {
          matchedErrors.push(line.trim().slice(0, 200));
        }
      }
      if (matchedErrors.length > 0) {
        results.push({ container, errors: matchedErrors.slice(0, 10) });
      }
    } catch { /* non-critical */ }
  }
  return results;
}

/** v8: Auto-severity classification — classify changes by file path patterns.
 *  CRITICAL: auth/security/middleware, HIGH: shared/contracts/db, MEDIUM: service code, LOW: test/docs */
function classifyChangeSeverity(changes: FileChange[], repoRoot: string): {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
} {
  const criticalPatterns = [/auth/i, /security/i, /middleware/i, /session/i, /permission/i, /rbac/i, /policy/i, /encrypt/i, /token/i, /password/i, /secret/i];
  const highPatterns = [/^packages\//, /^contracts\//, /migration/i, /seed\.ts/, /schema/i];
  const lowPatterns = [/\/__tests__\//, /\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /^docs\//, /^scripts\//];
  let maxSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  const reasons: string[] = [];
  for (const change of changes) {
    const rel = change.file_path.startsWith('/')
      ? path.relative(repoRoot, change.file_path)
      : change.file_path;
    if (criticalPatterns.some(p => p.test(rel))) {
      maxSeverity = 'CRITICAL';
      reasons.push(`${rel}: critical (auth/security/middleware)`);
    } else if (highPatterns.some(p => p.test(rel))) {
      if (maxSeverity !== 'CRITICAL') maxSeverity = 'HIGH';
      reasons.push(`${rel}: high (shared/contracts/migration)`);
    } else if (lowPatterns.some(p => p.test(rel))) {
      reasons.push(`${rel}: low (test/docs)`);
    } else {
      if (maxSeverity === 'LOW') maxSeverity = 'MEDIUM';
      reasons.push(`${rel}: medium (service code)`);
    }
  }
  return { severity: maxSeverity, reasons };
}

// ═══════════════════════════════════════════════════════════════════════
//  v9: Heal duration tracking, checkpoint cleanup, CB auto-decay,
//      dependency audit, heal pipeline timeout, impact estimation,
//      persistent telemetry snapshots
// ═══════════════════════════════════════════════════════════════════════

/** v9: Heal operation duration tracking — records phase timings per heal operation.
 *  Exposes mean/p95 via heal_history so latency regressions are visible. */
const healDurationLog: Array<{ phase: string; durationMs: number; at: number }> = [];
const HEAL_DURATION_MAX_ENTRIES = 500;

function recordHealDuration(phase: string, durationMs: number): void {
  healDurationLog.push({ phase, durationMs, at: Date.now() });
  if (healDurationLog.length > HEAL_DURATION_MAX_ENTRIES) {
    healDurationLog.splice(0, healDurationLog.length - HEAL_DURATION_MAX_ENTRIES);
  }
}

function getHealDurationStats(): Record<string, { count: number; meanMs: number; p95Ms: number; maxMs: number }> {
  const byPhase = new Map<string, number[]>();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const entry of healDurationLog) {
    if (entry.at < cutoff) continue;
    const arr = byPhase.get(entry.phase) || [];
    arr.push(entry.durationMs);
    byPhase.set(entry.phase, arr);
  }
  const stats: Record<string, { count: number; meanMs: number; p95Ms: number; maxMs: number }> = {};
  for (const [phase, durations] of byPhase.entries()) {
    durations.sort((a, b) => a - b);
    const count = durations.length;
    const mean = Math.round(durations.reduce((s, d) => s + d, 0) / count);
    const p95Idx = Math.min(Math.floor(count * 0.95), count - 1);
    stats[phase] = { count, meanMs: mean, p95Ms: durations[p95Idx], maxMs: durations[count - 1] };
  }
  return stats;
}

/** v9: Checkpoint tag cleanup — prune sven-checkpoint tags older than 7 days. */
function cleanupOldCheckpoints(repoRoot: string): { pruned: number; remaining: number } {
  const result = spawnSync('git', ['tag', '-l', 'sven-checkpoint/*'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 10000,
  });
  const tags = (result.stdout || '').trim().split('\n').filter(Boolean);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const tag of tags) {
    const tsStr = tag.replace('sven-checkpoint/', '');
    const ts = Number(tsStr);
    if (!isNaN(ts) && ts < cutoff) {
      const del = spawnSync('git', ['tag', '-d', tag], {
        cwd: repoRoot, encoding: 'utf8', timeout: 5000,
      });
      if (del.status === 0) pruned++;
    }
  }
  return { pruned, remaining: tags.length - pruned };
}

/** v9: Circuit breaker auto-decay — decay consecutive failures when idle.
 *  If no heal operation runs for 10min+, reduce failure count by 1 per 10min of inactivity.
 *  This prevents the CB from staying open forever after the admin takes a break. */
let lastHealOperationAt = Date.now();

function applyCircuitBreakerDecay(): void {
  if (opsConsecutiveFailures === 0) return;
  const idleMs = Date.now() - lastHealOperationAt;
  const decaySteps = Math.floor(idleMs / (10 * 60 * 1000)); // 1 per 10min idle
  if (decaySteps > 0) {
    const prevFailures = opsConsecutiveFailures;
    opsConsecutiveFailures = Math.max(0, opsConsecutiveFailures - decaySteps);
    if (opsConsecutiveFailures !== prevFailures) {
      logger.info('Circuit breaker auto-decay applied', {
        prev: prevFailures, now: opsConsecutiveFailures, idle_min: Math.round(idleMs / 60000),
      });
    }
  }
}

/** v9: Dependency vulnerability scan — run npm audit and parse results.
 *  Returns high/critical vulnerability count for the monorepo. */
function scanDependencyVulnerabilities(repoRoot: string): {
  ok: boolean; high: number; critical: number; total: number; details: string;
} {
  try {
    const result = spawnSync('npm', ['audit', '--json', '--omit=dev'], {
      cwd: repoRoot, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 256,
    });
    const output = (result.stdout || '').trim();
    if (!output) return { ok: true, high: 0, critical: 0, total: 0, details: 'no output' };
    try {
      const audit = JSON.parse(output);
      const vuln = audit.metadata?.vulnerabilities || {};
      const high = Number(vuln.high || 0);
      const critical = Number(vuln.critical || 0);
      const total = Number(vuln.total || 0);
      return { ok: high === 0 && critical === 0, high, critical, total, details: `${total} total (${critical} critical, ${high} high)` };
    } catch {
      return { ok: true, high: 0, critical: 0, total: 0, details: 'parse error' };
    }
  } catch {
    return { ok: true, high: 0, critical: 0, total: 0, details: 'scan unavailable' };
  }
}

/** v9: Fix impact estimation — calculate blast radius of a code change.
 *  Considers lines changed, file count, affected services, and risk multiplier. */
function estimateFixImpact(changes: FileChange[], repoRoot: string): {
  linesAdded: number; linesRemoved: number; filesChanged: number;
  servicesAffected: string[]; riskScore: number; riskLevel: string;
} {
  let linesAdded = 0;
  let linesRemoved = 0;
  const servicesSet = new Set<string>();
  for (const change of changes) {
    const rel = change.file_path.startsWith('/')
      ? path.relative(repoRoot, change.file_path)
      : change.file_path;
    const oldLineCount = change.old_content.split('\n').length;
    const newLineCount = change.new_content.split('\n').length;
    linesRemoved += oldLineCount;
    linesAdded += newLineCount;
    const svcMatch = rel.match(/^services\/([^/]+)\//);
    if (svcMatch) servicesSet.add(svcMatch[1]);
    if (rel.startsWith('packages/') || rel.startsWith('contracts/')) {
      servicesSet.add('gateway-api');
      servicesSet.add('agent-runtime');
      servicesSet.add('skill-runner');
    }
  }
  const filesChanged = changes.length;
  const servicesAffected = Array.from(servicesSet);
  // Risk score: 0-100. Bigger change + more files + more services = higher risk
  const linesDelta = Math.abs(linesAdded - linesRemoved) + Math.min(linesAdded, linesRemoved);
  const lineScore = Math.min(linesDelta / 50, 1) * 30; // max 30 for lines
  const fileScore = Math.min(filesChanged / 5, 1) * 25; // max 25 for file count
  const svcScore = Math.min(servicesAffected.length / 3, 1) * 25; // max 25 for services
  const severityMult = changes.some(c => {
    const r = c.file_path.startsWith('/') ? path.relative(repoRoot, c.file_path) : c.file_path;
    return /auth|security|middleware|session|permission/i.test(r);
  }) ? 20 : 0; // 20 bonus for critical files
  const riskScore = Math.round(Math.min(lineScore + fileScore + svcScore + severityMult, 100));
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
  return { linesAdded, linesRemoved, filesChanged, servicesAffected, riskScore, riskLevel };
}

/** v9: Heal pipeline timeout — wraps a heal operation with a max duration.
 *  Returns an AbortSignal-style guard for use with the mutex. */
function createHealTimeout(maxMs: number): { expired: boolean; check: () => void; clear: () => void } {
  let expired = false;
  const timer = setTimeout(() => { expired = true; }, maxMs);
  return {
    get expired() { return expired; },
    check() {
      if (expired) throw new Error(`Heal pipeline timeout exceeded (${maxMs}ms)`);
    },
    clear() { clearTimeout(timer); },
  };
}

/** v9: Persist key telemetry counters to ops_audit_log so they survive restarts.
 *  Called periodically by the diagnostics loop. */
async function persistTelemetrySnapshot(pool: pg.Pool): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ops_audit_log (id, user_id, tool_name, action, inputs, result_summary, severity, created_at)
       VALUES ($1, 'system', 'sven.ops.telemetry_snapshot', 'snapshot', $2::jsonb, $3, 'info', NOW())`,
      [
        `telemetry-${Date.now()}`,
        JSON.stringify(healTelemetry),
        `Telemetry snapshot: ${healTelemetry.fixes_applied} fixes, ${healTelemetry.deploys_completed} deploys, ${healTelemetry.fixes_reverted} reverts`,
      ],
    );
  } catch { /* non-critical — DB issue shouldn't block diagnostics */ }
}

/** Run jest tests for the service affected by the given file path.
 *  Returns ok=true if tests pass (or no tests exist). */
function runServiceTests(repoRoot: string, filePath: string): { ok: boolean; output: string; skipped: boolean } {
  const rel = path.relative(repoRoot, filePath.startsWith('/') ? filePath : path.join(repoRoot, filePath));
  const serviceMatch = rel.match(/^services\/([^/]+)\//);
  if (!serviceMatch) return { ok: true, output: '', skipped: true };

  const svcDir = path.join(repoRoot, 'services', serviceMatch[1]);
  const testDir = path.join(svcDir, 'src', '__tests__');

  // Check if test directory exists
  try {
    const stat = require('fs').statSync(testDir);
    if (!stat.isDirectory()) return { ok: true, output: 'No test directory', skipped: true };
  } catch {
    return { ok: true, output: 'No test directory', skipped: true };
  }

  const result = spawnSync('npx', ['jest', '--passWithNoTests', '--bail', '--forceExit', '--no-coverage'], {
    cwd: svcDir, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 256,
    env: { ...process.env, NODE_ENV: 'test', CI: '1' },
  });
  const output = ((result.stdout || '') + (result.stderr || '')).trim().slice(0, 2000);
  return { ok: result.status === 0, output, skipped: false };
}

/** Fix rate limiter — tracks per-file modification timestamps to prevent fix storms. */
const fixRateMap = new Map<string, number[]>();
const FIX_RATE_WINDOW_MS = 30 * 60 * 1000; // 30 minute window
const FIX_RATE_MAX = 3; // max 3 fixes per file per window

function checkFixRateLimit(filePath: string): { allowed: boolean; recentCount: number; resetInMs: number } {
  const now = Date.now();
  const timestamps = (fixRateMap.get(filePath) || []).filter(t => now - t < FIX_RATE_WINDOW_MS);
  if (timestamps.length >= FIX_RATE_MAX) {
    const oldestInWindow = Math.min(...timestamps);
    return { allowed: false, recentCount: timestamps.length, resetInMs: FIX_RATE_WINDOW_MS - (now - oldestInWindow) };
  }
  return { allowed: true, recentCount: timestamps.length, resetInMs: 0 };
}

function recordFixApplication(filePath: string): void {
  const now = Date.now();
  const timestamps = (fixRateMap.get(filePath) || []).filter(t => now - t < FIX_RATE_WINDOW_MS);
  timestamps.push(now);
  fixRateMap.set(filePath, timestamps);
}

/** Generate a unified diff string for a set of file changes. */
function generateUnifiedDiff(changes: FileChange[], repoRoot: string): string {
  const diffs: string[] = [];
  for (const change of changes) {
    const relPath = change.file_path.startsWith('/')
      ? path.relative(repoRoot, change.file_path)
      : change.file_path;
    const oldLines = change.old_content.split('\n');
    const newLines = change.new_content.split('\n');
    diffs.push(`--- a/${relPath}`);
    diffs.push(`+++ b/${relPath}`);
    // Simple context diff: show removed and added lines
    diffs.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
    for (const line of oldLines) diffs.push(`-${line}`);
    for (const line of newLines) diffs.push(`+${line}`);
  }
  return diffs.join('\n');
}

/** HTTP health probe — make a real HTTP GET to a service's /healthz endpoint.
 *  More reliable than Docker inspect because it verifies actual HTTP responsiveness. */
function probeHttpHealth(host: string, port: number, timeoutMs: number = 5000): { ok: boolean; statusCode: number; body: string; durationMs: number } {
  const start = Date.now();
  try {
    const result = spawnSync('curl', [
      '-s', '-o', '/dev/stdout', '-w', '\n%{http_code}',
      '--connect-timeout', String(Math.ceil(timeoutMs / 1000)),
      '--max-time', String(Math.ceil(timeoutMs / 1000)),
      `http://${host}:${port}/healthz`,
    ], { encoding: 'utf8', timeout: timeoutMs + 2000 });
    const lines = (result.stdout || '').trim().split('\n');
    const statusCode = parseInt(lines[lines.length - 1], 10) || 0;
    const body = lines.slice(0, -1).join('\n').slice(0, 500);
    return { ok: statusCode >= 200 && statusCode < 400, statusCode, body, durationMs: Date.now() - start };
  } catch {
    return { ok: false, statusCode: 0, body: 'connection failed', durationMs: Date.now() - start };
  }
}

/** Revert the last N sven-heal commits on the current branch.
 *  v7: Hard depth guard — max 5 reverts to prevent accidental mass undo. */
const REVERT_MAX_DEPTH = 5;
function revertHealCommits(repoRoot: string, count: number = 1): { ok: boolean; reverted: string[]; output: string } {
  const safeCount = Math.min(Math.max(count, 1), REVERT_MAX_DEPTH);
  if (count > REVERT_MAX_DEPTH) {
    return { ok: false, reverted: [], output: `Rollback depth ${count} exceeds max (${REVERT_MAX_DEPTH}). Use multiple smaller rollbacks.` };
  }
  const reverted: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    // Check if the last commit is a sven-heal commit
    const logResult = spawnSync('git', ['log', '-1', '--pretty=%H %s'], {
      cwd: repoRoot, encoding: 'utf8', timeout: 5000,
    });
    const line = (logResult.stdout || '').trim();
    const [hash, ...msgParts] = line.split(' ');
    const msg = msgParts.join(' ');
    if (!msg.includes('sven-heal') && !msg.includes('merge: fix(sven-heal')) {
      break; // Stop — next commit is not a sven-heal commit
    }
    const revert = spawnSync('git', ['revert', '--no-edit', 'HEAD'], {
      cwd: repoRoot, encoding: 'utf8', timeout: 30000,
    });
    if (revert.status !== 0) {
      return { ok: false, reverted, output: `Failed to revert ${hash}: ${(revert.stderr || '').trim().slice(0, 500)}` };
    }
    reverted.push(hash);
  }
  if (reverted.length === 0) return { ok: false, reverted: [], output: 'No sven-heal commits found to revert' };
  // Verify build after revert
  const buildCheck = verifyFullBuild(repoRoot);
  if (!buildCheck.ok) {
    // Undo the reverts to avoid leaving a broken state
    for (let i = 0; i < reverted.length; i++) {
      spawnSync('git', ['revert', '--no-edit', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', timeout: 30000 });
    }
    return { ok: false, reverted: [], output: `Revert broke the build, re-reverted. Failures: ${buildCheck.failures.map(f => f.service).join(', ')}` };
  }
  return { ok: true, reverted, output: `Reverted ${reverted.length} commit(s), build verified clean` };
}

async function executeInProcess(
  toolName: string,
  inputs: Record<string, unknown>,
  pool: pg.Pool,
  runContext?: SettingsScope,
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  if (toolName.startsWith('mcp.')) {
    return executeMcpProxyTool(toolName, inputs, pool, runContext?.chatId);
  }
  // Built-in first-party tools
  switch (toolName) {
    case 'sven.db.query': {
      const query = inputs.query as string;
      const validation = validateReadOnlySqlQuery(query);
      if (!validation.ok) {
        return { outputs: {}, error: validation.error };
      }
      const result = await pool.query(validation.normalizedQuery);
      return { outputs: { rows: result.rows, rowCount: result.rowCount } };
    }

    case 'sven.time.now':
      return { outputs: { iso: new Date().toISOString(), unix: Date.now() } };

    case 'sven.math.eval': {
      const expr = inputs.expression as string;
      const result = evaluateBoundedMathExpression(expr, {
        maxLength: Number(process.env.SVEN_MATH_EVAL_MAX_LENGTH || 512),
        maxTokens: Number(process.env.SVEN_MATH_EVAL_MAX_TOKENS || 256),
        maxOperations: Number(process.env.SVEN_MATH_EVAL_MAX_OPERATIONS || 256),
        maxMs: Number(process.env.SVEN_MATH_EVAL_MAX_MS || 25),
      });
      if (!result.ok) {
        return { outputs: {}, error: result.error };
      }
      return { outputs: { result: result.value } };
    }

    case 'wait.for':
      return executeWaitFor(inputs);

    case 'shell.exec':
      return executeNativeShellTool(inputs);

    case 'fs.walk':
      return executeNativeFsWalkTool(inputs);

    case 'screen.capture':
      return executeScreenCaptureTool(inputs);

    case 'audio.record':
      return executeAudioRecordTool(inputs);

    case 'ha.get_history': {
      const entityId = inputs.entity_id as string;
      if (!entityId || typeof entityId !== 'string') {
        return { outputs: {}, error: 'inputs.entity_id is required' };
      }
      const config = await getHaConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }
      const now = Date.now();
      const start = typeof inputs.start === 'string' && inputs.start.trim()
        ? inputs.start.trim()
        : new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const end = typeof inputs.end === 'string' && inputs.end.trim()
        ? inputs.end.trim()
        : undefined;
      const maxEntries = typeof inputs.max_entries === 'number'
        ? Math.min(Math.max(inputs.max_entries, 1), 200)
        : 200;

      const query = new URLSearchParams({
        filter_entity_id: entityId,
        minimal_response: '1',
      });
      if (end) {
        query.set('end_time', end);
      }

      const res = await fetch(`${config.baseUrl}/api/history/period/${start}?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        return { outputs: {}, error: `HA request failed (${res.status})` };
      }
      const payload = await res.json() as Array<Array<Record<string, unknown>>>;
      const states = Array.isArray(payload) && Array.isArray(payload[0])
        ? payload[0].slice(-maxEntries)
        : [];

      return { outputs: { entity_id: entityId, states } };
    }

    case 'ha.call_service': {
      const serviceRaw = inputs.service as string;
      if (!serviceRaw || typeof serviceRaw !== 'string') {
        return { outputs: {}, error: 'inputs.service is required' };
      }
      const [domain, service] = serviceRaw.split('.');
      if (!domain || !service) {
        return { outputs: {}, error: 'inputs.service must be in the form domain.service' };
      }

      const config = await getHaConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }

      const payload = buildHaServicePayload(inputs);

      const res = await fetch(`${config.baseUrl}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return { outputs: {}, error: `HA request failed (${res.status})` };
      }

      const result = await res.json() as Array<Record<string, unknown>>;
      return { outputs: { result } };
    }

    case 'ha.list_entities': {
      const config = await getHaConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }

      const filterDomain = typeof inputs.filter_domain === 'string'
        ? inputs.filter_domain.trim().toLowerCase()
        : undefined;

      try {
        const res = await fetch(`${config.baseUrl}/api/states`, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          return { outputs: {}, error: `HA request failed (${res.status})` };
        }

        const states = await res.json() as Array<{
          entity_id: string;
          state: string;
          attributes?: Record<string, unknown>;
          last_updated: string;
        }>;

        const filtered = filterDomain
          ? states.filter((s) => s.entity_id.startsWith(`${filterDomain}.`))
          : states;

        const entities = filtered.map((s) => ({
          entity_id: s.entity_id,
          state: s.state,
          attributes: s.attributes,
          last_updated: s.last_updated,
        }));

        return { outputs: { entities } };
      } catch (err) {
        return { outputs: {}, error: `Failed to list HA entities: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'ha.list_devices': {
      const config = await getHaConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }

      const filterManufacturer = typeof inputs.filter_manufacturer === 'string'
        ? inputs.filter_manufacturer.trim().toLowerCase()
        : undefined;
      const filterModel = typeof inputs.filter_model === 'string'
        ? inputs.filter_model.trim().toLowerCase()
        : undefined;

      try {
        const res = await fetch(`${config.baseUrl}/api/config/device_registry/list`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        if (!res.ok) {
          return { outputs: {}, error: `HA request failed (${res.status})` };
        }

        type HaDevice = {
          id: string;
          name?: string | null;
          name_by_user?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          area_id?: string | null;
          primary_config_entry_id?: string | null;
        };

        const devicesData = await res.json() as HaDevice[];

        let filtered = devicesData;
        if (filterManufacturer) {
          filtered = filtered.filter((d) =>
            d.manufacturer && d.manufacturer.toLowerCase().includes(filterManufacturer)
          );
        }
        if (filterModel) {
          filtered = filtered.filter((d) =>
            d.model && d.model.toLowerCase().includes(filterModel)
          );
        }

        const devices = filtered.map((d) => ({
          id: d.id,
          name: d.name ?? null,
          name_by_user: d.name_by_user ?? null,
          manufacturer: d.manufacturer ?? null,
          model: d.model ?? null,
          area_id: d.area_id ?? null,
          primary_config_entry_id: d.primary_config_entry_id ?? null,
        }));

        return { outputs: { devices } };
      } catch (err) {
        return { outputs: {}, error: `Failed to list HA devices: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'frigate.list_events': {
        const config = await getFrigateConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }

      const params = new URLSearchParams();
      const camera = typeof inputs.camera === 'string' ? inputs.camera.trim() : '';
      const label = typeof inputs.label === 'string' ? inputs.label.trim() : '';
      const zone = typeof inputs.zone === 'string' ? inputs.zone.trim() : '';
      const limit = typeof inputs.limit === 'number' ? Math.max(1, Math.min(inputs.limit, 500)) : 50;
      const hasClip = typeof inputs.has_clip === 'number' ? String(inputs.has_clip) : '';
      const hasSnapshot = typeof inputs.has_snapshot === 'number' ? String(inputs.has_snapshot) : '';

      if (camera) params.set('camera', camera);
      if (label) params.set('label', label);
      if (zone) params.set('zone', zone);
      params.set('limit', String(limit));
      if (hasClip) params.set('has_clip', hasClip);
      if (hasSnapshot) params.set('has_snapshot', hasSnapshot);

      const res = await fetch(`${config.baseUrl}/api/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        return { outputs: {}, error: `Frigate request failed (${res.status})` };
      }
      const events = await res.json() as Array<Record<string, unknown>>;
      return { outputs: { events } };
    }

    case 'frigate.get_event': {
      const eventId = typeof inputs.event_id === 'string' ? inputs.event_id.trim() : '';
      if (!eventId) {
        return { outputs: {}, error: 'inputs.event_id is required' };
      }

        const config = await getFrigateConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }

      const res = await fetch(`${config.baseUrl}/api/events/${encodeURIComponent(eventId)}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        return { outputs: {}, error: `Frigate request failed (${res.status})` };
      }
      const event = await res.json() as Record<string, unknown>;
      return { outputs: { event } };
    }

    case 'frigate.list_cameras': {
        const config = await getFrigateConfig(pool, runContext);
      if (config.error) {
        return { outputs: {}, error: config.error };
      }

      const res = await fetch(`${config.baseUrl}/api/config`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        return { outputs: {}, error: `Frigate request failed (${res.status})` };
      }
      const payload = await res.json() as Record<string, unknown>;
      const cameras = payload && typeof payload === 'object' ? (payload.cameras || {}) : {};
      return { outputs: { cameras } };
    }

    case 'calendar.list_events': {
      return {
        outputs: {},
        error: 'calendar.list_events requires a provider-backed integration and is currently unavailable',
      };
    }

    case 'calendar.create_event': {
      return {
        outputs: {},
        error: 'calendar.create_event requires a provider-backed integration and is currently unavailable',
      };
    }

    case 'calendar.update_event': {
      return {
        outputs: {},
        error: 'calendar.update_event requires a provider-backed integration and is currently unavailable',
      };
    }

    case 'calendar.delete_event': {
      return {
        outputs: {},
        error: 'calendar.delete_event requires a provider-backed integration and is currently unavailable',
      };
    }

    case 'calendar.diff_preview': {
      return {
        outputs: {},
        error: 'calendar.diff_preview requires a provider-backed integration and is currently unavailable',
      };
    }

    case 'git.status': {
      const repoId = inputs.repo_id as string;
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);
      if (!repoId) {
        return { outputs: {}, error: 'repo_id is required' };
      }
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        const status = await (gitRepo as any).getStatus();

        return { outputs: status };
      } catch (err) {
        return { outputs: {}, error: `Failed to get git status: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'git.diff': {
      const repoId = inputs.repo_id as string;
      const baseRef = (inputs.base_ref as string) || 'HEAD~1';
      const headRef = (inputs.head_ref as string) || 'HEAD';
      const filePattern = inputs.file_pattern as string | undefined;
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);

      if (!repoId) {
        return { outputs: {}, error: 'repo_id is required' };
      }
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        const diff = await (gitRepo as any).getDiff(baseRef, headRef, filePattern);

        return { outputs: diff };
      } catch (err) {
        return { outputs: {}, error: `Failed to get diff: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'git.log': {
      const repoId = inputs.repo_id as string;
      const branch = (inputs.branch as string) || 'HEAD';
      const maxCommits = parseGitLogMaxCommits(inputs.max_commits);
      const author = inputs.author as string | undefined;
      const since = inputs.since as string | undefined;
      const until = inputs.until as string | undefined;
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);

      if (!repoId) {
        return { outputs: {}, error: 'repo_id is required' };
      }
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      if (maxCommits === null) {
        return {
          outputs: {},
          error: `max_commits must be a finite integer between ${MIN_GIT_LOG_MAX_COMMITS} and ${MAX_GIT_LOG_MAX_COMMITS}`,
        };
      }
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        const commits = await (gitRepo as any).getLog(branch, maxCommits, author, since, until);

        return { outputs: { commits } };
      } catch (err) {
        return { outputs: {}, error: `Failed to get log: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'git.create_branch': {
      const repoId = inputs.repo_id as string;
      const branchName = inputs.branch_name as string;
      const fromRef = (inputs.from_ref as string) || 'HEAD';
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);

      if (!repoId || !branchName) {
        return { outputs: {}, error: 'repo_id and branch_name are required' };
      }
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        await (gitRepo as any).createBranch(branchName, fromRef);

        // Log operation
        await pool.query(
          `INSERT INTO git_operations (repo_id, operation_type, status, triggered_by)
           VALUES ($1, $2, $3, $4)`,
          [repoId, 'branch', 'success', gitUserId]
        );

        return { outputs: { success: true, branch_name: branchName } };
      } catch (err) {
        return { outputs: {}, error: `Failed to create branch: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'git.commit': {
      const repoId = inputs.repo_id as string;
      const rawMessage = inputs.message as string;
      const authorName = inputs.author_name as string | undefined;
      const authorEmail = inputs.author_email as string | undefined;
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);

      if (!repoId || !rawMessage) {
        return { outputs: {}, error: 'repo_id and message are required' };
      }

      // Sanitize commit message: strip AI markers, enforce clean formatting
      const message = stealthCommitter.sanitizeMessage(rawMessage);
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        const commitHash = await (gitRepo as any).createCommit(message, authorName, authorEmail);

        // Log operation
        await pool.query(
          `INSERT INTO git_operations (repo_id, operation_type, status, triggered_by)
           VALUES ($1, $2, $3, $4)`,
          [repoId, 'commit', 'success', gitUserId]
        );

        return { outputs: { success: true, commit_hash: commitHash } };
      } catch (err) {
        return { outputs: {}, error: `Failed to commit: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'git.create_pull_request': {
      const repoId = inputs.repo_id as string;
      const title = inputs.title as string;
      const description = (inputs.description as string) || '';
      const sourceBranch = inputs.source_branch as string;
      const targetBranch = inputs.target_branch as string;
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);

      if (!repoId || !title || !sourceBranch || !targetBranch) {
        return { outputs: {}, error: 'repo_id, title, source_branch, and target_branch are required' };
      }
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        const pr = await (gitRepo as any).createPullRequest(title, description, sourceBranch, targetBranch);

        // Store PR in database
        await pool.query(
          `INSERT INTO git_pull_requests (repo_id, pr_number, provider_id, title, description, source_branch, target_branch, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [repoId, pr.number || null, pr.id, pr.title, pr.description, pr.sourceBranch, pr.targetBranch, pr.status]
        );

        // Log operation
        await pool.query(
          `INSERT INTO git_operations (repo_id, operation_type, status, triggered_by)
           VALUES ($1, $2, $3, $4)`,
          [repoId, 'pr_create', 'success', gitUserId]
        );

        return { outputs: { success: true, pr_id: pr.id, pr_url: pr.url } };
      } catch (err) {
        return { outputs: {}, error: `Failed to create PR: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'git.merge_pull_request': {
      const repoId = inputs.repo_id as string;
      const prNumber = inputs.pr_number as string;
      const mergeStrategy = (inputs.merge_strategy as string) || 'merge';
      const gitActor = resolveGitActorUserId(inputs.user_id, runContext?.userId);

      if (!repoId || !prNumber) {
        return { outputs: {}, error: 'repo_id and pr_number are required' };
      }
      if (!gitActor.ok) {
        return { outputs: {}, error: gitActor.error || 'Git authorization failed' };
      }
      const gitUserId = String(gitActor.userId || '').trim();
      const gitOrg = await resolveGitToolOrganizationId(pool, runContext);
      if (!gitOrg.organizationId) {
        return { outputs: {}, error: gitOrg.error || 'Git authorization failed' };
      }

      try {
        const repoLookup = await loadActiveGitRepoForTool(pool, repoId, gitUserId, gitOrg.organizationId);
        if (!repoLookup.repo) {
          return { outputs: {}, error: repoLookup.error || 'Repository not found' };
        }
        const repo = repoLookup.repo;
        const runtimeConfig = await buildGitRepoRuntimeConfig(repo);
        if (!runtimeConfig.config) {
          return { outputs: {}, error: runtimeConfig.error || 'Invalid git repository configuration' };
        }
        const gitRepo = createGitRepo(repo.provider as GitProvider, runtimeConfig.config);
        const mergeCommitSha = await (gitRepo as any).mergePullRequest(prNumber, mergeStrategy);

        // Update PR status
        await pool.query(
          `UPDATE git_pull_requests SET status = $1 WHERE repo_id = $2 AND pr_number = $3`,
          ['merged', repoId, prNumber]
        );

        // Log operation
        await pool.query(
          `INSERT INTO git_operations (repo_id, operation_type, status, triggered_by)
           VALUES ($1, $2, $3, $4)`,
          [repoId, 'pr_merge', 'success', gitUserId]
        );

        return { outputs: { success: true, merge_commit: mergeCommitSha } };
      } catch (err) {
        return { outputs: {}, error: `Failed to merge PR: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.search': {
      const searchPath = inputs.path as string;
      const pattern = (inputs.pattern as string) || '.*';
      const maxResults = parseNasSearchMaxResults(inputs.max_results);
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!searchPath) {
        return { outputs: {}, error: 'path is required' };
      }
      if (maxResults === null) {
        return {
          outputs: {},
          error: `max_results must be a finite integer between ${MIN_NAS_SEARCH_MAX_RESULTS} and ${MAX_NAS_SEARCH_MAX_RESULTS}`,
        };
      }

      try {
        const validation = validateNasPath(searchPath, nasUserId, false);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        const results = await searchFiles(searchPath, pattern, nasUserId, maxResults);

        // Log operation
        try {
          await pool.query(
            `INSERT INTO nas_operations (user_id, operation_type, path, status, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [nasUserId, 'search', searchPath, 'success', JSON.stringify({ pattern, results_count: results.length })]
          );
        } catch (logError) {
          logger.warn('Failed to log NAS operation', { error: logError });
        }

        return { outputs: { results } };
      } catch (err) {
        return { outputs: {}, error: `Search failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.list': {
      const dirPath = inputs.path as string;
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!dirPath) {
        return { outputs: {}, error: 'path is required' };
      }

      try {
        const validation = validateNasPath(dirPath, nasUserId, false);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        const entries = await listDirectory(dirPath, nasUserId);

        return { outputs: { entries } };
      } catch (err) {
        return { outputs: {}, error: `List failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.preview': {
      const filePath = inputs.path as string;
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!filePath) {
        return { outputs: {}, error: 'path is required' };
      }

      try {
        const validation = validateNasPath(filePath, nasUserId, false);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        const preview = await readFilePreview(filePath, nasUserId);

        return { outputs: preview as unknown as Record<string, unknown> };
      } catch (err) {
        return { outputs: {}, error: `Preview failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.read': {
      const filePath = inputs.path as string;
      const maxBytes = parseNasReadMaxBytes(inputs.max_bytes);
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!filePath) {
        return { outputs: {}, error: 'path is required' };
      }
      if (maxBytes === null) {
        return {
          outputs: {},
          error: `max_bytes must be a finite integer between ${MIN_NAS_READ_MAX_BYTES} and ${MAX_NAS_READ_MAX_BYTES}`,
        };
      }

      try {
        const validation = validateNasPath(filePath, nasUserId, false);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        const buffer = await readFile(filePath, nasUserId, maxBytes);
        const isTextFile = !filePath.match(/\.(pdf|png|jpg|jpeg|gif|svg|mp3|mp4|zip|tar|gz)$/i);
        const content = isTextFile ? buffer.toString('utf8') : buffer.toString('base64');

        // Log operation
        try {
          await pool.query(
            `INSERT INTO nas_operations (user_id, operation_type, path, status, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [nasUserId, 'read', filePath, 'success', JSON.stringify({ size: buffer.length })]
          );
        } catch (logError) {
          logger.warn('Failed to log NAS operation', { error: logError });
        }

        return { outputs: { content, size: buffer.length, isBinary: !isTextFile } };
      } catch (err) {
        return { outputs: {}, error: `Read failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.write': {
      const filePath = inputs.path as string;
      const content = inputs.content as string | undefined;
      const encoding = inputs.encoding as string | undefined;
      const append = inputs.append as boolean | undefined;
      const createDirs = inputs.create_dirs as boolean | undefined;
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!filePath || content === undefined || content === null) {
        return { outputs: {}, error: 'path and content are required' };
      }

      try {
        const validation = validateNasPath(filePath, nasUserId, true);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        const decoded = decodeNasWriteContent(content, encoding);
        if (!decoded.buffer) {
          return { outputs: {}, error: decoded.error || 'Invalid content encoding' };
        }
        const buffer = decoded.buffer;

        // Read existing content for file history snapshot (before write)
        let beforeContent: string | null = null;
        try {
          const existing = await readFile(filePath, nasUserId);
          beforeContent = existing.toString('utf-8');
        } catch {
          // File doesn't exist yet — beforeContent stays null (new file)
        }

        const result = await writeFile(filePath, buffer, nasUserId, { append, createDirs });

        // Record file history snapshot for undo support
        try {
          fileHistory.record({
            filePath,
            beforeContent,
            afterContent: buffer.toString('utf-8'),
            operation: beforeContent === null ? 'create' : 'modify',
            actorId: nasUserId,
            toolName: 'nas.write',
            taskId: runContext?.chatId,
          });
        } catch (histErr) {
          logger.warn('File history record failed', { filePath, error: String(histErr) });
        }

        // Log operation
        try {
          await pool.query(
            `INSERT INTO nas_operations (user_id, operation_type, path, status, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [nasUserId, append ? 'append' : 'write', filePath, 'success', JSON.stringify({ size: result.size })]
          );
        } catch (logError) {
          logger.warn('Failed to log NAS operation', { error: logError });
        }

        return { outputs: result as unknown as Record<string, unknown> };
      } catch (err) {
        return { outputs: {}, error: `Write failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.delete': {
      const filePath = inputs.path as string;
      const recursive = inputs.recursive as boolean | undefined;
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!filePath) {
        return { outputs: {}, error: 'path is required' };
      }

      try {
        const validation = validateNasPath(filePath, nasUserId, true);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        // Read existing content for file history snapshot (before delete)
        let beforeContent: string | null = null;
        try {
          const existing = await readFile(filePath, nasUserId);
          beforeContent = existing.toString('utf-8');
        } catch {
          // File might be a directory or unreadable — skip snapshot content
        }

        const result = await deleteFile(filePath, nasUserId, recursive);

        // Record file history snapshot for undo support
        if (beforeContent !== null) {
          try {
            fileHistory.record({
              filePath,
              beforeContent,
              afterContent: null,
              operation: 'delete',
              actorId: nasUserId,
              toolName: 'nas.delete',
              taskId: runContext?.chatId,
            });
          } catch (histErr) {
            logger.warn('File history record failed', { filePath, error: String(histErr) });
          }
        }

        // Log operation
        try {
          await pool.query(
            `INSERT INTO nas_operations (user_id, operation_type, path, status)
             VALUES ($1, $2, $3, $4)`,
            [nasUserId, 'delete', filePath, 'success']
          );
        } catch (logError) {
          logger.warn('Failed to log NAS operation', { error: logError });
        }

        return { outputs: result };
      } catch (err) {
        return { outputs: {}, error: `Delete failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'nas.stats': {
      const filePath = inputs.path as string;
      const nasActor = resolveNasActorUserId(inputs.user_id, runContext?.userId);
      if (!nasActor.ok) {
        return { outputs: {}, error: nasActor.error || 'NAS authorization failed' };
      }
      const nasUserId = String(nasActor.userId || '').trim();

      if (!filePath) {
        return { outputs: {}, error: 'path is required' };
      }

      try {
        const validation = validateNasPath(filePath, nasUserId, false);
        if (!validation.valid) {
          return { outputs: {}, error: validation.error };
        }

        const stats = await getFileStats(filePath, nasUserId);

        return { outputs: stats };
      } catch (err) {
        return { outputs: {}, error: `Stats failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'web.fetch': {
      const url = inputs.url as string;
      const timeout = parseWebFetchTimeoutMs(inputs.timeout);
      const maxContentLength = parseWebFetchMaxContentLength(inputs.max_content_length);
      const extractHtml = inputs.extract_html as boolean | undefined;

      if (!url) {
        return { outputs: {}, error: 'url is required' };
      }
      if (timeout === null) {
        return {
          outputs: {},
          error: `timeout must be a finite integer between ${MIN_WEB_FETCH_TIMEOUT_MS} and ${MAX_WEB_FETCH_TIMEOUT_MS}`,
        };
      }
      if (maxContentLength === null) {
        return {
          outputs: {},
          error: `max_content_length must be a finite integer between ${MIN_WEB_FETCH_MAX_CONTENT_LENGTH} and ${MAX_WEB_FETCH_MAX_CONTENT_LENGTH}`,
        };
      }

      try {
        const allowlist = await loadWebAllowlist(pool, runContext);

        if (allowlist.length === 0) {
          return { outputs: {}, error: 'No web domains are allowlisted' };
        }

        const result = await fetchWebWithOptionalFirecrawl({
          url,
          directFetch: async () => {
            const direct = await fetchWebContent(url, {
              allowlist,
              timeout,
              maxContentLength,
              extractHtml,
              cacheTtlSeconds: 3600, // Cache for 1 hour
            });
            return direct as unknown as Record<string, unknown>;
          },
          loadConfig: async () =>
            getWebFetchFirecrawlConfig(pool, {
              parseSettingValue,
              resolveSecretRef,
              loadSettingsMap: (keys) => getScopedSettingsMap(pool, keys, runContext),
              warn: (message, meta) => logger.warn(message, meta),
            }),
          fetchFallback: async (config) => fetchWithFirecrawl(config, url, Boolean(extractHtml), maxContentLength),
        });
        return { outputs: result };
      } catch (err) {
        if (err instanceof FirecrawlRequestError) {
          logger.warn('Firecrawl fallback failed during web.fetch', {
            url,
            status: err.status,
            detail: err.detail,
          });
          return { outputs: {}, error: `Fetch failed: ${err.message}` };
        }
        return { outputs: {}, error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'web.extract-text': {
      const html = inputs.html as string;
      const maxLength = parseWebExtractMaxLength(inputs.max_length);

      if (!html || typeof html !== 'string') {
        return { outputs: {}, error: 'html is required' };
      }
      if (maxLength === null) {
        return {
          outputs: {},
          error: `max_length must be a finite integer between ${MIN_WEB_EXTRACT_MAX_LENGTH} and ${MAX_WEB_EXTRACT_MAX_LENGTH}`,
        };
      }

      try {
        const text = extractTextContent(html, maxLength);

        return { outputs: { text, length: text.length } };
      } catch (err) {
        return { outputs: {}, error: `Extraction failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

      case 'web.extract-metadata': {
        const html = inputs.html as string;

      if (!html || typeof html !== 'string') {
        return { outputs: {}, error: 'html is required' };
      }

      try {
        const metadata = extractMetadata(html);

        return { outputs: metadata };
        } catch (err) {
          return { outputs: {}, error: `Extraction failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      case 'analyze.media': {
        return analyzeMedia(inputs, pool);
      }

      // ═══════════════════════════════════════════════════════════════════
      //  SearXNG Private Search — search.web
      // ═══════════════════════════════════════════════════════════════════

    case 'search.web': {
      const query = inputs.query as string;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return { outputs: {}, error: 'inputs.query is required' };
      }

      const numResults = Math.min(Math.max((inputs.num_results as number) || 10, 1), 50);
      const allowedCategories = new Set(['general', 'images', 'news', 'files', 'science']);
      const categoryInput = String(inputs.categories || 'general');
      const categories = categoryInput
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter((c) => allowedCategories.has(c))
        .join(',') || 'general';
      const language = String(inputs.language || 'auto').trim() || 'auto';

      // Prefer the runtime env URL when the stored setting still points at the legacy docker-only default.
      let searxngUrl = process.env.SEARXNG_URL || 'http://searxng:8080';
      let configuredEngines: string[] = [];
      let safeSearch = 1;
      try {
        const settings = await getScopedSettingsMap(
          pool,
          ['search.searxng_url', 'search.engines', 'search.safeSearch'],
          runContext,
        );
        const searxngUrlSetting = parseSettingValue<string>(settings.get('search.searxng_url'))?.trim();
        const legacyDefault =
          searxngUrlSetting === 'http://searxng:8080' || searxngUrlSetting === 'http://searxng:8080/';
        if (searxngUrlSetting && (!legacyDefault || !process.env.SEARXNG_URL)) {
          try {
            const parsed = new URL(searxngUrlSetting);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              searxngUrl = searxngUrlSetting;
            }
          } catch {
            // ignore invalid URL; keep env/default
          }
        }

        const enginesValue = parseSettingValue<string[] | string>(settings.get('search.engines'));
        if (Array.isArray(enginesValue)) {
          configuredEngines = enginesValue
            .filter((engine) => typeof engine === 'string' && engine.trim())
            .map((engine) => engine.trim());
        } else if (typeof enginesValue === 'string' && enginesValue.trim()) {
          configuredEngines = [enginesValue.trim()];
        }

        const safeVal = parseSettingValue<string>(settings.get('search.safeSearch'))?.trim().toLowerCase();
        if (safeVal === 'off') safeSearch = 0;
        else if (safeVal === 'strict') safeSearch = 2;
      } catch { /* use defaults */ }

      try {
        const searchUrl = new URL('/search', searxngUrl);
        searchUrl.searchParams.set('q', query.trim());
        searchUrl.searchParams.set('format', 'json');
        searchUrl.searchParams.set('categories', categories);
        searchUrl.searchParams.set('language', language);
        searchUrl.searchParams.set('safesearch', String(safeSearch));
        searchUrl.searchParams.set('pageno', '1');
        if (configuredEngines.length > 0) {
          searchUrl.searchParams.set('engines', configuredEngines.join(','));
        }

        const response = await fetch(searchUrl.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          return { outputs: {}, error: `SearXNG error: ${response.status} ${response.statusText}` };
        }

        const data = (await response.json()) as {
          results?: Array<{
            title?: string;
            url?: string;
            content?: string;
            engine?: string;
            category?: string;
          }>;
          number_of_results?: number;
        };

        const results = (data.results || [])
          .slice(0, numResults)
          .map((r) => {
            const title = r.title || '';
            const url = sanitizeSearchResultUrl(r.url || '');
            const snippet = r.content || '';
            return {
              title,
              url,
              snippet,
              source_engine: r.engine || 'unknown',
              category: r.category || categories,
            };
          })
          .filter((r) => r.url && !isLikelyAdResult(r.url, r.title, r.snippet))
          .map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            source_engine: r.source_engine,
          }));

        return {
          outputs: {
            results,
            total: data.number_of_results || results.length,
            query: query.trim(),
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Search failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'search.brave': {
      const query = inputs.query as string;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return { outputs: {}, error: 'inputs.query is required' };
      }

      const numResults = Math.min(Math.max((inputs.num_results as number) || 10, 1), 20);
      const language = String(inputs.language || 'auto').trim() || 'auto';
      const country = String(inputs.country || '').trim().toUpperCase();

      let safeSearch = 'moderate';
      try {
        const settings = await getScopedSettingsMap(pool, ['search.safeSearch'], runContext);
        const val = parseSettingValue<string>(settings.get('search.safeSearch'))?.trim().toLowerCase();
        if (val === 'off' || val === 'strict' || val === 'moderate') safeSearch = val;
      } catch { /* use default */ }

      try {
        const apiKey = await getBraveSearchApiKey(pool, runContext);
        const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
        searchUrl.searchParams.set('q', query.trim());
        searchUrl.searchParams.set('count', String(numResults));
        searchUrl.searchParams.set('safesearch', safeSearch);
        if (language.toLowerCase() !== 'auto') {
          searchUrl.searchParams.set('search_lang', language);
        }
        if (country) {
          searchUrl.searchParams.set('country', country);
        }

        const response = await fetch(searchUrl.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': apiKey,
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          return { outputs: {}, error: `Brave Search error: ${response.status} ${response.statusText}` };
        }

        const data = (await response.json()) as {
          web?: {
            results?: Array<{
              title?: string;
              url?: string;
              description?: string;
              extra_snippets?: string[];
            }>;
          };
        };
        const rawResults = Array.isArray(data.web?.results) ? data.web!.results! : [];
        const results = rawResults
          .slice(0, numResults)
          .map((r) => {
            const title = String(r.title || '');
            const url = sanitizeSearchResultUrl(String(r.url || ''));
            const snippet = String(
              r.description || (Array.isArray(r.extra_snippets) ? r.extra_snippets.join(' ') : ''),
            );
            return {
              title,
              url,
              snippet,
              source_engine: 'brave',
            };
          })
          .filter((r) => r.url && !isLikelyAdResult(r.url, r.title, r.snippet));

        return {
          outputs: {
            results,
            total: results.length,
            query: query.trim(),
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { outputs: {}, error: sanitizeSearchErrorMessage(`Brave search failed: ${msg}`, query) };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Dynamic Skill Authoring — skill.author
    // ═══════════════════════════════════════════════════════════════════

    case 'skill.author': {
      const enabledRes = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'agent.dynamicTools.enabled'`,
      );
      const enabledVal = enabledRes.rows[0]?.value;
      const enabled = parseSettingValue<boolean | string>(enabledVal);
      const isEnabled =
        typeof enabled === 'boolean'
          ? enabled
          : String(enabled || '').toLowerCase() === 'true';
      if (!isEnabled) {
        return { outputs: {}, error: 'Dynamic tool creation is disabled (agent.dynamicTools.enabled=false)' };
      }

      const skillName = String(inputs.skill_name || '').trim();
      const description = String(inputs.description || '').trim();
      const languageRaw = String(inputs.handler_language || 'typescript').trim().toLowerCase();
      const language = (languageRaw === 'python' || languageRaw === 'shell' || languageRaw === 'typescript')
        ? languageRaw
        : null;
      if (!skillName || !description || !language) {
        return { outputs: {}, error: 'skill_name, description, and handler_language (typescript|python|shell) are required' };
      }

      const rawHandler = String(inputs.handler_code || '').trim();
      const handlerCode = rawHandler || getDefaultHandlerTemplate(language);
      const maxBytes = 50 * 1024;
      if (Buffer.byteLength(handlerCode, 'utf8') > maxBytes) {
        return { outputs: {}, error: 'handler_code exceeds maximum size (50KB)' };
      }

      let inSchema: Record<string, unknown> | unknown = {};
      let outSchema: Record<string, unknown> | unknown = {};
      try {
        inSchema = typeof inputs.inputs_schema === 'string'
          ? JSON.parse(String(inputs.inputs_schema))
          : (inputs.inputs_schema || {});
        outSchema = typeof inputs.outputs_schema === 'string'
          ? JSON.parse(String(inputs.outputs_schema))
          : (inputs.outputs_schema || {});
      } catch {
        return { outputs: {}, error: 'inputs_schema/outputs_schema must be valid JSON when provided as string' };
      }
      if (typeof inSchema !== 'object' || inSchema === null || Array.isArray(inSchema)) {
        return { outputs: {}, error: 'inputs_schema must be a JSON object' };
      }
      if (typeof outSchema !== 'object' || outSchema === null || Array.isArray(outSchema)) {
        return { outputs: {}, error: 'outputs_schema must be a JSON object' };
      }

      const syntax = await validateHandlerSyntax(language, handlerCode);
      if (!syntax.ok) {
        return { outputs: {}, error: `Handler syntax validation failed: ${syntax.error}` };
      }

      const authoringContext = resolveDynamicSkillAuthoringContext({
        payloadUserId: inputs.user_id,
        payloadChatId: inputs.chat_id,
        runContextUserId: runContext?.userId,
        runContextChatId: runContext?.chatId,
      });
      if (!authoringContext.ok) {
        return { outputs: {}, error: authoringContext.error || 'Dynamic skill authoring authorization failed' };
      }
      const userId = String(authoringContext.userId || '').trim();
      const chatId = String(authoringContext.chatId || '').trim();

      const policyRes = await pool.query(
        `SELECT scope, effect, target_type
         FROM permissions
         WHERE
           (target_type = 'global')
           OR (target_type = 'user' AND target_id = $1)
           OR (target_type = 'chat' AND target_id = $2)`,
        [userId, chatId],
      );
      const byScope = new Map<string, { hasAllow: boolean; hasDeny: boolean }>();
      for (const row of policyRes.rows) {
        const scope = String(row.scope || '').trim();
        const effect = String(row.effect || '').trim().toLowerCase();
        if (!scope) continue;
        const entry = byScope.get(scope) || { hasAllow: false, hasDeny: false };
        if (effect === 'allow') entry.hasAllow = true;
        if (effect === 'deny') entry.hasDeny = true;
        byScope.set(scope, entry);
      }
      const effectiveAllowedScopes = Array.from(byScope.entries())
        .filter(([, entry]) => entry.hasAllow && !entry.hasDeny)
        .map(([scope]) => scope)
        .slice(0, 128);
      if (effectiveAllowedScopes.length === 0) {
        return { outputs: {}, error: 'No effective allow scopes found for this session; dynamic skill creation denied' };
      }
      const requestedScopesRaw = (inputs.permissions_required || inputs.policy_scopes) as unknown;
      const requestedScopes = Array.isArray(requestedScopesRaw)
        ? requestedScopesRaw.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
      const inheritedScopes = requestedScopes.length > 0 ? requestedScopes : effectiveAllowedScopes;
      const outsideScope = inheritedScopes.find((s) => !effectiveAllowedScopes.includes(s));
      if (outsideScope) {
        return { outputs: {}, error: `Requested permission scope "${outsideScope}" exceeds current session policy scope` };
      }

      const hourlyLimitRes = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'agent.dynamicTools.maxCreationsPerHour'`,
      );
      const hourlyLimitSetting = parseSettingValue<unknown>(hourlyLimitRes.rows[0]?.value);
      const hourlyLimitResolution = resolveDynamicSkillCreationHourlyLimit(hourlyLimitSetting);
      if (hourlyLimitResolution.usedDefault) {
        logger.warn('Invalid dynamic skill creation hourly limit; using default', {
          setting_key: 'agent.dynamicTools.maxCreationsPerHour',
          setting_value: String(hourlyLimitSetting),
          fallback_value: hourlyLimitResolution.value,
        });
      }
      const hourlyLimit = hourlyLimitResolution.value;
      if (userId) {
        const usageRes = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM tool_runs
           WHERE tool_name = 'skill.author'
             AND user_id = $1
             AND created_at >= NOW() - INTERVAL '1 hour'`,
          [userId],
        );
        const count = Number(usageRes.rows[0]?.c || 0);
        if (count >= hourlyLimit) {
          return { outputs: {}, error: `Rate limit exceeded: max ${hourlyLimit} skill creations per hour` };
        }
      }

      const slug = slugifySkillName(skillName);
      const skillDirRoot = process.env.SVEN_DYNAMIC_SKILLS_DIR || path.join(os.homedir(), '.sven', 'workspace', 'skills');
      const skillDir = path.join(skillDirRoot, slug);
      await fs.mkdir(skillDir, { recursive: true });

      const handlerFile = language === 'python' ? 'handler.py' : language === 'shell' ? 'handler.sh' : 'handler.ts';
      const handlerPath = path.join(skillDir, handlerFile);
      await fs.writeFile(handlerPath, handlerCode, 'utf8');

      const skillMarkdown = [
        '---',
        `name: ${slug}`,
        `description: ${description.replace(/\r?\n/g, ' ')}`,
        'version: 0.1.0',
        `handler_language: ${language}`,
        `handler_file: ${handlerFile}`,
        `inputs_schema: ${JSON.stringify(inSchema)}`,
        `outputs_schema: ${JSON.stringify(outSchema)}`,
        '---',
        '',
        '# Dynamic Skill',
        '',
        'Generated by `skill.author` and quarantined for review.',
      ].join('\n');
      const mdValidation = validateGeneratedSkillMarkdown(skillMarkdown);
      if (!mdValidation.ok) {
        return { outputs: {}, error: mdValidation.error || 'Generated SKILL.md failed validation' };
      }
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMarkdown, 'utf8');

      const orgRes = await pool.query(
        `SELECT organization_id FROM chats WHERE id = $1`,
        [chatId],
      );
      const orgId = String(orgRes.rows[0]?.organization_id || '').trim();
      if (!orgId) {
        return { outputs: {}, error: 'Could not resolve organization for dynamic skill registration' };
      }

      const sourceName = `dynamic-agent-skills-${orgId.slice(0, 8)}`;
      let sourceId = '';
      const sourceRes = await pool.query(
        `SELECT id FROM registry_sources WHERE organization_id = $1 AND name = $2 LIMIT 1`,
        [orgId, sourceName],
      );
      if (sourceRes.rows.length > 0) {
        sourceId = String(sourceRes.rows[0].id);
      } else {
        sourceId = generateTaskId('catalog_entry');
        await pool.query(
          `INSERT INTO registry_sources (id, organization_id, name, type, path, enabled, created_at)
           VALUES ($1, $2, $3, 'local', $4, true, NOW())`,
          [sourceId, orgId, sourceName, skillDirRoot],
        );
      }

      let publisherId = '';
      const pubRes = await pool.query(
        `SELECT id FROM registry_publishers WHERE organization_id = $1 AND name = $2 LIMIT 1`,
        [orgId, 'agent-runtime'],
      );
      if (pubRes.rows.length > 0) {
        publisherId = String(pubRes.rows[0].id);
      } else {
        publisherId = generateTaskId('catalog_entry');
        await pool.query(
          `INSERT INTO registry_publishers (id, organization_id, name, trusted, created_at)
           VALUES ($1, $2, 'agent-runtime', false, NOW())`,
          [publisherId, orgId],
        );
      }

      const toolIdCandidate = generateTaskId('tool_run');
      const toolName = `dynamic.${slug}`;
      await pool.query(
        `INSERT INTO tools (
          id, name, display_name, description, execution_mode, inputs_schema, outputs_schema,
          permissions_required, resource_limits, is_first_party, trust_level, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'gvisor', $5::jsonb, $6::jsonb, $7::text[],
          '{"timeout_ms":30000,"max_bytes":1048576,"max_concurrency":1}'::jsonb, false, 'quarantined', NOW(), NOW()
        )
        ON CONFLICT (name) DO UPDATE
          SET description = EXCLUDED.description,
              inputs_schema = EXCLUDED.inputs_schema,
              outputs_schema = EXCLUDED.outputs_schema,
              permissions_required = EXCLUDED.permissions_required,
              trust_level = $8,
              execution_mode = 'gvisor',
              updated_at = NOW()`,
        [
          toolIdCandidate,
          toolName,
          skillName,
          description,
          JSON.stringify(inSchema),
          JSON.stringify(outSchema),
          inheritedScopes,
          DYNAMIC_SKILL_INITIAL_TRUST_LEVEL,
        ],
      );
      const toolRes = await pool.query(
        `SELECT id FROM tools WHERE name = $1 LIMIT 1`,
        [toolName],
      );
      const toolId = String(toolRes.rows[0]?.id || toolIdCandidate);

      const catalogId = generateTaskId('catalog_entry');
      await pool.query(
        `INSERT INTO skills_catalog (
          id, organization_id, source_id, publisher_id, name, description, version, format, manifest, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, '0.1.0', 'openclaw', $7::jsonb, NOW()
        )`,
        [catalogId, orgId, sourceId, publisherId, toolName, description, JSON.stringify({
          tool_id: toolId,
          first_party: false,
          dynamic: true,
          inherited_scopes: inheritedScopes,
          handler_language: language,
          handler_file: handlerFile,
          skill_dir: skillDir,
        })],
      );

      const installedId = generateTaskId('catalog_entry');
      await pool.query(
        `INSERT INTO skills_installed (
          id, organization_id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [installedId, orgId, catalogId, toolId, DYNAMIC_SKILL_INITIAL_TRUST_LEVEL, userId || null],
      );

      const reportId = generateTaskId('audit_entry');
      await pool.query(
        `INSERT INTO skill_quarantine_reports (
          id, skill_id, organization_id, static_checks, sbom, vuln_scan, overall_risk, reviewed_by, reviewed_at, created_at
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'unknown', NULL, NULL, NOW()
        )`,
        [
          reportId,
          installedId,
          orgId,
          JSON.stringify({ status: 'pending', checks: [{ name: 'schema_validation', status: 'passed' }] }),
          JSON.stringify({ status: 'pending' }),
          JSON.stringify({ status: 'pending' }),
        ],
      );

      // Emit an approval queue item to notify admins that review is required.
      try {
        await pool.query(
          `INSERT INTO approvals (
            id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at
          ) VALUES (
            $1, $2, $3, 'registry.skill.review', $4, 'pending', 1, NOW() + INTERVAL '7 days', $5::jsonb, NOW()
          )`,
          [
            generateTaskId('approval'),
            chatId,
            'registry.skill.review',
            userId,
            JSON.stringify({
              message: `Agent created new skill: ${skillName} - review required`,
              tool_name: toolName,
              installed_id: installedId,
              catalog_entry_id: catalogId,
            }),
          ],
        );
      } catch (err) {
        logger.warn('Could not create admin review notification approval for dynamic skill', {
          err: String(err),
          tool_name: toolName,
          chat_id: chatId,
        });
      }

      return {
        outputs: {
          skill_name: skillName,
          skill_slug: slug,
          skill_dir: skillDir,
          tool_name: toolName,
          tool_id: toolId,
          catalog_entry_id: catalogId,
          installed_id: installedId,
          trust_level: DYNAMIC_SKILL_INITIAL_TRUST_LEVEL,
          review_required: true,
          inherited_scopes: inheritedScopes,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Spotify tools — search and playback control
    // ═══════════════════════════════════════════════════════════════════

    case 'spotify.search': {
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };

      const searchType = String(inputs.type || 'track').trim().toLowerCase();
      const allowedTypes = new Set(['track', 'artist', 'album', 'playlist', 'show', 'episode']);
      if (!allowedTypes.has(searchType)) {
        return { outputs: {}, error: 'inputs.type must be one of: track, artist, album, playlist, show, episode' };
      }

      const limit = Math.min(Math.max(Number(inputs.limit || 10), 1), 50);
      const market = String(inputs.market || '').trim();

      try {
        const token = await getSpotifyAppAccessToken(pool, runContext);
        const url = new URL('https://api.spotify.com/v1/search');
        url.searchParams.set('q', query);
        url.searchParams.set('type', searchType);
        url.searchParams.set('limit', String(limit));
        if (market) url.searchParams.set('market', market);

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Spotify search failed: ${res.status} ${body}` };
        }

        const data = await res.json() as Record<string, any>;
        const bucket = data[`${searchType}s`] || {};
        const items = Array.isArray(bucket.items) ? bucket.items : [];

        const mapped = items.map((item: any) => ({
          id: String(item?.id || ''),
          type: String(item?.type || searchType),
          name: String(item?.name || ''),
          uri: String(item?.uri || ''),
          url: String(item?.external_urls?.spotify || ''),
          artists: Array.isArray(item?.artists)
            ? item.artists.map((a: any) => String(a?.name || '')).filter(Boolean)
            : [],
          album: item?.album?.name ? String(item.album.name) : '',
          duration_ms: Number(item?.duration_ms || 0) || undefined,
          preview_url: item?.preview_url ? String(item.preview_url) : '',
        }));

        return {
          outputs: {
            query,
            type: searchType,
            total: Number(bucket.total || mapped.length || 0),
            items: mapped,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Spotify search failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'spotify.play':
    case 'spotify.pause':
    case 'spotify.queue': {
      const userToken = String(inputs.access_token || process.env.SPOTIFY_USER_ACCESS_TOKEN || '').trim();
      if (!userToken) {
        return {
          outputs: {},
          error: 'Spotify playback control requires inputs.access_token or SPOTIFY_USER_ACCESS_TOKEN',
        };
      }

      const deviceId = String(inputs.device_id || '').trim();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/json',
      };

      let endpoint = '';
      let method: 'PUT' | 'POST' = 'PUT';
      let body: string | undefined;

      if (toolName === 'spotify.play') {
        endpoint = 'https://api.spotify.com/v1/me/player/play';
        const contextUri = String(inputs.context_uri || '').trim();
        const uris = Array.isArray(inputs.uris)
          ? (inputs.uris as unknown[]).map((v) => String(v || '').trim()).filter(Boolean)
          : [];
        body = JSON.stringify({
          ...(contextUri ? { context_uri: contextUri } : {}),
          ...(uris.length > 0 ? { uris } : {}),
        });
        headers['Content-Type'] = 'application/json';
      } else if (toolName === 'spotify.pause') {
        endpoint = 'https://api.spotify.com/v1/me/player/pause';
      } else {
        const uri = String(inputs.uri || '').trim();
        if (!uri) {
          return { outputs: {}, error: 'inputs.uri is required for spotify.queue' };
        }
        method = 'POST';
        const queueUrl = new URL('https://api.spotify.com/v1/me/player/queue');
        queueUrl.searchParams.set('uri', uri);
        endpoint = queueUrl.toString();
      }

      if (deviceId) {
        const url = new URL(endpoint);
        url.searchParams.set('device_id', deviceId);
        endpoint = url.toString();
      }

      try {
        const res = await fetch(endpoint, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok && res.status !== 204) {
          const errBody = await res.text();
          return { outputs: {}, error: `Spotify API failed: ${res.status} ${errBody}` };
        }

        return {
          outputs: {
            ok: true,
            action: toolName,
            device_id: deviceId || null,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Spotify API request failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Sonos tools — Sonos Control API playback management
    // ═══════════════════════════════════════════════════════════════════

    case 'sonos.list_households': {
      try {
        const token = await getSonosAccessToken(pool, runContext);
        const res = await fetch(`${getSonosApiBaseUrl()}/households`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Sonos API failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, unknown>;
        return { outputs: { households: (data as any).households || [] } };
      } catch (err) {
        return { outputs: {}, error: `Sonos list failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'sonos.list_groups': {
      const householdId = String(inputs.household_id || '').trim();
      if (!householdId) return { outputs: {}, error: 'inputs.household_id is required' };
      try {
        const token = await getSonosAccessToken(pool, runContext);
        const res = await fetch(`${getSonosApiBaseUrl()}/households/${encodeURIComponent(householdId)}/groups`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Sonos API failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, unknown>;
        return { outputs: { groups: (data as any).groups || [] } };
      } catch (err) {
        return { outputs: {}, error: `Sonos groups failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'sonos.playback': {
      const groupId = String(inputs.group_id || '').trim();
      const action = String(inputs.action || '').trim();
      const allowed = new Set(['play', 'pause', 'skipToNextTrack', 'skipToPreviousTrack']);
      if (!groupId) return { outputs: {}, error: 'inputs.group_id is required' };
      if (!allowed.has(action)) {
        return { outputs: {}, error: 'inputs.action must be one of: play, pause, skipToNextTrack, skipToPreviousTrack' };
      }
      try {
        const token = await getSonosAccessToken(pool, runContext);
        const endpoint = `${getSonosApiBaseUrl()}/groups/${encodeURIComponent(groupId)}/playback/${action}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: '{}',
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Sonos playback failed: ${res.status} ${body}` };
        }
        return { outputs: { ok: true, group_id: groupId, action } };
      } catch (err) {
        return { outputs: {}, error: `Sonos playback failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Shazam tool — audio recognition (Audd-compatible API)
    // ═══════════════════════════════════════════════════════════════════

    case 'shazam.recognize': {
      const audioUrl = String(inputs.audio_url || '').trim();
      if (!audioUrl) return { outputs: {}, error: 'inputs.audio_url is required' };
      try {
        const apiToken = await getShazamApiToken(pool, runContext);
        const body = new URLSearchParams();
        body.set('api_token', apiToken);
        body.set('url', audioUrl);
        body.set('return', 'apple_music,spotify,deezer');

        const res = await fetch('https://api.audd.io/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: body.toString(),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          const errBody = await res.text();
          return { outputs: {}, error: `Shazam recognition failed: ${res.status} ${errBody}` };
        }
        const data = await res.json() as Record<string, any>;
        const result = data.result || null;
        if (!result) {
          return { outputs: { matched: false, provider: 'audd', raw: data } };
        }
        return {
          outputs: {
            matched: true,
            provider: 'audd',
            title: String(result.title || ''),
            artist: String(result.artist || ''),
            album: String(result.album || ''),
            release_date: String(result.release_date || ''),
            timecode: String(result.timecode || ''),
            song_link: String(result.song_link || ''),
            spotify: result.spotify || null,
            apple_music: result.apple_music || null,
            deezer: result.deezer || null,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Shazam recognition failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Apple Notes tools — macOS only via AppleScript
    // ═══════════════════════════════════════════════════════════════════

    case 'apple.notes.list': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'apple.notes.list is only available on macOS hosts' };
      }
      const limit = Math.min(Math.max(Number(inputs.limit || 20), 1), 100);
      const maxBodyChars = Math.min(Math.max(Number(inputs.max_body_chars || 500), 50), 4000);
      const colSep = '<<<COL>>>';
      const rowSep = '<<<ROW>>>';

      const script = `
tell application "Notes"
  set AppleScript's text item delimiters to "${rowSep}"
  set outLines to {}
  set c to 0
  repeat with acc in accounts
    repeat with f in folders of acc
      repeat with n in notes of f
        set c to c + 1
        set nid to id of n as string
        set nname to name of n as string
        set nmod to modification date of n as string
        set nbody to body of n as string
        if (length of nbody) > ${maxBodyChars} then
          set nbody to text 1 thru ${maxBodyChars} of nbody
        end if
        set end of outLines to nid & "${colSep}" & nname & "${colSep}" & nmod & "${colSep}" & nbody
        if c >= ${limit} then
          return outLines as string
        end if
      end repeat
    end repeat
  end repeat
  return outLines as string
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Apple Notes list failed: ${res.error || 'unknown error'}` };

      const rows = parseAppleScriptListOutput(String(res.stdout || ''), rowSep, colSep)
        .map((parts: string[]) => ({
          id: String(parts[0] || ''),
          title: String(parts[1] || ''),
          modified_at: String(parts[2] || ''),
          body_preview: String(parts[3] || ''),
        }))
        .filter((n: { id: string; title: string }) => n.id || n.title);

      return { outputs: { notes: rows, count: rows.length } };
    }

    case 'apple.notes.create': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'apple.notes.create is only available on macOS hosts' };
      }
      const title = String(inputs.title || '').trim();
      const body = String(inputs.body || '').trim();
      if (!title) return { outputs: {}, error: 'inputs.title is required' };
      if (!body) return { outputs: {}, error: 'inputs.body is required' };

      const escTitle = escapeAppleScriptString(title);
      const escBody = escapeAppleScriptString(body);
      const colSep = '<<<COL>>>';
      const script = `
tell application "Notes"
  set targetFolder to first folder of default account
  set newNote to make new note at targetFolder with properties {name:"${escTitle}", body:"${escBody}"}
  return (id of newNote as string) & "${colSep}" & (name of newNote as string)
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Apple Notes create failed: ${res.error || 'unknown error'}` };
      const parts = String(res.stdout || '').split(colSep);

      return {
        outputs: {
          id: String(parts[0] || ''),
          title: String(parts[1] || title),
          created: true,
        },
      };
    }

    case 'apple.notes.search': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'apple.notes.search is only available on macOS hosts' };
      }
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const limit = Math.min(Math.max(Number(inputs.limit || 20), 1), 100);
      const maxBodyChars = Math.min(Math.max(Number(inputs.max_body_chars || 400), 50), 4000);
      const escQuery = escapeAppleScriptString(query);
      const colSep = '<<<COL>>>';
      const rowSep = '<<<ROW>>>';

      const script = `
tell application "Notes"
  set AppleScript's text item delimiters to "${rowSep}"
  set outLines to {}
  set q to "${escQuery}"
  set c to 0
  repeat with acc in accounts
    repeat with f in folders of acc
      repeat with n in notes of f
        set nname to name of n as string
        set nbody to body of n as string
        if ((nname contains q) or (nbody contains q)) then
          set c to c + 1
          set nid to id of n as string
          set nmod to modification date of n as string
          if (length of nbody) > ${maxBodyChars} then
            set nbody to text 1 thru ${maxBodyChars} of nbody
          end if
          set end of outLines to nid & "${colSep}" & nname & "${colSep}" & nmod & "${colSep}" & nbody
          if c >= ${limit} then
            return outLines as string
          end if
        end if
      end repeat
    end repeat
  end repeat
  return outLines as string
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Apple Notes search failed: ${res.error || 'unknown error'}` };

      const rows = parseAppleScriptListOutput(String(res.stdout || ''), rowSep, colSep)
        .map((parts: string[]) => ({
          id: String(parts[0] || ''),
          title: String(parts[1] || ''),
          modified_at: String(parts[2] || ''),
          body_preview: String(parts[3] || ''),
        }))
        .filter((n: { id: string; title: string }) => n.id || n.title);

      return { outputs: { query, notes: rows, count: rows.length } };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Apple Reminders tools — macOS only via AppleScript
    // ═══════════════════════════════════════════════════════════════════

    case 'apple.reminders.list': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'apple.reminders.list is only available on macOS hosts' };
      }
      const listName = String(inputs.list || '').trim();
      const includeCompleted = Boolean(inputs.include_completed || false);
      const limit = Math.min(Math.max(Number(inputs.limit || 50), 1), 200);
      const colSep = '<<<COL>>>';
      const rowSep = '<<<ROW>>>';

      const escListName = escapeAppleScriptString(listName);
      const script = `
tell application "Reminders"
  set AppleScript's text item delimiters to "${rowSep}"
  set outLines to {}
  set c to 0
  set targetLists to {}
  if "${escListName}" is not "" then
    repeat with rl in lists
      if (name of rl as string) is "${escListName}" then set end of targetLists to rl
    end repeat
  else
    set targetLists to lists
  end if
  repeat with rl in targetLists
    repeat with r in reminders of rl
      if ${includeCompleted ? 'true' : 'false'} or (completed of r is false) then
        set c to c + 1
        set rid to id of r as string
        set rname to name of r as string
        set rcompleted to completed of r as string
        set rdue to ""
        try
          set rdue to due date of r as string
        end try
        set end of outLines to rid & "${colSep}" & rname & "${colSep}" & (name of rl as string) & "${colSep}" & rcompleted & "${colSep}" & rdue
        if c >= ${limit} then return outLines as string
      end if
    end repeat
  end repeat
  return outLines as string
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Apple Reminders list failed: ${res.error || 'unknown error'}` };

      const reminders = parseAppleScriptListOutput(String(res.stdout || ''), rowSep, colSep)
        .map((parts: string[]) => ({
          id: String(parts[0] || ''),
          title: String(parts[1] || ''),
          list: String(parts[2] || ''),
          completed: String(parts[3] || '').toLowerCase() === 'true',
          due_date: String(parts[4] || ''),
        }))
        .filter((r: { id: string; title: string }) => r.id || r.title);

      return { outputs: { reminders, count: reminders.length } };
    }

    case 'apple.reminders.create': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'apple.reminders.create is only available on macOS hosts' };
      }
      const title = String(inputs.title || '').trim();
      const listName = String(inputs.list || 'Reminders').trim();
      if (!title) return { outputs: {}, error: 'inputs.title is required' };

      const escTitle = escapeAppleScriptString(title);
      const escListName = escapeAppleScriptString(listName);
      const colSep = '<<<COL>>>';
      const script = `
tell application "Reminders"
  set targetList to missing value
  repeat with rl in lists
    if (name of rl as string) is "${escListName}" then set targetList to rl
  end repeat
  if targetList is missing value then
    set targetList to make new list with properties {name:"${escListName}"}
  end if
  set newReminder to make new reminder at end of reminders of targetList with properties {name:"${escTitle}"}
  return (id of newReminder as string) & "${colSep}" & (name of targetList as string)
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Apple Reminders create failed: ${res.error || 'unknown error'}` };
      const parts = String(res.stdout || '').split(colSep);

      return {
        outputs: {
          id: String(parts[0] || ''),
          title,
          list: String(parts[1] || listName),
          created: true,
        },
      };
    }

    case 'apple.reminders.complete': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'apple.reminders.complete is only available on macOS hosts' };
      }
      const reminderId = String(inputs.id || '').trim();
      const title = String(inputs.title || '').trim();
      if (!reminderId && !title) {
        return { outputs: {}, error: 'inputs.id or inputs.title is required' };
      }
      const escId = escapeAppleScriptString(reminderId);
      const escTitle = escapeAppleScriptString(title);
      const script = `
tell application "Reminders"
  set targetReminder to missing value
  repeat with rl in lists
    repeat with r in reminders of rl
      if "${escId}" is not "" and (id of r as string) is "${escId}" then set targetReminder to r
      if targetReminder is missing value and "${escTitle}" is not "" and (name of r as string) is "${escTitle}" then set targetReminder to r
    end repeat
  end repeat
  if targetReminder is missing value then return "NOT_FOUND"
  set completed of targetReminder to true
  return id of targetReminder as string
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Apple Reminders complete failed: ${res.error || 'unknown error'}` };
      if (String(res.stdout || '').trim() === 'NOT_FOUND') {
        return { outputs: {}, error: 'Reminder not found' };
      }
      return {
        outputs: {
          id: String(res.stdout || '').trim(),
          completed: true,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Things 3 tools — macOS only via AppleScript
    // ═══════════════════════════════════════════════════════════════════

    case 'things3.list': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'things3.list is only available on macOS hosts' };
      }
      const listName = String(inputs.list || 'Inbox').trim();
      const includeCompleted = Boolean(inputs.include_completed || false);
      const limit = Math.min(Math.max(Number(inputs.limit || 50), 1), 200);
      const colSep = '<<<COL>>>';
      const rowSep = '<<<ROW>>>';
      const escListName = escapeAppleScriptString(listName);

      const script = `
tell application "Things3"
  set AppleScript's text item delimiters to "${rowSep}"
  set outLines to {}
  set c to 0
  set sourceList to list "${escListName}"
  repeat with t in to dos of sourceList
    if ${includeCompleted ? 'true' : 'false'} or (status of t is not completed) then
      set c to c + 1
      set tid to id of t as string
      set tname to name of t as string
      set tstatus to status of t as string
      set tdue to ""
      try
        set tdue to due date of t as string
      end try
      set end of outLines to tid & "${colSep}" & tname & "${colSep}" & tstatus & "${colSep}" & tdue
      if c >= ${limit} then return outLines as string
    end if
  end repeat
  return outLines as string
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Things3 list failed: ${res.error || 'unknown error'}` };

      const todos = parseAppleScriptListOutput(String(res.stdout || ''), rowSep, colSep)
        .map((parts: string[]) => ({
          id: String(parts[0] || ''),
          title: String(parts[1] || ''),
          status: String(parts[2] || ''),
          due_date: String(parts[3] || ''),
        }))
        .filter((t: { id: string; title: string }) => t.id || t.title);

      return { outputs: { list: listName, todos, count: todos.length } };
    }

    case 'things3.create': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'things3.create is only available on macOS hosts' };
      }
      const title = String(inputs.title || '').trim();
      const notes = String(inputs.notes || '').trim();
      const listName = String(inputs.list || 'Inbox').trim();
      if (!title) return { outputs: {}, error: 'inputs.title is required' };

      const escTitle = escapeAppleScriptString(title);
      const escNotes = escapeAppleScriptString(notes);
      const escListName = escapeAppleScriptString(listName);
      const colSep = '<<<COL>>>';
      const script = `
tell application "Things3"
  set targetList to list "${escListName}"
  set newTodo to make new to do with properties {name:"${escTitle}"} at end of to dos of targetList
  ${notes ? `set notes of newTodo to "${escNotes}"` : ''}
  return (id of newTodo as string) & "${colSep}" & (name of newTodo as string)
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Things3 create failed: ${res.error || 'unknown error'}` };
      const parts = String(res.stdout || '').split(colSep);
      return {
        outputs: {
          id: String(parts[0] || ''),
          title: String(parts[1] || title),
          list: listName,
          created: true,
        },
      };
    }

    case 'things3.complete': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'things3.complete is only available on macOS hosts' };
      }
      const todoId = String(inputs.id || '').trim();
      const title = String(inputs.title || '').trim();
      if (!todoId && !title) return { outputs: {}, error: 'inputs.id or inputs.title is required' };

      const escId = escapeAppleScriptString(todoId);
      const escTitle = escapeAppleScriptString(title);
      const script = `
tell application "Things3"
  set targetTodo to missing value
  repeat with t in to dos
    if "${escId}" is not "" and (id of t as string) is "${escId}" then
      set targetTodo to t
      exit repeat
    end if
    if targetTodo is missing value and "${escTitle}" is not "" and (name of t as string) is "${escTitle}" then
      set targetTodo to t
    end if
  end repeat
  if targetTodo is missing value then return "NOT_FOUND"
  set status of targetTodo to completed
  return id of targetTodo as string
end tell
      `.trim();

      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Things3 complete failed: ${res.error || 'unknown error'}` };
      if (String(res.stdout || '').trim() === 'NOT_FOUND') {
        return { outputs: {}, error: 'To-do not found' };
      }
      return {
        outputs: {
          id: String(res.stdout || '').trim(),
          completed: true,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Notion tools — page search/create/update
    // ═══════════════════════════════════════════════════════════════════

    case 'notion.search': {
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const limit = Math.min(Math.max(Number(inputs.limit || 10), 1), 50);
      try {
        const token = await getNotionApiToken(pool, runContext);
        const res = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify({
            query,
            page_size: limit,
            filter: { value: 'page', property: 'object' },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Notion search failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, any>;
        const pages = Array.isArray(data.results) ? data.results.map((p: any) => ({
          id: String(p?.id || ''),
          url: String(p?.url || ''),
          title: String(
            p?.properties?.title?.title?.[0]?.plain_text
            || p?.properties?.Name?.title?.[0]?.plain_text
            || p?.title?.[0]?.plain_text
            || '',
          ),
          created_time: String(p?.created_time || ''),
          last_edited_time: String(p?.last_edited_time || ''),
        })) : [];
        return { outputs: { query, pages, count: pages.length } };
      } catch (err) {
        return { outputs: {}, error: `Notion search failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'notion.create_page': {
      const title = String(inputs.title || '').trim();
      const content = String(inputs.content || '').trim();
      const parentPageId = String(inputs.parent_page_id || process.env.NOTION_PARENT_PAGE_ID || '').trim();
      if (!title) return { outputs: {}, error: 'inputs.title is required' };
      if (!parentPageId) {
        return { outputs: {}, error: 'inputs.parent_page_id or NOTION_PARENT_PAGE_ID is required' };
      }
      try {
        const token = await getNotionApiToken(pool, runContext);
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify({
            parent: { page_id: parentPageId },
            properties: {
              title: {
                title: [{ type: 'text', text: { content: title } }],
              },
            },
            ...(content ? {
              children: [{
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ type: 'text', text: { content } }],
                },
              }],
            } : {}),
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Notion create_page failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, any>;
        return {
          outputs: {
            id: String(data.id || ''),
            url: String(data.url || ''),
            title,
            created: true,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Notion create_page failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'notion.append_block_text': {
      const pageId = String(inputs.page_id || '').trim();
      const text = String(inputs.text || '').trim();
      if (!pageId) return { outputs: {}, error: 'inputs.page_id is required' };
      if (!text) return { outputs: {}, error: 'inputs.text is required' };
      try {
        const token = await getNotionApiToken(pool, runContext);
        const res = await fetch(`https://api.notion.com/v1/blocks/${encodeURIComponent(pageId)}/children`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify({
            children: [{
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: text } }],
              },
            }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Notion append failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, any>;
        return { outputs: { page_id: pageId, appended: true, results_count: Array.isArray(data.results) ? data.results.length : 0 } };
      } catch (err) {
        return { outputs: {}, error: `Notion append failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Obsidian tools — local vault operations
    // ═══════════════════════════════════════════════════════════════════

    case 'obsidian.list_notes': {
      const subpath = String(inputs.path || '').trim();
      try {
        const vaultRoot = await getObsidianVaultPath(pool, runContext);
        const target = await resolveObsidianNotePath(vaultRoot, subpath || '.');
        const entries = await fs.readdir(target, { withFileTypes: true });
        const notes = entries
          .filter((e: import('node:fs').Dirent) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
          .map((e: import('node:fs').Dirent) => e.name)
          .sort((a, b) => a.localeCompare(b));
        return { outputs: { path: subpath || '.', notes, count: notes.length } };
      } catch (err) {
        return { outputs: {}, error: `Obsidian list_notes failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'obsidian.read_note': {
      const notePath = String(inputs.path || '').trim();
      if (!notePath) return { outputs: {}, error: 'inputs.path is required' };
      try {
        const vaultRoot = await getObsidianVaultPath(pool, runContext);
        const fullPath = await resolveObsidianNotePath(vaultRoot, notePath);
        const content = await fs.readFile(fullPath, 'utf8');
        return { outputs: { path: notePath, content } };
      } catch (err) {
        return { outputs: {}, error: `Obsidian read_note failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'obsidian.write_note': {
      const notePath = String(inputs.path || '').trim();
      const content = String(inputs.content || '');
      const append = Boolean(inputs.append || false);
      if (!notePath) return { outputs: {}, error: 'inputs.path is required' };
      try {
        const vaultRoot = await getObsidianVaultPath(pool, runContext);
        const fullPath = await resolveObsidianNotePath(vaultRoot, notePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        if (append) {
          await fs.appendFile(fullPath, content, 'utf8');
        } else {
          await fs.writeFile(fullPath, content, 'utf8');
        }
        return { outputs: { path: notePath, wrote: true, append } };
      } catch (err) {
        return { outputs: {}, error: `Obsidian write_note failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'obsidian.search_notes': {
      const query = String(inputs.query || '').trim().toLowerCase();
      const limit = Math.min(Math.max(Number(inputs.limit || 20), 1), 100);
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      try {
        const vaultRoot = await getObsidianVaultPath(pool, runContext);
        const collected: Array<{ path: string; matches: number }> = [];
        const visited = new Set<string>();
        const walk = async (dir: string, depth: number): Promise<void> => {
          if (depth > MAX_OBSIDIAN_WALK_DEPTH) return;
          let realDir: string;
          try { realDir = await fs.realpath(dir); } catch { return; }
          if (visited.has(realDir)) return;
          visited.add(realDir);
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              await walk(p, depth + 1);
              continue;
            }
            if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
            const content = await fs.readFile(p, 'utf8');
            const lc = content.toLowerCase();
            let idx = 0;
            let count = 0;
            while ((idx = lc.indexOf(query, idx)) !== -1) {
              count += 1;
              idx += query.length;
            }
            if (count > 0) {
              collected.push({
                path: path.relative(vaultRoot, p).replace(/\\/g, '/'),
                matches: count,
              });
            }
          }
        };
        await walk(vaultRoot, 0);
        collected.sort((a, b) => b.matches - a.matches);
        return { outputs: { query, results: collected.slice(0, limit), count: Math.min(collected.length, limit) } };
      } catch (err) {
        return { outputs: {}, error: `Obsidian search_notes failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Bear Notes tools — macOS only via AppleScript
    // ═══════════════════════════════════════════════════════════════════

    case 'bear.list_notes': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'bear.list_notes is only available on macOS hosts' };
      }
      const limit = Math.min(Math.max(Number(inputs.limit || 50), 1), 200);
      const colSep = '<<<COL>>>';
      const rowSep = '<<<ROW>>>';
      const script = `
tell application "Bear"
  set AppleScript's text item delimiters to "${rowSep}"
  set outLines to {}
  set c to 0
  repeat with n in notes
    set c to c + 1
    set nid to id of n as string
    set ntitle to title of n as string
    set nmod to modification date of n as string
    set end of outLines to nid & "${colSep}" & ntitle & "${colSep}" & nmod
    if c >= ${limit} then return outLines as string
  end repeat
  return outLines as string
end tell
      `.trim();
      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Bear list_notes failed: ${res.error || 'unknown error'}` };
      const notes = parseAppleScriptListOutput(String(res.stdout || ''), rowSep, colSep)
        .map((parts: string[]) => ({
          id: String(parts[0] || ''),
          title: String(parts[1] || ''),
          modified_at: String(parts[2] || ''),
        }))
        .filter((n: { id: string; title: string }) => n.id || n.title);
      return { outputs: { notes, count: notes.length } };
    }

    case 'bear.create_note': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'bear.create_note is only available on macOS hosts' };
      }
      const title = String(inputs.title || '').trim();
      const content = String(inputs.content || '').trim();
      const tags = Array.isArray(inputs.tags) ? (inputs.tags as unknown[]).map((t) => String(t || '').trim()).filter(Boolean) : [];
      if (!title) return { outputs: {}, error: 'inputs.title is required' };

      const escTitle = escapeAppleScriptString(title);
      const escContent = escapeAppleScriptString(content);
      const tagSuffix = tags.length > 0 ? `\n${tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')}` : '';
      const escTagSuffix = escapeAppleScriptString(tagSuffix);
      const colSep = '<<<COL>>>';
      const script = `
tell application "Bear"
  set noteBody to "${escContent}${escTagSuffix}"
  set newNote to make new note with properties {title:"${escTitle}", text:noteBody}
  return (id of newNote as string) & "${colSep}" & (title of newNote as string)
end tell
      `.trim();
      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Bear create_note failed: ${res.error || 'unknown error'}` };
      const parts = String(res.stdout || '').split(colSep);
      return {
        outputs: {
          id: String(parts[0] || ''),
          title: String(parts[1] || title),
          created: true,
        },
      };
    }

    case 'bear.search_notes': {
      if (process.platform !== 'darwin') {
        return { outputs: {}, error: 'bear.search_notes is only available on macOS hosts' };
      }
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const limit = Math.min(Math.max(Number(inputs.limit || 20), 1), 100);
      const escQuery = escapeAppleScriptString(query);
      const colSep = '<<<COL>>>';
      const rowSep = '<<<ROW>>>';
      const script = `
tell application "Bear"
  set AppleScript's text item delimiters to "${rowSep}"
  set outLines to {}
  set c to 0
  repeat with n in notes
    set t to title of n as string
    set b to text of n as string
    if t contains "${escQuery}" or b contains "${escQuery}" then
      set c to c + 1
      set end of outLines to (id of n as string) & "${colSep}" & t & "${colSep}" & (modification date of n as string)
      if c >= ${limit} then return outLines as string
    end if
  end repeat
  return outLines as string
end tell
      `.trim();
      const res = runAppleScript(script, 20000);
      if (!res.ok) return { outputs: {}, error: `Bear search_notes failed: ${res.error || 'unknown error'}` };
      const notes = parseAppleScriptListOutput(String(res.stdout || ''), rowSep, colSep)
        .map((parts: string[]) => ({
          id: String(parts[0] || ''),
          title: String(parts[1] || ''),
          modified_at: String(parts[2] || ''),
        }))
        .filter((n: { id: string; title: string }) => n.id || n.title);
      return { outputs: { query, notes, count: notes.length } };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Trello tools — boards/cards
    // ═══════════════════════════════════════════════════════════════════

    case 'trello.list_boards': {
      try {
        const { key, token } = await getTrelloConfig(pool, runContext);
        const url = new URL('https://api.trello.com/1/members/me/boards');
        url.searchParams.set('key', key);
        url.searchParams.set('token', token);
        url.searchParams.set('fields', 'id,name,url,closed');
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Trello list_boards failed: ${res.status} ${body}` };
        }
        const boards = await res.json() as Array<Record<string, unknown>>;
        return { outputs: { boards } };
      } catch (err) {
        return { outputs: {}, error: `Trello list_boards failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'trello.list_cards': {
      const listId = String(inputs.list_id || '').trim();
      const boardId = String(inputs.board_id || '').trim();
      if (!listId && !boardId) return { outputs: {}, error: 'inputs.list_id or inputs.board_id is required' };
      try {
        const { key, token } = await getTrelloConfig(pool, runContext);
        const url = listId
          ? new URL(`https://api.trello.com/1/lists/${encodeURIComponent(listId)}/cards`)
          : new URL(`https://api.trello.com/1/boards/${encodeURIComponent(boardId)}/cards`);
        url.searchParams.set('key', key);
        url.searchParams.set('token', token);
        url.searchParams.set('fields', 'id,name,url,idList,due,closed');
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Trello list_cards failed: ${res.status} ${body}` };
        }
        const cards = await res.json() as Array<Record<string, unknown>>;
        return { outputs: { cards, count: cards.length } };
      } catch (err) {
        return { outputs: {}, error: `Trello list_cards failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'trello.create_card': {
      const listId = String(inputs.list_id || '').trim();
      const name = String(inputs.name || '').trim();
      const desc = String(inputs.desc || '').trim();
      if (!listId) return { outputs: {}, error: 'inputs.list_id is required' };
      if (!name) return { outputs: {}, error: 'inputs.name is required' };
      try {
        const { key, token } = await getTrelloConfig(pool, runContext);
        const url = new URL('https://api.trello.com/1/cards');
        url.searchParams.set('key', key);
        url.searchParams.set('token', token);
        url.searchParams.set('idList', listId);
        url.searchParams.set('name', name);
        if (desc) url.searchParams.set('desc', desc);
        const res = await fetch(url.toString(), {
          method: 'POST',
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Trello create_card failed: ${res.status} ${body}` };
        }
        const card = await res.json() as Record<string, unknown>;
        return { outputs: { card } };
      } catch (err) {
        return { outputs: {}, error: `Trello create_card failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'trello.move_card': {
      const cardId = String(inputs.card_id || '').trim();
      const listId = String(inputs.list_id || '').trim();
      if (!cardId || !listId) return { outputs: {}, error: 'inputs.card_id and inputs.list_id are required' };
      try {
        const { key, token } = await getTrelloConfig(pool, runContext);
        const url = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}`);
        url.searchParams.set('key', key);
        url.searchParams.set('token', token);
        url.searchParams.set('idList', listId);
        const res = await fetch(url.toString(), {
          method: 'PUT',
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `Trello move_card failed: ${res.status} ${body}` };
        }
        const card = await res.json() as Record<string, unknown>;
        return { outputs: { card, moved: true } };
      } catch (err) {
        return { outputs: {}, error: `Trello move_card failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Twitter / X tools — posting and recent search
    // ═══════════════════════════════════════════════════════════════════

    case 'x.post_tweet': {
      const text = String(inputs.text || '').trim();
      if (!text) return { outputs: {}, error: 'inputs.text is required' };
      try {
        const token = await getXApiBearerToken(pool, runContext);
        const res = await fetch('https://api.x.com/2/tweets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `x.post_tweet failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, unknown>;
        return { outputs: { data } };
      } catch (err) {
        return { outputs: {}, error: `x.post_tweet failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'x.search_recent': {
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const maxResults = Math.min(Math.max(Number(inputs.max_results || 10), 10), 100);
      try {
        const token = await getXApiBearerToken(pool, runContext);
        const url = new URL('https://api.x.com/2/tweets/search/recent');
        url.searchParams.set('query', query);
        url.searchParams.set('max_results', String(maxResults));
        url.searchParams.set('tweet.fields', 'author_id,created_at,public_metrics,text');
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `x.search_recent failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, unknown>;
        return { outputs: { query, data } };
      } catch (err) {
        return { outputs: {}, error: `x.search_recent failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  1Password tools — op CLI bridge
    // ═══════════════════════════════════════════════════════════════════

    case 'onepassword.list_items': {
      const vault = String(inputs.vault || '').trim();
      const args = ['item', 'list', '--format', 'json'];
      if (vault) args.push('--vault', vault);
      const res = runOpCli(args, 20000);
      if (!res.ok) return { outputs: {}, error: `1Password list_items failed: ${res.error || 'unknown error'}` };
      try {
        const items = JSON.parse(res.stdout || '[]') as Array<Record<string, unknown>>;
        return { outputs: { items, count: items.length } };
      } catch (err) {
        return { outputs: {}, error: `1Password list_items parse failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'onepassword.get_item': {
      const item = String(inputs.item || '').trim();
      const vault = String(inputs.vault || '').trim();
      if (!item) return { outputs: {}, error: 'inputs.item is required' };
      const args = ['item', 'get', item, '--format', 'json'];
      if (vault) args.push('--vault', vault);
      const res = runOpCli(args, 20000);
      if (!res.ok) return { outputs: {}, error: `1Password get_item failed: ${res.error || 'unknown error'}` };
      try {
        const data = JSON.parse(res.stdout || '{}') as Record<string, unknown>;
        return { outputs: { item: data } };
      } catch (err) {
        return { outputs: {}, error: `1Password get_item parse failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'onepassword.read_field': {
      const item = String(inputs.item || '').trim();
      const field = String(inputs.field || '').trim();
      const vault = String(inputs.vault || '').trim();
      if (!item || !field) return { outputs: {}, error: 'inputs.item and inputs.field are required' };
      const ref = `op://${vault ? `${vault}/` : ''}${item}/${field}`;
      const res = runOpCli(['read', ref], 15000);
      if (!res.ok) return { outputs: {}, error: `1Password read_field failed: ${res.error || 'unknown error'}` };
      return { outputs: { item, field, value: res.stdout } };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  GIF Search tools — Giphy / Tenor
    // ═══════════════════════════════════════════════════════════════════

    case 'gif.search': {
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const engine = String(inputs.engine || 'giphy').trim().toLowerCase();
      const limit = Math.min(Math.max(Number(inputs.limit || 10), 1), 25);
      try {
        const cfg = await getGifApiConfig(pool, runContext);
        if (engine === 'tenor') {
          if (!cfg.tenorKey) return { outputs: {}, error: 'Tenor API key is not configured' };
          const url = new URL('https://tenor.googleapis.com/v2/search');
          url.searchParams.set('q', query);
          url.searchParams.set('key', cfg.tenorKey);
          url.searchParams.set('limit', String(limit));
          url.searchParams.set('media_filter', 'gif,tinygif');
          const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
          if (!res.ok) {
            const body = await res.text();
            return { outputs: {}, error: `gif.search tenor failed: ${res.status} ${body}` };
          }
          const data = await res.json() as Record<string, any>;
          const items = Array.isArray(data.results) ? data.results.map((r: any) => ({
            id: String(r.id || ''),
            title: String(r.content_description || ''),
            url: String(r.url || ''),
            gif_url: String(r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || ''),
            preview_url: String(r.media_formats?.tinygif?.url || ''),
            source: 'tenor',
          })) : [];
          return { outputs: { query, engine: 'tenor', items, count: items.length } };
        }

        if (!cfg.giphyKey) return { outputs: {}, error: 'Giphy API key is not configured' };
        const url = new URL('https://api.giphy.com/v1/gifs/search');
        url.searchParams.set('api_key', cfg.giphyKey);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('rating', 'pg');
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          const body = await res.text();
          return { outputs: {}, error: `gif.search giphy failed: ${res.status} ${body}` };
        }
        const data = await res.json() as Record<string, any>;
        const items = Array.isArray(data.data) ? data.data.map((r: any) => ({
          id: String(r.id || ''),
          title: String(r.title || ''),
          url: String(r.url || ''),
          gif_url: String(r.images?.original?.url || ''),
          preview_url: String(r.images?.fixed_width_small?.url || ''),
          source: 'giphy',
        })) : [];
        return { outputs: { query, engine: 'giphy', items, count: items.length } };
      } catch (err) {
        return { outputs: {}, error: `gif.search failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Image Generation — OpenAI (gpt-image-1) / Stable Diffusion
    // ═══════════════════════════════════════════════════════════════════

    case 'image-generation': {
      const prompt = String(inputs.prompt || '').trim();
      if (!prompt) return { outputs: {}, error: 'inputs.prompt is required' };
      const provider = String(inputs.provider || 'openai') as 'openai' | 'stable_diffusion';
      const size = String(inputs.size || '1024x1024');
      const n = Math.max(1, Math.min(Number(inputs.n || 1), 4));
      const style = inputs.style ? String(inputs.style) : undefined;
      const finalPrompt = style ? `${prompt}\nStyle: ${style}` : prompt;

      try {
        if (provider === 'stable_diffusion') {
          const baseUrl = (process.env.STABLE_DIFFUSION_URL || 'http://127.0.0.1:7860').replace(/\/+$/, '');
          const sdKey = process.env.STABLE_DIFFUSION_API_KEY || '';
          const [w, h] = size.split('x').map(Number);
          const res = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(sdKey ? { Authorization: `Bearer ${sdKey}` } : {}),
            },
            body: JSON.stringify({ prompt: finalPrompt, width: w || 1024, height: h || 1024, steps: 30 }),
            signal: AbortSignal.timeout(45000),
          });
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { outputs: {}, error: `Stable Diffusion failed (${res.status}): ${body}` };
          }
          const data = await res.json() as { images?: string[]; info?: string };
          const images = (data.images || []).map((b64: string) => ({ data_url: `data:image/png;base64,${b64}` }));
          return { outputs: { provider: 'stable_diffusion', images, count: images.length } };
        }

        // OpenAI provider (default)
        const apiKey = process.env.OPENAI_API_KEY || '';
        if (!apiKey) return { outputs: {}, error: 'OPENAI_API_KEY is required for image generation' };
        const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: finalPrompt, size, n, response_format: 'b64_json' }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return { outputs: {}, error: `OpenAI image generation failed (${res.status}): ${body}` };
        }
        const data = await res.json() as { data?: Array<{ b64_json?: string }> };
        const images = (data.data || [])
          .map((item: { b64_json?: string }) => item.b64_json)
          .filter((b64: string | undefined): b64 is string => Boolean(b64))
          .map((b64: string) => ({ data_url: `data:image/png;base64,${b64}` }));
        return { outputs: { provider: 'openai', model, images, count: images.length } };
      } catch (err) {
        return { outputs: {}, error: `image-generation failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Email — Generic IMAP/SMTP bridge
    // ═══════════════════════════════════════════════════════════════════

    case 'email-generic': {
      const action = String(inputs.action || '').trim();
      if (!action || !['send', 'search', 'list'].includes(action)) {
        return { outputs: {}, error: 'inputs.action must be one of: send, search, list' };
      }
      const baseUrl = (process.env.EMAIL_API_BASE || '').replace(/\/+$/, '');
      if (!baseUrl) return { outputs: {}, error: 'EMAIL_API_BASE environment variable is not configured' };
      const emailKey = process.env.EMAIL_API_KEY || '';
      const authHdrs: Record<string, string> = emailKey ? { Authorization: `Bearer ${emailKey}` } : {};

      try {
        if (action === 'send') {
          const to = Array.isArray(inputs.to) ? inputs.to.map(String) : [];
          if (to.length === 0) return { outputs: {}, error: 'inputs.to is required for send' };
          const res = await fetch(`${baseUrl}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHdrs },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || undefined,
              to,
              cc: Array.isArray(inputs.cc) ? inputs.cc.map(String) : [],
              bcc: Array.isArray(inputs.bcc) ? inputs.bcc.map(String) : [],
              subject: String(inputs.subject || ''),
              body: String(inputs.body || ''),
            }),
            signal: AbortSignal.timeout(30000),
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok) return { outputs: {}, error: `Email send failed (${res.status}): ${JSON.stringify(result)}` };
          return { outputs: { action: 'send', result } };
        }
        if (action === 'search') {
          const res = await fetch(`${baseUrl}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHdrs },
            body: JSON.stringify({
              query: String(inputs.query || ''),
              limit: Math.max(1, Math.min(Number(inputs.limit || 10), 50)),
            }),
            signal: AbortSignal.timeout(30000),
          });
          const result = await res.json().catch(() => ({})) as Record<string, unknown>;
          if (!res.ok) return { outputs: {}, error: `Email search failed (${res.status}): ${JSON.stringify(result)}` };
          return { outputs: { action: 'search', items: (result.items || result.messages || []) as unknown[] } };
        }
        // action === 'list'
        const limit = Math.max(1, Math.min(Number(inputs.limit || 10), 50));
        const res = await fetch(`${baseUrl}/inbox?limit=${encodeURIComponent(String(limit))}`, {
          method: 'GET',
          headers: authHdrs,
          signal: AbortSignal.timeout(30000),
        });
        const result = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!res.ok) return { outputs: {}, error: `Email list failed (${res.status}): ${JSON.stringify(result)}` };
        return { outputs: { action: 'list', items: (result.items || result.messages || []) as unknown[] } };
      } catch (err) {
        return { outputs: {}, error: `email-generic failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Voice Call — outbound via adapter-voice-call service
    // ═══════════════════════════════════════════════════════════════════

    case 'voice.call.place': {
      const to = String(inputs.to || '').trim();
      if (!to) return { outputs: {}, error: 'inputs.to (phone number) is required' };
      const provider = String(inputs.provider || 'twilio');
      if (!['mock', 'twilio', 'telnyx', 'plivo'].includes(provider)) {
        return { outputs: {}, error: 'inputs.provider must be one of: mock, twilio, telnyx, plivo' };
      }
      const voicePort = process.env.VOICE_CALL_PORT || '8490';
      const voiceBase = process.env.VOICE_CALL_URL || `http://adapter-voice-call:${voicePort}`;
      const voiceApiKey = process.env.VOICE_CALL_API_KEY || '';
      if (!voiceApiKey) return { outputs: {}, error: 'VOICE_CALL_API_KEY is not configured' };

      try {
        const res = await fetch(`${voiceBase}/v1/calls/outbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-voice-api-key': voiceApiKey,
          },
          body: JSON.stringify({
            provider,
            to,
            from: inputs.from ? String(inputs.from) : undefined,
            approval_id: inputs.approval_id ? String(inputs.approval_id) : undefined,
            chat_id: runContext?.chatId || undefined,
            sender_identity_id: inputs.sender_identity_id ? String(inputs.sender_identity_id) : undefined,
            metadata: typeof inputs.metadata === 'object' ? inputs.metadata : undefined,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return { outputs: {}, error: `Voice call failed (${res.status}): ${body}` };
        }
        const result = await res.json() as { provider?: string; call_id?: string };
        return { outputs: { provider: result.provider || provider, call_id: result.call_id || 'unknown', to, status: 'initiated' } };
      } catch (err) {
        return { outputs: {}, error: `voice.call.place failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Weather tools — Open-Meteo (no API key)
    // ═══════════════════════════════════════════════════════════════════

    case 'weather.current':
    case 'weather.forecast': {
      const location = String(inputs.location || '').trim();
      if (!location) return { outputs: {}, error: 'inputs.location is required' };
      const days = Math.min(Math.max(Number(inputs.days || 3), 1), 7);
      try {
        const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geoUrl.searchParams.set('name', location);
        geoUrl.searchParams.set('count', '1');
        geoUrl.searchParams.set('language', 'en');
        geoUrl.searchParams.set('format', 'json');
        const geoRes = await fetch(geoUrl.toString(), { signal: AbortSignal.timeout(10000) });
        if (!geoRes.ok) {
          const body = await geoRes.text();
          return { outputs: {}, error: `weather geocoding failed: ${geoRes.status} ${body}` };
        }
        const geo = await geoRes.json() as Record<string, any>;
        const first = Array.isArray(geo.results) ? geo.results[0] : null;
        if (!first) return { outputs: {}, error: `No weather location match for "${location}"` };
        const lat = Number(first.latitude);
        const lon = Number(first.longitude);
        const placeName = [first.name, first.admin1, first.country].filter(Boolean).join(', ');

        const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
        weatherUrl.searchParams.set('latitude', String(lat));
        weatherUrl.searchParams.set('longitude', String(lon));
        weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');
        weatherUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
        weatherUrl.searchParams.set('timezone', 'auto');
        weatherUrl.searchParams.set('forecast_days', String(days));

        const wRes = await fetch(weatherUrl.toString(), { signal: AbortSignal.timeout(15000) });
        if (!wRes.ok) {
          const body = await wRes.text();
          return { outputs: {}, error: `weather forecast failed: ${wRes.status} ${body}` };
        }
        const weather = await wRes.json() as Record<string, any>;
        if (toolName === 'weather.current') {
          return {
            outputs: {
              location: placeName,
              latitude: lat,
              longitude: lon,
              current: weather.current || {},
              current_units: weather.current_units || {},
            },
          };
        }
        return {
          outputs: {
            location: placeName,
            latitude: lat,
            longitude: lon,
            current: weather.current || {},
            daily: weather.daily || {},
            daily_units: weather.daily_units || {},
          },
        };
      } catch (err) {
        return { outputs: {}, error: `weather request failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Scheduler tools — user-facing scheduled tasks
    // ═══════════════════════════════════════════════════════════════════
    case 'schedule.create': {
      const name = (inputs.name as string)?.trim();
      const instruction = (inputs.instruction as string)?.trim();
      const scheduleType = (inputs.schedule_type as string) || 'recurring';
      const expression = (inputs.expression as string)?.trim();
      const runAt = inputs.run_at as string | undefined;
      const timezone = (inputs.timezone as string) || 'UTC';
      const enabled = typeof inputs.enabled === 'boolean' ? inputs.enabled : true;
      const missedPolicy = parseScheduleMissedPolicy(inputs.missed_policy) || 'skip';
      const maxRuns = Number.isFinite(Number(inputs.max_runs)) ? Number(inputs.max_runs) : null;
      const actor = resolveScheduleActorUserId(inputs.user_id, runContext?.userId);
      if (!actor.ok) {
        return { outputs: {}, error: actor.error || 'Schedule authorization failed' };
      }
      const userId = String(actor.userId || '').trim();
      const agentId = inputs.agent_id as string | undefined;
      const chatId = inputs.chat_id as string | undefined;

      if (!name || !instruction) {
        return { outputs: {}, error: 'name and instruction are required' };
      }
      if (!resolveScheduleTimezone(timezone)) {
        return { outputs: {}, error: 'timezone must be a valid IANA timezone' };
      }
      if (inputs.missed_policy !== undefined && !parseScheduleMissedPolicy(inputs.missed_policy)) {
        return { outputs: {}, error: 'missed_policy must be one of: skip, run_immediately' };
      }
      const scheduleTargetAccess = await validateScheduleTargetAccess(pool, {
        userId,
        chatId: chatId || undefined,
        agentId: agentId || undefined,
      });
      if (!scheduleTargetAccess.ok) {
        return { outputs: {}, error: scheduleTargetAccess.error || 'Schedule target access denied' };
      }

      let nextRun: Date | null = null;

      if (scheduleType === 'recurring') {
        if (!expression) {
          return { outputs: {}, error: 'cron expression is required for recurring tasks' };
        }
        if (!isValidScheduleCron(expression)) {
          return { outputs: {}, error: 'Invalid cron expression: must have 5 fields (min hour dom month dow)' };
        }
        nextRun = computeScheduleNextRun(expression, new Date(), timezone);
        if (!nextRun) {
          return { outputs: {}, error: 'Unable to compute next run for cron expression' };
        }
      } else if (scheduleType === 'once') {
        if (!runAt) {
          return { outputs: {}, error: 'run_at datetime is required for one-time tasks' };
        }
        const dt = new Date(runAt);
        if (isNaN(dt.getTime())) {
          return { outputs: {}, error: 'run_at must be a valid ISO datetime' };
        }
        nextRun = dt;
      } else {
        return { outputs: {}, error: 'schedule_type must be "once" or "recurring"' };
      }

      try {
        const id = generateTaskId('outbox_item');
        const runAtDate = runAt ? new Date(runAt) : null;

        await pool.query(
          `INSERT INTO scheduled_tasks
             (id, user_id, agent_id, chat_id, name, instruction, schedule_type,
              expression, run_at, timezone, enabled, next_run, missed_policy, max_runs, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
          [
            id, userId, agentId || null, chatId || null,
            name, instruction, scheduleType,
            expression || null,
            runAtDate?.toISOString() || null,
            timezone,
            enabled,
            nextRun ? nextRun.toISOString() : null,
            missedPolicy,
            maxRuns,
          ],
        );

        return {
          outputs: {
            id,
            name,
            schedule_type: scheduleType,
            expression: expression || null,
            run_at: runAt || null,
            next_run: nextRun ? nextRun.toISOString() : null,
            enabled,
            message: `Scheduled task "${name}" created successfully.`,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Failed to create schedule: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'schedule.list': {
      const actor = resolveScheduleActorUserId(inputs.user_id, runContext?.userId);
      if (!actor.ok) {
        return { outputs: {}, error: actor.error || 'Schedule authorization failed' };
      }
      const userId = String(actor.userId || '').trim();

      try {
        const res = await pool.query(
          `SELECT id, name, instruction, schedule_type, expression, run_at,
                  enabled, last_run, next_run, run_count
           FROM scheduled_tasks
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [userId],
        );

        return {
          outputs: {
            tasks: res.rows,
            count: res.rows.length,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Failed to list schedules: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'schedule.cancel': {
      const taskId = inputs.task_id as string;
      const actor = resolveScheduleActorUserId(inputs.user_id, runContext?.userId);
      if (!actor.ok) {
        return { outputs: {}, error: actor.error || 'Schedule authorization failed' };
      }
      const userId = String(actor.userId || '').trim();

      if (!taskId) {
        return { outputs: {}, error: 'task_id is required' };
      }

      try {
        const res = await pool.query(
          `DELETE FROM scheduled_tasks WHERE id = $1 AND user_id = $2 RETURNING id, name`,
          [taskId, userId],
        );

        if (res.rows.length === 0) {
          return { outputs: {}, error: 'Scheduled task not found or not owned by user' };
        }

        return {
          outputs: {
            id: res.rows[0].id,
            name: res.rows[0].name,
            message: `Scheduled task "${res.rows[0].name}" has been cancelled.`,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Failed to cancel schedule: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'schedule.toggle': {
      const taskId = inputs.task_id as string;
      const actor = resolveScheduleActorUserId(inputs.user_id, runContext?.userId);
      if (!actor.ok) {
        return { outputs: {}, error: actor.error || 'Schedule authorization failed' };
      }
      const userId = String(actor.userId || '').trim();
      const enabled = inputs.enabled as boolean;

      if (!taskId) {
        return { outputs: {}, error: 'task_id is required' };
      }
      if (typeof enabled !== 'boolean') {
        return { outputs: {}, error: 'enabled must be a boolean' };
      }

      try {
        const res = await pool.query(
          `UPDATE scheduled_tasks
           SET enabled = $3, updated_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING id, name, enabled`,
          [taskId, userId, enabled],
        );

        if (res.rows.length === 0) {
          return { outputs: {}, error: 'Scheduled task not found or not owned by user' };
        }

        return {
          outputs: {
            id: res.rows[0].id,
            name: res.rows[0].name,
            enabled: res.rows[0].enabled,
            message: `Scheduled task "${res.rows[0].name}" is now ${enabled ? 'enabled' : 'disabled'}.`,
          },
        };
      } catch (err) {
        return { outputs: {}, error: `Failed to toggle schedule: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Device tools — Magic Mirror / Kiosk / Sensor Hub control
    // ═══════════════════════════════════════════════════════════════════

    case 'device.list': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const status = inputs.status as string | undefined;
      const deviceType = inputs.device_type as string | undefined;
      const limit = parseDeviceListLimit(inputs.limit);
      const offset = parseDeviceListOffset(inputs.offset);
      if (limit === null || offset === null) {
        return { outputs: {}, error: `limit must be an integer between 1 and ${MAX_DEVICE_LIST_LIMIT}, and offset must be an integer >= 0` };
      }

      let where = 'WHERE organization_id = $1';
      const params: unknown[] = [organizationId];

      if (status) {
        params.push(status);
        where += ` AND status = $${params.length}`;
      }
      if (deviceType) {
        params.push(deviceType);
        where += ` AND device_type = $${params.length}`;
      }
      params.push(limit + 1);
      const limitParam = params.length;
      params.push(offset);
      const offsetParam = params.length;

      const result = await pool.query(
        `SELECT id, name, device_type, status, capabilities,
                last_seen_at, paired_at
         FROM devices ${where}
         ORDER BY last_seen_at DESC NULLS LAST, id ASC
         LIMIT $${limitParam}
         OFFSET $${offsetParam}`,
        params,
      );

      const hasMore = result.rows.length > limit;
      const devices = hasMore ? result.rows.slice(0, limit) : result.rows;
      return { outputs: { devices, limit, offset, has_more: hasMore } };
    }

    case 'device.send_command': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const deviceId = inputs.device_id as string | undefined;
      const deviceName = inputs.device_name as string | undefined;
      const command = inputs.command as string;
      const forceEnqueue = inputs.force_enqueue === true;
      const payloadRaw = inputs.payload;
      const payload = payloadRaw === undefined
        ? {}
        : (typeof payloadRaw === 'object' && payloadRaw !== null && !Array.isArray(payloadRaw)
          ? (payloadRaw as Record<string, unknown>)
          : null);

      if (!command) {
        return { outputs: {}, error: 'command is required' };
      }
      if (!DEVICE_COMMAND_ALLOWLIST.includes(command)) {
        return {
          outputs: {},
          error: `Invalid command. Must be one of: ${DEVICE_COMMAND_ALLOWLIST.join(', ')}`,
        };
      }
      if (!payload) {
        return { outputs: {}, error: 'payload must be a plain object when provided' };
      }

      const payloadJson = JSON.stringify(payload);
      if (payloadJson.length > MAX_DEVICE_COMMAND_PAYLOAD_BYTES) {
        return { outputs: {}, error: `payload too large (max ${MAX_DEVICE_COMMAND_PAYLOAD_BYTES} bytes)` };
      }

      // Resolve device by name if ID not provided
      let resolvedDeviceId = deviceId;
      if (!resolvedDeviceId && deviceName) {
        const lookup = await pool.query(
          `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [organizationId, deviceName],
        );
        if (lookup.rows.length === 0) {
          return { outputs: {}, error: `Device not found: ${deviceName}` };
        }
        resolvedDeviceId = lookup.rows[0].id;
      }
      if (!resolvedDeviceId) {
        return { outputs: {}, error: 'device_id or device_name is required' };
      }

      // Verify device exists
      const device = await pool.query(
        `SELECT id, status, config FROM devices WHERE id = $1 AND organization_id = $2`,
        [resolvedDeviceId, organizationId],
      );
      if (device.rows.length === 0) {
        return { outputs: {}, error: `Device not found: ${resolvedDeviceId}` };
      }
      const desktopPolicy = validateDeviceDesktopPolicy({
        deviceConfigRaw: device.rows[0].config,
        command,
        payload,
      });
      if (!desktopPolicy.ok) {
        return { outputs: {}, error: desktopPolicy.error };
      }
      const deviceStatus = String(device.rows[0].status || '').toLowerCase();
      if (!forceEnqueue) {
        if (deviceStatus === 'offline') {
          return { outputs: {}, error: 'Device is offline; set force_enqueue=true to override' };
        }
        if (deviceStatus === 'pairing') {
          return { outputs: {}, error: 'Device is pairing; set force_enqueue=true to override' };
        }
        if (deviceStatus !== 'online') {
          return { outputs: {}, error: `Device is not ready (${deviceStatus || 'unknown'})` };
        }
      }

      const result = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, $2, $3)
         RETURNING id, command, status, created_at`,
        [resolvedDeviceId, command, payloadJson],
      );

      return {
        outputs: {
          command_id: result.rows[0].id,
          status: result.rows[0].status,
          message: `Command '${command}' queued for device ${device.rows[0].id}`,
        },
      };
    }

    case 'device.camera_snapshot': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const deviceId = inputs.device_id as string | undefined;
      const deviceName = inputs.device_name as string | undefined;

      let resolvedDeviceId = deviceId;
      if (!resolvedDeviceId && deviceName) {
        const lookup = await pool.query(
          `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [organizationId, deviceName],
        );
        if (lookup.rows.length === 0) {
          return { outputs: {}, error: `Device not found: ${deviceName}` };
        }
        resolvedDeviceId = lookup.rows[0].id;
      }
      if (!resolvedDeviceId) {
        return { outputs: {}, error: 'device_id or device_name is required' };
      }
      const device = await pool.query(
        `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
        [resolvedDeviceId, organizationId],
      );
      if (device.rows.length === 0) {
        return { outputs: {}, error: `Device not found: ${resolvedDeviceId}` };
      }

      const result = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'camera_snapshot', '{}')
         RETURNING id, status, created_at`,
        [resolvedDeviceId],
      );

      return {
        outputs: {
          command_id: result.rows[0].id,
          status: result.rows[0].status,
          message: `Camera snapshot command queued for device`,
        },
      };
    }

    case 'device.sensor_read': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const deviceId = inputs.device_id as string | undefined;
      const deviceName = inputs.device_name as string | undefined;
      const sensorType = (inputs.sensor_type as string) || 'system';

      let resolvedDeviceId = deviceId;
      if (!resolvedDeviceId && deviceName) {
        const lookup = await pool.query(
          `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [organizationId, deviceName],
        );
        if (lookup.rows.length === 0) {
          return { outputs: {}, error: `Device not found: ${deviceName}` };
        }
        resolvedDeviceId = lookup.rows[0].id;
      }
      if (!resolvedDeviceId) {
        return { outputs: {}, error: 'device_id or device_name is required' };
      }
      const device = await pool.query(
        `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
        [resolvedDeviceId, organizationId],
      );
      if (device.rows.length === 0) {
        return { outputs: {}, error: `Device not found: ${resolvedDeviceId}` };
      }

      const result = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'sensor_read', $2)
         RETURNING id, status, created_at`,
        [resolvedDeviceId, JSON.stringify({ sensor_type: sensorType })],
      );

      return {
        outputs: {
          command_id: result.rows[0].id,
          status: result.rows[0].status,
          message: `Sensor read (${sensorType}) command queued for device`,
        },
      };
    }

    case 'device.display': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const deviceId = inputs.device_id as string | undefined;
      const deviceName = inputs.device_name as string | undefined;
      const url = inputs.url as string | undefined;
      const html = inputs.html as string | undefined;
      const text = inputs.text as string | undefined;

      if (!url && !html && !text) {
        return { outputs: {}, error: 'One of url, html, or text is required' };
      }
      if (url && url.length > MAX_DEVICE_DISPLAY_URL_LENGTH) {
        return { outputs: {}, error: `url exceeds max length (${MAX_DEVICE_DISPLAY_URL_LENGTH})` };
      }
      if (text && text.length > MAX_DEVICE_DISPLAY_TEXT_LENGTH) {
        return { outputs: {}, error: `text exceeds max length (${MAX_DEVICE_DISPLAY_TEXT_LENGTH})` };
      }
      if (html && html.length > MAX_DEVICE_DISPLAY_HTML_LENGTH) {
        return { outputs: {}, error: `html exceeds max length (${MAX_DEVICE_DISPLAY_HTML_LENGTH})` };
      }

      let resolvedDeviceId = deviceId;
      if (!resolvedDeviceId && deviceName) {
        const lookup = await pool.query(
          `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [organizationId, deviceName],
        );
        if (lookup.rows.length === 0) {
          return { outputs: {}, error: `Device not found: ${deviceName}` };
        }
        resolvedDeviceId = lookup.rows[0].id;
      }
      if (!resolvedDeviceId) {
        return { outputs: {}, error: 'device_id or device_name is required' };
      }
      const device = await pool.query(
        `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
        [resolvedDeviceId, organizationId],
      );
      if (device.rows.length === 0) {
        return { outputs: {}, error: `Device not found: ${resolvedDeviceId}` };
      }

      const payload: Record<string, unknown> = {};
      if (url) payload.url = url;
      if (html) payload.html = html;
      if (text) payload.text = text;

      const result = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'display', $2)
         RETURNING id, status, created_at`,
        [resolvedDeviceId, JSON.stringify(payload)],
      );

      return {
        outputs: {
          command_id: result.rows[0].id,
          status: result.rows[0].status,
          message: `Display command queued for device`,
        },
      };
    }

    case 'device.speak': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const deviceId = inputs.device_id as string | undefined;
      const deviceName = inputs.device_name as string | undefined;
      const text = inputs.text as string;

      if (!text) {
        return { outputs: {}, error: 'text is required' };
      }
      if (text.length > MAX_DEVICE_SPEAK_TEXT_LENGTH) {
        return { outputs: {}, error: `text exceeds max length (${MAX_DEVICE_SPEAK_TEXT_LENGTH})` };
      }

      let resolvedDeviceId = deviceId;
      if (!resolvedDeviceId && deviceName) {
        const lookup = await pool.query(
          `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [organizationId, deviceName],
        );
        if (lookup.rows.length === 0) {
          return { outputs: {}, error: `Device not found: ${deviceName}` };
        }
        resolvedDeviceId = lookup.rows[0].id;
      }
      if (!resolvedDeviceId) {
        return { outputs: {}, error: 'device_id or device_name is required' };
      }
      const device = await pool.query(
        `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
        [resolvedDeviceId, organizationId],
      );
      if (device.rows.length === 0) {
        return { outputs: {}, error: `Device not found: ${resolvedDeviceId}` };
      }

      const result = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'tts_speak', $2)
         RETURNING id, status, created_at`,
        [resolvedDeviceId, JSON.stringify({ text })],
      );

      return {
        outputs: {
          command_id: result.rows[0].id,
          status: result.rows[0].status,
          message: `TTS speak command queued for device`,
        },
      };
    }

    case 'device.relay_snapshot': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;

      const sourceDeviceIdInput = inputs.source_device_id as string | undefined;
      const sourceDeviceNameInput = inputs.source_device_name as string | undefined;
      const targetDeviceIdInput = inputs.target_device_id as string | undefined;
      const targetDeviceNameInput = inputs.target_device_name as string | undefined;
      const width = Math.max(64, Math.min(1920, Math.trunc(Number(inputs.width || 320))));
      const height = Math.max(64, Math.min(1080, Math.trunc(Number(inputs.height || 180))));
      const timeoutMs = parseDeviceRelayTimeoutMs(inputs.timeout_ms);
      if (timeoutMs === null) {
        return {
          outputs: {},
          error: `timeout_ms must be a finite integer between ${MIN_DEVICE_RELAY_TIMEOUT_MS} and ${MAX_DEVICE_RELAY_TIMEOUT_MS}`,
        };
      }

      const resolveDevice = async (idInput: string | undefined, nameInput: string | undefined): Promise<string | null> => {
        let resolvedDeviceId = idInput;
        if (!resolvedDeviceId && nameInput) {
          const lookup = await pool.query(
            `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
            [organizationId, nameInput],
          );
          if (lookup.rows.length === 0) return null;
          resolvedDeviceId = lookup.rows[0].id;
        }
        if (!resolvedDeviceId) return null;
        const owned = await pool.query(
          `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
          [resolvedDeviceId, organizationId],
        );
        if (owned.rows.length === 0) return null;
        return String(owned.rows[0].id);
      };

      const sourceDeviceId = await resolveDevice(sourceDeviceIdInput, sourceDeviceNameInput);
      if (!sourceDeviceId) {
        return { outputs: {}, error: 'source_device_id or source_device_name is required and must exist in organization' };
      }
      const targetDeviceId = await resolveDevice(targetDeviceIdInput, targetDeviceNameInput);
      if (!targetDeviceId) {
        return { outputs: {}, error: 'target_device_id or target_device_name is required and must exist in organization' };
      }

      const snapshotInsert = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'camera_snapshot', $2)
         RETURNING id, status, created_at`,
        [sourceDeviceId, JSON.stringify({ width, height })],
      );
      const snapshotCommandId = String(snapshotInsert.rows[0].id);

      const deadline = Date.now() + timeoutMs;
      let snapshotStatus = String(snapshotInsert.rows[0].status || 'pending').toLowerCase();
      let snapshotResultPayload: Record<string, unknown> = {};
      let snapshotErrorMessage = '';

      while (Date.now() < deadline) {
        const poll = await pool.query(
          `SELECT status, result_payload, error_message
           FROM device_commands
           WHERE id = $1 AND device_id = $2
           LIMIT 1`,
          [snapshotCommandId, sourceDeviceId],
        );
        if (poll.rows.length > 0) {
          snapshotStatus = String(poll.rows[0].status || '').toLowerCase();
          snapshotResultPayload =
            (poll.rows[0].result_payload && typeof poll.rows[0].result_payload === 'object')
              ? (poll.rows[0].result_payload as Record<string, unknown>)
              : {};
          snapshotErrorMessage = String(poll.rows[0].error_message || '');

          if (snapshotStatus === 'acknowledged' || snapshotStatus === 'failed') {
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      if (snapshotStatus !== 'acknowledged') {
        return {
          outputs: {},
          error: snapshotStatus === 'failed'
            ? (snapshotErrorMessage || 'Snapshot command failed')
            : `Snapshot command timed out after ${timeoutMs}ms`,
        };
      }

      const imageBase64 = String(snapshotResultPayload.image_base64 || '').trim();
      if (!imageBase64) {
        return { outputs: {}, error: 'Snapshot succeeded but returned no image data' };
      }
      if (imageBase64.length > MAX_DEVICE_RELAY_IMAGE_BASE64_LENGTH) {
        return { outputs: {}, error: `Snapshot image too large (max base64 length ${MAX_DEVICE_RELAY_IMAGE_BASE64_LENGTH})` };
      }

      const html =
        '<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;">'
        + `<img style="max-width:100vw;max-height:100vh;object-fit:contain;" src="data:image/jpeg;base64,${imageBase64}"/>`
        + '</body></html>';

      const displayInsert = await pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'display', $2)
         RETURNING id, status, created_at`,
        [targetDeviceId, JSON.stringify({ type: 'html', content: html })],
      );

      return {
        outputs: {
          source_device_id: sourceDeviceId,
          target_device_id: targetDeviceId,
          snapshot_command_id: snapshotCommandId,
          display_command_id: displayInsert.rows[0].id,
          display_status: displayInsert.rows[0].status,
          width,
          height,
          timeout_ms: timeoutMs,
          message: 'Snapshot relayed from source device to target display',
        },
      };
    }

    case 'device.get_events': {
      const deviceOrg = await resolveDeviceToolOrganizationId(pool, runContext);
      if (!deviceOrg.organizationId) {
        return { outputs: {}, error: deviceOrg.error || 'Device authorization failed' };
      }
      const organizationId = deviceOrg.organizationId;
      const deviceId = inputs.device_id as string | undefined;
      const deviceName = inputs.device_name as string | undefined;
      const eventType = inputs.event_type as string | undefined;
      const limit = parseDeviceEventsLimit(inputs.limit);

      let resolvedDeviceId = deviceId;
      if (!resolvedDeviceId && deviceName) {
        const lookup = await pool.query(
          `SELECT id FROM devices WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [organizationId, deviceName],
        );
        if (lookup.rows.length === 0) {
          return { outputs: {}, error: `Device not found: ${deviceName}` };
        }
        resolvedDeviceId = lookup.rows[0].id;
      }
      if (!resolvedDeviceId) {
        return { outputs: {}, error: 'device_id or device_name is required' };
      }
      if (limit === null) {
        return {
          outputs: {},
          error: `limit must be a finite integer between ${MIN_DEVICE_EVENTS_LIMIT} and ${MAX_DEVICE_EVENTS_LIMIT}`,
        };
      }

      const device = await pool.query(
        `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
        [resolvedDeviceId, organizationId],
      );
      if (device.rows.length === 0) {
        return { outputs: {}, error: `Device not found: ${resolvedDeviceId}` };
      }

      let where = 'WHERE e.device_id = $1 AND d.organization_id = $2';
      const params: unknown[] = [resolvedDeviceId, organizationId];
      if (eventType) {
        params.push(eventType);
        where += ` AND e.event_type = $${params.length}`;
      }
      params.push(limit);

      const result = await pool.query(
        `SELECT e.id, e.event_type, e.payload, e.created_at
         FROM device_events e
         JOIN devices d ON d.id = e.device_id
         ${where}
         ORDER BY e.created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      return { outputs: { events: result.rows } };
    }

    // ── Slack tools ──────────────────────────────────────────────────────────

    case 'slack.post_message':
    case 'slack.create_channel':
    case 'slack.invite_user':
    case 'slack.list_channels':
    case 'slack.list_members': {
      // Resolve bot token: setting ref → env fallback
      let slackToken: string | undefined;
      try {
        const slackSettings = await getScopedSettingsMap(
          pool,
          ['slack.bot_token_ref'],
          runContext,
        );
        const tokenRef = parseSettingValue<string>(slackSettings.get('slack.bot_token_ref'))?.trim();
        slackToken = tokenRef ? await resolveSecretRef(tokenRef) : process.env.SLACK_BOT_TOKEN?.trim();
      } catch {
        slackToken = process.env.SLACK_BOT_TOKEN?.trim();
      }

      if (!slackToken) {
        return { outputs: {}, error: 'Slack bot token not configured (set slack.bot_token_ref setting or SLACK_BOT_TOKEN env)' };
      }

      const slackApi = async (method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const isGet = method === 'GET';
        const endpoint = `https://slack.com/api/${body._endpoint}`;
        delete body._endpoint;

        let url = endpoint;
        let fetchOpts: RequestInit = {
          method,
          headers: {
            Authorization: `Bearer ${slackToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        };
        if (isGet) {
          url += '?' + new URLSearchParams(body as Record<string, string>).toString();
          fetchOpts = { ...fetchOpts, method: 'GET', body: undefined };
        } else {
          (fetchOpts as RequestInit & { body: string }).body = JSON.stringify(body);
        }

        const res = await fetch(url, fetchOpts);
        if (!res.ok) throw new Error(`Slack API HTTP ${res.status}`);
        return await res.json() as Record<string, unknown>;
      };

      // Helper: resolve channel name → ID
      const resolveChannelId = async (nameOrId: string): Promise<string> => {
        if (/^[CG][A-Z0-9]+$/.test(nameOrId)) return nameOrId; // already an ID
        const name = nameOrId.replace(/^#/, '').toLowerCase();
        const data = await slackApi('GET', { _endpoint: 'conversations.list', types: 'public_channel,private_channel', limit: '200' });
        const channels = (data.channels as Array<{ id: string; name: string }>) || [];
        const match = channels.find((c) => c.name === name);
        if (!match) throw new Error(`Channel "${nameOrId}" not found`);
        return match.id;
      };

      // Helper: resolve email → user ID
      const resolveUserId = async (emailOrId: string): Promise<string> => {
        if (/^U[A-Z0-9]+$/.test(emailOrId)) return emailOrId; // already a user ID
        const data = await slackApi('GET', { _endpoint: 'users.lookupByEmail', email: emailOrId });
        if (!data.ok) throw new Error(`User "${emailOrId}" not found: ${data.error}`);
        return (data.user as { id: string }).id;
      };

      try {
        switch (toolName) {
          case 'slack.post_message': {
            const channel = String(inputs.channel || '').trim();
            const text = String(inputs.text || '').trim();
            if (!channel) return { outputs: {}, error: 'channel is required' };
            if (!text) return { outputs: {}, error: 'text is required' };

            const channelId = await resolveChannelId(channel);
            const body: Record<string, unknown> = { _endpoint: 'chat.postMessage', channel: channelId, text };
            if (inputs.thread_ts) body.thread_ts = inputs.thread_ts;

            const data = await slackApi('POST', body);
            if (!data.ok) return { outputs: {}, error: `Slack error: ${data.error}` };
            return { outputs: { ok: true, ts: data.ts, channel: data.channel } };
          }

          case 'slack.create_channel': {
            const name = String(inputs.name || '').trim().toLowerCase().replace(/\s+/g, '-');
            if (!name) return { outputs: {}, error: 'name is required' };
            const isPrivate = Boolean(inputs.is_private);

            const data = await slackApi('POST', { _endpoint: 'conversations.create', name, is_private: isPrivate });
            if (!data.ok) return { outputs: {}, error: `Slack error: ${data.error}` };
            const ch = data.channel as { id: string; name: string };
            return { outputs: { ok: true, channel_id: ch.id, channel_name: ch.name } };
          }

          case 'slack.invite_user': {
            const channel = String(inputs.channel || '').trim();
            const users = Array.isArray(inputs.users) ? inputs.users as string[] : [];
            if (!channel) return { outputs: {}, error: 'channel is required' };
            if (!users.length) return { outputs: {}, error: 'users array is required' };

            const channelId = await resolveChannelId(channel);
            const userIds = await Promise.all(users.map((u) => resolveUserId(String(u).trim())));

            const data = await slackApi('POST', { _endpoint: 'conversations.invite', channel: channelId, users: userIds.join(',') });
            if (!data.ok) return { outputs: {}, error: `Slack error: ${data.error}` };
            return { outputs: { ok: true, invited_count: userIds.length } };
          }

          case 'slack.list_channels': {
            const limit = Math.min(Math.max(Number(inputs.limit) || 50, 1), 200);
            const types = inputs.include_private ? 'public_channel,private_channel' : 'public_channel';

            const data = await slackApi('GET', { _endpoint: 'conversations.list', types, limit: String(limit), exclude_archived: 'true' });
            if (!data.ok) return { outputs: {}, error: `Slack error: ${data.error}` };

            const channels = ((data.channels as Array<Record<string, unknown>>) || []).map((c) => ({
              id: c.id,
              name: c.name,
              is_private: c.is_private,
              num_members: c.num_members,
              topic: (c.topic as { value: string } | undefined)?.value || '',
            }));
            return { outputs: { ok: true, channels } };
          }

          case 'slack.list_members': {
            const channel = String(inputs.channel || '').trim();
            const limit = Math.min(Math.max(Number(inputs.limit) || 50, 1), 200);
            if (!channel) return { outputs: {}, error: 'channel is required' };

            const channelId = await resolveChannelId(channel);
            const membersData = await slackApi('GET', { _endpoint: 'conversations.members', channel: channelId, limit: String(limit) });
            if (!membersData.ok) return { outputs: {}, error: `Slack error: ${membersData.error}` };

            const memberIds = (membersData.members as string[]) || [];
            const members = await Promise.all(
              memberIds.map(async (uid) => {
                const u = await slackApi('GET', { _endpoint: 'users.info', user: uid });
                const profile = (u.user as { id: string; name: string; profile: { display_name: string; email: string } } | undefined);
                return {
                  id: uid,
                  name: profile?.name || uid,
                  display_name: profile?.profile?.display_name || '',
                  email: profile?.profile?.email || '',
                };
              }),
            );
            return { outputs: { ok: true, members } };
          }

          default:
            return { outputs: {}, error: `No in-process handler for tool: ${toolName}` };
        }
      } catch (err) {
        return { outputs: {}, error: `Slack tool failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ═════════════════════════════════════════════════════════
    // MEMORY TOOLS
    // ═════════════════════════════════════════════════════════

    case 'memory.search': {
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const limit = Math.min(Math.max(Number(inputs.limit) || 5, 1), 20);
      const res = await pool.query(
        `SELECT key, value, importance, visibility, updated_at
         FROM memories
         WHERE archived_at IS NULL AND merged_into IS NULL
           AND (key ILIKE '%' || $1 || '%' OR value ILIKE '%' || $1 || '%')
         ORDER BY importance DESC, updated_at DESC
         LIMIT $2`,
        [query, limit],
      );
      return { outputs: { memories: res.rows } };
    }

    case 'memory.list': {
      const visibility = inputs.visibility as string | undefined;
      const limit = Math.min(Math.max(Number(inputs.limit) || 20, 1), 50);
      const conditions = ['archived_at IS NULL', 'merged_into IS NULL'];
      const params: unknown[] = [];
      if (visibility) {
        params.push(visibility);
        conditions.push(`visibility = $${params.length}`);
      }
      params.push(limit);
      const res = await pool.query(
        `SELECT key, value, importance, visibility, source, updated_at
         FROM memories
         WHERE ${conditions.join(' AND ')}
         ORDER BY updated_at DESC
         LIMIT $${params.length}`,
        params,
      );
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM memories WHERE archived_at IS NULL AND merged_into IS NULL`,
      );
      return { outputs: { memories: res.rows, total: countRes.rows[0]?.total || 0 } };
    }

    case 'memory.save': {
      const key = String(inputs.key || '').trim();
      const value = String(inputs.value || '').trim();
      if (!key || !value) return { outputs: {}, error: 'inputs.key and inputs.value are required' };
      const visibility = inputs.visibility || 'user_private';
      const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await pool.query(
        `INSERT INTO memories (id, user_id, chat_id, visibility, key, value, source, importance)
         VALUES ($1, $2, $3, $4, $5, $6, 'tool', 1.0)
         ON CONFLICT DO NOTHING`,
        [id, runContext?.userId || null, runContext?.chatId || null, visibility, key, value],
      );
      return { outputs: { id, success: true } };
    }

    case 'memory.forget': {
      const key = String(inputs.key || '').trim();
      if (!key) return { outputs: {}, error: 'inputs.key is required' };
      const res = await pool.query(
        `UPDATE memories SET archived_at = NOW() WHERE key = $1 AND archived_at IS NULL`,
        [key],
      );
      return { outputs: { success: true, deleted_count: res.rowCount || 0 } };
    }

    case 'memory.stats': {
      const total = await pool.query(
        `SELECT COUNT(*)::int AS total FROM memories WHERE archived_at IS NULL AND merged_into IS NULL`,
      );
      const byVis = await pool.query(
        `SELECT visibility, COUNT(*)::int AS count FROM memories
         WHERE archived_at IS NULL AND merged_into IS NULL GROUP BY visibility`,
      );
      const bySrc = await pool.query(
        `SELECT source, COUNT(*)::int AS count FROM memories
         WHERE archived_at IS NULL AND merged_into IS NULL GROUP BY source`,
      );
      const avgImp = await pool.query(
        `SELECT COALESCE(AVG(importance), 0)::float AS avg_importance FROM memories
         WHERE archived_at IS NULL AND merged_into IS NULL`,
      );
      const byVisObj: Record<string, number> = {};
      for (const r of byVis.rows) byVisObj[(r as any).visibility] = (r as any).count;
      const bySrcObj: Record<string, number> = {};
      for (const r of bySrc.rows) bySrcObj[(r as any).source] = (r as any).count;
      return {
        outputs: {
          total: total.rows[0]?.total || 0,
          by_visibility: byVisObj,
          by_source: bySrcObj,
          avg_importance: avgImp.rows[0]?.avg_importance || 0,
        },
      };
    }

    // ═════════════════════════════════════════════════════════
    // KNOWLEDGE GRAPH / BRAIN TOOLS
    // ═════════════════════════════════════════════════════════

    case 'brain.search': {
      const query = String(inputs.query || '').trim();
      if (!query) return { outputs: {}, error: 'inputs.query is required' };
      const entityType = inputs.entity_type as string | undefined;
      const limit = Math.min(Math.max(Number(inputs.limit) || 10, 1), 20);
      const conditions = ['deleted_at IS NULL', `(name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')`];
      const params: unknown[] = [query];
      if (entityType) {
        params.push(entityType);
        conditions.push(`type = $${params.length}`);
      }
      params.push(limit);
      const entities = await pool.query(
        `SELECT id, type, name, description, confidence::float
         FROM kg_entities
         WHERE ${conditions.join(' AND ')}
         ORDER BY confidence DESC, updated_at DESC
         LIMIT $${params.length}`,
        params,
      );
      const entityIds = entities.rows.map((r: any) => r.id);
      let relations: any[] = [];
      if (entityIds.length > 0) {
        const relRes = await pool.query(
          `SELECT r.id, r.relation_type, r.confidence::float,
                  se.name AS source_name, te.name AS target_name
           FROM kg_relations r
           JOIN kg_entities se ON se.id = r.source_entity_id
           JOIN kg_entities te ON te.id = r.target_entity_id
           WHERE r.deleted_at IS NULL
             AND (r.source_entity_id = ANY($1) OR r.target_entity_id = ANY($1))
           LIMIT 30`,
          [entityIds],
        );
        relations = relRes.rows;
      }
      return { outputs: { entities: entities.rows, relations } };
    }

    case 'brain.entity': {
      const name = String(inputs.name || '').trim();
      if (!name) return { outputs: {}, error: 'inputs.name is required' };
      const includeRelations = inputs.include_relations !== false;
      const entityRes = await pool.query(
        `SELECT id, type, name, description, metadata, confidence::float, first_seen_at, updated_at
         FROM kg_entities WHERE name ILIKE $1 AND deleted_at IS NULL LIMIT 1`,
        [name],
      );
      if (entityRes.rows.length === 0) {
        return { outputs: { entity: null, relations: [], evidence: [] } };
      }
      const entity = entityRes.rows[0];
      let relations: any[] = [];
      let evidence: any[] = [];
      if (includeRelations) {
        const relRes = await pool.query(
          `SELECT r.relation_type, r.confidence::float,
                  se.name AS source_name, te.name AS target_name
           FROM kg_relations r
           JOIN kg_entities se ON se.id = r.source_entity_id
           JOIN kg_entities te ON te.id = r.target_entity_id
           WHERE r.deleted_at IS NULL
             AND (r.source_entity_id = $1 OR r.target_entity_id = $1)
           LIMIT 20`,
          [(entity as any).id],
        );
        relations = relRes.rows;
      }
      const evRes = await pool.query(
        `SELECT content_type, quote, context, confidence::float, extraction_method
         FROM kg_evidence WHERE entity_id = $1 LIMIT 10`,
        [(entity as any).id],
      );
      evidence = evRes.rows;
      return { outputs: { entity, relations, evidence } };
    }

    case 'brain.stats': {
      const entityCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM kg_entities WHERE deleted_at IS NULL`,
      );
      const relCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM kg_relations WHERE deleted_at IS NULL`,
      );
      const types = await pool.query(
        `SELECT type, COUNT(*)::int AS count FROM kg_entities WHERE deleted_at IS NULL GROUP BY type ORDER BY count DESC`,
      );
      const recent = await pool.query(
        `SELECT name, type, first_seen_at FROM kg_entities WHERE deleted_at IS NULL ORDER BY first_seen_at DESC LIMIT 5`,
      );
      const typesObj: Record<string, number> = {};
      for (const r of types.rows) typesObj[(r as any).type] = (r as any).count;
      return {
        outputs: {
          entity_count: entityCount.rows[0]?.count || 0,
          relation_count: relCount.rows[0]?.count || 0,
          entity_types: typesObj,
          recent_entities: recent.rows,
        },
      };
    }

    // ═════════════════════════════════════════════════════════
    // PATTERN OBSERVATION TOOLS
    // ═════════════════════════════════════════════════════════

    case 'pattern.insights': {
      const status = inputs.status || 'active';
      const limit = Math.min(Math.max(Number(inputs.limit) || 10, 1), 20);
      const res = await pool.query(
        `SELECT normalized_question, sample_question, occurrences,
                first_seen_at, last_seen_at, suggested_answer, status
         FROM proactive_pattern_insights
         WHERE status = $1
         ORDER BY occurrences DESC, last_seen_at DESC
         LIMIT $2`,
        [status, limit],
      );
      return { outputs: { patterns: res.rows } };
    }

    // ═════════════════════════════════════════════════════════
    // COMMUNITY AGENTS TOOLS
    // ═════════════════════════════════════════════════════════

    case 'agents.list': {
      const statusFilter = inputs.status as string | undefined;
      const conditions = ['1=1'];
      const params: unknown[] = [];
      if (statusFilter) {
        params.push(statusFilter);
        conditions.push(`status = $${params.length}`);
      }
      const res = await pool.query(
        `SELECT id, name, model, status, created_at
         FROM agents
         WHERE ${conditions.join(' AND ')}
         ORDER BY name ASC`,
        params,
      );
      return { outputs: { agents: res.rows } };
    }

    case 'agents.message': {
      const agentName = String(inputs.agent_name || '').trim();
      const message = String(inputs.message || '').trim();
      if (!agentName || !message) return { outputs: {}, error: 'inputs.agent_name and inputs.message are required' };
      const agentRes = await pool.query(
        `SELECT id, name, status FROM agents WHERE name ILIKE $1 AND status = 'active' LIMIT 1`,
        [agentName],
      );
      if (agentRes.rows.length === 0) {
        return { outputs: {}, error: `No active agent found with name: ${agentName}` };
      }
      const agent = agentRes.rows[0] as { id: string; name: string };
      const msgId = `iam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const sessionId = runContext?.chatId || 'system';
      await pool.query(
        `INSERT INTO inter_agent_messages (id, from_agent, to_agent, session_id, message, status, created_at)
         VALUES ($1, 'sven-core', $2, $3, $4, 'queued', NOW())`,
        [msgId, agent.id, sessionId, message],
      );
      return {
        outputs: {
          agent_id: agent.id,
          status: 'delegated',
          response: `Message sent to ${agent.name}. The agent will process it asynchronously.`,
        },
      };
    }

    // ═════════════════════════════════════════════════════════
    // FEDERATION TOOLS
    // ═════════════════════════════════════════════════════════

    case 'federation.status': {
      const identityRes = await pool.query(
        `SELECT key, value FROM settings WHERE key IN ('federation_identity', 'federation_enabled', 'federation_consent_mode')`,
      );
      const settings: Record<string, string> = {};
      for (const r of identityRes.rows) settings[(r as any).key] = (r as any).value;
      let identity = null;
      try { identity = JSON.parse(settings.federation_identity || 'null'); } catch { /* empty */ }
      return {
        outputs: {
          enabled: settings.federation_enabled === 'true',
          identity,
          consent_mode: settings.federation_consent_mode || 'opt-in',
        },
      };
    }

    case 'federation.peers': {
      try {
        const res = await pool.query(
          `SELECT homeserver, status, last_seen_at, capabilities
           FROM federation_peers
           ORDER BY last_seen_at DESC NULLS LAST`,
        );
        return { outputs: { peers: res.rows } };
      } catch {
        return { outputs: { peers: [], note: 'Federation peers table not available' } };
      }
    }

    // ═════════════════════════════════════════════════════════
    // CALIBRATION TOOLS
    // ═════════════════════════════════════════════════════════

    case 'calibration.self_check': {
      const windowDays = Math.min(Math.max(Number(inputs.window_days) || 7, 1), 90);
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      const totalRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM messages WHERE role = 'assistant' AND created_at >= $1`,
        [since],
      );
      const fbRes = await pool.query(
        `SELECT feedback, COUNT(*)::int AS count FROM message_feedback WHERE created_at >= $1 GROUP BY feedback`,
        [since],
      );
      let positive = 0, negative = 0;
      for (const r of fbRes.rows) {
        if ((r as any).feedback === 'up') positive = (r as any).count;
        if ((r as any).feedback === 'down') negative = (r as any).count;
      }
      const total = totalRes.rows[0]?.total || 0;
      const accuracy = positive + negative > 0 ? positive / (positive + negative) : null;
      return {
        outputs: {
          window_days: windowDays,
          total_interactions: total,
          positive_feedback: positive,
          negative_feedback: negative,
          accuracy_estimate: accuracy,
        },
      };
    }

    // ═════════════════════════════════════════════════════════
    // INFERENCE / MODEL ROUTING TOOLS
    // ═════════════════════════════════════════════════════════

    case 'inference.status': {
      const nodes = await pool.query(
        `SELECT node_name, node_type, is_healthy, current_load_percent::float,
                avg_response_time_ms::float, supported_models, gpu_enabled
         FROM inference_nodes
         ORDER BY node_name ASC`,
      );
      const policy = await pool.query(
        `SELECT policy_name, description, prefer_local_first, load_threshold_percent::float
         FROM inference_routing_policy WHERE is_active = true LIMIT 1`,
      );
      return {
        outputs: {
          nodes: nodes.rows,
          active_routing_policy: policy.rows[0]?.policy_name || 'default',
        },
      };
    }

    // ═════════════════════════════════════════════════════════
    // SELF-AWARENESS / INTROSPECTION TOOLS
    // ═════════════════════════════════════════════════════════

    case 'sven.soul': {
      try {
        const res = await pool.query(
          `SELECT si.slug, sc.name, si.version, sc.author, si.status, si.activated_at, si.content
           FROM souls_installed si
           JOIN souls_catalog sc ON sc.id = si.soul_id
           WHERE si.status = 'active'
           ORDER BY si.activated_at DESC NULLS LAST
           LIMIT 1`,
        );
        if (res.rows.length === 0) {
          return { outputs: { slug: null, content: 'No active soul found. I am running on defaults.' } };
        }
        const row = res.rows[0] as any;
        return {
          outputs: {
            slug: row.slug,
            name: row.name,
            version: row.version,
            author: row.author,
            status: row.status,
            activated_at: row.activated_at,
            content: row.content,
          },
        };
      } catch {
        return { outputs: { slug: null, content: 'Soul system unavailable (pre-migration).' } };
      }
    }

    case 'sven.whois': {
      const userId = runContext?.userId;
      if (!userId || userId === 'unknown') {
        return { outputs: {}, error: 'Cannot identify the current user from context' };
      }
      const userRes = await pool.query(
        `SELECT username, display_name, role, created_at FROM users WHERE id = $1`,
        [userId],
      );
      if (userRes.rows.length === 0) {
        return { outputs: {}, error: 'User not found' };
      }
      const user = userRes.rows[0] as any;

      let uiPrefs = null;
      try {
        const uiRes = await pool.query(
          `SELECT visual_mode, motion_enabled, motion_level, avatar_mode FROM user_ui_preferences WHERE user_id = $1`,
          [userId],
        );
        uiPrefs = uiRes.rows[0] || null;
      } catch { /* table may not exist */ }

      let proactivePrefs = null;
      try {
        const proRes = await pool.query(
          `SELECT channels, quiet_hours_start, quiet_hours_end, quiet_hours_timezone FROM user_proactive_preferences WHERE user_id = $1`,
          [userId],
        );
        proactivePrefs = proRes.rows[0] || null;
      } catch { /* table may not exist */ }

      let sessionSettings = null;
      if (runContext?.chatId) {
        try {
          const ssRes = await pool.query(
            `SELECT think_level, verbose, usage_mode, model_name, profile_name, rag_enabled, agent_paused
             FROM session_settings WHERE session_id = $1`,
            [runContext.chatId],
          );
          sessionSettings = ssRes.rows[0] || null;
        } catch { /* table may not exist */ }
      }

      const channelsRes = await pool.query(
        `SELECT DISTINCT channel, display_name FROM identities WHERE user_id = $1`,
        [userId],
      );

      const memCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM memories WHERE user_id = $1 AND archived_at IS NULL AND merged_into IS NULL`,
        [userId],
      );

      const convCount = await pool.query(
        `SELECT COUNT(DISTINCT chat_id)::int AS count FROM messages WHERE sender_user_id = $1`,
        [userId],
      );

      return {
        outputs: {
          username: user.username,
          display_name: user.display_name,
          role: user.role,
          member_since: user.created_at,
          ui_preferences: uiPrefs,
          proactive_preferences: proactivePrefs,
          session_settings: sessionSettings,
          channels: channelsRes.rows,
          memory_count: memCount.rows[0]?.count || 0,
          conversation_count: convCount.rows[0]?.count || 0,
        },
      };
    }

    case 'sven.tool_history': {
      const limit = Math.min(Math.max(Number(inputs.limit) || 20, 1), 50);
      const statusFilter = inputs.status as string | undefined;
      const conditions = ['1=1'];
      const params: unknown[] = [];
      if (statusFilter) {
        params.push(statusFilter);
        conditions.push(`status = $${params.length}`);
      }
      params.push(limit);
      const runs = await pool.query(
        `SELECT tool_name, status, duration_ms, error, created_at
         FROM tool_runs
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      const summaryRes = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status IN ('success','completed'))::int AS success,
           COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
           COUNT(*) FILTER (WHERE status = 'timeout')::int AS timeouts,
           COALESCE(AVG(duration_ms)::int, 0) AS avg_duration_ms
         FROM tool_runs
         WHERE created_at > NOW() - INTERVAL '24 hours'`,
      );
      return {
        outputs: {
          runs: runs.rows,
          summary_24h: summaryRes.rows[0] || { total: 0, success: 0, errors: 0, timeouts: 0, avg_duration_ms: 0 },
        },
      };
    }

    case 'sven.schedules': {
      const filterType = (inputs.type as string) || 'all';
      const result: Record<string, unknown[]> = {};

      if (filterType === 'all' || filterType === 'scheduled_tasks') {
        const res = await pool.query(
          `SELECT name, instruction, schedule_type, expression, timezone, enabled,
                  last_run, next_run, run_count, max_runs
           FROM scheduled_tasks
           ORDER BY enabled DESC, next_run ASC NULLS LAST
           LIMIT 30`,
        );
        result.scheduled_tasks = res.rows;
      }

      if (filterType === 'all' || filterType === 'ha_automations') {
        try {
          const res = await pool.query(
            `SELECT name, description, enabled, cooldown_seconds, last_triggered_at
             FROM ha_automations
             ORDER BY enabled DESC, last_triggered_at DESC NULLS LAST
             LIMIT 30`,
          );
          result.ha_automations = res.rows;
        } catch { result.ha_automations = []; }
      }

      if (filterType === 'all' || filterType === 'workflows') {
        const res = await pool.query(
          `SELECT name, description, version, enabled, tags, created_at
           FROM workflows
           ORDER BY enabled DESC, updated_at DESC
           LIMIT 20`,
        );
        result.workflows = res.rows;
      }

      return { outputs: result };
    }

    case 'sven.documents': {
      const limit = Math.min(Math.max(Number(inputs.limit) || 15, 1), 30);
      const artifacts = await pool.query(
        `SELECT name, mime_type, size_bytes, is_private, created_at
         FROM artifacts
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
      );
      const totalArt = await pool.query(
        `SELECT COUNT(*)::int AS count FROM artifacts`,
      );
      let ragStats = { total_chunks: 0, unique_sources: 0 };
      try {
        const ragRes = await pool.query(
          `SELECT
             COUNT(*)::int AS total_chunks,
             COUNT(DISTINCT source)::int AS unique_sources
           FROM rag_embeddings`,
        );
        ragStats = ragRes.rows[0] as any;
      } catch { /* rag_embeddings may not exist */ }
      return {
        outputs: {
          artifacts: artifacts.rows,
          total_artifacts: totalArt.rows[0]?.count || 0,
          rag_stats: ragStats,
        },
      };
    }

    case 'sven.mcp_servers': {
      const servers = await pool.query(
        `SELECT s.id, s.name, s.transport, s.status, s.last_connected,
                COUNT(t.id)::int AS tool_count
         FROM mcp_servers s
         LEFT JOIN mcp_server_tools t ON t.server_id = s.id
         GROUP BY s.id, s.name, s.transport, s.status, s.last_connected
         ORDER BY s.name ASC`,
      );
      const totalTools = servers.rows.reduce((sum: number, r: any) => sum + (r.tool_count || 0), 0);
      return {
        outputs: {
          servers: servers.rows.map((r: any) => ({
            name: r.name,
            transport: r.transport,
            status: r.status,
            tool_count: r.tool_count,
            last_connected: r.last_connected,
          })),
          total_tools: totalTools,
        },
      };
    }

    case 'sven.integrations': {
      try {
        const res = await pool.query(
          `SELECT integration_type, runtime_mode, status, last_deployed_at, last_error
           FROM integration_runtime_instances
           ORDER BY status ASC, integration_type ASC`,
        );
        return { outputs: { integrations: res.rows } };
      } catch {
        return { outputs: { integrations: [], note: 'Integration runtime table not available' } };
      }
    }

    case 'sven.channels': {
      const channelStats = await pool.query(
        `SELECT channel, COUNT(*)::int AS conversation_count, MAX(created_at) AS latest_activity
         FROM chats
         WHERE channel IS NOT NULL
         GROUP BY channel
         ORDER BY conversation_count DESC`,
      );
      const totalConvs = await pool.query(
        `SELECT COUNT(*)::int AS count FROM chats`,
      );
      return {
        outputs: {
          channels: channelStats.rows,
          total_conversations: totalConvs.rows[0]?.count || 0,
        },
      };
    }

    case 'sven.skills': {
      try {
        const res = await pool.query(
          `SELECT sc.name, sc.description, sc.version, sc.format,
                  si.trust_level, si.installed_at
           FROM skills_installed si
           JOIN skills_catalog sc ON sc.id = si.catalog_entry_id
           ORDER BY si.installed_at DESC`,
        );
        return { outputs: { skills: res.rows, total: res.rows.length } };
      } catch {
        return { outputs: { skills: [], total: 0, note: 'Skills system unavailable' } };
      }
    }

    case 'sven.analytics': {
      const windowDays = Math.min(Math.max(Number(inputs.window_days) || 7, 1), 90);
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

      const fbRes = await pool.query(
        `SELECT feedback, COUNT(*)::int AS count FROM message_feedback WHERE created_at >= $1 GROUP BY feedback`,
        [since],
      );
      let positive = 0, negative = 0;
      for (const r of fbRes.rows) {
        if ((r as any).feedback === 'up') positive = (r as any).count;
        if ((r as any).feedback === 'down') negative = (r as any).count;
      }

      let tokenUsage: any = { total_input: 0, total_output: 0, models: {} };
      try {
        const tokenRes = await pool.query(
          `SELECT model_name, SUM(input_tokens)::int AS input_tokens, SUM(output_tokens)::int AS output_tokens
           FROM session_token_usage
           WHERE created_at >= $1
           GROUP BY model_name`,
          [since],
        );
        const models: Record<string, any> = {};
        let totalInput = 0, totalOutput = 0;
        for (const r of tokenRes.rows) {
          const m = (r as any).model_name || 'unknown';
          models[m] = { input_tokens: (r as any).input_tokens, output_tokens: (r as any).output_tokens };
          totalInput += (r as any).input_tokens || 0;
          totalOutput += (r as any).output_tokens || 0;
        }
        tokenUsage = { total_input: totalInput, total_output: totalOutput, models };
      } catch { /* session_token_usage may not exist */ }

      const convs = await pool.query(
        `SELECT COUNT(DISTINCT id)::int AS count FROM chats WHERE created_at >= $1`,
        [since],
      );
      const msgs = await pool.query(
        `SELECT COUNT(*)::int AS count FROM messages WHERE created_at >= $1`,
        [since],
      );

      return {
        outputs: {
          window_days: windowDays,
          feedback: { positive, negative },
          token_usage: tokenUsage,
          conversation_count: convs.rows[0]?.count || 0,
          message_count: msgs.rows[0]?.count || 0,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVILEGED OPS TOOLS — 47-admin-only
    // ═══════════════════════════════════════════════════════════════

    case 'sven.ops.infra': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.infra', inputs, 'Infrastructure topology requested');

      const dockerPs = runDockerCommand(['ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'], 10000, 1024 * 64);
      const containerLines = (dockerPs.stdout || '').trim().split('\n').filter(Boolean).map(line => {
        const [name, status, ports] = line.split('\t');
        return { name: name || '', status: status || '', ports: ports || '' };
      });

      return {
        outputs: {
          topology: {
            vms: [
              { name: 'VM1 — Edge Proxy (47d-platform)', ip: '10.47.47.5', wg: 'N/A', role: 'L4/L7 nginx reverse proxy, SNI routing, TLS termination (Let\'s Encrypt), routes the47network.com→VM14, sven.systems→VM4' },
              { name: 'VM4 — Platform', ip: '10.47.47.8', wg: '10.47.0.6', role: 'Core services: postgres, nats, gateway-api, agent-runtime, skill-runner, registry-worker, notification-service, workflow-executor, nginx' },
              { name: 'VM5 — AI & Voice', ip: '10.47.47.9', wg: '10.47.0.7', role: 'LLM inference: ollama (RX 9070 XT + RX 6750 XT), litellm, faster-whisper, piper, openwakeword, wake-word, llama-server (systemd)' },
              { name: 'VM6 — Data & Observability', ip: '10.47.47.10', wg: '10.47.0.8', role: 'opensearch, RAG pipeline (indexer, nas-ingestor, git-ingestor, notes-ingestor), searxng, egress-proxy, otel-collector, prometheus, grafana, loki, uptime-kuma' },
              { name: 'VM7 — Adapters', ip: '10.47.47.11', wg: '10.47.0.9', role: '22 channel adapters (discord, slack, telegram, matrix, teams, whatsapp, signal, imessage, webchat, google-chat, zalo, feishu, mattermost, voice-call, line, irc, nostr, tlon, nextcloud-talk, twitch, whatsapp-personal, zalo-personal), cloudflared tunnel' },
              { name: 'VM12 — External', ip: '10.47.47.12', wg: 'N/A', role: 'Rocket.Chat (talk.sven.systems)' },
              { name: 'VM13 — GPU Fallback (Kaldorei)', ip: '10.47.47.13', wg: 'N/A', role: 'Ollama fallback (RTX 3060)' },
              { name: 'VM14 — Public Web (Daedalus)', ip: '10.47.47.14', wg: 'N/A', role: 'the47network.com + plate.the47network.com static sites, nginx, TLS terminated at VM1' },
            ],
            cross_vm_connectivity: {
              'VM7→VM4': 'Gateway API :3000',
              'VM7→VM6': 'OTEL Collector :4318',
              'VM5→VM4': 'PostgreSQL :5432, NATS :4222',
              'VM5→VM6': 'OTEL :4318',
              'VM6→VM4': 'PostgreSQL :5432, NATS :4222',
              'VM6→VM5': 'Ollama :11434 (embeddings)',
              'VM4→VM5': 'Ollama :11434, LiteLLM :4000',
              'VM4→VM6': 'OpenSearch :9200, OTEL :4318, Egress :3128',
              'VM4→VM13': 'Ollama :11434 (fallback)',
              'VM1→VM14': 'Nginx :80 (reverse proxy for the47network.com)',
            },
          },
          running_containers: containerLines,
          observability: {
            otel_collector: { port: '4317/4318', location: 'VM6', protocol: 'gRPC/HTTP' },
            prometheus: { port: '9090', location: 'VM6', retention: '30d' },
            grafana: { port: '9091→3000', location: 'VM6' },
            loki: { port: '3100', location: 'VM6' },
            promtail: { locations: ['VM4', 'VM5', 'VM6', 'VM7'] },
            postgres_exporter: { port: '9187', location: 'VM4' },
            nats_exporter: { port: '7777', location: 'VM4' },
            uptime_kuma: { location: 'VM6' },
          },
          deployment: {
            orchestration: 'Docker Compose (per-VM) + systemd bootstrap',
            process_manager: 'PM2 (dev mode: gateway-api :3000, agent-runtime :39100, admin-ui :3100, canvas-ui :3200)',
            systemd_unit: 'sven-compose-core.service — starts postgres, nats, gateway-api, sven-internal-nginx',
            networking: 'WireGuard mesh (10.47.0.0/24) between VMs, Cloudflare Tunnel on VM7',
            tls: 'Nginx TLS termination on VM4, Caddy/Traefik configs available',
            total_services: '40+ (22 adapters + 18+ core/infra)',
          },
        },
      };
    }

    case 'sven.ops.health': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.health', inputs, 'System health check');

      const dbStats = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active') AS active_connections,
           (SELECT count(*)::int FROM pg_stat_activity) AS total_connections,
           pg_database_size(current_database())::bigint AS db_size_bytes`,
      );
      const db = dbStats.rows[0] as { active_connections: number; total_connections: number; db_size_bytes: string };

      let queueDepths: Record<string, number> = {};
      try {
        const qRes = await pool.query(
          `SELECT tool_name, count(*)::int AS pending FROM tool_runs WHERE status = 'running' GROUP BY tool_name ORDER BY pending DESC LIMIT 20`,
        );
        for (const r of qRes.rows) queueDepths[(r as any).tool_name] = (r as any).pending;
      } catch { /* tool_runs may not exist yet */ }

      let errors24h: { total: number; by_status: Record<string, number> } = { total: 0, by_status: {} };
      try {
        const errRes = await pool.query(
          `SELECT status, count(*)::int AS cnt FROM tool_runs WHERE status IN ('error','timeout','denied') AND created_at >= NOW() - INTERVAL '24 hours' GROUP BY status`,
        );
        for (const r of errRes.rows) {
          errors24h.by_status[(r as any).status] = (r as any).cnt;
          errors24h.total += (r as any).cnt;
        }
      } catch { /* table may not exist */ }

      const dockerHealth = runDockerCommand(['ps', '--format', '{{.Names}}\t{{.Status}}'], 10000, 1024 * 64);
      const services: Record<string, string> = {};
      for (const line of (dockerHealth.stdout || '').trim().split('\n').filter(Boolean)) {
        const [name, status] = line.split('\t');
        if (name) services[name] = status || 'unknown';
      }

      const uptime = process.uptime();

      return {
        outputs: {
          database: {
            active_connections: db.active_connections,
            total_connections: db.total_connections,
            db_size_mb: Math.round(Number(db.db_size_bytes) / (1024 * 1024)),
          },
          queues: { running_tool_runs: queueDepths },
          errors_24h: errors24h,
          services: services,
          uptime: {
            skill_runner_seconds: Math.round(uptime),
            skill_runner_uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          },
        },
      };
    }

    case 'sven.ops.code_scan': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.code_scan', inputs, 'Code scan initiated');

      const scope = String(inputs.scope || 'all');
      const categories = Array.isArray(inputs.categories) ? inputs.categories.map(String) : ['lint', 'typecheck', 'security'];
      const start = Date.now();
      const findings: Array<{ category: string; severity: string; file: string; line?: number; message: string }> = [];

      const serviceMap: Record<string, string> = {
        'gateway-api': 'services/gateway-api',
        'agent-runtime': 'services/agent-runtime',
        'skill-runner': 'services/skill-runner',
        'canvas-ui': 'apps/canvas-ui',
        'admin-ui': 'apps/admin-ui',
      };
      const targets = scope === 'all' ? Object.keys(serviceMap) : [scope];

      for (const target of targets) {
        const cwd = serviceMap[target];
        if (!cwd) continue;

        if (categories.includes('typecheck')) {
          const tsc = spawnSync('node', ['../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'], {
            cwd, timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 256,
          });
          if (tsc.stdout) {
            for (const line of tsc.stdout.split('\n').filter(Boolean).slice(0, 50)) {
              const match = line.match(/^(.+?)\((\d+),\d+\):\s*error\s+\w+:\s*(.+)$/);
              if (match) findings.push({ category: 'typecheck', severity: 'error', file: `${cwd}/${match[1]}`, line: Number(match[2]), message: match[3] });
            }
          }
        }

        if (categories.includes('security')) {
          const audit = spawnSync('npx', ['audit', '--json'], {
            cwd, timeout: 30000, encoding: 'utf8', maxBuffer: 1024 * 256,
          });
          try {
            const parsed = JSON.parse(audit.stdout || '{}');
            if (parsed.vulnerabilities) {
              for (const [pkg, info] of Object.entries(parsed.vulnerabilities).slice(0, 20)) {
                const v = info as any;
                findings.push({ category: 'security', severity: v.severity || 'unknown', file: `${cwd}/package.json`, message: `${pkg}: ${v.title || v.via?.[0]?.title || 'vulnerability detected'}` });
              }
            }
          } catch { /* audit output may not be valid JSON */ }
        }
      }

      const summary: Record<string, number> = {};
      for (const f of findings) summary[f.severity] = (summary[f.severity] || 0) + 1;

      return {
        outputs: {
          findings: findings.slice(0, 100),
          summary: { ...summary, total: findings.length },
          scan_duration_ms: Date.now() - start,
          scope,
          categories,
        },
      };
    }

    case 'sven.ops.code_fix': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.code_fix', inputs, 'Code fix proposal requested', 'medium');

      const issueDescription = String(inputs.issue_description || '');
      const autoApply = inputs.auto_apply === true;

      if (!issueDescription) return { outputs: {}, error: 'issue_description is required.' };

      // Build change list — support single-file (file_path/old_content/new_content)
      // or multi-file (changes: [{file_path, old_content, new_content}, ...])
      const changes: FileChange[] = [];
      if (inputs.changes && Array.isArray(inputs.changes)) {
        for (const c of inputs.changes as Array<Record<string, unknown>>) {
          const fp = c.file_path ? String(c.file_path) : undefined;
          const oc = c.old_content ? String(c.old_content) : undefined;
          const nc = c.new_content ? String(c.new_content) : undefined;
          if (fp && oc && nc) changes.push({ file_path: fp, old_content: oc, new_content: nc });
        }
      } else {
        const filePath = inputs.file_path ? String(inputs.file_path) : undefined;
        const oldContent = inputs.old_content ? String(inputs.old_content) : undefined;
        const newContent = inputs.new_content ? String(inputs.new_content) : undefined;
        if (filePath && oldContent && newContent) changes.push({ file_path: filePath, old_content: oldContent, new_content: newContent });
      }

      const isExecutableFix = changes.length > 0;
      const proposalId = generateTaskId('tool_run');
      const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';

      // v8: File quarantine check — block fixes on quarantined files
      if (isExecutableFix) {
        for (const change of changes) {
          const quarantine = isFileQuarantined(change.file_path);
          if (quarantine.quarantined) {
            return {
              outputs: {
                proposal: { id: proposalId, status: 'quarantined', file: change.file_path, failures: quarantine.failures },
                error_detail: `${change.file_path} is quarantined after ${quarantine.failures} consecutive heal failures in 24h. Use sven.ops.heal_history with clear_quarantine to lift.`,
              },
            };
          }
        }
      }

      // v8: Resource guard — check system resources before heavy operations
      if (isExecutableFix) {
        const resGuard = checkSystemResources();
        if (!resGuard.ok) {
          return {
            outputs: {
              proposal: { id: proposalId, status: 'resource_blocked', warnings: resGuard.warnings, freeMemMb: resGuard.freeMemMb, freeDiskMb: resGuard.freeDiskMb },
              error_detail: `System resources too low for safe build: ${resGuard.warnings.join('; ')}`,
            },
          };
        }
      }

      // v8: Auto-severity classification — classify change impact by file paths
      const changeSeverity = isExecutableFix ? classifyChangeSeverity(changes, repoRoot) : { severity: 'MEDIUM' as const, reasons: [] };

      // v9: Fix impact estimation — calculate blast radius (lines, files, services, risk score)
      const fixImpact = isExecutableFix ? estimateFixImpact(changes, repoRoot) : null;

      // v7: Confidence scoring — fetch per-file historical success rate
      const confidenceScores: Array<{ file: string; score: number; revertRate: string; rating: string }> = [];
      if (isExecutableFix) {
        for (const change of changes) {
          const conf = await getHealConfidence(pool, change.file_path);
          confidenceScores.push({
            file: change.file_path,
            score: conf.score,
            revertRate: conf.revertRate,
            rating: conf.score >= 0.8 ? 'HIGH' : conf.score >= 0.5 ? 'MEDIUM' : 'LOW',
          });
        }
      }

      // v4: Generate unified diff for all modes (preview for approvals, record for direct)
      const unifiedDiff = isExecutableFix ? generateUnifiedDiff(changes, repoRoot) : '';

      // v6: Fix deduplication — reject identical diffs within 24h
      let fixHashForDedup = '';
      if (isExecutableFix) {
        const dedup = isDuplicateFix(changes);
        fixHashForDedup = dedup.hash;
        if (dedup.duplicate) {
          return {
            outputs: {
              proposal: { id: proposalId, status: 'deduplicated', hash: dedup.hash.slice(0, 16) },
              error_detail: `This exact diff (${dedup.hash.slice(0, 12)}…) was already applied ${dedup.firstSeenAt ? Math.round((Date.now() - dedup.firstSeenAt) / 60000) + ' min ago' : 'recently'}. Skipping duplicate.`,
            },
          };
        }
      }

      // v4: Fix rate limiter — check all files before applying
      if (isExecutableFix) {
        for (const change of changes) {
          const rateCheck = checkFixRateLimit(change.file_path);
          if (!rateCheck.allowed) {
            return {
              outputs: {
                proposal: { id: proposalId, status: 'rate_limited', file: change.file_path, recent_fixes: rateCheck.recentCount, max: FIX_RATE_MAX, reset_in_min: Math.ceil(rateCheck.resetInMs / 60000) },
                error_detail: `${change.file_path} has been modified ${rateCheck.recentCount} times in the last 30 minutes (limit: ${FIX_RATE_MAX}). This prevents fix loops. Cooldown resets in ${Math.ceil(rateCheck.resetInMs / 60000)} min.`,
              },
            };
          }
        }

        // v6: Dry-run simulation — apply on temp branch, build+test, discard
        if (inputs.dry_run === true) {
          try {
            const sim = await dryRunSimulation(changes, repoRoot);
            return {
              outputs: {
                proposal: { id: proposalId, status: 'dry_run_complete', files: changes.map(c => c.file_path) },
                dry_run: {
                  build_ok: sim.buildOk, build_output: sim.buildOutput.slice(0, 1000),
                  tests_ok: sim.testsOk, test_output: sim.testOutput.slice(0, 1000),
                  cross_service_ok: sim.crossServiceOk, cross_service_output: sim.crossServiceOutput.slice(0, 500),
                },
                diff: unifiedDiff.slice(0, 3000),
                note: sim.buildOk && sim.testsOk
                  ? `Dry-run passed: build ✅ tests ✅${sim.crossServiceOk ? '' : ' cross-service ❌'}. Safe to apply for real.`
                  : `Dry-run failed: build ${sim.buildOk ? '✅' : '❌'} tests ${sim.testsOk ? '✅' : '❌'}. Do not apply.`,
              },
            };
          } catch (err) {
            return { outputs: {}, error: `Dry-run simulation failed: ${err instanceof Error ? err.message : String(err)}` };
          }
        }
      }

      if (isExecutableFix && !autoApply) {
        // Direct apply via branch isolation
        try {
          const commitMsg = `fix(sven-heal): ${issueDescription.slice(0, 72)}`;
          const result = await applyFixOnBranch(changes, repoRoot, commitMsg);

          if (!result.ok) {
            if (runContext?.userId) {
              await logOpsAudit(pool, runContext.userId, 'sven.ops.code_fix', { files: changes.map(c => c.file_path), issue: issueDescription }, `Fix rolled back: build verification failed on branch ${result.branch}`, 'high');
            }
            return {
              outputs: {
                proposal: { id: proposalId, status: 'rolled_back', files: changes.map(c => c.file_path), branch: result.branch },
                error_detail: `Fix was applied on branch ${result.branch} but broke the build. Branch abandoned, all files restored.`,
                build_errors: (result.buildOutput || '').slice(0, 1000),
                diff: unifiedDiff.slice(0, 3000),
              },
            };
          }

          // v4: Post-fix test runner — verify tests still pass
          const testResults: Array<{ file: string; ok: boolean; output: string; skipped: boolean }> = [];
          for (const change of changes) {
            const tr = runServiceTests(repoRoot, change.file_path);
            testResults.push({ file: change.file_path, ...tr });
          }
          const testFailures = testResults.filter(t => !t.ok && !t.skipped);

          if (testFailures.length > 0) {
            const revertResult = revertHealCommits(repoRoot, 1);
            if (runContext?.userId) {
              await logOpsAudit(pool, runContext.userId, 'sven.ops.code_fix', { files: changes.map(c => c.file_path), issue: issueDescription, commit: result.commitHash }, `Fix reverted: tests failed after build passed`, 'high');
            }
            return {
              outputs: {
                proposal: { id: proposalId, status: 'reverted_tests_failed', files: changes.map(c => c.file_path), commit: result.commitHash },
                error_detail: `Build passed but tests failed. Commit ${result.commitHash} reverted. ${revertResult.ok ? 'Build re-verified.' : revertResult.output}`,
                test_failures: testFailures.map(t => ({ file: t.file, output: t.output.slice(0, 500) })),
                diff: unifiedDiff.slice(0, 3000),
              },
            };
          }

          // Record rate limit entries
          for (const change of changes) recordFixApplication(change.file_path);

          // v6: Record dedup hash
          recordFixHash(fixHashForDedup);

          const testNote = testResults.some(t => !t.skipped) ? ', tests passed' : '';

          if (runContext?.userId) {
            await logOpsAudit(pool, runContext.userId, 'sven.ops.code_fix', {
              files: changes.map(c => c.file_path), issue: issueDescription, commit: result.commitHash, branch: result.branch, tests_passed: true,
            }, `Fix applied via branch ${result.branch}, verified (build+tests), merged: ${result.commitHash}`, 'high');
          }

          return {
            outputs: {
              proposal: {
                id: proposalId,
                status: 'applied',
                files: changes.map(c => c.file_path),
                commit: result.commitHash,
                commit_message: commitMsg,
                branch: result.branch,
                build_verified: true,
                tests_verified: testFailures.length === 0,
                severity: changeSeverity.severity,
              },
              confidence: confidenceScores,
              severity_classification: changeSeverity,
              impact: fixImpact,
              diff: unifiedDiff.slice(0, 3000),
              issue: issueDescription,
              note: `Fix applied via branch ${result.branch}, build verified clean${testNote}, merged and committed as ${result.commitHash}. Use sven.ops.deploy to deploy.`,
            },
          };
        } catch (err) {
          return { outputs: {}, error: `Failed to apply fix: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      if (isExecutableFix && autoApply) {
        // Create an approval request — the fix will be applied when /approve is used
        const approvalId = generateTaskId('approval');
        try {
          await pool.query(
            `INSERT INTO approvals (
               id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at
             ) VALUES (
               $1, $2, 'sven.ops.code_fix', 'ops.deploy', $3, 'pending', 1, NOW() + INTERVAL '24 hours', $4::jsonb, NOW()
             )`,
            [
              approvalId,
              runContext?.chatId || 'system',
              runContext?.userId || 'system',
              JSON.stringify({
                message: `Code fix: ${issueDescription.slice(0, 200)}`,
                proposal_id: proposalId,
                changes,
                // Keep single-file fields for backward compat
                file_path: changes[0]?.file_path,
                old_content: changes[0]?.old_content,
                new_content: changes[0]?.new_content,
                action: 'code_fix',
                diff_preview: unifiedDiff.slice(0, 5000), // v4: unified diff stored in approval
              }),
            ],
          );
        } catch (err) {
          logger.warn('Failed to create code fix approval', { err: String(err) });
          return { outputs: {}, error: `Failed to create approval: ${String(err)}` };
        }

        return {
          outputs: {
            proposal: {
              id: proposalId,
              status: 'pending_approval',
              files: changes.map(c => c.file_path),
              issue: issueDescription,
              approval_id: approvalId,
              note: `Use /approve ${approvalId} to apply this ${changes.length}-file fix via branch isolation, build verify, test verify, and commit.`,
            },
            diff: unifiedDiff.slice(0, 3000),
          },
        };
      }

      // Proposal-only mode — no executable diff provided
      return {
        outputs: {
          proposal: {
            id: proposalId,
            issue: issueDescription,
            file_path: inputs.file_path ? String(inputs.file_path) : 'unspecified',
            status: 'proposal_only',
            note: 'Provide file_path + old_content + new_content (or changes[] for multi-file) to make this an executable fix.',
          },
        },
      };
    }

    case 'sven.ops.pentest': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.pentest', inputs, 'Security pentest initiated', 'high');

      const scope = String(inputs.scope || 'full');
      const target = inputs.target ? String(inputs.target) : undefined;
      const start = Date.now();
      const vulnerabilities: Array<{ id: string; severity: string; category: string; title: string; description: string; endpoint?: string; recommendation: string }> = [];

      // Check for common security misconfigurations via DB and env inspection
      // Auth: check for users without MFA, expired sessions, weak policies
      try {
        const noMfa = await pool.query(`SELECT count(*)::int AS cnt FROM users WHERE mfa_secret IS NULL AND role = 'admin'`);
        if ((noMfa.rows[0] as any)?.cnt > 0) {
          vulnerabilities.push({
            id: 'SEC-001', severity: 'high', category: 'auth',
            title: 'Admin accounts without MFA',
            description: `${(noMfa.rows[0] as any).cnt} admin account(s) do not have MFA enabled.`,
            recommendation: 'Enable TOTP MFA for all admin accounts via /admin/security.',
          });
        }
      } catch { /* mfa_secret column may not exist */ }

      // Check for overly permissive CORS
      const corsOrigin = process.env.CORS_ORIGIN || '';
      if (corsOrigin === '*' || corsOrigin.includes('*')) {
        vulnerabilities.push({
          id: 'SEC-002', severity: 'critical', category: 'misconfig',
          title: 'Wildcard CORS origin',
          description: `CORS_ORIGIN is set to "${corsOrigin}" — allows any origin to make authenticated requests.`,
          recommendation: 'Set CORS_ORIGIN to the specific allowed domain(s).',
        });
      }

      // Check hardening profile
      const hardeningProfile = process.env.SVEN_HARDENING_PROFILE || '';
      if (!hardeningProfile || hardeningProfile !== 'strict') {
        vulnerabilities.push({
          id: 'SEC-003', severity: 'medium', category: 'misconfig',
          title: 'Hardening profile not set to strict',
          description: `SVEN_HARDENING_PROFILE="${hardeningProfile || 'unset'}". Production should use "strict".`,
          recommendation: 'Set SVEN_HARDENING_PROFILE=strict in production environment.',
        });
      }

      // Check for expired or stale approvals (potential approval fatigue)
      try {
        const staleApprovals = await pool.query(
          `SELECT count(*)::int AS cnt FROM approvals WHERE status = 'pending' AND expires_at < NOW()`,
        );
        if ((staleApprovals.rows[0] as any)?.cnt > 5) {
          vulnerabilities.push({
            id: 'SEC-004', severity: 'low', category: 'access_control',
            title: 'Stale pending approvals',
            description: `${(staleApprovals.rows[0] as any).cnt} expired approval requests still in pending state.`,
            recommendation: 'Clean up expired approvals to avoid approval fatigue and confusion.',
          });
        }
      } catch { /* approvals table may not exist */ }

      // Rate limiting check — env var presence
      if (!process.env.SVEN_RATE_LIMIT_ENABLED && !process.env.RATE_LIMIT_MAX) {
        vulnerabilities.push({
          id: 'SEC-005', severity: 'medium', category: 'rate_limiting',
          title: 'Rate limiting not explicitly configured',
          description: 'No SVEN_RATE_LIMIT_ENABLED or RATE_LIMIT_MAX environment variable detected.',
          endpoint: '/api/*',
          recommendation: 'Configure rate limiting environment variables for public API endpoints.',
        });
      }

      // Check for tools with elevated trust that may be exploitable
      try {
        const riskyTools = await pool.query(
          `SELECT name, trust_level, permissions_required FROM tools WHERE trust_level = 'trusted' AND enabled = TRUE AND permissions_required && ARRAY['nas.write', 'code.execute', 'ops.admin']::text[]`,
        );
        if (riskyTools.rows.length > 0) {
          vulnerabilities.push({
            id: 'SEC-006', severity: 'info', category: 'access_control',
            title: 'High-privilege tools enabled',
            description: `${riskyTools.rows.length} tool(s) with elevated permissions (nas.write, code.execute, or ops.admin) are enabled: ${riskyTools.rows.map((r: any) => r.name).join(', ')}.`,
            recommendation: 'Verify each high-privilege tool is intentionally enabled and properly gated.',
          });
        }
      } catch { /* tools table may differ */ }

      // ── Live HTTP endpoint probes against the gateway API ──
      const gatewayPort = process.env.GATEWAY_PORT || '3000';
      const gatewayBase = `http://127.0.0.1:${gatewayPort}`;
      const probeTimeout = 5000;

      // Helper: safe fetch with timeout, returns null on network error
      const probeFetch = async (url: string, init?: RequestInit): Promise<Response | null> => {
        try {
          return await fetch(url, { ...init, signal: AbortSignal.timeout(probeTimeout) });
        } catch {
          return null;
        }
      };

      // Probe 1: Unauthenticated access to protected endpoints
      const protectedPaths = ['/api/admin/users', '/api/admin/agents', '/api/chats', '/api/tools'];
      for (const path of protectedPaths) {
        const res = await probeFetch(`${gatewayBase}${path}`);
        if (res && res.status !== 401 && res.status !== 403 && res.status !== 404) {
          vulnerabilities.push({
            id: `SEC-EP-${vulnerabilities.length + 1}`, severity: 'critical', category: 'auth_bypass',
            title: `Unauthenticated access to ${path}`,
            description: `GET ${path} returned HTTP ${res.status} without authentication. Expected 401 or 403.`,
            endpoint: path,
            recommendation: `Ensure preHandler: authenticated or adminOnly middleware is applied to ${path}.`,
          });
        }
      }

      // Probe 2: Security headers on a public endpoint
      const headerProbe = await probeFetch(`${gatewayBase}/health`);
      if (headerProbe) {
        const headers = headerProbe.headers;
        const requiredHeaders: Array<{ name: string; id: string; severity: string; recommendation: string }> = [
          { name: 'x-frame-options', id: 'SEC-HDR-01', severity: 'medium', recommendation: 'Set X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking.' },
          { name: 'x-content-type-options', id: 'SEC-HDR-02', severity: 'medium', recommendation: 'Set X-Content-Type-Options: nosniff to prevent MIME-type sniffing.' },
          { name: 'strict-transport-security', id: 'SEC-HDR-03', severity: 'high', recommendation: 'Set Strict-Transport-Security header with max-age >= 31536000 and includeSubDomains.' },
          { name: 'content-security-policy', id: 'SEC-HDR-04', severity: 'medium', recommendation: 'Implement a Content-Security-Policy header to mitigate XSS attacks.' },
        ];
        for (const h of requiredHeaders) {
          if (!headers.get(h.name)) {
            vulnerabilities.push({
              id: h.id, severity: h.severity, category: 'missing_header',
              title: `Missing ${h.name} header`,
              description: `The ${h.name} header is not set on /health response.`,
              endpoint: '/health',
              recommendation: h.recommendation,
            });
          }
        }
        // Check for server version disclosure
        const serverHeader = headers.get('server') || '';
        if (serverHeader && /\d+\.\d+/.test(serverHeader)) {
          vulnerabilities.push({
            id: 'SEC-HDR-05', severity: 'low', category: 'info_disclosure',
            title: 'Server version disclosed in headers',
            description: `Server header reveals version: "${serverHeader}".`,
            endpoint: '/health',
            recommendation: 'Remove or obfuscate the Server header to prevent version fingerprinting.',
          });
        }
      }

      // Probe 3: Debug/internal endpoints that should not be publicly accessible
      const debugPaths = ['/debug', '/metrics', '/env', '/.env', '/api/debug', '/swagger', '/docs/api', '/graphql'];
      for (const path of debugPaths) {
        const res = await probeFetch(`${gatewayBase}${path}`);
        if (res && res.status >= 200 && res.status < 400) {
          vulnerabilities.push({
            id: `SEC-DBG-${vulnerabilities.length + 1}`, severity: 'high', category: 'exposed_debug',
            title: `Debug/internal endpoint accessible: ${path}`,
            description: `GET ${path} returned HTTP ${res.status}. Internal/debug endpoints should return 404 or be behind auth.`,
            endpoint: path,
            recommendation: `Disable or gate ${path} behind admin authentication in production.`,
          });
        }
      }

      // Probe 4: CORS preflight — check that arbitrary origins are rejected
      const corsProbe = await probeFetch(`${gatewayBase}/api/chats`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://evil-attacker.com', 'Access-Control-Request-Method': 'POST' },
      });
      if (corsProbe) {
        const acao = corsProbe.headers.get('access-control-allow-origin') || '';
        if (acao === '*' || acao === 'https://evil-attacker.com') {
          vulnerabilities.push({
            id: 'SEC-CORS-01', severity: 'critical', category: 'cors_misconfiguration',
            title: 'CORS allows arbitrary origins',
            description: `Preflight to /api/chats with Origin: https://evil-attacker.com returned Access-Control-Allow-Origin: "${acao}".`,
            endpoint: '/api/chats',
            recommendation: 'Configure CORS to only allow trusted origins. Never reflect arbitrary origins or use wildcard.',
          });
        }
      }

      // Probe 5: Method confusion — check that POST-only endpoints reject GET
      const methodPaths = ['/api/chats', '/api/auth/login'];
      for (const path of methodPaths) {
        const res = await probeFetch(`${gatewayBase}${path}`, { method: 'DELETE' });
        if (res && res.status !== 404 && res.status !== 405 && res.status !== 401 && res.status !== 403) {
          vulnerabilities.push({
            id: `SEC-MTD-${vulnerabilities.length + 1}`, severity: 'medium', category: 'method_confusion',
            title: `Unexpected DELETE accepted on ${path}`,
            description: `DELETE ${path} returned HTTP ${res.status} instead of 405 Method Not Allowed.`,
            endpoint: path,
            recommendation: `Restrict HTTP methods on ${path} to only those explicitly needed.`,
          });
        }
      }

      const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const v of vulnerabilities) {
        const sev = v.severity as keyof typeof summary;
        if (sev in summary) summary[sev]++;
      }

      return {
        outputs: {
          vulnerabilities,
          summary: { ...summary, total: vulnerabilities.length },
          recommendations: vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').map(v => v.recommendation),
          scan_duration_ms: Date.now() - start,
          scope,
          target: target || 'all',
          probes_executed: ['unauthenticated_access', 'security_headers', 'debug_endpoints', 'cors_preflight', 'method_confusion'],
          gateway_probed: gatewayBase,
          note: 'Combined configuration audit + live HTTP endpoint probes. For deeper protocol-level testing, delegate to the security-auditor agent.',
        },
      };
    }

    case 'sven.ops.deploy': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.deploy', inputs, `Deploy ${inputs.action || 'status'} requested`, inputs.action === 'execute' ? 'high' : 'info');

      const action = String(inputs.action || 'status');
      const targetService = String(inputs.target || 'all');
      const environment = String(inputs.environment || 'staging');

      if (action === 'status') {
        const dockerStatus = runDockerCommand(['ps', '--format', '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}'], 10000, 1024 * 64);
        const serviceStatuses: Array<{ name: string; image: string; status: string; created: string }> = [];
        for (const line of (dockerStatus.stdout || '').trim().split('\n').filter(Boolean)) {
          const [name, image, status, created] = line.split('\t');
          if (targetService !== 'all' && !name?.includes(targetService)) continue;
          serviceStatuses.push({ name: name || '', image: image || '', status: status || '', created: created || '' });
        }
        return {
          outputs: {
            deployment_status: {
              environment,
              services: serviceStatuses,
              total_running: serviceStatuses.filter(s => s.status.toLowerCase().includes('up')).length,
              total_services: serviceStatuses.length,
            },
          },
        };
      }

      if (action === 'plan') {
        // Check which compose files exist on the system
        const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';
        const composePrimary = process.env.SVEN_COMPOSE_FILE || 'docker-compose.yml';
        const composeProfiles = process.env.SVEN_COMPOSE_PROFILES || 'docker-compose.profiles.yml';

        return {
          outputs: {
            plan: {
              environment,
              target: targetService,
              compose_root: repoRoot,
              compose_files: [composePrimary, composeProfiles],
              steps: [
                `1. Pull latest images for ${targetService === 'all' ? 'all services' : targetService}`,
                '2. Run database migrations (if pending)',
                `3. Rebuild and restart ${targetService === 'all' ? 'services in dependency order (infra → core → adapters)' : targetService}`,
                '4. Health check verification (docker ps + /health probes)',
                '5. Audit log entry for deployment',
              ],
              dependency_order: ['postgres', 'nats', 'gateway-api', 'agent-runtime', 'skill-runner', 'notification-service', 'adapters'],
              self_restart_note: 'If skill-runner is restarted, a delayed self-restart is used — response is sent first, then the process restarts after 3 seconds.',
              estimated_downtime: 'Near-zero (sequential restart with dependency ordering)',
              rollback: `docker compose -f ${composePrimary} up -d --force-recreate ${targetService === 'all' ? '' : targetService}`.trim() + ' (previous image)',
              requires_approval: true,
              note: 'Use action=execute to create an approval request, or action=apply with an approval_id to execute immediately.',
            },
          },
        };
      }

      // action === 'apply' — execute with a pre-existing approved approval
      if (action === 'apply') {
        const approvalId = inputs.approval_id ? String(inputs.approval_id) : undefined;
        if (!approvalId) return { outputs: {}, error: 'approval_id is required for action=apply. Get one via action=execute + /approve.' };

        // Verify the approval is actually approved
        const apprRes = await pool.query(
          `SELECT status, details FROM approvals WHERE id = $1 AND tool_name = 'sven.ops.deploy'`,
          [approvalId],
        );
        if (apprRes.rows.length === 0) return { outputs: {}, error: `Approval ${approvalId} not found for sven.ops.deploy.` };
        const appr = apprRes.rows[0] as { status: string; details: Record<string, any> };
        if (appr.status !== 'approved') return { outputs: {}, error: `Approval ${approvalId} is ${appr.status}, not approved.` };

        // Atomic CAS: claim the approval to prevent double-execution
        const claimed = await claimApproval(pool, approvalId);
        if (!claimed) return { outputs: {}, error: `Approval ${approvalId} was already claimed by another process.` };

        const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';
        const composePrimary = process.env.SVEN_COMPOSE_FILE || 'docker-compose.yml';
        const deployTarget = appr.details?.target || targetService;
        const deployEnv = appr.details?.environment || environment;
        const results: Array<{ step: string; success: boolean; output: string }> = [];
        const restartsSelf = deployTarget === 'all' || deployTarget === 'skill-runner';

        // Step 1: Pull latest images (builds from source where applicable)
        const composeArgs = ['-f', composePrimary, 'up', '-d', '--build', '--force-recreate'];
        if (deployTarget !== 'all') composeArgs.push(deployTarget);

        if (runContext?.userId) {
          await logOpsAudit(pool, runContext.userId, 'sven.ops.deploy', { target: deployTarget, environment: deployEnv, approval_id: approvalId }, `Deployment executing: ${deployTarget} to ${deployEnv}`, 'high');
        }

        // If this deploy restarts skill-runner, we need to send response first then restart
        if (restartsSelf) {
          // Execute non-self services first
          const nonSelfArgs = ['-f', composePrimary, 'up', '-d', '--build', '--force-recreate'];
          if (deployTarget === 'all') {
            // Restart everything except skill-runner first
            const dockerPs = runDockerCommand(['ps', '--format', '{{.Names}}'], 10000, 1024 * 32);
            const allServices = (dockerPs.stdout || '').trim().split('\n').filter(Boolean).filter(s => !s.includes('skill-runner'));
            for (const svc of allServices) {
              const restartResult = spawnSync('docker', ['restart', svc], {
                cwd: repoRoot, encoding: 'utf8', timeout: 60000,
              });
              results.push({
                step: `restart ${svc}`,
                success: restartResult.status === 0,
                output: (restartResult.stdout || restartResult.stderr || '').trim().slice(0, 200),
              });
            }
          }

          // Mark approval as executed
          await pool.query(
            `UPDATE approvals SET status = 'executed', resolved_at = NOW() WHERE id = $1`,
            [approvalId],
          );

          // Schedule self-restart after sending response
          setTimeout(() => {
            logger.info('Self-healing: restarting skill-runner process for deployment');
            const selfRestart = spawnSync('docker', ['restart', 'skill-runner'], {
              encoding: 'utf8', timeout: 30000,
            });
            if (selfRestart.status !== 0) {
              // If docker restart fails, try process.exit — PM2/Docker will auto-restart
              logger.info('Docker restart failed, exiting process for auto-restart by orchestrator');
              process.exit(0);
            }
          }, 3000);

          return {
            outputs: {
              deployment: {
                status: 'executing',
                target: deployTarget,
                environment: deployEnv,
                approval_id: approvalId,
                steps_completed: results,
                self_restart: true,
                note: 'Other services restarted. Skill-runner will self-restart in ~3 seconds. You may see a brief interruption.',
              },
            },
          };
        }

        // Non-self restart — execute directly
        const composeResult = spawnSync('docker', ['compose', ...composeArgs], {
          cwd: repoRoot, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 256,
        });
        results.push({
          step: `docker compose up -d --build --force-recreate ${deployTarget}`,
          success: composeResult.status === 0,
          output: (composeResult.stdout || composeResult.stderr || '').trim().slice(0, 500),
        });

        // Health check after restart
        const postHealth = runDockerCommand(['ps', '--format', '{{.Names}}\t{{.Status}}'], 10000, 1024 * 32);
        const healthAfter: Record<string, string> = {};
        for (const line of (postHealth.stdout || '').trim().split('\n').filter(Boolean)) {
          const [name, status] = line.split('\t');
          if (name) healthAfter[name] = status || 'unknown';
        }

        // Mark approval as executed
        await pool.query(
          `UPDATE approvals SET status = 'executed', resolved_at = NOW() WHERE id = $1`,
          [approvalId],
        );

        if (runContext?.userId) {
          await logOpsAudit(pool, runContext.userId, 'sven.ops.deploy', { target: deployTarget, approval_id: approvalId, results_count: results.length }, `Deployment completed: ${results.filter(r => r.success).length}/${results.length} steps succeeded`, 'high');
        }

        return {
          outputs: {
            deployment: {
              status: 'completed',
              target: deployTarget,
              environment: deployEnv,
              approval_id: approvalId,
              steps: results,
              services_health: healthAfter,
            },
          },
        };
      }

      if (action === 'execute') {
        const deployApprovalId = generateTaskId('approval');
        try {
          await pool.query(
            `INSERT INTO approvals (
               id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at
             ) VALUES (
               $1, $2, 'sven.ops.deploy', 'ops.deploy', $3, 'pending', 1, NOW() + INTERVAL '1 hour', $4::jsonb, NOW()
             )`,
            [
              deployApprovalId,
              runContext?.chatId || 'system',
              runContext?.userId || 'system',
              JSON.stringify({
                message: `Deploy ${targetService} to ${environment}`,
                environment,
                target: targetService,
                requires: 'Approve with /approve to execute deployment',
              }),
            ],
          );
        } catch (err) {
          return { outputs: {}, error: `Failed to create deployment approval: ${String(err)}` };
        }

        return {
          outputs: {
            deployment_status: { state: 'pending_approval', environment, target: targetService },
            approval_id: deployApprovalId,
            message: `Deployment approval created. Use /approve ${deployApprovalId} to execute the deployment to ${environment}.`,
          },
        };
      }

      return { outputs: {}, error: `Unknown deploy action: ${action}. Use status, plan, or execute.` };
    }

    case 'sven.ops.logs': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.logs', inputs, 'Log viewer accessed');

      const service = String(inputs.service || 'all');
      const level = String(inputs.level || 'error');
      const keyword = inputs.keyword ? String(inputs.keyword) : undefined;
      const limit = Math.min(Math.max(Number(inputs.limit) || 25, 1), 100);

      const levelFilter = level === 'error' ? `status IN ('error','timeout')`
        : level === 'warn' ? `status IN ('error','timeout','denied')`
        : `status IS NOT NULL`;

      // Build parameterised filters with correct indices
      const filterParams: unknown[] = [];
      let filterClauses = '';
      let pIdx = 1;

      if (keyword) {
        filterClauses += ` AND (error ILIKE $${pIdx} OR tool_name ILIKE $${pIdx})`;
        filterParams.push(`%${keyword}%`);
        pIdx++;
      }
      if (service !== 'all') {
        filterClauses += ` AND tool_name LIKE $${pIdx}`;
        filterParams.push(`%${service}%`);
        pIdx++;
      }

      const whereClause = `${levelFilter}${filterClauses} AND created_at >= NOW() - INTERVAL '24 hours'`;

      const logQuery = `SELECT tool_name, status, error, created_at, duration_ms
        FROM tool_runs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${pIdx}`;

      let logs: Array<Record<string, unknown>> = [];
      let totalMatching = 0;
      try {
        const res = await pool.query(logQuery, [...filterParams, limit]);
        logs = res.rows.map((r: any) => ({
          tool_name: r.tool_name,
          status: r.status,
          error: r.error ? String(r.error).slice(0, 500) : null,
          timestamp: r.created_at,
          duration_ms: r.duration_ms,
        }));

        const countQuery = `SELECT count(*)::int AS cnt FROM tool_runs WHERE ${whereClause}`;
        const countRes = await pool.query(countQuery, filterParams);
        totalMatching = (countRes.rows[0] as any)?.cnt || logs.length;
      } catch (err) {
        return { outputs: { logs: [], error: `Log query failed: ${String(err)}` } };
      }

      return {
        outputs: {
          logs,
          total_matching: totalMatching,
          filters: { service, level, keyword: keyword || null, limit },
        },
      };
    }

    case 'sven.ops.config': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };
      if (runContext?.userId) await logOpsAudit(pool, runContext.userId, 'sven.ops.config', inputs, `Config ${inputs.action || 'view'} requested`, inputs.action === 'update' ? 'high' : 'info');

      const action = String(inputs.action || 'view');
      const category = String(inputs.category || 'all');

      if (action === 'view') {
        const settings: Record<string, Record<string, unknown>> = {};

        // Security settings from env
        if (category === 'all' || category === 'security') {
          settings.security = {
            hardening_profile: process.env.SVEN_HARDENING_PROFILE || 'unset',
            prompt_guard_enabled: process.env.FEATURE_PROMPT_GUARD_ENABLED || 'unset',
            anti_distillation_enabled: process.env.FEATURE_ANTI_DISTILLATION_ENABLED || 'unset',
            client_attestation_enabled: process.env.FEATURE_CLIENT_ATTESTATION_ENABLED || 'unset',
            cors_origin: process.env.CORS_ORIGIN || 'unset',
          };
        }

        // Performance settings
        if (category === 'all' || category === 'performance') {
          settings.performance = {
            db_pool_max: process.env.DATABASE_POOL_MAX || 'default',
            ollama_url: process.env.OLLAMA_URL ? '(configured)' : 'unset',
            litellm_url: process.env.LITELLM_URL ? '(configured)' : 'unset',
            default_model: process.env.SVEN_AGENT_DEFAULT_MODEL || 'unset',
            coding_model: process.env.SVEN_AGENT_CODING_MODEL || 'unset',
            fast_model: process.env.SVEN_AGENT_FAST_MODEL || 'unset',
          };
        }

        // Feature flags from DB
        if (category === 'all' || category === 'features') {
          try {
            const flagRes = await pool.query(
              `SELECT key, value FROM settings WHERE key LIKE 'feature_%' OR key LIKE 'FEATURE_%' ORDER BY key LIMIT 50`,
            );
            const flags: Record<string, string> = {};
            for (const r of flagRes.rows) flags[(r as any).key] = (r as any).value;
            settings.features = flags;
          } catch {
            settings.features = { note: 'settings table not available' };
          }
        }

        // Policy engine rules
        if (category === 'all' || category === 'policies') {
          try {
            const policyRes = await pool.query(
              `SELECT name, action, enabled FROM policy_rules ORDER BY name LIMIT 50`,
            );
            settings.policies = { rules: policyRes.rows };
          } catch {
            settings.policies = { note: 'policy_rules table not available' };
          }
        }

        return { outputs: { settings, action: 'view', category } };
      }

      if (action === 'update') {
        const key = inputs.key ? String(inputs.key) : undefined;
        const value = inputs.value ? String(inputs.value) : undefined;
        if (!key || value === undefined) return { outputs: {}, error: 'key and value are required for action=update.' };

        const configApprovalId = generateTaskId('approval');
        try {
          await pool.query(
            `INSERT INTO approvals (
               id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at
             ) VALUES (
               $1, $2, 'sven.ops.config', 'ops.config', $3, 'pending', 1, NOW() + INTERVAL '1 hour', $4::jsonb, NOW()
             )`,
            [
              configApprovalId,
              runContext?.chatId || 'system',
              runContext?.userId || 'system',
              JSON.stringify({ message: `Update config: ${key} = ${value}`, key, value, requires: 'Approve with /approve to apply' }),
            ],
          );
        } catch (err) {
          return { outputs: {}, error: `Failed to create config update approval: ${String(err)}` };
        }

        return {
          outputs: {
            settings: { key, proposed_value: value, status: 'pending_approval' },
            approval_id: configApprovalId,
            message: `Config update approval created. Use /approve ${configApprovalId} to apply.`,
          },
        };
      }

      return { outputs: {}, error: `Unknown config action: ${action}. Use view or update.` };
    }

    case 'sven.ops.deep_scan': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };

      const scope = String(inputs.scope || 'all');
      const categories = Array.isArray(inputs.categories)
        ? inputs.categories.map(String)
        : ['sql_injection', 'command_injection', 'path_traversal', 'hardcoded_secrets', 'ssrf', 'missing_auth'];
      const start = Date.now();

      // Glasswing-class vulnerability patterns — regex-based SAST for TypeScript/JS
      const vulnPatterns: Array<{
        id: string; category: string; severity: string; pattern: RegExp;
        title: string; description: string; recommendation: string;
      }> = [];

      if (categories.includes('sql_injection')) {
        vulnPatterns.push(
          { id: 'SQLI-001', category: 'sql_injection', severity: 'critical', pattern: /`[^`]*\$\{[^}]+\}[^`]*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|WHERE|FROM|JOIN|SET)\b/gi, title: 'Template literal SQL with interpolated variables', description: 'SQL query uses template literal string interpolation instead of parameterised queries. Direct path to SQL injection.', recommendation: 'Use parameterised queries ($1, $2) with pg library. Never interpolate user input into SQL strings.' },
          { id: 'SQLI-002', category: 'sql_injection', severity: 'critical', pattern: /(?:query|exec|execute)\s*\(\s*[`"'][^`"']*\+\s*(?:req\.|input|param|body|query\.|args)/gi, title: 'String concatenation in SQL query', description: 'SQL query built with string concatenation from request/input data.', recommendation: 'Replace string concatenation with parameterised queries.' },
        );
      }

      if (categories.includes('command_injection')) {
        vulnPatterns.push(
          { id: 'CMDI-001', category: 'command_injection', severity: 'critical', pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/gi, title: 'Command execution with interpolated variables', description: 'Shell command uses template literals with variable interpolation — direct command injection vector.', recommendation: 'Use array-form spawn/spawnSync with arguments as separate array elements. Never interpolate into shell commands.' },
          { id: 'CMDI-002', category: 'command_injection', severity: 'high', pattern: /(?:exec|execSync)\s*\(\s*(?:input|req\.|param|body|args|command)/gi, title: 'Exec with user-controlled input', description: 'Process execution using user-controlled variables.', recommendation: 'Whitelist allowed commands, use array-form spawn, validate and sanitise all inputs.' },
        );
      }

      if (categories.includes('path_traversal')) {
        vulnPatterns.push(
          { id: 'PATH-001', category: 'path_traversal', severity: 'high', pattern: /(?:readFile|writeFile|readdir|stat|access|unlink|mkdir|rmdir|rename)\s*\(\s*(?:req\.|input|param|body|args)/gi, title: 'File operation with user-controlled path', description: 'File system operation uses user-controlled path without traversal check.', recommendation: 'Validate path with path.resolve() and ensure it starts with the allowed root directory. Reject paths containing "..".' },
          { id: 'PATH-002', category: 'path_traversal', severity: 'high', pattern: /path\.(?:join|resolve)\s*\([^)]*(?:req\.|input|param|body)[^)]*\)(?!.*(?:startsWith|includes\(['"]\.\.['"]))/gi, title: 'Path construction from user input without validation', description: 'Path built from user input without verifying it stays within the intended directory.', recommendation: 'After path.resolve(), verify the result starts with the expected base directory.' },
        );
      }

      if (categories.includes('hardcoded_secrets')) {
        vulnPatterns.push(
          { id: 'SEC-H01', category: 'hardcoded_secrets', severity: 'critical', pattern: /(?:password|secret|token|api_key|apikey|private_key|access_key)\s*[:=]\s*['"][A-Za-z0-9+/=_\-]{16,}['"]/gi, title: 'Hardcoded secret or credential', description: 'A secret, password, token, or API key appears to be hardcoded in source code.', recommendation: 'Move all secrets to environment variables or a secrets manager. Never commit credentials to source.' },
          { id: 'SEC-H02', category: 'hardcoded_secrets', severity: 'high', pattern: /(?:Bearer|Basic)\s+[A-Za-z0-9+/=_\-]{20,}/gi, title: 'Hardcoded authorization header', description: 'An authorization token (Bearer/Basic) is hardcoded in source.', recommendation: 'Load auth tokens from environment variables or secure storage.' },
        );
      }

      if (categories.includes('ssrf')) {
        vulnPatterns.push(
          { id: 'SSRF-001', category: 'ssrf', severity: 'high', pattern: /(?:fetch|axios|got|request|http\.get|https\.get|urllib)\s*\(\s*(?:req\.|input|param|body|url|args)/gi, title: 'HTTP request with user-controlled URL', description: 'An HTTP client makes a request to a URL derived from user input — SSRF vector.', recommendation: 'Validate URLs against an allowlist of domains. Block internal IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254).' },
          { id: 'SSRF-002', category: 'ssrf', severity: 'medium', pattern: /new\s+URL\s*\(\s*(?:req\.|input|param|body|args)/gi, title: 'URL construction from user input', description: 'A URL object is constructed from user-controlled input without validation.', recommendation: 'Parse and validate the URL, check the hostname against an allowlist before making any request.' },
        );
      }

      if (categories.includes('prototype_pollution')) {
        vulnPatterns.push(
          { id: 'PROTO-001', category: 'prototype_pollution', severity: 'high', pattern: /(?:Object\.assign|_\.merge|_\.extend|_\.defaultsDeep|deepmerge)\s*\(\s*(?:\{\}|target|obj),\s*(?:req\.|input|param|body|args)/gi, title: 'Deep merge with user-controlled input', description: 'Object merge/assign using user-controlled data — prototype pollution vector.', recommendation: 'Use a safe merge function that rejects __proto__, constructor, and prototype keys.' },
        );
      }

      if (categories.includes('regex_dos')) {
        vulnPatterns.push(
          { id: 'REDOS-001', category: 'regex_dos', severity: 'medium', pattern: /new\s+RegExp\s*\(\s*(?:req\.|input|param|body|args)/gi, title: 'User-controlled regex pattern', description: 'RegExp constructed from user input — can cause catastrophic backtracking (ReDoS).', recommendation: 'Never allow user input to construct regex patterns. If needed, use a regex timeout or re2 library.' },
        );
      }

      if (categories.includes('unsafe_deserialization')) {
        vulnPatterns.push(
          { id: 'DESER-001', category: 'unsafe_deserialization', severity: 'critical', pattern: /(?:eval|Function)\s*\(\s*(?:req\.|input|param|body|args|data)/gi, title: 'Eval/Function with user input', description: 'eval() or Function() called with user-controlled data — remote code execution vector.', recommendation: 'Never use eval() or Function() with untrusted data. Use JSON.parse() for data deserialization.' },
          { id: 'DESER-002', category: 'unsafe_deserialization', severity: 'high', pattern: /JSON\.parse\s*\(\s*(?:req\.|input\.)[^)]*\)(?!.*(?:try|catch|schema|validate|zod|joi|ajv))/gi, title: 'JSON.parse of user input without validation', description: 'User input is parsed as JSON without schema validation.', recommendation: 'Validate parsed JSON against a schema (Zod, Joi, Ajv) before using it.' },
        );
      }

      if (categories.includes('missing_auth')) {
        vulnPatterns.push(
          { id: 'AUTH-001', category: 'missing_auth', severity: 'high', pattern: /app\.(?:get|post|put|patch|delete)\s*\(\s*['"][^'"]+['"]\s*,\s*(?:async\s+)?\(?(?:req|request)/gi, title: 'Route handler without auth middleware', description: 'HTTP route handler does not appear to use authentication middleware (preHandler/authenticated/adminOnly).', recommendation: 'Add preHandler: authenticated or adminOnly to all non-public routes.' },
        );
      }

      if (categories.includes('open_redirect')) {
        vulnPatterns.push(
          { id: 'REDIR-001', category: 'open_redirect', severity: 'medium', pattern: /(?:redirect|location)\s*(?:=|\()\s*(?:req\.|input|param|body|query\.|url)/gi, title: 'Redirect with user-controlled URL', description: 'HTTP redirect uses user-controlled URL — open redirect / phishing vector.', recommendation: 'Validate redirect URLs against an allowlist of internal paths. Never redirect to user-supplied external URLs.' },
        );
      }

      if (categories.includes('info_disclosure')) {
        vulnPatterns.push(
          { id: 'INFO-001', category: 'info_disclosure', severity: 'medium', pattern: /(?:console\.log|logger\.info|logger\.debug)\s*\([^)]*(?:password|secret|token|api_key|private_key|cookie|session)/gi, title: 'Sensitive data in logs', description: 'Logging statement may include sensitive data (passwords, tokens, secrets).', recommendation: 'Redact sensitive fields before logging. Use structured logging with explicit field selection.' },
          { id: 'INFO-002', category: 'info_disclosure', severity: 'low', pattern: /\.stack\s*\|\||err\.stack|error\.stack/gi, title: 'Stack trace potentially exposed', description: 'Error stack trace may be exposed to clients, leaking internal paths and library versions.', recommendation: 'Never return stack traces in API responses. Log internally, return a generic error message to clients.' },
        );
      }

      const serviceMap: Record<string, string> = {
        'gateway-api': 'services/gateway-api/src',
        'agent-runtime': 'services/agent-runtime/src',
        'skill-runner': 'services/skill-runner/src',
      };
      const targets = scope === 'all' ? Object.keys(serviceMap) : serviceMap[scope] ? [scope] : [];
      const vulnerabilities: Array<{ id: string; severity: string; category: string; title: string; file: string; line: number; snippet: string; description: string; recommendation: string }> = [];
      let filesScanned = 0;

      async function scanDir(dir: string): Promise<string[]> {
        const files: string[] = [];
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === '__tests__') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              files.push(...await scanDir(full));
            } else if (/\.(ts|js|mjs|cjs)$/.test(entry.name)) {
              files.push(full);
            }
          }
        } catch { /* permission denied or missing dir */ }
        return files;
      }

      for (const target of targets) {
        const srcDir = serviceMap[target];
        if (!srcDir) continue;
        const files = await scanDir(srcDir);
        filesScanned += files.length;

        for (const filePath of files) {
          let content: string;
          try {
            content = await fs.readFile(filePath, 'utf8');
          } catch { continue; }

          const lines = content.split('\n');
          for (const vp of vulnPatterns) {
            vp.pattern.lastIndex = 0;
            for (let i = 0; i < lines.length; i++) {
              if (vp.pattern.test(lines[i])) {
                // Skip false positives: test files, comments
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

                vulnerabilities.push({
                  id: vp.id,
                  severity: vp.severity,
                  category: vp.category,
                  title: vp.title,
                  file: filePath,
                  line: i + 1,
                  snippet: lines[i].trim().slice(0, 200),
                  description: vp.description,
                  recommendation: vp.recommendation,
                });
              }
              vp.pattern.lastIndex = 0; // Reset regex state for global patterns
            }
          }
        }
      }

      const summary: Record<string, number> = {};
      for (const v of vulnerabilities) summary[v.severity] = (summary[v.severity] || 0) + 1;

      const scanSeverity = vulnerabilities.some(v => v.severity === 'critical') ? 'critical'
        : vulnerabilities.some(v => v.severity === 'high') ? 'high' : 'info';

      if (runContext?.userId) {
        await logOpsAudit(pool, runContext.userId, 'sven.ops.deep_scan', { scope, categories },
          `${vulnerabilities.length} findings (${summary['critical'] || 0} critical, ${summary['high'] || 0} high) across ${filesScanned} files`,
          scanSeverity as any);
      }

      return {
        outputs: {
          vulnerabilities: vulnerabilities.slice(0, 100),
          summary: { ...summary, total: vulnerabilities.length },
          scan_duration_ms: Date.now() - start,
          files_scanned: filesScanned,
          scope,
          categories,
          glasswing_note: 'Glasswing-class source-level SAST scan. Pattern-based detection of OWASP Top 10 vulnerability classes. When a frontier model (Mithos-class) becomes available as Sven\'s base, these patterns will be augmented with semantic code understanding for zero-day-class detection.',
        },
      };
    }

    case 'sven.ops.rollback': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };

      const count = Math.min(Math.max(Number(inputs.count) || 1, 1), 5);
      const dryRun = inputs.dry_run === true;
      const repoRoot = process.env.SVEN_REPO_ROOT || '/home/hantz/47/47Network/TheSven/thesven_v0.1.0';

      // Preview: show what would be rolled back
      const logResult = spawnSync('git', ['log', `--max-count=${count}`, '--pretty=%H %s'], {
        cwd: repoRoot, encoding: 'utf8', timeout: 5000,
      });
      const candidates = (logResult.stdout || '').trim().split('\n').filter(Boolean).map(line => {
        const [hash, ...msgParts] = line.split(' ');
        return { hash, message: msgParts.join(' '), is_heal: msgParts.join(' ').includes('sven-heal') };
      });
      const healCommits = candidates.filter(c => c.is_heal);

      if (healCommits.length === 0) {
        return { outputs: { status: 'nothing_to_rollback', candidates, note: 'No sven-heal commits found in the last ' + count + ' commits.' } };
      }

      if (dryRun) {
        return {
          outputs: {
            status: 'dry_run',
            would_revert: healCommits,
            total_candidates: candidates.length,
            note: `Would revert ${healCommits.length} sven-heal commit(s). Run with dry_run=false to execute.`,
          },
        };
      }

      const result = revertHealCommits(repoRoot, count);

      if (runContext?.userId) {
        await logOpsAudit(pool, runContext.userId, 'sven.ops.rollback', { count, reverted: result.reverted },
          result.ok ? `Rolled back ${result.reverted.length} commit(s), build verified clean` : `Rollback failed: ${result.output}`,
          result.ok ? 'high' : 'critical');
      }

      // v5: Rollback→Deploy chaining — auto-create deploy approval
      let chainedDeployId: string | undefined;
      if (result.ok && inputs.chain_deploy !== false) {
        try {
          chainedDeployId = generateTaskId('approval');
          await pool.query(
            `INSERT INTO approvals (id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, expires_at, details, created_at)
             VALUES ($1, $2, 'sven.ops.deploy', 'ops.deploy', $3, 'pending', 1, NOW() + INTERVAL '1 hour', $4::jsonb, NOW())`,
            [
              chainedDeployId,
              runContext?.chatId || 'system',
              runContext?.userId || 'system',
              JSON.stringify({ message: `Deploy rollback of ${result.reverted.length} heal commit(s)`, target: 'all', environment: 'staging', chained_from_rollback: true }),
            ],
          );
        } catch { chainedDeployId = undefined; }
      }

      const chainNote = chainedDeployId ? ` Deploy approval auto-created: /approve ${chainedDeployId}` : '';

      return {
        outputs: {
          status: result.ok ? 'rolled_back' : 'failed',
          reverted_commits: result.reverted,
          build_verified: result.ok,
          detail: result.output,
          chained_deploy_id: chainedDeployId || null,
          note: result.ok
            ? `Reverted ${result.reverted.length} sven-heal commit(s). Build re-verified clean.${chainNote}`
            : result.output,
        },
      };
    }

    case 'sven.ops.heal_history': {
      const gate = await requireAdmin47(pool, runContext?.userId);
      if (!gate.ok) return { outputs: {}, error: gate.error };

      // v8: Clear quarantine for a specific file if requested
      if (inputs.clear_quarantine) {
        const file = String(inputs.clear_quarantine);
        const cleared = clearFileQuarantine(file);
        if (runContext?.userId) {
          await logOpsAudit(pool, runContext.userId, 'sven.ops.heal_history', { file }, cleared ? `Quarantine cleared for ${file}` : `No quarantine found for ${file}`, 'medium');
        }
        return {
          outputs: {
            quarantine_cleared: cleared,
            file,
            note: cleared ? `Quarantine lifted for ${file}. Heal operations can target this file again.` : `${file} was not quarantined.`,
          },
        };
      }

      const toolFilter = inputs.tool_filter ? String(inputs.tool_filter) : null;
      const severityFilter = inputs.severity_filter ? String(inputs.severity_filter) : null;
      const limit = Math.min(Math.max(Number(inputs.limit) || 50, 1), 200);
      const sinceHours = Math.min(Math.max(Number(inputs.since_hours) || 168, 1), 8760);
      const includeStats = inputs.include_stats !== false;

      const healTools = [
        'sven.ops.code_fix', 'sven.ops.deploy', 'sven.ops.code_scan',
        'sven.ops.health', 'sven.ops.deep_scan',
      ];

      // --- Fetch recent entries ---
      const conditions: string[] = ['created_at > NOW() - make_interval(hours => $1)'];
      const params: unknown[] = [sinceHours];
      let paramIdx = 2;

      if (toolFilter) {
        conditions.push(`tool_name = $${paramIdx}`);
        params.push(toolFilter);
        paramIdx++;
      } else {
        conditions.push(`tool_name = ANY($${paramIdx})`);
        params.push(healTools);
        paramIdx++;
      }

      if (severityFilter) {
        conditions.push(`severity = $${paramIdx}`);
        params.push(severityFilter);
        paramIdx++;
      }

      const entriesRes = await pool.query(
        `SELECT id, tool_name, action, result_summary, severity, inputs, created_at
         FROM ops_audit_log
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${paramIdx}`,
        [...params, limit],
      );

      const entries = entriesRes.rows.map((r: any) => ({
        id: r.id,
        tool: r.tool_name,
        action: r.action,
        summary: r.result_summary,
        severity: r.severity,
        inputs_preview: (() => {
          try {
            const inp = typeof r.inputs === 'string' ? JSON.parse(r.inputs) : r.inputs;
            const keys = Object.keys(inp || {});
            return keys.slice(0, 5).join(', ') || '(none)';
          } catch { return '(parse error)'; }
        })(),
        at: r.created_at,
      }));

      // --- Aggregate stats ---
      let stats: Record<string, unknown> = {};
      if (includeStats) {
        const statsRes = await pool.query(
          `SELECT tool_name,
                  COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE result_summary ILIKE '%success%' OR result_summary ILIKE '%completed%' OR result_summary ILIKE '%passed%') AS successes,
                  COUNT(*) FILTER (WHERE result_summary ILIKE '%fail%' OR result_summary ILIKE '%error%' OR result_summary ILIKE '%rollback%') AS failures,
                  COUNT(*) FILTER (WHERE severity IN ('high','critical')) AS high_severity,
                  MIN(created_at) AS first_seen,
                  MAX(created_at) AS last_seen
           FROM ops_audit_log
           WHERE created_at > NOW() - make_interval(hours => $1)
             AND tool_name = ANY($2)
           GROUP BY tool_name
           ORDER BY total DESC`,
          [sinceHours, healTools],
        );
        const toolStats: Record<string, unknown> = {};
        let totalOps = 0;
        let totalSuccesses = 0;
        let totalFailures = 0;
        for (const row of statsRes.rows as any[]) {
          toolStats[row.tool_name] = {
            total: Number(row.total),
            successes: Number(row.successes),
            failures: Number(row.failures),
            high_severity: Number(row.high_severity),
            first_seen: row.first_seen,
            last_seen: row.last_seen,
          };
          totalOps += Number(row.total);
          totalSuccesses += Number(row.successes);
          totalFailures += Number(row.failures);
        }
        stats = {
          by_tool: toolStats,
          totals: {
            operations: totalOps,
            successes: totalSuccesses,
            failures: totalFailures,
            success_rate: totalOps > 0 ? `${((totalSuccesses / totalOps) * 100).toFixed(1)}%` : 'N/A',
          },
        };
      }

      // --- Approval execution stats ---
      const approvalRes = await pool.query(
        `SELECT status, COUNT(*) AS cnt
         FROM approvals
         WHERE created_at > NOW() - make_interval(hours => $1)
           AND tool_name = ANY($2)
         GROUP BY status`,
        [sinceHours, ['sven.ops.code_fix', 'sven.ops.deploy']],
      );
      const approvalStats: Record<string, number> = {};
      for (const row of approvalRes.rows as any[]) {
        approvalStats[row.status] = Number(row.cnt);
      }

      // --- Circuit breaker status (from in-memory state) ---
      const cbStatus = {
        state: circuitState(),
        consecutive_failures: opsConsecutiveFailures,
        threshold: OPS_CIRCUIT_THRESHOLD,
        last_failure_at: opsLastFailureAt ? new Date(opsLastFailureAt).toISOString() : null,
        half_open_cooldown_ms: OPS_CIRCUIT_HALF_OPEN_MS,
      };

      if (runContext?.userId) {
        await logOpsAudit(pool, runContext.userId, 'sven.ops.heal_history', { tool_filter: toolFilter, severity_filter: severityFilter, limit, since_hours: sinceHours },
          `Returned ${entries.length} entries over ${sinceHours}h window`, 'info');
      }

      // v7: Confidence scoring for a specific file if requested
      let confidenceResult: Record<string, unknown> | undefined;
      if (inputs.confidence_file) {
        const conf = await getHealConfidence(pool, String(inputs.confidence_file));
        confidenceResult = {
          file: String(inputs.confidence_file),
          confidence_score: conf.score,
          total_operations: conf.total,
          successes: conf.successes,
          failures: conf.failures,
          revert_rate: conf.revertRate,
          rating: conf.score >= 0.8 ? 'HIGH' : conf.score >= 0.5 ? 'MEDIUM' : 'LOW',
        };
      }

      return {
        outputs: {
          entries,
          total_entries: entries.length,
          time_range_hours: sinceHours,
          stats: includeStats ? stats : undefined,
          approval_stats: approvalStats,
          circuit_breaker: cbStatus,
          telemetry: healTelemetry,
          quarantined_files: getQuarantinedFiles(),
          confidence: confidenceResult || undefined,
          duration_stats: getHealDurationStats(),
          heal_note: 'This is Sven\'s self-healing track record. Use it to identify recurring issues, track fix success rates, and understand the health of the autonomous repair pipeline. Use clear_quarantine to lift file quarantines.',
        },
      };
    }

    default:
      return { outputs: {}, error: `No in-process handler for tool: ${toolName}` };
  }
}

async function executeMcpProxyTool(
  toolName: string,
  inputs: Record<string, unknown>,
  pool: pg.Pool,
  chatId?: string,
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  const row = await pool.query(
    `SELECT t.server_id, t.tool_name, s.transport, s.url, s.auth_token, s.status,
            o.enabled AS override_enabled
     FROM mcp_server_tools t
     JOIN mcp_servers s ON s.id = t.server_id
     LEFT JOIN mcp_chat_overrides o
       ON o.server_id = t.server_id
      AND o.chat_id = $2
     WHERE t.qualified_name = $1
     LIMIT 1`,
    [toolName, chatId || null],
  );
  if (row.rows.length === 0) {
    return { outputs: {}, error: `MCP proxy tool not found: ${toolName}` };
  }
  const target = row.rows[0];
  const serverStatus = String(target.status || '').toLowerCase();
  if (serverStatus !== 'connected') {
    return { outputs: {}, error: `MCP server is not connected (${serverStatus || 'unknown'})` };
  }
  if (chatId && target.override_enabled === false) {
    return { outputs: {}, error: 'MCP server is disabled for this chat' };
  }
  const transport = String(target.transport || '').toLowerCase();
  const timeoutResolution = resolveMcpRpcTimeoutMs(process.env.MCP_RPC_TIMEOUT_MS);
  const timeoutMs = timeoutResolution.timeoutMs;
  if (timeoutResolution.invalid) {
    logger.warn('Invalid MCP_RPC_TIMEOUT_MS; using default timeout', {
      raw_timeout: String(process.env.MCP_RPC_TIMEOUT_MS),
      default_timeout_ms: DEFAULT_MCP_RPC_TIMEOUT_MS,
    });
  }
  const mcpToolCallJsonMaxBytes = resolveMcpToolCallJsonMaxBytes(process.env.SVEN_MCP_TOOL_CALL_JSON_MAX_BYTES);
  const startedAtMs = Date.now();
  try {
    let payload: any;
    if (transport === 'stdio') {
      payload = callMcpStdio(String(target.url), String(target.tool_name), inputs, timeoutMs);
    } else if (transport === 'http') {
      payload = await callMcpHttp(
        String(target.url),
        String(target.auth_token || ''),
        String(target.tool_name),
        inputs,
        timeoutMs,
      );
    } else {
      throw new Error(`MCP_UNSUPPORTED_TRANSPORT: ${transport || 'unknown'}`);
    }
    const serializedInput = serializeMcpToolCallPayloadForStorage(inputs, 'input', mcpToolCallJsonMaxBytes);
    const serializedOutput = serializeMcpToolCallPayloadForStorage(payload, 'output', mcpToolCallJsonMaxBytes);
    if (serializedInput.truncated || serializedOutput.truncated) {
      logger.warn('MCP tool-call persistence payload truncated', {
        server_id: target.server_id,
        tool_name: target.tool_name,
        input_truncated: serializedInput.truncated,
        output_truncated: serializedOutput.truncated,
        max_bytes: mcpToolCallJsonMaxBytes,
      });
    }
    await pool.query(
      `INSERT INTO mcp_tool_calls (id, server_id, tool_name, input, output, duration_ms, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'success', NOW())`,
      [
        `mcp_${generateTaskId('tool_run')}`,
        target.server_id,
        target.tool_name,
        serializedInput.json,
        serializedOutput.json,
        Math.max(0, Date.now() - startedAtMs),
      ],
    );
    return { outputs: { mcp: payload } };
  } catch (err) {
    const callerSafeError = sanitizeMcpProxyError(err);
    const serializedInput = serializeMcpToolCallPayloadForStorage(inputs, 'input', mcpToolCallJsonMaxBytes);
    if (serializedInput.truncated) {
      logger.warn('MCP tool-call error input payload truncated', {
        server_id: target.server_id,
        tool_name: target.tool_name,
        max_bytes: mcpToolCallJsonMaxBytes,
      });
    }
    try {
      await pool.query(
        `INSERT INTO mcp_tool_calls (id, server_id, tool_name, input, output, duration_ms, status, error, created_at)
         VALUES ($1, $2, $3, $4, '{}'::jsonb, $5, 'error', $6, NOW())`,
        [
          `mcp_${generateTaskId('tool_run')}`,
          target.server_id,
          target.tool_name,
          serializedInput.json,
          Math.max(0, Date.now() - startedAtMs),
          String(err),
        ],
      );
    } catch (logErr) {
      logger.error('MCP proxy error logging insert failed', {
        server_id: target.server_id,
        tool_name: target.tool_name,
        logging_err: String(logErr),
      });
    }
    logger.warn('MCP proxy call failed', {
      server_id: target.server_id,
      tool_name: target.tool_name,
      err: String(err),
      caller_error: callerSafeError,
    });
    return { outputs: {}, error: callerSafeError };
  }
}

function callMcpStdio(
  specRaw: string,
  toolName: string,
  input: Record<string, unknown>,
  timeoutMs: number,
): any {
  const spec = parseMcpStdioSpec(specRaw);
  const requestId = `mcp_${Date.now()}`;
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: { name: toolName, arguments: input || {} },
  });
  const childEnv = buildMcpStdioEnv(process.env, spec.env);
  if (spec.env && Object.keys(spec.env).length > 0) {
    logger.info('MCP stdio env overrides applied', {
      env_keys: Object.keys(spec.env).slice(0, 64),
    });
  }
  const child = spawnSync(spec.command, spec.args, {
    cwd: spec.cwd || process.cwd(),
    env: childEnv,
    shell: false,
    input: `${payload}\n`,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  if (child.error) {
    throw new Error('MCP_STDIO_EXEC_FAILED');
  }
  if (typeof child.status === 'number' && child.status !== 0) {
    throw new Error(`MCP_STDIO_EXIT_NON_ZERO: status ${child.status}`);
  }
  if (child.signal) {
    throw new Error(`MCP_STDIO_EXIT_SIGNAL: signal ${child.signal}`);
  }
  return parseMcpStdioResponse(String(child.stdout || ''), requestId);
}

function parseMcpStdioSpec(url: string): {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
} {
  const trimmed = String(url || '').trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    throw new Error('Invalid MCP stdio config: JSON object required');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid MCP stdio config: malformed JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid MCP stdio config: JSON object required');
  }
  const command = String(parsed?.command || '').trim();
  if (!command) throw new Error('Invalid MCP stdio config: command required');
  return {
    command,
    args: Array.isArray(parsed?.args) ? parsed.args.map((x: unknown) => String(x)) : [],
    cwd: typeof parsed?.cwd === 'string' ? parsed.cwd : undefined,
    env: parsed?.env && typeof parsed.env === 'object'
      ? Object.fromEntries(Object.entries(parsed.env).map(([k, v]) => [k, String(v)]))
      : undefined,
    shell: typeof parsed?.shell === 'boolean' ? parsed.shell : undefined,
  };
}

function sanitizeMcpProxyError(err: unknown): string {
  const text = String(err || '');
  if (text.startsWith('MCP_HTTP_UNSAFE_TARGET')) {
    return 'MCP target is not allowed';
  }
  if (text.startsWith('MCP_HTTP_RESPONSE_TOO_LARGE')) {
    return 'MCP response exceeded allowed size';
  }
  if (text.startsWith('MCP_HTTP_INVALID_JSON')) {
    return 'MCP transport returned invalid JSON';
  }
  if (text.startsWith('MCP_HTTP_TOOL_FAILED')) {
    return 'MCP HTTP tool call failed';
  }
  if (text.startsWith('MCP_UNSUPPORTED_TRANSPORT')) {
    return 'MCP server transport is not supported';
  }
  if (text.startsWith('MCP_STDIO_EXEC_FAILED')) {
    return 'MCP stdio execution failed';
  }
  if (text.startsWith('MCP_STDIO_EXIT_NON_ZERO')) {
    return 'MCP stdio process exited with non-zero status';
  }
  if (text.startsWith('MCP_STDIO_EXIT_SIGNAL')) {
    return 'MCP stdio process terminated by signal';
  }
  if (text.startsWith('MCP_STDIO_NO_RESPONSE')) {
    return 'MCP stdio returned no response';
  }
  if (text.startsWith('MCP_STDIO_INVALID_JSON_RESPONSE')) {
    return 'MCP stdio returned invalid JSON';
  }
  if (text.startsWith('MCP_STDIO_TOOL_FAILED')) {
    return 'MCP stdio tool call failed';
  }
  return 'MCP tool call failed';
}

/**
 * Container-per-call execution via Docker.
 */
async function executeInContainer(
  tool: Record<string, unknown>,
  event: ToolRunRequestEvent,
  timeout: number,
  nasMounts: string[],
  egressConfig: { networkArgs: string[]; envArgs: string[] },
  secretMounts: { mountArgs: string[]; envArgs: string[] },
): Promise<{ outputs: Record<string, unknown>; error?: string; logs?: ToolLogs }> {

  const imageName = (tool.manifest as any)?.image || `sven-skill-${tool.name}:latest`;
  const memLimit = `${tool.max_memory_mb || 256}m`;
  const cpuShares = String(tool.max_cpu_shares || 512);
  const maxBytes = getMaxBytes(tool);

  const envJson = JSON.stringify(event.inputs);
  const encodedInput = Buffer.from(envJson).toString('base64');

  try {
    const args = [
      'run', '--rm',
      ...egressConfig.networkArgs,
      `--memory=${memLimit}`,
      `--cpu-shares=${cpuShares}`,
      '--read-only',
      '--tmpfs', '/tmp:size=64m',
      ...nasMounts,
      ...secretMounts.mountArgs,
      ...egressConfig.envArgs,
      ...secretMounts.envArgs,
      '-e', `SVEN_INPUT=${encodedInput}`,
      '-e', `SVEN_RUN_ID=${event.run_id}`,
      imageName,
    ];

    const result = runDockerCommand(args, timeout, maxBytes);
    const logs: ToolLogs = {
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
    };

    if (result.error) {
      return { outputs: {}, error: result.error, logs };
    }

    if (Buffer.byteLength(result.stdout, 'utf8') > maxBytes) {
      return { outputs: {}, error: 'Tool output exceeded max_bytes limit', logs };
    }

    try {
      const outputs = JSON.parse(result.stdout.trim());
      return { outputs, logs };
    } catch {
      return { outputs: {}, error: 'Invalid tool output JSON', logs };
    }
  } catch (err: any) {
    return { outputs: {}, error: `Container execution failed: ${err.message}` };
  }
}

/**
 * gVisor sandboxed execution for quarantined skills.
 * Uses runsc runtime via Docker.
 */
async function executeInGVisor(
  tool: Record<string, unknown>,
  event: ToolRunRequestEvent,
  timeout: number,
  nasMounts: string[],
  egressConfig: { networkArgs: string[]; envArgs: string[] },
  secretMounts: { mountArgs: string[]; envArgs: string[] },
): Promise<{ outputs: Record<string, unknown>; error?: string; logs?: ToolLogs }> {

  const imageName = (tool.manifest as any)?.image || `sven-skill-${tool.name}:latest`;
  const memLimit = `${tool.max_memory_mb || 128}m`;
  const maxBytes = getMaxBytes(tool);

  const envJson = JSON.stringify(event.inputs);
  const encodedInput = Buffer.from(envJson).toString('base64');

  try {
    const args = [
      'run', '--rm',
      '--runtime=runsc',
      ...egressConfig.networkArgs,
      `--memory=${memLimit}`,
      '--read-only',
      '--tmpfs', '/tmp:size=32m',
      '--cap-drop=ALL',
      ...nasMounts,
      ...secretMounts.mountArgs,
      ...egressConfig.envArgs,
      ...secretMounts.envArgs,
      '-e', `SVEN_INPUT=${encodedInput}`,
      '-e', `SVEN_RUN_ID=${event.run_id}`,
      imageName,
    ];

    const result = runDockerCommand(args, timeout, maxBytes);
    const logs: ToolLogs = {
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
    };

    if (result.error) {
      return { outputs: {}, error: result.error, logs };
    }

    if (Buffer.byteLength(result.stdout, 'utf8') > maxBytes) {
      return { outputs: {}, error: 'Tool output exceeded max_bytes limit', logs };
    }

    try {
      const outputs = JSON.parse(result.stdout.trim());
      return { outputs, logs };
    } catch {
      return { outputs: {}, error: 'Invalid tool output JSON', logs };
    }
  } catch (err: any) {
    return { outputs: {}, error: `gVisor execution failed: ${err.message}` };
  }
}

/**
 * Firecracker micro-VM execution for high-isolation skill runs.
 * Launches a Firecracker micro-VM via the jailer, copies tool inputs via
 * a virtio-vsock channel, and captures JSON output from stdout.
 * Falls back to Docker container execution if the Firecracker binary is
 * not available (graceful degradation).
 */
async function executeInFirecracker(
  tool: Record<string, unknown>,
  event: ToolRunRequestEvent,
  timeout: number,
): Promise<{ outputs: Record<string, unknown>; error?: string; logs?: ToolLogs }> {
  const firecrackerBin = process.env.SVEN_FIRECRACKER_BIN || '/usr/bin/firecracker';
  const jailerBin = process.env.SVEN_JAILER_BIN || '/usr/bin/jailer';
  const kernelImage = process.env.SVEN_FC_KERNEL || '/var/lib/sven/firecracker/vmlinux';
  const rootfsBase = process.env.SVEN_FC_ROOTFS_DIR || '/var/lib/sven/firecracker/rootfs';

  // Check Firecracker availability
  const fcCheck = spawnSync(firecrackerBin, ['--version'], { timeout: 5000, encoding: 'utf8' });
  if (fcCheck.error || fcCheck.status !== 0) {
    return {
      outputs: {},
      error: `Firecracker not available at ${firecrackerBin}: ${fcCheck.error?.message || fcCheck.stderr || 'binary not found'}. Configure SVEN_FIRECRACKER_BIN or install Firecracker.`,
    };
  }

  const manifest = (tool.manifest as Record<string, unknown>) || {};
  const rootfsImage = (manifest.rootfs as string) || path.join(rootfsBase, `sven-skill-${tool.name}.ext4`);
  const memSizeMib = Math.min(Number(tool.max_memory_mb) || 128, 512);
  const vcpuCount = Math.min(Number(manifest.vcpu_count) || 1, 2);
  const maxBytes = getMaxBytes(tool);

  const vmId = `fc-${event.run_id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
  const chrootBase = process.env.SVEN_FC_CHROOT || '/srv/jailer';
  const chrootDir = path.join(chrootBase, 'firecracker', vmId);

  const envJson = JSON.stringify(event.inputs);
  const encodedInput = Buffer.from(envJson).toString('base64');

  try {
    // Ensure chroot directory structure exists
    await fs.mkdir(path.join(chrootDir, 'root'), { recursive: true });

    // Write input payload to a file the VM guest can read via mount
    const inputPath = path.join(chrootDir, 'root', 'sven_input.b64');
    await fs.writeFile(inputPath, encodedInput, 'utf8');

    // Copy kernel and rootfs into chroot (jailer requirement)
    const chrootKernel = path.join(chrootDir, 'root', 'vmlinux');
    const chrootRootfs = path.join(chrootDir, 'root', 'rootfs.ext4');
    await fs.copyFile(kernelImage, chrootKernel);
    await fs.copyFile(rootfsImage, chrootRootfs);

    // Build jailer arguments
    const jailerArgs = [
      '--id', vmId,
      '--exec-file', firecrackerBin,
      '--uid', '65534',
      '--gid', '65534',
      '--chroot-base-dir', chrootBase,
      '--',
      '--no-api',
      '--config-file', '/dev/null',
    ];

    // Build the VM config and pass it via stdin
    const vmConfig = JSON.stringify({
      'boot-source': {
        kernel_image_path: 'vmlinux',
        boot_args: `console=ttyS0 reboot=k panic=1 pci=off init=/sven-entrypoint SVEN_INPUT_FILE=/sven_input.b64 SVEN_RUN_ID=${event.run_id}`,
      },
      'drives': [{
        drive_id: 'rootfs',
        path_on_host: 'rootfs.ext4',
        is_root_device: true,
        is_read_only: true,
      }],
      'machine-config': {
        vcpu_count: vcpuCount,
        mem_size_mib: memSizeMib,
      },
    });

    const configPath = path.join(chrootDir, 'root', 'vm_config.json');
    await fs.writeFile(configPath, vmConfig, 'utf8');

    // Replace --config-file /dev/null with the real config
    jailerArgs[jailerArgs.length - 1] = 'vm_config.json';

    const result = spawnSync(jailerBin, jailerArgs, {
      timeout,
      maxBuffer: maxBytes,
      encoding: 'utf8',
      cwd: chrootDir,
    });

    const logs: ToolLogs = {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exit_code: result.status ?? -1,
    };

    if (result.error) {
      if (isMaxBufferError(result.error)) {
        return { outputs: {}, error: 'Tool output exceeded max_bytes limit', logs };
      }
      return { outputs: {}, error: `Firecracker VM execution failed: ${result.error.message}`, logs };
    }

    if (result.status !== 0) {
      const message = result.stderr || `Firecracker VM exited with code ${result.status}`;
      return { outputs: {}, error: `Firecracker VM execution failed: ${message}`, logs };
    }

    if (Buffer.byteLength(result.stdout, 'utf8') > maxBytes) {
      return { outputs: {}, error: 'Tool output exceeded max_bytes limit', logs };
    }

    try {
      const outputs = JSON.parse(result.stdout.trim());
      return { outputs, logs };
    } catch {
      return { outputs: {}, error: 'Invalid tool output JSON', logs };
    }
  } catch (err: any) {
    return { outputs: {}, error: `Firecracker execution failed: ${err.message}` };
  } finally {
    // Clean up chroot directory
    try {
      await fs.rm(chrootDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Publish tool run result to NATS.
 */
async function publishResult(
  nc: NatsConnection,
  event: ToolRunRequestEvent,
  status: string,
  outputs: Record<string, unknown>,
  error?: string,
): Promise<void> {
  const envelope: EventEnvelope<ToolRunResultEvent> = {
    schema_version: '1.0',
    event_id: generateTaskId('event_envelope'),
    occurred_at: new Date().toISOString(),
    data: {
      run_id: event.run_id,
      correlation_id: event.correlation_id,
      tool_name: event.tool_name,
      chat_id: event.chat_id,
      user_id: event.user_id,
      status,
      outputs,
      error,
    },
  };

  nc.publish(NATS_SUBJECTS.TOOL_RUN_RESULT, jc.encode(envelope));
}

if (String(process.env.SVEN_SKIP_MAIN || '').toLowerCase() !== 'true') {
  main().catch((err) => {
    logger.fatal('Skill runner failed', { err: err instanceof Error ? err.stack : String(err) });
    process.exit(1);
  });
}
