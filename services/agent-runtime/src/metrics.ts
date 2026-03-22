import { createServer, type Server } from 'node:http';
import { parseBooleanSetting } from './settings-utils.js';

type CounterMap = Map<string, number>;
type HistogramBuckets = {
  boundaries: number[];
  counts: number[];
  sum: number;
  count: number;
};

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  const rendered = entries
    .map(([k, v]) => `${k}="${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
  return `{${rendered}}`;
}

export class RuntimeMetrics {
  private readonly maxLabelSeriesPerMetric: number;
  private counters: CounterMap = new Map();
  private labelSeriesByMetric: Map<string, Set<string>> = new Map();
  private llmLatency: HistogramBuckets = {
    boundaries: [50, 100, 200, 500, 1000, 2000, 5000, 10000],
    counts: [0, 0, 0, 0, 0, 0, 0, 0],
    sum: 0,
    count: 0,
  };

  constructor(options?: { maxLabelSeriesPerMetric?: number }) {
    this.maxLabelSeriesPerMetric = Math.max(
      1,
      Math.floor(options?.maxLabelSeriesPerMetric || 256),
    );
  }

  incToolCall(toolName: string): void {
    this.inc('sven_agent_tool_calls_total', { tool_name: toolName });
  }

  incToolResult(toolName: string, status: string): void {
    this.inc('sven_agent_tool_results_total', { tool_name: toolName, status });
  }

  observeLlm(latencyMs: number, promptTokens: number, completionTokens: number): void {
    this.inc('sven_agent_llm_requests_total', {});
    this.observeLatency(latencyMs);
    this.add('sven_agent_prompt_tokens_total', {}, promptTokens);
    this.add('sven_agent_completion_tokens_total', {}, completionTokens);
    this.add('sven_agent_total_tokens_total', {}, promptTokens + completionTokens);
  }

  renderPrometheus(): string {
    const lines: string[] = [];

    lines.push('# HELP sven_agent_tool_calls_total Tool calls published by agent-runtime.');
    lines.push('# TYPE sven_agent_tool_calls_total counter');
    this.emitCounter(lines, 'sven_agent_tool_calls_total');

    lines.push('# HELP sven_agent_tool_results_total Tool run results observed by agent-runtime.');
    lines.push('# TYPE sven_agent_tool_results_total counter');
    this.emitCounter(lines, 'sven_agent_tool_results_total');

    lines.push('# HELP sven_agent_llm_requests_total LLM requests executed by agent-runtime.');
    lines.push('# TYPE sven_agent_llm_requests_total counter');
    this.emitCounter(lines, 'sven_agent_llm_requests_total');

    lines.push('# HELP sven_agent_prompt_tokens_total Prompt tokens consumed by agent-runtime.');
    lines.push('# TYPE sven_agent_prompt_tokens_total counter');
    this.emitCounter(lines, 'sven_agent_prompt_tokens_total');

    lines.push('# HELP sven_agent_completion_tokens_total Completion tokens consumed by agent-runtime.');
    lines.push('# TYPE sven_agent_completion_tokens_total counter');
    this.emitCounter(lines, 'sven_agent_completion_tokens_total');

    lines.push('# HELP sven_agent_total_tokens_total Total tokens consumed by agent-runtime.');
    lines.push('# TYPE sven_agent_total_tokens_total counter');
    this.emitCounter(lines, 'sven_agent_total_tokens_total');

    lines.push('# HELP sven_agent_metric_series_dropped_total Metric label series dropped due to cardinality limits.');
    lines.push('# TYPE sven_agent_metric_series_dropped_total counter');
    this.emitCounter(lines, 'sven_agent_metric_series_dropped_total');

    lines.push('# HELP sven_agent_llm_latency_ms LLM request latency in milliseconds.');
    lines.push('# TYPE sven_agent_llm_latency_ms histogram');
    let cumulative = 0;
    for (let i = 0; i < this.llmLatency.boundaries.length; i += 1) {
      cumulative += this.llmLatency.counts[i];
      const boundary = this.llmLatency.boundaries[i];
      lines.push(`sven_agent_llm_latency_ms_bucket${formatLabels({ le: String(boundary) })} ${cumulative}`);
    }
    lines.push(`sven_agent_llm_latency_ms_bucket${formatLabels({ le: '+Inf' })} ${this.llmLatency.count}`);
    lines.push(`sven_agent_llm_latency_ms_sum ${this.llmLatency.sum}`);
    lines.push(`sven_agent_llm_latency_ms_count ${this.llmLatency.count}`);

    return `${lines.join('\n')}\n`;
  }

  private observeLatency(latencyMs: number): void {
    const value = Number.isFinite(latencyMs) ? Math.max(0, latencyMs) : 0;
    this.llmLatency.sum += value;
    this.llmLatency.count += 1;
    for (let i = 0; i < this.llmLatency.boundaries.length; i += 1) {
      if (value <= this.llmLatency.boundaries[i]) {
        this.llmLatency.counts[i] += 1;
        break;
      }
    }
  }

  private emitCounter(lines: string[], metricName: string): void {
    let emitted = false;
    for (const [key, value] of this.counters.entries()) {
      if (!key.startsWith(`${metricName}|`)) continue;
      emitted = true;
      const labelPart = key.slice(metricName.length + 1);
      lines.push(`${metricName}${labelPart} ${value}`);
    }
    if (!emitted) {
      lines.push(`${metricName} 0`);
    }
  }

  private inc(metricName: string, labels: Record<string, string>): void {
    this.add(metricName, labels, 1);
  }

  private add(metricName: string, labels: Record<string, string>, amount: number): void {
    const boundedLabels = this.boundLabels(metricName, labels);
    const labelPart = formatLabels(boundedLabels);
    const key = `${metricName}|${labelPart}`;
    const prev = this.counters.get(key) || 0;
    this.counters.set(key, prev + amount);
  }

  private boundLabels(metricName: string, labels: Record<string, string>): Record<string, string> {
    const keys = Object.keys(labels || {});
    if (keys.length === 0) return labels;
    if (metricName === 'sven_agent_metric_series_dropped_total') return labels;

    const labelPart = formatLabels(labels);
    const series = this.labelSeriesByMetric.get(metricName) || new Set<string>();
    if (!series.has(labelPart) && series.size >= this.maxLabelSeriesPerMetric) {
      const overflowLabels: Record<string, string> = {};
      for (const key of keys) {
        overflowLabels[key] = '__other__';
      }
      const overflowLabelPart = formatLabels(overflowLabels);
      if (!series.has(overflowLabelPart)) {
        series.add(overflowLabelPart);
      }
      this.labelSeriesByMetric.set(metricName, series);
      this.inc('sven_agent_metric_series_dropped_total', { metric_name: metricName });
      return overflowLabels;
    }
    if (!series.has(labelPart)) {
      series.add(labelPart);
      this.labelSeriesByMetric.set(metricName, series);
    }
    return labels;
  }
}

export const runtimeMetrics = new RuntimeMetrics();

export function resolveMetricsBindHost(env: NodeJS.ProcessEnv): string {
  const requestedHost = String(env.AGENT_RUNTIME_METRICS_HOST || '').trim();
  if (!requestedHost) return '127.0.0.1';

  const isLoopback =
    requestedHost === '127.0.0.1'
    || requestedHost === '::1'
    || requestedHost.toLowerCase() === 'localhost';
  if (isLoopback) return requestedHost;

  const allowRemote = parseBooleanSetting(env.AGENT_RUNTIME_METRICS_ALLOW_REMOTE, false);
  if (!allowRemote) return '127.0.0.1';
  return requestedHost;
}

export function startMetricsServer(
  port: number,
  host = '127.0.0.1',
): Server {
  const server = createServer((req, res) => {
    const path = String(req.url || '').split('?')[0];
    if (path === '/healthz') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (path !== '/metrics') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    res.end(runtimeMetrics.renderPrometheus());
  });

  server.listen(port, host);
  return server;
}
