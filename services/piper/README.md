# piper

**Piper TTS**

Local text-to-speech service using Piper. Converts agent text responses to speech audio. Multiple voice models supported. Runs entirely on-device — no text leaves the infrastructure.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

None (standalone)

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
PIPER_MODEL_PATH, PIPER_VOICE, PIPER_SPEAKER_ID, VOICE_TTS_SIGNING_SECRET
```

## Running

```bash
# Via Docker Compose
docker compose up -d piper

# Bare metal
npm --workspace services/piper run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
