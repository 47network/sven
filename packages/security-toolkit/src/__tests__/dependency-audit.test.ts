import {
  classifyLicense,
  checkTyposquat,
  matchVulnerabilities,
  auditDependencies,
  parseDependencies,
  PackageDep,
  KnownVulnerability
} from '../dependency-audit/index';

describe('Dependency Audit', () => {
  describe('classifyLicense', () => {
    it('should classify permissive licenses as none', () => {
      expect(classifyLicense('MIT').riskLevel).toBe('none');
      expect(classifyLicense('ISC').riskLevel).toBe('none');
      expect(classifyLicense('Apache-2.0').riskLevel).toBe('none');
    });

    it('should classify MPL-2.0 as low risk', () => {
      const result = classifyLicense('MPL-2.0');
      expect(result.riskLevel).toBe('low');
      expect(result.note).toContain('MPL-2.0: file-level copyleft');
    });

    it('should classify copyleft licenses as high risk', () => {
      const result = classifyLicense('GPL-3.0');
      expect(result.riskLevel).toBe('high');
      expect(result.note).toContain('GPL-3.0: strong copyleft');
    });

    it('should classify UNLICENSED as critical risk', () => {
      const result = classifyLicense('UNLICENSED');
      expect(result.riskLevel).toBe('critical');
      expect(result.note).toContain('No license declared');

      const emptyResult = classifyLicense('');
      expect(emptyResult.riskLevel).toBe('critical');
      expect(emptyResult.note).toContain('No license declared');
    });

    it('should classify unknown licenses as medium risk', () => {
      const result = classifyLicense('Custom-License');
      expect(result.riskLevel).toBe('medium');
      expect(result.note).toContain('Unknown license: Custom-License');
    });

    it('should normalize license string before classification', () => {
      expect(classifyLicense(' MIT ').riskLevel).toBe('none');
      expect(classifyLicense('Apache-2.0  ').riskLevel).toBe('none');
    });
  });

  describe('checkTyposquat', () => {
    it('should not flag popular packages', () => {
      expect(checkTyposquat('react').isSuspect).toBe(false);
      expect(checkTyposquat('express').isSuspect).toBe(false);
      expect(checkTyposquat('fastify').isSuspect).toBe(false);
    });

    it('should flag obvious typos of popular packages', () => {
      const result = checkTyposquat('reac');
      expect(result.isSuspect).toBe(true);
      expect(result.similarTo).toBe('react');

      const result2 = checkTyposquat('exprss');
      expect(result2.isSuspect).toBe(true);
      expect(result2.similarTo).toBe('express');

      const result3 = checkTyposquat('fastifyy');
      expect(result3.isSuspect).toBe(true);
      expect(result3.similarTo).toBe('fastify');
    });

    it('should strip scopes before checking', () => {
      const result = checkTyposquat('@my-scope/reac');
      expect(result.isSuspect).toBe(true);
      expect(result.similarTo).toBe('react');

      const result2 = checkTyposquat('@babel/core');
      expect(result2.isSuspect).toBe(true);
      expect(result2.similarTo).toBe('cors');

      const result3 = checkTyposquat('@types/node');
      expect(result3.isSuspect).toBe(false);
    });

    it('should not flag distantly related names', () => {
      expect(checkTyposquat('my-custom-router').isSuspect).toBe(false);
      expect(checkTyposquat('very-long-package-name').isSuspect).toBe(false);
    });
  });

  describe('matchVulnerabilities', () => {
    it('should map known vulnerabilities to corresponding dependencies', () => {
      const deps: PackageDep[] = [
        { name: 'vulnerable-pkg', version: '1.0.0', isDev: false },
        { name: 'safe-pkg', version: '2.0.0', isDev: false }
      ];

      const vulns: KnownVulnerability[] = [
        { id: 'VULN-1', package: 'vulnerable-pkg', affectedVersions: '<2.0.0', severity: 'high', title: 'Test Vuln', description: 'A test vulnerability' }
      ];

      const result = matchVulnerabilities(deps, vulns);

      expect(result.size).toBe(1);
      expect(result.has('vulnerable-pkg@1.0.0')).toBe(true);
      expect(result.get('vulnerable-pkg@1.0.0')![0].id).toBe('VULN-1');
      expect(result.has('safe-pkg@2.0.0')).toBe(false);
    });

    it('should handle dependencies with no vulnerabilities', () => {
      const deps: PackageDep[] = [
        { name: 'safe-pkg', version: '2.0.0', isDev: false }
      ];
      const vulns: KnownVulnerability[] = [];

      const result = matchVulnerabilities(deps, vulns);
      expect(result.size).toBe(0);
    });
  });

  describe('auditDependencies', () => {
    it('should generate a clean report for safe dependencies', () => {
      const deps: PackageDep[] = [
        { name: 'safe-pkg', version: '1.0.0', isDev: false, integrity: 'sha512-abc' }
      ];
      const licenses = new Map([['safe-pkg', 'MIT']]);

      const report = auditDependencies(deps, [], licenses);

      expect(report.totalPackages).toBe(1);
      expect(report.findings.length).toBe(0);
      expect(report.securityScore).toBe(100);
      expect(report.licenseIssues.length).toBe(0);
      expect(report.supplyChainFlags.length).toBe(0);
    });

    it('should report vulnerabilities and adjust security score', () => {
      const deps: PackageDep[] = [
        { name: 'vuln-pkg', version: '1.0.0', isDev: false, integrity: 'sha512-abc' }
      ];
      const vulns: KnownVulnerability[] = [
        { id: 'VULN-1', package: 'vuln-pkg', affectedVersions: '<2.0.0', severity: 'high', title: 'Test Vuln', description: 'A test vulnerability', patchedVersion: '2.0.0' }
      ];

      const report = auditDependencies(deps, vulns);

      expect(report.findings.length).toBe(1);
      expect(report.findings[0].riskLevel).toBe('high');
      expect(report.findings[0].remediation).toContain('Upgrade vuln-pkg to 2.0.0 to fix VULN-1');
      expect(report.securityScore).toBe(85);
    });

    it('should flag typosquatting suspect packages', () => {
      const deps: PackageDep[] = [
        { name: 'reac', version: '1.0.0', isDev: false, integrity: 'sha512-abc' }
      ];

      const report = auditDependencies(deps);

      expect(report.findings.length).toBe(1);
      expect(report.findings[0].riskLevel).toBe('medium');
      expect(report.supplyChainFlags.length).toBe(1);
      expect(report.supplyChainFlags[0].flagType).toBe('typosquat-suspect');
      expect(report.supplyChainFlags[0].description).toContain('react');
      expect(report.securityScore).toBe(92);
    });

    it('should flag packages missing integrity hash', () => {
      const deps: PackageDep[] = [
        { name: 'no-integrity-pkg', version: '1.0.0', isDev: false }
      ];

      const report = auditDependencies(deps);

      expect(report.supplyChainFlags.length).toBe(1);
      expect(report.supplyChainFlags[0].flagType).toBe('no-lockfile-integrity');
      expect(report.securityScore).toBe(100);
    });

    it('should report license issues', () => {
      const deps: PackageDep[] = [
        { name: 'gpl-pkg', version: '1.0.0', isDev: false, integrity: 'sha512-abc' }
      ];
      const licenses = new Map([['gpl-pkg', 'GPL-3.0']]);

      const report = auditDependencies(deps, [], licenses);

      expect(report.licenseIssues.length).toBe(1);
      expect(report.licenseIssues[0].riskLevel).toBe('high');
    });
  });

  describe('parseDependencies', () => {
    it('should parse dependency and devDependency maps', () => {
      const dependencies = {
        react: '^18.2.0',
        express: '^4.18.0',
      };
      const devDependencies = {
        typescript: '^5.0.0',
      };

      const deps = parseDependencies(dependencies, devDependencies);

      expect(deps.length).toBe(3);
      expect(deps.find(d => d.name === 'react')?.isDev).toBe(false);
      expect(deps.find(d => d.name === 'typescript')?.isDev).toBe(true);
    });
  });
});
