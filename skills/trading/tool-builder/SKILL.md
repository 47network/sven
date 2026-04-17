---
name: tool-builder
description: Create, register, and manage custom trading tools and compound workflows. Compose existing skills into multi-step trading automations.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [list_subjects, describe_pipeline, compose_workflow, validate]
    workflow_name:
      type: string
    steps:
      type: array
      items:
        type: object
    symbol:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# tool-builder

Compose multi-step trading workflows from existing skills. Lists NATS subjects, describes the data pipeline, and validates workflow configurations.
