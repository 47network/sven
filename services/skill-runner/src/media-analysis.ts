import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import type pg from 'pg';
import { validateNasPath } from '@sven/shared/integrations/nas.js';

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.opus']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);

export const DEFAULT_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_FRAME_INTERVAL_SEC = 10;
const DEFAULT_MAX_FRAMES = 5;
const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 300000;
const DEFAULT_KEYFRAME_TIMEOUT_MS = 120000;
const DEFAULT_MEDIA_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_MEDIA_OPENAI_TIMEOUT_MS = 20000;
const MIN_MEDIA_SUBPROCESS_TIMEOUT_MS = 1000;
const MAX_MEDIA_SUBPROCESS_TIMEOUT_MS = 900000;
const MIN_MEDIA_HTTP_TIMEOUT_MS = 500;
const MAX_MEDIA_HTTP_TIMEOUT_MS = 120000;

export type MediaAnalysisDeps = {
  fetch: typeof fetch;
  spawnSync: typeof spawnSync;
  stat: typeof fs.stat;
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  mkdtemp: typeof fs.mkdtemp;
  rm: typeof fs.rm;
  unlink: typeof fs.unlink;
  readdir: typeof fs.readdir;
  tmpdir: () => string;
  getWebAllowlist: (pool: pg.Pool, chatId?: string) => Promise<string[]>;
  transcribeAudio: (filePath: string, language?: string) => Promise<string>;
  summarizeTranscript: (text: string) => Promise<{ summary: string; topics: string[] }>;
  describeImage: (imagePath: string) => Promise<string>;
  extractKeyFrames: (videoPath: string, outDir: string, intervalSec: number, maxFrames: number) => Promise<string[]>;
};

type MediaResolveResult = {
  filePath: string;
  source: string;
  sizeBytes: number;
  tempFile: boolean;
  tempDir?: string | null;
};

function isSpawnTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as NodeJS.ErrnoException).code === 'ETIMEDOUT';
}

function isFetchTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = String((err as { name?: unknown }).name || '').toLowerCase();
  const code = String((err as { code?: unknown }).code || '').toLowerCase();
  const message = String((err as { message?: unknown }).message || '').toLowerCase();
  return name.includes('timeout') || code.includes('aborted') || message.includes('timed out') || message.includes('abort');
}

export function resolveMediaSubprocessTimeoutMs(
  rawValue: string | undefined,
  envName: string,
  defaultValueMs: number,
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return defaultValueMs;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${envName} must be a finite number`);
  }
  const normalized = Math.trunc(parsed);
  if (normalized < MIN_MEDIA_SUBPROCESS_TIMEOUT_MS) return MIN_MEDIA_SUBPROCESS_TIMEOUT_MS;
  if (normalized > MAX_MEDIA_SUBPROCESS_TIMEOUT_MS) return MAX_MEDIA_SUBPROCESS_TIMEOUT_MS;
  return normalized;
}

export function resolveMediaHttpTimeoutMs(
  rawValue: string | undefined,
  envName: string,
  defaultValueMs: number,
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return defaultValueMs;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${envName} must be a finite number`);
  }
  const normalized = Math.trunc(parsed);
  if (normalized < MIN_MEDIA_HTTP_TIMEOUT_MS) return MIN_MEDIA_HTTP_TIMEOUT_MS;
  if (normalized > MAX_MEDIA_HTTP_TIMEOUT_MS) return MAX_MEDIA_HTTP_TIMEOUT_MS;
  return normalized;
}

async function fetchWithDeadline(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutContext: string,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isFetchTimeoutError(err)) {
      throw new Error(`${timeoutContext} timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

export async function readResponseBufferWithinLimit(res: Response, maxBytes: number): Promise<Buffer> {
  if (res.body) {
    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.length;
        if (total > maxBytes) {
          try {
            await reader.cancel('max_bytes exceeded');
          } catch {
            // Best effort cancellation for oversized response streams.
          }
          throw new Error(`Remote file exceeds size limit (${total} > ${maxBytes})`);
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks, total);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`Remote file exceeds size limit (${buffer.length} > ${maxBytes})`);
  }
  return buffer;
}

export async function extractKeyFramesWithFfmpeg(
  spawnSyncImpl: typeof spawnSync,
  readdirImpl: typeof fs.readdir,
  videoPath: string,
  outDir: string,
  intervalSec: number,
  maxFrames: number,
): Promise<string[]> {
  const safeInterval = Number.isFinite(intervalSec) && intervalSec > 0 ? intervalSec : DEFAULT_FRAME_INTERVAL_SEC;
  const safeMaxFrames = Number.isFinite(maxFrames) && maxFrames > 0 ? maxFrames : DEFAULT_MAX_FRAMES;
  const outputPattern = path.join(outDir, 'frame-%03d.jpg');
  const keyframeTimeoutMs = resolveMediaSubprocessTimeoutMs(
    process.env.MEDIA_ANALYSIS_KEYFRAME_TIMEOUT_MS,
    'MEDIA_ANALYSIS_KEYFRAME_TIMEOUT_MS',
    DEFAULT_KEYFRAME_TIMEOUT_MS,
  );
  const args = [
    '-i',
    videoPath,
    '-vf',
    `fps=1/${safeInterval}`,
    '-frames:v',
    String(safeMaxFrames),
    outputPattern,
  ];
  const proc = spawnSyncImpl('ffmpeg', args, {
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: keyframeTimeoutMs,
  });
  if (isSpawnTimeoutError(proc.error)) {
    throw new Error(`ffmpeg keyframe extraction timed out after ${keyframeTimeoutMs}ms`);
  }
  if (proc.status !== 0) {
    throw new Error(`ffmpeg failed: ${String(proc.stderr || '').trim()}`);
  }
  const entries = await readdirImpl(outDir);
  return entries
    .filter((entry) => entry.toLowerCase().endsWith('.jpg'))
    .map((entry) => path.join(outDir, entry));
}

function resolveMaxBytes(input: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (input === undefined || input === null || input === '') {
    return { ok: true, value: DEFAULT_MEDIA_MAX_BYTES };
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'inputs.max_bytes must be a finite number' };
  }
  if (parsed <= 0) {
    return { ok: false, error: 'inputs.max_bytes must be greater than 0' };
  }
  return { ok: true, value: Math.min(parsed, DEFAULT_MEDIA_MAX_BYTES) };
}

const defaultDeps: MediaAnalysisDeps = {
  fetch,
  spawnSync,
  stat: fs.stat,
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  mkdtemp: fs.mkdtemp,
  rm: fs.rm,
  unlink: fs.unlink,
  readdir: fs.readdir,
  tmpdir: () => os.tmpdir(),
  getWebAllowlist: async (pool: pg.Pool, chatId?: string) => {
    let orgId: string | null = null;
    if (chatId) {
      const orgRes = await pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [chatId]);
      orgId = String(orgRes.rows[0]?.organization_id || '').trim() || null;
    }
    const res = await pool.query(
      `SELECT pattern
       FROM allowlists
       WHERE (organization_id = $1 OR organization_id IS NULL)
         AND type = 'web_domain'
         AND enabled = TRUE`,
      [orgId],
    );
    return res.rows.map((row: any) => String(row.pattern || '')).filter(Boolean);
  },
  transcribeAudio: async (filePath: string, language?: string) => {
    const modelPath = process.env.FASTER_WHISPER_MODEL_PATH;
    const pythonBinary = process.env.FASTER_WHISPER_PYTHON || 'python3';
    const scriptPath = process.env.FASTER_WHISPER_SCRIPT
      || path.resolve(process.cwd(), 'services', 'faster-whisper', 'transcribe.py');

    if (!modelPath) {
      throw new Error('FASTER_WHISPER_MODEL_PATH not configured');
    }

    try {
      await fs.stat(scriptPath);
    } catch {
      throw new Error(`Faster-whisper script not found at ${scriptPath}`);
    }

    const args = [
      scriptPath,
      '--model',
      modelPath,
      '--input',
      filePath,
      '--language',
      language || 'auto',
      '--device',
      process.env.FASTER_WHISPER_DEVICE || 'cpu',
    ];

    const transcribeTimeoutMs = resolveMediaSubprocessTimeoutMs(
      process.env.MEDIA_ANALYSIS_TRANSCRIBE_TIMEOUT_MS,
      'MEDIA_ANALYSIS_TRANSCRIBE_TIMEOUT_MS',
      DEFAULT_TRANSCRIBE_TIMEOUT_MS,
    );
    const proc = spawnSync(pythonBinary, args, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: transcribeTimeoutMs,
    });

    if (isSpawnTimeoutError(proc.error)) {
      throw new Error(`Transcription timed out after ${transcribeTimeoutMs}ms`);
    }
    if (proc.status !== 0) {
      throw new Error(`Transcription failed (${proc.status}): ${String(proc.stderr || '').trim()}`);
    }

    const raw = String(proc.stdout || '').trim();
    if (!raw) {
      throw new Error('Transcription produced no output');
    }

    try {
      const parsed = JSON.parse(raw);
      return String(parsed.transcript || '').trim();
    } catch (err) {
      throw new Error(`Failed to parse transcription output: ${String(err)}`);
    }
  },
  summarizeTranscript: async (text: string) => {
    if (!text) return { summary: '', topics: [] };
    const apiKey = process.env.OPENAI_API_KEY || '';
    const model = process.env.MEDIA_ANALYSIS_TEXT_MODEL || 'gpt-4o-mini';
    if (!apiKey) {
      return { summary: text.slice(0, 280), topics: [] };
    }

    const payload = {
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Summarize the transcript and return JSON with keys summary (string) and topics (array of strings).',
        },
        { role: 'user', content: text.slice(0, 12000) },
      ],
    };

    const openAiTimeoutMs = resolveMediaHttpTimeoutMs(
      process.env.MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS,
      'MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS',
      DEFAULT_MEDIA_OPENAI_TIMEOUT_MS,
    );
    let res: Response;
    try {
      res = await fetchWithDeadline(
        fetch,
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(payload),
        },
        openAiTimeoutMs,
        'OpenAI summarize request',
      );
    } catch (err) {
      if (isFetchTimeoutError(err) || String(err).toLowerCase().includes('timed out')) {
        return { summary: text.slice(0, 280), topics: [] };
      }
      return { summary: text.slice(0, 280), topics: [] };
    }

    if (!res.ok) {
      return { summary: text.slice(0, 280), topics: [] };
    }

    const data = await res.json() as any;
    const content = String(data?.choices?.[0]?.message?.content || '');
    try {
      const parsed = JSON.parse(content);
      return {
        summary: String(parsed.summary || '').trim(),
        topics: Array.isArray(parsed.topics) ? parsed.topics.map((t: any) => String(t)) : [],
      };
    } catch {
      return { summary: content.trim(), topics: [] };
    }
  },
  describeImage: async (imagePath: string) => {
    const apiKey = process.env.OPENAI_API_KEY || '';
    const model = process.env.MEDIA_ANALYSIS_VISION_MODEL || 'gpt-4o-mini';
    if (!apiKey) {
      return 'Image analysis not configured';
    }

    const buffer = await fs.readFile(imagePath);
    const base64 = buffer.toString('base64');
    const payload = {
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe the image in one or two sentences.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
    };

    const openAiTimeoutMs = resolveMediaHttpTimeoutMs(
      process.env.MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS,
      'MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS',
      DEFAULT_MEDIA_OPENAI_TIMEOUT_MS,
    );
    const res = await fetchWithDeadline(
      fetch,
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      },
      openAiTimeoutMs,
      'OpenAI vision request',
    );

    if (!res.ok) {
      throw new Error(`Vision model request failed (${res.status})`);
    }

    const data = await res.json() as any;
    return String(data?.choices?.[0]?.message?.content || '').trim();
  },
  extractKeyFrames: async (videoPath: string, outDir: string, intervalSec: number, maxFrames: number) => extractKeyFramesWithFfmpeg(
    spawnSync,
    fs.readdir,
    videoPath,
    outDir,
    intervalSec,
    maxFrames,
  ),
};

function inferMediaType(filePath: string, explicit?: string): 'audio' | 'video' | 'image' | null {
  const raw = (explicit || '').toLowerCase();
  if (raw === 'audio' || raw === 'video' || raw === 'image') return raw;
  const ext = path.extname(filePath).toLowerCase();
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (IMAGE_EXT.has(ext)) return 'image';
  return null;
}

function isDomainAllowed(url: URL, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  const host = url.hostname.toLowerCase();
  if (net.isIP(host) !== 0) return false;
  return allowlist.some((pattern) => {
    const normalized = pattern.toLowerCase().trim();
    if (!normalized) return false;
    if (normalized === host) return true;
    if (normalized.startsWith('*.')) {
      const suffix = normalized.slice(1);
      return host.endsWith(suffix);
    }
    return false;
  });
}

async function resolveMediaInput(
  inputs: Record<string, unknown>,
  pool: pg.Pool,
  deps: MediaAnalysisDeps,
): Promise<MediaResolveResult> {
  const maxBytesResolved = resolveMaxBytes(inputs.max_bytes);
  if (!maxBytesResolved.ok) {
    throw new Error(maxBytesResolved.error);
  }
  const maxBytes = maxBytesResolved.value;

  const inputPath = typeof inputs.path === 'string' ? inputs.path : '';
  const inputUrl = typeof inputs.url === 'string' ? inputs.url : '';

  if (inputPath) {
    const validation = validateNasPath(inputPath, inputs.user_id as string, false);
    if (!validation.valid) {
      throw new Error(validation.error || 'Path not allowed');
    }
    const stats = await deps.stat(inputPath);
    if (stats.size > maxBytes) {
      throw new Error(`File exceeds size limit (${stats.size} > ${maxBytes})`);
    }
    return { filePath: inputPath, source: inputPath, sizeBytes: stats.size, tempFile: false, tempDir: null };
  }

  if (inputUrl) {
    const url = new URL(inputUrl);
    const chatId = typeof inputs.chat_id === 'string' ? inputs.chat_id.trim() : '';
    const allowlist = await deps.getWebAllowlist(pool, chatId || undefined);
    if (!isDomainAllowed(url, allowlist)) {
      throw new Error(`URL domain not allowlisted: ${url.hostname}`);
    }

    const fetchTimeoutMs = resolveMediaHttpTimeoutMs(
      process.env.MEDIA_ANALYSIS_FETCH_TIMEOUT_MS,
      'MEDIA_ANALYSIS_FETCH_TIMEOUT_MS',
      DEFAULT_MEDIA_FETCH_TIMEOUT_MS,
    );
    const res = await fetchWithDeadline(
      deps.fetch,
      inputUrl,
      {},
      fetchTimeoutMs,
      'Media URL fetch',
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch media (${res.status})`);
    }

    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      throw new Error(`Remote file exceeds size limit (${contentLength} > ${maxBytes})`);
    }

    const buffer = await readResponseBufferWithinLimit(res, maxBytes);

    const ext = path.extname(url.pathname) || '.bin';
    const tempDir = await deps.mkdtemp(path.join(deps.tmpdir(), 'media-'));
    const tempPath = path.join(tempDir, `media${ext}`);
    await deps.writeFile(tempPath, buffer);
    return { filePath: tempPath, source: inputUrl, sizeBytes: buffer.length, tempFile: true, tempDir };
  }

  throw new Error('Either inputs.path or inputs.url is required');
}

export async function analyzeMedia(
  inputs: Record<string, unknown>,
  pool: pg.Pool,
  deps: Partial<MediaAnalysisDeps> = {},
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  const runtimeDeps: MediaAnalysisDeps = { ...defaultDeps, ...deps };
  let resolved: MediaResolveResult | null = null;
  let keyFrameDir: string | null = null;

  try {
    resolved = await resolveMediaInput(inputs, pool, runtimeDeps);
    const mediaType = inferMediaType(resolved.filePath, inputs.media_type as string | undefined);
    if (!mediaType) {
      return { outputs: {}, error: 'Unable to infer media type; set inputs.media_type' };
    }

    const outputs: Record<string, unknown> = {
      media_type: mediaType,
      source: resolved.source,
      size_bytes: resolved.sizeBytes,
      transcript: '',
      summary: '',
      topics: [],
      key_frames: [],
      warnings: [],
    };

    if (mediaType === 'audio') {
      const language = typeof inputs.language === 'string' ? inputs.language : undefined;
      const transcript = await runtimeDeps.transcribeAudio(resolved.filePath, language);
      outputs.transcript = transcript;
      const summary = await runtimeDeps.summarizeTranscript(transcript);
      outputs.summary = summary.summary;
      outputs.topics = summary.topics;
      return { outputs };
    }

    if (mediaType === 'image') {
      const description = await runtimeDeps.describeImage(resolved.filePath);
      outputs.summary = description;
      const imagePath = resolved.tempFile ? null : resolved.filePath;
      outputs.key_frames = [{ description, timestamp: null, image_path: imagePath }];
      return { outputs };
    }

    const interval = typeof inputs.frame_interval_sec === 'number'
      ? inputs.frame_interval_sec
      : DEFAULT_FRAME_INTERVAL_SEC;
    const maxFrames = typeof inputs.max_frames === 'number'
      ? inputs.max_frames
      : DEFAULT_MAX_FRAMES;
    keyFrameDir = await runtimeDeps.mkdtemp(path.join(runtimeDeps.tmpdir(), 'media-frames-'));
    const frames = await runtimeDeps.extractKeyFrames(resolved.filePath, keyFrameDir, interval, maxFrames);
    const keyFrames = [];
    for (const frame of frames) {
      const description = await runtimeDeps.describeImage(frame);
      keyFrames.push({ description, timestamp: null, image_path: null });
    }
    outputs.key_frames = keyFrames;

    const descriptions = keyFrames.map((f: any) => f.description).join('\n');
    const summary = await runtimeDeps.summarizeTranscript(descriptions);
    outputs.summary = summary.summary;
    outputs.topics = summary.topics;
    return { outputs };
  } catch (err) {
    return { outputs: {}, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (keyFrameDir) {
      await runtimeDeps.rm(keyFrameDir, { recursive: true, force: true }).catch(() => {});
    }
    if (resolved?.tempFile) {
      await runtimeDeps.unlink(resolved.filePath).catch(() => {});
    }
    if (resolved?.tempDir) {
      await runtimeDeps.rm(resolved.tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
