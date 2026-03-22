const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCOPE_CONFIG_REL = path.join('config', 'release', 'ops-shell-scope.json');
const DEFAULT_GLOBS = [
  'scripts/ops/**/*.sh',
  'scripts/ops/**/*.ps1',
  'scripts/ops/**/*.cjs',
  'scripts/ops/**/*.js',
  'scripts/ops/**/*.md',
  '.github/workflows/ops-shell-ci.yml',
];

function normalizeRelPath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasTrue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function hasFalse(value) {
  return ['0', 'false', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
}

function loadScopeGlobs(rootDir) {
  const abs = path.join(rootDir, SCOPE_CONFIG_REL);
  if (!fs.existsSync(abs)) return DEFAULT_GLOBS.slice();
  try {
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const values = Array.isArray(parsed?.path_globs)
      ? parsed.path_globs.map((value) => normalizeRelPath(value)).filter(Boolean)
      : [];
    return values.length ? values : DEFAULT_GLOBS.slice();
  } catch {
    return DEFAULT_GLOBS.slice();
  }
}

function globToRegex(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function runGit(rootDir, args) {
  const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  return {
    code: result.status ?? -1,
    out: String(result.stdout || ''),
    err: String(result.stderr || ''),
  };
}

function parseChangedFiles(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => normalizeRelPath(line))
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function getChangedFiles({ rootDir, targetSha, baseRef }) {
  const candidates = [];
  if (baseRef && targetSha) {
    candidates.push({
      mode: `git diff ${baseRef}...${targetSha}`,
      args: ['diff', '--name-only', `${baseRef}...${targetSha}`],
    });
  }
  if (targetSha) {
    candidates.push({
      mode: `git show ${targetSha}`,
      args: ['show', '--pretty=format:', '--name-only', targetSha],
    });
  }
  candidates.push({
    mode: 'git diff HEAD~1..HEAD',
    args: ['diff', '--name-only', 'HEAD~1', 'HEAD'],
  });

  for (const candidate of candidates) {
    const run = runGit(rootDir, candidate.args);
    if (run.code !== 0) continue;
    const files = unique(parseChangedFiles(run.out));
    if (files.length > 0) {
      return {
        files,
        source: candidate.mode,
      };
    }
  }

  return {
    files: [],
    source: 'no_changed_files_detected',
  };
}

function detectOpsShellCiRequirement(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const targetSha = String(options.targetSha || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
  const baseRef = String(options.baseRef || process.env.SVEN_OPS_SHELL_CI_BASE_REF || '').trim() || null;
  const override = process.env.SVEN_OPS_SHELL_CI_REQUIRED;
  if (hasTrue(override)) {
    return {
      required: true,
      matched_files: [],
      changed_files: [],
      scope_globs: loadScopeGlobs(rootDir),
      source: 'env_override_true',
    };
  }
  if (hasFalse(override)) {
    return {
      required: false,
      matched_files: [],
      changed_files: [],
      scope_globs: loadScopeGlobs(rootDir),
      source: 'env_override_false',
    };
  }

  const scopeGlobs = loadScopeGlobs(rootDir);
  const scopeRegexes = scopeGlobs.map(globToRegex);
  const changed = getChangedFiles({ rootDir, targetSha, baseRef });
  const matchedFiles = changed.files.filter((file) => scopeRegexes.some((regex) => regex.test(file)));
  return {
    required: matchedFiles.length > 0,
    matched_files: matchedFiles,
    changed_files: changed.files,
    scope_globs: scopeGlobs,
    source: changed.source,
  };
}

module.exports = {
  SCOPE_CONFIG_REL,
  detectOpsShellCiRequirement,
};
