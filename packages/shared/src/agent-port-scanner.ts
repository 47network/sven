export type PortScanType = 'tcp_connect' | 'syn' | 'udp' | 'service_detection' | 'os_fingerprint';
export type ScanTargetStatus = 'active' | 'paused' | 'archived';
export type PortState = 'open' | 'closed' | 'filtered' | 'open|filtered';
export type PortRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface AgentScanTarget {
  id: string;
  agentId: string;
  targetHost: string;
  portRange: string;
  scanType: PortScanType;
  scheduleCron: string | null;
  lastScanAt: string | null;
  status: ScanTargetStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentScanResult {
  id: string;
  targetId: string;
  scanStartedAt: string;
  scanCompletedAt: string | null;
  openPorts: number[];
  closedPortsCount: number;
  filteredPortsCount: number;
  osDetection: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentPortService {
  id: string;
  resultId: string;
  portNumber: number;
  protocol: 'tcp' | 'udp';
  state: PortState;
  serviceName: string | null;
  serviceVersion: string | null;
  banner: string | null;
  riskLevel: PortRiskLevel | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
