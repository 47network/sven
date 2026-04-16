import {
  shannonEntropy,
  redactSecret,
  shouldScanFile,
  scanFileForSecrets,
  scanForSecrets,
  SECRET_PATTERNS
} from '../secret-scanner/index.js';

describe('Secret Scanner', () => {
  describe('shannonEntropy', () => {
    it('returns 0 for empty string', () => {
      expect(shannonEntropy('')).toBe(0);
    });

    it('returns low entropy for repetitive strings', () => {
      const entropy = shannonEntropy('aaaaaaaa');
      expect(entropy).toBe(0);
    });

    it('returns high entropy for random strings', () => {
      const entropy = shannonEntropy('aB3dE6fH1jK9lM');
      expect(entropy).toBeGreaterThan(3.5);
    });
  });

  describe('redactSecret', () => {
    it('redacts entire string if length <= 8', () => {
      expect(redactSecret('12345678')).toBe('***');
      expect(redactSecret('abc')).toBe('***');
    });

    it('redacts middle characters for longer strings', () => {
      const redacted = redactSecret('AKIAIOSFODNN7EXAMPLE');
      // 20 chars -> Math.min(4, Math.floor(20 * 0.15)) = Math.min(4, 3) = 3
      // Expected: 3 chars + '***' + 3 chars
      expect(redacted).toBe('AKI***PLE');
    });

    it('caps exposed characters at 4 for very long strings', () => {
      const longSecret = 'a'.repeat(100);
      const redacted = redactSecret(longSecret);
      // 100 chars -> Math.floor(15) but max is 4
      expect(redacted).toBe('aaaa***aaaa');
    });
  });

  describe('shouldScanFile', () => {
    it('excludes files by extension', () => {
      expect(shouldScanFile('image.png')).toBe(false);
      expect(shouldScanFile('archive.zip')).toBe(false);
      expect(shouldScanFile('yarn.lock')).toBe(false);
    });

    it('excludes files by path', () => {
      expect(shouldScanFile('node_modules/library/index.js')).toBe(false);
      expect(shouldScanFile('dist/bundle.js')).toBe(false);
      expect(shouldScanFile('coverage/lcov-report/index.html')).toBe(false);
    });

    it('includes valid source files', () => {
      expect(shouldScanFile('src/index.ts')).toBe(true);
      expect(shouldScanFile('components/Button.tsx')).toBe(true);
      expect(shouldScanFile('config.json')).toBe(true);
      expect(shouldScanFile('.env.example')).toBe(true);
    });
  });

  describe('scanFileForSecrets', () => {
    it('finds AWS access keys', () => {
      const source = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
      const findings = scanFileForSecrets(source, 'config.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('aws-access-key');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].matchedText).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(findings[0].line).toBe(1);
    });

    it('ignores doc/example comments', () => {
      const source = '// example aws_secret_access_key: "AKIAIOSFODNN7EXAMPLE"';
      const findings = scanFileForSecrets(source, 'config.ts');

      expect(findings).toHaveLength(0);
    });

    it('ignores inline suppression', () => {
      const source = `
        const secret = "AKIAIOSFODNN7EXAMPLE"; // secret-scan-disable
        const secret2 = "AKIAIOSFODNN7EXAMPL2"; /* secret-scan-disable */
      `;
      const findings = scanFileForSecrets(source, 'config.ts');

      expect(findings).toHaveLength(0);
    });

    it('applies entropy gate for generic passwords', () => {
      // low entropy string (length > 8 but repetitive)
      const source = 'const password = "aaaaaaaaa";';
      const findings = scanFileForSecrets(source, 'config.ts');

      // Generic password minEntropy is 3.0, 'aaaaaaaaa' has entropy 0
      expect(findings).toHaveLength(0);

      // high entropy string
      const sourceHigh = 'const password = "P@ssw0rd!123456789";';
      const findingsHigh = scanFileForSecrets(sourceHigh, 'config.ts');
      expect(findingsHigh).toHaveLength(1);
      expect(findingsHigh[0].type).toBe('generic-password');
    });

    it('returns context', () => {
      const source = 'line1\nconst awsKey = "AKIAIOSFODNN7EXAMPLE";\nline3';
      const findings = scanFileForSecrets(source, 'config.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toBe(source);
    });
  });

  describe('scanForSecrets', () => {
    it('aggregates findings by type and severity', () => {
      const files = new Map<string, string>();
      files.set('config.ts', 'const awsKey = "AKIAIOSFODNN7EXAMPLE";');
      files.set('secrets.js', 'const password = "P@ssw0rd!123456789";');
      files.set('ignore.png', 'binary data containing AKIAIOSFODNN7EXAMPLE');

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(3); // Map size is 3, even if some excluded
      expect(report.secretsFound).toBe(2);
      expect(report.clean).toBe(false);

      expect(report.byType['aws-access-key']).toBe(1);
      expect(report.byType['generic-password']).toBe(1);

      expect(report.bySeverity.critical).toBe(1); // AWS key
      expect(report.bySeverity.medium).toBe(1); // password
      expect(report.bySeverity.high).toBe(0);
    });

    it('returns clean report when no secrets found', () => {
      const files = new Map<string, string>();
      files.set('index.ts', 'const a = 1;');

      const report = scanForSecrets(files);

      expect(report.secretsFound).toBe(0);
      expect(report.clean).toBe(true);
      expect(report.bySeverity.critical).toBe(0);
      expect(report.bySeverity.high).toBe(0);
      expect(report.bySeverity.medium).toBe(0);
    });
  });
});
