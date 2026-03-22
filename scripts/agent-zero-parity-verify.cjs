#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const docPath = path.join(root, 'docs', 'parity', 'sven-vs-agent-zero-feature-comparison.md');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'agent-zero-parity-verify-latest.json');
const outMd = path.join(outDir, 'agent-zero-parity-verify-latest.md');

function readUtf8(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function parseTotalsRow(markdown) {
  const re = /^\|\s*\*\*TOTALS\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\s*\((\d+)%\)\*\*\s*\|\s*\*\*(\d+)\s*\((\d+)%\)\*\*\s*\|\s*\*\*(\d+)\s*\((\d+)%\)\*\*\s*\|/im;
  const m = markdown.match(re);
  if (!m) return null;
  return {
    total: Number(m[1]),
    matched: Number(m[2]),
    matched_pct: Number(m[3]),
    partial: Number(m[4]),
    partial_pct: Number(m[5]),
    missing: Number(m[6]),
    missing_pct: Number(m[7]),
  };
}

function parseFeatureRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = [];
  let inMainFeatureTable = false;
  for (const line of lines) {
    if (/^\|\s*#\s*\|\s*Agent Zero Feature\s*\|\s*Description\s*\|\s*Sven Status\s*\|\s*Notes\s*\|/i.test(line)) {
      inMainFeatureTable = true;
      continue;
    }
    if (inMainFeatureTable && /^\s*$/.test(line)) {
      inMainFeatureTable = false;
      continue;
    }
    if (!inMainFeatureTable) continue;
    if (!/^\|\s*\d+\.\d+\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const featureId = cells[0];
    const statusCell = cells[3];
    const notesCell = cells[4];
    rows.push({
      feature_id: featureId,
      status: statusCell,
      notes: notesCell,
    });
  }
  return rows;
}

function runNpm(args) {
  if (process.platform === 'win32') {
    const cmdline = `npm ${args.join(' ')}`;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdline], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function resultPayload(id, command, result) {
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    id,
    command,
    exit_code: exitCode,
    pass: exitCode === 0,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout_excerpt: String(result.stdout || '').split(/\r?\n/).slice(-25),
    stderr_excerpt: String(result.stderr || '').split(/\r?\n/).slice(-25),
  };
}

function run() {
  const checks = [];
  const commandRuns = [];
  let mappedAgentZeroRows = [];
  const markdown = readUtf8(docPath);
  if (!markdown) {
    checks.push({
      id: 'agent_zero_parity_doc_present',
      pass: false,
      detail: 'docs/parity/sven-vs-agent-zero-feature-comparison.md missing',
    });
  } else {
    checks.push({
      id: 'agent_zero_parity_doc_present',
      pass: true,
      detail: 'docs/parity/sven-vs-agent-zero-feature-comparison.md',
    });

    const totals = parseTotalsRow(markdown);
    checks.push({
      id: 'agent_zero_parity_totals_row_present',
      pass: Boolean(totals),
      detail: totals ? `total=${totals.total}, matched=${totals.matched}, partial=${totals.partial}, missing=${totals.missing}` : 'TOTALS row missing',
    });

    const rows = parseFeatureRows(markdown);
    mappedAgentZeroRows = rows
      .filter((row) => row.status === '✅' || row.status === '✅+')
      .map((row) => row.feature_id);
    checks.push({
      id: 'agent_zero_parity_feature_rows_present',
      pass: rows.length > 0,
      detail: `feature_rows=${rows.length}`,
    });

    const validStatuses = new Set(['✅', '✅+', '⚠️', '❌']);
    const invalidStatusRows = rows.filter((row) => !validStatuses.has(row.status));
    checks.push({
      id: 'agent_zero_parity_status_values_valid',
      pass: invalidStatusRows.length === 0,
      detail: invalidStatusRows.length === 0
        ? 'all row statuses valid'
        : `invalid statuses in rows: ${invalidStatusRows.map((row) => `${row.feature_id}:${row.status}`).join(', ')}`,
    });

    const matchedRows = rows.filter((row) => row.status === '✅' || row.status === '✅+').length;
    const partialRows = rows.filter((row) => row.status === '⚠️').length;
    const missingRows = rows.filter((row) => row.status === '❌').length;
    checks.push({
      id: 'agent_zero_parity_row_count_consistency',
      pass: Boolean(totals)
        && totals.matched === matchedRows
        && totals.partial === partialRows
        && totals.missing === missingRows,
      detail: Boolean(totals)
        ? `totals(m=${totals.matched},p=${totals.partial},x=${totals.missing}) vs rows(m=${matchedRows},p=${partialRows},x=${missingRows})`
        : 'cannot compare row counts without TOTALS row',
    });

    checks.push({
      id: 'agent_zero_parity_totals_sum_consistency',
      pass: Boolean(totals) && (totals.matched + totals.partial + totals.missing === totals.total),
      detail: Boolean(totals)
        ? `matched+partial+missing=${totals.matched + totals.partial + totals.missing}; total=${totals.total}`
        : 'cannot verify sum without TOTALS row',
    });

    const computedMatchedPct = rows.length > 0 ? Math.round((matchedRows / rows.length) * 100) : 0;
    const computedPartialPct = rows.length > 0 ? Math.round((partialRows / rows.length) * 100) : 0;
    const computedMissingPct = rows.length > 0 ? Math.round((missingRows / rows.length) * 100) : 0;
    checks.push({
      id: 'agent_zero_parity_percentage_consistency',
      pass: Boolean(totals)
        && totals.matched_pct === computedMatchedPct
        && totals.partial_pct === computedPartialPct
        && totals.missing_pct === computedMissingPct,
      detail: Boolean(totals)
        ? `totals_pct(m=${totals.matched_pct},p=${totals.partial_pct},x=${totals.missing_pct}) vs computed_pct(m=${computedMatchedPct},p=${computedPartialPct},x=${computedMissingPct})`
        : 'cannot verify percentage without TOTALS row',
    });

    const rowsRequiringEvidence = rows.filter((row) => row.status === '✅' || row.status === '✅+' || row.status === '⚠️');
    const hasDocLevelEvidenceAnchors =
      markdown.includes('docs/parity/competitor-baseline-manifest.json')
      && markdown.includes('docs/parity/competitor-evidence-ledger.json');
    const rowsWithoutEvidenceRefs = rowsRequiringEvidence.filter((row) => {
      const notes = String(row.notes || '');
      const hasBacktickRef = /`[^`]+`/.test(notes);
      const hasUrlRef = /https?:\/\//i.test(notes);
      return !hasBacktickRef && !hasUrlRef;
    });
    checks.push({
      id: 'agent_zero_parity_required_rows_have_evidence_refs',
      pass: rowsWithoutEvidenceRefs.length === 0 || hasDocLevelEvidenceAnchors,
      detail: rowsWithoutEvidenceRefs.length === 0
        ? `all ${rowsRequiringEvidence.length} matched/partial rows include evidence refs`
        : hasDocLevelEvidenceAnchors
          ? `row-level refs missing for ${rowsWithoutEvidenceRefs.length} rows, covered by doc-level evidence anchors`
        : `rows missing evidence refs: ${rowsWithoutEvidenceRefs.map((row) => row.feature_id).join(', ')}`,
    });

    const runtimeCoreRun = runNpm([
      '--prefix',
      'services/agent-runtime',
      'run',
      'test',
      '--',
      'skill-command.test.ts',
      'model-command.test.ts',
      'directives.test.ts',
      'llm-router.provider-keys.test.ts',
      'llm-router.litellm.test.ts',
      'self-correction.test.ts',
      '--runInBand',
    ]);
    commandRuns.push(resultPayload(
      'agent_zero_runtime_core_tests_check',
      'npm --prefix services/agent-runtime run test -- skill-command.test.ts model-command.test.ts directives.test.ts llm-router.provider-keys.test.ts llm-router.litellm.test.ts self-correction.test.ts --runInBand',
      runtimeCoreRun,
    ));

    const runtimeGatewayRun = runNpm([
      '--prefix',
      'services/gateway-api',
      'run',
      'test',
      '--',
      'community-status.unit.test.ts',
      'community-persona-verification.unit.test.ts',
      '--runInBand',
    ]);
    commandRuns.push(resultPayload(
      'agent_zero_runtime_gateway_tests_check',
      'npm --prefix services/gateway-api run test -- community-status.unit.test.ts community-persona-verification.unit.test.ts --runInBand',
      runtimeGatewayRun,
    ));

    checks.push({
      id: 'agent_zero_runtime_proof_tests_pass',
      pass: commandRuns.every((runItem) => runItem.pass),
      detail: 'agent-runtime and gateway runtime proof test suites pass',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    source: {
      parity_doc: 'docs/parity/sven-vs-agent-zero-feature-comparison.md',
    },
    mapped_agent_zero_rows: mappedAgentZeroRows,
    command_runs: commandRuns,
    source_files: [
      'services/agent-runtime/src/chat-commands.ts',
      'services/agent-runtime/src/llm-router.ts',
      'services/agent-runtime/src/self-correction.ts',
      'services/agent-runtime/src/__tests__/skill-command.test.ts',
      'services/agent-runtime/src/__tests__/model-command.test.ts',
      'services/agent-runtime/src/__tests__/directives.test.ts',
      'services/agent-runtime/src/__tests__/llm-router.provider-keys.test.ts',
      'services/agent-runtime/src/__tests__/llm-router.litellm.test.ts',
      'services/agent-runtime/src/__tests__/self-correction.test.ts',
      'services/gateway-api/src/routes/admin/community.ts',
      'services/gateway-api/src/__tests__/community-status.unit.test.ts',
      'services/gateway-api/src/__tests__/community-persona-verification.unit.test.ts',
    ],
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Agent-Zero Parity Verify',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped Agent Zero rows: ${mappedAgentZeroRows.length}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Command Runs',
      ...commandRuns.map((runItem) => `- ${runItem.id}: exit_code=${runItem.exit_code} (\`${runItem.command}\`)`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  console.log(`agent-zero-parity-verify: ${status}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
