#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const releaseCommit = String(process.env.SVEN_RELEASE_COMMIT || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
const reproducibilityScope = {
  scope_id: 'bounded_release_artifacts_v1',
  scope_name: 'Bounded Release Artifact Reproducibility',
  scope_policy:
    'This gate proves reproducibility for explicitly configured release-critical targets only; it is not a full-repo deterministic build proof.',
};
const targetIds = String(process.env.SVEN_REPRO_TARGETS || 'cli_pack,quickstart_installers')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);
const allowedTargetIds = new Set(['cli_pack', 'quickstart_installers', 'release_files']);
const unknownTargetIds = targetIds.filter((id) => !allowedTargetIds.has(id));
const fileTargets = String(process.env.SVEN_REPRO_FILE_TARGETS || '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function runNpmPack(packDest) {
  const cwd = path.join(root, 'packages', 'cli');
  const result = spawnSync(`npm pack --json --silent --pack-destination "${packDest}"`, {
    cwd,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`npm pack failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(`Unable to parse npm pack output: ${result.stdout}`);
  }
  const fileName = parsed?.[0]?.filename;
  if (!fileName) throw new Error('npm pack output did not include filename');
  return path.join(packDest, fileName);
}

function run() {
  const lockPath = path.join(root, 'package-lock.json');
  const checks = [
    {
      id: 'lockfile_exists',
      pass: fs.existsSync(lockPath),
      detail: 'package-lock.json',
    },
    {
      id: 'reproducibility_scope_declared',
      pass: true,
      detail: `${reproducibilityScope.scope_id}: ${reproducibilityScope.scope_name}`,
    },
    {
      id: 'reproducibility_targets_supported',
      pass: unknownTargetIds.length === 0,
      detail: unknownTargetIds.length === 0 ? `targets=${targetIds.join(',') || '(none)'}` : `unknown=${unknownTargetIds.join(',')}`,
    },
  ];
  const matrix = [];
  const immutable_refs = [];

  if (targetIds.includes('cli_pack')) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sven-repro-'));
    const firstDir = path.join(tmpRoot, 'pack-1');
    const secondDir = path.join(tmpRoot, 'pack-2');
    fs.mkdirSync(firstDir, { recursive: true });
    fs.mkdirSync(secondDir, { recursive: true });

    const firstTar = runNpmPack(firstDir);
    const secondTar = runNpmPack(secondDir);
    const firstHash = sha256File(firstTar);
    const secondHash = sha256File(secondTar);
    const pass = path.basename(firstTar) === path.basename(secondTar) && firstHash === secondHash;
    matrix.push({
      id: 'cli_pack',
      scope_id: reproducibilityScope.scope_id,
      release_commit: releaseCommit,
      status: pass ? 'pass' : 'fail',
      package: '@sven/cli',
      artifacts: [
        { artifact_id: `cli_pack:${path.basename(firstTar)}`, path: path.basename(firstTar), sha256: firstHash, release_commit: releaseCommit },
        { artifact_id: `cli_pack:${path.basename(secondTar)}`, path: path.basename(secondTar), sha256: secondHash, release_commit: releaseCommit },
      ],
      checks: [
        {
          id: 'pack_filename_stable',
          pass: path.basename(firstTar) === path.basename(secondTar),
          detail: `${path.basename(firstTar)} vs ${path.basename(secondTar)}`,
        },
        {
          id: 'pack_sha256_stable',
          pass: firstHash === secondHash,
          detail: `${firstHash} == ${secondHash}`,
        },
      ],
    });
    immutable_refs.push({
      id: 'cli_pack',
      scope_id: reproducibilityScope.scope_id,
      artifact_id: `cli_pack:${path.basename(firstTar)}`,
      artifact: path.basename(firstTar),
      sha256: firstHash,
      release_commit: releaseCommit,
    });
  }

  if (targetIds.includes('quickstart_installers')) {
    const installerFiles = [
      'deploy/quickstart/install.sh',
      'deploy/quickstart/install.ps1',
      'deploy/quickstart/install.cmd',
    ];
    const installerArtifacts = installerFiles.map((rel) => {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) return { artifact_id: `quickstart_installers:${rel}`, path: rel, exists: false, sha256: null, release_commit: releaseCommit };
      return { artifact_id: `quickstart_installers:${rel}`, path: rel, exists: true, sha256: sha256File(abs), release_commit: releaseCommit };
    });
    const pass = installerArtifacts.every((artifact) => artifact.exists === true);
    matrix.push({
      id: 'quickstart_installers',
      scope_id: reproducibilityScope.scope_id,
      release_commit: releaseCommit,
      status: pass ? 'pass' : 'fail',
      artifacts: installerArtifacts,
      checks: [
        {
          id: 'installer_files_present',
          pass,
          detail: `${installerArtifacts.filter((artifact) => artifact.exists).length}/${installerArtifacts.length} files`,
        },
      ],
    });
    for (const artifact of installerArtifacts) {
      if (artifact.exists && artifact.sha256) {
        immutable_refs.push({
          id: 'quickstart_installers',
          scope_id: reproducibilityScope.scope_id,
          artifact_id: artifact.artifact_id,
          artifact: artifact.path,
          sha256: artifact.sha256,
          release_commit: releaseCommit,
        });
      }
    }
  }

  if (targetIds.includes('release_files')) {
    const fileArtifacts = fileTargets.map((rel) => {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) return { artifact_id: `release_files:${rel}`, path: rel, exists: false, sha256: null, release_commit: releaseCommit };
      return { artifact_id: `release_files:${rel}`, path: rel, exists: true, sha256: sha256File(abs), release_commit: releaseCommit };
    });
    const pass = fileArtifacts.length > 0 && fileArtifacts.every((artifact) => artifact.exists === true);
    matrix.push({
      id: 'release_files',
      scope_id: reproducibilityScope.scope_id,
      release_commit: releaseCommit,
      status: pass ? 'pass' : 'fail',
      artifacts: fileArtifacts,
      checks: [
        {
          id: 'release_files_present',
          pass,
          detail:
            fileArtifacts.length > 0
              ? `${fileArtifacts.filter((artifact) => artifact.exists).length}/${fileArtifacts.length} files`
              : 'no SVEN_REPRO_FILE_TARGETS configured',
        },
      ],
    });
    for (const artifact of fileArtifacts) {
      if (artifact.exists && artifact.sha256) {
        immutable_refs.push({
          id: 'release_files',
          scope_id: reproducibilityScope.scope_id,
          artifact_id: artifact.artifact_id,
          artifact: artifact.path,
          sha256: artifact.sha256,
          release_commit: releaseCommit,
        });
      }
    }
  }

  checks.push({
    id: 'reproducibility_matrix_targets_present',
    pass: matrix.length > 0,
    detail: matrix.length > 0 ? `${matrix.length} targets` : 'no reproducibility targets selected',
  });
  checks.push({
    id: 'reproducibility_matrix_all_pass',
    pass: matrix.length > 0 && matrix.every((entry) => entry.status === 'pass'),
    detail:
      matrix.length > 0
        ? `${matrix.filter((entry) => entry.status === 'pass').length}/${matrix.length} targets passed`
        : 'matrix empty',
  });

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    reproducibility_scope: reproducibilityScope,
    release_commit: releaseCommit,
    targets: targetIds,
    matrix,
    immutable_refs,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-reproducibility-latest.json');
  const outMd = path.join(outDir, 'release-reproducibility-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Release Reproducibility Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Scope: ${report.reproducibility_scope.scope_id} (${report.reproducibility_scope.scope_name})`,
    `Scope policy: ${report.reproducibility_scope.scope_policy}`,
    `Release commit: ${report.release_commit || '(unset)'}`,
    `Targets: ${report.targets.join(', ') || '(none)'}`,
    '',
    '## Reproducibility Matrix',
    ...report.matrix.map((entry) => `- ${entry.id}: ${entry.status}`),
    '',
    '## Immutable References',
    ...report.immutable_refs.map((ref) => `- [${ref.id}] ${ref.artifact}: sha256=${ref.sha256}`),
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
