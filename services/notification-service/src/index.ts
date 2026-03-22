import { connect, JSONCodec, AckPolicy, DeliverPolicy } from 'nats';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import webpush from 'web-push';
import path from 'node:path';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import { ensureStreams } from '@sven/shared/nats/streams.js';
import type { ApprovalCreatedEvent, ApprovalUpdatedEvent, AudioIngestEvent, EventEnvelope, NotifyPushEvent } from '@sven/shared';

const logger = createLogger('notification-service');
const jc = JSONCodec();
const DEFAULT_POLL_INTERVAL_MS = 30000;
const MIN_HA_POLL_INTERVAL_MS = 1000;
const MAX_HA_POLL_INTERVAL_MS = 300000;
const DEFAULT_HA_REQUEST_TIMEOUT_MS = 5000;
const APPROVAL_EVENT_MAX_DELIVER = 5;
const NOTIFY_CONSUMER_DURABLE_NAME = 'notification-workers';
const APPROVAL_CONSUMER_DURABLE_NAME = 'notification-approval-workers';
const APPROVAL_QUARANTINE_SUBJECT = 'approval.quarantine';
const ALLOWED_NOTIFICATION_CHANNELS = new Set(['outbox', 'webhook', 'push', 'email']);
const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';
const WEB_PUSH_VAPID_SUBJECT = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:ops@sven.local';
const WEB_PUSH_VAPID_PUBLIC_KEY = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
const WEB_PUSH_VAPID_PRIVATE_KEY = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '';
const WEB_PUSH_ENABLED = !!(WEB_PUSH_VAPID_PUBLIC_KEY && WEB_PUSH_VAPID_PRIVATE_KEY);
const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;
const DEFAULT_WEBHOOK_RETRY_ATTEMPTS = 3;
const DEFAULT_WEBHOOK_RETRY_BASE_MS = 250;
const WEBHOOK_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'metadata.aws.internal',
]);
const WEBHOOK_BLOCKED_IP_LITERALS = new Set([
  '169.254.169.254',
  '100.100.100.200',
]);

if (WEB_PUSH_ENABLED) {
  webpush.setVapidDetails(WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY);
} else {
  logger.warn('Web Push disabled: VAPID keys not configured');
}

/**
 * Notification Service – delivers push notifications, digest emails,
 * and emergency alerts to admins.
 *
 * Subscribes to notify.push subject.
 * Notification channels: outbox (chat message), webhook, push, email.
 */

interface NotificationRecord {
  id: string;
  type: string;
  recipient_user_id: string | undefined;
  target_user_ids?: string[];
  channel: string;
  channels?: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  status: string;
  created_at: Date;
  delivered_at?: Date;
}

type HaSubscriptionRow = {
  id: string;
  chat_id: string;
  user_id: string | null;
  entity_id: string;
  match_state: string | null;
  match_attribute: string | null;
  match_value: string | null;
  cooldown_seconds: number;
  enabled: boolean;
  last_state: string | null;
  last_attributes: Record<string, unknown> | null;
  last_notified_at: string | null;
};

type HaAutomationRow = {
  id: string;
  name: string;
  description: string;
  chat_id: string;
  user_id: string | null;
  enabled: boolean;
  trigger: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  cooldown_seconds: number;
  last_state: string | null;
  last_attributes: Record<string, unknown> | null;
  last_triggered_at: string | null;
};

type HaPendingActionRow = {
  id: string;
  automation_id: string;
  approval_id: string;
  chat_id: string;
  user_id: string;
  service: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  status: string;
};

type ApprovalEnvelopeValidation =
  | { ok: true; event: ApprovalUpdatedEvent }
  | { ok: false; reason: string };

type AutomationExecutionSummary = {
  attempted: number;
  executed: number;
  approvalsCreated: number;
  blocked: number;
  failed: number;
};

function normalizeHaRequestTimeoutMs(value: unknown): number {
  const min = 250;
  const max = 30000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_HA_REQUEST_TIMEOUT_MS;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

function normalizeHaPollIntervalMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  const rounded = Math.trunc(parsed);
  if (rounded < MIN_HA_POLL_INTERVAL_MS || rounded > MAX_HA_POLL_INTERVAL_MS) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return rounded;
}

function buildHaRequestSignal(): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return undefined;
  }
  const timeoutMs = normalizeHaRequestTimeoutMs(process.env.HA_REQUEST_TIMEOUT_MS);
  return AbortSignal.timeout(timeoutMs);
}

function normalizeWebhookTimeoutMs(value: unknown): number {
  const min = 250;
  const max = 30000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WEBHOOK_TIMEOUT_MS;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

function normalizeWebhookRetryAttempts(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WEBHOOK_RETRY_ATTEMPTS;
  const rounded = Math.trunc(parsed);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

function normalizeWebhookRetryBaseMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WEBHOOK_RETRY_BASE_MS;
  const rounded = Math.trunc(parsed);
  if (rounded < 50) return 50;
  if (rounded > 5000) return 5000;
  return rounded;
}

function buildWebhookRequestSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return undefined;
  }
  return AbortSignal.timeout(timeoutMs);
}

function isRetryableWebhookStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function waitMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWebhookNotificationWithRetry(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const timeoutMs = normalizeWebhookTimeoutMs(process.env.NOTIFICATION_WEBHOOK_TIMEOUT_MS);
  const maxAttempts = normalizeWebhookRetryAttempts(process.env.NOTIFICATION_WEBHOOK_MAX_ATTEMPTS);
  const backoffBaseMs = normalizeWebhookRetryBaseMs(process.env.NOTIFICATION_WEBHOOK_RETRY_BASE_MS);

  let lastError = 'unknown webhook failure';
  const allowlist = resolveWebhookHostAllowlist(process.env.NOTIFICATION_WEBHOOK_ALLOWLIST_HOSTS);
  const validatedWebhookUrl = validateWebhookTargetUrl(webhookUrl, allowlist);
  if (!validatedWebhookUrl.ok) {
    return { ok: false, error: validatedWebhookUrl.error };
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(validatedWebhookUrl.url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: buildWebhookRequestSignal(timeoutMs),
      });
      if (res.ok) {
        return { ok: true };
      }
      lastError = `webhook responded with status ${res.status}`;
      if (!isRetryableWebhookStatus(res.status)) {
        return { ok: false, error: lastError };
      }
    } catch (err) {
      lastError = String(err instanceof Error ? err.message : err);
    }

    if (attempt < maxAttempts) {
      const backoffMs = Math.min(10000, backoffBaseMs * (2 ** (attempt - 1)));
      await waitMs(backoffMs);
    }
  }

  return { ok: false, error: lastError };
}

function resolveWebhookHostAllowlist(raw: unknown): string[] {
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

function validateWebhookTargetUrl(
  urlRaw: string,
  allowlist: string[],
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlRaw);
  } catch {
    return { ok: false, error: 'WEBHOOK_UNSAFE_TARGET: invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `WEBHOOK_UNSAFE_TARGET: unsupported scheme ${parsed.protocol}` };
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (!hostname) {
    return { ok: false, error: 'WEBHOOK_UNSAFE_TARGET: missing hostname' };
  }
  if (WEBHOOK_BLOCKED_HOSTNAMES.has(hostname) || WEBHOOK_BLOCKED_IP_LITERALS.has(hostname)) {
    return { ok: false, error: `WEBHOOK_UNSAFE_TARGET: blocked host ${hostname}` };
  }
  if (isPrivateOrLocalIpv4(hostname) || isPrivateOrLocalIpv6(hostname)) {
    return { ok: false, error: `WEBHOOK_UNSAFE_TARGET: private/local host ${hostname}` };
  }
  if (!isHostAllowlisted(hostname, allowlist)) {
    return { ok: false, error: `WEBHOOK_UNSAFE_TARGET: host ${hostname} not allowlisted` };
  }
  return { ok: true, url: parsed };
}

function validateApprovalUpdatedEnvelope(input: unknown): ApprovalEnvelopeValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'envelope_not_object' };
  }
  const envelope = input as Record<string, unknown>;
  if (typeof envelope.event_id !== 'string' || !envelope.event_id.trim()) {
    return { ok: false, reason: 'missing_event_id' };
  }
  if (typeof envelope.occurred_at !== 'string' || !envelope.occurred_at.trim()) {
    return { ok: false, reason: 'missing_occurred_at' };
  }
  if (typeof envelope.schema_version !== 'string' || !envelope.schema_version.trim()) {
    return { ok: false, reason: 'invalid_schema_version' };
  }
  const payload = envelope.data;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'missing_payload_data' };
  }
  const event = payload as Record<string, unknown>;
  const approvalId = String(event.approval_id || '').trim();
  const voterUserId = String(event.voter_user_id || '').trim();
  const vote = String(event.vote || '').trim();
  const status = String(event.status || '').trim();
  if (!approvalId) return { ok: false, reason: 'missing_approval_id' };
  if (!voterUserId) return { ok: false, reason: 'missing_voter_user_id' };
  if (vote !== 'approve' && vote !== 'deny') return { ok: false, reason: 'invalid_vote' };
  if (!['pending', 'approved', 'denied', 'expired'].includes(status)) {
    return { ok: false, reason: 'invalid_status' };
  }
  return {
    ok: true,
    event: {
      approval_id: approvalId,
      voter_user_id: voterUserId,
      vote: vote as 'approve' | 'deny',
      status: status as 'pending' | 'approved' | 'denied' | 'expired',
    },
  };
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

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function isTruthy(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeEmailAddress(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isValidEmailAddress(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveGmailAccessToken(): Promise<string> {
  const direct = String(process.env.GMAIL_ACCESS_TOKEN || '').trim();
  if (direct) return direct;
  const tokenRef = String(process.env.GMAIL_ACCESS_TOKEN_REF || '').trim();
  if (!tokenRef) return '';
  return String(await resolveSecretRef(tokenRef));
}

async function sendEmailNotification(
  to: string,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await resolveGmailAccessToken();
  if (!token) {
    return { ok: false, error: 'EMAIL_CHANNEL_UNAVAILABLE: GMAIL_ACCESS_TOKEN or GMAIL_ACCESS_TOKEN_REF is not configured' };
  }

  try {
    const from = String(process.env.GMAIL_FROM || '').trim();
    const safeSubject = String(payload.title || 'Sven notification').replace(/[\r\n]+/g, ' ').trim();
    const lines = [
      ...(from ? [`From: ${from}`] : []),
      `To: ${to}`,
      `Subject: ${safeSubject || 'Sven notification'}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      String(payload.body || ''),
    ];
    const raw = Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, error: `EMAIL_DELIVERY_FAILED: gmail api ${response.status}${detail ? ` ${detail}` : ''}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err || 'email delivery failed') };
  }
}

function isProductionProfile(env: NodeJS.ProcessEnv): boolean {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const svenEnv = String(env.SVEN_ENV || '').trim().toLowerCase();
  const flavor = String(env.SVEN_FLAVOR || '').trim().toLowerCase();
  return nodeEnv === 'production'
    || svenEnv === 'production'
    || svenEnv === 'prod'
    || flavor === 'prod'
    || flavor === 'production';
}

function normalizeList(raw: string | undefined): Set<string> {
  return new Set(
    String(raw || '')
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function parseFileRefPath(ref: string): string {
  try {
    const parsed = new URL(ref);
    let pathname = decodeURIComponent(parsed.pathname || '');
    if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    return String(ref || '').slice('file://'.length);
  }
}

async function toRealAbsPath(candidate: string): Promise<string | null> {
  const fs = await import('node:fs/promises');
  const abs = path.resolve(candidate);
  try {
    return await fs.realpath(abs);
  } catch {
    return null;
  }
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function resolveSecretRef(ref: string): Promise<string> {
  if (ref.startsWith('env://')) {
    const key = ref.slice('env://'.length);
    if (!key) throw new Error('Invalid env ref');
    const enforceAllowlist = isProductionProfile(process.env) || isTruthy(process.env.SVEN_SECRET_ENV_ENFORCE_ALLOWLIST);
    if (enforceAllowlist) {
      const allowlist = normalizeList(process.env.SVEN_SECRET_ENV_ALLOWLIST);
      if (!allowlist.has(key)) {
        throw new Error('env:// secret ref key is not allowlisted');
      }
    }
    const value = process.env[key];
    if (value === undefined) throw new Error(`Env var not set: ${key}`);
    return value;
  }

  if (ref.startsWith('file://')) {
    const filePath = parseFileRefPath(ref);
    if (!filePath) throw new Error('Invalid file ref');
    const fileRefEnabled = isTruthy(process.env.SVEN_SECRET_FILE_REF_ENABLED)
      || !isProductionProfile(process.env);
    if (!fileRefEnabled) {
      throw new Error('file:// secret refs are disabled');
    }
    const targetReal = await toRealAbsPath(filePath);
    if (!targetReal) {
      throw new Error('Invalid file ref path');
    }
    const rootsRaw = String(process.env.SVEN_SECRET_FILE_ALLOWLIST || '')
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (rootsRaw.length === 0) {
      throw new Error('file:// secret refs require SVEN_SECRET_FILE_ALLOWLIST');
    }
    const allowedRoots: string[] = [];
    for (const root of rootsRaw) {
      const resolved = await toRealAbsPath(root);
      if (resolved) allowedRoots.push(resolved);
    }
    if (allowedRoots.length === 0) {
      throw new Error('No valid file:// secret allowlist roots');
    }
    const permitted = allowedRoots.some((root) => isWithinRoot(targetReal, root));
    if (!permitted) {
      throw new Error('file:// secret ref path is outside allowed roots');
    }
    const fs = await import('node:fs/promises');
    return (await fs.readFile(targetReal, 'utf8')).trim();
  }

  if (ref.startsWith('sops://')) {
    const sopsBin = process.env.SVEN_SOPS_BIN || 'sops';
    const { execSync } = await import('node:child_process');
    const filePath = ref.slice('sops://'.length);
    if (!filePath) throw new Error('Invalid sops ref');
    return execSync(`${sopsBin} -d ${filePath}`, { encoding: 'utf8' }).trim();
  }

  if (ref.startsWith('vault://')) {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    if (!addr || !token) throw new Error('Vault not configured');
    const parsed = new URL(ref);
    const vaultPath = `${parsed.host}${parsed.pathname}`.replace(/^\/+/, '');
    const field = parsed.hash ? parsed.hash.slice(1) : '';

    const res = await fetch(`${addr.replace(/\/$/, '')}/v1/${vaultPath}`, {
      headers: { 'X-Vault-Token': token },
    });
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

  throw new Error('Unsupported secret ref');
}

function buildApprovedPendingAction(pending: HaPendingActionRow): Record<string, unknown> {
  const payload = (pending.payload && typeof pending.payload === 'object' && !Array.isArray(pending.payload))
    ? pending.payload
    : {};
  const service = typeof payload.service === 'string' && payload.service.trim()
    ? payload.service.trim()
    : pending.service;
  const entityId = typeof payload.entity_id === 'string'
    ? payload.entity_id
    : pending.entity_id;
  const data = payload.data;

  const action: Record<string, unknown> = {
    type: 'service',
    service,
  };
  if (entityId) action.entity_id = entityId;
  if (data !== undefined) action.data = data;
  return action;
}

type PushDeliveryResult = {
  attempted: number;
  delivered: number;
  failed: number;
};

async function sendExpoPush(
  pool: pg.Pool,
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<PushDeliveryResult> {
  if (tokens.length === 0) {
    return { attempted: 0, delivered: 0, failed: 0 };
  }
  const result: PushDeliveryResult = { attempted: tokens.length, delivered: 0, failed: 0 };
  const staleTokens = new Set<string>();
  const batches = [];
  for (let i = 0; i < tokens.length; i += 100) {
    batches.push(tokens.slice(i, i + 100));
  }
  for (const batch of batches) {
    const messages = batch.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: 'default',
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      logger.warn('Expo push failed', { status: res.status });
      result.failed += batch.length;
      continue;
    }
    const body = await res.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const tickets = Array.isArray(body?.data) ? body.data : [];
    if (tickets.length === 0) {
      // No ticket details: conservatively count batch as delivered on 2xx response.
      result.delivered += batch.length;
      continue;
    }
    for (let i = 0; i < batch.length; i += 1) {
      const ticket = tickets[i];
      if (ticket?.status === 'ok') {
        result.delivered += 1;
        continue;
      }
      result.failed += 1;
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        staleTokens.add(batch[i]);
      }
    }
  }

  if (staleTokens.size > 0) {
    await pool.query(
      `DELETE FROM mobile_push_tokens WHERE platform IN ('expo', 'android', 'ios') AND token = ANY($1::text[])`,
      [Array.from(staleTokens)],
    );
    logger.info('Removed stale Expo push tokens', { count: staleTokens.size });
  }

  return result;
}

async function sendWebPush(
  pool: pg.Pool,
  subscriptions: string[],
  payload: { title: string; body: string; data?: Record<string, unknown>; tag?: string },
): Promise<PushDeliveryResult> {
  if (!WEB_PUSH_ENABLED || subscriptions.length === 0) {
    return { attempted: 0, delivered: 0, failed: 0 };
  }

  const result: PushDeliveryResult = { attempted: subscriptions.length, delivered: 0, failed: 0 };
  const staleTokens: string[] = [];
  for (const encoded of subscriptions) {
    try {
      const sub = JSON.parse(encoded);
      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          tag: payload.tag,
        }),
        { TTL: 60 },
      );
      result.delivered += 1;
    } catch (err: any) {
      const status = Number(err?.statusCode || 0);
      result.failed += 1;
      if (status === 404 || status === 410) {
        staleTokens.push(encoded);
      } else {
        logger.warn('Web push failed', { err: String(err) });
      }
    }
  }

  if (staleTokens.length > 0) {
    await pool.query(
      `DELETE FROM mobile_push_tokens WHERE platform = 'web' AND token = ANY($1::text[])`,
      [staleTokens],
    );
  }
  return result;
}

function normalizeChannels(notif: NotificationRecord): Set<string> {
  const channels = new Set<string>();
  if (notif.channel) {
    const channel = String(notif.channel).trim();
    if (channel) channels.add(channel);
  }
  if (Array.isArray(notif.channels)) {
    for (const raw of notif.channels) {
      const channel = String(raw || '').trim();
      if (channel) channels.add(channel);
    }
  }
  return channels;
}

function splitSupportedChannels(channels: Set<string>): { supported: Set<string>; unsupported: string[] } {
  const supported = new Set<string>();
  const unsupported: string[] = [];
  for (const channel of channels) {
    if (ALLOWED_NOTIFICATION_CHANNELS.has(channel)) {
      supported.add(channel);
      continue;
    }
    unsupported.push(channel);
  }
  return { supported, unsupported };
}

function resolvePrimaryChannel(event: NotifyPushEvent): string {
  const channel = String(event.channel || '').trim();
  if (channel) return channel;
  if (Array.isArray(event.channels)) {
    for (const raw of event.channels) {
      const candidate = String(raw || '').trim();
      if (candidate) return candidate;
    }
  }
  return 'outbox';
}

function shouldSendPush(notif: NotificationRecord, channels: Set<string>): boolean {
  if (channels.has('push')) return true;
  const data = notif.data as Record<string, unknown>;
  if (data?.push === true) return true;
  return false;
}

async function resolvePushTokens(
  pool: pg.Pool,
  recipientUserId?: string,
  targetUserIds?: string[],
): Promise<Array<{ platform: string; token: string }>> {
  const userIds = new Set<string>();
  if (recipientUserId) userIds.add(recipientUserId);
  if (Array.isArray(targetUserIds)) {
    for (const id of targetUserIds) {
      if (id) userIds.add(id);
    }
  }
  if (userIds.size === 0) return [];

  const res = await pool.query(
    `SELECT platform, token FROM mobile_push_tokens WHERE user_id = ANY($1::text[])`,
    [Array.from(userIds).map((id) => String(id || '').trim()).filter(Boolean)],
  );
  return res.rows
    .map((row) => ({
      platform: String(row.platform || '').trim().toLowerCase(),
      token: String(row.token || '').trim(),
    }))
    .filter((row) => row.platform.length > 0 && row.token.length > 0);
}

function isExpoPushPlatform(platform: string): boolean {
  return platform === 'expo' || platform === 'android' || platform === 'ios';
}

async function getHaConfig(pool: pg.Pool): Promise<{ baseUrl?: string; token?: string } | null> {
  const settingsRes = await pool.query(
    `SELECT key, value FROM settings_global WHERE key IN ('ha.base_url', 'ha.token_ref')`,
  );
  const settings = new Map(settingsRes.rows.map((row) => [row.key, row.value]));
  const baseUrlSetting = parseSettingValue<string>(settings.get('ha.base_url'))?.trim();
  const tokenRef = parseSettingValue<string>(settings.get('ha.token_ref'))?.trim();

  const baseUrl = baseUrlSetting || process.env.HA_BASE_URL?.trim();
  const token = tokenRef ? await resolveSecretRef(tokenRef) : process.env.HA_TOKEN?.trim();

  if (!baseUrl || !token) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

async function ensureNotificationsRecipientUserIdText(pool: pg.Pool): Promise<void> {
  const tableRes = await pool.query(
    `SELECT to_regclass('public.notifications') AS notifications`,
  );
  if (!String(tableRes.rows[0]?.notifications || '').trim()) {
    throw new Error('notifications table is missing; apply migrations before starting notification-service');
  }

  const columnRes = await pool.query(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'recipient_user_id'
     LIMIT 1`,
  );
  if (columnRes.rows.length === 0) {
    throw new Error('notifications.recipient_user_id column is missing; apply migrations before startup');
  }

  const dataType = String(columnRes.rows[0]?.data_type || '').toLowerCase();
  if (dataType === 'text' || dataType === 'character varying' || dataType === 'varchar') {
    return;
  }

  throw new Error(`Unsupported notifications.recipient_user_id type: ${dataType || 'unknown'}`);
}

async function getOrganizationIdForChat(pool: pg.Pool, chatId: string): Promise<string | null> {
  const normalizedChatId = String(chatId || '').trim();
  if (!normalizedChatId) return null;
  const res = await pool.query(
    `SELECT organization_id
     FROM chats
     WHERE id = $1
     LIMIT 1`,
    [normalizedChatId],
  );
  return String(res.rows[0]?.organization_id || '').trim() || null;
}

async function getHaConfigForOrg(
  pool: pg.Pool,
  organizationId: string | null,
): Promise<{ baseUrl?: string; token?: string } | null> {
  const keys = ['ha.base_url', 'ha.token_ref'];
  const settings = new Map<string, unknown>();

  if (organizationId) {
    const orgSettingsRes = await pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1
         AND key = ANY($2::text[])`,
      [organizationId, keys],
    );
    for (const row of orgSettingsRes.rows) {
      settings.set(String(row.key), row.value);
    }
  }

  const missingKeys = keys.filter((key) => !settings.has(key));
  if (missingKeys.length > 0) {
    const globalSettingsRes = await pool.query(
      `SELECT key, value
       FROM settings_global
       WHERE key = ANY($1::text[])`,
      [missingKeys],
    );
    for (const row of globalSettingsRes.rows) {
      const key = String(row.key);
      if (!settings.has(key)) {
        settings.set(key, row.value);
      }
    }
  }

  const baseUrlSetting = parseSettingValue<string>(settings.get('ha.base_url'))?.trim();
  const tokenRef = parseSettingValue<string>(settings.get('ha.token_ref'))?.trim();
  const baseUrl = baseUrlSetting || process.env.HA_BASE_URL?.trim();
  const token = tokenRef ? await resolveSecretRef(tokenRef) : process.env.HA_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

async function getHaConfigForChat(
  pool: pg.Pool,
  chatId: string,
  cache: Map<string, { baseUrl?: string; token?: string } | null>,
): Promise<{ baseUrl?: string; token?: string } | null> {
  const orgId = await getOrganizationIdForChat(pool, chatId);
  const cacheKey = orgId || '__global__';
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) || null;
  }
  const config = await getHaConfigForOrg(pool, orgId);
  cache.set(cacheKey, config);
  return config;
}

let cachedAdminId: string | null = null;
async function getDefaultRequesterId(pool: pg.Pool): Promise<string> {
  if (cachedAdminId) return cachedAdminId;
  const res = await pool.query(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
  );
  const id = res.rows[0]?.id;
  if (!id) {
    throw new Error('No admin user found for approval requester');
  }
  cachedAdminId = id;
  return id;
}

async function loadAllowlist(
  pool: pg.Pool,
  type: 'ha_entity' | 'ha_service',
  chatId?: string,
): Promise<Array<{ pattern: string; danger_tier: number | null }>> {
  let orgId: string | null = null;
  if (chatId) {
    const orgRes = await pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [chatId]);
    orgId = String(orgRes.rows[0]?.organization_id || '').trim() || null;
  }
  const res = await pool.query(
    `SELECT pattern, danger_tier
     FROM allowlists
     WHERE (organization_id = $2 OR organization_id IS NULL)
       AND type = $1
       AND enabled = TRUE`,
    [type, orgId],
  );
  return res.rows as Array<{ pattern: string; danger_tier: number | null }>;
}

function matchAllowlist(
  entries: Array<{ pattern: string; danger_tier: number | null }>,
  value: string,
): { allowed: boolean; dangerTier: number } {
  const match = entries.find(
    (entry) => entry.pattern === value || value.startsWith(`${entry.pattern}.`),
  );
  if (!match) return { allowed: false, dangerTier: 1 };
  return { allowed: true, dangerTier: match.danger_tier ?? 1 };
}

function buildDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeAutomation(row: HaAutomationRow): HaAutomationRow {
  return {
    ...row,
    trigger: parseJsonValue<Record<string, unknown>>(row.trigger, {}),
    conditions: parseJsonValue<Array<Record<string, unknown>>>(row.conditions, []),
    actions: parseJsonValue<Array<Record<string, unknown>>>(row.actions, []),
    last_attributes: parseJsonValue<Record<string, unknown> | null>(row.last_attributes, null),
  };
}

function getNumericValue(
  trigger: Record<string, unknown>,
  attributes: Record<string, unknown>,
  state: string,
): number | null {
  const attribute = typeof trigger.attribute === 'string' ? trigger.attribute : null;
  const raw = attribute ? attributes[attribute] : state;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function checkNumericTrigger(
  trigger: Record<string, unknown>,
  current: number,
  previous: number | null,
): boolean {
  const above = typeof trigger.above === 'number' ? trigger.above : null;
  const below = typeof trigger.below === 'number' ? trigger.below : null;

  const meets = (above === null || current > above) && (below === null || current < below);
  if (!meets) return false;

  if (previous === null) return true;

  const prevMeets = (above === null || previous > above) && (below === null || previous < below);
  return !prevMeets;
}

type ConditionEvaluationContext = {
  currentState: string;
  attributes: Record<string, unknown>;
  now: Date;
};

function normalizeConditionOperator(condition: Record<string, unknown>): string | null {
  const explicit = typeof condition.operator === 'string'
    ? condition.operator
    : typeof condition.op === 'string'
      ? condition.op
      : null;
  const op = (explicit || '').trim().toLowerCase();
  if (op) return op;

  if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return 'eq';
  if (Object.prototype.hasOwnProperty.call(condition, 'not_equals')) return 'neq';
  if (Object.prototype.hasOwnProperty.call(condition, 'above')) return 'gt';
  if (Object.prototype.hasOwnProperty.call(condition, 'below')) return 'lt';
  if (Object.prototype.hasOwnProperty.call(condition, 'in')) return 'in';
  if (Object.prototype.hasOwnProperty.call(condition, 'not_in')) return 'not_in';
  if (condition.exists === true) return 'exists';
  if (condition.exists === false) return 'not_exists';
  return null;
}

function resolveConditionActualValue(
  condition: Record<string, unknown>,
  context: ConditionEvaluationContext,
): unknown {
  const field = typeof condition.field === 'string' ? condition.field.trim().toLowerCase() : '';
  const type = typeof condition.type === 'string' ? condition.type.trim().toLowerCase() : '';
  const source = field || type;

  if (source === 'state') return context.currentState;
  if (source === 'day_of_week' || source === 'dow') return context.now.getDay();
  if (source === 'hour') return context.now.getHours();
  if (source === 'minute') return context.now.getMinutes();

  const attributeKey = typeof condition.attribute === 'string'
    ? condition.attribute
    : typeof condition.key === 'string'
      ? condition.key
      : typeof condition.path === 'string'
        ? condition.path
        : null;
  if (source === 'attribute' || attributeKey) {
    return attributeKey ? context.attributes[attributeKey] : undefined;
  }

  return undefined;
}

function resolveConditionExpectedValue(
  condition: Record<string, unknown>,
  operator: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(condition, 'value')) return condition.value;
  if (operator === 'eq' && Object.prototype.hasOwnProperty.call(condition, 'equals')) return condition.equals;
  if (operator === 'neq' && Object.prototype.hasOwnProperty.call(condition, 'not_equals')) return condition.not_equals;
  if (operator === 'gt' && Object.prototype.hasOwnProperty.call(condition, 'above')) return condition.above;
  if (operator === 'lt' && Object.prototype.hasOwnProperty.call(condition, 'below')) return condition.below;
  if (operator === 'in' && Array.isArray(condition.in)) return condition.in;
  if (operator === 'not_in' && Array.isArray(condition.not_in)) return condition.not_in;
  return undefined;
}

function evaluateAutomationCondition(
  condition: Record<string, unknown>,
  context: ConditionEvaluationContext,
): boolean {
  const operator = normalizeConditionOperator(condition);
  if (!operator) return false;

  const actual = resolveConditionActualValue(condition, context);
  if (operator === 'exists') return actual !== undefined && actual !== null;
  if (operator === 'not_exists') return actual === undefined || actual === null;
  if (actual === undefined || actual === null) return false;

  const expected = resolveConditionExpectedValue(condition, operator);
  switch (operator) {
    case 'eq':
      return String(actual) === String(expected);
    case 'neq':
      return String(actual) !== String(expected);
    case 'gt': {
      const actualNum = Number(actual);
      const expectedNum = Number(expected);
      return Number.isFinite(actualNum) && Number.isFinite(expectedNum) && actualNum > expectedNum;
    }
    case 'gte': {
      const actualNum = Number(actual);
      const expectedNum = Number(expected);
      return Number.isFinite(actualNum) && Number.isFinite(expectedNum) && actualNum >= expectedNum;
    }
    case 'lt': {
      const actualNum = Number(actual);
      const expectedNum = Number(expected);
      return Number.isFinite(actualNum) && Number.isFinite(expectedNum) && actualNum < expectedNum;
    }
    case 'lte': {
      const actualNum = Number(actual);
      const expectedNum = Number(expected);
      return Number.isFinite(actualNum) && Number.isFinite(expectedNum) && actualNum <= expectedNum;
    }
    case 'in':
      return Array.isArray(expected) && expected.some((value) => String(value) === String(actual));
    case 'not_in':
      return Array.isArray(expected) && expected.every((value) => String(value) !== String(actual));
    default:
      return false;
  }
}

function shouldRunAutomationConditions(
  automation: HaAutomationRow,
  context: ConditionEvaluationContext,
): boolean {
  if (!Array.isArray(automation.conditions) || automation.conditions.length === 0) {
    return true;
  }

  return automation.conditions.every((condition) => {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return false;
    }
    return evaluateAutomationCondition(condition as Record<string, unknown>, context);
  });
}

function shouldTriggerAutomation(
  automation: HaAutomationRow,
  currentState: string,
  attributes: Record<string, unknown>,
): boolean {
  const trigger = automation.trigger || {};
  if (trigger.type === 'state') {
    const toState = typeof trigger.to === 'string' ? trigger.to : null;
    const fromState = typeof trigger.from === 'string' ? trigger.from : null;

    if (toState && currentState !== toState) {
      return false;
    }

    if (fromState && automation.last_state !== fromState) {
      return false;
    }

    return automation.last_state !== currentState;
  }

  if (trigger.type === 'numeric_state') {
    const currentValue = getNumericValue(trigger, attributes, currentState);
    if (currentValue === null) return false;
    const previousValue = automation.last_attributes && typeof trigger.attribute === 'string'
      ? Number(automation.last_attributes[trigger.attribute])
      : Number(automation.last_state);
    const prevValue = Number.isFinite(previousValue) ? previousValue : null;
    return checkNumericTrigger(trigger, currentValue, prevValue);
  }

  return false;
}

async function createAutomationApproval(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
  automation: HaAutomationRow,
  action: Record<string, unknown>,
  dangerTier: number,
): Promise<void> {
  const requesterId = automation.user_id || await getDefaultRequesterId(pool);
  const approvalId = uuidv7();
  const quorum = dangerTier >= 3 ? 2 : 1;
  const expiresMs = dangerTier >= 3 ? 10 * 60 * 1000 : 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiresMs);

  const service = typeof action.service === 'string' ? action.service : '';
  const entityId = typeof action.entity_id === 'string' ? action.entity_id : null;
  const payload = {
    service,
    entity_id: entityId,
    data: action.data ?? null,
  };

  await pool.query(
    `INSERT INTO approvals (id, chat_id, tool_name, scope, requester_user_id, quorum_required, expires_at, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      approvalId,
      automation.chat_id,
      'ha.call_service',
      'ha.write',
      requesterId,
      quorum,
      expiresAt,
      JSON.stringify({
        automation_id: automation.id,
        automation_name: automation.name,
        action: payload,
      }),
    ],
  );

  await pool.query(
    `INSERT INTO ha_automation_pending_actions (
        id, automation_id, approval_id, chat_id, user_id, service, entity_id, payload, status, created_at
     ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, 'pending', NOW()
     )`,
    [
      automation.id,
      approvalId,
      automation.chat_id,
      requesterId,
      service,
      entityId,
      JSON.stringify(payload),
    ],
  );

  const approvalEnvelope: EventEnvelope<ApprovalCreatedEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data: {
      approval_id: approvalId,
      chat_id: automation.chat_id,
      tool_name: 'ha.call_service',
      scope: 'ha.write',
      requester_user_id: requesterId,
      quorum_required: quorum,
      expires_at: expiresAt.toISOString(),
      details: {
        automation_id: automation.id,
        automation_name: automation.name,
        action: payload,
      },
    },
  };

  nc.publish(NATS_SUBJECTS.APPROVAL_CREATED, jc.encode(approvalEnvelope));

  const notifyEnvelope: EventEnvelope<NotifyPushEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data: {
      type: 'approval.pending',
      channel: 'outbox',
      title: 'Approval Required',
      body: `Automation "${automation.name}" requests approval for HA action "${service}".\n\nApprove: /approve ${approvalId}\nDeny: /deny ${approvalId}`,
      data: {
        approval_id: approvalId,
        chat_id: automation.chat_id,
        tool_name: 'ha.call_service',
        scope: 'ha.write',
        quorum_required: quorum,
        expires_at: expiresAt.toISOString(),
        actions: [
          { id: 'approve', label: 'Approve', value: approvalId },
          { id: 'deny', label: 'Deny', value: approvalId },
        ],
        commands: {
          approve: `/approve ${approvalId}`,
          deny: `/deny ${approvalId}`,
        },
      },
      priority: 'high',
    },
  };

  nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(notifyEnvelope));
  logger.info('HA automation approval created', { approval_id: approvalId, automation_id: automation.id });
}

async function executeAutomationActions(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
  config: { baseUrl: string; token: string },
  automation: HaAutomationRow,
  options: { allowDangerous?: boolean } = {},
): Promise<AutomationExecutionSummary> {
  const serviceAllowlist = await loadAllowlist(pool, 'ha_service', automation.chat_id);
  const entityAllowlist = await loadAllowlist(pool, 'ha_entity', automation.chat_id);
  const summary: AutomationExecutionSummary = {
    attempted: 0,
    executed: 0,
    approvalsCreated: 0,
    blocked: 0,
    failed: 0,
  };

  for (const action of automation.actions || []) {
    summary.attempted += 1;
    if (action.type !== 'service') {
      summary.failed += 1;
      continue;
    }

    const service = typeof action.service === 'string' ? action.service : '';
    if (!service.includes('.')) {
      summary.failed += 1;
      continue;
    }

    const entityId = typeof action.entity_id === 'string' ? action.entity_id : '';
    const data = typeof action.data === 'object' && action.data ? action.data : undefined;

    const serviceCheck = matchAllowlist(serviceAllowlist, service);
    if (!serviceCheck.allowed) {
      await notifyAutomationBlocked(nc, automation, `Service ${service} not allowlisted`);
      summary.blocked += 1;
      summary.failed += 1;
      continue;
    }

    if (entityId) {
      const entityCheck = matchAllowlist(entityAllowlist, entityId);
      if (!entityCheck.allowed) {
        await notifyAutomationBlocked(nc, automation, `Entity ${entityId} not allowlisted`);
        summary.blocked += 1;
        summary.failed += 1;
        continue;
      }
      const tier = Math.max(entityCheck.dangerTier, serviceCheck.dangerTier);
      if (tier > 1 && !options.allowDangerous) {
        await createAutomationApproval(nc, pool, automation, action, tier);
        summary.approvalsCreated += 1;
        continue;
      }
    } else if (serviceCheck.dangerTier > 1 && !options.allowDangerous) {
      await createAutomationApproval(nc, pool, automation, action, serviceCheck.dangerTier);
      summary.approvalsCreated += 1;
      continue;
    }

    const [domain, serviceName] = service.split('.');
    const payload: Record<string, unknown> = {};
    if (entityId) payload.entity_id = entityId;
    if (data) payload.data = data;

    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/api/services/${domain}/${serviceName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        signal: buildHaRequestSignal(),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const errorName = String((err as { name?: string })?.name || '');
      const detail = errorName === 'AbortError' || errorName === 'TimeoutError'
        ? 'HA service request timed out'
        : `HA service request failed (${String((err as Error)?.message || err)})`;
      await notifyAutomationBlocked(nc, automation, detail);
      summary.failed += 1;
      continue;
    }

    if (!res.ok) {
      await notifyAutomationBlocked(nc, automation, `HA service failed (${res.status})`);
      summary.failed += 1;
      continue;
    }

    summary.executed += 1;
  }

  return summary;
}

async function notifyAutomationBlocked(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  automation: HaAutomationRow,
  reason: string,
): Promise<void> {
  const envelope: EventEnvelope<NotifyPushEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data: {
      type: 'ha.automation.blocked',
      recipient_user_id: automation.user_id || undefined,
      channel: 'outbox',
      title: `HA automation blocked: ${automation.name}`,
      body: reason,
      data: {
        chat_id: automation.chat_id,
        automation_id: automation.id,
      },
      priority: 'high',
    },
  };

  nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
}

async function handleAutomationApprovalUpdate(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
  approvalId: string,
  status: string,
): Promise<void> {
  const res = await pool.query(
    `SELECT id, automation_id, approval_id, chat_id, user_id, service, entity_id, payload, status
     FROM ha_automation_pending_actions
     WHERE approval_id = $1`,
    [approvalId],
  );

  if (res.rows.length === 0) return;
  const pending = res.rows[0] as HaPendingActionRow;
  const updatePendingStatus = async (
    nextStatus: 'approved' | 'denied' | 'expired' | 'executed' | 'error',
    reason: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> => {
    const nextPayload = {
      ...(pending.payload || {}),
      resolution: {
        status: nextStatus,
        reason,
        ...extra,
        resolved_at: new Date().toISOString(),
      },
    };
    await pool.query(
      `UPDATE ha_automation_pending_actions
       SET status = $2, resolved_at = NOW(), payload = $3::jsonb
       WHERE id = $1`,
      [pending.id, nextStatus, JSON.stringify(nextPayload)],
    );
  };

  if (status === 'pending') {
    return;
  }
  if (status !== 'approved') {
    const terminalStatus = status === 'denied' || status === 'expired' ? status : 'error';
    await updatePendingStatus(terminalStatus, `approval_${status}`);
    await notifyAutomationBlocked(nc, {
      id: pending.automation_id,
      name: 'Automation',
      description: '',
      chat_id: pending.chat_id,
      user_id: pending.user_id,
      enabled: true,
      trigger: {},
      conditions: [],
      actions: [],
      cooldown_seconds: 0,
      last_state: null,
      last_attributes: null,
      last_triggered_at: null,
    }, `Approval ${status} for ${pending.service}`);
    return;
  }

  const automationRes = await pool.query(
    `SELECT id, name, description, chat_id, user_id, enabled, trigger, conditions, actions,
            cooldown_seconds, last_state, last_attributes, last_triggered_at
     FROM ha_automations WHERE id = $1`,
    [pending.automation_id],
  );

  if (automationRes.rows.length === 0) {
    await updatePendingStatus('error', 'automation_missing');
    return;
  }
  const automation = normalizeAutomation(automationRes.rows[0] as HaAutomationRow);
  const orgId = await getOrganizationIdForChat(pool, automation.chat_id);
  const config = await getHaConfigForOrg(pool, orgId);
  if (!config) {
    await updatePendingStatus('error', 'ha_config_missing');
    return;
  }

  const approvedAction = buildApprovedPendingAction(pending);
  const scopedAutomation: HaAutomationRow = {
    ...automation,
    actions: [approvedAction],
  };
  const execution = await executeAutomationActions(
    nc,
    pool,
    config as { baseUrl: string; token: string },
    scopedAutomation,
    { allowDangerous: true },
  );
  const isExecuted = execution.failed === 0 && (execution.executed > 0 || execution.approvalsCreated > 0);
  if (!isExecuted) {
    await updatePendingStatus('error', 'automation_execution_failed', { execution });
    return;
  }
  await updatePendingStatus('executed', 'automation_executed', { execution });
}

function matchesSubscription(
  sub: HaSubscriptionRow,
  state: string,
  attributes: Record<string, unknown>,
): boolean {
  if (!sub.match_state && !sub.match_attribute) {
    return sub.last_state !== state;
  }

  if (sub.match_state && sub.match_state !== state) {
    return false;
  }

  if (sub.match_attribute) {
    const attrValue = attributes[sub.match_attribute];
    const targetValue = sub.match_value ?? '';
    return String(attrValue) === String(targetValue);
  }

  return true;
}

async function pollHaSubscriptions(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
): Promise<void> {
  const configCache = new Map<string, { baseUrl?: string; token?: string } | null>();

  const subsRes = await pool.query(
    `SELECT id, chat_id, user_id, entity_id, match_state, match_attribute, match_value,
            cooldown_seconds, enabled, last_state, last_attributes, last_notified_at
     FROM ha_subscriptions
     WHERE enabled = TRUE`,
  );

  for (const sub of subsRes.rows as HaSubscriptionRow[]) {
    try {
      const config = await getHaConfigForChat(pool, sub.chat_id, configCache);
      if (!config) {
        logger.warn('HA config missing for subscription context', {
          subscription_id: sub.id,
          chat_id: sub.chat_id,
        });
        continue;
      }
      const res = await fetch(`${config.baseUrl}/api/states/${sub.entity_id}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        signal: buildHaRequestSignal(),
      });
      if (!res.ok) {
        logger.warn('HA subscription fetch failed', { entity_id: sub.entity_id, status: res.status });
        continue;
      }
      const payload = await res.json() as Record<string, unknown>;
      const state = String(payload.state ?? '');
      const attributes = (typeof payload.attributes === 'object' && payload.attributes)
        ? payload.attributes as Record<string, unknown>
        : {};

      const now = Date.now();
      const lastNotified = sub.last_notified_at ? Date.parse(sub.last_notified_at) : 0;
      const cooldownMs = (sub.cooldown_seconds || 0) * 1000;
      const isCooldown = cooldownMs > 0 && now - lastNotified < cooldownMs;
      const shouldNotify = matchesSubscription(sub, state, attributes) && !isCooldown;

      await pool.query(
        `UPDATE ha_subscriptions
         SET last_state = $2, last_attributes = $3, updated_at = NOW()
         WHERE id = $1`,
        [sub.id, state, JSON.stringify(attributes)],
      );

      if (!shouldNotify) {
        continue;
      }

      const title = `HA alert: ${sub.entity_id}`;
      const body = sub.match_attribute
        ? `${sub.match_attribute} is ${attributes[sub.match_attribute]}`
        : `State is ${state}`;

      const envelope: EventEnvelope<NotifyPushEvent> = {
        schema_version: '1.0',
        event_id: uuidv7(),
        occurred_at: new Date().toISOString(),
        data: {
          type: 'ha.subscription',
          recipient_user_id: sub.user_id || undefined,
          channel: 'outbox',
          title,
          body,
          data: {
            chat_id: sub.chat_id,
            entity_id: sub.entity_id,
            state,
            attributes,
          },
        },
      };

      nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
      await pool.query(
        `UPDATE ha_subscriptions
         SET last_notified_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [sub.id],
      );
      logger.info('HA subscription notified', { subscription_id: sub.id, entity_id: sub.entity_id });
    } catch (err) {
      logger.warn('HA subscription poll error', { subscription_id: sub.id, err: String(err) });
    }
  }
}

async function pollHaAutomations(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
): Promise<void> {
  const configCache = new Map<string, { baseUrl?: string; token?: string } | null>();

  const autosRes = await pool.query(
    `SELECT id, name, description, chat_id, user_id, enabled, trigger, conditions, actions,
            cooldown_seconds, last_state, last_attributes, last_triggered_at
     FROM ha_automations
     WHERE enabled = TRUE`,
  );

  for (const raw of autosRes.rows as HaAutomationRow[]) {
    const automation = normalizeAutomation(raw);
    const config = await getHaConfigForChat(pool, automation.chat_id, configCache);
    if (!config) {
      logger.warn('HA config missing for automation context', {
        automation_id: automation.id,
        chat_id: automation.chat_id,
      });
      continue;
    }
    const trigger = automation.trigger || {};

    if (trigger.type === 'time') {
      const at = typeof trigger.at === 'string' ? trigger.at : '';
      if (!at || !/^\d{2}:\d{2}$/.test(at)) {
        continue;
      }
      const now = new Date();
      const [hourStr, minuteStr] = at.split(':');
      const hour = Number(hourStr);
      const minute = Number(minuteStr);
      const days = Array.isArray(trigger.days) ? trigger.days.map(Number) : null;

      if (days && days.length > 0 && !days.includes(now.getDay())) {
        continue;
      }

      if (now.getHours() !== hour || now.getMinutes() !== minute) {
        continue;
      }

      const lastKey = automation.last_triggered_at
        ? buildDateKey(new Date(automation.last_triggered_at))
        : null;
      const todayKey = buildDateKey(now);
      if (lastKey === todayKey) {
        continue;
      }
      const conditionsMet = shouldRunAutomationConditions(automation, {
        currentState: String(automation.last_state ?? ''),
        attributes: automation.last_attributes || {},
        now,
      });
      if (!conditionsMet) {
        continue;
      }

      try {
        const execution = await executeAutomationActions(nc, pool, config as { baseUrl: string; token: string }, automation);
        const markTriggered = execution.failed === 0 && (execution.executed > 0 || execution.approvalsCreated > 0);
        if (markTriggered) {
          await pool.query(
            `UPDATE ha_automations
             SET last_triggered_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [automation.id],
          );
          logger.info('HA automation executed (time)', {
            automation_id: automation.id,
            name: automation.name,
            execution,
          });
        } else {
          logger.warn('HA automation time-trigger left unmarked for retry', {
            automation_id: automation.id,
            execution,
          });
        }
      } catch (err) {
        logger.warn('HA automation time-trigger execution error', {
          automation_id: automation.id,
          err: String(err),
        });
      }
      continue;
    }

    const entityId = typeof trigger.entity_id === 'string' ? trigger.entity_id : '';
    if (!entityId) continue;

    try {
      const res = await fetch(`${config.baseUrl}/api/states/${entityId}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        signal: buildHaRequestSignal(),
      });
      if (!res.ok) {
        logger.warn('HA automation fetch failed', { entity_id: entityId, status: res.status });
        continue;
      }
      const payload = await res.json() as Record<string, unknown>;
      const state = String(payload.state ?? '');
      const attributes = (typeof payload.attributes === 'object' && payload.attributes)
        ? payload.attributes as Record<string, unknown>
        : {};

      const now = Date.now();
      const nowDate = new Date(now);
      const lastTriggered = automation.last_triggered_at ? Date.parse(automation.last_triggered_at) : 0;
      const cooldownMs = (automation.cooldown_seconds || 0) * 1000;
      const isCooldown = cooldownMs > 0 && now - lastTriggered < cooldownMs;
      const conditionsMet = shouldRunAutomationConditions(automation, {
        currentState: state,
        attributes,
        now: nowDate,
      });

      const shouldTrigger = shouldTriggerAutomation(automation, state, attributes) && conditionsMet && !isCooldown;

      await pool.query(
        `UPDATE ha_automations
         SET last_state = $2, last_attributes = $3, updated_at = NOW(),
             last_triggered_at = CASE WHEN $4 THEN NOW() ELSE last_triggered_at END
         WHERE id = $1`,
        [automation.id, state, JSON.stringify(attributes), shouldTrigger],
      );

      if (!shouldTrigger) {
        continue;
      }

      await executeAutomationActions(nc, pool, config as { baseUrl: string; token: string }, automation);
      logger.info('HA automation executed', { automation_id: automation.id, name: automation.name });
    } catch (err) {
      logger.warn('HA automation poll error', { automation_id: automation.id, err: String(err) });
    }
  }
}

async function main(): Promise<void> {
  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'notification-service',
    maxReconnectAttempts: -1,
  });
  logger.info('Connected to NATS');

  // Ensure JetStream streams exist
  await ensureStreams(nc);
  logger.info('NATS streams ensured');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 5,
  });
  logger.info('Connected to Postgres');

  // Runtime remains read-only for schema governance; migrations own table lifecycle.
  await ensureNotificationsRecipientUserIdText(pool);

  const js = nc.jetstream();

  let pollInFlight = false;
  const pollInterval = normalizeHaPollIntervalMs(process.env.HA_POLL_INTERVAL_MS);
  if (String(process.env.HA_POLL_INTERVAL_MS || '').trim() && pollInterval === DEFAULT_POLL_INTERVAL_MS) {
    logger.warn('Invalid HA_POLL_INTERVAL_MS; using safe default', {
      raw: process.env.HA_POLL_INTERVAL_MS,
      min_ms: MIN_HA_POLL_INTERVAL_MS,
      max_ms: MAX_HA_POLL_INTERVAL_MS,
      default_ms: DEFAULT_POLL_INTERVAL_MS,
    });
  }
  setInterval(async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      await pollHaSubscriptions(nc, pool);
      await pollHaAutomations(nc, pool);
    } catch (err) {
      logger.warn('HA subscription poll failed', { err: String(err) });
    } finally {
      pollInFlight = false;
    }
  }, pollInterval);

  // Subscribe to all notification messages (wildcard pattern avoids filtered consumer issues)
  const sub = await js.pullSubscribe('notify.>', {
    config: {
      durable_name: NOTIFY_CONSUMER_DURABLE_NAME,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.New,
    },
  });

  const approvalSub = await js.pullSubscribe('approval.>', {
    config: {
      durable_name: APPROVAL_CONSUMER_DURABLE_NAME,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.New,
      max_deliver: APPROVAL_EVENT_MAX_DELIVER,
    },
  });

  logger.info('Subscribed to notify.push, processing...');

  let malformedApprovalEventCount = 0;
  (async () => {
    for await (const msg of approvalSub) {
      try {
        const decoded = jc.decode(msg.data) as unknown;
        const validation = validateApprovalUpdatedEnvelope(decoded);
        if (!validation.ok) {
          malformedApprovalEventCount += 1;
          logger.warn('Dropping malformed approval update event', {
            reason: validation.reason,
            malformed_approval_events_total: malformedApprovalEventCount,
            subject: String(msg.subject || ''),
          });
          try {
            nc.publish(
              APPROVAL_QUARANTINE_SUBJECT,
              jc.encode({
                schema_version: '1.0',
                event_id: uuidv7(),
                occurred_at: new Date().toISOString(),
                data: {
                  source_subject: String(msg.subject || ''),
                  reason: validation.reason,
                },
              }),
            );
          } catch (publishErr) {
            logger.warn('Failed to publish approval quarantine event', {
              err: String(publishErr),
            });
          }
          msg.ack();
          continue;
        }
        await handleAutomationApprovalUpdate(nc, pool, validation.event.approval_id, validation.event.status);
        msg.ack();
      } catch (err) {
        logger.error('Approval update handling failed', { err: String(err) });
        msg.nak(5000);
      }
    }
  })();

  for await (const msg of sub) {
    try {
      const envelope = jc.decode(msg.data) as EventEnvelope<NotifyPushEvent>;
      const event = envelope.data;

      logger.info('Processing notification', {
        type: event.type,
        recipient: event.recipient_user_id,
      });

      const notifId = uuidv7();
      const primaryChannel = resolvePrimaryChannel(event);

      // Store notification record
      await pool.query(
        `INSERT INTO notifications (id, type, recipient_user_id, channel, title, body, data, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
        [
          notifId,
          event.type,
          event.recipient_user_id || null,
          primaryChannel,
          event.title,
          event.body || '',
          JSON.stringify({
            ...(event.data || {}),
            ...(event.action_url ? { action_url: event.action_url } : {}),
          }),
        ],
      );

      // Route notification
      await routeNotification(nc, pool, {
        id: notifId,
        type: event.type,
        recipient_user_id: event.recipient_user_id,
        target_user_ids: event.target_user_ids,
        channel: primaryChannel,
        channels: event.channels,
        title: event.title,
        body: event.body || '',
        data: {
          ...(event.data || {}),
          ...(event.action_url ? { action_url: event.action_url } : {}),
        },
        priority: event.priority,
        status: 'pending',
        created_at: new Date(),
      });

      msg.ack();
    } catch (err) {
      logger.error('Error processing notification', { err: String(err) });
      msg.nak(5000);
    }
  }
}

async function maybeQueueNotificationAudioIngest(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
  notif: NotificationRecord,
): Promise<boolean> {
  const data = notif.data || {};
  const audioUrl = typeof data.audio_url === 'string' && data.audio_url.trim()
    ? data.audio_url.trim()
    : '';
  if (!audioUrl) {
    return false;
  }

  const chatId = typeof data.chat_id === 'string' && data.chat_id ? data.chat_id : '';
  const senderIdentityId = typeof data.sender_identity_id === 'string' && data.sender_identity_id
    ? data.sender_identity_id
    : '';
  if (!chatId || !senderIdentityId) {
    logger.warn('Notification audio missing chat or sender identity; skipping STT', {
      notif_id: notif.id,
      chat_id: chatId,
      sender_identity_id: senderIdentityId,
    });
    return false;
  }

  const metadata = (typeof data.metadata === 'object' && data.metadata)
    ? (data.metadata as Record<string, unknown>)
    : {};
  if (metadata.transcribe === false) {
    logger.info('Notification audio marked as no-transcribe', { notif_id: notif.id, chat_id: chatId });
    return false;
  }

  const channel = typeof data.channel === 'string' && data.channel
    ? data.channel
    : (notif.channel || 'outbox');
  const channelMessageId = typeof data.channel_message_id === 'string' && data.channel_message_id
    ? data.channel_message_id
    : uuidv7();
  const audioMime = typeof data.audio_mime === 'string' ? data.audio_mime : undefined;
  const eventId = uuidv7();

  await pool.query(
    `INSERT INTO messages (id, chat_id, sender_identity_id, role, content_type, audio_url, audio_mime, channel_message_id, created_at)
     VALUES ($1, $2, $3, 'user', 'audio', $4, $5, $6, NOW())`,
    [eventId, chatId, senderIdentityId, audioUrl, audioMime || null, channelMessageId],
  );

  const envelope: EventEnvelope<AudioIngestEvent> = {
    schema_version: '1.0',
    event_id: eventId,
    occurred_at: new Date().toISOString(),
    data: {
      channel,
      channel_message_id: channelMessageId,
      chat_id: chatId,
      sender_identity_id: senderIdentityId,
      message_id: eventId,
      audio_url: audioUrl,
      audio_mime: audioMime,
      metadata,
    },
  };

  nc.publish(NATS_SUBJECTS.AUDIO_INGEST, jc.encode(envelope));
  logger.info('Notification audio queued for STT', { notif_id: notif.id, chat_id: chatId, channel });
  return true;
}

async function routeNotification(
  nc: ReturnType<typeof connect> extends Promise<infer T> ? T : never,
  pool: pg.Pool,
  notif: NotificationRecord,
): Promise<void> {
  await maybeQueueNotificationAudioIngest(nc, pool, notif);

  const normalizedChannels = normalizeChannels(notif);
  const { supported: channels, unsupported } = splitSupportedChannels(normalizedChannels);
  if (unsupported.length > 0) {
    logger.warn('Notification has unsupported channels', { id: notif.id, unsupported });
    await pool.query(
      `UPDATE notifications SET status = 'failed' WHERE id = $1`,
      [notif.id],
    );
    return;
  }

  const deliveryChannels: Record<string, { status: 'delivered' | 'partial' | 'failed' | 'skipped'; error?: string }> =
    {};
  let delivered = false;
  const shouldPush = shouldSendPush(notif, channels);

  if (shouldPush) {
    try {
      const targets = await resolvePushTokens(pool, notif.recipient_user_id, notif.target_user_ids);
      const expoTokens = targets.filter((t) => isExpoPushPlatform(t.platform)).map((t) => t.token);
      const webSubscriptions = targets.filter((t) => t.platform === 'web').map((t) => t.token);
      const actionUrl = (() => {
        const explicit = String((notif.data as any)?.action_url || '');
        if (explicit) return explicit;
        if (notif.type === 'approval.pending' && (notif.data as any)?.approval_id) {
          return `/approvals?focus=${encodeURIComponent(String((notif.data as any).approval_id))}`;
        }
        return '/';
      })();
      const payloadData = {
        ...notif.data,
        action_url: actionUrl,
        notification_id: notif.id,
        notification_type: notif.type,
      };

      const expoResult = await sendExpoPush(pool, expoTokens, {
        title: notif.title,
        body: notif.body || '',
        data: payloadData,
      });
      const webResult = await sendWebPush(pool, webSubscriptions, {
        title: notif.title,
        body: notif.body || '',
        data: payloadData,
        tag: notif.type,
      });
      const attempted = expoResult.attempted + webResult.attempted;
      const deliveredCount = expoResult.delivered + webResult.delivered;
      const failedCount = expoResult.failed + webResult.failed;

      if (attempted === 0) {
        deliveryChannels.push = { status: 'failed', error: 'no registered push targets' };
      } else if (deliveredCount > 0 && failedCount === 0) {
        deliveryChannels.push = { status: 'delivered' };
        delivered = true;
      } else if (deliveredCount > 0 && failedCount > 0) {
        deliveryChannels.push = { status: 'partial', error: `${failedCount}/${attempted} push deliveries failed` };
        delivered = true;
      } else {
        deliveryChannels.push = { status: 'failed', error: `${failedCount}/${attempted} push deliveries failed` };
      }
    } catch (err) {
      logger.warn('Push delivery failed', { id: notif.id, err: String(err) });
      deliveryChannels.push = {
        status: 'failed',
        error: String((err as Error)?.message || err || 'push delivery failed'),
      };
    }
  } else if (channels.has('push')) {
    deliveryChannels.push = { status: 'skipped', error: 'push disabled by policy' };
  }

  if (channels.has('outbox')) {
    // Route through the outbox for channel delivery
    const chatId = notif.data.chat_id as string;
    if (!chatId) {
      // Broadcast to HQ chat
      const hqRes = await pool.query(
        `SELECT id, channel, channel_chat_id FROM chats WHERE type = 'hq' LIMIT 1`,
      );
      if (hqRes.rows.length > 0) {
        const hq = hqRes.rows[0];
        await enqueueOutbox(nc, pool, hq.id, hq.channel || 'internal', hq.channel_chat_id || hq.id, notif);
        deliveryChannels.outbox = { status: 'delivered' };
        delivered = true;
      } else {
        deliveryChannels.outbox = { status: 'failed', error: 'HQ chat not found' };
      }
    } else {
      const chatRes = await pool.query(
        `SELECT channel, channel_chat_id FROM chats WHERE id = $1`,
        [chatId],
      );
      if (chatRes.rows.length > 0) {
        const chat = chatRes.rows[0];
        await enqueueOutbox(nc, pool, chatId, chat.channel || 'internal', chat.channel_chat_id || chatId, notif);
        deliveryChannels.outbox = { status: 'delivered' };
        delivered = true;
      } else {
        deliveryChannels.outbox = { status: 'failed', error: 'Target chat not found' };
      }
    }
  }

  if (channels.has('webhook')) {
    const webhookUrl = notif.data.webhook_url as string;
    if (webhookUrl) {
      const delivery = await sendWebhookNotificationWithRetry(webhookUrl, {
        type: notif.type,
        title: notif.title,
        body: notif.body,
        data: notif.data,
        timestamp: new Date().toISOString(),
      });
      if (delivery.ok) {
        logger.info('Webhook notification sent', { id: notif.id, url: webhookUrl });
        deliveryChannels.webhook = { status: 'delivered' };
        delivered = true;
      } else {
        logger.error('Webhook notification failed', { id: notif.id, err: delivery.error, url: webhookUrl });
        deliveryChannels.webhook = { status: 'failed', error: delivery.error };
      }
    } else {
      logger.warn('Webhook channel requested without webhook_url', { id: notif.id });
      deliveryChannels.webhook = { status: 'failed', error: 'missing webhook_url' };
    }
  }

  if (channels.has('email')) {
    const recipient = normalizeEmailAddress((notif.data as Record<string, unknown>)?.email_to);
    if (!isValidEmailAddress(recipient)) {
      deliveryChannels.email = { status: 'failed', error: 'missing or invalid email_to' };
    } else {
      const delivery = await sendEmailNotification(recipient, {
        title: notif.title,
        body: notif.body || '',
        data: notif.data,
      });
      if (delivery.ok) {
        deliveryChannels.email = { status: 'delivered' };
        delivered = true;
      } else {
        logger.error('Email notification failed', { id: notif.id, err: delivery.error, to: recipient });
        deliveryChannels.email = { status: 'failed', error: delivery.error };
      }
    }
  }

  if (channels.size === 0) {
    logger.warn('Notification missing channels', { id: notif.id, channel: notif.channel });
  }

  if (!delivered) {
    await pool.query(
      `UPDATE notifications
       SET status = 'failed',
           data = COALESCE(data, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [notif.id, JSON.stringify({ delivery_channels: deliveryChannels })],
    );
    return;
  }

  const channelResults = Object.values(deliveryChannels);
  const failedChannelCount = channelResults.filter((entry) => entry.status === 'failed').length;
  const terminalStatus = failedChannelCount > 0 ? 'partial' : 'delivered';

  // Mark as delivered/partial with per-channel outcomes.
  await pool.query(
    `UPDATE notifications
     SET status = $2,
         delivered_at = NOW(),
         data = COALESCE(data, '{}'::jsonb) || $3::jsonb
     WHERE id = $1`,
    [notif.id, terminalStatus, JSON.stringify({ delivery_channels: deliveryChannels })],
  );
}

async function enqueueOutbox(
  nc: any,
  pool: pg.Pool,
  chatId: string,
  channel: string,
  channelChatId: string,
  notif: NotificationRecord,
): Promise<void> {
  const outboxId = uuidv7();
  const idempotencyKey = `notif:${notif.id}`;

  const text = notif.body
    ? `**${notif.title}**\n\n${notif.body}`
    : `**${notif.title}**`;

  const blocks = [
    { type: 'markdown', content: text },
  ];

  await pool.query(
    `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, blocks, idempotency_key, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'blocks', $5, $6, $7, 'pending', NOW(), NOW())`,
    [outboxId, chatId, channel, channelChatId, text, JSON.stringify(blocks), idempotencyKey],
  );

  const envelope = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data: {
      outbox_id: outboxId,
      chat_id: chatId,
      channel,
      channel_chat_id: channelChatId,
      content_type: 'blocks',
      text,
      blocks,
      idempotency_key: idempotencyKey,
    },
  };
  const payload = jc.encode(envelope);
  nc.publish(NATS_SUBJECTS.OUTBOX_ENQUEUE, payload);
  nc.publish(NATS_SUBJECTS.TTS_OUTBOX_ENQUEUE, payload);

  logger.info('Notification enqueued to outbox', {
    notif_id: notif.id,
    outbox_id: outboxId,
    chat_id: chatId,
  });
}

main().catch((err) => {
  logger.fatal('Notification service failed', { err: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
