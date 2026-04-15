# Multi-VM Deployment Runbook

## Overview

This runbook covers deployment, restart, and health verification procedures
for the Sven multi-VM production environment.

## VM Topology

| VM | Role | Compose File |
|:---|:-----|:-------------|
| VM4 | Core platform (gateway, agent-runtime, postgres, NATS) | `docker-compose.yml` |
| VM5 | AI inference (Ollama, vLLM, model-router) | `docker-compose.vm5-ai.yml` |
| VM7 | Messaging adapters (all 20 channels) | `docker-compose.vm7-adapters.yml` |
| VM13 | GPU overflow (RTX 3060) | `docker-compose.yml` (VM13 profile) |

## Restart Procedures

### Ordered Restart — VM5 (AI Services)

```bash
# 1. Stop AI services
ssh vm5 "cd /opt/sven && docker compose -f docker-compose.vm5-ai.yml down"

# 2. Restart with health wait
ssh vm5 "cd /opt/sven && docker compose -f docker-compose.vm5-ai.yml up -d --wait"

# 3. Verify health
npm run release:multi-vm:restart:health:check
```

### Ordered Restart — VM7 (Adapters)

```bash
# 1. Stop adapter services
ssh vm7 "cd /opt/sven && docker compose -f docker-compose.vm7-adapters.yml down"

# 2. Restart with health wait
ssh vm7 "cd /opt/sven && docker compose -f docker-compose.vm7-adapters.yml up -d --wait"

# 3. Verify health
npm run release:multi-vm:restart:health:check
```

## Release Gate Verification

### Restart Health Check

```bash
npm run release:multi-vm:restart:health:check
```

Validates that all services on VM5 and VM7 have healthchecks defined and
respond correctly after a restart sequence.

### VM Restart Drill

```bash
# Dry run (check only)
npm run ops:release:vm-restart-drill:strict

# Execute actual restart drill
npm run ops:release:vm-restart-drill:execute

# Verify drill evidence
npm run release:vm-restart:drill:evidence:check
```

The restart drill performs:
1. Ordered stop of `docker-compose.vm5-ai.yml` services
2. Ordered stop of `docker-compose.vm7-adapters.yml` services
3. Restart VM7 with `up -d --wait`
4. Restart VM5 with `up -d --wait`
5. Health check all services
6. Record evidence JSON

## Troubleshooting

### Service fails healthcheck after restart

1. Check container logs: `docker logs <container> --tail 100`
2. Verify env vars are set: `docker exec <container> env | grep SVEN`
3. Check dependent services are reachable (postgres, NATS)
4. Restart individual service: `docker compose restart <service>`

### GPU not available after VM5 restart

1. Verify NVIDIA driver: `nvidia-smi`
2. Check Docker GPU runtime: `docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi`
3. Restart Ollama: `docker compose -f docker-compose.vm5-ai.yml restart ollama`
