export type ConvertibleFormat = 'json' | 'csv' | 'xml' | 'yaml' | 'parquet' | 'avro' | 'tsv' | 'excel';
export type ConversionStatus = 'pending' | 'converting' | 'completed' | 'failed' | 'cancelled';
export type EncodingType = 'utf-8' | 'utf-16' | 'ascii' | 'iso-8859-1' | 'windows-1252';
export type DelimiterType = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'custom';

export interface FormatConverterConfig {
  id: string;
  agentId: string;
  supportedFormats: ConvertibleFormat[];
  maxFileSizeMb: number;
  preserveMetadata: boolean;
  encoding: EncodingType;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversionJob {
  id: string;
  configId: string;
  agentId: string;
  sourceFormat: ConvertibleFormat;
  targetFormat: ConvertibleFormat;
  sourcePath?: string;
  outputPath?: string;
  fileSizeBytes: number;
  recordsCount: number;
  status: ConversionStatus;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface FormatMapping {
  id: string;
  configId: string;
  mappingName: string;
  sourceFormat: ConvertibleFormat;
  targetFormat: ConvertibleFormat;
  fieldMappings: Record<string, unknown>;
  transformOptions: Record<string, unknown>;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
