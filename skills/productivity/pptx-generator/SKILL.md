---
name: pptx-generator
description: Create PowerPoint-compatible presentations (.pptx) with slides, titles, bullet points, and speaker notes.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user asks to create a presentation, slide deck, PowerPoint file, or pitch deck.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create, template_list, preview]
    title:
      type: string
    slides:
      type: array
      items:
        type: object
        properties:
          title:
            type: string
          bullets:
            type: array
          body:
            type: string
          notes:
            type: string
          layout:
            type: string
    author:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# pptx-generator

Create PowerPoint-compatible presentations with titled slides, bullet points,
body text, and speaker notes. Returns PresentationML (PPTX) structure.
