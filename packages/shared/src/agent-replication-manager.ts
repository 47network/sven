export type ReplicationType = 'streaming' | 'logical' | 'snapshot' | 'bidirectional';
export type NodeRole = 'primary' | 'replica' | 'standby' | 'witness';
export type NodeState = 'initializing' | 'streaming' | 'catchup' | 'synced' | 'disconnected';

export interface AgentReplMgrConfig {
  id: string; agent_id: string; repl_type: ReplicationType; primary_host: string;
  max_replicas: number; sync_mode: string; status: string; created_at: string; updated_at: string;
}
export interface AgentReplNode {
  id: string; config_id: string; node_name: string; host: string; role: NodeRole;
  state: NodeState; lag_bytes: number; lag_seconds: number; last_heartbeat_at: string | null; created_at: string;
}
export interface AgentReplFailover {
  id: string; config_id: string; old_primary: string; new_primary: string;
  trigger_type: string; state: string; data_loss_bytes: number;
  duration_seconds: number; created_at: string; completed_at: string | null;
}
