# Community Doc Agents Verification

## Purpose

Run automated community-facing documentation agents that verify live Sven behavior before publishing feature documentation updates.

## Commands

```powershell
# 1) Verify runtime + documentation surface
npm run release:community:doc-agents:verify

# 2) Publish generated summary (local draft + optional webhooks)
npm run release:community:doc-agents:publish:local
```

## Required Inputs

- `SVEN_DOC_AGENT_API_BASE` (default: `https://app.example.com`)
- `SVEN_DOC_AGENT_COMMUNITY_URL` (default: `https://app.example.com/community`)

Optional for authenticated-user scenario:

- `SVEN_DOC_AGENT_USERNAME`
- `SVEN_DOC_AGENT_PASSWORD`
- `SVEN_DOC_AGENT_REQUIRE_COMMUNITY_FEED` (`true|false`, default `false`; when `true`, `/v1/public/community/feed` becomes a required pass gate)

Runtime contracts now include:
- `GET /v1/public/community/status`
- `GET /v1/public/community/feed`
- `GET /v1/public/community/leaderboard` (optional pass gate)
- `GET /v1/public/community/capability-proof` (required pass gate)

Optional publish targets:

- `SVEN_COMMUNITY_DOCS_WEBHOOK_URL`
- `SVEN_COMMUNITY_DISCORD_WEBHOOK_URL`
- `SVEN_COMMUNITY_GITHUB_DISCUSSIONS_WEBHOOK_URL`
- `SVEN_COMMUNITY_MARKETPLACE_WEBHOOK_URL`

## Artifacts

- `docs/release/status/community-doc-agents-latest.json`
- `docs/release/status/community-doc-agents-latest.md`
- `docs/community/agent-feature-verification-latest.md`
- `docs/release/status/community-doc-agents-publish-latest.json`
- `docs/release/status/community-doc-agents-publish-latest.md`
- `docs/community/posts/community-doc-agent-post-latest.md`

## Promotion Rule

Treat community documentation as production-truthful only when:

1. `community-doc-agents-latest.json` has `status=pass`.
2. Required checks are all pass (no required failures).
3. If webhooks are configured, publish step has no failed configured targets.
