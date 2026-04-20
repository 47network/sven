export interface InvoiceGeneratorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface InvoiceTemplate {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
