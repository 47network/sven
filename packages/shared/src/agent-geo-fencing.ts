/* Batch 133 — Agent Geo-Fencing types */

export type GeoFenceType = 'circle' | 'polygon' | 'rectangle' | 'country' | 'region';
export type GeoFenceRuleType = 'allow' | 'deny' | 'alert' | 'throttle' | 'redirect';
export type GeoAlertType = 'entry' | 'exit' | 'dwell' | 'violation' | 'anomaly';
export type GeoAlertSeverity = 'info' | 'warning' | 'critical';

export interface GeoFenceZone {
  id: string;
  name: string;
  description?: string;
  fenceType: GeoFenceType;
  coordinates: Array<{ lat: number; lng: number }>;
  radiusKm?: number;
  countryCode?: string;
  regionCode?: string;
  metadata: Record<string, unknown>;
  active: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeoFenceRule {
  id: string;
  zoneId: string;
  ruleType: GeoFenceRuleType;
  targetService?: string;
  priority: number;
  conditions: Record<string, unknown>;
  actionConfig: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoFenceAlert {
  id: string;
  zoneId: string;
  ruleId?: string;
  alertType: GeoAlertType;
  sourceIp?: string;
  sourceLocation?: { lat: number; lng: number; country?: string };
  severity: GeoAlertSeverity;
  resolved: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface GeoRoutingPolicy {
  zoneId: string;
  rules: GeoFenceRule[];
  defaultAction: GeoFenceRuleType;
  fallbackRegion?: string;
}

export interface GeoFencingStats {
  totalZones: number;
  activeZones: number;
  totalRules: number;
  alertsToday: number;
  topAlertZones: Array<{ zoneId: string; zoneName: string; count: number }>;
}
