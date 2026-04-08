/**
 * Pure utility functions for the wake-word service.
 *
 * Extracted from index.ts to enable unit testing without side effects.
 */

import { isIP } from 'node:net';

export class WakeWordValidationError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'WakeWordValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface WakeWordDetectorDecision {
  detected: boolean;
  confidence?: number;
  matchedLabel?: string | null;
  targetLabel?: string | null;
  threshold?: number;
  scores?: Record<string, number>;
}

export function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function normalizeWakeWordMaxAudioBytes(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 2 * 1024 * 1024;
  return Math.min(Math.max(Math.floor(parsed), 32 * 1024), 10 * 1024 * 1024);
}

export function normalizeWakeWordMaxRequestBodyBytes(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 4 * 1024 * 1024;
  return Math.min(Math.max(Math.floor(parsed), 128 * 1024), 20 * 1024 * 1024);
}

export function normalizeBoolean(raw: string | undefined): boolean {
  const normalized = String(raw || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function normalizeDetectorTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10_000;
  return Math.min(Math.max(Math.floor(parsed), 1_000), 60_000);
}

export function normalizeDetectorThreshold(raw: string | undefined): number | undefined {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(parsed, 0), 1);
}

export function normalizeBase64AudioPayload(payload: string): string {
  const raw = String(payload || '').trim();
  const comma = raw.indexOf(',');
  const candidate = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw;
  return candidate.replace(/\s+/g, '');
}

export function estimateBase64DecodedBytes(payload: string): number {
  const normalized = normalizeBase64AudioPayload(payload);
  if (!normalized) return 0;
  let padding = 0;
  if (normalized.endsWith('==')) padding = 2;
  else if (normalized.endsWith('=')) padding = 1;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function isBlockedAudioHostname(hostnameRaw: string): boolean {
  const hostname = String(hostnameRaw || '').trim().toLowerCase();
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === 'metadata.google.internal') return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  return false;
}

export function isBlockedAudioIp(ipRaw: string): boolean {
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

export function guessExtension(mime?: string): string {
  const normalized = mime?.toLowerCase() || '';
  const mapping: Record<string, string> = {
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/webm': '.webm',
    'audio/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac',
  };

  if (mapping[normalized]) {
    return mapping[normalized];
  }
  if (normalized.includes('/')) {
    return `.${normalized.split('/')[1]}`;
  }
  return '.wav';
}

export function guessMimeFromExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  const reverseMap: Record<string, string> = {
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  };
  return reverseMap[normalized] || 'audio/wav';
}

export function buildMetadata(body: {
  metadata?: Record<string, unknown>;
  wake_word: string;
  confidence?: number;
  language?: string;
  mode?: string;
  transcribe?: boolean;
}): Record<string, unknown> {
  const base = { ...(body.metadata || {}) };
  base.wake_word = { name: body.wake_word, confidence: body.confidence };
  if (body.language) {
    base.language = body.language;
  }
  if (typeof body.mode === 'string') {
    base.mode = body.mode;
  }
  base.source = 'wake-word';
  if (typeof body.transcribe === 'boolean') {
    base.transcribe = body.transcribe;
  }
  return base;
}

export function attachDetectorMetadata(
  metadata: Record<string, unknown>,
  decision: WakeWordDetectorDecision | null,
): Record<string, unknown> {
  if (!decision) return metadata;
  return {
    ...metadata,
    wake_word_detector: {
      provider: 'openwakeword',
      detected: decision.detected,
      confidence: decision.confidence ?? null,
      matched_label: decision.matchedLabel ?? null,
      target_label: decision.targetLabel ?? null,
      threshold: decision.threshold ?? null,
      scores: decision.scores ?? {},
    },
  };
}
