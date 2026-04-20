// Batch 52: Agent Notifications & Alerts — shared types

export type NotificationType =
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'task_assigned'
  | 'task_completed'
  | 'payment_received'
  | 'review_requested'
  | 'escalation';

export type NotificationChannel =
  | 'in_app'
  | 'email'
  | 'webhook'
  | 'nats'
  | 'slack';

export type NotificationPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'
  | 'critical';

export type NotificationStatus =
  | 'pending'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export type NotificationFrequency =
  | 'immediate'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'digest';

export type EscalationCondition =
  | 'unread_timeout'
  | 'unacknowledged'
  | 'repeated_failure'
  | 'priority_threshold'
  | 'custom';

export type NotificationAction =
  | 'notification_send'
  | 'notification_read'
  | 'preference_update'
  | 'template_create'
  | 'escalation_configure'
  | 'digest_generate'
  | 'channel_manage';

export interface AgentNotification {
  id: string;
  agentId: string;
  notificationType: NotificationType;
  channel: NotificationChannel;
  title: string;
  body?: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  sourceType?: string;
  sourceId?: string;
  actionUrl?: string;
  metadata: Record<string, unknown>;
  scheduledAt?: string;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  agentId: string;
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  frequency: NotificationFrequency;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  notificationType: NotificationType;
  channel: NotificationChannel;
  subjectTemplate?: string;
  bodyTemplate: string;
  variables: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  notificationType: NotificationType;
  conditionExpr: string;
  escalateAfterMinutes: number;
  escalateTo: string;
  escalationChannel: NotificationChannel;
  maxEscalations: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationDigest {
  agentId: string;
  period: NotificationFrequency;
  notifications: AgentNotification[];
  totalCount: number;
  unreadCount: number;
  generatedAt: string;
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  'info', 'warning', 'error', 'success', 'task_assigned',
  'task_completed', 'payment_received', 'review_requested', 'escalation',
];

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  'in_app', 'email', 'webhook', 'nats', 'slack',
];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  'low', 'normal', 'high', 'urgent', 'critical',
];

export const NOTIFICATION_STATUSES: NotificationStatus[] = [
  'pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'cancelled',
];

export const NOTIFICATION_FREQUENCIES: NotificationFrequency[] = [
  'immediate', 'hourly', 'daily', 'weekly', 'digest',
];

export const NOTIFICATION_ACTIONS: NotificationAction[] = [
  'notification_send', 'notification_read', 'preference_update',
  'template_create', 'escalation_configure', 'digest_generate', 'channel_manage',
];

export function shouldSendNow(priority: NotificationPriority, frequency: NotificationFrequency): boolean {
  if (priority === 'urgent' || priority === 'critical') return true;
  return frequency === 'immediate';
}

export function isHighPriority(priority: NotificationPriority): boolean {
  return priority === 'high' || priority === 'urgent' || priority === 'critical';
}

export function canEscalate(status: NotificationStatus): boolean {
  return status === 'pending' || status === 'sent' || status === 'delivered';
}

export function getUnreadCount(notifications: Pick<AgentNotification, 'readAt'>[]): number {
  return notifications.filter((n) => !n.readAt).length;
}
