import {
  shannonEntropy,
  redactSecret,
  shouldScanFile,
  scanFileForSecrets,
  scanForSecrets,
  SECRET_PATTERNS,
  type SecretPattern
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

    it('returns consistent entropy for very long repeating strings', () => {
      expect(shannonEntropy('a'.repeat(100))).toBe(0);
      expect(shannonEntropy('a'.repeat(1000))).toBe(0);
    });

    it('handles strings with spaces and special characters', () => {
      expect(shannonEntropy('!@#$%^&*()_+')).toBeGreaterThan(3);
    });
  });

  describe('redactSecret', () => {
    it('redacts strings of 8 characters or less entirely', () => {
      expect(redactSecret('12345678')).toBe('***');
      expect(redactSecret('abc')).toBe('***');
      expect(redactSecret('')).toBe('***');
    });

    it('redacts exactly 9 characters by showing 1 character on each end', () => {
      expect(redactSecret('1234567890')).toBe('1***0');
    });

    it('partially redacts strings longer than 8 characters', () => {
      expect(redactSecret('12345678901234567890')).toBe('123***890');
    });

    it('caps shown characters to a maximum of 4 on each end for very long secrets', () => {
      expect(redactSecret('123456789012345678901234567890')).toBe('1234***7890');
    });
  });

  describe('SECRET_PATTERNS', () => {
    it('verifies that all built-in patterns have a unique ID and valid RegExp', () => {
      const ids = new Set<string>();
      for (const pattern of SECRET_PATTERNS) {
        expect(ids.has(pattern.id)).toBe(false);
        ids.add(pattern.id);
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(typeof pattern.title).toBe('string');
        expect(pattern.severity).toMatch(/^(critical|high|medium)$/);
      }
    });

    it('matches specific dummy secrets for each pattern', () => {
      const awsAccess = 'AKIA' + '1234567890ABCDEF';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'aws-access-key')?.pattern.test(awsAccess)).toBe(true);

      const awsSecret = 'aws_secret_access_key = "' + 'a'.repeat(40) + '"';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'aws-secret-key')?.pattern.test(awsSecret)).toBe(true);

      const githubToken = 'ghp_' + 'a'.repeat(36);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'github-token')?.pattern.test(githubToken)).toBe(true);

      const githubFineGrained = 'github_pat_' + 'a'.repeat(82);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'github-fine-grained')?.pattern.test(githubFineGrained)).toBe(true);

      const gitlabToken = 'glpat-' + 'a'.repeat(20);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'gitlab-token')?.pattern.test(gitlabToken)).toBe(true);

      const slackToken = 'xoxb-' + '1234567890';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'slack-token')?.pattern.test(slackToken)).toBe(true);

      const slackWebhook = 'https://hooks.slack.com/services/T' + '1234/B5678/901234';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'slack-webhook')?.pattern.test(slackWebhook)).toBe(true);

      const stripeKey = 'sk_live_' + 'a'.repeat(20);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'stripe-key')?.pattern.test(stripeKey)).toBe(true);

      const twilioKey = 'SK' + 'a'.repeat(32);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'twilio-key')?.pattern.test(twilioKey)).toBe(true);

      const sendgridKey = 'SG.' + 'a'.repeat(22) + '.' + 'a'.repeat(43);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'sendgrid-key')?.pattern.test(sendgridKey)).toBe(true);

      const jwt = 'eyJ' + 'a'.repeat(10) + '.eyJ' + 'a'.repeat(10) + '.' + 'a'.repeat(10);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'jwt')?.pattern.test(jwt)).toBe(true);

      const privateKey = '-----BEGIN RSA PRIVATE KEY-----';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'private-key')?.pattern.test(privateKey)).toBe(true);

      const npmToken = 'npm_' + 'a'.repeat(36);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'npm-token')?.pattern.test(npmToken)).toBe(true);

      const pypiToken = 'pypi-' + 'a'.repeat(50);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'pypi-token')?.pattern.test(pypiToken)).toBe(true);

      const gcpServiceAccount = '"type": "service_account"';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'gcp-service-account')?.pattern.test(gcpServiceAccount)).toBe(true);

      const dbUrl = 'postgresql://user:pass' + 'word@localhost:5432/db';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'database-url')?.pattern.test(dbUrl)).toBe(true);

      const genericApiKey = 'api_key = "' + 'a'.repeat(20) + '"';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'generic-api-key')?.pattern.test(genericApiKey)).toBe(true);

      const genericPassword = 'password = "' + 'a'.repeat(8) + '"';
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'generic-password')?.pattern.test(genericPassword)).toBe(true);

      const basicAuth = 'Authorization: Basic ' + 'a'.repeat(10);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'basic-auth-header')?.pattern.test(basicAuth)).toBe(true);

      const bearerToken = 'Authorization: Bearer ' + 'a'.repeat(20);
      expect(SECRET_PATTERNS.find((pattern) => pattern.type === 'bearer-token')?.pattern.test(bearerToken)).toBe(true);
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

    it('falls back to the full match for built-in private-key patterns without capture groups', () => {
      const mockKey = ['-----BEGIN PRIVATE KEY', '-----'].join('');
      const source = `const key = "${mockKey}";`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('private-key');
      expect(findings[0].matchedText).toBe('-----BEGIN PRIVATE KEY-----');
      expect(findings[0].line).toBe(1);
    });

    it('falls back to the full match for built-in gcp service-account patterns without capture groups', () => {
      const source = `const serviceAccount = '{"type": "service_account"}';`;
      const findings = scanFileForSecrets(source, 'test.ts');

      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe('gcp-service-account');
      expect(findings[0].matchedText).toBe('"type": "service_account"');
      expect(findings[0].line).toBe(1);
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

    it('falls back to the full match for custom patterns without capture groups', () => {
      const customPatterns: SecretPattern[] = [
        {
          id: 'CUSTOM-1',
          type: 'generic-secret',
          title: 'Custom Secret',
          pattern: /NO_CAPTURE_GROUP_SECRET/,
          severity: 'high',
        },
      ];
      const source = `const secret = "NO_CAPTURE_GROUP_SECRET";`;
      const findings = scanFileForSecrets(source, 'test.ts', customPatterns);

      expect(findings).toHaveLength(1);
      expect(findings[0].matchedText).toBe('NO_CAPTURE_GROUP_SECRET');
      expect(findings[0].patternId).toBe('CUSTOM-1');
    });
  });

  describe('scanForSecrets', () => {
    it('aggregates findings across multiple files', () => {
      const files = new Map<string, string>();
      files.set('valid.ts', `const key = "AKIA1234567890ABCDEF";`);
      files.set('ignored.png', `const key = "AKIA1234567890ABCDEF";`);
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

    it('accepts custom patterns', () => {
      const customPatterns: SecretPattern[] = [
        {
          id: 'CUSTOM-1',
          type: 'generic-secret',
          title: 'Custom Secret',
          pattern: /NO_CAPTURE_GROUP_SECRET/,
          severity: 'high',
        },
      ];
      const files = new Map<string, string>();
      files.set('custom.ts', `const key = "NO_CAPTURE_GROUP_SECRET";`);

      const report = scanForSecrets(files, customPatterns);

      expect(report.secretsFound).toBe(1);
      expect(report.clean).toBe(false);
      expect(report.findings[0].patternId).toBe('CUSTOM-1');
    });

    it('aggregates by severity and type correctly', () => {
      const files = new Map<string, string>();
      files.set(
        'file1.ts',
        `const key1 = "AKIA1234567890ABCDEF";\nconst webhook = "https://hooks.slack.com/services/T1/B1/123";\nconst key2 = "AKIA0987654321FEDCBA";`,
      );
      files.set('file2.ts', `const config = { api_key: "AbCdEf1234567890Zyxw" };`);
      files.set('ignored.png', `const ignored = "AKIA1234567890ABCDEF";`);

      const report = scanForSecrets(files);

      expect(report.filesScanned).toBe(3);
      expect(report.secretsFound).toBe(4);
      expect(report.clean).toBe(false);
      expect(report.byType['aws-access-key']).toBe(2);
      expect(report.byType['slack-webhook']).toBe(1);
      expect(report.byType['generic-api-key']).toBe(1);
      expect(report.bySeverity.critical).toBe(2);
      expect(report.bySeverity.high).toBe(1);
      expect(report.bySeverity.medium).toBe(1);
      expect(new Date(report.scannedAt).toISOString()).toBe(report.scannedAt);
    });
  });
});
