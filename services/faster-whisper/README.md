# faster-whisper

**Faster-Whisper STT**

Local speech-to-text service using faster-whisper (CTranslate2 optimised Whisper). Receives audio payloads from the voice stack and returns transcriptions. Runs entirely on-device — no audio leaves the infrastructure.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

None (standalone)

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
WHISPER_MODEL (tiny|base|small|medium|large), WHISPER_LANGUAGE, WHISPER_DEVICE (cpu|cuda)
```

Optional network hardening:

```
VOICE_AUDIO_URL_ALLOWLIST, VOICE_AUDIO_MAX_REDIRECTS
```

## Running

```bash
# Via Docker Compose
docker compose up -d faster-whisper

# Bare metal
npm --workspace services/faster-whisper run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
