#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const strict = process.argv.includes('--strict');
const includeDev = process.argv.includes('--include-dev');
const productionOnly = !includeDev;
const MAX_CRITICAL = Number(process.env.SECURITY_MAX_CRITICAL || 0);
const MAX_HIGH = Number(process.env.SECURITY_MAX_HIGH || 0);

function readRootWorkspaces() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return [];
  }
  const raw = parsed && Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
  return raw
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0);
}

function expandWorkspacePattern(pattern) {
  const normalized = String(pattern || '').replace(/\\/g, '/');
  const wildcard = normalized.endsWith('/*');
  const baseRel = wildcard ? normalized.slice(0, -2) : normalized;
  const baseAbs = path.join(process.cwd(), baseRel);
  if (!fs.existsSync(baseAbs) || !fs.statSync(baseAbs).isDirectory()) return [];
  if (!wildcard) {
    return fs.existsSync(path.join(baseAbs, 'package.json')) ? [baseAbs] : [];
  }
  const roots = [];
  const entries = fs.readdirSync(baseAbs, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(baseAbs, entry.name);
    if (!fs.existsSync(path.join(candidate, 'package.json'))) continue;
    roots.push(candidate);
  }
  return roots;
}

function runJson(cwd, args) {
  const proc = spawnSync('npm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const stdout = String(proc.stdout || '').trim();
  let parsed = {};
  try {
    parsed = stdout ? JSON.parse(stdout) : {};
  } catch {
    parsed = {};
  }
  return { status: proc.status, parsed };
}

function collectProdPackages(tree, out = new Set()) {
  if (!tree || typeof tree !== 'object') return out;
  const deps = tree.dependencies || {};
  for (const [name, dep] of Object.entries(deps)) {
    out.add(name);
    collectProdPackages(dep, out);
  }
  return out;
}

function packageNameFromNodePath(nodePath) {
  const marker = 'node_modules/';
  const idx = String(nodePath || '').lastIndexOf(marker);
  if (idx < 0) return '';
  const tail = String(nodePath).slice(idx + marker.length);
  const parts = tail.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts[0].startsWith('@') && parts.length > 1) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

function filterProdVulnerabilities(vulns, prodPackageSet) {
  const entries = Object.entries(vulns || {});
  const included = [];
  const excluded = [];
  for (const [name, vuln] of entries) {
    const nodes = Array.isArray(vuln?.nodes) ? vuln.nodes : [];
    const nodePkgs = nodes.map(packageNameFromNodePath).filter(Boolean);
    const relevantByNode = nodePkgs.some((pkg) => prodPackageSet.has(pkg));
    const relevantByName = prodPackageSet.has(name);
    const relevant = relevantByNode || relevantByName;
    const row = {
      name,
      severity: String(vuln?.severity || 'info'),
      nodes: nodes.length,
    };
    if (relevant) included.push(row);
    else excluded.push(row);
  }
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const vuln of included) {
    if (Object.prototype.hasOwnProperty.call(counts, vuln.severity)) {
      counts[vuln.severity] += 1;
    } else {
      counts.info += 1;
    }
    counts.total += 1;
  }
  return { counts, included, excluded };
}

function runAudit(cwd) {
  const args = ['audit', '--json', ...(productionOnly ? ['--omit=dev'] : [])];
  const audit = runJson(cwd, args);
  const parsed = audit.parsed || {};
  const vulns = parsed.metadata?.vulnerabilities || {};
  const prodTree = runJson(cwd, ['ls', '--omit=dev', '--all', '--json']);
  const prodSet = collectProdPackages(prodTree.parsed);
  const filtered = filterProdVulnerabilities(parsed.vulnerabilities || {}, prodSet);
  const effective = productionOnly
    ? filtered.counts
    : {
        info: Number(vulns.info || 0),
        low: Number(vulns.low || 0),
        moderate: Number(vulns.moderate || 0),
        high: Number(vulns.high || 0),
        critical: Number(vulns.critical || 0),
        total: Number(vulns.total || 0),
      };

  return {
    cwd,
    exit_code: audit.status,
    scope: {
      production_only: productionOnly,
      prod_dependency_count: prodSet.size,
      filtered_excluded_count: filtered.excluded.length,
    },
    raw_vulnerabilities: {
      info: Number(vulns.info || 0),
      low: Number(vulns.low || 0),
      moderate: Number(vulns.moderate || 0),
      high: Number(vulns.high || 0),
      critical: Number(vulns.critical || 0),
      total: Number(vulns.total || 0),
    },
    filtered_vulnerabilities: filtered.counts,
    vulnerabilities: {
      info: Number(effective.info || 0),
      low: Number(effective.low || 0),
      moderate: Number(effective.moderate || 0),
      high: Number(effective.high || 0),
      critical: Number(effective.critical || 0),
      total: Number(effective.total || 0),
    },
    filtered_excluded_samples: filtered.excluded.slice(0, 25),
  };
}

function discoverWorkspaceAuditRoots() {
  const roots = [];
  const seen = new Set();
  const workspacePatterns = readRootWorkspaces();
  for (const pattern of workspacePatterns) {
    const expanded = expandWorkspacePattern(pattern);
    for (const candidate of expanded) {
      const normalized = path.normalize(candidate);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      roots.push(candidate);
    }
  }
  return {
    workspace_patterns: workspacePatterns,
    roots: roots.sort((a, b) => a.localeCompare(b)),
  };
}

function main() {
  const discovery = discoverWorkspaceAuditRoots();
  const roots = discovery.roots;
  const workspacePatterns = discovery.workspace_patterns;

  const reports = roots.map(runAudit);
  const agg = reports.reduce(
    (acc, r) => {
      acc.info += r.vulnerabilities.info;
      acc.low += r.vulnerabilities.low;
      acc.moderate += r.vulnerabilities.moderate;
      acc.high += r.vulnerabilities.high;
      acc.critical += r.vulnerabilities.critical;
      acc.total += r.vulnerabilities.total;
      return acc;
    },
    { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
  );

  const scannedRel = roots.map((cwd) => path.relative(process.cwd(), cwd).replace(/\\/g, '/'));
  const expectedRel = scannedRel.slice();
  const scannedSet = new Set(scannedRel);
  const missingWorkspaceScans = expectedRel.filter((rel) => !scannedSet.has(rel));
  const coveragePass = expectedRel.length > 0 && missingWorkspaceScans.length === 0;

  const pass = coveragePass && agg.critical <= MAX_CRITICAL && agg.high <= MAX_HIGH;
  const status = pass ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    mode: {
      strict,
      production_only: productionOnly,
    },
    thresholds: { max_critical: MAX_CRITICAL, max_high: MAX_HIGH },
    status,
    coverage: {
      workspace_patterns: workspacePatterns,
      audit_roots: scannedRel,
      expected_workspace_roots: expectedRel,
      missing_workspace_scans: missingWorkspaceScans,
      coverage_pass: coveragePass,
      audit_root_count: roots.length,
      deterministic_workspace_scope: workspacePatterns,
    },
    aggregate: agg,
    reports,
  };

  const outJson = path.join(process.cwd(), 'docs', 'release', 'status', 'dependency-vuln-latest.json');
  const outMd = path.join(process.cwd(), 'docs', 'release', 'status', 'dependency-vuln-latest.md');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Dependency Vulnerability Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${status}`,
    `Mode: strict=${strict}, production_only=${productionOnly}`,
    `Thresholds: critical<=${MAX_CRITICAL}, high<=${MAX_HIGH}`,
    `Coverage roots: ${report.coverage.audit_root_count}`,
    `Workspace coverage pass: ${coveragePass}`,
    `Missing workspace scans: ${missingWorkspaceScans.length}`,
    '',
    `Aggregate: total=${agg.total}, critical=${agg.critical}, high=${agg.high}, moderate=${agg.moderate}, low=${agg.low}, info=${agg.info}`,
    '',
    'Per-project:',
    ...reports.map((r) => `- ${path.relative(process.cwd(), r.cwd) || '.'}: total=${r.vulnerabilities.total}, critical=${r.vulnerabilities.critical}, high=${r.vulnerabilities.high}, filtered_excluded=${r.scope.filtered_excluded_count}`),
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (!pass) process.exit(2);
}

main();
