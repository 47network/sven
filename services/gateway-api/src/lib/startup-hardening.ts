type StartupRiskIssue = {
  code: string;
  detail: string;
  config_path: string;
};

type StartupRiskResult = {
  risk: boolean;
  profile: string;
  issues: StartupRiskIssue[];
};

type StartupHardeningEnforcement = {
  enforceFailClosed: boolean;
  blockingIssues: StartupRiskIssue[];
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isSecureHardeningProfile(profile: string): boolean {
  const normalized = profile.trim().toLowerCase();
  return normalized === 'strict' || normalized === 'hardened' || normalized === 'isolated' || normalized === 'production';
}

function shouldEnforceFailClosed(
  env: NodeJS.ProcessEnv,
  profile: string,
): boolean {
  const explicit = env.SVEN_STARTUP_HARDENING_FAIL_CLOSED;
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return isTruthy(explicit);
  }
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  return nodeEnv === 'production' || isSecureHardeningProfile(profile);
}

function isCriticalIssueCode(code: string): boolean {
  return code === 'COOKIE_SECRET'
    || code === 'HARDENING_PROFILE'
    || code === 'SSO_MOCK_PROD'
    || code === 'SSO_SAML_ASSERTION_STRICT';
}

export function assessStartupHardeningRisk(
  env: NodeJS.ProcessEnv = process.env,
): StartupRiskResult {
  const profile = String(env.SVEN_HARDENING_PROFILE || env.SVEN_PROFILE || 'default');
  const issues: StartupRiskIssue[] = [];

  if (!isSecureHardeningProfile(profile)) {
    issues.push({
      code: 'HARDENING_PROFILE',
      detail: `Startup profile "${profile}" is not an explicit hardening profile`,
      config_path: 'SVEN_HARDENING_PROFILE',
    });
  }

  const cookieSecret = String(env.COOKIE_SECRET || '').trim();
  const loweredCookieSecret = cookieSecret.toLowerCase();
  const weakCookieSecret = loweredCookieSecret === 'sven-dev-secret'
    || loweredCookieSecret === 'sven-dev-secret-change-me'
    || loweredCookieSecret === 'change-me'
    || loweredCookieSecret === 'changeme'
    || loweredCookieSecret === 'default';
  if (!cookieSecret || cookieSecret.length < 32 || weakCookieSecret) {
    issues.push({
      code: 'COOKIE_SECRET',
      detail: 'Cookie secret is missing, weak, or default',
      config_path: 'auth.cookie_secret',
    });
  }

  const corsOrigin = String(env.CORS_ORIGIN || '').trim().toLowerCase();
  if (corsOrigin === 'true' || corsOrigin === '*') {
    issues.push({
      code: 'CORS_ORIGIN',
      detail: `CORS allows broad origins (${corsOrigin})`,
      config_path: 'gateway.cors_origin',
    });
  }

  const browserIsolation = String(env.BROWSER_ENFORCE_CONTAINER || '').trim().toLowerCase();
  if (!['1', 'true', 'yes', 'on'].includes(browserIsolation)) {
    issues.push({
      code: 'BROWSER_ISOLATION',
      detail: 'Browser container isolation is not explicitly enforced',
      config_path: 'browser.enforce_container',
    });
  }

  const hasEgressProxy = Boolean(
    String(env.SVEN_EGRESS_PROXY || '').trim() ||
    String(env.BROWSER_PROXY_URL || '').trim() ||
      String(env.HTTP_PROXY || '').trim() ||
      String(env.HTTPS_PROXY || '').trim() ||
      String(env.EGRESS_PROXY_URL || '').trim(),
  );
  if (!hasEgressProxy) {
    issues.push({
      code: 'EGRESS_PROXY',
      detail: 'No explicit egress proxy configured',
      config_path: 'network.egress_proxy',
    });
  }

  const publicUrl = String(env.GATEWAY_URL || '').trim();
  if (publicUrl && /^http:\/\//i.test(publicUrl) && (env.NODE_ENV || 'development') === 'production') {
    issues.push({
      code: 'PUBLIC_URL_TLS',
      detail: `Public URL is not HTTPS (${publicUrl})`,
      config_path: 'gateway.public_url',
    });
  }

  if (!isTruthy(env.AUTH_DISABLE_TOKEN_EXCHANGE)) {
    issues.push({
      code: 'TOKEN_EXCHANGE',
      detail: 'Token exchange hardening flag is not enabled',
      config_path: 'auth.disable_token_exchange',
    });
  }

  if (isSecureHardeningProfile(profile) && isTruthy(env.SVEN_SSO_MOCK_ENABLED)) {
    issues.push({
      code: 'SSO_MOCK_PROD',
      detail: 'SSO mock login is enabled under a production-like hardening profile',
      config_path: 'auth.sso_mock_enabled',
    });
  }

  const strictAssertionValidationConfigured = String(env.SVEN_SSO_STRICT_ASSERTION_VALIDATION || '').trim();
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const productionLike = nodeEnv === 'production' || isSecureHardeningProfile(profile);
  if (productionLike && strictAssertionValidationConfigured && !isTruthy(strictAssertionValidationConfigured)) {
    issues.push({
      code: 'SSO_SAML_ASSERTION_STRICT',
      detail: 'SAML strict assertion validation is explicitly disabled in a production-like environment',
      config_path: 'auth.sso_strict_assertion_validation',
    });
  }

  return {
    risk: issues.length > 0,
    profile,
    issues,
  };
}

export function evaluateStartupHardeningEnforcement(
  result: StartupRiskResult,
  env: NodeJS.ProcessEnv = process.env,
): StartupHardeningEnforcement {
  const enforceFailClosed = shouldEnforceFailClosed(env, result.profile);
  const blockingIssues = result.issues.filter((issue) => isCriticalIssueCode(issue.code));
  return {
    enforceFailClosed,
    blockingIssues,
  };
}
