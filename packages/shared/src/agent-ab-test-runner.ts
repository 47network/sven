export type ABTestStatus = 'draft' | 'running' | 'paused' | 'concluded' | 'cancelled';
export type ABVariant = 'control' | 'test';
export type ABWinner = 'control' | 'test' | 'inconclusive';

export interface ABTestRunnerConfig {
  id: string;
  agentId: string;
  minSampleSize: number;
  confidenceLevel: number;
  maxDurationDays: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ABTest {
  id: string;
  configId: string;
  name: string;
  hypothesis?: string;
  controlVariant: Record<string, unknown>;
  testVariant: Record<string, unknown>;
  trafficSplit: number;
  status: ABTestStatus;
  winner?: ABWinner;
  createdAt: string;
}

export interface ABResult {
  id: string;
  testId: string;
  variant: ABVariant;
  impressions: number;
  conversions: number;
  conversionRate: number;
  pValue?: number;
  recordedAt: string;
}
