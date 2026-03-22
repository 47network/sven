# Skill Submission Process

Date: 2026-02-21

## Submission Model

Default process is PR-based submission.

## Steps

1. Fork the repository and create a feature branch.
2. Add your skill under `skills/<skill-name>/`.
3. Include `README.md` with:
   - purpose and scope
   - required configuration/secrets
   - input/output examples
   - safety considerations
4. Open a pull request with:
   - threat/risk notes
   - test evidence
   - expected runtime dependencies
5. Maintainers review for quality, security, and policy compliance.

## Acceptance Criteria

- No hardcoded secrets.
- Clear input/output contract.
- Bounded behavior and failure handling documented.
- Compatible with existing policy/approval controls.

## Post-Merge

- Skill is listed in `docs/community/skill-directory.md`.
- Verification/badge status is evaluated under publisher policy.
