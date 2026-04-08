import { FastifyInstance, FastifyRequest } from 'fastify';
import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { createLogger } from '@sven/shared';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { createHash, randomBytes } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { createReadStream, realpathSync } from 'node:fs';
import { access, realpath as fsRealpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { v7 as uuidv7 } from 'uuid';
import { requireRole } from './auth.js';
import { withCorrelationMetadata } from '../lib/correlation.js';

const logger = createLogger('gateway-canvas');
const a2uiBus = new EventEmitter();
const A2UI_RECENT_EVENT_BUFFER_MAX = 200;
const a2uiRecentEvents = new Map<string, A2uiEventEnvelope[]>();
const A2UI_EVENT_NATS_SUBJECT = 'ui.a2ui.event';
const A2UI_EVENT_NATS_SOURCE_INSTANCE = uuidv7();
const a2uiNatsCodec = JSONCodec<{
  source_instance_id: string;
  chat_id: string;
  event: A2uiEventEnvelope;
}>();
let a2uiNatsSubscribed = false;
const CALENDAR_SIMULATION_ORGANIZER = 'simulated@sven.local';

type QueryExecutor = {
  query: (text: string, values?: unknown[]) => Promise<pg.QueryResult>;
};

type MessageQueueConfig = {
  enabled: boolean;
  maxDepth: number;
  timeoutMinutes: number;
};

type VoiceContinuousConfig = {
  enabled: boolean;
  ttlSeconds: number;
};

type SpeakerIdentificationConfig = {
  enabled: boolean;
};

type AgentRuntimeState = {
  paused: boolean;
  updated_at: string | null;
  nudge_nonce: number;
  last_nudged_at: string | null;
  processing: boolean;
  last_user_message_at: string | null;
  last_assistant_message_at: string | null;
};

type UserProactivePreferences = {
  channels: Record<string, boolean>;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
};

type ProactiveDeliveryDecision = {
  allowed: boolean;
  reason: 'admin_disabled' | 'channel_opted_out' | 'quiet_hours' | null;
};

const TIME_HH_MM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type QueuedTailPlan = {
  remainingSlots: number;
  queuedFetchLimit: number;
  queuedExistsProbe: boolean;
};

type CanvasStreamEventKind = 'message' | 'approval' | 'agent_state' | 'agent_nudged';

type CanvasStreamCursor = {
  kind: CanvasStreamEventKind;
  ts: string;
  id: string;
};

type CanvasRunDetail = {
  id: string;
  tool_name: string;
  chat_id: string;
  user_id: string;
  approval_id: string | null;
  status: string;
  prev_hash: string;
  run_hash: string;
  canonical_io_sha256: string;
  duration_ms: number | null;
  created_at: unknown;
  completed_at: unknown;
  context_message_id: string | null;
  linked_artifacts: Array<Record<string, unknown>>;
};

type CanvasArtifactMetadata = {
  id: string;
  chat_id: string;
  message_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: unknown;
  is_private: boolean;
  download_url: string;
};

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

type ArtifactUrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; code: 'UPSTREAM_BLOCKED'; message: string };

type ArtifactUpstreamFailure =
  | { code: 'UPSTREAM_BLOCKED'; status: 403; message: string }
  | { code: 'UPSTREAM_REDIRECT_INVALID'; status: 502; message: string }
  | { code: 'UPSTREAM_REDIRECT_LIMIT'; status: 502; message: string };

const DISALLOWED_ARTIFACT_HOSTNAMES = new Set<string>([
  'localhost',
  'metadata',
  'metadata.google.internal',
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
]);

export function normalizeArtifactHostname(hostname: string): string {
  return String(hostname || '').trim().toLowerCase().replace(/\.+$/, '');
}

export function isBlockedArtifactUpstreamHostname(hostname: string): boolean {
  const normalized = normalizeArtifactHostname(hostname);
  if (!normalized) return true;
  if (DISALLOWED_ARTIFACT_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith('.localhost')) return true;
  return false;
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split('%')[0];
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) {
      return isBlockedIPv4(mapped);
    }
  }
  return false;
}

export function isBlockedArtifactUpstreamIp(ip: string): boolean {
  const value = String(ip || '').trim();
  const family = isIP(value);
  if (family === 4) return isBlockedIPv4(value);
  if (family === 6) return isBlockedIPv6(value);
  return true;
}

async function resolveArtifactHostnameAddresses(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records
    .map((record) => String(record.address || '').trim())
    .filter((addr) => addr.length > 0);
}

export async function assertSafeArtifactUpstreamUrl(
  rawUrl: string,
  resolver: (hostname: string) => Promise<string[]> = resolveArtifactHostnameAddresses,
): Promise<ArtifactUrlSafetyResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream URL is invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream protocol is not allowed' };
  }
  const normalizedHost = normalizeArtifactHostname(parsed.hostname);
  if (isBlockedArtifactUpstreamHostname(normalizedHost)) {
    return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream target is not allowed' };
  }
  if (isIP(normalizedHost) !== 0) {
    if (isBlockedArtifactUpstreamIp(normalizedHost)) {
      return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream target is not allowed' };
    }
    return { ok: true, url: parsed };
  }
  let resolved: string[];
  try {
    resolved = await resolver(normalizedHost);
  } catch {
    return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream host resolution failed' };
  }
  if (!resolved.length) {
    return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream host resolution failed' };
  }
  if (resolved.some((ip) => isBlockedArtifactUpstreamIp(ip))) {
    return { ok: false, code: 'UPSTREAM_BLOCKED', message: 'Artifact upstream target is not allowed' };
  }
  return { ok: true, url: parsed };
}

async function fetchArtifactUpstreamSafe(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<Response> {
  let currentUrl = rawUrl;
  const maxRedirects = 3;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const safety = await assertSafeArtifactUpstreamUrl(currentUrl);
    if (!safety.ok) {
      throw {
        code: 'UPSTREAM_BLOCKED',
        status: 403,
        message: safety.message,
      } satisfies ArtifactUpstreamFailure;
    }
    const response = await fetch(safety.url, { signal, redirect: 'manual' });
    const status = response.status;
    if (status >= 300 && status < 400) {
      const location = String(response.headers.get('location') || '').trim();
      if (!location) {
        throw {
          code: 'UPSTREAM_REDIRECT_INVALID',
          status: 502,
          message: 'Artifact upstream redirect is missing location',
        } satisfies ArtifactUpstreamFailure;
      }
      currentUrl = new URL(location, safety.url).toString();
      continue;
    }
    return response;
  }
  throw {
    code: 'UPSTREAM_REDIRECT_LIMIT',
    status: 502,
    message: 'Artifact upstream redirect limit exceeded',
  } satisfies ArtifactUpstreamFailure;
}

function isInlineArtifactMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
    || mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
    || mimeType.startsWith('text/')
    || mimeType.includes('json')
    || mimeType.includes('pdf');
}

export function sanitizeHeaderFilename(name: string): string {
  const baseName = basename(String(name || 'artifact').trim() || 'artifact');
  let strippedControls = '';
  for (const ch of baseName) {
    const code = ch.charCodeAt(0);
    if (code <= 31 || code === 127) continue;
    strippedControls += ch;
  }
  const strippedQuotes = strippedControls.replace(/"/g, '');
  const collapsedWhitespace = strippedQuotes.replace(/\s+/g, ' ').trim();
  return collapsedWhitespace || 'artifact';
}

export function contentDisposition(name: string, mimeType: string): string {
  const safeName = sanitizeHeaderFilename(name);
  const type = String(mimeType || '').toLowerCase();
  const mode = isInlineArtifactMime(type) ? 'inline' : 'attachment';
  return `${mode}; filename="${safeName}"`;
}

function normalizeOriginValue(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function inferRequestOrigin(request: FastifyRequest): string | null {
  const origin = normalizeOriginValue(String(request.headers.origin || ''));
  if (origin) return origin;

  const referer = String(request.headers.referer || '').trim();
  if (referer) {
    try {
      return new URL(referer).origin.replace(/\/+$/, '');
    } catch {
      // Ignore malformed referers and keep falling back.
    }
  }

  const forwardedProto = String(request.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '')
    .split(',')[0]
    ?.trim();
  const host = forwardedHost || String(request.headers.host || '').trim();
  if (host) {
    const proto = forwardedProto || (String(process.env.NODE_ENV || '').toLowerCase() === 'production' ? 'https' : 'http');
    return normalizeOriginValue(`${proto}://${host}`);
  }

  return normalizeOriginValue(String(process.env.PUBLIC_URL || ''));
}

function buildShareUrl(request: FastifyRequest, token: string): string {
  const origin = inferRequestOrigin(request) || 'http://localhost:3000';
  return `${origin}/shared/${token}`;
}

function generateShareToken(): string {
  // 24 bytes => 192-bit entropy, url-safe base64 token.
  return randomBytes(24).toString('base64url');
}

function fingerprintShareToken(token: string): string {
  return createHash('sha256').update(String(token || '')).digest('hex').slice(0, 12);
}

function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return fallback;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeProactiveChannels(input: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const parsed = parseJsonObject(input);
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;
    if (typeof rawValue === 'boolean') {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === 'string') {
      const lowered = rawValue.trim().toLowerCase();
      if (lowered === 'true') out[key] = true;
      if (lowered === 'false') out[key] = false;
    }
  }
  return out;
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = TIME_HH_MM_RE.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1] || 0);
  const mm = Number(m[2] || 0);
  return hh * 60 + mm;
}

function currentMinutesInTimezone(timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return Math.min(Math.max(hour, 0), 23) * 60 + Math.min(Math.max(minute, 0), 59);
    }
  } catch {
    // Fallback to UTC if timezone is invalid.
  }
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function isWithinQuietHours(prefs: UserProactivePreferences): boolean {
  const start = parseTimeToMinutes(prefs.quiet_hours_start);
  const end = parseTimeToMinutes(prefs.quiet_hours_end);
  if (start === null || end === null) return false;
  if (start === end) return true;
  const current = currentMinutesInTimezone(prefs.quiet_hours_timezone || 'UTC');
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

async function getOrgProactiveEnabled(pool: pg.Pool, orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  try {
    const orgRes = await pool.query(
      `SELECT value
       FROM organization_settings
       WHERE organization_id = $1 AND key = 'agent.proactive.enabled'
       LIMIT 1`,
      [orgId],
    );
    if (orgRes.rows.length > 0) {
      return parseBooleanSetting(orgRes.rows[0]?.value, false);
    }
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }
  const globalRes = await pool.query(
    `SELECT value
     FROM settings_global
     WHERE key = 'agent.proactive.enabled'
     LIMIT 1`,
  );
  return parseBooleanSetting(globalRes.rows[0]?.value, false);
}

async function getUserProactivePreferences(pool: pg.Pool, userId: string): Promise<UserProactivePreferences> {
  const defaults: UserProactivePreferences = {
    channels: {},
    quiet_hours_start: null,
    quiet_hours_end: null,
    quiet_hours_timezone: 'UTC',
  };
  try {
    const res = await pool.query(
      `SELECT channels, quiet_hours_start, quiet_hours_end, quiet_hours_timezone
       FROM user_proactive_preferences
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );
    if (res.rows.length === 0) return defaults;
    const row = res.rows[0];
    return {
      channels: normalizeProactiveChannels(row.channels),
      quiet_hours_start: row.quiet_hours_start ? String(row.quiet_hours_start) : null,
      quiet_hours_end: row.quiet_hours_end ? String(row.quiet_hours_end) : null,
      quiet_hours_timezone: String(row.quiet_hours_timezone || 'UTC'),
    };
  } catch (err) {
    if (isSchemaCompatError(err)) return defaults;
    throw err;
  }
}

async function getChatChannel(pool: pg.Pool, chatId: string, orgId: string): Promise<string> {
  const res = await pool.query(
    `SELECT channel
     FROM chats
     WHERE id = $1 AND organization_id = $2
     LIMIT 1`,
    [chatId, orgId],
  );
  return String(res.rows[0]?.channel || 'canvas').trim().toLowerCase() || 'canvas';
}

async function evaluateProactiveDelivery(
  pool: pg.Pool,
  params: { orgId: string; userId: string; channel: string },
): Promise<ProactiveDeliveryDecision> {
  const orgEnabled = await getOrgProactiveEnabled(pool, params.orgId);
  if (!orgEnabled) return { allowed: false, reason: 'admin_disabled' };

  const prefs = await getUserProactivePreferences(pool, params.userId);
  const channelKey = String(params.channel || 'canvas').trim().toLowerCase() || 'canvas';
  const channelValue = prefs.channels[channelKey];
  if (typeof channelValue === 'boolean' && !channelValue) {
    return { allowed: false, reason: 'channel_opted_out' };
  }
  if (isWithinQuietHours(prefs)) {
    return { allowed: false, reason: 'quiet_hours' };
  }
  return { allowed: true, reason: null };
}

function parseNumberSetting(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function extractSessionTokenFromRequest(request: any): string {
  const headerAuth = String(request.headers?.authorization || '').trim();
  const bearerToken = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7).trim() : '';
  const cookieToken = String(request.cookies?.sven_session || '').trim();
  return bearerToken || cookieToken;
}

function normalizePatternQuestion(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function buildPatternFallbackAnswer(question: string, occurrences: number): string {
  return `You asked this ${occurrences} times recently: "${question}". I can help build a reusable checklist answer for this topic.`;
}

function formatCalendarUtc(dateLike: string | Date): string {
  const d = new Date(dateLike);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm} UTC`;
}

export function buildQueuedTailPlan(maxRows: number, persistedRowsCount: number): QueuedTailPlan {
  const remainingSlots = Math.max(0, maxRows - persistedRowsCount);
  if (remainingSlots === 0) {
    return {
      remainingSlots: 0,
      queuedFetchLimit: 0,
      queuedExistsProbe: true,
    };
  }
  return {
    remainingSlots,
    queuedFetchLimit: remainingSlots + 1,
    queuedExistsProbe: false,
  };
}

function healthSeverityRank(level: string): number {
  if (level === 'critical') return 3;
  if (level === 'warning') return 2;
  return 1;
}

async function getMessageQueueConfig(pool: pg.Pool): Promise<MessageQueueConfig> {
  const defaults: MessageQueueConfig = {
    enabled: true,
    maxDepth: 10,
    timeoutMinutes: 30,
  };
  try {
    const res = await pool.query(
      `SELECT key, value
       FROM settings_global
       WHERE key IN (
         'chat.messageQueue.enabled',
         'chat.messageQueue.maxDepth',
         'chat.messageQueue.timeoutMinutes'
       )`,
    );
    const map = new Map<string, unknown>();
    for (const row of res.rows) {
      map.set(String(row.key), row.value);
    }
    return {
      enabled: parseBooleanSetting(map.get('chat.messageQueue.enabled'), defaults.enabled),
      maxDepth: parseNumberSetting(map.get('chat.messageQueue.maxDepth'), defaults.maxDepth, 1, 200),
      timeoutMinutes: parseNumberSetting(map.get('chat.messageQueue.timeoutMinutes'), defaults.timeoutMinutes, 1, 24 * 60),
    };
  } catch {
    return defaults;
  }
}

async function getOrgSettingValue(
  pool: pg.Pool,
  orgId: string | null,
  key: string,
): Promise<unknown> {
  if (!orgId) return null;
  try {
    const orgRes = await pool.query(
      `SELECT value
       FROM organization_settings
       WHERE organization_id = $1 AND key = $2
       LIMIT 1`,
      [orgId, key],
    );
    if (orgRes.rows.length > 0) return orgRes.rows[0]?.value;
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }
  try {
    const globalRes = await pool.query(
      `SELECT value
       FROM settings_global
       WHERE key = $1
       LIMIT 1`,
      [key],
    );
    return globalRes.rows[0]?.value ?? null;
  } catch (err) {
    if (isSchemaCompatError(err)) return null;
    throw err;
  }
}

async function getVoiceContinuousConfig(pool: pg.Pool, orgId: string | null): Promise<VoiceContinuousConfig> {
  const defaultEnabled = false;
  const defaultTtlSeconds = 180;
  const enabledRaw = await getOrgSettingValue(pool, orgId, 'voice.continuousConversation.enabled');
  const ttlRaw = await getOrgSettingValue(pool, orgId, 'voice.continuousConversation.ttlSeconds');
  return {
    enabled: parseBooleanSetting(enabledRaw, defaultEnabled),
    ttlSeconds: parseNumberSetting(ttlRaw, defaultTtlSeconds, 30, 3600),
  };
}

export async function ensureCanvasIdentity(pool: QueryExecutor, userId: string): Promise<string> {
  const candidateId = uuidv7();
  const identityRes = await pool.query(
    `WITH inserted AS (
       INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
       VALUES ($1, $2, 'canvas', $2, $3, NOW())
       ON CONFLICT (channel, channel_user_id) DO NOTHING
       RETURNING id
     )
     SELECT id FROM inserted
     UNION ALL
     SELECT id FROM identities WHERE channel = 'canvas' AND channel_user_id = $2
     LIMIT 1`,
    [candidateId, userId, `canvas:${userId}`],
  );
  const identityId = identityRes.rows[0]?.id ? String(identityRes.rows[0].id) : '';
  if (!identityId) {
    throw new Error('Failed to resolve canvas identity');
  }
  return identityId;
}

async function getSpeakerIdentificationConfig(
  pool: pg.Pool,
  orgId: string | null,
): Promise<SpeakerIdentificationConfig> {
  const enabledRaw = await getOrgSettingValue(pool, orgId, 'voice.speakerIdentification.enabled');
  return {
    enabled: parseBooleanSetting(enabledRaw, false),
  };
}

async function upsertSpeakerProfile(
  pool: pg.Pool,
  input: {
    organizationId: string;
    chatId: string;
    userId: string;
    signature: string;
    label: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: string; label: string; signature: string }> {
  const existing = await pool.query(
    `SELECT id, label, signature
     FROM voice_speaker_profiles
     WHERE organization_id = $1
       AND chat_id = $2
       AND user_id = $3
       AND signature = $4
     LIMIT 1`,
    [input.organizationId, input.chatId, input.userId, input.signature],
  );
  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `UPDATE voice_speaker_profiles
       SET label = $2,
           metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, label, signature`,
      [
        String(existing.rows[0].id),
        input.label,
        JSON.stringify(input.metadata || {}),
      ],
    );
    return {
      id: String(updated.rows[0].id),
      label: String(updated.rows[0].label),
      signature: String(updated.rows[0].signature),
    };
  }

  const inserted = await pool.query(
    `INSERT INTO voice_speaker_profiles
       (id, organization_id, chat_id, user_id, label, signature, metadata, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
     RETURNING id, label, signature`,
    [
      uuidv7(),
      input.organizationId,
      input.chatId,
      input.userId,
      input.label,
      input.signature,
      JSON.stringify(input.metadata || {}),
    ],
  );
  return {
    id: String(inserted.rows[0].id),
    label: String(inserted.rows[0].label),
    signature: String(inserted.rows[0].signature),
  };
}

async function findSpeakerProfileBySignature(
  pool: pg.Pool,
  input: {
    organizationId: string;
    chatId: string;
    userId: string;
    signature: string;
  },
): Promise<{ id: string; label: string; signature: string } | null> {
  try {
    const res = await pool.query(
      `SELECT id, label, signature
       FROM voice_speaker_profiles
       WHERE organization_id = $1
         AND chat_id = $2
         AND user_id = $3
         AND signature = $4
       LIMIT 1`,
      [input.organizationId, input.chatId, input.userId, input.signature],
    );
    if (!res.rows.length) return null;
    return {
      id: String(res.rows[0].id),
      label: String(res.rows[0].label),
      signature: String(res.rows[0].signature),
    };
  } catch (err) {
    if (isSchemaCompatError(err)) return null;
    throw err;
  }
}

async function pruneExpiredQueuedMessages(pool: pg.Pool, chatId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE chat_message_queue
       SET status = 'expired'
       WHERE chat_id = $1
         AND status = 'queued'
         AND expires_at <= NOW()`,
      [chatId],
    );
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }
}

async function isChatProcessing(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT is_processing
       FROM chat_processing_state
       WHERE chat_id = $1
       LIMIT 1`,
      [chatId],
    );
    return Boolean(res.rows[0]?.is_processing);
  } catch (err) {
    if (isSchemaCompatError(err)) return false;
    throw err;
  }
}

export async function createOrRefreshVoiceContinuousSession(
  pool: pg.Pool,
  input: {
    organizationId: string;
    chatId: string;
    userId: string;
    senderIdentityId: string;
    channel: string;
    ttlSeconds: number;
    metadata?: Record<string, unknown>;
    sessionId?: string;
  },
): Promise<{ id: string; expires_at: string; ttl_seconds: number }> {
  const sessionId = input.sessionId || uuidv7();
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const ttlSeconds = Math.max(30, Math.min(3600, Math.floor(input.ttlSeconds)));
  const res = await pool.query(
    `INSERT INTO voice_continuous_sessions
       (id, organization_id, chat_id, user_id, sender_identity_id, channel, started_at, last_activity_at, expires_at, metadata)
     VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW() + ($7::text || ' seconds')::interval, $8::jsonb)
     ON CONFLICT (id) DO UPDATE
     SET last_activity_at = NOW(),
         expires_at = NOW() + ($7::text || ' seconds')::interval,
         ended_at = NULL,
         ended_reason = NULL,
         metadata = COALESCE(voice_continuous_sessions.metadata, '{}'::jsonb) || $8::jsonb
     WHERE voice_continuous_sessions.organization_id = EXCLUDED.organization_id
       AND voice_continuous_sessions.chat_id = EXCLUDED.chat_id
       AND voice_continuous_sessions.user_id = EXCLUDED.user_id
       AND voice_continuous_sessions.sender_identity_id = EXCLUDED.sender_identity_id
       AND voice_continuous_sessions.channel = EXCLUDED.channel
     RETURNING id, expires_at`,
    [
      sessionId,
      input.organizationId,
      input.chatId,
      input.userId,
      input.senderIdentityId,
      input.channel,
      ttlSeconds,
      JSON.stringify(metadata),
    ],
  );
  if (res.rows.length === 0) {
    throw new Error('VOICE_CONTINUOUS_SESSION_OWNERSHIP_MISMATCH');
  }
  return {
    id: String(res.rows[0].id),
    expires_at: String(res.rows[0].expires_at),
    ttl_seconds: ttlSeconds,
  };
}

async function getActiveVoiceContinuousSession(
  pool: pg.Pool,
  input: {
    sessionId: string;
    organizationId: string;
    chatId: string;
    userId: string;
    channel: string;
  },
): Promise<{ id: string; expires_at: string } | null> {
  try {
    const res = await pool.query(
      `SELECT id, expires_at
       FROM voice_continuous_sessions
       WHERE id = $1
         AND organization_id = $2
         AND chat_id = $3
         AND user_id = $4
         AND channel = $5
         AND ended_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [input.sessionId, input.organizationId, input.chatId, input.userId, input.channel],
    );
    if (!res.rows.length) return null;
    return {
      id: String(res.rows[0].id),
      expires_at: String(res.rows[0].expires_at),
    };
  } catch (err) {
    if (isSchemaCompatError(err)) return null;
    throw err;
  }
}

async function endVoiceContinuousSession(
  pool: pg.Pool,
  input: {
    sessionId: string;
    organizationId: string;
    chatId: string;
    userId: string;
    reason: string;
  },
): Promise<boolean> {
  try {
    const res = await pool.query(
      `UPDATE voice_continuous_sessions
       SET ended_at = NOW(), ended_reason = $6
       WHERE id = $1
         AND organization_id = $2
         AND chat_id = $3
         AND user_id = $4
         AND channel = 'canvas'
         AND ended_at IS NULL
       RETURNING id`,
      [input.sessionId, input.organizationId, input.chatId, input.userId, 'canvas', input.reason],
    );
    return res.rows.length > 0;
  } catch (err) {
    if (isSchemaCompatError(err)) return false;
    throw err;
  }
}

async function setChatProcessing(pool: pg.Pool, chatId: string, processing: boolean): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (chat_id) DO UPDATE
       SET is_processing = EXCLUDED.is_processing, updated_at = NOW()`,
      [chatId, processing],
    );
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }
}

async function getAgentRuntimeState(pool: pg.Pool, chatId: string): Promise<AgentRuntimeState> {
  const fallback: AgentRuntimeState = {
    paused: false,
    updated_at: null,
    nudge_nonce: 0,
    last_nudged_at: null,
    processing: false,
    last_user_message_at: null,
    last_assistant_message_at: null,
  };
  try {
    const stateRes = await pool.query(
      `SELECT agent_paused, nudge_nonce, last_nudged_at, updated_at
       FROM session_settings
       WHERE session_id = $1
       LIMIT 1`,
      [chatId],
    );
    const processingRes = await pool.query(
      `SELECT is_processing
       FROM chat_processing_state
       WHERE chat_id = $1
       LIMIT 1`,
      [chatId],
    );
    const messageStateRes = await pool.query(
      `SELECT
         MAX(CASE WHEN role = 'user' THEN created_at END) AS last_user_message_at,
         MAX(CASE WHEN role = 'assistant' THEN created_at END) AS last_assistant_message_at
       FROM messages
       WHERE chat_id = $1`,
      [chatId],
    );
    const row = stateRes.rows[0] || {};
    const msgRow = messageStateRes.rows[0] || {};
    return {
      paused: Boolean(row.agent_paused),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      nudge_nonce: Number(row.nudge_nonce || 0),
      last_nudged_at: row.last_nudged_at ? new Date(row.last_nudged_at).toISOString() : null,
      processing: Boolean(processingRes.rows[0]?.is_processing),
      last_user_message_at: msgRow.last_user_message_at
        ? new Date(msgRow.last_user_message_at).toISOString()
        : null,
      last_assistant_message_at: msgRow.last_assistant_message_at
        ? new Date(msgRow.last_assistant_message_at).toISOString()
        : null,
    };
  } catch (err) {
    if (isSchemaCompatError(err)) return fallback;
    throw err;
  }
}

async function setAgentPaused(
  pool: pg.Pool,
  chatId: string,
  paused: boolean,
  updatedBy: string,
): Promise<AgentRuntimeState> {
  try {
    const res = await pool.query(
      `INSERT INTO session_settings (session_id, agent_paused, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (session_id) DO UPDATE
       SET agent_paused = EXCLUDED.agent_paused,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by
       RETURNING agent_paused, nudge_nonce, last_nudged_at, updated_at`,
      [chatId, paused, updatedBy],
    );
    const processingRes = await pool.query(
      `SELECT is_processing
       FROM chat_processing_state
       WHERE chat_id = $1
       LIMIT 1`,
      [chatId],
    );
    const msgStateRes = await pool.query(
      `SELECT
         MAX(CASE WHEN role = 'user' THEN created_at END) AS last_user_message_at,
         MAX(CASE WHEN role = 'assistant' THEN created_at END) AS last_assistant_message_at
       FROM messages
       WHERE chat_id = $1`,
      [chatId],
    );
    return {
      paused: Boolean(res.rows[0]?.agent_paused),
      updated_at: res.rows[0]?.updated_at ? new Date(res.rows[0].updated_at).toISOString() : null,
      nudge_nonce: Number(res.rows[0]?.nudge_nonce || 0),
      last_nudged_at: res.rows[0]?.last_nudged_at ? new Date(res.rows[0].last_nudged_at).toISOString() : null,
      processing: Boolean(processingRes.rows[0]?.is_processing),
      last_user_message_at: msgStateRes.rows[0]?.last_user_message_at
        ? new Date(msgStateRes.rows[0].last_user_message_at).toISOString()
        : null,
      last_assistant_message_at: msgStateRes.rows[0]?.last_assistant_message_at
        ? new Date(msgStateRes.rows[0].last_assistant_message_at).toISOString()
        : null,
    };
  } catch (err) {
    if (isSchemaCompatError(err)) {
      return {
        paused: false,
        updated_at: null,
        nudge_nonce: 0,
        last_nudged_at: null,
        processing: false,
        last_user_message_at: null,
        last_assistant_message_at: null,
      };
    }
    throw err;
  }
}

async function findReadablePath(storagePath: string): Promise<string | null> {
  const raw = String(storagePath || '').trim();
  if (!raw || isHttpUrl(raw)) return null;

  const baseRoots = [
    process.env.ARTIFACT_STORAGE_ROOT,
    process.env.SVEN_STORAGE_ROOT,
    join(process.cwd(), 'storage'),
  ]
    .filter((v): v is string => !!v)
    .map((v) => resolve(v));

  if (baseRoots.length === 0) return null;

  const candidates = isAbsolute(raw)
    ? [resolve(raw)]
    : [resolve(raw), ...baseRoots.map((root) => resolve(root, raw))];

  for (const candidate of candidates) {
    let realCandidate: string;
    try {
      realCandidate = await fsRealpath(candidate);
    } catch {
      continue;
    }
    const allowed = baseRoots.some((root) => {
      try {
        const realRoot = realpathSync(root);
        return realCandidate === realRoot || realCandidate.startsWith(`${realRoot}${sep}`);
      } catch { return false; }
    });
    if (!allowed) continue;
    try {
      await access(realCandidate);
      return realCandidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveCompletionModelName(pool: pg.Pool, orgId: string | null): Promise<string | null> {
  try {
    if (orgId) {
      const scoped = await pool.query(
        `SELECT name
         FROM model_registry
         WHERE organization_id = $1 OR organization_id IS NULL
         ORDER BY organization_id DESC NULLS LAST, created_at ASC
         LIMIT 1`,
        [orgId],
      );
      if (scoped.rows.length > 0) return String(scoped.rows[0].name || '').trim() || null;
    }
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }

  const fallback = await pool.query(
    `SELECT name
     FROM model_registry
     WHERE organization_id IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
  );
  if (fallback.rows.length === 0) return null;
  return String(fallback.rows[0].name || '').trim() || null;
}

export async function runOneShotCompletionViaOpenAICompat(
  pool: pg.Pool,
  opts: {
    orgId: string | null;
    sessionToken: string;
    text: string;
    systemPrompt?: string | null;
  },
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  const modelName = await resolveCompletionModelName(pool, opts.orgId);
  if (!modelName) {
    return {
      ok: false,
      status: 503,
      code: 'MODEL_NOT_CONFIGURED',
      message: 'No model is configured for one-shot completion',
    };
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  const systemPrompt = String(opts.systemPrompt || '').trim();
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: opts.text });

  const port = Number(process.env.GATEWAY_PORT || 3000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const timeoutMs = normalizeOneShotCompletionTimeoutMs(process.env.CANVAS_ONE_SHOT_COMPLETION_TIMEOUT_MS);
  const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.sessionToken}`,
        'Content-Type': 'application/json',
      },
      signal: timeoutSignal,
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
      }),
    });
  } catch (err) {
    const errorName = String((err as { name?: string })?.name || '');
    if (errorName === 'AbortError' || errorName === 'TimeoutError') {
      logger.warn('One-shot completion request timed out', { timeout_ms: timeoutMs });
      return {
        ok: false,
        status: 504,
        code: 'COMPLETION_TIMEOUT',
        message: 'Completion request timed out',
      };
    }
    logger.warn('One-shot completion transport failure', {
      error: String((err as Error)?.message || err),
    });
    return {
      ok: false,
      status: 502,
      code: 'COMPLETION_UPSTREAM_ERROR',
      message: 'Completion endpoint is temporarily unavailable',
    };
  }

  let parsed: any = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    logger.warn('One-shot completion upstream rejected', {
      status: response.status,
      error_code: String(parsed?.error?.code || ''),
      error_message: String(parsed?.error?.message || ''),
      error_type: String(parsed?.error?.type || ''),
    });
    const errMsg = getOneShotCompletionPublicErrorMessage(response.status);
    return {
      ok: false,
      status: response.status,
      code: 'COMPLETION_UPSTREAM_ERROR',
      message: errMsg,
    };
  }

  const text = String(parsed?.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    return {
      ok: false,
      status: 502,
      code: 'EMPTY_COMPLETION',
      message: 'Completion provider returned an empty response',
    };
  }

  return { ok: true, text };
}

export function getOneShotCompletionPublicErrorMessage(status: number): string {
  if (status === 400) return 'Completion request was rejected';
  if (status === 401 || status === 403) return 'Completion authorization failed';
  if (status === 404) return 'Completion endpoint is unavailable';
  if (status === 408) return 'Completion request timed out';
  if (status === 429) return 'Completion service is rate limited';
  if (status >= 500) return 'Completion service is temporarily unavailable';
  return `Completion request failed with status ${status}`;
}

export function normalizeOneShotCompletionTimeoutMs(value: unknown): number {
  const fallback = 5000;
  const min = 100;
  const max = 10000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

export function normalizeWakeWordTimeoutMs(value: unknown): number {
  const fallback = 8000;
  const min = 250;
  const max = 30000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

export function normalizeVoiceCallOutboundTimeoutMs(value: unknown): number {
  const fallback = 10000;
  const min = 250;
  const max = 30000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

export function normalizeIsoTimestampCursor(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoLike.test(raw)) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeMessagesPageLimit(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return 50;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 200) return null;
  return parsed;
}

export function buildCanvasStreamEventId(kind: CanvasStreamEventKind, ts: string, id: string): string {
  const payload = JSON.stringify({
    k: kind,
    t: String(ts || ''),
    i: String(id || ''),
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function parseCanvasStreamEventId(value: unknown): CanvasStreamCursor | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const kindRaw = String(obj.k || '').trim() as CanvasStreamEventKind;
  const allowedKinds: CanvasStreamEventKind[] = ['message', 'approval', 'agent_state', 'agent_nudged'];
  if (!allowedKinds.includes(kindRaw)) return null;
  const ts = String(obj.t || '').trim();
  const id = String(obj.i || '').trim();
  if (!ts || !id) return null;
  const parsedTs = new Date(ts);
  if (Number.isNaN(parsedTs.getTime())) return null;
  return {
    kind: kindRaw,
    ts: parsedTs.toISOString(),
    id,
  };
}

export function shouldSkipCanvasStreamPollTick(inFlight: boolean): boolean {
  return inFlight;
}

type CanvasApprovalStreamEvent = {
  id: string;
  chat_id: string;
  status: string;
  tool_name: string;
  scope: string;
  requester_user_id: string;
  votes_approve: number;
  votes_deny: number;
  quorum_required: number;
  created_at: unknown;
  resolved_at: unknown;
  event_ts: unknown;
};

export function projectCanvasApprovalStreamEvent(row: Record<string, unknown>): CanvasApprovalStreamEvent {
  return {
    id: String(row.id || ''),
    chat_id: String(row.chat_id || ''),
    status: String(row.status || ''),
    tool_name: String(row.tool_name || ''),
    scope: String(row.scope || ''),
    requester_user_id: String(row.requester_user_id || ''),
    votes_approve: Number(row.votes_approve || 0),
    votes_deny: Number(row.votes_deny || 0),
    quorum_required: Number(row.quorum_required || 0),
    created_at: row.created_at ?? null,
    resolved_at: row.resolved_at ?? null,
    event_ts: row.event_ts ?? row.created_at ?? null,
  };
}

export function projectCanvasRunDetail(
  row: Record<string, unknown>,
  contextMessageId: string | null,
  linkedArtifacts: Array<Record<string, unknown>>,
): CanvasRunDetail {
  return {
    id: String(row.id || ''),
    tool_name: String(row.tool_name || ''),
    chat_id: String(row.chat_id || ''),
    user_id: String(row.user_id || ''),
    approval_id: row.approval_id ? String(row.approval_id) : null,
    status: String(row.status || ''),
    prev_hash: String(row.prev_hash || ''),
    run_hash: String(row.run_hash || ''),
    canonical_io_sha256: String(row.canonical_io_sha256 || ''),
    duration_ms: Number.isFinite(Number(row.duration_ms)) ? Number(row.duration_ms) : null,
    created_at: row.created_at ?? null,
    completed_at: row.completed_at ?? null,
    context_message_id: contextMessageId,
    linked_artifacts: linkedArtifacts,
  };
}

export function projectCanvasArtifactMetadata(
  row: Record<string, unknown>,
  artifactId: string,
): CanvasArtifactMetadata {
  return {
    id: String(row.id || artifactId),
    chat_id: String(row.chat_id || ''),
    message_id: row.message_id ? String(row.message_id) : null,
    name: String(row.name || ''),
    mime_type: String(row.mime_type || 'application/octet-stream'),
    size_bytes: Number.isFinite(Number(row.size_bytes)) ? Number(row.size_bytes) : null,
    created_at: row.created_at ?? null,
    is_private: Boolean(row.is_private),
    download_url: `/v1/artifacts/${encodeURIComponent(String(row.id || artifactId))}/download`,
  };
}

export function getWakeWordPublicErrorMessage(status: number): string {
  if (status === 400) return 'Wake-word request was rejected';
  if (status === 401 || status === 403) return 'Wake-word authorization failed';
  if (status === 404) return 'Wake-word service is unavailable';
  if (status === 408) return 'Wake-word request timed out';
  if (status === 429) return 'Wake-word service is rate limited';
  if (status >= 500) return 'Wake-word service is temporarily unavailable';
  return `Wake-word request failed with status ${status}`;
}

export function normalizeHealthNatsTimeoutMs(value: unknown): number {
  const fallback = 1000;
  const min = 100;
  const max = 10000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

export function normalizeArtifactUpstreamTimeoutMs(value: unknown): number {
  const fallback = 10000;
  const min = 250;
  const max = 30000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

export function getPublicProactiveHealthCheckErrorMessage(service: 'postgres' | 'nats'): string {
  if (service === 'postgres') return 'Database health check failed';
  return 'Message bus health check failed';
}

/**
 * User-facing Canvas API routes.
 * These power the Canvas UI and require an active session (any role).
 */
export async function registerCanvasRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  const requireAuth = requireRole(pool, 'admin', 'user');
  if (!a2uiNatsSubscribed) {
    a2uiNatsSubscribed = true;
    const sub = nc.subscribe(A2UI_EVENT_NATS_SUBJECT);
    void (async () => {
      for await (const msg of sub) {
        try {
          const decoded = a2uiNatsCodec.decode(msg.data);
          if (!decoded || typeof decoded !== 'object') continue;
          const sourceInstance = String(decoded.source_instance_id || '').trim();
          if (!sourceInstance || sourceInstance === A2UI_EVENT_NATS_SOURCE_INSTANCE) continue;
          const chatId = String(decoded.chat_id || '').trim();
          if (!chatId) continue;
          const evt = decoded.event;
          if (!evt || typeof evt !== 'object') continue;
          emitA2uiEvent(chatId, evt, { publishRemote: false });
        } catch (err) {
          logger.warn('Failed to process remote A2UI event', { error: String(err) });
        }
      }
    })();
  }

  // ─── GET /v1/me ───
  app.get('/v1/me', { preHandler: requireAuth }, async (request, reply) => {
    const result = await pool.query(
      `SELECT id, username, display_name, role, created_at, active_organization_id
       FROM users WHERE id = $1`,
      [request.userId],
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── POST /v1/complete ───
  // One-shot completion without creating a chat thread.
  app.post('/v1/complete', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['text'],
        additionalProperties: false,
        properties: {
          text: { type: 'string', minLength: 1 },
          system_prompt: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { text?: string; system_prompt?: string };
    const text = String(body.text || '').trim();
    if (!text) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'text is required' },
      });
    }

    const headerAuth = String(request.headers?.authorization || '').trim();
    const bearerToken = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7).trim() : '';
    const cookieToken = String(request.cookies?.sven_session || '').trim();
    const sessionToken = bearerToken || cookieToken;
    if (!sessionToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }

    const completion = await runOneShotCompletionViaOpenAICompat(pool, {
      orgId: request.orgId || null,
      sessionToken,
      text,
      systemPrompt: body.system_prompt || null,
    });
    if (!completion.ok) {
      return reply.status(completion.status).send({
        success: false,
        error: { code: completion.code, message: completion.message },
      });
    }

    reply.send({ success: true, data: { text: completion.text } });
  });

  // ─── POST /v1/incognito/messages ───
  // Ephemeral completion path that does not persist to chat history.
  app.post('/v1/incognito/messages', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['text'],
        additionalProperties: false,
        properties: {
          text: { type: 'string', minLength: 1 },
          incognito: { type: 'boolean' },
          stream: { type: 'boolean' },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { text?: string; incognito?: boolean };
    const text = String(body.text || '').trim();
    if (!text) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'text is required' },
      });
    }
    if (body.incognito === false) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'incognito must be true when provided' },
      });
    }

    const headerAuth = String(request.headers?.authorization || '').trim();
    const bearerToken = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7).trim() : '';
    const cookieToken = String(request.cookies?.sven_session || '').trim();
    const sessionToken = bearerToken || cookieToken;
    if (!sessionToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }

    const completion = await runOneShotCompletionViaOpenAICompat(pool, {
      orgId: request.orgId || null,
      sessionToken,
      text,
      systemPrompt: null,
    });
    if (!completion.ok) {
      return reply.status(completion.status).send({
        success: false,
        error: { code: completion.code, message: completion.message },
      });
    }

    reply.send({ success: true, data: { text: completion.text } });
  });

  // ─── GET /v1/proactive/preferences ───
  app.get('/v1/proactive/preferences', { preHandler: requireAuth }, async (request: any, reply) => {
    const prefs = await getUserProactivePreferences(pool, request.userId);
    reply.send({
      success: true,
      data: {
        channels: prefs.channels,
        quiet_hours: {
          start: prefs.quiet_hours_start,
          end: prefs.quiet_hours_end,
          timezone: prefs.quiet_hours_timezone,
        },
      },
    });
  });

  // ─── PUT /v1/proactive/preferences ───
  app.put('/v1/proactive/preferences', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          channels: { type: 'object', additionalProperties: { type: 'boolean' } },
          quiet_hours: {
            type: 'object',
            additionalProperties: false,
            properties: {
              start: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              end: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              timezone: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as {
      channels?: Record<string, boolean>;
      quiet_hours?: { start?: string | null; end?: string | null; timezone?: string };
    };

    const current = await getUserProactivePreferences(pool, request.userId);
    const channels = body.channels ? normalizeProactiveChannels(body.channels) : current.channels;

    const quietHours = body.quiet_hours || {};
    const nextStart = quietHours.start === undefined
      ? current.quiet_hours_start
      : (quietHours.start ? String(quietHours.start).trim() : null);
    const nextEnd = quietHours.end === undefined
      ? current.quiet_hours_end
      : (quietHours.end ? String(quietHours.end).trim() : null);
    const nextTimezone = quietHours.timezone === undefined
      ? current.quiet_hours_timezone
      : String(quietHours.timezone || '').trim() || 'UTC';

    const hasStart = Boolean(nextStart);
    const hasEnd = Boolean(nextEnd);
    if (hasStart !== hasEnd) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'quiet_hours.start and quiet_hours.end must be set together' },
      });
    }
    if (hasStart && !TIME_HH_MM_RE.test(String(nextStart))) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'quiet_hours.start must be HH:MM' },
      });
    }
    if (hasEnd && !TIME_HH_MM_RE.test(String(nextEnd))) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'quiet_hours.end must be HH:MM' },
      });
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: nextTimezone }).format(new Date());
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'quiet_hours.timezone is invalid' },
      });
    }

    try {
      await pool.query(
        `INSERT INTO user_proactive_preferences
           (user_id, channels, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, updated_at)
         VALUES ($1, $2::jsonb, $3, $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET channels = EXCLUDED.channels,
             quiet_hours_start = EXCLUDED.quiet_hours_start,
             quiet_hours_end = EXCLUDED.quiet_hours_end,
             quiet_hours_timezone = EXCLUDED.quiet_hours_timezone,
             updated_at = NOW()`,
        [
          request.userId,
          JSON.stringify(channels),
          hasStart ? nextStart : null,
          hasEnd ? nextEnd : null,
          nextTimezone,
        ],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'proactive preferences schema not initialized' },
        });
      }
      throw err;
    }

    reply.send({
      success: true,
      data: {
        channels,
        quiet_hours: {
          start: hasStart ? nextStart : null,
          end: hasEnd ? nextEnd : null,
          timezone: nextTimezone,
        },
      },
    });
  });

  // ─── GET /v1/proactive/patterns ───
  // Returns detected recurring question patterns for the caller.
  app.get('/v1/proactive/patterns', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = (request.query || {}) as { limit?: string };
    const limit = Math.min(Math.max(parseInt(String(query.limit || 20), 10) || 20, 1), 100);
    try {
      const res = await pool.query(
        `SELECT id, chat_id, sample_question, normalized_question, occurrences,
                first_seen_at, last_seen_at, suggested_answer, status, last_notified_at, created_at, updated_at
         FROM proactive_pattern_insights
         WHERE organization_id = $1 AND user_id = $2
         ORDER BY last_seen_at DESC
         LIMIT $3`,
        [request.orgId, request.userId, limit],
      );
      return reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'proactive pattern insights schema not initialized' },
        });
      }
      throw err;
    }
  });

  // ─── POST /v1/proactive/patterns/scan ───
  // Detect recurring user questions and proactively create answer messages.
  app.post('/v1/proactive/patterns/scan', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 90 },
          min_occurrences: { type: 'integer', minimum: 1, maximum: 10 },
          max_patterns: { type: 'integer', minimum: 1, maximum: 20 },
        },
      },
    },
  }, async (request: any, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const body = (request.body || {}) as {
      days?: number;
      min_occurrences?: number;
      max_patterns?: number;
    };
    const days = Math.min(Math.max(Number(body.days || 14), 1), 90);
    const minOccurrences = Math.min(Math.max(Number(body.min_occurrences || 3), 1), 10);
    const maxPatterns = Math.min(Math.max(Number(body.max_patterns || 5), 1), 20);
    const sessionToken = extractSessionTokenFromRequest(request);

    type Candidate = {
      chat_id: string;
      channel: string;
      normalized_question: string;
      sample_question: string;
      occurrences: number;
      first_seen_at: Date;
      last_seen_at: Date;
    };
    const grouped = new Map<string, Candidate>();

    let scannedMessages = 0;
    try {
      const rows = await pool.query(
        `SELECT m.chat_id, m.text, m.created_at, c.channel
         FROM messages m
         JOIN chats c ON c.id = m.chat_id
         WHERE m.role = 'user'
           AND m.sender_user_id = $1
           AND c.organization_id = $2
           AND m.created_at >= NOW() - ($3 || ' days')::interval
           AND m.text IS NOT NULL
         ORDER BY m.created_at DESC
         LIMIT 4000`,
        [request.userId, request.orgId, String(days)],
      );
      scannedMessages = rows.rows.length;

      for (const row of rows.rows as Array<{ chat_id: string; text: string; created_at: string; channel: string }>) {
        const rawText = String(row.text || '').trim();
        if (rawText.length < 8) continue;
        const normalized = normalizePatternQuestion(rawText);
        if (normalized.length < 8) continue;
        const key = `${row.chat_id}::${normalized}`;
        const createdAt = new Date(row.created_at);
        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, {
            chat_id: row.chat_id,
            channel: String(row.channel || 'canvas').trim().toLowerCase() || 'canvas',
            normalized_question: normalized,
            sample_question: rawText.slice(0, 500),
            occurrences: 1,
            first_seen_at: createdAt,
            last_seen_at: createdAt,
          });
          continue;
        }
        existing.occurrences += 1;
        if (createdAt < existing.first_seen_at) existing.first_seen_at = createdAt;
        if (createdAt > existing.last_seen_at) existing.last_seen_at = createdAt;
      }
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'required chat schema not initialized' },
        });
      }
      throw err;
    }

    const candidates = Array.from(grouped.values())
      .filter((row) => row.occurrences >= minOccurrences)
      .sort((a, b) => {
        if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
        return b.last_seen_at.getTime() - a.last_seen_at.getTime();
      })
      .slice(0, maxPatterns);

    let proactiveMessagesCreated = 0;
    const insights: Array<Record<string, unknown>> = [];

    for (const candidate of candidates) {
      try {
        const upsert = await pool.query(
          `INSERT INTO proactive_pattern_insights
             (id, organization_id, user_id, chat_id, normalized_question, sample_question, occurrences,
              first_seen_at, last_seen_at, status, created_at, updated_at)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW(), NOW())
           ON CONFLICT (organization_id, user_id, chat_id, normalized_question)
           DO UPDATE SET
             sample_question = EXCLUDED.sample_question,
             occurrences = EXCLUDED.occurrences,
             first_seen_at = LEAST(proactive_pattern_insights.first_seen_at, EXCLUDED.first_seen_at),
             last_seen_at = GREATEST(proactive_pattern_insights.last_seen_at, EXCLUDED.last_seen_at),
             updated_at = NOW()
           RETURNING id, chat_id, sample_question, normalized_question, occurrences, first_seen_at, last_seen_at, suggested_answer, status, last_notified_at`,
          [
            uuidv7(),
            request.orgId,
            request.userId,
            candidate.chat_id,
            candidate.normalized_question,
            candidate.sample_question,
            candidate.occurrences,
            candidate.first_seen_at.toISOString(),
            candidate.last_seen_at.toISOString(),
          ],
        );
        const insight = upsert.rows[0] as {
          id: string;
          chat_id: string;
          sample_question: string;
          occurrences: number;
          last_notified_at: string | null;
        };

        const lastNotified = insight.last_notified_at ? Date.parse(insight.last_notified_at) : 0;
        const notifyEligible = !lastNotified || (Date.now() - lastNotified) >= 24 * 60 * 60 * 1000;
        let messageCreated = false;
        let suppressionReason: string | null = null;
        if (notifyEligible) {
          const delivery = await evaluateProactiveDelivery(pool, {
            orgId: request.orgId,
            userId: request.userId,
            channel: candidate.channel,
          });
          if (!delivery.allowed) {
            suppressionReason = delivery.reason;
          } else {
            let answer = buildPatternFallbackAnswer(insight.sample_question, insight.occurrences);
            if (sessionToken) {
              const completion = await runOneShotCompletionViaOpenAICompat(pool, {
                orgId: request.orgId || null,
                sessionToken,
                systemPrompt: 'You generate concise proactive answers for recurring user questions.',
                text: `The user repeatedly asked this question ${insight.occurrences} times:\n"${insight.sample_question}"\nProvide a short, actionable answer (2-4 sentences).`,
              });
              if (completion.ok) {
                answer = completion.text;
              }
            }

            const proactiveMessage = `Proactive insight: I noticed this recurring question (${insight.occurrences}x): "${insight.sample_question}".\n\n${answer}`;
            await pool.query(
              `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, created_at)
               VALUES ($1, $2, NULL, 'assistant', 'text', $3, NOW())`,
              [uuidv7(), insight.chat_id, proactiveMessage],
            );
            await pool.query(
              `UPDATE proactive_pattern_insights
               SET suggested_answer = $2, last_notified_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [insight.id, answer],
            );
            proactiveMessagesCreated += 1;
            messageCreated = true;
          }
        }

        insights.push({
          id: insight.id,
          chat_id: insight.chat_id,
          sample_question: insight.sample_question,
          occurrences: insight.occurrences,
          notified: messageCreated,
          suppressed_reason: suppressionReason,
        });
      } catch (err) {
        if (isSchemaCompatError(err)) {
          return reply.status(503).send({
            success: false,
            error: { code: 'FEATURE_UNAVAILABLE', message: 'proactive pattern insights schema not initialized' },
          });
        }
        throw err;
      }
    }

    return reply.send({
      success: true,
      data: {
        scanned_messages: scannedMessages,
        detected_patterns: candidates.length,
        proactive_messages_created: proactiveMessagesCreated,
        insights,
      },
    });
  });

  // ─── GET /v1/proactive/calendar/upcoming ───
  app.get('/v1/proactive/calendar/upcoming', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = (request.query || {}) as { lookahead_hours?: string; limit?: string };
    const lookaheadHours = Math.min(Math.max(parseInt(String(query.lookahead_hours || 24), 10) || 24, 1), 168);
    const limit = Math.min(Math.max(parseInt(String(query.limit || 10), 10) || 10, 1), 50);
    try {
      const res = await pool.query(
        `SELECT ce.id, ce.title, ce.description, ce.start_time, ce.end_time, ce.location, ce.status,
                cs.calendar_name, ca.account_name, ca.provider
         FROM calendar_events ce
         JOIN calendar_subscriptions cs ON cs.id = ce.subscription_id AND cs.sync_enabled = TRUE
         JOIN calendar_accounts ca ON ca.id = cs.account_id AND ca.enabled = TRUE
         WHERE ca.user_id = $1
           AND ca.organization_id = $4
           AND ce.status <> 'cancelled'
           AND COALESCE(ce.organizer, '') <> $5
           AND ce.start_time >= NOW()
           AND ce.start_time <= NOW() + ($2 || ' hours')::interval
         ORDER BY ce.start_time ASC
         LIMIT $3`,
        [request.userId, String(lookaheadHours), limit, request.orgId, CALENDAR_SIMULATION_ORGANIZER],
      );
      return reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'calendar schema not initialized' },
        });
      }
      throw err;
    }
  });

  // ─── POST /v1/proactive/calendar/prefetch ───
  app.post('/v1/proactive/calendar/prefetch', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chat_id: { type: 'string' },
          lookahead_hours: { type: 'integer', minimum: 1, maximum: 168 },
          max_events: { type: 'integer', minimum: 1, maximum: 20 },
        },
      },
    },
  }, async (request: any, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const body = (request.body || {}) as { chat_id?: string; lookahead_hours?: number; max_events?: number };
    const lookaheadHours = Math.min(Math.max(Number(body.lookahead_hours || 24), 1), 168);
    const maxEvents = Math.min(Math.max(Number(body.max_events || 5), 1), 20);

    let chatId = String(body.chat_id || '').trim();
    if (chatId) {
      const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
      if (!member) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of target chat' } });
      }
    } else {
      const fallbackChat = await pool.query(
        `SELECT c.id
         FROM chats c
         JOIN chat_members cm ON cm.chat_id = c.id
         WHERE cm.user_id = $1
           AND c.organization_id = $2
         ORDER BY c.updated_at DESC
         LIMIT 1`,
        [request.userId, request.orgId],
      );
      if (fallbackChat.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No available chat for proactive prefetch' } });
      }
      chatId = String(fallbackChat.rows[0].id);
    }

    type EventRow = {
      id: string;
      title: string;
      description: string | null;
      start_time: string;
      end_time: string;
      location: string | null;
      status: string;
      calendar_name: string | null;
      account_name: string | null;
      provider: string;
    };
    let events: EventRow[] = [];
    try {
      const res = await pool.query(
        `SELECT ce.id, ce.title, ce.description, ce.start_time, ce.end_time, ce.location, ce.status,
                cs.calendar_name, ca.account_name, ca.provider
         FROM calendar_events ce
         JOIN calendar_subscriptions cs ON cs.id = ce.subscription_id AND cs.sync_enabled = TRUE
         JOIN calendar_accounts ca ON ca.id = cs.account_id AND ca.enabled = TRUE
         WHERE ca.user_id = $1
           AND ca.organization_id = $4
           AND ce.status <> 'cancelled'
           AND COALESCE(ce.organizer, '') <> $5
           AND ce.start_time >= NOW()
           AND ce.start_time <= NOW() + ($2 || ' hours')::interval
         ORDER BY ce.start_time ASC
         LIMIT $3`,
        [request.userId, String(lookaheadHours), maxEvents, request.orgId, CALENDAR_SIMULATION_ORGANIZER],
      );
      events = res.rows as EventRow[];
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'calendar schema not initialized' },
        });
      }
      throw err;
    }

    if (events.length === 0) {
      return reply.send({
        success: true,
        data: { chat_id: chatId, prefetched_events: 0, message_created: false, reason: 'no_upcoming_events' },
      });
    }

    let newEvents: EventRow[] = [];
    try {
      const ids = events.map((row) => row.id);
      const dedupe = await pool.query(
        `SELECT calendar_event_id
         FROM proactive_calendar_prefetch_runs
         WHERE user_id = $1
           AND chat_id = $2
           AND prefetch_date = CURRENT_DATE
           AND calendar_event_id = ANY($3::text[])`,
        [request.userId, chatId, ids],
      );
      const seen = new Set(dedupe.rows.map((row) => String(row.calendar_event_id)));
      newEvents = events.filter((row) => !seen.has(row.id));
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'calendar prefetch ledger schema not initialized' },
        });
      }
      throw err;
    }

    if (newEvents.length === 0) {
      return reply.send({
        success: true,
        data: { chat_id: chatId, prefetched_events: 0, message_created: false, reason: 'already_prefetched_today' },
      });
    }

    const chatChannel = await getChatChannel(pool, chatId, request.orgId);
    const delivery = await evaluateProactiveDelivery(pool, {
      orgId: request.orgId,
      userId: request.userId,
      channel: chatChannel,
    });
    if (!delivery.allowed) {
      return reply.send({
        success: true,
        data: {
          chat_id: chatId,
          prefetched_events: newEvents.length,
          message_created: false,
          reason: delivery.reason,
        },
      });
    }

    const eventLines = newEvents.map((ev, idx) => {
      const when = `${formatCalendarUtc(ev.start_time)} -> ${formatCalendarUtc(ev.end_time)}`;
      const where = ev.location ? ` at ${ev.location}` : '';
      const source = ev.calendar_name || ev.account_name || ev.provider;
      return `${idx + 1}. ${ev.title} (${when}${where}) [${source}]`;
    });
    let proactiveBody = `I pre-fetched context for your upcoming meetings in the next ${lookaheadHours}h:\n${eventLines.join('\n')}`;

    const sessionToken = extractSessionTokenFromRequest(request);
    if (sessionToken) {
      const completion = await runOneShotCompletionViaOpenAICompat(pool, {
        orgId: request.orgId || null,
        sessionToken,
        systemPrompt: 'You are a proactive assistant generating brief meeting prep context.',
        text: `Upcoming meetings:\n${eventLines.join('\n')}\n\nCreate concise prep notes and suggested focus points for each meeting.`,
      });
      if (completion.ok) {
        proactiveBody = `Calendar prefetch:\n\n${completion.text}`;
      }
    }

    const messageId = uuidv7();
    await pool.query(
      `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, created_at)
       VALUES ($1, $2, NULL, 'assistant', 'text', $3, NOW())`,
      [messageId, chatId, proactiveBody],
    );
    try {
      for (const ev of newEvents) {
        await pool.query(
          `INSERT INTO proactive_calendar_prefetch_runs
             (id, organization_id, user_id, chat_id, calendar_event_id, prefetch_date, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NOW())
           ON CONFLICT (user_id, chat_id, calendar_event_id, prefetch_date) DO NOTHING`,
          [uuidv7(), request.orgId, request.userId, chatId, ev.id],
        );
      }
    } catch (err) {
      if (!isSchemaCompatError(err)) throw err;
    }

    return reply.send({
      success: true,
      data: {
        chat_id: chatId,
        message_id: messageId,
        prefetched_events: newEvents.length,
        message_created: true,
      },
    });
  });

  // ─── GET /v1/proactive/health/issues ───
  app.get('/v1/proactive/health/issues', { preHandler: requireAuth }, async (request: any, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = (request.query || {}) as { limit?: string };
    const limit = Math.min(Math.max(parseInt(String(query.limit || 20), 10) || 20, 1), 100);
    try {
      const res = await pool.query(
        `SELECT id, chat_id, issue_key, services, severity, summary, occurrences,
                first_detected_at, last_detected_at, last_notified_at, report_date, created_at, updated_at
         FROM proactive_health_issues
         WHERE organization_id = $1 AND user_id = $2
         ORDER BY last_detected_at DESC
         LIMIT $3`,
        [request.orgId, request.userId, limit],
      );
      return reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'health issue ledger schema not initialized' },
        });
      }
      throw err;
    }
  });

  // ─── POST /v1/proactive/health/scan ───
  app.post('/v1/proactive/health/scan', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chat_id: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const body = (request.body || {}) as { chat_id?: string };
    let chatId = String(body.chat_id || '').trim();
    if (chatId) {
      const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
      if (!member) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of target chat' } });
      }
    } else {
      const fallbackChat = await pool.query(
        `SELECT c.id
         FROM chats c
         JOIN chat_members cm ON cm.chat_id = c.id
         WHERE cm.user_id = $1
           AND c.organization_id = $2
         ORDER BY c.updated_at DESC
         LIMIT 1`,
        [request.userId, request.orgId],
      );
      if (fallbackChat.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No available chat for health report' } });
      }
      chatId = String(fallbackChat.rows[0].id);
    }

    const issues: Array<{ service: string; severity: 'info' | 'warning' | 'critical'; message: string }> = [];

    try {
      await pool.query('SELECT 1');
    } catch (err) {
      logger.warn('Proactive health postgres check failed', {
        error: String((err as Error)?.message || err),
      });
      issues.push({
        service: 'postgres',
        severity: 'critical',
        message: getPublicProactiveHealthCheckErrorMessage('postgres'),
      });
    }

    try {
      const timeoutRaw = process.env.HEALTH_NATS_TIMEOUT_MS;
      const timeoutMs = normalizeHealthNatsTimeoutMs(timeoutRaw);
      if (timeoutRaw !== undefined && Number(timeoutRaw) !== timeoutMs) {
        logger.warn('Normalized HEALTH_NATS_TIMEOUT_MS to safe bounds', {
          provided: String(timeoutRaw),
          normalized_ms: timeoutMs,
        });
      }
      const ok = await Promise.race([
        nc.flush().then(() => true).catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
      if (!ok || nc.isClosed()) {
        issues.push({ service: 'nats', severity: 'critical', message: 'Message bus health check failed' });
      }
    } catch (err) {
      logger.warn('Proactive health NATS check failed', {
        error: String((err as Error)?.message || err),
      });
      issues.push({
        service: 'nats',
        severity: 'critical',
        message: getPublicProactiveHealthCheckErrorMessage('nats'),
      });
    }

    try {
      const calendarErrorCount = await pool.query(
        `SELECT COUNT(*)::int AS c
         FROM calendar_accounts
         WHERE user_id = $1
           AND enabled = TRUE
           AND sync_error IS NOT NULL
           AND length(trim(sync_error)) > 0`,
        [request.userId],
      );
      const c = Number(calendarErrorCount.rows[0]?.c || 0);
      if (c > 0) {
        issues.push({ service: 'calendar', severity: 'warning', message: `${c} calendar account(s) have sync errors` });
      }
    } catch (err) {
      if (!isSchemaCompatError(err)) throw err;
    }

    try {
      const sim = await pool.query(
        `SELECT value
         FROM organization_settings
         WHERE organization_id = $1 AND key = 'proactive.health.simulatedIssue'
         LIMIT 1`,
        [request.orgId],
      );
      if (sim.rows.length > 0) {
        const value = sim.rows[0].value;
        const payload = typeof value === 'string' ? JSON.parse(value) : value;
        if (payload?.enabled) {
          const sev = ['info', 'warning', 'critical'].includes(String(payload.severity))
            ? String(payload.severity) as 'info' | 'warning' | 'critical'
            : 'warning';
          issues.push({
            service: String(payload.service || 'simulated'),
            severity: sev,
            message: String(payload.message || 'Simulated service degradation'),
          });
        }
      }
    } catch {
      // simulation config is optional
    }

    if (issues.length === 0) {
      return reply.send({
        success: true,
        data: { chat_id: chatId, status: 'healthy', issues_detected: 0, message_created: false },
      });
    }

    const services = Array.from(new Set(issues.map((i) => i.service))).sort();
    const summary = issues.map((i) => `${i.service}: ${i.message}`).join(' | ').slice(0, 2000);
    const highestSeverity = issues
      .map((i) => i.severity)
      .sort((a, b) => healthSeverityRank(b) - healthSeverityRank(a))[0] || 'warning';
    const issueKey = createHash('sha1').update(`${services.join(',')}|${summary}`).digest('hex');

    let notify = false;
    let issueId: string | null = null;
    let suppressedReason: string | null = null;
    try {
      const upsert = await pool.query(
        `INSERT INTO proactive_health_issues
           (id, organization_id, user_id, chat_id, issue_key, services, severity, summary, occurrences,
            first_detected_at, last_detected_at, report_date, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 1, NOW(), NOW(), CURRENT_DATE, NOW(), NOW())
         ON CONFLICT (user_id, chat_id, issue_key, report_date)
         DO UPDATE SET
           services = EXCLUDED.services,
           severity = EXCLUDED.severity,
           summary = EXCLUDED.summary,
           occurrences = proactive_health_issues.occurrences + 1,
           last_detected_at = NOW(),
           updated_at = NOW()
         RETURNING id, last_notified_at`,
        [
          uuidv7(),
          request.orgId,
          request.userId,
          chatId,
          issueKey,
          JSON.stringify(services),
          highestSeverity,
          summary,
        ],
      );
      issueId = String(upsert.rows[0]?.id || '');
      const lastNotified = upsert.rows[0]?.last_notified_at ? Date.parse(String(upsert.rows[0].last_notified_at)) : 0;
      notify = !lastNotified || (Date.now() - lastNotified) >= 60 * 60 * 1000;
      const chatChannel = await getChatChannel(pool, chatId, request.orgId);
      const delivery = await evaluateProactiveDelivery(pool, {
        orgId: request.orgId,
        userId: request.userId,
        channel: chatChannel,
      });
      if (notify && issueId && delivery.allowed) {
        const bodyText = `Proactive health alert (${highestSeverity}):\n${issues.map((i) => `- [${i.service}] ${i.message}`).join('\n')}`;
        const msgId = uuidv7();
        await pool.query(
          `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, created_at)
           VALUES ($1, $2, NULL, 'assistant', 'text', $3, NOW())`,
          [msgId, chatId, bodyText],
        );
        await pool.query(
          `UPDATE proactive_health_issues
           SET last_notified_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
          [issueId],
        );
      } else if (notify && !delivery.allowed) {
        suppressedReason = delivery.reason;
        notify = false;
      }
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'health issue ledger schema not initialized' },
        });
      }
      throw err;
    }

    return reply.send({
      success: true,
      data: {
        chat_id: chatId,
        status: 'issues_detected',
        issues_detected: issues.length,
        services,
        severity: highestSeverity,
        message_created: notify,
        issue_id: issueId,
        suppressed_reason: suppressedReason,
      },
    });
  });

  // ─── GET /v1/chats ───
  // Returns chats the authenticated user belongs to (paginated)
  app.get('/v1/chats', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = (request.query || {}) as { limit?: string | number; offset?: string | number };
    const limit = Math.min(Math.max(parseInt(String(query.limit ?? 40), 10) || 40, 1), 200);
    const offset = Math.max(parseInt(String(query.offset ?? 0), 10) || 0, 0);
    const result = await pool.query(
      `SELECT c.id, c.name, c.type, c.channel, c.created_at, c.updated_at,
              (SELECT COUNT(*)::int FROM messages m WHERE m.chat_id = c.id) AS message_count,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.chat_id = c.id) AS last_message_at
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id
       WHERE cm.user_id = $1 AND c.organization_id = $2
       ORDER BY c.updated_at DESC
      LIMIT $3 OFFSET $4`,
      [request.userId, request.orgId, limit + 1, offset],
    );
    const paged = paginateRows(result.rows, limit, offset);
    reply.send({ success: true, data: { rows: paged.rows, has_more: paged.page.has_more } });
  });

  // ─── POST /v1/chats ───
  // Create a new user-scoped chat and join the caller as admin member.
  app.post('/v1/chats', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['dm', 'group'] },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const body = (request.body || {}) as { name?: string; type?: string };
    const type = body.type === 'dm' || body.type === 'group' ? body.type : 'dm';
    const name = String(body.name || '').trim() || 'New chat';
    const chatId = uuidv7();
    const memberId = uuidv7();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO chats (id, organization_id, name, type, channel, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'canvas', NOW(), NOW())`,
        [chatId, request.orgId, name, type],
      );
      await client.query(
        `INSERT INTO chat_members (id, chat_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, 'admin', NOW())`,
        [memberId, chatId, request.userId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    reply.status(201).send({
      success: true,
      data: {
        id: chatId,
        name,
        type,
        channel: 'canvas',
        created_at: new Date().toISOString(),
      },
    });
  });

  // ─── GET /v1/chats/:chatId ───
  app.get('/v1/chats/:chatId', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    // Verify membership
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }

    const result = await pool.query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id) AS message_count
       FROM chats c WHERE c.id = $1`,
      [chatId],
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }

    const members = await pool.query(
      `SELECT cm.*, u.username, u.display_name, u.role AS user_role
       FROM chat_members cm JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = $1`,
      [chatId],
    );

    reply.send({
      success: true,
      data: { ...result.rows[0], members: members.rows },
    });
  });

  // ─── PATCH /v1/chats/:chatId ───
  // Rename a chat the caller belongs to.
  app.patch('/v1/chats/:chatId', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { name } = (request.body || {}) as { name?: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const nextName = String(name || '').trim();
    if (!nextName) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name is required' },
      });
    }

    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }

    const result = await pool.query(
      `UPDATE chats
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING id, name, type, channel, updated_at`,
      [nextName, chatId, request.orgId],
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── GET /v1/chats/:chatId/agent-state ───
  app.get('/v1/chats/:chatId/agent-state', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }
    const state = await getAgentRuntimeState(pool, chatId);
    reply.send({
      success: true,
      data: {
        chat_id: chatId,
        paused: state.paused,
        updated_at: state.updated_at,
        nudge_nonce: state.nudge_nonce,
        last_nudged_at: state.last_nudged_at,
        processing: state.processing,
        last_user_message_at: state.last_user_message_at,
        last_assistant_message_at: state.last_assistant_message_at,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/agent/pause ───
  app.post('/v1/chats/:chatId/agent/pause', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }
    const state = await setAgentPaused(pool, chatId, true, request.userId || 'system');
    reply.send({
      success: true,
      data: {
        chat_id: chatId,
        paused: state.paused,
        updated_at: state.updated_at,
        nudge_nonce: state.nudge_nonce,
        last_nudged_at: state.last_nudged_at,
        processing: state.processing,
        last_user_message_at: state.last_user_message_at,
        last_assistant_message_at: state.last_assistant_message_at,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/agent/resume ───
  app.post('/v1/chats/:chatId/agent/resume', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }
    const state = await setAgentPaused(pool, chatId, false, request.userId || 'system');
    reply.send({
      success: true,
      data: {
        chat_id: chatId,
        paused: state.paused,
        updated_at: state.updated_at,
        nudge_nonce: state.nudge_nonce,
        last_nudged_at: state.last_nudged_at,
        processing: state.processing,
        last_user_message_at: state.last_user_message_at,
        last_assistant_message_at: state.last_assistant_message_at,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/agent/nudge ───
  // Best-effort unstick: invalidate current turn and retry the latest user message.
  app.post('/v1/chats/:chatId/agent/nudge', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }

    const lastUserRes = await pool.query(
      `SELECT id, text, created_at, sender_identity_id
       FROM messages
       WHERE chat_id = $1 AND role = 'user'
       ORDER BY created_at DESC
       LIMIT 1`,
      [chatId],
    );
    if (lastUserRes.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No user message found to nudge' },
      });
    }
    const lastUser = lastUserRes.rows[0];
    const lastUserMessageId = String(lastUser.id || '');
    const text = String(lastUser.text || '').trim();
    if (!text) {
      return reply.status(409).send({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Latest user message has no text to retry' },
      });
    }

    const processingRes = await pool.query(
      `SELECT is_processing
       FROM chat_processing_state
       WHERE chat_id = $1
       LIMIT 1`,
      [chatId],
    );
    const processing = Boolean(processingRes.rows[0]?.is_processing);

    let identityId = String(lastUser.sender_identity_id || '');
    if (!identityId) {
      identityId = await ensureCanvasIdentity(pool, String(request.userId));
    }

    const state = await pool.query(
      `INSERT INTO session_settings (session_id, nudge_nonce, last_nudged_at, updated_at, updated_by)
       VALUES ($1, 1, NOW(), NOW(), $2)
       ON CONFLICT (session_id) DO UPDATE
       SET nudge_nonce = COALESCE(session_settings.nudge_nonce, 0) + 1,
           last_nudged_at = NOW(),
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by
       RETURNING nudge_nonce, last_nudged_at`,
      [chatId, request.userId || 'system'],
    );
    const nudgeNonce = Number(state.rows[0]?.nudge_nonce || 1);
    const lastNudgedAt = state.rows[0]?.last_nudged_at
      ? new Date(state.rows[0].last_nudged_at).toISOString()
      : new Date().toISOString();

    try {
      await setChatProcessing(pool, chatId, false);
    } catch {
      // Best effort only.
    }

    const nudgeEventId = uuidv7();
    try {
      await pool.query(
        `INSERT INTO agent_nudge_events (id, chat_id, user_id, action, context, created_at)
         VALUES ($1, $2, $3, 'resubmit_last_user_message', $4::jsonb, NOW())`,
        [nudgeEventId, chatId, request.userId, JSON.stringify({
          source: 'chat_ui',
          processing,
          last_user_message_id: lastUserMessageId,
          retried_text_preview: text.slice(0, 240),
          nudge_nonce: nudgeNonce,
        })],
      );
    } catch (err) {
      if (!isSchemaCompatError(err)) throw err;
    }

    const replayEventId = uuidv7();
    const correlationId = request.correlationId || String(request.id || replayEventId);
    try {
      const js = nc.jetstream();
      await js.publish('inbound.message.canvas', Buffer.from(JSON.stringify({
        schema_version: '1.0',
        event_id: replayEventId,
        occurred_at: new Date().toISOString(),
        data: {
          channel: 'canvas',
          channel_message_id: replayEventId,
          chat_id: chatId,
          sender_identity_id: identityId,
          content_type: 'text',
          text,
          metadata: withCorrelationMetadata({
            nudge: true,
            nudge_nonce: nudgeNonce,
            nudge_original_message_id: lastUserMessageId,
            nudged_by_user_id: request.userId,
          }, correlationId),
        },
      })));
    } catch (err) {
      logger.error('Failed to publish nudge replay event', { chat_id: chatId, err: String(err) });
      return reply.status(503).send({
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Unable to dispatch nudge retry event' },
      });
    }

    reply.send({
      success: true,
      data: {
        chat_id: chatId,
        nudged: true,
        nudge_event_id: nudgeEventId,
        replay_event_id: replayEventId,
        nudge_nonce: nudgeNonce,
        last_nudged_at: lastNudgedAt,
        retried_message_id: lastUserMessageId,
      },
    });
  });

  // ─── DELETE /v1/chats/:chatId ───
  // Delete a chat for the caller:
  // - If multiple members, remove caller membership only.
  // - If caller is the last member, delete the chat.
  app.delete('/v1/chats/:chatId', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this chat' } });
    }

    const chatRes = await pool.query(
      `SELECT id, type FROM chats WHERE id = $1 AND organization_id = $2`,
      [chatId, request.orgId],
    );
    if (chatRes.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }
    if (chatRes.rows[0].type === 'hq') {
      return reply.status(400).send({
        success: false,
        error: { code: 'PROTECTED', message: 'Cannot delete the HQ chat' },
      });
    }

    const memberCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM chat_members WHERE chat_id = $1`,
      [chatId],
    );
    const memberCount = Number(memberCountRes.rows[0]?.count || 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (memberCount > 1) {
        await client.query(
          `DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2`,
          [chatId, request.userId],
        );
      } else {
        await client.query(`DELETE FROM chats WHERE id = $1 AND organization_id = $2`, [chatId, request.orgId]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    reply.send({
      success: true,
      data: { chat_id: chatId, deleted: memberCount <= 1, left: memberCount > 1 },
    });
  });

  // ─── GET /v1/chats/:chatId/messages ───
  app.get('/v1/chats/:chatId/messages', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { before, limit = '50' } = request.query as { before?: string; limit?: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    // Verify membership
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const max = normalizeMessagesPageLimit(limit);
    if (!max) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 200' },
      });
    }
    const beforeCursorRaw = String(before || '').trim();
    const beforeCursor = beforeCursorRaw ? normalizeIsoTimestampCursor(beforeCursorRaw) : null;
    if (beforeCursorRaw && !beforeCursor) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'before must be a valid ISO timestamp' },
      });
    }
    let query = `SELECT m.*, mf.feedback AS user_feedback
                 FROM messages m
                 LEFT JOIN message_feedback mf ON mf.message_id = m.id AND mf.user_id = $2
                 WHERE m.chat_id = $1`;
    const params: unknown[] = [chatId, request.userId];

    if (beforeCursor) {
      params.push(beforeCursor);
      query += ` AND m.created_at < $${params.length}`;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(max + 1);

    let result;
    try {
      result = await pool.query(query, params);
    } catch (err) {
      if (!isSchemaCompatError(err)) throw err;

      // Backward-compat fallback: message_feedback table not available yet.
      let fallbackQuery = `SELECT * FROM messages WHERE chat_id = $1`;
      const fallbackParams: unknown[] = [chatId];
      if (beforeCursor) {
        fallbackParams.push(beforeCursor);
        fallbackQuery += ` AND created_at < $${fallbackParams.length}`;
      }
      fallbackQuery += ` ORDER BY created_at DESC LIMIT $${fallbackParams.length + 1}`;
      fallbackParams.push(max + 1);
      result = await pool.query(fallbackQuery, fallbackParams);
    }
    const paged = paginateRows(result.rows, max, 0);
    let rows = paged.rows.reverse();
    let hasMore = paged.page.has_more;

    // Include queued (not-yet-dispatched) messages at the tail for live composer feedback.
    if (!beforeCursor) {
      try {
        await pruneExpiredQueuedMessages(pool, chatId);
        const plan = buildQueuedTailPlan(max, rows.length);
        if (plan.queuedFetchLimit > 0) {
          const queuedRes = await pool.query(
            `SELECT q.id, q.chat_id, q.user_id, q.text, q.created_at,
                    ROW_NUMBER() OVER (ORDER BY q.created_at ASC, q.id ASC)::int AS queue_position
             FROM chat_message_queue q
             WHERE q.chat_id = $1 AND q.status = 'queued'
             ORDER BY q.created_at ASC, q.id ASC
             LIMIT $2`,
            [chatId, plan.queuedFetchLimit],
          );
          const queuedHasMore = queuedRes.rows.length > plan.remainingSlots;
          const queuedRows = queuedRes.rows.slice(0, plan.remainingSlots).map((q: any) => ({
            id: String(q.id),
            chat_id: String(q.chat_id),
            sender_user_id: String(q.user_id),
            sender_identity_id: null,
            role: 'user',
            content_type: 'text',
            text: String(q.text || ''),
            blocks: null,
            channel_message_id: null,
            created_at: String(q.created_at),
            user_feedback: null,
            status: 'queued',
            queue_id: String(q.id),
            queue_position: Number(q.queue_position || 0),
          }));
          rows = [...rows, ...queuedRows];
          hasMore = hasMore || queuedHasMore;
        } else if (plan.queuedExistsProbe) {
          const queuedExistsRes = await pool.query(
            `SELECT 1
             FROM chat_message_queue q
             WHERE q.chat_id = $1 AND q.status = 'queued'
             LIMIT 1`,
            [chatId],
          );
          hasMore = hasMore || queuedExistsRes.rows.length > 0;
        }
      } catch (err) {
        if (!isSchemaCompatError(err)) throw err;
      }
    }

    reply.send({ success: true, data: { rows, has_more: hasMore } });
  });

  // ─── GET /v1/chats/:chatId/export ───
  // Export chat transcript as markdown or JSON.
  app.get('/v1/chats/:chatId/export', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const query = (request.query || {}) as { format?: string; max_rows?: string | number };

    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const formatRaw = String(query.format || 'md').trim().toLowerCase();
    const format = formatRaw === 'json' ? 'json' : 'md';
    const maxRows = Math.min(Math.max(parseInt(String(query.max_rows ?? 5000), 10) || 5000, 1), 10000);

    const chatRes = await pool.query(
      `SELECT id, name FROM chats WHERE id = $1 AND organization_id = $2`,
      [chatId, request.orgId],
    );
    if (chatRes.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }
    const chatName = String(chatRes.rows[0].name || 'chat');

    const rowsRes = await pool.query(
      `SELECT m.id, m.role, m.text, m.content_type, m.blocks, m.created_at,
              u.display_name, u.username
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.chat_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [chatId, maxRows],
    );
    const rows = rowsRes.rows;

    const safeBaseName = chatName
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'chat';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
      const payload = {
        exported_at: new Date().toISOString(),
        chat_id: chatId,
        title: chatName,
        rows: rows.map((row: {
          id: string;
          role: string;
          text: string;
          content_type: string;
          blocks: unknown;
          created_at: string;
          display_name?: string | null;
          username?: string | null;
        }) => ({
          id: row.id,
          role: row.role,
          text: row.text,
          content_type: row.content_type,
          blocks: row.blocks,
          created_at: row.created_at,
          sender_name: row.display_name || row.username || null,
        })),
      };
      reply.header('Content-Type', 'application/json; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${safeBaseName}-transcript-${stamp}.json"`);
      return reply.send(payload);
    }

    const markdown = buildChatTranscriptMarkdown(chatName, rows);
    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${safeBaseName}-transcript-${stamp}.md"`);
    return reply.send(markdown);
  });

  // ─── POST /v1/chats/:chatId/messages ───
  // Send a user message (from Canvas UI directly)
  app.post('/v1/chats/:chatId/messages', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['text'],
        additionalProperties: false,
        properties: {
          text: { type: 'string', minLength: 1 },
          mode: { type: 'string', enum: ['balanced', 'precise', 'creative', 'fast'] },
          response_length: { type: 'string', enum: ['short', 'balanced', 'detailed'] },
          personality: { type: 'string', enum: ['friendly', 'professional', 'casual', 'technical'] },
          memory_context: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { text } = request.body as { text: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    // Verify membership
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const queueCfg = await getMessageQueueConfig(pool);
    const timeoutMinutes = queueCfg.timeoutMinutes;
    await pruneExpiredQueuedMessages(pool, chatId);

    const { v7: uuidv7 } = await import('uuid');
    const createdAtIso = new Date().toISOString();

    // Queue when busy and queueing is enabled.
    const currentlyProcessing = queueCfg.enabled ? await isChatProcessing(pool, chatId) : false;
    if (queueCfg.enabled && currentlyProcessing) {
      let queuedCount = 0;
      try {
        const queuedCountRes = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM chat_message_queue
           WHERE chat_id = $1 AND status = 'queued'`,
          [chatId],
        );
        queuedCount = Number(queuedCountRes.rows[0]?.c || 0);
      } catch (err) {
        if (!isSchemaCompatError(err)) throw err;
      }

      if (queuedCount >= queueCfg.maxDepth) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'QUEUE_DEPTH_EXCEEDED',
            message: `Message queue is full (max ${queueCfg.maxDepth})`,
          },
        });
      }

      const queueId = uuidv7();
      let queuedInserted = false;
      try {
        await pool.query(
          `INSERT INTO chat_message_queue (id, chat_id, user_id, text, status, created_at, expires_at)
           VALUES ($1, $2, $3, $4, 'queued', NOW(), NOW() + ($5::text || ' minutes')::interval)`,
          [queueId, chatId, request.userId, text, String(timeoutMinutes)],
        );
        queuedInserted = true;
      } catch (err) {
        if (isSchemaCompatError(err)) {
          // Schema not available; fallback to direct dispatch.
        } else {
          throw err;
        }
      }

      if (queuedInserted) {
        const queuePosition = queuedCount + 1;
        logger.info('Canvas message queued', { chat_id: chatId, queue_id: queueId, queue_position: queuePosition });
        return reply.status(202).send({
          success: true,
          data: {
            id: queueId,
            queue_id: queueId,
            chat_id: chatId,
            role: 'user',
            text,
            created_at: createdAtIso,
            status: 'queued',
            queued: true,
            queue_position: queuePosition,
          },
        });
      }
    }

    const messageId = uuidv7();
    await setChatProcessing(pool, chatId, true);
    try {
      await pool.query(
        `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, created_at)
         VALUES ($1, $2, $3, 'user', 'text', $4, NOW())`,
        [messageId, chatId, request.userId, text],
      );

      const identityId = await ensureCanvasIdentity(pool, String(request.userId));

      // Publish to NATS for agent-runtime processing
      const js = nc.jetstream();
      const correlationId = request.correlationId || String(request.id || messageId);
      try {
        await js.publish('inbound.message.canvas', Buffer.from(JSON.stringify({
          schema_version: '1.0',
          event_id: messageId,
          occurred_at: new Date().toISOString(),
          data: {
            channel: 'canvas',
            channel_message_id: messageId,
            chat_id: chatId,
            sender_identity_id: identityId,
            content_type: 'text',
            text,
            metadata: withCorrelationMetadata(undefined, correlationId),
          },
        })));
      } catch (publishErr) {
        logger.warn('Canvas direct dispatch publish failed; converting to recoverable queued delivery', {
          chat_id: chatId,
          message_id: messageId,
          err: String(publishErr),
        });
        const queueId = uuidv7();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `DELETE FROM messages
             WHERE id = $1
               AND chat_id = $2
               AND sender_user_id = $3
               AND role = 'user'
               AND content_type = 'text'`,
            [messageId, chatId, request.userId],
          );
          await client.query(
            `INSERT INTO chat_message_queue
               (id, chat_id, user_id, text, status, attempt_count, last_error, next_retry_at, created_at, expires_at)
             VALUES
               ($1, $2, $3, $4, 'failed', 0, $5, NOW(), NOW(), NOW() + ($6::text || ' minutes')::interval)`,
            [queueId, chatId, request.userId, text, String(publishErr), String(timeoutMinutes)],
          );
          await client.query('COMMIT');
        } catch (queueErr) {
          await client.query('ROLLBACK').catch(() => undefined);
          if (isSchemaCompatError(queueErr)) {
            throw publishErr;
          }
          throw queueErr;
        } finally {
          client.release();
        }
        await setChatProcessing(pool, chatId, false);
        return reply.status(202).send({
          success: true,
          data: {
            id: queueId,
            queue_id: queueId,
            chat_id: chatId,
            role: 'user',
            text,
            created_at: createdAtIso,
            status: 'queued',
            queued: true,
            queue_position: null,
            recovery_reason: 'dispatch_publish_failed',
          },
        });
      }

      logger.info('Canvas message sent', { chat_id: chatId, message_id: messageId });
      reply.status(201).send({
        success: true,
        data: { id: messageId, chat_id: chatId, role: 'user', text, created_at: createdAtIso, status: 'sent', queued: false },
      });
    } catch (err) {
      await setChatProcessing(pool, chatId, false);
      throw err;
    }
  });

  // ─── DELETE /v1/chats/:chatId/queue/:queueId ───
  // Allows user to cancel a queued message before dispatch.
  app.delete('/v1/chats/:chatId/queue/:queueId', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId, queueId } = request.params as { chatId: string; queueId: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    try {
      const res = await pool.query(
        `UPDATE chat_message_queue
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE id = $1
           AND chat_id = $2
           AND user_id = $3
           AND status = 'queued'
         RETURNING id`,
        [queueId, chatId, request.userId],
      );
      if (res.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Queued message not found or already dispatched' },
        });
      }
      return reply.send({ success: true, data: { id: queueId, cancelled: true } });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'UNAVAILABLE', message: 'Message queue schema is not available in this environment' },
        });
      }
      throw err;
    }
  });

  // ─── GET /v1/chats/:chatId/message-feedback ───
  // Returns the current user's feedback rows for messages in this chat.
  app.get('/v1/chats/:chatId/message-feedback', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    let result;
    try {
      result = await pool.query(
        `SELECT message_id, feedback, created_at, updated_at
         FROM message_feedback
         WHERE chat_id = $1 AND user_id = $2
         ORDER BY updated_at DESC`,
        [chatId, request.userId],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.send({ success: true, data: { rows: [] } });
      }
      throw err;
    }
    reply.send({ success: true, data: { rows: result.rows } });
  });

  // ─── PUT /v1/chats/:chatId/messages/:messageId/feedback ───
  // Set or clear thumbs feedback for a message.
  app.put('/v1/chats/:chatId/messages/:messageId/feedback', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId, messageId } = request.params as { chatId: string; messageId: string };
    const { feedback } = (request.body || {}) as { feedback?: 'up' | 'down' | null };

    if (feedback != null && feedback !== 'up' && feedback !== 'down') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'feedback must be one of: up, down, or null' },
      });
    }
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const messageExists = await pool.query(
      `SELECT 1 FROM messages WHERE id = $1 AND chat_id = $2`,
      [messageId, chatId],
    );
    if (messageExists.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found in this chat' },
      });
    }

    let counts;
    try {
      if (feedback == null) {
        await pool.query(
          `DELETE FROM message_feedback
           WHERE message_id = $1 AND user_id = $2`,
          [messageId, request.userId],
        );
      } else {
        await pool.query(
          `INSERT INTO message_feedback (id, message_id, chat_id, user_id, feedback, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (message_id, user_id)
           DO UPDATE SET feedback = EXCLUDED.feedback, updated_at = NOW()`,
          [uuidv7(), messageId, chatId, request.userId, feedback],
        );
      }

      counts = await pool.query(
        `SELECT feedback, COUNT(*)::int AS count
         FROM message_feedback
         WHERE message_id = $1
         GROUP BY feedback`,
        [messageId],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'UNAVAILABLE', message: 'Message feedback schema is not available in this environment' },
        });
      }
      throw err;
    }
    let up = 0;
    let down = 0;
    for (const row of counts.rows) {
      if (row.feedback === 'up') up = Number(row.count || 0);
      if (row.feedback === 'down') down = Number(row.count || 0);
    }

    reply.send({
      success: true,
      data: {
        message_id: messageId,
        feedback: feedback ?? null,
        counts: { up, down },
      },
    });
  });

  // ─── GET /v1/chats/:chatId/canvas ───
  // Returns canvas events (rich blocks) for a chat
  app.get('/v1/chats/:chatId/canvas', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const result = await pool.query(
      `SELECT ce.*, m.text, m.role, m.sender_user_id
       FROM canvas_events ce
       LEFT JOIN messages m ON m.id = ce.message_id
       WHERE ce.chat_id = $1
       ORDER BY ce.created_at ASC`,
      [chatId],
    );
    reply.send({ success: true, data: { rows: result.rows } });
  });

  // ─── POST /v1/chats/:chatId/voice/calls/outbound ───
  app.post('/v1/chats/:chatId/voice/calls/outbound', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const enabledRaw = await getOrgSettingValue(pool, orgId, 'voice.call.enabled');
    const enabled = parseBooleanSetting(enabledRaw, false);
    if (!enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'VOICE_CALL_DISABLED', message: 'Voice call integration is disabled' },
      });
    }

    const body = (request.body || {}) as {
      to?: string;
      from?: string;
      provider?: 'mock' | 'twilio' | 'telnyx' | 'plivo';
      approval_id?: string;
      metadata?: Record<string, unknown>;
    };
    const to = String(body.to || '').trim();
    if (!to) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'to is required' },
      });
    }

    const adapterBaseUrl = String(process.env.VOICE_CALL_ADAPTER_URL || 'http://adapter-voice-call:8490').replace(/\/+$/, '');
    const adapterApiKey = String(process.env.VOICE_CALL_API_KEY || '').trim();
    const adapterTimeoutMs = normalizeVoiceCallOutboundTimeoutMs(process.env.VOICE_CALL_ADAPTER_TIMEOUT_MS);
    const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(adapterTimeoutMs)
      : undefined;
    const senderIdentityId = await ensureCanvasIdentity(pool, String(request.userId));

    const adapterPayload = {
      provider: body.provider,
      to,
      from: body.from ? String(body.from) : undefined,
      approval_id: body.approval_id ? String(body.approval_id) : undefined,
      chat_id: chatId,
      sender_identity_id: senderIdentityId,
      metadata: body.metadata && typeof body.metadata === 'object'
        ? body.metadata
        : {},
    };

    let adapterRes: Response;
    try {
      adapterRes = await fetch(`${adapterBaseUrl}/v1/calls/outbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adapterApiKey ? { 'x-voice-api-key': adapterApiKey } : {}),
        },
        signal: timeoutSignal,
        body: JSON.stringify(adapterPayload),
      });
    } catch (err) {
      const errorName = String((err as { name?: string })?.name || '');
      if (errorName === 'AbortError' || errorName === 'TimeoutError') {
        logger.warn('Voice call adapter request timed out', {
          chat_id: chatId,
          user_id: request.userId,
          timeout_ms: adapterTimeoutMs,
        });
        return reply.status(504).send({
          success: false,
          error: { code: 'VOICE_CALL_ADAPTER_TIMEOUT', message: 'Voice call adapter request timed out' },
        });
      }
      logger.warn('Voice call adapter request failed', {
        chat_id: chatId,
        user_id: request.userId,
        err: err instanceof Error ? err.message : String(err),
      });
      return reply.status(502).send({
        success: false,
        error: { code: 'VOICE_CALL_ADAPTER_UNREACHABLE', message: 'Voice call adapter is unreachable' },
      });
    }

    const payload = await adapterRes.json().catch(() => null);
    if (!adapterRes.ok) {
      return reply.status(adapterRes.status).send(payload || {
        success: false,
        error: { code: 'VOICE_CALL_FAILED', message: 'Failed to place outbound voice call' },
      });
    }

    return reply.send(payload || { success: true, data: {} });
  });

  // ─── POST /v1/chats/:chatId/meetings/assistant/start ───
  app.post('/v1/chats/:chatId/meetings/assistant/start', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const enabledRaw = await getOrgSettingValue(pool, orgId, 'voice.meetingAssistant.enabled');
    const enabled = parseBooleanSetting(enabledRaw, false);
    if (!enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'MEETING_ASSISTANT_DISABLED', message: 'Meeting assistant is disabled' },
      });
    }

    const body = (request.body || {}) as {
      title?: string;
      provider?: string;
      join_url?: string;
      dial_in?: string;
      metadata?: Record<string, unknown>;
    };
    const title = String(body.title || '').trim().slice(0, 240) || 'Meeting';
    const provider = String(body.provider || 'manual').trim().slice(0, 80) || 'manual';
    const joinUrl = String(body.join_url || '').trim();
    const dialIn = String(body.dial_in || '').trim();
    const joinTarget = joinUrl || dialIn || null;
    if (!joinTarget) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'join_url or dial_in is required' },
      });
    }

    const sessionId = uuidv7();
    try {
      await pool.query(
        `INSERT INTO meeting_assistant_sessions
           (id, organization_id, chat_id, user_id, title, provider, join_target, status, notes, metadata, started_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, 'active', '[]'::jsonb, $8::jsonb, NOW(), NOW())`,
        [
          sessionId,
          orgId,
          chatId,
          String(request.userId),
          title,
          provider,
          joinTarget,
          JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        ],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Meeting assistant schema not initialized' },
        });
      }
      throw err;
    }

    const assistantMessage = `Meeting assistant joined ${provider} call for "${title}".`;
    await pool.query(
      `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, created_at)
       VALUES ($1, $2, NULL, 'assistant', 'text', $3, NOW())`,
      [uuidv7(), chatId, assistantMessage],
    );

    return reply.send({
      success: true,
      data: {
        session_id: sessionId,
        status: 'active',
        title,
        provider,
        join_target: joinTarget,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/meetings/assistant/:sessionId/notes ───
  app.post('/v1/chats/:chatId/meetings/assistant/:sessionId/notes', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId, sessionId } = request.params as { chatId: string; sessionId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const body = (request.body || {}) as { text?: string; speaker?: string; timestamp?: string };
    const noteText = String(body.text || '').trim();
    if (!noteText) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'text is required' },
      });
    }
    const note = {
      id: uuidv7(),
      text: noteText.slice(0, 4000),
      speaker: String(body.speaker || '').trim().slice(0, 120) || null,
      timestamp: String(body.timestamp || '').trim() || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    let updated;
    try {
      updated = await pool.query(
        `UPDATE meeting_assistant_sessions
         SET notes = COALESCE(notes, '[]'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2
           AND organization_id = $3
           AND chat_id = $4
           AND user_id = $5
           AND status = 'active'
         RETURNING id`,
        [JSON.stringify([note]), sessionId, orgId, chatId, String(request.userId)],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Meeting assistant schema not initialized' },
        });
      }
      throw err;
    }
    if (!updated.rows.length) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Active meeting assistant session not found' },
      });
    }

    return reply.send({ success: true, data: { session_id: sessionId, note } });
  });

  // ─── POST /v1/chats/:chatId/meetings/assistant/:sessionId/summary ───
  app.post('/v1/chats/:chatId/meetings/assistant/:sessionId/summary', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId, sessionId } = request.params as { chatId: string; sessionId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    let sessionRow;
    try {
      const res = await pool.query(
        `SELECT id, title, provider, join_target, notes, started_at, ended_at, status
         FROM meeting_assistant_sessions
         WHERE id = $1
           AND organization_id = $2
           AND chat_id = $3
           AND user_id = $4
         LIMIT 1`,
        [sessionId, orgId, chatId, String(request.userId)],
      );
      sessionRow = res.rows[0];
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Meeting assistant schema not initialized' },
        });
      }
      throw err;
    }
    if (!sessionRow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting assistant session not found' },
      });
    }

    const noteList = Array.isArray(sessionRow.notes) ? sessionRow.notes : [];
    if (noteList.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'No notes available for summary' },
      });
    }

    const noteLines = noteList
      .slice(-200)
      .map((n: any) => {
        const ts = String(n?.timestamp || n?.created_at || '').trim();
        const speaker = String(n?.speaker || '').trim();
        const text = String(n?.text || '').trim();
        const prefix = [ts, speaker].filter(Boolean).join(' ');
        return prefix ? `- ${prefix}: ${text}` : `- ${text}`;
      })
      .join('\n');

    let summary = '';
    const sessionToken = extractSessionTokenFromRequest(request);
    if (sessionToken) {
      const completion = await runOneShotCompletionViaOpenAICompat(pool, {
        orgId,
        sessionToken,
        systemPrompt: 'You are a meeting assistant. Produce concise meeting notes with sections: Summary, Decisions, Action Items, Risks.',
        text: `Meeting title: ${String(sessionRow.title || 'Meeting')}\nProvider: ${String(sessionRow.provider || 'manual')}\nNotes:\n${noteLines}`,
      });
      if (completion.ok) {
        summary = completion.text.trim();
      }
    }
    if (!summary) {
      // Deterministic fallback when completion endpoint/token is unavailable.
      const bullets = noteList.slice(-8).map((n: any) => `- ${String(n?.text || '').trim()}`);
      summary = [
        `Summary: ${String(sessionRow.title || 'Meeting')} (${String(sessionRow.provider || 'manual')})`,
        '',
        'Decisions:',
        '- (review notes for explicit decisions)',
        '',
        'Action Items:',
        ...bullets,
        '',
        'Risks:',
        '- (not enough structured risk annotations in captured notes)',
      ].join('\n');
    }

    try {
      await pool.query(
        `UPDATE meeting_assistant_sessions
         SET summary_text = $1,
             updated_at = NOW()
         WHERE id = $2
           AND organization_id = $3
           AND chat_id = $4
           AND user_id = $5`,
        [summary, sessionId, orgId, chatId, String(request.userId)],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Meeting assistant schema not initialized' },
        });
      }
      throw err;
    }

    await pool.query(
      `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, created_at)
       VALUES ($1, $2, NULL, 'assistant', 'text', $3, NOW())`,
      [uuidv7(), chatId, `Meeting assistant summary:\n\n${summary}`],
    );

    return reply.send({
      success: true,
      data: {
        session_id: sessionId,
        status: String(sessionRow.status || 'active'),
        summary,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/meetings/assistant/:sessionId/end ───
  app.post('/v1/chats/:chatId/meetings/assistant/:sessionId/end', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId, sessionId } = request.params as { chatId: string; sessionId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    let ended;
    try {
      ended = await pool.query(
        `UPDATE meeting_assistant_sessions
         SET status = 'ended',
             ended_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND organization_id = $2
           AND chat_id = $3
           AND user_id = $4
         RETURNING id, ended_at`,
        [sessionId, orgId, chatId, String(request.userId)],
      );
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Meeting assistant schema not initialized' },
        });
      }
      throw err;
    }
    if (!ended.rows.length) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting assistant session not found' },
      });
    }
    return reply.send({
      success: true,
      data: {
        session_id: sessionId,
        status: 'ended',
        ended_at: ended.rows[0].ended_at,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/voice/continuous/start ───
  app.post('/v1/chats/:chatId/voice/continuous/start', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const config = await getVoiceContinuousConfig(pool, orgId);
    if (!config.enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'VOICE_CONTINUOUS_DISABLED', message: 'Continuous conversation mode is disabled' },
      });
    }

    const body = (request.body || {}) as { ttl_seconds?: number };
    const requestedTtl = Number(body.ttl_seconds || config.ttlSeconds);
    const ttlSeconds = Math.max(30, Math.min(3600, Number.isFinite(requestedTtl) ? Math.floor(requestedTtl) : config.ttlSeconds));
    const identityId = await ensureCanvasIdentity(pool, String(request.userId));
    const session = await createOrRefreshVoiceContinuousSession(pool, {
      organizationId: orgId,
      chatId,
      userId: String(request.userId),
      senderIdentityId: identityId,
      channel: 'canvas',
      ttlSeconds,
      metadata: { started_via: 'manual_start' },
    });

    return reply.send({ success: true, data: { session_id: session.id, expires_at: session.expires_at, ttl_seconds: session.ttl_seconds } });
  });

  // ─── GET /v1/chats/:chatId/voice/continuous/status ───
  app.get('/v1/chats/:chatId/voice/continuous/status', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const query = (request.query || {}) as { session_id?: string };
    const sessionId = String(query.session_id || '').trim();
    if (!sessionId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'session_id is required' } });
    }
    const active = await getActiveVoiceContinuousSession(pool, {
      sessionId,
      organizationId: orgId,
      chatId,
      userId: String(request.userId),
      channel: 'canvas',
    });
    return reply.send({
      success: true,
      data: {
        session_id: sessionId,
        active: Boolean(active),
        expires_at: active?.expires_at || null,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/voice/continuous/stop ───
  app.post('/v1/chats/:chatId/voice/continuous/stop', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const body = (request.body || {}) as { session_id?: string; reason?: string };
    const sessionId = String(body.session_id || '').trim();
    if (!sessionId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'session_id is required' } });
    }
    const ended = await endVoiceContinuousSession(pool, {
      sessionId,
      organizationId: orgId,
      chatId,
      userId: String(request.userId),
      reason: String(body.reason || 'user_stop').slice(0, 120),
    });
    if (!ended) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Active session not found' } });
    }
    return reply.send({ success: true, data: { session_id: sessionId, ended: true } });
  });

  // ─── GET /v1/chats/:chatId/voice/speakers ───
  app.get('/v1/chats/:chatId/voice/speakers', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }
    try {
      const rows = await pool.query(
        `SELECT id, label, signature, metadata, created_at, updated_at
         FROM voice_speaker_profiles
         WHERE organization_id = $1
           AND chat_id = $2
           AND user_id = $3
         ORDER BY updated_at DESC, created_at DESC`,
        [orgId, chatId, String(request.userId)],
      );
      return reply.send({ success: true, data: rows.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Speaker profile schema not initialized' },
        });
      }
      throw err;
    }
  });

  // ─── POST /v1/chats/:chatId/voice/speakers ───
  app.post('/v1/chats/:chatId/voice/speakers', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }
    const body = (request.body || {}) as { label?: string; signature?: string; metadata?: Record<string, unknown> };
    const label = String(body.label || '').trim();
    const signature = String(body.signature || '').trim();
    const validation = validateSpeakerLabelSignature(label, signature, true);
    if (!validation.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: validation.message },
      });
    }
    try {
      const created = await upsertSpeakerProfile(pool, {
        organizationId: orgId,
        chatId,
        userId: String(request.userId),
        signature,
        label,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      });
      return reply.send({ success: true, data: created });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Speaker profile schema not initialized' },
        });
      }
      throw err;
    }
  });

  // ─── DELETE /v1/chats/:chatId/voice/speakers/:speakerId ───
  app.delete('/v1/chats/:chatId/voice/speakers/:speakerId', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId, speakerId } = request.params as { chatId: string; speakerId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }
    try {
      const deleted = await pool.query(
        `DELETE FROM voice_speaker_profiles
         WHERE id = $1
           AND organization_id = $2
           AND chat_id = $3
           AND user_id = $4
         RETURNING id`,
        [String(speakerId), orgId, chatId, String(request.userId)],
      );
      if (!deleted.rows.length) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Speaker profile not found' } });
      }
      return reply.send({ success: true, data: { id: String(deleted.rows[0].id) } });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Speaker profile schema not initialized' },
        });
      }
      throw err;
    }
  });

  // ─── POST /v1/chats/:chatId/wake-word ───
  // Forward wake word detections to wake-word service (mobile capture)
  app.post('/v1/chats/:chatId/wake-word', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const orgId = request.orgId ? String(request.orgId) : '';
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const body = (request.body || {}) as {
      audio_base64?: string;
      audio_mime?: string;
      wake_word?: string;
      continuous_session_id?: string;
      speaker_signature?: string;
      speaker_label?: string;
      auto_register_speaker?: boolean;
      emotion_label?: string;
      emotion_confidence?: number;
      confidence?: number;
      language?: string;
      mode?: string;
      transcribe?: boolean;
    };

    const audioBase64 = String(body.audio_base64 || '').trim();
    if (!audioBase64) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'audio_base64 is required' },
      });
    }
    const maxAudioBytes = normalizeWakeWordMaxAudioBytes(process.env.WAKE_WORD_MAX_AUDIO_BYTES);
    const decodedAudioBytes = estimateBase64DecodedBytes(audioBase64);
    if (!Number.isFinite(decodedAudioBytes) || decodedAudioBytes <= 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'audio_base64 must be valid base64 content' },
      });
    }
    if (decodedAudioBytes > maxAudioBytes) {
      return reply.status(413).send({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: `audio payload exceeds ${maxAudioBytes} bytes` },
      });
    }

    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const config = await getVoiceContinuousConfig(pool, orgId);
    const incomingWakeWord = String(body.wake_word || '').trim();
    const incomingSessionId = String(body.continuous_session_id || '').trim();
    let resolvedWakeWord = incomingWakeWord;
    let resolvedSessionId = incomingSessionId || null;

    if (!resolvedWakeWord) {
      if (!config.enabled) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'wake_word is required when continuous conversation mode is disabled' },
        });
      }
      if (!incomingSessionId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'wake_word or continuous_session_id is required' },
        });
      }
      const activeSession = await getActiveVoiceContinuousSession(pool, {
        sessionId: incomingSessionId,
        organizationId: orgId,
        chatId,
        userId: String(request.userId),
        channel: 'canvas',
      });
      if (!activeSession) {
        return reply.status(403).send({
          success: false,
          error: { code: 'VOICE_CONTINUOUS_SESSION_INVALID', message: 'Continuous voice session is not active' },
        });
      }
      resolvedWakeWord = 'continuous_followup';
    }
    const identityId = await ensureCanvasIdentity(pool, String(request.userId));
    const speakerConfig = await getSpeakerIdentificationConfig(pool, orgId);
    const speakerSignature = String(body.speaker_signature || '').trim();
    const speakerLabel = String(body.speaker_label || '').trim();
    const shouldAutoRegisterSpeaker = Boolean(body.auto_register_speaker);
    let speakerMeta: Record<string, unknown> | null = null;
    if (speakerConfig.enabled && speakerSignature) {
      const knownSpeaker = await findSpeakerProfileBySignature(pool, {
        organizationId: orgId,
        chatId,
        userId: String(request.userId),
        signature: speakerSignature,
      });
      if (knownSpeaker) {
        speakerMeta = {
          identified: true,
          profile_id: knownSpeaker.id,
          label: knownSpeaker.label,
          signature: knownSpeaker.signature,
          confidence: 1,
        };
      } else if (shouldAutoRegisterSpeaker && speakerLabel) {
        const speakerValidation = validateSpeakerLabelSignature(speakerLabel, speakerSignature, true);
        if (!speakerValidation.valid) {
          return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION', message: speakerValidation.message },
          });
        }
        const registered = await upsertSpeakerProfile(pool, {
          organizationId: orgId,
          chatId,
          userId: String(request.userId),
          signature: speakerSignature,
          label: speakerLabel,
          metadata: { auto_registered: true },
        });
        speakerMeta = {
          identified: true,
          profile_id: registered.id,
          label: registered.label,
          signature: registered.signature,
          confidence: 1,
          auto_registered: true,
        };
      } else {
        speakerMeta = {
          identified: false,
          signature: speakerSignature,
          label_hint: speakerLabel || null,
        };
      }
    }
    const emotionDetectionConfig = await getOrgSettingValue(pool, orgId, 'voice.emotionDetection.enabled');
    const emotionDetectionEnabled = parseBooleanSetting(emotionDetectionConfig, false);
    const emotionLabel = String(body.emotion_label || '').trim().toLowerCase();
    const emotionConfidenceRaw = Number(body.emotion_confidence ?? 0);
    const emotionConfidence = Number.isFinite(emotionConfidenceRaw)
      ? Math.max(0, Math.min(1, emotionConfidenceRaw))
      : 0;
    const emotionMeta = emotionDetectionEnabled && emotionLabel
      ? {
        label: emotionLabel,
        confidence: emotionConfidence,
        source: 'client_hint',
      }
      : null;

    const wakeWordUrl = process.env.WAKE_WORD_BASE_URL || 'http://wake-word:4400';
    const payload = {
      chat_id: chatId,
      channel: 'canvas',
      sender_identity_id: identityId,
      wake_word: resolvedWakeWord,
      confidence: body.confidence,
      language: body.language,
      mode: body.mode,
      transcribe: body.transcribe ?? true,
      audio_base64: audioBase64,
      audio_mime: body.audio_mime,
      metadata: {
        ...(speakerMeta ? { speaker: speakerMeta } : {}),
        ...(emotionMeta ? { emotion: emotionMeta } : {}),
      },
    };

    const wakeWordTimeoutMs = normalizeWakeWordTimeoutMs(process.env.WAKE_WORD_TIMEOUT_MS);
    const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(wakeWordTimeoutMs)
      : undefined;
    let res: Response;
    try {
      res = await fetch(`${wakeWordUrl}/v1/wake-word/detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: timeoutSignal,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const errorName = String((err as { name?: string })?.name || '');
      if (errorName === 'AbortError' || errorName === 'TimeoutError') {
        logger.warn('Wake-word upstream request timed out', {
          timeout_ms: wakeWordTimeoutMs,
          chat_id: chatId,
          user_id: request.userId,
        });
        return reply.status(504).send({
          success: false,
          error: { code: 'WAKE_WORD_TIMEOUT', message: 'Wake-word request timed out' },
        });
      }
      logger.warn('Wake-word upstream transport failure', {
        chat_id: chatId,
        user_id: request.userId,
        error: String((err as Error)?.message || err),
      });
      return reply.status(502).send({
        success: false,
        error: { code: 'WAKE_WORD_FAILED', message: 'Wake-word service is temporarily unavailable' },
      });
    }
    if (!res.ok) {
      let upstreamPayload: Record<string, unknown> | null = null;
      try {
        const parsed = await res.json();
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          upstreamPayload = parsed as Record<string, unknown>;
        }
      } catch {
        upstreamPayload = null;
      }
      const upstreamError = (upstreamPayload && typeof upstreamPayload.error === 'object' && upstreamPayload.error !== null)
        ? (upstreamPayload.error as Record<string, unknown>)
        : null;
      logger.warn('Wake-word upstream rejected request', {
        status: res.status,
        chat_id: chatId,
        user_id: request.userId,
        upstream_error_code: String(upstreamError?.code || ''),
        upstream_error_message: String(upstreamError?.message || ''),
      });
      return reply.status(res.status).send({
        success: false,
        error: {
          code: 'WAKE_WORD_FAILED',
          message: getWakeWordPublicErrorMessage(res.status),
        },
      });
    }

    const data = await res.json().catch(() => ({}));
    if (config.enabled) {
      let session;
      try {
        session = await createOrRefreshVoiceContinuousSession(pool, {
          organizationId: orgId,
          chatId,
          userId: String(request.userId),
          senderIdentityId: identityId,
          channel: 'canvas',
          ttlSeconds: config.ttlSeconds,
          sessionId: resolvedSessionId || undefined,
          metadata: { continued_without_wake_word: !incomingWakeWord },
        });
      } catch (err) {
        if (String((err as Error)?.message || '') === 'VOICE_CONTINUOUS_SESSION_OWNERSHIP_MISMATCH') {
          return reply.status(403).send({
            success: false,
            error: { code: 'VOICE_CONTINUOUS_SESSION_INVALID', message: 'Continuous voice session is not active' },
          });
        }
        throw err;
      }
      resolvedSessionId = session.id;
      return reply.send({
        success: true,
        data,
        voice_continuous: {
          enabled: true,
          session_id: session.id,
          expires_at: session.expires_at,
          ttl_seconds: session.ttl_seconds,
          continued_without_wake_word: !incomingWakeWord,
        },
      });
    }
    reply.send({ success: true, data });
  });

  // ─── A2UI: Agent-to-UI protocol (push/reset/eval/snapshot) ───
  app.get('/v1/chats/:chatId/a2ui/snapshot', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }
    const snapshot = await getA2uiState(pool, chatId);
    reply.send({ success: true, data: snapshot });
  });

  app.post('/v1/chats/:chatId/a2ui/push', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = (request.body || {}) as { html?: string; component?: string; state?: Record<string, unknown> };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const htmlInput = String(body.html || '');
    if (htmlInput.length > 512_000) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'html exceeds 512KB limit' } });
    }
    const componentInput = String(body.component || '');
    if (componentInput.length > 512_000) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'component exceeds 512KB limit' } });
    }
    const stateInput = body.state && typeof body.state === 'object' ? body.state : null;
    if (stateInput && JSON.stringify(stateInput).length > 512_000) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'state exceeds 512KB limit' } });
    }

    const current = await getA2uiState(pool, chatId);
    const next = {
      version: current.version + 1,
      html: htmlInput || current.html || '',
      component: componentInput || current.component || '',
      state: stateInput || current.state || {},
    };
    await upsertA2uiState(pool, chatId, next, request.userId);

    emitA2uiEvent(chatId, {
      id: uuidv7(),
      type: 'push',
      payload: next,
      created_at: new Date().toISOString(),
    }, { nc });
    reply.send({ success: true, data: next });
  });

  app.post('/v1/chats/:chatId/a2ui/reset', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const current = await getA2uiState(pool, chatId);
    const next = {
      version: current.version + 1,
      html: '',
      component: '',
      state: {},
    };
    await upsertA2uiState(pool, chatId, next, request.userId);
    emitA2uiEvent(chatId, {
      id: uuidv7(),
      type: 'reset',
      payload: next,
      created_at: new Date().toISOString(),
    }, { nc });
    reply.send({ success: true, data: next });
  });

  app.post('/v1/chats/:chatId/a2ui/eval', { preHandler: requireAuth }, async (request, reply) => {
    const evalEnabled = String(process.env.SVEN_A2UI_EVAL_ENABLED || '').trim().toLowerCase() === 'true';
    if (!evalEnabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'A2UI_EVAL_DISABLED', message: 'A2UI eval is disabled' },
      });
    }
    const { chatId } = request.params as { chatId: string };
    const body = (request.body || {}) as { script?: string; payload?: Record<string, unknown> };
    const script = String(body.script || '').trim();
    if (!script) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'script is required' } });
    }
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const current = await getA2uiState(pool, chatId);
    const evalResult = executeA2uiEvalScript(script, current, body.payload || {});
    if (!evalResult.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'A2UI_EVAL_EXECUTION_FAILED', message: evalResult.message },
      });
    }
    const ui = evalResult.ui;
    const next = {
      version: normalizeA2uiVersion(ui.version, current.version),
      html: String(ui.html || current.html || ''),
      component: String(ui.component || current.component || ''),
      state: ui.state && typeof ui.state === 'object'
        ? (ui.state as Record<string, unknown>)
        : current.state || {},
    };
    await upsertA2uiState(pool, chatId, next, request.userId);

    const response = { result: evalResult.result ?? null, ui: next };
    emitA2uiEvent(chatId, {
      id: uuidv7(),
      type: 'eval',
      payload: response,
      created_at: new Date().toISOString(),
    }, { nc });
    reply.send({ success: true, data: response });
  });

  app.post('/v1/chats/:chatId/a2ui/interaction', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = (request.body || {}) as { event_type?: string; payload?: Record<string, unknown> };
    const eventType = String(body.event_type || 'interaction');
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const eventId = uuidv7();
    const correlationId = request.correlationId || String(request.id || eventId);
    await pool.query(
      `INSERT INTO a2ui_interactions (id, chat_id, user_id, event_type, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventId, chatId, request.userId, eventType, JSON.stringify(body.payload || {})],
    );

    // Bridge UI interaction back into agent-runtime.
    const js = nc.jetstream();
    await js.publish('inbound.message.canvas', Buffer.from(JSON.stringify({
      schema_version: '1.0',
      event_id: eventId,
      occurred_at: new Date().toISOString(),
      chat_id: chatId,
      message_id: eventId,
      sender_user_id: request.userId,
      content_type: 'text',
      text: `/a2ui ${eventType} ${JSON.stringify(body.payload || {})}`,
      channel: 'canvas',
      metadata: withCorrelationMetadata(
        { a2ui_interaction: true, event_type: eventType, payload: body.payload || {} },
        correlationId,
      ),
    })));

    const evt = {
      id: eventId,
      type: 'interaction',
      payload: {
        event_type: eventType,
        payload: body.payload || {},
        user_id: request.userId,
      },
      created_at: new Date().toISOString(),
    };
    emitA2uiEvent(chatId, evt, { nc });
    reply.status(201).send({ success: true, data: evt });
  });

  app.get('/v1/chats/:chatId/a2ui/stream', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('retry: 3000\n\n');

    const snapshot = await getA2uiState(pool, chatId);
    const lastEventId = String((request.headers['last-event-id'] as string | undefined) || '').trim();
    const snapshotEventId = `snapshot:${chatId}:${Number(snapshot.version || 0)}`;
    reply.raw.write(`id: ${snapshotEventId}\n`);
    reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

    const replayEvents = getA2uiReplayEvents(chatId, lastEventId);
    for (const evt of replayEvents) {
      reply.raw.write(`id: ${evt.id}\n`);
      reply.raw.write(`event: ${evt.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    const send = (evt: A2uiEventEnvelope) => {
      reply.raw.write(`id: ${evt.id}\n`);
      reply.raw.write(`event: ${evt.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    };
    const listener = (evt: A2uiEventEnvelope) => send(evt);
    a2uiBus.on(chatId, listener);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      a2uiBus.off(chatId, listener);
    };
    request.raw.on('close', cleanup);
    reply.raw.on('error', cleanup);
  });

  // ─── GET /v1/artifacts/:artifactId ───
  app.get('/v1/artifacts/:artifactId', { preHandler: requireAuth }, async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };

    const result = await pool.query(
      `SELECT a.id,
              a.chat_id,
              a.message_id,
              a.name,
              a.mime_type,
              a.size_bytes,
              a.created_at,
              a.is_private
       FROM artifacts a
       JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $2
       WHERE a.id = $1`,
      [artifactId, request.userId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
    }

    const artifactRow = result.rows[0] as Record<string, unknown>;

    // If private and user is not the owner, deny
    if (artifactRow.is_private) {
      if (!artifactRow.message_id) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Private artifact' } });
      }
      const msg = await pool.query(`SELECT sender_user_id FROM messages WHERE id = $1`, [artifactRow.message_id]);
      if (msg.rows.length === 0 || msg.rows[0].sender_user_id !== request.userId) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Private artifact' } });
      }
    }

    const safeArtifact = projectCanvasArtifactMetadata(artifactRow, artifactId);
    reply.send({ success: true, data: safeArtifact });
  });

  // ─── GET /v1/artifacts/:artifactId/download ───
  // Streams artifact content if the authenticated user can access it.
  app.get('/v1/artifacts/:artifactId/download', { preHandler: requireAuth }, async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };

    const result = await pool.query(
      `SELECT a.* FROM artifacts a
       JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $2
       WHERE a.id = $1`,
      [artifactId, request.userId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
    }

    const artifact = result.rows[0];

    if (artifact.is_private) {
      if (!artifact.message_id) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Private artifact' } });
      }
      const msg = await pool.query(`SELECT sender_user_id FROM messages WHERE id = $1`, [artifact.message_id]);
      if (msg.rows.length === 0 || msg.rows[0].sender_user_id !== request.userId) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Private artifact' } });
      }
    }

    const storagePath = String(artifact.storage_path || '').trim();
    if (!storagePath) {
      return reply.status(404).send({ success: false, error: { code: 'MISSING_STORAGE', message: 'Artifact storage path is empty' } });
    }

    if (isHttpUrl(storagePath)) {
      const mimeType = String(artifact.mime_type || 'application/octet-stream');
      const fileName = String(artifact.name || `${artifact.id}`);
      const upstreamTimeoutMs = normalizeArtifactUpstreamTimeoutMs(process.env.ARTIFACT_UPSTREAM_FETCH_TIMEOUT_MS);
      const upstreamSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(upstreamTimeoutMs)
        : undefined;
      let upstream: Response;
      try {
        upstream = await fetchArtifactUpstreamSafe(storagePath, upstreamSignal);
      } catch (err) {
        const knownFailure = err as Partial<ArtifactUpstreamFailure>;
        if (
          (knownFailure.code === 'UPSTREAM_BLOCKED'
            || knownFailure.code === 'UPSTREAM_REDIRECT_INVALID'
            || knownFailure.code === 'UPSTREAM_REDIRECT_LIMIT')
          && typeof knownFailure.status === 'number'
          && typeof knownFailure.message === 'string'
        ) {
          return reply.status(knownFailure.status).send({
            success: false,
            error: { code: knownFailure.code, message: knownFailure.message },
          });
        }
        const errorName = String((err as { name?: string })?.name || '');
        if (errorName === 'AbortError' || errorName === 'TimeoutError') {
          return reply.status(504).send({
            success: false,
            error: { code: 'UPSTREAM_TIMEOUT', message: 'Artifact upstream request timed out' },
          });
        }
        logger.warn('Artifact upstream transport failed', {
          path: storagePath,
          error: String((err as Error)?.message || err),
        });
        return reply.status(502).send({
          success: false,
          error: { code: 'UPSTREAM_FAILED', message: 'Artifact upstream request failed' },
        });
      }
      if (!upstream.ok || !upstream.body) {
        return reply.status(502).send({
          success: false,
          error: { code: 'UPSTREAM_FAILED', message: `Artifact upstream failed with ${upstream.status}` },
        });
      }
      const upstreamType = upstream.headers.get('content-type');
      if (upstreamType) {
        reply.header('Content-Type', upstreamType);
      } else {
        reply.header('Content-Type', mimeType);
      }
      reply.header('Content-Disposition', contentDisposition(fileName, mimeType));
      const upstreamLength = upstream.headers.get('content-length');
      if (upstreamLength) {
        reply.header('Content-Length', upstreamLength);
      }
      const upstreamBody = upstream.body as unknown as globalThis.ReadableStream<Uint8Array>;
      return reply.send(Readable.fromWeb(upstreamBody));
    }

    const filePath = await findReadablePath(storagePath);
    if (!filePath) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact file is not accessible on this host' },
      });
    }

    const mimeType = String(artifact.mime_type || 'application/octet-stream');
    const fileName = String(artifact.name || `${artifact.id}`);
    reply.header('Content-Type', mimeType);
    reply.header('Content-Disposition', contentDisposition(fileName, mimeType));
    return reply.send(createReadStream(filePath));
  });

  // ─── GET /v1/runs/:runId ───
  app.get('/v1/runs/:runId', { preHandler: requireAuth }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const result = await pool.query(
      `SELECT tr.id,
              tr.tool_name,
              tr.chat_id,
              tr.user_id,
              tr.approval_id,
              tr.status,
              tr.prev_hash,
              tr.run_hash,
              tr.canonical_io_sha256,
              tr.duration_ms,
              tr.created_at,
              tr.completed_at,
              COALESCE(
                ctx.message_id,
                NULLIF(ap.details->>'message_id', ''),
                NULLIF(ap.details->>'context_message_id', '')
              ) AS context_message_id
       FROM tool_runs tr
       JOIN chats c ON c.id = tr.chat_id AND c.organization_id = $3
       JOIN chat_members cm ON cm.chat_id = tr.chat_id AND cm.user_id = $2
       LEFT JOIN approvals ap ON ap.id = tr.approval_id
       LEFT JOIN LATERAL (
         SELECT a.message_id
         FROM artifacts a
         WHERE a.tool_run_id = tr.id AND a.message_id IS NOT NULL
         ORDER BY a.created_at DESC
         LIMIT 1
        ) ctx ON TRUE
       WHERE tr.id = $1`,
      [runId, request.userId, request.orgId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tool run not found' } });
    }
    const runRow = (result.rows[0] || {}) as Record<string, unknown>;
    const runChatId = String(runRow.chat_id || '').trim();
    if (!runChatId) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL', message: 'Tool run is missing required chat scope' },
      });
    }

    const artifactResult = await pool.query(
      `SELECT id, chat_id, message_id, name, mime_type, size_bytes, created_at
       FROM artifacts
        WHERE tool_run_id = $1
         AND chat_id = $2
         AND EXISTS (
           SELECT 1
           FROM chat_members cm
           WHERE cm.chat_id = artifacts.chat_id
             AND cm.user_id = $3
         )
        ORDER BY created_at DESC
        LIMIT 50`,
      [runId, runChatId, request.userId],
    );
    const linkedArtifacts = artifactResult.rows;
    const contextMessageId = runRow.context_message_id ? String(runRow.context_message_id) : null;
    const safeRunDetail = projectCanvasRunDetail(
      runRow,
      contextMessageId,
      linkedArtifacts as Array<Record<string, unknown>>,
    );

    reply.send({
      success: true,
      data: safeRunDetail,
    });
  });

  // ─── GET /v1/approvals ───
  // User-facing approvals (only from chats they belong to)
  app.get('/v1/approvals', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const queryInput = (request.query || {}) as Record<string, unknown>;
    const filters = normalizeApprovalsFilters(queryInput);
    if (!filters.requesterValid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'requester must be all or me' },
      });
    }
    const limit = clampInt(queryInput.limit, 50, 1, 100);
    const offset = Math.max(clampInt(queryInput.offset, 0, 0, Number.MAX_SAFE_INTEGER), 0);
    const built = buildApprovalsBaseSelect(request.userId, request.orgId, filters);
    const queryParams = [...built.params];
    let query = built.query;

    queryParams.push(limit + 1);
    const limitPos = queryParams.length;
    queryParams.push(offset);
    const offsetPos = queryParams.length;
    query += ` ORDER BY a.created_at DESC LIMIT $${limitPos} OFFSET $${offsetPos}`;

    const result = await pool.query(query, queryParams);
    const paged = paginateRows(result.rows, limit, offset);

    reply.send({
      success: true,
      data: {
        rows: paged.rows,
        page: paged.page,
      },
    });
  });

  // ─── GET /v1/approvals/export ───
  // Export approvals visible to current user with optional filters.
  app.get('/v1/approvals/export', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const queryInput = (request.query || {}) as Record<string, unknown>;
    const filters = normalizeApprovalsFilters(queryInput);
    if (!filters.requesterValid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'requester must be all or me' },
      });
    }
    const format = String(queryInput.format || 'json').trim().toLowerCase();
    const maxRows = clampInt(queryInput.max_rows, 5000, 1, 10000);

    if (format !== 'json' && format !== 'csv') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'format must be json or csv' },
      });
    }

    const built = buildApprovalsBaseSelect(request.userId, request.orgId, filters);
    const queryParams = [...built.params, maxRows];
    const query = `${built.query} ORDER BY a.created_at DESC LIMIT $${queryParams.length}`;

    const result = await pool.query(query, queryParams);
    const payload = {
      exported_at: new Date().toISOString(),
      filters: {
        status: filters.status || null,
        chat_id: filters.chatId || null,
        query: filters.q || null,
        requester: filters.requester,
      },
      rows: result.rows,
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = filters.status === 'history' ? 'history' : (filters.status || 'all');
    if (format === 'csv') {
      const csv = buildApprovalsCsv(result.rows);
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="approvals-${suffix}-${stamp}.csv"`);
      reply.send(csv);
      return;
    }

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="approvals-${suffix}-${stamp}.json"`);
    reply.send(payload);
  });

  // ─── POST /v1/approvals/:id/vote ───
  app.post('/v1/approvals/:id/vote', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['decision'],
        additionalProperties: false,
        properties: {
          decision: { type: 'string', enum: ['approve', 'deny', 'reject'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { decision } = request.body as { decision: 'approve' | 'deny' | 'reject' };
    const normalizedDecision = decision === 'reject' ? 'deny' : decision;
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const { v7: uuidv7 } = await import('uuid');
    const voteId = uuidv7();
    let nextStatus: 'approved' | 'denied' | 'pending' = 'pending';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify the approval belongs to a chat user is in and lock row for atomic tally update.
      const approval = await client.query(
        `SELECT a.*
         FROM approvals a
         JOIN chats c ON c.id = a.chat_id AND c.organization_id = $3
         JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $2
         WHERE a.id = $1 AND a.status = 'pending'
         FOR UPDATE`,
        [id, request.userId, request.orgId],
      );

      if (approval.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Approval not found or already resolved' } });
      }
      if (String(approval.rows[0]?.requester_user_id || '') === String(request.userId)) {
        await client.query('ROLLBACK');
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Requester cannot vote on own approval' },
        });
      }
      const approversRaw = (approval.rows[0]?.details && typeof approval.rows[0].details === 'object')
        ? (approval.rows[0].details as Record<string, unknown>).approvers
        : undefined;
      const allowedApprovers = Array.isArray(approversRaw)
        ? approversRaw.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      if (allowedApprovers.length > 0 && !allowedApprovers.includes(String(request.userId || '').trim())) {
        await client.query('ROLLBACK');
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'User is not in configured approvers list' },
        });
      }
      const expiresAtMs = approval.rows[0]?.expires_at
        ? Date.parse(String(approval.rows[0].expires_at))
        : NaN;
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        await client.query(
          `UPDATE approvals
           SET status = 'expired',
               resolved_at = COALESCE(resolved_at, NOW())
           WHERE id = $1
             AND status = 'pending'`,
          [id],
        );
        await client.query('COMMIT');
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Approval already expired' },
        });
      }

      await client.query(
        `INSERT INTO approval_votes (id, approval_id, voter_user_id, vote, voted_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (approval_id, voter_user_id) DO UPDATE
         SET vote = $4, voted_at = NOW()`,
        [voteId, id, request.userId, normalizedDecision],
      );

      const tallyRes = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE vote = 'approve')::int AS approve_count,
           COUNT(*) FILTER (WHERE vote = 'deny')::int AS deny_count
         FROM approval_votes
         WHERE approval_id = $1`,
        [id],
      );
      const approveCount = Number(tallyRes.rows[0]?.approve_count || 0);
      const denyCount = Number(tallyRes.rows[0]?.deny_count || 0);
      const quorumRequired = Number(approval.rows[0]?.quorum_required || 1);
      nextStatus = approveCount >= quorumRequired
        ? 'approved'
        : denyCount > 0
          ? 'denied'
          : 'pending';
      await client.query(
        `UPDATE approvals
         SET votes_approve = $2,
             votes_deny = $3,
             status = $4,
             resolved_at = CASE WHEN $4 = 'pending' THEN NULL ELSE NOW() END
         WHERE id = $1`,
        [id, approveCount, denyCount, nextStatus],
      );

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failures
      }
      throw err;
    } finally {
      client.release();
    }

    // Publish event
    const js = nc.jetstream();
    await js.publish('approval.updated', Buffer.from(JSON.stringify({
      schema_version: '1.0',
      event_id: voteId,
      occurred_at: new Date().toISOString(),
      data: {
        approval_id: id,
        voter_user_id: request.userId,
        vote: normalizedDecision,
        status: nextStatus,
      },
    })));

    logger.info('Approval vote cast', { approval_id: id, voter: request.userId, decision: normalizedDecision });
    reply.send({ success: true, data: { vote_id: voteId } });
  });

  // ─── POST /v1/search ───
  // Federated text search across messages, tool runs, and artifacts
  app.post('/v1/search', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const body = (request.body || {}) as {
      query?: string;
      chat_id?: string;
      limits?: { messages?: number; tool_runs?: number; artifacts?: number };
      offsets?: { messages?: number; tool_runs?: number; artifacts?: number };
    };
    const searchQuery = String(body.query || '').trim();
    const chatId = body.chat_id ? String(body.chat_id) : undefined;
    const limitsRaw = body.limits || {};
    const offsetsRaw = body.offsets || {};

    const limits = {
      messages: clampInt(limitsRaw.messages, 30, 1, 100),
      tool_runs: clampInt(limitsRaw.tool_runs, 10, 1, 100),
      artifacts: clampInt(limitsRaw.artifacts, 10, 1, 100),
    };
    const offsets = {
      messages: clampInt(offsetsRaw.messages, 0, 0, Number.MAX_SAFE_INTEGER),
      tool_runs: clampInt(offsetsRaw.tool_runs, 0, 0, Number.MAX_SAFE_INTEGER),
      artifacts: clampInt(offsetsRaw.artifacts, 0, 0, Number.MAX_SAFE_INTEGER),
    };

    if (!searchQuery) {
      const messagesPage = paginateRows([], limits.messages, offsets.messages).page;
      const toolRunsPage = paginateRows([], limits.tool_runs, offsets.tool_runs).page;
      const artifactsPage = paginateRows([], limits.artifacts, offsets.artifacts).page;
      return reply.send({
        success: true,
        data: {
          messages: [],
          tool_runs: [],
          artifacts: [],
          page: {
            messages: messagesPage,
            tool_runs: toolRunsPage,
            artifacts: artifactsPage,
          },
        },
      });
    }

    // Search messages the user has access to
    let msgQuery = `SELECT m.id, m.chat_id, m.text, m.role, m.created_at, c.name AS chat_name
                    FROM messages m
                    JOIN chats c ON c.id = m.chat_id
                    JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $1
                    WHERE c.organization_id = $2
                      AND m.text ILIKE $3`;
    const msgParams: unknown[] = [request.userId, request.orgId, `%${searchQuery}%`];
    if (chatId) {
      msgParams.push(chatId);
      msgQuery += ` AND m.chat_id = $${msgParams.length}`;
    }
    msgParams.push(limits.messages + 1);
    const msgLimitPos = msgParams.length;
    msgParams.push(offsets.messages);
    const msgOffsetPos = msgParams.length;
    msgQuery += ` ORDER BY m.created_at DESC LIMIT $${msgLimitPos} OFFSET $${msgOffsetPos}`;
    const msgResult = await pool.query(msgQuery, msgParams);

    // Search tool runs
    let runQuery = `SELECT tr.id, tr.chat_id, tr.tool_name, tr.status, tr.created_at, c.name AS chat_name,
                           COALESCE(
                             ctx.message_id,
                             NULLIF(ap.details->>'message_id', ''),
                             NULLIF(ap.details->>'context_message_id', '')
                           ) AS context_message_id
                    FROM tool_runs tr
                    JOIN chats c ON c.id = tr.chat_id
                    JOIN chat_members cm ON cm.chat_id = tr.chat_id AND cm.user_id = $1
                    LEFT JOIN approvals ap ON ap.id = tr.approval_id
                    LEFT JOIN LATERAL (
                      SELECT a.message_id
                      FROM artifacts a
                      WHERE a.tool_run_id = tr.id AND a.message_id IS NOT NULL
                      ORDER BY a.created_at DESC
                      LIMIT 1
                    ) ctx ON TRUE
                    WHERE c.organization_id = $2
                      AND tr.tool_name ILIKE $3`;
    const runParams: unknown[] = [request.userId, request.orgId, `%${searchQuery}%`];
    if (chatId) {
      runParams.push(chatId);
      runQuery += ` AND tr.chat_id = $${runParams.length}`;
    }
    runParams.push(limits.tool_runs + 1);
    const runLimitPos = runParams.length;
    runParams.push(offsets.tool_runs);
    const runOffsetPos = runParams.length;
    runQuery += ` ORDER BY tr.created_at DESC LIMIT $${runLimitPos} OFFSET $${runOffsetPos}`;
    const runResult = await pool.query(runQuery, runParams);

    // Search artifacts
    let artQuery = `SELECT a.id, a.chat_id, a.message_id, a.name, a.mime_type, a.size_bytes, a.created_at, c.name AS chat_name
                    FROM artifacts a
                    JOIN chats c ON c.id = a.chat_id
                    JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $1
                    WHERE c.organization_id = $2
                      AND a.name ILIKE $3`;
    const artParams: unknown[] = [request.userId, request.orgId, `%${searchQuery}%`];
    if (chatId) {
      artParams.push(chatId);
      artQuery += ` AND a.chat_id = $${artParams.length}`;
    }
    artParams.push(limits.artifacts + 1);
    const artLimitPos = artParams.length;
    artParams.push(offsets.artifacts);
    const artOffsetPos = artParams.length;
    artQuery += ` ORDER BY a.created_at DESC LIMIT $${artLimitPos} OFFSET $${artOffsetPos}`;
    const artResult = await pool.query(artQuery, artParams);

    const messagesPaged = paginateRows(msgResult.rows, limits.messages, offsets.messages);
    const toolRunsPaged = paginateRows(runResult.rows, limits.tool_runs, offsets.tool_runs);
    const artifactsPaged = paginateRows(artResult.rows, limits.artifacts, offsets.artifacts);

    reply.send({
      success: true,
      data: {
        messages: messagesPaged.rows,
        tool_runs: toolRunsPaged.rows,
        artifacts: artifactsPaged.rows,
        page: {
          messages: messagesPaged.page,
          tool_runs: toolRunsPaged.page,
          artifacts: artifactsPaged.page,
        },
      },
    });
  });

  // ─── GET /v1/stream ───
  // SSE endpoint for realtime updates in chats the user belongs to
  app.get('/v1/stream', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const streamQuery = (request.query || {}) as { last_event_id?: string };
    const headerLastEventId = String(request.headers['last-event-id'] || '').trim();
    const queryLastEventId = String(streamQuery.last_event_id || '').trim();
    const resumeToken = queryLastEventId || headerLastEventId;
    const resumeCursor = resumeToken ? parseCanvasStreamEventId(resumeToken) : null;
    if (resumeToken && !resumeCursor) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'last_event_id must be a valid stream cursor' },
      });
    }
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write('retry: 5000\n\n');

    // Poll for new messages/approvals (simple approach — in production, use NATS subscription)
    // Keep independent cursors so high traffic in one stream cannot starve the other.
    let messageCursorTs = new Date().toISOString();
    let messageCursorId = '';
    let approvalCursorTs = messageCursorTs;
    let approvalCursorId = '';
    let agentStateCursorTs = messageCursorTs;
    let agentStateCursorId = '';
    let nudgeCursorTs = messageCursorTs;
    let nudgeCursorId = '';
    let pollInFlight = false;
    if (resumeCursor) {
      if (resumeCursor.kind === 'message') {
        messageCursorTs = resumeCursor.ts;
        messageCursorId = resumeCursor.id;
      } else if (resumeCursor.kind === 'approval') {
        approvalCursorTs = resumeCursor.ts;
        approvalCursorId = resumeCursor.id;
      } else if (resumeCursor.kind === 'agent_state') {
        agentStateCursorTs = resumeCursor.ts;
        agentStateCursorId = resumeCursor.id;
      } else if (resumeCursor.kind === 'agent_nudged') {
        nudgeCursorTs = resumeCursor.ts;
        nudgeCursorId = resumeCursor.id;
      }
    }
    const interval = setInterval(async () => {
      if (shouldSkipCanvasStreamPollTick(pollInFlight)) return;
      pollInFlight = true;
      try {
        const newMsgs = await pool.query<{
          id: unknown;
          created_at: unknown;
          [key: string]: unknown;
        }>(
          `SELECT m.*, u.username AS sender_name
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_user_id
           JOIN chat_members cm ON cm.chat_id = m.chat_id
           JOIN chats c ON c.id = m.chat_id
           WHERE cm.user_id = $1
             AND c.organization_id = $2
             AND (m.created_at > $3 OR (m.created_at = $3 AND m.id > $4))
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT 50`,
          [request.userId, request.orgId, messageCursorTs, messageCursorId],
        );

        for (const msg of newMsgs.rows) {
          const evTs = String(msg.created_at || '');
          const evIdRaw = String(msg.id || '');
          const evId = buildCanvasStreamEventId('message', evTs, evIdRaw);
          reply.raw.write(`id: ${evId}\n`);
          reply.raw.write('event: message\n');
          reply.raw.write(`data: ${JSON.stringify(msg)}\n\n`);
        }

        // Also check approvals
        const newApprovals = await pool.query<{
          id: unknown;
          chat_id: unknown;
          status: unknown;
          tool_name: unknown;
          scope: unknown;
          requester_user_id: unknown;
          votes_approve: unknown;
          votes_deny: unknown;
          quorum_required: unknown;
          created_at: unknown;
          resolved_at: unknown;
          event_ts: unknown;
          [key: string]: unknown;
        }>(
          `SELECT a.id,
                  a.chat_id,
                  a.status,
                  a.tool_name,
                  a.scope,
                  a.requester_user_id,
                  a.votes_approve,
                  a.votes_deny,
                  a.quorum_required,
                  a.created_at,
                  a.resolved_at,
                  GREATEST(a.created_at, COALESCE(a.resolved_at, a.created_at)) AS event_ts
           FROM approvals a
           JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $1
           JOIN chats c ON c.id = a.chat_id
           WHERE (
             c.organization_id = $2
             AND (
               GREATEST(a.created_at, COALESCE(a.resolved_at, a.created_at)) > $3
             OR (
                 GREATEST(a.created_at, COALESCE(a.resolved_at, a.created_at)) = $3
                  AND a.id > $4
               )
             )
           )
           ORDER BY event_ts ASC, a.id ASC
           LIMIT 50`,
          [request.userId, request.orgId, approvalCursorTs, approvalCursorId],
        );

        for (const a of newApprovals.rows) {
          const approvalEvent = projectCanvasApprovalStreamEvent(a);
          const evTs = String(a.event_ts || a.created_at || '');
          const evIdRaw = String(a.id || '');
          const evId = buildCanvasStreamEventId('approval', evTs, evIdRaw);
          reply.raw.write(`id: ${evId}\n`);
          reply.raw.write('event: approval\n');
          reply.raw.write(`data: ${JSON.stringify(approvalEvent)}\n\n`);
        }

        const newAgentStates = await pool.query<{
          session_id: unknown;
          agent_paused: unknown;
          updated_at: unknown;
        }>(
          `SELECT ss.session_id, ss.agent_paused, ss.updated_at
           FROM session_settings ss
           JOIN chat_members cm ON cm.chat_id = ss.session_id AND cm.user_id = $1
           JOIN chats c ON c.id = ss.session_id
           WHERE c.organization_id = $2
             AND (ss.updated_at > $3 OR (ss.updated_at = $3 AND ss.session_id > $4))
           ORDER BY ss.updated_at ASC, ss.session_id ASC
           LIMIT 50`,
          [request.userId, request.orgId, agentStateCursorTs, agentStateCursorId],
        );
        for (const row of newAgentStates.rows) {
          const paused = Boolean(row.agent_paused);
          const evTs = String(row.updated_at || '');
          const evIdRaw = String(row.session_id || '');
          const evId = buildCanvasStreamEventId('agent_state', evTs, evIdRaw);
          reply.raw.write(`id: ${evId}\n`);
          reply.raw.write(`event: ${paused ? 'agent.paused' : 'agent.resumed'}\n`);
          reply.raw.write(`data: ${JSON.stringify({
            chat_id: String(row.session_id || ''),
            paused,
            updated_at: row.updated_at,
          })}\n\n`);
        }

        const newNudges = await pool.query<{
          id: unknown;
          chat_id: unknown;
          user_id: unknown;
          action: unknown;
          context: unknown;
          created_at: unknown;
        }>(
          `SELECT n.id, n.chat_id, n.user_id, n.action, n.context, n.created_at
           FROM agent_nudge_events n
           JOIN chat_members cm ON cm.chat_id = n.chat_id AND cm.user_id = $1
           JOIN chats c ON c.id = n.chat_id
           WHERE c.organization_id = $2
             AND (n.created_at > $3 OR (n.created_at = $3 AND n.id > $4))
           ORDER BY n.created_at ASC, n.id ASC
           LIMIT 50`,
          [request.userId, request.orgId, nudgeCursorTs, nudgeCursorId],
        );
        for (const n of newNudges.rows) {
          const evTs = String(n.created_at || '');
          const evIdRaw = String(n.id || '');
          const evId = buildCanvasStreamEventId('agent_nudged', evTs, evIdRaw);
          reply.raw.write(`id: ${evId}\n`);
          reply.raw.write('event: agent.nudged\n');
          reply.raw.write(`data: ${JSON.stringify({
            id: String(n.id || ''),
            chat_id: String(n.chat_id || ''),
            user_id: String(n.user_id || ''),
            action: String(n.action || 'resubmit_last_user_message'),
            context: n.context || {},
            created_at: n.created_at,
          })}\n\n`);
        }

        if (newMsgs.rows.length > 0) {
          const lastMsg = newMsgs.rows[newMsgs.rows.length - 1];
          messageCursorTs = String(lastMsg.created_at || messageCursorTs);
          messageCursorId = String(lastMsg.id || messageCursorId);
        }
        if (newApprovals.rows.length > 0) {
          const lastApproval = newApprovals.rows[newApprovals.rows.length - 1];
          approvalCursorTs = String(lastApproval.event_ts || approvalCursorTs);
          approvalCursorId = String(lastApproval.id || approvalCursorId);
        }
        if (newAgentStates.rows.length > 0) {
          const lastState = newAgentStates.rows[newAgentStates.rows.length - 1];
          agentStateCursorTs = String(lastState.updated_at || agentStateCursorTs);
          agentStateCursorId = String(lastState.session_id || agentStateCursorId);
        }
        if (newNudges.rows.length > 0) {
          const lastNudge = newNudges.rows[newNudges.rows.length - 1];
          nudgeCursorTs = String(lastNudge.created_at || nudgeCursorTs);
          nudgeCursorId = String(lastNudge.id || nudgeCursorId);
        }
      } catch {
        // Connection may be closed
      } finally {
        pollInFlight = false;
      }
    }, 2000);

    // Heartbeat
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(interval);
        clearInterval(heartbeat);
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    };
    request.raw.on('close', cleanup);
    reply.raw.on('error', cleanup);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Share Conversation as Link
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /v1/chats/:chatId/share ───
  // Return current active share status for this chat.
  app.get('/v1/chats/:chatId/share', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    await deactivateExpiredChatShares(pool, { chatId });

    const existing = await pool.query(
      `SELECT id, share_token, created_at, expires_at
       FROM chat_shares
       WHERE chat_id = $1
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [chatId],
    );

    if (existing.rows.length === 0) {
      return reply.send({
        success: true,
        data: { active: false },
      });
    }

    const row = existing.rows[0];
    reply.send({
      success: true,
      data: {
        active: true,
        share_token: row.share_token,
        share_url: buildShareUrl(request, String(row.share_token || '')),
        created_at: row.created_at,
        expires_at: row.expires_at,
      },
    });
  });

  // ─── POST /v1/chats/:chatId/share ───
  // Create or return existing share link
  app.post('/v1/chats/:chatId/share', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          expires_in_days: { type: 'integer', minimum: 1, maximum: 3650 },
        },
      },
    },
  }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const body = (request.body || {}) as { expires_in_days?: unknown };
    let expiresInDays: number | null = null;
    if (body.expires_in_days !== undefined && body.expires_in_days !== null && String(body.expires_in_days).trim() !== '') {
      const parsed = Number(body.expires_in_days);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'expires_in_days must be between 1 and 3650' },
        });
      }
      expiresInDays = parsed;
    }
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock chat row to serialize concurrent share creation for this chat.
      await client.query(
        `SELECT id FROM chats WHERE id = $1 FOR UPDATE`,
        [chatId],
      );
      await deactivateExpiredChatShares(client, { chatId });

      const existing = await client.query(
        `SELECT id, share_token, created_at, expires_at
         FROM chat_shares
         WHERE chat_id = $1
           AND is_active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC
         LIMIT 1`,
        [chatId],
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        await client.query('COMMIT');
        return reply.send({
          success: true,
          data: {
            share_token: row.share_token,
            share_url: buildShareUrl(request, String(row.share_token || '')),
            created_at: row.created_at,
            expires_at: row.expires_at,
          },
        });
      }

      let created: { share_token: string; created_at: string; expires_at: string | null } | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const token = generateShareToken();
        try {
          const inserted = await client.query(
            `INSERT INTO chat_shares (chat_id, share_token, created_by, organization_id, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING share_token, created_at, expires_at`,
            [chatId, token, request.userId, request.orgId, expiresAt],
          );
          if (inserted.rows.length > 0) {
            created = inserted.rows[0] as { share_token: string; created_at: string; expires_at: string | null };
            break;
          }
        } catch (error) {
          const pgError = error as { code?: string; constraint?: string };
          const code = String(pgError.code || '');
          if (code !== '23505') throw error;
          const constraint = String(pgError.constraint || '');
          if (constraint === 'chat_shares_chat_id_key') {
            const revived = await client.query(
              `UPDATE chat_shares
                 SET share_token = $2,
                     created_by = $3,
                     organization_id = $4,
                     is_active = TRUE,
                     created_at = NOW(),
                     expires_at = $5
               WHERE chat_id = $1
               RETURNING share_token, created_at, expires_at`,
              [chatId, token, request.userId, request.orgId, expiresAt],
            );
            if (revived.rows.length > 0) {
              created = revived.rows[0] as { share_token: string; created_at: string; expires_at: string | null };
              break;
            }
          }
          if (constraint === 'chat_shares_share_token_key') {
            continue;
          }
          throw error;
        }
      }

      if (!created) {
        throw new Error('failed to generate unique share token');
      }

      await client.query('COMMIT');
      logger.info('chat shared', {
        chat_id: chatId,
        user_id: request.userId,
        share_token_fingerprint: fingerprintShareToken(created.share_token),
      });
      reply.status(201).send({
        success: true,
        data: {
          share_token: created.share_token,
          share_url: buildShareUrl(request, created.share_token),
          created_at: created.created_at,
          expires_at: created.expires_at,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─── DELETE /v1/chats/:chatId/share ───
  // Revoke active share link
  app.delete('/v1/chats/:chatId/share', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const member = await assertChatMember(pool, chatId, request.userId, request.orgId);
    if (!member) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not a member' } });
    }

    const result = await pool.query(
      `UPDATE chat_shares SET is_active = FALSE WHERE chat_id = $1 AND is_active = TRUE RETURNING id`,
      [chatId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No active share' } });
    }

    logger.info(`Chat ${chatId} share revoked by user ${request.userId}`);
    reply.send({ success: true, data: { revoked: true } });
  });

  // ─── GET /v1/shared/:token ───
  // Public read-only access to a shared conversation (no auth required)
  app.get('/v1/shared/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const shareResult = await pool.query(
      `SELECT cs.chat_id, cs.expires_at, c.name AS chat_name
       FROM chat_shares cs
       JOIN chats c ON c.id = cs.chat_id
       WHERE cs.share_token = $1 AND cs.is_active = TRUE`,
      [token],
    );

    if (shareResult.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Share not found or expired' } });
    }

    const share = shareResult.rows[0];

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      await deactivateExpiredChatShares(pool, { token });
      return reply.status(410).send({ success: false, error: { code: 'EXPIRED', message: 'This share link has expired' } });
    }

    // Fetch messages (last 200, oldest first)
    const msgResult = await pool.query(
      `SELECT id, role, text, created_at
       FROM messages
       WHERE chat_id = $1
       ORDER BY created_at ASC
       LIMIT 200`,
      [share.chat_id],
    );

    reply.send({
      success: true,
      data: {
        title: share.chat_name,
        messages: msgResult.rows.map((m: { id: string; role: string; text: string; created_at: string }) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          timestamp: m.created_at,
        })),
      },
    });
  });

  logger.info('Canvas routes registered');
}

async function assertChatMember(pool: pg.Pool, chatId: string, userId: string, orgId?: string): Promise<boolean> {
  if (!orgId) return false;
  const member = await pool.query(
    `SELECT 1
     FROM chat_members cm
     JOIN chats c ON c.id = cm.chat_id
     WHERE cm.chat_id = $1 AND cm.user_id = $2 AND c.organization_id = $3`,
    [chatId, userId, orgId],
  );
  return member.rows.length > 0;
}

async function deactivateExpiredChatShares(
  db: QueryExecutor,
  target: { chatId?: string; token?: string },
): Promise<void> {
  const conditions = ['is_active = TRUE', 'expires_at IS NOT NULL', 'expires_at <= NOW()'];
  const params: unknown[] = [];
  if (target.chatId) {
    params.push(target.chatId);
    conditions.push(`chat_id = $${params.length}`);
  }
  if (target.token) {
    params.push(target.token);
    conditions.push(`share_token = $${params.length}`);
  }
  const whereClause = conditions.join(' AND ');
  await db.query(`UPDATE chat_shares SET is_active = FALSE WHERE ${whereClause}`, params);
}

type ApprovalsFilters = {
  status: string;
  chatId: string;
  q: string;
  requester: 'all' | 'me';
  requesterValid: boolean;
};

export function normalizeApprovalsRequesterFilter(rawValue: unknown): {
  requester: 'all' | 'me';
  requesterValid: boolean;
} {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (!normalized || normalized === 'all' || normalized === 'any') {
    return { requester: 'all', requesterValid: true };
  }
  if (normalized === 'me') {
    return { requester: 'me', requesterValid: true };
  }
  return { requester: 'all', requesterValid: false };
}

function normalizeApprovalsFilters(queryInput: Record<string, unknown>): ApprovalsFilters {
  const requester = normalizeApprovalsRequesterFilter(queryInput.requester);
  return {
    status: String(queryInput.status || '').trim().toLowerCase(),
    chatId: String(queryInput.chat_id || '').trim(),
    q: String(queryInput.query || '').trim(),
    requester: requester.requester,
    requesterValid: requester.requesterValid,
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parseInt(String(value ?? fallback), 10);
  const base = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(base, min), max);
}

type OffsetPage = {
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset: number;
};

function paginateRows<T>(rows: T[], limit: number, offset: number): { rows: T[]; page: OffsetPage } {
  const hasMore = rows.length > limit;
  const pagedRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    rows: pagedRows,
    page: {
      offset,
      limit,
      has_more: hasMore,
      next_offset: offset + pagedRows.length,
    },
  };
}

function buildApprovalsBaseSelect(
  userId: string,
  orgId: string,
  filters: ApprovalsFilters,
): { query: string; params: unknown[] } {
  let query = `SELECT a.id,
                      a.chat_id,
                      a.tool_name,
                      a.scope,
                      a.requester_user_id,
                      a.status,
                      a.quorum_required,
                      a.votes_approve,
                      a.votes_deny,
                      a.expires_at,
                      a.created_at,
                      a.resolved_at
               FROM approvals a
               JOIN chats c ON c.id = a.chat_id AND c.organization_id = $2
               JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $1
               WHERE 1=1`;
  const params: unknown[] = [userId, orgId];

  if (filters.status === 'history') {
    query += ` AND a.status <> 'pending'`;
  } else if (filters.status) {
    params.push(filters.status);
    query += ` AND a.status = $${params.length}`;
  }
  if (filters.chatId) {
    params.push(filters.chatId);
    query += ` AND a.chat_id = $${params.length}`;
  }
  if (filters.requester === 'me') {
    params.push(userId);
    query += ` AND a.requester_user_id = $${params.length}`;
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    query += ` AND (
      a.tool_name ILIKE $${params.length}
      OR a.scope ILIKE $${params.length}
      OR CAST(a.details AS TEXT) ILIKE $${params.length}
    )`;
  }
  return { query, params };
}

type A2uiStateSnapshot = {
  version: number;
  html: string;
  component: string;
  state: Record<string, unknown>;
  updated_at: string | null;
};

type A2uiEventEnvelope = {
  id: string;
  type: string;
  payload: unknown;
  created_at: string;
};

type A2uiEvalExecutionResult =
  | {
    ok: true;
    ui: Partial<A2uiStateSnapshot> & { state?: unknown };
    result: unknown;
  }
  | {
    ok: false;
    message: string;
  };

type SpeakerValidationResult = {
  valid: boolean;
  message: string;
};

async function getA2uiState(pool: pg.Pool, chatId: string): Promise<A2uiStateSnapshot> {
  const res = await pool.query(
    `SELECT version, html, component, state, updated_at
     FROM a2ui_state
     WHERE chat_id = $1`,
    [chatId],
  );
  if (res.rows.length === 0) {
    return { version: 0, html: '', component: '', state: {}, updated_at: null };
  }
  const row = res.rows[0] as {
    version?: number;
    html?: string;
    component?: string;
    state?: unknown;
    updated_at?: string | null;
  };
  return {
    version: Number(row.version || 0),
    html: String(row.html || ''),
    component: String(row.component || ''),
    state: row.state && typeof row.state === 'object'
      ? (row.state as Record<string, unknown>)
      : {},
    updated_at: row.updated_at || null,
  };
}

export function normalizeA2uiVersion(value: unknown, currentVersion: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return currentVersion + 1;
  if (parsed < 0 || parsed > 2147483647) return currentVersion + 1;
  return parsed;
}

export function executeA2uiEvalScript(
  script: string,
  current: A2uiStateSnapshot,
  payload: Record<string, unknown>,
): A2uiEvalExecutionResult {
  const sandbox: Record<string, unknown> = {
    ui: JSON.parse(JSON.stringify(current)),
    payload: payload || {},
    result: null,
  };

  try {
    vm.runInNewContext(
      `result = (() => { ${script} })();`,
      sandbox,
      { timeout: 100, microtaskMode: 'afterEvaluate' },
    );
  } catch (err) {
    logger.warn('A2UI eval script execution failed', {
      error: String((err as Error)?.message || err),
    });
    return {
      ok: false,
      message: 'A2UI eval script execution failed',
    };
  }

  return {
    ok: true,
    ui: (sandbox.ui && typeof sandbox.ui === 'object'
      ? sandbox.ui
      : {}) as Partial<A2uiStateSnapshot> & { state?: unknown },
    result: sandbox.result ?? null,
  };
}

export function validateSpeakerLabelSignature(
  label: string,
  signature: string,
  required: boolean,
): SpeakerValidationResult {
  if (required && (!label || !signature)) {
    return {
      valid: false,
      message: 'label and signature are required',
    };
  }
  if ((label && label.length > 120) || (signature && signature.length > 512)) {
    return {
      valid: false,
      message: 'label/signature length exceeded',
    };
  }
  return { valid: true, message: '' };
}

export function normalizeWakeWordMaxAudioBytes(value: unknown): number {
  const fallback = 2 * 1024 * 1024;
  const min = 32 * 1024;
  const max = 10 * 1024 * 1024;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}

export function estimateBase64DecodedBytes(input: string): number {
  const raw = String(input || '').trim();
  if (!raw) return 0;
  const normalized = raw.includes(',')
    ? raw.slice(raw.indexOf(',') + 1)
    : raw;
  const compact = normalized.replace(/\s+/g, '');
  if (!compact) return 0;
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.floor((compact.length * 3) / 4) - padding;
}

async function upsertA2uiState(
  pool: pg.Pool,
  chatId: string,
  next: { version: number; html: string; component: string; state: Record<string, unknown> },
  userId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO a2ui_state (chat_id, version, html, component, state, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (chat_id) DO UPDATE
     SET version = $2,
         html = $3,
         component = $4,
         state = $5,
         updated_at = NOW(),
         updated_by = $6`,
    [chatId, next.version, next.html, next.component, JSON.stringify(next.state || {}), userId],
  );
}

function emitA2uiEvent(
  chatId: string,
  evt: A2uiEventEnvelope,
  options?: { nc?: NatsConnection; publishRemote?: boolean },
) {
  const existing = a2uiRecentEvents.get(chatId) || [];
  existing.push(evt);
  if (existing.length > A2UI_RECENT_EVENT_BUFFER_MAX) {
    existing.splice(0, existing.length - A2UI_RECENT_EVENT_BUFFER_MAX);
  }
  a2uiRecentEvents.set(chatId, existing);
  a2uiBus.emit(chatId, evt);
  if (options?.publishRemote === false) return;
  if (!options?.nc) return;
  try {
    options.nc.publish(
      A2UI_EVENT_NATS_SUBJECT,
      a2uiNatsCodec.encode({
        source_instance_id: A2UI_EVENT_NATS_SOURCE_INSTANCE,
        chat_id: chatId,
        event: evt,
      }),
    );
  } catch (err) {
    logger.warn('Failed to publish remote A2UI event', { chat_id: chatId, error: String(err) });
  }
}

function getA2uiReplayEvents(chatId: string, lastEventId: string): A2uiEventEnvelope[] {
  const existing = a2uiRecentEvents.get(chatId) || [];
  const marker = String(lastEventId || '').trim();
  if (!marker) return [];
  const idx = existing.findIndex((evt) => String(evt.id || '') === marker);
  if (idx < 0) return [];
  return existing.slice(idx + 1);
}

function toCsvCell(value: unknown): string {
  if (value == null) return '';
  let raw = typeof value === 'string'
    ? value
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Neutralize spreadsheet formula execution while preserving leading whitespace.
  const normalized = raw.replace(/^(\s*)([=+\-@])/, "$1'$2");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function buildApprovalsCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [
    'id',
    'chat_id',
    'tool_name',
    'scope',
    'requester_user_id',
    'status',
    'quorum_required',
    'votes_approve',
    'votes_deny',
    'expires_at',
    'created_at',
    'resolved_at',
  ];
  const lines = [headers.map((header) => toCsvCell(header)).join(',')];
  for (const row of rows) {
    lines.push([
      toCsvCell(row.id),
      toCsvCell(row.chat_id),
      toCsvCell(row.tool_name),
      toCsvCell(row.scope),
      toCsvCell(row.requester_user_id),
      toCsvCell(row.status),
      toCsvCell(row.quorum_required),
      toCsvCell(row.votes_approve),
      toCsvCell(row.votes_deny),
      toCsvCell(row.expires_at),
      toCsvCell(row.created_at),
      toCsvCell(row.resolved_at),
    ].join(','));
  }
  return lines.join('\n');
}

function transcriptRoleLabel(rawRole: unknown): string {
  const role = String(rawRole || '').toLowerCase();
  if (role === 'assistant') return 'Sven';
  if (role === 'system') return 'System';
  return 'You';
}

function buildChatTranscriptMarkdown(title: string, rows: Array<Record<string, unknown>>): string {
  const exportedAt = new Date().toISOString();
  const header = [
    `# ${String(title || 'Chat transcript')}`,
    '',
    `Exported: ${exportedAt}`,
    `Messages: ${rows.length}`,
    '',
    '---',
    '',
  ].join('\n');

  const body = rows.flatMap((row) => {
    const createdAt = String(row.created_at || '');
    const role = transcriptRoleLabel(row.role);
    const rawText = String(row.text || '').trim();
    const contentType = String(row.content_type || '').toLowerCase();
    const text = rawText || (
      contentType === 'blocks'
        ? '[blocks message]'
        : contentType === 'file'
          ? '[file message]'
          : contentType === 'audio'
            ? '[audio message]'
            : '[empty message]'
    );
    return [
      `## ${role} (${createdAt || 'unknown'})`,
      '',
      text,
      '',
    ];
  }).join('\n');

  return `${header}${body}`.trimEnd() + '\n';
}
