# Canvas PWA + Web Push (VPN-first)

This enables installable Canvas on mobile/desktop browsers and Web Push notifications for:
- approvals pending
- system alerts
- buddy digests (when emitted as `notify.push`)

## 1) Generate VAPID keys

Run once:

```bash
npx web-push generate-vapid-keys
```

## 2) Configure env vars

Set on `notification-service`:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT` (for example: `mailto:ops@example.com`)

Set on `canvas-ui`:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`

## 3) Runtime behavior

- Canvas registers `/sw.js` service worker.
- User enables notifications from Canvas sidebar (`Notify` button).
- Browser push subscription is stored through `POST /v1/push/register` with platform `web`.
- Notification service delivers:
  - Expo push to `platform=expo`
  - Web Push to `platform=web`

For stale browser subscriptions (HTTP `404/410`), tokens are auto-pruned.

## 4) Deep-link approvals

- Approval notifications carry `action_url` to approvals.
- Service worker click opens Canvas approvals page.
- If `deep_link_token` is present, it is appended as `?token=...` and exchanged by gateway `/v1/auth/token-exchange`.
- Notification actions `Approve` / `Deny` call `POST /v1/approvals/:id/vote` directly.

## 5) Verify

1. Log into Canvas.
2. Click `Install`.
3. Click `Notify` and allow browser notifications.
4. Trigger a test event:
   - pending approval (`approval.pending`)
   - or `notify.push` with high priority
5. Confirm notification appears and click action/deep link.
