# Image Generation Skill

Generate images from text prompts using either OpenAI or a Stable Diffusion (AUTOMATIC1111-compatible) endpoint.

## Usage
Example inputs:

```json
{
  "prompt": "a cozy cabin in the snowy woods at dusk, cinematic lighting",
  "provider": "openai",
  "size": "1024x1024",
  "n": 1
}
```

```json
{
  "prompt": "retro futurism skyline, neon, rain",
  "provider": "stable_diffusion",
  "size": "768x1024",
  "style": "vaporwave"
}
```

## Outputs
The handler returns an `images` array with `data_url` values (base64 PNG).

## Environment Variables
- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (default: `gpt-image-1`)
- `STABLE_DIFFUSION_URL` (default: `http://127.0.0.1:7860`)
- `STABLE_DIFFUSION_API_KEY` (optional)

## Notes
This skill only uses outbound HTTPS to the configured providers. Store outputs in object storage if needed.
