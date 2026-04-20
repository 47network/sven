export type MigrationDirection = 'up' | 'down';
export type MigrationState = 'pending' | 'applied' | 'rolled_back' | 'failed' | 'skipped';

export interface AgentSchemaMigConfig {
  id: string; agent_id: string; db_type: string; migrations_dir: string;
  auto_apply: boolean; lock_timeout_seconds: number; status: string; created_at: string; updated_at: string;
}
export interface AgentSchemaMigration {
  id: string; config_id: string; version: string; name: string;
  direction: MigrationDirection; state: MigrationState; checksum: string;
  applied_at: string | null; rolled_back_at: string | null; created_at: string;
}
export interface AgentSchemaDiff {
  id: string; config_id: string; from_version: string; to_version: string;
  diff_sql: string; tables_affected: string[]; breaking: boolean; created_at: string;
}
