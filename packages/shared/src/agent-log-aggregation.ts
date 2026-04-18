// Batch 74: Agent Log Aggregation & Search — shared types

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogSource = 'agent' | 'service' | 'task' | 'event' | 'system' | 'external';
export type LogFormat = 'json' | 'text' | 'structured' | 'binary';
export type LogDashboardWidgetType = 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'counter' | 'heatmap';
export type LogAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface LogStream {
  id: string;
  agent_id: string;
  stream_name: string;
  source: LogSource;
  retention_days: number;
  format: LogFormat;
  tags: string[];
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  stream_id: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  source_file?: string;
  source_line?: number;
  trace_id?: string;
  span_id?: string;
  timestamp: string;
  indexed_at: string;
}

export interface LogFilter {
  id: string;
  owner_id: string;
  filter_name: string;
  query: string;
  streams: string[];
  levels: string[];
  date_range: Record<string, unknown>;
  is_saved: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LogDashboard {
  id: string;
  owner_id: string;
  dashboard_name: string;
  widgets: Array<{ type: LogDashboardWidgetType; config: Record<string, unknown> }>;
  layout: Record<string, unknown>;
  refresh_interval: number;
  is_shared: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LogAlert {
  id: string;
  owner_id: string;
  alert_name: string;
  condition: Record<string, unknown>;
  severity: LogAlertSeverity;
  channels: Array<{ type: string; target: string }>;
  cooldown_min: number;
  is_enabled: boolean;
  last_fired_at?: string;
  fire_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const LOG_LEVEL_ORDER: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

export function isAtLeastLevel(entry: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_ORDER.indexOf(entry) >= LOG_LEVEL_ORDER.indexOf(threshold);
}

export function formatLogLine(entry: LogEntry): string {
  return `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`;
}

export function parseLogQuery(query: string): { terms: string[]; levels: LogLevel[]; streams: string[] } {
  const terms: string[] = [];
  const levels: LogLevel[] = [];
  const streams: string[] = [];
  const tokens = query.split(/\s+/);
  for (const t of tokens) {
    if (t.startsWith('level:')) levels.push(t.slice(6) as LogLevel);
    else if (t.startsWith('stream:')) streams.push(t.slice(7));
    else terms.push(t);
  }
  return { terms, levels, streams };
}
