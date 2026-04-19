// Batch 186: Agent Storage Optimizer — storage analysis, deduplication, tiering

export type StorageVolumeType = 'block' | 'object' | 'file' | 'archive' | 'cache';

export type StorageTier = 'hot' | 'warm' | 'cold' | 'archive' | 'standard';

export type StorageVolumeStatus = 'online' | 'offline' | 'degraded' | 'migrating' | 'archived';

export type StorageAnalysisType = 'usage' | 'dedup' | 'tiering' | 'lifecycle' | 'cost' | 'performance';

export type StorageAnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export type StorageActionType = 'archive' | 'delete' | 'deduplicate' | 'compress' | 'tier_move' | 'resize';

export type StorageActionStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled_back';

export interface StorageVolume {
  id: string;
  agent_id: string;
  volume_name: string;
  volume_type: StorageVolumeType;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  usage_percent: number;
  tier: StorageTier;
  iops_limit: number | null;
  throughput_mbps: number | null;
  cost_per_gb_month: number | null;
  status: StorageVolumeStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StorageAnalysis {
  id: string;
  volume_id: string;
  analysis_type: StorageAnalysisType;
  total_files: number;
  duplicate_bytes: number;
  reclaimable_bytes: number;
  cold_data_bytes: number;
  estimated_savings_monthly: number;
  recommendations: unknown[];
  status: StorageAnalysisStatus;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface StorageAction {
  id: string;
  analysis_id: string;
  action_type: StorageActionType;
  target_path: string | null;
  bytes_affected: number;
  bytes_saved: number;
  files_affected: number;
  status: StorageActionStatus;
  approved_by: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  executed_at: string | null;
  created_at: string;
}
