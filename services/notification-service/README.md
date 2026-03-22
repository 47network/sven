# notification-service

**Notification Service**

Delivers push notifications (Expo Push + Web Push), emails, and in-app alerts. Receives notification commands from Gateway and agent-runtime via NATS and fans them out to configured delivery channels.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, Expo Push API, Web Push (VAPID), SMTP

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```bash
EXPO_PUSH_URL, WEB_PUSH_ENABLED, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, WEB_PUSH_VAPID_SUBJECT, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
```

## Running

```bash
# Via Docker Compose
docker compose up -d notification-service

# Bare metal
npm --workspace services/notification-service run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
