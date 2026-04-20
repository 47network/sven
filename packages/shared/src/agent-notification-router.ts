/* Batch 132 — Agent Notification Router */

export type NotificationChannelType = 'email' | 'slack' | 'webhook' | 'sms' | 'discord' | 'telegram' | 'pagerduty';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

export type NotificationDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'suppressed';

export interface NotifChannel {
  id: string;
  agentId: string;
  channelName: string;
  channelType: NotificationChannelType;
  config: Record<string, unknown>;
  enabled: boolean;
  verified: boolean;
  createdAt: string;
}

export interface NotificationRule {
  id: string;
  agentId: string;
  ruleName: string;
  severity: NotificationSeverity;
  channelId: string;
  filterPattern?: string;
  cooldownSecs: number;
  escalateAfter?: number;
  escalateTo?: string;
  enabled: boolean;
  createdAt: string;
}

export interface NotificationLogEntry {
  id: string;
  ruleId?: string;
  channelId: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  deliveryStatus: NotificationDeliveryStatus;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface NotificationRouterStats {
  totalChannels: number;
  activeRules: number;
  sentToday: number;
  failedToday: number;
  deliveryRate: number;
}
