import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { IntegrationRuntimeOrchestrator } from '../../services/IntegrationRuntimeOrchestrator.js';

type IntegrationCatalogItem = {
  id: string;
  name: string;
  runtime_type: string;
  tool_patterns: string[];
  required_settings: string[];
  configuration_mode: 'settings' | 'table' | 'hybrid' | 'none';
  table_name?: string;
};

type IntegrationTemplatePlan = {
  settings: Record<string, unknown>;
  runtime: {
    mode: 'container' | 'local_worker';
    image_ref?: string;
    deployment_spec?: Record<string, unknown>;
  };
};

type IntegrationLibraryProfile = {
  id: string;
  name: string;
  description: string;
  integration_ids: string[];
};

type ApplyTemplateBody = {
  deploy_runtime?: boolean;
  overwrite_existing?: boolean;
  setting_overrides?: Record<string, unknown>;
  runtime_mode?: 'container' | 'local_worker';
  image_ref?: string;
};

type RecoveryPlaybookBody = {
  retry_failed?: boolean;
  deploy_stopped?: boolean;
  apply_templates_unconfigured?: boolean;
  validate_unconfigured?: boolean;
  overwrite_existing?: boolean;
  boot_event_limit?: number;
};

function sanitizeRuntimeResultForTenant<T extends Record<string, unknown>>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = { ...payload } as Record<string, unknown>;
  delete clone.command;
  delete clone.output;
  return clone as T;
}

const PLAYBOOK_LOCK_NAMESPACE = 0x49525042;

function parseOptionalBooleanOption(
  raw: unknown,
  field:
    | 'deploy_runtime'
    | 'overwrite_existing'
    | 'retry_failed'
    | 'deploy_stopped'
    | 'apply_templates_unconfigured'
    | 'validate_unconfigured',
): { valid: true; value: boolean | undefined } | { valid: false; message: string } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, message: `${field} must be a boolean when provided` };
  }
  return { valid: true, value: raw };
}

function newRunId(): string {
  return `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const INTEGRATIONS: IntegrationCatalogItem[] = [
  { id: 'ha', name: 'Home Assistant', runtime_type: 'ha', tool_patterns: ['ha.%'], required_settings: ['ha.base_url', 'ha.token_ref'], configuration_mode: 'settings' },
  { id: 'calendar', name: 'Calendar (CalDAV/Google)', runtime_type: 'calendar', tool_patterns: ['calendar.%'], required_settings: [], configuration_mode: 'table', table_name: 'calendar_accounts' },
  { id: 'git', name: 'Git (Forgejo/GitHub)', runtime_type: 'git', tool_patterns: ['git.%'], required_settings: [], configuration_mode: 'table', table_name: 'git_repos' },
  { id: 'nas', name: 'NAS', runtime_type: 'nas', tool_patterns: ['nas.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'web', name: 'Web Fetch', runtime_type: 'web', tool_patterns: ['web.%', 'search.web'], required_settings: ['webFetch.firecrawlEnabled', 'webFetch.firecrawlApiUrl'], configuration_mode: 'hybrid', table_name: 'allowlists' },
  { id: 'frigate', name: 'Frigate', runtime_type: 'frigate', tool_patterns: ['frigate.%'], required_settings: ['frigate.base_url', 'frigate.token_ref'], configuration_mode: 'settings' },
  { id: 'spotify', name: 'Spotify', runtime_type: 'spotify', tool_patterns: ['spotify.%'], required_settings: ['spotify.client_id', 'spotify.client_secret_ref'], configuration_mode: 'settings' },
  { id: 'sonos', name: 'Sonos', runtime_type: 'sonos', tool_patterns: ['sonos.%'], required_settings: ['sonos.access_token_ref'], configuration_mode: 'settings' },
  { id: 'shazam', name: 'Shazam', runtime_type: 'shazam', tool_patterns: ['shazam.%'], required_settings: ['shazam.api_token_ref'], configuration_mode: 'settings' },
  { id: 'obsidian', name: 'Obsidian', runtime_type: 'obsidian', tool_patterns: ['obsidian.%'], required_settings: ['obsidian.vault_path'], configuration_mode: 'settings' },
  { id: 'notion', name: 'Notion', runtime_type: 'notion', tool_patterns: ['notion.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'apple-notes', name: 'Apple Notes', runtime_type: 'apple-notes', tool_patterns: ['apple.notes.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'apple-reminders', name: 'Apple Reminders', runtime_type: 'apple-reminders', tool_patterns: ['apple.reminders.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'things3', name: 'Things3', runtime_type: 'things3', tool_patterns: ['things3.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'bear', name: 'Bear', runtime_type: 'bear', tool_patterns: ['bear.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'trello', name: 'Trello', runtime_type: 'trello', tool_patterns: ['trello.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'x', name: 'X/Twitter', runtime_type: 'x', tool_patterns: ['x.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'onepassword', name: '1Password', runtime_type: 'onepassword', tool_patterns: ['onepassword.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'weather', name: 'Weather', runtime_type: 'weather', tool_patterns: ['weather.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'gif', name: 'GIF Search', runtime_type: 'gif', tool_patterns: ['gif.%'], required_settings: [], configuration_mode: 'none' },
  { id: 'device', name: 'Device Ecosystem (Peekaboo/Mirror)', runtime_type: 'device', tool_patterns: ['device.%'], required_settings: [], configuration_mode: 'table', table_name: 'devices' },
];

const INTEGRATION_LIBRARY_PROFILES: IntegrationLibraryProfile[] = [
  {
    id: 'recommended-local',
    name: 'Recommended Local Starter',
    description: 'Local-first integrations for quick bring-up with minimal external credentials.',
    integration_ids: ['obsidian', 'device', 'web', 'nas', 'ha'],
  },
  {
    id: 'full-ecosystem',
    name: 'Full Ecosystem',
    description: 'Installs/deploys all code-linked integrations supported by this build.',
    integration_ids: INTEGRATIONS.map((item) => item.id),
  },
];

function parseSettingText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'string') return parsed.trim();
      if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
      return value.trim();
    } catch {
      return value.trim();
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

type SettingSource = 'organization_settings' | 'missing';
type SettingReadiness = {
  key: string;
  configured: boolean;
  value_present: boolean;
  source: SettingSource;
};

async function loadOrganizationSettings(
  pool: pg.Pool,
  orgId: string,
  keys: string[],
): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  if (!keys.length) return map;
  const res = await pool.query(
    `SELECT key, value
       FROM organization_settings
      WHERE organization_id = $1
        AND key = ANY($2::text[])`,
    [orgId, keys],
  );
  for (const row of res.rows) {
    map.set(String(row.key), row.value);
  }
  return map;
}

function buildSettingReadiness(keys: string[], settingsMap: Map<string, unknown>): SettingReadiness[] {
  return keys.map((key) => {
    const source: SettingSource = settingsMap.has(key) ? 'organization_settings' : 'missing';
    const raw = settingsMap.get(key);
    const value = parseSettingText(raw);
    return {
      key,
      configured: source === 'organization_settings' && value.length > 0,
      value_present: value.length > 0,
      source,
    };
  });
}

async function getOrgIdForRequest(request: any): Promise<string | null> {
  return request.orgId ? String(request.orgId) : null;
}

function normalizeIntegrationId(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

function toSignedInt32(value: number): number {
  const normalized = value >>> 0;
  return normalized > 0x7fffffff ? normalized - 0x100000000 : normalized;
}

function derivePlaybookLockKeys(orgId: string): [number, number] | null {
  const cleaned = String(orgId || '').trim().toLowerCase().replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(cleaned)) return null;
  const partA = Number.parseInt(cleaned.slice(0, 8), 16);
  const partB = Number.parseInt(cleaned.slice(8, 16), 16);
  if (!Number.isFinite(partA) || !Number.isFinite(partB)) return null;
  return [toSignedInt32(partA ^ PLAYBOOK_LOCK_NAMESPACE), toSignedInt32(partB)];
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

function tenantSafeRuntimeError(raw: unknown, fallback: string): string {
  const value = String(raw || '').trim();
  if (!value) return fallback;
  if (value.startsWith('RUNTIME_CMD_TIMEOUT')) return 'Runtime command timed out';
  if (value.startsWith('No runtime command configured')) return 'Runtime hook is not configured';
  if (value.startsWith('Runtime command template')) return 'Runtime hook configuration is invalid';
  if (value.startsWith('Command exited with code')) return fallback;
  return fallback;
}

class IntegrationTableReadinessError extends Error {
  readonly code = 'INTEGRATION_TABLE_READINESS_QUERY_FAILED';
  readonly tableName: string;

  constructor(tableName: string, message: string) {
    super(message);
    this.name = 'IntegrationTableReadinessError';
    this.tableName = tableName;
  }
}

function isIntegrationTableReadinessError(error: unknown): error is IntegrationTableReadinessError {
  return error instanceof IntegrationTableReadinessError;
}

function escapeCsv(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function deriveStoragePath(orgId: string, integrationType: string): string {
  const root = String(process.env.SVEN_INTEGRATION_STORAGE_ROOT || '/var/lib/sven/integrations')
    .replace(/[\\]+/g, '/')
    .replace(/\/+$/, '');
  const resolved = require('path').resolve(root, orgId, integrationType);
  if (!resolved.startsWith(root + '/')) {
    throw new Error('Storage path traversal detected');
  }
  return resolved;
}

function deriveNetworkScope(orgId: string): string {
  const digest = createHash('sha256').update(String(orgId || '').trim().toLowerCase()).digest('hex').slice(0, 24);
  return `sven-org-${digest || 'default'}`;
}

const integrationTableOrgScopeCache = new WeakMap<pg.Pool, Map<string, Promise<boolean>>>();

async function integrationTableHasOrganizationId(pool: pg.Pool, tableName: string): Promise<boolean> {
  let tableMap = integrationTableOrgScopeCache.get(pool);
  if (!tableMap) {
    tableMap = new Map<string, Promise<boolean>>();
    integrationTableOrgScopeCache.set(pool, tableMap);
  }
  let cached = tableMap.get(tableName);
  if (!cached) {
    cached = (async () => {
      const res = await pool.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'organization_id'
          LIMIT 1`,
        [tableName],
      );
      return res.rows.length > 0;
    })();
    tableMap.set(tableName, cached);
  }
  return cached;
}

function canExecuteRecoveryPlaybook(request: any): boolean {
  const tenantRole = String(request.tenantRole || '').trim().toLowerCase();
  return tenantRole === 'owner' || tenantRole === 'admin';
}

function findIntegrationById(integrationId: string): IntegrationCatalogItem | null {
  return INTEGRATIONS.find((item) => item.id === integrationId) || null;
}

function defaultSettingValue(key: string, orgId: string, integrationType: string): unknown {
  if (key === 'obsidian.vault_path') {
    return `${deriveStoragePath(orgId, integrationType)}/vault`;
  }
  if (key === 'webFetch.firecrawlEnabled') {
    return false;
  }
  if (key === 'webFetch.firecrawlApiUrl') {
    return 'http://localhost:3002';
  }
  if (key.endsWith('.base_url')) {
    return '';
  }
  if (key.endsWith('_ref') || key.endsWith('.token_ref') || key.endsWith('.api_token_ref')) {
    return '';
  }
  if (key.endsWith('.client_id')) {
    return '';
  }
  return '';
}

function buildTemplatePlan(item: IntegrationCatalogItem, orgId: string): IntegrationTemplatePlan {
  const settings: Record<string, unknown> = {};
  for (const key of item.required_settings) {
    settings[key] = defaultSettingValue(key, orgId, item.runtime_type);
  }

  let imageRef: string | undefined = `sven/integration-${item.runtime_type}:latest`;
  if (item.runtime_type === 'sonos' || item.runtime_type === 'shazam') {
    imageRef = 'sven/integration-sonos-shazam:latest';
  }
  if (item.runtime_type === 'device') {
    imageRef = 'sven/integration-mirror-peekaboo:latest';
  }

  return {
    settings,
    runtime: {
      mode: 'container',
      image_ref: imageRef,
      deployment_spec: {},
    },
  };
}

async function applyTemplateForIntegration(params: {
  pool: pg.Pool;
  orchestrator: IntegrationRuntimeOrchestrator;
  orgId: string;
  userId: string | null;
  item: IntegrationCatalogItem;
  body: ApplyTemplateBody;
}) {
  const { pool, orchestrator, orgId, userId, item, body } = params;

  const deployRuntimeParsed = parseOptionalBooleanOption(body.deploy_runtime, 'deploy_runtime');
  if (!deployRuntimeParsed.valid) {
    throw {
      statusCode: 400,
      error: { code: 'VALIDATION', message: deployRuntimeParsed.message },
    };
  }
  const overwriteExistingParsed = parseOptionalBooleanOption(
    body.overwrite_existing,
    'overwrite_existing',
  );
  if (!overwriteExistingParsed.valid) {
    throw {
      statusCode: 400,
      error: { code: 'VALIDATION', message: overwriteExistingParsed.message },
    };
  }

  const plan = buildTemplatePlan(item, orgId);
  const shouldDeploy = deployRuntimeParsed.value ?? true;
  const overwriteExisting = overwriteExistingParsed.value ?? false;
  const settingOverrides =
    body.setting_overrides && typeof body.setting_overrides === 'object' ? body.setting_overrides : {};
  const runtimeMode = body.runtime_mode === 'local_worker' ? 'local_worker' : plan.runtime.mode;
  const imageRefRaw = String(body.image_ref || plan.runtime.image_ref || '').trim() || null;
  if (imageRefRaw && !/^[a-zA-Z0-9][a-zA-Z0-9._\/-]{0,200}(:[a-zA-Z0-9._-]{1,128})?$/.test(imageRefRaw)) {
    throw { statusCode: 400, error: { code: 'VALIDATION', message: 'image_ref contains invalid characters' } };
  }
  const imageRef = imageRefRaw;
  let commandExecuted: boolean | null = null;
  let executionStatus: 'not_requested' | 'executed' | 'not_executed' = 'not_requested';

  let existingSettings = new Set<string>();
  if (item.required_settings.length > 0) {
    const existing = await pool.query(
      `SELECT key
         FROM organization_settings
         WHERE organization_id = $1
           AND key = ANY($2::text[])`,
      [orgId, item.required_settings],
    );
    existingSettings = new Set(existing.rows.map((row) => String(row.key)));
  }

  const settingEntries: Array<{ key: string; value: unknown }> = [];
  for (const key of item.required_settings) {
    if (!overwriteExisting && existingSettings.has(key)) continue;
    const value = Object.prototype.hasOwnProperty.call(settingOverrides, key)
      ? (settingOverrides as Record<string, unknown>)[key]
      : plan.settings[key];
    settingEntries.push({ key, value });
  }

  for (const entry of settingEntries) {
    await pool.query(
      `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, NOW(), $4)
         ON CONFLICT (organization_id, key)
         DO UPDATE SET value = $3::jsonb, updated_at = NOW(), updated_by = $4`,
      [orgId, entry.key, JSON.stringify(entry.value), userId],
    );
  }

  if (shouldDeploy) {
    const storagePath = deriveStoragePath(orgId, item.runtime_type);
    const networkScope = deriveNetworkScope(orgId);
    await pool.query(
      `INSERT INTO integration_runtime_instances
           (organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope,
            deployment_spec, last_error, last_deployed_at, updated_at)
         VALUES
           ($1, $2, $3, 'deploying', $4, $5, $6, $7::jsonb, NULL, NOW(), NOW())
         ON CONFLICT (organization_id, integration_type) DO UPDATE
         SET runtime_mode = $3,
             status = 'deploying',
             image_ref = $4,
             storage_path = $5,
             network_scope = $6,
             deployment_spec = $7::jsonb,
             last_error = NULL,
             last_deployed_at = NOW(),
             updated_at = NOW()`,
      [
        orgId,
        item.runtime_type,
        runtimeMode,
        imageRef,
        storagePath,
        networkScope,
        JSON.stringify(plan.runtime.deployment_spec || {}),
      ],
    );

    const orchestration = await orchestrator.execute({
      action: 'deploy',
      integrationType: item.runtime_type,
      organizationId: orgId,
      runtimeMode,
      imageRef,
      storagePath,
      networkScope,
    });

    if (!orchestration.ok) {
      const safeError = tenantSafeRuntimeError(orchestration.error, 'Runtime deploy failed');
      await pool.query(
        `UPDATE integration_runtime_instances
           SET status = 'error',
               last_error = $3,
               updated_at = NOW()
           WHERE organization_id = $1
             AND integration_type = $2`,
        [orgId, item.runtime_type, safeError],
      );
      const error: Record<string, unknown> = {
        statusCode: 500,
        error: {
          code: 'RUNTIME_DEPLOY_FAILED',
          message: safeError,
        },
        data: {
          integration_id: item.id,
          integration_type: item.runtime_type,
          applied_settings: settingEntries.map((row) => row.key),
          deploy_runtime: shouldDeploy,
          runtime_mode: runtimeMode,
          image_ref: imageRef,
          command_executed: orchestration.executed,
        },
      };
      throw error;
    }
    commandExecuted = orchestration.executed === true;
    executionStatus = commandExecuted ? 'executed' : 'not_executed';

    const runtimeStatus = commandExecuted ? 'running' : 'stopped';
    await pool.query(
      `UPDATE integration_runtime_instances
         SET status = $3,
             last_error = NULL,
             updated_at = NOW()
         WHERE organization_id = $1
           AND integration_type = $2`,
      [orgId, item.runtime_type, runtimeStatus],
    );
  }

  return {
    integration_id: item.id,
    integration_type: item.runtime_type,
    applied_settings: settingEntries.map((row) => row.key),
    deploy_runtime: shouldDeploy,
    runtime_mode: runtimeMode,
    image_ref: imageRef,
    command_executed: commandExecuted,
    execution_status: executionStatus,
  };
}

async function deployRuntimeForType(params: {
  pool: pg.Pool;
  orchestrator: IntegrationRuntimeOrchestrator;
  orgId: string;
  integrationType: string;
}): Promise<{
  integration_type: string;
  ok: boolean;
  status: 'running' | 'stopped' | 'error';
  runtime_mode: 'container' | 'local_worker';
  image_ref: string | null;
  command_executed: boolean;
  error?: string;
}> {
  const { pool, orchestrator, orgId, integrationType } = params;
  const existing = await pool.query(
    `SELECT runtime_mode, image_ref, deployment_spec
       FROM integration_runtime_instances
      WHERE organization_id = $1
        AND integration_type = $2
      LIMIT 1`,
    [orgId, integrationType],
  );
  const existingRow = existing.rows[0] || null;
  const runtimeMode = String(existingRow?.runtime_mode || 'container') === 'local_worker' ? 'local_worker' : 'container';
  const imageRef =
    String(existingRow?.image_ref || '').trim() || `sven/integration-${integrationType}:latest`;
  const deploymentSpec =
    existingRow?.deployment_spec && typeof existingRow.deployment_spec === 'object'
      ? existingRow.deployment_spec
      : {};
  const storagePath = deriveStoragePath(orgId, integrationType);
  const networkScope = deriveNetworkScope(orgId);

  await pool.query(
    `INSERT INTO integration_runtime_instances
       (organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope,
        deployment_spec, last_error, last_deployed_at, updated_at)
     VALUES
       ($1, $2, $3, 'deploying', $4, $5, $6, $7::jsonb, NULL, NOW(), NOW())
     ON CONFLICT (organization_id, integration_type) DO UPDATE
     SET runtime_mode = $3,
         status = 'deploying',
         image_ref = $4,
         storage_path = $5,
         network_scope = $6,
         deployment_spec = $7::jsonb,
         last_error = NULL,
         last_deployed_at = NOW(),
         updated_at = NOW()`,
    [orgId, integrationType, runtimeMode, imageRef, storagePath, networkScope, JSON.stringify(deploymentSpec)],
  );

  const orchestration = await orchestrator.execute({
    action: 'deploy',
    integrationType,
    organizationId: orgId,
    runtimeMode,
    imageRef,
    storagePath,
    networkScope,
  });

  if (!orchestration.ok) {
    const safeError = tenantSafeRuntimeError(orchestration.error, 'Runtime deploy failed');
    await pool.query(
      `UPDATE integration_runtime_instances
         SET status = 'error',
             last_error = $3,
             updated_at = NOW()
       WHERE organization_id = $1
         AND integration_type = $2`,
      [orgId, integrationType, safeError],
    );
    return {
      integration_type: integrationType,
      ok: false,
      status: 'error',
      runtime_mode: runtimeMode,
      image_ref: imageRef,
      command_executed: orchestration.executed,
      error: safeError,
    };
  }

  const runtimeStatus = orchestration.executed ? 'running' : 'stopped';
  await pool.query(
    `UPDATE integration_runtime_instances
       SET status = $3,
           last_error = NULL,
           updated_at = NOW()
     WHERE organization_id = $1
       AND integration_type = $2`,
    [orgId, integrationType, runtimeStatus],
  );
  return {
    integration_type: integrationType,
    ok: true,
    status: runtimeStatus,
    runtime_mode: runtimeMode,
    image_ref: imageRef,
    command_executed: orchestration.executed,
  };
}

async function safeTableCount(pool: pg.Pool, tableName: string, orgId: string): Promise<number> {
  try {
    let sql = '';
    if (tableName === 'calendar_accounts') {
      sql = (await integrationTableHasOrganizationId(pool, tableName))
        ? `SELECT COUNT(*)::int AS total
             FROM calendar_accounts
            WHERE organization_id = $1`
        : `SELECT COUNT(*)::int AS total
             FROM calendar_accounts ca
            WHERE EXISTS (
                    SELECT 1
                      FROM organization_memberships om
                     WHERE om.organization_id = $1
                       AND om.user_id = ca.user_id
                       AND om.status = 'active'
                  )`;
    } else if (tableName === 'git_repos') {
      sql = (await integrationTableHasOrganizationId(pool, tableName))
        ? `SELECT COUNT(*)::int AS total
             FROM git_repos
            WHERE organization_id = $1`
        : `SELECT COUNT(*)::int AS total
             FROM git_repos gr
            WHERE EXISTS (
                    SELECT 1
                      FROM organization_memberships om
                     WHERE om.organization_id = $1
                       AND om.user_id = gr.user_id
                       AND om.status = 'active'
                  )`;
    } else if (tableName === 'allowlists') {
      sql = `SELECT COUNT(*)::int AS total
               FROM allowlists
              WHERE organization_id = $1 AND type = 'web_domain'`;
    } else if (tableName === 'devices') {
      sql = `SELECT COUNT(*)::int AS total
               FROM devices
              WHERE organization_id = $1`;
    } else {
      throw new IntegrationTableReadinessError(tableName, `No table readiness query configured for ${tableName}`);
    }
    const res = await pool.query(sql, [orgId]);
    return Number(res.rows[0]?.total || 0);
  } catch (error) {
    throw new IntegrationTableReadinessError(
      tableName,
      `Failed readiness query for ${tableName}: ${asErrorMessage(error)}`,
    );
  }
}

export async function registerIntegrationsCatalogRoutes(app: FastifyInstance, pool: pg.Pool) {
  const orchestrator = new IntegrationRuntimeOrchestrator();

  app.get('/integrations/catalog', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    try {
      const allSettingKeys = Array.from(new Set(INTEGRATIONS.flatMap((item) => item.required_settings)));
      const settingsMap = await loadOrganizationSettings(pool, orgId, allSettingKeys);

      const toolsRes = await pool.query(`SELECT name FROM tools`);
      const toolNames = toolsRes.rows.map((row) => String(row.name || ''));

      const runtimeRes = await pool.query(
        `SELECT integration_type, status, runtime_mode, updated_at
         FROM integration_runtime_instances
         WHERE organization_id = $1`,
        [orgId],
      );
      const runtimeMap = new Map<string, { status: string; runtime_mode: string; updated_at: string }>();
      for (const row of runtimeRes.rows) {
        runtimeMap.set(String(row.integration_type || ''), {
          status: String(row.status || 'stopped'),
          runtime_mode: String(row.runtime_mode || 'container'),
          updated_at: String(row.updated_at || ''),
        });
      }

      const rows = [];
      for (const item of INTEGRATIONS) {
        const availableTools = toolNames.filter((tool) =>
          item.tool_patterns.some((pattern) => {
            if (pattern.endsWith('%')) {
              return tool.startsWith(pattern.slice(0, -1));
            }
            return tool === pattern;
          }),
        );
        const settingReadiness = buildSettingReadiness(item.required_settings, settingsMap);
        const tableCount = item.table_name ? await safeTableCount(pool, item.table_name, orgId) : 0;
        const runtime = runtimeMap.get(item.runtime_type);
        const configured =
          (item.required_settings.length > 0 ? settingReadiness.every((x) => x.configured) : true) &&
          (item.configuration_mode === 'table' ? tableCount > 0 : true);
        const linked = availableTools.length > 0;

        rows.push({
          id: item.id,
          name: item.name,
          runtime_type: item.runtime_type,
          configuration_mode: item.configuration_mode,
          linked,
          configured,
          available_tools_count: availableTools.length,
          available_tools: availableTools,
          required_settings: settingReadiness,
          table_name: item.table_name || null,
          table_count: tableCount,
          runtime_status: runtime?.status || 'stopped',
          runtime_mode: runtime?.runtime_mode || 'container',
          runtime_updated_at: runtime?.updated_at || null,
          runtime_hooks: orchestrator.getHookReadiness(item.runtime_type),
        });
      }

      return reply.send({ success: true, data: rows });
    } catch (error) {
      if (isIntegrationTableReadinessError(error)) {
        const readinessError = error;
        return reply.status(503).send({
          success: false,
          error: {
            code: readinessError.code,
            message: 'Integration table readiness query failed',
          },
          data: {
            table_name: readinessError.tableName,
            readiness_error_detail: 'Table readiness query failed',
          },
        });
      }
      throw error;
    }
  });

  app.post('/integrations/catalog/:integrationId/apply-template', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const { integrationId } = request.params as { integrationId: string };
    const id = normalizeIntegrationId(integrationId);
    const item = findIntegrationById(id);
    if (!item) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } });
    }

    const body = (request.body || {}) as ApplyTemplateBody;
    const userId = String((request as any).userId || '') || null;

    try {
      const data = await applyTemplateForIntegration({
        pool,
        orchestrator,
        orgId,
        userId,
        item,
        body,
      });
      return reply.send({ success: true, data });
    } catch (error) {
      const asObj =
        error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
      return reply.status(Number(asObj.statusCode || 500)).send({
        success: false,
        error: (asObj.error as Record<string, unknown>) || {
          code: 'APPLY_TEMPLATE_FAILED',
          message: 'Failed to apply integration template',
        },
        data: asObj.data && typeof asObj.data === 'object'
          ? sanitizeRuntimeResultForTenant(asObj.data as Record<string, unknown>)
          : null,
      });
    }
  });

  app.get('/integrations/catalog/library', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const availableIds = new Set(INTEGRATIONS.map((item) => item.id));
    const profiles = INTEGRATION_LIBRARY_PROFILES.map((profile) => ({
      ...profile,
      integration_ids: profile.integration_ids.filter((id) => availableIds.has(id)),
    }));
    return reply.send({ success: true, data: profiles });
  });

  app.post('/integrations/catalog/library/:profileId/install', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { profileId } = request.params as { profileId: string };
    const body = (request.body || {}) as ApplyTemplateBody & { integration_ids?: string[] };
    const userId = String((request as any).userId || '') || null;

    const profile = INTEGRATION_LIBRARY_PROFILES.find((entry) => entry.id === String(profileId || '').trim());
    if (!profile) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Library profile not found' } });
    }

    const overrideIds = Array.isArray(body.integration_ids)
      ? body.integration_ids.map((id) => normalizeIntegrationId(id))
      : [];
    if (overrideIds.length > 0) {
      const unknownOverrideIds = Array.from(
        new Set(overrideIds.filter((id) => !findIntegrationById(id))),
      );
      if (unknownOverrideIds.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: `Unknown integration_ids: ${unknownOverrideIds.join(', ')}`,
          },
          data: {
            requested: overrideIds.length,
            unknown_integration_ids: unknownOverrideIds,
          },
        });
      }
    }
    const installIds = overrideIds.length > 0 ? overrideIds : profile.integration_ids;
    const items = installIds
      .map((id) => findIntegrationById(id))
      .filter((item): item is IntegrationCatalogItem => Boolean(item));

    const results: Array<{ integration_id: string; ok: boolean; data?: Record<string, unknown>; error?: Record<string, unknown> }> = [];
    for (const item of items) {
      try {
        const data = await applyTemplateForIntegration({
          pool,
          orchestrator,
          orgId,
          userId,
          item,
          body,
        });
        results.push({ integration_id: item.id, ok: true, data });
      } catch (error) {
        const asObj = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
        results.push({
          integration_id: item.id,
          ok: false,
          error: {
            ...(asObj.error && typeof asObj.error === 'object' ? (asObj.error as Record<string, unknown>) : {}),
            statusCode: Number(asObj.statusCode || 500),
          },
        });
      }
    }

    const succeeded = results.filter((row) => row.ok).length;
    const failed = results.length - succeeded;
    const nonExecutedRuntimeDeploys = results.filter((row) => {
      if (!row.ok || !row.data || typeof row.data !== 'object') return false;
      const deployRuntime = (row.data as { deploy_runtime?: unknown }).deploy_runtime === true;
      const commandExecuted = (row.data as { command_executed?: unknown }).command_executed === true;
      return deployRuntime && !commandExecuted;
    }).length;
    const requireRuntimeExecution = String(
      process.env.SVEN_INTEGRATION_LIBRARY_REQUIRE_RUNTIME_EXECUTION || '',
    ).trim().toLowerCase() === 'true';
    const executionGuardTriggered = requireRuntimeExecution && nonExecutedRuntimeDeploys > 0;
    return reply.send({
      success: failed === 0 && !executionGuardTriggered,
      data: {
        profile_id: profile.id,
        profile_name: profile.name,
        requested: installIds.length,
        attempted: results.length,
        succeeded,
        failed,
        runtime_non_executed_deploys: nonExecutedRuntimeDeploys,
        require_runtime_execution: requireRuntimeExecution,
        execution_guard_triggered: executionGuardTriggered,
        results,
      },
    });
  });

  app.get('/integrations/catalog/:integrationId/validate', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const { integrationId } = request.params as { integrationId: string };
    const id = normalizeIntegrationId(integrationId);
    const item = findIntegrationById(id);
    if (!item) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } });
    }

    try {
    const toolsRes = await pool.query(`SELECT name FROM tools`);
    const toolNames = toolsRes.rows.map((row) => String(row.name || ''));
    const availableTools = toolNames.filter((tool) =>
      item.tool_patterns.some((pattern) => {
        if (pattern.endsWith('%')) return tool.startsWith(pattern.slice(0, -1));
        return tool === pattern;
      }),
    );

    const requiredKeys = item.required_settings;
    const settingMap = await loadOrganizationSettings(pool, orgId, requiredKeys);
    const settingStatus = buildSettingReadiness(requiredKeys, settingMap);

    const tableCount = item.table_name ? await safeTableCount(pool, item.table_name, orgId) : 0;
    const runtime = await pool.query(
      `SELECT status, runtime_mode, image_ref, updated_at
       FROM integration_runtime_instances
       WHERE organization_id = $1
         AND integration_type = $2
       LIMIT 1`,
      [orgId, item.runtime_type],
    );
    const runtimeRow = runtime.rows[0] || null;

    const checks = [
      {
        id: 'tools-linked',
        label: 'Tools linked',
        pass: availableTools.length > 0,
        detail: availableTools.length > 0 ? `${availableTools.length} tool(s) linked` : 'No linked tools found',
      },
      {
        id: 'settings',
        label: 'Required settings',
        pass: settingStatus.every((x) => x.configured),
        detail:
          settingStatus.length > 0
            ? `${settingStatus.filter((x) => x.configured).length}/${settingStatus.length} configured`
            : 'No required settings',
      },
      {
        id: 'table-data',
        label: 'Configuration records',
        pass: item.table_name ? tableCount > 0 : true,
        detail: item.table_name ? `${item.table_name}: ${tableCount}` : 'No table configuration required',
      },
      {
        id: 'runtime',
        label: 'Runtime status',
        pass: runtimeRow ? String(runtimeRow.status || '') === 'running' : false,
        detail: runtimeRow
          ? `${String(runtimeRow.status || 'unknown')} (${String(runtimeRow.runtime_mode || 'container')})`
          : 'Runtime instance not deployed',
      },
      {
        id: 'runtime-hooks',
        label: 'Runtime hook wiring',
        pass: (() => {
          const hooks = orchestrator.getHookReadiness(item.runtime_type);
          if (!hooks.executionEnabled) return true;
          return hooks.deployConfigured && hooks.stopConfigured && hooks.statusConfigured;
        })(),
        detail: (() => {
          const hooks = orchestrator.getHookReadiness(item.runtime_type);
          if (!hooks.executionEnabled) return 'Execution disabled (DB-only mode)';
          return `deploy=${hooks.deployConfigured}, stop=${hooks.stopConfigured}, status=${hooks.statusConfigured}`;
        })(),
      },
    ];

    return reply.send({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        runtime_type: item.runtime_type,
        checks,
        linked_tools: availableTools,
        required_settings: settingStatus,
        table_name: item.table_name || null,
        table_count: tableCount,
        runtime: runtimeRow,
      },
    });
    } catch (error) {
      if (isIntegrationTableReadinessError(error)) {
        const readinessError = error;
        return reply.status(503).send({
          success: false,
          error: {
            code: readinessError.code,
            message: 'Integration table readiness query failed',
          },
          data: {
            table_name: readinessError.tableName,
            readiness_error_detail: 'Table readiness query failed',
          },
        });
      }
      throw error;
    }
  });

  app.post('/integrations/catalog/recovery-playbook', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    if (!canExecuteRecoveryPlaybook(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Recovery playbook execution requires tenant owner or admin role' },
      });
    }
    const userId = String((request as any).userId || '') || null;
    const body = (request.body || {}) as RecoveryPlaybookBody;
    const retryFailedParsed = parseOptionalBooleanOption(body.retry_failed, 'retry_failed');
    if (!retryFailedParsed.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: retryFailedParsed.message },
      });
    }
    const deployStoppedParsed = parseOptionalBooleanOption(body.deploy_stopped, 'deploy_stopped');
    if (!deployStoppedParsed.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: deployStoppedParsed.message },
      });
    }
    const applyTemplatesParsed = parseOptionalBooleanOption(
      body.apply_templates_unconfigured,
      'apply_templates_unconfigured',
    );
    if (!applyTemplatesParsed.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: applyTemplatesParsed.message },
      });
    }
    const validateUnconfiguredParsed = parseOptionalBooleanOption(
      body.validate_unconfigured,
      'validate_unconfigured',
    );
    if (!validateUnconfiguredParsed.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: validateUnconfiguredParsed.message },
      });
    }
    const overwriteExistingParsed = parseOptionalBooleanOption(
      body.overwrite_existing,
      'overwrite_existing',
    );
    if (!overwriteExistingParsed.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: overwriteExistingParsed.message },
      });
    }
    const retryFailed = retryFailedParsed.value ?? true;
    const deployStopped = deployStoppedParsed.value ?? true;
    const applyTemplatesUnconfigured = applyTemplatesParsed.value ?? true;
    const validateUnconfigured = validateUnconfiguredParsed.value ?? true;
    const overwriteExisting = overwriteExistingParsed.value ?? false;
    const bootEventLimit = Number.isFinite(Number(body.boot_event_limit))
      ? Math.min(200, Math.max(10, Math.trunc(Number(body.boot_event_limit))))
      : 100;
    const lockKeys = derivePlaybookLockKeys(orgId);
    if (!lockKeys) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Invalid organization lock identity' },
      });
    }
    let lockAcquired = false;
    let lockClient: pg.PoolClient | null = null;
    const runId = newRunId();
    const runStartedAt = new Date().toISOString();

    try {
      lockClient = await pool.connect();
      const lock = await lockClient.query(
        `SELECT pg_try_advisory_lock($1, $2) AS acquired`,
        lockKeys,
      );
      lockAcquired = Boolean(lock.rows[0]?.acquired);
      if (!lockAcquired) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'PLAYBOOK_IN_PROGRESS',
            message: 'Recovery playbook is already running for this account',
          },
        });
      }

      const requestedOptions = {
        retry_failed: retryFailed,
        deploy_stopped: deployStopped,
        apply_templates_unconfigured: applyTemplatesUnconfigured,
        validate_unconfigured: validateUnconfigured,
        overwrite_existing: overwriteExisting,
      };
      try {
        await pool.query(
          `INSERT INTO integration_recovery_playbook_runs
             (id, organization_id, actor_user_id, requested_options, target_snapshot, summary, result, created_at)
           VALUES
             ($1, $2, $3, $4::jsonb, $5::jsonb, '{}'::jsonb, '{}'::jsonb, NOW())`,
          [
            runId,
            orgId,
            userId,
            JSON.stringify(requestedOptions),
            JSON.stringify({
              _run: {
                status: 'in_progress',
                started_at: runStartedAt,
              },
            }),
          ],
        );
      } catch (persistError) {
        return reply.status(503).send({
          success: false,
          error: { code: 'PLAYBOOK_AUDIT_PERSIST_FAILED', message: 'Recovery playbook audit insert failed' },
          data: { run_id: runId, durable_audit: false, reason: asErrorMessage(persistError) },
        });
      }

      const allSettingKeys = Array.from(new Set(INTEGRATIONS.flatMap((item) => item.required_settings)));
      const settingsMap = await loadOrganizationSettings(pool, orgId, allSettingKeys);

      const unconfiguredIds: string[] = [];
      for (const item of INTEGRATIONS) {
        const settingReadiness = buildSettingReadiness(item.required_settings, settingsMap).map((row) => row.configured);
        const tableCount = item.table_name ? await safeTableCount(pool, item.table_name, orgId) : 0;
        const configured =
          (item.required_settings.length > 0 ? settingReadiness.every((x) => x) : true) &&
          (item.configuration_mode === 'table' ? tableCount > 0 : true);
        if (!configured) unconfiguredIds.push(item.id);
      }
      const unconfiguredSet = new Set(unconfiguredIds);

      const failedRuntimeRows = await pool.query(
        `SELECT DISTINCT LOWER(REPLACE(COALESCE(b.content->'content'->>'tool_name', ''), 'integration.runtime.', '')) AS integration_type
           FROM messages m
           JOIN chats c
             ON c.id = m.chat_id
           CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.blocks, '[]'::jsonb)) AS b(content)
          WHERE c.organization_id = $1
            AND m.role = 'assistant'
            AND b.content->>'type' = 'tool_card'
            AND LOWER(COALESCE(b.content->'content'->>'status', '')) = 'error'
            AND (b.content->'content'->>'tool_name') LIKE 'integration.runtime.%'
          ORDER BY integration_type ASC
          LIMIT $2`,
        [orgId, bootEventLimit],
      );
      const failedRuntimeTypes = failedRuntimeRows.rows
        .map((row) => normalizeIntegrationId(row.integration_type))
        .filter((x) => x.length > 0);

      const stoppedRows = await pool.query(
        `SELECT integration_type
           FROM integration_runtime_instances
          WHERE organization_id = $1
            AND status = 'stopped'
          ORDER BY integration_type ASC`,
        [orgId],
      );
      const stoppedRuntimeTypes = stoppedRows.rows
        .map((row) => normalizeIntegrationId(row.integration_type))
        .filter((x) => x.length > 0);

      const retryFailedResults: Array<Record<string, unknown>> = [];
      if (retryFailed) {
        for (const runtimeType of failedRuntimeTypes) {
          const result = await deployRuntimeForType({
            pool,
            orchestrator,
            orgId,
            integrationType: runtimeType,
          });
          retryFailedResults.push(result);
        }
      }

      const deployStoppedResults: Array<Record<string, unknown>> = [];
      if (deployStopped) {
        for (const runtimeType of stoppedRuntimeTypes) {
          const result = await deployRuntimeForType({
            pool,
            orchestrator,
            orgId,
            integrationType: runtimeType,
          });
          deployStoppedResults.push(result);
        }
      }

      const templateResults: Array<Record<string, unknown>> = [];
      if (applyTemplatesUnconfigured) {
        for (const integrationId of unconfiguredIds) {
          const item = findIntegrationById(integrationId);
          if (!item) continue;
          try {
            const data = await applyTemplateForIntegration({
              pool,
              orchestrator,
              orgId,
              userId,
              item,
              body: {
                deploy_runtime: true,
                overwrite_existing: overwriteExisting,
              },
            });
            templateResults.push({ integration_id: integrationId, ok: true, data });
          } catch (error) {
            const asObj = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
            templateResults.push({
              integration_id: integrationId,
              ok: false,
              error: {
                ...(asObj.error && typeof asObj.error === 'object' ? (asObj.error as Record<string, unknown>) : {}),
                statusCode: Number(asObj.statusCode || 500),
              },
            });
          }
        }
      }

      const validationResults: Array<Record<string, unknown>> = [];
      const validationToolNames = validateUnconfigured
        ? (await pool.query(`SELECT name FROM tools`)).rows.map((row) => String(row.name || ''))
        : [];
      if (validateUnconfigured) {
        for (const integrationId of unconfiguredIds) {
          const item = findIntegrationById(integrationId);
          if (!item) continue;

          const availableTools = validationToolNames.filter((tool) =>
            item.tool_patterns.some((pattern) => {
              if (pattern.endsWith('%')) return tool.startsWith(pattern.slice(0, -1));
              return tool === pattern;
            }),
          );

          const requiredKeys = item.required_settings;
          const settingMap = await loadOrganizationSettings(pool, orgId, requiredKeys);
          const settingStatus = buildSettingReadiness(requiredKeys, settingMap);

          const tableCount = item.table_name ? await safeTableCount(pool, item.table_name, orgId) : 0;
          const runtime = await pool.query(
            `SELECT status, runtime_mode, image_ref, updated_at
             FROM integration_runtime_instances
             WHERE organization_id = $1
               AND integration_type = $2
             LIMIT 1`,
            [orgId, item.runtime_type],
          );
          const runtimeRow = runtime.rows[0] || null;
          const checks = [
            {
              id: 'tools-linked',
              pass: availableTools.length > 0,
            },
            {
              id: 'settings',
              pass: settingStatus.every((x) => x.configured),
            },
            {
              id: 'table-data',
              pass: item.table_name ? tableCount > 0 : true,
            },
            {
              id: 'runtime',
              pass: runtimeRow ? String(runtimeRow.status || '') === 'running' : false,
            },
            {
              id: 'runtime-hooks',
              pass: (() => {
                const hooks = orchestrator.getHookReadiness(item.runtime_type);
                if (!hooks.executionEnabled) return true;
                return hooks.deployConfigured && hooks.stopConfigured && hooks.statusConfigured;
              })(),
            },
          ];
          validationResults.push({
            integration_id: integrationId,
            ok: checks.every((check) => Boolean(check.pass)),
            checks,
          });
        }
      }

      const countOk = (rows: Array<Record<string, unknown>>) => rows.filter((row) => Boolean(row.ok)).length;
      const summary = {
        retry_failed: {
          enabled: retryFailed,
          attempted: retryFailed ? failedRuntimeTypes.length : 0,
          succeeded: countOk(retryFailedResults),
          failed: retryFailedResults.length - countOk(retryFailedResults),
        },
        deploy_stopped: {
          enabled: deployStopped,
          attempted: deployStopped ? stoppedRuntimeTypes.length : 0,
          succeeded: countOk(deployStoppedResults),
          failed: deployStoppedResults.length - countOk(deployStoppedResults),
        },
        apply_templates_unconfigured: {
          enabled: applyTemplatesUnconfigured,
          attempted: applyTemplatesUnconfigured ? unconfiguredIds.length : 0,
          succeeded: countOk(templateResults),
          failed: templateResults.length - countOk(templateResults),
        },
        validate_unconfigured: {
          enabled: validateUnconfigured,
          attempted: validateUnconfigured ? unconfiguredIds.length : 0,
          succeeded: countOk(validationResults),
          failed: validationResults.length - countOk(validationResults),
        },
      };

      const runPayload = {
        options: requestedOptions,
        targets: {
          failed_runtime_types: failedRuntimeTypes,
          stopped_runtime_types: stoppedRuntimeTypes,
          unconfigured_integration_ids: unconfiguredIds,
          unconfigured_count: unconfiguredSet.size,
          _run: {
            status: 'completed',
            started_at: runStartedAt,
            finished_at: new Date().toISOString(),
          },
        },
        summary,
        result: {
          retry_failed_results: retryFailedResults.map((row) => sanitizeRuntimeResultForTenant(row)),
          deploy_stopped_results: deployStoppedResults.map((row) => sanitizeRuntimeResultForTenant(row)),
          template_results: templateResults,
          validation_results: validationResults,
        },
      };
      try {
        const persisted = await pool.query(
          `UPDATE integration_recovery_playbook_runs
              SET requested_options = $3::jsonb,
                  target_snapshot = $4::jsonb,
                  summary = $5::jsonb,
                  result = $6::jsonb
            WHERE id = $1
              AND organization_id = $2`,
          [
            runId,
            orgId,
            JSON.stringify(runPayload.options),
            JSON.stringify(runPayload.targets),
            JSON.stringify(runPayload.summary),
            JSON.stringify(runPayload.result),
          ],
        );
        if (typeof (persisted as { rowCount?: number } | null)?.rowCount === 'number' && (persisted as { rowCount: number }).rowCount < 1) {
          return reply.status(503).send({
            success: false,
            error: { code: 'PLAYBOOK_AUDIT_PERSIST_FAILED', message: 'Recovery playbook audit update missing run row' },
            data: { run_id: runId, durable_audit: false },
          });
        }
      } catch (persistError) {
        return reply.status(503).send({
          success: false,
          error: { code: 'PLAYBOOK_AUDIT_PERSIST_FAILED', message: 'Recovery playbook audit update failed' },
          data: { run_id: runId, durable_audit: false, reason: asErrorMessage(persistError) },
        });
      }

      return reply.send({
        success: true,
        data: {
          run_id: runId,
          organization_id: orgId,
          targets: {
            failed_runtime_types: failedRuntimeTypes,
            stopped_runtime_types: stoppedRuntimeTypes,
            unconfigured_integration_ids: unconfiguredIds,
            unconfigured_count: unconfiguredSet.size,
          },
          options: {
            retry_failed: retryFailed,
            deploy_stopped: deployStopped,
            apply_templates_unconfigured: applyTemplatesUnconfigured,
            validate_unconfigured: validateUnconfigured,
            overwrite_existing: overwriteExisting,
          },
          summary,
          retry_failed_results: retryFailedResults.map((row) => sanitizeRuntimeResultForTenant(row)),
          deploy_stopped_results: deployStoppedResults.map((row) => sanitizeRuntimeResultForTenant(row)),
          template_results: templateResults,
          validation_results: validationResults,
        },
      });
    } catch (error) {
      try {
        const persisted = await pool.query(
          `UPDATE integration_recovery_playbook_runs
              SET target_snapshot = $3::jsonb,
                  result = $4::jsonb
            WHERE id = $1
              AND organization_id = $2`,
          [
            runId,
            orgId,
            JSON.stringify({
              _run: {
                status: 'failed',
                started_at: runStartedAt,
                finished_at: new Date().toISOString(),
              },
            }),
            JSON.stringify({
              error: {
                message: asErrorMessage(error),
              },
            }),
          ],
        );
        if (typeof (persisted as { rowCount?: number } | null)?.rowCount === 'number' && (persisted as { rowCount: number }).rowCount < 1) {
          return reply.status(503).send({
            success: false,
            error: { code: 'PLAYBOOK_AUDIT_PERSIST_FAILED', message: 'Recovery playbook failure audit update missing run row' },
            data: { run_id: runId, durable_audit: false },
          });
        }
      } catch (persistError) {
        return reply.status(503).send({
          success: false,
          error: { code: 'PLAYBOOK_AUDIT_PERSIST_FAILED', message: 'Recovery playbook failure audit update failed' },
          data: { run_id: runId, durable_audit: false, reason: asErrorMessage(persistError) },
        });
      }
      if (isIntegrationTableReadinessError(error)) {
        const readinessError = error;
        return reply.status(503).send({
          success: false,
          error: {
            code: readinessError.code,
            message: 'Integration table readiness query failed',
          },
          data: {
            run_id: runId,
            table_name: readinessError.tableName,
            readiness_error_detail: 'Table readiness query failed',
          },
        });
      }
      return reply.status(500).send({
        success: false,
        error: { code: 'PLAYBOOK_FAILED', message: 'Recovery playbook failed' },
        data: { run_id: runId },
      });
    } finally {
      if (lockClient) {
        try {
          if (lockAcquired) {
            await lockClient.query(`SELECT pg_advisory_unlock($1, $2)`, lockKeys);
          }
        } finally {
          lockClient.release();
        }
      }
    }
  });

  app.get('/integrations/catalog/recovery-playbook/runs', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = (request.query || {}) as {
      limit?: string | number;
      page?: string | number;
      has_failures?: string;
      run_status?: string;
      actor_user_id?: string;
      from?: string;
      to?: string;
      sort?: string;
      order?: string;
      format?: string;
    };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.trunc(parsedLimit))) : 20;
    const parsedPage = Number(query.page);
    const page = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage)) : 1;
    const offset = (page - 1) * limit;
    const hasFailuresRaw = String(query.has_failures || '').trim().toLowerCase();
    const hasFailures =
      hasFailuresRaw === 'true' ? true : hasFailuresRaw === 'false' ? false : undefined;
    const runStatusRaw = String(query.run_status || '').trim().toLowerCase();
    const runStatus =
      runStatusRaw === 'in_progress' || runStatusRaw === 'completed' || runStatusRaw === 'failed'
        ? runStatusRaw
        : '';
    const actorUserId = String(query.actor_user_id || '').trim();
    const from = String(query.from || '').trim();
    const to = String(query.to || '').trim();
    const sortRaw = String(query.sort || 'created_at').trim().toLowerCase();
    const sort = sortRaw === 'created_at' ? 'created_at' : 'created_at';
    const orderRaw = String(query.order || 'desc').trim().toLowerCase();
    const order = orderRaw === 'asc' ? 'ASC' : 'DESC';
    const format = String(query.format || '').trim().toLowerCase();
    try {
      const conditions: string[] = ['organization_id = $1'];
      const params: Array<string | number> = [orgId];
      if (typeof hasFailures === 'boolean') {
        params.push(hasFailures ? 0 : 0);
        const idx = params.length;
        conditions.push(
          hasFailures
            ? `(COALESCE((summary->'retry_failed'->>'failed')::int, 0) + COALESCE((summary->'deploy_stopped'->>'failed')::int, 0) + COALESCE((summary->'apply_templates_unconfigured'->>'failed')::int, 0) + COALESCE((summary->'validate_unconfigured'->>'failed')::int, 0)) > $${idx}`
            : `(COALESCE((summary->'retry_failed'->>'failed')::int, 0) + COALESCE((summary->'deploy_stopped'->>'failed')::int, 0) + COALESCE((summary->'apply_templates_unconfigured'->>'failed')::int, 0) + COALESCE((summary->'validate_unconfigured'->>'failed')::int, 0)) = $${idx}`,
        );
      }
      if (runStatus) {
        params.push(runStatus);
        conditions.push(`COALESCE(target_snapshot->'_run'->>'status', 'completed') = $${params.length}`);
      }
      if (actorUserId) {
        params.push(actorUserId);
        conditions.push(`actor_user_id = $${params.length}`);
      }
      if (from) {
        params.push(from);
        conditions.push(`created_at >= $${params.length}::timestamptz`);
      }
      if (to) {
        params.push(to);
        conditions.push(`created_at <= $${params.length}::timestamptz`);
      }
      const whereSql = conditions.join('\n          AND ');
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
           FROM integration_recovery_playbook_runs
          WHERE ${whereSql}`,
        params,
      );
      const total = Number(countRes.rows[0]?.total || 0);
      const statusCountRes = await pool.query(
        `SELECT COALESCE(target_snapshot->'_run'->>'status', 'completed') AS run_status,
                COUNT(*)::int AS total
           FROM integration_recovery_playbook_runs
          WHERE ${whereSql}
          GROUP BY COALESCE(target_snapshot->'_run'->>'status', 'completed')`,
        params,
      );
      const statusCounts = {
        in_progress: 0,
        completed: 0,
        failed: 0,
      };
      for (const row of statusCountRes.rows) {
        const key = String(row.run_status || '').toLowerCase();
        const value = Number(row.total || 0);
        if (key === 'in_progress' || key === 'completed' || key === 'failed') {
          statusCounts[key] = value;
        }
      }
      params.push(limit);
      params.push(offset);
      const rows = await pool.query(
        `SELECT id, organization_id, actor_user_id, requested_options, target_snapshot, summary, created_at,
                COALESCE(target_snapshot->'_run'->>'status', 'completed') AS run_status
           FROM integration_recovery_playbook_runs
          WHERE ${whereSql}
          ORDER BY ${sort} ${order}
          LIMIT $${params.length - 1}
          OFFSET $${params.length}`,
        params,
      );
      if (format === 'csv') {
        const lines = [
          [
            'id',
            'created_at',
            'actor_user_id',
            'run_status',
            'retry_failed',
            'deploy_stopped',
            'apply_templates_unconfigured',
            'validate_unconfigured',
          ].join(','),
          ...rows.rows.map((row) => {
            const summary = row.summary && typeof row.summary === 'object' ? row.summary : {};
            const stage = (key: string) => {
              const node =
                summary && typeof summary === 'object' && (summary as Record<string, unknown>)[key]
                  ? ((summary as Record<string, unknown>)[key] as Record<string, unknown>)
                  : {};
              const attempted = Number(node.attempted || 0);
              const succeeded = Number(node.succeeded || 0);
              const failed = Number(node.failed || 0);
              return `${succeeded}/${attempted}${failed > 0 ? ` (failed ${failed})` : ''}`;
            };
            return [
              escapeCsv(row.id),
              escapeCsv(row.created_at),
              escapeCsv(row.actor_user_id || ''),
              escapeCsv(row.run_status || 'completed'),
              escapeCsv(stage('retry_failed')),
              escapeCsv(stage('deploy_stopped')),
              escapeCsv(stage('apply_templates_unconfigured')),
              escapeCsv(stage('validate_unconfigured')),
            ].join(',');
          }),
        ];
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="integration-recovery-playbook-runs.csv"');
        return reply.send(lines.join('\n'));
      }
      return reply.send({
        success: true,
        data: rows.rows,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.max(1, Math.ceil(total / limit)),
          sort,
          order: order.toLowerCase(),
          status_counts: statusCounts,
        },
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: { code: 'RECOVERY_RUNS_QUERY_FAILED', message: 'Failed to load recovery playbook runs' },
      });
    }
  });

  app.get('/integrations/catalog/recovery-playbook/runs/:runId', async (request, reply) => {
    const orgId = await getOrgIdForRequest(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { runId } = request.params as { runId: string };
    const id = String(runId || '').trim();
    if (!id) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'runId is required' } });
    }
    try {
      const row = await pool.query(
        `SELECT id, organization_id, actor_user_id, requested_options, target_snapshot, summary, result, created_at
           FROM integration_recovery_playbook_runs
          WHERE organization_id = $1
            AND id = $2
          LIMIT 1`,
        [orgId, id],
      );
      if (row.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Run not found' } });
      }
      return reply.send({ success: true, data: row.rows[0] });
    } catch {
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load run detail' } });
    }
  });
}
