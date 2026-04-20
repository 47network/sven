// ---------------------------------------------------------------------------
// Lightweight Prometheus metrics — no prom-client dependency (Batch 16)
// ---------------------------------------------------------------------------
// Simple counter + gauge + histogram registry that renders to Prometheus text
// format. Avoids adding an npm dependency for what are simple string counters.
//
// Usage:
//   import { MetricsRegistry, registerMetricsRoute } from '@sven/shared';
//   const m = new MetricsRegistry('sven_marketplace');
//   const orderCounter = m.counter('orders_total', 'Total orders', ['status']);
//   orderCounter.inc({ status: 'paid' });
//   registerMetricsRoute(app, m);
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';

interface Labels { [key: string]: string }

function labelsKey(labels: Labels): string {
  const pairs = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return pairs.map(([k, v]) => `${k}="${v}"`).join(',');
}

// ---- Counter ----
export class Counter {
  private values = new Map<string, number>();
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
  ) {}

  inc(labels: Labels = {}, value = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [labels, val] of this.values) {
      const suffix = labels ? `{${labels}}` : '';
      lines.push(`${this.name}${suffix} ${val}`);
    }
    return lines.join('\n');
  }
}

// ---- Gauge ----
export class Gauge {
  private values = new Map<string, number>();
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
  ) {}

  set(labels: Labels, value: number): void;
  set(value: number): void;
  set(labelsOrValue: Labels | number, value?: number): void {
    if (typeof labelsOrValue === 'number') {
      this.values.set('', labelsOrValue);
    } else {
      this.values.set(labelsKey(labelsOrValue), value ?? 0);
    }
  }

  inc(labels: Labels = {}, value = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [labels, val] of this.values) {
      const suffix = labels ? `{${labels}}` : '';
      lines.push(`${this.name}${suffix} ${val}`);
    }
    return lines.join('\n');
  }
}

// ---- Histogram ----
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export class Histogram {
  private bucketCounts = new Map<string, Map<number, number>>();
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();
  private readonly buckets: number[];

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
    buckets?: number[],
  ) {
    this.buckets = buckets ?? DEFAULT_BUCKETS;
  }

  observe(labels: Labels, value: number): void {
    const key = labelsKey(labels);
    if (!this.bucketCounts.has(key)) {
      this.bucketCounts.set(key, new Map(this.buckets.map(b => [b, 0])));
    }
    const bm = this.bucketCounts.get(key)!;
    for (const b of this.buckets) {
      if (value <= b) bm.set(b, (bm.get(b) ?? 0) + 1);
    }
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [labels, bm] of this.bucketCounts) {
      const labelSuffix = labels ? `,${labels}` : '';
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"${labelSuffix}} ${bm.get(b) ?? 0}`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"${labelSuffix}} ${this.counts.get(labels) ?? 0}`);
      lines.push(`${this.name}_sum{${labels || ''}} ${this.sums.get(labels) ?? 0}`);
      lines.push(`${this.name}_count{${labels || ''}} ${this.counts.get(labels) ?? 0}`);
    }
    return lines.join('\n');
  }
}

// ---- Registry ----
export class MetricsRegistry {
  private metrics: Array<Counter | Gauge | Histogram> = [];
  constructor(public readonly prefix: string = '') {}

  counter(name: string, help: string, labelNames: string[] = []): Counter {
    const fullName = this.prefix ? `${this.prefix}_${name}` : name;
    const c = new Counter(fullName, help, labelNames);
    this.metrics.push(c);
    return c;
  }

  gauge(name: string, help: string, labelNames: string[] = []): Gauge {
    const fullName = this.prefix ? `${this.prefix}_${name}` : name;
    const g = new Gauge(fullName, help, labelNames);
    this.metrics.push(g);
    return g;
  }

  histogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): Histogram {
    const fullName = this.prefix ? `${this.prefix}_${name}` : name;
    const h = new Histogram(fullName, help, labelNames, buckets);
    this.metrics.push(h);
    return h;
  }

  render(): string {
    return this.metrics.map(m => m.render()).join('\n\n') + '\n';
  }
}

/** Register GET /metrics on a Fastify app. */
export function registerMetricsRoute(app: FastifyInstance, registry: MetricsRegistry): void {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return registry.render();
  });
}
