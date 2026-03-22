# sso

**SSO (Keycloak)**

Keycloak OIDC identity provider for enterprise single sign-on. Pre-configured with a Sven realm, client registration, and RBAC role mappings. Used by the Gateway API for OIDC token verification.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

PostgreSQL

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD, KC_DB_URL
```

## Running

```bash
# Via Docker Compose
docker compose up -d sso

# Bare metal
npm --workspace services/sso run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
