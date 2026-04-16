/// <reference types="jest" />
import { generateSecurityPosture, generateSecurityDigest, postureToMarkdown } from '../../report/index.js';
import type { SecurityPosture } from '../../report/index.js';

describe('Security Toolkit Report Generation', () => {
  describe('generateSecurityPosture', () => {
    it('should handle all null inputs', () => {
      const posture = generateSecurityPosture({});

      expect(posture.overallScore).toBe(0);
      expect(posture.grade).toBe('F');
      expect(posture.criticalFindings).toBe(0);
      expect(posture.totalFindings).toBe(0);
      expect(posture.scores.sast).toBeNull();
      expect(posture.scores.dependencies).toBeNull();
      expect(posture.scores.secrets).toBeNull();
      expect(posture.scores.infrastructure).toBeNull();
      expect(posture.scores.pentest).toBeNull();
      expect(posture.topRisks).toEqual([]);
      expect(posture.recommendations).toEqual([]);
      expect(posture.complianceNotes).toHaveLength(4);
      expect(posture.complianceNotes.find((c: any) => c.control === 'A03:2021-Injection')?.status).toBe('not-tested');
    });

    it('should aggregate a perfect score', () => {
      const posture = generateSecurityPosture({
        sast: { securityScore: 100, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } as any, byCategory: {} as any } as any,
        dependencies: { securityScore: 100, byRisk: { critical: 0, high: 0, medium: 0, low: 0, none: 0 } as any, findings: [] } as any,
        secrets: { clean: true, secretsFound: 0, bySeverity: { critical: 0, high: 0, medium: 0 } as any } as any,
        infrastructure: { securityScore: 100, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } as any } as any,
        pentest: { overallScore: 100, vulnerabilities: [] } as any,
      });

      expect(posture.overallScore).toBe(100);
      expect(posture.grade).toBe('A');
      expect(posture.totalFindings).toBe(0);
      expect(posture.recommendations).toContain('Security posture is strong. Continue regular scanning.');
      expect(posture.complianceNotes.every((c: any) => c.status === 'pass')).toBe(true);
    });

    it('should accurately aggregate and count critical findings across all domains', () => {
      const posture = generateSecurityPosture({
        sast: { securityScore: 20, bySeverity: { critical: 2, high: 0, medium: 0, low: 0 } as any, byCategory: { 'sql-injection': 2 } } as any,
        dependencies: { securityScore: 30, byRisk: { critical: 1, high: 0, medium: 0, low: 0, none: 0 } as any, findings: [{}] } as any,
        secrets: { clean: false, secretsFound: 1, bySeverity: { critical: 1, high: 0, medium: 0 } as any } as any,
        infrastructure: { securityScore: 40, bySeverity: { critical: 1, high: 0, medium: 0, low: 0 } as any } as any,
        pentest: { overallScore: 50, vulnerabilities: [ { severity: 'critical' } ] } as any,
      });

      expect(posture.criticalFindings).toBe(6);
      expect(posture.overallScore).toBe(23);
      expect(posture.grade).toBe('F');

      expect(posture.topRisks).toContain('1 secret(s) found in source code — immediate rotation required');
      expect(posture.topRisks).toContain('6 critical finding(s) require immediate attention');
      expect(posture.topRisks).toContain('Critical dependency CVEs detected');
      expect(posture.topRisks).toContain('Critical infrastructure misconfigurations detected');

      expect(posture.recommendations).toContain('Rotate all detected secrets immediately. Remove them from source and use a secrets manager.');
      expect(posture.recommendations).toContain('Address all critical findings before next deployment.');
      expect(posture.recommendations).toContain('Fix critical SAST findings: SQL injection, command injection, or hardcoded secrets.');
      expect(posture.recommendations).toContain('Upgrade dependencies with critical CVEs.');

      const injectionNote = posture.complianceNotes.find((c: any) => c.control === 'A03:2021-Injection');
      expect(injectionNote?.status).toBe('fail');

      const secretsNote = posture.complianceNotes.find((c: any) => c.control === 'CC6.1-Secret Management');
      expect(secretsNote?.status).toBe('fail');
    });

    it('should aggregate only provided domains (weighted average)', () => {
      const posture = generateSecurityPosture({
        sast: { securityScore: 80, bySeverity: { critical: 0, high: 2, medium: 0, low: 0 } as any, byCategory: {} } as any,
        secrets: { clean: true, secretsFound: 0, bySeverity: { critical: 0, high: 0, medium: 0 } as any } as any,
      });
      expect(posture.overallScore).toBe(89);
      expect(posture.grade).toBe('B');
    });
  });

  describe('generateSecurityDigest', () => {
    const makePosture = (score: number, totalFindings: number): SecurityPosture => ({
      generatedAt: new Date().toISOString(),
      overallScore: score,
      grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F',
      scores: { sast: null, dependencies: null, secrets: null, infrastructure: null, pentest: null },
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
      totalFindings,
      secretsClean: true,
      topRisks: [],
      recommendations: [],
      complianceNotes: [],
    });

    it('should generate a baseline digest if previous posture is null', () => {
      const current = makePosture(80, 5);
      const digest = generateSecurityDigest(current, null, 'daily');

      expect(digest.period).toBe('daily');
      expect(digest.trend).toBe('stable');
      expect(digest.newFindings).toBe(5);
      expect(digest.resolvedFindings).toBe(0);
      expect(digest.summary).toContain('Baseline report — no previous data for comparison.');
    });

    it('should identify an improving trend', () => {
      const current = makePosture(85, 2);
      const previous = makePosture(80, 5);
      const digest = generateSecurityDigest(current, previous, 'weekly');

      expect(digest.trend).toBe('improving');
      expect(digest.newFindings).toBe(0);
      expect(digest.resolvedFindings).toBe(3);
      expect(digest.summary).toContain('Trend: improving. 0 new, 3 resolved since last weekly report.');
    });

    it('should identify a degrading trend', () => {
      const current = makePosture(70, 10);
      const previous = makePosture(80, 5);
      const digest = generateSecurityDigest(current, previous, 'daily');

      expect(digest.trend).toBe('degrading');
      expect(digest.newFindings).toBe(5);
      expect(digest.resolvedFindings).toBe(0);
      expect(digest.summary).toContain('Trend: degrading. 5 new, 0 resolved since last daily report.');
    });

    it('should identify a stable trend (score change <= 2)', () => {
      const current = makePosture(81, 4);
      const previous = makePosture(80, 5);
      const digest = generateSecurityDigest(current, previous, 'daily');

      expect(digest.trend).toBe('stable');
      expect(digest.newFindings).toBe(0);
      expect(digest.resolvedFindings).toBe(1);
      expect(digest.summary).toContain('Trend: stable. 0 new, 1 resolved since last daily report.');
    });
  });

  describe('postureToMarkdown', () => {
    it('should generate a markdown report from a posture object', () => {
      const posture = generateSecurityPosture({
        sast: { securityScore: 90, bySeverity: { critical: 0, high: 1, medium: 0, low: 0 } as any, byCategory: {} } as any,
      });

      const md = postureToMarkdown(posture);

      expect(md).toContain('# Security Posture Report');
      expect(md).toContain('**Grade**:');
      expect(md).toContain('## Scores');
      expect(md).toContain('| SAST | 90 |');
      expect(md).toContain('| Dependencies | N/A |');
      expect(md).toContain('## Findings Summary');
      expect(md).toContain('| Critical | 0 |');
      expect(md).toContain('| High | 1 |');
      expect(md).toContain('## Compliance');
      expect(md).toContain('| OWASP | A03:2021-Injection | PASS |');
    });

    it('should include recommendations and top risks when present', () => {
      const posture = generateSecurityPosture({
        sast: { securityScore: 20, bySeverity: { critical: 2, high: 0, medium: 0, low: 0 } as any, byCategory: { 'sql-injection': 2 } } as any,
      });
      const md = postureToMarkdown(posture);
      expect(md).toContain('## Top Risks');
      expect(md).toContain('- 2 critical finding(s) require immediate attention');
      expect(md).toContain('## Recommendations');
      expect(md).toContain('- Address all critical findings before next deployment.');
      expect(md).toContain('| FAIL | 2 injection finding(s) |');
    });
  });
});
