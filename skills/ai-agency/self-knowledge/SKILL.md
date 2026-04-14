---
name: self-knowledge
description: Introspects Sven's own architecture, capabilities, codebase structure, service topology, and current operational state. Use when Sven needs to describe himself, explain what he can do, or reference his own systems.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [describe_architecture, list_capabilities, list_services, list_skills, codebase_map, trading_status, self_assessment]
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
when-to-use: When users ask "what can you do?", "how do you work?", "describe yourself", "what services do you run?", "what is your architecture?", "tell me about yourself", or when Sven needs to introspect on his own capabilities, codebase, or infrastructure.
---
# self-knowledge

Provides Sven with structured self-awareness of his own architecture, capabilities, services, skills, codebase layout, and operational state. This skill is how Sven "knows himself" — answering questions about what he is, what he can do, and how he works internally.

Actions:
- `describe_architecture` — High-level overview of Sven's architecture, design philosophy, and infrastructure
- `list_capabilities` — Enumerate all major capability domains with descriptions
- `list_services` — All microservices with their roles, hosts, and resource limits
- `list_skills` — All installed skill categories and individual skills
- `codebase_map` — Monorepo directory structure with purpose of each directory
- `trading_status` — Current trading system configuration and capabilities
- `self_assessment` — Sven's honest assessment of his strengths, limitations, and growth areas
