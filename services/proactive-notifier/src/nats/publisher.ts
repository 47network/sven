import { NatsConnection, JSONCodec } from 'nats';
import { NATS_SUBJECTS } from '@sven/shared';

const jc = JSONCodec();

export class ProactivePublisher {
  constructor(private readonly nc: NatsConnection) {}

  publishNotificationDispatched(logId: string, ruleId: string | null, channel: string, channelChatId: string, category: string, severity: string): void {
    this.nc.publish(NATS_SUBJECTS.NOTIFY_PROACTIVE, jc.encode({
      log_id: logId, rule_id: ruleId, channel, channel_chat_id: channelChatId,
      category, severity, ts: Date.now(),
    }));
  }

  publishFeedbackRecorded(logId: string, action: string): void {
    this.nc.publish(NATS_SUBJECTS.NOTIFY_PROACTIVE_FEEDBACK, jc.encode({
      log_id: logId, action, ts: Date.now(),
    }));
  }

  publishEngineReloaded(rulesCount: number, endpointsCount: number, enabled: boolean): void {
    this.nc.publish('sven.proactive.engine.reloaded', jc.encode({
      rules_count: rulesCount, endpoints_count: endpointsCount, enabled, ts: Date.now(),
    }));
  }

  publishRuleCreated(ruleId: string, category: string, name: string): void {
    this.nc.publish('sven.proactive.rule.created', jc.encode({
      rule_id: ruleId, category, name, ts: Date.now(),
    }));
  }

  publishEndpointCreated(endpointId: string, channel: string, label: string): void {
    this.nc.publish('sven.proactive.endpoint.created', jc.encode({
      endpoint_id: endpointId, channel, label, ts: Date.now(),
    }));
  }
}
