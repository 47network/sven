import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';

/**
 * Incident Response & Safety Service
 * Handles kill switch, lockdown mode, forensics mode, escalation rules
 */

interface IncidentMode {
  id: string;
  enabled: boolean;
  activatedBy: string;
  activatedAt: Date;
  reason?: string;
  severity?: string;
}

interface Incident {
  id: string;
  status: string;
  severity: string;
  title: string;
  description?: string;
  killSwitchEnabled?: boolean;
  lockdownEnabled?: boolean;
  forensicsEnabled?: boolean;
  detectedAt: Date;
  detectedBy?: string;
}

interface EscalationRule {
  id: string;
  name: string;
  enabled: boolean;
  approvalAgeMinutes?: number;
  approvalCountThreshold?: number;
  scopeFilter?: string;
  actionType: string;
  escalateToRole?: string;
  notifyChannels: string[];
  createIncident: boolean;
  runIntervalMinutes: number;
}

type SqlExecutor = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

function parseNotifyChannels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [];
}

const pool = getPool();
const ALLOWED_ESCALATION_ACTION_TYPES = new Set([
  'escalate_to_admin',
  'auto_deny',
  'notify',
  'create_incident',
]);
const ESCALATION_APPROVAL_AGE_MINUTES_MIN = 1;
const ESCALATION_APPROVAL_AGE_MINUTES_MAX = 10080;

async function disableIncidentModeRow(
  tableName: 'incident_kill_switch' | 'incident_lockdown' | 'incident_forensics',
  userId: string,
  actionType: string,
  actionDescription: string,
): Promise<{ success: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE ${tableName}
       SET enabled = false
       WHERE enabled = true
       RETURNING id`
    );
    if ((result.rowCount || 0) === 0) {
      const err = new Error('Incident mode is already disabled') as Error & { code?: string };
      err.code = 'INVALID_STATE';
      throw err;
    }
    await writeIncidentModeSetting(client, 'normal', userId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await logIncidentAction(actionType, actionDescription, userId, {});
  return { success: true };
}

async function writeIncidentModeSetting(
  executor: SqlExecutor,
  mode: 'normal' | 'kill_switch' | 'lockdown' | 'forensics',
  userId: string,
): Promise<void> {
  await executor.query(
    `INSERT INTO settings_global (key, value, updated_at, updated_by)
     VALUES ('incident.mode', $1, NOW(), $2)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
    [JSON.stringify(mode), userId],
  );
}

async function activateIncidentModeRow(
  tableName: 'incident_kill_switch' | 'incident_lockdown' | 'incident_forensics',
  mode: 'kill_switch' | 'lockdown' | 'forensics',
  userId: string,
  reason: string,
  severity: string
): Promise<any> {
  const client = await pool.connect();
  const id = nanoid();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tableName]);
    await client.query(`UPDATE ${tableName} SET enabled = false WHERE enabled = true`);
    const result = await client.query(
      `INSERT INTO ${tableName} (id, enabled, activated_by, reason, severity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, true, userId, reason, severity]
    );
    await writeIncidentModeSetting(client, mode, userId);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Activate kill switch (blocks all write operations)
 */
export async function activateKillSwitch(
  userId: string,
  reason: string,
  severity: string = 'critical'
): Promise<IncidentMode> {
  try {
    const row = await activateIncidentModeRow(
      'incident_kill_switch',
      'kill_switch',
      userId,
      reason,
      severity,
    );

    // Log to incident response
    await logIncidentAction(
      'activate_kill_switch',
      'Kill switch activated: all write operations blocked',
      userId,
      { reason, severity }
    );

    return {
      id: row.id,
      enabled: row.enabled,
      activatedBy: row.activated_by,
      activatedAt: row.activated_at,
      reason: row.reason,
      severity: row.severity,
    };
  } catch (error) {
    console.error('Failed to activate kill switch:', error);
    throw error;
  }
}

/**
 * Deactivate kill switch
 */
export async function deactivateKillSwitch(userId: string): Promise<{ success: boolean }> {
  try {
    return await disableIncidentModeRow(
      'incident_kill_switch',
      userId,
      'deactivate_kill_switch',
      'Kill switch deactivated: write operations resumed'
    );
  } catch (error) {
    console.error('Failed to deactivate kill switch:', error);
    throw error;
  }
}

/**
 * Check if kill switch is active
 */
export async function isKillSwitchActive(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT enabled FROM incident_kill_switch 
       WHERE enabled = true 
       ORDER BY activated_at DESC 
       LIMIT 1`
    );

    return result.rows.length > 0 && result.rows[0].enabled === true;
  } catch (error) {
    console.error('Failed to check kill switch status:', error);
    throw error;
  }
}

/**
 * Get current kill switch state
 */
export async function getKillSwitchStatus(): Promise<IncidentMode | null> {
  try {
    const result = await pool.query(
      `SELECT id, enabled, activated_by, activated_at, reason, severity
       FROM incident_kill_switch 
       WHERE enabled = true 
       ORDER BY activated_at DESC 
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      enabled: row.enabled,
      activatedBy: row.activated_by,
      activatedAt: row.activated_at,
      reason: row.reason,
      severity: row.severity,
    };
  } catch (error) {
    console.error('Failed to get kill switch status:', error);
    throw error;
  }
}

/**
 * Enable lockdown mode (quarantine new skills, block installations)
 */
export async function enableLockdown(
  userId: string,
  reason: string,
  severity: string = 'high'
): Promise<IncidentMode> {
  try {
    const row = await activateIncidentModeRow('incident_lockdown', 'lockdown', userId, reason, severity);

    await logIncidentAction(
      'enable_lockdown',
      'Lockdown enabled: new skill installations blocked, all skills quarantined',
      userId,
      { reason, severity }
    );

    return {
      id: row.id,
      enabled: row.enabled,
      activatedBy: row.activated_by,
      activatedAt: row.activated_at,
      reason: row.reason,
      severity: row.severity,
    };
  } catch (error) {
    console.error('Failed to enable lockdown:', error);
    throw error;
  }
}

/**
 * Disable lockdown mode
 */
export async function disableLockdown(userId: string): Promise<{ success: boolean }> {
  try {
    return await disableIncidentModeRow(
      'incident_lockdown',
      userId,
      'disable_lockdown',
      'Lockdown disabled: normal skill installation resumed'
    );
  } catch (error) {
    console.error('Failed to disable lockdown:', error);
    throw error;
  }
}

/**
 * Check if lockdown is active
 */
export async function isLockdownActive(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT enabled FROM incident_lockdown 
       WHERE enabled = true 
       ORDER BY activated_at DESC 
       LIMIT 1`
    );

    return result.rows.length > 0 && result.rows[0].enabled === true;
  } catch (error) {
    console.error('Failed to check lockdown status:', error);
    throw error;
  }
}

/**
 * Enable forensics mode (pause tools, keep chat/canvas read-only)
 */
export async function enableForensics(
  userId: string,
  reason: string,
  severity: string = 'critical'
): Promise<IncidentMode> {
  try {
    const row = await activateIncidentModeRow(
      'incident_forensics',
      'forensics',
      userId,
      reason,
      severity,
    );

    await logIncidentAction(
      'enable_forensics',
      'Forensics mode enabled: all tools paused, audit logging boosted',
      userId,
      { reason, severity }
    );

    return {
      id: row.id,
      enabled: row.enabled,
      activatedBy: row.activated_by,
      activatedAt: row.activated_at,
      reason: row.reason,
      severity: row.severity,
    };
  } catch (error) {
    console.error('Failed to enable forensics:', error);
    throw error;
  }
}

/**
 * Disable forensics mode
 */
export async function disableForensics(userId: string): Promise<{ success: boolean }> {
  try {
    return await disableIncidentModeRow(
      'incident_forensics',
      userId,
      'disable_forensics',
      'Forensics mode disabled: tools resumed, normal audit logging resumed'
    );
  } catch (error) {
    console.error('Failed to disable forensics:', error);
    throw error;
  }
}

/**
 * Check if forensics mode is active
 */
export async function isForensicsActive(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT enabled FROM incident_forensics 
       WHERE enabled = true 
       ORDER BY activated_at DESC 
       LIMIT 1`
    );

    return result.rows.length > 0 && result.rows[0].enabled === true;
  } catch (error) {
    console.error('Failed to check forensics status:', error);
    throw error;
  }
}

/**
 * Get current incident status (all modes + open incidents)
 */
export async function getIncidentStatus(): Promise<{
  killSwitchActive: boolean;
  lockdownActive: boolean;
  forensicsActive: boolean;
  openIncidents: number;
  status: string;
}> {
  try {
    const killSwitch = await isKillSwitchActive();
    const lockdown = await isLockdownActive();
    const forensics = await isForensicsActive();

    const incidentResult = await pool.query(
      `SELECT COUNT(*)::int as count FROM incidents WHERE status = 'open'`
    );
    const openIncidents = Number(incidentResult.rows[0]?.count ?? 0);

    let status = 'nominal';
    if (killSwitch) {
      status = 'kill_switch_active';
    } else if (lockdown && forensics) {
      status = 'lockdown_and_forensics_active';
    } else if (lockdown) {
      status = 'lockdown_active';
    } else if (forensics) {
      status = 'forensics_active';
    } else if (openIncidents > 0) {
      status = 'incidents_open';
    }

    return {
      killSwitchActive: killSwitch,
      lockdownActive: lockdown,
      forensicsActive: forensics,
      openIncidents,
      status,
    };
  } catch (error) {
    console.error('Failed to get incident status:', error);
    throw error;
  }
}

/**
 * Create an escalation rule (auto-escalate old approvals)
 */
export async function createEscalationRule(
  name: string,
  userId: string,
  config: {
    approvalAgeMinutes?: number;
    approvalCountThreshold?: number;
    scopeFilter?: string;
    actionType: string;
    escalateToRole?: string;
    notifyChannels?: string[];
    createIncident?: boolean;
    runIntervalMinutes?: number;
  }
): Promise<EscalationRule> {
  try {
    if (!ALLOWED_ESCALATION_ACTION_TYPES.has(String(config.actionType || '').trim())) {
      const err = new Error(
        'actionType must be one of escalate_to_admin|auto_deny|notify|create_incident'
      ) as Error & { code?: string };
      err.code = 'VALIDATION';
      throw err;
    }
    if (config.approvalAgeMinutes !== undefined) {
      const parsedApprovalAge = Number(config.approvalAgeMinutes);
      if (
        !Number.isInteger(parsedApprovalAge) ||
        parsedApprovalAge < ESCALATION_APPROVAL_AGE_MINUTES_MIN ||
        parsedApprovalAge > ESCALATION_APPROVAL_AGE_MINUTES_MAX
      ) {
        const err = new Error(
          `approvalAgeMinutes must be between ${ESCALATION_APPROVAL_AGE_MINUTES_MIN} and ${ESCALATION_APPROVAL_AGE_MINUTES_MAX}`
        ) as Error & { code?: string };
        err.code = 'VALIDATION';
        throw err;
      }
    }
    const id = nanoid();
    const shouldCreateIncident = config.actionType === 'create_incident';

    const result = await pool.query(
      `INSERT INTO escalation_rules 
       (id, name, enabled, approval_age_minutes, approval_count_threshold, scope_filter, action_type, escalate_to_role, notify_channels, create_incident, run_interval_minutes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        name,
        true,
        config.approvalAgeMinutes || 1440, // Default 24h
        config.approvalCountThreshold ?? null,
        config.scopeFilter ? String(config.scopeFilter).trim() : null,
        config.actionType,
        config.escalateToRole || null,
        config.notifyChannels || [],
        shouldCreateIncident,
        config.runIntervalMinutes && config.runIntervalMinutes > 0
          ? config.runIntervalMinutes
          : 5,
        userId,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      approvalAgeMinutes: row.approval_age_minutes,
      approvalCountThreshold: row.approval_count_threshold ?? undefined,
      scopeFilter: row.scope_filter ?? undefined,
      actionType: row.action_type,
      escalateToRole: row.escalate_to_role,
      notifyChannels: parseNotifyChannels(row.notify_channels),
      createIncident: Boolean(row.create_incident),
      runIntervalMinutes: Number(row.run_interval_minutes || 5),
    };
  } catch (error) {
    console.error('Failed to create escalation rule:', error);
    throw error;
  }
}

/**
 * List all escalation rules
 */
export async function getEscalationRules(): Promise<EscalationRule[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, enabled, approval_age_minutes, approval_count_threshold, scope_filter, action_type, escalate_to_role, notify_channels, create_incident, run_interval_minutes
       FROM escalation_rules
       ORDER BY created_at DESC`
    );

    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      approvalAgeMinutes: r.approval_age_minutes,
      approvalCountThreshold: r.approval_count_threshold ?? undefined,
      scopeFilter: r.scope_filter ?? undefined,
      actionType: r.action_type,
      escalateToRole: r.escalate_to_role,
      notifyChannels: parseNotifyChannels(r.notify_channels),
      createIncident: Boolean(r.create_incident),
      runIntervalMinutes: Number(r.run_interval_minutes || 5),
    }));
  } catch (error) {
    console.error('Failed to get escalation rules:', error);
    throw error;
  }
}

/**
 * Enable/disable an escalation rule
 */
export async function updateEscalationRule(
  ruleId: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  try {
    const result = await pool.query(
      'UPDATE escalation_rules SET enabled = $1, updated_at = NOW() WHERE id = $2 AND enabled <> $1 RETURNING id',
      [enabled, ruleId]
    );
    if ((result.rowCount || 0) === 0) {
      const existsResult = await pool.query('SELECT id FROM escalation_rules WHERE id = $1 LIMIT 1', [ruleId]);
      if ((existsResult.rowCount || 0) === 0) {
        const err = new Error('Escalation rule not found') as Error & { code?: string };
        err.code = 'NOT_FOUND';
        throw err;
      }
      const err = new Error(
        enabled ? 'Escalation rule is already enabled' : 'Escalation rule is already disabled'
      ) as Error & { code?: string };
      err.code = 'INVALID_STATE';
      throw err;
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to update escalation rule:', error);
    throw error;
  }
}

/**
 * Execute escalation rules (run periodically, e.g. every 5 minutes)
 */
export async function executeEscalationRules(): Promise<{
  rulesExecuted: number;
  escalationsTriggered: number;
  incidentsCreated: number;
}> {
  try {
    const rules = await pool.query(
      `SELECT * FROM escalation_rules WHERE enabled = true`
    );

    let escalationsTriggered = 0;
    let incidentsCreated = 0;

    for (const rule of rules.rows) {
      const runIntervalMinutes = Number(rule.run_interval_minutes || 5);
      if (rule.last_executed_at && Number.isFinite(runIntervalMinutes) && runIntervalMinutes > 0) {
        const nextRunAt = new Date(new Date(rule.last_executed_at).getTime() + runIntervalMinutes * 60_000);
        if (nextRunAt > new Date()) {
          continue;
        }
      }

      const filters: string[] = [`status = 'pending'`];
      const params: unknown[] = [];

      if (rule.approval_age_minutes) {
        params.push(rule.approval_age_minutes);
        filters.push(`created_at < NOW() - INTERVAL '1 minute' * $${params.length}`);
      }
      if (rule.scope_filter) {
        params.push(rule.scope_filter);
        filters.push(`scope = $${params.length}`);
      }
      if (rule.action_type === 'create_incident') {
        params.push(rule.id);
        filters.push(
          `NOT EXISTS (
            SELECT 1
            FROM escalation_audit ea
            WHERE ea.rule_id = $${params.length}
              AND ea.approval_id = approvals.id
              AND ea.action_type = 'create_incident'
              AND ea.action_executed = true
          )`
        );
      }

      const approvalResult = await pool.query(
        `SELECT id, scope FROM approvals
         WHERE ${filters.join(' AND ')}
         ORDER BY created_at ASC
         LIMIT 100`,
        params
      );
      const pendingApprovalCount = approvalResult.rows.length;
      const requiredCount = Number(rule.approval_count_threshold || 0);
      if (requiredCount > 0 && pendingApprovalCount < requiredCount) {
        await pool.query('UPDATE escalation_rules SET last_executed_at = NOW() WHERE id = $1', [
          rule.id,
        ]);
        continue;
      }

      for (const approval of approvalResult.rows) {
        let actionExecuted = false;
        let actionResult: Record<string, unknown> | null = null;

        // Take action based on rule action type
        if (rule.action_type === 'auto_deny') {
          await pool.query(
            `UPDATE approvals SET status = 'denied', decided_at = NOW() WHERE id = $1`,
            [approval.id]
          );
          actionExecuted = true;
        } else if (rule.action_type === 'create_incident') {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            const claimResult = await client.query(
              `SELECT id FROM approvals WHERE id = $1 AND status = 'pending' FOR UPDATE`,
              [approval.id]
            );
            if (claimResult.rows.length > 0) {
              const alreadyEscalatedResult = await client.query(
                `SELECT 1
                 FROM escalation_audit
                 WHERE rule_id = $1
                   AND approval_id = $2
                   AND action_type = 'create_incident'
                   AND action_executed = true
                 LIMIT 1`,
                [rule.id, approval.id]
              );

              if (alreadyEscalatedResult.rows.length === 0) {
                const incidentId = nanoid();
                await client.query(
                  `INSERT INTO incidents (id, title, description, severity, affected_systems)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [
                    incidentId,
                    'Escalation: Old approval timeout',
                    `Approval ${approval.id} exceeded escalation criteria`,
                    'high',
                    JSON.stringify(['approvals']),
                  ]
                );
                incidentsCreated++;
                actionExecuted = true;
              } else {
                actionResult = { code: 'already_escalated', actionType: rule.action_type };
              }
            } else {
              actionResult = { code: 'approval_not_pending', actionType: rule.action_type };
            }

            await client.query(
              `INSERT INTO escalation_audit (rule_id, approval_id, approval_age_minutes, pending_approval_count, action_type, action_executed, action_result)
               VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
              [
                rule.id,
                approval.id,
                rule.approval_age_minutes,
                pendingApprovalCount,
                rule.action_type,
                actionExecuted,
                JSON.stringify(actionResult || {}),
              ]
            );

            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        } else {
          actionResult = { code: 'unsupported_action_type', actionType: rule.action_type };
          await pool.query(
            `INSERT INTO escalation_audit (rule_id, approval_id, approval_age_minutes, pending_approval_count, action_type, action_executed, action_result)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
            [
              rule.id,
              approval.id,
              rule.approval_age_minutes,
              pendingApprovalCount,
              rule.action_type,
              actionExecuted,
              JSON.stringify(actionResult || {}),
            ]
          );
        }

        if (actionExecuted) {
          escalationsTriggered++;
        }
      }

      // Update last executed
      await pool.query('UPDATE escalation_rules SET last_executed_at = NOW() WHERE id = $1', [
        rule.id,
      ]);
    }

    return { rulesExecuted: rules.rows.length, escalationsTriggered, incidentsCreated };
  } catch (error) {
    console.error('Failed to execute escalation rules:', error);
    throw error;
  }
}

/**
 * Send emergency notification
 */
export async function sendEmergencyNotification(
  channel: string,
  recipients: string[],
  title: string,
  message: string,
  severity: string = 'critical',
  incidentId?: string
): Promise<string> {
  try {
    const id = nanoid();

    await pool.query(
      `INSERT INTO emergency_notifications 
       (id, incident_id, channel, recipients, title, message, severity, delivery_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, incidentId || null, channel, recipients, title, message, severity, 'queued']
    );

    // In production, this would integrate with actual notification service
    // e.g., Slack API, Discord webhooks, email service, SMS gateway, etc.
    console.log(`[EMERGENCY] ${severity.toUpperCase()} via ${channel}: ${title}`);

    return id;
  } catch (error) {
    console.error('Failed to send emergency notification:', error);
    throw error;
  }
}

/**
 * Log incident action to response log
 */
export async function logIncidentAction(
  actionType: string,
  actionDescription: string,
  userId: string,
  details?: any
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get or create incident context
    let incidentId: string | null = null;
    const incidentResult = await client.query(
      `SELECT id FROM incidents WHERE status = 'open' ORDER BY detected_at DESC LIMIT 1`
    );

    if (incidentResult.rows.length === 0) {
      incidentId = nanoid();
      await client.query(
        `INSERT INTO incidents (id, title, description, detected_by, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [incidentId, actionType, actionDescription, userId, 'open']
      );
    } else {
      incidentId = incidentResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO incident_response_log (incident_id, action_type, action_description, actor_user_id, result_details)
       VALUES ($1, $2, $3, $4, $5)`,
      [incidentId, actionType, actionDescription, userId, JSON.stringify(details || {})]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to log incident action:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get incident history
 */
export async function getIncidentHistory(limit: number = 50): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT action_at, action_type, action_description, actor_user_id
       FROM incident_response_log
       ORDER BY action_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to get incident history:', error);
    const wrapped = new Error('Failed to get incident history') as Error & { code?: string };
    wrapped.code = 'INCIDENT_HISTORY_QUERY_FAILED';
    throw wrapped;
  }
}

/**
 * Close an incident
 */
export async function closeIncident(incidentId: string, userId: string, notes?: string): Promise<{ success: boolean }> {
  try {
    const result = await pool.query(
      `UPDATE incidents 
       SET status = 'closed', resolved_at = NOW(), resolved_by = $1
       WHERE id = $2
       RETURNING id`,
      [userId, incidentId]
    );
    if ((result.rowCount || 0) === 0) {
      const err = new Error('Incident not found') as Error & { code?: string };
      err.code = 'NOT_FOUND';
      throw err;
    }

    await logIncidentAction(
      'close_incident',
      `Incident closed: ${notes || 'No additional notes'}`,
      userId,
      { incident_id: incidentId }
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to close incident:', error);
    throw error;
  }
}
