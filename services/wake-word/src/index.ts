import fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { join, basename, extname } from 'node:path';
import { promises as fs } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { connect, JSONCodec, NatsConnection } from 'nats';
import pg from 'pg';
import { fetch } from 'undici';
import { nanoid } from 'nanoid';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, WakeWordDetectionEvent } from '@sven/shared';
import {
  WakeWordValidationError,
  stripTrailingSlash,
  normalizeWakeWordMaxAudioBytes,
  normalizeWakeWordMaxRequestBodyBytes,
  normalizeBoolean,
  normalizeDetectorTimeoutMs,
  normalizeDetectorThreshold,
  normalizeBase64AudioPayload,
  estimateBase64DecodedBytes,
  isBlockedAudioHostname,
  isBlockedAudioIp,
  guessExtension,
  guessMimeFromExtension,
  buildMetadata,
  attachDetectorMetadata,
  type WakeWordDetectorDecision,
} from './utils.js';

const logger = createLogger('wake-word');
const jc = JSONCodec<EventEnvelope<WakeWordDetectionEvent>>();

const serverPort = Number(process.env.WAKE_WORD_PORT || 4400);
const serverHost = process.env.WAKE_WORD_HOST || '0.0.0.0';
const storageDir = process.env.WAKE_WORD_STORAGE || join(process.cwd(), 'storage');
const retentionDays = Math.max(1, Number(process.env.WAKE_WORD_STORAGE_RETENTION_DAYS || 3));
const audioRoutePrefix = '/audio';
const storageBaseUrl = stripTrailingSlash(
  process.env.WAKE_WORD_BASE_URL || `http://wake-word:${serverPort}`,
);
const wakeWordSigningSecret = String(process.env.WAKE_WORD_SIGNING_SECRET || '').trim();
const wakeWordSignedUrlTtlSeconds = Number(process.env.WAKE_WORD_SIGNED_URL_TTL_SECONDS || 900);
const wakeWordMaxAudioBytes = normalizeWakeWordMaxAudioBytes(process.env.WAKE_WORD_MAX_AUDIO_BYTES);
const wakeWordMaxRequestBodyBytes = normalizeWakeWordMaxRequestBodyBytes(process.env.WAKE_WORD_MAX_REQUEST_BODY_BYTES);
const wakeWordAudioUrlAllowlist = (process.env.WAKE_WORD_AUDIO_URL_ALLOWLIST || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const wakeWordSelfDetect = normalizeBoolean(process.env.WAKE_WORD_SELF_DETECT);
const openWakeWordDetectUrl = stripTrailingSlash(
  process.env.OPENWAKEWORD_DETECT_URL || 'http://openwakeword-detector:4410',
);
const openWakeWordDetectTimeoutMs = normalizeDetectorTimeoutMs(process.env.OPENWAKEWORD_DETECT_TIMEOUT_MS);
const openWakeWordThreshold = normalizeDetectorThreshold(process.env.OPENWAKEWORD_THRESHOLD);
const gatewayUrl = process.env.WAKE_WORD_GATEWAY_URL || `http://gateway-api:${process.env.GATEWAY_PORT || 3000}`;
const adapterToken = process.env.SVEN_ADAPTER_TOKEN;
const databaseUrl = process.env.DATABASE_URL;

if (!adapterToken) {
  logger.fatal('SVEN_ADAPTER_TOKEN is required for wake-word service');
  process.exit(1);
}

if (!databaseUrl) {
  logger.fatal('DATABASE_URL is required for wake-word service');
  process.exit(1);
}
if (!wakeWordSigningSecret) {
  logger.fatal('WAKE_WORD_SIGNING_SECRET is required for wake-word service');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
let nc: NatsConnection | null = null;

async function main() {
  await fs.mkdir(storageDir, { recursive: true });

  const app = fastify({ logger: false, bodyLimit: wakeWordMaxRequestBodyBytes });
  app.get('/audio/:file', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { file?: string };
    const query = request.query as { expires?: string | number; sig?: string };

    const requestedFile = String(params.file || '').trim();
    const safeFile = basename(requestedFile);
    if (!safeFile || safeFile !== requestedFile || safeFile.includes('/') || safeFile.includes('\\')) {
      reply.status(400).send({ success: false, error: { code: 'INVALID_FILE', message: 'Invalid audio file path' } });
      return;
    }

    const expiresRaw = String(query.expires || '').trim();
    const sig = String(query.sig || '').trim();
    const expires = Number(expiresRaw);
    if (!sig || !Number.isFinite(expires) || expires <= 0) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing audio signature' } });
      return;
    }
    if (Math.floor(Date.now() / 1000) > expires) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Audio signature expired' } });
      return;
    }

    const expectedSig = signStoredAudioUrl(safeFile, expires);
    const provided = Buffer.from(sig, 'utf8');
    const expected = Buffer.from(expectedSig, 'utf8');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid audio signature' } });
      return;
    }

    const filePath = join(storageDir, safeFile);
    let audio: Buffer;
    try {
      audio = await fs.readFile(filePath);
    } catch {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Audio file not found' } });
      return;
    }

    const extension = extname(safeFile).toLowerCase();
    const contentType = guessMimeFromExtension(extension);
    reply.header('Content-Type', contentType).send(audio);
  });
  app.get('/healthz', async () => ({ success: true }));
  app.setErrorHandler((error: Error, _: FastifyRequest, reply: FastifyReply) => {
    logger.error('Request error', { error: String(error) });
    reply.status(500).send({ success: false, error: { message: 'Internal server error' } });
  });

  app.post('/v1/wake-word/detection', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as WakeWordRequestBody;
    if (!body.chat_id || !body.channel || !body.sender_identity_id || !body.wake_word) {
      reply.status(400).send({
        success: false,
        error: { code: 'MISSING_WAKE_WORD_FIELDS', message: 'chat_id, channel, sender_identity_id, and wake_word are required', },
      });
      return;
    }

    try {
      const channelMessageId = body.channel_message_id || `wake-${nanoid()}`;
      const audio = await resolveAudio(body);
      const detectorDecision = wakeWordSelfDetect ? await detectWakeWord(body, audio) : null;
      if (detectorDecision && !detectorDecision.detected) {
        logger.info('Wake-word detector rejected audio window', {
          wake_word: body.wake_word,
          target_label: detectorDecision.targetLabel,
          confidence: detectorDecision.confidence,
        });
        reply.status(202).send({
          success: true,
          data: {
            detected: false,
            confidence: detectorDecision.confidence ?? null,
            matched_label: detectorDecision.matchedLabel ?? null,
          },
        });
        return;
      }

      const metadata = attachDetectorMetadata(buildMetadata(body), detectorDecision);
      const effectiveConfidence = detectorDecision?.confidence ?? body.confidence;
      const gatewayResponse = await forwardToGateway({
        channel: body.channel,
        channel_message_id: channelMessageId,
        chat_id: body.chat_id,
        sender_identity_id: body.sender_identity_id,
        audio_url: audio.audio_url,
        audio_mime: audio.audio_mime,
        metadata,
      });

      const detectionId = uuidv7();
      const messageEventId = gatewayResponse.event_id;

      await Promise.all([
        storeWakeWordEvent(detectionId, body, audio, metadata, channelMessageId, messageEventId, effectiveConfidence),
        publishWakeWordEvent(detectionId, body, audio, metadata, channelMessageId, messageEventId, effectiveConfidence),
      ]);

      reply.status(202).send({
        success: true,
        data: {
          detection_id: detectionId,
          message_event_id: messageEventId,
          detected: true,
          confidence: effectiveConfidence ?? null,
          matched_label: detectorDecision?.matchedLabel ?? null,
        },
      });
    } catch (error) {
      if (error instanceof WakeWordValidationError) {
        reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      logger.error('Wake word detection failed', { error: String(error) });
      reply.status(500).send({ success: false, error: { message: 'Unable to forward detection' } });
    }
  });

  await connectNats();
  startStorageCleaner();

  const address = await app.listen({ port: serverPort, host: serverHost });
  logger.info('Wake-word service listening', { address });
}

main().catch((err) => {
  logger.fatal('Wake-word service crashed', { err: String(err) });
  process.exit(1);
});

interface WakeWordRequestBody {
  chat_id: string;
  channel: string;
  sender_identity_id: string;
  channel_message_id?: string;
  audio_base64?: string;
  audio_url?: string;
  audio_mime?: string;
  metadata?: Record<string, unknown>;
  transcribe?: boolean;
  language?: string;
  wake_word: string;
  confidence?: number;
  mode?: string;
}

interface AudioReference {
  audio_url: string;
  audio_mime?: string;
}

interface WakeWordDetectorResponseBody {
  data?: {
    detected?: boolean;
    confidence?: number;
    matched_label?: string | null;
    target_label?: string | null;
    threshold?: number;
    scores?: Record<string, number>;
  };
}

function signStoredAudioUrl(fileName: string, expires: number): string {
  return createHmac('sha256', wakeWordSigningSecret)
    .update(`${fileName}:${expires}`)
    .digest('hex');
}

function createSignedStoredAudioUrl(fileName: string): string {
  const expires = Math.floor(Date.now() / 1000) + Math.max(30, wakeWordSignedUrlTtlSeconds);
  const sig = signStoredAudioUrl(fileName, expires);
  return `${storageBaseUrl}${audioRoutePrefix}/${encodeURIComponent(fileName)}?expires=${expires}&sig=${sig}`;
}

async function resolveAudio(body: WakeWordRequestBody): Promise<AudioReference> {
  if (body.audio_base64) {
    return storeBase64Audio(body.audio_base64, body.audio_mime);
  }
  if (body.audio_url) {
    const safeUrl = await validateExternalAudioUrl(body.audio_url);
    return { audio_url: safeUrl, audio_mime: body.audio_mime };
  }
  throw new Error('audio_base64 or audio_url is required');
}

async function storeBase64Audio(base64: string, mime?: string): Promise<AudioReference> {
  const normalizedBase64 = normalizeBase64AudioPayload(base64);
  const estimatedBytes = estimateBase64DecodedBytes(normalizedBase64);
  if (estimatedBytes <= 0) {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_PAYLOAD', 'Audio payload is empty');
  }
  if (estimatedBytes > wakeWordMaxAudioBytes) {
    throw new WakeWordValidationError(
      413,
      'PAYLOAD_TOO_LARGE',
      `Audio payload exceeds ${wakeWordMaxAudioBytes} bytes limit`,
    );
  }

  const buffer = Buffer.from(normalizedBase64, 'base64');
  if (buffer.length === 0) {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_PAYLOAD', 'Audio payload is empty');
  }
  if (buffer.length > wakeWordMaxAudioBytes) {
    throw new WakeWordValidationError(
      413,
      'PAYLOAD_TOO_LARGE',
      `Audio payload exceeds ${wakeWordMaxAudioBytes} bytes limit`,
    );
  }

  const extension = guessExtension(mime);
  const fileName = `wake-${nanoid()}${extension}`;
  const filePath = join(storageDir, fileName);

  await fs.writeFile(filePath, buffer);

  const resolvedMime = mime || guessMimeFromExtension(extension);
  return {
    audio_url: createSignedStoredAudioUrl(fileName),
    audio_mime: resolvedMime,
  };
}

function isAllowlistedAudioHost(hostnameRaw: string): boolean {
  if (wakeWordAudioUrlAllowlist.length === 0) return true;
  const hostname = String(hostnameRaw || '').trim().toLowerCase();
  if (!hostname) return false;
  return wakeWordAudioUrlAllowlist.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

async function validateExternalAudioUrl(urlRaw: string): Promise<string> {
  const trimmed = String(urlRaw || '').trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url must be a valid absolute URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url must use http/https scheme');
  }
  if (url.username || url.password) {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url must not include userinfo');
  }

  const hostname = url.hostname.toLowerCase();
  if (!isAllowlistedAudioHost(hostname)) {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url host is not allowlisted');
  }
  if (isBlockedAudioHostname(hostname)) {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url host is blocked');
  }
  if (isBlockedAudioIp(hostname)) {
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url host is blocked');
  }

  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (resolved.some((entry) => isBlockedAudioIp(entry.address))) {
      throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url resolves to a blocked address');
    }
  } catch (err) {
    if (err instanceof WakeWordValidationError) throw err;
    throw new WakeWordValidationError(400, 'INVALID_AUDIO_URL', 'audio_url host resolution failed');
  }

  return url.toString();
}

async function detectWakeWord(
  body: WakeWordRequestBody,
  audio: AudioReference,
): Promise<WakeWordDetectorDecision> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openWakeWordDetectTimeoutMs);

  try {
    const response = await fetch(`${openWakeWordDetectUrl}/v1/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wake_word: body.wake_word,
        threshold: openWakeWordThreshold,
        audio_url: audio.audio_url,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`Detector responded ${response.status}: ${bodyText}`);
    }

    const detectorBody = (await response.json().catch(() => null)) as WakeWordDetectorResponseBody | null;
    return {
      detected: Boolean(detectorBody?.data?.detected),
      confidence: detectorBody?.data?.confidence,
      matchedLabel: detectorBody?.data?.matched_label ?? null,
      targetLabel: detectorBody?.data?.target_label ?? null,
      threshold: detectorBody?.data?.threshold,
      scores: detectorBody?.data?.scores ?? {},
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new WakeWordValidationError(502, 'WAKE_WORD_DETECTOR_FAILED', `Wake-word detector failed: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

interface GatewayResponseBody {
  data?: {
    event_id?: string;
  };
}

async function forwardToGateway(payload: {
  channel: string;
  channel_message_id: string;
  chat_id: string;
  sender_identity_id: string;
  audio_url: string;
  audio_mime?: string;
  metadata: Record<string, unknown>;
}): Promise<{ event_id: string }> {
  const response = await fetch(`${gatewayUrl}/v1/events/audio`, {
    method: 'POST',
    headers: buildGatewayHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Gateway responded ${response.status}: ${bodyText}`);
  }

  const gatewayBody = (await response.json().catch(() => null)) as GatewayResponseBody | null;
  return {
    event_id: gatewayBody?.data?.event_id ?? uuidv7(),
  };
}

function buildGatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (adapterToken) {
    headers['X-SVEN-ADAPTER-TOKEN'] = adapterToken;
  }

  return headers;
}

async function storeWakeWordEvent(
  detectionId: string,
  body: WakeWordRequestBody,
  audio: AudioReference,
  metadata: Record<string, unknown>,
  channelMessageId: string,
  messageId: string,
  confidence: number | null | undefined,
) {
  try {
    await pool.query(
      `INSERT INTO wake_word_events (id, chat_id, channel, channel_message_id, sender_identity_id, message_id, audio_url, audio_mime, detection_confidence, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        detectionId,
        body.chat_id,
        body.channel,
        channelMessageId,
        body.sender_identity_id,
        messageId,
        audio.audio_url,
        audio.audio_mime,
        confidence ?? null,
        JSON.stringify(metadata || {}),
      ],
    );
  } catch (err) {
    logger.error('Failed to persist wake-word event', { error: String(err) });
  }
}

async function publishWakeWordEvent(
  detectionId: string,
  body: WakeWordRequestBody,
  audio: AudioReference,
  metadata: Record<string, unknown>,
  channelMessageId: string,
  messageId: string,
  confidence: number | null | undefined,
) {
  if (!nc) {
    logger.warn('NATS connection unavailable; skipping wake-word event publish');
    return;
  }

  const envelope: EventEnvelope<WakeWordDetectionEvent> = {
    schema_version: '1.0',
    event_id: detectionId,
    occurred_at: new Date().toISOString(),
    data: {
      chat_id: body.chat_id,
      channel: body.channel,
      channel_message_id: channelMessageId,
      sender_identity_id: body.sender_identity_id,
      message_id: messageId,
      audio_url: audio.audio_url,
      audio_mime: audio.audio_mime,
      wake_word: body.wake_word,
      confidence: confidence ?? undefined,
      language: body.language,
      mode: body.mode,
      metadata,
    },
  };

  nc.publish(NATS_SUBJECTS.WAKE_WORD_DETECTED, jc.encode(envelope));
}

async function connectNats() {
  nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
  logger.info('Connected to NATS for wake-word detection');
}

function startStorageCleaner() {
  const intervalMs = Math.max(retentionDays, 1) * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const files = await fs.readdir(storageDir);
      const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      await Promise.all(
        files.map(async (file) => {
          const path = join(storageDir, file);
          try {
            const stats = await fs.stat(path);
            if (stats.mtimeMs < threshold) {
              await fs.rm(path);
            }
          } catch (err) {
            logger.debug('Unable to clean wake-word audio file', { file, error: String(err) });
          }
        }),
      );
    } catch (err) {
      logger.error('Wake-word storage cleaner failed', { error: String(err) });
    }
  }, intervalMs);
}

async function shutdown() {
  logger.info('Shutting down wake-word service');
  await Promise.all([pool.end(), nc?.close() ?? Promise.resolve()]);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
