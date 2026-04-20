export type ConfigStoreType = 'etcd' | 'consul' | 'vault' | 'file' | 'env';
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

export interface AgentConfigMgrConfig {
  id: string;
  agent_id: string;
  store_type: ConfigStoreType;
  encryption_enabled: boolean;
  version_history: number;
  watch_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentConfigEntry {
  id: string;
  config_id: string;
  key_path: string;
  value_encrypted: string;
  value_type: ConfigValueType;
  version: number;
  environment: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConfigHistory {
  id: string;
  entry_id: string;
  old_value?: string;
  new_value: string;
  changed_by?: string;
  change_reason?: string;
  version: number;
  created_at: string;
}
