/**
 * Entity Lifecycle Subscriber — listens for agent events and broadcasts entity state
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * This worker:
 * 1. Subscribes to agent.*.start|end NATS subjects
 * 2. Feeds events to EntityStateService
 * 3. Manages entity state broadcasts to WebSocket clients
 */

import { AckPolicy, DeliverPolicy, NatsConnection, type JsMsg } from 'nats';
import { createLogger } from '@sven/shared';
import { entityStateService } from '../services/EntityStateService.js';
import { AgentLifecycleEvent } from '../types/entity.js';

const logger = createLogger('entity-lifecycle-subscriber');

const AGENT_EVENT_SUBJECTS = [
    'agent.*.start',
    'agent.*.end',
    'agent.tool.start',
    'agent.tool.end',
    'agent.tts.amplitude',
];

let lifecycleMessages: AsyncIterable<JsMsg> | null = null;

/**
 * Start listening for agent lifecycle events
 */
export async function startEntityLifecycleSubscriber(nc: NatsConnection): Promise<void> {
    logger.info('Starting entity lifecycle subscriber');

    const js = nc.jetstream();
    const consumersApi = js.consumers as any;
    const jsm = await nc.jetstreamManager();
    let consumer: any;
    try {
        consumer = await consumersApi.get('RUNTIME', 'entity-lifecycle-subscriber');
    } catch (err) {
        const message = String(err || '').toLowerCase();
        const isMissing = message.includes('consumer not found') || message.includes('404');
        if (!isMissing) throw err;
        await jsm.consumers.add('RUNTIME', {
            durable_name: 'entity-lifecycle-subscriber',
            ack_policy: AckPolicy.Explicit,
            deliver_policy: DeliverPolicy.All,
            filter_subject: 'agent.>',
            ack_wait: 30_000_000_000,
            max_deliver: 10,
        });
        consumer = await consumersApi.get('RUNTIME', 'entity-lifecycle-subscriber');
        logger.info('Created missing RUNTIME durable consumer', { durable: 'entity-lifecycle-subscriber' });
    }

    lifecycleMessages = await consumer.consume();
    (async () => {
        for await (const msg of lifecycleMessages!) {
            try {
                const subject = msg.subject;
                const data = JSON.parse(new TextDecoder().decode(msg.data));

                if (subject === 'agent.tts.amplitude') {
                    const { channelId, rms, peak, chunkId, timestamp } = data;
                    if (channelId && rms !== undefined && chunkId) {
                        entityStateService.publishAmplitude(channelId, {
                            rms,
                            peak: peak ?? rms,
                            chunkId,
                            timestamp: timestamp || new Date().toISOString(),
                            channelId,
                        });
                    }
                } else {
                    const event: AgentLifecycleEvent = {
                        type: data.type,
                        channelId: data.channelId,
                        toolName: data.toolName,
                        toolSuccess: data.toolSuccess,
                        ttsChunkId: data.ttsChunkId,
                        timestamp: data.timestamp || new Date().toISOString(),
                        tokenRate: data.tokenRate,
                    };

                    if (event.channelId) {
                        entityStateService.handleAgentEvent(event);
                    }
                }

                msg.ack();
            } catch (err) {
                logger.warn('Failed to process agent event', {
                    subject: msg.subject,
                    error: String(err),
                });
                msg.nak();
            }
        }
    })();

    logger.info('Entity lifecycle subscriber started', {
        durableConsumer: 'entity-lifecycle-subscriber',
        subjects: AGENT_EVENT_SUBJECTS,
    });
}

/**
 * Stop listening for agent events
 */
export async function stopEntityLifecycleSubscriber(): Promise<void> {
    logger.info('Stopping entity lifecycle subscriber');

    lifecycleMessages = null;
}
