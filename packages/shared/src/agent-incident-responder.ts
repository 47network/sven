export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentActionType = 'diagnose' | 'remediate' | 'escalate' | 'rollback' | 'notify' | 'runbook';

export interface AgentIncidentRespConfig {
  id: string; agent_id: string; auto_remediate: boolean; escalation_policy: unknown[];
  runbook_dir: string | null; status: string; created_at: string; updated_at: string;
}
export interface AgentIncident {
  id: string; config_id: string; severity: IncidentSeverity; title: string; description: string;
  state: string; assigned_to: string | null; root_cause: string | null; resolution: string | null;
  opened_at: string; resolved_at: string | null;
}
export interface AgentIncidentAction {
  id: string; incident_id: string; action_type: IncidentActionType; description: string;
  automated: boolean; result: Record<string, unknown>; executed_at: string;
}
