import {
  auditDockerCompose,
  auditTlsCerts,
  auditEnvFile,
  generateInfraReport,
  DockerComposeService,
  TlsCertInfo,
  InfraFinding
} from '../../infra-scanner/index.js';

describe('infra-scanner', () => {
  describe('auditDockerCompose', () => {
    const baseSecureService: DockerComposeService = {
      name: 'secure-service',
      image: 'nginx:alpine',
      read_only: true,
      user: '1000:1000',
      healthcheck: { test: ['CMD', 'curl', '-f', 'http://localhost'] }
    };

    it('should return no findings for a secure service', () => {
      const findings = auditDockerCompose([baseSecureService]);
      expect(findings).toHaveLength(0);
    });

    it('should detect privileged mode', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, privileged: true }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toBe('Container running in privileged mode');
    });

    it('should detect dangerous capabilities', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, cap_add: ['SYS_ADMIN'] }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('Dangerous capability added: SYS_ADMIN');
    });

    it('should detect host network mode', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, network_mode: 'host' }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('Container using host network mode');
    });

    it('should detect sensitive host volume mounts (docker.sock)', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, volumes: ['/var/run/docker.sock:/var/run/docker.sock'] }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toBe('Sensitive host path mounted: /var/run/docker.sock');
    });

    it('should detect sensitive host volume mounts (/etc)', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, volumes: ['/etc/config:/etc/config'] }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('Sensitive host path mounted: /etc/config');
    });

    it('should detect wide port exposure', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, ports: ['80:80'] }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].title).toBe('Port 80 exposed on all interfaces');
    });

    it('should ignore local port exposure', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, ports: ['127.0.0.1:80:80'] }]);
      expect(findings).toHaveLength(0);
    });

    it('should detect hardcoded secrets in environment variables', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, environment: { DB_PASSWORD: 'supersecret' } }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('Hardcoded secret in compose environment: DB_PASSWORD');
    });

    it('should ignore referenced secrets in environment variables', () => {
      const findings = auditDockerCompose([{ ...baseSecureService, environment: { DB_PASSWORD: '${DB_PASSWORD}' } }]);
      expect(findings).toHaveLength(0);
    });

    it('should detect missing healthcheck', () => {
      const findings = auditDockerCompose([{ name: 'no-healthcheck', read_only: true, user: '1000' }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('low');
      expect(findings[0].title).toBe('No healthcheck defined');
    });

    it('should detect writable filesystem', () => {
      const findings = auditDockerCompose([{ name: 'writable', user: '1000', healthcheck: {} }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('informational');
      expect(findings[0].title).toBe('Container filesystem is writable');
    });

    it('should detect running as root (no user)', () => {
      const findings = auditDockerCompose([{ name: 'root-user', read_only: true, healthcheck: {} }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].title).toBe('Container may run as root');
    });
  });

  describe('auditTlsCerts', () => {
    const baseSecureCert: TlsCertInfo = {
      domain: 'secure.com',
      issuer: 'Let\'s Encrypt',
      validFrom: '2023-01-01',
      validTo: '2024-01-01',
      daysUntilExpiry: 90,
      protocol: 'TLSv1.3',
      keySize: 2048
    };

    it('should return no findings for a secure certificate', () => {
      const findings = auditTlsCerts([baseSecureCert]);
      expect(findings).toHaveLength(0);
    });

    it('should detect expired certificates', () => {
      const findings = auditTlsCerts([{ ...baseSecureCert, daysUntilExpiry: -5 }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toBe('TLS certificate expired for secure.com');
    });

    it('should detect certificates expiring soon (<= 14 days)', () => {
      const findings = auditTlsCerts([{ ...baseSecureCert, daysUntilExpiry: 10 }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('TLS certificate expiring soon for secure.com');
    });

    it('should detect certificates nearing expiry (<= 30 days)', () => {
      const findings = auditTlsCerts([{ ...baseSecureCert, daysUntilExpiry: 25 }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].title).toBe('TLS certificate nearing expiry for secure.com');
    });

    it('should detect weak key sizes (< 2048)', () => {
      const findings = auditTlsCerts([{ ...baseSecureCert, keySize: 1024 }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('Weak TLS key size for secure.com');
    });

    it('should detect deprecated TLS protocols', () => {
      const findings = auditTlsCerts([{ ...baseSecureCert, protocol: 'TLSv1.1' }]);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toBe('Deprecated TLS protocol for secure.com');
    });
  });

  describe('auditEnvFile', () => {
    const validEnv = `
# A valid env file
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
    `;

    it('should return no findings for a secure env file', () => {
      const findings = auditEnvFile(validEnv, '.env.production');
      expect(findings).toHaveLength(0);
    });

    it('should detect weak sensitive values', () => {
      const weakEnv = `PASSWORD=admin`;
      const findings = auditEnvFile(weakEnv, '.env');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].title).toBe('Weak/default value for sensitive variable: PASSWORD');
    });

    it('should detect empty sensitive values', () => {
      const emptyEnv = `SECRET=""`;
      const findings = auditEnvFile(emptyEnv, '.env');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('Empty value for sensitive variable: SECRET');
    });

    it('should detect debug mode enabled in non-dev env files', () => {
      const debugEnv = `DEBUG=true`;
      const findings = auditEnvFile(debugEnv, '.env.production');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].title).toBe('Debug/development mode enabled: DEBUG=true');
    });

    it('should ignore debug mode in dev env files', () => {
      const debugEnv = `DEBUG=true`;
      const findings = auditEnvFile(debugEnv, '.env.local');
      expect(findings).toHaveLength(0);
    });
  });

  describe('generateInfraReport', () => {
    it('should generate a perfect score report with no findings', () => {
      const report = generateInfraReport([]);
      expect(report.securityScore).toBe(100);
      expect(report.bySeverity.critical).toBe(0);
      expect(report.findings).toHaveLength(0);
    });

    it('should calculate the security score correctly based on penalties', () => {
      const findings: InfraFinding[] = [
        { id: '1', category: 'docker-compose', severity: 'critical', title: 't', description: 'd', location: 'l', remediation: 'r' },
        { id: '2', category: 'tls-cert', severity: 'high', title: 't', description: 'd', location: 'l', remediation: 'r' },
        { id: '3', category: 'env-config', severity: 'medium', title: 't', description: 'd', location: 'l', remediation: 'r' },
        { id: '4', category: 'docker-image', severity: 'low', title: 't', description: 'd', location: 'l', remediation: 'r' },
        { id: '5', category: 'network', severity: 'informational', title: 't', description: 'd', location: 'l', remediation: 'r' }
      ];

      const report = generateInfraReport(findings);
      // Penalties: critical(20) + high(10) + medium(5) + low(2) + informational(0) = 37
      // 100 - 37 = 63
      expect(report.securityScore).toBe(63);
      expect(report.bySeverity.critical).toBe(1);
      expect(report.bySeverity.high).toBe(1);
      expect(report.byCategory['docker-compose']).toBe(1);
      expect(report.byCategory['tls-cert']).toBe(1);
      expect(report.findings).toHaveLength(5);
    });

    it('should not let security score go below 0', () => {
      const findings: InfraFinding[] = Array(6).fill({
        id: '1', category: 'docker-compose', severity: 'critical', title: 't', description: 'd', location: 'l', remediation: 'r'
      });

      const report = generateInfraReport(findings);
      // 6 * 20 = 120 penalty, score should be max(0, 100 - 120) = 0
      expect(report.securityScore).toBe(0);
    });
  });
});
