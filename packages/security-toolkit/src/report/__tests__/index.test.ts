import {
  generateSecurityPosture,
  generateSecurityDigest,
  postureToMarkdown,
} from '../index.js';
import type { SastReport } from '../../sast/index.js';
import type { DepAuditReport } from '../../dependency-audit/index.js';
import type { SecretScanReport } from '../../secret-scanner/index.js';
import type { InfraAuditReport } from '../../infra-scanner/index.js';
import type { PentestReport } from '../../pentest/index.js';

import { describe, it, expect } from '@jest/globals';

describe('Security Report Generator', () => {
  describe('generateSecurityPosture', () => {
    it('should generate an empty posture report if no scans are provided', () => {
      const posture = generateSecurityPosture({});

      expect(posture.overallScore).toBe(0);
      expect(posture.grade).toBe('F');
      expect(posture.totalFindings).toBe(0);
      expect(posture.topRisks.length).toBe(0);
      expect(posture.complianceNotes.length).toBe(4);
      expect(posture.secretsClean).toBe(false);
    });

    it('should calculate weighted average accurately', () => {
      const sastMock = {
        scanId: 'sast-1',
        timestamp: new Date().toISOString(),
        framework: 'mock',
        securityScore: 80,
        findings: [],
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {},
      } as unknown as SastReport;

      const secretsMock = {
        scanId: 'secrets-1',
        timestamp: new Date().toISOString(),
        secretsFound: 0,
        clean: true,
        findings: [],
        bySeverity: { critical: 0, high: 0, medium: 0 },
      } as unknown as SecretScanReport;

      const posture = generateSecurityPosture({
        sast: sastMock,
        secrets: secretsMock,
      });

      expect(posture.overallScore).toBe(89);
      expect(posture.grade).toBe('B');
    });

    it('should aggregate critical findings from SAST, dependencies, and infrastructure correctly', () => {
      const sastMock = {
        scanId: 'sast-1',
        timestamp: '',
        framework: 'mock',
        securityScore: 0,
        findings: [],
        bySeverity: { critical: 1, high: 2, medium: 0, low: 0 },
        byCategory: {},
      } as unknown as SastReport;

      const dependenciesMock = {
        auditId: 'dep-1',
        timestamp: '',
        securityScore: 0,
        findings: [],
        byRisk: { critical: 2, high: 0, medium: 1, low: 0 },
      } as unknown as DepAuditReport;

      const secretsMock = {
        scanId: 'secrets-1',
        timestamp: '',
        secretsFound: 2,
        clean: false,
        findings: [],
        bySeverity: { critical: 1, high: 1, medium: 1 },
      } as unknown as SecretScanReport;

      const infraMock = {
        auditId: 'infra-1',
        timestamp: '',
        securityScore: 0,
        findings: [],
        bySeverity: { critical: 1, high: 0, medium: 0, low: 2 },
      } as unknown as InfraAuditReport;

      const posture = generateSecurityPosture({
        sast: sastMock,
        dependencies: dependenciesMock,
        secrets: secretsMock,
        infrastructure: infraMock,
      });

      expect(posture.criticalFindings).toBe(5);
      expect(posture.highFindings).toBe(3);
      expect(posture.totalFindings).toBe(12);
      expect(posture.topRisks).toContain('5 critical finding(s) require immediate attention');
      expect(posture.topRisks).toContain('Critical dependency CVEs detected');
      expect(posture.topRisks).toContain('2 secret(s) found in source code — immediate rotation required');
      expect(posture.topRisks).toContain('Critical infrastructure misconfigurations detected');
    });

    it('should calculate pentest vulnerabilities severity', () => {
      const pentestMock = {
        reportId: 'pt-1',
        target: 'app',
        date: '',
        methodology: 'manual',
        overallScore: 0,
        vulnerabilities: [
          {
            id: 'v1', title: 'v1', severity: 'critical', cvssScore: 10, description: '', remediation: '', status: 'open'
          },
          {
            id: 'v2', title: 'v2', severity: 'high', cvssScore: 8, description: '', remediation: '', status: 'open'
          },
          {
            id: 'v3', title: 'v3', severity: 'medium', cvssScore: 5, description: '', remediation: '', status: 'open'
          },
          {
            id: 'v4', title: 'v4', severity: 'low', cvssScore: 2, description: '', remediation: '', status: 'open'
          }
        ],
      } as unknown as PentestReport;

      const posture = generateSecurityPosture({
        pentest: pentestMock,
      });

      expect(posture.criticalFindings).toBe(1);
      expect(posture.highFindings).toBe(1);
      expect(posture.totalFindings).toBe(4);
    });

    it('should generate accurate compliance notes', () => {
      const sastMock = {
        scanId: 'sast-1',
        timestamp: '',
        framework: 'mock',
        securityScore: 0,
        findings: [],
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {
          'sql-injection': 1,
          'auth-bypass': 0,
        },
      } as unknown as SastReport;

      const posture = generateSecurityPosture({
        sast: sastMock,
      });

      const injectionNote = posture.complianceNotes.find(c => c.control.includes('Injection'));
      expect(injectionNote?.status).toBe('fail');
      expect(injectionNote?.detail).toBe('1 injection finding(s)');

      const authNote = posture.complianceNotes.find(c => c.control.includes('Auth'));
      expect(authNote?.status).toBe('pass');
    });

    it('should recommend running secret scans when no secret report is provided', () => {
      const posture = generateSecurityPosture({});
      expect(posture.recommendations).toContain(
        'Run secret scanning to validate that no credentials or keys are committed.',
      );
    });

    it('should mark SOC2 secret management as not-tested when secret scan is missing', () => {
      const posture = generateSecurityPosture({});
      const secretNote = posture.complianceNotes.find((c) => c.control === 'CC6.1-Secret Management');

      expect(secretNote?.status).toBe('not-tested');
      expect(secretNote?.detail).toBe('Secret scan not run');
    });
  });

  describe('generateSecurityDigest', () => {
    const defaultPosture = generateSecurityPosture({});

    it('should evaluate baseline report correctly', () => {
      const digest = generateSecurityDigest(defaultPosture, null, 'daily');

      expect(digest.trend).toBe('stable');
      expect(digest.newFindings).toBe(0);
      expect(digest.resolvedFindings).toBe(0);
      expect(digest.summary).toContain('Baseline report — no previous data for comparison.');
    });

    it('should generate a degrading trend if score decreases', () => {
      const previousPosture = {
        ...defaultPosture,
        overallScore: 90,
        totalFindings: 0,
      };

      const currentPosture = {
        ...defaultPosture,
        overallScore: 85,
        totalFindings: 5,
        criticalFindings: 1,
      };

      const digest = generateSecurityDigest(currentPosture, previousPosture, 'weekly');

      expect(digest.trend).toBe('degrading');
      expect(digest.newFindings).toBe(5);
      expect(digest.resolvedFindings).toBe(0);
      expect(digest.summary).toContain('Trend: degrading.');
      expect(digest.summary).toContain('1 critical finding(s) require immediate action.');
    });

    it('should generate an improving trend if score increases', () => {
      const previousPosture = {
        ...defaultPosture,
        overallScore: 70,
        totalFindings: 10,
      };

      const currentPosture = {
        ...defaultPosture,
        overallScore: 80,
        totalFindings: 5,
      };

      const digest = generateSecurityDigest(currentPosture, previousPosture, 'weekly');

      expect(digest.trend).toBe('improving');
      expect(digest.newFindings).toBe(0);
      expect(digest.resolvedFindings).toBe(5);
    });

    it('should generate a stable trend if score remains within 2 points', () => {
      const previousPosture = {
        ...defaultPosture,
        overallScore: 70,
        totalFindings: 10,
      };

      const currentPosture = {
        ...defaultPosture,
        overallScore: 71,
        totalFindings: 10,
      };

      const digest = generateSecurityDigest(currentPosture, previousPosture, 'weekly');

      expect(digest.trend).toBe('stable');
      expect(digest.newFindings).toBe(0);
      expect(digest.resolvedFindings).toBe(0);
    });
  });

  describe('postureToMarkdown', () => {
    it('should format simple empty posture correctly', () => {
      const posture = generateSecurityPosture({});
      const markdown = postureToMarkdown(posture);

      expect(markdown).toContain('# Security Posture Report');
      expect(markdown).toContain('**Grade**: F (0/100)');
      expect(markdown).toContain('| SAST | N/A |');
      expect(markdown).toContain('| **Total** | **0** |');
    });

    it('should format compliance notes and recommendations correctly', () => {
      const sastMock = {
        scanId: 'sast-1',
        timestamp: '',
        framework: 'mock',
        securityScore: 80,
        findings: [],
        bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
        byCategory: {},
      } as unknown as SastReport;

      const posture = generateSecurityPosture({ sast: sastMock });
      const markdown = postureToMarkdown(posture);

      expect(markdown).toContain('## Top Risks');
      expect(markdown).toContain('- 1 critical finding(s) require immediate attention');

      expect(markdown).toContain('## Recommendations');
      expect(markdown).toContain('- Address all critical findings before next deployment.');

      expect(markdown).toContain('## Compliance');
      expect(markdown).toContain('| OWASP | A03:2021-Injection | PASS | No injection vulnerabilities detected |');
    });

    it('should escape compliance table cells to prevent markdown row injection', () => {
      const posture = {
        ...generateSecurityPosture({}),
        complianceNotes: [
          {
            framework: 'OWASP|A',
            control: 'A03\nInjection',
            status: 'fail',
            detail: 'value|with|pipes\nand newline\\path',
          },
        ],
      };

      const markdown = postureToMarkdown(posture);
      expect(markdown).toContain('| OWASP&#124;A | A03 Injection | FAIL | value&#124;with&#124;pipes and newline\\\\path |');
    });
  });
});
