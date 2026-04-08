/**
 * Tests for wake-word service utility functions.
 *
 * Covers all pure functions extracted into src/utils.ts.
 */

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
} from '../utils';

// ---------------------------------------------------------------------------
// WakeWordValidationError
// ---------------------------------------------------------------------------

describe('WakeWordValidationError', () => {
  it('sets statusCode, code, and message', () => {
    const err = new WakeWordValidationError(400, 'BAD', 'bad request');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD');
    expect(err.message).toBe('bad request');
    expect(err.name).toBe('WakeWordValidationError');
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// stripTrailingSlash
// ---------------------------------------------------------------------------

describe('stripTrailingSlash', () => {
  it('removes trailing slash', () => {
    expect(stripTrailingSlash('http://example.com/')).toBe('http://example.com');
  });

  it('leaves non-trailing-slash strings unchanged', () => {
    expect(stripTrailingSlash('http://example.com')).toBe('http://example.com');
  });

  it('handles empty string', () => {
    expect(stripTrailingSlash('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// normalizeWakeWordMaxAudioBytes
// ---------------------------------------------------------------------------

describe('normalizeWakeWordMaxAudioBytes', () => {
  it('returns default 2MB for undefined', () => {
    expect(normalizeWakeWordMaxAudioBytes(undefined)).toBe(2 * 1024 * 1024);
  });

  it('returns default for non-numeric string', () => {
    expect(normalizeWakeWordMaxAudioBytes('abc')).toBe(2 * 1024 * 1024);
  });

  it('returns default for negative value', () => {
    expect(normalizeWakeWordMaxAudioBytes('-100')).toBe(2 * 1024 * 1024);
  });

  it('clamps to minimum 32KB', () => {
    expect(normalizeWakeWordMaxAudioBytes('1000')).toBe(32 * 1024);
  });

  it('clamps to maximum 10MB', () => {
    expect(normalizeWakeWordMaxAudioBytes('999999999')).toBe(10 * 1024 * 1024);
  });

  it('accepts valid value in range', () => {
    expect(normalizeWakeWordMaxAudioBytes('1048576')).toBe(1048576);
  });
});

// ---------------------------------------------------------------------------
// normalizeWakeWordMaxRequestBodyBytes
// ---------------------------------------------------------------------------

describe('normalizeWakeWordMaxRequestBodyBytes', () => {
  it('returns default 4MB for undefined', () => {
    expect(normalizeWakeWordMaxRequestBodyBytes(undefined)).toBe(4 * 1024 * 1024);
  });

  it('clamps to minimum 128KB', () => {
    expect(normalizeWakeWordMaxRequestBodyBytes('1000')).toBe(128 * 1024);
  });

  it('clamps to maximum 20MB', () => {
    expect(normalizeWakeWordMaxRequestBodyBytes('999999999')).toBe(20 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// normalizeBoolean
// ---------------------------------------------------------------------------

describe('normalizeBoolean', () => {
  it.each(['true', 'True', 'TRUE', '1', 'yes', 'on'])(
    'returns true for "%s"',
    (value) => {
      expect(normalizeBoolean(value)).toBe(true);
    },
  );

  it.each(['false', '0', 'no', 'off', '', 'random'])(
    'returns false for "%s"',
    (value) => {
      expect(normalizeBoolean(value)).toBe(false);
    },
  );

  it('returns false for undefined', () => {
    expect(normalizeBoolean(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeDetectorTimeoutMs
// ---------------------------------------------------------------------------

describe('normalizeDetectorTimeoutMs', () => {
  it('returns default 10s for undefined', () => {
    expect(normalizeDetectorTimeoutMs(undefined)).toBe(10_000);
  });

  it('clamps to minimum 1s', () => {
    expect(normalizeDetectorTimeoutMs('100')).toBe(1_000);
  });

  it('clamps to maximum 60s', () => {
    expect(normalizeDetectorTimeoutMs('120000')).toBe(60_000);
  });

  it('accepts valid value', () => {
    expect(normalizeDetectorTimeoutMs('5000')).toBe(5_000);
  });
});

// ---------------------------------------------------------------------------
// normalizeDetectorThreshold
// ---------------------------------------------------------------------------

describe('normalizeDetectorThreshold', () => {
  it('returns undefined for non-numeric', () => {
    expect(normalizeDetectorThreshold('abc')).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(normalizeDetectorThreshold(undefined)).toBeUndefined();
  });

  it('clamps to 0 minimum', () => {
    expect(normalizeDetectorThreshold('-0.5')).toBe(0);
  });

  it('clamps to 1 maximum', () => {
    expect(normalizeDetectorThreshold('1.5')).toBe(1);
  });

  it('passes through valid threshold', () => {
    expect(normalizeDetectorThreshold('0.4')).toBeCloseTo(0.4);
  });
});

// ---------------------------------------------------------------------------
// normalizeBase64AudioPayload
// ---------------------------------------------------------------------------

describe('normalizeBase64AudioPayload', () => {
  it('strips data URI prefix', () => {
    expect(normalizeBase64AudioPayload('data:audio/wav;base64,AAAA')).toBe('AAAA');
  });

  it('passes through plain base64', () => {
    expect(normalizeBase64AudioPayload('AAAA')).toBe('AAAA');
  });

  it('strips whitespace', () => {
    expect(normalizeBase64AudioPayload('AA AA\nBB')).toBe('AAAABB');
  });

  it('handles empty/null-ish', () => {
    expect(normalizeBase64AudioPayload('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// estimateBase64DecodedBytes
// ---------------------------------------------------------------------------

describe('estimateBase64DecodedBytes', () => {
  it('returns 0 for empty payload', () => {
    expect(estimateBase64DecodedBytes('')).toBe(0);
  });

  it('estimates correctly for no padding', () => {
    // "AAAA" => 3 bytes
    expect(estimateBase64DecodedBytes('AAAA')).toBe(3);
  });

  it('accounts for single padding', () => {
    // "AAA=" => 2 bytes
    expect(estimateBase64DecodedBytes('AAA=')).toBe(2);
  });

  it('accounts for double padding', () => {
    // "AA==" => 1 byte
    expect(estimateBase64DecodedBytes('AA==')).toBe(1);
  });

  it('strips data URI prefix before estimation', () => {
    expect(estimateBase64DecodedBytes('data:audio/wav;base64,AAAA')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isBlockedAudioHostname
// ---------------------------------------------------------------------------

describe('isBlockedAudioHostname', () => {
  it('blocks empty hostname', () => {
    expect(isBlockedAudioHostname('')).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isBlockedAudioHostname('localhost')).toBe(true);
  });

  it('blocks metadata.google.internal', () => {
    expect(isBlockedAudioHostname('metadata.google.internal')).toBe(true);
  });

  it('blocks .local domains', () => {
    expect(isBlockedAudioHostname('myhost.local')).toBe(true);
  });

  it('blocks .internal domains', () => {
    expect(isBlockedAudioHostname('service.internal')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isBlockedAudioHostname('cdn.example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBlockedAudioIp
// ---------------------------------------------------------------------------

describe('isBlockedAudioIp', () => {
  it('blocks empty IP', () => {
    expect(isBlockedAudioIp('')).toBe(true);
  });

  // IPv4 private/reserved ranges
  it.each([
    '10.0.0.1',
    '10.255.255.255',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.1.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.255.255',
  ])('blocks private IPv4 %s', (ip) => {
    expect(isBlockedAudioIp(ip)).toBe(true);
  });

  // IPv4 public
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '203.0.113.1',
    '172.32.0.1',
  ])('allows public IPv4 %s', (ip) => {
    expect(isBlockedAudioIp(ip)).toBe(false);
  });

  // IPv6
  it('blocks loopback ::1', () => {
    expect(isBlockedAudioIp('::1')).toBe(true);
  });

  it('blocks link-local fe80::', () => {
    expect(isBlockedAudioIp('fe80::1')).toBe(true);
  });

  it('blocks ULA fc/fd', () => {
    expect(isBlockedAudioIp('fc00::1')).toBe(true);
    expect(isBlockedAudioIp('fd12::1')).toBe(true);
  });

  it('allows public IPv6', () => {
    expect(isBlockedAudioIp('2001:db8::1')).toBe(false);
  });

  it('blocks non-IP strings', () => {
    expect(isBlockedAudioIp('not-an-ip')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// guessExtension
// ---------------------------------------------------------------------------

describe('guessExtension', () => {
  it.each([
    ['audio/wav', '.wav'],
    ['audio/x-wav', '.wav'],
    ['audio/webm', '.webm'],
    ['audio/mp4', '.mp4'],
    ['audio/mpeg', '.mp3'],
    ['audio/ogg', '.ogg'],
    ['audio/flac', '.flac'],
  ])('maps %s to %s', (mime, ext) => {
    expect(guessExtension(mime)).toBe(ext);
  });

  it('defaults to .wav for undefined', () => {
    expect(guessExtension(undefined)).toBe('.wav');
  });

  it('falls back to subtype for unknown mime', () => {
    expect(guessExtension('audio/aac')).toBe('.aac');
  });
});

// ---------------------------------------------------------------------------
// guessMimeFromExtension
// ---------------------------------------------------------------------------

describe('guessMimeFromExtension', () => {
  it.each([
    ['.wav', 'audio/wav'],
    ['.webm', 'audio/webm'],
    ['.mp3', 'audio/mpeg'],
    ['.ogg', 'audio/ogg'],
    ['.flac', 'audio/flac'],
  ])('maps %s to %s', (ext, mime) => {
    expect(guessMimeFromExtension(ext)).toBe(mime);
  });

  it('defaults to audio/wav for unknown', () => {
    expect(guessMimeFromExtension('.xyz')).toBe('audio/wav');
  });
});

// ---------------------------------------------------------------------------
// buildMetadata
// ---------------------------------------------------------------------------

describe('buildMetadata', () => {
  it('builds base metadata with wake_word and source', () => {
    const result = buildMetadata({ wake_word: 'hey sven', confidence: 0.9 });
    expect(result.source).toBe('wake-word');
    expect(result.wake_word).toEqual({ name: 'hey sven', confidence: 0.9 });
  });

  it('includes language when present', () => {
    const result = buildMetadata({ wake_word: 'hey sven', language: 'en-US' });
    expect(result.language).toBe('en-US');
  });

  it('includes mode when present', () => {
    const result = buildMetadata({ wake_word: 'hey sven', mode: 'android_foreground_service' });
    expect(result.mode).toBe('android_foreground_service');
  });

  it('includes transcribe when boolean', () => {
    const result = buildMetadata({ wake_word: 'hey sven', transcribe: false });
    expect(result.transcribe).toBe(false);
  });

  it('preserves existing metadata', () => {
    const result = buildMetadata({ wake_word: 'hey sven', metadata: { custom: 'value' } });
    expect(result.custom).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// attachDetectorMetadata
// ---------------------------------------------------------------------------

describe('attachDetectorMetadata', () => {
  it('returns metadata unchanged when decision is null', () => {
    const metadata = { source: 'wake-word' };
    expect(attachDetectorMetadata(metadata, null)).toBe(metadata);
  });

  it('appends wake_word_detector block when decision is present', () => {
    const metadata = { source: 'wake-word' };
    const decision = {
      detected: true,
      confidence: 0.85,
      matchedLabel: 'hey_mycroft_v0.1',
      targetLabel: 'hey_mycroft_v0.1',
      threshold: 0.5,
      scores: { 'hey_mycroft_v0.1': 0.85 },
    };
    const result = attachDetectorMetadata(metadata, decision);
    expect(result.source).toBe('wake-word');
    expect(result.wake_word_detector).toEqual({
      provider: 'openwakeword',
      detected: true,
      confidence: 0.85,
      matched_label: 'hey_mycroft_v0.1',
      target_label: 'hey_mycroft_v0.1',
      threshold: 0.5,
      scores: { 'hey_mycroft_v0.1': 0.85 },
    });
  });

  it('normalizes null/undefined fields in decision', () => {
    const result = attachDetectorMetadata({}, {
      detected: false,
    });
    const detector = result.wake_word_detector as Record<string, unknown>;
    expect(detector.confidence).toBeNull();
    expect(detector.matched_label).toBeNull();
    expect(detector.target_label).toBeNull();
    expect(detector.threshold).toBeNull();
    expect(detector.scores).toEqual({});
  });
});
