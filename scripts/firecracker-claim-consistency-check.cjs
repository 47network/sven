#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const checklistPath = path.join(root, 'docs', 'Sven_Master_Checklist.md');
const runnerPath = path.join(root, 'services', 'skill-runner', 'src', 'index.ts');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'firecracker-claim-consistency-latest.json');
const outMd = path.join(outDir, 'firecracker-claim-consistency-latest.md');

function check(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

function readRequired(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const checks = [];
  let checklist;
  let runner;

  try {
    checklist = readRequired(checklistPath);
    checks.push(check('master_checklist_readable', true, path.relative(root, checklistPath)));
  } catch (error) {
    checks.push(
      check(
        'master_checklist_readable',
        false,
        `failed to read ${path.relative(root, checklistPath)}: ${String(error && error.message ? error.message : error)}`,
      ),
    );
  }

  try {
    runner = readRequired(runnerPath);
    checks.push(check('skill_runner_readable', true, path.relative(root, runnerPath)));
  } catch (error) {
    checks.push(
      check(
        'skill_runner_readable',
        false,
        `failed to read ${path.relative(root, runnerPath)}: ${String(error && error.message ? error.message : error)}`,
      ),
    );
  }

  const firecrackerLine = checklist
    ? checklist.split(/\r?\n/).find((line) => /Firecracker/i.test(line))
    : '';
  const firecrackerChecked = firecrackerLine ? /^\s*-\s\[x\]/i.test(firecrackerLine) : false;
  const firecrackerPlaceholder =
    runner
      ? runner.includes('Firecracker execution not implemented yet')
        || runner.includes('Firecracker execution placeholder')
      : false;

  checks.push(
    check(
      'firecracker_checklist_item_present',
      Boolean(firecrackerLine),
      firecrackerLine ? firecrackerLine.trim() : 'no Firecracker checklist line found',
    ),
  );
  checks.push(
    check(
      'firecracker_claim_not_completed_while_placeholder_exists',
      !(firecrackerPlaceholder && firecrackerChecked),
      `placeholder_detected=${firecrackerPlaceholder}; checklist_checked=${firecrackerChecked}`,
    ),
  );

  const failed = checks.filter((item) => item.status !== 'pass');
  const status = {
    generated_at: new Date().toISOString(),
    status: failed.length === 0 ? 'pass' : 'fail',
    firecracker: {
      placeholder_detected: firecrackerPlaceholder,
      checklist_checked: firecrackerChecked,
      checklist_line: firecrackerLine || null,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  const lines = [
    '# Firecracker Claim Consistency Check',
    '',
    `Status: ${status.status}`,
    `Generated: ${status.generated_at}`,
    '',
    '## Firecracker State',
    '',
    `- placeholder_detected: ${firecrackerPlaceholder}`,
    `- checklist_checked: ${firecrackerChecked}`,
    `- checklist_line: ${firecrackerLine ? firecrackerLine.trim() : 'N/A'}`,
    '',
    '## Checks',
    '',
    ...checks.map((item) => `- ${item.id}: ${item.status} (${item.detail})`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify(status, null, 2));
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && failed.length > 0) {
    process.exit(2);
  }
}

main();
