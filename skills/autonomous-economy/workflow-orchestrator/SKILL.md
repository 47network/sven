---
name: workflow-orchestrator
version: 1.0.0
description: Manages complex multi-step agent workflows with branching, parallel execution, and error recovery
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [workflow, orchestration, automation, pipeline, branching, parallel]
---

# Workflow Orchestrator

Orchestrates complex multi-step workflows for agents including conditional branching,
parallel step execution, loops, subprocess invocation, and configurable error handling.

## Actions

- **create-workflow**: Define a new workflow from a step definition graph
- **start-workflow**: Begin executing a workflow instance
- **pause-workflow**: Pause a running workflow for manual review
- **resume-workflow**: Resume a paused workflow
- **get-status**: Get detailed workflow and step status
- **cancel-workflow**: Cancel and clean up a running workflow

## Inputs

- `workflowName` — Human-readable workflow name
- `definition` — JSON workflow graph (steps, conditions, parallel groups)
- `context` — Initial context data passed through steps
- `errorHandling` — Strategy: retry, skip, abort, or fallback
- `timeoutSeconds` — Maximum execution time

## Outputs

- `workflowId` — Created workflow identifier
- `status` — Current workflow status
- `completedSteps` — Array of completed step results
- `currentStep` — Currently executing step name
- `context` — Accumulated context after execution
