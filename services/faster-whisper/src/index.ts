import { connect, consumerOpts, createInbox, JSONCodec, NatsConnection } from 'nats';
import pg from 'pg';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fetch } from 'undici';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import { ensureStreams } from '@sven/shared/nats/streams.js';
import type { AudioIngestEvent, EventEnvelope, InboundMessageEvent } from '@sven/shared';

const logger = createLogger('faster-whisper');
const jc = JSONCodec();

const retentionDays = Number(process.env.VOICE_TRANSCRIPT_RETENTION_DAYS || 30);
const modelPath = resolveModelPath();
const languageEnv = process.env.FASTER_WHISPER_LANGUAGE || 'auto';
const pythonBinary = process.env.FASTER_WHISPER_PYTHON || 'python3';
const pythonScript = new URL('../transcribe.py', import.meta.url).pathname;
const device = process.env.FASTER_WHISPER_DEVICE || 'cpu';
const envEmotionEnabled = String(process.env.VOICE_EMOTION_DETECTION_ENABLED || 'false').toLowerCase() === 'true';
const audioUrlAllowlist = (process.env.VOICE_AUDIO_URL_ALLOWLIST || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const maxAudioRedirects = Number(process.env.VOICE_AUDIO_MAX_REDIRECTS || 3);

function resolveModelPath(): string {
  const value = process.env.FASTER_WHISPER_MODEL_PATH;
  if (!value) {
    logger.fatal('FASTER_WHISPER_MODEL_PATH is required');
    process.exit(1);
  }
  return value;
}

let streamingNc: NatsConnection | null = null;

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
  streamingNc = nc;
  logger.info('Connected to Postgres and NATS');

  await ensureStreams(nc);

  startTranscriptCleaner(pool);

  const js = nc.jetstream();
  const opts = consumerOpts();
  opts.durable('faster-whisper');
  opts.manualAck();
  opts.ackExplicit();
  opts.deliverTo(createInbox());
  opts.filterSubject(NATS_SUBJECTS.AUDIO_INGEST);

  const sub = await js.subscribe(NATS_SUBJECTS.AUDIO_INGEST, opts);
  logger.info('Audio ingest consumer started');

  for await (const msg of sub) {
    let envelope: EventEnvelope<AudioIngestEvent> | null = null;
    try {
      envelope = jc.decode(msg.data) as EventEnvelope<AudioIngestEvent>;
      const event = envelope.data;
      logger.info('Audio ingest event', { event_id: envelope.event_id, channel: event.channel });

      const gamingMode = await isGamingMode(pool);
      if (gamingMode) {
        logger.warn('Gaming mode active; skipping transcription', { chat_id: event.chat_id });
        await publishInbound(event, '[Gaming mode: transcription skipped]');
        await msg.ack();
        continue;
      }

      const transcript = await handleTranscription(pool, event);
      await publishInbound(
        event,
        transcript.text,
        transcript.emotion || undefined,
        transcript.detectedLanguage || undefined,
        transcript.languageProbability,
      );
      await msg.ack();
    } catch (err) {
      logger.error('Failed to process audio ingest event', { error: String(err) });
      if (envelope) {
        await publishInbound(envelope.data, `[Transcription failed: ${String(err)}]`);
      }
      msg.ack();
    }
  }
}

async function handleTranscription(
  pool: pg.Pool,
  event: AudioIngestEvent,
): Promise<{
  text: string;
  emotion: EmotionSignal | null;
  detectedLanguage: string | null;
  languageProbability: number | null;
}> {
  const temp = await downloadAudio(event.audio_url);
  try {
    const autoDetectEnabled = await isMultiLanguageAutoDetectEnabled(pool);
    const requestedLanguage = String(event.metadata?.language || '').trim();
    const language = requestedLanguage || (autoDetectEnabled ? languageEnv : 'en');
    const { transcript, detectedLanguage, languageProbability } = await runPythonTranscription(temp, language);
    const cleaned = transcript.trim() || '[Audio received — no transcript produced]';
    const emotionEnabled = await isEmotionDetectionEnabled(pool);
    const emotion = emotionEnabled ? detectEmotionFromTranscript(cleaned) : null;
    const resolvedLanguage = String(detectedLanguage || language || '').trim() || null;
    const transcriptMetadata = {
      ...(event.metadata || {}),
      ...(resolvedLanguage ? { language_detected: resolvedLanguage } : {}),
      ...(Number.isFinite(languageProbability) ? { language_probability: languageProbability } : {}),
      ...(emotion ? { emotion } : {}),
    };
    await pool.query('UPDATE messages SET text = $1 WHERE id = $2', [cleaned, event.message_id]);
    await pool.query(
      `INSERT INTO voice_transcripts (message_id, chat_id, transcript, provider, language, metadata, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.message_id,
        event.chat_id,
        cleaned,
        'faster-whisper',
        resolvedLanguage,
        JSON.stringify(transcriptMetadata),
        new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
      ],
    );
    if (emotion) {
      try {
        await pool.query(
          `INSERT INTO voice_emotion_signals
             (id, organization_id, chat_id, message_id, sender_identity_id, emotion_label, confidence, provider, metadata, created_at)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, 'heuristic', $8::jsonb, NOW())`,
          [
            randomUUID(),
            event.metadata?.organization_id ? String(event.metadata.organization_id) : null,
            event.chat_id,
            event.message_id,
            event.sender_identity_id,
            emotion.label,
            emotion.confidence,
            JSON.stringify({ scores: emotion.scores }),
          ],
        );
      } catch (err) {
        logger.warn('Failed to persist voice emotion signal', { err: String(err) });
      }
    }
    return {
      text: cleaned,
      emotion,
      detectedLanguage: resolvedLanguage,
      languageProbability: Number.isFinite(languageProbability) ? Number(languageProbability) : null,
    };
  } finally {
    await unlink(temp).catch(() => {});
  }
}

async function publishInbound(
  event: AudioIngestEvent,
  text: string,
  emotion?: EmotionSignal,
  detectedLanguage?: string,
  languageProbability?: number | null,
): Promise<void> {
  const envelope: EventEnvelope<InboundMessageEvent> = {
    schema_version: '1.0',
    event_id: event.message_id,
    occurred_at: new Date().toISOString(),
    data: {
      channel: event.channel,
      channel_message_id: event.channel_message_id,
      chat_id: event.chat_id,
      sender_identity_id: event.sender_identity_id,
      content_type: 'audio',
      text,
      audio_url: event.audio_url,
      metadata: {
        ...(event.metadata || {}),
        ...(detectedLanguage ? { language_detected: detectedLanguage } : {}),
        ...(Number.isFinite(Number(languageProbability)) ? { language_probability: Number(languageProbability) } : {}),
        ...(emotion ? { emotion } : {}),
        transcribed_by: 'faster-whisper',
      },
    },
  };
  if (!streamingNc) {
    throw new Error('NATS connection is not initialized');
  }
  streamingNc.publish(NATS_SUBJECTS.inboundMessage(event.channel), jc.encode(envelope));
}

type EmotionLabel = 'neutral' | 'calm' | 'happy' | 'sad' | 'angry' | 'frustrated' | 'urgent';

type EmotionSignal = {
  label: EmotionLabel;
  confidence: number;
  scores: Record<EmotionLabel, number>;
};

function detectEmotionFromTranscript(text: string): EmotionSignal | null {
  const normalized = String(text || '').toLowerCase().trim();
  if (!normalized || normalized.startsWith('[')) return null;

  const scores: Record<EmotionLabel, number> = {
    neutral: 0.2,
    calm: 0.2,
    happy: 0,
    sad: 0,
    angry: 0,
    frustrated: 0,
    urgent: 0,
  };

  const addIf = (patterns: RegExp[], label: EmotionLabel, delta: number) => {
    for (const p of patterns) {
      if (p.test(normalized)) scores[label] += delta;
    }
  };

  addIf([/\b(thanks|thank you|great|awesome|amazing|perfect)\b/g], 'happy', 0.35);
  addIf([/\b(sorry|sad|upset|tired|exhausted|down)\b/g], 'sad', 0.35);
  addIf([/\b(angry|mad|furious|hate|annoyed)\b/g], 'angry', 0.4);
  addIf([/\b(stuck|frustrated|again|broken|doesn.?t work|not working)\b/g], 'frustrated', 0.35);
  addIf([/\b(asap|urgent|immediately|right now|quickly)\b/g], 'urgent', 0.4);
  addIf([/\b(relax|calm|no rush|whenever)\b/g], 'calm', 0.3);

  const exclamations = (normalized.match(/!/g) || []).length;
  if (exclamations >= 2) {
    scores.urgent += 0.2;
    scores.frustrated += 0.1;
  }

  const sorted = (Object.keys(scores) as EmotionLabel[])
    .map((label) => ({ label, score: scores[label] }))
    .sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  if (!top || !second) return null;
  const confidence = Math.max(0, Math.min(1, top.score - second.score + 0.35));
  return { label: top.label, confidence, scores };
}

async function isEmotionDetectionEnabled(pool: pg.Pool): Promise<boolean> {
  if (envEmotionEnabled) return true;
  try {
    const res = await pool.query(
      `SELECT value
       FROM settings_global
       WHERE key = 'voice.emotionDetection.enabled'
       LIMIT 1`,
    );
    if (!res.rows.length) return false;
    const parsed = parseSettingValue(res.rows[0].value);
    return parsed === true || parsed === 'true' || parsed === 1 || parsed === '1';
  } catch {
    return false;
  }
}

async function isMultiLanguageAutoDetectEnabled(pool: pg.Pool): Promise<boolean> {
  const env = process.env.VOICE_MULTI_LANGUAGE_AUTODETECT;
  if (typeof env === 'string' && env.trim() !== '') {
    const v = env.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  }
  try {
    const res = await pool.query(
      `SELECT value
       FROM settings_global
       WHERE key = 'voice.multiLanguage.autoDetect'
       LIMIT 1`,
    );
    if (!res.rows.length) return true;
    const parsed = parseSettingValue(res.rows[0].value);
    return parsed === true || parsed === 'true' || parsed === 1 || parsed === '1';
  } catch {
    return true;
  }
}

async function downloadAudio(url: string): Promise<string> {
  const safeInitialUrl = await validateExternalAudioUrl(url);
  const response = await fetchWithSafeRedirects(safeInitialUrl, Math.max(0, maxAudioRedirects));
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Audio response contained no body');
  }
  const extension = getExtension(url) || '.bin';
  const tempPath = join(tmpdir(), `audio-${randomUUID()}${extension}`);
  const stream = createWriteStream(tempPath);
  const nodeStream = Readable.fromWeb(response.body);
  await pipeline(nodeStream, stream);
  return tempPath;
}

function isBlockedAudioHostname(hostnameRaw: string): boolean {
  const hostname = String(hostnameRaw || '').trim().toLowerCase();
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === 'metadata.google.internal') return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  return false;
}

function isBlockedAudioIp(ipRaw: string): boolean {
  const ip = String(ipRaw || '').trim().toLowerCase();
  if (!ip) return true;
  const family = isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map((part) => Number(part));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (family === 6) {
    if (ip === '::1') return true;
    if (ip.startsWith('fe80:')) return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
    return false;
  }
  return false;
}

function isAllowlistedAudioHost(hostnameRaw: string): boolean {
  if (audioUrlAllowlist.length === 0) return true;
  const hostname = String(hostnameRaw || '').trim().toLowerCase();
  if (!hostname) return false;
  return audioUrlAllowlist.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

async function validateExternalAudioUrl(urlRaw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(String(urlRaw || '').trim());
  } catch {
    throw new Error('audio_url must be a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('audio_url must use http/https scheme');
  }
  if (parsed.username || parsed.password) {
    throw new Error('audio_url must not include userinfo');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isAllowlistedAudioHost(hostname)) {
    throw new Error('audio_url host is not allowlisted');
  }
  if (isBlockedAudioHostname(hostname) || isBlockedAudioIp(hostname)) {
    throw new Error('audio_url host is blocked');
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (resolved.length === 0) {
    throw new Error('audio_url host resolution failed');
  }
  if (resolved.some((entry) => isBlockedAudioIp(entry.address))) {
    throw new Error('audio_url resolves to blocked address');
  }
  return parsed;
}

async function fetchWithSafeRedirects(initialUrl: URL, maxRedirectsAllowed: number): Promise<Response> {
  let current = initialUrl;
  let redirects = 0;
  for (;;) {
    const response = await fetch(current, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (!location || ![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    redirects += 1;
    if (redirects > maxRedirectsAllowed) {
      throw new Error('audio_url redirect limit exceeded');
    }
    const next = new URL(location, current);
    current = await validateExternalAudioUrl(next.toString());
  }
}

function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const idx = pathname.lastIndexOf('.');
    if (idx !== -1) return pathname.slice(idx);
  } catch (err) {
    logger.warn('Failed to guess audio extension', { err: String(err) });
  }
  return '';
}

async function runPythonTranscription(filePath: string, language: string) {
  const args = [
    pythonScript,
    '--model',
    modelPath,
    '--input',
    filePath,
    '--language',
    language,
    '--device',
    device,
  ];

  const child = spawn(pythonBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';

  if (!child.stdout || !child.stderr) {
    throw new Error('Transcription process streams unavailable');
  }

  const stdoutStream = child.stdout;
  const stderrStream = child.stderr;

  stdoutStream.setEncoding('utf8');
  stdoutStream.on('data', (chunk: string) => { stdout += chunk; });
  stderrStream.setEncoding('utf8');
  stderrStream.on('data', (chunk: string) => { stderr += chunk; });

  await once(child, 'exit');
  const exitCode = child.exitCode ?? 0;
  if (exitCode !== 0) {
    throw new Error(`Transcription failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  if (stderr.trim()) {
    logger.debug('Python transcription stderr', { stderr });
  }

  if (!stdout.trim()) {
    throw new Error('Transcription produced no output');
  }

  try {
    const parsed = JSON.parse(stdout);
    return {
      transcript: String(parsed.transcript || ''),
      detectedLanguage: parsed.detected_language ? String(parsed.detected_language) : null,
      languageProbability: Number.isFinite(Number(parsed.language_probability))
        ? Number(parsed.language_probability)
        : null,
      details: parsed,
    };
  } catch (err) {
    throw new Error(`Unable to parse transcription output: ${String(err)}`);
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

function startTranscriptCleaner(pool: pg.Pool): void {
  const interval = Math.max(60, retentionDays) * 60 * 1000; // at least hourly
  setInterval(async () => {
    try {
      await pool.query(
        `DELETE FROM voice_transcripts WHERE retention_expires_at <= NOW()`
      );
      logger.debug('Purged expired voice transcripts');
    } catch (err) {
      logger.error('Failed to purge voice transcripts', { err: String(err) });
    }
  }, interval);
}

main().catch((err) => {
  logger.fatal('Faster-Whisper worker failed', { err: String(err) });
  process.exit(1);
});
