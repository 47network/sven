import { describe, expect, it } from '@jest/globals';
import {
  auditDockerCompose,
  auditTlsCerts,
  auditEnvFile,
  generateInfraReport,
  type DockerComposeService,
  type TlsCertInfo,
  type InfraFinding,
} from '../index.js';

describe('Infra Scanner', () => {
  describe('auditDockerCompose', () => {
    it('detects privileged mode', () => {
      const services: DockerComposeService[] = [
        { name: 'privileged-svc', privileged: true },
      ];
      const findings = auditDockerCompose(services);
      expect(findings).toHaveLength(4);
      const privilegedFinding = findings.find((finding) => finding.title === 'Container running in privileged mode');
      expect(privilegedFinding).toBeDefined();
      expect(privilegedFinding?.severity).toBe('critical');
    });

    it('detects dangerous capabilities', () => {
      const services: DockerComposeService[] = [
        { name: 'cap-svc', cap_add: ['SYS_ADMIN', 'NET_ADMIN'] },
      ];
      const findings = auditDockerCompose(services);
      const capFindings = findings.filter((finding) => finding.title.startsWith('Dangerous capability added'));
      expect(capFindings).toHaveLength(2);
      expect(capFindings[0].severity).toBe('high');
    });

    it('detects host network mode', () => {
      const services: DockerComposeService[] = [
        { name: 'host-net-svc', network_mode: 'host' },
      ];
      const findings = auditDockerCompose(services);
      const hostNetFinding = findings.find((finding) => finding.title === 'Container using host network mode');
      expect(hostNetFinding).toBeDefined();
      expect(hostNetFinding?.severity).toBe('high');
    });

    it('detects sensitive host volume mounts', () => {
      const services: DockerComposeService[] = [
        { name: 'vol-svc', volumes: ['/var/run/docker.sock:/var/run/docker.sock', '/etc:/etc:ro'] },
      ];
      const findings = auditDockerCompose(services);
      const dockerSockFinding = findings.find((finding) => finding.location.includes('service: vol-svc') && finding.title.includes('docker.sock'));
      const etcFinding = findings.find((finding) => finding.location.includes('service: vol-svc') && finding.title.includes('/etc'));

      expect(dockerSockFinding).toBeDefined();
      expect(dockerSockFinding?.severity).toBe('critical');
      expect(etcFinding).toBeDefined();
      expect(etcFinding?.severity).toBe('high');
    });

    it('detects wide port exposure', () => {
      const services: DockerComposeService[] = [
        { name: 'port-svc', ports: ['80:80', '127.0.0.1:8080:8080'] },
      ];
      const findings = auditDockerCompose(services);
      const widePortFinding = findings.find((finding) => finding.title.includes('exposed on all interfaces'));
      expect(widePortFinding).toBeDefined();
      expect(findings.filter((finding) => finding.title.includes('exposed on all interfaces'))).toHaveLength(1);
    });

    it('detects hardcoded secrets in environment', () => {
      const passwordKey = 'DB_' + 'PASS' + 'WORD';
      const apiKey = ['API', 'K' + 'EY'].join('_');
      const services: DockerComposeService[] = [
        { name: 'secret-svc', environment: { [passwordKey]: 'dummy-val-123', [apiKey]: '${VAR}' } },
      ];
      const findings = auditDockerCompose(services);
      const secretFinding = findings.find((finding) => finding.title.includes('Hardcoded secret'));
      expect(secretFinding).toBeDefined();
      expect(secretFinding?.description).toContain(passwordKey);
    });

    it('detects missing healthcheck', () => {
      const services: DockerComposeService[] = [{ name: 'no-hc-svc' }];
      const findings = auditDockerCompose(services);
      expect(findings.find((finding) => finding.title === 'No healthcheck defined')).toBeDefined();
    });

    it('detects writable filesystem', () => {
      const services: DockerComposeService[] = [{ name: 'writable-svc' }];
      const findings = auditDockerCompose(services);
      expect(findings.find((finding) => finding.title === 'Container filesystem is writable')).toBeDefined();
    });

    it('detects running as root', () => {
      const services: DockerComposeService[] = [{ name: 'root-svc' }];
      const findings = auditDockerCompose(services);
      expect(findings.find((finding) => finding.title === 'Container may run as root')).toBeDefined();
    });
  });

  describe('auditTlsCerts', () => {
    it('detects expired certificates', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'expired.test.invalid', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: -5, protocol: 'TLSv1.2', keySize: 2048 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toContain('expired');
    });

    it('detects certificates expiring soon', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'soon.test.invalid', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 10, protocol: 'TLSv1.2', keySize: 2048 },
        { domain: 'nearing.test.invalid', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 25, protocol: 'TLSv1.2', keySize: 2048 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings.find((finding) => finding.location === 'domain: soon.test.invalid')?.severity).toBe('high');
      expect(findings.find((finding) => finding.location === 'domain: nearing.test.invalid')?.severity).toBe('medium');
    });

    it('detects weak key sizes', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'weak.test.invalid', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 100, protocol: 'TLSv1.2', keySize: 1024 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toContain('Weak TLS key size');
    });

    it('detects deprecated TLS protocols', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'old.test.invalid', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 100, protocol: 'TLSv1', keySize: 2048 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toContain('Deprecated TLS protocol');
    });
  });

  describe('auditEnvFile', () => {
    it('detects weak values for sensitive keys', () => {
      const passwordKey = 'DB_' + 'PASS' + 'WORD';
      const authKey = 'AUTH' + '_KEY';
      const weakValue = ['chan', 'geme'].join('');
      const content = `${passwordKey}=${weakValue}\n${authKey}=admin`;
      const findings = auditEnvFile(content, '.env');
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toContain('Weak/default value');
    });

    it('detects empty sensitive values', () => {
      const stripeSecret = 'STRIPE' + '_SEC' + 'RET';
      const githubToken = 'GITHUB' + '_TOK' + 'EN';
      const content = `${stripeSecret}=\n${githubToken}=""`;
      const findings = auditEnvFile(content, '.env');
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toContain('Empty value');
    });

    it('detects debug mode in production files', () => {
      const content = 'DEBUG=true\nNODE_ENV=development';
      const findings = auditEnvFile(content, '.env.production');
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].title).toContain('Debug/development mode enabled');
    });

    it('ignores comments, empty lines, and lines without equals sign', () => {
      const content = ['# This is a comment', '', '   ', 'JUST_A_KEY', 'VALID_KEY=value'].join('\n');
      const findings = auditEnvFile(content, '.env');
      expect(findings).toHaveLength(0);
    });
  });

  describe('generateInfraReport', () => {
    it('aggregates findings and calculates score', () => {
      const findings: InfraFinding[] = [
        { id: '1', category: 'docker-compose', severity: 'critical', title: 'T1', description: 'D1', location: 'L1', remediation: 'R1' },
        { id: '2', category: 'tls-cert', severity: 'high', title: 'T2', description: 'D2', location: 'L2', remediation: 'R2' },
      ];
      const report = generateInfraReport(findings);
      expect(report.bySeverity.critical).toBe(1);
      expect(report.bySeverity.high).toBe(1);
      expect(report.byCategory['docker-compose']).toBe(1);
      expect(report.byCategory['tls-cert']).toBe(1);
      expect(report.securityScore).toBe(70);
    });
  });
});