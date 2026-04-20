export type SchemaFormat = 'json_schema' | 'avro' | 'protobuf' | 'openapi' | 'graphql' | 'custom';

export type CompatibilityMode = 'backward' | 'forward' | 'full' | 'none';

export type RegistryStatus = 'active' | 'deprecated' | 'archived' | 'draft';

export type SchemaDependencyType = 'required' | 'optional' | 'dev';

export type SchemaEvolutionType = 'create' | 'update' | 'deprecate' | 'archive' | 'restore' | 'fork';

export interface SchemaRegistryEntry {
  id: string;
  namespace: string;
  name: string;
  version: string;
  schemaFormat: SchemaFormat;
  definition: Record<string, unknown>;
  compatibility: CompatibilityMode;
  status: RegistryStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaVersion {
  id: string;
  registryId: string;
  version: string;
  definition: Record<string, unknown>;
  changelog?: string;
  isBreaking: boolean;
  publishedBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SchemaDependency {
  id: string;
  schemaId: string;
  dependsOn: string;
  dependencyType: SchemaDependencyType;
  versionConstraint?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SchemaConsumer {
  id: string;
  schemaId: string;
  consumerId: string;
  consumerType: string;
  subscribedVersion?: string;
  lastUsedAt?: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SchemaEvolutionEntry {
  id: string;
  schemaId: string;
  fromVersion?: string;
  toVersion: string;
  evolutionType: SchemaEvolutionType;
  changes: unknown[];
  impactAssessment?: string;
  approvedBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isSchemaBreaking(v: SchemaVersion): boolean {
  return v.isBreaking;
}

export function isCompatible(mode: CompatibilityMode, hasBreaking: boolean): boolean {
  if (mode === 'none') return true;
  return !hasBreaking;
}

export function schemaFullName(entry: SchemaRegistryEntry): string {
  return entry.namespace + '/' + entry.name + '@' + entry.version;
}
