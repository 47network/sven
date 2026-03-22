import { AckPolicy, DeliverPolicy, NatsConnection, JSONCodec } from 'nats';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, OutboxEnqueueEvent } from '@sven/shared';

const logger = createLogger('outbox-subscriber');
const jc = JSONCodec();

/**
 * Subscribe to outbox.enqueue events and persist them to the outbox table.
 * Adapters then poll GET /v1/outbox/next to deliver messages.
 */
export async function startOutboxSubscriber(
  nc: NatsConnection,
  pool: pg.Pool,
): Promise<void> {
  const js = nc.jetstream();
  const consumersApi = js.consumers as any;
  const jsm = await nc.jetstreamManager();
  let consumer: any;
  try {
    consumer = await consumersApi.get('OUTBOX', 'outbox-worker');
  } catch (err) {
    const message = String(err || '').toLowerCase();
    const isMissing = message.includes('consumer not found') || message.includes('404');
    if (!isMissing) {
      throw err;
    }
    await jsm.consumers.add('OUTBOX', {
      durable_name: 'outbox-worker',
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      filter_subject: NATS_SUBJECTS.OUTBOX_ENQUEUE,
      ack_wait: 30_000_000_000, // 30s in ns
      max_deliver: 10,
    });
    consumer = await consumersApi.get('OUTBOX', 'outbox-worker');
    logger.info('Created missing OUTBOX durable consumer', { durable: 'outbox-worker' });
  }
  const messages = await consumer.consume();

  logger.info('Outbox subscriber started');

  (async () => {
    for await (const msg of messages) {
      try {
        const envelope = jc.decode(msg.data) as EventEnvelope<OutboxEnqueueEvent>;
        const data = envelope.data;

        // Idempotency: skip if already exists
        const existing = await pool.query(
          `SELECT 1 FROM outbox WHERE idempotency_key = $1`,
          [data.idempotency_key],
        );

        if (existing.rows.length > 0) {
          logger.info('Duplicate outbox event, skipping', {
            idempotency_key: data.idempotency_key,
          });
          msg.ack();
          continue;
        }

        await pool.query(
          `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, blocks, file_url, audio_url, idempotency_key, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW(), NOW())`,
          [
            data.outbox_id || uuidv7(),
            data.chat_id,
            data.channel,
            data.channel_chat_id,
            data.content_type,
            data.text || null,
            data.blocks ? JSON.stringify(data.blocks) : null,
            data.file_url || null,
            data.audio_url || null,
            data.idempotency_key,
          ],
        );

        logger.info('Outbox item persisted', {
          event_id: envelope.event_id,
          channel: data.channel,
          chat_id: data.chat_id,
        });

        msg.ack();
      } catch (err) {
        logger.error('Failed to process outbox event', { error: String(err) });
        // NAK so it gets redelivered
        msg.nak();
      }
    }
  })();
}
