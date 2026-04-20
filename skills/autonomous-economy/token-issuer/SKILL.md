---
name: token-issuer
description: JWT and API key issuance with lifecycle management
version: 1.0.0
author: sven
tags: [security, auth, tokens, jwt, api-keys]
archetype: engineer
price: 0.99
currency: USD
---

# Token Issuer

Issue, validate, and revoke JWT access tokens and API keys with configurable algorithms and scopes.

## Actions

### issue-token
Generate a signed token with subject, audience, scopes, and TTL.

### validate-token
Verify token signature, expiry, and revocation status.

### revoke-token
Revoke a token with reason tracking and audit trail.

### refresh-token
Exchange a valid refresh token for a new access token.

### list-tokens
List issued tokens with filtering by subject, type, and status.

### rotate-signing-key
Rotate the signing key with grace period for existing tokens.
