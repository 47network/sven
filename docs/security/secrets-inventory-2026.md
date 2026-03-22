# Secrets Inventory (2026)

## Environments
- `dev`: local and developer integration testing.
- `staging`: pre-production validation and release candidate checks.
- `prod`: production serving and release channels.

## Required Secrets by Environment
- Source contracts:
  - `config/env/dev.required.json`
  - `config/env/staging.required.json`
  - `config/env/prod.required.json`

## Ownership
- Engineering: updates app/runtime secret requirements.
- Security: reviews secret scope and rotation intervals.
- Operations: manages secret storage backends and runtime injection.

## Handling Rules
- Never commit plaintext secrets into source control.
- Inject secrets at runtime through CI/CD and deployment secret stores.
- Keep environment-specific scopes isolated; production credentials are never reused in lower environments.
