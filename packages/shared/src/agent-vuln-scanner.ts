export type ScanType = 'dependency' | 'container' | 'code' | 'infrastructure' | 'secret';
export type VulnSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export interface AgentVulnScanConfig {
  id: string; agent_id: string; scan_type: ScanType; schedule_cron: string;
  severity_threshold: VulnSeverity; auto_fix: boolean; status: string; created_at: string; updated_at: string;
}
export interface AgentVulnScan {
  id: string; config_id: string; scan_type: ScanType; target: string; state: string;
  total_found: number; critical: number; high: number; started_at: string; completed_at: string | null;
}
export interface AgentVulnerability {
  id: string; scan_id: string; cve_id: string | null; severity: VulnSeverity;
  package_name: string; affected_version: string; fixed_version: string | null;
  description: string; remediation: string | null; patched: boolean; created_at: string;
}
