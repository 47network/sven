# Community Ecosystem Rollout And Safety

## Objective

Roll out Sven community capabilities with verified-persona-only participation and strict trust/safety controls.

## Required Environment

- `SVEN_COMMUNITY_DOCS_URL`
- `SVEN_COMMUNITY_DISCORD_URL`
- `SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL`
- `SVEN_COMMUNITY_MARKETPLACE_URL`
- `SVEN_COMMUNITY_ACCESS_MODE=verified_persona_only`
- `SVEN_COMMUNITY_PERSONA_PROVIDER=<oidc|saml|enterprise_idp>`
- `SVEN_COMMUNITY_PERSONA_ALLOWLIST=<comma-separated identities/domains>`
- `SVEN_COMMUNITY_MODERATION_MODE=strict`
- `SVEN_COMMUNITY_AGENT_POST_POLICY=reviewed_only`
- `SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED=true`
- `SVEN_DOC_AGENT_API_BASE=https://app.example.com`
- `SVEN_DOC_AGENT_COMMUNITY_URL=https://app.example.com/community`
- `SVEN_DOC_AGENT_USERNAME` (optional, enables authenticated user scenario checks)
- `SVEN_DOC_AGENT_PASSWORD` (optional, enables authenticated user scenario checks)
- Optional publish hooks:
  - `SVEN_COMMUNITY_DOCS_WEBHOOK_URL`
  - `SVEN_COMMUNITY_DISCORD_WEBHOOK_URL`
  - `SVEN_COMMUNITY_GITHUB_DISCUSSIONS_WEBHOOK_URL`
  - `SVEN_COMMUNITY_MARKETPLACE_WEBHOOK_URL`

## Validation

Run:

```powershell
npm run release:community:doc-agents:verify
npm run release:community:ecosystem:check
```

Artifacts:

- `docs/release/status/community-doc-agents-latest.json`
- `docs/release/status/community-doc-agents-latest.md`
- `docs/community/agent-feature-verification-latest.md`
- `docs/release/status/community-ecosystem-readiness-latest.json`
- `docs/release/status/community-ecosystem-readiness-latest.md`

## Documentation Publishing

Run:

```powershell
npm run release:community:doc-agents:publish:local
```

This writes:

- `docs/release/status/community-doc-agents-publish-latest.json`
- `docs/release/status/community-doc-agents-publish-latest.md`
- `docs/community/posts/community-doc-agent-post-latest.md`

If webhook env vars are configured, this step pushes the verification summary to community channels.

## Promotion Rule

Do not promote community ecosystem parity to `matched` until:

1. Readiness status is `pass`.
2. URLs are live and reachable.
3. Verified-persona checks are enforced in production.
4. Moderation and incident runbook ownership is staffed.
5. Community doc-agent verification is `pass` and the publish lane completed without failed configured targets.
