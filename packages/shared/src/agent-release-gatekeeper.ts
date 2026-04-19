export type GateType = 'tests' | 'security' | 'review' | 'staging' | 'performance' | 'compliance';
export type CandidateState = 'candidate' | 'evaluating' | 'promoted' | 'rejected' | 'expired';

export interface AgentReleaseGateConfig {
  id: string; agent_id: string; gates: GateType[]; auto_promote: boolean;
  notification_channels: string[]; status: string; created_at: string; updated_at: string;
}
export interface AgentReleaseCandidate {
  id: string; config_id: string; version: string; source_branch: string;
  commit_sha: string; state: CandidateState;
  promoted_at: string | null; rejected_at: string | null; created_at: string;
}
export interface AgentReleaseGateResult {
  id: string; candidate_id: string; gate_name: GateType; passed: boolean;
  details: Record<string, unknown>; evaluated_by: string; evaluated_at: string;
}
