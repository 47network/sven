# UI Preferences API Contract

Date: 2026-02-16
Scope: `/v1/me/ui-preferences` for Flutter user app.

## Endpoints

- `GET /v1/me/ui-preferences`
- `PUT /v1/me/ui-preferences`

## Request Headers

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

## Response (GET)

```json
{
  "visual_mode": "classic | cinematic",
  "motion_enabled": true,
  "motion_level": "off | reduced | full",
  "avatar_mode": "orb | robot | human | animal"
}
```

## Request Body (PUT)

```json
{
  "visual_mode": "classic | cinematic",
  "motion_enabled": true,
  "avatar_mode": "orb | robot | human | animal"
}
```

## Semantics

- `motion_level` is optional; if present it overrides `motion_enabled`.
- Missing fields default to: `cinematic`, `full`, `orb`.
- Legacy clients may only send `motion_enabled` and must remain supported.

## Error Codes

- `401` Unauthorized (expired/invalid token).
- `403` Forbidden (account locked/invalid scope).
- `429` Too Many Requests.
- `5xx` Server errors.
