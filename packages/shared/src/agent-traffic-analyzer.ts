export type TrafficCaptureType = 'realtime' | 'scheduled' | 'triggered' | 'retrospective';
export type TrafficCaptureStatus = 'active' | 'paused' | 'completed' | 'archived';
export type TrafficPatternType = 'normal' | 'anomaly' | 'attack' | 'bot' | 'crawler' | 'api_abuse' | 'ddos' | 'exfiltration';
export type TrafficReportType = 'summary' | 'detailed' | 'anomaly' | 'compliance' | 'forensic';

export interface AgentTrafficCapture {
  id: string;
  agentId: string;
  source: string;
  captureType: TrafficCaptureType;
  status: TrafficCaptureStatus;
  filterExpression?: string;
  sampleRate: number;
  bytesCaptured: number;
  packetsCaptured: number;
  startedAt: string;
  endedAt?: string;
  metadata: Record<string, unknown>;
}

export interface AgentTrafficPattern {
  id: string;
  captureId: string;
  patternType: TrafficPatternType;
  confidence: number;
  sourceIps: string[];
  destinationIps: string[];
  protocols: string[];
  description?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
}

export interface AgentTrafficReport {
  id: string;
  agentId: string;
  reportType: TrafficReportType;
  periodStart: string;
  periodEnd: string;
  totalBytes: number;
  totalPackets: number;
  topSources: string[];
  topDestinations: string[];
  protocolBreakdown: Record<string, number>;
  findings: string[];
  metadata: Record<string, unknown>;
}
