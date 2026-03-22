#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function listReleaseNotes() {
  const dir = path.join(root, 'docs', 'release', 'notes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^rc-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();
}

function semverLike(value) {
  return /^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(value);
}

function run() {
  const pkgRoot = readJson('package.json');
  const pkgCli = readJson('packages/cli/package.json');
  const changelogPath = path.join(root, 'docs', 'release', 'changelog.md');
  const releaseNotes = listReleaseNotes();
  const latestReleaseNote = releaseNotes.length > 0 ? releaseNotes[releaseNotes.length - 1] : '';
  const changelog = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '';

  const checks = [
    {
      id: 'root_version_semver',
      pass: semverLike(String(pkgRoot.version || '')),
      detail: `package.json version=${pkgRoot.version || '(missing)'}`,
    },
    {
      id: 'cli_version_semver',
      pass: semverLike(String(pkgCli.version || '')),
      detail: `packages/cli version=${pkgCli.version || '(missing)'}`,
    },
    {
      id: 'cli_version_matches_root',
      pass: String(pkgCli.version || '') === String(pkgRoot.version || ''),
      detail: `${pkgCli.version || '(missing)'} == ${pkgRoot.version || '(missing)'}`,
    },
    {
      id: 'release_note_exists',
      pass: Boolean(latestReleaseNote),
      detail: latestReleaseNote || 'none',
    },
    {
      id: 'changelog_exists',
      pass: fs.existsSync(changelogPath),
      detail: path.relative(root, changelogPath),
    },
    {
      id: 'changelog_has_current_version',
      pass: changelog.includes(`## v${pkgRoot.version}`),
      detail: `expects heading: ## v${pkgRoot.version}`,
    },
    {
      id: 'changelog_links_latest_rc_note',
      pass: latestReleaseNote ? changelog.includes(`notes/${latestReleaseNote}`) : false,
      detail: latestReleaseNote ? `notes/${latestReleaseNote}` : 'latest release note missing',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    release: {
      root_version: pkgRoot.version,
      cli_version: pkgCli.version,
      latest_release_note: latestReleaseNote || null,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-versioning-latest.json');
  const outMd = path.join(outDir, 'release-versioning-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Release Versioning and Changelog Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Root version: ${pkgRoot.version}`,
    `CLI version: ${pkgCli.version}`,
    `Latest RC note: ${latestReleaseNote || 'none'}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
