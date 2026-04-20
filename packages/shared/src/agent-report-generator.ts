export type ReportFormat = 'pdf' | 'html' | 'csv' | 'xlsx' | 'markdown' | 'json';

export interface AgentReportConfig {
  id: string; agent_id: string; output_format: ReportFormat; template_engine: string;
  schedule_cron?: string; recipients: string[]; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface AgentReportTemplate {
  id: string; config_id: string; template_name: string; template_content: string;
  variables: string[]; version: number; created_at: string;
}

export interface AgentReportOutput {
  id: string; template_id: string; output_url: string; output_format: ReportFormat;
  page_count?: number; size_bytes: number; generated_at: string; created_at: string;
}
