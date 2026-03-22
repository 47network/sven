#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function run() {
  const rel = 'docs/security/privacy/mobile-app-store-privacy-declarations-2026.md';
  const full = path.join(root, rel);
  const body = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';

  const checks = [
    { id: 'privacy_declaration_doc_present', pass: Boolean(body), detail: rel },
    { id: 'apple_section_present', pass: body.includes('## Apple App Privacy'), detail: rel },
    { id: 'google_play_section_present', pass: body.includes('## Google Play Data Safety'), detail: rel },
    {
      id: 'approval_section_present',
      pass: body.includes('Product: approved')
        && body.includes('Security: approved')
        && body.includes('Release owner: approved'),
      detail: 'expects product/security/release owner approvals',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = { generated_at: new Date().toISOString(), status, checks };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-app-store-privacy-latest.json');
  const outMd = path.join(outDir, 'mobile-app-store-privacy-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Mobile App Store Privacy Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();

