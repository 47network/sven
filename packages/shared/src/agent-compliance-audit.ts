// Batch 55 — Agent Compliance & Audit shared types

/* ------------------------------------------------------------------ */
/*  Type unions                                                        */
/* ------------------------------------------------------------------ */

export type PolicyType = 'regulatory' | 'operational' | 'security' | 'financial' | 'ethical';

export type PolicyStatus = 'draft' | 'active' | 'suspended' | 'retired' | 'under_review';

export type AuditActionType = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'reject' | 'escalate';

export type AuditOutcome = 'success' | 'failure' | 'partial' | 'denied';

export type CheckType = 'automated' | 'manual' | 'scheduled' | 'triggered' | 'random';

export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'skipped';

export type ComplianceAction = 'policy_create' | 'audit_log' | 'check_run' | 'risk_assess' | 'report_generate' | 'policy_enforce' | 'violation_resolve';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

export interface CompliancePolicy {
  id: string;
  name: string;
  description?: string;
  policy_type: PolicyType;
  status: PolicyStatus;
  rules: Record<string, unknown>[];
  severity: string;
  effective_from?: string;
  effective_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditTrailEntry {
  id: string;
  agent_id: string;
  action_type: AuditActionType;
  resource_type: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  session_id?: string;
  outcome: AuditOutcome;
  risk_level: string;
  created_at: string;
}

export interface ComplianceCheck {
  id: string;
  policy_id: string;
  agent_id?: string;
  check_type: CheckType;
  status: CheckStatus;
  findings: Record<string, unknown>[];
  score?: number;
  checked_at?: string;
  next_check_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskAssessment {
  id: string;
  agent_id: string;
  assessment_type: string;
  risk_score: number;
  risk_level: string;
  factors: Record<string, unknown>[];
  mitigations: Record<string, unknown>[];
  assessed_by?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReport {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  status: string;
  summary: Record<string, unknown>;
  findings_count: number;
  pass_rate?: number;
  generated_by?: string;
  delivered_to: string[];
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const POLICY_TYPES: readonly PolicyType[] = ['regulatory', 'operational', 'security', 'financial', 'ethical'] as const;

export const POLICY_STATUSES: readonly PolicyStatus[] = ['draft', 'active', 'suspended', 'retired', 'under_review'] as const;

export const AUDIT_ACTION_TYPES: readonly AuditActionType[] = ['create', 'read', 'update', 'delete', 'execute', 'approve', 'reject', 'escalate'] as const;

export const AUDIT_OUTCOMES: readonly AuditOutcome[] = ['success', 'failure', 'partial', 'denied'] as const;

export const CHECK_TYPES: readonly CheckType[] = ['automated', 'manual', 'scheduled', 'triggered', 'random'] as const;

export const CHECK_STATUSES: readonly CheckStatus[] = ['pending', 'running', 'passed', 'failed', 'warning', 'skipped'] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function isPolicyActive(status: PolicyStatus): boolean {
  return status === 'active';
}

export function isCheckPassing(status: CheckStatus): boolean {
  return status === 'passed' || status === 'warning';
}

export function isHighRisk(riskLevel: string): boolean {
  return riskLevel === 'critical' || riskLevel === 'high';
}

export function calculatePassRate(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 10000) / 100;
}
