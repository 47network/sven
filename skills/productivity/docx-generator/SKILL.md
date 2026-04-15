---
name: docx-generator
description: Create Word-compatible documents (.docx) from structured content — headings, paragraphs, tables, lists, and styled text.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user asks to create a Word document, DOCX file, or formatted text document with structured content.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create, template_list, preview]
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
          level:
            type: number
          list_items:
            type: array
          table:
            type: object
    author:
      type: string
    template:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# docx-generator

Create Word-compatible documents with headings, paragraphs, tables, and lists.
Returns an Open XML (DOCX) document structure that can be saved or transmitted.
