import { describe, expect, it } from '@jest/globals';
import { assessStartupHardeningRisk, evaluateStartupHardeningEnforcement } from '../lib/startup-hardening.js';

describe('startup hardening risk assessment', () => {
  it('flags risk when running with weak/default hardening posture', () => {
    const result = assessStartupHardeningRisk({
      SVEN_HARDENING_PROFILE: 'default',
      COOKIE_SECRET: 'sven-dev-secret-change-me',
      CORS_ORIGIN: '*',
      BROWSER_ENFORCE_CONTAINER: 'false',
      NODE_ENV: 'production',
      GATEWAY_URL: 'http://example.internal',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    const issueCodes = result.issues.map((i) => i.code);
    expect(issueCodes).toEqual(
      expect.arrayContaining([
        'HARDENING_PROFILE',
        'COOKIE_SECRET',
        'CORS_ORIGIN',
        'BROWSER_ISOLATION',
        'PUBLIC_URL_TLS',
        'EGRESS_PROXY',
        'TOKEN_EXCHANGE',
      ]),
    );
  });

  it('does not flag risk for hardened startup posture', () => {
    const result = assessStartupHardeningRisk({
      SVEN_HARDENING_PROFILE: 'strict',
      COOKIE_SECRET: 'this-is-a-very-strong-cookie-secret',
      CORS_ORIGIN: 'https://admin.example.com',
      BROWSER_ENFORCE_CONTAINER: 'true',
      NODE_ENV: 'production',
      GATEWAY_URL: 'https://api.example.com',
      HTTPS_PROXY: 'http://egress-proxy.internal:3128',
      AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('accepts SVEN_EGRESS_PROXY as valid egress proxy signal for startup hardening parity with skill-runner', () => {
    const result = assessStartupHardeningRisk({
      SVEN_HARDENING_PROFILE: 'strict',
      COOKIE_SECRET: 'this-is-a-very-strong-cookie-secret',
      CORS_ORIGIN: 'https://admin.example.com',
      BROWSER_ENFORCE_CONTAINER: 'true',
      NODE_ENV: 'production',
      GATEWAY_URL: 'https://api.example.com',
      SVEN_EGRESS_PROXY: 'http://egress-proxy.internal:3128',
      AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('enforces fail-closed in production when critical startup hardening issues exist', () => {
    const result = assessStartupHardeningRisk({
      NODE_ENV: 'production',
      SVEN_HARDENING_PROFILE: 'default',
      COOKIE_SECRET: 'weak-secret',
      CORS_ORIGIN: 'https://admin.example.com',
      BROWSER_ENFORCE_CONTAINER: 'true',
      HTTPS_PROXY: 'http://egress-proxy.internal:3128',
      AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
    } as NodeJS.ProcessEnv);

    const enforcement = evaluateStartupHardeningEnforcement(result, {
      NODE_ENV: 'production',
      SVEN_HARDENING_PROFILE: 'default',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(true);
    expect(enforcement.enforceFailClosed).toBe(true);
    expect(enforcement.blockingIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['COOKIE_SECRET', 'HARDENING_PROFILE']),
    );
  });

  it('does not enforce fail-closed in default dev profile without explicit override', () => {
    const result = assessStartupHardeningRisk({
      NODE_ENV: 'development',
      SVEN_HARDENING_PROFILE: 'default',
      COOKIE_SECRET: 'weak-secret',
    } as NodeJS.ProcessEnv);

    const enforcement = evaluateStartupHardeningEnforcement(result, {
      NODE_ENV: 'development',
      SVEN_HARDENING_PROFILE: 'default',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(true);
    expect(enforcement.enforceFailClosed).toBe(false);
    expect(enforcement.blockingIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['COOKIE_SECRET', 'HARDENING_PROFILE']),
    );
  });

  it('supports explicit fail-closed override in non-production mode', () => {
    const result = assessStartupHardeningRisk({
      NODE_ENV: 'development',
      SVEN_HARDENING_PROFILE: 'default',
      COOKIE_SECRET: 'weak-secret',
    } as NodeJS.ProcessEnv);

    const enforcement = evaluateStartupHardeningEnforcement(result, {
      NODE_ENV: 'development',
      SVEN_HARDENING_PROFILE: 'default',
      SVEN_STARTUP_HARDENING_FAIL_CLOSED: 'true',
    } as NodeJS.ProcessEnv);

    expect(enforcement.enforceFailClosed).toBe(true);
    expect(enforcement.blockingIssues.length).toBeGreaterThan(0);
  });

  it('treats SSO mock enablement as a blocking issue for hardened production profiles', () => {
    const result = assessStartupHardeningRisk({
      NODE_ENV: 'production',
      SVEN_HARDENING_PROFILE: 'strict',
      COOKIE_SECRET: 'this-is-a-very-strong-cookie-secret',
      CORS_ORIGIN: 'https://admin.example.com',
      BROWSER_ENFORCE_CONTAINER: 'true',
      HTTPS_PROXY: 'http://egress-proxy.internal:3128',
      AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
      SVEN_SSO_MOCK_ENABLED: 'true',
    } as NodeJS.ProcessEnv);

    const enforcement = evaluateStartupHardeningEnforcement(result, {
      NODE_ENV: 'production',
      SVEN_HARDENING_PROFILE: 'strict',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['SSO_MOCK_PROD']));
    expect(enforcement.enforceFailClosed).toBe(true);
    expect(enforcement.blockingIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['SSO_MOCK_PROD']));
  });

  it('treats explicit SAML strict-assertion disablement as a blocking issue in production-like profiles', () => {
    const result = assessStartupHardeningRisk({
      NODE_ENV: 'production',
      SVEN_HARDENING_PROFILE: 'strict',
      COOKIE_SECRET: 'this-is-a-very-strong-cookie-secret',
      CORS_ORIGIN: 'https://admin.example.com',
      BROWSER_ENFORCE_CONTAINER: 'true',
      HTTPS_PROXY: 'http://egress-proxy.internal:3128',
      AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
      SVEN_SSO_STRICT_ASSERTION_VALIDATION: 'false',
    } as NodeJS.ProcessEnv);

    const enforcement = evaluateStartupHardeningEnforcement(result, {
      NODE_ENV: 'production',
      SVEN_HARDENING_PROFILE: 'strict',
    } as NodeJS.ProcessEnv);

    expect(result.risk).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['SSO_SAML_ASSERTION_STRICT']));
    expect(enforcement.enforceFailClosed).toBe(true);
    expect(enforcement.blockingIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['SSO_SAML_ASSERTION_STRICT']),
    );
  });
});
