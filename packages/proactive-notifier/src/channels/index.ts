/**
 * @sven/proactive-notifier — Channel dispatcher
 *
 * Resolves the target delivery channels for a proactive notification
 * and formats payloads for the outbox / NATS publish flow.
 */

import type { TriggerRule, NotificationSeverity, NotificationPriority } from '../triggers/index.js';

/** Supported delivery channel types */
export type ChannelType = 'slack' | 'discord' | 'whatsapp' | 'matrix' | 'telegram' | 'email' | 'push' | 'webhook';

/** A configured channel endpoint for proactive delivery */
export interface ChannelEndpoint {
  /** Unique endpoint id */
  id: string;
  /** Channel adapter type */
  channel: ChannelType;
  /** The chat/channel/room ID in the adapter's namespace */
  channel_chat_id: string;
  /** Human-readable label (e.g. "#ops-alerts") */
  label: string;
  /** Whether this endpoint is active */
  enabled: boolean;
  /** Minimum severity to deliver to this endpoint */
  min_severity: NotificationSeverity;
  /** Organisation scope (null = global) */
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Global config stored in settings_global under `proactive_notifications.config` */
export interface ProactiveNotificationConfig {
  /** Master kill switch */
  enabled: boolean;
  /** Global cooldown between any proactive notification (seconds) */
  global_cooldown_seconds: number;
  /** Maximum proactive notifications per hour across all rules */
  global_max_per_hour: number;
  /** Default channel endpoints when a rule has empty target_channels */
  default_channel_ids: string[];
  /** Whether Sven can generate ad-hoc proactive messages beyond trigger rules */
  allow_freeform_proactive: boolean;
  /** Quiet hours — suppress non-critical during these windows (UTC HH:MM) */
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  /** Feedback learning: suppress rules that user frequently dismisses */
  adaptive_suppression: boolean;
}

/** Default config shipped with the system */
export const DEFAULT_CONFIG: ProactiveNotificationConfig = {
  enabled: true,
  global_cooldown_seconds: 30,
  global_max_per_hour: 60,
  default_channel_ids: [],
  allow_freeform_proactive: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  adaptive_suppression: true,
};

/** A proactive notification ready for outbox dispatch */
export interface ProactiveOutboxPayload {
  /** The rule that triggered this notification (null for freeform) */
  rule_id: string | null;
  /** Channel adapter type */
  channel: ChannelType;
  /** Target chat ID in the adapter namespace */
  channel_chat_id: string;
  /** Formatted notification text (Markdown) */
  text: string;
  /** Block-kit / rich content payload */
  blocks: Array<{ type: string; content: string }>;
  /** Priority for delivery ordering */
  priority: NotificationPriority;
  /** Idempotency key to prevent duplicate delivery */
  idempotency_key: string;
}

/** Map severity to delivery priority */
export function severityToPriority(severity: NotificationSeverity): NotificationPriority {
  switch (severity) {
    case 'critical': return 'critical';
    case 'error': return 'high';
    case 'warning': return 'normal';
    case 'info': return 'low';
  }
}

/** Render a body template with {{variable}} placeholders */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, path: string) => {
    const keys = path.trim().split('.');
    let value: unknown = data;
    for (const key of keys) {
      if (value === null || value === undefined) break;
      value = (value as Record<string, unknown>)[key];
    }
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

/** Build the outbox payload for a triggered notification */
export function buildOutboxPayload(
  rule: TriggerRule,
  eventData: Record<string, unknown>,
  endpoint: ChannelEndpoint,
  idempotencyKey: string,
): ProactiveOutboxPayload {
  const text = renderTemplate(rule.body_template, { event: eventData });
  return {
    rule_id: rule.id,
    channel: endpoint.channel,
    channel_chat_id: endpoint.channel_chat_id,
    text,
    blocks: [{ type: 'markdown', content: text }],
    priority: severityToPriority(rule.min_severity),
    idempotency_key: idempotencyKey,
  };
}

/** Check if current UTC time is within quiet hours */
export function isInQuietHours(
  config: ProactiveNotificationConfig,
  now: Date = new Date(),
): boolean {
  if (!config.quiet_hours_start || !config.quiet_hours_end) return false;

  const parseHHMM = (s: string): number => {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const startMin = parseHHMM(config.quiet_hours_start);
  const endMin = parseHHMM(config.quiet_hours_end);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Wraps midnight (e.g. 22:00 – 07:00)
  return nowMin >= startMin || nowMin < endMin;
}
