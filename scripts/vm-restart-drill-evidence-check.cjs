#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const evidenceRel = String(
  process.env.SVEN_VM_RESTART_DRILL_EVIDENCE_PATH || 'docs/release/evidence/vm-restart-drill-latest.json',
).trim();
const evidencePath = path.join(root, evidenceRel);
const maxAgeHours = Number(process.env.SVEN_VM_RESTART_DRILL_MAX_AGE_HOURS || 168);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function ageHours(timestampIso) {
  const parsed = Date.parse(String(timestampIso || ''));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function hasCommand(report, pattern) {
  const commands = Array.isArray(report?.commands) ? report.commands : [];
  return commands.some((item) => pattern.test(String(item.command || '')));
}

function run() {
  const checks = [];
  let evidence = null;

  if (!fs.existsSync(evidencePath)) {
    checks.push({
      id: 'vm_restart_drill_evidence_present',
      pass: false,
      detail: `${evidenceRel} missing`,
    });
  } else {
    try {
      evidence = readJson(evidencePath);
      checks.push({
        id: 'vm_restart_drill_evidence_present',
        pass: true,
        detail: evidenceRel,
      });
    } catch (err) {
      checks.push({
        id: 'vm_restart_drill_evidence_present',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  }

  const statusValue = String(evidence?.status || '').toLowerCase();
  checks.push({
    id: 'vm_restart_drill_status_valid',
    pass: ['planned', 'pass'].includes(statusValue),
    detail: `status=${statusValue || '(missing)'}`,
  });

  checks.push({
    id: 'vm_restart_drill_vm5_waited_command_present',
    pass: hasCommand(evidence, /docker compose .*docker-compose\.vm5-ai\.yml .*up -d --wait/i),
    detail: 'vm5 waited compose restart command recorded',
  });

  checks.push({
    id: 'vm_restart_drill_vm7_waited_command_present',
    pass: hasCommand(evidence, /docker compose .*docker-compose\.vm7-adapters\.yml .*up -d --wait/i),
    detail: 'vm7 waited compose restart command recorded',
  });

  checks.push({
    id: 'vm_restart_drill_repo_contract_present',
    pass: hasCommand(evidence, /release:multi-vm:restart:health:check/),
    detail: 'repo restart-health contract command recorded',
  });

  const headSha = String(evidence?.head_sha || '').trim();
  checks.push({
    id: 'vm_restart_drill_head_sha_valid',
    pass: /^[a-f0-9]{7,40}$/i.test(headSha),
    detail: headSha || 'missing head_sha',
  });

  const age = ageHours(evidence?.generated_at);
  checks.push({
    id: 'vm_restart_drill_fresh',
    pass: typeof age === 'number' && age <= maxAgeHours,
    detail: typeof age === 'number' ? `${age.toFixed(2)}h <= ${maxAgeHours}h` : 'missing/invalid generated_at',
  });

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((check) => !check.pass) ? 'fail' : 'pass',
    evidence: evidenceRel,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'vm-restart-drill-evidence-latest.json');
  const outMd = path.join(outDir, 'vm-restart-drill-evidence-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# VM Restart Drill Evidence\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nEvidence: ${evidenceRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson).replace(/\\/g, '/')}`);
  console.log(`Wrote ${path.relative(root, outMd).replace(/\\/g, '/')}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
