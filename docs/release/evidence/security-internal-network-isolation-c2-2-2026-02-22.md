# C2.2 Internal Service Communication Isolation (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Decision

This checklist row is satisfied via Docker network isolation (instead of mTLS), using segmented bridge networks for internal service communication.

## Evidence

- `docker-compose.yml` defines dedicated networks:
  - `core` (`sven-core`)
  - `tools` (`sven-tools`)
  - `rag` (`sven-rag`)
  - `monitoring` (`sven-monitoring`)
- Services are attached only to required network segments, limiting east-west reachability by role.

## Notes

- Some services intentionally publish host ports for operator access and external ingress; this does not negate internal segmentation between container networks.
- mTLS is not currently configured between internal services; isolation control for this row is network segmentation.
