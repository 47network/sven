// Batch 206: Data Catalog — metadata management and lineage tracking

export type DataAssetType = 'table' | 'view' | 'stream' | 'file' | 'api_endpoint' | 'model' | 'dashboard' | 'report' | 'dataset';
export type DataTransformationType = 'copy' | 'filter' | 'aggregate' | 'join' | 'derive' | 'enrich' | 'mask' | 'sample';

export interface DataAsset {
  id: string;
  agent_id: string;
  name: string;
  asset_type: DataAssetType;
  source_system?: string;
  schema_info: Record<string, unknown>;
  tags: string[];
  description?: string;
  owner_agent_id?: string;
  quality_score?: number;
  last_profiled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DataLineage {
  id: string;
  source_asset_id: string;
  target_asset_id: string;
  transformation_type: DataTransformationType;
  transformation_config: Record<string, unknown>;
  pipeline_id?: string;
  created_at: string;
}

export interface DataProfile {
  id: string;
  asset_id: string;
  row_count?: number;
  column_count?: number;
  size_bytes?: number;
  null_percentage: Record<string, unknown>;
  unique_counts: Record<string, unknown>;
  value_distributions: Record<string, unknown>;
  anomalies: unknown[];
  profiled_at: string;
}

export type DataCatalogEvent =
  | 'catalog.asset_registered'
  | 'catalog.lineage_traced'
  | 'catalog.profile_completed'
  | 'catalog.quality_scored';
