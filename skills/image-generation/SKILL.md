---
name: image-generation
description: Generate images via OpenAI (DALL-E / gpt-image-1) or Stable Diffusion (AUTOMATIC1111-compatible) endpoints.
version: 2026.2.21
publisher: Local Publisher
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"prompt":{"type":"string"},"provider":{"type":"string","enum":["openai","stable_diffusion"],"default":"openai"},"size":{"type":"string","enum":["256x256","512x512","1024x1024","1024x768","768x1024"],"default":"1024x1024"},"n":{"type":"integer","minimum":1,"maximum":4,"default":1},"style":{"type":"string","default":""}},"required":["prompt"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"provider":{"type":"string"},"model":{"type":"string"},"images":{"type":"array","items":{"type":"object","properties":{"data_url":{"type":"string"},"seed":{"type":"number"},"width":{"type":"number"},"height":{"type":"number"}},"required":["data_url"]}}},"required":["images"]}
---

# Image Generation Skill

Generate images from text prompts using either OpenAI's image generation APIs or a Stable Diffusion endpoint (AUTOMATIC1111-compatible).

## Configuration
- OpenAI:
  - `OPENAI_API_KEY` (required)
  - `OPENAI_IMAGE_MODEL` (optional, default `gpt-image-1`)
- Stable Diffusion (AUTOMATIC1111):
  - `STABLE_DIFFUSION_URL` (optional, default `http://127.0.0.1:7860`)
  - `STABLE_DIFFUSION_API_KEY` (optional, for reverse proxies)

## Approval Policy
Image generation produces new media artifacts and can incur external API costs. Treat this as **write** scope and require user approval when cost controls or restricted content policies apply.

## Egress / Network Policy
- Allowlist:
  - `api.openai.com`
  - Host for `STABLE_DIFFUSION_URL`
- Denylist:
  - Any other outbound domains

## Scope Mapping
- `image.generate`: **write** (creates media artifacts)
- `image.generate.safe`: **write** (same scope, but enforce safe prompt policies if configured)

## Notes
This skill returns data URLs by default for easy rendering in clients. Persist outputs to object storage if needed.
