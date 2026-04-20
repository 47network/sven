export type SuiteType = 'unit' | 'integration' | 'e2e' | 'smoke' | 'regression' | 'performance';
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'flaky';
export type HarnessMode = 'sequential' | 'parallel' | 'sharded';

export interface AgentTestHarnessConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  parallelSuites: number;
  timeoutSeconds: number;
  retryFailed: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTestSuite {
  id: string;
  configId: string;
  suiteName: string;
  suiteType: SuiteType;
  testCount: number;
  status: TestStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface AgentTestCase {
  id: string;
  suiteId: string;
  testName: string;
  status: TestStatus;
  assertionCount: number;
  errorMessage?: string;
  durationMs?: number;
  executedAt?: Date;
}
