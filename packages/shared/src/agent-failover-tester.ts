export interface FailoverTesterConfig {
  id: string;
  agentId: string;
  targetService: string;
  testType: 'chaos' | 'graceful' | 'network_partition' | 'resource_exhaustion' | 'dependency_failure';
  recoveryTimeTargetS: number;
  lastTestAt: string | null;
  lastRecoveryTimeS: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface FailoverTestResult {
  testId: string;
  targetService: string;
  testType: string;
  passed: boolean;
  recoveryTimeS: number;
  targetRecoveryTimeS: number;
  failureMode: string;
  observations: string[];
}
export interface ResilienceScore {
  service: string;
  score: number;
  testsRun: number;
  testsPassed: number;
  avgRecoveryTimeS: number;
  lastTestedAt: string;
}
