#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const local = process.argv.includes('--local');

function exists(relPath) { return fs.existsSync(path.join(root, relPath)); }
function read(relPath) { return fs.readFileSync(path.join(root, relPath), 'utf8'); }
function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }

function run() {
  const voiceoverCandidates = [
    'docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md',
    'docs/release/evidence/mobile/voiceover_audit_20260221.md',
  ];
  const voiceoverPath = voiceoverCandidates.find((p) => exists(p));
  const voiceoverBody = voiceoverPath ? read(voiceoverPath) : '';
  const voiceoverPass = voiceoverPath
    ? /^verdict:\s*pass\s*$/im.test(voiceoverBody)
    : false;

  const checks = [
    {
      id: 'flutter_a11y_test_suite_present',
      pass: exists('apps/companion-user-flutter/test/a11y_test.dart'),
      detail: 'apps/companion-user-flutter/test/a11y_test.dart',
    },
    {
      id: 'widget_semantics_coverage_present',
      pass: exists('apps/companion-user-flutter/test/widget_screen_test.dart')
        && read('apps/companion-user-flutter/test/widget_screen_test.dart').toLowerCase().includes('a11y'),
      detail: 'apps/companion-user-flutter/test/widget_screen_test.dart',
    },
    {
      id: 'talkback_artifacts_present',
      pass: exists('docs/release/evidence/mobile/logcat_signin_20260213-190325.txt')
        || exists('docs/release/evidence/mobile/logcat_signin_20260213-190302.txt'),
      detail: 'docs/release/evidence/mobile/logcat_signin_*.txt',
    },
    {
      id: 'voiceover_artifact_present',
      pass: local ? true : voiceoverPass,
      detail: local
        ? 'local_mode_skip: manual iOS VoiceOver verdict not required for local validation'
        : (voiceoverPath
          ? `${voiceoverPath} (requires "Verdict: pass")`
          : 'expected VoiceOver evidence document'),
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    mode: local ? 'local' : 'strict',
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-accessibility-latest.json');
  const outMd = path.join(outDir, 'mobile-accessibility-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Mobile Accessibility Check',
    '',
    `Generated: ${report.generated_at}`,
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
