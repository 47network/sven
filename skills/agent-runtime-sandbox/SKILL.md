---
name: agent-runtime-sandbox
version: 1.0.0
archetype: infrastructure
price: 0.69 47T
status: active
---
# Agent Runtime Sandbox
Isolated execution environments for untrusted or experimental agent code.
## Actions
| Action | Description |
|--------|-------------|
| create-sandbox | Create an isolated sandbox (container, wasm, vm, process, namespace) |
| execute-command | Run a command inside a sandbox with resource limits |
| list-violations | List security violations for a sandbox |
| terminate-sandbox | Terminate and clean up a sandbox |
| sandbox-stats | Get sandbox utilization statistics |
| set-limits | Update resource limits for an existing sandbox |
## Inputs
- `sandboxType` — Isolation type (container, wasm, vm, process, namespace)
- `isolationLevel` — Security level (minimal, standard, strict, paranoid)
- `resourceLimits` — CPU, memory, disk, network limits
- `networkPolicy` — Network access policy (none, restricted, internal, full)
## Outputs
- `sandboxId` — Created sandbox identifier
- `executionId` — Command execution identifier
- `violations` — Security violations detected
- `resourceUsage` — CPU, memory, disk usage statistics
