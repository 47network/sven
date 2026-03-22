# Skill Development Guide

Date: 2026-02-21

## Overview

Sven skills are packaged under the repository `skills/` directory and are executed through the skill runner pipeline. A skill should define:

- clear intent and constraints
- explicit inputs and outputs
- minimal required privileges

## Where Skills Live

- `skills/<skill-name>/README.md` for usage and examples
- `skills/<skill-name>/` implementation files
- `services/skill-runner/` execution runtime

## Build a New Skill

1. Create a new folder under `skills/` with a unique name.
2. Add a `README.md` that documents:
   - purpose
   - required configuration/env vars
   - sample invocation
   - expected response shape
3. Add implementation code and keep network/file access scoped to only what is required.
4. Register or expose the skill through the existing skill runtime wiring.

## Security Baseline

- Do not hardcode credentials.
- Use existing secret/config mechanisms.
- Assume tool input is untrusted and validate it.
- Return structured errors, never stack traces with secrets.

## Validation Checklist

- Run service tests for changed skill runner behavior.
- Verify the skill output contract is stable and deterministic.
- Confirm audit trail/approval behavior for privileged operations.

## Related Docs

- `CONTRIBUTING.md`
- `docs/api/openapi.yaml`
- `docs/security/threat-model.md`
- `docs/security/ui-app-security-baseline.md`
