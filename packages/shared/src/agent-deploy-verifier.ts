export interface DeployVerifierConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  verificationChecks: string[];
  timeoutSeconds: number;
  retryCount: number;
  notificationOnFailure: boolean;
  approvalRequired: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  id: string;
  configId: string;
  deploymentId: string;
  checkName: string;
  passed: boolean;
  details: string;
  duration: number;
  executedAt: string;
}

export interface DeploymentApproval {
  id: string;
  verificationId: string;
  approvedBy: string | null;
  status: string;
  comments: string | null;
  decidedAt: string | null;
}
