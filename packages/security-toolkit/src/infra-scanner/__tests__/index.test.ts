import {
  auditDockerCompose,
  auditTlsCerts,
  auditEnvFile,
  generateInfraReport,
  DockerComposeService,
  TlsCertInfo,
} from '../index';

describe('Infrastructure Scanner', () => {
  describe('auditDockerCompose', () => {
    it('should identify containers running in privileged mode', () => {
      const services: DockerComposeService[] = [
        { name: 'app', image: 'nginx' },
        { name: 'db', image: 'postgres', privileged: true },
      ];
      const findings = auditDockerCompose(services);

      const privilegedFinding = findings.find(f => f.title === 'Container running in privileged mode');

      expect(privilegedFinding).toBeDefined();
      expect(privilegedFinding?.severity).toBe('critical');
      expect(privilegedFinding?.location).toBe('service: db');
    });

    it('should identify dangerous capabilities added', () => {
      const services: DockerComposeService[] = [
        { name: 'app', cap_add: ['SYS_ADMIN', 'CHOWN'] },
      ];
      const findings = auditDockerCompose(services);

      const dangerousCapFinding = findings.find(f => f.title.includes('Dangerous capability added'));
      expect(dangerousCapFinding).toBeDefined();
      expect(dangerousCapFinding?.severity).toBe('high');
      expect(dangerousCapFinding?.description).toContain('SYS_ADMIN');
    });

    it('should identify host network mode usage', () => {
      const services: DockerComposeService[] = [
        { name: 'app', network_mode: 'host' },
      ];
      const findings = auditDockerCompose(services);

      const hostNetworkFinding = findings.find(f => f.title === 'Container using host network mode');
      expect(hostNetworkFinding).toBeDefined();
      expect(hostNetworkFinding?.severity).toBe('high');
    });

    it('should identify sensitive host volume mounts', () => {
      const services: DockerComposeService[] = [
        { name: 'app1', volumes: ['/var/run/docker.sock:/var/run/docker.sock'] },
        { name: 'app2', volumes: ['/etc:/host/etc:ro'] },
      ];
      const findings = auditDockerCompose(services);

      const dockerSockFinding = findings.find(f => f.description.includes('/var/run/docker.sock'));
      expect(dockerSockFinding).toBeDefined();
      expect(dockerSockFinding?.severity).toBe('critical');

      const etcFinding = findings.find(f => f.description.includes('mounts /etc from the host'));
      expect(etcFinding).toBeDefined();
      expect(etcFinding?.severity).toBe('high');
    });

    it('should identify wide port exposure (0.0.0.0)', () => {
      const services: DockerComposeService[] = [
        { name: 'app', ports: ['8080:80'] },
        { name: 'db', ports: ['127.0.0.1:5432:5432'] },
      ];
      const findings = auditDockerCompose(services);

      const portFinding = findings.find(f => f.title.includes('Port 8080 exposed on all interfaces'));
      expect(portFinding).toBeDefined();
      expect(portFinding?.severity).toBe('medium');
      expect(portFinding?.location).toBe('service: app');

      const safePortFinding = findings.find(f => f.title.includes('Port 127.0.0.1'));
      expect(safePortFinding).toBeUndefined();
    });

    it('should identify hardcoded secrets in compose environment', () => {
      const services: DockerComposeService[] = [
        { name: 'app', environment: { DB_PASSWORD: 'supersecret', NORMAL_VAR: 'value' } },
        { name: 'app2', environment: { DB_PASSWORD: '${DB_PASSWORD}' } }, // Safe, using env var
      ];
      const findings = auditDockerCompose(services);

      const secretFinding = findings.find(f => f.title.includes('Hardcoded secret in compose environment: DB_PASSWORD'));
      expect(secretFinding).toBeDefined();
      expect(secretFinding?.severity).toBe('high');
      expect(secretFinding?.location).toBe('service: app');
    });

    it('should identify missing healthchecks', () => {
      const services: DockerComposeService[] = [
        { name: 'app' },
      ];
      const findings = auditDockerCompose(services);

      const healthcheckFinding = findings.find(f => f.title === 'No healthcheck defined');
      expect(healthcheckFinding).toBeDefined();
      expect(healthcheckFinding?.severity).toBe('low');
    });

    it('should identify missing read_only filesystem', () => {
      const services: DockerComposeService[] = [
        { name: 'app' },
      ];
      const findings = auditDockerCompose(services);

      const readOnlyFinding = findings.find(f => f.title === 'Container filesystem is writable');
      expect(readOnlyFinding).toBeDefined();
      expect(readOnlyFinding?.severity).toBe('informational');
    });

    it('should identify missing user specification (running as root)', () => {
      const services: DockerComposeService[] = [
        { name: 'app' },
      ];
      const findings = auditDockerCompose(services);

      const rootUserFinding = findings.find(f => f.title === 'Container may run as root');
      expect(rootUserFinding).toBeDefined();
      expect(rootUserFinding?.severity).toBe('medium');
    });

    it('should return no findings for a perfectly secure service', () => {
      const services: DockerComposeService[] = [
        {
          name: 'secure-app',
          image: 'alpine:latest',
          privileged: false,
          network_mode: 'bridge',
          ports: ['127.0.0.1:8080:8080'],
          volumes: ['app-data:/app/data'],
          environment: { DB_HOST: 'db' },
          healthcheck: { test: ['CMD', 'curl', '-f', 'http://localhost/health'] },
          read_only: true,
          user: '1000:1000'
        },
      ];
      const findings = auditDockerCompose(services);

      expect(findings).toHaveLength(0);
    });
  });

  describe('auditTlsCerts', () => {
    it('should identify expired TLS certificates', () => {
      const certs: TlsCertInfo[] = [
        {
          domain: 'example.com',
          issuer: 'Let\'s Encrypt',
          validFrom: '2023-01-01',
          validTo: '2023-04-01',
          daysUntilExpiry: -10,
          protocol: 'TLSv1.2',
          keySize: 2048
        }
      ];
      const findings = auditTlsCerts(certs);

      const expiredFinding = findings.find(f => f.title.includes('TLS certificate expired'));
      expect(expiredFinding).toBeDefined();
      expect(expiredFinding?.severity).toBe('critical');
    });

    it('should identify TLS certificates expiring soon (<= 14 days)', () => {
      const certs: TlsCertInfo[] = [
        {
          domain: 'example.com',
          issuer: 'Let\'s Encrypt',
          validFrom: '2023-01-01',
          validTo: '2023-04-01',
          daysUntilExpiry: 7,
          protocol: 'TLSv1.2',
          keySize: 2048
        }
      ];
      const findings = auditTlsCerts(certs);

      const soonFinding = findings.find(f => f.title.includes('TLS certificate expiring soon'));
      expect(soonFinding).toBeDefined();
      expect(soonFinding?.severity).toBe('high');
    });

    it('should identify TLS certificates nearing expiry (<= 30 days)', () => {
      const certs: TlsCertInfo[] = [
        {
          domain: 'example.com',
          issuer: 'Let\'s Encrypt',
          validFrom: '2023-01-01',
          validTo: '2023-04-01',
          daysUntilExpiry: 25,
          protocol: 'TLSv1.2',
          keySize: 2048
        }
      ];
      const findings = auditTlsCerts(certs);

      const nearFinding = findings.find(f => f.title.includes('TLS certificate nearing expiry'));
      expect(nearFinding).toBeDefined();
      expect(nearFinding?.severity).toBe('medium');
    });

    it('should identify weak TLS key size', () => {
      const certs: TlsCertInfo[] = [
        {
          domain: 'example.com',
          issuer: 'Let\'s Encrypt',
          validFrom: '2023-01-01',
          validTo: '2023-04-01',
          daysUntilExpiry: 90,
          protocol: 'TLSv1.2',
          keySize: 1024
        }
      ];
      const findings = auditTlsCerts(certs);

      const keySizeFinding = findings.find(f => f.title.includes('Weak TLS key size'));
      expect(keySizeFinding).toBeDefined();
      expect(keySizeFinding?.severity).toBe('high');
    });

    it('should identify deprecated TLS protocols', () => {
      const certs: TlsCertInfo[] = [
        {
          domain: 'example.com',
          issuer: 'Let\'s Encrypt',
          validFrom: '2023-01-01',
          validTo: '2023-04-01',
          daysUntilExpiry: 90,
          protocol: 'TLSv1.1',
          keySize: 2048
        }
      ];
      const findings = auditTlsCerts(certs);

      const protocolFinding = findings.find(f => f.title.includes('Deprecated TLS protocol'));
      expect(protocolFinding).toBeDefined();
      expect(protocolFinding?.severity).toBe('critical');
    });

    it('should return no findings for a secure certificate', () => {
      const certs: TlsCertInfo[] = [
        {
          domain: 'example.com',
          issuer: 'Let\'s Encrypt',
          validFrom: '2023-01-01',
          validTo: '2024-01-01',
          daysUntilExpiry: 180,
          protocol: 'TLSv1.3',
          keySize: 4096
        }
      ];
      const findings = auditTlsCerts(certs);

      expect(findings).toHaveLength(0);
    });
  });

  describe('auditEnvFile', () => {
    it('should identify weak/default values for sensitive variables', () => {
      const content = `
        DB_PASSWORD=password
        SECRET_KEY=changeme
        API_TOKEN=test
      `;
      const findings = auditEnvFile(content, '.env');

      expect(findings).toHaveLength(3);
      findings.forEach(f => {
        expect(f.severity).toBe('critical');
        expect(f.title).toContain('Weak/default value for sensitive variable');
      });
    });

    it('should identify empty values for sensitive variables', () => {
      const content = `
        DB_PASSWORD=
        SECRET_KEY=""
        API_TOKEN=''
      `;
      const findings = auditEnvFile(content, '.env');

      expect(findings).toHaveLength(3);
      findings.forEach(f => {
        expect(f.severity).toBe('high');
        expect(f.title).toContain('Empty value for sensitive variable');
      });
    });

    it('should identify debug/development mode enabled in non-dev files', () => {
      const content = `
        DEBUG=true
        NODE_ENV=development
      `;
      const findings = auditEnvFile(content, '.env.production');

      expect(findings).toHaveLength(2);
      findings.forEach(f => {
        expect(f.severity).toBe('medium');
        expect(f.title).toContain('Debug/development mode enabled');
      });
    });

    it('should not flag debug mode in dev environment files', () => {
      const content = `
        DEBUG=true
        NODE_ENV=development
      `;
      const findings = auditEnvFile(content, '.env.dev');

      expect(findings).toHaveLength(0);
    });

    it('should ignore commented out lines and empty lines', () => {
      const content = `
        # DB_PASSWORD=password

        # SECRET_KEY=changeme
      `;
      const findings = auditEnvFile(content, '.env');

      expect(findings).toHaveLength(0);
    });

    it('should return no findings for a secure env file', () => {
      const content = `
        DB_PASSWORD=super_secure_random_string_123!
        SECRET_KEY=another_secure_string_456
        PORT=8080
      `;
      const findings = auditEnvFile(content, '.env');

      expect(findings).toHaveLength(0);
    });
  });

  describe('generateInfraReport', () => {
    it('should correctly group findings by severity and category', () => {
      const findings: import('../index').InfraFinding[] = [
        { id: '1', category: 'docker-compose', severity: 'critical', title: 'T1', description: 'D1', location: 'L1', remediation: 'R1' },
        { id: '2', category: 'docker-compose', severity: 'high', title: 'T2', description: 'D2', location: 'L2', remediation: 'R2' },
        { id: '3', category: 'env-config', severity: 'high', title: 'T3', description: 'D3', location: 'L3', remediation: 'R3' },
        { id: '4', category: 'tls-cert', severity: 'medium', title: 'T4', description: 'D4', location: 'L4', remediation: 'R4' },
      ];

      const report = generateInfraReport(findings);

      expect(report.bySeverity).toEqual({
        critical: 1,
        high: 2,
        medium: 1,
        low: 0,
        informational: 0,
      });

      expect(report.byCategory).toEqual({
        'docker-compose': 2,
        'env-config': 1,
        'tls-cert': 1,
      });

      expect(report.findings).toBe(findings);
      expect(report.auditedAt).toBeDefined();
    });

    it('should accurately calculate the security score with deductions', () => {
      // 1 critical (20), 1 high (10), 1 medium (5), 1 low (2) = 37 penalty
      // 100 - 37 = 63
      const findings: import('../index').InfraFinding[] = [
        { id: '1', category: 'docker-compose', severity: 'critical', title: '', description: '', location: '', remediation: '' },
        { id: '2', category: 'docker-compose', severity: 'high', title: '', description: '', location: '', remediation: '' },
        { id: '3', category: 'env-config', severity: 'medium', title: '', description: '', location: '', remediation: '' },
        { id: '4', category: 'tls-cert', severity: 'low', title: '', description: '', location: '', remediation: '' },
        { id: '5', category: 'tls-cert', severity: 'informational', title: '', description: '', location: '', remediation: '' },
      ];

      const report = generateInfraReport(findings);

      expect(report.securityScore).toBe(63);
    });

    it('should not allow security score to drop below 0', () => {
      // 6 criticals = 120 penalty
      const findings: import('../index').InfraFinding[] = Array(6).fill({
        id: '1', category: 'docker-compose', severity: 'critical', title: '', description: '', location: '', remediation: ''
      });

      const report = generateInfraReport(findings);

      expect(report.securityScore).toBe(0);
    });

    it('should return a score of 100 for no findings', () => {
      const report = generateInfraReport([]);

      expect(report.securityScore).toBe(100);
    });
  });
});
