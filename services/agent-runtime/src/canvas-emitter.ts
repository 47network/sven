import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import { CitationRef, formatCitationsMarkdown } from './citation-utils.js';
import { parseBooleanSetting, parseSettingValue } from './settings-utils.js';

const logger = createLogger('canvas-emitter');
const jc = JSONCodec();

interface EmitParams {
  chat_id: string;
  channel: string;
  text?: string;
  blocks?: unknown[];
  tool_calls?: any[];
  citations?: CitationRef[];
  metadata?: Record<string, unknown>;
}

interface ArtifactInsert {
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  is_private: boolean;
  enc_alg?: string;
  enc_kid?: string;
  ciphertext_sha256?: string;
  tool_run_id?: string;
}

interface RedactionConfig {
  enabled: boolean;
  patterns: RegExp[];
  mask: string;
}

const MAX_REDACTION_PATTERN_LENGTH = 256;
const MAX_REDACTION_PATTERN_COUNT = 64;

function isUnsafeRedactionPattern(pattern: string): boolean {
  if (pattern.length > MAX_REDACTION_PATTERN_LENGTH) return true;
  if (pattern.includes('(?<=') || pattern.includes('(?<!')) return true;
  if (/\\[1-9]/.test(pattern)) return true;
  if (/\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(pattern)) return true;
  return false;
}

/**
 * Canvas Emitter – produces canvas_blocks[], persists events & artifacts,
 * and publishes outbox messages for channel delivery.
 */
export class CanvasEmitter {
  constructor(
    private pool: pg.Pool,
    private nc: NatsConnection,
  ) {}

  async emit(params: EmitParams): Promise<void> {
    const messageId = uuidv7();

    // Build canvas blocks from response
    const blocks = this.buildBlocks(params);
    const redaction = await this.getRedactionConfig();
    const text = redaction.enabled
      ? this.redactText(params.text || '', redaction)
      : params.text || '';
    const storedBlocks = redaction.enabled
      ? this.redactBlocks(blocks, redaction)
      : blocks;
    let channelChatId = params.chat_id;
    const outboxId = uuidv7();
    const idempotencyKey = `${params.chat_id}:${messageId}`;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Persist assistant message
      await client.query(
        `INSERT INTO messages (id, chat_id, role, content_type, text, blocks, created_at)
         VALUES ($1, $2, 'assistant', 'blocks', $3, $4, NOW())`,
        [messageId, params.chat_id, text, JSON.stringify(storedBlocks)],
      );

      // Persist canvas event
      if (storedBlocks.length > 0) {
        const canvasEventId = uuidv7();
        await client.query(
          `INSERT INTO canvas_events (id, chat_id, message_id, blocks, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [canvasEventId, params.chat_id, messageId, JSON.stringify(storedBlocks)],
        );
      }

      // Persist artifacts referenced by blocks
      const artifacts = this.extractArtifacts(storedBlocks);
      for (const artifact of artifacts) {
        await client.query(
          `INSERT INTO artifacts (id, chat_id, message_id, tool_run_id, name, mime_type, size_bytes, storage_path, is_private, enc_alg, enc_kid, ciphertext_sha256, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
          [
            uuidv7(),
            params.chat_id,
            messageId,
            artifact.tool_run_id || null,
            artifact.name,
            artifact.mime_type,
            artifact.size_bytes,
            artifact.storage_path,
            artifact.is_private,
            artifact.enc_alg || null,
            artifact.enc_kid || null,
            artifact.ciphertext_sha256 || null,
          ],
        );
      }

      // Get channel chat ID for outbox
      const chatRes = await client.query(
        `SELECT channel_chat_id FROM chats WHERE id = $1`,
        [params.chat_id],
      );
      channelChatId = chatRes.rows[0]?.channel_chat_id || params.chat_id;

      // Write to outbox
      await client.query(
        `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, blocks, idempotency_key, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'blocks', $5, $6, $7, 'pending', NOW(), NOW())`,
        [outboxId, params.chat_id, params.channel, channelChatId, text, JSON.stringify(storedBlocks), idempotencyKey],
      );

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error('Canvas emit rollback failed', {
          error: String(rollbackErr),
          chat_id: params.chat_id,
          message_id: messageId,
        });
      }
      throw err;
    } finally {
      client.release();
    }

    // Publish outbox event to both OUTBOX and TTS streams
    const envelope = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        outbox_id: outboxId,
        chat_id: params.chat_id,
        channel: params.channel,
        channel_chat_id: channelChatId,
        content_type: 'blocks',
        text,
        blocks: storedBlocks,
        idempotency_key: idempotencyKey,
        metadata: params.metadata || {},
      },
    };
    const payload = jc.encode(envelope);
    this.nc.publish(NATS_SUBJECTS.OUTBOX_ENQUEUE, payload);
    this.nc.publish(NATS_SUBJECTS.TTS_OUTBOX_ENQUEUE, payload);

    logger.info('Canvas emitted', {
      message_id: messageId,
      chat_id: params.chat_id,
      blocks_count: storedBlocks.length,
    });
  }

  private async getRedactionConfig(): Promise<RedactionConfig> {
    const res = await this.pool.query(
      `SELECT key, value FROM settings_global
       WHERE key = ANY($1::text[])`,
      [['redaction.enabled', 'redaction.patterns', 'redaction.mask']],
    );

    const values = new Map<string, any>();
    for (const row of res.rows) {
      values.set(row.key, parseSettingValue(row.value));
    }

    const enabled = parseBooleanSetting(values.get('redaction.enabled'), false);
    const mask = String(values.get('redaction.mask') ?? '[REDACTED]');
    const rawPatterns = values.get('redaction.patterns');
    const patterns = Array.isArray(rawPatterns) ? rawPatterns : [];
    const regexes: RegExp[] = [];

    for (const pattern of patterns) {
      if (regexes.length >= MAX_REDACTION_PATTERN_COUNT) {
        logger.warn('Redaction pattern limit reached; remaining patterns skipped', {
          limit: MAX_REDACTION_PATTERN_COUNT,
        });
        break;
      }
      if (typeof pattern !== 'string') continue;
      const normalized = pattern.trim();
      if (normalized.length === 0) continue;
      if (isUnsafeRedactionPattern(normalized)) {
        logger.warn('Unsafe redaction pattern skipped', { pattern: normalized });
        continue;
      }
      try {
        regexes.push(new RegExp(normalized, 'gi'));
      } catch (err) {
        logger.warn('Invalid redaction pattern skipped', { pattern: normalized });
      }
    }

    return { enabled, patterns: regexes, mask };
  }

  private redactText(text: string, config: RedactionConfig): string {
    if (!config.enabled || config.patterns.length === 0) return text;
    let redacted = text;
    for (const re of config.patterns) {
      redacted = redacted.replace(re, config.mask);
    }
    return redacted;
  }

  private redactBlocks(blocks: unknown[], config: RedactionConfig): unknown[] {
    if (!config.enabled || config.patterns.length === 0) return blocks;

    return blocks.map((block) => {
      if (!block || typeof block !== 'object') return block;
      const typed = block as { type?: string; content?: any; metadata?: Record<string, unknown> };
      const type = typed.type || '';
      const content = typed.content;

      if (type === 'tool_card' && content && typeof content === 'object') {
        const reason = typeof content.reason === 'string'
          ? this.redactText(content.reason, config)
          : content.reason;
        return { ...typed, content: { ...content, reason } };
      }

      const redactableTypes = new Set(['markdown', 'code', 'table', 'chart', 'link']);
      if (!redactableTypes.has(type)) return block;

      if (typeof content === 'string') {
        return { ...typed, content: this.redactText(content, config) };
      }

      if (content && typeof content === 'object') {
        const clone = { ...content } as Record<string, unknown>;
        for (const key of ['content', 'text', 'title', 'description', 'body']) {
          if (typeof clone[key] === 'string') {
            clone[key] = this.redactText(clone[key] as string, config);
          }
        }
        return { ...typed, content: clone };
      }

      return block;
    });
  }

  private extractArtifacts(blocks: unknown[]): ArtifactInsert[] {
    const artifacts: ArtifactInsert[] = [];

    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const typedBlock = block as { type?: string; content?: any };
      const content = typedBlock.content || {};

      const hasExplicitArtifact =
        content.artifact && typeof content.artifact === 'object';
      const artifactAllowedTypes = new Set(['file_preview', 'image', 'audio']);
      if (!hasExplicitArtifact && !artifactAllowedTypes.has(typedBlock.type || '')) {
        continue;
      }

      const candidate = hasExplicitArtifact ? content.artifact : content;

      const storagePath =
        candidate.storage_path || candidate.path || candidate.url || null;
      if (!storagePath) continue;

      const name =
        candidate.name || candidate.file_name || candidate.filename || 'artifact';
      const mimeType = candidate.mime_type || candidate.file_mime || 'application/octet-stream';
      const sizeBytes = Number(candidate.size_bytes || candidate.size || 0);

      artifacts.push({
        name,
        mime_type: mimeType,
        size_bytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
        storage_path: String(storagePath),
        is_private: Boolean(candidate.is_private),
        enc_alg: candidate.enc_alg,
        enc_kid: candidate.enc_kid,
        ciphertext_sha256: candidate.ciphertext_sha256,
        tool_run_id: candidate.tool_run_id,
      });
    }

    return artifacts;
  }

  private buildBlocks(params: EmitParams): unknown[] {
    const blocks: unknown[] = [];

    // Primary text response
    if (params.text) {
      blocks.push({ type: 'markdown', content: params.text });
    }

    // Existing blocks from LLM
    if (params.blocks) {
      blocks.push(...params.blocks);
    }

    // Tool call cards
    if (params.tool_calls) {
      for (const tc of params.tool_calls) {
        if (tc.blocked) {
          blocks.push({
            type: 'tool_card',
            content: {
              tool_name: tc.name,
              status: 'blocked',
              reason: tc.block_reason,
            },
          });
        } else if (tc.pending_approval) {
          blocks.push({
            type: 'tool_card',
            content: {
              tool_name: tc.name,
              status: 'pending_approval',
              approval_id: tc.approval_id,
            },
          });
        } else {
          blocks.push({
            type: 'tool_card',
            content: {
              tool_name: tc.name,
              status: 'executed',
              run_id: tc.run_id,
            },
          });
        }
      }
    }

    if (params.citations && params.citations.length > 0) {
      blocks.push({
        type: 'markdown',
        content: formatCitationsMarkdown(params.citations),
        metadata: { citations: params.citations },
      });
    }

    return blocks;
  }
}
