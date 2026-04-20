export type LakehouseFormat = 'iceberg' | 'delta' | 'hudi' | 'parquet';

export interface AgentLakehouseConfig {
  id: string; agent_id: string; format: LakehouseFormat; storage_path: string;
  catalog_type: string; compaction_enabled: boolean; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface AgentLakehouseTable {
  id: string; config_id: string; table_name: string; partition_columns: string[];
  file_count: number; row_count: number; size_bytes: number;
  last_compacted_at?: string; created_at: string;
}

export interface AgentLakehouseSnapshot {
  id: string; table_id: string; snapshot_id: number; parent_snapshot_id?: number;
  operation: string; added_files: number; deleted_files: number; created_at: string;
}
