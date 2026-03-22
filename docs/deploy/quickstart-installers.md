# QuickStart Installers (`example.com`)

Topology note:
- If you use standalone Nginx on the Sven host, follow `docs/deploy/nginx-47matrix-domains.md`.
- If you use an external proxy (external Nginx/Caddy/Traefik), follow `docs/deploy/ingress-topologies.md`.

These files back the one-liners:

- `deploy/quickstart/install.sh`
- `deploy/quickstart/install.ps1`
- `deploy/quickstart/install.cmd`

Default installer source repo:

- `https://github.com/47network/thesven.git`

Default installer branch:

- `main`

Target runtime domain for the app/API:

- `https://app.example.com`

Important:

- the quickstart installers clone the repo locally
- they require `git`, `node`, and `npm`
- they install the Sven CLI globally from `packages/cli`
- they do not bootstrap services unless `SVEN_INSTALL_BOOTSTRAP=1`
- for GitHub release users, using a pinned tag or commit is safer than relying on the default `main` branch

Quickstart is an evaluation and CLI bootstrap path. It is not the primary production deployment path.

## Serve installers from Sven machine (no edge file copy)

On `192.168.7.59`, run the static installer service:

```sh
docker compose up -d quickstart-static
```

This exposes:

- `http://192.168.7.59:8088/install.sh`
- `http://192.168.7.59:8088/install.ps1`
- `http://192.168.7.59:8088/install.cmd`
- `http://192.168.7.59:8088/`
- `http://192.168.7.59:8088/suite`

If and only if you run external Nginx, that external proxy should forward
`https://example.com/*` to internal ingress `http://<sven-host>:8088`
using a thin `location /` pass-through.

## One-liners

```sh
curl -fsSL https://example.com/install.sh | sh
```

```powershell
iwr -useb https://example.com/install.ps1 | iex
```

```cmd
curl -fsSL https://example.com/install.cmd -o install.cmd && install.cmd && del install.cmd
```

## Override variables (optional)

The installer scripts accept:

- `SVEN_REPO_URL`
- `SVEN_BRANCH`
- `SVEN_INSTALL_DIR`
- `SVEN_GATEWAY_URL`
- `SVEN_INSTALLER_DRY_RUN=1`
- `SVEN_INSTALL_BOOTSTRAP=1`

## What The Installers Actually Do

All three installers follow the same contract:

1. check prerequisites:
   - `git`
   - `node`
   - `npm`
2. clone or update the Sven repo into `SVEN_INSTALL_DIR`
3. checkout `SVEN_BRANCH` or default to `main`
4. run a global CLI install from `packages/cli`
5. optionally run:
   - `sven install`
   - `sven doctor`
   only when `SVEN_INSTALL_BOOTSTRAP=1`

Default install directory:

- Unix: `$HOME/.sven-src`
- Windows: `%USERPROFILE%\.sven-src`

## Recommended Release Pinning

If you are installing from a GitHub release, override `SVEN_BRANCH` to a release tag or exact commit instead of relying on `main`.

Examples:

```sh
SVEN_BRANCH=v0.1.0 curl -fsSL https://example.com/install.sh | sh
```

```powershell
$env:SVEN_BRANCH='v0.1.0'; iwr -useb https://example.com/install.ps1 | iex
```

See also:

- [github-release-install-guide-2026.md](github-release-install-guide-2026.md)

## Ops shortcuts (shell)

Run cross-domain smoke checks:

```sh
sh scripts/ops/sh/ops.sh ingress smoke-47matrix
```

Publish quickstart files and immediately smoke-check both domains:

```sh
sh scripts/ops/sh/ops.sh ingress quickstart-publish-smoke /opt/sven/quickstart example.com app.example.com
```

