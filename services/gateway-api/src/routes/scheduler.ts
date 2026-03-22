import { FastifyInstance } from 'fastify';
import { NatsConnection, JSONCodec } from 'nats';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { NATS_SUBJECTS, createLogger } from '@sven/shared';
import type { EventEnvelope, NotifyPushEvent } from '@sven/shared';
import { requireRole } from './auth.js';

const logger = createLogger('scheduler');
const jc = JSONCodec();
const ALLOWED_NOTIFY_CHANNELS = new Set(['in_app', 'email', 'slack', 'webhook']);
const PROACTIVE_TYPES = new Set(['daily_briefing', 'daily_digest', 'reminder']);
const PROACTIVE_NAME_PREFIX = '[proactive:';
const DEFAULT_SCHEDULE_LIST_LIMIT = 50;
const MAX_SCHEDULE_LIST_LIMIT = 50;
const DEFAULT_SCHEDULER_TICK_MS = 15000;
const MIN_SCHEDULER_TICK_MS = 1000;
const MAX_SCHEDULER_TICK_MS = 300000;
const DEFAULT_SCHEDULE_HISTORY_LIMIT = 10;
const MAX_SCHEDULE_HISTORY_LIMIT = 100;
const MIN_PROACTIVE_ACK_MAX_CHARS = 32;
const MAX_PROACTIVE_ACK_MAX_CHARS = 4000;
const ALLOWED_MISSED_POLICIES = new Set(['skip', 'run_immediately']);
const ALLOWED_SESSION_RETENTION = new Set(['sticky', 'ephemeral']);
const SCHEDULER_TICK_ADVISORY_LOCK_KEY = 470001;

let schedulerStarted = false;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

// ─── Cron helpers (shared with admin cron.ts) ─────────────────────

function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => isValidField(field, i));
}

function isValidField(field: string, index: number): boolean {
  const range = getRange(index);
  const parts = field.split(',');
  for (const part of parts) {
    if (part === '*') continue;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if (!Number.isFinite(step) || step <= 0) return false;
      continue;
    }
    if (/^\d+$/.test(part)) {
      const num = Number(part);
      if (num < range.min || num > range.max) return false;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (a < range.min || b > range.max || a > b) return false;
      continue;
    }
    return false;
  }
  return true;
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function resolveTimezone(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}

function getTimePartsInZone(date: Date, timeZone: string): { minute: number; hour: number; day: number; month: number; weekday: number } | null {
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
    const weekday = WEEKDAY_MAP[weekdayText];
    if (!Number.isFinite(minute) || !Number.isFinite(hour) || !Number.isFinite(day) || !Number.isFinite(month) || weekday === undefined) {
      return null;
    }
    return { minute, hour, day, month, weekday };
  } catch {
    return null;
  }
}

function computeNextRun(expression: string, fromDate: Date, timeZone: string): Date | null {
  if (!isValidCron(expression)) return null;
  const tz = resolveTimezone(timeZone);
  if (!tz) return null;
  const [m, h, dom, mon, dow] = expression.trim().split(/\s+/);
  const next = new Date(Math.floor(fromDate.getTime() / 60000) * 60000 + 60000);

  for (let i = 0; i < 60 * 24 * 366; i += 1) {
    const parts = getTimePartsInZone(next, tz);
    if (!parts) return null;
    if (
      matchesField(parts.minute, m, 0) &&
      matchesField(parts.hour, h, 1) &&
      matchesField(parts.day, dom, 2) &&
      matchesField(parts.month, mon, 3) &&
      matchesField(parts.weekday, dow, 4)
    ) {
      return next;
    }
    next.setUTCMinutes(next.getUTCMinutes() + 1);
  }
  return null;
}

function matchesField(value: number, field: string, index: number): boolean {
  if (field === '*') return true;
  const range = getRange(index);
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

function getRange(index: number): { min: number; max: number } {
  if (index === 0) return { min: 0, max: 59 };
  if (index === 1) return { min: 0, max: 23 };
  if (index === 2) return { min: 1, max: 31 };
  if (index === 3) return { min: 1, max: 12 };
  return { min: 0, max: 6 };
}

function normalizeNotifyChannels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const channels: string[] = [];
  for (const value of raw) {
    const channel = String(value || '').trim();
    if (!ALLOWED_NOTIFY_CHANNELS.has(channel) || seen.has(channel)) continue;
    seen.add(channel);
    channels.push(channel);
  }
  return channels;
}

function parseSchedulerTickIntervalMs(raw: unknown): number {
  const value = String(raw ?? '').trim();
  if (!value) return DEFAULT_SCHEDULER_TICK_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_SCHEDULER_TICK_MS || parsed > MAX_SCHEDULER_TICK_MS) {
    throw new Error(
      `Invalid SCHEDULER_TICK_MS: "${value}". Expected integer ${MIN_SCHEDULER_TICK_MS}-${MAX_SCHEDULER_TICK_MS}`,
    );
  }
  return parsed;
}

function parseScheduleHistoryLimit(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_SCHEDULE_HISTORY_LIMIT;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_SCHEDULE_HISTORY_LIMIT) return null;
  return parsed;
}

function parseMissedPolicy(raw: unknown, fallback: 'skip' | 'run_immediately' = 'skip'): 'skip' | 'run_immediately' | null {
  if (raw === undefined) return fallback;
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!ALLOWED_MISSED_POLICIES.has(value)) return null;
  return value as 'skip' | 'run_immediately';
}

function parseMissedPolicyPatch(raw: unknown): { provided: boolean; valid: boolean; value: 'skip' | 'run_immediately' | null } {
  if (raw === undefined) return { provided: false, valid: true, value: null };
  const parsed = parseMissedPolicy(raw, 'skip');
  if (!parsed) return { provided: true, valid: false, value: null };
  return { provided: true, valid: true, value: parsed };
}

function parseMaxConcurrentRuns(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) return null;
  return parsed;
}

function parseSessionRetention(
  raw: unknown,
  fallback: 'sticky' | 'ephemeral' = 'sticky',
): 'sticky' | 'ephemeral' | null {
  if (raw === undefined) return fallback;
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!ALLOWED_SESSION_RETENTION.has(value)) return null;
  return value as 'sticky' | 'ephemeral';
}

function parseSessionRetentionPatch(
  raw: unknown,
): { provided: boolean; valid: boolean; value: 'sticky' | 'ephemeral' | null } {
  if (raw === undefined) return { provided: false, valid: true, value: null };
  const parsed = parseSessionRetention(raw, 'sticky');
  if (!parsed) return { provided: true, valid: false, value: null };
  return { provided: true, valid: true, value: parsed };
}

function normalizeOptionalUrl(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!isAllowedWebhookProtocol(parsed.protocol)) return null;
    const allowlist = resolveSchedulerWebhookHostAllowlist(process.env.SCHEDULER_WEBHOOK_ALLOWLIST_HOSTS);
    if (!isSchedulerWebhookTargetAllowed(parsed, allowlist)) return null;
    return value;
  } catch {
    return null;
  }
}

function allowInsecureWebhookUrls(): boolean {
  return process.env.SCHEDULER_ALLOW_INSECURE_WEBHOOK_URLS === 'true' || process.env.NODE_ENV !== 'production';
}

function isAllowedWebhookProtocol(protocol: string): boolean {
  if (protocol === 'https:') return true;
  if (protocol === 'http:' && allowInsecureWebhookUrls()) return true;
  return false;
}

const SCHEDULER_WEBHOOK_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'metadata.aws.internal',
  '169.254.169.254',
]);

const SCHEDULER_WEBHOOK_BLOCKED_IP_LITERALS = new Set([
  '127.0.0.1',
  '::1',
  '0:0:0:0:0:0:0:1',
]);

function resolveSchedulerWebhookHostAllowlist(raw: unknown): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateOrLocalIpv4(hostname: string): boolean {
  const octets = parseIpv4(hostname);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateOrLocalIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}

function isHostAllowlisted(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.some((entry) => {
    const normalized = entry.toLowerCase().trim();
    if (!normalized) return false;
    if (normalized === hostname) return true;
    if (normalized.startsWith('*.')) {
      const suffix = normalized.slice(1);
      return hostname.endsWith(suffix);
    }
    return false;
  });
}

function isSchedulerWebhookTargetAllowed(url: URL, allowlist: string[]): boolean {
  const hostname = String(url.hostname || '').toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (!hostname) return false;
  if (SCHEDULER_WEBHOOK_BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (SCHEDULER_WEBHOOK_BLOCKED_IP_LITERALS.has(hostname)) return false;
  if (isPrivateOrLocalIpv4(hostname) || isPrivateOrLocalIpv6(hostname)) return false;
  if (!isHostAllowlisted(hostname, allowlist)) return false;
  return true;
}

function normalizeOptionalEmail(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

function parseOptionalEmailPatch(raw: unknown): { provided: boolean; valid: boolean; value: string | null } {
  if (raw === undefined) return { provided: false, valid: true, value: null };
  if (raw === null) return { provided: true, valid: true, value: null };
  if (typeof raw !== 'string') return { provided: true, valid: false, value: null };
  const value = raw.trim();
  if (!value) return { provided: true, valid: false, value: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { provided: true, valid: false, value: null };
  return { provided: true, valid: true, value };
}

function parseOptionalUrlPatch(raw: unknown): { provided: boolean; valid: boolean; value: string | null } {
  if (raw === undefined) return { provided: false, valid: true, value: null };
  if (raw === null) return { provided: true, valid: true, value: null };
  if (typeof raw !== 'string') return { provided: true, valid: false, value: null };
  const value = raw.trim();
  if (!value) return { provided: true, valid: false, value: null };
  try {
    const parsed = new URL(value);
    if (!isAllowedWebhookProtocol(parsed.protocol)) {
      return { provided: true, valid: false, value: null };
    }
    const allowlist = resolveSchedulerWebhookHostAllowlist(process.env.SCHEDULER_WEBHOOK_ALLOWLIST_HOSTS);
    if (!isSchedulerWebhookTargetAllowed(parsed, allowlist)) {
      return { provided: true, valid: false, value: null };
    }
    return { provided: true, valid: true, value };
  } catch {
    return { provided: true, valid: false, value: null };
  }
}

function parsePagination(rawLimit: unknown, rawOffset: unknown): { limit: number; offset: number } | null {
  const limitText = String(rawLimit ?? '').trim();
  const offsetText = String(rawOffset ?? '').trim();

  const limit = limitText === '' ? DEFAULT_SCHEDULE_LIST_LIMIT : Number(limitText);
  const offset = offsetText === '' ? 0 : Number(offsetText);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SCHEDULE_LIST_LIMIT) return null;
  if (!Number.isInteger(offset) || offset < 0) return null;
  return { limit, offset };
}

function buildTaskNotifyMessages(taskName: string, outcome: 'success' | 'error', durationMs: number, error?: string) {
  if (outcome === 'success') {
    return {
      title: `Scheduled task completed: ${taskName}`,
      body: `Outcome: success\nDuration: ${durationMs}ms`,
    };
  }
  return {
    title: `Scheduled task failed: ${taskName}`,
    body: `Outcome: error\nDuration: ${durationMs}ms\nError: ${error || 'unknown error'}`,
  };
}

function mapTaskChannelsToNotify(task: any): Array<{
  channels: string[];
  data: Record<string, unknown>;
}> {
  const configured = normalizeNotifyChannels(task.notify_channels);
  if (configured.length === 0) return [];

  const groups: Array<{ channels: string[]; data: Record<string, unknown> }> = [];
  const baseChannels: string[] = [];

  if (configured.includes('in_app')) baseChannels.push('outbox');
  if (configured.includes('email')) baseChannels.push('email');

  if (baseChannels.length > 0) groups.push({ channels: baseChannels, data: {} });

  if (configured.includes('webhook') && task.notify_webhook_url) {
    groups.push({
      channels: ['webhook'],
      data: { webhook_url: task.notify_webhook_url },
    });
  }
  if (configured.includes('slack') && task.notify_slack_webhook_url) {
    groups.push({
      channels: ['webhook'],
      data: { webhook_url: task.notify_slack_webhook_url, provider: 'slack' },
    });
  }

  return groups;
}

function publishTaskNotification(
  nc: NatsConnection,
  task: any,
  outcome: 'success' | 'error',
  durationMs: number,
  error?: string,
): void {
  const groups = mapTaskChannelsToNotify(task);
  if (groups.length === 0) return;

  const msg = buildTaskNotifyMessages(String(task.name || 'Scheduled task'), outcome, durationMs, error);
  const baseData: Record<string, unknown> = {
    task_id: task.id,
    task_name: task.name,
    scheduled_task_id: task.id,
    organization_id: task.organization_id || null,
    outcome,
    duration_ms: durationMs,
    error: error || null,
  };

  for (const group of groups) {
    const envelope: EventEnvelope<NotifyPushEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'scheduler.task',
        recipient_user_id: task.user_id,
        channels: group.channels,
        title: msg.title,
        body: msg.body,
        data: {
          ...baseData,
          ...(task.chat_id ? { chat_id: task.chat_id } : {}),
          ...(task.notify_email_to ? { email_to: task.notify_email_to } : {}),
          ...group.data,
        },
        priority: outcome === 'error' ? 'high' : 'normal',
      },
    };
    nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
  }
}

function parseTimeOfDay(raw: unknown): { hour: number; minute: number } | null {
  const value = String(raw || '').trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function buildDailyCron(time: { hour: number; minute: number }): string {
  return `${time.minute} ${time.hour} * * *`;
}

function buildProactiveInstruction(type: string, reminderText?: string): string {
  if (type === 'daily_briefing') {
    return 'Send a concise daily briefing with priorities, pending tasks, and key follow-ups for today.';
  }
  if (type === 'daily_digest') {
    return 'Send a daily digest summarizing important updates, unresolved items, and suggested next actions.';
  }
  const text = String(reminderText || '').trim();
  return text
    ? `Send this reminder to the user: ${text}`
    : 'Send a reminder to check pending tasks and priorities.';
}

function parseAckMaxChars(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let normalized: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      normalized = JSON.parse(trimmed);
    } catch {
      normalized = trimmed;
    }
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < MIN_PROACTIVE_ACK_MAX_CHARS || parsed > MAX_PROACTIVE_ACK_MAX_CHARS) return null;
  return parsed;
}

async function resolveProactiveAckMaxChars(pool: pg.Pool): Promise<number | null> {
  const envValue = parseAckMaxChars(process.env.PROACTIVE_ACK_MAX_CHARS);
  if (envValue !== null) return envValue;

  const res = await pool.query(
    `SELECT key, value
     FROM settings_global
     WHERE key = ANY($1::text[])`,
    [[
      'agent.proactive.ackMaxChars',
      'agent.heartbeat.ackMaxChars',
      'agent.proactive.ack_max_chars',
    ]],
  );
  const byKey = new Map<string, unknown>();
  for (const row of res.rows as Array<{ key?: unknown; value?: unknown }>) {
    byKey.set(String(row.key || ''), row.value);
  }

  const precedence = [
    'agent.proactive.ackMaxChars',
    'agent.heartbeat.ackMaxChars',
    'agent.proactive.ack_max_chars',
  ];
  for (const key of precedence) {
    if (!byKey.has(key)) continue;
    const parsed = parseAckMaxChars(byKey.get(key));
    if (parsed !== null) return parsed;
  }
  return null;
}

function applyProactiveAckMaxChars(instruction: string, maxChars: number | null): string {
  if (maxChars === null) return instruction;
  if (/\back(?:_| )?max(?:_| )?chars\b/i.test(instruction) || /\bunder\s+\d+\s+characters\b/i.test(instruction)) {
    return instruction;
  }
  return `${instruction}\n\nOutput constraint: keep the final user-facing acknowledgment under ${maxChars} characters.`;
}

async function scheduledTasksHasColumn(pool: pg.Pool, columnName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'scheduled_tasks'
        AND column_name = $1
      LIMIT 1`,
    [columnName],
  );
  return result.rows.length > 0;
}

async function resolveScheduledTaskOrganizationId(pool: pg.Pool, task: any): Promise<string | null> {
  const direct = String(task?.organization_id || '').trim();
  if (direct) return direct;

  const chatId = String(task?.chat_id || '').trim();
  if (chatId) {
    const chatResult = await pool.query(
      `SELECT organization_id
         FROM chats
        WHERE id = $1
        LIMIT 1`,
      [chatId],
    );
    const fromChat = String(chatResult.rows[0]?.organization_id || '').trim();
    if (fromChat) return fromChat;
  }

  const userId = String(task?.user_id || '').trim();
  if (userId) {
    const membershipResult = await pool.query(
      `SELECT organization_id
         FROM organization_memberships
        WHERE user_id = $1
          AND status = 'active'
        ORDER BY created_at ASC NULLS LAST, organization_id ASC
        LIMIT 1`,
      [userId],
    );
    const fromMembership = String(membershipResult.rows[0]?.organization_id || '').trim();
    if (fromMembership) return fromMembership;
  }

  const orgResult = await pool.query(
    `SELECT id
       FROM organizations
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1`,
  );
  const fallback = String(orgResult.rows[0]?.id || '').trim();
  return fallback || null;
}

// ─── Tick: execute due scheduled tasks ────────────────────────────

async function tickScheduler(pool: pg.Pool, nc: NatsConnection): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    const lockRes = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [SCHEDULER_TICK_ADVISORY_LOCK_KEY],
    );
    lockAcquired = Boolean(lockRes.rows[0]?.locked);
    if (!lockAcquired) {
      logger.debug('Scheduler tick skipped because another worker holds the advisory lock');
      return;
    }

    const hasOrgColumn = await scheduledTasksHasColumn(pool, 'organization_id');
    const hasProactiveTypeColumn = await scheduledTasksHasColumn(pool, 'proactive_type');
    const due = await pool.query(
      hasOrgColumn
        ? `SELECT id, user_id, organization_id, agent_id, chat_id, name, instruction, schedule_type,
                  expression, timezone, missed_policy, run_count, max_runs, next_run,
                  notify_channels, notify_email_to, notify_webhook_url, notify_slack_webhook_url,
                  ${hasProactiveTypeColumn ? 'proactive_type' : 'NULL::text AS proactive_type'}
           FROM scheduled_tasks
           WHERE enabled = TRUE
             AND (
               (schedule_type = 'once' AND run_at <= NOW() AND run_count = 0)
               OR
               (schedule_type = 'recurring' AND (next_run IS NULL OR next_run <= NOW()))
             )
           ORDER BY COALESCE(next_run, run_at) ASC NULLS FIRST
           LIMIT 25`
        : `SELECT id, user_id, NULL::text AS organization_id, agent_id, chat_id, name, instruction, schedule_type,
                  expression, timezone, missed_policy, run_count, max_runs, next_run,
                  notify_channels, notify_email_to, notify_webhook_url, notify_slack_webhook_url,
                  ${hasProactiveTypeColumn ? 'proactive_type' : 'NULL::text AS proactive_type'}
           FROM scheduled_tasks
           WHERE enabled = TRUE
             AND (
               (schedule_type = 'once' AND run_at <= NOW() AND run_count = 0)
               OR
               (schedule_type = 'recurring' AND (next_run IS NULL OR next_run <= NOW()))
             )
           ORDER BY COALESCE(next_run, run_at) ASC NULLS FIRST
           LIMIT 25`,
    );

    const now = new Date();

    for (const task of due.rows) {
      if (
        task.schedule_type === 'recurring'
        && task.missed_policy === 'skip'
        && task.next_run
        && task.expression
      ) {
        const lastPlanned = new Date(task.next_run);
        const nextAfter = computeNextRun(task.expression, lastPlanned, String(task.timezone || 'UTC'));
        if (nextAfter && now >= nextAfter) {
          const nextRun = computeNextRun(task.expression, now, String(task.timezone || 'UTC'));
          await pool.query(
            `UPDATE scheduled_tasks
             SET next_run = $2, updated_at = NOW()
             WHERE id = $1`,
            [task.id, nextRun?.toISOString() || null],
          );
          logger.info('Skipping missed scheduled task run', {
            taskId: task.id,
            name: task.name,
            nextRun: nextRun?.toISOString() || null,
          });
          continue;
        }
      }

      await executeScheduledTask(pool, nc, task);
    }
  } catch (err) {
    logger.warn('Scheduler tick failed', { error: String(err) });
  } finally {
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [SCHEDULER_TICK_ADVISORY_LOCK_KEY]);
      } catch (unlockErr) {
        logger.warn('Scheduler advisory lock release failed', { error: String(unlockErr) });
      }
    }
    client.release();
  }
}

async function executeScheduledTask(pool: pg.Pool, nc: NatsConnection, task: any): Promise<void> {
  const runId = uuidv7();
  const started = Date.now();
  const maxConcurrentRuns = Number(task.max_concurrent_runs || 1);
  const sessionRetention = parseSessionRetention(task.session_retention, 'sticky') || 'sticky';

  const activeRuns = await pool.query(
    `SELECT COUNT(*)::integer AS running_count
     FROM scheduled_task_runs
     WHERE scheduled_task_id = $1
       AND status = 'running'`,
    [task.id],
  );
  const runningCount = Number(activeRuns.rows[0]?.running_count || 0);
  if (runningCount >= maxConcurrentRuns) {
    logger.info('Scheduled task skipped because max concurrency is reached', {
      taskId: task.id,
      runningCount,
      maxConcurrentRuns,
    });
    return;
  }

  await pool.query(
    `INSERT INTO scheduled_task_runs (id, scheduled_task_id, started_at, status)
     VALUES ($1, $2, NOW(), 'running')`,
    [runId, task.id],
  );

  try {
    const resolvedOrganizationId = await resolveScheduledTaskOrganizationId(pool, task);
    if (!resolvedOrganizationId) {
      throw new Error('scheduled task execution requires organization_id context');
    }
    const isProactivePreset = PROACTIVE_TYPES.has(String(task.proactive_type || '').trim());
    const proactiveAckMaxChars = isProactivePreset
      ? await resolveProactiveAckMaxChars(pool)
      : null;
    const instructionText = isProactivePreset
      ? applyProactiveAckMaxChars(String(task.instruction || ''), proactiveAckMaxChars)
      : String(task.instruction || '');

    // Publish instruction as an inbound message to the agent runtime
    const chatId = task.chat_id || (
      sessionRetention === 'ephemeral'
        ? `scheduled:${task.id}:${runId}`
        : `scheduled:${task.id}`
    );
    const envelope: EventEnvelope<{
      type: string;
      organization_id: string;
      chat_id: string;
      user_id: string;
      agent_id?: string;
      text: string;
      source: string;
      scheduled_task_id: string;
    }> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'scheduled_task',
        organization_id: resolvedOrganizationId,
        chat_id: chatId,
        user_id: task.user_id,
        agent_id: task.agent_id || undefined,
        text: instructionText,
        source: 'scheduler',
        scheduled_task_id: task.id,
      },
    };

    nc.publish(
      NATS_SUBJECTS.inboundMessage('scheduler'),
      jc.encode(envelope),
    );

    const durationMs = Date.now() - started;

    await pool.query(
      `UPDATE scheduled_task_runs
       SET status = 'success', finished_at = NOW(), duration_ms = $2
       WHERE id = $1`,
      [runId, durationMs],
    );

    // Update task state
    const newRunCount = Number(task.run_count) + 1;
    const maxRuns = task.max_runs != null ? Number(task.max_runs) : null;

    if (task.schedule_type === 'once' || (maxRuns !== null && newRunCount >= maxRuns)) {
      // One-time task or max runs reached — disable
      await pool.query(
        `UPDATE scheduled_tasks
         SET last_run = NOW(), run_count = $2, enabled = FALSE, updated_at = NOW()
         WHERE id = $1`,
        [task.id, newRunCount],
      );
    } else {
      // Recurring — compute next run
      const nextRun = computeNextRun(task.expression, new Date(), String(task.timezone || 'UTC'));
      await pool.query(
        `UPDATE scheduled_tasks
         SET last_run = NOW(), next_run = $2, run_count = $3, updated_at = NOW()
         WHERE id = $1`,
        [task.id, nextRun?.toISOString() || null, newRunCount],
      );
    }

    publishTaskNotification(nc, task, 'success', durationMs);
    logger.info('Scheduled task executed', { taskId: task.id, name: task.name, runId });
  } catch (err) {
    const durationMs = Date.now() - started;
    await pool.query(
      `UPDATE scheduled_task_runs
       SET status = 'error', finished_at = NOW(), error = $2, duration_ms = $3
       WHERE id = $1`,
      [runId, String(err), durationMs],
    );
    publishTaskNotification(nc, task, 'error', durationMs, String(err));
    logger.error('Scheduled task failed', { taskId: task.id, error: String(err) });
  }
}

// ─── Routes ───────────────────────────────────────────────────────

export async function registerSchedulerRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  const authenticated = requireRole(pool, 'admin', 'user');
  const currentOrgId = (request: any): string | null => {
    const orgId = String(request.orgId || '').trim();
    return orgId || null;
  };
  const ensureOrgScope = (request: any, reply: any): string | null => {
    const orgId = currentOrgId(request);
    if (orgId) return orgId;
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return null;
  };
  const ensureChatInOrg = async (chatId: string, orgId: string): Promise<boolean> => {
    const result = await pool.query(
      `SELECT id
       FROM chats
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1`,
      [chatId, orgId],
    );
    return result.rows.length > 0;
  };
  const ensureAgentInOrg = async (agentId: string, orgId: string): Promise<boolean> => {
    const result = await pool.query(
      `SELECT asn.agent_id
       FROM agent_sessions asn
       JOIN chats c ON c.id = asn.session_id
       WHERE asn.agent_id = $1
         AND c.organization_id = $2
       LIMIT 1`,
      [agentId, orgId],
    );
    return result.rows.length > 0;
  };

  // ─── GET /v1/schedules — list user's scheduled tasks ───
  app.get('/v1/schedules', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const query = (request.query as { limit?: string | number; offset?: string | number }) || {};
    const pagination = parsePagination(query.limit, query.offset);
    if (!pagination) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `limit must be an integer between 1 and ${MAX_SCHEDULE_LIST_LIMIT}; offset must be an integer >= 0`,
        },
      });
    }
    const hasOrgColumn = await scheduledTasksHasColumn(pool, 'organization_id');
    const res = await pool.query(
      hasOrgColumn
        ? `SELECT id, name, instruction, schedule_type, expression, run_at, timezone,
                  enabled, last_run, next_run, run_count, max_runs, agent_id, chat_id,
                  missed_policy, notify_channels, notify_email_to, notify_webhook_url,
                  notify_slack_webhook_url, created_at, updated_at,
                  (
                    SELECT status
                    FROM scheduled_task_runs r
                    WHERE r.scheduled_task_id = scheduled_tasks.id
                    ORDER BY started_at DESC
                    LIMIT 1
                  ) AS last_status
           FROM scheduled_tasks
           WHERE user_id = $1
             AND organization_id = $2
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4`
        : `SELECT id, name, instruction, schedule_type, expression, run_at, timezone,
                  enabled, last_run, next_run, run_count, max_runs, agent_id, chat_id,
                  missed_policy, notify_channels, notify_email_to, notify_webhook_url,
                  notify_slack_webhook_url, created_at, updated_at,
                  (
                    SELECT status
                    FROM scheduled_task_runs r
                    WHERE r.scheduled_task_id = scheduled_tasks.id
                    ORDER BY started_at DESC
                    LIMIT 1
                  ) AS last_status
           FROM scheduled_tasks
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
      hasOrgColumn
        ? [userId, orgId, pagination.limit, pagination.offset]
        : [userId, pagination.limit, pagination.offset],
    );
    reply.send({ success: true, data: res.rows });
  });

  // ─── POST /v1/schedules — create a scheduled task ───
  app.post('/v1/schedules', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const body = (request.body as {
      name?: string;
      instruction?: string;
      schedule_type?: 'once' | 'recurring';
      expression?: string;
      run_at?: string;
      timezone?: string;
      enabled?: boolean;
      agent_id?: string;
      chat_id?: string;
      max_runs?: number;
      max_concurrent_runs?: number;
      session_retention?: 'sticky' | 'ephemeral';
      missed_policy?: 'skip' | 'run_immediately';
      notify_channels?: string[];
      notify_email_to?: string;
      notify_webhook_url?: string;
      notify_slack_webhook_url?: string;
    }) || {};

    const name = String(body.name || '').trim();
    const instruction = String(body.instruction || '').trim();
    const scheduleType = body.schedule_type || 'recurring';

    if (!name) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name is required' },
      });
    }
    if (!instruction) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'instruction is required' },
      });
    }

    const timezone = resolveTimezone(body.timezone || 'UTC');
    if (!timezone) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'timezone must be a valid IANA timezone' },
      });
    }

    let nextRun: Date | null = null;
    let runAt: Date | null = null;

    if (scheduleType === 'recurring') {
      if (!body.expression || !isValidCron(body.expression)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'Valid cron expression is required for recurring tasks' },
        });
      }
      nextRun = computeNextRun(body.expression, new Date(), timezone);
    } else if (scheduleType === 'once') {
      if (!body.run_at) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'run_at datetime is required for one-time tasks' },
        });
      }
      runAt = new Date(body.run_at);
      if (isNaN(runAt.getTime())) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'run_at must be a valid ISO datetime' },
        });
      }
    } else {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'schedule_type must be "once" or "recurring"' },
      });
    }

    const id = uuidv7();
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
    const maxConcurrentRuns = parseMaxConcurrentRuns(body.max_concurrent_runs);
    if (body.max_concurrent_runs !== undefined && maxConcurrentRuns === null) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'max_concurrent_runs must be an integer between 1 and 1000' },
      });
    }
    const missedPolicy = parseMissedPolicy(body.missed_policy, 'skip');
    if (!missedPolicy) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'missed_policy must be one of: skip, run_immediately' },
      });
    }
    const sessionRetention = parseSessionRetention(body.session_retention, 'sticky');
    if (!sessionRetention) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'session_retention must be one of: sticky, ephemeral' },
      });
    }
    const notifyChannels = normalizeNotifyChannels(body.notify_channels);
    const notifyEmailTo = normalizeOptionalEmail(body.notify_email_to);
    const notifyWebhookUrl = normalizeOptionalUrl(body.notify_webhook_url);
    const notifySlackWebhookUrl = normalizeOptionalUrl(body.notify_slack_webhook_url);
    const requestedChatId = String(body.chat_id || '').trim();
    if (requestedChatId) {
      const chatAllowed = await ensureChatInOrg(requestedChatId, orgId);
      if (!chatAllowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'chat_id must belong to active organization' },
        });
      }
    }
    const requestedAgentId = String(body.agent_id || '').trim();
    if (requestedAgentId) {
      const agentAllowed = await ensureAgentInOrg(requestedAgentId, orgId);
      if (!agentAllowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'agent_id must belong to active organization' },
        });
      }
    }
    if (notifyChannels.includes('email') && !notifyEmailTo) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_email_to is required for email notifications' },
      });
    }
    if (notifyChannels.includes('webhook') && !notifyWebhookUrl) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_webhook_url is required for webhook notifications' },
      });
    }
    if (notifyChannels.includes('slack') && !notifySlackWebhookUrl) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_slack_webhook_url is required for Slack notifications' },
      });
    }

    await pool.query(
      `INSERT INTO scheduled_tasks
         (id, user_id, organization_id, agent_id, chat_id, name, instruction, schedule_type,
          expression, run_at, timezone, enabled, next_run, missed_policy,
          max_runs, max_concurrent_runs, session_retention, notify_channels, notify_email_to, notify_webhook_url, notify_slack_webhook_url,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21, NOW(), NOW())`,
      [
        id,
        userId,
        orgId,
        requestedAgentId || null,
        requestedChatId || null,
        name,
        instruction,
        scheduleType,
        body.expression || null,
        runAt?.toISOString() || null,
        timezone,
        enabled,
        nextRun?.toISOString() || runAt?.toISOString() || null,
        missedPolicy,
        body.max_runs ?? null,
        maxConcurrentRuns ?? 1,
        sessionRetention,
        JSON.stringify(notifyChannels),
        notifyEmailTo,
        notifyWebhookUrl,
        notifySlackWebhookUrl,
      ],
    );

    reply.status(201).send({ success: true, data: { id, name, next_run: nextRun || runAt } });
  });

  // ─── POST /v1/schedules/proactive — create proactive preset task ───
  app.post('/v1/schedules/proactive', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const body = (request.body as {
      type?: 'daily_briefing' | 'daily_digest' | 'reminder';
      time?: string;
      timezone?: string;
      chat_id?: string;
      agent_id?: string;
      reminder_text?: string;
      notify_channels?: string[];
      notify_email_to?: string;
      notify_webhook_url?: string;
      notify_slack_webhook_url?: string;
    }) || {};

    const type = String(body.type || '').trim();
    if (!PROACTIVE_TYPES.has(type)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'type must be one of: daily_briefing, daily_digest, reminder' },
      });
    }

    const time = parseTimeOfDay(body.time || '09:00');
    if (!time) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'time must use HH:MM (24h) format' },
      });
    }

    const timezone = resolveTimezone(body.timezone || 'UTC');
    if (!timezone) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'timezone must be a valid IANA timezone' },
      });
    }

    const expression = buildDailyCron(time);
    const nextRun = computeNextRun(expression, new Date(), timezone);
    if (!nextRun) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Failed to compute next run from time/expression' },
      });
    }

    const id = uuidv7();
    const name = `${PROACTIVE_NAME_PREFIX}${type}] ${type.replace(/_/g, ' ')}`;
    const instruction = buildProactiveInstruction(type, body.reminder_text);
    const notifyChannels = normalizeNotifyChannels(body.notify_channels || ['in_app']);
    const notifyEmailTo = normalizeOptionalEmail(body.notify_email_to);
    const notifyWebhookUrl = normalizeOptionalUrl(body.notify_webhook_url);
    const notifySlackWebhookUrl = normalizeOptionalUrl(body.notify_slack_webhook_url);
    const requestedChatId = String(body.chat_id || '').trim();
    if (requestedChatId) {
      const chatAllowed = await ensureChatInOrg(requestedChatId, orgId);
      if (!chatAllowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'chat_id must belong to active organization' },
        });
      }
    }
    const requestedAgentId = String(body.agent_id || '').trim();
    if (requestedAgentId) {
      const agentAllowed = await ensureAgentInOrg(requestedAgentId, orgId);
      if (!agentAllowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'agent_id must belong to active organization' },
        });
      }
    }
    if (notifyChannels.includes('email') && !notifyEmailTo) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_email_to is required for email notifications' },
      });
    }
    if (notifyChannels.includes('webhook') && !notifyWebhookUrl) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_webhook_url is required for webhook notifications' },
      });
    }
    if (notifyChannels.includes('slack') && !notifySlackWebhookUrl) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_slack_webhook_url is required for Slack notifications' },
      });
    }

    await pool.query(
      `INSERT INTO scheduled_tasks
         (id, user_id, organization_id, agent_id, chat_id, name, instruction, schedule_type,
          expression, run_at, timezone, enabled, next_run, missed_policy, max_runs, max_concurrent_runs, session_retention,
          notify_channels, notify_email_to, notify_webhook_url, notify_slack_webhook_url, proactive_type,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'recurring', $8, NULL, $9, TRUE, $10, 'run_immediately', NULL, 1, 'sticky', $11::jsonb, $12, $13, $14, $15, NOW(), NOW())`,
      [
        id,
        userId,
        orgId,
        requestedAgentId || null,
        requestedChatId || null,
        name,
        instruction,
        expression,
        timezone,
        nextRun.toISOString(),
        JSON.stringify(notifyChannels),
        notifyEmailTo,
        notifyWebhookUrl,
        notifySlackWebhookUrl,
        type,
      ],
    );

    reply.status(201).send({
      success: true,
      data: {
        id,
        type,
        name,
        expression,
        timezone,
        next_run: nextRun.toISOString(),
      },
    });
  });

  // ─── GET /v1/schedules/proactive — list proactive preset tasks ───
  app.get('/v1/schedules/proactive', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const query = (request.query as { limit?: string | number; offset?: string | number }) || {};
    const pagination = parsePagination(query.limit, query.offset);
    if (!pagination) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `limit must be an integer between 1 and ${MAX_SCHEDULE_LIST_LIMIT}; offset must be an integer >= 0`,
        },
      });
    }
    const res = await pool.query(
      `SELECT id, name, instruction, expression, timezone, enabled, next_run, last_run, run_count, max_concurrent_runs, session_retention, created_at, updated_at, proactive_type
       FROM scheduled_tasks
       WHERE user_id = $1
         AND organization_id = $2
         AND schedule_type = 'recurring'
         AND proactive_type IN ('daily_briefing', 'daily_digest', 'reminder')
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, orgId, pagination.limit, pagination.offset],
    );

    const rows = res.rows.map((row) => {
      const type = String((row as Record<string, unknown>).proactive_type || 'unknown');
      return { ...row, type };
    });
    reply.send({ success: true, data: rows });
  });

  // ─── DELETE /v1/schedules/proactive/:id — delete proactive preset task ───
  app.delete('/v1/schedules/proactive/:id', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const ownership = await pool.query(
      `SELECT id, proactive_type
       FROM scheduled_tasks
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, orgId],
    );
    if (ownership.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
      });
    }
    const proactiveType = String((ownership.rows[0] as Record<string, unknown>).proactive_type || '').trim();
    if (!PROACTIVE_TYPES.has(proactiveType)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Task is not a proactive preset task' },
      });
    }

    await pool.query(`DELETE FROM scheduled_tasks WHERE id = $1 AND user_id = $2 AND organization_id = $3`, [id, userId, orgId]);
    reply.send({ success: true });
  });

  // ─── GET /v1/schedules/:id — get single task ───
  app.get('/v1/schedules/:id', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const res = await pool.query(
      `SELECT id, name, instruction, schedule_type, expression, run_at, timezone,
              enabled, last_run, next_run, run_count, max_runs, max_concurrent_runs, session_retention, agent_id, chat_id,
              missed_policy, notify_channels, notify_email_to, notify_webhook_url,
              notify_slack_webhook_url, created_at, updated_at,
              (
                SELECT status
                FROM scheduled_task_runs r
                WHERE r.scheduled_task_id = scheduled_tasks.id
                ORDER BY started_at DESC
                LIMIT 1
              ) AS last_status
       FROM scheduled_tasks
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, orgId],
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
      });
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  // ─── PUT /v1/schedules/:id — update task ───
  app.put('/v1/schedules/:id', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const current = await pool.query(
      `SELECT id, schedule_type, expression, timezone, max_concurrent_runs, session_retention, notify_channels, notify_email_to, notify_webhook_url, notify_slack_webhook_url
       FROM scheduled_tasks
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, orgId],
    );
    if (current.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
      });
    }

    const body = (request.body as {
      name?: string;
      instruction?: string;
      expression?: string;
      run_at?: string;
      timezone?: string;
      enabled?: boolean;
      agent_id?: string;
      chat_id?: string;
      max_runs?: number | null;
      max_concurrent_runs?: number | null;
      session_retention?: string | null;
      missed_policy?: string | null;
      notify_channels?: string[];
      notify_email_to?: string | null;
      notify_webhook_url?: string | null;
      notify_slack_webhook_url?: string | null;
    }) || {};
    const requestedChatId = body.chat_id !== undefined ? String(body.chat_id || '').trim() : '';
    if (body.chat_id !== undefined && requestedChatId) {
      const chatAllowed = await ensureChatInOrg(requestedChatId, orgId);
      if (!chatAllowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'chat_id must belong to active organization' },
        });
      }
    }
    const requestedAgentId = body.agent_id !== undefined ? String(body.agent_id || '').trim() : '';
    if (body.agent_id !== undefined && requestedAgentId) {
      const agentAllowed = await ensureAgentInOrg(requestedAgentId, orgId);
      if (!agentAllowed) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'agent_id must belong to active organization' },
        });
      }
    }

    const timezonePatch = body.timezone !== undefined ? resolveTimezone(body.timezone) : null;
    if (body.timezone !== undefined && !timezonePatch) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'timezone must be a valid IANA timezone' },
      });
    }

    // Validate cron if changing expression on recurring task
    const scheduleType = current.rows[0].schedule_type;
    const currentTimezone = resolveTimezone((current.rows[0] as Record<string, unknown>).timezone) || 'UTC';
    const effectiveTimezone = timezonePatch || currentTimezone;
    let newNextRun: string | null = null;

    if (scheduleType === 'recurring' && (body.expression || body.timezone !== undefined)) {
      const expression = body.expression || String((current.rows[0] as Record<string, unknown>).expression || '');
      if (!isValidCron(expression)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'Invalid cron expression' },
        });
      }
      const next = computeNextRun(expression, new Date(), effectiveTimezone);
      newNextRun = next?.toISOString() || null;
    }

    let runAtIso: string | null = null;
    if (body.run_at) {
      const runAt = new Date(body.run_at);
      if (isNaN(runAt.getTime())) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'run_at must be a valid ISO datetime' },
        });
      }
      runAtIso = runAt.toISOString();
      if (scheduleType === 'once') {
        newNextRun = runAtIso;
      }
    }

    const notifyChannels = body.notify_channels !== undefined
      ? normalizeNotifyChannels(body.notify_channels)
      : null;
    const maxConcurrentRunsPatch = body.max_concurrent_runs !== undefined ? parseMaxConcurrentRuns(body.max_concurrent_runs) : undefined;
    if (body.max_concurrent_runs !== undefined && maxConcurrentRunsPatch === null) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'max_concurrent_runs must be an integer between 1 and 1000' },
      });
    }
    const missedPolicyPatch = parseMissedPolicyPatch(body.missed_policy);
    if (!missedPolicyPatch.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'missed_policy must be one of: skip, run_immediately' },
      });
    }
    const sessionRetentionPatch = parseSessionRetentionPatch(body.session_retention);
    if (!sessionRetentionPatch.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'session_retention must be one of: sticky, ephemeral' },
      });
    }
    const notifyEmailPatch = parseOptionalEmailPatch(body.notify_email_to);
    const notifyWebhookPatch = parseOptionalUrlPatch(body.notify_webhook_url);
    const notifySlackWebhookPatch = parseOptionalUrlPatch(body.notify_slack_webhook_url);
    if (!notifyEmailPatch.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_email_to must be a valid email or null' },
      });
    }
    if (!notifyWebhookPatch.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_webhook_url must be a valid webhook URL allowed by policy or null' },
      });
    }
    if (!notifySlackWebhookPatch.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_slack_webhook_url must be a valid webhook URL allowed by policy or null' },
      });
    }
    const currentTask = current.rows[0] as Record<string, unknown>;
    const effectiveNotifyChannels = notifyChannels
      || normalizeNotifyChannels(currentTask.notify_channels);
    const effectiveNotifyEmail = notifyEmailPatch.provided
      ? notifyEmailPatch.value
      : normalizeOptionalEmail(currentTask.notify_email_to);
    const effectiveNotifyWebhook = notifyWebhookPatch.provided
      ? notifyWebhookPatch.value
      : normalizeOptionalUrl(currentTask.notify_webhook_url);
    const effectiveNotifySlackWebhook = notifySlackWebhookPatch.provided
      ? notifySlackWebhookPatch.value
      : normalizeOptionalUrl(currentTask.notify_slack_webhook_url);

    if (effectiveNotifyChannels.includes('email') && !effectiveNotifyEmail) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_email_to is required for email notifications' },
      });
    }
    if (effectiveNotifyChannels.includes('webhook') && !effectiveNotifyWebhook) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_webhook_url is required for webhook notifications' },
      });
    }
    if (effectiveNotifyChannels.includes('slack') && !effectiveNotifySlackWebhook) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'notify_slack_webhook_url is required for Slack notifications' },
      });
    }

    await pool.query(
      `UPDATE scheduled_tasks
       SET name = COALESCE($3, name),
           instruction = COALESCE($4, instruction),
           expression = COALESCE($5, expression),
           run_at = COALESCE($6, run_at),
           timezone = COALESCE($7, timezone),
           enabled = COALESCE($8, enabled),
           agent_id = COALESCE($9, agent_id),
           chat_id = COALESCE($10, chat_id),
           max_runs = COALESCE($11, max_runs),
           missed_policy = COALESCE($12, missed_policy),
           next_run = COALESCE($13, next_run),
           notify_channels = COALESCE($14::jsonb, notify_channels),
           notify_email_to = CASE WHEN $18::boolean THEN $15 ELSE notify_email_to END,
           notify_webhook_url = CASE WHEN $19::boolean THEN $16 ELSE notify_webhook_url END,
           notify_slack_webhook_url = CASE WHEN $20::boolean THEN $17 ELSE notify_slack_webhook_url END,
           max_concurrent_runs = COALESCE($22, max_concurrent_runs),
           session_retention = COALESCE($23, session_retention),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND organization_id = $21`,
      [
        id,
        userId,
        body.name || null,
        body.instruction || null,
        body.expression || null,
        runAtIso,
        timezonePatch,
        typeof body.enabled === 'boolean' ? body.enabled : null,
        requestedAgentId || null,
        requestedChatId || null,
        body.max_runs !== undefined ? body.max_runs : null,
        missedPolicyPatch.provided ? missedPolicyPatch.value : null,
        newNextRun,
        notifyChannels ? JSON.stringify(notifyChannels) : null,
        notifyEmailPatch.value,
        notifyWebhookPatch.value,
        notifySlackWebhookPatch.value,
        notifyEmailPatch.provided,
        notifyWebhookPatch.provided,
        notifySlackWebhookPatch.provided,
        orgId,
        maxConcurrentRunsPatch ?? null,
        sessionRetentionPatch.provided ? sessionRetentionPatch.value : null,
      ],
    );

    reply.send({ success: true });
  });

  // ─── DELETE /v1/schedules/:id — delete task ───
  app.delete('/v1/schedules/:id', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const res = await pool.query(
      `DELETE FROM scheduled_tasks WHERE id = $1 AND user_id = $2 AND organization_id = $3 RETURNING id`,
      [id, userId, orgId],
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
      });
    }

    reply.send({ success: true });
  });

  // ─── GET /v1/schedules/:id/history — run history ───
  app.get('/v1/schedules/:id/history', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string | number };
    const limit = parseScheduleHistoryLimit(query.limit);
    if (limit === null) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `limit must be an integer between 1 and ${MAX_SCHEDULE_HISTORY_LIMIT}`,
        },
      });
    }

    // Verify ownership
    const ownership = await pool.query(
      `SELECT id FROM scheduled_tasks WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, orgId],
    );
    if (ownership.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
      });
    }

    const res = await pool.query(
      `SELECT id, scheduled_task_id, started_at, finished_at, status, result, error, duration_ms
       FROM scheduled_task_runs
       WHERE scheduled_task_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [id, limit],
    );

    reply.send({ success: true, data: res.rows });
  });

  // ─── POST /v1/schedules/:id/run — manual run now ───
  app.post('/v1/schedules/:id/run', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const orgId = ensureOrgScope(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const res = await pool.query(
      `SELECT id, user_id, organization_id, agent_id, chat_id, name, instruction, schedule_type,
              expression, timezone, enabled, missed_policy, run_count, max_runs, max_concurrent_runs, session_retention,
              notify_channels, notify_email_to, notify_webhook_url, notify_slack_webhook_url
       FROM scheduled_tasks
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, orgId],
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
      });
    }
    if (res.rows[0].enabled !== true) {
      return reply.status(409).send({
        success: false,
        error: { code: 'TASK_DISABLED', message: 'Scheduled task is disabled and cannot be run manually' },
      });
    }
    const activeRuns = await pool.query(
      `SELECT COUNT(*)::integer AS running_count
       FROM scheduled_task_runs
       WHERE scheduled_task_id = $1
         AND status = 'running'`,
      [id],
    );
    const runningCount = Number(activeRuns.rows[0]?.running_count || 0);
    const maxConcurrentRuns = Number(res.rows[0].max_concurrent_runs || 1);
    if (runningCount >= maxConcurrentRuns) {
      return reply.status(409).send({
        success: false,
        error: { code: 'TASK_CONCURRENCY_LIMIT', message: 'Scheduled task has reached max concurrent runs' },
      });
    }

    await executeScheduledTask(pool, nc, res.rows[0]);
    reply.send({ success: true });
  });

  // ─── Start scheduler tick ───
  if (!schedulerStarted) {
    const tickIntervalMs = parseSchedulerTickIntervalMs(process.env.SCHEDULER_TICK_MS);
    schedulerStarted = true;
    schedulerTimer = setInterval(() => {
      void tickScheduler(pool, nc);
    }, tickIntervalMs);
    logger.info('Scheduler tick started', {
      intervalMs: tickIntervalMs,
    });
  }

  app.addHook('onClose', async () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
      schedulerStarted = false;
    }
  });
}
