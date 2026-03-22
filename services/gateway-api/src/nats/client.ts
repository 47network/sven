import { connect, NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('gateway-nats');

let nc: NatsConnection | null = null;

export async function getNatsConnection(): Promise<NatsConnection> {
  if (!nc) {
    const servers = process.env.NATS_URL || 'nats://localhost:4222';
    nc = await connect({
      servers,
      name: 'gateway-api',
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
    });
    logger.info('Connected to NATS', { servers });

    // Handle disconnect/reconnect
    (async () => {
      for await (const s of nc!.status()) {
        logger.info('NATS status', { type: String(s.type), data: String(s.data) });
      }
    })();
  }
  return nc;
}

export async function closeNats(): Promise<void> {
  if (nc) {
    await nc.drain();
    nc = null;
    logger.info('NATS connection closed');
  }
}
