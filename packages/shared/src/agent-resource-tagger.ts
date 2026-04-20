export interface ResourceTaggerConfig {
  id: string;
  agentId: string;
  tagPolicyName: string;
  requiredTags: string[];
  autoTagEnabled: boolean;
  complianceRate: number;
  lastAuditAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface TagPolicy {
  name: string;
  requiredTags: string[];
  optionalTags: string[];
  enforcementLevel: 'warn' | 'block' | 'auto_fix';
}
export interface TagComplianceReport {
  policyName: string;
  totalResources: number;
  compliantResources: number;
  complianceRate: number;
  violations: Array<{ resourceId: string; missingTags: string[] }>;
}
