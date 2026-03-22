import { FastifyInstance, FastifyRequest } from 'fastify';
import pg from 'pg';
import { requireRole } from '../auth.js';
import {
  activateKillSwitch,
  deactivateKillSwitch,
  getKillSwitchStatus,
  enableLockdown,
  disableLockdown,
  isLockdownActive,
  enableForensics,
  disableForensics,
  isForensicsActive,
  getIncidentStatus,
  createEscalationRule,
  getEscalationRules,
  updateEscalationRule,
  executeEscalationRules,
  sendEmergencyNotification,
  getIncidentHistory,
  closeIncident,
} from '../../services/IncidentService.js';

const ALLOWED_INCIDENT_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const ALLOWED_ESCALATION_ACTION_TYPES = new Set([
  'escalate_to_admin',
  'auto_deny',
  'notify',
  'create_incident',
]);
const ESCALATION_APPROVAL_AGE_MINUTES_MIN = 1;
const ESCALATION_APPROVAL_AGE_MINUTES_MAX = 10080;

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function parseIncidentSeverity(
  rawSeverity: unknown,
  fallback: 'critical' | 'high' | 'medium' | 'low'
): { ok: true; value: string } | { ok: false; message: string } {
  if (rawSeverity === undefined || rawSeverity === null || rawSeverity === '') {
    return { ok: true, value: fallback };
  }
  if (typeof rawSeverity !== 'string') {
    return { ok: false, message: 'severity must be a string' };
  }
  const normalized = rawSeverity.trim().toLowerCase();
  if (!ALLOWED_INCIDENT_SEVERITIES.has(normalized)) {
    return { ok: false, message: 'severity must be one of critical, high, medium, low' };
  }
  return { ok: true, value: normalized };
}

function parseEmergencyRecipients(
  rawRecipients: unknown
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (!Array.isArray(rawRecipients)) {
    return { ok: false, message: 'recipients must be a non-empty array of strings' };
  }
  const recipients = rawRecipients
    .map((r) => (typeof r === 'string' ? r.trim() : ''))
    .filter(Boolean);
  if (recipients.length === 0 || recipients.length !== rawRecipients.length) {
    return { ok: false, message: 'recipients must be a non-empty array of strings' };
  }
  return { ok: true, value: recipients };
}

function parseNotifyChannelsInput(
  rawChannels: unknown
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (rawChannels === undefined || rawChannels === null) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(rawChannels)) {
    return { ok: false, message: 'notifyChannels must be an array of strings when provided' };
  }
  const channels = rawChannels
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (channels.length !== rawChannels.length) {
    return { ok: false, message: 'notifyChannels must be an array of strings when provided' };
  }
  return { ok: true, value: channels };
}

function parseApprovalAgeMinutesInput(
  raw: unknown
): { ok: true; value: number | undefined } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: undefined };
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return { ok: false, message: 'approvalAgeMinutes must be an integer when provided' };
  }
  if (
    parsed < ESCALATION_APPROVAL_AGE_MINUTES_MIN ||
    parsed > ESCALATION_APPROVAL_AGE_MINUTES_MAX
  ) {
    return {
      ok: false,
      message: `approvalAgeMinutes must be between ${ESCALATION_APPROVAL_AGE_MINUTES_MIN} and ${ESCALATION_APPROVAL_AGE_MINUTES_MAX}`,
    };
  }
  return { ok: true, value: parsed };
}

function parseIncidentHistoryLimit(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: 50 };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    return { ok: false, message: 'limit must be a finite integer between 1 and 500' };
  }
  return { ok: true, value: parsed };
}

function normalizeIncidentBody<T extends object>(
  body: unknown
): { ok: true; value: Partial<T> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as Partial<T> };
}

/**
 * Incident Response & Safety REST API Routes (Admin Panel)
 */
export async function registerIncidentRoutes(app: FastifyInstance, pool: pg.Pool) {
  const adminOnly = requireRole(pool, 'admin');
  app.addHook('preHandler', adminOnly);
  app.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if (!(request as any).orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
    if (String((request as any).userRole || '').trim() !== 'platform_admin') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Platform admin role required for global incident controls',
        },
      });
    }
  });

  // ─── GET /incident/status ───
  app.get('/incident/status', async (request: FastifyRequest, reply) => {
    try {
      const status = await getIncidentStatus();
      return reply.send({ success: true, data: status });
    } catch (error) {
      if (isSchemaCompatError(error)) {
        request.log.warn({ err: error }, 'incident schema not ready; fail-closed');
        return reply.status(503).send({
          success: false,
          error: {
            code: 'FEATURE_UNAVAILABLE',
            message: 'Incident schema not available in this environment',
          },
        });
      }
      console.error('Failed to get incident status:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get incident status' },
      });
    }
  });

  // ─── POST /incident/kill-switch/activate ───
  app.post('/incident/kill-switch/activate', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const body = normalizeIncidentBody<{ reason?: string; severity?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: body.message },
        });
      }
      const { reason, severity = 'critical' } = body.value;

      if (!reason) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'reason required' },
        });
      }
      const severityInput = parseIncidentSeverity(severity, 'critical');
      if (!severityInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: severityInput.message },
        });
      }

      const result = await activateKillSwitch(userId, reason, severityInput.value);

      // Send emergency notification
      let notification = {
        attempted: false,
        degraded: false,
        message: 'not_requested',
      };
      try {
        const config = await pool.query(`SELECT emergency_contacts FROM incident_config LIMIT 1`);
        if (config.rows.length > 0 && config.rows[0].emergency_contacts) {
          const contacts = config.rows[0].emergency_contacts;
          notification = {
            attempted: true,
            degraded: false,
            message: 'contacts_loaded',
          };
          // Would send notifications here in production
        }
      } catch (e) {
        request.log.warn(
          { err: e },
          'Kill-switch activation succeeded but emergency notification side-effects failed'
        );
        notification = {
          attempted: true,
          degraded: true,
          message: 'notification_side_effect_failed',
        };
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: result.id,
          status: 'kill_switch_activated',
          message: `Kill switch activated: all write operations blocked. Reason: ${reason}`,
          notification,
        },
      });
    } catch (error) {
      console.error('Failed to activate kill switch:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to activate kill switch' },
      });
    }
  });

  // ─── POST /incident/kill-switch/deactivate ───
  app.post('/incident/kill-switch/deactivate', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;

      const result = await deactivateKillSwitch(userId);

      return reply.send({
        success: result.success,
        data: {
          status: 'kill_switch_deactivated',
          message: 'Kill switch deactivated: write operations resumed',
        },
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'INVALID_STATE') {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Kill switch is already disabled' },
        });
      }
      console.error('Failed to deactivate kill switch:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate kill switch' },
      });
    }
  });

  // ─── GET /incident/kill-switch/status ───
  app.get('/incident/kill-switch/status', async (request: FastifyRequest, reply) => {
    try {
      const status = await getKillSwitchStatus();

      return reply.send({
        success: true,
        data: {
          active: status !== null,
          status,
        },
      });
    } catch (error) {
      console.error('Failed to get kill switch status:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get kill switch status' },
      });
    }
  });

  // ─── POST /incident/lockdown/enable ───
  app.post('/incident/lockdown/enable', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const body = normalizeIncidentBody<{ reason?: string; severity?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: body.message },
        });
      }
      const { reason, severity = 'high' } = body.value;

      if (!reason) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'reason required' },
        });
      }
      const severityInput = parseIncidentSeverity(severity, 'high');
      if (!severityInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: severityInput.message },
        });
      }

      const result = await enableLockdown(userId, reason, severityInput.value);

      return reply.status(201).send({
        success: true,
        data: {
          id: result.id,
          status: 'lockdown_enabled',
          message: 'Lockdown enabled: new skill installations blocked, all skills quarantined',
        },
      });
    } catch (error) {
      console.error('Failed to enable lockdown:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enable lockdown' },
      });
    }
  });

  // ─── POST /incident/lockdown/disable ───
  app.post('/incident/lockdown/disable', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;

      const result = await disableLockdown(userId);

      return reply.send({
        success: result.success,
        data: {
          status: 'lockdown_disabled',
          message: 'Lockdown disabled: normal skill installation resumed',
        },
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'INVALID_STATE') {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Lockdown is already disabled' },
        });
      }
      console.error('Failed to disable lockdown:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to disable lockdown' },
      });
    }
  });

  // ─── GET /incident/lockdown/status ───
  app.get('/incident/lockdown/status', async (request: FastifyRequest, reply) => {
    try {
      const active = await isLockdownActive();

      return reply.send({
        success: true,
        data: { active },
      });
    } catch (error) {
      console.error('Failed to get lockdown status:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get lockdown status' },
      });
    }
  });

  // ─── POST /incident/forensics/enable ───
  app.post('/incident/forensics/enable', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const body = normalizeIncidentBody<{ reason?: string; severity?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: body.message },
        });
      }
      const { reason, severity = 'critical' } = body.value;

      if (!reason) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'reason required' },
        });
      }
      const severityInput = parseIncidentSeverity(severity, 'critical');
      if (!severityInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: severityInput.message },
        });
      }

      const result = await enableForensics(userId, reason, severityInput.value);

      return reply.status(201).send({
        success: true,
        data: {
          id: result.id,
          status: 'forensics_enabled',
          message: 'Forensics mode enabled: all tools paused, audit logging boosted',
        },
      });
    } catch (error) {
      console.error('Failed to enable forensics:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enable forensics' },
      });
    }
  });

  // ─── POST /incident/forensics/disable ───
  app.post('/incident/forensics/disable', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;

      const result = await disableForensics(userId);

      return reply.send({
        success: result.success,
        data: {
          status: 'forensics_disabled',
          message: 'Forensics mode disabled: tools resumed, normal audit logging resumed',
        },
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'INVALID_STATE') {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Forensics mode is already disabled' },
        });
      }
      console.error('Failed to disable forensics:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to disable forensics' },
      });
    }
  });

  // ─── GET /incident/forensics/status ───
  app.get('/incident/forensics/status', async (request: FastifyRequest, reply) => {
    try {
      const active = await isForensicsActive();

      return reply.send({
        success: true,
        data: { active },
      });
    } catch (error) {
      console.error('Failed to get forensics status:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get forensics status' },
      });
    }
  });

  // ─── POST /incident/escalation-rules ───
  app.post('/incident/escalation-rules', async (request: FastifyRequest, reply) => {
    try {
      const userId = (request as any).userId;
      const body = normalizeIncidentBody<{
        name?: unknown;
        approvalAgeMinutes?: unknown;
        approvalCountThreshold?: unknown;
        scopeFilter?: unknown;
        runIntervalMinutes?: unknown;
        actionType?: unknown;
        escalateToRole?: unknown;
        notifyChannels?: unknown;
        createIncident?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: body.message },
        });
      }
      const {
        name,
        approvalAgeMinutes,
        approvalCountThreshold,
        scopeFilter,
        runIntervalMinutes,
        actionType,
        escalateToRole,
        notifyChannels,
        createIncident,
      } =
        body.value;
      const nameText = typeof name === 'string' ? name.trim() : '';
      const actionTypeText = typeof actionType === 'string' ? actionType.trim() : '';
      const approvalCountThresholdValue =
        approvalCountThreshold === undefined || approvalCountThreshold === null || approvalCountThreshold === ''
          ? undefined
          : Number(approvalCountThreshold);
      const runIntervalMinutesValue =
        runIntervalMinutes === undefined || runIntervalMinutes === null || runIntervalMinutes === ''
          ? undefined
          : Number(runIntervalMinutes);
      const scopeFilterText =
        scopeFilter === undefined || scopeFilter === null || scopeFilter === ''
          ? undefined
          : String(scopeFilter);
      const escalateToRoleText =
        escalateToRole === undefined || escalateToRole === null || escalateToRole === ''
          ? undefined
          : String(escalateToRole);

      if (!nameText || !actionTypeText) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'name and actionType required' },
        });
      }
      if (!ALLOWED_ESCALATION_ACTION_TYPES.has(actionTypeText)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'actionType must be one of escalate_to_admin|auto_deny|notify|create_incident',
          },
        });
      }
      if (createIncident !== undefined && typeof createIncident !== 'boolean') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'createIncident must be a boolean when provided' },
        });
      }
      if (actionTypeText === 'create_incident' && createIncident === false) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'createIncident cannot be false when actionType is create_incident',
          },
        });
      }
      if (actionTypeText !== 'create_incident' && createIncident === true) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'createIncident=true is only allowed when actionType is create_incident',
          },
        });
      }
      const approvalAgeInput = parseApprovalAgeMinutesInput(approvalAgeMinutes);
      if (!approvalAgeInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: approvalAgeInput.message },
        });
      }
      const notifyChannelsInput = parseNotifyChannelsInput(notifyChannels);
      if (!notifyChannelsInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: notifyChannelsInput.message },
        });
      }

      const rule = await createEscalationRule(nameText, userId, {
        approvalAgeMinutes: approvalAgeInput.value,
        approvalCountThreshold: Number.isFinite(approvalCountThresholdValue as number)
          ? approvalCountThresholdValue
          : undefined,
        scopeFilter: scopeFilterText,
        runIntervalMinutes: Number.isFinite(runIntervalMinutesValue as number)
          ? runIntervalMinutesValue
          : undefined,
        actionType: actionTypeText,
        escalateToRole: escalateToRoleText,
        notifyChannels: notifyChannelsInput.value,
        createIncident: createIncident as boolean | undefined,
      });

      return reply.status(201).send({
        success: true,
        data: rule,
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'VALIDATION') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: String((error as any)?.message || 'Invalid input') },
        });
      }
      console.error('Failed to create escalation rule:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create escalation rule' },
      });
    }
  });

  // ─── GET /incident/escalation-rules ───
  app.get('/incident/escalation-rules', async (request: FastifyRequest, reply) => {
    try {
      const rules = await getEscalationRules();

      return reply.send({
        success: true,
        data: { rules, total: rules.length },
      });
    } catch (error) {
      console.error('Failed to get escalation rules:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get escalation rules' },
      });
    }
  });

  // ─── POST /incident/escalation-rules/:ruleId/disable ───
  app.post('/incident/escalation-rules/:ruleId/disable', async (request: FastifyRequest, reply) => {
    try {
      const { ruleId } = request.params as any;
      const stateRes = await pool.query(
        'SELECT id, enabled FROM escalation_rules WHERE id = $1 LIMIT 1',
        [ruleId]
      );
      if (stateRes.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Escalation rule not found' },
        });
      }
      if (stateRes.rows[0].enabled !== true) {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Escalation rule is already disabled' },
        });
      }

      const result = await updateEscalationRule(ruleId, false);

      return reply.send({
        success: result.success,
        message: 'Escalation rule disabled',
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Escalation rule not found' },
        });
      }
      if (String((error as any)?.code || '') === 'INVALID_STATE') {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Escalation rule is already disabled' },
        });
      }
      console.error('Failed to disable escalation rule:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to disable escalation rule' },
      });
    }
  });

  // ─── POST /incident/escalation-rules/:ruleId/enable ───
  app.post('/incident/escalation-rules/:ruleId/enable', async (request: FastifyRequest, reply) => {
    try {
      const { ruleId } = request.params as any;
      const stateRes = await pool.query(
        'SELECT id, enabled FROM escalation_rules WHERE id = $1 LIMIT 1',
        [ruleId]
      );
      if (stateRes.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Escalation rule not found' },
        });
      }
      if (stateRes.rows[0].enabled === true) {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Escalation rule is already enabled' },
        });
      }

      const result = await updateEscalationRule(ruleId, true);

      return reply.send({
        success: result.success,
        message: 'Escalation rule enabled',
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Escalation rule not found' },
        });
      }
      if (String((error as any)?.code || '') === 'INVALID_STATE') {
        return reply.status(409).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Escalation rule is already enabled' },
        });
      }
      console.error('Failed to enable escalation rule:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enable escalation rule' },
      });
    }
  });

  // ─── POST /incident/escalation-rules/execute ───
  app.post('/incident/escalation-rules/execute', async (request: FastifyRequest, reply) => {
    try {
      const result = await executeEscalationRules();

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Failed to execute escalation rules:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to execute escalation rules' },
      });
    }
  });

  // ─── POST /incident/emergency-notify ───
  app.post('/incident/emergency-notify', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeIncidentBody<{
        channel?: unknown;
        recipients?: unknown;
        title?: unknown;
        message?: unknown;
        severity?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: body.message },
        });
      }
      const { channel, recipients, title, message, severity = 'critical' } =
        body.value;
      const channelText = typeof channel === 'string' ? channel.trim() : '';
      const titleText = typeof title === 'string' ? title.trim() : '';
      const messageText = typeof message === 'string' ? message.trim() : '';

      if (!channelText || !recipients || !titleText || !messageText) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'channel, recipients, title, and message required',
          },
        });
      }
      const recipientsInput = parseEmergencyRecipients(recipients);
      if (!recipientsInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: recipientsInput.message },
        });
      }
      const severityInput = parseIncidentSeverity(severity, 'critical');
      if (!severityInput.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: severityInput.message },
        });
      }

      const notifId = await sendEmergencyNotification(
        channelText,
        recipientsInput.value,
        titleText,
        messageText,
        severityInput.value
      );

      return reply.status(201).send({
        success: true,
        data: { notificationId: notifId, status: 'queued' },
      });
    } catch (error) {
      console.error('Failed to send emergency notification:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to send emergency notification' },
      });
    }
  });

  // ─── GET /incident/history ───
  app.get('/incident/history', async (request: FastifyRequest, reply) => {
    try {
      const { limit } = request.query as any;
      const parsedLimit = parseIncidentHistoryLimit(limit);
      if (!parsedLimit.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: parsedLimit.message },
        });
      }

      const history = await getIncidentHistory(parsedLimit.value);

      return reply.send({
        success: true,
        data: { history, total: history.length },
      });
    } catch (error) {
      console.error('Failed to get incident history:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get incident history' },
      });
    }
  });

  // ─── POST /incident/:incidentId/close ───
  app.post('/incident/:incidentId/close', async (request: FastifyRequest, reply) => {
    try {
      const { incidentId } = request.params as any;
      const userId = (request as any).userId;
      const body = normalizeIncidentBody<{ notes?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: body.message },
        });
      }
      const { notes } = body.value;
      const notesText = typeof notes === 'string' ? notes : undefined;

      const result = await closeIncident(incidentId, userId, notesText);

      return reply.send({
        success: result.success,
        message: 'Incident closed',
      });
    } catch (error) {
      if (String((error as any)?.code || '') === 'NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Incident not found' },
        });
      }
      console.error('Failed to close incident:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to close incident' },
      });
    }
  });
}
