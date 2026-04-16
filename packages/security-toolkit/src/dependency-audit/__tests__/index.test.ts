import { describe, expect, it } from '@jest/globals';
import {
  classifyLicense,
  checkTyposquat,
  matchVulnerabilities,
  auditDependencies,
  parseDependencies,
  PackageDep,
  KnownVulnerability
} from '../index.js';

describe('Dependency Audit', () => {
  describe('classifyLicense', () => {
    it('returns none for permissive licenses', () => {
      expect(classifyLicense('MIT').riskLevel).toBe('none');
      expect(classifyLicense('Apache-2.0').riskLevel).toBe('none');
    });

    it('returns low for MPL-2.0', () => {
      expect(classifyLicense('MPL-2.0').riskLevel).toBe('low');
    });

    it('returns high for copyleft licenses', () => {
      expect(classifyLicense('GPL-3.0').riskLevel).toBe('high');
      expect(classifyLicense('AGPL-3.0-or-later').riskLevel).toBe('high');
    });

    it('returns critical for UNLICENSED', () => {
      expect(classifyLicense('UNLICENSED').riskLevel).toBe('critical');
      expect(classifyLicense('').riskLevel).toBe('critical');
    });

    it('returns medium for unknown licenses', () => {
      expect(classifyLicense('Custom-License').riskLevel).toBe('medium');
    });
  });

  describe('checkTyposquat', () => {
    it('returns isSuspect false for exact matches of popular packages', () => {
      expect(checkTyposquat('express').isSuspect).toBe(false);
      expect(checkTyposquat('react').isSuspect).toBe(false);
    });

    it('returns isSuspect true for distance 1 typo', () => {
      expect(checkTyposquat('exress').isSuspect).toBe(true);
      expect(checkTyposquat('reaact').isSuspect).toBe(true);
    });

    it('returns isSuspect true for distance 2 typo if length > 5', () => {
      expect(checkTyposquat('expres').isSuspect).toBe(true);
    });

    it('returns isSuspect false for distance 2 typo if length <= 5', () => {
      // 'reac' is distance 1 from 'react', so it returns true! Let's use distance 2: 'rea'
      expect(checkTyposquat('rea').isSuspect).toBe(false);
    });

    it('returns isSuspect false for completely different packages', () => {
      expect(checkTyposquat('my-custom-internal-package').isSuspect).toBe(false);
    });

    it('strips scope when checking', () => {
      expect(checkTyposquat('@myorg/express').isSuspect).toBe(false);
      expect(checkTyposquat('@myorg/exress').isSuspect).toBe(true);
    });
  });

  describe('matchVulnerabilities', () => {
    it('matches known vulnerabilities with dependencies', () => {
      const deps: PackageDep[] = [
        { name: 'lodash', version: '4.17.20', isDev: false },
        { name: 'react', version: '18.2.0', isDev: false }
      ];
      const vulns: KnownVulnerability[] = [
        {
          id: 'CVE-123',
          package: 'lodash',
          affectedVersions: '<4.17.21',
          severity: 'high',
          title: 'Prototype Pollution',
          description: '...'
        }
      ];

      const matchMap = matchVulnerabilities(deps, vulns);
      expect(matchMap.get('lodash@4.17.20')).toHaveLength(1);
      expect(matchMap.get('lodash@4.17.20')?.[0].id).toBe('CVE-123');
      expect(matchMap.has('react@18.2.0')).toBe(false);
    });
  });

  describe('parseDependencies', () => {
    it('parses empty dependencies correctly', () => {
      expect(parseDependencies()).toEqual([]);
    });

    it('parses dependencies and devDependencies correctly', () => {
      const dependencies = { react: '18.2.0' };
      const devDependencies = { jest: '29.0.0' };
      const parsed = parseDependencies(dependencies, devDependencies);

      expect(parsed).toHaveLength(2);
      expect(parsed).toContainEqual({ name: 'react', version: '18.2.0', isDev: false });
      expect(parsed).toContainEqual({ name: 'jest', version: '29.0.0', isDev: true });
    });
  });

  describe('auditDependencies', () => {
    it('returns an empty report when no issues are found', () => {
      const deps: PackageDep[] = [
        { name: 'react', version: '18.2.0', isDev: false, integrity: 'sha512-...' }
      ];
      const licenses = new Map([['react', 'MIT']]);
      const report = auditDependencies(deps, [], licenses);

      expect(report.totalPackages).toBe(1);
      expect(report.findings).toHaveLength(0);
      expect(report.licenseIssues).toHaveLength(0);
      expect(report.supplyChainFlags).toHaveLength(0);
      expect(report.securityScore).toBe(100);
    });

    it('flags vulnerabilities and affects security score', () => {
      const deps: PackageDep[] = [
        { name: 'lodash', version: '4.17.20', isDev: false, integrity: 'sha512-...' }
      ];
      const vulns: KnownVulnerability[] = [
        {
          id: 'CVE-123',
          package: 'lodash',
          affectedVersions: '<4.17.21',
          severity: 'high',
          title: 'Prototype Pollution',
          description: '...',
          patchedVersion: '4.17.21'
        }
      ];
      const licenses = new Map([['lodash', 'MIT']]);

      const report = auditDependencies(deps, vulns, licenses);
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].riskLevel).toBe('high');
      expect(report.findings[0].remediation).toContain('Upgrade lodash to 4.17.21');
      expect(report.byRisk.high).toBe(1);
      // penalty for high is 15
      expect(report.securityScore).toBe(85);
    });

    it('flags typosquat suspects', () => {
      const deps: PackageDep[] = [
        { name: 'exress', version: '1.0.0', isDev: false, integrity: 'sha512-...' }
      ];

      const report = auditDependencies(deps);
      expect(report.supplyChainFlags).toHaveLength(1);
      expect(report.supplyChainFlags[0].flagType).toBe('typosquat-suspect');
      expect(report.findings).toHaveLength(1);
      // Typosquat elevates none to medium risk
      expect(report.findings[0].riskLevel).toBe('medium');
    });

    it('flags missing lockfile integrity', () => {
      const deps: PackageDep[] = [
        { name: 'react', version: '18.2.0', isDev: false } // No integrity
      ];

      const report = auditDependencies(deps);
      expect(report.supplyChainFlags).toHaveLength(1);
      expect(report.supplyChainFlags[0].flagType).toBe('no-lockfile-integrity');
    });

    it('flags license issues', () => {
      const deps: PackageDep[] = [
        { name: 'some-lib', version: '1.0.0', isDev: false, integrity: 'sha512-...' }
      ];
      const licenses = new Map([['some-lib', 'GPL-3.0']]);

      const report = auditDependencies(deps, [], licenses);
      expect(report.licenseIssues).toHaveLength(1);
      expect(report.licenseIssues[0].riskLevel).toBe('high');
    });

    it('correctly calculates max severity when multiple vulns exist', () => {
      const deps: PackageDep[] = [
        { name: 'vuln-lib', version: '1.0.0', isDev: false, integrity: 'sha512-...' }
      ];
      const vulns: KnownVulnerability[] = [
        { id: 'CVE-1', package: 'vuln-lib', affectedVersions: '*', severity: 'medium', title: 'T1', description: 'D1' },
        { id: 'CVE-2', package: 'vuln-lib', affectedVersions: '*', severity: 'critical', title: 'T2', description: 'D2' },
        { id: 'CVE-3', package: 'vuln-lib', affectedVersions: '*', severity: 'low', title: 'T3', description: 'D3' }
      ];

      const report = auditDependencies(deps, vulns);
      expect(report.findings[0].riskLevel).toBe('critical');
    });
  });
});
