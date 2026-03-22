#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function argOrEnv(name, envName, fallback = '') {
  const cli = argValue(name, '');
  if (cli) return cli;
  const envValue = String(process.env[envName] || '').trim();
  if (envValue) return envValue;
  return fallback;
}

function parseStrictBool(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(v)) return true;
  if (['0', 'false', 'no', 'n'].includes(v)) return false;
  return null;
}

function parseCsvRecords(text) {
  const input = String(text || '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (inQuotes) {
    throw new Error('CSV parse error: unclosed quoted field');
  }
  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

function parseCsv(text) {
  const records = parseCsvRecords(text);
  if (records.length < 2) return { headers: [], rows: [] };
  const headers = records[0].map((h) => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < records.length; i += 1) {
    const cols = records[i];
    if (!cols || cols.every((v) => String(v || '').trim() === '')) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = String(cols[idx] || '').trim(); });
    rows.push({ ...row, __row_number: i + 1 });
  }
  return { headers, rows };
}

function avg(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function summarizeTarget(rows) {
  const durations = rows.map((r) => Number(r.duration_ms));
  const clicks = rows.map((r) => Number(r.clicks));
  const errors = rows.map((r) => Number(r.errors));
  const tasks = new Set(rows.map((r) => String(r.task_id || '').trim()).filter(Boolean));
  const missingControls = rows.filter((r) => parseStrictBool(r.controls_complete) !== true).length;

  return {
    rows: rows.length,
    tasks: tasks.size,
    avg_duration_ms: avg(durations),
    avg_clicks: avg(clicks),
    total_errors: errors.reduce((a, b) => a + b, 0),
    error_rate: rows.length ? Number((errors.reduce((a, b) => a + b, 0) / rows.length).toFixed(4)) : null,
    missing_controls: missingControls,
  };
}

function main() {
  const inputCsv = argValue('--input-csv', 'docs/release/status/f2-ui-operability-raw.csv');
  const outJson = argValue('--output-json', 'docs/release/status/f2-ui-operability-benchmark-latest.json');
  const outMd = argValue('--output-md', 'docs/release/status/f2-ui-operability-benchmark-latest.md');
  const strict = process.argv.includes('--strict');
  const provenance = {
    evidence_mode: argOrEnv('--evidence-mode', 'F2_EVIDENCE_MODE', 'csv_benchmark_input'),
    source_run_id: argOrEnv('--source-run-id', 'F2_SOURCE_RUN_ID', String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || `local-${Date.now()}`)),
    head_sha: argOrEnv('--head-sha', 'F2_HEAD_SHA', String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '')),
    baseline_source: 'csv_input',
  };
  const expectedSchema = ['target', 'task_id', 'duration_ms', 'clicks', 'errors', 'controls_complete'];

  if (!fs.existsSync(inputCsv)) {
    const payload = {
      generated_at: new Date().toISOString(),
      status: 'inconclusive',
      reason: `Missing input CSV: ${inputCsv}`,
      expected_schema: expectedSchema,
      provenance,
    };
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.mkdirSync(path.dirname(outMd), { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outMd, `# F2 UI Operability Benchmark\n\nStatus: inconclusive\nReason: ${payload.reason}\n`, 'utf8');
    console.log(`Wrote ${outJson}`);
    console.log(`Wrote ${outMd}`);
    if (strict) process.exit(2);
    return;
  }

  let headers = [];
  let parsedRows = [];
  const invalidRows = [];
  try {
    const parsed = parseCsv(fs.readFileSync(inputCsv, 'utf8'));
    headers = parsed.headers;
    parsedRows = parsed.rows;
  } catch (err) {
    const payload = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      input_csv: inputCsv,
      expected_schema: expectedSchema,
      validation: {
        total_rows: 0,
        valid_rows: 0,
        invalid_rows: 1,
        diagnostics: [String(err && err.message ? err.message : err)],
      },
      reason: 'CSV parse failed',
    };
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.mkdirSync(path.dirname(outMd), { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outMd, `# F2 UI Operability Benchmark\n\nStatus: fail\nReason: CSV parse failed\n`, 'utf8');
    console.log(`Wrote ${outJson}`);
    console.log(`Wrote ${outMd}`);
    process.exit(1);
  }

  const headerSet = new Set(headers);
  const missingHeaders = expectedSchema.filter((field) => !headerSet.has(field));
  if (missingHeaders.length > 0) {
    const payload = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      input_csv: inputCsv,
      expected_schema: expectedSchema,
      validation: {
        total_rows: parsedRows.length,
        valid_rows: 0,
        invalid_rows: parsedRows.length,
        diagnostics: [`Missing required headers: ${missingHeaders.join(', ')}`],
      },
      reason: 'CSV schema mismatch',
    };
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.mkdirSync(path.dirname(outMd), { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outMd, `# F2 UI Operability Benchmark\n\nStatus: fail\nReason: CSV schema mismatch\n`, 'utf8');
    console.log(`Wrote ${outJson}`);
    console.log(`Wrote ${outMd}`);
    process.exit(1);
  }

  const rows = [];
  for (const row of parsedRows) {
    const rowNumber = Number(row.__row_number || 0);
    const target = String(row.target || '').trim().toLowerCase();
    const taskId = String(row.task_id || '').trim();
    const duration = Number(row.duration_ms);
    const clicks = Number(row.clicks);
    const errors = Number(row.errors);
    const controls = parseStrictBool(row.controls_complete);

    const rowErrors = [];
    if (!['sven', 'agent_zero'].includes(target)) rowErrors.push(`target invalid: ${row.target}`);
    if (!taskId) rowErrors.push('task_id missing');
    if (!Number.isFinite(duration) || duration < 0) rowErrors.push(`duration_ms invalid: ${row.duration_ms}`);
    if (!Number.isFinite(clicks) || clicks < 0 || !Number.isInteger(clicks)) rowErrors.push(`clicks invalid: ${row.clicks}`);
    if (!Number.isFinite(errors) || errors < 0 || !Number.isInteger(errors)) rowErrors.push(`errors invalid: ${row.errors}`);
    if (controls == null) rowErrors.push(`controls_complete invalid: ${row.controls_complete}`);

    if (rowErrors.length > 0) {
      invalidRows.push({
        row: rowNumber || null,
        errors: rowErrors,
      });
      continue;
    }

    rows.push({
      target,
      task_id: taskId,
      duration_ms: duration,
      clicks,
      errors,
      controls_complete: controls ? 'true' : 'false',
    });
  }

  const svenRows = rows.filter((r) => r.target === 'sven');
  const agentRows = rows.filter((r) => r.target === 'agent_zero');

  const sven = summarizeTarget(svenRows);
  const agent = summarizeTarget(agentRows);

  const enoughData = sven.rows > 0 && agent.rows > 0;
  const durationCriterion = enoughData && sven.avg_duration_ms != null && agent.avg_duration_ms != null
    ? sven.avg_duration_ms <= Math.round(agent.avg_duration_ms * 0.8)
    : null;
  const errorCriterion = enoughData && sven.error_rate != null && agent.error_rate != null
    ? sven.error_rate <= agent.error_rate
    : null;
  const controlsCriterion = sven.missing_controls === 0;

  let status = 'pass';
  if (!enoughData || durationCriterion == null || errorCriterion == null) status = 'inconclusive';
  if ((durationCriterion === false) || (errorCriterion === false) || !controlsCriterion) status = 'fail';
  if (strict && invalidRows.length > 0) status = 'fail';

  const payload = {
    generated_at: new Date().toISOString(),
    status,
    input_csv: inputCsv,
    expected_schema: expectedSchema,
    validation: {
      total_rows: parsedRows.length,
      valid_rows: rows.length,
      invalid_rows: invalidRows.length,
      diagnostics: invalidRows.slice(0, 50),
    },
    summary: {
      sven,
      agent_zero: agent,
    },
    criteria: {
      duration_le_80pct_of_agent_zero: durationCriterion,
      error_rate_le_agent_zero: errorCriterion,
      no_missing_controls_for_sven: controlsCriterion,
    },
    provenance: {
      ...provenance,
    },
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    '# F2 UI Operability Benchmark',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    `Input: ${payload.input_csv}`,
    `Validation: valid=${payload.validation.valid_rows} invalid=${payload.validation.invalid_rows} total=${payload.validation.total_rows}`,
    '',
    '## Summary',
    `- Sven avg duration (ms): ${sven.avg_duration_ms == null ? 'n/a' : sven.avg_duration_ms}`,
    `- Agent Zero avg duration (ms): ${agent.avg_duration_ms == null ? 'n/a' : agent.avg_duration_ms}`,
    `- Sven error rate: ${sven.error_rate == null ? 'n/a' : sven.error_rate}`,
    `- Agent Zero error rate: ${agent.error_rate == null ? 'n/a' : agent.error_rate}`,
    `- Sven missing controls rows: ${sven.missing_controls}`,
    '',
    '## Criteria',
    `- duration <= Agent Zero -20%: ${payload.criteria.duration_le_80pct_of_agent_zero == null ? 'n/a' : payload.criteria.duration_le_80pct_of_agent_zero}`,
    `- error rate <= Agent Zero: ${payload.criteria.error_rate_le_agent_zero == null ? 'n/a' : payload.criteria.error_rate_le_agent_zero}`,
    `- no missing controls: ${payload.criteria.no_missing_controls_for_sven}`,
    '',
    '## Validation',
    `- strict mode: ${strict}`,
    `- invalid rows: ${payload.validation.invalid_rows}`,
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  console.log(`f2-ui-operability-benchmark: ${status}`);
  if (status === 'fail') process.exit(1);
  if (strict && status !== 'pass') process.exit(2);
}

main();
