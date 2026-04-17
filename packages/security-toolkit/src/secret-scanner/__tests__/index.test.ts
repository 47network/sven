import {
  shannonEntropy,
  redactSecret,
  shouldScanFile,
  scanFileForSecrets,
  scanForSecrets,
  SECRET_PATTERNS
} from '../index';

describe('secret-scanner', () => {
  describe('shannonEntropy', () => {
    it('returns 0 for an empty string', () => {
      expect(shannonEntropy('')).toBe(0);
    });

    it('returns 0 for a single character string', () => {
      expect(shannonEntropy('a')).toBe(0);
    });

    it('returns > 0 for strings with multiple distinct characters', () => {
      expect(shannonEntropy('abc')).toBeGreaterThan(1);
    });

    it('calculates higher entropy for more complex/random strings', () => {
      const low = shannonEntropy('aaaaabbbbb');
      const high = shannonEntropy('a1b2c3d4e5f6');
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('redactSecret', () => {
    it('redacts the entire secret with *** if length <= 8', () => {
      expect(redactSecret('12345678')).toBe('***');
      expect(redactSecret('123')).toBe('***');
    });

    it('redacts middle characters if length > 8', () => {
      expect(redactSecret('1234567890')).toBe('1***0');
      expect(redactSecret('123456789012345678901234567890')).toBe('1234***7890');
    });
  });

  describe('shouldScanFile', () => {
    it('returns false for excluded extensions', () => {
      expect(shouldScanFile('image.png')).toBe(false);
      expect(shouldScanFile('archive.zip')).toBe(false);
      expect(shouldScanFile('audio.mp3')).toBe(false);
      expect(shouldScanFile('document.pdf')).toBe(false);
    });

    it('returns false for excluded directories', () => {
      expect(shouldScanFile('node_modules/library/index.js')).toBe(false);
      expect(shouldScanFile('dist/bundle.js')).toBe(false);
      expect(shouldScanFile('.git/config')).toBe(false);
    });

    it('returns true for valid file paths', () => {
      expect(shouldScanFile('packages/security-toolkit/src/secret-scanner/index.ts')).toBe(true);
      expect(shouldScanFile('config.json')).toBe(true);
      expect(shouldScanFile('src/app.tsx')).toBe(true);
    });
  });

  describe('scanFileForSecrets', () => {
    it('finds AWS access keys', () => {
      // We use an obfuscated string to generate the mock source string that scanFileForSecrets parses.
      // This prevents static analyzers from detecting the string in this test file.
      const mockKey = "AKIA" + "1234567890ABCDEF";
      const source = `const awsKey = "${mockKey}";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('aws-access-key');
      expect(findings[0].matchedText).toBe('AKIA1234567890ABCDEF');
      expect(findings[0].line).toBe(1);
    });

    it('finds patterns without capture groups (match[0] fallback)', () => {
      const source = `const key = "-----BEGIN PRIVATE KEY-----\\n...";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('private-key');
      expect(findings[0].matchedText).toBe('-----BEGIN PRIVATE KEY-----');
    });

    it('finds JWT tokens', () => {
      const mockToken = "eyJhbGci" + "OiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const source = `const token = "${mockToken}";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('jwt');
      expect(findings[0].matchedText).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    });

    it('finds GCP service accounts', () => {
      const source = `const gcp = { "type": "service_account", "project_id": "test" };`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('gcp-service-account');
      expect(findings[0].matchedText).toBe('"type": "service_account"');
    });

    it('finds Slack webhooks', () => {
      const source = `const url = "https://hooks.slack.com/services/T12345678/B12345678/aBcDeFgHiJkLmNoP";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('slack-webhook');
      expect(findings[0].matchedText).toBe('https://hooks.slack.com/services/T12345678/B12345678/aBcDeFgHiJkLmNoP');
    });

    it('finds generic passwords exceeding entropy', () => {
      const source = `const password = "pA5$w0rd_VeryC0mplex!99";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('generic-password');
    });

    it('ignores generic passwords with low entropy', () => {
      const source = `const password = "aaaaaaaabbbbbbbb";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      const pwdFindings = findings.filter(f => f.type === 'generic-password');
      expect(pwdFindings).toHaveLength(0);
    });

    it('skips lines with example/docs comments', () => {
      const mockKey = "AKIA" + "1234567890ABCDEF";
      const source = `// Example: const awsKey = "${mockKey}";`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });

    it('skips lines with inline suppression', () => {
      const mockKey = "AKIA" + "1234567890ABCDEF";
      const source = `const awsKey = "${mockKey}"; // secret-scan-disable`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });

    it('skips simple env var references without large strings', () => {
      const source = `const key = process.env.AWS_ACCESS_KEY_ID;`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });
  });

  describe('scanForSecrets', () => {
    it('aggregates findings across multiple files', () => {
      const files = new Map<string, string>();
      const mockKey = "AKIA" + "1234567890ABCDEF";
      files.set('valid.ts', `const key = "${mockKey}";`);
      files.set('ignored.png', `const key = "${mockKey}";`);
      files.set('clean.ts', `const noSecretsHere = true;`);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(3);
      expect(report.secretsFound).toBe(1);
      expect(report.clean).toBe(false);
      expect(report.byType['aws-access-key']).toBe(1);
      expect(report.bySeverity.critical).toBeGreaterThan(0);
      expect(report.findings[0].file).toBe('valid.ts');
    });

    it('returns clean report if no secrets found', () => {
      const files = new Map<string, string>();
      files.set('clean.ts', `const noSecretsHere = true;`);

      const report = scanForSecrets(files);

      expect(report.secretsFound).toBe(0);
      expect(report.clean).toBe(true);
      expect(report.bySeverity.critical).toBe(0);
      expect(report.bySeverity.high).toBe(0);
      expect(report.bySeverity.medium).toBe(0);
    });
  });
});
