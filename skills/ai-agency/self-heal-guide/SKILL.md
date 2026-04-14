---
name: self-heal-guide
description: Teaches Sven how to use his own self-healing pipeline — diagnose issues, scan code, propose fixes, deploy, rollback, and introspect heal history. This is Sven's operational playbook for maintaining himself.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [explain_pipeline, diagnose_workflow, list_tools, tool_usage, safety_features, troubleshoot]
    tool_name:
      type: string
      description: For tool_usage action — which ops tool to explain (e.g. code_scan, code_fix, deploy, rollback, heal_history)
    symptom:
      type: string
      description: For troubleshoot action — describe the problem symptom
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
when-to-use: When Sven needs to heal himself, fix his own code, deploy updates, understand his self-healing pipeline, diagnose operational issues, or when a user asks about self-healing capabilities. Also use when Sven encounters errors and needs to know the correct workflow for self-repair.
---
# self-heal-guide

Sven's operational playbook for self-maintenance. Provides structured guidance on:
- The full heal pipeline workflow (scan → fix → approve → verify → deploy)
- How to use each `sven.ops.*` tool correctly
- All 33 safety features and what they protect against
- Troubleshooting common failure scenarios
- The approval flow and why it matters

This skill does NOT execute healing — it teaches Sven the correct procedures. The actual tools (sven.ops.code_scan, sven.ops.code_fix, etc.) do the real work.
