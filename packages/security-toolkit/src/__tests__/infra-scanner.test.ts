import {
  auditDockerCompose,
  auditTlsCerts,
  auditEnvFile,
  generateInfraReport,
  DockerComposeService,
  TlsCertInfo,
  InfraFinding
} from '../infra-scanner/index.js';

describe('Infra Scanner', () => {
  describe('auditDockerCompose', () => {
    it('should detect privileged containers', () => {
      const services: DockerComposeService[] = [
        { name: 'app', privileged: true }
      ];
      const findings = auditDockerCompose(services);
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'critical',
            title: 'Container running in privileged mode'
          })
        ])
      );
    });

    it('should detect dangerous capabilities', () => {
      const services: DockerComposeService[] = [
        { name: 'app', cap_add: ['SYS_ADMIN', 'NET_ADMIN'] }
      ];
      const findings = auditDockerCompose(services);
      const capFindings = findings.filter(f => f.title.startsWith('Dangerous capability added'));
      expect(capFindings).toHaveLength(2);
      expect(capFindings[0].title).toContain('SYS_ADMIN');
      expect(capFindings[1].title).toContain('NET_ADMIN');
    });

    it('should detect host network mode', () => {
      const services: DockerComposeService[] = [
        { name: 'app', network_mode: 'host' }
      ];
      const findings = auditDockerCompose(services);
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'high',
            title: 'Container using host network mode'
          })
        ])
      );
    });

    it('should detect sensitive host volume mounts', () => {
      const services: DockerComposeService[] = [
        { name: 'app', volumes: ['/var/run/docker.sock:/var/run/docker.sock', '/etc:/etc'] }
      ];
      const findings = auditDockerCompose(services);
      const dockerSock = findings.find(f => f.title.includes('/var/run/docker.sock'));
      const etc = findings.find(f => f.title.includes('/etc'));

      expect(dockerSock?.severity).toBe('critical');
      expect(etc?.severity).toBe('high');
    });

    it('should detect wide port exposure', () => {
      const services: DockerComposeService[] = [
        { name: 'app', ports: ['8080:8080', '127.0.0.1:9090:9090'] }
      ];
      const findings = auditDockerCompose(services);
      const portFindings = findings.filter(f => f.title.includes('exposed on all interfaces'));

      expect(portFindings).toHaveLength(1);
      expect(portFindings[0].title).toContain('Port 8080');
    });

    it('should detect hardcoded secrets in environment', () => {
      const services: DockerComposeService[] = [
        { name: 'app', environment: { DB_PASSWORD: 'supersecret', NORMAL_ENV: 'value' } }
      ];
      const findings = auditDockerCompose(services);
      const secretFindings = findings.filter(f => f.title.includes('Hardcoded secret in compose environment'));

      expect(secretFindings).toHaveLength(1);
      expect(secretFindings[0].title).toContain('DB_PASSWORD');
    });

    it('should detect missing healthcheck', () => {
      const services: DockerComposeService[] = [
        { name: 'app' } // no healthcheck
      ];
      const findings = auditDockerCompose(services);
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'low',
            title: 'No healthcheck defined'
          })
        ])
      );
    });

    it('should not warn about missing healthcheck if present', () => {
      const services: DockerComposeService[] = [
        { name: 'app', healthcheck: { test: ['CMD', 'curl', '-f', 'http://localhost'] } }
      ];
      const findings = auditDockerCompose(services);
      expect(findings.some(f => f.title === 'No healthcheck defined')).toBe(false);
    });

    it('should detect writable filesystem', () => {
      const services: DockerComposeService[] = [
        { name: 'app' }
      ];
      const findings = auditDockerCompose(services);
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'informational',
            title: 'Container filesystem is writable'
          })
        ])
      );
    });

    it('should detect container running as root', () => {
      const services: DockerComposeService[] = [
        { name: 'app' }
      ];
      const findings = auditDockerCompose(services);
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'medium',
            title: 'Container may run as root'
          })
        ])
      );
    });
  });

  describe('auditTlsCerts', () => {
    it('should detect expired certificates', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'example.com', issuer: 'CA', validFrom: '', validTo: '', daysUntilExpiry: -5, protocol: 'TLSv1.2', keySize: 2048 }
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        title: 'TLS certificate expired for example.com'
      });
    });

    it('should detect expiring soon certificates', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'example.com', issuer: 'CA', validFrom: '', validTo: '', daysUntilExpiry: 10, protocol: 'TLSv1.2', keySize: 2048 }
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0]).toMatchObject({
        severity: 'high',
        title: 'TLS certificate expiring soon for example.com'
      });
    });

    it('should detect nearing expiry certificates', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'example.com', issuer: 'CA', validFrom: '', validTo: '', daysUntilExpiry: 25, protocol: 'TLSv1.2', keySize: 2048 }
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0]).toMatchObject({
        severity: 'medium',
        title: 'TLS certificate nearing expiry for example.com'
      });
    });

    it('should detect weak key sizes', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'example.com', issuer: 'CA', validFrom: '', validTo: '', daysUntilExpiry: 100, protocol: 'TLSv1.2', keySize: 1024 }
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0]).toMatchObject({
        severity: 'high',
        title: 'Weak TLS key size for example.com'
      });
    });

    it('should detect deprecated TLS protocols', () => {
      const certs: TlsCertInfo[] = [
        { domain: 'example.com', issuer: 'CA', validFrom: '', validTo: '', daysUntilExpiry: 100, protocol: 'TLSv1', keySize: 2048 }
      ];
      const findings = auditTlsCerts(certs);
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        title: 'Deprecated TLS protocol for example.com'
      });
    });
  });

  describe('auditEnvFile', () => {
    it('should detect weak/default values for sensitive variables', () => {
      const content = 'DB_PASSWORD=password\nAPI_KEY=test\nNORMAL_VAR=value';
      const findings = auditEnvFile(content, '.env');

      const weakFindings = findings.filter(f => f.title.includes('Weak/default value for sensitive variable'));
      expect(weakFindings).toHaveLength(2);
      expect(weakFindings[0].title).toContain('DB_PASSWORD');
      expect(weakFindings[1].title).toContain('API_KEY');
    });

    it('should detect empty values for sensitive variables', () => {
      const content = 'DB_PASSWORD=\nAPI_KEY=""\nSECRET_TOKEN=\'\'';
      const findings = auditEnvFile(content, '.env');

      const emptyFindings = findings.filter(f => f.title.includes('Empty value for sensitive variable'));
      expect(emptyFindings).toHaveLength(3);
    });

    it('should detect debug mode in non-development env files', () => {
      const content = 'NODE_ENV=development\nDEBUG=true';
      const findings = auditEnvFile(content, '.env.production');

      const debugFindings = findings.filter(f => f.title.includes('Debug/development mode enabled'));
      expect(debugFindings).toHaveLength(2);
    });

    it('should ignore debug mode in development env files', () => {
      const content = 'NODE_ENV=development\nDEBUG=true';
      const findings = auditEnvFile(content, '.env.dev');

      const debugFindings = findings.filter(f => f.title.includes('Debug/development mode enabled'));
      expect(debugFindings).toHaveLength(0);
    });

    it('should ignore commented lines and empty lines', () => {
      const content = '# DB_PASSWORD=password\n\n  \n';
      const findings = auditEnvFile(content, '.env');
      expect(findings).toHaveLength(0);
    });
  });

  describe('generateInfraReport', () => {
    it('should aggregate findings correctly', () => {
      const findings: InfraFinding[] = [
        { id: '1', category: 'docker-compose', severity: 'critical', title: '', description: '', location: '', remediation: '' },
        { id: '2', category: 'docker-compose', severity: 'high', title: '', description: '', location: '', remediation: '' },
        { id: '3', category: 'env-config', severity: 'medium', title: '', description: '', location: '', remediation: '' },
        { id: '4', category: 'tls-cert', severity: 'low', title: '', description: '', location: '', remediation: '' },
        { id: '5', category: 'network', severity: 'informational', title: '', description: '', location: '', remediation: '' }
      ];

      const report = generateInfraReport(findings);

      expect(report.findings).toBe(findings);
      expect(report.bySeverity).toEqual({
        critical: 1,
        high: 1,
        medium: 1,
        low: 1,
        informational: 1
      });
      expect(report.byCategory).toEqual({
        'docker-compose': 2,
        'env-config': 1,
        'tls-cert': 1,
        'network': 1
      });
      // penalty: critical (20) + high (10) + medium (5) + low (2) + info (0) = 37
      // score: 100 - 37 = 63
      expect(report.securityScore).toBe(63);
    });

    it('should cap security score at 0', () => {
      const findings: InfraFinding[] = Array(10).fill({
        id: '1', category: 'docker-compose', severity: 'critical', title: '', description: '', location: '', remediation: ''
      }); // penalty 200

      const report = generateInfraReport(findings);
      expect(report.securityScore).toBe(0);
    });
  });
});
