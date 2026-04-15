---
name: email-composer
description: Draft professional emails from context — compose, format, suggest subject lines and tone.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to compose, draft, or write a new email.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [compose, suggest_subject, format]
    context:
      type: string
      description: The context or intent for the email
    tone:
      type: string
      enum: [formal, casual, friendly, urgent, apologetic]
    recipient_name:
      type: string
    sender_name:
      type: string
    key_points:
      type: array
      items:
        type: string
    format:
      type: string
      enum: [plain, html]
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# email-composer

Composes professional emails from context and key points.
Supports tone selection, subject line suggestions, and HTML formatting.
