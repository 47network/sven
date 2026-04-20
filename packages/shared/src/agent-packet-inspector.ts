export type InspectionDepth = 'header' | 'shallow' | 'deep' | 'full';
export type PacketProtocol = 'tcp' | 'udp' | 'http' | 'https' | 'dns' | 'icmp' | 'quic';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type CaptureStatus = 'running' | 'completed' | 'stopped' | 'error';

export interface AgentInspectionPolicy {
  id: string;
  agentId: string;
  policyName: string;
  inspectionDepth: InspectionDepth;
  protocols: string[];
  capturePayload: boolean;
  maxPacketSize: number;
  retentionHours: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPacketCapture {
  id: string;
  policyId: string;
  captureStart: string;
  captureEnd: string | null;
  packetCount: number;
  bytesCaptured: number;
  protocolBreakdown: Record<string, number>;
  anomaliesDetected: number;
  storagePath: string | null;
  status: CaptureStatus;
  createdAt: string;
}

export interface AgentPacketAnomaly {
  id: string;
  captureId: string;
  anomalyType: string;
  severity: AnomalySeverity;
  sourceIp: string | null;
  destinationIp: string | null;
  protocol: string | null;
  description: string | null;
  rawData: Record<string, unknown>;
  detectedAt: string;
}
