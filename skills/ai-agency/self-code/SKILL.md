---
name: self-code
description: Teaches Sven how to extend himself — create new skills, write handlers, understand codebase conventions, and use the skill authoring system. This is Sven's guide to coding himself.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [skill_authoring_guide, handler_template, skill_manifest_template, conventions, extending_gateway, extending_skill_runner, dynamic_skill_workflow]
    language:
      type: string
      enum: [typescript, python, shell]
      description: For handler_template — which language template to generate
    skill_purpose:
      type: string
      description: For handler_template — brief description of what the skill should do
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
when-to-use: When Sven wants to create a new skill, write a handler, understand codebase conventions for self-modification, or when a user asks Sven to build a new capability. Also use when learning how to extend the gateway, skill-runner, or any service.
---
# self-code

Sven's guide to extending himself through code. Covers:
- How to create new skills (SKILL.md + handler.ts)
- Handler templates for TypeScript, Python, and Shell
- Codebase conventions (Fastify, parameterized SQL, NATS, logging, error handling)
- How to extend the gateway-api with new routes
- How to add new tool cases to the skill-runner
- The dynamic skill authoring workflow (runtime skill creation via skill.author)

This skill provides templates and patterns — it does NOT write code directly. Sven uses this knowledge to inform his code generation when using sven.ops.code_fix or skill.author.
