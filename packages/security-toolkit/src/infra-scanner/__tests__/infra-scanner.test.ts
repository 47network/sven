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
      expect(findings).toHaveLength(4); // privileged, missing healthcheck, writable, root
      const privilegedFinding = findings.find((f) => f.title === 'Container running in privileged mode');
      expect(privilegedFinding).toBeDefined();
      expect(privilegedFinding?.severity).toBe('critical');
    });

    it('detects dangerous capabilities', () => {
      const services: DockerComposeService[] = [
        { name: 'cap-svc', cap_add: ['SYS_ADMIN', 'NET_ADMIN'] },
      ];
      const findings = auditDockerCompose(services);
      const capFindings = findings.filter((f) => f.title.startsWith('Dangerous capability added'));
      expect(capFindings).toHaveLength(2);
      expect(capFindings[0].severity).toBe('high');
    });

    it('detects host network mode', () => {
      const services: DockerComposeService[] = [
        { name: 'host-net-svc', network_mode: 'host' },
      ];
      const findings = auditDockerCompose(services);
      const hostNetFinding = findings.find((f) => f.title === 'Container using host network mode');
      expect(hostNetFinding).toBeDefined();
      expect(hostNetFinding?.severity).toBe('high');
    });

    it('detects sensitive host volume mounts', () => {
      const services: DockerComposeService[] = [
        { name: 'vol-svc', volumes: ['/var/run/docker.sock:/var/run/docker.sock', '/etc:/etc:ro'] },
      ];
      const findings = auditDockerCompose(services);
      const dockerSockFinding = findings.find((f) => f.location.includes('service: vol-svc') && f.title.includes('docker.sock'));
      const etcFinding = findings.find((f) => f.location.includes('service: vol-svc') && f.title.includes('/etc'));

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
      const widePortFinding = findings.find((f) => f.title.includes('exposed on all interfaces'));
      expect(widePortFinding).toBeDefined();
      expect(findings.filter((f) => f.title.includes('exposed on all interfaces'))).toHaveLength(1);
    });

    it('detects hardcoded secrets in environment', () => {
      const services: DockerComposeService[] = [
        { name: 'secret-svc', environment: { DATABASE_PASSWORD: 'super-secret', API_KEY: '${API_KEY}' } },
      ];
      const findings = auditDockerCompose(services);
      const secretFinding = findings.find((f) => f.title.includes('Hardcoded secret'));
      expect(secretFinding).toBeDefined();
      expect(secretFinding?.description).toContain('DATABASE_PASSWORD');
    });

    it('detects missing healthcheck', () => {
      const services: DockerComposeService[] = [{ name: 'no-hc-svc' }];
      const findings = auditDockerCompose(services);
      expect(findings.find((f) => f.title === 'No healthcheck defined')).toBeDefined();
    });

    it('detects writable filesystem', () => {
      const services: DockerComposeService[] = [{ name: 'writable-svc' }];
      const findings = auditDockerCompose(services);
      expect(findings.find((f) => f.title === 'Container filesystem is writable')).toBeDefined();
    });

    it('detects running as root', () => {
      const services: DockerComposeService[] = [{ name: 'root-svc' }];
      const findings = auditDockerCompose(services);
      expect(findings.find((f) => f.title === 'Container may run as root')).toBeDefined();
    });
  });

  describe('auditTlsCerts', () => {
    it('detects expired certificates', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'expired.com', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: -5, protocol: 'TLSv1.2', keySize: 2048 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toContain('expired');
    });

    it('detects certificates expiring soon', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'soon.com', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 10, protocol: 'TLSv1.2', keySize: 2048 },
        { domain: 'nearing.com', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 25, protocol: 'TLSv1.2', keySize: 2048 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings.find((f) => f.location.includes('soon.com'))?.severity).toBe('high');
      expect(findings.find((f) => f.location.includes('nearing.com'))?.severity).toBe('medium');
    });

    it('detects weak key sizes', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'weak.com', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 100, protocol: 'TLSv1.2', keySize: 1024 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toContain('Weak TLS key size');
    });

    it('detects deprecated TLS protocols', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'old.com', issuer: 'Any', validFrom: '', validTo: '', daysUntilExpiry: 100, protocol: 'TLSv1', keySize: 2048 },
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toContain('Deprecated TLS protocol');
    });
  });

  describe('auditEnvFile', () => {
    it('detects weak values for sensitive keys', () => {
      const content = 'DATABASE_PASSWORD=password\nAPI_TOKEN=admin';
      const findings = auditEnvFile(content, '.env');
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toContain('Weak/default value');
    });

    it('detects empty sensitive values', () => {
      const content = 'STRIPE_SECRET=\nGITHUB_TOKEN=""';
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
      // Score: 100 - 20 (critical) - 10 (high) = 70
      expect(report.securityScore).toBe(70);
    });
  });
});
