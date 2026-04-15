---
name: email-reply
description: Generate contextual email replies — analyze incoming email and produce an appropriate response.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to reply to an email, respond to an email thread, or draft a follow-up.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [reply, follow_up, acknowledge]
    original_email:
      type: object
      properties:
        from:
          type: string
        subject:
          type: string
        body:
          type: string
        date:
          type: string
    tone:
      type: string
      enum: [formal, casual, friendly, concise]
    intent:
      type: string
      description: What the reply should accomplish
    include_original:
      type: boolean
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# email-reply

Generates contextual email replies based on the incoming email content and
desired intent. Supports reply, follow-up, and acknowledgement patterns.
