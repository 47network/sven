# litellm

**LiteLLM Proxy**

Unified LLM provider proxy. Exposes a single OpenAI-compatible API that routes to any configured provider: OpenAI, Anthropic, Google, Mistral, Ollama, LM Studio, and more. Also handles embedding requests.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

None (standalone)

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
LITELLM_CONFIG_PATH (YAML with model definitions and API keys)
```

## Running

```bash
# Via Docker Compose
docker compose up -d litellm

# Bare metal
npm --workspace services/litellm run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
