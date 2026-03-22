#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const checklistPath = path.join(root, 'docs', 'Sven_Master_Checklist.md');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'master-checklist-governance-latest.json');
const outMd = path.join(outDir, 'master-checklist-governance-latest.md');

function check(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

function isUnchecked(line) {
  return /^\s*-\s\[\s\]/.test(line);
}

function isChecked(line) {
  return /^\s*-\s\[x\]/i.test(line);
}

function isRiskyDoDLine(line) {
  if (!/(100%\s*complete|23\/23\s*sections\s*complete|all\s+23\s+sections\s+100%\s+complete)/i.test(line)) {
    return false;
  }
  return !/(do not treat|in progress|evidence-gated)/i.test(line);
}

function adapterTestSurfaceSnapshot(rootDir) {
  const servicesDir = path.join(rootDir, 'services');
  if (!fs.existsSync(servicesDir)) {
    return {
      adapterCount: 0,
      adapterWithTests: 0,
      adapterWithPassWithNoTests: 0,
    };
  }
  const adapterDirs = fs
    .readdirSync(servicesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('adapter-'))
    .map((entry) => path.join(servicesDir, entry.name));

  let adapterWithTests = 0;
  let adapterWithPassWithNoTests = 0;
  const testFilePattern = /\.(test|spec)\.(t|j)sx?$/i;

  for (const dir of adapterDirs) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8').replace(/^\uFEFF/, ''));
        const testScript = String(pkg?.scripts?.test || '');
        if (/\bpassWithNoTests\b/i.test(testScript)) {
          adapterWithPassWithNoTests += 1;
        }
      } catch {
        // best-effort metric only; parse failure is surfaced by package-level checks elsewhere.
      }
    }

    let hasTests = false;
    const stack = [dir];
    while (stack.length > 0 && !hasTests) {
      const current = stack.pop();
      if (!current) break;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.isFile() && testFilePattern.test(entry.name)) {
          hasTests = true;
          break;
        }
      }
    }
    if (hasTests) adapterWithTests += 1;
  }

  return {
    adapterCount: adapterDirs.length,
    adapterWithTests,
    adapterWithPassWithNoTests,
  };
}

function main() {
  let source = '';
  try {
    source = fs.readFileSync(checklistPath, 'utf8');
  } catch (error) {
    const status = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      checks: [
        check(
          'master_checklist_readable',
          false,
          `failed to read ${path.relative(root, checklistPath)}: ${String(error && error.message ? error.message : error)}`,
        ),
      ],
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outMd, `# Master Checklist Governance\n\nStatus: fail\n\n- master_checklist_readable: fail\n`, 'utf8');
    process.exit(2);
  }

  const lines = source.split(/\r?\n/);
  const checkedCount = lines.filter(isChecked).length;
  const uncheckedCount = lines.filter(isUnchecked).length;
  const total = checkedCount + uncheckedCount;
  const completionPercent = total > 0 ? Number(((checkedCount / total) * 100).toFixed(2)) : 0;
  const summaryStatus = uncheckedCount === 0 ? 'complete' : 'in_progress';
  const riskyLines = lines
    .map((line, idx) => ({ line: idx + 1, text: line }))
    .filter((entry) => isRiskyDoDLine(entry.text));

  const checks = [];
  checks.push(
    check(
      'master_checklist_summary_machine_state',
      true,
      `checked=${checkedCount}, unchecked=${uncheckedCount}, completion_percent=${completionPercent}, summary_status=${summaryStatus}`,
    ),
  );
  checks.push(
    check(
      'dod_declaration_blocked_when_unchecked',
      !(uncheckedCount > 0 && riskyLines.length > 0),
      uncheckedCount > 0
        ? riskyLines.length > 0
          ? `unchecked=${uncheckedCount}; risky_dod_lines=${riskyLines.length}`
          : `unchecked=${uncheckedCount}; no risky DoD declaration lines detected`
        : 'all checklist items checked',
    ),
  );

  const adapterSnapshot = adapterTestSurfaceSnapshot(root);
  const adapterDisclosurePresent =
    /Adapter-level automated test suites remain limited in this snapshot/i.test(source)
    || /adapter-local suites are still limited in this snapshot/i.test(source);
  checks.push(
    check(
      'adapter_test_surface_disclosed_when_coverage_is_thin',
      adapterSnapshot.adapterWithTests > 0 || adapterDisclosurePresent,
      `adapters=${adapterSnapshot.adapterCount}; adapters_with_tests=${adapterSnapshot.adapterWithTests}; pass_with_no_tests=${adapterSnapshot.adapterWithPassWithNoTests}; disclosure_present=${adapterDisclosurePresent}`,
    ),
  );

  const failed = checks.filter((entry) => entry.status !== 'pass');
  const status = {
    generated_at: new Date().toISOString(),
    status: failed.length === 0 ? 'pass' : 'fail',
    checklist: {
      checked_count: checkedCount,
      unchecked_count: uncheckedCount,
      total_items: total,
      completion_percent: completionPercent,
      summary_status: summaryStatus,
    },
    adapter_test_surface: {
      adapter_count: adapterSnapshot.adapterCount,
      adapters_with_tests: adapterSnapshot.adapterWithTests,
      adapters_with_pass_with_no_tests: adapterSnapshot.adapterWithPassWithNoTests,
    },
    risky_dod_lines: riskyLines,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  const mdLines = [
    '# Master Checklist Governance',
    '',
    `Status: ${status.status}`,
    `Generated: ${status.generated_at}`,
    '',
    '## Summary',
    '',
    `- checked_count: ${checkedCount}`,
    `- unchecked_count: ${uncheckedCount}`,
    `- total_items: ${total}`,
    `- completion_percent: ${completionPercent}`,
    `- summary_status: ${summaryStatus}`,
    `- adapter_count: ${adapterSnapshot.adapterCount}`,
    `- adapters_with_tests: ${adapterSnapshot.adapterWithTests}`,
    `- adapters_with_pass_with_no_tests: ${adapterSnapshot.adapterWithPassWithNoTests}`,
    '',
    '## Checks',
    '',
    ...checks.map((entry) => `- ${entry.id}: ${entry.status} (${entry.detail})`),
    '',
  ];

  if (riskyLines.length > 0) {
    mdLines.push('## Risky DoD Lines');
    mdLines.push('');
    for (const entry of riskyLines) {
      mdLines.push(`- L${entry.line}: ${entry.text.trim()}`);
    }
    mdLines.push('');
  }

  fs.writeFileSync(outMd, `${mdLines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify(status, null, 2));
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && failed.length > 0) {
    process.exit(2);
  }
}

main();
