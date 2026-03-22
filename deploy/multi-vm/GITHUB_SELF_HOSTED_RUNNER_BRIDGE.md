# GitHub Self-Hosted Runner (Bridge Lanes)

Use this when GitHub-hosted Actions are unavailable or budget-constrained.

## Scope

- Workflow: `bridge-runtime-tests`
- Workflow: `gateway-bridge-contract-tests`
- Manual dispatch target: `runner_target=self-hosted`

## 1) Prepare VM host

```bash
sudo useradd -m -s /bin/bash gha || true
sudo mkdir -p /opt/github-runner
sudo chown -R gha:gha /opt/github-runner
```

Install prerequisites:

```bash
sudo apt-get update
sudo apt-get install -y curl tar jq git ca-certificates
```

## 2) Download runner binary

Run as `gha`:

```bash
cd /opt/github-runner
curl -L -o actions-runner.tar.gz https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz
tar xzf actions-runner.tar.gz
```

## 3) Configure runner

In GitHub repo `47network/thesven`:
- Settings -> Actions -> Runners -> New self-hosted runner
- Copy registration command and run as `gha`.

Use labels:
- `self-hosted`
- `linux`
- `x64`
- `bridge`

## 4) Install as systemd service

Run as `gha` inside `/opt/github-runner`:

```bash
sudo ./svc.sh install gha
sudo ./svc.sh start
sudo ./svc.sh status
```

## 5) Trigger bridge workflows on self-hosted runner

```bash
gh workflow run bridge-runtime-tests.yml -R 47network/thesven --ref <branch> -f runner_target=self-hosted
gh workflow run gateway-bridge-contract-tests.yml -R 47network/thesven --ref <branch> -f runner_target=self-hosted
```

## 6) VM-local authority fallback (no Actions required)

```bash
npm run ops:release:bridge-vm-ci-lanes:strict:skip-remote
```

Artifacts:
- `docs/release/status/bridge-vm-ci-lanes-latest.json`
- `docs/release/status/bridge-vm-ci-lanes-latest.md`

## 7) Security notes

- Use a dedicated non-root runner user (`gha`).
- Keep runner host isolated to CI-only role where possible.
- Rotate/remove old runners and registration tokens after maintenance windows.
