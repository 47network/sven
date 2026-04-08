import fastify from 'fastify';
import { join, resolve, basename, extname } from 'node:path';
import { promises as fs } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import { ensureStreams } from '@sven/shared/nats/streams.js';
import { connect, consumerOpts, createInbox, JSONCodec, NatsConnection } from 'nats';
import pg from 'pg';
import { fetch } from 'undici';
import { v7 as uuidv7 } from 'uuid';
import type { CanvasBlock, EventEnvelope, OutboxEnqueueEvent } from '@sven/shared';

const logger = createLogger('piper-tts');
const jc = JSONCodec();

const storageDir = process.env.VOICE_TTS_STORAGE
  ? resolve(process.env.VOICE_TTS_STORAGE)
  : join(process.cwd(), 'storage');
const serverPort = Number(process.env.VOICE_TTS_PORT || 4200);
const baseUrl = process.env.VOICE_TTS_BASE_URL || `http://piper:${serverPort}`;
const piperUrl = process.env.PIPER_URL || 'http://piper:59125/api/tts';
const piperVoiceName = process.env.PIPER_VOICE || 'alloy';
const piperApiKey = process.env.PIPER_API_KEY;
const defaultProvider = (process.env.VOICE_TTS_PROVIDER || 'piper').toLowerCase();
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || '';
const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || '';
const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const elevenLabsPricePer1kChars = Number(process.env.ELEVENLABS_PRICE_PER_1K_CHARS || 0);
const openAiApiKey = process.env.OPENAI_API_KEY || '';
const openAiTtsModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const openAiTtsVoice = process.env.OPENAI_TTS_VOICE || 'alloy';
const openAiPricePer1kChars = Number(process.env.OPENAI_TTS_PRICE_PER_1K_CHARS || 0);
const ttsSigningSecret = String(process.env.VOICE_TTS_SIGNING_SECRET || '').trim();
const ttsSignedUrlTtlSeconds = Number(process.env.VOICE_TTS_SIGNED_URL_TTL_SECONDS || 900);
const ttsRetryDelayMs = Number(process.env.VOICE_TTS_RETRY_DELAY_MS || 5000);
const ttsMaxDeliver = Number(process.env.VOICE_TTS_MAX_DELIVER || 10);
const allowedChannels = new Set(
  (process.env.VOICE_TTS_CHANNELS || 'discord,slack,telegram,teams,google_chat,whatsapp,signal,imessage,webchat')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const retentionDays = Number(process.env.VOICE_TTS_RETENTION_DAYS || 7);
const maxChars = Number(process.env.VOICE_TTS_MAX_CHARS || 1200);

async function main() {
  if (!ttsSigningSecret) {
    throw new Error('VOICE_TTS_SIGNING_SECRET is required');
  }

  await fs.mkdir(storageDir, { recursive: true });

  const app = fastify({ logger: false });
  app.get('/tts/:file', async (request, reply) => {
    const params = request.params as { file?: string };
    const query = request.query as { expires?: string | number; sig?: string };

    const requestedFile = String(params.file || '').trim();
    const safeFile = basename(requestedFile);
    if (!safeFile || safeFile !== requestedFile || safeFile.includes('/') || safeFile.includes('\\')) {
      reply.code(400).send({ success: false, error: { code: 'INVALID_FILE', message: 'Invalid audio file path' } });
      return;
    }

    const expiresRaw = String(query.expires || '').trim();
    const sig = String(query.sig || '').trim();
    const expires = Number(expiresRaw);
    if (!sig || !Number.isFinite(expires) || expires <= 0) {
      reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing audio signature' } });
      return;
    }

    if (Math.floor(Date.now() / 1000) > expires) {
      reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Audio signature expired' } });
      return;
    }

    const expectedSig = signAudioUrl(safeFile, expires);
    const provided = Buffer.from(sig, 'utf8');
    const expected = Buffer.from(expectedSig, 'utf8');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid audio signature' } });
      return;
    }

    const filePath = join(storageDir, safeFile);
    let audio: Buffer;
    try {
      audio = await fs.readFile(filePath);
    } catch {
      reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Audio file not found' } });
      return;
    }

    const extension = extname(safeFile).toLowerCase();
    const contentType = extension === '.mp3' ? 'audio/mpeg' : 'audio/wav';
    reply.header('Content-Type', contentType).send(audio);
  });
  app.get('/healthz', async () => ({ success: true }));
  await app.listen({ port: serverPort, host: '0.0.0.0' });
  logger.info('Piper TTS server listening', { port: serverPort });

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
  logger.info('Connected to Postgres and NATS for TTS');

  await ensureStreams(nc);

  startStorageCleaner(pool);
  await startOutboxListener(nc, pool);
}

async function startOutboxListener(nc: NatsConnection, pool: pg.Pool) {
  const js = nc.jetstream();
  const opts = consumerOpts();
  opts.durable('piper-tts');
  opts.manualAck();
  opts.ackExplicit();
  opts.maxDeliver(Math.max(1, ttsMaxDeliver));
  opts.deliverTo(createInbox());

  const sub = await js.subscribe(NATS_SUBJECTS.TTS_OUTBOX_ENQUEUE, opts);
  logger.info('Subscribed to outbox enqueue for TTS');

  for await (const msg of sub) {
    try {
      const envelope = jc.decode(msg.data) as EventEnvelope<OutboxEnqueueEvent>;
      const data = envelope.data;
      validateTtsEvent(data);

      if (data.content_type === 'audio') {
        msg.ack();
        continue;
      }

      if (!allowedChannels.has(data.channel)) {
        msg.ack();
        continue;
      }

      const gamingMode = await isGamingMode(pool);
      if (gamingMode) {
        logger.warn('Gaming mode active; skipping TTS', { chat_id: data.chat_id });
        msg.ack();
        continue;
      }

      const text = extractText(data);
      if (!text) {
        msg.ack();
        continue;
      }

      const safeText = text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
      const synthesis = await synthesizeSpeech(pool, safeText, data.channel);
      const fileName = `${uuidv7()}.${synthesis.format}`;
      const filePath = join(storageDir, fileName);
      await fs.writeFile(filePath, synthesis.buffer);
      const audioUrl = createSignedAudioUrl(fileName);

      await publishAudioOutbox(nc, data, audioUrl);
      await recordTtsGeneration(
        pool,
        data.outbox_id,
        data.chat_id,
        data.channel,
        safeText,
        audioUrl,
        synthesis.provider,
        synthesis.voice,
        {
          format: synthesis.format,
          char_count: safeText.length,
          estimated_cost_usd: synthesis.estimatedCostUsd,
          fallback_used: synthesis.fallbackUsed,
        },
      );
      msg.ack();
    } catch (err) {
      if (err instanceof PermanentTtsError) {
        logger.warn('TTS worker dropped permanent-invalid event', { error: String(err.message || err) });
        msg.ack();
        continue;
      }
      logger.error('TTS worker failed; scheduling retry', { error: String(err) });
      msg.nak(Math.max(250, ttsRetryDelayMs));
    }
  }
}

class PermanentTtsError extends Error {}

function validateTtsEvent(data: OutboxEnqueueEvent): void {
  if (!data || typeof data !== 'object') {
    throw new PermanentTtsError('Invalid TTS event payload');
  }
  if (!String(data.outbox_id || '').trim()) {
    throw new PermanentTtsError('Missing outbox_id in TTS event');
  }
  if (!String(data.chat_id || '').trim()) {
    throw new PermanentTtsError('Missing chat_id in TTS event');
  }
  if (!String(data.channel || '').trim()) {
    throw new PermanentTtsError('Missing channel in TTS event');
  }
}

function extractText(data: OutboxEnqueueEvent): string {
  if (data.text && typeof data.text === 'string') {
    return data.text.trim();
  }
  if (data.blocks && Array.isArray(data.blocks)) {
    return data.blocks
      .map((block: CanvasBlock | string) => (typeof block === 'string' ? block : JSON.stringify(block)))
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

function signAudioUrl(fileName: string, expires: number): string {
  return createHmac('sha256', ttsSigningSecret)
    .update(`${fileName}:${expires}`)
    .digest('hex');
}

function createSignedAudioUrl(fileName: string): string {
  const expires = Math.floor(Date.now() / 1000) + Math.max(30, ttsSignedUrlTtlSeconds);
  const sig = signAudioUrl(fileName, expires);
  return `${baseUrl}/tts/${encodeURIComponent(fileName)}?expires=${expires}&sig=${sig}`;
}

type TtsProvider = 'piper' | 'elevenlabs' | 'openai';

async function synthesizeSpeech(
  pool: pg.Pool,
  text: string,
  channel: string,
): Promise<{ buffer: Buffer; provider: TtsProvider; voice: string; format: 'wav' | 'mp3'; estimatedCostUsd: number; fallbackUsed: boolean }> {
  const preferred = await resolveProviderForChannel(pool, channel);
  if (preferred === 'elevenlabs') {
    try {
      const result = await synthesizeElevenLabs(text);
      return { ...result, fallbackUsed: false };
    } catch (err) {
      logger.warn('ElevenLabs synthesis failed, falling back to Piper', { error: String(err) });
      const fallback = await synthesizePiper(text, piperVoiceName);
      return { ...fallback, fallbackUsed: true };
    }
  }
  if (preferred === 'openai') {
    try {
      const result = await synthesizeOpenAI(text);
      return { ...result, fallbackUsed: false };
    } catch (err) {
      logger.warn('OpenAI synthesis failed, falling back to Piper', { error: String(err) });
      const fallback = await synthesizePiper(text, piperVoiceName);
      return { ...fallback, fallbackUsed: true };
    }
  }
  const result = await synthesizePiper(text, piperVoiceName);
  return { ...result, fallbackUsed: false };
}

async function synthesizePiper(text: string, voice: string): Promise<{ buffer: Buffer; provider: TtsProvider; voice: string; format: 'wav'; estimatedCostUsd: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'audio/wav',
  };
  if (piperApiKey) {
    headers.Authorization = `Bearer ${piperApiKey}`;
  }
  const response = await fetch(piperUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, voice, format: 'wav' }),
  });
  if (!response.ok) {
    throw new Error(`Piper request failed: ${response.status}`);
  }
  const data = await response.arrayBuffer();
  return {
    buffer: Buffer.from(data),
    provider: 'piper',
    voice,
    format: 'wav',
    estimatedCostUsd: 0,
  };
}

async function synthesizeElevenLabs(text: string): Promise<{ buffer: Buffer; provider: TtsProvider; voice: string; format: 'mp3'; estimatedCostUsd: number }> {
  if (!elevenLabsApiKey || !elevenLabsVoiceId) {
    throw new Error('ElevenLabs not configured');
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoiceId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      'xi-api-key': elevenLabsApiKey,
    },
    body: JSON.stringify({
      text,
      model_id: elevenLabsModelId,
      output_format: 'mp3_44100_128',
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ElevenLabs request failed: ${response.status} ${errText}`);
  }
  const data = await response.arrayBuffer();
  const estimatedCostUsd = elevenLabsPricePer1kChars > 0
    ? (text.length / 1000) * elevenLabsPricePer1kChars
    : 0;
  return {
    buffer: Buffer.from(data),
    provider: 'elevenlabs',
    voice: elevenLabsVoiceId,
    format: 'mp3',
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
  };
}

async function synthesizeOpenAI(text: string): Promise<{ buffer: Buffer; provider: TtsProvider; voice: string; format: 'mp3'; estimatedCostUsd: number }> {
  if (!openAiApiKey) {
    throw new Error('OpenAI TTS not configured');
  }
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model: openAiTtsModel,
      voice: openAiTtsVoice,
      input: text,
      format: 'mp3',
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS request failed: ${response.status} ${errText}`);
  }
  const data = await response.arrayBuffer();
  const estimatedCostUsd = openAiPricePer1kChars > 0
    ? (text.length / 1000) * openAiPricePer1kChars
    : 0;
  return {
    buffer: Buffer.from(data),
    provider: 'openai',
    voice: openAiTtsVoice,
    format: 'mp3',
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
  };
}

async function resolveProviderForChannel(pool: pg.Pool, channel: string): Promise<TtsProvider> {
  const mapRes = await pool.query(
    `SELECT value
     FROM settings_global
     WHERE key = 'voice.tts.channel_providers'
     LIMIT 1`,
  );
  if (mapRes.rows.length > 0) {
    const parsed = parseSettingValue(mapRes.rows[0].value);
    if (parsed && typeof parsed === 'object') {
      const provider = String((parsed as Record<string, unknown>)[channel] || '').toLowerCase();
      if (provider === 'piper' || provider === 'elevenlabs' || provider === 'openai') {
        return provider;
      }
    }
  }

  if (defaultProvider === 'elevenlabs') return 'elevenlabs';
  if (defaultProvider === 'openai') return 'openai';
  return 'piper';
}

async function publishAudioOutbox(nc: NatsConnection, data: OutboxEnqueueEvent, audioUrl: string): Promise<void> {
  const envelope: EventEnvelope<OutboxEnqueueEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data: {
      ...data,
      content_type: 'audio',
      audio_url: audioUrl,
      idempotency_key: `${data.idempotency_key || data.outbox_id || uuidv7()}:tts`,
      text: data.text,
    },
  };
  nc.publish(NATS_SUBJECTS.OUTBOX_ENQUEUE, jc.encode(envelope));
}

async function recordTtsGeneration(
  pool: pg.Pool,
  outboxId: string,
  chatId: string,
  channel: string,
  text: string,
  audioUrl: string,
  provider: TtsProvider,
  voice: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO voice_tts_generated (outbox_id, chat_id, channel, text, audio_url, provider, voice, metadata, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + interval '7 days' * $9)`,
      [outboxId, chatId, channel, text, audioUrl, provider, voice, JSON.stringify(metadata), retentionDays],
    );
  } catch (err) {
    logger.warn('Failed to record TTS generation', { error: String(err) });
  }
}

async function isGamingMode(pool: pg.Pool): Promise<boolean> {
  const res = await pool.query(
    `SELECT value FROM settings_global WHERE key = 'performance.gaming_mode'`
  );
  if (res.rows.length === 0) return false;
  const parsed = parseSettingValue(res.rows[0].value);
  return parsed === true || parsed === 'true' || parsed === 1 || parsed === '1';
}

function parseSettingValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function startStorageCleaner(pool: pg.Pool): void {
  const intervalMs = Math.max(30, retentionDays) * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const files = await fs.readdir(storageDir);
      const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      await Promise.all(
        files.map(async (file) => {
          const fullPath = join(storageDir, file);
          try {
            const stats = await fs.stat(fullPath);
            if (stats.mtimeMs < threshold) {
              await fs.rm(fullPath);
            }
          } catch (err) {
            logger.debug('Failed to clean audio file', { file, err: String(err) });
          }
        }),
      );
      // Also purge DB records
      await pool.query(
        `DELETE FROM voice_tts_generated WHERE retention_expires_at <= NOW()`
      );
      logger.debug('Purged expired TTS audio files');
    } catch (err) {
      logger.error('Failed to purge old TTS files', { err: String(err) });
    }
  }, intervalMs);
}

main().catch((err) => {
  logger.fatal('Piper TTS service failed', { err: String(err) });
  process.exit(1);
});
