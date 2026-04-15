---
name: video-generator
description: Create videos programmatically — marketing videos, data visualizations, social media content, tutorials, and brand videos using ffmpeg-based rendering with declarative JSON composition specs.
version: 1.0.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["create_video","list_templates","render","get_status","cancel","preview","get_stats"],"default":"list_templates"},"description":{"type":"string","description":"Natural language description of the video to create (for create_video action)"},"template":{"type":"string","enum":["social_media","data_dashboard","product_showcase","tutorial","brand"],"description":"Pre-built template domain to use"},"aspect_ratio":{"type":"string","enum":["16:9","9:16","1:1","4:3"],"default":"16:9"},"spec":{"type":"object","description":"Full VideoSpec JSON override (optional, for advanced users)"},"job_id":{"type":"string","description":"Render job ID (for get_status, cancel actions)"},"org_id":{"type":"string","description":"Organization ID"},"user_id":{"type":"string","description":"User ID"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
when-to-use: Use when the user wants to create a video, generate video content, make a social media clip, build a data visualization animation, produce a product showcase, create tutorial videos, or render brand content.
---

# Video Generator Skill

Create videos programmatically using ffmpeg-based rendering with declarative JSON composition specs. Supports natural language descriptions converted to video specs via LLM, 5 pre-built templates, async render queue, and preview generation.

## Actions

- `create_video` — Generate a VideoSpec from natural language description and queue for rendering
- `list_templates` — List available pre-built video templates
- `render` — Queue a VideoSpec for rendering (manual spec input)
- `get_status` — Check the status of a render job
- `cancel` — Cancel a pending or rendering job
- `preview` — Generate a single-frame preview image of a video spec
- `get_stats` — Get aggregate video rendering statistics

## Templates

| Domain | Name | Aspect | Description |
|--------|------|--------|-------------|
| `social_media` | Social Media Post | 9:16 | Short-form vertical video (hook → body → CTA) |
| `data_dashboard` | Data Dashboard | 16:9 | Animated metrics and data visualization |
| `product_showcase` | Product Showcase | 16:9 | Professional product presentation with features |
| `tutorial` | Tutorial | 16:9 | Step-by-step walkthrough with numbered steps |
| `brand` | XLVII Brand | 16:9 | XLVII branded content with brand palette |

## Architecture

- **Engine**: `services/agent-runtime/src/video-engine.ts`
- **Rendering**: ffmpeg-based — color backgrounds + drawtext filters + xfade transitions
- **Composition**: Declarative JSON VideoSpec → ffmpeg filter_complex → MP4/WebM
- **NL Pipeline**: Description → LLM → VideoSpec JSON → render
- **Queue**: In-memory async render queue (100 cap, LRU eviction)
- **Storage**: Output files stored via existing media upload pipeline

## Examples

- "Create a social media video about our new product launch" → `{ action: "create_video", description: "...", template: "social_media" }`
- "Show me available video templates" → `{ action: "list_templates" }`
- "Check on my video render" → `{ action: "get_status", job_id: "vid_1" }`

## Scope Mapping
- `design.video`: **write** (generates video files)
- `design.video.render`: **execute** (triggers ffmpeg render)
