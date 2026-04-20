---
skill: agent-workflow-templates
name: Agent Workflow Templates
version: 1.0.0
description: Reusable workflow templates with steps, triggers, and execution tracking
author: sven-autonomous-economy
archetype: orchestrator
tags: [workflows, templates, automation, triggers, pipelines]
price: 0
currency: 47Token
actions:
  - workflow_create_template
  - workflow_add_step
  - workflow_add_trigger
  - workflow_execute
  - workflow_pause_resume
  - workflow_get_status
  - workflow_report
---

# Agent Workflow Templates

Reusable workflow templates with ordered steps, configurable triggers,
execution tracking, and step-level result recording.

## Actions

### workflow_create_template
Create a new workflow template.
- **Input**: name, category, description, inputSchema, outputSchema
- **Output**: templateId, name, category, version, status

### workflow_add_step
Add a step to a workflow template.
- **Input**: templateId, stepOrder, name, action, inputMapping, retryCount
- **Output**: stepId, name, stepOrder, action

### workflow_add_trigger
Add a trigger to a workflow template.
- **Input**: templateId, triggerType, triggerConfig
- **Output**: triggerId, triggerType, isActive

### workflow_execute
Execute a workflow template.
- **Input**: templateId, inputData, triggerId
- **Output**: executionId, status, totalSteps, startedAt

### workflow_pause_resume
Pause or resume a workflow execution.
- **Input**: executionId, action (pause/resume)
- **Output**: executionId, status, currentStep

### workflow_get_status
Get workflow execution status.
- **Input**: executionId
- **Output**: status, currentStep, totalSteps, stepResults[]

### workflow_report
Generate workflow usage report.
- **Input**: templateId, dateRange
- **Output**: totalExecutions, successRate, avgDuration, topFailures
