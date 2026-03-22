# Evidence: Community Marketplace Governance Docs

Date: 2026-02-21
Owner: Codex session
Checklist target: `A24.2` and `B2.2` governance/process lines

## Added Artifacts

- Skill submission process:
  - `docs/community/skill-submission-process.md`
- Verified publisher badge policy:
  - `docs/community/verified-publisher-badges.md`
- Skill directory source listing:
  - `docs/community/skill-directory.md`
- Public skill directory web route:
  - `apps/canvas-ui/src/app/skills/page.tsx` (`/skills`)
  - public-route allowlist updated in `apps/canvas-ui/src/middleware.ts`
- Skill ratings/reviews UI on directory page:
  - `apps/canvas-ui/src/app/skills/page.tsx`
  - per-skill star rating, review count, and review snippets rendered

## Result

Submission workflow, publisher verification policy, public web skill listing, and ratings/reviews UI are documented in-repo as of 2026-02-21.
