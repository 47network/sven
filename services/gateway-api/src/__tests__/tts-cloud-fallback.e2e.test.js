import crypto from 'crypto';
import { describe, expect, it } from '@jest/globals';
import { connect, JSONCodec } from 'nats';
import * as pg from 'pg';

const RUN = process.env.TEST_TTS_E2E === '1';
const DATABASE_URL = process.env.DATABASE_URL || '';
const NATS_URL = process.env.NATS_URL || '';
const EXPECT_PROVIDER = process.env.TEST_EXPECT_TTS_PROVIDER || '';
const EXPECT_FALLBACK = process.env.TEST_EXPECT_TTS_FALLBACK || '';

const jc = JSONCodec();

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function waitForGenerated(pool, outboxId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await pool.query(
      `SELECT provider, voice, metadata, audio_url, created_at
       FROM voice_tts_generated
       WHERE outbox_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [outboxId],
    );
    if (res.rows.length > 0) {
      return res.rows[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

describe('Cloud TTS + Fallback E2E (optional)', () => {
  it('generates audio and records provider/fallback metadata', async () => {
    if (!RUN || !DATABASE_URL || !NATS_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    const nc = await connect({ servers: NATS_URL });
    try {
      const chatRes = await pool.query(
        `SELECT id, channel, channel_chat_id
         FROM chats
         ORDER BY created_at ASC
         LIMIT 1`,
      );
      if (chatRes.rows.length === 0) {
        expect(true).toBe(true);
        return;
      }
      const chat = chatRes.rows[0];
      const outboxId = id('ob_tts');
      const idempotencyKey = id('idem_tts');
      const text = 'Cloud TTS fallback test message.';

      await pool.query(
        `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, idempotency_key, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'text', $5, $6, 'pending', NOW(), NOW())`,
        [outboxId, String(chat.id), String(chat.channel || 'webchat'), String(chat.channel_chat_id || chat.id), text, idempotencyKey],
      );

      const envelope = {
        schema_version: '1.0',
        event_id: id('evt_tts'),
        occurred_at: new Date().toISOString(),
        data: {
          outbox_id: outboxId,
          chat_id: String(chat.id),
          channel: String(chat.channel || 'webchat'),
          channel_chat_id: String(chat.channel_chat_id || chat.id),
          content_type: 'text',
          text,
          idempotency_key: idempotencyKey,
        },
      };
      nc.publish('tts.enqueue', jc.encode(envelope));

      const generated = await waitForGenerated(pool, outboxId, 45000);
      expect(generated).toBeTruthy();
      expect(typeof generated.audio_url).toBe('string');

      const metadata = typeof generated.metadata === 'string'
        ? JSON.parse(generated.metadata)
        : (generated.metadata || {});

      if (EXPECT_PROVIDER) {
        expect(String(generated.provider)).toBe(EXPECT_PROVIDER);
      }
      if (EXPECT_FALLBACK) {
        const expected = EXPECT_FALLBACK === 'true';
        expect(Boolean(metadata.fallback_used)).toBe(expected);
      }
    } finally {
      await nc.drain();
      await pool.end();
    }
  });
});
