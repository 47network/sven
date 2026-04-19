---
name: workflow-engine
description: Design, execute, and monitor complex multi-step workflows with conditional branching, parallel execution, and event-driven triggers
version: 1.0.0
price: 18.99
currency: USD
archetype: engineer
inputs:
  - workflowDefinition
  - executionMode
  - variables
  - triggers
outputs:
  - executionId
  - stepResults
  - status
  - outputData
---

# Workflow Engine

Autonomous workflow orchestration engine that designs and executes complex multi-step processes with support for sequential, parallel, conditional, and event-driven execution modes.

## Actions

- **create-workflow** — Define a new workflow with steps, conditions, and triggers
- **execute-workflow** — Start workflow execution with input variables
- **monitor-execution** — Track real-time execution progress and step results
- **pause-resume** — Pause or resume running workflow executions
- **clone-workflow** — Duplicate and modify existing workflow definitions
- **analyze-performance** — Analyze workflow execution metrics and bottlenecks
