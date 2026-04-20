// Batch 50 — Agent SLA & Contracts shared types

export type ContractType = 'standard' | 'premium' | 'enterprise' | 'trial' | 'custom';

export type ContractStatus = 'draft' | 'pending_approval' | 'active' | 'suspended' | 'expired' | 'terminated' | 'renewed';

export type SlaMetricType = 'uptime' | 'response_time' | 'throughput' | 'error_rate' | 'completion_rate' | 'latency_p99';

export type SlaComplianceStatus = 'met' | 'warning' | 'breached' | 'exempted';

export type MeasurementWindow = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type PenaltyType = 'none' | 'credit' | 'discount' | 'termination_right' | 'escalation';

export type AmendmentType = 'modification' | 'addendum' | 'renewal' | 'termination_request';

export type AmendmentStatus = 'proposed' | 'under_review' | 'approved' | 'rejected' | 'withdrawn';

export type DisputeType = 'sla_breach' | 'quality_issue' | 'billing_dispute' | 'scope_disagreement' | 'termination_dispute';

export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AgentsDisputeStatus = 'open' | 'investigating' | 'mediation' | 'resolved' | 'escalated' | 'closed';

export interface ServiceContract {
  id: string;
  providerId: string;
  consumerId: string;
  contractType: ContractType;
  title: string;
  description: string | null;
  terms: Record<string, unknown>;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  status: ContractStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SlaDefinition {
  id: string;
  contractId: string;
  metricType: SlaMetricType;
  targetValue: number;
  thresholdWarn: number | null;
  thresholdBreach: number | null;
  measurementWindow: MeasurementWindow;
  penaltyType: PenaltyType;
  penaltyValue: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SlaMeasurement {
  id: string;
  slaId: string;
  measuredValue: number;
  targetValue: number;
  compliance: SlaComplianceStatus;
  periodStart: string;
  periodEnd: string;
  details: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ContractAmendment {
  id: string;
  contractId: string;
  amendmentType: AmendmentType;
  description: string;
  oldTerms: Record<string, unknown>;
  newTerms: Record<string, unknown>;
  proposedBy: string;
  status: AmendmentStatus;
  approvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ContractDispute {
  id: string;
  contractId: string;
  slaId: string | null;
  raisedBy: string;
  disputeType: DisputeType;
  severity: DisputeSeverity;
  description: string;
  evidence: unknown[];
  resolution: string | null;
  resolvedBy: string | null;
  status: AgentsDisputeStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
}

export const CONTRACT_TYPES: readonly ContractType[] = ['standard', 'premium', 'enterprise', 'trial', 'custom'] as const;

export const SLA_METRIC_TYPES: readonly SlaMetricType[] = ['uptime', 'response_time', 'throughput', 'error_rate', 'completion_rate', 'latency_p99'] as const;

export const MEASUREMENT_WINDOWS: readonly MeasurementWindow[] = ['hourly', 'daily', 'weekly', 'monthly', 'quarterly'] as const;

export const PENALTY_TYPES: readonly PenaltyType[] = ['none', 'credit', 'discount', 'termination_right', 'escalation'] as const;

export const DISPUTE_SEVERITIES: readonly DisputeSeverity[] = ['low', 'medium', 'high', 'critical'] as const;

export const DISPUTE_TYPES: readonly DisputeType[] = ['sla_breach', 'quality_issue', 'billing_dispute', 'scope_disagreement', 'termination_dispute'] as const;

export function isSlaBreached(measured: number, target: number, metricType: SlaMetricType): boolean {
  if (metricType === 'error_rate' || metricType === 'response_time' || metricType === 'latency_p99') {
    return measured > target;
  }
  return measured < target;
}

export function getComplianceStatus(measured: number, target: number, warnThreshold: number | null, metricType: SlaMetricType): SlaComplianceStatus {
  if (isSlaBreached(measured, target, metricType)) return 'breached';
  if (warnThreshold !== null && isSlaBreached(measured, warnThreshold, metricType)) return 'warning';
  return 'met';
}

export function isContractActive(contract: Pick<ServiceContract, 'status' | 'startDate' | 'endDate'>): boolean {
  if (contract.status !== 'active') return false;
  const now = new Date();
  if (new Date(contract.startDate) > now) return false;
  if (contract.endDate && new Date(contract.endDate) < now) return false;
  return true;
}

export function calculateSlaScore(measurements: Pick<SlaMeasurement, 'compliance'>[]): number {
  if (measurements.length === 0) return 100;
  const met = measurements.filter(m => m.compliance === 'met' || m.compliance === 'exempted').length;
  return Math.round((met / measurements.length) * 10000) / 100;
}
