// ---------------------------------------------------------------------------
// Agent Service Domains — shared types for Batch 37
// Agents spawn independent service businesses at *.from.sven.systems
// ---------------------------------------------------------------------------

export type ServiceType =
  | 'research_lab'
  | 'consulting'
  | 'design_studio'
  | 'translation_bureau'
  | 'writing_house'
  | 'data_analytics'
  | 'dev_shop'
  | 'marketing_agency'
  | 'legal_office'
  | 'education_center'
  | 'custom';

export type DomainStatus = 'provisioning' | 'active' | 'suspended' | 'archived';

export type DeployStatus = 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'rolled_back';

export type DomainHealthStatus = 'healthy' | 'degraded' | 'down';

export const SERVICE_TYPES: readonly ServiceType[] = [
  'research_lab', 'consulting', 'design_studio', 'translation_bureau',
  'writing_house', 'data_analytics', 'dev_shop', 'marketing_agency',
  'legal_office', 'education_center', 'custom',
] as const;

export const DOMAIN_BASE = 'from.sven.systems';

export interface ServiceTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  serviceType: ServiceType;
  defaultConfig: Record<string, unknown>;
  requiredSkills: string[];
  baseCostTokens: number;
  createdAt: string;
}

export interface AgentServiceDomain {
  id: string;
  agentId: string;
  subdomain: string;
  displayName: string;
  serviceType: ServiceType;
  templateId: string | null;
  status: DomainStatus;
  config: Record<string, unknown>;
  branding: {
    primaryColor?: string;
    logoUrl?: string;
    tagline?: string;
    description?: string;
  };
  revenueTotal: number;
  visitorCount: number;
  tokensInvested: number;
  createdAt: string;
  activatedAt: string | null;
  updatedAt: string;
}

export interface ServiceDeployment {
  id: string;
  domainId: string;
  version: number;
  deployStatus: DeployStatus;
  containerId: string | null;
  port: number | null;
  healthUrl: string | null;
  lastHealth: DomainHealthStatus | null;
  buildLog: string | null;
  deployedAt: string | null;
  createdAt: string;
}

export interface ServiceDomainAnalytics {
  id: string;
  domainId: string;
  day: string;
  pageViews: number;
  uniqueVisitors: number;
  ordersCount: number;
  revenueUsd: number;
  avgResponseMs: number | null;
  errorCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function fullDomain(subdomain: string): string {
  return `${subdomain}.${DOMAIN_BASE}`;
}

export function fullUrl(subdomain: string, secure = true): string {
  const proto = secure ? 'https' : 'http';
  return `${proto}://${subdomain}.${DOMAIN_BASE}`;
}

export function isValidSubdomain(s: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s);
}

export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'mail', 'ftp', 'ns1', 'ns2',
  'cdn', 'static', 'assets', 'docs', 'blog', 'status',
  'landing', 'app', 'dashboard', 'portal', 'auth', 'sso',
]);

export function isSubdomainAvailable(subdomain: string): boolean {
  return isValidSubdomain(subdomain) && !RESERVED_SUBDOMAINS.has(subdomain);
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  research_lab: 'Research Laboratory',
  consulting: 'Consulting Firm',
  design_studio: 'Design Studio',
  translation_bureau: 'Translation Bureau',
  writing_house: 'Writing House',
  data_analytics: 'Data Analytics',
  dev_shop: 'Development Shop',
  marketing_agency: 'Marketing Agency',
  legal_office: 'Legal Office',
  education_center: 'Education Center',
  custom: 'Custom Service',
};
