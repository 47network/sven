// Batch 183: Agent Patch Manager — software patch tracking, rollouts, compliance

export type PatchSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type PatchPolicyStatus = 'active' | 'paused' | 'disabled' | 'archived';

export type PatchReleaseStatus = 'pending' | 'approved' | 'rolling_out' | 'completed' | 'failed' | 'rolled_back';

export type PatchComplianceStatus = 'compliant' | 'non_compliant' | 'pending' | 'exempt' | 'unknown';

export interface PatchPolicy {
  id: string;
  agent_id: string;
  policy_name: string;
  target_scope: string;
  auto_approve: boolean;
  maintenance_window: Record<string, unknown>;
  severity_filter: PatchSeverity[];
  exclusions: unknown[];
  max_concurrent: number;
  rollback_on_failure: boolean;
  status: PatchPolicyStatus;
  created_at: string;
  updated_at: string;
}

export interface PatchRelease {
  id: string;
  policy_id: string;
  patch_name: string;
  version: string;
  severity: PatchSeverity;
  cve_ids: string[];
  affected_systems: number;
  patched_systems: number;
  failed_systems: number;
  status: PatchReleaseStatus;
  release_notes: string | null;
  metadata: Record<string, unknown>;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PatchCompliance {
  id: string;
  policy_id: string;
  target_host: string;
  current_version: string | null;
  required_version: string | null;
  compliance_status: PatchComplianceStatus;
  last_scan_at: string | null;
  last_patched_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
