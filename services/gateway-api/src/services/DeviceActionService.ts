import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.15 Device Action Service
 * Mobile actions / device control through Sven.
 * Navigate apps, complete tasks, automate workflows — powered by Gemma 4
 * native function calling capability.
 */

type ActionCategory = 'navigation' | 'automation' | 'device_control' | 'app_interaction' | 'system' | 'custom';
type ActionStatus = 'registered' | 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
type PlatformTarget = 'android' | 'ios' | 'desktop_macos' | 'desktop_windows' | 'desktop_linux' | 'any';

interface DeviceAction {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  category: ActionCategory;
  platform: PlatformTarget;
  function_schema: Record<string, unknown>;
  requires_confirmation: boolean;
  is_active: boolean;
  created_at: string;
}

interface ActionExecution {
  id: string;
  organization_id: string;
  user_id: string;
  action_id: string;
  action_name: string;
  device_id: string;
  status: ActionStatus;
  input_params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  execution_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

interface DeviceActionPolicy {
  id: string;
  organization_id: string;
  allow_device_control: boolean;
  allow_app_navigation: boolean;
  allow_system_actions: boolean;
  require_confirmation_all: boolean;
  max_actions_per_minute: number;
  blocked_actions: string[];
  created_at: string;
  updated_at: string;
}

/** Built-in device actions available on all platforms */
const BUILTIN_ACTIONS: Array<Omit<DeviceAction, 'id' | 'organization_id' | 'created_at'>> = [
  {
    name: 'open_app',
    description: 'Launch an application by name or package identifier',
    category: 'navigation',
    platform: 'any',
    function_schema: { type: 'object', properties: { app_name: { type: 'string' }, package_id: { type: 'string' } }, required: ['app_name'] },
    requires_confirmation: false,
    is_active: true,
  },
  {
    name: 'set_alarm',
    description: 'Set an alarm or timer on the device',
    category: 'device_control',
    platform: 'any',
    function_schema: { type: 'object', properties: { time: { type: 'string' }, label: { type: 'string' }, recurring: { type: 'boolean' } }, required: ['time'] },
    requires_confirmation: false,
    is_active: true,
  },
  {
    name: 'send_notification',
    description: 'Create a local notification on the device',
    category: 'system',
    platform: 'any',
    function_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high'] } }, required: ['title', 'body'] },
    requires_confirmation: false,
    is_active: true,
  },
  {
    name: 'toggle_setting',
    description: 'Toggle a device setting (wifi, bluetooth, do-not-disturb, etc.)',
    category: 'device_control',
    platform: 'any',
    function_schema: { type: 'object', properties: { setting: { type: 'string', enum: ['wifi', 'bluetooth', 'dnd', 'airplane', 'flashlight', 'dark_mode'] }, enabled: { type: 'boolean' } }, required: ['setting', 'enabled'] },
    requires_confirmation: true,
    is_active: true,
  },
  {
    name: 'take_screenshot',
    description: 'Capture a screenshot of the current screen',
    category: 'device_control',
    platform: 'any',
    function_schema: { type: 'object', properties: { save_to_gallery: { type: 'boolean' } } },
    requires_confirmation: false,
    is_active: true,
  },
  {
    name: 'navigate_to',
    description: 'Open a URL or deep link in the appropriate app',
    category: 'navigation',
    platform: 'any',
    function_schema: { type: 'object', properties: { url: { type: 'string' }, in_app: { type: 'boolean' } }, required: ['url'] },
    requires_confirmation: false,
    is_active: true,
  },
  {
    name: 'run_shortcut',
    description: 'Execute a user-defined automation shortcut or workflow',
    category: 'automation',
    platform: 'any',
    function_schema: { type: 'object', properties: { shortcut_name: { type: 'string' }, params: { type: 'object' } }, required: ['shortcut_name'] },
    requires_confirmation: true,
    is_active: true,
  },
  {
    name: 'clipboard_copy',
    description: 'Copy text to the device clipboard',
    category: 'system',
    platform: 'any',
    function_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    requires_confirmation: false,
    is_active: true,
  },
];

export class DeviceActionService {
  constructor(private pool: pg.Pool) {}

  /** Seed built-in actions for an org */
  async seedActions(organizationId: string): Promise<DeviceAction[]> {
    const seeded: DeviceAction[] = [];
    for (const action of BUILTIN_ACTIONS) {
      const id = uuidv7();
      await this.pool.query(
        `INSERT INTO device_actions (
          id, organization_id, name, description, category, platform,
          function_schema, requires_confirmation, is_active, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (organization_id, name) DO NOTHING`,
        [
          id, organizationId, action.name, action.description,
          action.category, action.platform, JSON.stringify(action.function_schema),
          action.requires_confirmation, action.is_active,
        ],
      );
      seeded.push({ id, organization_id: organizationId, ...action, created_at: new Date().toISOString() });
    }
    return seeded;
  }

  /** Register a custom action */
  async registerAction(organizationId: string, input: Partial<DeviceAction>): Promise<DeviceAction> {
    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO device_actions (
        id, organization_id, name, description, category, platform,
        function_schema, requires_confirmation, is_active, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      RETURNING *`,
      [
        id, organizationId, input.name, input.description || '',
        input.category || 'custom', input.platform || 'any',
        JSON.stringify(input.function_schema || {}),
        input.requires_confirmation || false, true,
      ],
    );
    return this.mapAction(result.rows[0]);
  }

  /** List registered actions */
  async listActions(
    organizationId: string,
    opts?: { category?: ActionCategory; platform?: PlatformTarget; activeOnly?: boolean },
  ): Promise<DeviceAction[]> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    if (opts?.category) { params.push(opts.category); conditions.push(`category = $${params.length}`); }
    if (opts?.platform) { params.push(opts.platform); conditions.push(`(platform = $${params.length} OR platform = 'any')`); }
    if (opts?.activeOnly !== false) { conditions.push('is_active = TRUE'); }

    const result = await this.pool.query(
      `SELECT * FROM device_actions WHERE ${conditions.join(' AND ')} ORDER BY category, name`,
      params,
    );
    return result.rows.map((r) => this.mapAction(r));
  }

  /** Toggle action active state */
  async toggleAction(organizationId: string, actionId: string, active: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE device_actions SET is_active = $3 WHERE id = $1 AND organization_id = $2`,
      [actionId, organizationId, active],
    );
  }

  /** Delete a custom action */
  async deleteAction(organizationId: string, actionId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM device_actions WHERE id = $1 AND organization_id = $2`,
      [actionId, organizationId],
    );
  }

  /** Execute an action (record the execution) */
  async executeAction(
    organizationId: string,
    userId: string,
    actionId: string,
    deviceId: string,
    inputParams: Record<string, unknown>,
  ): Promise<ActionExecution> {
    const action = await this.pool.query(
      `SELECT name FROM device_actions WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
      [actionId, organizationId],
    );
    const actionName = String(action.rows[0]?.name || 'unknown');

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO device_action_executions (
        id, organization_id, user_id, action_id, action_name, device_id,
        status, input_params, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,NOW())
      RETURNING *`,
      [id, organizationId, userId, actionId, actionName, deviceId, JSON.stringify(inputParams)],
    );
    return this.mapExecution(result.rows[0]);
  }

  /** Mark execution as completed */
  async completeExecution(
    executionId: string,
    resultData: Record<string, unknown>,
    executionMs: number,
  ): Promise<ActionExecution> {
    const result = await this.pool.query(
      `UPDATE device_action_executions
       SET status = 'completed', result = $2, execution_ms = $3, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [executionId, JSON.stringify(resultData), executionMs],
    );
    return this.mapExecution(result.rows[0]);
  }

  /** Mark execution as failed */
  async failExecution(executionId: string, errorMessage: string): Promise<ActionExecution> {
    const result = await this.pool.query(
      `UPDATE device_action_executions
       SET status = 'failed', error_message = $2, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [executionId, errorMessage],
    );
    return this.mapExecution(result.rows[0]);
  }

  /** List execution history */
  async listExecutions(
    organizationId: string,
    opts?: { actionId?: string; deviceId?: string; status?: ActionStatus; limit?: number; offset?: number },
  ): Promise<{ rows: ActionExecution[]; total: number }> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    if (opts?.actionId) { params.push(opts.actionId); conditions.push(`action_id = $${params.length}`); }
    if (opts?.deviceId) { params.push(opts.deviceId); conditions.push(`device_id = $${params.length}`); }
    if (opts?.status) { params.push(opts.status); conditions.push(`status = $${params.length}`); }

    const where = conditions.join(' AND ');
    const limit = Math.min(opts?.limit || 50, 200);
    const offset = opts?.offset || 0;

    const [rows, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM device_action_executions WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM device_action_executions WHERE ${where}`, params),
    ]);

    return {
      rows: rows.rows.map((r) => this.mapExecution(r)),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  /** Get or create device action policy */
  async getPolicy(organizationId: string): Promise<DeviceActionPolicy> {
    const result = await this.pool.query(
      `SELECT * FROM device_action_policies WHERE organization_id = $1`,
      [organizationId],
    );
    if (result.rows[0]) return this.mapPolicy(result.rows[0]);

    const id = uuidv7();
    const inserted = await this.pool.query(
      `INSERT INTO device_action_policies (
        id, organization_id, allow_device_control, allow_app_navigation,
        allow_system_actions, require_confirmation_all, max_actions_per_minute,
        blocked_actions, created_at, updated_at
      ) VALUES ($1,$2,TRUE,TRUE,TRUE,FALSE,30,'[]',NOW(),NOW())
      ON CONFLICT (organization_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [id, organizationId],
    );
    return this.mapPolicy(inserted.rows[0]);
  }

  /** Update device action policy */
  async updatePolicy(organizationId: string, updates: Partial<DeviceActionPolicy>): Promise<DeviceActionPolicy> {
    const fields: string[] = [];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (updates.allow_device_control !== undefined) { params.push(updates.allow_device_control); fields.push(`allow_device_control = $${idx++}`); }
    if (updates.allow_app_navigation !== undefined) { params.push(updates.allow_app_navigation); fields.push(`allow_app_navigation = $${idx++}`); }
    if (updates.allow_system_actions !== undefined) { params.push(updates.allow_system_actions); fields.push(`allow_system_actions = $${idx++}`); }
    if (updates.require_confirmation_all !== undefined) { params.push(updates.require_confirmation_all); fields.push(`require_confirmation_all = $${idx++}`); }
    if (updates.max_actions_per_minute !== undefined) { params.push(updates.max_actions_per_minute); fields.push(`max_actions_per_minute = $${idx++}`); }
    if (updates.blocked_actions !== undefined) { params.push(JSON.stringify(updates.blocked_actions)); fields.push(`blocked_actions = $${idx++}`); }

    if (fields.length === 0) return this.getPolicy(organizationId);

    fields.push('updated_at = NOW()');
    const result = await this.pool.query(
      `UPDATE device_action_policies SET ${fields.join(', ')} WHERE organization_id = $1 RETURNING *`,
      params,
    );
    return this.mapPolicy(result.rows[0]);
  }

  /** Get execution statistics */
  async getStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_executions,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(DISTINCT action_id)::int AS unique_actions_used,
        COUNT(DISTINCT device_id)::int AS unique_devices,
        COALESCE(AVG(execution_ms) FILTER (WHERE status = 'completed'), 0)::int AS avg_execution_ms
       FROM device_action_executions WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0] || {};
  }

  /** Get built-in actions list */
  static getBuiltinActions(): typeof BUILTIN_ACTIONS { return BUILTIN_ACTIONS; }

  private mapAction(r: Record<string, unknown>): DeviceAction {
    let schema: Record<string, unknown> = {};
    try {
      schema = typeof r.function_schema === 'string' ? JSON.parse(r.function_schema as string)
        : (r.function_schema && typeof r.function_schema === 'object' ? r.function_schema as Record<string, unknown> : {});
    } catch { schema = {}; }
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      name: String(r.name),
      description: String(r.description),
      category: r.category as ActionCategory,
      platform: r.platform as PlatformTarget,
      function_schema: schema,
      requires_confirmation: Boolean(r.requires_confirmation),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    };
  }

  private mapExecution(r: Record<string, unknown>): ActionExecution {
    let inputParams: Record<string, unknown> = {};
    let resultData: Record<string, unknown> | null = null;
    try {
      inputParams = typeof r.input_params === 'string' ? JSON.parse(r.input_params as string)
        : (r.input_params && typeof r.input_params === 'object' ? r.input_params as Record<string, unknown> : {});
    } catch { inputParams = {}; }
    try {
      if (r.result) {
        resultData = typeof r.result === 'string' ? JSON.parse(r.result as string)
          : (r.result && typeof r.result === 'object' ? r.result as Record<string, unknown> : null);
      }
    } catch { resultData = null; }
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      user_id: String(r.user_id),
      action_id: String(r.action_id),
      action_name: String(r.action_name),
      device_id: String(r.device_id),
      status: r.status as ActionStatus,
      input_params: inputParams,
      result: resultData,
      error_message: r.error_message ? String(r.error_message) : null,
      execution_ms: r.execution_ms != null ? Number(r.execution_ms) : null,
      created_at: String(r.created_at),
      completed_at: r.completed_at ? String(r.completed_at) : null,
    };
  }

  private mapPolicy(r: Record<string, unknown>): DeviceActionPolicy {
    let blocked: string[] = [];
    try {
      blocked = typeof r.blocked_actions === 'string' ? JSON.parse(r.blocked_actions as string)
        : (Array.isArray(r.blocked_actions) ? r.blocked_actions as string[] : []);
    } catch { blocked = []; }
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      allow_device_control: Boolean(r.allow_device_control),
      allow_app_navigation: Boolean(r.allow_app_navigation),
      allow_system_actions: Boolean(r.allow_system_actions),
      require_confirmation_all: Boolean(r.require_confirmation_all),
      max_actions_per_minute: Number(r.max_actions_per_minute || 30),
      blocked_actions: blocked,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}
