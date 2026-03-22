import { afterEach, describe, expect, it } from '@jest/globals';
import type { Pool } from 'pg';
import { resolvePersonaVerificationEvidence } from '../routes/admin/community';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

function createMockPool(rows: Array<Record<string, unknown>>): Pool {
  return {
    query: async () => ({ rows }),
  } as unknown as Pool;
}

describe('community persona verification evidence', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('fails closed when verified-persona mode has no provider configured', async () => {
    process.env.SVEN_COMMUNITY_ACCESS_MODE = 'verified_persona_only';
    delete process.env.SVEN_COMMUNITY_PERSONA_PROVIDER;
    process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST = 'stan@the47network.com';

    const evidence = await resolvePersonaVerificationEvidence(createMockPool([]), 'stan@the47network.com');
    expect(evidence.verified).toBe(false);
    expect(evidence.reason).toBe('persona_provider_missing');
  });

  it('passes when identity exists and allowlist matches', async () => {
    process.env.SVEN_COMMUNITY_ACCESS_MODE = 'verified_persona_only';
    process.env.SVEN_COMMUNITY_PERSONA_PROVIDER = 'oidc';
    process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST = 'email:stan@the47network.com';

    const evidence = await resolvePersonaVerificationEvidence(
      createMockPool([
        {
          organization_id: 'org-1',
          user_id: 'user-1',
          provider: 'oidc',
          subject: 'sub-1',
          email: 'stan@the47network.com',
          groups_json: ['trusted'],
          has_unrevoked_session_link: true,
        },
      ]),
      'stan@the47network.com',
    );

    expect(evidence.verified).toBe(true);
    expect(evidence.reason).toBe('persona_evidence_verified');
    expect(evidence.identity_found).toBe(true);
    expect(evidence.allowlist_matched).toBe(true);
  });

  it('fails when identity exists but allowlist does not match', async () => {
    process.env.SVEN_COMMUNITY_ACCESS_MODE = 'verified_persona_only';
    process.env.SVEN_COMMUNITY_PERSONA_PROVIDER = 'oidc';
    process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST = 'email:other@the47network.com';

    const evidence = await resolvePersonaVerificationEvidence(
      createMockPool([
        {
          organization_id: 'org-1',
          user_id: 'user-1',
          provider: 'oidc',
          subject: 'sub-1',
          email: 'stan@the47network.com',
          groups_json: ['trusted'],
          has_unrevoked_session_link: false,
        },
      ]),
      'stan@the47network.com',
    );

    expect(evidence.verified).toBe(false);
    expect(evidence.reason).toBe('allowlist_mismatch');
    expect(evidence.identity_found).toBe(true);
    expect(evidence.allowlist_matched).toBe(false);
  });
});
