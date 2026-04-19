export interface RequestValidatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  validationSchemas: Record<string, unknown>;
  sanitizationRules: Record<string, unknown>[];
  rateLimiting: Record<string, unknown>;
  contentTypePolicies: Record<string, unknown>;
  rejectionHandling: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ValidationResult {
  requestId: string;
  valid: boolean;
  errors: string[];
  sanitized: boolean;
  processingTimeMs: number;
}
export interface ValidationReport {
  totalValidated: number;
  passed: number;
  failed: number;
  topErrors: string[];
  reportPeriod: string;
}
