---
name: prompt-compressor
description: Compress long prompts and contexts while preserving semantic meaning — reduce token count without losing information.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user has a long prompt or context that needs to be shorter, or when hitting token limits.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [compress, decompress_plan, benchmark]
    text:
      type: string
    target_ratio:
      type: number
      description: Target compression ratio (0.0-1.0). E.g. 0.5 means halve the token count.
    preserve_code:
      type: boolean
  required: [action, text]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# prompt-compressor

Compresses long contexts while preserving semantic information.
Uses multiple techniques: abbreviation, structure extraction,
key-phrase retention, and whitespace optimization.
