#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const capabilityPath = path.join(outDir, 'competitor-capability-proof-latest.json');
const agentZeroDocPath = path.join(root, 'docs', 'parity', 'sven-vs-agent-zero-feature-comparison.md');
const openClawDocPath = path.join(root, 'docs', 'parity', 'Sven_vs_OpenClaw_Feature_Comparison.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function extractRowFromMarkdown(docSource, featureId) {
  const escaped = featureId.replace('.', '\\.');
  const regex = new RegExp(`^\\|\\s*${escaped}\\s*\\|.*$`, 'm');
  const match = docSource.match(regex);
  if (!match) return null;
  const row = match[0];
  const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
  return {
    raw_row: row,
    feature_id: cells[0] || featureId,
    feature: cells[1] || '',
    description: cells[2] || '',
    sven_status: cells[3] || '',
    notes: cells[4] || '',
  };
}

function main() {
  const checks = [];
  const addCheck = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  addCheck('capability_proof_artifact_present', exists(capabilityPath), capabilityPath);
  if (!exists(capabilityPath)) {
    const report = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      checks,
      reason: 'Missing competitor capability proof artifact',
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'competitor-delta-sheet-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'competitor-delta-sheet-latest.md'),
      '# Competitor Delta Sheet\n\nStatus: fail\n\n- capability proof artifact missing\n',
      'utf8',
    );
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const capability = readJson(capabilityPath);
  const openClawDoc = exists(openClawDocPath) ? fs.readFileSync(openClawDocPath, 'utf8') : '';
  const agentZeroDoc = exists(agentZeroDocPath) ? fs.readFileSync(agentZeroDocPath, 'utf8') : '';

  addCheck('openclaw_doc_present', Boolean(openClawDoc), openClawDocPath);
  addCheck('agent_zero_doc_present', Boolean(agentZeroDoc), agentZeroDocPath);

  const competitorRows = [];
  for (const [competitorId, stats] of Object.entries(capability.competitors || {})) {
    const total = Number(stats.total_rows || 0);
    const proven = Number(stats.proven_pass_rows || 0);
    const partial = Number(stats.partial_rows || 0);
    const unproven = Number(stats.unproven_rows || 0);
    competitorRows.push({
      competitor: competitorId,
      total_rows: total,
      proven_pass_rows: proven,
      partial_rows: partial,
      unproven_rows: unproven,
      proven_coverage_percent: percent(proven, total),
    });
  }
  competitorRows.sort((a, b) => b.proven_coverage_percent - a.proven_coverage_percent);
  addCheck(
    'row_level_competitors_ranked',
    competitorRows.length > 0,
    `ranked=${competitorRows.length}; top=${competitorRows[0] ? competitorRows[0].competitor : 'none'}`,
  );

  const waveRows = (capability.waves || []).map((wave) => ({
    wave: wave.wave,
    competitor: wave.competitor,
    status: wave.status,
    generated_at: wave.generated_at || null,
  }));
  const waveFailures = waveRows.filter((w) => w.status !== 'pass');
  addCheck('wave_level_competitors_all_pass', waveFailures.length === 0, waveFailures.length === 0 ? 'all pass' : `failing=${waveFailures.length}`);

  const unresolved = [];
  for (const [competitorId, rows] of Object.entries(capability.unresolved_rows || {})) {
    for (const row of rows || []) {
      let detail = null;
      if (competitorId === 'agent_zero' && agentZeroDoc) {
        detail = extractRowFromMarkdown(agentZeroDoc, String(row.feature_id || ''));
      } else if (competitorId === 'openclaw' && openClawDoc) {
        detail = extractRowFromMarkdown(openClawDoc, String(row.feature_id || ''));
      }
      unresolved.push({
        competitor: competitorId,
        feature_id: String(row.feature_id || ''),
        classification: String(row.classification || 'unknown'),
        reason: String(row.reason || ''),
        detail,
      });
    }
  }

  const prioritizedBacklog = unresolved.map((item, index) => {
    const detail = item.detail || {};
    const actionHint = /community/i.test(`${detail.feature || ''} ${detail.description || ''} ${detail.notes || ''}`)
      ? 'Finish public community rollout (docs + Discord + GitHub Discussions + marketplace) and turn community ecosystem readiness to pass.'
      : 'Close remaining parity evidence gap with code + tests + runtime artifact.';
    return {
      priority: index + 1,
      competitor: item.competitor,
      feature_id: item.feature_id,
      feature: detail.feature || null,
      action: actionHint,
      evidence_source: detail.raw_row ? (item.competitor === 'agent_zero' ? 'docs/parity/sven-vs-agent-zero-feature-comparison.md' : 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md') : null,
    };
  });

  const status = unresolved.length === 0 ? 'pass' : 'partial';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    summary: {
      claim_100_percent_parity: Boolean(capability.summary && capability.summary.claim_100_percent_parity),
      total_rows: Number(capability.summary && capability.summary.total_rows ? capability.summary.total_rows : 0),
      proven_pass_rows: Number(capability.summary && capability.summary.proven_pass_rows ? capability.summary.proven_pass_rows : 0),
      partial_rows: Number(capability.summary && capability.summary.partial_rows ? capability.summary.partial_rows : 0),
      unproven_rows: Number(capability.summary && capability.summary.unproven_rows ? capability.summary.unproven_rows : 0),
      row_level_competitor_count: competitorRows.length,
      wave_level_competitor_count: waveRows.length,
    },
    ranking: {
      row_level: competitorRows,
      wave_level: waveRows,
    },
    unresolved_rows: unresolved,
    prioritized_backlog: prioritizedBacklog,
    checks,
    source: {
      capability_proof: path.relative(root, capabilityPath),
      openclaw_doc: path.relative(root, openClawDocPath),
      agent_zero_doc: path.relative(root, agentZeroDocPath),
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'competitor-delta-sheet-latest.json');
  const outMd = path.join(outDir, 'competitor-delta-sheet-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Competitor Delta Sheet',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- Total rows: ${report.summary.total_rows}`,
    `- Proven rows: ${report.summary.proven_pass_rows}`,
    `- Partial rows: ${report.summary.partial_rows}`,
    `- Unproven rows: ${report.summary.unproven_rows}`,
    `- Claim 100% parity: ${report.summary.claim_100_percent_parity ? 'yes' : 'no'}`,
    '',
    '## Row-Level Ranking',
    '| Competitor | Proven | Partial | Unproven | Total | Coverage % |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...competitorRows.map((r) => `| ${r.competitor} | ${r.proven_pass_rows} | ${r.partial_rows} | ${r.unproven_rows} | ${r.total_rows} | ${r.proven_coverage_percent}% |`),
    '',
    '## Wave-Level Status',
    '| Wave | Competitor | Status | Generated At |',
    '| --- | --- | --- | --- |',
    ...waveRows.map((w) => `| ${w.wave} | ${w.competitor} | ${w.status} | ${w.generated_at || ''} |`),
    '',
  ];

  if (prioritizedBacklog.length > 0) {
    lines.push('## Priority Backlog');
    lines.push('| Priority | Competitor | Feature ID | Feature | Action |');
    lines.push('| ---: | --- | --- | --- | --- |');
    for (const item of prioritizedBacklog) {
      lines.push(`| ${item.priority} | ${item.competitor} | ${item.feature_id} | ${item.feature || ''} | ${item.action} |`);
    }
    lines.push('');
  } else {
    lines.push('## Priority Backlog');
    lines.push('- No unresolved rows.');
    lines.push('');
  }

  lines.push('## Checks');
  for (const check of checks) {
    lines.push(`- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`);
  }
  lines.push('');

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (report.status === 'fail') {
    process.exit(2);
  }
}

main();
