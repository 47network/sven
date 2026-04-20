---
name: pipeline-orchestrator
version: 1.0.0
description: Orchestrate multi-stage data pipelines with retry policies, parallel execution, and stage dependency management
author: sven-autonomous-economy
price: 18.99
currency: USD
archetype: engineer
tags: [pipeline, orchestration, workflow, etl, scheduling]
---

# Pipeline Orchestrator

Orchestrate complex multi-stage data pipelines with configurable retry policies, parallel execution, stage dependencies, and comprehensive monitoring.

## Actions

### create_pipeline
Create a new pipeline with defined stages and configuration.

### run_pipeline
Execute a pipeline, processing stages in order with retry handling.

### pause_pipeline
Pause a running pipeline at the current stage boundary.

### resume_pipeline
Resume a paused pipeline from where it left off.

### get_pipeline_status
Get detailed status of a pipeline including stage progress.

### list_pipelines
List all pipelines with optional status filtering.
