/* Batch 136 — Agent Blue-Green Deployment types */

export type BlueGreenStage = 'blue' | 'green';
export type BlueGreenStatus = 'idle' | 'deploying' | 'testing' | 'switching' | 'switched' | 'rolling_back' | 'failed';
export type TrafficStrategy = 'immediate' | 'gradual' | 'canary' | 'random';

export interface BlueGreenDeployment {
  id: string;
  serviceName: string;
  environment: string;
  activeStage: BlueGreenStage;
  status: BlueGreenStatus;
  blueVersion?: string;
  greenVersion?: string;
  blueHealth: Record<string, unknown>;
  greenHealth: Record<string, unknown>;
  trafficSplit: { blue: number; green: number };
  switchCriteria: Record<string, unknown>;
  metadata: Record<string, unknown>;
  lastSwitchAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlueGreenSwitch {
  id: string;
  deploymentId: string;
  fromStage: BlueGreenStage;
  toStage: BlueGreenStage;
  reason?: string;
  initiatedBy?: string;
  healthBefore: Record<string, unknown>;
  healthAfter: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  createdAt: string;
}

export interface TrafficSplit {
  id: string;
  deploymentId: string;
  bluePercent: number;
  greenPercent: number;
  strategy: TrafficStrategy;
  stepPercent: number;
  stepInterval: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlueGreenStats {
  totalDeployments: number;
  activeDeployments: number;
  switchesToday: number;
  successRate: number;
  avgSwitchDuration: number;
  byService: Array<{ service: string; switches: number; lastSwitch: string }>;
}
