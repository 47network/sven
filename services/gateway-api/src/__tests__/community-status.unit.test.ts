import { afterEach, describe, expect, it } from '@jest/globals';
import { redactCommunityStatusForPublic, redactCommunityStatusForRole, resolveCommunityStatus } from '../routes/admin/community';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('community status policy', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('defaults to verified-persona and strict safety posture', () => {
    delete process.env.SVEN_COMMUNITY_ACCESS_MODE;
    delete process.env.SVEN_COMMUNITY_PERSONA_PROVIDER;
    delete process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST;
    delete process.env.SVEN_COMMUNITY_MODERATION_MODE;
    delete process.env.SVEN_COMMUNITY_AGENT_POST_POLICY;
    delete process.env.SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED;

    const status = resolveCommunityStatus();
    expect(status.policy.access_mode).toBe('verified_persona_only');
    expect(status.policy.moderation_mode).toBe('strict');
    expect(status.policy.agent_post_policy).toBe('reviewed_only');
    expect(status.readiness.verified_persona_provider).toBe(false);
    expect(status.readiness.verified_persona_allowlist).toBe(false);
    expect(status.readiness.moderation_guardrails).toBe(true);
    expect(status.readiness.security_baseline).toBe(false);
    expect(status.total).toBe(8);
  });

  it('marks verified-persona readiness when provider + allowlist are configured', () => {
    process.env.SVEN_COMMUNITY_ACCESS_MODE = 'verified_persona_only';
    process.env.SVEN_COMMUNITY_PERSONA_PROVIDER = 'oidc';
    process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST = 'stan@the47network.com';
    process.env.SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED = 'true';

    const status = resolveCommunityStatus();
    expect(status.policy.persona_provider).toBe('oidc');
    expect(status.policy.persona_allowlist_configured).toBe(true);
    expect(status.readiness.verified_persona_provider).toBe(true);
    expect(status.readiness.verified_persona_allowlist).toBe(true);
    expect(status.readiness.security_baseline).toBe(true);
  });

  it('redacts privileged URLs and provider for non-platform-admin roles', () => {
    process.env.SVEN_COMMUNITY_DOCS_URL = 'https://community.example/docs';
    process.env.SVEN_COMMUNITY_DISCORD_URL = 'https://discord.gg/example';
    process.env.SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL = 'https://github.com/org/repo/discussions';
    process.env.SVEN_COMMUNITY_MARKETPLACE_URL = 'https://community.example/marketplace';
    process.env.SVEN_COMMUNITY_PERSONA_PROVIDER = 'oidc';

    const status = resolveCommunityStatus();
    const redacted = redactCommunityStatusForRole(status, 'operator');
    expect(redacted.docs_url).toBeNull();
    expect(redacted.discord_url).toBeNull();
    expect(redacted.github_discussions_url).toBeNull();
    expect(redacted.marketplace_url).toBeNull();
    expect(redacted.policy.persona_provider).toBeNull();
  });

  it('redacts persona internals for public status endpoint', () => {
    process.env.SVEN_COMMUNITY_PERSONA_PROVIDER = 'oidc';
    process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST = '47@the47network.com';

    const status = resolveCommunityStatus();
    const publicView = redactCommunityStatusForPublic(status);
    expect(publicView.policy.persona_provider).toBeNull();
    expect(publicView.policy.persona_allowlist_configured).toBe(false);
    expect(publicView.readiness.verified_persona_provider).toBe(true);
  });

  it('normalizes 47matrix https links to external TLS port', () => {
    process.env.SVEN_EXTERNAL_TLS_PORT = '44747';
    process.env.SVEN_COMMUNITY_DOCS_URL = 'https://app.sven.example.com/docs';

    const status = resolveCommunityStatus();
    expect(status.docs_url).toBe('https://app.sven.example.com/docs');
  });
});
