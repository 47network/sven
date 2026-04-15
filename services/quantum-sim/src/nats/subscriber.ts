import type { NatsConnection, Subscription } from 'nats';
import { StringCodec } from 'nats';
import { NATS_SUBJECTS } from '@sven/shared';

const sc = StringCodec();

export interface NatsPublisherDeps {
  nc: NatsConnection;
}

export function publishJobCompleted(deps: NatsPublisherDeps, jobId: string, result: unknown): void {
  deps.nc.publish(NATS_SUBJECTS.QUANTUM_JOB_COMPLETED, sc.encode(JSON.stringify({ jobId, result })));
  deps.nc.publish(NATS_SUBJECTS.quantumJobStatus(jobId), sc.encode(JSON.stringify({ status: 'completed', jobId })));
}

export function publishJobFailed(deps: NatsPublisherDeps, jobId: string, error: string): void {
  deps.nc.publish(NATS_SUBJECTS.QUANTUM_JOB_FAILED, sc.encode(JSON.stringify({ jobId, error })));
  deps.nc.publish(NATS_SUBJECTS.quantumJobStatus(jobId), sc.encode(JSON.stringify({ status: 'failed', jobId, error })));
}

export function publishJobStatus(deps: NatsPublisherDeps, jobId: string, status: string): void {
  deps.nc.publish(NATS_SUBJECTS.quantumJobStatus(jobId), sc.encode(JSON.stringify({ status, jobId })));
}

export interface SubscriberDeps {
  nc: NatsConnection;
  onSubmit: (payload: { circuitJson: unknown; shots: number; backendId: string; orgId: string }) => Promise<string>;
  onCancel: (jobId: string) => Promise<boolean>;
  logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

export function subscribeToNats(deps: SubscriberDeps): Subscription[] {
  const subs: Subscription[] = [];

  // Job submit
  const submitSub = deps.nc.subscribe(NATS_SUBJECTS.QUANTUM_JOB_SUBMIT);
  subs.push(submitSub);
  void (async () => {
    for await (const msg of submitSub) {
      try {
        const payload = JSON.parse(sc.decode(msg.data)) as {
          circuitJson: unknown;
          shots: number;
          backendId: string;
          orgId: string;
        };
        const jobId = await deps.onSubmit(payload);
        if (msg.reply) {
          msg.respond(sc.encode(JSON.stringify({ ok: true, jobId })));
        }
      } catch (err) {
        deps.logger.error('NATS quantum.job.submit handler error', err);
        if (msg.reply) {
          msg.respond(sc.encode(JSON.stringify({ ok: false, error: String(err) })));
        }
      }
    }
  })();

  // Job cancel
  const cancelSub = deps.nc.subscribe(NATS_SUBJECTS.QUANTUM_JOB_CANCEL);
  subs.push(cancelSub);
  void (async () => {
    for await (const msg of cancelSub) {
      try {
        const { jobId } = JSON.parse(sc.decode(msg.data)) as { jobId: string };
        const cancelled = await deps.onCancel(jobId);
        if (msg.reply) {
          msg.respond(sc.encode(JSON.stringify({ ok: cancelled, jobId })));
        }
      } catch (err) {
        deps.logger.error('NATS quantum.job.cancel handler error', err);
        if (msg.reply) {
          msg.respond(sc.encode(JSON.stringify({ ok: false, error: String(err) })));
        }
      }
    }
  })();

  return subs;
}
