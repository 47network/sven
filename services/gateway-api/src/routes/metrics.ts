import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { timingSafeEqual } from 'node:crypto';

const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
const latencyBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const latencyHistogram: number[] = new Array(latencyBuckets.length + 1).fill(0);
let latencySum = 0;
const METRICS_AUTH_TOKEN = String(process.env.SVEN_METRICS_AUTH_TOKEN || '').trim();
const INCLUDE_INCIDENT_MODE_METRICS = String(process.env.SVEN_METRICS_INCLUDE_INCIDENT_MODE || '').trim().toLowerCase() === 'true';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isLoopbackIp(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '::1' || normalized === '127.0.0.1' || normalized === 'localhost') return true;
  if (normalized.startsWith('::ffff:')) {
    return normalized.slice('::ffff:'.length) === '127.0.0.1';
  }
  return false;
}

function getRequestIp(request: any): string {
  const forwarded = String(request?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (forwarded) return forwarded;
  return String(request?.ip || '').trim();
}

function recordLatency(seconds: number) {
  latencySum += seconds;
  for (let i = 0; i < latencyBuckets.length; i++) {
    if (seconds <= latencyBuckets[i]) {
      latencyHistogram[i]++;
      return;
    }
  }
  latencyHistogram[latencyBuckets.length]++;
}

export async function registerMetricsRoutes(app: FastifyInstance, pool: pg.Pool) {
  // Hook to track request metrics
  app.addHook('onResponse', async (request, reply) => {
    requestCount++;
    const status = reply.statusCode;
    if (status >= 400) errorCount++;
    const elapsed = reply.elapsedTime; // Fastify built-in, in ms
    if (typeof elapsed === 'number') {
      recordLatency(elapsed / 1000);
    }
  });

  app.get('/metrics', async (request, reply) => {
    const requestIp = getRequestIp(request);
    const isLoopback = isLoopbackIp(requestIp);
    const providedToken = String(request.headers['x-sven-metrics-token'] || '').trim();
    if (!isLoopback) {
      if (!METRICS_AUTH_TOKEN || !safeEqual(providedToken, METRICS_AUTH_TOKEN)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'METRICS_FORBIDDEN', message: 'Metrics endpoint is restricted' },
        });
      }
    }

    const mem = process.memoryUsage();
    const uptimeSeconds = process.uptime();
    const cpu = process.cpuUsage();

    // Postgres pool metrics
    let pgTotal = 0;
    let pgIdle = 0;
    let pgWaiting = 0;
    let incidentMode = 'normal';
    try {
      pgTotal = pool.totalCount;
      pgIdle = pool.idleCount;
      pgWaiting = pool.waitingCount;
    } catch { /* pool may not expose these */ }
    if (INCLUDE_INCIDENT_MODE_METRICS) {
      try {
        const incidentRes = await pool.query(
          `SELECT value FROM settings_global WHERE key = 'incident.mode' LIMIT 1`,
        );
        const rawMode = incidentRes.rows[0]?.value;
        if (typeof rawMode === 'string') {
          incidentMode = rawMode.startsWith('"') ? JSON.parse(rawMode) : rawMode;
        }
      } catch { /* keep default normal mode */ }
    }

    const lines: string[] = [];

    // Process metrics
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);

    lines.push('# HELP process_heap_bytes Heap memory used in bytes.');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes ${mem.heapUsed}`);

    lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${uptimeSeconds.toFixed(2)}`);

    lines.push('# HELP process_cpu_user_seconds_total CPU user time in seconds.');
    lines.push('# TYPE process_cpu_user_seconds_total counter');
    lines.push(`process_cpu_user_seconds_total ${(cpu.user / 1e6).toFixed(4)}`);

    lines.push('# HELP process_cpu_system_seconds_total CPU system time in seconds.');
    lines.push('# TYPE process_cpu_system_seconds_total counter');
    lines.push(`process_cpu_system_seconds_total ${(cpu.system / 1e6).toFixed(4)}`);

    lines.push('# HELP process_start_time_seconds Start time of the process since unix epoch.');
    lines.push('# TYPE process_start_time_seconds gauge');
    lines.push(`process_start_time_seconds ${(startTime / 1000).toFixed(0)}`);

    // HTTP metrics
    lines.push('# HELP http_requests_total Total number of HTTP requests.');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${requestCount}`);

    lines.push('# HELP http_errors_total Total number of HTTP error responses (4xx+5xx).');
    lines.push('# TYPE http_errors_total counter');
    lines.push(`http_errors_total ${errorCount}`);

    const errorRate = requestCount > 0 ? (errorCount / requestCount) : 0;
    lines.push('# HELP http_error_rate Current error rate (errors/requests).');
    lines.push('# TYPE http_error_rate gauge');
    lines.push(`http_error_rate ${errorRate.toFixed(6)}`);

    // Latency histogram
    lines.push('# HELP http_request_duration_seconds HTTP request latency in seconds.');
    lines.push('# TYPE http_request_duration_seconds histogram');
    let cumulative = 0;
    for (let i = 0; i < latencyBuckets.length; i++) {
      cumulative += latencyHistogram[i];
      lines.push(`http_request_duration_seconds_bucket{le="${latencyBuckets[i]}"} ${cumulative}`);
    }
    cumulative += latencyHistogram[latencyBuckets.length];
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${cumulative}`);
    lines.push(`http_request_duration_seconds_sum ${latencySum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count ${requestCount}`);

    // Postgres pool metrics
    lines.push('# HELP pg_pool_total Total connections in pool.');
    lines.push('# TYPE pg_pool_total gauge');
    lines.push(`pg_pool_total ${pgTotal}`);

    lines.push('# HELP pg_pool_idle Idle connections in pool.');
    lines.push('# TYPE pg_pool_idle gauge');
    lines.push(`pg_pool_idle ${pgIdle}`);

    lines.push('# HELP pg_pool_waiting Waiting clients in pool.');
    lines.push('# TYPE pg_pool_waiting gauge');
    lines.push(`pg_pool_waiting ${pgWaiting}`);

    // Incident mode metrics are opt-in only to avoid exposing operational posture by default.
    if (INCLUDE_INCIDENT_MODE_METRICS) {
      lines.push('# HELP sven_incident_mode_active Incident mode active state by mode (1 active, 0 inactive).');
      lines.push('# TYPE sven_incident_mode_active gauge');
      const incidentModes = ['normal', 'kill_switch', 'lockdown', 'forensics'];
      for (const mode of incidentModes) {
        const active = incidentMode === mode ? 1 : 0;
        lines.push(`sven_incident_mode_active{mode="${mode}"} ${active}`);
      }
    }

    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8').send(lines.join('\n') + '\n');
  });
}
