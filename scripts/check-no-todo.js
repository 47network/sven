import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const scanRoots = String(process.env.SVEN_CHECK_NO_TODO_SCAN_ROOTS || 'services,apps,packages')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const excludedDirNames = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.git',
  'coverage'
]);

const excludedFilePatterns = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /__tests__/i,
  /\.md$/i,
  /tsconfig\.tsbuildinfo$/i
];

const targetFilePatterns = [
  /\.[cm]?[jt]sx?$/i,
  /\.sql$/i,
  /\.ya?ml$/i
];

const markerPattern = /\b(?:TODO|FIXME)\b/i;
const violations = [];

function shouldSkipFile(relPath) {
  return excludedFilePatterns.some((re) => re.test(relPath));
}

function isTargetFile(relPath) {
  return targetFilePatterns.some((re) => re.test(relPath));
}

function isJavaScriptOrTypeScript(relPath) {
  return /\.[cm]?[jt]sx?$/i.test(relPath);
}

function isSql(relPath) {
  return /\.sql$/i.test(relPath);
}

function isYaml(relPath) {
  return /\.ya?ml$/i.test(relPath);
}

function lineContainsTodoComment(line, relPath) {
  if (!markerPattern.test(line)) {
    return false;
  }
  if (isJavaScriptOrTypeScript(relPath)) {
    return /(\/\/.*\b(?:TODO|FIXME)\b|\/\*.*\b(?:TODO|FIXME)\b|\b(?:TODO|FIXME)\b.*\*\/)/i.test(line);
  }
  if (isSql(relPath)) {
    return /(--.*\b(?:TODO|FIXME)\b|\/\*.*\b(?:TODO|FIXME)\b|\b(?:TODO|FIXME)\b.*\*\/)/i.test(line);
  }
  if (isYaml(relPath)) {
    return /#.*\b(?:TODO|FIXME)\b/i.test(line);
  }
  return false;
}

function loadAllowlist() {
  const configuredPath = process.env.SVEN_CHECK_NO_TODO_ALLOWLIST_PATH;
  const fallbackPath = path.join(ROOT, 'docs', 'release', 'no-todo-allowlist.json');
  const allowlistPath = configuredPath ? path.resolve(ROOT, configuredPath) : fallbackPath;
  if (!fs.existsSync(allowlistPath)) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  } catch (error) {
    console.error(`Invalid TODO allowlist JSON at ${path.relative(ROOT, allowlistPath)}: ${error.message}`);
    process.exit(1);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    console.error(
      `Invalid TODO allowlist shape at ${path.relative(
        ROOT,
        allowlistPath,
      )}: expected {"entries":[{"path":"...","line":N?,"text":"...?"}]}`,
    );
    process.exit(1);
  }
  return parsed.entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      path: typeof entry.path === 'string' ? entry.path.replace(/\\/g, '/') : '',
      line: Number.isInteger(entry.line) ? entry.line : null,
      text: typeof entry.text === 'string' ? entry.text : null,
    }))
    .filter((entry) => entry.path.length > 0);
}

const allowlist = loadAllowlist();

function isAllowlisted(relPath, lineNumber, line) {
  return allowlist.some((entry) => {
    if (entry.path !== relPath) {
      return false;
    }
    if (entry.line !== null && entry.line !== lineNumber) {
      return false;
    }
    if (entry.text && !line.includes(entry.text)) {
      return false;
    }
    return true;
  });
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (excludedDirNames.has(entry.name)) {
        continue;
      }
      walk(fullPath);
      continue;
    }

    if (!isTargetFile(relPath) || shouldSkipFile(relPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineNumber = i + 1;
      if (!lineContainsTodoComment(line, relPath)) {
        continue;
      }
      if (isAllowlisted(relPath, lineNumber, line)) {
        continue;
      }
      if (markerPattern.test(line)) {
        violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
      }
    }
  }
}

for (const scanRoot of scanRoots) {
  const full = path.isAbsolute(scanRoot) ? scanRoot : path.join(ROOT, scanRoot);
  if (fs.existsSync(full)) {
    walk(full);
  }
}

if (violations.length > 0) {
  console.error('TODO/FIXME markers found in production code:');
  for (const v of violations) {
    console.error(`- ${v}`);
  }
  process.exit(1);
}

console.log('No TODO/FIXME markers found in scanned production code.');
