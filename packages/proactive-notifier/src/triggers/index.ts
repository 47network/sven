/**
 * @sven/proactive-notifier — Trigger type definitions
 *
 * Defines the event categories and threshold rules that determine
 * when Sven should proactively reach out to the user.
 */

/** Trigger category — maps to system event domains */
export type TriggerCategory =
  | 'critical_error'
  | 'resource_exhaustion'
  | 'security_alert'
  | 'training_milestone'
  | 'health_degraded'
  | 'task_completed'
  | 'scheduled_digest'
  | 'economy_balance_warning'
  | 'economy_automaton_retiring'
  | 'economy_revenue_milestone'
  | 'custom';

/** Severity levels for proactive notifications */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Priority for delivery ordering */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/** A trigger rule that drives proactive notifications */
export interface TriggerRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable label */
  name: string;
  /** Trigger category */
  category: TriggerCategory;
  /** Whether the rule is active */
  enabled: boolean;
  /** Minimum severity to fire this trigger */
  min_severity: NotificationSeverity;
  /** Cooldown between repeat fires (seconds) */
  cooldown_seconds: number;
  /** Maximum notifications per hour for this rule (0 = unlimited) */
  max_per_hour: number;
  /** JSONPath or dot-notation expression evaluated against event data */
  condition_expression: string;
  /** Template for the notification body — supports {{variable}} placeholders */
  body_template: string;
  /** Channels to dispatch to — empty array means use global defaults */
  target_channels: string[];
  /** ISO timestamp of last time this rule fired */
  last_fired_at: string | null;
  /** Organisation scope (null = global) */
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Default trigger rule presets shipped with the system */
export const DEFAULT_TRIGGER_RULES: Omit<TriggerRule, 'id' | 'last_fired_at' | 'organization_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Critical Error Alert',
    category: 'critical_error',
    enabled: true,
    min_severity: 'critical',
    cooldown_seconds: 300,
    max_per_hour: 10,
    condition_expression: 'event.level === "fatal" || event.level === "error"',
    body_template: '🚨 **Critical Error**\n\n{{event.message}}\n\nService: `{{event.service}}`\nTimestamp: {{event.timestamp}}',
    target_channels: [],
  },
  {
    name: 'Resource Exhaustion Warning',
    category: 'resource_exhaustion',
    enabled: true,
    min_severity: 'warning',
    cooldown_seconds: 600,
    max_per_hour: 5,
    condition_expression: 'event.metric_value >= event.threshold',
    body_template: '⚠️ **Resource Alert**: {{event.resource}} at {{event.metric_value}}% (threshold: {{event.threshold}}%)\n\nHost: `{{event.host}}`',
    target_channels: [],
  },
  {
    name: 'Security Alert',
    category: 'security_alert',
    enabled: true,
    min_severity: 'error',
    cooldown_seconds: 60,
    max_per_hour: 20,
    condition_expression: 'event.type === "auth_failure" || event.type === "brute_force" || event.type === "suspicious_access"',
    body_template: '🔒 **Security Alert**: {{event.type}}\n\n{{event.description}}\n\nSource: `{{event.source_ip}}`\nUser: {{event.user_id}}',
    target_channels: [],
  },
  {
    name: 'Training Milestone Reached',
    category: 'training_milestone',
    enabled: true,
    min_severity: 'info',
    cooldown_seconds: 0,
    max_per_hour: 0,
    condition_expression: 'event.milestone !== undefined',
    body_template: '🎯 **Milestone**: {{event.milestone}}\n\n{{event.description}}',
    target_channels: [],
  },
  {
    name: 'Health Degradation',
    category: 'health_degraded',
    enabled: true,
    min_severity: 'warning',
    cooldown_seconds: 300,
    max_per_hour: 6,
    condition_expression: 'event.status === "degraded" || event.status === "down"',
    body_template: '💔 **Health Degraded**: {{event.service}} is {{event.status}}\n\nChecks failing: {{event.failing_checks}}',
    target_channels: [],
  },
  {
    name: 'Task Completed',
    category: 'task_completed',
    enabled: true,
    min_severity: 'info',
    cooldown_seconds: 0,
    max_per_hour: 0,
    condition_expression: 'event.task_status === "completed"',
    body_template: '✅ **Task Complete**: {{event.task_name}}\n\n{{event.summary}}',
    target_channels: [],
  },
  // ── Economy / Autonomous Revenue ──────────────────────────────────
  {
    name: 'Economy Balance Warning',
    category: 'economy_balance_warning',
    enabled: true,
    min_severity: 'warning',
    cooldown_seconds: 3600,
    max_per_hour: 2,
    condition_expression: 'event.balance < event.min_threshold',
    body_template: '💰 **Low Balance**: Treasury at ${{event.balance}} (minimum: ${{event.min_threshold}})\n\nAccount: `{{event.account_id}}`\nAction required: top-up or reduce spend.',
    target_channels: [],
  },
  {
    name: 'Automaton Retiring',
    category: 'economy_automaton_retiring',
    enabled: true,
    min_severity: 'warning',
    cooldown_seconds: 600,
    max_per_hour: 5,
    condition_expression: 'event.decision === "retire"',
    body_template: '🔻 **Automaton Retiring**: `{{event.automaton_id}}`\n\nROI: {{event.roi}} (threshold: {{event.retire_threshold}})\nLifetime revenue: ${{event.lifetime_revenue}}\nReason: Unprofitable — shutting down to conserve resources.',
    target_channels: [],
  },
  {
    name: 'Revenue Milestone',
    category: 'economy_revenue_milestone',
    enabled: true,
    min_severity: 'info',
    cooldown_seconds: 0,
    max_per_hour: 0,
    condition_expression: 'event.milestone !== undefined',
    body_template: '🚀 **Revenue Milestone**: ${{event.total_revenue}} earned!\n\n{{event.description}}\nTop pipeline: `{{event.top_pipeline}}`',
    target_channels: [],
  },
];

/** Severity ordering for comparisons */
export const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

/** Check whether an event severity meets the trigger's minimum */
export function severityMeetsThreshold(
  eventSeverity: NotificationSeverity,
  minSeverity: NotificationSeverity,
): boolean {
  return SEVERITY_ORDER[eventSeverity] >= SEVERITY_ORDER[minSeverity];
}
