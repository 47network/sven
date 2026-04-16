import {
  shannonEntropy,
  redactSecret,
  shouldScanFile,
  scanFileForSecrets,
  scanForSecrets,
  SECRET_PATTERNS
} from '../secret-scanner/index';

describe('secret-scanner', () => {
  describe('shannonEntropy', () => {
    it('returns 0 for empty string', () => {
      expect(shannonEntropy('')).toBe(0);
    });

    it('returns 0 for a string of repeated characters', () => {
      expect(shannonEntropy('aaaaa')).toBe(0);
    });

    it('returns a positive number for strings with varying characters', () => {
      const entropy = shannonEntropy('abcde12345');
      expect(entropy).toBeGreaterThan(0);
      expect(entropy).toBeCloseTo(3.3219, 3); // log2(10)
    });
  });

  describe('redactSecret', () => {
    it('returns *** for strings <= 8 characters', () => {
      expect(redactSecret('secret')).toBe('***');
      expect(redactSecret('12345678')).toBe('***');
    });

    it('redacts middle characters for longer strings based on length * 0.15', () => {
      // 20 char string -> floor(20 * 0.15) = 3 chars on each end
      const str = '12345678901234567890';
      expect(str.length).toBe(20);
      expect(redactSecret(str)).toBe('123***890');
    });

    it('caps shown characters at 4 for very long strings', () => {
      // 100 char string -> floor(100 * 0.15) = 15, but capped at 4
      const longStr = 'a'.repeat(40) + 'b'.repeat(20) + 'c'.repeat(40);
      expect(redactSecret(longStr)).toBe('aaaa***cccc');
    });
  });

  describe('shouldScanFile', () => {
    it('returns false for excluded extensions', () => {
      expect(shouldScanFile('package.lock')).toBe(false);
      expect(shouldScanFile('audio.mp3')).toBe(false);
      expect(shouldScanFile('document.pdf')).toBe(false);
    });

    it('returns false for excluded paths', () => {
      expect(shouldScanFile('node_modules/library/index.js')).toBe(false);
      expect(shouldScanFile('.git/config')).toBe(false);
      expect(shouldScanFile('dist/bundle.js')).toBe(false);
    });

    it('returns true for normal code files', () => {
      expect(shouldScanFile('src/index.ts')).toBe(true);
      expect(shouldScanFile('config.js')).toBe(true);
      expect(shouldScanFile('.env')).toBe(true);
    });
  });

  describe('scanFileForSecrets', () => {
    it('finds secrets using built-in patterns', () => {
      const source = `
const awsAccessKey = "AKIA1234567890ABCDEF";
console.log(awsAccessKey);
`;
      const findings = scanFileForSecrets(source, 'config.js');
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        type: 'aws-access-key',
        matchedText: 'AKIA1234567890ABCDEF',
        line: 2,
        file: 'config.js',
      });
    });

    it('suppresses findings in comments like "example" or "placeholder"', () => {
      const source = `
// example AKIA1234567890ABCDEF
# placeholder AKIA1234567890ABCDEF
; changeme AKIA1234567890ABCDEF
`;
      const findings = scanFileForSecrets(source, 'config.js');
      expect(findings).toHaveLength(0);
    });

    it('suppresses findings with inline secret-scan-disable', () => {
      const source = `
const myKey = "AKIA1234567890ABCDEF"; // secret-scan-disable
`;
      const findings = scanFileForSecrets(source, 'config.js');
      expect(findings).toHaveLength(0);
    });

    it('skips generic process.env assignments', () => {
      const source = `
const dbPassword = process.env.DB_PASSWORD;
`;
      const findings = scanFileForSecrets(source, 'config.js');
      expect(findings).toHaveLength(0);
    });

    it('enforces minEntropy if specified on a pattern', () => {
      // Find a pattern with minEntropy, e.g. generic-password (SEC-018)
      // minEntropy is 3.0
      const sourceHigh = `const password = 'aB3!xY9_zPq2#mN'`; // High entropy
      const sourceLow = `const password = 'aaaaaaaaaaaaaaa'`; // Low entropy

      const findingsHigh = scanFileForSecrets(sourceHigh, 'high.js');
      expect(findingsHigh.some(f => f.type === 'generic-password')).toBe(true);

      const findingsLow = scanFileForSecrets(sourceLow, 'low.js');
      expect(findingsLow.some(f => f.type === 'generic-password')).toBe(false);
    });
  });

  describe('scanForSecrets', () => {
    it('aggregates findings from multiple files', () => {
      const files = new Map<string, string>([
        ['src/config.ts', 'const token = "xoxb-1234567890-1234567890";'], // slack-token
        ['node_modules/test.js', 'const token = "xoxb-1234567890-1234567890";'], // Excluded path
        ['src/index.ts', 'console.log("hello");'], // Clean file
        ['docs/readme.pdf', 'binary data xoxb-1234567890-1234567890'], // Excluded extension
      ]);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(4); // scanForSecrets processes all keys (though skips excluded ones)
      expect(report.secretsFound).toBe(1);
      expect(report.clean).toBe(false);
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].file).toBe('src/config.ts');
      expect(report.byType['slack-token']).toBe(1);
      expect(report.bySeverity['critical']).toBe(1);
    });

    it('returns a clean report if no secrets found', () => {
        const files = new Map<string, string>([
            ['src/index.ts', 'console.log("hello");'],
          ]);
          const report = scanForSecrets(files);
          expect(report.clean).toBe(true);
          expect(report.secretsFound).toBe(0);
    });
  });
});
