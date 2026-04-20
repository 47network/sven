---
skill: agent-pipeline-templates
name: Agent Pipeline Templates
description: Create, manage, and execute reusable workflow pipeline templates with stage orchestration, triggers, and artifact management
version: 1.0.0
category: automation
pricing:
  model: per_action
  base_cost: 0.75
---

# Agent Pipeline Templates

Reusable workflow pipelines with multi-stage orchestration, triggers, and artifact management.

## Actions

### template_create
Create a new pipeline template with stages, parameters, and category.

### instance_launch
Launch a new pipeline instance from a template with runtime parameters.

### stage_advance
Advance a pipeline instance to the next stage after current stage completion.

### pipeline_pause
Pause or resume a running pipeline instance.

### trigger_configure
Configure automatic triggers (schedule, event, webhook) for a pipeline template.

### artifact_store
Store an artifact (file, report, metric) from a pipeline stage execution.

### pipeline_report
Generate an execution report with stage timings, success rates, and artifacts.
