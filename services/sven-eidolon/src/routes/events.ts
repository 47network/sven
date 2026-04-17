// ---------------------------------------------------------------------------
// SSE route — real-time event feed for the 3D city.
// ---------------------------------------------------------------------------
// Clients reconnect automatically via the EventSource contract. We bound
// subscriber count in the bus itself (MAX_LISTENERS) and close the stream
// cleanly when the client disconnects.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { EidolonEventBus } from '../event-bus.js';

export async function registerEventsRoute(
  app: FastifyInstance,
  bus: EidolonEventBus,
): Promise<void> {
  app.get('/v1/eidolon/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`: eidolon stream open\n\n`);

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = bus.subscribe((ev) => {
        try {
          reply.raw.write(`event: ${ev.kind}\n`);
          reply.raw.write(`id: ${ev.id}\n`);
          reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
        } catch {
          // writable stream is gone; cleanup handled in 'close'.
        }
      });
    } catch (err) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
      reply.raw.end();
      return reply;
    }

    const cleanup = () => {
      try { unsubscribe?.(); } catch { /* ignore */ }
      try { reply.raw.end(); } catch { /* ignore */ }
    };
    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);

    return reply;
  });
}
