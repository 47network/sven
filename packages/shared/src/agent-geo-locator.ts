// Batch 239: Geo Locator types

export type ComplianceMode = 'gdpr' | 'ccpa' | 'hipaa' | 'pci' | 'custom';
export type GeoRestrictionType = 'country_block' | 'region_block' | 'ip_range_block' | 'compliance_fence' | 'data_residency';
export type GeoLookupSource = 'maxmind' | 'ip2location' | 'ipinfo' | 'custom';

export interface AgentGeoProfile {
  id: string;
  agentId: string;
  profileName: string;
  allowedRegions: string[];
  blockedRegions: string[];
  defaultRegion: string;
  complianceMode: ComplianceMode;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGeoLookup {
  id: string;
  profileId: string;
  ipAddress: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  isAllowed: boolean;
  lookupSource: GeoLookupSource;
  createdAt: string;
}

export interface AgentGeoRestriction {
  id: string;
  profileId: string;
  restrictionType: GeoRestrictionType;
  target: string;
  reason: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
