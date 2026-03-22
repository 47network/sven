#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pg = require('pg');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const durationHours = Number(getArg('--duration-hours', '72'));
const intervalSeconds = Number(getArg('--interval-seconds', '60'));
const strict = args.includes('--strict') || process.env.SOAK_MONITOR_STRICT === '1';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sven:sven@127.0.0.1:5432/sven';

const outDir = path.join(process.cwd(), 'docs', 'release', 'status');
const eventsPath = path.join(outDir, 'soak-72h-events.jsonl');
const summaryPath = path.join(outDir, 'soak-72h-summary.json');
const startedAt = new Date();
const startedMs = startedAt.getTime();
const deadlineMs = startedMs + durationHours * 60 * 60 * 1000;

fs.mkdirSync(outDir, { recursive: true });

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    let body = {};
    try {
      body = await resp.json();
    } catch {
      body = {};
    }
    return { ok: resp.ok, status: resp.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function writeSummary(summary) {
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function appendEvent(event) {
  fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`);
}

async function sample() {
  const at = new Date().toISOString();
  const event = {
    at,
    api_url: API_URL,
    checks: {},
    status: 'pass',
  };
  let skippedChecks = 0;

  try {
    const health = await fetchJson(`${API_URL}/healthz`);
    event.checks.healthz = { ok: health.ok, status: health.status };
    if (!health.ok) event.status = 'fail';
  } catch (err) {
    event.checks.healthz = { ok: false, error: String(err) };
    event.status = 'fail';
  }

  try {
    const ready = await fetchJson(`${API_URL}/readyz`);
    event.checks.readyz = { ok: ready.ok, status: ready.status };
    if (!ready.ok) event.status = 'fail';
  } catch (err) {
    event.checks.readyz = { ok: false, error: String(err) };
    event.status = 'fail';
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    const outbox = await client.query(
      `SELECT COUNT(*)::int AS count, COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))),0)::int AS age_s
       FROM outbox
       WHERE status = 'pending'`,
    );
    event.checks.outbox = {
      pending_count: Number(outbox.rows[0]?.count || 0),
      oldest_pending_age_seconds: Number(outbox.rows[0]?.age_s || 0),
    };

    const approvals = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM approvals
       WHERE status = 'pending'`,
    );
    event.checks.approvals = {
      pending_count: Number(approvals.rows[0]?.count || 0),
    };

    try {
      const incidentTimestampColumnResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'incidents'
           AND column_name IN ('detected_at', 'created_at')
         ORDER BY CASE column_name WHEN 'detected_at' THEN 0 ELSE 1 END
         LIMIT 1`,
      );
      const incidentTimestampColumn = incidentTimestampColumnResult.rows[0]?.column_name;
      if (!incidentTimestampColumn) {
        throw new Error('incidents table is missing both detected_at and created_at');
      }
      const incidents = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM incidents
         WHERE ${incidentTimestampColumn} >= to_timestamp($1 / 1000.0)
           AND LOWER(severity) IN ('sev1','sev2')`,
        [startedMs],
      );
      const sevCount = Number(incidents.rows[0]?.count || 0);
      event.checks.sev1_sev2_since_start = { count: sevCount, timestamp_column: incidentTimestampColumn };
      if (sevCount > 0) event.status = 'fail';
    } catch (err) {
      const code = String((err && typeof err === 'object' && 'code' in err ? err.code : '') || '');
      event.checks.sev1_sev2_since_start = code === '42P01'
        ? { skipped: true, reason: 'incidents table missing on this schema baseline' }
        : { error: String(err) };
      if (code === '42P01') {
        skippedChecks += 1;
      } else {
        event.status = 'fail';
      }
    }
  } catch (err) {
    event.checks.database = { ok: false, error: String(err) };
    event.status = 'fail';
  } finally {
    await client.end().catch(() => {});
  }

  if (event.status === 'pass' && skippedChecks > 0) {
    event.status = 'pass_with_skips';
  }
  event.skipped_checks = skippedChecks;
  appendEvent(event);
  return event;
}

async function run() {
  let samples = 0;
  let failures = 0;
  let skippedSamples = 0;
  let lastEvent = null;

  while (Date.now() < deadlineMs) {
    lastEvent = await sample();
    samples += 1;
    if (lastEvent.status === 'pass_with_skips') {
      skippedSamples += 1;
    }
    if (lastEvent.status === 'fail') {
      failures += 1;
      const failSummary = {
        started_at: startedAt.toISOString(),
        expected_end_at: new Date(deadlineMs).toISOString(),
        finished_at: new Date().toISOString(),
        api_url: API_URL,
        duration_hours: durationHours,
        interval_seconds: intervalSeconds,
        samples,
        failures,
        skipped_samples: skippedSamples,
        status: 'fail',
        reason: 'One or more checks failed during soak',
        last_event: lastEvent,
      };
      writeSummary(failSummary);
      console.error(JSON.stringify(failSummary, null, 2));
      process.exit(2);
    }
    if (strict && lastEvent.status === 'pass_with_skips') {
      const failSummary = {
        started_at: startedAt.toISOString(),
        expected_end_at: new Date(deadlineMs).toISOString(),
        finished_at: new Date().toISOString(),
        api_url: API_URL,
        duration_hours: durationHours,
        interval_seconds: intervalSeconds,
        samples,
        failures,
        skipped_samples: skippedSamples,
        status: 'fail',
        reason: 'Strict soak mode disallows skipped checks',
        last_event: lastEvent,
      };
      writeSummary(failSummary);
      console.error(JSON.stringify(failSummary, null, 2));
      process.exit(2);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }

  const finalStatus = skippedSamples > 0 ? 'pass_with_skips' : 'pass';
  const passSummary = {
    started_at: startedAt.toISOString(),
    expected_end_at: new Date(deadlineMs).toISOString(),
    finished_at: new Date().toISOString(),
    api_url: API_URL,
    duration_hours: durationHours,
    interval_seconds: intervalSeconds,
    samples,
    failures,
    skipped_samples: skippedSamples,
    status: finalStatus,
    reason:
      finalStatus === 'pass'
        ? 'Completed soak window with no failed checks'
        : 'Completed soak window with no failed checks, but one or more checks were skipped',
    last_event: lastEvent,
  };
  writeSummary(passSummary);
  console.log(JSON.stringify(passSummary, null, 2));
  if (strict && finalStatus !== 'pass') process.exit(2);
}

run().catch((err) => {
  const failSummary = {
    started_at: startedAt.toISOString(),
    expected_end_at: new Date(deadlineMs).toISOString(),
    finished_at: new Date().toISOString(),
    api_url: API_URL,
    duration_hours: durationHours,
    interval_seconds: intervalSeconds,
    status: 'fail',
    reason: String(err),
  };
  writeSummary(failSummary);
  console.error(String(err));
  process.exit(1);
});
