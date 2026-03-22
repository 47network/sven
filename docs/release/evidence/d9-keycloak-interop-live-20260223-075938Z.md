# D9 Keycloak OIDC Live Interop Evidence (2026-02-23)

- Generated: 2026-02-23T07:59:38.999Z
- Result: FAIL
- Auto-start IdP: no

## Environment

- API_URL: http://127.0.0.1:3001
- KEYCLOAK_BASE_URL: (default http://127.0.0.1:8081)
- KEYCLOAK_REALM: (default sven)
- KEYCLOAK_CLIENT_ID: (default sven-gateway)
- TEST_BEARER_TOKEN: 1111...11
- TEST_SESSION_COOKIE: (unset)

## Steps

### keycloak_interop_smoke

- Command: `node scripts\sso-keycloak-interop-smoke.cjs`
- Exit status: 1

```text
[sso:keycloak] starting smoke interop
[sso:keycloak] api=http://127.0.0.1:3001
[sso:keycloak] keycloak=http://127.0.0.1:8081 realm=sven
[sso:keycloak] acquired admin bearer
```

```text
[sso:keycloak] failed: create account failed (404)
```
