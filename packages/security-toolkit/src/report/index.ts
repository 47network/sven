// ──── Security Report Generator ──────────────────────────────────
// Combines findings from SAST, dependency audit, secret scan, infra scan,
// and pentest into a unified security posture report.

import type { SastReport } from '../sast/index.js';
import type { DepAuditReport } from '../dependency-audit/index.js';
import type { SecretScanReport } from '../secret-scanner/index.js';
import type { InfraAuditReport } from '../infra-scanner/index.js';
import type { PentestReport } from '../pentest/index.js';

// ──── Types ──────────────────────────────────────────────────────

export type PostureGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SecurityPosture {
  readonly generatedAt: string;
  readonly overallScore: number;
  readonly grade: PostureGrade;
  readonly scores: {
    readonly sast: number | null;
    readonly dependencies: number | null;
    readonly secrets: number | null;
    readonly infrastructure: number | null;
    readonly pentest: number | null;
  };
  readonly criticalFindings: number;
  readonly highFindings: number;
  readonly mediumFindings: number;
  readonly lowFindings: number;
  readonly totalFindings: number;
  readonly secretsClean: boolean;
  readonly topRisks: readonly string[];
  readonly recommendations: readonly string[];
  readonly complianceNotes: readonly ComplianceNote[];
}

export interface ComplianceNote {
  readonly framework: string;
  readonly control: string;
  readonly status: 'pass' | 'fail' | 'partial' | 'not-tested';
  readonly detail: string;
}

export interface SecurityDigest {
  readonly generatedAt: string;
  readonly period: 'daily' | 'weekly';
  readonly posture: SecurityPosture;
  readonly newFindings: number;
  readonly resolvedFindings: number;
  readonly trend: 'improving' | 'stable' | 'degrading';
  readonly summary: string;
}

// ──── Score Computation ──────────────────────────────────────────

function scoreToGrade(score: number): PostureGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function weightedAverage(scores: readonly (number | null)[], weights: readonly number[]): number {
  let totalWeight = 0;
  let sum = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] !== null) {
      sum += (scores[i] as number) * weights[i];
      totalWeight += weights[i];
    }
  }
  return totalWeight > 0 ? Math.round(sum / totalWeight) : 0;
}

// ──── Report Assembly ────────────────────────────────────────────

/**
 * Generate a unified security posture from individual scan reports.
 * Pass null for any scan that wasn't run.
 */
export function generateSecurityPosture(opts: {
  sast?: SastReport | null;
  dependencies?: DepAuditReport | null;
  secrets?: SecretScanReport | null;
  infrastructure?: InfraAuditReport | null;
  pentest?: PentestReport | null;
}): SecurityPosture {
  const scores = {
    sast: opts.sast?.securityScore ?? null,
    dependencies: opts.dependencies?.securityScore ?? null,
    secrets: opts.secrets ? (opts.secrets.clean ? 100 : 0) : null,
    infrastructure: opts.infrastructure?.securityScore ?? null,
    pentest: opts.pentest?.overallScore ?? null,
  };

  // Weights: SAST and secrets are most important
  const overallScore = weightedAverage(
    [scores.sast, scores.dependencies, scores.secrets, scores.infrastructure, scores.pentest],
    [30, 20, 25, 15, 10],
  );

  // Aggregate severity counts
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  if (opts.sast) {
    critical += opts.sast.bySeverity.critical;
    high += opts.sast.bySeverity.high;
    medium += opts.sast.bySeverity.medium;
    low += opts.sast.bySeverity.low;
  }
  if (opts.dependencies) {
    critical += opts.dependencies.byRisk.critical;
    high += opts.dependencies.byRisk.high;
    medium += opts.dependencies.byRisk.medium;
    low += opts.dependencies.byRisk.low;
  }
  if (opts.secrets) {
    critical += opts.secrets.bySeverity.critical;
    high += opts.secrets.bySeverity.high;
    medium += opts.secrets.bySeverity.medium;
  }
  if (opts.infrastructure) {
    critical += opts.infrastructure.bySeverity.critical;
    high += opts.infrastructure.bySeverity.high;
    medium += opts.infrastructure.bySeverity.medium;
    low += opts.infrastructure.bySeverity.low;
  }
  if (opts.pentest) {
    for (const v of opts.pentest.vulnerabilities) {
      if (v.severity === 'critical') critical++;
      else if (v.severity === 'high') high++;
      else if (v.severity === 'medium') medium++;
      else low++;
    }
  }

  const totalFindings = critical + high + medium + low;

  // Top risks
  const topRisks: string[] = [];
  if (opts.secrets && !opts.secrets.clean) topRisks.push(`${opts.secrets.secretsFound} secret(s) found in source code — immediate rotation required`);
  if (critical > 0) topRisks.push(`${critical} critical finding(s) require immediate attention`);
  if (opts.dependencies && opts.dependencies.byRisk.critical > 0) topRisks.push('Critical dependency CVEs detected');
  if (opts.infrastructure && opts.infrastructure.bySeverity.critical > 0) topRisks.push('Critical infrastructure misconfigurations detected');

  // Recommendations
  const recommendations: string[] = [];
  if (!opts.secrets) recommendations.push('Run secret scanning to validate that no credentials or keys are committed.');
  if (opts.secrets && !opts.secrets.clean) recommendations.push('Rotate all detected secrets immediately. Remove them from source and use a secrets manager.');
  if (critical > 0) recommendations.push('Address all critical findings before next deployment.');
  if (opts.dependencies && opts.dependencies.byRisk.critical > 0) recommendations.push('Upgrade dependencies with critical CVEs.');
  if (opts.sast && opts.sast.bySeverity.critical > 0) recommendations.push('Fix critical SAST findings: SQL injection, command injection, or hardcoded secrets.');
  if (high > 5) recommendations.push('Schedule a focused sprint to address high-severity findings.');
  if (totalFindings === 0 && (opts.sast || opts.secrets)) recommendations.push('Security posture is strong. Continue regular scanning.');

  // Compliance notes
  const complianceNotes: ComplianceNote[] = [];

  // OWASP A03 Injection
  const injectionFindings = (opts.sast?.byCategory['sql-injection'] ?? 0) + (opts.sast?.byCategory['command-injection'] ?? 0) + (opts.sast?.byCategory['xss'] ?? 0);
  complianceNotes.push({
    framework: 'OWASP',
    control: 'A03:2021-Injection',
    status: injectionFindings === 0 ? (opts.sast ? 'pass' : 'not-tested') : 'fail',
    detail: injectionFindings > 0 ? `${injectionFindings} injection finding(s)` : 'No injection vulnerabilities detected',
  });

  // OWASP A07 Auth
  const authFindings = opts.sast?.byCategory['auth-bypass'] ?? 0;
  complianceNotes.push({
    framework: 'OWASP',
    control: 'A07:2021-Auth Failures',
    status: authFindings === 0 ? (opts.sast ? 'pass' : 'not-tested') : 'fail',
    detail: authFindings > 0 ? `${authFindings} auth bypass finding(s)` : 'No auth bypass patterns detected',
  });

  // SOC 2 - Secrets
  complianceNotes.push({
    framework: 'SOC 2',
    control: 'CC6.1-Secret Management',
    status: opts.secrets ? (opts.secrets.clean ? 'pass' : 'fail') : 'not-tested',
    detail: opts.secrets?.clean ? 'No secrets in source code' : `${opts.secrets?.secretsFound ?? 0} secret(s) found`,
  });

  // SOC 2 - Vulnerability Management
  complianceNotes.push({
    framework: 'SOC 2',
    control: 'CC7.1-Vulnerability Management',
    status: opts.dependencies ? (opts.dependencies.byRisk.critical === 0 ? 'pass' : 'fail') : 'not-tested',
    detail: opts.dependencies ? `${opts.dependencies.findings.length} dependency issue(s)` : 'Dependency audit not run',
  });

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    grade: scoreToGrade(overallScore),
    scores,
    criticalFindings: critical,
    highFindings: high,
    mediumFindings: medium,
    lowFindings: low,
    totalFindings,
    secretsClean: opts.secrets?.clean ?? false,
    topRisks,
    recommendations,
    complianceNotes,
  };
}

/**
 * Generate a daily or weekly security digest by comparing current and previous posture.
 */
export function generateSecurityDigest(
  current: SecurityPosture,
  previous: SecurityPosture | null,
  period: 'daily' | 'weekly',
): SecurityDigest {
  const newFindings = previous ? Math.max(0, current.totalFindings - previous.totalFindings) : current.totalFindings;
  const resolvedFindings = previous ? Math.max(0, previous.totalFindings - current.totalFindings) : 0;

  let trend: 'improving' | 'stable' | 'degrading';
  if (!previous) {
    trend = 'stable';
  } else if (current.overallScore > previous.overallScore + 2) {
    trend = 'improving';
  } else if (current.overallScore < previous.overallScore - 2) {
    trend = 'degrading';
  } else {
    trend = 'stable';
  }

  const summary = [
    `Security posture: ${current.grade} (${current.overallScore}/100).`,
    current.criticalFindings > 0 ? `${current.criticalFindings} critical finding(s) require immediate action.` : 'No critical findings.',
    previous ? `Trend: ${trend}. ${newFindings} new, ${resolvedFindings} resolved since last ${period} report.` : 'Baseline report — no previous data for comparison.',
    ...current.topRisks.slice(0, 3),
  ].join(' ');

  return {
    generatedAt: new Date().toISOString(),
    period,
    posture: current,
    newFindings,
    resolvedFindings,
    trend,
    summary,
  };
}

/**
 * Render the security posture as a Markdown report.
 */
export function postureToMarkdown(posture: SecurityPosture): string {
  const escapeMarkdownTableCell = (value: string): string =>
    value
      .replace(/\r?\n/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();

  const lines: string[] = [
    '# Security Posture Report',
    '',
    `**Generated**: ${posture.generatedAt}`,
    `**Grade**: ${posture.grade} (${posture.overallScore}/100)`,
    '',
    '## Scores',
    '',
    `| Domain | Score |`,
    `|--------|-------|`,
    `| SAST | ${posture.scores.sast ?? 'N/A'} |`,
    `| Dependencies | ${posture.scores.dependencies ?? 'N/A'} |`,
    `| Secrets | ${posture.scores.secrets ?? 'N/A'} |`,
    `| Infrastructure | ${posture.scores.infrastructure ?? 'N/A'} |`,
    `| Pentest | ${posture.scores.pentest ?? 'N/A'} |`,
    '',
    '## Findings Summary',
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| Critical | ${posture.criticalFindings} |`,
    `| High | ${posture.highFindings} |`,
    `| Medium | ${posture.mediumFindings} |`,
    `| Low | ${posture.lowFindings} |`,
    `| **Total** | **${posture.totalFindings}** |`,
    '',
  ];

  if (posture.topRisks.length > 0) {
    lines.push('## Top Risks', '');
    for (const risk of posture.topRisks) {
      lines.push(`- ${risk}`);
    }
    lines.push('');
  }

  if (posture.recommendations.length > 0) {
    lines.push('## Recommendations', '');
    for (const rec of posture.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  if (posture.complianceNotes.length > 0) {
    lines.push('## Compliance', '');
    lines.push('| Framework | Control | Status | Detail |');
    lines.push('|-----------|---------|--------|--------|');
    for (const note of posture.complianceNotes) {
      const icon = note.status === 'pass' ? 'PASS' : note.status === 'fail' ? 'FAIL' : note.status === 'partial' ? 'PARTIAL' : 'N/T';
      lines.push(
        `| ${escapeMarkdownTableCell(note.framework)} | ${escapeMarkdownTableCell(note.control)} | ${icon} | ${escapeMarkdownTableCell(note.detail)} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
