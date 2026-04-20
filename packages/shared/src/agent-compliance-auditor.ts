export type ComplianceFramework = 'soc2' | 'gdpr' | 'hipaa' | 'pci_dss' | 'iso27001' | 'nist';
export type CheckState = 'pending' | 'checking' | 'passed' | 'failed' | 'waived';
export interface AgentComplianceConfig {
  id: string; agent_id: string; framework: ComplianceFramework; schedule_cron: string;
  auto_remediate: boolean; status: string; created_at: string; updated_at: string;
}
export interface AgentComplianceCheck {
  id: string; config_id: string; control_id: string; control_name: string; category: string;
  state: CheckState; compliant: boolean | null; evidence: Record<string, unknown>; checked_at: string;
}
export interface AgentComplianceReport {
  id: string; config_id: string; framework: ComplianceFramework; period_start: string; period_end: string;
  total_controls: number; passing: number; failing: number; score: number; generated_at: string;
}
