export interface UptimeReporterConfig {
  id: string;
  agentId: string;
  targetName: string;
  slaTargetPercent: number;
  reportingInterval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  downtimeMinutes: number;
  lastReportAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface UptimeReport {
  targetName: string;
  period: string;
  uptimePercent: number;
  downtimeMinutes: number;
  slaTarget: number;
  slaMet: boolean;
  incidents: number;
}
export interface DowntimeIncident {
  id: string;
  targetName: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number;
  cause: string;
}
