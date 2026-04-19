---
name: oauth-manager
description: OAuth2/OIDC provider with authorization code and client credentials flows
version: 1.0.0
author: sven
tags: [security, oauth, oidc, authorization, pkce]
archetype: engineer
price: 1.99
currency: USD
---

# OAuth Manager

Full OAuth 2.0 and OpenID Connect provider with authorization code (PKCE), client credentials, and device code flows.

## Actions

### register-client
Register an OAuth client with redirect URIs, scopes, and grant types.

### authorize
Initiate authorization code flow with PKCE challenge.

### exchange-code
Exchange authorization code for access and refresh tokens.

### client-credentials
Issue tokens via client credentials flow for service-to-service auth.

### introspect-token
Validate and inspect a token's claims, scopes, and status.

### revoke-grant
Revoke all tokens for a specific grant.
