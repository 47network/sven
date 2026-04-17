#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const statusDir = path.join(root, 'docs', 'release', 'status');
const PLAINTEXT_PLACEHOLDER_OR_TEST_PATTERN = /(__tests__|\.example\.|replace-with|REPLACE_WITH)/i;

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function inferOwner(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (normalized.startsWith('services/')) {
    return normalized.split('/').slice(0, 2).join('/');
  }
  if (normalized.startsWith('packages/')) {
    return normalized.split('/').slice(0, 2).join('/');
  }
  if (normalized.startsWith('apps/')) {
    return normalized.split('/').slice(0, 2).join('/');
  }
  if (normalized.startsWith('.github/')) return '.github';
  if (normalized.startsWith('scripts/')) return 'scripts';
  if (normalized.startsWith('deploy/')) return 'deploy';
  return 'repo-root';
}

function pushItem(items, source, severity, owner, title, evidence) {
  items.push({
    source,
    severity,
    owner,
    title,
    evidence,
  });
}

function toCounts(items, key) {
  const out = {};
  for (const item of items) {
    const k = String(item[key] || 'unknown');
    out[k] = (out[k] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function classifyTriage(item) {
  const severity = String(item.severity || 'unknown').toLowerCase();
  const source = String(item.source || '').toLowerCase();
  const owner = String(item.owner || '');
  const title = String(item.title || '');

  if (severity === 'critical') {
    return { action: 'fix_now', rationale: 'critical severity' };
  }
  if (severity === 'high') {
    return { action: 'fix_now', rationale: 'high severity' };
  }
  if (source === 'plaintext-secrets-check') {
    if (PLAINTEXT_PLACEHOLDER_OR_TEST_PATTERN.test(`${title} ${JSON.stringify(item.evidence || {})}`)) {
      return { action: 'defer', rationale: 'likely non-production placeholder/test fixture; review in periodic cleanup' };
    }
    return { action: 'review_false_positive', rationale: 'secret-like pattern requires manual validation' };
  }
  if (source === 'dependency-audit' && (severity === 'moderate' || severity === 'low' || severity === 'info')) {
    return { action: 'defer', rationale: 'below immediate threshold; schedule with normal dependency upgrades' };
  }
  if (source === 'auth-surface-check' && owner === 'services/gateway-api') {
    return { action: 'fix_now', rationale: 'internet-facing auth coverage ambiguity' };
  }
  return { action: 'defer', rationale: 'non-critical severity; prioritize after critical/high burn-down' };
}

function main() {
  const dependency = readJsonIfExists(path.join(statusDir, 'dependency-vuln-latest.json'));
  const plaintext = readJsonIfExists(path.join(statusDir, 'security-plaintext-secrets-latest.json'));
  const authSurface = readJsonIfExists(path.join(statusDir, 'security-auth-surface-latest.json'));
  const transport = readJsonIfExists(path.join(statusDir, 'security-transport-csp-latest.json'));
  const codeScanning = readJsonIfExists(path.join(statusDir, 'code-scanning-alerts-latest.json'));
  const secretScanning = readJsonIfExists(path.join(statusDir, 'secret-scanning-alerts-latest.json'));

  const items = [];

  if (dependency?.reports && Array.isArray(dependency.reports)) {
    for (const report of dependency.reports) {
      const rel = path.relative(root, report.cwd || '').replace(/\\/g, '/');
      const owner = inferOwner(rel);
      const vulns = report.vulnerabilities || {};
      for (const sev of ['critical', 'high', 'moderate', 'low', 'info']) {
        const count = Number(vulns[sev] || 0);
        if (count <= 0) continue;
        pushItem(
          items,
          'dependency-audit',
          sev,
          owner,
          `${count} ${sev} dependency vulnerabilities`,
          { path: rel, count },
        );
      }
    }
  }

  if (plaintext?.findings && Array.isArray(plaintext.findings)) {
    for (const finding of plaintext.findings) {
      const file = String(finding.file || '');
      pushItem(
        items,
        'plaintext-secrets-check',
        'moderate',
        inferOwner(file),
        'Potential plaintext secret pattern',
        { file, line: finding.line || null },
      );
    }
  }

  if (authSurface?.unknown && Array.isArray(authSurface.unknown)) {
    for (const route of authSurface.unknown) {
      const file = String(route.file || '');
      pushItem(
        items,
        'auth-surface-check',
        'high',
        inferOwner(file),
        `Auth coverage unknown: ${route.method || 'ROUTE'} ${route.path || route.route_literal || ''}`.trim(),
        { file, reason: route.reason || '' },
      );
    }
  }

  if (transport?.checks && Array.isArray(transport.checks)) {
    for (const check of transport.checks) {
      if (check?.pass) continue;
      pushItem(
        items,
        'transport-csp-check',
        'high',
        'repo-root',
        `Transport/CSP check failed: ${check.name || 'unnamed-check'}`,
        { detail: check.detail || '' },
      );
    }
  }

  if (Array.isArray(codeScanning)) {
    for (const alert of codeScanning) {
      const file = String(alert?.most_recent_instance?.location?.path || '');
      const severity = String(alert?.rule?.security_severity_level || alert?.rule?.severity || 'unknown').toLowerCase();
      pushItem(
        items,
        'code-scanning',
        severity,
        inferOwner(file),
        String(alert?.rule?.description || alert?.rule?.name || 'Code scanning alert'),
        { file, alert_number: alert?.number || null },
      );
    }
  }

  if (Array.isArray(secretScanning)) {
    for (const alert of secretScanning) {
      const file = String(alert?.location?.path || '');
      pushItem(
        items,
        'secret-scanning',
        'critical',
        inferOwner(file),
        String(alert?.secret_type_display_name || alert?.secret_type || 'Secret scanning alert'),
        { file, alert_number: alert?.number || null },
      );
    }
  }

  const triaged = items.map((item) => {
    const triage = classifyTriage(item);
    return { ...item, triage };
  });

  const summary = {
    generated_at: new Date().toISOString(),
    totals: {
      findings: triaged.length,
      by_source: toCounts(triaged, 'source'),
      by_severity: toCounts(triaged, 'severity'),
      by_owner: toCounts(triaged, 'owner'),
      by_triage_action: toCounts(triaged.map((item) => ({ action: item.triage.action })), 'action'),
    },
  };

  const backlog = {
    status: 'pass',
    ...summary,
    findings: triaged,
  };

  const outJson = path.join(statusDir, 'security-remediation-backlog-latest.json');
  const outMd = path.join(statusDir, 'security-remediation-backlog-latest.md');
  fs.mkdirSync(statusDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(backlog, null, 2)}\n`, 'utf8');

  const lines = [
    '# Security Remediation Backlog',
    '',
    `Generated: ${summary.generated_at}`,
    `Total findings: ${summary.totals.findings}`,
    '',
    '## Findings by source',
    ...Object.entries(summary.totals.by_source).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Findings by severity',
    ...Object.entries(summary.totals.by_severity).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Findings by owner',
    ...Object.entries(summary.totals.by_owner).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Triage summary',
    ...Object.entries(summary.totals.by_triage_action).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Top remediation priorities (critical/high)',
    ...triaged
      .filter((item) => item.severity === 'critical' || item.severity === 'high')
      .slice(0, 50)
      .map((item) => `- [${item.severity}] (${item.source}) ${item.owner}: ${item.title}`),
    '',
    '## Deferred with rationale (sample)',
    ...triaged
      .filter((item) => item.triage.action === 'defer')
      .slice(0, 30)
      .map((item) => `- (${item.source}) ${item.owner}: ${item.title} — ${item.triage.rationale}`),
    '',
    '## Review false-positive candidates (sample)',
    ...triaged
      .filter((item) => item.triage.action === 'review_false_positive')
      .slice(0, 30)
      .map((item) => `- (${item.source}) ${item.owner}: ${item.title} — ${item.triage.rationale}`),
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
}

main();
