# D9 Keycloak Interop Preflight

- Generated: 2026-02-23T08:28:47.908Z
- Status: PASS
- With IdP: yes
- Strict: yes

## Checks

- [x] node_version_gte_20: node=24.12.0
- [x] gateway_health_reachable: status=200
- [x] admin_auth_source_present: TEST_BEARER_TOKEN set
- [x] admin_auth_source_valid: bearer /v1/auth/me status=200
- [x] keycloak_well_known_reachable: status=200
