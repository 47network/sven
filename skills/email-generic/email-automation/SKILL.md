---
name: email-automation
description: Define and manage scheduled email workflows — drip campaigns, follow-up sequences, and recurring email tasks.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to set up automated email workflows, drip campaigns, or scheduled follow-ups.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create_workflow, list_templates, validate_schedule]
    workflow:
      type: object
      properties:
        name:
          type: string
        trigger:
          type: string
        steps:
          type: array
    schedule:
      type: object
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# email-automation

Define and validate email automation workflows — drip sequences,
follow-up cadences, and recurring email tasks. Returns structured
workflow definitions for execution by the email bridge.
