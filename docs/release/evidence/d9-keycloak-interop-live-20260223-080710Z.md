# D9 Keycloak OIDC Live Interop Evidence (2026-02-23)

- Generated: 2026-02-23T08:07:12.179Z
- Result: PASS
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
- Exit status: 0

```text
[sso:keycloak] starting smoke interop
[sso:keycloak] api=http://127.0.0.1:3001
[sso:keycloak] keycloak=http://127.0.0.1:8081 realm=sven
[sso:keycloak] acquired admin bearer
[sso:keycloak] created account 19de8877-4bf0-40f7-b1ed-e8db765aabef
[sso:keycloak] tenant SSO config applied
[sso:keycloak] oidc/start succeeded
[sso:keycloak] keycloak login produced authorization code
[sso:keycloak] oidc/callback succeeded
[sso:keycloak] success: live keycloak OIDC interop validated end-to-end
```
