# Email (Generic IMAP/SMTP) Skill

Send/search/list email via a bridge service that speaks IMAP/SMTP or a vendor API.

## Usage
Send:
```json
{
  "action": "send",
  "to": ["user@example.com"],
  "subject": "Hello",
  "body": "This is a test message."
}
```

Search:
```json
{
  "action": "search",
  "query": "from:billing@example.com invoice",
  "limit": 10
}
```

List inbox:
```json
{
  "action": "list",
  "limit": 10
}
```

## Environment Variables
- `EMAIL_API_BASE` (required)
- `EMAIL_API_KEY` (optional)
- `EMAIL_FROM` (optional)

## Notes
The bridge should expose `/send`, `/search`, and `/inbox` endpoints. This skill is provider-agnostic.
