// ---------------------------------------------------------------------------
// Integration Agents Agency — shared types for Batch 39
// Self-evolving agents that wrap third-party SaaS platforms and sell their
// use on the marketplace. Auto-detect API changes, fix breaks, learn new
// capabilities over time.
// ---------------------------------------------------------------------------

export type IntegrationCategory =
  | 'project_management'
  | 'crm'
  | 'marketing'
  | 'support'
  | 'hr'
  | 'finance'
  | 'devops'
  | 'communication'
  | 'analytics'
  | 'ecommerce'
  | 'design'
  | 'legal'
  | 'custom';

export type IntegrationAuthType =
  | 'oauth2'
  | 'api_key'
  | 'basic'
  | 'token'
  | 'webhook'
  | 'saml'
  | 'custom';

export type PlatformStatus =
  | 'discovered'
  | 'analyzing'
  | 'building'
  | 'testing'
  | 'active'
  | 'deprecated'
  | 'broken'
  | 'archived';

export type AgentHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'broken'
  | 'updating'
  | 'learning';

export type EvolutionType =
  | 'api_change_detected'
  | 'skill_learned'
  | 'bug_fixed'
  | 'capability_added'
  | 'performance_improved'
  | 'breaking_change_resolved'
  | 'new_endpoint_covered'
  | 'auth_updated'
  | 'deprecation_handled';

export type SubscriptionPlan =
  | 'free_trial'
  | 'basic'
  | 'pro'
  | 'enterprise'
  | 'custom';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

// ---------------------------------------------------------------------------

export interface IntegrationPlatform {
  id: string;
  name: string;
  slug: string;
  category: IntegrationCategory;
  websiteUrl: string | null;
  apiDocsUrl: string | null;
  authType: IntegrationAuthType;
  apiVersion: string | null;
  status: PlatformStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationAgent {
  id: string;
  platformId: string;
  agentId: string;
  name: string;
  description: string | null;
  capabilities: string[];
  supportedActions: string[];
  apiCoveragePct: number;
  healthStatus: AgentHealthStatus;
  version: string;
  totalInvocations: number;
  successRate: number;
  revenueTokens: number;
  lastHealthCheck: Date | null;
  lastApiSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationEvolution {
  id: string;
  agentId: string;
  evolutionType: EvolutionType;
  description: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  autoResolved: boolean;
  resolutionMs: number | null;
  createdAt: Date;
}

export interface IntegrationSubscription {
  id: string;
  agentId: string;
  subscriberId: string;
  plan: SubscriptionPlan;
  monthlyTokens: number;
  invocationsUsed: number;
  invocationsLimit: number | null;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INTEGRATION_CATEGORIES: readonly IntegrationCategory[] = [
  'project_management', 'crm', 'marketing', 'support',
  'hr', 'finance', 'devops', 'communication',
  'analytics', 'ecommerce', 'design', 'legal', 'custom',
] as const;

export const PLATFORM_STATUS_ORDER: readonly PlatformStatus[] = [
  'discovered', 'analyzing', 'building', 'testing', 'active',
] as const;

export const EVOLUTION_TYPES: readonly EvolutionType[] = [
  'api_change_detected', 'skill_learned', 'bug_fixed',
  'capability_added', 'performance_improved', 'breaking_change_resolved',
  'new_endpoint_covered', 'auth_updated', 'deprecation_handled',
] as const;

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  project_management: 'Project Management',
  crm: 'CRM',
  marketing: 'Marketing',
  support: 'Customer Support',
  hr: 'Human Resources',
  finance: 'Finance & Accounting',
  devops: 'DevOps & CI/CD',
  communication: 'Communication',
  analytics: 'Analytics & BI',
  ecommerce: 'E-Commerce',
  design: 'Design & Creative',
  legal: 'Legal & Compliance',
  custom: 'Custom',
};

/** Well-known platforms that agents should prioritize wrapping */
export const SEED_PLATFORMS: ReadonlyArray<{ name: string; slug: string; category: IntegrationCategory }> = [
  { name: 'Atlassian Jira', slug: 'atlassian-jira', category: 'project_management' },
  { name: 'Atlassian Confluence', slug: 'atlassian-confluence', category: 'project_management' },
  { name: 'Salesforce', slug: 'salesforce', category: 'crm' },
  { name: 'HubSpot', slug: 'hubspot', category: 'crm' },
  { name: 'Zendesk', slug: 'zendesk', category: 'support' },
  { name: 'Freshdesk', slug: 'freshdesk', category: 'support' },
  { name: 'Monday.com', slug: 'monday', category: 'project_management' },
  { name: 'Asana', slug: 'asana', category: 'project_management' },
  { name: 'Notion', slug: 'notion', category: 'project_management' },
  { name: 'Linear', slug: 'linear', category: 'project_management' },
  { name: 'Trello', slug: 'trello', category: 'project_management' },
  { name: 'ServiceNow', slug: 'servicenow', category: 'support' },
  { name: 'QuickBooks', slug: 'quickbooks', category: 'finance' },
  { name: 'Xero', slug: 'xero', category: 'finance' },
  { name: 'Shopify', slug: 'shopify', category: 'ecommerce' },
  { name: 'WooCommerce', slug: 'woocommerce', category: 'ecommerce' },
  { name: 'Mailchimp', slug: 'mailchimp', category: 'marketing' },
  { name: 'SendGrid', slug: 'sendgrid', category: 'marketing' },
  { name: 'Figma', slug: 'figma', category: 'design' },
  { name: 'Canva', slug: 'canva', category: 'design' },
  { name: 'BambooHR', slug: 'bamboohr', category: 'hr' },
  { name: 'Workday', slug: 'workday', category: 'hr' },
  { name: 'Datadog', slug: 'datadog', category: 'devops' },
  { name: 'PagerDuty', slug: 'pagerduty', category: 'devops' },
  { name: 'Intercom', slug: 'intercom', category: 'communication' },
  { name: 'Twilio', slug: 'twilio', category: 'communication' },
  { name: 'Google Analytics', slug: 'google-analytics', category: 'analytics' },
  { name: 'Mixpanel', slug: 'mixpanel', category: 'analytics' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function canAdvancePlatform(current: PlatformStatus, next: PlatformStatus): boolean {
  const ci = PLATFORM_STATUS_ORDER.indexOf(current);
  const ni = PLATFORM_STATUS_ORDER.indexOf(next);
  if (ci === -1 || ni === -1) return false;
  return ni === ci + 1;
}

export function isHealthy(status: AgentHealthStatus): boolean {
  return status === 'healthy';
}

export function needsAttention(status: AgentHealthStatus): boolean {
  return status === 'degraded' || status === 'broken';
}
