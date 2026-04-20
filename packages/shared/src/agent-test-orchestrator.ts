export type TestFramework = 'jest' | 'mocha' | 'vitest' | 'pytest' | 'playwright' | 'cypress';
export type TestRunState = 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';

export interface AgentTestOrchConfig {
  id: string; agent_id: string; framework: TestFramework; test_directory: string;
  parallel_workers: number; coverage_threshold: number;
  status: string; created_at: string; updated_at: string;
}
export interface AgentTestRun {
  id: string; config_id: string; suite_name: string; total_tests: number;
  passed: number; failed: number; skipped: number; coverage_percent: number;
  duration_ms: number; state: TestRunState; created_at: string;
}
export interface AgentTestFailure {
  id: string; run_id: string; test_name: string; error_message: string;
  stack_trace: string; retry_count: number; fixed: boolean; created_at: string;
}
