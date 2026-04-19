---
name: runbook-executor
version: 1.0.0
description: Executes automated runbooks with step-by-step orchestration and rollback
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [runbook, automation, orchestration, steps, rollback, remediation]
---

# Runbook Executor

Executes multi-step automated runbooks with sandboxed execution, step-by-step
progress tracking, conditional branching, and automatic rollback on failure.

## Actions

- **create-runbook**: Define a new runbook with steps
- **execute-runbook**: Start runbook execution
- **get-execution**: Get execution status and step results
- **list-runbooks**: List all defined runbooks
- **cancel-execution**: Cancel a running execution
- **clone-runbook**: Clone and modify an existing runbook

## Inputs

- `runbookName` — Human-readable runbook name
- `steps` — Array of step definitions with actions and conditions
- `triggerConditions` — Auto-trigger conditions
- `timeoutSeconds` — Maximum execution time
- `sandboxEnabled` — Run in isolated sandbox

## Outputs

- `runbookId` — Created runbook identifier
- `executionId` — Execution instance identifier
- `status` — pending, running, completed, failed, cancelled, or timed_out
- `currentStep` — Current step index
- `stepResults` — Array of step execution results
