export type SchemaType = 'json_schema' | 'regex' | 'custom' | 'composite' | 'range' | 'enum';

export type SchemaStatus = 'active' | 'deprecated' | 'draft' | 'archived';

export type RuleType = 'required' | 'type' | 'min' | 'max' | 'pattern' | 'enum' | 'custom' | 'range' | 'length' | 'unique';

export type ValidationSeverity = 'error' | 'warning' | 'info' | 'hint';

export type AuditAction = 'validate' | 'skip' | 'override' | 'approve' | 'reject' | 'retry';

export interface ValidationSchema {
  id: string;
  name: string;
  version: string;
  schemaType: SchemaType;
  definition: Record<string, unknown>;
  isStrict: boolean;
  status: SchemaStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRule {
  id: string;
  schemaId: string;
  fieldPath: string;
  ruleType: RuleType;
  constraintValue: Record<string, unknown>;
  errorMessage?: string;
  severity: ValidationSeverity;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataValidationResult {
  id: string;
  schemaId: string;
  inputHash: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  errors: unknown[];
  warnings: unknown[];
  validatedAt: string;
  durationMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ValidationPipeline {
  id: string;
  name: string;
  description?: string;
  stages: unknown[];
  failFast: boolean;
  status: string;
  totalRuns: number;
  passRate: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationAuditEntry {
  id: string;
  pipelineId?: string;
  schemaId?: string;
  action: AuditAction;
  actorId?: string;
  inputSummary?: string;
  resultId?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isSchemaActive(s: ValidationSchema): boolean {
  return s.status === 'active';
}

export function validationPassRate(r: DataValidationResult[]): number {
  if (r.length === 0) return 1;
  return r.filter(x => x.isValid).length / r.length;
}

export function hasErrors(r: DataValidationResult): boolean {
  return r.errorCount > 0;
}
