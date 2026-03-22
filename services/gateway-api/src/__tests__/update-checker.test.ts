import { describe, expect, it } from '@jest/globals';
import { compareSemver, validateUpdateFeedUrl } from '../services/UpdateCheckerService.js';

describe('UpdateCheckerService semver compare', () => {
  it('compares versions correctly', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('1.2.4', '1.2.3')).toBe(1);
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1);
    expect(compareSemver('v2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.10.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0', '1.0.5')).toBe(-1);
  });

  it('preserves prerelease precedence and ignores build metadata in ordering', () => {
    expect(compareSemver('1.2.3-rc.1', '1.2.3')).toBe(-1);
    expect(compareSemver('1.2.3', '1.2.3-rc.1')).toBe(1);
    expect(compareSemver('1.2.4-beta.1', '1.2.4-alpha.9')).toBe(1);
    expect(compareSemver('v1.2.3+meta.7', '1.2.3')).toBe(0);
  });
});

describe('UpdateCheckerService feed URL safety policy', () => {
  it('rejects localhost/private/metadata targets and unsupported schemes', () => {
    expect(validateUpdateFeedUrl('file:///tmp/feed.json', []).ok).toBe(false);
    expect(validateUpdateFeedUrl('http://localhost/feed.json', []).ok).toBe(false);
    expect(validateUpdateFeedUrl('http://127.0.0.1/feed.json', []).ok).toBe(false);
    expect(validateUpdateFeedUrl('http://169.254.169.254/latest/meta-data', []).ok).toBe(false);
    expect(validateUpdateFeedUrl('http://metadata.google.internal/computeMetadata/v1', []).ok).toBe(false);
    expect(validateUpdateFeedUrl('http://192.168.1.10/feed.json', []).ok).toBe(false);
  });

  it('accepts public https targets and enforces optional host allowlist', () => {
    const publicResult = validateUpdateFeedUrl('https://api.github.com/repos/47matrix/openclaw-sven/releases/latest', []);
    expect(publicResult.ok).toBe(true);

    const allowedResult = validateUpdateFeedUrl('https://updates.example.com/feed.json', ['updates.example.com']);
    expect(allowedResult.ok).toBe(true);

    const blockedByAllowlist = validateUpdateFeedUrl('https://api.github.com/feed.json', ['updates.example.com']);
    expect(blockedByAllowlist.ok).toBe(false);
  });
});
