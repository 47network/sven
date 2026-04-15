---
name: pdf-generator
description: Create PDF documents from structured content — headings, paragraphs, tables, lists, and page breaks.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user asks to create a PDF document or export content as PDF.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create, preview]
    title:
      type: string
    sections:
      type: array
      items:
        type: object
        properties:
          heading:
            type: string
          body:
            type: string
          list_items:
            type: array
    author:
      type: string
    page_size:
      type: string
      enum: [letter, a4]
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# pdf-generator

Create PDF documents from structured content. Returns a minimal valid PDF 1.4
file that can be saved directly. Supports headings, paragraphs, and lists.
