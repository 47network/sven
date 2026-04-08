/**
 * Anti-distillation — response watermarking and fingerprinting.
 *
 * Embeds invisible watermarks into agent responses so that if someone
 * uses Sven's outputs to train a competing model, the provenance can
 * be detected. Also provides tool definition obfuscation for untrusted
 * execution contexts.
 *
 * Features:
 * - Zero-width Unicode watermarking (invisible in rendered text)
 * - Whitespace-based steganography
 * - Lexical variation watermarking (synonym substitution markers)
 * - Response fingerprinting with timestamp + service identity
 * - Watermark detection and payload extraction
 * - Tool definition obfuscation for sandboxed contexts
 *
 * Prior art: Digital watermarking (Kirchhoff et al.), text steganography
 * (zero-width characters), Unicode confusables, document fingerprinting,
 * AI text watermarking (Kirchenbauer et al. 2023), authorship attribution.
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { createLogger } from './logger.js';

const log = createLogger('anti-distillation');

// ── Zero-width characters ─────────────────────────────────────────

/** Zero-Width Space */
const ZWS = '\u200B';
/** Zero-Width Non-Joiner */
const ZWNJ = '\u200C';
/** Zero-Width Joiner */
const ZWJ = '\u200D';
/** Word Joiner */
const WJ = '\u2060';

/** Map bits to zero-width characters. */
const BIT_CHARS: Record<string, string> = {
  '00': ZWS,
  '01': ZWNJ,
  '10': ZWJ,
  '11': WJ,
};

/** Reverse map for decoding. */
const CHAR_BITS: Map<string, string> = new Map(
  Object.entries(BIT_CHARS).map(([bits, char]) => [char, bits]),
);

// ── Types ─────────────────────────────────────────────────────────

export type WatermarkAlgorithm = 'zero-width' | 'whitespace' | 'lexical';

export interface WatermarkConfig {
  /** Whether watermarking is enabled. Default true. */
  enabled: boolean;
  /** Watermarking algorithm. Default 'zero-width'. */
  algorithm: WatermarkAlgorithm;
  /** Payload to embed (identifier). Max 64 bytes. */
  payload: string;
  /** How densely to inject marks (0–1). Default 0.3 (30% of insertion points). */
  density: number;
}

export interface Fingerprint {
  /** SHA-256 hash of the response. */
  hash: string;
  /** When the response was generated. */
  timestamp: Date;
  /** Which service generated it. */
  serviceId: string;
  /** Session ID if available. */
  sessionId?: string;
  /** HMAC signature for verification. */
  hmac: string;
}

export interface WatermarkDetectionResult {
  /** Whether a watermark was found. */
  found: boolean;
  /** The extracted payload if found. */
  payload?: string;
  /** Algorithm used. */
  algorithm?: WatermarkAlgorithm;
  /** Confidence of detection (0–1). */
  confidence: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface AntiDistillationConfig {
  /** Watermark configuration. */
  watermark: WatermarkConfig;
  /** HMAC secret for fingerprinting. */
  fingerprintSecret: string;
  /** Service identifier. */
  serviceId: string;
}

// ── Default config ────────────────────────────────────────────────

const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: true,
  algorithm: 'zero-width',
  payload: 'sven',
  density: 0.3,
};

// ── AntiDistillation ──────────────────────────────────────────────

export class AntiDistillation {
  private readonly config: AntiDistillationConfig;

  constructor(config: Pick<AntiDistillationConfig, 'fingerprintSecret' | 'serviceId'> & {
    watermark?: Partial<WatermarkConfig>;
  }) {
    this.config = {
      watermark: { ...DEFAULT_WATERMARK, ...config.watermark },
      fingerprintSecret: config.fingerprintSecret,
      serviceId: config.serviceId,
    };
  }

  /**
   * Embed a watermark into text.
   */
  watermark(text: string): string {
    if (!this.config.watermark.enabled) return text;

    switch (this.config.watermark.algorithm) {
      case 'zero-width':
        return this.watermarkZeroWidth(text);
      case 'whitespace':
        return this.watermarkWhitespace(text);
      case 'lexical':
        return this.watermarkLexical(text);
      default:
        return text;
    }
  }

  /**
   * Attempt to detect and extract a watermark from text.
   */
  detectWatermark(text: string): WatermarkDetectionResult {
    // Try zero-width first
    const zwResult = this.detectZeroWidth(text);
    if (zwResult.found) return zwResult;

    // Try whitespace
    const wsResult = this.detectWhitespace(text);
    if (wsResult.found) return wsResult;

    return { found: false, confidence: 0 };
  }

  /**
   * Generate a fingerprint for a response.
   */
  fingerprint(response: string, sessionId?: string): Fingerprint {
    const timestamp = new Date();
    const hash = createHash('sha256').update(response).digest('hex');

    const hmacPayload = `${hash}:${timestamp.toISOString()}:${this.config.serviceId}:${sessionId ?? ''}`;
    const hmac = createHmac('sha256', this.config.fingerprintSecret)
      .update(hmacPayload)
      .digest('hex');

    return {
      hash,
      timestamp,
      serviceId: this.config.serviceId,
      sessionId,
      hmac,
    };
  }

  /**
   * Verify a response fingerprint.
   */
  verifyFingerprint(response: string, fp: Fingerprint): boolean {
    const hash = createHash('sha256').update(response).digest('hex');
    if (hash !== fp.hash) return false;

    const hmacPayload = `${hash}:${fp.timestamp.toISOString()}:${fp.serviceId}:${fp.sessionId ?? ''}`;
    const expected = createHmac('sha256', this.config.fingerprintSecret)
      .update(hmacPayload)
      .digest('hex');

    return expected === fp.hmac;
  }

  /**
   * Obfuscate tool definitions to prevent extraction of capabilities.
   * Used when tools are exposed to untrusted execution contexts.
   */
  obfuscateTools(
    tools: ToolDefinition[],
    level: 'light' | 'heavy' = 'light',
  ): ToolDefinition[] {
    return tools.map((tool) => {
      if (level === 'light') {
        // Truncate descriptions, remove parameter details
        return {
          name: tool.name,
          description: tool.description.length > 80
            ? tool.description.slice(0, 80) + '...'
            : tool.description,
          parameters: tool.parameters,
        };
      }

      // Heavy: hash names, minimal description, strip parameters
      const obfuscatedName = `tool_${createHash('sha256')
        .update(tool.name)
        .digest('hex')
        .slice(0, 8)}`;
      return {
        name: obfuscatedName,
        description: 'Internal tool',
      };
    });
  }

  /**
   * Create from environment variables.
   */
  static fromEnv(serviceId: string): AntiDistillation {
    const secret = process.env['SVEN_FINGERPRINT_SECRET'] ?? randomBytes(32).toString('hex');
    return new AntiDistillation({
      fingerprintSecret: secret,
      serviceId,
      watermark: {
        enabled: process.env['SVEN_WATERMARK_ENABLED'] !== 'false',
        payload: process.env['SVEN_WATERMARK_PAYLOAD'] ?? 'sven',
        density: parseFloat(process.env['SVEN_WATERMARK_DENSITY'] ?? '0.3') || 0.3,
      },
    });
  }

  // ── Zero-width watermarking ─────────────────────────────────────

  private watermarkZeroWidth(text: string): string {
    const payload = this.config.watermark.payload;
    const encoded = this.encodeToBits(payload);
    const zwChars = this.bitsToZeroWidth(encoded);

    // Find insertion points (after spaces, between words)
    const lines = text.split('\n');
    let charIndex = 0;
    const insertionPoints: number[] = [];

    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') {
          insertionPoints.push(charIndex + i + 1);
        }
      }
      charIndex += line.length + 1; // +1 for \n
    }

    if (insertionPoints.length === 0) return text;

    // Select insertion points based on density
    const numInsertions = Math.max(1, Math.floor(insertionPoints.length * this.config.watermark.density));
    const step = Math.max(1, Math.floor(insertionPoints.length / numInsertions));
    const selectedPoints: number[] = [];
    for (let i = 0; i < insertionPoints.length && selectedPoints.length < numInsertions; i += step) {
      selectedPoints.push(insertionPoints[i]!);
    }

    // Distribute the zero-width chars across insertion points
    let result = text;
    let offset = 0;
    for (let i = 0; i < selectedPoints.length; i++) {
      const charIdx = i % zwChars.length;
      const insertPos = selectedPoints[i]! + offset;
      result = result.slice(0, insertPos) + zwChars[charIdx] + result.slice(insertPos);
      offset += 1;
    }

    log.debug('Zero-width watermark applied', {
      payloadLength: payload.length,
      insertions: selectedPoints.length,
    });

    return result;
  }

  private detectZeroWidth(text: string): WatermarkDetectionResult {
    const zwChars: string[] = [];
    for (const char of text) {
      if (CHAR_BITS.has(char)) {
        zwChars.push(char);
      }
    }

    if (zwChars.length < 4) {
      return { found: false, confidence: 0 };
    }

    // Reconstruct bits
    const bits = zwChars.map((c) => CHAR_BITS.get(c)!).join('');
    const payload = this.decodeBits(bits);

    // Determine confidence based on pattern regularity
    const confidence = Math.min(1.0, zwChars.length / 8);

    return {
      found: true,
      payload,
      algorithm: 'zero-width',
      confidence,
    };
  }

  // ── Whitespace watermarking ─────────────────────────────────────

  private watermarkWhitespace(text: string): string {
    const payload = this.config.watermark.payload;
    const bits = this.encodeToBits(payload);
    const lines = text.split('\n');

    // Encode bits as trailing spaces on lines (1 space = 0, 2 spaces = 1)
    let bitIdx = 0;
    const watermarked = lines.map((line) => {
      if (bitIdx >= bits.length || line.trim().length === 0) return line;
      const bit = bits[bitIdx++];
      return bit === '1' ? `${line}  ` : `${line} `;
    });

    log.debug('Whitespace watermark applied', {
      bitsEncoded: Math.min(bitIdx, bits.length),
    });

    return watermarked.join('\n');
  }

  private detectWhitespace(text: string): WatermarkDetectionResult {
    const lines = text.split('\n');
    const bits: string[] = [];

    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const trailing = line.length - line.trimEnd().length;
      if (trailing === 1) bits.push('0');
      else if (trailing === 2) bits.push('1');
    }

    if (bits.length < 8) {
      return { found: false, confidence: 0 };
    }

    const payload = this.decodeBits(bits.join(''));
    return {
      found: true,
      payload,
      algorithm: 'whitespace',
      confidence: Math.min(1.0, bits.length / 16),
    };
  }

  // ── Lexical watermarking ────────────────────────────────────────

  private watermarkLexical(text: string): string {
    // Simple approach: append a tiny invisible marker comment
    // Full lexical watermarking (synonym substitution) requires NLP
    // which would add heavy dependencies. This is a pragmatic fallback.
    const marker = `\u200B${this.config.watermark.payload.split('').map(
      (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0), // fullwidth chars
    ).join('')}\u200B`;

    return `${text}${marker}`;
  }

  // ── Bit encoding/decoding ───────────────────────────────────────

  private encodeToBits(payload: string): string {
    const bytes = Buffer.from(payload, 'utf-8');
    return [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
  }

  private decodeBits(bits: string): string {
    const bytes: number[] = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes).toString('utf-8');
  }

  private bitsToZeroWidth(bits: string): string[] {
    const chars: string[] = [];
    for (let i = 0; i + 1 < bits.length; i += 2) {
      const pair = bits.slice(i, i + 2);
      chars.push(BIT_CHARS[pair] ?? ZWS);
    }
    return chars;
  }
}
