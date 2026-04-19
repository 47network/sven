export interface SslInspectorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  scanTargets: string[];
  certificatePolicies: Record<string, unknown>;
  expiryThresholdDays: number;
  protocolRequirements: Record<string, unknown>;
  alertChannels: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface CertificateReport {
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  protocol: string;
  grade: string;
  vulnerabilities: string[];
}
export interface SslComplianceResult {
  target: string;
  compliant: boolean;
  violations: string[];
  recommendations: string[];
  scannedAt: string;
}
