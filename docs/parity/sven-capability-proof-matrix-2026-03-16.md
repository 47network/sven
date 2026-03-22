# Sven Capability Proof Matrix (Competitor-Grade)

Date: 2026-03-16  
Scope: OpenClaw + Agent Zero parity confidence based on local machine evidence only

## Status Scale

- `proven-pass`: backed by executable checks and fresh status/evidence artifacts.
- `partial`: implemented/documented, but runtime proof is incomplete/stale/inconsistent.
- `unproven`: no reliable runtime proof in current local evidence.

## Confidence Rules

- Documentation claims are not enough by themselves.
- A capability is `proven-pass` only when test/CI + status/evidence are bound.

## Domain Matrix

| Domain | OpenClaw Parity Confidence | Agent Zero Parity Confidence | Evidence Basis |
|---|---|---|---|
| Core runtime/gateway | partial | partial | parity docs + release status pass lanes; no full feature-by-feature executable map |
| Channels/adapters | partial | proven-pass | many adapters documented; no consolidated adapter E2E ledger for all OC channels |
| Tool execution/browser | partial | partial | browser/tool lanes exist; not all competitor-specific behaviors proven with fresh artifacts |
| Memory/RAG/context | partial | partial | implemented broadly; strict feature-level proof matrix missing |
| Multi-agent/workflows | partial | partial | implemented and documented; no complete competitor behavior replay suite artifact |
| Security/governance | proven-pass | proven-pass | release policy gates + hardening artifacts + parity checklist verify pass |
| UI/operability | partial | partial | major UI surfaces exist; benchmark/runtime UX proofs are not complete per-competitor domain |
| Deploy/ops/release readiness | proven-pass (except soak) | proven-pass (except soak) | strict release status now blocked only by soak completion |

## Bottom Line

- We cannot honestly claim “100% everything competitors can do” yet.
- Current state is strong, but still mixed between `proven-pass` and `partial`.
- Release readiness is currently soak-gated, not architecture-gated.

## Required to Reach 100% Claim

1. Create a feature-to-test binding ledger for each competitor feature row.
2. Add fresh runtime artifacts per domain (<=72h) for every claimed parity area.
3. Add mandatory CI gates for competitor-domain suites (channels, tools, memory, multi-agent).
4. Fail parity status if any claimed capability lacks executable proof.

## Immediate Next Execution Set

1. Build `competitor-baseline-manifest.json` and wire it into both parity comparison docs.
2. Add domain E2E proof packs:
   - channel adapters
   - browser/tool behaviors
   - memory/RAG behaviors
   - multi-agent workflow behaviors
3. Emit a machine-readable proof status artifact and gate release status on it.

