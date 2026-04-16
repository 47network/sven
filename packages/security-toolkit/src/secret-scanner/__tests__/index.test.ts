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
      // 10 chars -> 10 * 0.15 = 1.5 -> Math.floor = 1. Math.min(4, 1) = 1 showChar.
      expect(redactSecret('1234567890')).toBe('1***0');

      // 30 chars -> 30 * 0.15 = 4.5 -> Math.floor = 4. Math.min(4, 4) = 4 showChars.
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
      const source = `const awsKey = "AKIA1234567890ABCDEF";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('aws-access-key');
      expect(findings[0].matchedText).toBe('AKIA1234567890ABCDEF');
      expect(findings[0].line).toBe(1);
    });

    it('finds generic passwords exceeding entropy', () => {
      // Needs a high entropy password
      const source = `const password = "pA5$w0rd_VeryC0mplex!99";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('generic-password');
    });

    it('ignores generic passwords with low entropy', () => {
      const source = `const password = "aaaaaaaabbbbbbbb";`; // very low entropy password
      const findings = scanFileForSecrets(source, 'test.ts');

      const pwdFindings = findings.filter(f => f.type === 'generic-password');
      expect(pwdFindings).toHaveLength(0); // entropy is < 3.0
    });

    it('skips lines with example/docs comments', () => {
      const source = `// Example: const awsKey = "AKIA1234567890ABCDEF";`;
      const findings = scanFileForSecrets(source, 'test.ts');
      expect(findings).toHaveLength(0);
    });

    it('skips lines with inline suppression', () => {
      const source = `const awsKey = "AKIA1234567890ABCDEF"; // secret-scan-disable`;
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
      files.set('valid.ts', `const key = "AKIA1234567890ABCDEF";`);
      files.set('ignored.png', `const key = "AKIA1234567890ABCDEF";`); // shouldn't be scanned
      files.set('clean.ts', `const noSecretsHere = true;`);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(3); // The map size is 3, filesScanned is just files.size
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
