import { NatsConnection, JSONCodec, type Subscription } from 'nats';
import { ProactiveEngine, type ProactiveEvent } from '@sven/proactive-notifier/engine';

const jc = JSONCodec();

/**
 * Subscribe to system events on NATS and evaluate them via the ProactiveEngine.
 *
 * Subscribes to `sven.proactive.event.>` — any service can publish an event
 * to trigger proactive evaluation (e.g. security-toolkit publishes a
 * security_alert event, health checks publish health_degraded, etc.)
 */
export class ProactiveSubscriber {
  private subs: Subscription[] = [];

  constructor(
    private readonly nc: NatsConnection,
    private readonly engine: ProactiveEngine,
    private readonly logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
  ) {}

  start(): void {
    // Primary event ingestion subject
    const sub = this.nc.subscribe('sven.proactive.event.>');
    this.subs.push(sub);
    this.logger.info('NATS subscriber started', { subject: 'sven.proactive.event.>' });

    void this.processSubscription(sub);

    // Reload trigger on config change
    const reloadSub = this.nc.subscribe('sven.proactive.reload');
    this.subs.push(reloadSub);

    void (async () => {
      for await (const msg of reloadSub) {
        try {
          await this.engine.reload();
          this.logger.info('Engine reloaded via NATS command');
        } catch (err) {
          this.logger.error('Failed to reload engine', { error: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
  }

  private async processSubscription(sub: Subscription): Promise<void> {
    for await (const msg of sub) {
      try {
        const data = jc.decode(msg.data) as Record<string, unknown>;

        const event: ProactiveEvent = {
          event_id: (data.event_id as string) || crypto.randomUUID(),
          occurred_at: (data.occurred_at as string) || new Date().toISOString(),
          category: data.category as ProactiveEvent['category'],
          severity: (data.severity as ProactiveEvent['severity']) || 'info',
          data: (data.data as Record<string, unknown>) || data,
          organization_id: (data.organization_id as string) || null,
        };

        const result = await this.engine.evaluate(event);

        if (result.should_notify) {
          await this.engine.dispatch(event, result);
          this.logger.info('Proactive event processed', {
            event_id: event.event_id,
            category: event.category,
            matched_rules: result.matched_rules.length,
            payloads: result.payloads.length,
          });
        }
      } catch (err) {
        this.logger.error('Failed to process proactive event', {
          subject: msg.subject,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async stop(): Promise<void> {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
    this.subs = [];
  }
}
